/**
 * Çark dilimi yazılarının yerleşimi.
 *
 * Eskiden dilim SAYISINA bakan sabit eşikler vardı
 * (`count >= 12 ? 9 karakter : count >= 9 ? 11 : 14`). Dilim sayısı tek
 * başına yeterli bilgi değil: aynı 12 dilim, 206 px'lik bir telefon
 * çarkında dar, 548 px'lik masaüstü çarkında ferahtır. Sabit eşik yüzünden
 * büyük çarkta bile yazılar kırpılıyor, "500 ₺ FREESPİN PAKETİ" ekranda
 * "500 ₺ FRE…" olarak çıkıyordu.
 *
 * Buradaki hesap üç gerçek ölçüye bakıyor:
 *   · yazının uzayabileceği YARIÇAP bandı  → satır uzunluğu
 *   · yayın en dar olduğu yerdeki genişlik → satır sayısı
 *   · ETİKETLERİN kendisi                  → punto
 *
 * Üçüncüsü önemli: punto, en uzun etiket sığacak şekilde seçiliyor. Panelde
 * seçilen punto bir üst sınır; ödül adları uzunsa kırpmak yerine yazı
 * küçültülüyor. Bir çark, ödülün ne olduğunu gösteremiyorsa işini yapmıyor.
 *
 * Saf fonksiyonlar: SVG çizmeden test edilebilsinler diye ayrı duruyorlar.
 */

/** 900 ağırlıklı BÜYÜK harfte ortalama karakter genişliği (em cinsinden). */
export const KARAKTER_ORANI = 0.6;
/** Satır yüksekliği (em). */
const SATIR_ORANI = 1.15;
/**
 * Bunun altına inmek yerine kırpmak yeğ: okunmayan yazının faydası yok.
 * Telefonda 1 SVG birimi = 1 CSS pikseli olduğu için bu doğrudan ekrandaki
 * punto. 7 küçük ama koyu konturlu kalın beyaz yazıda okunuyor; 8 yapmak
 * 232 px'lik telefon çarkında etiketlerin yarısını kırptırıyordu.
 */
const EN_KUCUK_PUNTO = 7;
/** Bir dilime en fazla bu kadar satır. */
const EN_COK_SATIR = 3;

export type CarkEtiketOlculeri = {
  /** Yazının ortalanacağı yarıçap. */
  yaziRadius: number;
  fontSize: number;
  maxCharacters: number;
  maxLines: number;
};

/**
 * Etiketi satırlara böler, sığmayan kısmı "…" ile kırpar.
 * (Davranışı değişmedi; `WheelManager`'dan buraya taşındı.)
 */
