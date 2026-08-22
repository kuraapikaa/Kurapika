/**
 * TOPLU YATIRIM / ÇEKİM ÖZETİ.
 *
 * Birden fazla kullanıcı adı için toplam yatırım ve toplam çekim.
 * Yatırım ve çekim AYRI tarih aralıkları kullanabilir: operatör
 * "şu tarihten sonra yatıranların şu hafta içindeki çekimleri" gibi
 * sorular soruyor ve tek bir aralıkla bu yanıtlanamıyor.
 *
 * ── Neden ayrı bir dosya ──────────────────────────────────────────────
 * Toplama işi Lynon'a hiç gitmeden test edilebilmeli. Rotanın içine
 * gömülseydi, "başarısız işlemler sayılıyor mu", "sınır tarihi dahil mi"
 * gibi soruların yanıtı ancak canlı veriyle görülebilirdi.
 *
 * ── Hangi işlemler sayılır ────────────────────────────────────────────
 * Yalnızca durumu `success` olanlar. Bekleyen ya da reddedilen bir çekim
 * kasadan çıkmış para DEĞİLDİR; toplama katılırsa oyuncunun çektiği para
 * olduğundan fazla görünür. Aynı kural `kayipTabaniService` içinde de
 * geçerli — iki yerde farklı davransaydı aynı oyuncu iki ekranda iki
 * farklı toplam gösterirdi.
 *
 * Tutarlar MUTLAK değere çevrilir: Lynon çekimleri kimi kurulumda
 * negatif, kimisinde pozitif döndürüyor ve işaretine güvenmek toplamı
 * sessizce sıfıra yaklaştırırdı.
 */

export type OdemeSatiri = {
  transactionType?: unknown;
  type?: unknown;
  status?: unknown;
  state?: unknown;
  amount?: unknown;
  actualAmount?: unknown;
  receivedAmount?: unknown;
  createdAt?: unknown;
  creationDate?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
};

export type Aralik = {
  /** ISO tarih/zaman. Boş = alt sınır yok. */
  baslangic?: string | null;
  /** ISO tarih/zaman. Boş = üst sınır yok. */
  bitis?: string | null;
};

export type TurOzeti = {
  toplam: number;
  adet: number;
  /** Aralıktaki en eski ve en yeni işlem — verinin gerçekten kapsandığını görmek için. */
  ilk: string | null;
  son: string | null;
};

export type OyuncuOzeti = {
  yatirim: TurOzeti;
  cekim: TurOzeti;
  /**
   * ÖDENMEMİŞ çekimler (bekleyen/onay bekleyen). Toplama KATILMAZ ama
   * ayrı raporlanır.
   *
   * Neden: panelin işlem listesi çekimlerde `status !== 'failed'`
   * kullanıyor, yani bekleyenleri de gösteriyor. Burada yalnızca ödenmiş
   * olanlar sayılıyor -- kasadan çıkmamış para "çekilmiş" sayılamaz.
   * İki ekranın farkı bu; sayıyı göstermezsek fark açıklanamaz kalır ve
   * "toplamlar yanlış" gibi görünür.
   */
  bekleyenCekim: TurOzeti;
  /** yatırım − (ödenmiş) çekim. Oyuncunun kasada bıraktığı net tutar. */
  net: number;
};

const BASARILI = 'success';

/** Lynon'un ödenmemiş çekim durumları (accountSnapshotService ile aynı küme). */
const BEKLEYEN_DURUMLAR = new Set(['new', 'created', 'pending', 'pendingproviderapproval']);

function metin(deger: unknown): string {
  return String(deger ?? '').trim().toLowerCase();
}

/**
 * SAYIYA ÇEVİRME — panelin geri kalanıyla AYNI kural.
 *
 * Önce `Number()` kullanılıyordu ve tutarlar yanlış çıkıyordu: Lynon
 * bazı alanları BİÇİMLENMİŞ metin olarak döndürüyor ("1.234,56" gibi) ve
 * `Number("1.234,56")` NaN veriyor. NaN sessizce 0'a düşünce toplam
 * olduğundan küçük görünüyordu.
 *
 * Kural `lynonBackofficeService.numberFrom` ile birebir: son görülen
 * ayırıcı hangisiyse ONDALIK odur. "1.234,56" -> 1234.56,
 * "1,234.56" -> 1234.56.
 */
