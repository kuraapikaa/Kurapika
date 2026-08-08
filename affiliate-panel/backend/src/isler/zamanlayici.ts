import { gunAnahtari } from '../lib/gunler.js';
import { kiracilariListele, veritabani } from '../lib/veritabani.js';
import { geceHakedisiIsle, type GeceSonucu } from './geceIsi.js';

/**
 * GECE YARISI ZAMANLAYICISI.
 *
 * ── Neden cron ifadesi değil, GÜN DEĞİŞİMİ takibi ──
 *
 * "Her gece 00:00" yerel saate göre. Bir sonraki gece yarısına kaç
 * milisaniye kaldığını hesaplamak yaz saati geçişlerinde yanılıyor: o
 * gece 23 ya da 25 saat sürüyor ve iş bir saat kayıyor ya da iki kez
 * çalışıyor.
 *
 * Bunun yerine dakikada bir yerel TAKVİM GÜNÜ okunuyor; gün değişince
 * iş çalışıyor. Yaz saati geçişinden etkilenmiyor, çünkü hiçbir yerde
 * süre aritmetiği yok.
 *
 * ── Açılışta da çalışıyor ──
 *
 * Konteyner gece yarısında kapalıysa o gecenin işi kaçardı. Açılışta
 * bir kez çalıştırmak bunu telafi ediyor; iş zaten idempotent
 * (`kaynakAnahtari` benzersiz), fazladan çalışması zarar vermiyor.
 */

const KONTROL_ARALIGI_MS = 60_000;
/** Açılışta hemen değil: veritabanı ve göç işlemleri otursun. */
const ACILIS_GECIKMESI_MS = Math.max(1000, Number(process.env.AFF_ACILIS_ISI_GECIKMESI_MS) || 20_000);

export interface ZamanlayiciKancasi {
  durdur(): void;
}

/** Tüm kiracılar için gece işini çalıştırır; hatalar tek tek yutuluyor. */
export async function tumKiracilarIcinCalistir(
  gunlukcu: { info: (o: unknown, m: string) => void; error: (o: unknown, m: string) => void },
  simdi = new Date(),
): Promise<GeceSonucu[]> {
  if (!veritabani()) return [];

  const sonuclar: GeceSonucu[] = [];
  for (const kiraci of await kiracilariListele()) {
    try {
      const sonuc = await geceHakedisiIsle(kiraci, simdi);
      if (sonuc.yazilanHareket > 0) {
        gunlukcu.info(sonuc, 'Gece hakedişi cüzdanlara yazıldı');
      }
      sonuclar.push(sonuc);
    } catch (hata) {
      // Bir kiracinin hatasi digerlerini engellememeli: hepsi ayri
      // hesaplar ve biri bozuk yapilandirmayla duruyorsa oteki
      // odemesini almali.
      gunlukcu.error({ kiraci, hata: (hata as Error).message }, 'Gece hakedişi başarısız');
    }
  }
  return sonuclar;
}

export function geceIsiniZamanla(
  gunlukcu: { info: (o: unknown, m: string) => void; error: (o: unknown, m: string) => void },
): ZamanlayiciKancasi {
  let sonGorulenGun = gunAnahtari();
  let calisiyor = false;

  const guvenliCalistir = async () => {
    // Ust uste binmeyi engelle: bir tur uzun surerse dakikalik kontrol
    // ikinci bir turu baslatmamali.
    if (calisiyor) return;
    calisiyor = true;
    try {
      await tumKiracilarIcinCalistir(gunlukcu);
    } finally {
      calisiyor = false;
    }
  };

  const acilis = setTimeout(() => void guvenliCalistir(), ACILIS_GECIKMESI_MS);

  const tik = setInterval(() => {
    const bugun = gunAnahtari();
    if (bugun === sonGorulenGun) return;
    sonGorulenGun = bugun;
    void guvenliCalistir();
  }, KONTROL_ARALIGI_MS);

  // Zamanlayicilar surecin kapanmasini engellemesin.
  acilis.unref?.();
  tik.unref?.();

  return {
    durdur() {
      clearTimeout(acilis);
      clearInterval(tik);
    },
  };
}
