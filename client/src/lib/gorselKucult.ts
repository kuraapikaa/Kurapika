/**
 * Panelden yüklenen görselleri saklamadan ÖNCE küçültür.
 *
 * VIP seviye logoları oyun yapılandırmasının içinde duruyor ve
 * `/games/config` yanıtı HER oyuncuya, her lobi açılışında gidiyor.
 * Yüklenen dosya olduğu gibi data URI'ye çevrilseydi (paneldeki mevcut
 * alışkanlık) 7 seviyelik bir merdiven o yanıta megabaytlar eklerdi --
 * hem de logonun ekranda 96 px göründüğü yerde.
 *
 * Burada görsel tarayıcıda yeniden ölçeklenip WebP'ye kodlanıyor:
 * 256 px'lik bir rozet tipik olarak 5-10 KB tutuyor. Sunucuya yeni bir uç
 * ya da dosya deposu eklemeye gerek kalmıyor.
 */

/**
 * Kabul edilen tipler.
 *
 * SVG YOK: script taşıyabiliyor ve panele yüklenen bir SVG oyuncu
 * sayfasında çalışırdı.
 */
export const GECERLI_TIPLER = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'] as const;

/**
 * Kaynak dosya üst sınırı. Küçültme zaten yapılıyor; bu yalnızca
 * tarayıcıyı kilitleyecek devasa dosyalar için.
 */
export const EN_BUYUK_KAYNAK = 8 * 1024 * 1024;

/**
 * Logonun saklanacağı en büyük kenar (px). Ekranda ~96 px görünüyor;
 * 256 retina ekran için fazlasıyla yeter.
 */
export const EN_BUYUK_KENAR = 256;

export type GorselDenetimi = { uygun: true } | { uygun: false; sebep: string };

export function gorselUygunMu(
  dosya: { type?: string; size?: number } | null | undefined,
): GorselDenetimi {
  if (!dosya) return { uygun: false, sebep: 'Dosya seçilmedi.' };
  const tip = String(dosya.type ?? '').toLowerCase();
  if (!GECERLI_TIPLER.includes(tip as (typeof GECERLI_TIPLER)[number])) {
    return { uygun: false, sebep: 'Yalnızca PNG, JPEG, WebP, GIF veya AVIF yüklenebilir.' };
  }
  const boyut = Number(dosya.size ?? 0);
  if (boyut > EN_BUYUK_KAYNAK) {
    return { uygun: false, sebep: `Dosya çok büyük (${kbYaz(boyut)}). En fazla ${kbYaz(EN_BUYUK_KAYNAK)}.` };
  }
  return { uygun: true };
}

/** En-boy oranını koruyarak hedef kutuya sığdırır. Küçük görseli BÜYÜTMEZ. */
export function hedefBoyut(
  genislik: number,
  yukseklik: number,
  enBuyukKenar = EN_BUYUK_KENAR,
): { genislik: number; yukseklik: number } {
  const g = Math.max(1, Math.floor(Number(genislik) || 1));
  const y = Math.max(1, Math.floor(Number(yukseklik) || 1));
  const sinir = Math.max(1, Math.floor(Number(enBuyukKenar) || EN_BUYUK_KENAR));
  const uzun = Math.max(g, y);
  if (uzun <= sinir) return { genislik: g, yukseklik: y };
  const oran = sinir / uzun;
  return {
    genislik: Math.max(1, Math.round(g * oran)),
    yukseklik: Math.max(1, Math.round(y * oran)),
  };
}

/** data URI'nin yaklaşık bayt boyutu (base64 çözülmüş hali). */
export function veriUriBoyutu(veriUri: unknown): number {
  const s = String(veriUri ?? '');
  const virgul = s.indexOf(',');
  if (!s.startsWith('data:') || virgul < 0) return 0;
  const govde = s.slice(virgul + 1);
  const dolgu = govde.endsWith('==') ? 2 : govde.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((govde.length * 3) / 4) - dolgu);
}

export function kbYaz(bayt: number): string {
  const kb = Math.max(0, Number(bayt) || 0) / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}

/**
 * Dosyayı küçültüp data URI döner.
 *
 * WebP her hedef tarayıcıda kodlanabiliyor; kodlanamadığı bir ortamda
 * PNG'ye düşülüyor. `toDataURL` desteklenmeyen bir tip istendiğinde
 * sessizce PNG döndürdüğü için çıktının tipi ayrıca kontrol ediliyor --
 * yoksa "WebP kaydettim" deyip PNG saklardık.
 */
export async function gorseliKucult(
  dosya: File,
  enBuyukKenar = EN_BUYUK_KENAR,
): Promise<{ veriUri: string; genislik: number; yukseklik: number; bayt: number }> {
  const denetim = gorselUygunMu(dosya);
  if (!denetim.uygun) throw new Error(denetim.sebep);

  const kaynak = await dosyayiOku(dosya);
  const gorsel = await gorseliYukle(kaynak);
  const { genislik, yukseklik } = hedefBoyut(gorsel.naturalWidth, gorsel.naturalHeight, enBuyukKenar);

  const tuval = document.createElement('canvas');
  tuval.width = genislik;
  tuval.height = yukseklik;
  const ctx = tuval.getContext('2d');
  if (!ctx) throw new Error('Tarayıcı görsel işlemeyi desteklemiyor.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(gorsel, 0, 0, genislik, yukseklik);

  let veriUri = tuval.toDataURL('image/webp', 0.9);
  if (!veriUri.startsWith('data:image/webp')) veriUri = tuval.toDataURL('image/png');

  return { veriUri, genislik, yukseklik, bayt: veriUriBoyutu(veriUri) };
}

function dosyayiOku(dosya: File): Promise<string> {
  return new Promise((coz, reddet) => {
    const okuyucu = new FileReader();
    okuyucu.onload = () => coz(String(okuyucu.result || ''));
    okuyucu.onerror = () => reddet(new Error('Dosya okunamadı.'));
    okuyucu.readAsDataURL(dosya);
  });
}

function gorseliYukle(kaynak: string): Promise<HTMLImageElement> {
  return new Promise((coz, reddet) => {
    const gorsel = new Image();
    gorsel.onload = () => coz(gorsel);
    gorsel.onerror = () => reddet(new Error('Görsel çözümlenemedi.'));
    gorsel.src = kaynak;
  });
}