export function sayiya(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === '') return fallback;
  let text = String(value).trim();
  if (!text) return fallback;
  // Para birimi simgesi, boşluk vb. atılır; rakam, ayırıcı ve eksi kalır.
  text = text.replace(/[^\d,.-]/g, '');
  if (!text) return fallback;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma > dot) text = text.replace(/\./g, '').replace(',', '.');
  else text = text.replace(/,/g, '');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Satırın tutarı — TÜRE GÖRE farklı alan.
 *
 * ── Yatırımda `actualAmount` ──────────────────────────────────────────
 * Canlıda ölçüldü: `halil4554` için Lynon tek satır döndürüyor,
 * `amount: 2000` ve `actualAmount: 500`. Oyuncunun gerçek yatırımı 500.
 * Yani yatırımda `amount` hesaba GEÇEN tutar değil; geçen tutar
 * `actualAmount`.
 *
 * `mapTransaction` hâlâ `amount`ı önceliyor -- yani panelin diğer
 * ekranları bu satır için 2.000 gösteriyor. Burayı bilerek AYIRIYORUZ:
 * ölçülmüş gerçek, tutarlılıktan önce gelir. Diğer ekranların da
 * düzeltilmesi gerekiyor; bkz. teslim notu.
 *
 * ── Çekimde sıra DEĞİŞMEDİ ────────────────────────────────────────────
 * Çekim tarafında aynı ölçüm yapılmadı. Doğrulanmamış bir varsayımla
 * çekim tutarını da değiştirmek, tek bildiğimiz gerçeği düzeltirken
 * bilmediğimiz bir yeri bozmak olurdu.
 */
function tutar(satir: OdemeSatiri, tur: string): number {
  const ham = tur === 'deposit'
    ? (satir.actualAmount ?? satir.amount ?? satir.receivedAmount)
    : (satir.amount ?? satir.actualAmount ?? satir.receivedAmount);
  return Math.abs(sayiya(ham));
}

function zaman(satir: OdemeSatiri): number {
  for (const aday of [satir.createdAt, satir.creationDate, satir.updatedAt]) {
    const t = Date.parse(String(aday ?? ''));
    if (Number.isFinite(t)) return t;
  }
  return Number.NaN;
}

/**
 * Sınırlar DAHİL: operatör "01.08 - 31.08" derken 31 Ağustos'u da
 * kastediyor. Gün sonu bilgisi çağıranın sorumluluğunda (tarih seçici
 * `2026-08-31` gönderirse bunu `23:59:59.999`e genişletmek gerekir);
 * burada verilen an neyse o uygulanır.
 */
function araliktaMi(ms: number, aralik: Aralik | undefined): boolean {
  if (!Number.isFinite(ms)) return false;
  const bas = aralik?.baslangic ? Date.parse(aralik.baslangic) : null;
  const bit = aralik?.bitis ? Date.parse(aralik.bitis) : null;
  if (bas != null && Number.isFinite(bas) && ms < bas) return false;
  if (bit != null && Number.isFinite(bit) && ms > bit) return false;
  return true;
}

function bosOzet(): TurOzeti {
  return { toplam: 0, adet: 0, ilk: null, son: null };
}

function ozetle(satirlar: OdemeSatiri[], aralik: Aralik | undefined, tur: string): TurOzeti {
  const sonuc = bosOzet();
  let enEski = Number.POSITIVE_INFINITY;
  let enYeni = Number.NEGATIVE_INFINITY;

  for (const satir of satirlar) {
    const ms = zaman(satir);
    if (!araliktaMi(ms, aralik)) continue;
    sonuc.toplam += tutar(satir, tur);
    sonuc.adet += 1;
    if (ms < enEski) enEski = ms;
    if (ms > enYeni) enYeni = ms;
  }

  if (sonuc.adet > 0) {
    sonuc.ilk = new Date(enEski).toISOString();
    sonuc.son = new Date(enYeni).toISOString();
  }
  // Kayan nokta birikimi: 2 hane yeterli, para birimi zaten kuruşlu.
  sonuc.toplam = Math.round(sonuc.toplam * 100) / 100;
  return sonuc;
}

