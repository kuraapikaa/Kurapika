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
} from './lynonBackofficeService.js';
import { istanbulDateKey } from '../lib/istanbulGunu.js';
import {
  gunlukCekimSayisi,
  otomatikRedKarari,
  sonYatirimdanSonrakiBonuslar,
  type CekimBaglami,
  type OyuncuNotu,
} from './cekimDegerlendirmesi.js';

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

  const kpi = kpiSonuc.status === 'fulfilled'
    ? ((kpiSonuc.value as AnyRecord)?.Data?.[0] ?? {})
    : {};
  const notlar: OyuncuNotu[] = notSonuc.status === 'fulfilled' ? (notSonuc.value as OyuncuNotu[]) : [];
  // Bonus gecmisi ALINAMADIYSA "yok" degil "olculemedi".
  const bonusOlculdu = bonusSonuc.status === 'fulfilled';
  const bonuslar: AnyRecord[] = bonusOlculdu
    ? ((bonusSonuc.value as AnyRecord)?.Data ?? [])
    : [];

  const sonYatirimZamani = (kpi.LastDepositDate ?? kpi.LastDepositLocalDate ?? null) as string | null;
  const sonYatirimBonuslari = sonYatirimdanSonrakiBonuslar(bonuslar, sonYatirimZamani).map((bonus) => ({
    ad: String(bonus?.Name ?? 'Bonus'),
    tutar: nullableSayi(bonus?.Amount ?? bonus?.TotalPaidAmount),
  }));

  return {
    playerId,
    login: String(cekim?.ClientLogin ?? kpi.ClientLogin ?? ''),
    tutar: Number(cekim?.Amount ?? 0),
    paraBirimi: String(cekim?.CurrencyId ?? cekim?.currency ?? 'TRY'),
    gunlukCekim,
    netKarZarar: nullableSayi(kpi.ProfitAndLose),
    toplamYatirim: nullableSayi(kpi.DepositAmount),
    toplamCekim: nullableSayi(kpi.WithdrawalAmount),
    bakiye: nullableSayi(kpi.Balance),
    sonYatirimTutari: nullableSayi(kpi.LastDepositAmount),
    sonYatirimZamani,
    sonCekimZamani: (kpi.LastWithdrawalDate ?? null) as string | null,
    sonYatirimBonuslari,
    bonusOlculdu,
    notlar,
    otomatikRed: otomatikRedKarari(gunlukCekim),
  };
}
