/**
 * Bonus atama notu.
 *
 * ── Neden ─────────────────────────────────────────────────────────────
 *
 * Lynon'a giden `assignmentReason` bugune kadar uc sabit metinden biriydi:
 *
 *   "Narcosbahis panel talebi / destek1"
 *   "Narcosbahis oyun ödülü: 50 TL"
 *   "Ertesi gün otomasyonu 2026-07-31"
 *
 * Bir oyuncunun ayni bonusu defalarca aldigi bildirildiginde bu notlarla
 * HANGI kuralin, HANGI yatirima karsilik, NE tutarla islendigi
 * anlasilamiyor; her vaka icin kodu okumak gerekiyor.
 *
 * Bu modul notu tek bicimde uretir. Bicim hem operatorun okuyabilecegi
 * hem de geri ayristirilabilir olacak sekilde secildi.
 *
 *   Narcosbahis | Kural: kayip-bonusu | Talep: destek1 | Yatırım: #98123
 *   (1.000 TRY) | Tutar: 250 TRY | 02.08.2026 03:14
 *
 * `nottanYatirimKimligi` bu bicimden yatirim kimligini geri okur;
 * mukerrer kontrolu tarih karsilastirmasi yerine kimlige dayanabilsin
 * diye. Bicim degistirilirse o okuma kor kalir.
 */

/** Lynon tarafinda asiri uzun not reddedilebiliyor; guvenli tavan. */
const AZAMI_UZUNLUK = 200;

export type AtamaNotuGirdisi = {
  /** Kural anahtari (PROMO_SPECS anahtari) ya da kampanya kimligi. */
  kuralAnahtari?: unknown;
  /** Kuralin okunabilir basligi. */
  baslik?: unknown;
  /** Talebi yapan panel kullanicisi ya da otomasyon adi. */
  talepEden?: unknown;
  /** Hakkin baglandigi yatirim kimligi. */
  yatirimId?: unknown;
  /** Yatirim tutari. */
  yatirimTutari?: unknown;
  /** Verilen bonus tutari. */
  tutar?: unknown;
  /** Kaynak yol: 'panel' | 'oyun' | 'otomasyon'. */
  kaynak?: unknown;
  /**
   * Notun basina konacak sabit metin.
   *
   * Oyun odulleri icin GEREKLI: `oyunHakkiGecmisi.oyunOduluMu`
   * "Narcosbahis oyun ödülü" onekini ariyor, geriye donuk eslestirme
   * buna dayaniyor. Onek degistirilirse o eslestirme kor kalir.
   */
  onek?: unknown;
};

function metin(value: unknown): string {
  return String(value ?? '').trim();
}

function sayi(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function tutarYaz(value: unknown): string | null {
  const n = sayi(value);
  return n == null ? null : `${n.toLocaleString('tr-TR')} TRY`;
}

/**
 * Atama notunu olusturur.
 *
 * Bos alanlar tamamen atlanir — "Yatırım: -" gibi bilgi tasimayan
 * parcalar notu uzatip okunurlugu dusuruyor.
 */
export function atamaNotu(girdi: AtamaNotuGirdisi, simdi: Date = new Date()): string {
  const onek = metin(girdi.onek);
  const parcalar: string[] = [onek || 'Narcosbahis'];

  const kaynak = metin(girdi.kaynak);
  if (kaynak) parcalar.push(`Kaynak: ${kaynak}`);

  const anahtar = metin(girdi.kuralAnahtari);
  const baslik = metin(girdi.baslik);
  if (anahtar && baslik && baslik !== anahtar) parcalar.push(`Kural: ${anahtar} (${baslik})`);
  else if (anahtar) parcalar.push(`Kural: ${anahtar}`);
  else if (baslik) parcalar.push(`Kural: ${baslik}`);

  const talepEden = metin(girdi.talepEden);
  if (talepEden) parcalar.push(`Talep: ${talepEden}`);

  const yatirimId = metin(girdi.yatirimId);
  if (yatirimId) {
    const yatirimTutari = tutarYaz(girdi.yatirimTutari);
    parcalar.push(yatirimTutari ? `Yatırım: #${yatirimId} (${yatirimTutari})` : `Yatırım: #${yatirimId}`);
  }

  const tutar = tutarYaz(girdi.tutar);
  if (tutar) parcalar.push(`Tutar: ${tutar}`);

  parcalar.push(
    simdi.toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  );

  return parcalar.join(' | ').slice(0, AZAMI_UZUNLUK);
}

/**
 * Nottan yatirim kimligini geri okur.
 *
 * Yalnizca bu modulun yazdigi bicimi tanir; elle girilmis notlardan
 * kimlik uydurmaz.
 */
export function nottanYatirimKimligi(not: unknown): string | null {
  const eslesme = /Yatırım:\s*#([^\s|()]+)/.exec(String(not ?? ''));
  return eslesme ? eslesme[1] : null;
}

/** Nottan kural anahtarini geri okur. */
export function nottanKural(not: unknown): string | null {
  const eslesme = /Kural:\s*([^|(]+)/.exec(String(not ?? ''));
  const deger = eslesme ? eslesme[1].trim() : '';
  return deger === '' ? null : deger;
}

/** Nottan kaynak yolunu geri okur ("Kaynak: telegram" -> "telegram"). */
export function nottanKaynak(not: unknown): string | null {
  const eslesme = /Kaynak:\s*([^|]+)/.exec(String(not ?? ''));
  const deger = eslesme ? eslesme[1].trim() : '';
  return deger === '' ? null : deger;
}

/** Nottan talebi yapan panel kullanicisini/otomasyonu geri okur. */
export function nottanTalep(not: unknown): string | null {
  const eslesme = /Talep:\s*([^|]+)/.exec(String(not ?? ''));
  const deger = eslesme ? eslesme[1].trim() : '';
  return deger === '' ? null : deger;
}
