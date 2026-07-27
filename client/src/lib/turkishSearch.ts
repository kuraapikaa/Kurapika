/**
 * Türkçe metin araması için normalizasyon.
 *
 * İki ayrı sorunu birlikte çözer:
 *
 * 1. **Locale hatası.** Düz `.toLowerCase()` Türkçe "İ" (U+0130) harfini
 *    `i` + birleşen nokta (U+0069 U+0307) yapar. Bu yüzden "ibrahim" araması
 *    "İbrahim Yılmaz" kaydını BULMUYORDU. `toLocaleLowerCase('tr-TR')` doğru
 *    sonucu verir.
 *
 * 2. **Aksan katlama.** Kullanıcı klavyeden ASCII yazar ("ilk yatirim"), veri
 *    ise Türkçe karakter içerir ("İlk Yatırım"). Locale düzeltmesi tek başına
 *    bunu çözmez; ı/ş/ğ/ü/ö/ç ASCII karşılıklarına indirgenir.
 *
 * Not: katlama tek yönlü değil — hem sorgu hem hedef aynı fonksiyondan
 * geçirildiği için "İlk Yatırım" yazan kullanıcı da sonucu bulur.
 */

const TR_MAP: Record<string, string> = {
  // ASCII 'I' de haritada olmalı: toLocaleLowerCase('tr-TR') onu 'ı' (noktasız)
  // yapar, yani "Ilk" -> "ılk" olur ve "ilk" sorgusuyla eşleşmez. Katlamayı
  // locale küçültmeden ÖNCE yaptığımız için burada yakalanması gerekir.
  ı: 'i', İ: 'i', i: 'i', I: 'i',
  ş: 's', Ş: 's',
  ğ: 'g', Ğ: 'g',
  ü: 'u', Ü: 'u',
  ö: 'o', Ö: 'o',
  ç: 'c', Ç: 'c',
};

/** Arama karşılaştırması için metni normalize eder. */
export function normalizeTr(value: unknown): string {
  const text = String(value ?? '');
  if (!text) return '';
  let out = '';
  for (const ch of text) {
    const mapped = TR_MAP[ch];
    out += mapped ?? ch;
  }
  // Kalan büyük harfler ve birleşen işaretler için locale-aware küçültme.
  return out.toLocaleLowerCase('tr-TR').normalize('NFC');
}

/** `hedef` içinde `terim` geçiyor mu — Türkçe duyarlı. */
export function matchesTr(target: unknown, term: string): boolean {
  const q = normalizeTr(term).trim();
  if (!q) return true;
  return normalizeTr(target).includes(q);
}

/** Birden çok alandan herhangi biri eşleşiyor mu. */
export function matchesAnyTr(fields: Array<unknown>, term: string): boolean {
  const q = normalizeTr(term).trim();
  if (!q) return true;
  return fields.some((f) => normalizeTr(f).includes(q));
}
