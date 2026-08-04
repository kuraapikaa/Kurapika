/**
 * Cekim bildirimi icin baglam toplama.
 *
 * Karar mantigi `cekimDegerlendirmesi` icinde ve testli; burasi
 * yalnizca uclardan veri cekip o modulun bekledigi sekle sokuyor.
 *
 * ── Eksik veri gizlenmez ──────────────────────────────────────────────
 *
 * Her uc ayri ayri `Promise.allSettled` ile cagriliyor: biri dustugu
 * icin cekim bildirimi HIC gitmemeli. Alinamayan olcu `null` kalir ve
 * mesajda "—" gorunur; sifir yazmak operatore yanlis karar verdirir.
 */
import {
  lynonOyuncuNotlari,
  lynonPlayerKpi,
  lynonWithdrawalRequests,
  lynonClientBonuses,
  lynonCasinoOperations,
  lynonSportBets,
} from './lynonBackofficeService.js';
import { istanbulDateKey } from '../lib/istanbulGunu.js';
import {
  gunlukCekimSayisi,
  otomatikRedKarari,
  sonYatirimdanSonrakiBonuslar,
  casinoCevrimToplami,
  sporCevrimToplami,
  sonKullanilanBonusSec,
  enCokOynananOyunlar as enCokOynananOyunlarSec,
  type CekimBaglami,
  type OyuncuNotu,
} from './cekimDegerlendirmesi.js';
import { bonusKaynakliKazanc, oyuncuPanosu, yatirimsizBakiyeMi } from './oyuncuPanoVerisi.js';

type AnyRecord = Record<string, any>;

function nullableSayi(deger: unknown): number | null {
  if (deger === null || deger === undefined || deger === '') return null;
  const n = Number(deger);
  return Number.isFinite(n) ? n : null;
}

/**
 * Bir cekim talebi icin karar baglami.
 *
 * @param cekim       Bildirilen cekim satiri (mapTransaction ciktisi).
 * @param gunlukCekimler Ayni gunun cekim listesi; sayim icin.
 */
