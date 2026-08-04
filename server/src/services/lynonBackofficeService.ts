import { config } from '../config.js';
import { metrikSayisi, netGelir, panoMetrikleri, taninmayanAlanlar } from './lynonPanoMetrikleri.js';
import { kayipTabani } from './kayipTabaniService.js';
import { isLynonConfigured, lynonRequest, LynonHttpError, LynonAuthError } from '../lib/lynonAuth.js';
import { getCachedJsonWithTtl, setCachedJson } from '../lib/redisClient.js';
import { istanbulDateKey } from '../lib/istanbulGunu.js';
import { araligaGoreTtl } from './onbellekOmru.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import {
  ayAraligi,
  ayinManuelKalemleri,
  ayinTamAraligi,
  mutabakatMesaji,
  mutabakatSatirlari,
  mutabakatToplami,
  oncekiAyAnahtari,
  ozetFarki,
  satirlariManuelIleZenginlestir,
  yontemKasaMesaji,
  type ManuelKalem,
} from './mutabakat.js';
import {
  bonusOturumSatiri,
  bonusOzeti,
  mukerrerVerilisler,
  tarihAraligindakiOturumlar,
  type OyuncuAdlari,
} from './bonusOturumRaporu.js';
import { oyuncuBakiyeMesaji, oyuncuBakiyeOzetiCikar } from './oyuncuBakiyeRaporu.js';
import { izinliKisitMi, kisitGovdeleri, type Kisit } from './hedefBakiyeKilidi.js';
import {
  duzeltmeSatiri,
  duzeltmeToplami,
  hesapBazindaOzet,
  tarihAraligindakiDuzeltmeler,
  tarihineGoreSirala,
  yapanBazindaOzet,
  type HamDuzeltme,
  type OyuncuAdlari as DuzeltmeAdlari,
} from './manuelDuzeltmeRaporu.js';
import {
  kategoriGovdeleri,
  kategoriOnerileri,
  merdivenBosluklari,
  seviyeMerdiveni,
  varsayilanSeviye,
  type LynonKategori,
  type OyuncuProfili,
} from './oyuncuKategorileme.js';
import {
  DAVRANIS_KATEGORILERI,
  eksikKategoriler,
  kategoriOlusturmaGovdesi,
  otomatikDavranislar,
} from './davranisKategorileri.js';

type AnyRecord = Record<string, any>;

interface PageParams {
  page: number;
  countPerPage: number;
}

const REPORT_CACHE_TTL_MS = 10 * 60 * 1000;
/**
 * Pano onbellegi artik SABIT DEGIL.
 *
 * Bugunu iceren pencere kisa, tamami gecmiste kalan pencere uzun omurlu
 * (bkz. `onbellekOmru`). Sabit bes dakika, canli rakama bakan operator
 * icin cok uzun; degismeyecek bir gecmis gun icin ise saf israfti.
 */
const AFFILIATE_CACHE_TTL_MS = 15 * 60 * 1000;
let reportCatalogCache: { ts: number; data: AnyRecord[] } | null = null;
type PromiseCacheEntry = { expiresAt: number; value: Promise<unknown> };
const lynonResultCache = new Map<string, PromiseCacheEntry>();

function cachedLynon<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = lynonResultCache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value as Promise<T>;

  /**
   * BAYATLIK IKI KATINA CIKMASIN.
   *
   * Redis'ten alinan deger bellege TAM SURE ile yaziliyordu: Redis
   * kaydinin omrunun 30 saniyesi kalmis olsa bile bellekte 5 dakika daha
   * yasiyor, toplam bayatlik ~10 dakikaya cikabiliyordu. Canli rakama
   * bakan operator icin bu "pano guncellenmiyor" demek.
   *
   * Artik bellek kaydi Redis kaydinin KALAN omruyla yaziliyor; ikisi
   * ayni anda dusuyor.
   */
  // Kayit ONCE kuruluyor; Redis'ten gelen kalan omur uzerine yazilabilsin
  // diye govde ona referansla erisiyor.
  const kayit: PromiseCacheEntry = { expiresAt: Date.now() + ttlMs, value: undefined as unknown as Promise<unknown> };

  const guarded: Promise<T> = (async () => {
    const shared = await getCachedJsonWithTtl<T>(key).catch(() => undefined);
    if (shared !== undefined) {
      if (shared.ttlMs > 0 && lynonResultCache.get(key) === kayit) {
        kayit.expiresAt = Date.now() + Math.min(ttlMs, shared.ttlMs);
      }
      return shared.value;
    }
    const loaded = await loader();
    await setCachedJson(key, loaded, ttlMs).catch((error) => {
      console.warn('[redis-cache] Lynon cache write failed:', error instanceof Error ? error.message : error);
    });
    return loaded;
  })().catch((error) => {
    if (lynonResultCache.get(key) === kayit) lynonResultCache.delete(key);
    throw error;
  });

  kayit.value = guarded;
  lynonResultCache.set(key, kayit);
  if (lynonResultCache.size > 200) {
    const now = Date.now();
    for (const [cacheKey, entry] of lynonResultCache) {
      if (entry.expiresAt <= now) lynonResultCache.delete(cacheKey);
    }
  }
  return guarded;
}

export { isLynonConfigured, LynonHttpError, LynonAuthError };

export function lynonErrorResponse(error: unknown): { status: number; body: AnyRecord } {
  if (error instanceof LynonHttpError || error instanceof LynonAuthError) {
    return {
      status: error.status,
      body: {
        HasError: true,
        AlertMessage: error.message,
        lynon: true,
      },
    };
  }

  return {
    status: 502,
    body: {
      HasError: true,
      AlertMessage: error instanceof Error ? error.message : 'Lynon API istegi basarisiz.',
      lynon: true,
    },
  };
}

function arrayOf(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((item): item is AnyRecord => item != null && typeof item === 'object') : [];
}

function recordOf(value: unknown): AnyRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function numberFrom(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === '') return fallback;
  let text = String(value).trim();
  if (!text) return fallback;
  text = text.replace(/[^\d,.-]/g, '');
  if (!text) return fallback;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma > dot) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolFromStatus(status: unknown): boolean {
  const normalized = String(status ?? '').trim().toLowerCase();
  return ['blocked', 'locked', 'disabled', 'inactive', 'false'].includes(normalized);
}

function pageFromBody(body: AnyRecord = {}): PageParams {
  const countPerPage = Math.max(1, Math.min(500, numberFrom(body.MaxRows ?? body.countPerPage ?? body.Limit ?? 50, 50)));
  const skip = Math.max(0, numberFrom(body.SkeepRows ?? body.Offset ?? 0, 0));
  const page = Math.max(1, numberFrom(body.page, Math.floor(skip / countPerPage) + 1));
  return { page, countPerPage };
}

/**
 * Turkiye gun anahtari.
 *
 * Govde `lib/istanbulGunu.ts`e tasindi; saat dilimi donusumunun tek bir
 * kaynagi olsun diye. Buradan yeniden disari veriliyor cunku panelin
 * yarisi bu modulden aliyor.
 */
export { istanbulDateKey };

export function previousIstanbulDateKey(value: Date | string | number = new Date()): string {
  const currentKey = istanbulDateKey(value);
  const [year, month, day] = currentKey.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return '';
  const previous = new Date(Date.UTC(year, month - 1, day - 1, 12));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}-${String(previous.getUTCDate()).padStart(2, '0')}`;
}

export function istanbulDayBoundsUtc(dateKey: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Geçersiz Türkiye tarih anahtarı.');
  return {
    from: new Date(`${dateKey}T00:00:00+03:00`).toISOString(),
    to: new Date(`${dateKey}T23:59:59.999+03:00`).toISOString(),
  };
}

/**
 * TARIH SAAT DILIMI — bildirilen "tarih ayarı yanlış" hatasinin kaynagi.
 *
 * Panelden gelen `2026-08-02` bir TURKIYE IS GUNU. Burada UTC olarak
 * yorumlaniyordu:
 *
 *   `${text}T00:00:00.000Z`   ->  Turkiye saatiyle 03:00
 *
 * Yani pencere 3 saat kayiyordu: o gunun 00:00-03:00 arasindaki
 * yatirim/cekimleri DISARIDA kaliyor, ertesi gunun 00:00-03:00 arasi
 * ICERI siziyordu. Ayni yanlis pencere sunucu tarafindaki ikinci
 * suzgecte de kullanildigi icin kayitlar iki kez eleniyordu.
 *
 * Dogrusu gunu Istanbul sinirlariyla almak; `istanbulDayBoundsUtc` zaten
 * bunu yapiyordu ama yalnizca ertesi gun isinde kullaniliyordu.
 */
const ISTANBUL_OFSET = '+03:00';

function toIsoDateTime(value: unknown, endOfDay = false): string | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;

  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s*-\s*|\s+|T)?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/);
  if (dmy) {
    const [, day, month, year, hh, mm, ss] = dmy;
    const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
    const p = (n: number) => String(n).padStart(2, '0');
    const saat = hh ? Number(hh) : endOfDay ? 23 : 0;
    const dakika = mm ? Number(mm) : endOfDay ? 59 : 0;
    const saniye = ss ? Number(ss) : endOfDay ? 59 : 0;
    const salise = hh || mm || ss ? '000' : endOfDay ? '999' : '000';
    // Operatorun girdigi gun/saat TURKIYE saatidir.
    const iso = `${fullYear}-${p(Number(month))}-${p(Number(day))}T${p(saat)}:${p(dakika)}:${p(saniye)}.${salise}${ISTANBUL_OFSET}`;
    const zaman = Date.parse(iso);
    return Number.isNaN(zaman) ? null : new Date(zaman).toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(
      `${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}${ISTANBUL_OFSET}`,
    ).toISOString();
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/**
 * Gun anahtari (YYYY-MM-DD) — TURKIYE gunune gore.
 *
 * Onceden `toIsoDateTime(...).slice(0, 10)` idi. Artik toIsoDateTime
 * Istanbul sinirlarina cevirdigi icin `2026-08-02` girdisi
 * `2026-08-01T21:00:00Z` uretiyor; ham dilimleme gunu BIR GERI alirdi.
 * Bu yuzden gun anahtari UTC'den degil Istanbul'dan okunuyor.
 */
function dateOnly(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const iso = toIsoDateTime(value);
  return iso ? istanbulDateKey(new Date(iso)) : null;
}

/**
 * Bir TURKIYE gununun UTC sinirlari.
 *
 * Kod boyunca `${ymd}T00:00:00.000Z` / `${ymd}T23:59:59.999Z` elle
 * kuruluyordu; hepsi gunu UTC sanip pencereyi 3 saat kaydiriyordu.
 * Tek kaynak burasi.
 */
function gunBasi(ymd: string): string {
  return new Date(`${ymd}T00:00:00.000${ISTANBUL_OFSET}`).toISOString();
}

function gunSonu(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999${ISTANBUL_OFSET}`).toISOString();
}

/** Bugun — TURKIYE gunu. UTC ile 21:00-24:00 arasi bir gun sapiyordu. */
function todayYmd(): string {
  return istanbulDateKey(new Date());
}

/** Bir yil once — TURKIYE gunune gore. */
function yearAgoYmd(): string {
  const bugun = todayYmd();
  const [yil, ay, gun] = bugun.split('-');
  return `${Number(yil) - 1}-${ay}-${gun}`;
}

function dateRangeFromBody(body: AnyRecord = {}): { from?: string; to?: string } {
  return {
    from: toIsoDateTime(
      body.FromCreatedDateLocal ??
      body.FromDateLocal ??
      body.StartDateLocal ??
      body.StartTimeLocal ??
      body.MinCreatedLocal ??
      body.startDate ??
      body.StartDate ??
      body.FromDate ??
      body.creationDateFrom,
      false
    ) ?? undefined,
    to: toIsoDateTime(
      body.ToCreatedDateLocal ??
      body.ToDateLocal ??
      body.EndDateLocal ??
      body.EndTimeLocal ??
      body.MaxCreatedLocal ??
      body.endDate ??
      body.EndDate ??
      body.ToDate ??
      body.creationDateTo,
      true
    ) ?? undefined,
  };
}

function dateRangeFromDashboardBody(body: AnyRecord = {}): { startDate: string; endDate: string } {
  const startDate = dateOnly(
    body.startDate ??
    body.StartDate ??
    body.PartnerBonusStartDateLocal ??
    body.StartDateLocal ??
    body.FromDate ??
    body.FromDateLocal ??
    body.StartTimeLocal ??
    body.MinCreatedLocal
  ) ?? todayYmd();
  const endDate = dateOnly(
    body.endDate ??
    body.EndDate ??
    body.PartnerBonusEndDateLocal ??
    body.EndDateLocal ??
    body.ToDate ??
    body.ToDateLocal ??
    body.EndTimeLocal ??
    body.MaxCreatedLocal
  ) ?? startDate;
  return { startDate, endDate };
}

function reportDateRangeFromBody(body: AnyRecord = {}): { startDate: string; endDate: string; currency: string } {
  const { startDate, endDate } = dateRangeFromDashboardBody(body);
  return {
    startDate,
    endDate,
    currency: firstNonEmpty(body.currency, body.CurrencyId, body.ToCurrencyId, config.lynon.currency),
  };
}

function rowsFromReportData(data: AnyRecord): AnyRecord[] {
  return arrayOf(data.reports ?? data.Reports ?? data.Result ?? data.Objects);
}

function summaryFromReportData(data: AnyRecord): AnyRecord {
  return recordOf(data.reportsSummary ?? data.ReportsSummary ?? data.summary);
}

function pickAmount(row: AnyRecord, keys: string[], fallback = 0): number {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return numberFrom(row[key], fallback);
  }
  return fallback;
}

