import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { evaluateForAccount } from '../services/promoEvaluator.js';
import { assignmentValuesForPromoSpec, freespinAtamasiVar, getRules, type PromoSpec, type RulesConfig } from '../services/rulesService.js';
import { atamaNotu } from '../services/bonusAtamaNotu.js';
import { bonusDenetimAciklamasi } from '../services/bonusDenetimAciklamasi.js';
import { audit } from '../lib/auditLog.js';
import { araligaGorePartnerBonusId, araliklariOzetle } from '../services/bonusAraliklari.js';
import { depositBasis } from '../services/promoEvaluator.js';
import { dagitikKilitle, odulAnahtari } from '../lib/odulKilidi.js';
import { currentTenantKey, safeTenantKey } from '../lib/tenantContext.js';
import { bekleyenGun, gunEkle, VARSAYILAN_PENCERE, type GunDurumu, type PencereAyari } from './ertesiGunPenceresi.js';
import {
  isLynonConfigured,
  istanbulDateKey,
  istanbulDayBoundsUtc,
  lynonAdjustPlayerMainAccount,
  lynonAssignCampaignToPlayer,
  lynonBonusDefinitions,
  lynonBuildBonusEligibilitySnapshot,
  lynonCorrectionHistory,
  lynonPaymentTransactions,
  previousIstanbulDateKey,
} from '../services/lynonBackofficeService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, '..', 'data', 'next-day-bonus-runs');
const PAGE_SIZE = 500;
const BETWEEN_PLAYERS_MS = 350;

/**
 * ERTESI GUN BONUSU — TELAFILI CALISMA MODELI.
 *
 * Bu is eskiden YALNIZCA Turkiye saatiyle 00:15-00:19 arasinda
 * calisiyordu: `if (hour !== 0 || minute < 15 || minute > 19) return`.
 * Bes dakikalik bir pencere ve HICBIR telafi yolu yoktu. Sonuclari
 * sahada tam olarak "ertesi gun freespinleri dagitilmiyor" seklinde
 * goruluyordu:
 *
 *   - Surec o bes dakikada ayakta degilse (Railway yeniden baslatmasi,
 *     deploy, kisa bir cokme) O GUNUN bonusu tamamen ve sessizce
 *     kayboluyordu. Ertesi gun uyanan is yalnizca YENI gune bakiyor,
 *     kacirdigi gunu hic sormuyordu.
 *   - Gecici bir API hatasi alan oyuncunun kaydi `error` olarak
 *     yaziliyordu ama kayit anahtari gunu icerdigi icin (`stateKey`)
 *     yalnizca AYNI GUN, ayni pencerede yeniden denenebiliyordu. 00:19'u
 *     geciren hata kalici kayipti.
 *
 * Yerine gecen model: is her dakika uyanir ve "bekleyen gun" arar. Bir
 * gun, baslangic saati gectiginde bekleyen sayilir ve tum kapilardan
 * hatasiz gecene kadar bekleyen kalir — gunun hangi saatinde olundugu
 * fark etmez. Boylece aksam yeniden baslatilan bir sunucu sabahki
 * dagitimi telafi eder.
 *
 * Sonsuz yeniden denemeye karsi iki sinir var: gun basina deneme sayisi
 * ve denemeler arasi bekleme. Kalici bir hata (silinmis kampanya gibi)
 * Lynon'u dakikada bir dovmez.
 */

/** Zamanlama ayari; hepsi ortam degiskeni ile ezilebilir. */
function pencereAyari(): PencereAyari {
  return {
    baslangicSaat: Number(process.env.ERTESI_GUN_BASLANGIC_SAAT ?? VARSAYILAN_PENCERE.baslangicSaat),
    baslangicDakika: Number(process.env.ERTESI_GUN_BASLANGIC_DAKIKA ?? VARSAYILAN_PENCERE.baslangicDakika),
    telafiGun: Math.max(1, Number(process.env.ERTESI_GUN_TELAFI_GUN) || VARSAYILAN_PENCERE.telafiGun),
    maxDeneme: Math.max(1, Number(process.env.ERTESI_GUN_MAX_DENEME) || VARSAYILAN_PENCERE.maxDeneme),
    denemeArasiMs: Math.max(60_000, Number(process.env.ERTESI_GUN_DENEME_ARASI_MS) || VARSAYILAN_PENCERE.denemeArasiMs),
  };
}