export function oyuncuOzeti(
  satirlar: OdemeSatiri[] | null | undefined,
  yatirimAraligi?: Aralik,
  cekimAraligi?: Aralik,
): OyuncuOzeti {
  const tumu = Array.isArray(satirlar) ? satirlar : [];
  const turu = (satir: OdemeSatiri) => metin(satir.transactionType ?? satir.type);
  const durumu = (satir: OdemeSatiri) => metin(satir?.status ?? satir?.state);

  const yatirimlar = tumu.filter((s) => turu(s) === 'deposit' && durumu(s) === BASARILI);
  const cekimler = tumu.filter((s) => turu(s) === 'withdrawal' && durumu(s) === BASARILI);
  const bekleyenler = tumu.filter((s) => turu(s) === 'withdrawal' && BEKLEYEN_DURUMLAR.has(durumu(s)));

  const yatirim = ozetle(yatirimlar, yatirimAraligi, 'deposit');
  const cekim = ozetle(cekimler, cekimAraligi, 'withdrawal');
  const bekleyenCekim = ozetle(bekleyenler, cekimAraligi, 'withdrawal');

  return {
    yatirim,
    cekim,
    bekleyenCekim,
    net: Math.round((yatirim.toplam - cekim.toplam) * 100) / 100,
  };
}

/**
 * Girilen metinden kullanıcı adı listesi çıkarır.
 *
 * Operatör listeyi Excel'den, Telegram'dan ya da elle yapıştırıyor;
 * araya virgül, noktalı virgül, sekme ve satır sonu karışıyor. Hepsi
 * ayırıcı sayılır. Tekrarlar ELENİR ama sıra korunur: 200 satırlık bir
 * yapıştırmada aynı adın iki kez sorgulanması hem yavaşlatır hem de
 * sonucu iki kez sayılmış gibi gösterirdi.
 *
 * Karşılaştırma Türkçe'ye duyarlı küçültmeyle yapılır ("İSMAİL" ile
 * "ismail" aynı kişi), fakat listeye kullanıcının YAZDIĞI hali girer --
 * Lynon'a kendi yazdığı biçimde sormak, eşleşmeyi bize bağlı olmaktan
 * çıkarır.
 */
export function kullaniciAdlariniAyikla(ham: unknown, sinir = 500): string[] {
  const parcalar = String(ham ?? '')
    .split(/[\s,;]+/)
    .map((parca) => parca.trim())
    .filter(Boolean);

  const gorulen = new Set<string>();
  const sonuc: string[] = [];
  for (const parca of parcalar) {
    const anahtar = parca.toLocaleLowerCase('tr-TR');
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    sonuc.push(parca);
    if (sonuc.length >= sinir) break;
  }
  return sonuc;
}

/**
 * Satır toplamlarından genel toplam.
 *
 * Ayrı hesaplanıyor çünkü bulunamayan oyuncular listede kalıyor ve
 * toplamlara katılmamalı; "10 kullanıcıdan 7'si bulundu" bilgisi
 * kaybolursa toplam sessizce eksik okunur.
 */
export function genelToplam(satirlar: Array<{ bulundu: boolean; ozet?: OyuncuOzeti | null }>): {
  yatirimToplam: number;
  cekimToplam: number;
  net: number;
  bulunan: number;
  bulunamayan: number;
} {
  let yatirimToplam = 0;
  let cekimToplam = 0;
  let bulunan = 0;
  let bulunamayan = 0;

  for (const satir of satirlar) {
    if (!satir.bulundu || !satir.ozet) { bulunamayan += 1; continue; }
    bulunan += 1;
    yatirimToplam += satir.ozet.yatirim.toplam;
    cekimToplam += satir.ozet.cekim.toplam;
  }

  yatirimToplam = Math.round(yatirimToplam * 100) / 100;
  cekimToplam = Math.round(cekimToplam * 100) / 100;
  return {
    yatirimToplam,
    cekimToplam,
    net: Math.round((yatirimToplam - cekimToplam) * 100) / 100,
    bulunan,
    bulunamayan,
  };
}

