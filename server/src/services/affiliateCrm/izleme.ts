/**
 * ÖZEL DİNAMİK İZLEME PARAMETRELERİ.
 *
 * Bugüne kadar bir ortağın tüm trafiği tek bir BTag'e bağlıydı. Ortak
 * "hangi kanalım, hangi banner'ım, hangi kampanyam getirdi" sorusunu
 * soramıyordu; elinde tek bir toplam vardı. Dinamik parametreler bu
 * kırılımı taşır: `sub1..sub5` ortağın kendi anlamlandırdığı serbest
 * alanlar, tıklamada yakalanır ve dönüşüme kadar taşınır.
 *
 * Saf tutuldu: hiçbir I/O yok. Link üretimi ve makro ikamesi bu
 * yazılımın en çok test edilmesi gereken parçası — yanlış kaçış (escape)
 * bir ortağın tüm trafiğini yanlış kanala yazar ve bu geriye dönük
 * düzeltilemez.
 */

/** Ortağın serbestçe kullandığı alt kanal alanları. */
export const ALT_PARAMETRELER = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'] as const;
export type AltParametre = (typeof ALT_PARAMETRELER)[number];

export interface IzlemeBaglami {
  /** Ortağın BTag'i; Lynon tarafındaki karşılığı. */
  bTag: string;
  /** Kampanya/medya kimliği (varsa). */
  medyaId?: string;
  alt?: Partial<Record<AltParametre, string>>;
}

/**
 * Değerleri temizler.
 *
 * Ortak parametreyi kendi panelinden yazıyor; sınırsız uzunlukta ya da
 * kontrol karakteri içeren bir değer hem depoyu hem de sonradan
 * gönderilecek postback URL'sini bozar.
 */
export function altDegerTemizle(deger: unknown): string {
  return [...String(deger ?? '')]
    // Kontrol karakterleri URL'ye ve kayda girmemeli. Kod noktasina
    // bakiyoruz: duzenli ifadeye gomulu kontrol baytlari kaynak dosyada
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
  const bTag = String(baglam.bTag ?? '').trim();
  if (!bTag) throw new Error('bTag zorunlu.');

  let url: URL;
  try {
    url = new URL(hedefUrl);
  } catch {
    throw new Error(`Geçersiz hedef adres: ${hedefUrl}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Hedef adres yalnızca http/https olabilir.');
  }

  url.searchParams.set('btag', bTag);
  if (baglam.medyaId) url.searchParams.set('mid', String(baglam.medyaId));
  for (const [anahtar, deger] of Object.entries(baglam.alt ?? {})) {
    if (deger) url.searchParams.set(anahtar, deger);
  }
  return url.toString();
}

/** Gelen bir istekten izleme bağlamını çıkarır. */
export function izlemeBaglamiCoz(sorgu: Record<string, unknown>): IzlemeBaglami | null {
  const bTag = altDegerTemizle(sorgu.btag ?? sorgu.bTag ?? sorgu.BTag);
  if (!bTag) return null;
  const medyaId = altDegerTemizle(sorgu.mid ?? sorgu.medyaId);
  return {
    bTag,
    ...(medyaId ? { medyaId } : {}),
    alt: altParametreleriTemizle(sorgu),
  };
}

/**
 * POSTBACK MAKROLARI.
 *
 * Ortak kendi izleme sistemine ait bir URL şablonu veriyor, örn.
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