/**
 * Onceki gunun yatirim islemlerinde taranacak en fazla sayfa.
 *
 * Eskiden 10 sayfa (5.000 islem) SESSIZ bir tavandi: yogun bir gunde
 * 5.000. islemden sonrasi hic okunmuyor, o oyuncular bonus almiyor ve
 * hicbir yerde iz kalmiyordu. Tavan yukseltildi ve dolarsa artik
 * loglaniyor.
 */
const MAX_SAYFA = Math.max(1, Number(process.env.ERTESI_GUN_MAX_SAYFA) || 60);

type RunRecord = {
  status: 'granted' | 'ineligible' | 'already-granted' | 'error';
  at: string;
  message?: string;
};

type RunState = {
  version: 2;
  /** Geriye donuk uyumluluk: v1 kaydindaki tamamlanmis gunler. */
  completedDates: string[];
  gunler: Record<string, GunDurumu>;
  records: Record<string, RunRecord>;
};

type AutoRule = {
  key: string;
  group: 'id' | 'title';
  spec: PromoSpec;
};

const emptyState = (): RunState => ({ version: 2, completedDates: [], gunler: {}, records: {} });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function statePath(tenantKey: string): string {
  return join(STATE_DIR, `${safeTenantKey(tenantKey)}.json`);
}

async function loadState(tenantKey: string): Promise<RunState> {
  const parsed = await readStoredDocument<Partial<RunState> & { completedDates?: unknown }>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'next-day-bonus-runs',
    filePath: statePath(tenantKey),
    fallback: emptyState,
  });

  const completedDates = Array.isArray(parsed.completedDates) ? parsed.completedDates.map(String) : [];
  const gunler: Record<string, GunDurumu> = parsed.gunler && typeof parsed.gunler === 'object' ? { ...parsed.gunler } : {};
  // v1 -> v2 gecisi: eski `completedDates` listesi tamamlanmis gun sayilir,
  // yoksa surumu yukseltir yukseltmez tum gecmis gunler yeniden dagitilirdi.
  for (const dateKey of completedDates) {
    if (!gunler[dateKey]) gunler[dateKey] = { durum: 'done', deneme: 0 };
  }

  return {
    version: 2,
    completedDates,
    gunler,
    records: parsed.records && typeof parsed.records === 'object' ? parsed.records : {},
  };
}

async function saveState(tenantKey: string, state: RunState): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'next-day-bonus-runs', filePath: statePath(tenantKey) },
    state,
  );
}

function automaticRules(rules: RulesConfig): AutoRule[] {
  const rows: AutoRule[] = [
    ...Object.entries(rules.PROMO_SPECS).map(([key, spec]) => ({ key, group: 'id' as const, spec })),
    ...Object.entries(rules.PROMO_TITLE_SPECS).map(([key, spec]) => ({ key, group: 'title' as const, spec })),
  ];
  const unique = new Map<string, AutoRule>();
  for (const row of rows) {
    if (row.spec.enabled === false || row.spec.isNextDayBonus !== true || row.spec.autoGrantNextDayAt0015 !== true) continue;
    const identity = `${String(row.spec.type ?? 'partner')}:${row.spec.partnerBonusId ?? row.group}:${row.key}`;
    if (!unique.has(identity)) unique.set(identity, row);
  }
  return [...unique.values()];
}