function textIncludes(value: unknown, needle: string): boolean {
  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function normalizeStatusName(value: unknown): string {
  const status = firstNonEmpty(value);
  if (!status) return '';
  const map: Record<string, string> = {
    new: 'Yeni',
    created: 'Oluşturuldu',
    pending: 'Bekliyor',
    pendingproviderapproval: 'Sağlayıcı Onayı Bekliyor',
    success: 'Ödendi',
    failed: 'Başarısız',
    rejected: 'Reddedildi',
    processed: 'İşlendi',
    // Bahis/round sonuç durumları (spor: sportOperation, casino: state)
    won: 'Kazandı',
    win: 'Kazandı',
    lost: 'Kaybetti',
    lose: 'Kaybetti',
    void: 'İptal',
    cancelled: 'İptal Edildi',
    canceled: 'İptal Edildi',
    cashedout: 'Nakit Çıkış',
    cashout: 'Nakit Çıkış',
    open: 'Açık',
    refunded: 'İade Edildi',
    refund: 'İade Edildi',
  };
  return map[status.toLowerCase().replace(/[^a-z]/g, '')] ?? status;
}

function transactionStatusFromBody(body: AnyRecord, fallback?: string[] | null): string[] | null {
  if (Array.isArray(body.status)) return body.status.map(String);
  if (Array.isArray(body.StateList) && body.StateList.length > 0) return body.StateList.map(String);
  if (typeof body.State === 'string' && body.State.trim()) return [body.State.trim()];
  return fallback ?? null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = numberFrom(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Gerçek Lynon BackofficeAccounts yanıtı oyuncu başına 5 hesap döner:
 * playerAccount (ana nakit), playerBonusMoneyAccount, playerBonusWinAccount,
 * playerFrozenAccount ve playerUnusedBalance. Ana bakiye YALNIZCA 'playerAccount'
 * hesabıdır; geniş bir regex ile arandığında dizi sırası nedeniyle önce
 * playerFrozenAccount eşleşip yanlış bakiye gösterilir.
 */
function pickMainAccount(accounts: AnyRecord[]): AnyRecord | undefined {
  const currency = String(config.lynon.currency).toUpperCase();
  const isMain = (account: AnyRecord) => String(account.accountType ?? '').toLowerCase() === 'playeraccount';
  return (
    accounts.find((account) => isMain(account) && String(account.currency ?? '').toUpperCase() === currency) ??
    accounts.find(isMain)
  );
}

function mapPlayer(row: AnyRecord): AnyRecord {
  const category = recordOf(row.category);
  const userId = row.userId ?? row.id ?? row.playerId;
  const numericId = numberFrom(userId, NaN);
  return {
    ...row,
    Id: Number.isFinite(numericId) ? numericId : userId,
    Login: firstNonEmpty(row.userName, row.username, row.login),
    FirstName: row.firstName ?? null,
    LastName: row.lastName ?? null,
    Email: row.email ?? null,
    Phone: firstNonEmpty(row.phoneNumber, row.phone) || null,
    MobilePhone: firstNonEmpty(row.phoneNumber, row.mobilePhone) || null,
    PartnerName: firstNonEmpty(row.siteName, row.webSiteName, `Site ${row.siteId ?? config.lynon.siteId}`),
    PartnerId: row.siteId ?? config.lynon.siteId,
    Balance: nullableNumber(
      row.balance ??
      row.realBalance ??
      row.currentBalance ??
      row.cashBalance ??
      row.availableBalance ??
      row.totalBalance
    ),
    LastLoginLocalDate: row.lastLoginDate ?? null,
    CreatedLocalDate: row.registrationDate ?? row.createdAt ?? null,
    IsLocked: boolFromStatus(row.status),
    CurrencyId: firstNonEmpty(row.preferredCurrency, row.currency, config.lynon.currency),
    Status: row.status ?? null,
    ExternalId: String(userId ?? ''),
    Language: row.language ?? null,
    IsPhoneVerified: row.isMobileNumberVerified === true,
    IsEmailVerified: row.isEmailVerified === true,
    IsIdentityVerified: row.isIdentityDocNumberVerified === true,
    VerificationStatus: row.verificationStatus ?? null,
    IsVerified: row.verificationStatus === 'verified' || row.isEmailVerified === true || row.isMobileNumberVerified === true,
    LastLoginIp: row.lastLoginIp ?? null,
    CategoryId: row.categoryId ?? category.id ?? null,
    CategoryName: row.categoryName ?? category.name ?? null,
    CategoryTextColor: row.categoryTextColor ?? category.textColor ?? null,
    CategoryBackgroundColor: row.categoryBackgroundColor ?? category.color ?? null,
  };
}

function mapTransaction(row: AnyRecord): AnyRecord {
  const personal = recordOf(row.personalData);
  const clientId = numberFrom(row.userId ?? row['Player ID'], NaN);
  const amount = numberFrom(row.amount ?? row.actualAmount ?? row.receivedAmount);
  const type = firstNonEmpty(row.transactionType, row.type);
  const id = row.id ?? row.platformTransactionId;
  const login = firstNonEmpty(personal.userName, row.userName, row.username, row.UserName, row.userId, row['UserName']);
  const status = firstNonEmpty(row.status, row.state, row.Status);

  const normalizedType = String(type).trim().toLowerCase();
  const documentTypeName = normalizedType === 'deposit'
    ? 'Yatırım'
    : normalizedType === 'withdrawal'
      ? 'Çekim'
      : type || 'İşlem';

  return {
    ...row,
    Id: Number.isFinite(numberFrom(id, NaN)) ? numberFrom(id) : id,
    DocumentId: Number.isFinite(numberFrom(id, NaN)) ? numberFrom(id) : id,
    ReferenceNo: firstNonEmpty(row.referenceNumber, row.referenceNo, row.platformTransactionId, id),
    DocumentTypeName: documentTypeName,
    DocumentState: row.documentState ?? row.status ?? row.state ?? null,
    Operation: /deposit|credit|win/i.test(String(type)) ? 2 : 1,
    Balance: nullableNumber(row.balanceAfter ?? row.balance),
    ClientId: Number.isFinite(clientId) ? clientId : row.userId,
    ClientLogin: login,
    ClientName: firstNonEmpty(`${personal.firstname ?? ''} ${personal.lastname ?? ''}`.trim(), row.fullName),
    ClientFirstName: personal.firstname ?? null,
    ClientLastName: personal.lastname ?? null,
    Amount: amount,
    AmountEUR: amount,
    CurrencyId: firstNonEmpty(row.currency, row.actualCurrency, row.receivedCurrency, config.lynon.currency),
    ExchangedAmount: numberFrom(row.convertedAmount, amount),
    TransactionDate: row.createdAt ?? null,
    CreatedLocal: row.createdAt ?? null,
    ModifiedLocal: row.updatedAt ?? null,
    RequestTime: row.createdAt ?? null,
    RequestTimeLocal: row.createdAt ?? null,
    PaymentCreatedLocal: row.updatedAt ?? null,
    PaymentSystemName: firstNonEmpty(row.method, row.integration, row.paymentType),
    TypeName: documentTypeName,
    TypeCode: normalizedType ? `payment.${normalizedType}` : null,
    StateName: normalizeStatusName(status),
    DocumentStateName: normalizeStatusName(status),
    State: status,
    UserName: '',
    Note: row.corrected ? 'Corrected' : null,
    ExternalId: row.platformTransactionId ?? null,
    PaymentSystemId: row.paymentId ?? null,
    IntegrationName: row.integration ?? null,
  };
}

function wrapObjects(objects: AnyRecord[]): AnyRecord {
  return { HasError: false, Data: { Count: objects.length, Objects: objects } };
}

function mapBonus(row: AnyRecord, source: 'offer' | 'campaign'): AnyRecord {
  const campaignId = nullableNumber(row.campaignId ?? (source === 'campaign' ? row.id : null));
  const id = campaignId ?? row.id ?? row.templateId;
  const title = firstNonEmpty(row.title, row.systemName, row.name, `Bonus ${id}`);
  const enabled = row.state ?? row.isEnabled ?? row.status === 'active';
  const normalizedTitle = title.toLocaleLowerCase('tr-TR');
  const category =
    /free\s*bet|freebet/.test(normalizedTitle) ? 'Freebet' :
    /free\s*spin|freespin/.test(normalizedTitle) ? 'Freespin' :
    /cashback|kayıp|kayip/.test(normalizedTitle) ? 'Kayıp Bonusu' :
    /yatırım|yatirim|deposit/.test(normalizedTitle) ? 'Yatırım Bonusu' :
    /çark|cark|wheel/.test(normalizedTitle) ? 'Çark Ödülü' :
    /kazı|kazi|scratch/.test(normalizedTitle) ? 'Kazı Kazan Ödülü' :
    /skor|tahmin|prediction/.test(normalizedTitle) ? 'Skor Tahmin Ödülü' :
    'Bonus';
  const isFreeBet = category === 'Freebet';
  return {
    ...row,
    Id: id,
    ExternalId: id,
    CampaignId: campaignId,
    PartnerBonusId: campaignId,
    Name: title,
    Description: title,
    BeginDate: row.startDate ?? null,
    EndDate: row.endDate ?? null,
    StartDateLocal: row.startDate ?? null,
    EndDateLocal: row.endDate ?? null,
    ExpirationDays: numberFrom(row.expirationToClaimInDays ?? row.activeBonusExpirationInDays),
    BonusId: id,
    MinSelCount: numberFrom(row.minSelectionCount),
    MinSelPrice: numberFrom(row.minSelectionPrice),
    MinBetPrice: nullableNumber(row.minBetAmount),
    IsDeleted: row.status === 'archived',
    IsDisabled: enabled === false || row.status === 'disabled',
    Type: { Id: source === 'campaign' ? 2 : 1, Name: category },
    TypeId: source === 'campaign' ? 2 : 1,
    ProductTypeId: isFreeBet ? 1 : 0,
    BonusCategory: category,
    IsFreeBet: isFreeBet,
    SourceType: source === 'campaign' ? 'Campaign' : 'Offer',
    IsAssignable: campaignId != null,
    Partner: { Id: config.lynon.siteId, Name: `Site ${config.lynon.siteId}` },
    PartnerId: config.lynon.siteId,
    configurationCurrency: row.configurationCurrency,
  };
}

function mapCasinoBet(row: AnyRecord): AnyRecord {
  const round = recordOf(row.round);
  const amount = Math.abs(numberFrom(row.amount));
  const type = firstNonEmpty(row.type);
  const id = row.id ?? row.platformTransactionId ?? round.id;
  return {
    ...row,
    Id: Number.isFinite(numberFrom(id, NaN)) ? numberFrom(id) : id,
    DocumentId: row.platformTransactionId ?? id,
    CreatedLocal: row.createdAt ?? null,
    ClientId: numberFrom(round.playerExternalId, NaN),
    ClientLogin: firstNonEmpty(row.userName, row.username, round.playerExternalId),
    ClientName: '',
    TypeName: financialMovementTypeNameCaseInsensitive(type) || 'Casino',
    Amount: type.toLowerCase() === 'win' ? 0 : amount,
    WinningAmount: type.toLowerCase() === 'win' ? amount : 0,
    CurrencyId: firstNonEmpty(round.currency, row.currency, config.lynon.currency),
    StateName: normalizeStatusName(row.state),
    GameName: round.gameName ?? null,
    ProviderName: round.providerName ?? null,
    GameType: round.gameType ?? null,
    Source: 'casino',
    IsLive: String(round.gameType ?? '').toLowerCase().includes('live'),
  };
}

function mapSportBet(row: AnyRecord): AnyRecord {
  // Gerçek Lynon yanıtı: bet amount 'amount', kazanç 'wonAmount', durum 'sportOperation'
  // (status/state DEĞİL) alanlarında gelir; maç/pazar/seçim bilgisi ise satırda değil,
  // 'details[]' dizisindeki her bahis bacağının kendi objesinde bulunur.
  const amount = Math.abs(numberFrom(row.amount ?? row.stake ?? row.betAmount ?? row.realBetAmount));
  const win = Math.abs(numberFrom(row.wonAmount ?? row.winAmount ?? row.winningAmount ?? row.payout ?? row.realWinAmount));
  const id = row.operationId ?? row.id ?? row.betId ?? row.platformTransactionId ?? row.eventId;
  const details = arrayOf(row.details);
  const firstLeg = recordOf(details[0]);
  const status = firstNonEmpty(row.sportOperation, row.status, row.state);
  return {
    ...row,
    Id: Number.isFinite(numberFrom(id, NaN)) ? numberFrom(id) : id,
    CreatedLocal: row.creationDate ?? row.createdAt ?? row.betDate ?? null,
    ClientId: numberFrom(row.platformPlayerId ?? row.userId, NaN),
    ClientLogin: firstNonEmpty(row.userName, row.username, row.platformPlayerId),
    ClientName: '',
    TypeName: 'sport',
    Amount: amount,
    WinningAmount: win,
    CurrencyId: firstNonEmpty(row.currency, config.lynon.currency),
    Price: numberFrom(row.price ?? row.odds, 0),
    StateName: normalizeStatusName(status),
    SportName: firstNonEmpty(firstLeg.sport, row.sportName, row.sport, 'Sportbook'),
    CompetitionName: firstNonEmpty(firstLeg.competition, row.competitionName, row.tournamentName, row.leagueName),
    MatchName: firstNonEmpty(firstLeg.match, row.matchName, row.eventName, row.fixtureName),
    MarketName: firstNonEmpty(firstLeg.marketType, row.marketName),
    SelectionName: firstNonEmpty(firstLeg.selection, row.selectionName),
    SelectionCount: details.length || undefined,
    BetType: row.betType ?? null,
    IsBonusBet: row.balanceType === 'bonus' || row.isFreeBet === true,
    Source: 'sport',
    IsLive: row.isLive ?? null,
  };
}

/**
 * Lynon uçlarının bir kısmı tarih query/gövde parametrelerini sessizce yok sayıp tüm
 * kayıtları döndürüyor (ödeme yolunda bu yüzden zaten sunucu tarafı filtre vardı).
 * Casino/spor/finansal hareket yollarında bu doğrulama yoktu; seçilen tarih aralığı
 * arayüzde hiçbir etki yaratmıyordu. Eşlenmiş satırları CreatedLocal üzerinden süzer.
 */
function filterMappedRowsByRange(rows: AnyRecord[], from?: string | null, to?: string | null): AnyRecord[] {
  const fromMs = from ? Date.parse(from) : null;
  const toMs = to ? Date.parse(to) : null;
  if (fromMs == null && toMs == null) return rows;
  return rows.filter((row) => {
    const createdMs = Date.parse(String(row.CreatedLocal ?? row.TransactionDate ?? ''));
    if (!Number.isFinite(createdMs)) return false;
    if (fromMs != null && createdMs < fromMs) return false;
    if (toMs != null && createdMs > toMs) return false;
    return true;
  });
}

function betReportResponse(rows: AnyRecord[]): AnyRecord {
  return {
    HasError: false,
    Data: {
      BetData: {
        Count: rows.length,
        Objects: rows,
      },
    },
  };
}

function providerReportResponse(rows: AnyRecord[], summary: AnyRecord = {}): AnyRecord {
  const providers = rows.map((row, index) => {
    const bet = pickAmount(row, ['Bets Amount (TRY)', 'Bets Amount', 'Bet Amount (TRY)', 'Bet Amount', 'Total Bets (TRY)', 'Total Bets']);
    const win = pickAmount(row, ['Won Amount (TRY)', 'Won Amount', 'Total Wins (TRY)', 'Total Wins', 'Win Amount (TRY)', 'Win Amount']);
    const profit = pickAmount(row, ['GGR (TRY)', 'GGR'], bet - win);
    return {
      ...row,
      ProviderName: firstNonEmpty(row['Provider Name'], row.ProviderName, row.providerName, `Provider ${index + 1}`),
      ProviderPrefix: firstNonEmpty(row['Integration Name'], row.ProviderPrefix, row.integrationName),
      BetAmount: bet,
      WinAmount: win,
      Profit: profit,
      BetAmountByReportCurrency: bet,
      WinAmountByReportCurrency: win,
      ProfitByReportCurrency: profit,
      TotalRound: numberFrom(row['Bets Count'] ?? row['Bet Count'] ?? row.BetCount),
    };
  });

  return {
    HasError: false,
    Result: {
      ReportByTResultViewModel: providers,
      TotalBetAmountByReportCurrency: pickAmount(summary, ['Bets Amount (TRY)', 'Bet Amount (TRY)', 'Total Bets (TRY)'], providers.reduce((sum, row) => sum + numberFrom(row.BetAmountByReportCurrency), 0)),
      TotalWinAmountByReportCurrency: pickAmount(summary, ['Won Amount (TRY)', 'Win Amount (TRY)', 'Total Wins (TRY)'], providers.reduce((sum, row) => sum + numberFrom(row.WinAmountByReportCurrency), 0)),
      TotalProfitByReportCurrency: pickAmount(summary, ['GGR (TRY)', 'GGR'], providers.reduce((sum, row) => sum + numberFrom(row.ProfitByReportCurrency), 0)),
      TotalRound: providers.reduce((sum, row) => sum + numberFrom(row.TotalRound), 0),
    },
  };
}

function reportRowsByGameType(rows: AnyRecord[]): { casino?: AnyRecord; sport?: AnyRecord } {
  return {
    casino: rows.find((row) => textIncludes(row['Game Type'] ?? row.GameType, 'casino')),
    sport: rows.find((row) => textIncludes(row['Game Type'] ?? row.GameType, 'sport')),
  };
}

export async function lynonMe(): Promise<unknown> {
  return lynonRequest('/api/v1/me');
}

export async function lynonSites(): Promise<unknown> {
  return lynonRequest('/api/partner/api/v1.0/sites/all');
}

export async function lynonSite(): Promise<unknown> {
  return lynonRequest(`/api/partner/api/v1.0/sites/${config.lynon.siteId}`);
}

export async function lynonDashboardSummary(startDate: string, endDate: string): Promise<AnyRecord> {
  /**
   * BUGUN KISA, GECMIS UZUN.
   *
   * Sabit bes dakikalik omur iki farkli soruya ayni cevabi veriyordu:
   * bugunun rakami her yatirimda degisiyor (bes dakika cok uzun), gecmis
   * bir gunun rakami ise bir daha ASLA degismiyor (bes dakikada bir
   * yeniden cekmek saf israf). Ayrinti `onbellekOmru` icinde.
   */
  const ttl = araligaGoreTtl(endDate, todayYmd());
  return cachedLynon(`dashboard-summary:${config.lynon.siteId}:${startDate}:${endDate}:${config.lynon.currency}`, ttl, async () => {
    const data = recordOf(await lynonRequest(`/api/report/api/v1.0/dashboardData/sites/${config.lynon.siteId}/dashboard/${config.lynon.currency}`, {
      query: { startDate, endDate },
    }));

    /**
     * METRIK ESLEME.
     *
     * Onceden farkli metrikler arasinda SESSIZ GERI DUSUS vardi:
     *
     *   DepositCount: data['TOTAL DEPOSITS COUNT'] ?? data['UNIQUE PLAYER DEPOSITS']
     *
     * Ilk alan yanitta yok; ikinciye dusuyor ve ekranda "2 işlem ·
     * 2 oyuncu" yaziyordu — ayni sayi iki ayri etiketle. `PLAYERS LOGGED
     * IN` ve `LOGIN COUNT` alanlari yanitta hic olmadigi icin "Aktif
     * Oyuncu" ve "Günlük Girişler" surekli 0 gorunuyordu.
     *
     * `Profit` ise PROFIT yoksa GGR'ye dusuyordu; bunlar AYRI metrikler
     * (ornek gunde -52.984,08 ve +14.668,99), biri digerinin yerine
     * konunca isaret bile ters donebiliyor.
     *
     * Artik olmayan alan `null` — sifir degil. Ekran "—" gosterir.
     */
    const metrikler = panoMetrikleri(data);
    const m = (anahtar: string) => metrikler.find((x) => x.anahtar === anahtar)?.deger ?? null;

    const summary = {
      Deposits: m('yatirim'),
      Withdrawals: m('cekim'),
      DepositClientCount: m('yatirimOyuncu'),
      WithdrawalClientCount: m('cekimOyuncu'),
      FirstDepositCount: m('ilkYatirim'),
      PlayersRegistered: m('yeniKayit'),
      PlayersBalance: m('gercekBakiye'),
      PlayersBonusBalance: m('bonusBakiye'),
      /** GGR ve PROFIT AYRI tutulur; birbirinin yerine gecmez. */
      GGR: m('ggr'),
      Profit: m('kar'),
      NetGelir: netGelir(metrikler),
      /** Yanitta bulunmayan alanlar: null kalir, 0'a cevrilmez. */
      PlayersLoggedIn: m('bahisOyuncu'),
      CorrectionsUp: numberFrom(data['CORRECTIONS UP']),
      CorrectionsDown: numberFrom(data['CORRECTIONS DOWN']),
      TournamentCost: numberFrom(data['TOURNAMENT COST']),
      /** Etiketli, gruplu tam liste — pano bunu ciziyor. */
      metrikler,
      /** Lynon yeni alan eklerse sessizce kaybolmasin. */
      taninmayanAlanlar: taninmayanAlanlar(data),
      /**
       * HANGI GUN SORULDU.
       *
       * "Dashboard yanlis gosteriyor" sikayetinin buyuk kismi rakam
       * hatasi degil, PENCERE hatasiydi: pano dunu soruyor, operator
       * bugunu bekliyordu. Sorulan araligi yanitla birlikte tasimak bu
       * ayrimi ekranda gorulur kilar — tahmin edilecek bir sey kalmaz.
       */
      Aralik: { startDate, endDate },
      raw: data,
    };

    return { HasError: false, Data: summary, UpdatedAt: new Date().toISOString(), Source: { siteId: config.lynon.siteId, endpoint: 'dashboardData' } };
  });
}

export async function lynonPartnerProfit(startDate: string, endDate: string): Promise<AnyRecord> {
  return cachedLynon(`partner-profit:${config.lynon.siteId}:${startDate}:${endDate}:${config.lynon.currency}`, araligaGoreTtl(endDate, todayYmd()), async () => {
    const [summaryResult, gameTypeResult] = await Promise.allSettled([
      lynonDashboardSummary(startDate, endDate),
      raporGetir(NARCOS_REPORT_IDS.gameType, 'Report By Game Type', { startDate, endDate, currency: config.lynon.currency }),
    ]);

    const summaryData = summaryResult.status === 'fulfilled' ? recordOf(summaryResult.value.Data) : {};
    const raw = recordOf(summaryData.raw);
    const gameTypeData = gameTypeResult.status === 'fulfilled' ? recordOf(gameTypeResult.value.Data) : {};
    const { casino, sport } = reportRowsByGameType(rowsFromReportData(gameTypeData));
    const casinoTurnover = casino ? pickAmount(casino, ['Total Bets (TRY)', 'Total Bets', 'Bet Count']) : numberFrom(raw['CASINO REAL BETS'] ?? raw['TOTAL REAL BET AMOUNT']);
    const casinoWinning = casino ? pickAmount(casino, ['Total Wins (TRY)', 'Total Wins']) : numberFrom(raw['CASINO REAL WINS'] ?? raw['TOTAL REAL WIN AMOUNT']);
    const sportTurnover = sport ? pickAmount(sport, ['Total Bets (TRY)', 'Total Bets']) : numberFrom(raw['SPORT REAL BETS']);
    const sportWinning = sport ? pickAmount(sport, ['Total Wins (TRY)', 'Total Wins']) : numberFrom(raw['SPORT REAL WINS']);

    /**
     * METRIKLER ARASI SESSIZ GERI DUSUS YOK.
     *
     * Onceden:
     *   Bonus: raw['TOTAL BONUS BET'] ?? raw['TOTAL Bonus PayOut'] ?? raw['TOTAL Cashback']
     *
     * Bunlar UC AYRI olcu. Bonus bahis (oyuncunun bonusla oynadigi
     * tutar), bonus odemesi (kasadan cikan) ve cashback birbirinin
     * yerine gecmez; ilki yoksa ikincisini "Bonus" etiketiyle
     * gostermek rakami hem buyutuyor hem anlamini degistiriyordu.
     *
     * Ayrica `RAKE` alani yanitta hic yok; `numberFrom` onu 0 yapiyor
     * ve ekranda "Rake: 0" gorunuyordu -- olcum yoklugu sifir diye
     * cizilmis oluyordu.
     */
    const alan = (ad: string): number | null =>
      Object.prototype.hasOwnProperty.call(raw, ad) ? metrikSayisi(raw[ad]) : null;

    const gameTypeRows = rowsFromReportData(gameTypeData);

    return {
      HasError: false,
      Data: {
        SportTurnover: sportTurnover,
        SportWinning: sportWinning,
        CasinoTurnover: casinoTurnover,
        CasinoWinning: casinoWinning,
        Rake: alan('RAKE'),
        TournamentCost: alan('TOURNAMENT COST'),
        /** Uc olcu AYRI doner; ekran hangisini gosterdigini bilir. */
        BonusBet: alan('TOTAL BONUS BET'),
        BonusPayout: alan('TOTAL Bonus PayOut'),
        Cashback: alan('TOTAL Cashback'),
        FreespinWin: alan('TOTAL FREESPIN WIN'),
        /**
         * Oyun turu kirilimi (rapor 1846) — Slot / Live Casino / Sport…
         * Her satirda bahis adedi, ciro, kazanc ve GGR var.
         */
        oyunTurleri: gameTypeRows.map((row) => ({
          tur: firstNonEmpty(row['Game Type'], row.GameType, 'Bilinmiyor'),
          bahisAdedi: metrikSayisi(row['Bet Count'] ?? row['Bets Count']),
          ciro: metrikSayisi(row['Total Bets (TRY)'] ?? row['Total Bets']),
          kazanc: metrikSayisi(row['Total Wins (TRY)'] ?? row['Total Wins']),
          ggr: metrikSayisi(row['GGR (TRY)'] ?? row.GGR),
        })),
        /** Oyun turu raporu alinabildi mi — sessiz bosluk gorunur olsun. */
        oyunTuruKaynagi: gameTypeResult.status === 'fulfilled' ? 'rapor-1846' : 'alinamadi',
        raw: { dashboard: raw, gameTypes: gameTypeRows },
      },
    };
  });
}

export async function lynonAffiliateSummary(startDate: string, endDate: string): Promise<AnyRecord> {
  return cachedLynon(`affiliate-summary:${config.lynon.siteId}:${startDate}:${endDate}:${config.lynon.currency}`, AFFILIATE_CACHE_TTL_MS, async () => {
    const report = await lynonReportById(NARCOS_REPORT_IDS.playersOverview, { startDate, endDate, currency: config.lynon.currency });
    const rows = rowsFromReportData(recordOf(report.Data));
    const groups = new Map<string, { players: Set<string>; activePlayers: Set<string>; totalDeposits: number; totalWithdrawals: number; netRevenue: number }>();

    for (const row of rows) {
      const bTag = firstNonEmpty(row.BTag, row['BTag'], row['Affiliate Id'], row['Affiliate ID']) || 'BTag Yok';
      const playerId = firstNonEmpty(row['Player ID'], row.PlayerId, row['Player Login'], row.Login) || `row-${groups.size}`;
      const deposits = pickAmount(row, ['TOTAL DEPOSITS AMOUNT FILTERED (TRY)', 'TOTAL DEPOSITS AMOUNT (TRY)', 'TOTAL DEPOSITS AMOUNT']);
      const withdrawals = pickAmount(row, ['TOTAL WITHDRAWALS AMOUNT FILTERED (TRY)', 'TOTAL WITHDRAWALS AMOUNT (TRY)', 'TOTAL WITHDRAWALS AMOUNT']);
      const bets = pickAmount(row, ['TOTAL BET AMOUNT FILTERED (TRY)', 'TOTAL BET AMOUNT (TRY)', 'TOTAL BET AMOUNT']);
      const wins = pickAmount(row, ['TOTAL WIN AMOUNT FILTERED (TRY)', 'TOTAL WIN AMOUNT (TRY)', 'TOTAL WIN AMOUNT']);
      const ggr = pickAmount(row, ['GGR FILTERED (TRY)', 'GGR (TRY)', 'GGR'], deposits - withdrawals);
      const current = groups.get(bTag) ?? { players: new Set<string>(), activePlayers: new Set<string>(), totalDeposits: 0, totalWithdrawals: 0, netRevenue: 0 };
      current.players.add(playerId);
      if (deposits !== 0 || withdrawals !== 0 || bets !== 0 || wins !== 0 || ggr !== 0) current.activePlayers.add(playerId);
      current.totalDeposits += deposits;
      current.totalWithdrawals += withdrawals;
      current.netRevenue += ggr;
      groups.set(bTag, current);
    }

    const objects = [...groups.entries()].map(([bTag, value]) => ({
      bTag,
      totalPlayers: value.players.size,
      activePlayers: value.activePlayers.size,
      totalDeposits: value.totalDeposits,
      totalWithdrawals: value.totalWithdrawals,
      netRevenue: value.netRevenue,
      conversionRate: value.players.size ? (value.activePlayers.size / value.players.size) * 100 : 0,
    })).sort((a, b) => b.totalPlayers - a.totalPlayers);

    return {
      HasError: false,
      Data: {
        Count: objects.length,
        TotalPlayers: new Set(rows.map((row) => firstNonEmpty(row['Player ID'], row.PlayerId, row['Player Login'], row.Login)).filter(Boolean)).size,
        Objects: objects,
      },
      UpdatedAt: new Date().toISOString(),
      Source: { reportId: NARCOS_REPORT_IDS.playersOverview, reportName: 'Players Overview Report', siteId: config.lynon.siteId },
    };
  });
}

export async function lynonTopCasinoGames(startDate: string, endDate: string, topRecordsCount = 5): Promise<AnyRecord> {
  return cachedLynon(`top-casino:${config.lynon.siteId}:${startDate}:${endDate}:${topRecordsCount}:${config.lynon.currency}`, araligaGoreTtl(endDate, todayYmd()), async () => {
    const catalog = await lynonReportCatalog();
    const reportMeta = catalog.find((item) => Number(item.id) === 1900)
      ?? catalog.find((item) => String(item.name ?? '').trim().toLowerCase() === 'report by game');
    const resolvedReportId = Number(reportMeta?.id ?? NARCOS_REPORT_IDS.game);
    const report = await lynonReportById(resolvedReportId, { startDate, endDate, currency: config.lynon.currency });
    const rows = rowsFromReportData(recordOf(report.Data))
      .filter((row) => !row['Game Type'] || textIncludes(row['Game Type'], 'casino'))
      .map((row, index) => ({
        ...row,
        GameId: numberFrom(row['Game ID'] ?? row.GameId, index + 1),
        Name: firstNonEmpty(row['Game Name'], row.GameName, `Game ${index + 1}`),
        Turnover: pickAmount(row, ['Bet Sum Amount (TRY)', 'Bet Sum Amount', 'Total Bets (TRY)', 'Total Bets']),
        WinningAmount: pickAmount(row, ['Win Sum Amount (TRY)', 'Win Sum Amount', 'Total Wins (TRY)', 'Total Wins']),
        ProfitAmount: pickAmount(row, ['GGR (TRY)', 'GGR']),
      }))
      .sort((a, b) => numberFrom(b.Turnover) - numberFrom(a.Turnover))
      .slice(0, Math.max(1, topRecordsCount));

    return { HasError: false, Data: rows, Source: { viewerReportId: 1900, resolvedReportId, reportName: reportMeta?.name ?? 'Report By Game', siteId: config.lynon.siteId } };
  });
}

async function lynonDashboardSportRows(startDate: string, endDate: string): Promise<AnyRecord[]> {
  return cachedLynon(`dashboard-sport-rows:${config.lynon.siteId}:${startDate}:${endDate}`, araligaGoreTtl(endDate, todayYmd()), async () => {
    const from = gunBasi(startDate);
    const to = gunSonu(endDate);
    return (await lynonSportBets({ startDate: from, endDate: to, countPerPage: 500 })).map(mapSportBet);
  });
}

export async function lynonTopSports(startDate: string, endDate: string, topRecordsCount = 5): Promise<AnyRecord> {
  const rows = await lynonDashboardSportRows(startDate, endDate);
  const groups = new Map<string, AnyRecord>();

  for (const row of rows) {
    const name = firstNonEmpty(row.SportName, row.CompetitionName, 'Sportbook');
    const current = groups.get(name) ?? { SportId: groups.size + 1, Name: name, Turnover: 0, WinningAmount: 0, ProfitAmount: 0, NumberOfBets: 0 };
    current.Turnover += numberFrom(row.Amount);
    current.WinningAmount += numberFrom(row.WinningAmount);
    current.ProfitAmount = current.Turnover - current.WinningAmount;
    current.NumberOfBets += 1;
    groups.set(name, current);
  }

  const data = Array.from(groups.values()).sort((a, b) => numberFrom(b.Turnover) - numberFrom(a.Turnover)).slice(0, Math.max(1, topRecordsCount));
  return { HasError: false, Data: data };
}

export async function lynonSportbookOverview(startDate: string, endDate: string): Promise<AnyRecord> {
  const rows = await lynonDashboardSportRows(startDate, endDate);
  const makeDetail = (items: AnyRecord[], isLive: boolean | null) => {
    const turnover = items.reduce((sum, row) => sum + numberFrom(row.Amount), 0);
    const winning = items.reduce((sum, row) => sum + numberFrom(row.WinningAmount), 0);
    const players = new Set(items.map((row) => String(row.ClientId || row.ClientLogin || '')).filter(Boolean));
    return {
      IsLive: isLive,
      Turnover: turnover,
      WinningAmount: winning,
      UnsettledBetsAmount: 0,
      NumberOfBets: items.length,
      NumberOfPlayers: players.size,
      AverageBetAmount: items.length ? turnover / items.length : 0,
      GGR: turnover - winning,
      Profitness: turnover - winning,
      BetPerPlayer: players.size ? items.length / players.size : 0,
      SingleBetCount: items.length,
      MultipleBetCount: 0,
      SystemBetCount: 0,
      ChainBetCount: 0,
    };
  };
  const liveRows = rows.filter((row) => row.IsLive === true);
  const prematchRows = rows.filter((row) => row.IsLive !== true);
  return {
    HasError: false,
    Data: {
      Details: [
        makeDetail(prematchRows, false),
        makeDetail(liveRows, true),
      ],
      BetCountsPerType: {
        Single: rows.length,
        Multiple: 0,
        System: 0,
        Chain: 0,
      },
    },
  };
}

export async function lynonPlayers(body: AnyRecord = {}): Promise<AnyRecord> {
  const { page, countPerPage } = pageFromBody(body);
  const query = firstNonEmpty(body.query, body.Login, body.ClientLogin, body.UserName, body.Email, body.Id);
  const params: Record<string, string | number | boolean | null | undefined> = {
    siteId: config.lynon.siteId,
    page,
    countPerPage,
    query: query || undefined,
    status: body.status ?? body.Status ?? undefined,
    verificationStatus: body.verificationStatus ?? undefined,
    categoryId: body.PartnerClientCategoryId ?? body.categoryId ?? undefined,
    registrationDateFrom: toIsoDateTime(body.MinCreatedLocal ?? body.registrationDateFrom) ?? undefined,
    registrationDateTo: toIsoDateTime(body.MaxCreatedLocal ?? body.registrationDateTo, true) ?? undefined,
  };

  const [rawRows, overviewMap] = await Promise.all([
    lynonRequest('/api/user/api/v1.0/userBackOffice', { query: params }).then(arrayOf),
    lynonPlayerOverviewMap().catch(() => new Map<string, AnyRecord>()),
  ]);
  const queryText = query.toLocaleLowerCase('tr-TR');
  const rows = rawRows
    .map(mapPlayer)
    .filter((player) => {
      if (!queryText) return true;
      const candidates = [player.Id, player.ExternalId, player.Login, player.Email, player.Phone, player.MobilePhone]
        .map((value) => String(value ?? '').toLocaleLowerCase('tr-TR'));
      return candidates.some((value) => value === queryText || value.includes(queryText));
    })
    .map((player) => {
      const overview = overviewMap.get(String(player.Id));
      if (!overview) return player;
      const balance = pickAmount(overview, ['REAL BALANCE (TRY)', 'REAL BALANCE', 'TOTAL BALANCE (TRY)', 'TOTAL BALANCE'], numberFrom(player.Balance));
      const bonusBalance = pickAmount(overview, ['BONUS BALANCE (TRY)', 'BONUS BALANCE']);
      const totalDeposit = pickAmount(overview, ['TOTAL DEPOSITS AMOUNT FILTERED (TRY)', 'TOTAL DEPOSITS AMOUNT FILTERED', 'TOTAL DEPOSITS AMOUNT (TRY)', 'TOTAL DEPOSITS AMOUNT']);
      const totalWithdraw = pickAmount(overview, ['TOTAL WITHDRAWALS AMOUNT FILTERED (TRY)', 'TOTAL WITHDRAWALS AMOUNT FILTERED', 'TOTAL WITHDRAWALS AMOUNT (TRY)', 'TOTAL WITHDRAWALS AMOUNT']);
      return {
        ...player,
        Balance: balance,
        BonusBalance: bonusBalance,
        TotalBalance: pickAmount(overview, ['TOTAL BALANCE (TRY)', 'TOTAL BALANCE'], balance + bonusBalance),
        TotalDeposit: totalDeposit,
        TotalWithdraw: totalWithdraw,
        ProfitAndLose: totalDeposit - totalWithdraw,
        BTag: overview['Affiliate Id'] ?? player.BTag ?? null,
        CategoryName: overview.Category ?? player.CategoryName ?? null,
        Email: overview.Email ?? player.Email,
        Phone: overview.PhoneNumber ?? player.Phone,
        MobilePhone: overview.PhoneNumber ?? player.MobilePhone,
        IsVerified: overview['Is Mail Verified'] === true || overview['Is Phone Verified'] === true || player.IsVerified,
      };
    });
  return wrapObjects(rows);
}
export async function lynonFindPlayerByLogin(login: string): Promise<AnyRecord | null> {
  const normalizedLogin = String(login ?? '').trim().toLocaleLowerCase('tr-TR');
  if (!normalizedLogin) return null;

  // Lynon araması bulanıktır. İlk satırı kullanmak "test" hesabını "test777"
  // ile eşleştirebilir; ayrıca farklı site verisi asla tenant sınırını geçmemelidir.
  const res = await lynonPlayers({ Login: login, MaxRows: 100, SkeepRows: 0 });
  const rows = arrayOf(res.Data?.Objects);
  return rows.find((row) => {
    const rowLogin = String(row.Login ?? row.userName ?? '').trim().toLocaleLowerCase('tr-TR');
    const rowSiteId = numberFrom(row.siteId ?? row.SiteId, NaN);
    return rowLogin === normalizedLogin && rowSiteId === Number(config.lynon.siteId);
  }) ?? null;
}

export async function lynonPlayerDetail(userId: string | number): Promise<AnyRecord> {
  const data = recordOf(await lynonRequest(`/api/user/api/v1.0/userBackOffice/users/${userId}`));
  return { HasError: false, Data: mapPlayer(data) };
}

export async function lynonPlayerAccounts(userId: string | number): Promise<AnyRecord> {
  const rows = arrayOf(await lynonRequest(`/api/platform/api/v1.0/BackofficeAccounts/${userId}`));
  return wrapObjects(rows);
}

/**
 * Oyuncunun ANA (gercek para) bakiyesi.
 *
 * `pickMainAccount` yalnizca `playerAccount` turunu secer; genis bir
 * regex once `playerFrozenAccount`'a carpip yanlis bakiye donduruyordu.
 * Okunamazsa null — sifir DEGIL; hedef bakiye kurali bu ayrima dayaniyor.
 */
export async function lynonPlayerMainBalance(userId: string | number): Promise<number | null> {
  const rows = arrayOf(await lynonRequest(`/api/platform/api/v1.0/BackofficeAccounts/${userId}`));
  const main = pickMainAccount(rows);
  if (!main) return null;
  const bakiye = numberFrom(main.balance ?? main.amount, NaN);
  return Number.isFinite(bakiye) ? bakiye : null;
}

/** Oyuncunun bahis/cekim/yatirim kisitlari. */
export async function lynonPlayerRestrictions(userId: string | number): Promise<Kisit[]> {
  const yanit = recordOf(
    await lynonRequest(`/api/limit/api/v1.0/userSettings/userSettings/${config.lynon.siteId}/${userId}/restrictions`),
  );
  return arrayOf(yanit.restrictions) as Kisit[];
}

/**
 * Kisit ac/kapat.
 *
 * Yazma sozlesmesi Lynon dokumaninda YOK; GET yanitinin sekli tek
 * ipucu. Bu yuzden `kisitGovdeleri` iki aday govde uretiyor ve ilki
 * 4xx alirsa ikincisi deneniyor. Ikisi de basarisiz olursa hata
 * yukselir — sessizce "yapildi" denmez.
 *
 * Cekim ve yatirim bu yoldan KAPATILAMAZ; beyaz liste `IZINLI_KISITLAR`.
 */
export async function lynonSetPlayerRestriction(input: {
  userId: string | number;
  restriction: string;
  isRestricted: boolean;
  note: string;
}): Promise<{ govde: Record<string, unknown>; yanit: unknown }> {
  const { userId, restriction, isRestricted, note } = input;
  if (!izinliKisitMi(restriction)) {
    throw new LynonHttpError(`Bu akıştan '${restriction}' kısıtı değiştirilemez.`, 422, { restriction });
  }

  const yol = `/api/limit/api/v1.0/userSettings/userSettings/${config.lynon.siteId}/${userId}/restrictions`;
  const adaylar = kisitGovdeleri(restriction, isRestricted, note);
  let sonHata: unknown = null;

  for (const govde of adaylar) {
    try {
      const yanit = await lynonRequest(yol, { method: 'PUT', body: govde });
      return { govde, yanit };
    } catch (err) {
      sonHata = err;
      // 4xx govde sekli yanlis demek olabilir; digerini dene.
      const durum = (err as { status?: number })?.status ?? 0;
      if (durum < 400 || durum >= 500) throw err;
    }
  }
  throw sonHata ?? new LynonHttpError('Kısıt güncellenemedi.', 500, { userId, restriction });
}

export type LynonBalanceCorrectionType = 'crediting' | 'debiting';

/**
 * Updates the Lynon Player Main account through the same correction flow used by
 * player-accounts. The direction is encoded in the endpoint; amount is always positive.
 */
export async function lynonAdjustPlayerMainAccount(input: {
  playerId: string | number;
  amount: number;
  note: string;
  correctionType: LynonBalanceCorrectionType;
}): Promise<AnyRecord> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new LynonHttpError('Bakiye düzeltme tutarı pozitif olmalıdır.', 422, { amount: input.amount });
  }

  const note = String(input.note ?? '').trim().slice(0, 50);
  if (!note) {
    throw new LynonHttpError('Nakit düzeltme notu zorunludur.', 422, {});
  }
  const correctionType = input.correctionType;
  if (correctionType !== 'crediting' && correctionType !== 'debiting') {
    throw new LynonHttpError('Correction type crediting veya debiting olmalıdır.', 422, { correctionType });
  }

  const [detailResponse, accountsResponse] = await Promise.all([
    lynonPlayerDetail(input.playerId),
    lynonPlayerAccounts(input.playerId),
  ]);
  const player = recordOf(detailResponse.Data);
  if (Number(player.PartnerId ?? player.siteId) !== Number(config.lynon.siteId)) {
    throw new LynonHttpError('Oyuncu aktif Lynon sitesine ait değil.', 404, { playerId: input.playerId });
  }

  const accounts = arrayOf(accountsResponse.Data?.Objects);
  const mainAccount = accounts.find((account) =>
    String(account.accountType ?? '').toLowerCase() === 'playeraccount' &&
    String(account.currency ?? '').toUpperCase() === String(config.lynon.currency).toUpperCase()
  );
  const accountId = Number(mainAccount?.id);
  if (!Number.isFinite(accountId)) {
    throw new LynonHttpError('Lynon PlayerAccount bulunamadı.', 422, { playerId: input.playerId });
  }

  const endpoint = correctionType === 'crediting' ? 'creditbalance' : 'debitbalance';
  const updatedAccount = recordOf(await lynonRequest(`/api/platform/api/v1.0/BackofficeAccounts/${accountId}/${endpoint}`, {
    method: 'POST',
    body: { amount, note },
  }));
  return { ...updatedAccount, correctionType, accountId, amount };
}

/** Credits the Lynon PlayerAccount through the verified player-accounts flow. */
export async function lynonCreditPlayerMainAccount(input: {
  playerId: string | number;
  amount: number;
  note: string;
}): Promise<AnyRecord> {
  return lynonAdjustPlayerMainAccount({ ...input, correctionType: 'crediting' });
}

const PLAYER_OVERVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
let playerOverviewReportCache: { expiresAt: number; value: Promise<Map<string, AnyRecord>> } | null = null;

async function lynonPlayerOverviewMap(): Promise<Map<string, AnyRecord>> {
  if (playerOverviewReportCache && playerOverviewReportCache.expiresAt > Date.now()) {
    return playerOverviewReportCache.value;
  }

  const range = { startDate: yearAgoYmd(), endDate: todayYmd(), currency: config.lynon.currency };
  const value = Promise.all([
    lynonReportById(NARCOS_REPORT_IDS.playersOverview, range),
    lynonReportById(NARCOS_REPORT_IDS.playerBalance, range).catch(() => ({ Data: {} })),
  ]).then(([overviewReport, balanceReport]) => {
    const overviewRows = rowsFromReportData(recordOf(overviewReport.Data));
    const balanceRows = rowsFromReportData(recordOf(balanceReport.Data));
    const result = new Map<string, AnyRecord>();
    for (const row of overviewRows) {
      result.set(String(row['Player ID'] ?? row.player_id ?? row.PlayerExternalId ?? ''), row);
    }
    for (const balanceRow of balanceRows) {
      const key = String(balanceRow['Player ID'] ?? balanceRow.player_id ?? balanceRow.PlayerExternalId ?? '');
      if (!key) continue;
      const current = result.get(key) ?? {};
      result.set(key, {
        ...balanceRow,
        ...current,
        'User Name': current['User Name'] ?? balanceRow.Username,
        FullName: current.FullName ?? balanceRow['Full Name'],
        Currency: current.Currency ?? balanceRow.Currency,
        'REAL BALANCE (TRY)': balanceRow['Total Real Balance (TRY)'] ?? balanceRow['Total Real Balance'] ?? current['REAL BALANCE (TRY)'],
        'BONUS BALANCE (TRY)': balanceRow['Total Bonus Balance (TRY)'] ?? balanceRow['Total Bonus Balance'] ?? current['BONUS BALANCE (TRY)'],
        'TOTAL BALANCE (TRY)': balanceRow['Total Balance (TRY)'] ?? balanceRow['Total Balance'] ?? current['TOTAL BALANCE (TRY)'],
        LastDepositDate: balanceRow['Last Deposit Date'] ?? current.LastDepositDate,
        LastWithdrawalDate: balanceRow['Last Withdrawal Date'] ?? current.LastWithdrawalDate,
      });
    }
    return result;
  }).catch((error) => {
    playerOverviewReportCache = null;
    throw error;
  });

  playerOverviewReportCache = {
    expiresAt: Date.now() + PLAYER_OVERVIEW_CACHE_TTL_MS,
    value,
  };
  return value;
}
export async function lynonPlayerKpi(userId: string | number): Promise<AnyRecord> {
  // Oyuncu profilindeki 32 alanlı doğrudan Lynon KPI ucu, rapor tablosundan
  // daha güncel ve son yatırım/çekim tutarlarını da içerir.
  const [directResult, directDetailResult, directAccountsResult] = await Promise.allSettled([
    lynonRequest(`/api/report/api/v1.0/dashboardData/player/${config.lynon.siteId}/${userId}/dashboard/${config.lynon.currency}`),
    lynonRequest(`/api/user/api/v1.0/userBackOffice/users/${userId}`),
    lynonRequest(`/api/platform/api/v1.0/BackofficeAccounts/${userId}`),
  ]);
  const direct = directResult.status === 'fulfilled' ? recordOf(directResult.value) : {};
  if (Object.keys(direct).length > 0) {
    const responseSiteId = numberFrom(direct['a.SiteId'] ?? direct.SiteId, NaN);
    if (Number.isFinite(responseSiteId) && responseSiteId !== Number(config.lynon.siteId)) {
      throw new LynonHttpError('Oyuncu aktif Lynon sitesine ait değil.', 404, { userId });
    }

    const detail = directDetailResult.status === 'fulfilled' ? recordOf(directDetailResult.value) : {};
    const detailSiteId = numberFrom(detail.siteId ?? detail.SiteId, NaN);
    if (Number.isFinite(detailSiteId) && detailSiteId !== Number(config.lynon.siteId)) {
      throw new LynonHttpError('Oyuncu aktif Lynon sitesine ait değil.', 404, { userId });
    }
    const accounts = directAccountsResult.status === 'fulfilled' ? arrayOf(directAccountsResult.value) : [];
    const player = mapPlayer(detail);
    const totalBalance = pickAmount(direct, ['TOTAL BALANCE']);
    const balance = pickAmount(direct, ['REAL BALANCE'], totalBalance);
    const bonusBalance = pickAmount(direct, ['BONUS BALANCE']);
    const depositAmount = pickAmount(direct, ['TOTAL DEPOSITS AMOUNT']);
    const withdrawalAmount = pickAmount(direct, ['TOTAL WITHDRAWALS AMOUNT']);
    const casinoRealStake = pickAmount(direct, ['CASINO REAL BETS']);
    const casinoBonusStake = pickAmount(direct, ['CASINO BONUS BETS']);
    const casinoRealWin = pickAmount(direct, ['CASINO REAL WINS']);
    const casinoBonusWin = pickAmount(direct, ['CASINO BONUS WINS']);
    const sportRealStake = pickAmount(direct, ['SPORT REAL BETS']);
    const sportBonusStake = pickAmount(direct, ['SPORT BONUS BETS']);
    const sportRealWin = pickAmount(direct, ['SPORT REAL WINS']);
    const sportBonusWin = pickAmount(direct, ['SPORT BONUS WINS']);
    const lastDepositDate = firstNonEmpty(direct['LAST DEPOSIT DATE']) || null;
    const lastWithdrawalDate = firstNonEmpty(direct['LAST WITHDRAWAL DATE']) || null;

    return {
      HasError: false,
      AlertType: 'success',
      AlertMessage: '',
      ModelErrors: [],
      Data: {
        Id: numberFrom(userId),
        ClientId: numberFrom(userId),
        Login: player.Login || null,
        Name: `${detail.firstName ?? ''} ${detail.lastName ?? ''}`.trim() || null,
        TotalSportBets: 0,
        TotalUnsettledBets: 0,
        TotalSportStakes: sportRealStake + sportBonusStake,
        TotalUnsettledStakes: 0,
        TotalSportWinnings: sportRealWin + sportBonusWin,
        TotalCasinoStakes: casinoRealStake + casinoBonusStake,
        TotalCasinoWinnings: casinoRealWin + casinoBonusWin,
        SportProfitness: pickAmount(direct, ['SPORT GGR']),
        CasinoProfitness: pickAmount(direct, ['CASINO GGR']),
        TotalDeposit: depositAmount,
        TotalWithdrawal: withdrawalAmount,
        ProfitAndLose: depositAmount - withdrawalAmount,
        GamingProfitAndLose: pickAmount(direct, ['GGR']),
        DepositAmount: depositAmount,
        DepositCount: pickAmount(direct, ['TOTAL DEPOSITS COUNT']),
        FirstDepositTime: null,
        FirstDepositTimeLocal: null,
        LastDepositAmount: pickAmount(direct, ['LAST DEPOSIT AMOUNT']),
        LastDepositTime: lastDepositDate,
        LastDepositTimeLocal: lastDepositDate,
        WithdrawalAmount: withdrawalAmount,
        WithdrawalCount: pickAmount(direct, ['TOTAL WITHDRAWALS COUNT']),
        LastWithdrawalAmount: pickAmount(direct, ['LAST WITHDRAWAL AMOUNT']),
        LastWithdrawalTime: lastWithdrawalDate,
        LastWithdrawalTimeLocal: lastWithdrawalDate,
        TotalSportBonusStakes: sportBonusStake,
        TotalSportBonusWinings: sportBonusWin,
        TotalCasinoBonusStakes: casinoBonusStake,
        TotalCasinoBonusWinings: casinoBonusWin,
        TotalBetAmount: pickAmount(direct, ['TOTAL BET AMOUNT']),
        TotalWinAmount: pickAmount(direct, ['TOTAL WIN AMOUNT']),
        FreeSpinWin: pickAmount(direct, ['FREE SPIN WIN']),
        BonusPayout: pickAmount(direct, ['BONUS PAYOUT']),
        CashbackBonus: pickAmount(direct, ['CASHBACK BONUS']),
        SportsbookProfileId: null,
        CurrencyId: firstNonEmpty(direct.Currency, detail.preferredCurrency, config.lynon.currency),
        Balance: balance,
        TotalBalance: totalBalance || balance + bonusBalance,
        BonusBalance: bonusBalance,
        CategoryName: detail.category?.name ?? player.CategoryName ?? null,
        Email: detail.email ?? player.Email ?? null,
        Phone: detail.phoneNumber ?? player.Phone ?? null,
        IsVerified: player.IsVerified,
        // Dogrulama durumlari AYRI tasinir: "dogrulanmis" tek bayragi,
        // telefonu onaylanmamis ama e-postasi onaylanmis bir oyuncuyu da
        // dogrulanmis gosteriyordu. Cekim degerlendirmesinde telefon
        // onayi ayri bir sinyal.
        IsPhoneVerified: player.IsPhoneVerified,
        IsEmailVerified: player.IsEmailVerified,
        IsIdentityVerified: player.IsIdentityVerified,
        VerificationStatus: player.VerificationStatus,
        IsTest: detail.isTest === true,
        BTag: detail.affiliateId ?? null,
        LastLoginIp: detail.lastLoginIp ?? null,
        LastLoginDate: detail.lastLoginDate ?? null,
        RegistrationDate: detail.registrationDate ?? null,
        rawKpi: direct,
        rawAccounts: accounts,
      },
    };
  }

  let overview: AnyRecord = {};
  try {
    overview = (await lynonPlayerOverviewMap()).get(String(userId)) ?? {};
  } catch {
    overview = {};
  }

  if (Object.keys(overview).length > 0) {
    const depositAmount = pickAmount(overview, [
      'TOTAL DEPOSITS AMOUNT FILTERED (TRY)',
      'TOTAL DEPOSITS AMOUNT FILTERED',
      'TOTAL DEPOSITS AMOUNT (TRY)',
      'TOTAL DEPOSITS AMOUNT',
    ]);
    const withdrawalAmount = pickAmount(overview, [
      'TOTAL WITHDRAWALS AMOUNT FILTERED (TRY)',
      'TOTAL WITHDRAWALS AMOUNT FILTERED',
      'TOTAL WITHDRAWALS AMOUNT (TRY)',
      'TOTAL WITHDRAWALS AMOUNT',
    ]);
    const casinoStake = pickAmount(overview, ['CASINO REAL BETS FILTERED', 'CASINO REAL BETS']) +
      pickAmount(overview, ['CASINO BONUS BETS FILTERED', 'CASINO BONUS BETS']);
    const casinoWin = pickAmount(overview, ['CASINO REAL WINS FILTERED', 'CASINO REAL WINS']) +
      pickAmount(overview, ['CASINO BONUS WINS FILTERED', 'CASINO BONUS WINS']);
    const sportStake = pickAmount(overview, ['SPORT REAL BETS FILTERED', 'SPORT REAL BETS']) +
      pickAmount(overview, ['SPORT BONUS BETS FILTERED', 'SPORT BONUS BETS']);
    const sportWin = pickAmount(overview, ['SPORT REAL WINS FILTERED', 'SPORT REAL WINS']) +
      pickAmount(overview, ['SPORT BONUS WINS FILTERED', 'SPORT BONUS WINS']);
    const casinoGgr = pickAmount(overview, ['CASINO GGR FILTERED', 'CASINO GGR']);
    const sportGgr = pickAmount(overview, ['SPORT GGR FILTERED', 'SPORT GGR']);
    const ggr = pickAmount(overview, ['GGR (TRY)__SUM FILTERED', 'GGR FILTERED', 'GGR (TRY)', 'GGR'], casinoGgr + sportGgr);
    const balance = pickAmount(overview, ['REAL BALANCE (TRY)', 'REAL BALANCE', 'TOTAL BALANCE (TRY)', 'TOTAL BALANCE']);
    const bonusBalance = pickAmount(overview, ['BONUS BALANCE (TRY)', 'BONUS BALANCE']);

    return {
      HasError: false,
      AlertType: 'success',
      AlertMessage: '',
      ModelErrors: [],
      Data: {
        Id: numberFrom(userId),
        ClientId: numberFrom(userId),
        Login: firstNonEmpty(overview['User Name'], overview.UserName, overview.username),
        Name: firstNonEmpty(overview.FullName, overview.fullName) || null,
        TotalSportBets: 0,
        TotalUnsettledBets: 0,
        TotalSportStakes: sportStake,
        TotalUnsettledStakes: 0,
        TotalSportWinnings: sportWin,
        TotalCasinoStakes: casinoStake,
        TotalCasinoWinnings: casinoWin,
        SportProfitness: sportGgr,
        CasinoProfitness: casinoGgr,
        TotalDeposit: depositAmount,
        TotalWithdrawal: withdrawalAmount,
        ProfitAndLose: depositAmount - withdrawalAmount,
        GamingProfitAndLose: ggr,
        DepositAmount: depositAmount,
        DepositCount: pickAmount(overview, ['TOTAL DEPOSITS COUNT FILTERED', 'TOTAL DEPOSITS COUNT']),
        WithdrawalCount: pickAmount(overview, ['TOTAL WITHDRAWALS COUNT FILTERED', 'TOTAL WITHDRAWALS COUNT']),
        WithdrawalAmount: withdrawalAmount,
        CurrencyId: firstNonEmpty(overview.Currency, config.lynon.currency),
        Balance: balance,
        TotalBalance: pickAmount(overview, ['TOTAL BALANCE (TRY)', 'TOTAL BALANCE'], balance + bonusBalance),
        BonusBalance: bonusBalance,
        CategoryName: overview.Category ?? null,
        Email: overview.Email ?? null,
        Phone: overview.PhoneNumber ?? null,
        IsVerified: overview['Is Mail Verified'] === true || overview['Is Phone Verified'] === true,
        IsTest: false,
        BTag: overview['Affiliate Id'] ?? null,
        LastDepositTimeLocal: overview.LastDepositDate ?? null,
        LastWithdrawalTimeLocal: overview.LastWithdrawalDate ?? null,
        rawOverview: overview,
      },
    };
  }

  // Aktivitesi olmayan oyuncular raporda yer almayabilir; yalnızca bu durumda iki temel uca düş.
  const [detailResult, accountsResult] = await Promise.allSettled([
    lynonRequest(`/api/user/api/v1.0/userBackOffice/users/${userId}`),
    lynonRequest(`/api/platform/api/v1.0/BackofficeAccounts/${userId}`),
  ]);
  const detail = detailResult.status === 'fulfilled' ? recordOf(detailResult.value) : {};
  const accounts = accountsResult.status === 'fulfilled' ? arrayOf(accountsResult.value) : [];
  const mainAccount = pickMainAccount(accounts);
  const bonusBalance = accounts
    .filter((account) => /bonus/i.test(String(account.accountType)))
    .reduce((sum, account) => sum + numberFrom(account.balance), 0);
  const player = mapPlayer(detail);
  const balance = mainAccount ? numberFrom(mainAccount.balance) : numberFrom(player.Balance);

  return {
    HasError: false,
    AlertType: 'success',
    AlertMessage: '',
    ModelErrors: [],
    Data: {
      Id: numberFrom(userId), ClientId: numberFrom(userId), Login: player.Login || null,
      Name: `${detail.firstName ?? ''} ${detail.lastName ?? ''}`.trim() || null,
      TotalSportBets: 0, TotalUnsettledBets: 0, TotalSportStakes: 0, TotalUnsettledStakes: 0,
      TotalSportWinnings: 0, TotalCasinoStakes: 0, TotalCasinoWinnings: 0,
      SportProfitness: 0, CasinoProfitness: 0, TotalDeposit: 0, TotalWithdrawal: 0,
      ProfitAndLose: 0, GamingProfitAndLose: 0, DepositAmount: 0, DepositCount: 0,
      WithdrawalCount: 0, WithdrawalAmount: 0,
      CurrencyId: firstNonEmpty(mainAccount?.currency, detail.preferredCurrency, config.lynon.currency),
      Balance: balance, TotalBalance: balance + bonusBalance, BonusBalance: bonusBalance,
      LastLoginIp: detail.lastLoginIp ?? null, LastLoginDate: detail.lastLoginDate ?? null,
      RegistrationDate: detail.registrationDate ?? null, IsTest: false, IsVerified: player.IsVerified,
      BTag: null, rawDetail: detail, rawAccounts: accounts,
    },
  };
}
export async function lynonPaymentTransactions(
  body: AnyRecord = {},
  opts: { transactionTypes?: 'deposit' | 'withdrawal' | null; status?: string[] | null } = {}
): Promise<AnyRecord[]> {
  const { page, countPerPage } = pageFromBody(body);
  const range = dateRangeFromBody(body);
  const query = firstNonEmpty(body.query, body.ClientLogin, body.UserName, body.ClientId, body.Id, body.ExternalId);
  const requestedStatuses = transactionStatusFromBody(body, opts.status);
  const requestedTypes = Array.isArray(body.transactionTypes)
    ? body.transactionTypes.map((value: unknown) => String(value).trim().toLowerCase()).filter(Boolean)
    : [opts.transactionTypes ?? body.transactionTypes]
        .map((value) => String(value ?? '').trim().toLowerCase())
        .filter(Boolean);
  const payload = {
    siteId: config.lynon.siteId,
    page,
    countPerPage,
    query: query || null,
    status: requestedStatuses,
    transactionTypes: opts.transactionTypes ?? body.transactionTypes ?? null,
    transactionType: opts.transactionTypes ?? body.transactionType ?? null,
    amountFrom: nullableNumber(body.AmountFrom ?? body.MinAmount),
    amountTo: nullableNumber(body.AmountTo ?? body.MaxAmount),
    creationDateFrom: range.from ?? null,
    creationDateTo: range.to ?? null,
    createdAtFrom: range.from ?? null,
    createdAtTo: range.to ?? null,
    updateDateFrom: toIsoDateTime(body.FromTransactionDateLocal ?? body.updateDateFrom) ?? null,
    updateDateTo: toIsoDateTime(body.ToTransactionDateLocal ?? body.updateDateTo, true) ?? null,
    currencies: body.CurrencyId ? [String(body.CurrencyId)] : null,
    methodIds: nullableNumber(body.PaymentSystemId) != null ? [nullableNumber(body.PaymentSystemId)!] : null,
    corrected: typeof body.corrected === 'boolean' ? body.corrected : null,
  };

  // Belirli bir oyuncu için istek yapılıyorsa, site geneli arama (POST + sayfalama)
  // yerine oyuncuya özel GET endpoint'i kullan. Site geneli endpoint yalnızca istenen
  // sayfadaki (varsayılan ilk 100-500) kayıtları döndürüyor; yoğun bir sitede belirli bir
  // oyuncunun yatırımları o pencerede hiç yer almayabilir ve sonuç sessizce boş dönerdi.
  const explicitClientId = nullableNumber(body.ClientId ?? body.clientId ?? body.playerId);
  const rows = explicitClientId != null && explicitClientId > 0
    ? arrayOf(await lynonRequest(`/api/payment-operations/api/v1.0/backofficeTransactions/users/${explicitClientId}/sites/${config.lynon.siteId}`))
    // Bazı Lynon kurulumları filtre alanlarını sessizce yok sayıp tüm kayıtları döndürüyor.
    // Bu yüzden aynı filtreleri sunucuda da zorunlu uygula; yatırım/çekim ve tarih asla karışmasın.
    : arrayOf(await lynonRequest('/api/payment-operations/api/v1.0/BackOfficeTransactions', {
        method: 'POST',
        body: { request: payload },
      }));
  const fromMs = range.from ? Date.parse(range.from) : null;
  const toMs = range.to ? Date.parse(range.to) : null;
  const statusSet = requestedStatuses?.length
    ? new Set(requestedStatuses.map((value) => String(value).trim().toLowerCase()))
    : null;
  const typeSet = requestedTypes.length ? new Set(requestedTypes) : null;
  const queryText = query.toLocaleLowerCase('tr-TR');

  return rows.filter((row) => {
    const type = String(row.transactionType ?? row.type ?? '').trim().toLowerCase();
    if (typeSet && !typeSet.has(type)) return false;

    const status = String(row.status ?? row.state ?? '').trim().toLowerCase();
    if (statusSet && !statusSet.has(status)) return false;

    const createdMs = Date.parse(String(row.createdAt ?? row.creationDate ?? row.updatedAt ?? ''));
    if (fromMs != null && (!Number.isFinite(createdMs) || createdMs < fromMs)) return false;
    if (toMs != null && (!Number.isFinite(createdMs) || createdMs > toMs)) return false;

    if (queryText) {
      const personal = recordOf(row.personalData);
      const candidates = [
        row.userId,
        row.id,
        row.platformTransactionId,
        row.referenceNumber,
        row.userName,
        row.username,
        personal.userName,
        personal.username,
      ].map((value) => String(value ?? '').toLocaleLowerCase('tr-TR'));
      if (!candidates.some((value) => value === queryText || value.includes(queryText))) return false;
    }

    return true;
  });
}
export async function lynonDeposits(body: AnyRecord = {}): Promise<AnyRecord> {
  const rows = (await lynonPaymentTransactions(body, { transactionTypes: 'deposit' })).map(mapTransaction);
  return {
    HasError: false,
    Data: {
      Documents: { Count: rows.length, Objects: rows },
      TotalAmount: rows.reduce((sum, row) => sum + numberFrom(row.Amount), 0),
    },
  };
}

export async function lynonWithdrawalRequests(body: AnyRecord = {}): Promise<AnyRecord> {
  const rows = (await lynonPaymentTransactions(body, {
    transactionTypes: 'withdrawal',
    status: null,

  })).map(mapTransaction);

  return {
    HasError: false,
    Data: {
      ClientRequests: rows,
      TotalAmount: rows.reduce((sum, row) => sum + numberFrom(row.Amount), 0),
      Count: rows.length,
    },
  };
}

export async function lynonClientTransactions(body: AnyRecord = {}): Promise<AnyRecord> {
  // ClientId opsiyoneldir: boşsa (ör. /islemler sayfasında oyuncu filtresi seçilmemişse)
  // site geneli işlem listesi döner — önceden burada erken boş dönüş vardı ve sayfa
  // hiçbir oyuncu filtrelenmeden açıldığında her zaman boş görünüyordu.
  const clientId = firstNonEmpty(body.ClientId, body.clientId, body.userId, body.Id);

  const requestedTypeCodes = Array.isArray(body.DocumentTypeIds)
    ? body.DocumentTypeIds.map((value: unknown) => String(value)).filter((value: string) => value.includes('.'))
    : [];
  const fetchBody = { ...body, ClientId: clientId || undefined, MaxRows: 500, SkeepRows: 0 };
  const range = dateRangeFromBody(body);
  // İşlemler sekmesi TÜM finansal hareket türlerini gösterir (Bahis, Kazanç, Bonus*,
  // Turnuva, Jackpot, İade, ChargeBack, BalanceCorrection …). operationTypes boş
  // bırakılınca Lynon hepsini döner; yalnızca BalanceCorrection istendiğinde diğer
  // 19 tür hiç çekilmiyordu ve profilde görünmüyordu.
  const [rawRows, movementRows] = await Promise.all([
    lynonPaymentTransactions(fetchBody),
    lynonFinancialMovements({
      playerId: clientId || undefined,
      operationTypes: [],
      startDate: range.from ?? null,
      endDate: range.to ?? null,
      countPerPage: 500,
    }).catch(() => [] as AnyRecord[]),
  ]);
  const payments = rawRows
    .filter((row) => !clientId || String(row.userId ?? '') === String(clientId))
    .map(mapTransaction);
  const corrections = filterMappedRowsByRange(
    movementRows
      .filter((row) => !clientId || String(row.playerId ?? '') === String(clientId))
      .map(mapFinancialMovement),
    range.from,
    range.to
  );
  let combined = [...payments, ...corrections]
    .sort((a, b) => Date.parse(String(b.CreatedLocal ?? '')) - Date.parse(String(a.CreatedLocal ?? '')));
  if (requestedTypeCodes.length > 0) {
    const allowed = new Set(requestedTypeCodes);
    combined = combined.filter((row) => allowed.has(String(row.TypeCode ?? '')));
  }

  const { page, countPerPage } = pageFromBody(body);
  const start = (page - 1) * countPerPage;
  const rows = combined.slice(start, start + countPerPage);
  return {
    HasError: false,
    Data: {
      Provider: 'lynon',
      Documents: { Count: combined.length, Objects: rows },
      Count: combined.length,
      Objects: rows,
      // İstemcinin tür filtresini doldurabilmesi için kanonik liste; yalnızca bu
      // oyuncuda görülen türlerden türetilirse tam liste asla oluşmuyor.
      TransactionTypes: lynonTransactionTypeOptions(),
      TotalAmount: combined.reduce((sum, row) => sum + numberFrom(row.Amount), 0),
    },
  };
}

export async function lynonBonusDefinitions(): Promise<AnyRecord> {
  const [offers, campaigns] = await Promise.allSettled([
    lynonRequest(`/api/bonusoffer/api/v1.0/offer/${config.lynon.siteId}`, {
      query: { bonusEngineVersion: 'V2' },
    }),
    lynonCampaigns(1, 500),
  ]);

  if (campaigns.status !== 'fulfilled') throw campaigns.reason;

  const normalizeCatalogTitle = (value: unknown) => String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/%/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const campaignRows: AnyRecord[] = campaigns.status === 'fulfilled'
    ? arrayOf(campaigns.value).map((row) => mapBonus(row, 'campaign'))
    : [];
  const campaignByTitle = new Map(
    campaignRows
      .map((row) => [normalizeCatalogTitle(row.Name), row] as const)
      .filter(([title]) => Boolean(title))
  );
  const offerRows: AnyRecord[] = offers.status === 'fulfilled'
    ? arrayOf(offers.value).map((row) => {
        const mapped = mapBonus(row, 'offer');
        const linkedCampaign = campaignByTitle.get(normalizeCatalogTitle(mapped.Name));
        const partnerBonusId = nullableNumber(mapped.PartnerBonusId ?? linkedCampaign?.PartnerBonusId);
        return {
          ...mapped,
          CampaignId: partnerBonusId,
          PartnerBonusId: partnerBonusId,
          IsAssignable: partnerBonusId != null,
        };
      })
    : [];

  // Aynı kampanyayı offer ve campaign uçları birlikte döndürdüğünde kampanya kaydı
  // tercih edilir. Eşleşmeyen offer kayıtları görünür fakat atanabilir bonus sayılmaz.
  const unique = new Map<string, AnyRecord>();
  for (const row of [...campaignRows, ...offerRows]) {
    const key = row.PartnerBonusId != null
      ? `campaign:${row.PartnerBonusId}`
      : `${String(row.SourceType).toLowerCase()}:${row.Id}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  const result = Array.from(unique.values());

  return {
    Result: result,
    HasError: false,
    ErrorDescription: null,
    ErrorId: 0,
    Count: result.length,
    Data: { Count: result.length, Objects: result },
    DataCompleteness: {
      campaigns: campaigns.status === 'fulfilled',
      offers: offers.status === 'fulfilled',
    },
  };
}
export async function lynonBonusRequests(): Promise<AnyRecord> {
  const rows = arrayOf(await lynonRequest(`/api/bonusOffer/api/v1.0/request/${config.lynon.siteId}`, {
    query: { bonusEngineVersion: 'V2', siteId: config.lynon.siteId },
  }));
  return wrapObjects(rows);
}

export async function lynonPromoCodes(): Promise<AnyRecord> {
  const rows = arrayOf(await lynonRequest(`/api/promocodes/api/v1.0/promocodes/get-promocodes/${config.lynon.siteId}`, {
    query: { page: 1, countPerPage: 50 },
  }));
  return wrapObjects(rows);
}

export async function lynonActiveWheels(): Promise<AnyRecord> {
  const data = await lynonRequest(`/api/wheel/api/v1.0/WheelsBackOffice/sites/${config.lynon.siteId}/active-wheels`);
  return { HasError: false, Data: data };
}

export async function lynonBonusBlocks(): Promise<AnyRecord> {
  const rows = arrayOf(await lynonRequest('/api/bonusenginev2/api/v1/Block'));
  return wrapObjects(rows);
}

export async function lynonPlayerCategories(): Promise<AnyRecord> {
  const rows = arrayOf(await lynonRequest(`/api/user/api/v1.0/categories/bysite/${config.lynon.siteId}`));
  return wrapObjects(rows);
}

export async function lynonKycDocuments(): Promise<AnyRecord> {
  const rows = arrayOf(await lynonRequest('/api/kyc/api/v1.0/documentsVerifications', {
    query: { siteId: config.lynon.siteId },
  }));
  return wrapObjects(rows);
}

/**
 * Lynon'un birleşik finansal hareket defteri (Deposit/Withdrawal/RejectWithdrawal/
 * BalanceCorrection vb. operationType'larla tek uçtan). Gerçek istek gövdesi ve yanıt
 * şekli doğrulanmıştır: POST body düz (sarmalanmamış) JSON, satırlar { id, date,
 * operationType, accountFrom, accountTo, balance, amount (işaretli), currency, playerId }.
 */
export async function lynonFinancialMovements(input: {
  playerId?: number | string;
  operationTypes?: string[];
  startDate?: string | null;
  endDate?: string | null;
  page?: number;
  countPerPage?: number;
}): Promise<AnyRecord[]> {
  const result = await lynonRequest('/api/platform/api/v1.0/BackofficeTransaction/financial-movement', {
    method: 'POST',
    body: {
      accountFromTypes: [],
      accountToTypes: [],
      countPerPage: input.countPerPage ?? 300,
      currencies: [],
      endDate: input.endDate ?? null,
      operationTypes: input.operationTypes ?? [],
      page: input.page ?? 1,
      playerId: input.playerId != null ? Number(input.playerId) : undefined,
      startDate: input.startDate ?? null,
    },
  });
  return arrayOf(result);
}

/** Lynon financial-movement operationType değerleri (backoffice dropdown'undan doğrulanmıştır). */
const FINANCIAL_MOVEMENT_TYPE_NAMES: Record<string, string> = {
  Bet: 'Bahis',
  BonusBet: 'Bonus Bahis',
  InGameBonusBet: 'Oyun İçi Bonus Bahis',
  Deposit: 'Yatırım',
  BonusMoneyBet: 'Bonus Bakiye Bahis',
  Win: 'Kazanç',
  BonusWin: 'Bonus Kazanç',
  InGameBonusWin: 'Oyun İçi Bonus Kazanç',
  Withdrawal: 'Çekim',
  RejectWithdrawal: 'Çekim Reddi',
  TournamentBet: 'Turnuva Bahis',
  BonusMoneyBonusBet: 'Bonus Bakiye Bonus Bahis',
  TournamentWin: 'Turnuva Kazanç',
  CashbackBonus: 'Kayıp Bonusu',
  JackpotWin: 'Jackpot Kazancı',
  RealMoneyBonus: 'Gerçek Bakiye Bonusu',
  BonusMoneyWin: 'Bonus Bakiye Kazanç',
  BonusMoneyBonusWin: 'Bonus Bakiye Bonus Kazanç',
  Refund: 'İade',
  ChargeBack: 'Ters İbraz',
  AwardBonus: 'Bonus Verildi',
  CompleteBonus: 'Bonus Tamamlandı',
  BalanceCorrection: 'Bakiye Düzeltmesi',
};

function financialMovementTypeName(operationType: string): string {
  return FINANCIAL_MOVEMENT_TYPE_NAMES[operationType] ?? operationType;
}

/**
 * Oyuncu profili "İşlemler" sekmesindeki tür filtresinin tam listesi. TypeCode'lar
 * mapFinancialMovement/mapTransaction ile birebir aynı biçimde üretilir ki istemci
 * seçtiği kodu DocumentTypeIds olarak geri gönderdiğinde filtre tutsun.
 */
export function lynonTransactionTypeOptions(): Array<{ id: string; name: string }> {
  return [
    { id: 'payment.deposit', name: 'Yatırım' },
    { id: 'payment.withdrawal', name: 'Çekim' },
    ...Object.entries(FINANCIAL_MOVEMENT_TYPE_NAMES).map(([code, name]) => ({
      id: `financial.${code}`,
      name,
    })),
  ];
}

const FINANCIAL_MOVEMENT_TYPE_NAMES_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(FINANCIAL_MOVEMENT_TYPE_NAMES).map(([key, value]) => [key.toLowerCase(), value])
);

/** Casino/spor işlem uçlarındaki 'type' alanı küçük harfle gelir (ör. "win"); aynı Türkçe
 * sözlüğü büyük/küçük harf duyarsız eşleştirir, tanımadığı değeri olduğu gibi bırakır. */
function financialMovementTypeNameCaseInsensitive(type: string): string {
  if (!type) return '';
  return FINANCIAL_MOVEMENT_TYPE_NAMES_LOWER[type.toLowerCase()] ?? type;
}

function mapFinancialMovement(row: AnyRecord): AnyRecord {
  const operationType = String(row.operationType ?? '');
  const typeName = financialMovementTypeName(operationType);
  const signedAmount = numberFrom(row.amount);
  const isCredit = signedAmount >= 0;
  const id = row.id ?? `${row.playerId ?? 'player'}-${row.date ?? 'movement'}`;
  return {
    ...row,
    Id: `correction-${id}`,
    DocumentId: `correction-${id}`,
    ReferenceNo: `FIN-${id}`,
    DocumentTypeName: typeName || (isCredit ? 'Bakiye Düzeltmesi - Alacak' : 'Bakiye Düzeltmesi - Borç'),
    DocumentState: 'success',
    DocumentStateName: 'Başarılı',
    StateName: 'Başarılı',
    Operation: isCredit ? 2 : 1,
    Balance: nullableNumber(row.balance),
    ClientId: Number.isFinite(numberFrom(row.playerId, NaN)) ? numberFrom(row.playerId) : row.playerId,
    ClientLogin: firstNonEmpty(row.playerUserName, row.playerId),
    Amount: Math.abs(signedAmount),
    AmountEUR: Math.abs(signedAmount),
    CurrencyId: firstNonEmpty(row.currency, config.lynon.currency),
    ExchangedAmount: Math.abs(signedAmount),
    TransactionDate: row.date ?? null,
    CreatedLocal: row.date ?? null,
    ModifiedLocal: row.date ?? null,
    TypeName: typeName,
    TypeCode: operationType ? `financial.${operationType}` : `correction.${isCredit ? 'crediting' : 'debiting'}`,
    OperationType: operationType,
    State: 'success',
    UserName: firstNonEmpty(row.userName, 'Lynon Backoffice'),
    Note: firstNonEmpty(row.note, row.accountFrom && row.accountTo ? `${row.accountFrom} → ${row.accountTo}` : null),
    /**
     * Duzeltme yonu. Bu alan HIC uretilmiyordu; snapshot
     * `row.CorrectionType ?? row.correctionType` okudugu icin
     * balanceCorrections'ta `tur` her zaman bos kaliyordu. Tutar da
     * Math.abs ile yaziliyor, yani isaret de kayip. Sonuc: geri ALINAN
     * (debiting) duzeltmeler bonus kullanimi sayiliyordu.
     */
    CorrectionType: isCredit ? 'crediting' : 'debiting',
    AccountName: firstNonEmpty(row.accountName, row.accountFrom),
  };
}

export async function lynonCorrectionHistory(body: AnyRecord = {}): Promise<AnyRecord> {
  const { page, countPerPage } = pageFromBody(body);
  const playerId = firstNonEmpty(body.playerId, body.PlayerId, body.ClientId, body.clientId);
  const range = dateRangeFromBody(body);
  const rows = await lynonFinancialMovements({
    playerId: playerId || undefined,
    operationTypes: ['BalanceCorrection'],
    startDate: range.from ?? null,
    endDate: range.to ?? null,
    page,
    countPerPage,
  });
  const fromMs = range.from ? Date.parse(range.from) : null;
  const toMs = range.to ? Date.parse(range.to) : null;
  const filtered = rows.filter((row) => {
    if (playerId && String(row.playerId ?? '') !== String(playerId)) return false;
    const createdMs = Date.parse(String(row.date ?? ''));
    if (fromMs != null && (!Number.isFinite(createdMs) || createdMs < fromMs)) return false;
    if (toMs != null && (!Number.isFinite(createdMs) || createdMs > toMs)) return false;
    return true;
  });
  return wrapObjects(filtered.map(mapFinancialMovement));
}

export async function lynonPaymentCounts(): Promise<AnyRecord> {
  const [deposit, withdrawal] = await Promise.allSettled([
    lynonRequest('/api/payment-operations/api/v1.0/BackOfficeTransactions/deposit/count'),
    lynonRequest('/api/payment-operations/api/v1.0/BackOfficeTransactions/withdrawal/count'),
  ]);
  return {
    HasError: false,
    Data: {
      deposit: deposit.status === 'fulfilled' ? deposit.value : null,
      withdrawal: withdrawal.status === 'fulfilled' ? withdrawal.value : null,
    },
  };
}

export async function lynonPaymentMethods(): Promise<AnyRecord> {
  const rows = arrayOf(await lynonRequest(`/api/payment-integration/api/v1.0/BackOfficePayments/${config.lynon.siteId}/payments`));
  return wrapObjects(rows);
}

export async function lynonDictionaries(): Promise<AnyRecord> {
  const [currencies, timeZones, languages] = await Promise.allSettled([
    lynonRequest('/api/dictionary/api/v1.0/currencies'),
    lynonRequest('/api/dictionary/api/v1.0/timeZones'),
    lynonRequest('/api/cmsgateway/api/v1/languages'),
  ]);
  return {
    HasError: false,
    Data: {
      currencies: currencies.status === 'fulfilled' ? currencies.value : [],
      timeZones: timeZones.status === 'fulfilled' ? timeZones.value : [],
      languages: languages.status === 'fulfilled' ? languages.value : [],
    },
  };
}

export async function lynonBackofficeSettings(): Promise<AnyRecord> {
  const data = await lynonRequest('/api/backofficeuser/api/v1/BackOfficeUsers/settings');
  return { HasError: false, Data: data };
}

export async function lynonGridLayout(tableKey: string): Promise<AnyRecord> {
  const data = await lynonRequest(`/api/backofficeuser/api/v1/GridLayoutConfigs/${encodeURIComponent(tableKey)}`);
  return { HasError: false, Data: data };
}

export async function lynonReportCatalog(force = false): Promise<AnyRecord[]> {
  if (!force && reportCatalogCache && Date.now() - reportCatalogCache.ts < REPORT_CACHE_TTL_MS) {
    return reportCatalogCache.data;
  }
  const data = arrayOf(await lynonRequest(`/api/report/api/v1.0/reportData/site/${config.lynon.siteId}`));
  reportCatalogCache = { ts: Date.now(), data };
  return data;
}

/**
 * RAPOR KIMLIGI ONCE, AD SONRA.
 *
 * Raporlar `lynonReportByName('Report By Provider')` gibi ADLA
 * cagriliyordu. Ad, Lynon katalogundaki serbest metin: bir harf
 * degisirse ya da rapor yeniden adlandirilirsa arama 404 doner.
 * Sonuclari sessiz degil ama gorunmez oluyordu:
 *
 *   - Saglayici raporu: hata firlatiyor, ekran "Tekrar Dene" gosteriyor.
 *   - Partner kar: `Promise.allSettled` icinde oldugu icin hata
 *     yutuluyor ve kod pano ham alanlarina geri dusuyor -- ekranda
 *     rakam VAR ama yanlis kaynaktan.
 *
 * Kimlikler sabit (NARCOS_REPORT_IDS). Once kimlikle denenir, kimlik
 * calismazsa ada dusulur; boylece Lynon rapor kimliklerini degistirirse
 * de calismaya devam eder.
 */
async function raporGetir(
  reportId: number,
  reportName: string,
  range: { startDate?: string; endDate?: string; currency?: string } = {},
): Promise<AnyRecord> {
  try {
    return await lynonReportById(reportId, range);
  } catch (err) {
    return lynonReportByName(reportName, range);
  }
}

export async function lynonReportByName(
  reportName: string,
  range: { startDate?: string; endDate?: string; currency?: string } = {}
): Promise<AnyRecord> {
  const catalog = await lynonReportCatalog();
  const normalized = reportName.trim().toLowerCase();
  const report = catalog.find((item) => String(item.name ?? '').trim().toLowerCase() === normalized);
  if (!report?.id) {
    throw new LynonHttpError(`Rapor bulunamadi: ${reportName}`, 404, { reportName });
  }

  const data = recordOf(await lynonRequest(`/api/report/api/v1.0/reportData/summarized/${report.id}`, {
    query: {
      startDate: gunBasi(range.startDate ?? yearAgoYmd()),
      endDate: gunSonu(range.endDate ?? todayYmd()),
      currency: range.currency ?? config.lynon.currency,
    },
  }));

  return { HasError: false, Data: data, report };
}

export const NARCOS_REPORT_IDS = {
  bonus: 1838,
  withdrawals: 1839,
  game: 1840,
  playersOverview: 1841,
  integrationPayment: 1842,
  playerBalance: 1843,
  provider: 1844,
  playerGame: 1845,
  gameType: 1846,
  transactions: 1847,
  payments: 1848,
} as const;

let operationalKpiCache = new Map<string, { expiresAt: number; value: Promise<AnyRecord> }>();

export async function lynonReportById(
  reportId: number,
  range: { startDate?: string; endDate?: string; currency?: string } = {},
): Promise<AnyRecord> {
  const data = recordOf(await lynonRequest(`/api/report/api/v1.0/reportData/summarized/${reportId}`, {
    query: {
      startDate: gunBasi(range.startDate ?? yearAgoYmd()),
      endDate: gunSonu(range.endDate ?? todayYmd()),
      'tz-id': '13',
      currency: range.currency ?? config.lynon.currency,
    },
  }));
  return { HasError: false, Data: data, reportId };
}

/** Consolidates Narcos Backoffice reports with Players Overview (1841) as the primary KPI source. */
export async function lynonOperationalKpi(
  range: { startDate?: string; endDate?: string; currency?: string } = {},
): Promise<AnyRecord> {
  const startDate = range.startDate ?? yearAgoYmd();
  const endDate = range.endDate ?? todayYmd();
  const currency = range.currency ?? config.lynon.currency;
  const key = `${startDate}|${endDate}|${currency}`;
  const existing = operationalKpiCache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;

  const value = Promise.all([
    lynonReportById(NARCOS_REPORT_IDS.playersOverview, { startDate, endDate, currency }),
    lynonReportById(NARCOS_REPORT_IDS.transactions, { startDate, endDate, currency }),
    lynonReportById(NARCOS_REPORT_IDS.provider, { startDate, endDate, currency }),
    lynonReportById(NARCOS_REPORT_IDS.bonus, { startDate, endDate, currency }),
  ]).then(([players, transactions, providers, bonuses]) => {
    const playerSummary = summaryFromReportData(recordOf(players.Data));
    const transactionSummary = summaryFromReportData(recordOf(transactions.Data));
    const providerSummary = summaryFromReportData(recordOf(providers.Data));
    const bonusSummary = summaryFromReportData(recordOf(bonuses.Data));
    return {
      HasError: false,
      Data: {
        source: { primary: NARCOS_REPORT_IDS.playersOverview, supporting: [NARCOS_REPORT_IDS.transactions, NARCOS_REPORT_IDS.provider, NARCOS_REPORT_IDS.bonus] },
        timeZone: 'Europe/Istanbul',
        currency,
        range: { startDate, endDate },
        players: {
          totalBalance: pickAmount(playerSummary, ['TOTAL BALANCE (TRY)', 'TOTAL BALANCE']),
          realBalance: pickAmount(playerSummary, ['REAL BALANCE (TRY)', 'REAL BALANCE']),
          bonusBalance: pickAmount(playerSummary, ['BONUS BALANCE (TRY)', 'BONUS BALANCE']),
          deposits: pickAmount(playerSummary, ['TOTAL DEPOSITS AMOUNT FILTERED (TRY)', 'TOTAL DEPOSITS AMOUNT (TRY)', 'TOTAL DEPOSITS AMOUNT']),
          withdrawals: pickAmount(playerSummary, ['TOTAL WITHDRAWALS AMOUNT FILTERED (TRY)', 'TOTAL WITHDRAWALS AMOUNT (TRY)', 'TOTAL WITHDRAWALS AMOUNT']),
          turnover: pickAmount(playerSummary, ['TOTAL BET AMOUNT FILTERED (TRY)', 'TOTAL BET AMOUNT (TRY)', 'TOTAL BET AMOUNT']),
          winnings: pickAmount(playerSummary, ['TOTAL WIN AMOUNT FILTERED (TRY)', 'TOTAL WIN AMOUNT (TRY)', 'TOTAL WIN AMOUNT']),
          ggr: pickAmount(playerSummary, ['GGR (TRY)', 'GGR']),
        },
        transactions: {
          deposits: pickAmount(transactionSummary, ['Deposit Amount (TRY)', 'Amount (TRY)']),
          withdrawals: pickAmount(transactionSummary, ['Withdrawal Amount (TRY)', 'Amount (TRY)']),
        },
        providers: {
          turnover: pickAmount(providerSummary, ['Bets Amount (TRY)', 'Bets Amount']),
          winnings: pickAmount(providerSummary, ['Won Amount (TRY)', 'Won Amount']),
          ggr: pickAmount(providerSummary, ['GGR (TRY)', 'GGR']),
        },
        bonuses: { amount: pickAmount(bonusSummary, ['Bonus Amount (TRY)', 'Bonus Amount']) },
      },
    };
  }).finally(() => {
    const cached = operationalKpiCache.get(key);
    if (cached && cached.expiresAt <= Date.now()) operationalKpiCache.delete(key);
  });
  operationalKpiCache.set(key, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
  return value;
}
export async function lynonCasinoOperations(params: {
  startDate?: string;
  endDate?: string;
  page?: number;
  countPerPage?: number;
  userId?: string | number;
} = {}): Promise<AnyRecord[]> {
  const page = params.page ?? 1;
  const countPerPage = params.countPerPage ?? 100;
  if (params.userId != null) {
    return arrayOf(await lynonRequest(`/api/operation/api/v1.0/backOffices/players/${params.userId}/site/${config.lynon.siteId}`, {
      query: {
        page,
        countPerPage,
        startCreateDate: params.startDate ?? gunBasi(yearAgoYmd()),
        endCreateDate: params.endDate ?? gunSonu(todayYmd()),
      },
    }));
  }
  return arrayOf(await lynonRequest('/api/operation/api/v1.0/backoffices', {
    query: {
      page,
      countPerPage,
      startCreateDate: params.startDate ?? gunBasi(todayYmd()),
      endCreateDate: params.endDate ?? gunSonu(todayYmd()),
      siteId: config.lynon.siteId,
    },
  }));
}

export async function lynonSportBets(params: {
  page?: number;
  countPerPage?: number;
  userId?: string | number;
  startDate?: string;
  endDate?: string;
} = {}): Promise<AnyRecord[]> {
  const page = params.page ?? 1;
  const countPerPage = params.countPerPage ?? 100;
  if (params.userId != null) {
    return arrayOf(await lynonRequest(`/api/sportOperation/api/v1.0/sportBetEvent/players/${params.userId}/site/${config.lynon.siteId}`, {
      query: {
        page,
        countPerPage,
        startCreateDate: params.startDate,
        endCreateDate: params.endDate,
      },
    }));
  }
  return arrayOf(await lynonRequest('/api/sportOperation/api/v1.0/sportBetEvent', {
    query: { page, countPerPage, SiteIds: config.lynon.siteId },
  }));
}

export async function lynonBetReport(body: AnyRecord = {}): Promise<AnyRecord> {
  const { page, countPerPage } = pageFromBody(body);
  const range = reportDateRangeFromBody(body);
  const sportRows = (await lynonSportBets({
    page,
    countPerPage,
    startDate: gunBasi(range.startDate),
    endDate: gunSonu(range.endDate),
  })).map(mapSportBet);
  return betReportResponse(sportRows);
}

export async function lynonClientBetHistory(body: AnyRecord = {}): Promise<AnyRecord> {
  const clientId = firstNonEmpty(recordOf(body.filterBet).ClientId, body.ClientId, body.clientId, body.userId);
  const start = firstNonEmpty(recordOf(body.filterBet).StartDateLocal, body.StartDateLocal, body.startDate);
  const end = firstNonEmpty(recordOf(body.filterBet).EndDateLocal, body.EndDateLocal, body.endDate);
  const { page, countPerPage } = pageFromBody({
    MaxRows: recordOf(body.filterBet).MaxRows ?? body.MaxRows,
    SkeepRows: recordOf(body.filterBet).SkeepRows ?? body.SkeepRows,
  });
  const fromIso = toIsoDateTime(start);
  const toIso = toIsoDateTime(end, true);
  const rows = (await lynonSportBets({
    page,
    countPerPage,
    userId: clientId || undefined,
    startDate: fromIso ?? undefined,
    endDate: toIso ?? undefined,
  })).map(mapSportBet);
  return betReportResponse(filterMappedRowsByRange(rows, fromIso, toIso));
}

export async function lynonSiteBetHistory(body: AnyRecord = {}): Promise<AnyRecord> {
  return lynonBetReport(body);
}

export async function lynonClientCasinoHistory(body: AnyRecord = {}): Promise<AnyRecord> {
  const clientId = firstNonEmpty(body.ClientId, body.clientId, body.userId);
  const start = firstNonEmpty(body.StartDateLocal, body.startDate);
  const end = firstNonEmpty(body.EndDateLocal, body.endDate);
  const { page, countPerPage } = pageFromBody(body);
  const fromIso = toIsoDateTime(start);
  const toIso = toIsoDateTime(end, true);
  const rows = (await lynonCasinoOperations({
    page,
    countPerPage,
    userId: clientId || undefined,
    startDate: fromIso ?? undefined,
    endDate: toIso ?? undefined,
  })).map(mapCasinoBet);
  return betReportResponse(filterMappedRowsByRange(rows, fromIso, toIso));
}

export async function lynonBetSelections(body: AnyRecord = {}): Promise<AnyRecord> {
  const betId = firstNonEmpty(body.BetId, body.betId);
  const clientId = firstNonEmpty(body.ClientId, body.clientId, body.playerId);
  if (!betId || !clientId) return { HasError: false, Data: [] };

  const rows = await lynonSportBets({ userId: clientId, countPerPage: 500 });
  const rawMatch = rows.find((row) => String(row.operationId ?? row.id ?? '') === String(betId));
  if (!rawMatch) return { HasError: false, Data: [] };

  const bet = mapSportBet(rawMatch);
  const details = arrayOf(rawMatch.details);
  const legs = details.length > 0 ? details : [{}];
  const selections = legs.map((leg, index) => {
    const legRecord = recordOf(leg);
    return {
      BetId: bet.Id,
      SelectionId: Number.isFinite(numberFrom(legRecord.id, NaN)) ? numberFrom(legRecord.id) : index,
      Price: numberFrom(bet.Price),
      State: bet.StateName,
      StateName: bet.StateName,
      StartTimeLocal: legRecord.startDate ?? bet.CreatedLocal ?? null,
      SportName: firstNonEmpty(legRecord.sport, bet.SportName),
      RegionName: legRecord.region ?? null,
      CompetitionName: firstNonEmpty(legRecord.competition, bet.CompetitionName),
      MatchName: firstNonEmpty(legRecord.match, bet.MatchName),
      MarketName: firstNonEmpty(legRecord.marketType, bet.MarketName),
      SelectionName: firstNonEmpty(legRecord.selection, bet.SelectionName),
      DisplayMarketName: firstNonEmpty(legRecord.marketType, bet.MarketName),
      DisplaySelectionName: firstNonEmpty(legRecord.selection, bet.SelectionName),
      MatchInfo: legRecord.region ?? null,
    };
  });

  return { HasError: false, Data: selections };
}

export async function lynonProviderReport(body: AnyRecord = {}): Promise<AnyRecord> {
  const range = reportDateRangeFromBody(body);
  const report = await raporGetir(NARCOS_REPORT_IDS.provider, 'Report By Provider', range);
  const data = recordOf(report.Data);
  return providerReportResponse(rowsFromReportData(data), summaryFromReportData(data));
}

/** Bonus oturumlarinda tek seferde cekilecek satir sayisi. */
const BONUS_OTURUM_SAYFA = 100;
/** En fazla kac sayfa okunur — "tum zamanlar" secildiginde ucu bogmamak icin. */
const BONUS_OTURUM_AZAMI_SAYFA = 50;
/**
 * Bonus oturumu onbellegi.
 *
 * ── Neden gerekti ─────────────────────────────────────────────────────
 *
 * Bu fonksiyon TEK CAGRIDA 50'ye kadar SIRALI HTTP istegi atiyor ve
 * onbellegi yoktu. Cagiranlar:
 *
 *   • hedefBakiyeJob        — 60 saniyede bir
 *   • telegramRaporJob      — 60 saniyede bir (bonus raporu uzerinden)
 *   • lynonClientBonusReport — her rapor acilisinda
 *   • lynonKategoriOnerileri — her kategori ekraninda + saatlik is
 *
 * Yalnizca iki periyodik is, dakikada ~100 istek yani GUNDE ~144.000
 * Lynon istegi demekti. Railway faturasinin buyudugu yer burasi:
 * surekli acik baglanti, surekli CPU, surekli giden trafik.
 *
 * Uc dakikalik onbellek butun cagiranlari tek cekime baglar. Islerin
 * gorecegi gecikme en fazla uc dakika: aday kesfi icin fazlasiyla
 * yeterli, cunku ADAYIN BAKIYESI her turda taze okunuyor.
 */
const BONUS_OTURUM_CACHE_TTL_MS = Number(process.env.BONUS_OTURUM_CACHE_MS) || 3 * 60 * 1000;

/**
 * Site genelindeki tum bonus oturumlari.
 *
 * Uc sayfali; sayfa boyundan kisa bir sayfa gelene ya da tavana
 * varilana kadar okunur. Tavana varilirsa bu bilgi yanitla birlikte
 * tasinir — sessizce kirpilan rapor, yanlis rapordur.
 *
 * Sonuc onbelleklidir; ayni anda gelen cagirilar ayni sozu paylasir
 * (bkz. `cachedLynon`), yani iki is ayni anda uyanirsa uc yine tek kez
 * taranir.
 */
export async function bonusOturumlariniTopla(): Promise<{ oturumlar: AnyRecord[]; kirpildi: boolean }> {
  return cachedLynon(
    `bonus-oturumlari:${config.lynon.siteId}`,
    BONUS_OTURUM_CACHE_TTL_MS,
    async () => {
      const oturumlar: AnyRecord[] = [];
      for (let sayfa = 1; sayfa <= BONUS_OTURUM_AZAMI_SAYFA; sayfa += 1) {
        const parca = arrayOf(
          await lynonRequest(`/api/bonusenginev2/api/v1/Report/bonusSessions/site/${config.lynon.siteId}`, {
            query: { page: sayfa, countPerPage: BONUS_OTURUM_SAYFA },
          }),
        );
        oturumlar.push(...parca);
        if (parca.length < BONUS_OTURUM_SAYFA) return { oturumlar, kirpildi: false };
      }
      return { oturumlar, kirpildi: true };
    },
  );
}

/**
 * Tum bonus raporu.
 *
 * Kaynak `Report By Bonus` (1844) OZET raporundan bonus OTURUMLARINA
 * tasindi. Ozet rapor bonus turune gore toplam donduruyordu; ekranin
 * "Oyuncu" sutunu doldurulamiyordu ve "bu uye kac kez ayni bonusu
 * aldi" sorusu rapordan cevaplanamiyordu.
 *
 * Kullanici adi oyuncu genel bakis raporundan eslenir; esleme yoksa ad
 * bos kalir (bkz. `bonusOturumRaporu`).
 */
export async function lynonClientBonusReport(body: AnyRecord = {}): Promise<AnyRecord> {
  const range = reportDateRangeFromBody(body);
  const [{ oturumlar, kirpildi }, overviewMap] = await Promise.all([
    bonusOturumlariniTopla(),
    lynonPlayerOverviewMap().catch(() => new Map<string, AnyRecord>()),
  ]);

  const adlar: OyuncuAdlari = new Map();
  for (const [kimlik, satir] of overviewMap) {
    if (!kimlik) continue;
    const login = firstNonEmpty(satir['User Name'], satir.Username, satir.username);
    const adSoyad = firstNonEmpty(satir.FullName, satir['Full Name']);
    if (!login && !adSoyad) continue;
    adlar.set(kimlik, { login: login || null, adSoyad: adSoyad || null });
  }

  const kapsam = tarihAraligindakiOturumlar(oturumlar, {
    startDate: range.startDate,
    endDate: range.endDate,
  });
  const objects = kapsam.map((oturum, index) => bonusOturumSatiri(oturum, adlar, index));
  objects.sort((a, b) => String(b.CreatedLocal ?? '').localeCompare(String(a.CreatedLocal ?? '')));

  /**
   * KAPSAM DURUSTLUGU — bildirilen "bonus raporu hatali" hatasinin kaynagi.
   *
   * Uc tarih filtresi kabul etmiyor; butun oturumlar cekilip burada
   * suzuluyor. Sayfa tavanina (50 x 100 = 5.000 kayit) varildiginda
   * elimizdeki EN ESKI oturumdan onceki hicbir sey yok. Kullanici gecmis
   * bir gunu sectiginde rapor bos ya da yarim geliyor, ustelik BOS BIR
   * RAPOR ile "o gun bonus verilmemis" ayirt edilemiyordu.
   *
   * Artik kapsanan en eski gun hesaplanip yanitla tasiniyor; istenen
   * aralik bunun disina tasiyorsa ekran bunu acikca soyluyor.
   */
  const gunler = oturumlar
    .map((oturum) => istanbulDateKey(String(oturum?.assignedDate ?? '')))
    .filter(Boolean)
    .sort();
  const kapsananEnEskiGun = gunler[0] ?? null;
  const veriEksik = Boolean(
    kirpildi && kapsananEnEskiGun && range.startDate && range.startDate < kapsananEnEskiGun,
  );

  return {
    HasError: false,
    AlertType: 'success',
    AlertMessage: '',
    Data: {
      ClientBonusReportData: {
        Count: objects.length,
        Objects: objects,
      },
      /** Bonus adina gore toplamlar — ekrandaki analiz kartlari. */
      BonusOzeti: bonusOzeti(objects),
      /**
       * Ayni oyuncuya ayni bonusun tekrari. "Bu uye nasil bir suru
       * telegram bonusu almis?" sorusu artik raporda gorunur.
       */
      MukerrerVerilisler: mukerrerVerilisler(objects),
      /** Adi eslenemeyen oyuncu sayisi — eksiklik gizlenmiyor. */
      AdsizOyuncu: objects.filter((satir) => !satir.ClientLogin).length,
      Kirpildi: kirpildi,
      /** Ucun donebildigi en eski gun; bundan oncesi bu raporda YOK. */
      KapsananEnEskiGun: kapsananEnEskiGun,
      /** Istenen aralik kapsamin disina tasiyor mu? */
      VeriEksik: veriEksik,
      /** Suzmeden once elde olan toplam oturum sayisi. */
      ToplamOturum: oturumlar.length,
      Range: range,
      Kaynak: `bonusSessions/site/${config.lynon.siteId}`,
    },
  };
}
export async function lynonRegistrationStats(body: AnyRecord = {}): Promise<AnyRecord> {
  const { startDate, endDate } = dateRangeFromDashboardBody(body);
  const playersRes = await lynonPlayers({
    MinCreatedLocal: gunBasi(startDate),
    MaxCreatedLocal: gunSonu(endDate),
    MaxRows: 500,
    SkeepRows: 0,
  });
  const players = arrayOf(recordOf(playersRes.Data).Objects);
  const deposits = await lynonPaymentTransactions({
    FromCreatedDateLocal: gunBasi(startDate),
    ToCreatedDateLocal: gunSonu(endDate),
    MaxRows: 500,
    SkeepRows: 0,
  }, { transactionTypes: 'deposit', status: ['success'] }).catch(() => []);

  const dayMap: Map<string, AnyRecord> = new Map();
  for (const player of players) {
    const day = dateOnly(player.CreatedLocalDate ?? player.registrationDate) ?? startDate;
    const row = dayMap.get(day) ?? { DateLocal: day, RegisteredClientsCount: 0, DepositedClientsCount: 0, DepositsAmount: 0, DepositsCount: 0, ConvertionRate: 0 };
    row.RegisteredClientsCount += 1;
    dayMap.set(day, row);
  }
  const depositedIds = new Set<string>();
  for (const deposit of deposits) {
    const mapped = mapTransaction(deposit);
    const day = dateOnly(mapped.CreatedLocal) ?? startDate;
    const row = dayMap.get(day) ?? { DateLocal: day, RegisteredClientsCount: 0, DepositedClientsCount: 0, DepositsAmount: 0, DepositsCount: 0, ConvertionRate: 0 };
    row.DepositsAmount += numberFrom(mapped.Amount);
    row.DepositsCount += 1;
    const key = String(mapped.ClientId || mapped.ClientLogin || '');
    if (key && !depositedIds.has(key)) {
      row.DepositedClientsCount += 1;
      depositedIds.add(key);
    }
    dayMap.set(day, row);
  }
  const rows: AnyRecord[] = Array.from(dayMap.values())
    .map((row): AnyRecord => ({
      ...row,
      ConvertionRate: row.RegisteredClientsCount > 0 ? (row.DepositedClientsCount / row.RegisteredClientsCount) * 100 : 0,
    }))
    .sort((a, b) => String(a.DateLocal).localeCompare(String(b.DateLocal)));
  return { HasError: false, Data: rows };
}

export async function lynonRegistrationStatsDetails(body: AnyRecord = {}): Promise<AnyRecord> {
  const { startDate, endDate } = dateRangeFromDashboardBody(body);
  const playersRes = await lynonPlayers({
    MinCreatedLocal: gunBasi(startDate),
    MaxCreatedLocal: gunSonu(endDate),
    MaxRows: 500,
    SkeepRows: 0,
  });
  const players = arrayOf(recordOf(playersRes.Data).Objects);
  const deposits = await lynonPaymentTransactions({
    FromCreatedDateLocal: gunBasi(startDate),
    ToCreatedDateLocal: gunSonu(endDate),
    MaxRows: 500,
    SkeepRows: 0,
  }, { transactionTypes: 'deposit', status: ['success'] }).catch(() => []);
  const depositsByUser = new Map<string, AnyRecord>();
  for (const deposit of deposits) {
    const mapped = mapTransaction(deposit);
    const key = String(mapped.ClientId || mapped.ClientLogin || '');
    const current = depositsByUser.get(key) ?? { amount: 0, count: 0, first: null as string | null };
    current.amount += numberFrom(mapped.Amount);
    current.count += 1;
    const created = firstNonEmpty(mapped.CreatedLocal);
    if (created && (!current.first || Date.parse(created) < Date.parse(current.first))) current.first = created;
    depositsByUser.set(key, current);
  }
  const rows = players.map((player) => {
    const key = String(player.Id || player.Login || '');
    const deposit = depositsByUser.get(key) ?? depositsByUser.get(String(player.Login)) ?? { amount: 0, count: 0, first: null };
    return {
      ClientId: numberFrom(player.Id, 0),
      Login: player.Login,
      Name: `${player.FirstName ?? ''} ${player.LastName ?? ''}`.trim(),
      CreatedLocal: player.CreatedLocalDate,
      FirstDepositTimeLocal: deposit.first,
      DepositCount: deposit.count,
      DepositAmount: deposit.amount,
      CurrencyId: player.CurrencyId ?? config.lynon.currency,
      BTag: player.BTag ?? null,
      raw: player,
    };
  });
  return { HasError: false, Data: rows };
}

export async function lynonClientTurnoverPaging(body: AnyRecord = {}): Promise<AnyRecord> {
  const range = reportDateRangeFromBody(body);
  const report = await raporGetir(NARCOS_REPORT_IDS.playersOverview, 'Report By Player', range);
  const rows = rowsFromReportData(recordOf(report.Data)).map((row) => ({
    ...row,
    ClientId: numberFrom(row.player_id ?? row['Player ID'], 0),
    ClientLogin: firstNonEmpty(row.username, row.UserName, row['User Name']),
    BetAmount: pickAmount(row, ['bet_amount_by_currency', 'bet_amount']),
    WinAmount: pickAmount(row, ['won_amount_by_currency', 'won_amount']),
    GGR: pickAmount(row, ['ggr_by_currency', 'ggr']),
    CurrencyId: firstNonEmpty(row.currency, config.lynon.currency),
  }));
  return {
    HasError: false,
    Data: {
      Count: rows.length,
      Objects: rows,
    },
  };
}

export async function lynonClientDetailedReport(body: AnyRecord = {}): Promise<AnyRecord> {
  const clientId = firstNonEmpty(body.ClientId, body.clientId, body.userId);
  if (!clientId) return { HasError: true, AlertMessage: 'ClientId gerekli', Data: [] };

  const range = reportDateRangeFromBody(body);
  const [detailResult, kpiResult, accountsResult, sportResult, casinoResult] = await Promise.allSettled([
    lynonPlayerDetail(clientId),
    lynonPlayerKpi(clientId),
    lynonPlayerAccounts(clientId),
    lynonSportBets({ userId: clientId, startDate: gunBasi(range.startDate), endDate: gunSonu(range.endDate), countPerPage: 500 }),
    lynonCasinoOperations({ userId: clientId, startDate: gunBasi(range.startDate), endDate: gunSonu(range.endDate), countPerPage: 500 }),
  ]);

  const detail = detailResult.status === 'fulfilled' ? recordOf(detailResult.value.Data) : {};
  const kpi = kpiResult.status === 'fulfilled' ? recordOf(kpiResult.value.Data) : {};
  const accounts = accountsResult.status === 'fulfilled' ? arrayOf(accountsResult.value.Data?.Objects) : [];
  const sportRows = sportResult.status === 'fulfilled' ? sportResult.value.map(mapSportBet) : [];
  const casinoRows = casinoResult.status === 'fulfilled' ? casinoResult.value.map(mapCasinoBet) : [];
  const sportStakeFromRows = sportRows.reduce((sum, row) => sum + numberFrom(row.Amount), 0);
  const sportWinFromRows = sportRows.reduce((sum, row) => sum + numberFrom(row.WinningAmount), 0);
  const casinoStakeFromRows = casinoRows.reduce((sum, row) => sum + numberFrom(row.Amount), 0);
  const casinoWinFromRows = casinoRows.reduce((sum, row) => sum + numberFrom(row.WinningAmount), 0);
  const sportStake = sportRows.length > 0 ? sportStakeFromRows : numberFrom(kpi.TotalSportStakes);
  const sportWin = sportRows.length > 0 ? sportWinFromRows : numberFrom(kpi.TotalSportWinnings);
  const casinoStake = casinoRows.length > 0 ? casinoStakeFromRows : numberFrom(kpi.TotalCasinoStakes);
  const casinoWin = casinoRows.length > 0 ? casinoWinFromRows : numberFrom(kpi.TotalCasinoWinnings);
  const sportBonusStake = numberFrom(kpi.TotalSportBonusStakes);
  const sportBonusWin = numberFrom(kpi.TotalSportBonusWinings);
  const casinoBonusStake = numberFrom(kpi.TotalCasinoBonusStakes);
  const casinoBonusWin = numberFrom(kpi.TotalCasinoBonusWinings);
  const sportRealWin = sportWin - sportBonusWin;
  const casinoRealWin = casinoWin - casinoBonusWin;
  const bonusBalance = numberFrom(kpi.BonusBalance);
  const currentBalance = numberFrom(kpi.Balance);

  return {
    HasError: false,
    Data: [{
      ClientId: numberFrom(clientId),
      Login: firstNonEmpty(kpi.Login, detail.Login),
      CurrentBalance: currentBalance,
      TotalBalance: currentBalance + bonusBalance,
      ActiveBonusAmount: bonusBalance,
      ActiveBonusType: bonusBalance > 0 ? 'Bonus Wallet' : null,
      SumBonusBalance: bonusBalance,
      DepositAmount: numberFrom(kpi.DepositAmount),
      DepositCount: numberFrom(kpi.DepositCount),
      WithdrawalAmount: numberFrom(kpi.WithdrawalAmount),
      WithdrawalCount: numberFrom(kpi.WithdrawalCount),
      NetProfit: numberFrom(kpi.DepositAmount) - numberFrom(kpi.WithdrawalAmount),
      NetProfitLessBonus: numberFrom(kpi.DepositAmount) - numberFrom(kpi.WithdrawalAmount) - bonusBalance,
      SportTotalBetAmount: sportStake,
      SportBetCount: sportRows.length,
      SportBonusBetAmount: sportBonusStake,
      SportRealMoneyWonAmount: sportRealWin,
      SportBonusWinAmount: sportBonusWin,
      SportNetProfit: sportWin - sportStake,
      SportNetProfitLessBonus: sportRealWin - (sportStake - sportBonusStake),
      CasinoTotalBetAmount: casinoStake,
      CasinoBetCount: casinoRows.length,
      CasinoBonusBetAmount: casinoBonusStake,
      CasinoRealMoneyWonAmount: casinoRealWin,
      CasinoBonusWinAmount: casinoBonusWin,
      CasinoNetProfit: casinoWin - casinoStake,
      CasinoNetProfitLessBonus: casinoRealWin - (casinoStake - casinoBonusStake),
      RealMoneyWonAmount: sportRealWin + casinoRealWin,
      BonusWonAmount: sportBonusWin + casinoBonusWin,
      ConvertedBonusAmount: numberFrom(kpi.BonusPayout),
      IsVerified: Boolean(kpi.IsVerified ?? detail.IsVerified),
      CurrencyId: firstNonEmpty(kpi.CurrencyId, detail.CurrencyId, config.lynon.currency),
      Accounts: accounts,
    }],
  };
}

export async function lynonClientBonuses(body: AnyRecord = {}): Promise<AnyRecord> {
  const clientId = firstNonEmpty(body.ClientId, body.clientId, body.userId);
  if (!clientId) return { HasError: false, AlertType: 'success', AlertMessage: '', ModelErrors: [], Data: [] };

  // Uygunluk kontrolü hem henüz claim edilmemiş atamaları hem de başlamış/tamamlanmış
  // bonus oturumlarını zorunlu olarak okur. Kaynaklardan biri eksikse çağrı hata verir;
  // eksik bonus geçmişiyle yanlış onay üretilemez.
  const [assignmentsPayload, sessionsPayload] = await Promise.all([
    lynonRequest(`/api/bonusenginev2/api/v1/CampaignAssignment/site/${config.lynon.siteId}/player/${clientId}`),
    lynonRequest(`/api/bonusenginev2/api/v1/Report/bonusSessions/site/${config.lynon.siteId}`, {
      query: { page: 1, countPerPage: 200, playerId: clientId },
    }),
  ]);
  const assignments = arrayOf(assignmentsPayload);
  const sessions = arrayOf(sessionsPayload);
  const assignmentById = new Map(assignments.map((row) => [String(row.id ?? ''), row]));
  const assignmentIdsWithSession = new Set(
    sessions.map((row) => String(row.campaignAssignmentId ?? '')).filter(Boolean)
  );

  const normalizeRow = (assignment: AnyRecord, session: AnyRecord, index: number): AnyRecord => {
    const campaignId = nullableNumber(session.campaignId ?? assignment.campaignId);
    const assignmentId = assignment.id ?? session.campaignAssignmentId ?? null;
    const sessionId = session.bonusSessionId ?? assignment.bonusSessionId ?? null;
    const status = firstNonEmpty(session.status, assignment.bonusSessionStatus, assignment.status);
    return {
      ...assignment,
      ...session,
      Id: campaignId ?? numberFrom(assignmentId ?? sessionId, index + 1),
      AssignmentId: assignmentId,
      BonusSessionId: sessionId,
      ClientId: numberFrom(clientId),
      CampaignId: campaignId,
      PartnerBonusId: campaignId,
      ResultType: status,
      IsActive: /provided|claimed|active|pending/i.test(status) && !/cancelled|completed|expired|rejected/i.test(status),
      Name: firstNonEmpty(session.bonusName, session.templateName, assignment.campaignName, 'Bonus'),
      Amount: numberFrom(session.payout ?? assignment.amount),
      CreatedLocal: session.assignedDate ?? assignment.createdAt ?? null,
      AcceptanceDateLocal: session.claimedDate ?? assignment.claimDate ?? null,
      ClientCurrency: firstNonEmpty(session.claimedCurrency, assignment.currency, config.lynon.currency),
      Note: session.assignmentReason ?? null,
    };
  };

  const rows = sessions.map((session, index) => {
    const assignment = assignmentById.get(String(session.campaignAssignmentId ?? '')) ?? {};
    return normalizeRow(assignment, session, index);
  });
  for (const assignment of assignments) {
    if (assignmentIdsWithSession.has(String(assignment.id ?? ''))) continue;
    rows.push(normalizeRow(assignment, {}, rows.length));
  }
  rows.sort((a, b) => Date.parse(String(b.CreatedLocal ?? '')) - Date.parse(String(a.CreatedLocal ?? '')));

  return {
    HasError: false,
    AlertType: 'success',
    AlertMessage: '',
    ModelErrors: [],
    Data: rows,
    DataCompleteness: { assignments: true, sessions: true },
  };
}
/**
 * Bir çekim talebini onaylar veya reddeder. Lynon ödeme geçidindeki tek işlem çözümleme
 * ucu — 'rejected' değeri doğrulanmıştır (gerçek backoffice isteğinden alınmıştır).
 */
/**
 * Cekim talebini cozumle (onayla / reddet).
 *
 * ── Duzeltilen hata ───────────────────────────────────────────────────
 *
 * Istek govdesi olarak ucun YANIT sekli gonderiliyordu:
 *
 *   { transactionId, status, amount, actualAmount }   ← YANIT
 *
 * Gercek istek govdesi tek alan:
 *
 *   { "action": "approve" }  |  { "action": "reject" }
 *
 * Islem kimligi zaten yolda. Yanit ise `{ transactionId, status,
 * amount, actualAmount, ... }` donuyor; iki sekil birbirine karismis.
 *
 * `status` girdisi cagiranlarin sozlesmesini bozmamak icin korundu ve
 * eyleme cevriliyor.
 */
export async function lynonResolveWithdrawal(input: {
  transactionId: number | string;
  status: 'rejected' | 'approved';
  amount?: number;
  actualAmount?: number;
}): Promise<AnyRecord> {
  const action = input.status === 'approved' ? 'approve' : 'reject';
  const result = await lynonRequest(`/api/payment-gateway/api/v1.0/operation/resolve/${input.transactionId}`, {
    method: 'POST',
    body: { action },
  });
  return { HasError: false, Data: result };
}

// ─── Oyuncu notlari ──────────────────────────────────────────────────────

/**
 * Sitede tanimli not tipleri.
 *
 * Gozlemlenen liste: VIP (168), High Risk (167), Manual (166),
 * Affiliate (165), Call (164), Risk (163). Tip kimlikleri koda
 * GOMULMEZ; not eklerken ad uzerinden bulunur, cunku kimlikler siteye
 * ozel ve degisebilir.
 */
export async function lynonNotTipleri(): Promise<AnyRecord[]> {
  return cachedLynon(
    `not-tipleri:${config.lynon.siteId}`,
    30 * 60 * 1000,
    async () => arrayOf(await lynonRequest(
      `/api/note/api/v1/Types/sites/${config.lynon.siteId}/typeCategories/player`,
    )),
  );
}

/** Oyuncunun profil notlari. */
export async function lynonOyuncuNotlari(playerId: number | string): Promise<AnyRecord[]> {
  return arrayOf(await lynonRequest(
    `/api/note/api/v1/Notes/sites/${config.lynon.siteId}/typeCategories/player`,
    { query: { identifier: playerId } },
  ));
}

/**
 * Oyuncu profiline not ekle.
 *
 * `typeId` verilmezse tip ADINDAN bulunur (varsayilan "Manual"): panel
 * ve bot, siteye ozel kimlikleri bilmek zorunda kalmasin. Ad da
 * bulunamazsa listenin ilki kullanilmaz — HATA verilir, cunku yanlis
 * tiple not yazmak notu yanlis kategoriye gomer.
 */
export async function lynonNotEkle(input: {
  playerId: number | string;
  text: string;
  typeId?: number | null;
  typeName?: string | null;
}): Promise<AnyRecord> {
  const metin = String(input.text ?? '').trim();
  if (!metin) throw new LynonHttpError('Not metni boş olamaz.', 422, {});

  let typeId = Number(input.typeId);
  if (!Number.isFinite(typeId) || typeId <= 0) {
    const aranan = String(input.typeName ?? 'Manual').trim().toLowerCase();
    const tipler = await lynonNotTipleri();
    const bulunan = tipler.find((tip) => String(tip?.name ?? '').trim().toLowerCase() === aranan);
    if (!bulunan) {
      throw new LynonHttpError(
        `Not tipi bulunamadı: "${input.typeName ?? 'Manual'}". Sitede tanımlı tipler: ${tipler.map((t) => t?.name).join(', ')}`,
        422,
        {},
      );
    }
    typeId = Number(bulunan.id);
  }

  const result = await lynonRequest('/api/note/api/v1/Notes/playerManagement', {
    method: 'POST',
    body: { identifier: Number(input.playerId), text: metin, typeId },
  });
  return { HasError: false, Data: result, typeId };
}

export async function lynonClientNotes(body: AnyRecord = {}): Promise<AnyRecord> {
  const clientId = firstNonEmpty(body.ClientId, body.clientId, body.userId);
  if (!clientId) return { HasError: false, AlertType: 'success', AlertMessage: '', ModelErrors: [], Data: [] };
  const rows = arrayOf(await lynonRequest(`/api/platform/api/v1.0/CorrectionHistory/sites/${config.lynon.siteId}`, {
    query: { page: 1, countPerPage: 200, playerId: clientId },
  }));
  return {
    HasError: false,
    AlertType: 'success',
    AlertMessage: '',
    ModelErrors: [],
    Data: rows.map((row, index) => ({
      ...row,
      Id: row.id ?? index + 1,
      CreatedBy: firstNonEmpty(row.userName, 'Lynon Backoffice'),
      CreatedLocal: row.createdAt ?? null,
      TypeName: firstNonEmpty(row.updateBalanceType, 'Bakiye d?zeltmesi'),
      Note: firstNonEmpty(row.note, row.accountName, '??lem notu girilmemi?.'),
    })),
  };
}

export async function lynonClientsByIp(body: AnyRecord = {}): Promise<AnyRecord> {
  const ip = firstNonEmpty(body.LoginIP, body.ip);
  if (!ip) return wrapObjects([]);
  const rows = arrayOf(await lynonRequest('/api/playerDataHub/api/v1.0/playerLogin', {
    query: { ip, siteId: config.lynon.siteId },
  }));
  return wrapObjects(rows.map((row, index) => ({
    ...row,
    Id: row.playerId ?? index + 1,
    ClientId: row.playerId ?? null,
    Login: row.userName ?? null,
    LastLoginIp: ip,
    LastLoginLocalDate: row.lastLoginDate ?? null,
    IsVerified: String(row.kycStatus ?? '').toLowerCase() === 'verified',
  })));
}

// ─── Otomatik oyuncu kategorileme ────────────────────────────────────────

/** Sitenin kategori merdiveni. Esikler aciklama alaninda yaziyor. */
export async function lynonKategoriler(): Promise<AnyRecord[]> {
  return arrayOf(await lynonRequest('/api/user/api/v1.0/categories', {
    query: { page: 1, countPerPage: 100, siteId: config.lynon.siteId },
  }));
}

// ─── Aylik mutabakat ─────────────────────────────────────────────────────

/** Manuel mutabakat kalemlerinin saklandigi belge. */
const MUTABAKAT_NAMESPACE = 'mutabakat-manuel-kalemler';

export async function mutabakatManuelKalemleriOku(tenantKey = 'default'): Promise<ManuelKalem[]> {
  return readStoredDocument<ManuelKalem[]>({
    tenantKey,
    namespace: MUTABAKAT_NAMESPACE,
    fallback: [],
  });
}

export async function mutabakatManuelKalemiEkle(
  kalem: Omit<ManuelKalem, 'id' | 'eklendi'>,
  tenantKey = 'default',
): Promise<ManuelKalem> {
  const tutar = Number(kalem.tutar);
  if (!Number.isFinite(tutar) || tutar <= 0) {
    throw new LynonHttpError('Tutar pozitif olmalı.', 422, {});
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(kalem.gun))) {
    throw new LynonHttpError('Gün YYYY-AA-GG biçiminde olmalı.', 422, {});
  }
  if (kalem.tur !== 'yatirim' && kalem.tur !== 'cekim') {
    throw new LynonHttpError('Tür yatirim veya cekim olmalı.', 422, {});
  }

  const kalemler = await mutabakatManuelKalemleriOku(tenantKey);
  const yontem = String(kalem.yontem ?? '').trim();
  const yeni: ManuelKalem = {
    ...kalem,
    tutar,
    aciklama: String(kalem.aciklama ?? '').trim().slice(0, 300),
    yontem: yontem || null,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eklendi: new Date().toISOString(),
  };
  kalemler.unshift(yeni);
  await writeStoredDocument<ManuelKalem[]>({ tenantKey, namespace: MUTABAKAT_NAMESPACE }, kalemler);
  return yeni;
}

export async function mutabakatManuelKalemiSil(id: string, tenantKey = 'default'): Promise<boolean> {
  const kalemler = await mutabakatManuelKalemleriOku(tenantKey);
  const kalan = kalemler.filter((kalem) => kalem.id !== id);
  if (kalan.length === kalemler.length) return false;
  await writeStoredDocument<ManuelKalem[]>({ tenantKey, namespace: MUTABAKAT_NAMESPACE }, kalan);
  return true;
}

/**
 * Mutabakat hesabinin ortak govdesi.
 *
 * `lynonMutabakat` (ay basindan bugune, gunluk 00:00 raporunun kaynagi)
 * ve `lynonAylikKapanisMutabakati` (kapanmis onceki ayin kesin toplami)
 * AYNI hesabi FARKLI tarih araliklariyla calistirir; kod tekrarini
 * onlemek icin tek yerde toplandi.
 */
async function mutabakatHesapla(
  aralik: { startDate: string; endDate: string },
  ay: string,
  tenantKey: string,
  kapanis: boolean,
): Promise<AnyRecord> {
  const rapor = await raporGetir(NARCOS_REPORT_IDS.integrationPayment, 'Report By Integration Payment', {
    startDate: aralik.startDate,
    endDate: aralik.endDate,
    currency: config.lynon.currency,
  });
  const data = recordOf(rapor.Data);
  const raporSatirlari = mutabakatSatirlari(rowsFromReportData(data));
  const ozet = summaryFromReportData(data);

  const tumKalemler = await mutabakatManuelKalemleriOku(tenantKey);
  const manuel = ayinManuelKalemleri(tumKalemler, ay);
  const toplam = mutabakatToplami(raporSatirlari, ozet, manuel);
  const fark = ozetFarki(raporSatirlari, ozet);
  // Yonteme etiketli manuel kalemler ilgili satira islenir — rapor
  // rakami degismez, yaninda "duzeltilmis" olarak gorunur.
  const satirlar = satirlariManuelIleZenginlestir(raporSatirlari, manuel);

  return {
    HasError: false,
    Data: {
      Ay: ay,
      Aralik: { startDate: aralik.startDate, endDate: aralik.endDate },
      Kapanis: kapanis,
      Satirlar: satirlar,
      Toplam: toplam,
      Fark: fark,
      ManuelKalemler: manuel,
      Mesaj: mutabakatMesaji({ ay, aralik, satirlar, toplam, fark, manuel, kapanis }),
      Kaynak: `reportData/summarized/${NARCOS_REPORT_IDS.integrationPayment}`,
    },
  };
}

/**
 * Aylik mutabakat — AYIN BASINDAN BUGUNE (devam eden ay).
 *
 * Kaynak rapor 1842 — odeme yontemi kirilimi. Rapor YALNIZCA odeme
 * saglayicilarindan gecen parayi goruyor; elden yapilan yatirimlar ve
 * dengeleme kalemleri elle eklenir ve toplamda AYRI gosterilir.
 */
export async function lynonMutabakat(body: AnyRecord = {}): Promise<AnyRecord> {
  const bugun = String(body.bugun ?? todayYmd());
  const tenantKey = String(body.tenantKey ?? 'default');
  const aralik = ayAraligi(bugun);
  return mutabakatHesapla(aralik, aralik.ay, tenantKey, false);
}

/**
 * Ay kapanis mutabakati — belirtilen (varsayilan: bir onceki) ayin
 * TAM ve KESIN toplami. Gunluk 00:00 raporu "ay icinde ne kadar
 * biriktik" sorusunu cevaplar; bu, "gecen ay kapanista tam olarak
 * ne oldu" sorusunu cevaplar — muhasebe icin ayrı, kesin bir kayit.
 */
export async function lynonAylikKapanisMutabakati(body: AnyRecord = {}): Promise<AnyRecord> {
  const tenantKey = String(body.tenantKey ?? 'default');
  const ay = String(body.ay ?? oncekiAyAnahtari(todayYmd()));
  const aralik = ayinTamAraligi(ay);
  return mutabakatHesapla(aralik, ay, tenantKey, true);
}

/**
 * Yontem bazinda GUNLUK kasa durumu — mutabakat DEGIL, ANLIK.
 *
 * Ayni rapor (1842) kullanilir ama araligi TEK GUN: "su an hangi
 * yontemden ne kadar para girdi/cikti" sorusunu cevaplar. Kasa ozetiyle
 * (dashboard toplami) ayni ritimde periyodik olarak Telegram'a atilir.
 */
export async function lynonYontemBazindaKasa(body: AnyRecord = {}): Promise<AnyRecord> {
  const gun = String(body.gun ?? todayYmd());
  const rapor = await raporGetir(NARCOS_REPORT_IDS.integrationPayment, 'Report By Integration Payment', {
    startDate: gun,
    endDate: gun,
    currency: config.lynon.currency,
  });
  const data = recordOf(rapor.Data);
  const satirlar = mutabakatSatirlari(rowsFromReportData(data));

  return {
    HasError: false,
    Data: {
      Gun: gun,
      Satirlar: satirlar,
      Mesaj: yontemKasaMesaji(gun, satirlar),
      Kaynak: `reportData/summarized/${NARCOS_REPORT_IDS.integrationPayment}`,
    },
  };
}

/**
 * Anlik oyuncu bakiye ozeti — rapor 1843 ("Player Balance").
 *
 * Varsayilan aralik BUGUNUN BASINDAN SU ANA — kullanicinin kendi
 * yakaladigi istek de ayni pencereyi kullaniyordu. Yalnizca TOPLAM
 * (`reportsSummary`) dondurulur; 1000+ oyuncu satirini tasimak bu
 * cagri icin gereksiz ve periyodik (7.5 dakikada bir) calistigi icin
 * maliyetli olurdu.
 */
export async function lynonAnlikOyuncuBakiyesi(body: AnyRecord = {}): Promise<AnyRecord> {
  const now = new Date();
  const gun = String(body.gun ?? todayYmd());
  const startDate = String(body.startDate ?? gunBasi(gun));
  const endDate = String(body.endDate ?? now.toISOString());

  const rapor = await raporGetir(NARCOS_REPORT_IDS.playerBalance, 'Report By Player Balance', {
    startDate, endDate, currency: config.lynon.currency,
  });
  const data = recordOf(rapor.Data);
  const saat = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit',
  }).format(now);
  const ozet = oyuncuBakiyeOzetiCikar(data, gun, saat);

  return {
    HasError: false,
    Data: {
      Ozet: ozet,
      Mesaj: oyuncuBakiyeMesaji(ozet),
      Kaynak: `reportData/summarized/${NARCOS_REPORT_IDS.playerBalance}`,
    },
  };
}

/** Manuel duzeltmelerde tek sayfadaki satir sayisi. */
const DUZELTME_SAYFA = 100;
/** En fazla kac sayfa okunur. */
const DUZELTME_AZAMI_SAYFA = 30;
/** Onbellek omru; iki dakika hem bot hem ekran icin yeterli. */
const DUZELTME_CACHE_TTL_MS = Number(process.env.DUZELTME_CACHE_MS) || 2 * 60 * 1000;

/**
 * Site genelindeki manuel bakiye duzeltmeleri.
 *
 *   GET /api/platform/api/v1.0/CorrectionHistory/sites/{siteId}
 *
 * Bu uc, `lynonCorrectionHistory`in kullandigi finansal hareket ucunde
 * OLMAYAN bir alan tasiyor: `userName` — duzeltmeyi yapan yonetici.
 * Panelin kendi denetim kaydi yalnizca PANELDEN yapilanlari goruyor;
 * Lynon arayuzunden elle yapilan bakiye eklemeleri oraya hic dusmuyor.
 *
 * Onbellekli: hem rapor ekrani hem Telegram botu ayni cekimi paylasir.
 */
export async function manuelDuzeltmeleriTopla(): Promise<{ kayitlar: AnyRecord[]; kirpildi: boolean }> {
  return cachedLynon(
    `manuel-duzeltmeler:${config.lynon.siteId}`,
    DUZELTME_CACHE_TTL_MS,
    async () => {
      const kayitlar: AnyRecord[] = [];
      for (let sayfa = 1; sayfa <= DUZELTME_AZAMI_SAYFA; sayfa += 1) {
        const parca = arrayOf(
          await lynonRequest(`/api/platform/api/v1.0/CorrectionHistory/sites/${config.lynon.siteId}`, {
            query: { page: sayfa, countPerPage: DUZELTME_SAYFA },
          }),
        );
        kayitlar.push(...parca);
        if (parca.length < DUZELTME_SAYFA) return { kayitlar, kirpildi: false };
      }
      return { kayitlar, kirpildi: true };
    },
  );
}

/**
 * Manuel duzeltmeler raporu.
 *
 * Uc tarih filtresi kabul etmedigi icin suzme sunucuda yapiliyor; sayfa
 * tavanina varilirsa kapsanan en eski gun yanitla tasiniyor. Bos rapor
 * ile "o gunun verisi elimizde yok" ayirt edilebilmeli.
 */
export async function lynonManuelDuzeltmeler(body: AnyRecord = {}): Promise<AnyRecord> {
  const range = reportDateRangeFromBody(body);
  const [{ kayitlar, kirpildi }, overviewMap] = await Promise.all([
    manuelDuzeltmeleriTopla(),
    lynonPlayerOverviewMap().catch(() => new Map<string, AnyRecord>()),
  ]);

  const adlar: DuzeltmeAdlari = new Map();
  for (const [kimlik, satir] of overviewMap) {
    if (!kimlik) continue;
    const login = firstNonEmpty(satir['User Name'], satir.Username, satir.username);
    const adSoyad = firstNonEmpty(satir.FullName, satir['Full Name']);
    if (!login && !adSoyad) continue;
    adlar.set(kimlik, { login: login || null, adSoyad: adSoyad || null });
  }

  const kapsam = tarihAraligindakiDuzeltmeler(kayitlar as HamDuzeltme[], {
    startDate: range.startDate,
    endDate: range.endDate,
  });
  const satirlar = tarihineGoreSirala(kapsam.map((kayit) => duzeltmeSatiri(kayit, adlar)));

  const gunler = kayitlar
    .map((kayit) => istanbulDateKey(String(kayit?.createdAt ?? '')))
    .filter(Boolean)
    .sort();
  const kapsananEnEskiGun = gunler[0] ?? null;

  return {
    HasError: false,
    Data: {
      Satirlar: satirlar,
      Toplam: duzeltmeToplami(satirlar),
      YapanOzeti: yapanBazindaOzet(satirlar),
      HesapOzeti: hesapBazindaOzet(satirlar),
      Kirpildi: kirpildi,
      KapsananEnEskiGun: kapsananEnEskiGun,
      VeriEksik: Boolean(
        kirpildi && kapsananEnEskiGun && range.startDate && range.startDate < kapsananEnEskiGun,
      ),
      Range: range,
      Kaynak: `CorrectionHistory/sites/${config.lynon.siteId}`,
    },
  };
}

/**
 * Davranis kategorilerini olustur.
 *
 * Uc dogrulandi:
 *   POST /api/user/api/v1.0/categories
 *   { name, description, siteId, color, textColor, isVisibleToPlayer }
 *
 * IDEMPOTENT: sitede ayni adla kategori varsa yeniden olusturulmaz.
 * Bu kontrol olmadan "kategorileri oluştur" dugmesine ikinci kez
 * basmak kopya uretirdi ve oyuncular iki farkli "High Risk" arasinda
 * bolunurdu.
 */
export async function lynonDavranisKategorileriniOlustur(): Promise<AnyRecord> {
  const mevcut = await lynonKategoriler();
  const eksik = eksikKategoriler(mevcut as Array<{ name?: unknown }>);

  const olusturulan: AnyRecord[] = [];
  const hatalar: AnyRecord[] = [];

  for (const tanim of eksik) {
    const govde = kategoriOlusturmaGovdesi(tanim, config.lynon.siteId);
    try {
      const yanit = await lynonRequest('/api/user/api/v1.0/categories', { method: 'POST', body: govde });
      olusturulan.push({ ad: tanim.name, kimlik: tanim.kimlik, yanit });
    } catch (err) {
      hatalar.push({ ad: tanim.name, mesaj: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    HasError: hatalar.length > 0 && olusturulan.length === 0,
    Data: {
      Olusturulan: olusturulan,
      /** Zaten var olanlar — hata degil, yapilacak is yok demek. */
      ZatenVar: DAVRANIS_KATEGORILERI.filter((t) => !eksik.includes(t)).map((t) => t.name),
      Hatalar: hatalar,
    },
  };
}

/**
 * Risk ve aktiviteye gore kategori onerileri.
 *
 * Iki asamali:
 *
 *   1. UCUZ TARAMA — tum oyuncular icin yatirim bandina gore aday
 *      degisiklikleri bulunur. Bu asamada coklu hesap OLCULMEZ; her
 *      oyuncu icin IP sorgusu atmak yuzlerce istek demek olurdu.
 *   2. ZENGINLESTIRME — yalnizca kategorisi degisecek oyuncular icin
 *      IP sorgusu yapilir ve risk yeniden hesaplanir.
 *
 * Tek asamali yapsaydik ya cok yavas olurdu ya da risk hic olculemez,
 * kritik riskli oyuncular sessizce terfi ederdi.
 */
export async function lynonKategoriOnerileri(body: AnyRecord = {}): Promise<AnyRecord> {
  const enFazlaOyuncu = Math.min(1000, numberFrom(body.MaxRows ?? body.limit, 500));
  const zenginlestirmeTavani = Math.min(60, numberFrom(body.enrichLimit, 40));

  const [kategoriler, playersRes, bonusVerisi] = await Promise.all([
    lynonKategoriler(),
    lynonPlayers({ MaxRows: enFazlaOyuncu, SkeepRows: 0 }),
    // Bonus avciligini olcmek icin site geneli bonus oturumlari.
    // Basarisiz olursa bonus adedi "bilinmiyor" kalir ve o kural hic
    // calismaz — sifir sayilmaz.
    bonusOturumlariniTopla().catch(() => ({ oturumlar: [] as AnyRecord[], kirpildi: false })),
  ]);

  const merdiven = seviyeMerdiveni(kategoriler as LynonKategori[]);
  const oyuncular = arrayOf(recordOf(playersRes.Data).Objects);
  const otomatik = otomatikDavranislar();

  /** playerId → aldigi bonus adedi. */
  const bonusAdetleri = new Map<string, number>();
  for (const oturum of bonusVerisi.oturumlar) {
    const kimlik = String(oturum?.playerId ?? '');
    if (!kimlik) continue;
    bonusAdetleri.set(kimlik, (bonusAdetleri.get(kimlik) ?? 0) + 1);
  }
  // Bonus verisi hic gelmediyse HERKESIN adedi "bilinmiyor" olmali;
  // bos harita "herkes sifir bonus almis" anlamina gelirdi.
  const bonusOlculdu = bonusVerisi.oturumlar.length > 0;

  const profiller: OyuncuProfili[] = oyuncular.map((oyuncu) => ({
    playerId: numberFrom(oyuncu.Id, 0),
    login: String(oyuncu.Login ?? ''),
    toplamYatirim: nullableNumber(oyuncu.TotalDeposit),
    netKarZarar: nullableNumber(oyuncu.ProfitAndLose),
    sonYatirim: (oyuncu.LastDepositDate as string | null) ?? null,
    // Ucuz taramada olculmez; asama 2'de doldurulur.
    ayniIpHesapSayisi: null,
    mevcutKategoriId: nullableNumber(oyuncu.CategoryId),
    bonusAdedi: bonusOlculdu ? bonusAdetleri.get(String(numberFrom(oyuncu.Id, 0))) ?? 0 : null,
  }));

  const adaylar = kategoriOnerileri(profiller, merdiven, Date.now(), otomatik);
  const zenginlestirilecek = adaylar.slice(0, zenginlestirmeTavani);

  const ipSayisi = new Map<number, number>();
  await Promise.all(
    zenginlestirilecek.map(async (oneri) => {
      const oyuncu = oyuncular.find((o) => numberFrom(o.Id, -1) === oneri.playerId);
      const ip = firstNonEmpty(oyuncu?.LastLoginIp);
      if (!ip) return;
      try {
        const yanit = await lynonClientsByIp({ LoginIP: ip });
        ipSayisi.set(oneri.playerId, arrayOf(recordOf(yanit.Data).Objects).length);
      } catch {
        // IP okunamadi: sayi bilinmiyor kalir, risk uydurulmaz.
      }
    }),
  );

  const zenginProfiller = profiller
    .filter((profil) => ipSayisi.has(profil.playerId))
    .map((profil) => ({ ...profil, ayniIpHesapSayisi: ipSayisi.get(profil.playerId) ?? null }));
  const yenidenHesaplanan = new Map(
    kategoriOnerileri(zenginProfiller, merdiven, Date.now(), otomatik).map((oneri) => [oneri.playerId, oneri]),
  );

  const oneriler = adaylar.map((oneri) => yenidenHesaplanan.get(oneri.playerId) ?? oneri);

  return {
    HasError: false,
    Data: {
      Oneriler: oneriler,
      /** Otomatik uygulanabilir olanlar: bekletme sebebi olmayanlar. */
      Uygulanabilir: oneriler.filter((oneri) => !oneri.bekletme).length,
      Merdiven: merdiven,
      /** Esigi cozulemeyen kategoriler — bant olarak kullanilamaz. */
      EsiksizKategoriler: merdiven.filter((seviye) => !seviye.esik).map((seviye) => seviye.ad),
      /**
       * Hicbir bandin kapsamadigi tutar araliklari.
       *
       * Sitede gercek bir bosluk var: bantlar 10.000 TL'den basliyor,
       * 0 – 9.999 arasi acikta. Varsayilan kategori bunu kapatiyor ama
       * boslugun kendisi gorunur olmali — bilerek mi birakildi?
       */
      Bosluklar: merdivenBosluklari(merdiven),
      VarsayilanKategori: varsayilanSeviye(merdiven),
      TarananOyuncu: profiller.length,
      RiskOlculen: ipSayisi.size,
      /** Bonus adedi olculemediyse "Bonus Avcısı" kurali hic calismaz. */
      BonusOlculdu: bonusOlculdu,
      /** Henuz sitede olmayan davranis kategorileri — olusturulmasi gerekiyor. */
      EksikDavranisKategorileri: eksikKategoriler(kategoriler as Array<{ name?: unknown }>).map((t) => t.name),
      /** Otomatik atanan davranis etiketleri; gerisi yalnizca elle. */
      OtomatikDavranislar: [...otomatik],
      DavranisTanimlari: DAVRANIS_KATEGORILERI.map((t) => ({
        kimlik: t.kimlik,
        ad: t.name,
        aciklama: t.description,
        renk: t.color,
        otomatik: otomatik.has(t.kimlik),
      })),
    },
  };
}

/**
 * Oyuncunun kategorisini yaz.
 *
 * Yazma sozlesmesi belgelenmemis; `kategoriGovdeleri` uc aday sekil
 * uretiyor ve ilki 4xx alirsa digeri deneniyor. Hepsi basarisiz olursa
 * hata yukselir — sessizce "uygulandi" denmez.
 */
export async function lynonKategoriUygula(playerId: number, kategoriId: number): Promise<AnyRecord> {
  const yollar = [
    `/api/user/api/v1.0/userBackOffice/users/${playerId}/category`,
    `/api/user/api/v1.0/userBackOffice/users/${playerId}`,
  ];
  let sonHata: unknown = null;

  for (const yol of yollar) {
    for (const govde of kategoriGovdeleri(playerId, kategoriId)) {
      try {
        const yanit = await lynonRequest(yol, { method: 'PUT', body: govde });
        return { HasError: false, Data: { playerId, kategoriId, yol, govde, yanit } };
      } catch (err) {
        sonHata = err;
        const durum = (err as { status?: number })?.status ?? 0;
        if (durum < 400 || durum >= 500) throw err;
      }
    }
  }
  throw sonHata ?? new LynonHttpError('Kategori güncellenemedi.', 500, { playerId, kategoriId });
}

export async function lynonPlayerActivity(login: string, from: Date, to: Date): Promise<AnyRecord> {
  const player = await lynonFindPlayerByLogin(login);
  if (!player) return { ok: false, status: 404, message: 'Kullanici bulunamadi.' };

  const userId = player.Id;
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const [deposits, casinoRows, sportRows] = await Promise.all([
    lynonPaymentTransactions({
      ClientId: userId,
      FromCreatedDateLocal: fromIso,
      ToCreatedDateLocal: toIso,
      MaxRows: 200,
      SkeepRows: 0,
    }, { transactionTypes: 'deposit' }).catch(() => []),
    lynonCasinoOperations({ startDate: fromIso, endDate: toIso, userId, countPerPage: 500 }).catch(() => []),
    lynonSportBets({ startDate: fromIso, endDate: toIso, userId, countPerPage: 500 }).catch(() => []),
  ]);

  const depositRows = deposits.filter((row) =>
    String(row.userId ?? '').toLowerCase() === String(userId).toLowerCase() ||
    String(recordOf(row.personalData).userName ?? '').toLowerCase() === login.toLowerCase()
  );
  const casinoWager = casinoRows
    .filter((row) => String(row.type ?? '').toLowerCase() === 'bet')
    .reduce((sum, row) => sum + Math.abs(numberFrom(row.amount)), 0);
  const sportWager = sportRows.reduce((sum, row) => sum + Math.abs(numberFrom(row.amount)), 0);

  return {
    ok: true,
    clientId: userId,
    login,
    from: fromIso,
    to: toIso,
    depositTotal: depositRows.reduce((sum, row) => sum + numberFrom(row.amount), 0),
    depositCount: depositRows.length,
    wagerTotal: casinoWager + sportWager,
    bonusCount: 0,
  };
}

/** Detay ucunun yetkili olduğu, listede hiç dönmeyen doğrulama bayrakları. */
const DOGRULAMA_BAYRAKLARI = ['IsPhoneVerified', 'IsEmailVerified', 'IsIdentityVerified', 'IsVerified'] as const;
/** Detayda dolu ise bindirilen, boşsa liste değeri korunan alanlar. */
const DETAY_NULLABLE_ALANLAR = ['VerificationStatus', 'LastLoginIp', 'LastLoginLocalDate'] as const;

/**
 * Liste satırının üzerine detay satırının doğrulama/son giriş alanlarını bindirir.
 *
 * Doğrulama bayrakları detaydan aynen alınır (detay yetkilidir); nullable alanlar
 * yalnızca detayda dolu ise yazılır, böylece detay boş dönerse listedeki bilgi silinmez.
 */
export function dogrulamaAlanlariniBirlestir(listRow: AnyRecord, detailMapped: AnyRecord): AnyRecord {
  const merged: AnyRecord = { ...listRow };
  for (const alan of DOGRULAMA_BAYRAKLARI) merged[alan] = detailMapped[alan];
  for (const alan of DETAY_NULLABLE_ALANLAR) {
    if (detailMapped[alan] != null) merged[alan] = detailMapped[alan];
  }
  return merged;
}

/**
 * Liste satırına, yalnızca detay ucunda dönen doğrulama/son giriş alanlarını ekler.
 * Detay isteği düşerse liste satırı olduğu gibi korunur (uygunluk fail-closed kalır).
 */
async function mergeVerificationDetail(listRow: AnyRecord): Promise<AnyRecord> {
  try {
    const detail = recordOf(await lynonRequest(`/api/user/api/v1.0/userBackOffice/users/${listRow.Id}`));
    const detailSiteId = numberFrom(detail.siteId ?? detail.SiteId, NaN);
    // Farklı sitenin kaydı asla tenant sınırını geçmemeli; şüphedeyse liste satırında kal.
    if (!Number.isFinite(detailSiteId) || detailSiteId !== Number(config.lynon.siteId)) return listRow;
    return dogrulamaAlanlariniBirlestir(listRow, mapPlayer(detail));
  } catch {
    return listRow;
  }
}

/**
 * Bonus talebi için Lynon'dan tek, doğrulanmış ve fail-closed hesap görünümü üretir.
 * Başarısız yatırım denemeleri uygunlukta yatırım sayılmaz; bekleyen çekimler ayrıca işaretlenir.
 */
export async function lynonBuildBonusEligibilitySnapshot(input: { login?: string; playerId?: number | string }): Promise<AnyRecord> {
  let player: AnyRecord | null = null;
  if (input.login) player = await lynonFindPlayerByLogin(input.login);
  if (!player && input.playerId != null) {
    const detail = recordOf(await lynonRequest(`/api/user/api/v1.0/userBackOffice/users/${input.playerId}`));
    const detailSiteId = numberFrom(detail.siteId ?? detail.SiteId, NaN);
    if (!Number.isFinite(detailSiteId) || detailSiteId !== Number(config.lynon.siteId)) {
      throw new LynonHttpError('Oyuncu aktif Lynon sitesinde bulunamadı.', 404, { playerId: input.playerId });
    }
    player = mapPlayer(detail);
  } else if (player?.Id != null) {
    // Oyuncu listesi ucu (`/userBackOffice`) doğrulama ve son giriş IP alanlarını
    // döndürmez; bunlar yalnızca detay ucunda (`/userBackOffice/users/{id}`) var.
    // Liste satırıyla yetinilirse telefonu onaylı üyede bile
    // "RED: Telefon numarası onaylı değil" çıkar. Detayı çekip üzerine bindiriyoruz.
    player = await mergeVerificationDetail(player);
  }
  if (!player?.Id) throw new LynonHttpError('Oyuncu aktif Lynon sitesinde bulunamadı.', 404, {});

  const playerSiteId = numberFrom(player.siteId ?? player.SiteId, NaN);
  if (!Number.isFinite(playerSiteId) || playerSiteId !== Number(config.lynon.siteId)) {
    throw new LynonHttpError('Oyuncu aktif Lynon sitesinde bulunamadı.', 404, { playerId: player.Id });
  }

  const playerId = player.Id;
  const now = new Date();
  const from = new Date(Date.UTC(Math.max(2020, now.getUTCFullYear() - 6), 0, 1));
  const loginIP: string | null = player.LastLoginIp ?? null;
  const [kpiResponse, payments, correctionsResponse, bonusesResponse, casinoRows, sportRows, sameIPPlayers] = await Promise.all([
    lynonPlayerKpi(playerId),
    lynonPaymentTransactions({
      ClientId: playerId,
      FromCreatedDateLocal: from.toISOString(),
      ToCreatedDateLocal: now.toISOString(),
      MaxRows: 500,
      SkeepRows: 0,
    }),
    lynonCorrectionHistory({
      ClientId: playerId,
      FromCreatedDateLocal: from.toISOString(),
      ToCreatedDateLocal: now.toISOString(),
      MaxRows: 500,
      SkeepRows: 0,
    }),
    lynonClientBonuses({ ClientId: playerId }),
    lynonCasinoOperations({ userId: playerId, countPerPage: 500 }),
    lynonSportBets({ userId: playerId, countPerPage: 500 }),
    loginIP ? lynonClientsByIp({ LoginIP: loginIP }).catch(() => wrapObjects([])) : Promise.resolve(wrapObjects([])),
  ]);
  const kpi = recordOf(kpiResponse.Data);
  const playerPayments = payments
    .filter((row) => String(row.userId ?? '') === String(playerId))
    .sort((a, b) => Date.parse(String(b.createdAt ?? '')) - Date.parse(String(a.createdAt ?? '')));
  const successfulDeposits = playerPayments.filter((row) =>
    String(row.transactionType ?? '').toLowerCase() === 'deposit' &&
    String(row.status ?? '').toLowerCase() === 'success'
  );
  // Bugunun (Europe/Istanbul) basarili yatirimlari, ESKIDEN YENIYE.
  //
  // "4. Yatirimin Bizden Hediye" ardisik yatirim sayar, "%400 Carsamba Happy
  // Days" gunun kacinci yatirimi oldugunu sorar; ikisi de sirali listeye
  // ihtiyac duyar. playerPayments YENIDEN ESKIYE sirali oldugu icin ters
  // ceviriyoruz — sira yanlis olursa kademe de yanlis hesaplanir.
  const bugunDateKey = istanbulDateKey(now);
  const sameDayDepositRows = successfulDeposits
    .filter((row) => istanbulDateKey(String(row.createdAt ?? '')) === bugunDateKey)
    .slice()
    .reverse();

  const previousDayDateKey = previousIstanbulDateKey(now);
  const previousDayDeposits = successfulDeposits.filter((row) => istanbulDateKey(String(row.createdAt ?? '')) === previousDayDateKey);
  const previousDayDepositTotal = previousDayDeposits.reduce((sum, row) => sum + numberFrom(row.amount), 0);
  const previousDayLastDeposit = previousDayDeposits[0];
  const withdrawals = playerPayments.filter((row) => String(row.transactionType ?? '').toLowerCase() === 'withdrawal');
  const pendingStatuses = new Set(['new', 'created', 'pending', 'pendingproviderapproval']);
  const pendingWithdrawals = withdrawals.filter((row) => pendingStatuses.has(String(row.status ?? '').toLowerCase()));
  const effectivePayments = playerPayments.filter((row) => {
    const type = String(row.transactionType ?? '').toLowerCase();
    const status = String(row.status ?? '').toLowerCase();
    if (type === 'deposit') return status === 'success';
    if (type === 'withdrawal') return status !== 'failed';
    return false;
  });
  const paymentTransactions: AnyRecord[] = effectivePayments.map((row) => {
    const type = String(row.transactionType ?? '').toLowerCase();
    const status = String(row.status ?? '').toLowerCase();
    const name = type === 'deposit'
      ? 'Deposit'
      : pendingStatuses.has(status)
        ? 'Withdrawal Request'
        : status === 'success'
          ? 'Withdrawal Payment'
          : 'Withdrawal Rejected';
    return {
      ...mapTransaction(row),
      DocumentTypeName: name,
      PaymentStatus: status,
    };
  });
  const financialMovements = arrayOf(correctionsResponse.Data?.Objects)
    .filter((row) => String(row.playerId ?? '') === String(playerId));
  const profileTransactions: AnyRecord[] = [...paymentTransactions, ...financialMovements]
    .sort((a, b) => Date.parse(String(b.CreatedLocal ?? '')) - Date.parse(String(a.CreatedLocal ?? '')));
  const profileTransactionsByType: Record<string, { count: number; totalAmount: number }> = {};
  for (const transaction of profileTransactions) {
    const name = String(transaction.DocumentTypeName || 'Other');
    const current = profileTransactionsByType[name] ?? { count: 0, totalAmount: 0 };
    current.count += 1;
    current.totalAmount += numberFrom(transaction.Amount);
    profileTransactionsByType[name] = current;
  }

  const lastDepositRow = successfulDeposits[0];
  const lastDepositTime = lastDepositRow ? Date.parse(String(lastDepositRow.createdAt ?? '')) : 0;
  const casinoBets = casinoRows.filter((row) => {
    const created = Date.parse(String(row.createdAt ?? row.createDate ?? row.date ?? ''));
    return String(row.type ?? '').toLowerCase() === 'bet' && (!lastDepositTime || created >= lastDepositTime);
  });
  const sportBetsAfterDeposit = sportRows.filter((row) => {
    const created = Date.parse(String(row.createdAt ?? row.createDate ?? row.date ?? ''));
    return !lastDepositTime || created >= lastDepositTime;
  });
  const casinoBetAmountSinceLastDeposit = casinoBets.reduce((sum, row) => sum + Math.abs(numberFrom(row.amount)), 0);
  const sportBetAmountSinceLastDeposit = sportBetsAfterDeposit.reduce((sum, row) => sum + Math.abs(numberFrom(row.amount ?? row.stake ?? row.betAmount)), 0);
  const totalBetAmountSinceLastDeposit = casinoBetAmountSinceLastDeposit + sportBetAmountSinceLastDeposit;
  const sportOddsSinceLastDeposit = sportBetsAfterDeposit
    .map((row) => numberFrom(row.price ?? row.odds, 0))
    .filter((odds) => odds > 0);
  const bonusRows = Array.isArray(bonusesResponse.Data) ? bonusesResponse.Data : [];
  const bonuses = bonusRows.map((bonus: AnyRecord) => ({
    ...bonus,
    Id: numberFrom(bonus.campaignId ?? bonus.PartnerBonusId),
    AssignmentId: bonus.Id,
    Name: firstNonEmpty(bonus.Name, bonus.campaignName, 'Bonus'),
    CreatedLocal: bonus.CreatedLocal ?? bonus.createdAt ?? null,
    ToWagerAmount: numberFrom(bonus.remainingWageringAmount ?? bonus.toWagerAmount),
  }));
  const openStatusPattern = /open|active|pending|unsettled|created/i;
  const openBetCount = [...casinoRows, ...sportRows].filter((row) =>
    openStatusPattern.test(String(row.status ?? row.state ?? row.resultStatus ?? ''))
  ).length;
  const registrationMs = Date.parse(String(player.CreatedLocalDate ?? player.registrationDate ?? ''));
  const sameIPOtherLogins = new Set(
    arrayOf(sameIPPlayers.Data?.Objects)
      .map((row) => String(row.Login ?? '').trim().toLocaleLowerCase('tr-TR'))
      .filter((rowLogin) => rowLogin && rowLogin !== String(player.Login ?? '').trim().toLocaleLowerCase('tr-TR'))
  );

  return {
    id: playerId,
    ClientId: playerId,
    username: player.Login,
    ClientLogin: player.Login,
    isPhoneVerified: Boolean(player.IsPhoneVerified),
    isEmailVerified: Boolean(player.IsEmailVerified),
    isIdentityVerified: Boolean(player.IsIdentityVerified),
    verificationStatus: player.VerificationStatus ?? null,
    loginIP,
    sameIPClientsCount: sameIPOtherLogins.size,
    registrationDate: player.CreatedLocalDate ?? player.registrationDate ?? null,
    accountAgeDays: Number.isFinite(registrationMs) ? Math.max(0, Math.floor((Date.now() - registrationMs) / 86_400_000)) : undefined,
    totalDeposits: numberFrom(kpi.DepositAmount, successfulDeposits.reduce((sum, row) => sum + numberFrom(row.amount), 0)),
    totalWithdrawals: numberFrom(kpi.WithdrawalAmount, withdrawals.filter((row) => String(row.status).toLowerCase() === 'success').reduce((sum, row) => sum + numberFrom(row.amount), 0)),
    balance: numberFrom(kpi.Balance ?? player.Balance),
    currency: firstNonEmpty(kpi.CurrencyId, player.CurrencyId, config.lynon.currency),
    /**
     * Son yatirim — KIMLIGIYLE birlikte.
     *
     * Oyun haklari (cark, kazi kazan) artik yatirim kimligine baglaniyor:
     * bir yatirim bir hak. Kimlik olmadan "bu yatirimla oynandi mi"
     * sorusu cevaplanamiyordu; cark yalnizca gunluk limitle sinirliydi ve
     * oyuncu tek yatirimla her gun yeniden ceviriyordu.
     */
    lastDeposit: lastDepositRow
      ? {
          id: lastDepositRow.id ?? lastDepositRow.platformTransactionId ?? null,
          amount: numberFrom(lastDepositRow.amount),
          dateLocal: lastDepositRow.createdAt,
        }
      : undefined,
    sameDayDateKey: bugunDateKey,
    sameDayDeposits: sameDayDepositRows.map((row) => ({
      amount: numberFrom(row.amount),
      dateLocal: String(row.createdAt ?? ''),
    })),
    sameDayDepositCount: sameDayDepositRows.length,
    sameDayDepositTotal: sameDayDepositRows.reduce((sum, row) => sum + numberFrom(row.amount), 0),
    previousDayDateKey,
    previousDayDepositTotal,
    previousDayDepositCount: previousDayDeposits.length,
    previousDayLastDeposit: previousDayLastDeposit ? { amount: numberFrom(previousDayLastDeposit.amount), dateLocal: previousDayLastDeposit.createdAt } : undefined,
    lastWithdrawal: withdrawals[0] ? { amount: numberFrom(withdrawals[0].amount), dateLocal: withdrawals[0].createdAt, status: withdrawals[0].status } : undefined,
    pendingWithdrawalCount: pendingWithdrawals.length,
    openBetCount,
    isFirstWithdrawal: withdrawals.length === 0,
    totalBetAmountSinceLastDeposit,
    casinoBetAmountSinceLastDeposit,
    sportBetAmountSinceLastDeposit,
    sportOddsSinceLastDeposit,
    wageringRemaining: bonuses.reduce((sum: number, bonus: AnyRecord) => sum + numberFrom(bonus.ToWagerAmount), 0),
    bonuses,
    profileTransactions,
    profileTransactionsByType,
    profileTransactionsCount: profileTransactions.length,
    financialMovementCount: financialMovements.length,
    /**
     * Bakiye duzeltmeleri — nakit bonus limitleri icin.
     *
     * Nakit bonuslar kampanya olarak atanmiyor, `crediting` duzeltmesi
     * olarak yaziliyor; `bonuses` listesinde hic gorunmuyorlar. Limit
     * kontrolleri oradan saydigi icin nakit bonuslarda YAPISAL OLARAK
     * kordu ve ayni bonus tekrar tekrar alinabiliyordu.
     */
    balanceCorrections: financialMovements.map((row) => ({
      not: String(row.Note ?? row.note ?? row.Info ?? ''),
      tutar: numberFrom(row.Amount ?? row.amount),
      tarih: String(row.CreatedLocal ?? row.createdAt ?? ''),
      tur: String(row.CorrectionType ?? row.correctionType ?? ''),
    })),
    paymentTransactionCount: paymentTransactions.length,
    recentGames: casinoBets.map((row) => firstNonEmpty(row.gameName, row.game?.name)).filter(Boolean),
    recentGameProviders: casinoBets.map((row) => firstNonEmpty(recordOf(row.round).providerName, row.providerName, row.game?.providerName)).filter(Boolean),
    totalKpi: numberFrom(kpi.GamingProfitAndLose),
    /**
     * KAYIP TABANI = YATIRIM - CEKIM (son odenen cekimden itibaren).
     *
     * Onceden `kpi.GamingProfitAndLose` idi: bahis eksi kazanc. O sayi
     * paranin kimden geldigine bakmiyor; bonusla ve MANUEL DUZELTMEYLE
     * verilen parayla yapilan kayiplar da iceride.
     *
     * Gozlenen vaka: 10.000 kendi parasi + 2x manuel duzeltme (20.000)
     * -> GGR ~23.000 -> %30 diliminden 7.000 kayip bonusu. Kasa kendi
     * verdigi paranin kaybini geri odemis oldu.
     *
     * Ayrinti ve donem penceresi gerekcesi: kayipTabaniService.
     */
    ...(() => {
      const taban = kayipTabani(
        playerPayments.map((row) => ({
          tur: String(row.transactionType ?? ''),
          durum: String(row.status ?? ''),
          tutar: numberFrom(row.amount),
          tarih: String(row.createdAt ?? ''),
        })),
      );
      return {
        netLoss: taban.netLoss,
        // Denetim icin: tabanin nasil olustugu panelden gorulebilsin.
        kayipTabaniDetay: taban,
      };
    })(),
    rawKpi: kpi,
    dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
  };
}

export function lynonDateOnly(value: unknown): string | null {
  return dateOnly(value);
}

export interface LynonCampaignInput {
  systemName: string;
  nameTranslations: Record<string, string>;
  expirationToClaimInDays: number;
  supportedCurrencies?: string[];
  configurationCurrency?: string;
  maxAssigneeCount?: number;
  startDate: string;
  endDate: string;
}

export interface LynonCampaignBonusInput {
  templateId: number;
  systemName: string;
  systemDescription?: string;
  nameTranslations?: Record<string, string>;
  descriptionTranslations?: Record<string, string>;
  activeBonusExpirationInDays?: number;
  assignmentLimits?: AnyRecord | AnyRecord[];
  blocksConfiguration: AnyRecord[];
}

export async function lynonCampaigns(page = 1, countPerPage = 100): Promise<AnyRecord[]> {
  const data = await lynonRequest(`/api/bonusenginev2/api/v1/Campaign/site/${config.lynon.siteId}`, {
    query: { page, countPerPage },
  });
  return arrayOf(data);
}

export async function lynonCampaign(campaignId: number): Promise<AnyRecord> {
  return recordOf(await lynonRequest(`/api/bonusenginev2/api/v1/Campaign/${campaignId}`));
}

export async function lynonCampaignBonuses(campaignId: number): Promise<AnyRecord[]> {
  return arrayOf(await lynonRequest(`/api/bonusenginev2/api/v1/Bonus/campaign/${campaignId}`));
}

export async function lynonTemplate(templateId: number): Promise<AnyRecord> {
  return recordOf(await lynonRequest(`/api/bonusenginev2/api/v1/Template/${templateId}`));
}

export async function lynonCreateCampaign(input: LynonCampaignInput): Promise<AnyRecord> {
  return recordOf(await lynonRequest(`/api/bonusenginev2/api/v1/Campaign/site/${config.lynon.siteId}`, {
    method: 'POST',
    body: {
      ...input,
      configurationCurrency: input.configurationCurrency ?? config.lynon.currency,
      supportedCurrencies: input.supportedCurrencies ?? [config.lynon.currency],
      maxAssigneeCount: input.maxAssigneeCount ?? 999999999,
    },
  }));
}

export async function lynonUpdateCampaign(campaignId: number, input: Partial<LynonCampaignInput>): Promise<AnyRecord> {
  return recordOf(await lynonRequest(`/api/bonusenginev2/api/v1/Campaign/${campaignId}`, {
    method: 'PUT',
    body: { ...input },
  }));
}

export async function lynonCloneCampaign(campaignId: number, input: Pick<LynonCampaignInput, 'systemName' | 'nameTranslations' | 'startDate' | 'endDate'>): Promise<AnyRecord> {
  return recordOf(await lynonRequest(`/api/bonusenginev2/api/v1/Campaign/clone/${campaignId}`, {
    method: 'PUT',
    body: { ...input },
  }));
}

export async function lynonSetCampaignState(campaignId: number, state: 'active' | 'inactive' | boolean): Promise<AnyRecord> {
  const enabled = typeof state === 'boolean' ? state : state === 'active';
  return recordOf(await lynonRequest(`/api/bonusenginev2/api/v1/Campaign/state/${campaignId}`, {
    method: 'PUT',
    body: { state: enabled, request: {} },
  }));
}

export async function lynonArchiveCampaign(campaignId: number): Promise<AnyRecord> {
  return recordOf(await lynonRequest(`/api/bonusenginev2/api/v1/Campaign/${campaignId}`, { method: 'DELETE' }));
}

export async function lynonAddCampaignBonus(campaignId: number, input: LynonCampaignBonusInput): Promise<AnyRecord> {
  return recordOf(await lynonRequest(`/api/bonusenginev2/api/v1/Bonus/site/${config.lynon.siteId}/campaign/${campaignId}`, {
    method: 'POST',
    body: { ...input },
  }));
}

export async function lynonUpdateCampaignBonus(bonusId: number, input: Partial<LynonCampaignBonusInput>): Promise<AnyRecord> {
  return recordOf(await lynonRequest(`/api/bonusenginev2/api/v1/Bonus/site/${config.lynon.siteId}/${bonusId}`, {
    method: 'PUT',
    body: { ...input },
  }));
}

export async function lynonDeleteCampaignBonus(bonusId: number): Promise<AnyRecord> {
  return recordOf(await lynonRequest(`/api/bonusenginev2/api/v1/Bonus/site/${config.lynon.siteId}/${bonusId}`, { method: 'DELETE' }));
}

function assignmentParamPayload(param: AnyRecord, supplied: unknown): { value: unknown; valueJson: string | null } {
  if (supplied === null || supplied === undefined || supplied === '') return { value: null, valueJson: null };
  const paramType = String(param.blockParamType ?? param.type ?? '').toLowerCase();
  if (paramType === 'singlegameselect') {
    const game = supplied != null && typeof supplied === 'object' && !Array.isArray(supplied)
      ? supplied as AnyRecord
      : {};
    const id = Number(game.id ?? game.Id);
    const providerId = Number(game.providerId ?? game.ProviderId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(providerId) || providerId <= 0) {
      return { value: null, valueJson: null };
    }
    return {
      value: { id, providerId },
      valueJson: JSON.stringify({ Id: id, ProviderId: providerId }),
    };
  }
  return {
    value: supplied,
    valueJson: typeof supplied === 'string' ? supplied : JSON.stringify(supplied),
  };
}

/** Template assignment bloklarını Lynon CampaignAssignment gövdesinin birebir biçimine dönüştürür. */
export function buildLynonAssignmentBlocks(template: AnyRecord, values: AnyRecord): { blocks: AnyRecord[]; missing: AnyRecord[] } {
  const missing: AnyRecord[] = [];
  const blocks = arrayOf(template.templateBlocks).map((block) => {
    const numericBlockId = Number(block.blockId ?? block.id);
    const blockId = Number.isFinite(numericBlockId) ? numericBlockId : 0;
    const params = arrayOf(block.params)
      .filter((param) => String(param.filledBy ?? '').toLowerCase() === 'assignment')
      .map((param) => {
        const key = String(param.blockParamKey ?? param.key ?? '');
        const supplied = values[`${blockId}.${key}`] ?? values[key];
        const payload = assignmentParamPayload(param, supplied);
        const required = param.blockParamIsOptional === false || param.isOptional === false || param.isMandatory === true || param.mandatory === true;
        if (required && payload.value === null) {
          missing.push({ blockId, key, label: param.name ?? param.blockParamName ?? param.blockParamTranslationKey ?? key, type: param.blockParamType ?? param.type ?? null });
        }
        return { blockParamKey: key, value: payload.value, valueJson: payload.valueJson };
      });
    return {
      blockId,
      params,
      templateBlockKey: String(block.templateBlockKey ?? block.key ?? ''),
    };
  }).filter((block) => block.params.length > 0);
  return { blocks, missing };
}

export interface LynonCampaignAssignmentInput {
  campaignId: number;
  playerId: number | string;
  assignmentReason?: string;
  assignmentValues?: AnyRecord;
  configurationCurrency?: string;
}

export function buildLynonCampaignAssignmentBody(
  input: LynonCampaignAssignmentInput,
  bonusBlocksConfiguration: Record<string, AnyRecord[]>,
): AnyRecord {
  return {
    campaignId: input.campaignId,
    assignmentReason: input.assignmentReason ?? 'Narcosbahis bonus talebi',
    bonusBlocksConfiguration,
    configurationCurrency: input.configurationCurrency ?? config.lynon.currency,
  };
}

/** Assigns a live Bonus Engine V2 campaign only when all required assignment values are explicit. */
export async function lynonAssignCampaignToPlayer(input: LynonCampaignAssignmentInput): Promise<AnyRecord> {
  const bonuses = await lynonCampaignBonuses(input.campaignId);
  if (!bonuses.length) {
    throw new LynonHttpError('Kampanyaya bagli aktif bonus bulunamadi.', 422, { campaignId: input.campaignId });
  }

  const bonusBlocksConfiguration: Record<string, AnyRecord[]> = {};
  const missing: AnyRecord[] = [];
  for (const bonus of bonuses) {
    const bonusId = Number(bonus.id ?? bonus.Id);
    const templateId = Number(bonus.templateId ?? bonus.TemplateId);
    if (!Number.isFinite(bonusId) || !Number.isFinite(templateId)) {
      throw new LynonHttpError('Kampanya bonus sablonu okunamadi.', 422, { campaignId: input.campaignId, bonus });
    }
    const prepared = buildLynonAssignmentBlocks(await lynonTemplate(templateId), input.assignmentValues ?? {});
    bonusBlocksConfiguration[String(bonusId)] = prepared.blocks;
    missing.push(...prepared.missing.map((item) => ({ bonusId, templateId, ...item })));
  }

  if (missing.length) {
    throw new LynonHttpError('Bu kampanya dinamik deger gerektiriyor; operat�r onayi olmadan atanamaz.', 422, {
      campaignId: input.campaignId,
      missingAssignmentFields: missing,
    });
  }

  return recordOf(await lynonRequest(
    `/api/bonusenginev2/api/v1/CampaignAssignment/site/${config.lynon.siteId}/player/${input.playerId}`,
    {
      method: 'POST',
      body: buildLynonCampaignAssignmentBody(input, bonusBlocksConfiguration),

    }
  ));
}