export function carkEtiketSatirlari(label: string, maxCharacters = 11, maxLines = 3): string[] {
  const words = String(label || 'Dilim').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const candidate = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
    if (lines.length && candidate.length > maxCharacters) {
      if (lines.length >= maxLines) break;
      lines.push(word);
    } else if (lines.length) {
      lines[lines.length - 1] = candidate;
    } else {
      lines.push(word);
    }
  }
  const consumed = lines.join(' ').length;
  const original = words.join(' ');
  if (original.length > consumed && lines.length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(3, maxCharacters - 1)).trimEnd()}…`;
  }
  return lines.slice(0, maxLines);
}

/**
 * Etiketin `satirSayisi` satıra KIRPILMADAN sığması için gereken en küçük
 * satır uzunluğu.
 *
 * Kelime bölünemediği için bu, "toplam uzunluk / satır sayısı" değil:
 * "250 ₺ DENEME BONUSU" iki satıra 10 karakterle sığmaz (kelimeler
 * "250 ₺" + "DENEME" + "BONUSU" olarak dağılır), 12 karakterle sığar.
 * Sarma davranışının kendisi ölçüt olarak kullanılıyor ki hesap ile
 * çizim ayrışmasın.
 */
export function enAzSatirUzunlugu(label: string, satirSayisi: number): number {
  const temiz = String(label || 'Dilim').replace(/\s+/g, ' ').trim();
  const tam = temiz.length;
  const enUzunKelime = temiz.split(' ').reduce((en, k) => Math.max(en, k.length), 1);
  for (let genislik = enUzunKelime; genislik <= tam; genislik += 1) {
    const satirlar = carkEtiketSatirlari(temiz, genislik, satirSayisi);
    if (satirlar.join(' ') === temiz) return genislik;
  }
  return tam;
}

export function carkEtiketOlculeri(girdi: {
  /** Dilim alanının dış yarıçapı. */
  radius: number;
  /** Göbek dairesinin yarıçapı. */
  centerRadius: number;
  /** Dilim sayısı (>= 1). */
  count: number;
  /** Panelden gelen tercih edilen punto; ÜST sınır olarak kullanılır. */
  labelSize?: number;
  /** Dilim etiketleri. Verilmezse punto yalnızca alana göre seçilir. */
  etiketler?: string[];
}): CarkEtiketOlculeri {
  const radius = Math.max(1, girdi.radius);
  const count = Math.max(1, Math.floor(girdi.count));
  const angle = (Math.PI * 2) / count;

  /*
   * İç sınır göbeğin dibinden değil, yarıçapın %30'undan başlıyor.
   * Dilim merkeze doğru daraldığı için göbeğin hemen yanında 12 dilimlik
   * bir çarkta dilim ~22 px kalıyor; iki satırlık yazı oraya sığmaz,
   * komşu dilime taşardı.
   */
  const icRadius = Math.max(girdi.centerRadius + 10, radius * 0.3);
  // Dış sınır dekoratif halkanın (radius * .91) içinde kalıyor.
  const disRadius = radius * 0.89;
  const bant = Math.max(24, disRadius - icRadius);
  const yaziRadius = icRadius + bant / 2;

  const tercih = Number(girdi.labelSize) > 0
    ? Number(girdi.labelSize)
    : Math.min(bant * 0.16, angle * yaziRadius * 0.34);

  /*
   * Satır sayısı seçimi. Her satır sayısı için iki sınır var:
   *   · yarıçap: en uzun etiket bu satır sayısıyla bandı aşmamalı
   *   · yay:     satır yığını, yayın EN DAR yerinde bile sığmalı
   * En büyük puntoyu veren satır sayısı kazanıyor. Tek satır genelde
   * uzun etiketlerde küçük punto demek, üç satır ise dar yayda.
   */
  const gereken = enUzunEtiketIhtiyaci(girdi.etiketler);
  let enIyiSatir = 1;
  let enIyiPunto = -1;

  for (let satir = 1; satir <= EN_COK_SATIR; satir += 1) {
    const yaricapSiniri = gereken
      ? bant / (gereken(satir) * KARAKTER_ORANI)
      : Number.POSITIVE_INFINITY;
    // En dar yer: yazının iç ucu, yani bandın başlangıcı.
    const yaySiniri = (angle * icRadius) / (satir * SATIR_ORANI);
    const punto = Math.min(tercih, yaricapSiniri, yaySiniri);
    /*
     * KIRPMA yok: en büyük puntoyu veren satır sayısı kazanıyor, alt sınır
     * en sonda uygulanıyor. Karşılaştırmayı kırpılmış değerler üzerinden
     * yapmak, alt sınırın altında kalan tüm adayları birbirine eşitliyor
     * ve ilk aday (tek satır) kazanıyordu -- telefonda uzun ödül adları
     * bu yüzden iki satıra bölünmek yerine kırpılıyordu.
     */
    if (punto > enIyiPunto) {
      enIyiPunto = punto;
      enIyiSatir = satir;
    }
  }

  const fontSize = kirp(enIyiPunto, EN_KUCUK_PUNTO, Math.max(EN_KUCUK_PUNTO, tercih));
  return {
    yaziRadius,
    fontSize,
    maxCharacters: Math.max(4, Math.floor(bant / (fontSize * KARAKTER_ORANI))),
    maxLines: enIyiSatir,
  };
}

/** En uzun etiketin, verilen satır sayısında istediği satır uzunluğu. */
function enUzunEtiketIhtiyaci(etiketler?: string[]) {
  const liste = (etiketler ?? []).map((e) => String(e ?? '').trim()).filter(Boolean);
  if (liste.length === 0) return null;
  const onbellek = new Map<number, number>();
  return (satir: number) => {
    const hazir = onbellek.get(satir);
    if (hazir != null) return hazir;
    const deger = liste.reduce((en, etiket) => Math.max(en, enAzSatirUzunlugu(etiket, satir)), 1);
    onbellek.set(satir, deger);
    return deger;
  };
}

function kirp(deger: number, alt: number, ust: number) {
  if (!Number.isFinite(deger)) return alt;
  return Math.min(Math.max(deger, alt), Math.max(alt, ust));
}