async function previousDayDepositorIds(previousDateKey: string): Promise<{ ids: Array<number | string>; kirpildi: boolean }> {
  const bounds = istanbulDayBoundsUtc(previousDateKey);
  const rows: Record<string, any>[] = [];
  let kirpildi = false;
  for (let page = 0; page < MAX_SAYFA; page += 1) {
    const pageRows = await lynonPaymentTransactions({
      FromCreatedDateLocal: bounds.from,
      ToCreatedDateLocal: bounds.to,
      MaxRows: PAGE_SIZE,
      SkeepRows: page * PAGE_SIZE,
    }, { transactionTypes: 'deposit', status: ['success'] });
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
    if (page === MAX_SAYFA - 1) kirpildi = true;
  }
  const ids = [...new Set(rows.map((row) => row.userId).filter((id) => id !== null && id !== undefined && String(id).trim() !== ''))];
  return { ids, kirpildi };
}

function stateKey(dateKey: string, rule: AutoRule, playerId: number | string): string {
  return `${dateKey}:${rule.group}:${rule.key}:${playerId}`;
}

function cashNote(dateKey: string, rule: AutoRule): string {
  return `NB ertesi gun ${dateKey} ${rule.key}`.slice(0, 50);
}

async function cashAlreadyCredited(playerId: number | string, dateKey: string, note: string): Promise<boolean> {
  const bounds = istanbulDayBoundsUtc(dateKey);
  const response = await lynonCorrectionHistory({
    ClientId: playerId,
    FromCreatedDateLocal: bounds.from,
    ToCreatedDateLocal: bounds.to,
    MaxRows: 500,
    SkeepRows: 0,
  });
  const rows = Array.isArray(response?.Data?.Objects) ? response.Data.Objects : [];
  return rows.some((row: any) => String(row.note ?? '').trim() === note);
}

export type KuruKapi = { ad: string; gecti: boolean; aciklama: string };

export type KuruSonuc = {
  playerId: string;
  dateKey: string;
  kapilar: KuruKapi[];
  /** Tum kapilar gecerse bonus verilirdi. */
  verilirdi: boolean;
  /** Verilecek tutar (hesaplanabildiyse). */
  tutar: number | null;
};

/**
 * Ertesi gun bonusunu KURU calistirir: hicbir sey yazmaz, atama yapmaz.
 *
 * Zaman penceresi ve idempotency kayitlari KASITLI olarak atlanir — amac
 * "su anda calissaydi ne olurdu" sorusunu cevaplamak.
 */