export async function cekimBaglamiTopla(
  cekim: AnyRecord,
  gunlukCekimler?: AnyRecord[],
): Promise<CekimBaglami> {
  const playerId = Number(cekim?.ClientId ?? cekim?.userId ?? 0);
  const gun = istanbulDateKey(String(cekim?.CreatedLocal ?? cekim?.createdAt ?? '')) || istanbulDateKey(new Date());

  // Gunluk liste verilmediyse cekilir; verildiyse tekrar istek atilmaz.
  let liste = gunlukCekimler;
  if (!liste) {
    const yanit = await lynonWithdrawalRequests({ startDate: gun, endDate: gun, MaxRows: 300 })
      .catch(() => null);
    liste = (yanit as AnyRecord | null)?.Data?.ClientRequests ?? [];
  }
  const gunlukCekim = gunlukCekimSayisi(liste, playerId, gun);

  const [kpiSonuc, notSonuc, bonusSonuc] = await Promise.allSettled([
    lynonPlayerKpi(playerId),
    lynonOyuncuNotlari(playerId),
    lynonClientBonuses({ ClientId: playerId }),
  ]);

  /**
   * KPI govdesi IKI SEKILDE gelebiliyor.
   *
   * `lynonPlayerKpi` dogrudan uctan okuyabildiginde `Data` bir NESNE
   * doner; rapor tablosuna dustugunde bazi cagirilar DIZI donduruyor.
   * Ilk surumde yalnizca `Data[0]` okunuyordu ve asil yol nesne oldugu
   * icin butun KPI alanlari bos kaliyordu: cekim mesajinda bakiye,
   * yatirim, kar/zarar hepsi "—" gorunurdu.
   */
  const kpiGovde = kpiSonuc.status === 'fulfilled' ? (kpiSonuc.value as AnyRecord)?.Data : null;
  const kpi: AnyRecord = Array.isArray(kpiGovde) ? (kpiGovde[0] ?? {}) : (kpiGovde ?? {});
  const notlar: OyuncuNotu[] = notSonuc.status === 'fulfilled' ? (notSonuc.value as OyuncuNotu[]) : [];
  // Bonus gecmisi ALINAMADIYSA "yok" degil "olculemedi".
  const bonusOlculdu = bonusSonuc.status === 'fulfilled';
  const bonuslar: AnyRecord[] = bonusOlculdu
    ? ((bonusSonuc.value as AnyRecord)?.Data ?? [])
    : [];

  /**
   * OYUNCU PANO UCU asil kaynak.
   *
   * `lynonPlayerKpi` bu ucu okuyup ham govdeyi `rawKpi` icinde tasiyor.
   * Eslenmis alanlar casino/spor ve gercek/bonus ayrimini kaybediyor;
   * cekim degerlendirmesinde asil lazim olan tam o ayrimlar. Ham govde
   * varsa ondan okunur, yoksa eslenmis alanlara duser.
   */
  const pano = oyuncuPanosu((kpi.rawKpi ?? null) as AnyRecord | null);
  const hamVar = Boolean(kpi.rawKpi);

  const sonYatirimZamani = (pano.sonYatirimTarihi
    ?? kpi.LastDepositTime
    ?? kpi.LastDepositDate
    ?? null) as string | null;
  const sonYatirimBonuslari = sonYatirimdanSonrakiBonuslar(bonuslar, sonYatirimZamani).map((bonus) => ({
    ad: String(bonus?.Name ?? 'Bonus'),
    tutar: nullableSayi(bonus?.Amount ?? bonus?.TotalPaidAmount),
  }));

  const toplamYatirim = hamVar ? pano.toplamYatirim : nullableSayi(kpi.DepositAmount);
  const toplamCekim = hamVar ? pano.toplamCekim : nullableSayi(kpi.WithdrawalAmount);

  /**
   * Son yatirimdan sonraki cevrim — YALNIZCA son yatirim zamani biliniyorsa
   * hesaplanir. Bilinmiyorsa "cevrim yok" degil "olculemedi" anlamina
   * gelmeli; bu yuzden null birakilir, 0 yazilmaz.
   */
  let casinoCevrimSonYatirim: number | null = null;
  let sporCevrimSonYatirim: number | null = null;
  let enCokOynananOyunlar: ReturnType<typeof enCokOynananOyunlarSec> = [];
  if (sonYatirimZamani) {
    const [casinoSonuc, sportSonuc] = await Promise.allSettled([
      lynonCasinoOperations({ userId: playerId, startDate: sonYatirimZamani, countPerPage: 500 }),
      lynonSportBets({ userId: playerId, startDate: sonYatirimZamani, countPerPage: 500 }),
    ]);
    if (casinoSonuc.status === 'fulfilled') {
      casinoCevrimSonYatirim = casinoCevrimToplami(casinoSonuc.value);
      enCokOynananOyunlar = enCokOynananOyunlarSec(casinoSonuc.value);
    }
    if (sportSonuc.status === 'fulfilled') sporCevrimSonYatirim = sporCevrimToplami(sportSonuc.value);
  }

  return {
    playerId,
    login: String(cekim?.ClientLogin ?? kpi.Login ?? ''),
    tutar: Number(cekim?.Amount ?? 0),
    paraBirimi: String(cekim?.CurrencyId ?? cekim?.currency ?? pano.paraBirimi ?? 'TRY'),
    yontem: [cekim?.method ?? cekim?.PaymentSystemName, cekim?.integration].filter(Boolean).join(' · ') || null,
    gunlukCekim,
    /**
     * Kasa acisindan kar/zarar = yatirim - cekim. Ikisinden biri
     * olculemediyse HESAPLANMAZ; eksik veriyle "oyuncu onde" demek
     * cekim kararini yanlis yone iter.
     */
    netKarZarar: toplamYatirim === null || toplamCekim === null
      ? nullableSayi(kpi.ProfitAndLose)
      : toplamYatirim - toplamCekim,
    toplamYatirim,
    toplamCekim,
    bakiye: hamVar ? (pano.gercekBakiye ?? pano.toplamBakiye) : nullableSayi(kpi.Balance),
    sonYatirimTutari: hamVar ? pano.sonYatirimTutari : nullableSayi(kpi.LastDepositAmount),
    sonYatirimZamani,
    sonCekimZamani: (pano.sonCekimTarihi ?? kpi.LastWithdrawalTime ?? null) as string | null,
    sonYatirimBonuslari,
    bonusOlculdu,
    notlar,
    otomatikRed: otomatikRedKarari(gunlukCekim),

    kayitTarihi: (kpi.RegistrationDate ?? null) as string | null,
    // Dogrulama bayraklari UC DURUMLU: alan hic gelmediyse "bilinmiyor".
    // `=== true` ile daraltmak, okunamayan alani "dogrulanmamis"
    // gosterip yanlis uyari uretirdi.
    telefonDogrulandi: typeof kpi.IsPhoneVerified === 'boolean' ? kpi.IsPhoneVerified : null,
    epostaDogrulandi: typeof kpi.IsEmailVerified === 'boolean' ? kpi.IsEmailVerified : null,
    kimlikDogrulandi: typeof kpi.IsIdentityVerified === 'boolean' ? kpi.IsIdentityVerified : null,
    kategori: (kpi.CategoryName ?? null) as string | null,

    yatirimAdedi: hamVar ? pano.yatirimAdedi : nullableSayi(kpi.DepositCount),
    cekimAdedi: hamVar ? pano.cekimAdedi : nullableSayi(kpi.WithdrawalCount),
    bonusBakiye: hamVar ? pano.bonusBakiye : nullableSayi(kpi.BonusBalance),
    casinoBahis: pano.casinoBahis,
    casinoGgr: pano.casinoGgr,
    sporBahis: pano.sporBahis,
    sporGgr: pano.sporGgr,
    bonusKaynakliKazanc: bonusKaynakliKazanc(pano),
    yatirimsizBakiye: hamVar && yatirimsizBakiyeMi(pano),
    casinoCevrimSonYatirim,
    sporCevrimSonYatirim,
    sonKullanilanBonus: bonusOlculdu ? sonKullanilanBonusSec(bonuslar) : null,
    enCokOynananOyunlar,
  };
}
