/**
 * TELEFON NUMARASIYLA OYUNCU EŞLEŞTİRME.
 *
 * Toplu sorguya yapıştırılan liste artık kullanıcı adı ve telefon
 * numarası KARIŞIK olabiliyor. Her satırın hangisi olduğu tahmin
 * ediliyor; yanlış tahmin yanlış oyuncuyu sorgulamak demek olduğu için
 * kurallar dar tutuldu.
 *
 * ── Neden son 10 hane ─────────────────────────────────────────────────
 * Aynı numara operatöre ve kayıt anına göre farklı yazılıyor:
 *
 *   0555 123 45 67
 *   +90 555 123 45 67
 *   905551234567
 *   5551234567
 *
 * Hepsi aynı kişi. Ülke kodu ve baştaki sıfır değişken, son 10 hane
 * sabit. Bu yüzden karşılaştırma son 10 hane üzerinden yapılıyor.
 * Daha kısa numaralarda (sabit hat, yurt dışı) elde ne varsa o
 * kullanılıyor; kırpmak farklı numaraları eşitlerdi.
 *
 * ── Neden kullanıcı adı ÖNCE denenmiyor da tür tahmin ediliyor ────────
 * Lynon araması bulanık: bir telefonu kullanıcı adı diye sorarsak
 * numarayı ADINDA geçiren bambaşka bir hesap dönebilir. Türü önce
 * belirleyip aramayı ona göre yapmak, yanlış kişiye rapor üretme
 * ihtimalini kapatıyor.
 */

/** Yalnızca rakamlar. */
export function haneler(metin: unknown): string {
  return String(metin ?? '').replace(/\D/g, '');
}

/**
 * Bu metin telefon numarası mı?
 *
 * Kural bilerek DAR: en az 10 hane olacak ve harf içermeyecek. Kısa
 * numaralı kullanıcı adlarını (ör. "test777") telefon sanmamak için 10
 * hane sınırı var; Türkiye cep numaraları alan koduyla birlikte zaten
 * 10 hane. Harf içeren hiçbir şey telefon sayılmıyor -- "0532abc" bir
 * kullanıcı adıdır.
 */
export function telefonMu(metin: unknown): boolean {
  const ham = String(metin ?? '').trim();
  if (!ham) return false;
  // Harf varsa kullanici adidir. Turkce harfler de dahil.
  if (/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(ham)) return false;
  return haneler(ham).length >= 10;
}

/**
 * Karşılaştırma anahtarı: son 10 hane (kısa numaralarda tamamı).
 */
export function telefonAnahtari(metin: unknown): string {
  const h = haneler(metin);
  return h.length > 10 ? h.slice(-10) : h;
}

/** İki numara aynı kişiye mi ait? */
export function telefonEslesiyorMu(a: unknown, b: unknown): boolean {
  const x = telefonAnahtari(a);
  const y = telefonAnahtari(b);
  // Bos anahtar hicbir seyle eslesmemeli: aksi halde telefonu olmayan
  // her oyuncu her aramaya cevap verirdi.
  if (!x || !y) return false;
  return x === y;
}

export type OyuncuSatiri = {
  Login?: unknown;
  userName?: unknown;
  Phone?: unknown;
  MobilePhone?: unknown;
  phoneNumber?: unknown;
  mobile?: unknown;
  [key: string]: unknown;
};

/** Satırdaki tüm telefon alanları — kurulumlar farklı ad kullanıyor. */
export function satirTelefonlari(satir: OyuncuSatiri): string[] {
  return [satir?.Phone, satir?.MobilePhone, satir?.phoneNumber, satir?.mobile]
    .map((deger) => String(deger ?? '').trim())
    .filter(Boolean);
}

/**
 * Arama sonuçları içinden numarası eşleşen oyuncuyu bulur.
 *
 * Birden fazla eşleşme varsa `null` döner ve sebebi bildirilir: aynı
 * numarayı paylaşan iki hesaptan hangisinin kastedildiği bilinemez ve
 * rastgele birini seçip rapora koymak, sessizce yanlış oyuncunun
 * parasını göstermek olurdu.
 */
export function telefonlaBul(
  satirlar: OyuncuSatiri[] | null | undefined,
  aranan: unknown,
): { durum: 'bulundu'; oyuncu: OyuncuSatiri } | { durum: 'yok' } | { durum: 'coklu'; adaylar: OyuncuSatiri[] } {
  const anahtar = telefonAnahtari(aranan);
  if (!anahtar) return { durum: 'yok' };

  const eslesenler = (Array.isArray(satirlar) ? satirlar : []).filter((satir) =>
    satirTelefonlari(satir).some((tel) => telefonEslesiyorMu(tel, anahtar)),
  );

  if (eslesenler.length === 0) return { durum: 'yok' };
  if (eslesenler.length > 1) return { durum: 'coklu', adaylar: eslesenler };
  return { durum: 'bulundu', oyuncu: eslesenler[0] };
}
