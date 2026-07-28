import type { Config } from '../config.js';
import type { AccountSnapshot } from './withdrawalEngine.js';
import { humanDelay } from '../lib/humanDelay.js';
import { backofficeGet, backofficePost } from '../lib/httpClient.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('accountSnapshot');

/** DD-MM-YY for GetClientTransactionsV1 StartTimeLocal/EndTimeLocal */
function toDDMMYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return `${d}-${m}-${y}`;
}

/** Parse date string (DD/MM/YYYY, DD.MM.YYYY, DD-MM-YY, YYYY-MM-DD, ISO with T, optional time) to timestamp. */
export function parseDateToTime(dateStr: string | null | undefined): number {
  if (dateStr == null || String(dateStr).trim() === '') return 0;
  const s = String(dateStr).trim();

  const timeMatch = s.match(/[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  const h = timeMatch ? parseInt(timeMatch[1], 10) : 0;
  const min = timeMatch ? parseInt(timeMatch[2], 10) : 0;
  const sec = timeMatch && timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;

  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);

  let date: Date | null = null;
  if (dmy) {
    const [, day, month, year] = dmy;
    const y = year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);
    date = new Date(y, parseInt(month, 10) - 1, parseInt(day, 10), h, min, sec);
  } else if (ymd) {
    const [, year, month, day] = ymd;
    date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), h, min, sec);
  } else {
    const iso = Date.parse(s);
    if (!Number.isNaN(iso)) date = new Date(iso);
  }

  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

/** Yatırım sayılan işlem türleri (son yatırım için). */
const DEPOSIT_TYPE_KEYS = ['Yatırım', 'Deposit', 'Yatırım Talebi Ödemesi'];

/** Çekim verildi (ödeme yapıldı) sayılan işlem türleri — son yatırım buna göre seçilir. */
const WITHDRAWAL_PAID_TYPE_KEYS = ['Çekim Talebi Ödemesi', 'Çekim talebi Ödemesi'];

/** Çekim talebi veya ödemesi — bunlardan biri varsa "ilk çekim" değildir. */
const WITHDRAWAL_ANY_TYPE_KEYS = [
  'Çekim Talebi',
  'Withdrawal Request',
  'Çekim Talebi Ödemesi',
  'Çekim talebi Ödemesi',
];

/** Parse API date string and return days since that date (approximate). */
function daysSinceDate(dateStr: string | null | undefined): number | undefined {
  const ts = parseDateToTime(dateStr);
  if (!ts) return undefined;
  const now = new Date().getTime();
  const ms = now - ts;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/** httpClient üzerinden GET isteği (retry + circuit breaker). */
async function fetchGet(
  baseUrl: string,
  path: string,
  query: string,
  authToken: string
): Promise<Record<string, unknown>> {
  const result = await backofficeGet(baseUrl, path, query, authToken, { timeoutMs: 15_000 });
  if (!result.ok) {
    throw new Error((result.data?.AlertMessage as string) || `API ${result.status}`);
  }
  return result.data;
}

/** httpClient üzerinden POST isteği (retry + circuit breaker). */
async function fetchPost(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  authToken: string
): Promise<Record<string, unknown>> {
  const result = await backofficePost(baseUrl, path, body, authToken, { timeoutMs: 15_000 });
  if (!result.ok) {
    throw new Error((result.data?.AlertMessage as string) || `API ${result.status}`);
  }
  return result.data;
}

export interface ProfileTransactionItem {
  DocumentId: number;
  DocumentTypeId: number;
  DocumentTypeName: string;
  Amount: number;
  Operation?: number;
  CreatedLocal?: string;
  [key: string]: unknown;
}

/** Profil işlemleri: GetClientTransactionsV1. documentTypeIds boş = tüm türler. */
export async function fetchClientProfileTransactions(
  clientId: number,
  config: Config,
  authToken: string,
  options: {
    documentTypeIds?: number[];
    maxRows?: number;
    daysBack?: number;
  } = {}
): Promise<{ count: number; objects: ProfileTransactionItem[] }> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (options.daysBack ?? 3));
  const api = config.clientProfileTransactionsApi;
  const body = {
    ByPassTotals: false,
    ClientId: clientId,
    CurrencyId: 'TRY',
    DocumentTypeIds: options.documentTypeIds ?? [],
    EndTimeLocal: toDDMMYY(end),
    GameId: null,
    MaxRows: options.maxRows ?? 500,
    PaymentSystemId: null,
    SkeepRows: 0,
    StartTimeLocal: toDDMMYY(start),
  };
  const res = await fetchPost(api.baseUrl, api.path, body, authToken);
  const data = res.Data as { Count?: number; Objects?: ProfileTransactionItem[] } | undefined;
  const objects = data?.Objects ?? [];
  const count = data?.Count ?? objects.length;
  return { count, objects };
}

