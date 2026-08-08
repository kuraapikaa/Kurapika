/**
 * ÖZEL DİNAMİK İZLEME PARAMETRELERİ.
 *
 * Bir ortağın tüm trafiği tek bir izleme anahtarına bağlı olsaydı,
 * ortak "hangi kanalım, hangi banner'ım, hangi kampanyam getirdi"
 * sorusunu soramazdı; elinde tek bir toplam olurdu. Dinamik
 * parametreler bu kırılımı taşıyor: `sub1..sub5` ortağın kendi
 * anlamlandırdığı serbest alanlar, tıklamada yakalanıyor ve dönüşüme
 * kadar taşınıyor.
 *
 * Saf tutuldu: hiçbir I/O yok. Link üretimi ve makro ikamesi bu
 * yazılımın en çok test edilmesi gereken parçası — yanlış kaçış bir
 * ortağın tüm trafiğini yanlış kanala yazar ve bu geriye dönük
 * düzeltilemez.
 */

/** Ortağın serbestçe kullandığı alt kanal alanları. */
export const ALT_PARAMETRELER = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'] as const;
export type AltParametre = (typeof ALT_PARAMETRELER)[number];

export interface IzlemeBaglami {
  /** Ortağın izleme anahtarı; backoffice tarafındaki karşılığı (Lynon'da BTag). */
  ortakAnahtari: string;
  /** Kampanya/medya kimliği (varsa). */
  medyaId?: string;
  alt?: Partial<Record<AltParametre, string>>;
}

/**
 * Değerleri temizler.
 *
 * Ortak parametreyi kendi panelinden yazıyor; sınırsız uzunlukta ya da
 * kontrol karakteri içeren bir değer hem depoyu hem de sonradan
 * gönderilecek postback adresini bozar.
 */
export function altDegerTemizle(deger: unknown): string {
  return [...String(deger ?? '')]
    // Kontrol karakterleri adrese ve kayda girmemeli. KOD NOKTASINA
    // bakiliyor: duzenli ifadeye gomulu kontrol baytlari kaynak dosyada
    // gorunmez kalir ve kodlama degisiminde sessizce bozulur.
    .filter((karakter) => {
      const kod = karakter.codePointAt(0) ?? 0;
      return kod > 0x1f && kod !== 0x7f;
    })
    .join('')
    .trim()
    .slice(0, 100);
}

export function altParametreleriTemizle(
  ham: Record<string, unknown> | undefined,
): Partial<Record<AltParametre, string>> {
  const cikti: Partial<Record<AltParametre, string>> = {};
  if (!ham) return cikti;
  for (const anahtar of ALT_PARAMETRELER) {
    const deger = altDegerTemizle(ham[anahtar]);
    if (deger) cikti[anahtar] = deger;
  }
  return cikti;
}

/**
 * İzleme linki üretir.
 *
 * Değerler `URLSearchParams` ile kodlanıyor; elle birleştirme, içinde
 * `&` geçen tek bir alt parametrenin sonraki tüm alanları ezmesine yol
 * açardı.
 */