export async function nextDayBonusKuruCalistir(
  playerId: string | number,
  now = new Date(),
  tenantKey = currentTenantKey(),
): Promise<KuruSonuc> {
  const dateKey = istanbulDateKey(now);
  const kapilar: KuruKapi[] = [];
  const ekle = (ad: string, gecti: boolean, aciklama: string) => {
    kapilar.push({ ad, gecti, aciklama });
    return gecti;
  };

  if (!ekle('Lynon baglantisi', isLynonConfigured(), isLynonConfigured() ? 'Yapilandirilmis' : 'Lynon yapilandirilmamis')) {
    return { playerId: String(playerId), dateKey, kapilar, verilirdi: false, tutar: null };
  }

  const rules = await getRules(tenantKey);
  const activeRules = automaticRules(rules);
  if (!ekle(
    'Otomatik kural',
    activeRules.length > 0,
    activeRules.length > 0
      ? `${activeRules.length} kural aktif: ${activeRules.map((r) => r.key).join(', ')}`
      : 'Hicbir kuralda isNextDayBonus + autoGrantNextDayAt0015 birlikte acik degil',
  )) {
    return { playerId: String(playerId), dateKey, kapilar, verilirdi: false, tutar: null };
  }

  const previousDateKey = previousIstanbulDateKey(now);
  const { ids: oncekiGunOyuncular } = await previousDayDepositorIds(previousDateKey);
  const listede = oncekiGunOyuncular.some((id: unknown) => String(id) === String(playerId));
  ekle(
    'Onceki gun yatirimi',
    listede,
    listede
      ? `${previousDateKey} tarihinde yatirimi var`
      : `${previousDateKey} tarihinde basarili yatirimi YOK (o gun ${oncekiGunOyuncular.length} oyuncu yatirim yapmis)`,
  );

  const catalog = await lynonBonusDefinitions();
  const catalogRows = Array.isArray(catalog.Result) ? catalog.Result : [];
  const campaignById = new Map<number, any>(
    catalogRows
      .filter((row: any) => Number.isInteger(Number(row.PartnerBonusId)) && Number(row.PartnerBonusId) > 0 && row.IsDeleted !== true && row.IsDisabled !== true)
      .map((row: any) => [Number(row.PartnerBonusId), row] as const)
  );

  let verilirdi = false;
  let tutar: number | null = null;

  for (const rule of activeRules) {
    const configuredType = String(rule.spec.type ?? 'partner').toLocaleLowerCase('tr-TR');
    const isCash = configuredType === 'cash' || configuredType === 'nakit';

    /**
     * KAMPANYA KIMLIGI YATIRIM TUTARINA BAGLI OLABILIR.
     *
     * Kural `partnerBonusRanges` tasiyorsa verilecek bonus, tutarin
     * dustugu kademeye gore secilir. Bu is eskiden `spec.partnerBonusId`
     * alanini DOGRUDAN okuyordu; aralik kullanan bir kuralda o alan bos
     * kalabildigi icin (panel, aralik girildiginde tek-ID alanini devre
     * disi birakiyor) her gece sessizce "kampanya bulunamadi" deyip
     * bonusu HIC vermiyordu.
     *
     * Hesap anlik goruntusu bu yuzden kampanya kapisindan ONCE aliniyor:
     * kademeyi secmek icin yatirim tabani gerekiyor. Taban `depositBasis`
     * — yani ertesi gun bonusunda DUNUN toplami, kayip bonusunda net
     * kayip; tutar hesabiyla ayni sayi.
     */
    const account = await lynonBuildBonusEligibilitySnapshot({ playerId, asOf: new Date(`${dateKey}T12:00:00+03:00`) });
    const yatirimTabani = depositBasis(account as any, rule.spec as any);
    const cozulenId = araligaGorePartnerBonusId(rule.spec as any, yatirimTabani);
    const campaignId = Number(cozulenId);
    const campaign = isCash ? null : campaignById.get(campaignId);
    const aralikOzeti = araliklariOzetle((rule.spec as any).partnerBonusRanges ?? []);

    if (!ekle(
      `[${rule.key}] Lynon kampanyasi`,
      isCash || Boolean(campaign),
      isCash
        ? 'Nakit bonus; kampanya gerekmiyor'
        : campaign
          ? `Aktif: ${campaign.Name ?? campaignId}${aralikOzeti ? ` (${yatirimTabani} TRY -> ${campaignId})` : ''}`
          : aralikOzeti
            ? `${yatirimTabani} TRY hicbir bonus araligina dusmuyor (${aralikOzeti})`
            : `PartnerBonusId ${rule.spec.partnerBonusId ?? 'eksik'} icin aktif kampanya YOK (silinmis/pasif olabilir)`,
    )) continue;
    const promoId = rule.group === 'id' && Number.isFinite(Number(rule.key)) ? Number(rule.key) : campaignId;
    const promoTitle = rule.group === 'title' ? rule.key : String(campaign?.Name ?? rule.key);
    const check = await evaluateForAccount(account as any, { id: promoId, title: promoTitle, kuralAnahtari: rule.key, ...rule.spec } as any, rules, tenantKey, 'bonus');

    const dusenler = check.items.filter((item) => !item.ok);
    ekle(
      `[${rule.key}] Uygunluk kurallari`,
      check.overallOk,
      check.overallOk ? 'Tum maddeler gecti' : dusenler.map((i) => i.reason || i.label).join(' | ').slice(0, 500),
    );

    const hesaplanan = Number(check.calculatedAmount ?? rule.spec.fixedAmount ?? 0);
    const tutarliBirDeger = Number.isFinite(hesaplanan) && hesaplanan > 0;
    /**
     * FREESPIN'DE TUTAR SIFIR OLABILIR.
     *
     * Burada kosulsuz "tutar > 0" araniyordu; gercek is ise nakit
     * disindaki kampanyalarda tutar sartı KOSMUYOR. Sonuc: freespin
     * kampanyalari icin kuru calistirma "verilmezdi" diyor ama is
     * veriyordu — teshis araci gercegin tam tersini soyluyordu.
     */
    const freespin = !isCash && freespinAtamasiVar(assignmentValuesForPromoSpec(rule.spec));
    const tutarGerekli = isCash || !freespin;
    ekle(
      `[${rule.key}] Tutar`,
      tutarliBirDeger || !tutarGerekli,
      tutarliBirDeger
        ? `${hesaplanan} TRY`
        : freespin
          ? 'Freespin atamasi; para tutari gerekmiyor'
          : 'Hesaplanan tutar 0 — barem/yuzde tanimi eksik olabilir',
    );

    if (check.overallOk && listede && (tutarliBirDeger || !tutarGerekli)) {
      verilirdi = true;
      tutar = tutarliBirDeger ? hesaplanan : null;
    }
  }

  return { playerId: String(playerId), dateKey, kapilar, verilirdi, tutar };
}

