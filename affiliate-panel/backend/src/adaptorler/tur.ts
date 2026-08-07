/**
 * BACKOFFICE ADAPTÖR SÖZLEŞMESİ.
 *
 * Bu panelin mimarisindeki tek asıl karar burası. Panel, Lynon'a ya da
 * başka bir backoffice'e ÜÇÜNCÜ TARAF olarak bağlanıyor; onun bir
 * parçası değil. Bunun anlamı: hiçbir servis, hiçbir ekran, hiçbir
 * komisyon hesabı Lynon'un alan adlarını bilmiyor.
 *
 * Sınır tek bir yerde: adaptör. Adaptör dışarının şeklini içerinin
 * modeline çeviriyor. Yeni bir backoffice eklemek, bu dosyadaki
 * arayüzü uygulayan bir dosya yazmaktan ibaret — çekirdek, depo,
 * komisyon ve arayüzün hiçbiri değişmiyor.
 *
 * Karşı seçenek, Lynon'un şemasını içeride kullanmaktı. Kısa vadede
 * daha az kod, uzun vadede kilitlenme: ikinci backoffice geldiğinde
 * tüm sistemi çevirmek gerekirdi. Bir affiliate paneli tanımı gereği
 * birden çok markaya bakar; tek sağlayıcıya gömmek baştan yanlış olur.
 */

/** Adaptörün panelde hangi düğmeleri açacağını belirler. */
export type AdaptorYetenegi =
  /** Gün bazında ortak performansı okuyabiliyor. */
  | 'olcum-cekme'
  /** Backoffice'teki ortak listesini okuyabiliyor. */
  | 'ortak-listesi'
  /** Bir oyuncuyu bir ortağa bağlayabiliyor. */
  | 'oyuncu-baglama'
  /** Sitenin gerçek ödeme yöntemlerini listeleyebiliyor. */
  | 'odeme-yontemleri';

export type AlanTuru = 'metin' | 'parola' | 'sayi' | 'secim' | 'cokSatir';

export interface AdaptorAlani {
  ad: string;
  etiket: string;
  tur: AlanTuru;
  zorunlu: boolean;
  /** Şifreli saklanır ve panele asla düz dönmez. */
  sir: boolean;
  ipucu?: string;
  varsayilan?: string;
  secenekler?: Array<{ deger: string; etiket: string }>;
}

/** Adaptörün çekirdek modele çevirdiği ham ölçüm. Kaynak etiketi yok. */
export interface HamOlcum {
  gun: string;
  ortakAnahtari: string;
  oyuncuSayisi: number;
  aktifOyuncuSayisi: number;
  yatirim: number;
  cekim: number;
  ggr: number;
  /**
   * İlk yatırımını o gün yapan oyuncu sayısı.
   *
   * `null` = ÖLÇÜLEMEDİ. Sıfır yazmak "hiç ilk yatırım olmadı" demek
   * olurdu; toplam düzeyinde rapor veren backoffice'lerde bu bilgi
   * gerçekten yok ve uydurmak komisyon hesabını bozar.
   */
  ftdSayisi: number | null;
}

export interface HamOrtak {
  /** Backoffice tarafındaki izleme anahtarı (Lynon'da BTag). */
  ortakAnahtari: string;
  ad: string | null;
  eposta: string | null;
  durum: string | null;
}

export interface OyuncuBagi {
  oyuncuId: string;
  ortakAnahtari: string;
  /** Backoffice'e özgü ek alanlar; adaptör kendi şemasına çevirir. */
  ek?: Record<string, string>;
}

export interface AdaptorDurumu {
  baglandi: boolean;
  mesaj: string;
  /** Teşhis için; sır İÇERMEZ. */
  ayrinti?: Record<string, unknown>;
}

export interface BackofficeAdaptoru {
  readonly tanimAdi: string;
  dogrula(): Promise<AdaptorDurumu>;
  gunuCek(gun: string): Promise<HamOlcum[]>;
  ortaklariListele?(): Promise<HamOrtak[]>;
  oyuncuyuBagla?(girdi: OyuncuBagi): Promise<{ basarili: boolean; mesaj: string }>;
  /**
   * Sitenin gerçek ödeme yöntemleri.
   *
   * Ortağın ödeme yöntemini serbest metin olarak yazması, "Papara",
   * "papara", "PAPARA TR" gibi üç ayrı değer üretiyor ve ödeme günü
   * hangisinin hangisi olduğu elle çözülüyordu. Backoffice'in kendi
   * listesinden seçtirmek bu belirsizliği kaynağında bitiriyor.
   */
  odemeYontemleri?(): Promise<string[]>;
}

export interface AdaptorTanimi {
  /** Bağlantı kaydında saklanan kararlı kimlik. */
  ad: string;
  etiket: string;
  aciklama: string;
  yetenekler: AdaptorYetenegi[];
  alanlar: AdaptorAlani[];
  olustur(ayar: Record<string, string>): BackofficeAdaptoru;
}

export class AdaptorHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'AdaptorHatasi';
  }
}

export const sayi = (deger: unknown): number => {
  const n = Number(deger);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Zorunlu alanları kontrol eder.
 *
 * Eksik alanla adaptör kurmaya izin vermek, hatayı ilk senkron turuna
 * — yani saatler sonrasına — erteler. Kurulum hatası kurulum anında
 * görünmeli.
 */
export function ayarlariDogrula(tanim: AdaptorTanimi, ayar: Record<string, string>): void {
  const eksik = tanim.alanlar
    .filter((alan) => alan.zorunlu && !String(ayar[alan.ad] ?? '').trim())
    .map((alan) => alan.etiket);
  if (eksik.length) {
    throw new AdaptorHatasi(`Şu alanlar zorunlu: ${eksik.join(', ')}`);
  }
}
