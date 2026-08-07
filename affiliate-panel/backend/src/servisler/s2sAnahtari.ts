import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { degistir, kayitOku, oku } from '../lib/depo.js';

/**
 * SUNUCUDAN SUNUCUYA ANAHTAR.
 *
 * Oyuncu kayıt bildirimi tarayıcıdan değil, sitenin sunucusundan geliyor;
 * oturum çerezi yok. Kimlik doğrulaması bu anahtarla.
 *
 * ── Neden scrypt DEĞİL ──
 *
 * Parolalar `parolaOzeti` ile scrypt'ten geçiyor, çünkü insan parolaları
 * tahmin edilebilir ve saldırganın sözlük denemesini pahalı kılmak
 * gerekiyor. Bu anahtar 32 bayt RASTGELE: sözlük saldırısı diye bir şey
 * yok, kaba kuvvet zaten imkânsız. Buna karşılık her bildirimde
 * doğrulanıyor -- scrypt kullanmak her isteğe yüz milisaniye eklerdi ve
 * kimseyi bir şeyden korumazdı.
 *
 * SHA-256 + sabit zamanlı karşılaştırma, yüksek entropili jetonlar için
 * doğru araç. Anahtarın kendisi HİÇBİR yerde saklanmıyor; yalnızca özeti.
 */

const ALAN = 's2s-anahtari';
const ONEK = 'affs2s_';

interface AnahtarBelgesi {
  ozet: string | null;
  olusturuldu: string | null;
  sonKullanim: string | null;
}

const cozBelge = (ham: unknown): AnahtarBelgesi => {
  const kayit = kayitOku(ham);
  return {
    ozet: typeof kayit.ozet === 'string' ? kayit.ozet : null,
    olusturuldu: typeof kayit.olusturuldu === 'string' ? kayit.olusturuldu : null,
    sonKullanim: typeof kayit.sonKullanim === 'string' ? kayit.sonKullanim : null,
  };
};

const ozetle = (anahtar: string): string => createHash('sha256').update(anahtar, 'utf8').digest('hex');

export interface AnahtarDurumu {
  kuruluMu: boolean;
  olusturuldu: string | null;
  sonKullanim: string | null;
}

export async function anahtarDurumu(kiraci: string): Promise<AnahtarDurumu> {
  const belge = await oku<AnahtarBelgesi>(kiraci, ALAN, cozBelge);
  return {
    kuruluMu: Boolean(belge.ozet),
    olusturuldu: belge.olusturuldu,
    sonKullanim: belge.sonKullanim,
  };
}

/**
 * Yeni anahtar üretir ve ESKİSİNİ GEÇERSİZ KILAR.
 *
 * Düz metin YALNIZCA burada, bir kez dönüyor. Saklanmadığı için
 * kaybedilirse gösterilemez; tek çare yeniden üretmek. Bu bilinçli:
 * saklanan bir anahtar, panel veritabanı sızdığında entegrasyonun da
 * sızması demek.
 */
export async function anahtarUret(kiraci: string, simdi = new Date()): Promise<string> {
  const anahtar = `${ONEK}${randomBytes(32).toString('base64url')}`;
  await degistir<AnahtarBelgesi, void>(kiraci, ALAN, cozBelge, (belge) => {
    belge.ozet = ozetle(anahtar);
    belge.olusturuldu = simdi.toISOString();
    belge.sonKullanim = null;
  });
  return anahtar;
}

export async function anahtarSil(kiraci: string): Promise<void> {
  await degistir<AnahtarBelgesi, void>(kiraci, ALAN, cozBelge, (belge) => {
    belge.ozet = null;
    belge.olusturuldu = null;
    belge.sonKullanim = null;
  });
}

/**
 * Anahtarı doğrular.
 *
 * Anahtar kurulu DEĞİLSE her istek reddediliyor. "Kurulmamışsa serbest"
 * davranışı, kurulumu unutulan bir kiracıda ucu herkese açardı.
 */
export async function anahtarGecerliMi(kiraci: string, sunulan: unknown, simdi = new Date()): Promise<boolean> {
  const belge = await oku<AnahtarBelgesi>(kiraci, ALAN, cozBelge);
  if (!belge.ozet) return false;

  const metin = typeof sunulan === 'string' ? sunulan.trim() : '';
  if (!metin) return false;

  const beklenen = Buffer.from(belge.ozet, 'hex');
  const gelen = Buffer.from(ozetle(metin), 'hex');
  // Uzunluklar sabit (sha256) ama `timingSafeEqual` esit olmayan
  // uzunlukta firlatiyor; bozuk bir kayit hataya donusmesin.
  if (beklenen.length !== gelen.length) return false;
  if (!timingSafeEqual(beklenen, gelen)) return false;

  // Son kullanim bilgisi teshis icin: "entegrasyon calisiyor mu"
  // sorusunun tek gorunur cevabi bu.
  await degistir<AnahtarBelgesi, void>(kiraci, ALAN, cozBelge, (kayit) => {
    kayit.sonKullanim = simdi.toISOString();
  });
  return true;
}