/**
 * HAM SATIRLARIN DÖKÜMÜ — "toplam neden bu kadar?" sorusunun yanıtı.
 *
 * Bir toplamın yanlış göründüğü bildirildiğinde iki olasılık var:
 * Lynon zaten az satır döndürüyor, ya da biz süzerken eliyoruz. İkisi
 * dışarıdan AYNI görünüyor -- ekranda sadece küçük bir sayı var.
 *
 * Bu döküm farkı görünür kılıyor: kaç satır geldi, kaçı yatırım/çekim,
 * hangi durumlar var. "3 yatırım geldi ama 1'i success" ile "zaten 1
 * yatırım geldi" arasındaki fark, sorunun bizde mi Lynon'da mı olduğunu
 * tek bakışta söylüyor.
 */
export type SatirDokumu = {
  hamSatir: number;
  /**
   * İlk satırların OKUDUĞUMUZ alanları + satırda bulunan tüm alan
   * ADLARI (değerleri değil).
   *
   * Neden gerekli: "1 kayıt geldi ve tutarı yanlış" durumunda tek soru
   * kalıyor — o satırda tutar hangi alanda duruyor? Alan adları listesi
   * bunu tahmin etmeden gösteriyor; okuduğumuz alan yanlışsa doğrusu
   * listede görünür. Değerler yalnızca zaten kullandığımız alanlar için
   * dönüyor, satırın tamamı DEĞİL.
   */
  ornekler: Array<{
    tur: unknown;
    durum: unknown;
    amount: unknown;
    actualAmount: unknown;
    receivedAmount: unknown;
    tarih: unknown;
    alanlar: string[];
  }>;
  /** transactionType -> adet */
  turler: Record<string, number>;
  /** status -> adet (yalnızca yatırım ve çekim satırları) */
  durumlar: Record<string, number>;
  /** Aralık süzgecine takılan (türü/durumu uygun ama tarihi dışarıda) satır sayısı. */
  aralikDisi: number;
};

export function satirDokumu(
  satirlar: OdemeSatiri[] | null | undefined,
  yatirimAraligi?: Aralik,
  cekimAraligi?: Aralik,
): SatirDokumu {
  const liste = Array.isArray(satirlar) ? satirlar : [];
  const turler: Record<string, number> = {};
  const durumlar: Record<string, number> = {};
  let aralikDisi = 0;

  for (const satir of liste) {
    const tur = metin(satir.transactionType ?? satir.type) || '(boş)';
    turler[tur] = (turler[tur] ?? 0) + 1;

    if (tur !== 'deposit' && tur !== 'withdrawal') continue;
    const durum = metin(satir.status ?? satir.state) || '(boş)';
    durumlar[durum] = (durumlar[durum] ?? 0) + 1;

    // Durumu uygun ama tarihi seçilen aralığın dışında kalanlar: bu sayı
    // büyükse sorun tarih seçiminde, süzgeçte değil.
    if (durum !== BASARILI) continue;
    const aralik = tur === 'deposit' ? yatirimAraligi : cekimAraligi;
    if (!araliktaMi(zaman(satir), aralik)) aralikDisi += 1;
  }

  const ornekler = liste.slice(0, 3).map((satir) => ({
    tur: satir.transactionType ?? satir.type ?? null,
    durum: satir.status ?? satir.state ?? null,
    amount: satir.amount ?? null,
    actualAmount: satir.actualAmount ?? null,
    receivedAmount: satir.receivedAmount ?? null,
    tarih: satir.createdAt ?? satir.creationDate ?? satir.updatedAt ?? null,
    // Yalnızca ADLAR: hangi alanların var olduğunu görmek için yeterli,
    // satırın tamamını dışarı vermeden.
    alanlar: Object.keys(satir ?? {}).sort(),
  }));

  return { hamSatir: liste.length, turler, durumlar, aralikDisi, ornekler };
}
