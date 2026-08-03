/**
 * Tum bonus raporu — bonus OTURUMLARINDAN.
 *
 * ── Neden degisti ─────────────────────────────────────────────────────
 *
 * `#/tum-bonus-raporu` ekrani `Report By Bonus` (1844) OZET raporunu
 * okuyordu. O rapor bonus turune gore toplamlar donduruyor; satirlarda
 * hangi oyuncunun hangi bonusu ne zaman aldigi YOK. Ekranda "Oyuncu"
 * sutunu vardi ama doldurulamiyordu.
 *
 * Kaynak artik:
 *
 *   GET /api/bonusenginev2/api/v1/Report/bonusSessions/site/{siteId}
 *
 * Bu uc her BONUS VERILISINI ayri satir olarak doner: playerId,
 * bonusName, campaignId, payout, assignedDate, claimedDate, status ve
 * — panelin kendi yazdigi — `assignmentReason` notu.
 *
 * ── Kullanici adi ─────────────────────────────────────────────────────
 *
 * Uc yalnizca `playerId` veriyor. Ad, oyuncu genel bakis raporundan
 * gelen kimlik→ad eslemesiyle birlestirilir. Esleme bulunamazsa ad
 * UYDURULMAZ: `ClientLogin` bos kalir ve ekran kimligi gosterir. Eksik
 * adi kimlikle doldurmak, "2501238" adinda bir oyuncu varmis gibi
 * gorunmesine yol aciyordu.
 *
 * ── Durum kodu ────────────────────────────────────────────────────────
 *
 * `status` sayisal geliyor ve Lynon bu kodlarin sozlugunu
 * yayinlamiyor. Bilinmeyen kod "Durum 7" olarak gosterilir; tahmin
 * edilmis bir etiketle degil. Yanlis etiket, olmayan bir bilgiyi varmis
 * gibi gosterir.
 */
import { istanbulDateKey } from '../lib/istanbulGunu.js';

type AnyRecord = Record<string, any>;

export type BonusOturumu = {
  playerId?: unknown;
  campaignId?: unknown;
  templateName?: unknown;
  bonusId?: unknown;
  bonusName?: unknown;
  campaignAssignmentId?: unknown;
  instantBonusAssignmentId?: unknown;
  bonusSessionId?: unknown;
  claimedCurrency?: unknown;
  payout?: unknown;
  assignedDate?: unknown;
  claimedDate?: unknown;
  status?: unknown;
  assignmentReason?: unknown;
  categoryId?: unknown;
  categoryName?: unknown;
};

/** Kimlik → oyuncu bilgisi. Bulunamayan kimlik icin kayit olmamali. */
export type OyuncuAdlari = Map<string, { login?: string | null; adSoyad?: string | null }>;

/**
 * Gozlemlenmis durum kodlari.
 *
 * Yalnizca gercek yanitlarda gorulup dogrulanabilenler burada. Liste
 * bilerek kisa: eksik bir kodun "Durum 4" gorunmesi, yanlis bir kodun
 * "Tamamlandi" gorunmesinden iyidir.
 */
const DURUM_ADLARI: Record<string, string> = {
  '0': 'Atandı',
  '1': 'Talep edildi',
};

export function oturumDurumu(status: unknown): string {
  if (status === null || status === undefined || status === '') return 'Bilinmiyor';
  const anahtar = String(status).trim();
  if (DURUM_ADLARI[anahtar]) return DURUM_ADLARI[anahtar];
  // Metin geldiyse oldugu gibi goster; sayiysa kodu belli et.
  return /^\d+$/.test(anahtar) ? `Durum ${anahtar}` : anahtar;
}