export function izlemeLinki(hedefUrl: string, baglam: IzlemeBaglami): string {
  const ortakAnahtari = String(baglam.ortakAnahtari ?? '').trim();
  if (!ortakAnahtari) throw new Error('ortakAnahtari zorunlu.');

  let url: URL;
  try {
    url = new URL(hedefUrl);
  } catch {
    throw new Error(`Geçersiz hedef adres: ${hedefUrl}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Hedef adres yalnızca http/https olabilir.');
  }

  url.searchParams.set('btag', ortakAnahtari);
  if (baglam.medyaId) url.searchParams.set('mid', String(baglam.medyaId));
  for (const [anahtar, deger] of Object.entries(baglam.alt ?? {})) {
    if (deger) url.searchParams.set(anahtar, deger);
  }
  return url.toString();
}

/** Gelen bir istekten izleme bağlamını çıkarır. */
export function izlemeBaglamiCoz(sorgu: Record<string, unknown>): IzlemeBaglami | null {
  const ortakAnahtari = altDegerTemizle(sorgu.btag ?? sorgu.bTag ?? sorgu.BTag ?? sorgu.ref);
  if (!ortakAnahtari) return null;
  const medyaId = altDegerTemizle(sorgu.mid ?? sorgu.medyaId);
  return {
    ortakAnahtari,
    ...(medyaId ? { medyaId } : {}),
    alt: altParametreleriTemizle(sorgu),
  };
}

/**
 * POSTBACK MAKROLARI.
 *
 * Ortak kendi izleme sistemine ait bir adres şablonu veriyor, örn.
 *   https://tracker.ornek.com/pb?cid={clickid}&payout={payout}
 *
 * Bilinmeyen makro OLDUĞU GİBİ BIRAKILMAZ, boşa çevrilir: şablonda
 * kalan `{foo}` ortağın sisteminde çözümlenmeyen bir literal olarak
 * görünür ve hatayı sessizce ortağın tarafına taşır.
 */
export type MakroDegerleri = Record<string, string | number | null | undefined>;

export function makrolariUygula(sablon: string, degerler: MakroDegerleri): string {
  return String(sablon ?? '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_eslesme, ad: string) => {
    const deger = degerler[ad] ?? degerler[ad.toLowerCase()];
    if (deger === null || deger === undefined || deger === '') return '';
    return encodeURIComponent(String(deger));
  });
}

/** Şablonda geçen makro adları; panelde önizleme ve doğrulama için. */
export function sablondakiMakrolar(sablon: string): string[] {
  return [...new Set([...String(sablon ?? '').matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]))];
}

/**
 * TRAFİK KAYNAĞI — bir yönlendiren (referrer) adresini okunur bir
 * kaynak adına çevirir.
 *
 * "Link trafiği nereden geliyor" sorusunun cevabı ham `referrer`
 * değeri değil: aynı kaynak `https://l.instagram.com/...`,
 * `https://www.instagram.com/...` gibi onlarca farklı biçimde
 * gelebiliyor ve ham değerle kırılım almak aynı kaynağı düzinelerce
 * satıra bölerdi. Bilinmeyen bir alan adı ATILMIYOR — ana makine adı
 * kendisi kaynak olarak kullanılıyor, "diğer" diye yutulmuyor; kaynak
 * bilinmiyor olsa da HANGİ alan adı olduğu değerli bir bilgi.
 *
 * Saf: `izleme.ts`'in geri kalanı gibi hiçbir I/O yok.
 */
const BILINEN_KAYNAKLAR: Record<string, string> = {
  'instagram.com': 'Instagram',
  'l.instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook',
  'lm.facebook.com': 'Facebook',
  'fb.me': 'Facebook',
  't.me': 'Telegram',
  'telegram.org': 'Telegram',
  'telegram.me': 'Telegram',
  'twitter.com': 'X / Twitter',
  'x.com': 'X / Twitter',
  't.co': 'X / Twitter',
  'tiktok.com': 'TikTok',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'bing.com': 'Bing',
  'yandex.com': 'Yandex',
  'yandex.com.tr': 'Yandex',
  'whatsapp.com': 'WhatsApp',
  'wa.me': 'WhatsApp',
  'reddit.com': 'Reddit',
  'discord.com': 'Discord',
  'discordapp.com': 'Discord',
};

export function kaynakAdi(referrer: string | null | undefined): string {
  const ham = String(referrer ?? '').trim();
  if (!ham) return 'Doğrudan';

  let host: string;
  try {
    host = new URL(ham).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    // Ayristirilamayan bir deger (bos olmayan ama URL olmayan) — bunu
    // "Dogrudan" saymak yanlis olurdu, gercekten bir yonlendiren vardi.
    return 'Diğer';
  }
  if (!host) return 'Diğer';

  if (BILINEN_KAYNAKLAR[host]) return BILINEN_KAYNAKLAR[host];
  // Google'in ulke bazli onlarca alt alani var (google.com.tr, google.de,
  // google.co.uk…); tek tek listelemek yerine desenle yakalaniyor.
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'Google';

  return host;
}
