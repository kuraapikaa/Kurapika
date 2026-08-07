import { istanbulDateKey } from '../lib/istanbulGunu.js';

/**
 * ERTESI GUN DAGITIMININ ZAMANLAMA KARARI.
 *
 * Bilerek saf: disariya hicbir cagri yok, hicbir sey yazmiyor. Dagitimin
 * "ne zaman calisir, ne zaman telafi eder, ne zaman vazgecer" karari bu
 * isin en kritik ve en zor gozlemlenen parcasiydi — eski hali gecede bir
 * kez, bes dakikaligina dogrulanabiliyordu. Ayri bir modulde durdugu icin
 * artik dogrudan test edilebiliyor.
 */

export interface GunDurumu {
  durum: 'bekliyor' | 'done';
  deneme: number;
  sonDenemeAt?: string;
}

export interface PencereAyari {
  /** Dagitimin baslayacagi Turkiye saati. */
  baslangicSaat: number;
  baslangicDakika: number;
  /** Bugun dahil kac gun geriye telafi denenir. */
  telafiGun: number;
  /** Bir gun icin en fazla kac tur. */
  maxDeneme: number;
  /** Basarisiz turdan sonra beklenecek sure. */
  denemeArasiMs: number;
}

export const VARSAYILAN_PENCERE: PencereAyari = {
  baslangicSaat: 0,
  baslangicDakika: 15,
  telafiGun: 3,
  maxDeneme: 12,
  denemeArasiMs: 10 * 60 * 1000,
};

export function istanbulSaatDakika(now: Date): { saat: number; dakika: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return {
    saat: Number(parts.find((part) => part.type === 'hour')?.value ?? -1),
    dakika: Number(parts.find((part) => part.type === 'minute')?.value ?? -1),
  };
}

/** `dateKey`'e gun ekler/cikarir. Ogle vaktinden hesaplanir; yaz saati kaymasi olmaz. */
export function gunEkle(dateKey: string, fark: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return '';
  const d = new Date(Date.UTC(year, month - 1, day + fark, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Gunun yeniden denenmeye uygun olup olmadigi (tavan ve bekleme suresi). */
function denenebilir(gun: GunDurumu | undefined, now: Date, ayar: PencereAyari): boolean {
  if (!gun) return true;
  if (gun.durum === 'done') return false;
  if (gun.deneme >= ayar.maxDeneme) return false;
  if (gun.sonDenemeAt) {
    const gecen = now.getTime() - new Date(gun.sonDenemeAt).getTime();
    if (Number.isFinite(gecen) && gecen < ayar.denemeArasiMs) return false;
  }
  return true;
}

/**
 * Islenmesi gereken en eski gun; yoksa null.
 *
 * ADAY OLMANIN IKI YOLU VAR:
 *
 *   1. Bugun — baslangic saati gectiyse. Saatin ustunden ne kadar
 *      gectiginin onemi YOK. Duzeltilen hata tam olarak buydu: is
 *      yalnizca 00:15-00:19 arasinda calisiyor, o bes dakikada sunucu
 *      ayakta degilse gun sessizce kayboluyordu. Artik 09:40'ta acilan
 *      bir sunucu ayni gunun dagitimini yapar.
 *
 *   2. Daha once BASLAMIS ama bitmemis bir gun (`durum: 'bekliyor'`).
 *      Gecici bir API hatasiyla yarim kalan gun ertesi gun de denenir.
 *
 * Hic gorulmemis gecmis gunler BILEREK aday DEGIL. Aksi halde sistemin
 * ilk kurulumunda -- ya da elle temizlenmis bir durum dosyasindan sonra
 * -- gecmis gunlerin bonusu topluca yeniden dagitilirdi; telafi
 * mekanizmasinin en pahali yan etkisi bu olurdu.
 */
export function bekleyenGun(
  gunler: Record<string, GunDurumu>,
  now: Date,
  ayar: PencereAyari = VARSAYILAN_PENCERE,
): string | null {
  const bugun = istanbulDateKey(now);
  if (!bugun) return null;

  const { saat, dakika } = istanbulSaatDakika(now);
  const bugunBasladi = saat > ayar.baslangicSaat || (saat === ayar.baslangicSaat && dakika >= ayar.baslangicDakika);

  // Once yarim kalmis gecmis gunler: en eskisi basa.
  for (let geri = Math.max(1, ayar.telafiGun) - 1; geri >= 1; geri -= 1) {
    const dateKey = gunEkle(bugun, -geri);
    if (!dateKey) continue;
    const gun = gunler[dateKey];
    if (gun?.durum !== 'bekliyor') continue;
    if (denenebilir(gun, now, ayar)) return dateKey;
  }

  if (bugunBasladi && denenebilir(gunler[bugun], now, ayar)) return bugun;
  return null;
}