function sayi(deger: unknown): number {
  if (deger === null || deger === undefined || deger === '') return 0;
  const n = Number(String(deger).replace(/[^\d.,+-]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function metin(deger: unknown): string {
  return String(deger ?? '').trim();
}

/**
 * Bir oturumu ekran satirina cevirir.
 *
 * Alan adlari eski `ClientBonusReportData` sozlesmesini korur; ekran
 * bileseni degismeden calisir.
 */
export function bonusOturumSatiri(oturum: BonusOturumu, adlar?: OyuncuAdlari, sira = 0): AnyRecord {
  const playerId = metin(oturum.playerId);
  const oyuncu = adlar?.get(playerId);
  const odeme = sayi(oturum.payout);
  const bonusAdi = metin(oturum.bonusName) || metin(oturum.templateName) || 'Bonus';

  return {
    Id: sayi(oturum.bonusSessionId) || sira + 1,
    ClientId: sayi(playerId),
    // Ad bulunamadiysa BOS kalir; kimlik ada terfi ettirilmez.
    ClientLogin: oyuncu?.login ?? '',
    ClientName: oyuncu?.adSoyad ?? oyuncu?.login ?? '',
    Name: bonusAdi,
    /** Kampanya sablonu bonus adindan farkli olabiliyor; ikisi de tasinir. */
    TemplateName: metin(oturum.templateName),
    Description: metin(oturum.assignmentReason),
    CampaignId: sayi(oturum.campaignId) || null,
    BonusId: sayi(oturum.bonusId) || null,
    AssignmentId: sayi(oturum.campaignAssignmentId) || null,
    BonusSessionId: sayi(oturum.bonusSessionId) || null,
    /**
     * `payout` bonusun ODENEN tutari. Verilen tutar bu uctan gelmiyor;
     * `Amount` alanina odemeyi yazip "verilen" demek eski raporun
     * hatasiydi. Ikisi ayri tutulur, verilen bilinmiyorsa null.
     */
    Amount: null,
    TotalPaidAmount: odeme,
    WinAmount: odeme,
    Durum: oturumDurumu(oturum.status),
    DurumKodu: oturum.status ?? null,
    Kategori: metin(oturum.categoryName) || null,
    CreatedLocal: oturum.assignedDate ?? null,
    AcceptanceDateLocal: oturum.claimedDate ?? null,
    ClientCurrency: metin(oturum.claimedCurrency) || null,
    CreatedByUserName: 'Lynon Bonus Engine',
  };
}

/** Turkiye gunune gore aralik suzgeci. Tarihi cozulemeyen satir DUSER. */
export function tarihAraligindakiOturumlar(
  oturumlar: BonusOturumu[],
  aralik: { startDate?: string | null; endDate?: string | null },
): BonusOturumu[] {
  const { startDate, endDate } = aralik;
  if (!startDate && !endDate) return [...(oturumlar ?? [])];
  return (oturumlar ?? []).filter((oturum) => {
    const gun = istanbulDateKey(String(oturum?.assignedDate ?? ''));
    if (!gun) return false;
    if (startDate && gun < startDate) return false;
    if (endDate && gun > endDate) return false;
    return true;
  });
}

export type BonusOzetSatiri = {
  ad: string;
  adet: number;
  odenen: number;
  oyuncuSayisi: number;
};

/** Bonus adina gore ozet — ekrandaki "en cok alinan" kartlari icin. */
export function bonusOzeti(satirlar: AnyRecord[]): BonusOzetSatiri[] {
  const kova = new Map<string, { adet: number; odenen: number; oyuncular: Set<string> }>();
  for (const satir of satirlar ?? []) {
    const ad = metin(satir?.Name) || 'Bonus';
    const mevcut = kova.get(ad) ?? { adet: 0, odenen: 0, oyuncular: new Set<string>() };
    mevcut.adet += 1;
    mevcut.odenen += sayi(satir?.TotalPaidAmount);
    const kimlik = metin(satir?.ClientId);
    if (kimlik && kimlik !== '0') mevcut.oyuncular.add(kimlik);
    kova.set(ad, mevcut);
  }
  return [...kova.entries()]
    .map(([ad, v]) => ({ ad, adet: v.adet, odenen: v.odenen, oyuncuSayisi: v.oyuncular.size }))
    .sort((a, b) => b.adet - a.adet);
}

/**
 * AYNI OYUNCU, AYNI BONUS — kac kez?
 *
 * "Bu uye nasil bir suru 100 FS Telegram bonusu almis?" sorusunun
 * cevabini raporun kendisinde gormek icin. Panelin bir yerinde bu
 * sayilmadigi surece mukerrer verilis ancak sikayet gelince fark
 * ediliyor.
 */
export function mukerrerVerilisler(
  satirlar: AnyRecord[],
  enAz = 2,
): Array<{ clientId: number; clientLogin: string; bonusAdi: string; adet: number; sonVerilis: string | null }> {
  const kova = new Map<string, { clientId: number; clientLogin: string; bonusAdi: string; adet: number; sonVerilis: string | null }>();
  for (const satir of satirlar ?? []) {
    const clientId = sayi(satir?.ClientId);
    const bonusAdi = metin(satir?.Name) || 'Bonus';
    if (!clientId) continue;
    const anahtar = `${clientId}|${bonusAdi}`;
    const mevcut = kova.get(anahtar) ?? {
      clientId,
      clientLogin: metin(satir?.ClientLogin),
      bonusAdi,
      adet: 0,
      sonVerilis: null as string | null,
    };
    mevcut.adet += 1;
    const tarih = metin(satir?.CreatedLocal);
    if (tarih && (!mevcut.sonVerilis || tarih > mevcut.sonVerilis)) mevcut.sonVerilis = tarih;
    if (!mevcut.clientLogin) mevcut.clientLogin = metin(satir?.ClientLogin);
    kova.set(anahtar, mevcut);
  }
  return [...kova.values()].filter((v) => v.adet >= enAz).sort((a, b) => b.adet - a.adet);
}