export async function runNextDayBonusJob(
  tenantKey = currentTenantKey(),
  now = new Date(),
): Promise<{
  skipped: boolean;
  dateKey: string;
  rules: number;
  players: number;
  granted: number;
  errors: number;
  /** Telafi edilen (bugun olmayan) bir gun islendiyse true. */
  telafi: boolean;
}> {
  const bugun = istanbulDateKey(now);
  const baseResult = { skipped: true, dateKey: bugun, rules: 0, players: 0, granted: 0, errors: 0, telafi: false };
  if (!isLynonConfigured()) return baseResult;

  const rules = await getRules(tenantKey);
  const activeRules = automaticRules(rules);
  if (!activeRules.length) return baseResult;

  const ayar = pencereAyari();
  const state = await loadState(tenantKey);
  const dateKey = bekleyenGun(state.gunler, now, ayar);
  if (!dateKey) return { ...baseResult, rules: activeRules.length };

  const telafi = dateKey !== bugun;
  const gun: GunDurumu = state.gunler[dateKey] ?? { durum: 'bekliyor', deneme: 0 };
  state.gunler[dateKey] = { ...gun, durum: 'bekliyor', deneme: gun.deneme + 1, sonDenemeAt: new Date().toISOString() };
  await saveState(tenantKey, state);

  if (telafi) {
    console.warn(`[next-day-bonus] ${tenantKey}: ${dateKey} gunu tamamlanmamis, telafi ediliyor (deneme ${gun.deneme + 1}/${ayar.maxDeneme}).`);
  }

  const previousDateKey = previousIstanbulDateKey(`${dateKey}T12:00:00+03:00`);
  const { ids: playerIds, kirpildi } = await previousDayDepositorIds(previousDateKey);
  if (kirpildi) {
    console.warn(
      `[next-day-bonus] ${tenantKey}: ${previousDateKey} yatirim listesi ${MAX_SAYFA * PAGE_SIZE} islemde kirpildi; ` +
      'bazi oyuncular atlanmis olabilir. ERTESI_GUN_MAX_SAYFA degerini yukseltin.',
    );
  }

  const catalogResponse = await lynonBonusDefinitions();
  const catalogRows = Array.isArray(catalogResponse.Result) ? catalogResponse.Result : [];
  const campaignById = new Map(
    catalogRows
      .filter((row: any) => Number.isInteger(Number(row.PartnerBonusId)) && Number(row.PartnerBonusId) > 0 && row.IsDeleted !== true && row.IsDisabled !== true)
      .map((row: any) => [Number(row.PartnerBonusId), row] as const)
  );

  let granted = 0;
  let errors = 0;
  let hasRetryableError = false;

  for (const playerId of playerIds) {
    for (const rule of activeRules) {
      const key = stateKey(dateKey, rule, playerId);
      const existing = state.records[key];
      if (existing && existing.status !== 'error') continue;

      /**
       * SUREÇLER ARASI TALEP — bkz. `lib/odulKilidi.ts` · `dagitikKilitle`.
       *
       * Yukarıdaki `state.records[key]` kontrolü SÜREÇ İÇİ bellekte;
       * ikinci bir Railway kopyası (ya da bir dağıtım sırasında bir süre
       * birlikte ayakta kalan eski+yeni süreç) aynı anahtar için kendi
       * hafızasında da "henüz verilmemiş" görüp AYNI bonusu tekrar
       * Lynon'a yazdırabilir — tam olarak sahada gözlemlenen "aynı
       * oyuncuya aynı bonus 10 kez" hatası. `dagitikKilitle`, Postgres'te
       * atomik bir talep satırıyla bunu ikinci bir süreç için de kapatır.
       *
       * Talep başka bir süreçte alınmışsa (`calisti: false`) KENDİ
       * KAYDIMIZI YAZMIYORUZ — o anahtarı gerçekten işleyen süreç kendi
       * sonucunu birazdan yazacak; burada yazarsak onun sonucunu ezeriz.
       */
      const talep = await dagitikKilitle(tenantKey, odulAnahtari(String(playerId), 'ertesi-gun', key), async () => {
        try {
          const account = await lynonBuildBonusEligibilitySnapshot({ playerId, asOf: new Date(`${dateKey}T12:00:00+03:00`) });
          const configuredType = String(rule.spec.type ?? 'partner').toLocaleLowerCase('tr-TR');
          const isCash = configuredType === 'cash' || configuredType === 'nakit';
          // Kuru koşumla AYNI çözümleme: kademe, yatırım tabanına göre.
          const cozulenId = araligaGorePartnerBonusId(rule.spec as any, depositBasis(account as any, rule.spec as any));
          const campaignId = Number(cozulenId);
          const campaign = isCash ? null : campaignById.get(campaignId);
          if (!isCash && !campaign) {
            const aralikOzeti = araliklariOzetle((rule.spec as any).partnerBonusRanges ?? []);
            throw new Error(aralikOzeti
              ? `Aktif Lynon kampanyası bulunamadı: ${depositBasis(account as any, rule.spec as any)} TRY için çözülen ID ${cozulenId ?? 'yok'} (${aralikOzeti})`
              : `Aktif Lynon kampanyası bulunamadı: ${rule.spec.partnerBonusId ?? 'eksik'}`);
          }

          const promoId = rule.group === 'id' && Number.isFinite(Number(rule.key)) ? Number(rule.key) : campaignId;
          const promoTitle = rule.group === 'title' ? rule.key : String(campaign?.Name ?? rule.key);
          const check = await evaluateForAccount(account as any, { id: promoId, title: promoTitle, kuralAnahtari: rule.key, ...rule.spec } as any, rules, tenantKey, 'bonus');
          if (!check.overallOk) {
            state.records[key] = {
              status: 'ineligible',
              at: new Date().toISOString(),
              message: check.items.filter((item) => !item.ok).map((item) => item.reason || item.label).join(' | ').slice(0, 500),
            };
            await saveState(tenantKey, state);
            return;
          }

          if (!isCash) {
            const alreadyAssigned = Array.isArray((account as any).bonuses) && (account as any).bonuses.some((bonus: any) =>
              Number(bonus.Id) === campaignId && istanbulDateKey(String(bonus.CreatedLocal ?? '')) === dateKey
            );
            if (alreadyAssigned) {
              state.records[key] = { status: 'already-granted', at: new Date().toISOString(), message: 'Lynon kampanyası bugün zaten atanmış.' };
              await saveState(tenantKey, state);
              return;
            }

            const calculatedAmount = Number(check.calculatedAmount ?? 0);
            const configuredAssignmentValues = assignmentValuesForPromoSpec(rule.spec);
            /**
             * FREESPIN ATAMASINA PARA TUTARI EKLENMEZ.
             *
             * Hesaplanan tutar sifirdan buyukse `BonusMoneyAmount` kosulsuz
             * ekleniyordu. Kayip yuzdesine bagli bir freespin kuralinda bu,
             * BetLevel/RoundCount/Game ile birlikte bir de para tutari
             * gonderilmesi demekti; Lynon boyle bir atamayi reddediyor ve
             * oyuncu freespin'i hic alamiyordu.
             */
            const freespin = freespinAtamasiVar(configuredAssignmentValues);
            const assignmentValues = {
              ...configuredAssignmentValues,
              ...(!freespin && calculatedAmount > 0 && configuredAssignmentValues.BonusMoneyAmount == null
                ? { BonusMoneyAmount: calculatedAmount }
                : {}),
            };
            await lynonAssignCampaignToPlayer({
              campaignId,
              playerId,
              assignmentReason: atamaNotu({
                onek: `Ertesi gün otomasyonu ${previousDateKey}`,
                kaynak: 'otomasyon',
                kuralAnahtari: rule.key,
                baslik: rule.spec?.title,
                tutar: calculatedAmount,
              }),
              assignmentValues,
            });
            audit('sistem', 'job', 'lynon_campaign_assignment', String(playerId), bonusDenetimAciklamasi({
              tur: 'kampanya',
              kaynak: `ertesi gün otomasyonu ${previousDateKey}`,
              baslik: rule.spec?.title,
              kuralAnahtari: rule.key,
              kampanyaId: campaignId,
              tutar: calculatedAmount,
              tutarKaynagi: 'kural',
              sonuc: 'basarili',
            }));
          } else {
            const amount = Number(check.calculatedAmount ?? rule.spec.fixedAmount ?? 0);
            if (!Number.isFinite(amount) || amount <= 0) throw new Error('Otomatik nakit bonus tutarı pozitif değil.');
            const note = cashNote(dateKey, rule);
            if (await cashAlreadyCredited(playerId, dateKey, note)) {
              state.records[key] = { status: 'already-granted', at: new Date().toISOString(), message: 'Crediting düzeltmesi bugün zaten işlendi.' };
              await saveState(tenantKey, state);
              return;
            }
            await lynonAdjustPlayerMainAccount({ playerId, amount, correctionType: 'crediting', note });
            audit('sistem', 'job', 'bonus_charge_as_cash', String(playerId), bonusDenetimAciklamasi({
              tur: 'nakit',
              kaynak: `ertesi gün otomasyonu ${previousDateKey}`,
              baslik: rule.spec?.title,
              kuralAnahtari: rule.key,
              tutar: amount,
              tutarKaynagi: 'kural',
              sonuc: 'basarili',
              mesaj: note,
            }));
          }

          granted += 1;
          state.records[key] = { status: 'granted', at: new Date().toISOString() };
          await saveState(tenantKey, state);
        } catch (error) {
          errors += 1;
          hasRetryableError = true;
          state.records[key] = { status: 'error', at: new Date().toISOString(), message: (error instanceof Error ? error.message : String(error)).slice(0, 500) };
          await saveState(tenantKey, state);
        }
      });

      if (!talep.calisti) {
        console.warn(`[next-day-bonus] ${tenantKey}: ${key} başka bir süreçte işleniyor, atlandı.`);
      }
      await sleep(BETWEEN_PLAYERS_MS);
    }
  }

  if (!hasRetryableError) {
    state.gunler[dateKey] = { ...state.gunler[dateKey], durum: 'done' };
    state.completedDates = [...new Set([...state.completedDates, dateKey])].slice(-45);
    // Bellek sinirsiz buyumesin: telafi penceresi disindaki gunlerin
    // kayitlari artik hicbir karari etkilemiyor.
    const koru = new Set(Array.from({ length: ayar.telafiGun + 2 }, (_, i) => gunEkle(bugun, -i)));
    for (const gunAnahtari of Object.keys(state.gunler)) {
      if (!koru.has(gunAnahtari) && state.gunler[gunAnahtari]?.durum === 'done') delete state.gunler[gunAnahtari];
    }
    for (const kayitAnahtari of Object.keys(state.records)) {
      if (!koru.has(kayitAnahtari.split(':')[0] ?? '')) delete state.records[kayitAnahtari];
    }
    await saveState(tenantKey, state);
  }

  return { skipped: false, dateKey, rules: activeRules.length, players: playerIds.length, granted, errors, telafi };
}