/**
 * Builds an AccountSnapshot from backoffice APIs (KPI, Bonuses, GetClients, Profil İşlemleri)
 * so the withdrawal checklist uses real system data including full transaction analysis.
 * İstekler iki dalga halinde ve aralarında gecikme ile atılır (bot tespiti azaltmak için).
 * withdrawalDateLocal verilirse "çekim verilen tarih" olarak bu kullanılır (profil işlemlerindeki ilk çekim değil).
 */
export async function buildAccountSnapshotFromClientId(
  clientId: number,
  config: Config,
  authToken: string,
  options?: { documentTypeIds?: number[]; withdrawalDateLocal?: string | null }
): Promise<AccountSnapshot> {
  await humanDelay();

  const [kpiRes, clientsRes] = await Promise.all([
    fetchGet(
      config.clientKpiApi.baseUrl,
      config.clientKpiApi.path,
      `id=${clientId}`,
      authToken
    ),
    fetchPost(config.clientsApi.baseUrl, config.clientsApi.path, {
      Id: clientId,
      MaxRows: 1,
      SkeepRows: 0,
      Login: '',
      FirstName: '',
      LastName: '',
      IsOrderedDesc: true,
      OrderedItem: 1,
    }, authToken),
  ]);

  await humanDelay();

  const [bonusesRes, notesRes, txResult] = await Promise.all([
    fetchPost(
      config.clientBonusesApi.baseUrl,
      config.clientBonusesApi.path,
      {
        ClientId: clientId,
        BonusType: null,
        FromDateLocal: null,
        ToDateLocal: null,
      },
      authToken
    ),
    fetchPost(
      config.clientNoteApi.baseUrl,
      config.clientNoteApi.path,
      {
        ClientId: clientId,
        Type: null,
        FromDateLocal: null,
        ToDateLocal: null,
      },
      authToken
    ),
    fetchClientProfileTransactions(clientId, config, authToken, {
      documentTypeIds: options?.documentTypeIds,
      maxRows: 500,
      daysBack: 30, // Son yatırımı bulmak için yeterli pencere (önceden 3 gündü; yatırım dışarıda kalınca tüm bonuslar listeleniyordu)
    }).catch(() => ({ count: 0, objects: [] })),
  ]);

  const kpiData = kpiRes.Data as Record<string, unknown> | undefined;
  const bonusesData = (bonusesRes.Data as unknown[] | undefined) ?? [];
  const notesData = (notesRes.Data as unknown[] | undefined) ?? [];
  const clientsData = clientsRes.Data as { Objects?: Record<string, unknown>[] } | undefined;
  const clientItem = clientsData?.Objects?.[0];

  const totalDeposits = kpiData?.TotalDeposit != null ? Number(kpiData.TotalDeposit) : undefined;

  // Kayıp bonusunun tabanı. promoEvaluator `account.netLoss` okuyordu ama bu alan
  // HİÇBİR YERDE yazılmıyordu; sonuç olarak kayıp bonusu her oyuncuda
  // "doğrulanmış net kaybı yok" ile reddediliyordu.
  //
  // Tanım: yatırım toplamı − çekim toplamı, negatifse 0. Yani oyuncunun siteye
  // bıraktığı net para. Lynon KPI'sı alan adını iki biçimde döndürebiliyor
  // (TotalWithdraw / TotalWithdrawal), ikisi de karşılanır.
  //
  // Para etkisi olduğu için eksik veriyle tahmin YAPMAYIZ: yatırım toplamı yoksa
  // netLoss undefined kalır ve kural "kaybı yok" diyerek güvenli tarafta reddeder.
  const totalWithdrawalsRaw = kpiData?.TotalWithdraw ?? kpiData?.TotalWithdrawal;
  const netLoss = totalDeposits != null
    ? Math.max(0, totalDeposits - Number(totalWithdrawalsRaw ?? 0))
    : undefined;
  const registrationDate =
    (kpiData?.FirstDepositTimeLocal as string) ?? (clientItem?.CreatedLocalDate as string);
  const accountAgeDays = registrationDate ? daysSinceDate(registrationDate) : undefined;
  const isTest = (kpiData?.IsTest ?? clientItem?.IsTest) === true;
  const balance =
    clientItem?.Balance != null ? Number(clientItem.Balance) : undefined;
  // GetClientBonuses yanıtındaki tüm parametreleri koru (Id, AcceptanceType, Name, Amount, ExpirationDays, StartDateLocal, EndDateLocal, ClientCurrency, IsTest, vb.); sadece kullanılan alanları normalize et.
  const bonusesList = Array.isArray(bonusesData)
    ? (bonusesData as any[]).map((b) => ({
      ...b,
      Id: Number(b.Id),
      Name: String(b.Name ?? ''),
      Amount: Number(b.Amount) || 0,
      WageredAmount: Number(b.WageredAmount) ?? 0,
      ToWagerAmount: Number(b.ToWagerAmount) ?? 0,
      RealAmount: Number(b.RealAmount) ?? 0,
      WinAmount: Number(b.WinAmount) ?? 0,
      PaidAmount: Number(b.PaidAmount) ?? 0,
      CreatedLocal: b.CreatedLocal || b.AcceptanceDateLocal || null,
      AcceptanceDateLocal: b.AcceptanceDateLocal ?? null,
      ClientBonusExpirationDateLocal: b.ClientBonusExpirationDateLocal ?? null,
    }))
    : [];
  const recentGames: string[] = [];
  if (kpiData?.LastSportBetTimeLocal) recentGames.push('sport');
  if (kpiData?.LastCasinoBetTimeLocal) recentGames.push('casino');
  const flags: string[] = [];
  const bTag = (kpiData?.BTag ?? clientItem?.BTag) as string | null | undefined;
  if (bTag != null && String(bTag).trim() !== '') flags.push(`BTag:${bTag}`);

  const txObjects = txResult.objects ?? [];
  const txCount = txResult.count ?? txObjects.length;
  const profileTransactionsByType: Record<string, { count: number; totalAmount: number }> = {};
  for (const tx of txObjects) {
    const name = (tx.DocumentTypeName as string) || 'Diğer';
    if (!profileTransactionsByType[name]) {
      profileTransactionsByType[name] = { count: 0, totalAmount: 0 };
    }
    profileTransactionsByType[name].count += 1;
    profileTransactionsByType[name].totalAmount += Number(tx.Amount) || 0;
  }

  const depositTxs = txObjects.filter(
    (tx) => DEPOSIT_TYPE_KEYS.includes(String(tx.DocumentTypeName ?? '').trim())
  );

  // ─── Bütün kontrol mantığının dayandığı kural ─────────────────────────────────────────────
  // Çekim talebi adına konuşuyoruz: ÜYE ÇEKİM VERMİŞ TARİH = "çekim verilen tarih".
  // Analizin baz alındığı yatırım = ÇEKİMDEN ÖNCEKİ son yatırım (çekim verilen tarihten önce yapılan en son yatırım).
  // Tüm kontroller (çevrim, bonus, wager, kurallar) bu baz yatırıma göre hesaplanır.
  // Çekim verilen tarih: otomatik çekimdeki çekim talebinin tarihi (withdrawalDateLocal) verilmişse onu kullan; yoksa profil işlemlerindeki EN SON çekim (değerlendirdiğimiz çekim).
  const withdrawalTxs = txObjects.filter((tx) =>
    WITHDRAWAL_ANY_TYPE_KEYS.includes(String(tx.DocumentTypeName ?? '').trim())
  );
  const lastWithdrawalTimeFromProfile =
    withdrawalTxs.length > 0
      ? Math.max(...withdrawalTxs.map((tx) => parseDateToTime(tx.CreatedLocal)).filter((t) => t > 0))
      : Infinity;
  const parsedWithdrawalDate =
    options?.withdrawalDateLocal != null && String(options.withdrawalDateLocal).trim() !== ''
      ? parseDateToTime(options.withdrawalDateLocal)
      : 0;
  const firstWithdrawalTime =
    parsedWithdrawalDate > 0 ? parsedWithdrawalDate : lastWithdrawalTimeFromProfile;

  // Baz yatırım = çekim verilen tarihten önceki son yatırım (tüm kontrol mantığı buna göre)
  const depositsBeforeWithdrawal =
    firstWithdrawalTime < Infinity
      ? depositTxs.filter((tx) => parseDateToTime(tx.CreatedLocal) < firstWithdrawalTime)
      : depositTxs;
  const baseDepositTx =
    depositsBeforeWithdrawal.length > 0
      ? depositsBeforeWithdrawal.reduce((latest, tx) =>
        parseDateToTime(tx.CreatedLocal) > parseDateToTime(latest.CreatedLocal) ? tx : latest
      )
      : null;

  let lastDeposit =
    baseDepositTx != null
      ? {
        amount: Number(baseDepositTx.Amount) || 0,
        dateLocal: String(baseDepositTx.CreatedLocal ?? '').trim(),
      }
      : undefined;

  let lastDepositTime = baseDepositTx ? parseDateToTime(baseDepositTx.CreatedLocal) : 0;
  let isNoDepositOverride = false;

  // Freespin & Promo Code & Weekly Discount Override Baseline: if claimed after the last deposit (or no deposit), its time becomes the new baseline.
  // We add a 24-hour threshold to prevent wiping out a deposit if a bonus was claimed immediately as an add-on.
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  let isWeeklyDiscountBaseline = false;

  const noDepBonusesBeforeWithdrawal = bonusesList.filter((b) => {
    if (!b.CreatedLocal) return false;
    const isNoDepositBonus = b.BonusType === 5 || /freespin|free spin|promosyon kod|haftalık.*discount|haftalik.*discount/i.test(b.Name);
    const bTime = parseDateToTime(b.CreatedLocal);

    // Only override if there's no prior deposit, or if the bonus was claimed >24 hours after the last deposit
    const isIndependentSession = lastDepositTime === 0 || (bTime - lastDepositTime) > TWENTY_FOUR_HOURS_MS;

    return isNoDepositBonus && bTime >= lastDepositTime && bTime < firstWithdrawalTime && isIndependentSession;
  });

  if (noDepBonusesBeforeWithdrawal.length > 0) {
    const latestBonus = noDepBonusesBeforeWithdrawal.reduce((latest, b) =>
      parseDateToTime(b.CreatedLocal!) > parseDateToTime(latest.CreatedLocal!) ? b : latest
    );
    lastDepositTime = parseDateToTime(latestBonus.CreatedLocal!);
    lastDeposit = {
      amount: 0, // No deposit principal
      dateLocal: latestBonus.CreatedLocal!,
    };
    isNoDepositOverride = true;
    if (/haftalık.*discount|haftalik.*discount/i.test(latestBonus.Name)) {
      isWeeklyDiscountBaseline = true;
    }
  }

  // Anapara çevrimi: baz yatırımdan sonra yapılan bahisler
  const betsSinceLastDeposit = txObjects.filter((tx) => {
    const txTime = parseDateToTime(tx.CreatedLocal);
    const isAfterOrAtDeposit = txTime >= lastDepositTime;
    const isBet = /bahis|bet|rake|game/i.test(String(tx.DocumentTypeName || ''));
    return isAfterOrAtDeposit && isBet;
  });
  const totalBetAmountSinceLastDeposit = betsSinceLastDeposit.reduce(
    (sum, tx) => sum + Math.abs(Number(tx.Amount) || 0),
    0
  );

  // YATIRIMDAN SONRAKİ - ÇEKİMDEN ÖNCEKİ bonusları hesaplamaya dahil et. (Artık lastDepositTime FreeSpin tarihine de güncellenebiliyor)
  const filteredBonuses = bonusesList.filter((b) => {
    if (!b.CreatedLocal) return false;
    // Canceled (ResultType 3) olanları dikkate alma
    if (b.ResultType === 3) return false;

    const bonusTime = parseDateToTime(b.CreatedLocal);
    if (bonusTime < lastDepositTime) return false; // Baz tarihten önceyse reddet
    if (bonusTime >= firstWithdrawalTime) return false; // Çekimden sonra
    return true;
  });

  const wageringRemaining = filteredBonuses.reduce((sum, b) => sum + (Number(b.ToWagerAmount) || 0), 0);

  // İlk çekim: profil penceresinde hiç çekim talebi veya çekim ödemesi yoksa (talep de sayılır)
  const withdrawalAnyCount = WITHDRAWAL_ANY_TYPE_KEYS.reduce(
    (sum, key) => sum + (profileTransactionsByType[key]?.count ?? 0),
    0
  );
  const isFirstWithdrawal = withdrawalAnyCount === 0;

  const notesList = notesData.map((n: any) => ({
    id: n.Id,
    note: n.Note,
    createdLocal: n.CreatedLocal,
  }));

  return {
    id: clientId,
    ClientId: clientId,
    ClientLogin: (kpiData?.Login ?? clientItem?.Login) as string | undefined,
    ClientName: (kpiData?.Name ?? (clientItem?.FirstName || clientItem?.LastName))
      ? `${clientItem?.FirstName ?? ''} ${clientItem?.LastName ?? ''}`.trim()
      : undefined,
    totalDeposits,
    registrationDate,
    accountAgeDays,
    isTest,
    balance,
    wageringRemaining: wageringRemaining > 0 ? wageringRemaining : undefined,
    bonuses: filteredBonuses.length ? filteredBonuses : undefined,
    lastDeposit,
    withdrawalTime: firstWithdrawalTime < Infinity ? new Date(firstWithdrawalTime).toISOString() : undefined,
    isFirstWithdrawal,
    notes: notesList.length ? notesList : undefined,
    totalBetAmountSinceLastDeposit,
    recentGames: recentGames.length ? recentGames : undefined,
    flags: flags.length ? flags : undefined,
    rawKpi: kpiData,
    rawBonusesCount: bonusesList.length,
    profileTransactionsCount: txCount,
    profileTransactions: txObjects.length ? txObjects : undefined,
    profileTransactionsByType: Object.keys(profileTransactionsByType).length ? profileTransactionsByType : undefined,
    isNoDepositOverride,
    isWeeklyDiscountBaseline,
    netLoss,
  };
}
