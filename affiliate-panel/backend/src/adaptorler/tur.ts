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
  | 'odeme-yontemleri'
  /** Gün bazında OYUNCU düzeyinde veri okuyabiliyor (BTag'e bakmadan). */
  | 'gecmis-doldurma'
  /** Bir oyuncunun en son bonus verilişini ya da bakiye düzeltmesini okuyabiliyor. */
  | 'son-bonus-duzeltme';

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
   * olurdu; uydurmak komisyon hesabını bozar.
   *
   * Adaptör bunu doğrudan biliyorsa yazar. Bilmiyorsa `null` bırakıp
   * `yatiranOyuncular` doldurur — çekirdek o listeden TÜRETİR.
   */
  ftdSayisi: number | null;
  /**
   * O gün yatırım yapan oyuncu kimlikleri.
   *
   * Backoffice "ilk yatırım" alanı vermiyor ama oyuncu bazında satır
   * veriyorsa, bilgi burada saklı: daha önce hiç yatırım yapmamış bir
   * kimlik, ilk yatırımını o gün yapmıştır. Çekirdek bir defter tutup
   * FTD'yi buradan hesaplıyor (bkz. `servisler/ilkYatirim.ts`).
   *
   * Veremeyen adaptörlerde boş; o durumda FTD `null` kalır.
   */
  yatiranOyuncular?: string[];
  /**
   * Ölçümün geldiği dikey.
   *
   * OPSİYONEL: mevcut adaptörlerin hiçbiri doldurmuyor ve doldurmak
   * zorunda değil. Boş bırakılırsa çekirdek `bilinmiyor` yazıyor ve
   * plandaki düz orana düşüyor — bugünkü davranış birebir korunuyor.
   *
   * Bir adaptör dikey vermeye başladığı gün YENİ satırlar ayrışıyor,
   * eski satırlar olduğu gibi kalıyor. Geriye dönük yeniden
   * yorumlama yok: bir ayın ödemesi kesinleştikten sonra o ayın
   * kırılımının değişmesi, kesinleşmiş bir rakamı oynatmak olurdu.
   */
  dikey?: 'casino' | 'spor' | 'bilinmiyor';
}

/**
 * Adaptörün OYUNCU düzeyinde döndürdüğü ham günlük veri. `HamOlcum`dan
 * farkı: BTag'e göre GRUPLANMAMIŞ, BTag'i olmayan satırlar da dahil.
 *
 * Neden gerekli: panel Lynon'un third-party affiliate kaydına hiç
 * katılmıyor, dolayısıyla `gunuCek`in filtrelediği "BTag'siz" satırların
 * büyük kısmı aslında BU panelin trafiği. Atfı Lynon'un BTag'i değil,
 * panelin kendi `oyuncu_eslesmeleri` kaydı belirliyor; bu yüzden ham
 * veri oyuncu bazında, atıfsız geliyor (bkz. `servisler/gecmisGGR.ts`).
 */
export interface HamOyuncuGunu {
  oyuncuId: string;
  yatirim: number;
  cekim: number;
  bahis: number;
  kazanc: number;
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
   * Kullanıcı adından backoffice oyuncu kimliğini bulur.
   *
   * `oyuncuyuBagla` yalnızca kimliği kabul ediyor; toplu geçişte elde
   * olan tek şey kullanıcı adı. Bu, o kimliği bulan adım — `oyuncu-baglama`
   * yeteneğiyle BİRLİKTE var olması bekleniyor, ayrı bir yetenek değil.
   *
   * Tam eşleşme YOKSA `null` döner, en yakın adayı DÖNMEZ: Lynon araması
   * bulanık, "test" sorgusu "test777" hesabını da getirebilir. Yanlış
   * oyuncuyu bir ortağa bağlamak, o oyuncunun tüm geçmiş ve gelecek
   * kazancını yanlış kişiye yazdırır.
   *
   * `kayitTarihi`, backoffice yanıtında bulunabilirse oyuncunun GERÇEK
   * Lynon kayıt anı (ISO); yoksa `null` — çağıran taraf bu durumda kendi
   * eşleşme kaydının oluşturulma anına düşer (bkz. `oyuncuEslesme.ts`).
   */
  oyuncuAra?(kullaniciAdi: string): Promise<{ oyuncuId: string; kullaniciAdi: string; kayitTarihi: string | null } | null>;
  /**
   * Sitenin gerçek ödeme yöntemleri.
   *
   * Ortağın ödeme yöntemini serbest metin olarak yazması, "Papara",
   * "papara", "PAPARA TR" gibi üç ayrı değer üretiyor ve ödeme günü
   * hangisinin hangisi olduğu elle çözülüyordu. Backoffice'in kendi
   * listesinden seçtirmek bu belirsizliği kaynağında bitiriyor.
   */
  odemeYontemleri?(): Promise<string[]>;
  /**
   * Bir günün OYUNCU bazlı ham verisi; BTag'e bakmadan, filtresiz.
   *
   * Geçmişe dönük GGR doldurma bunu kullanıyor: atfı Lynon'un BTag'i
   * değil, panelin kendi eşleşme kaydı yapıyor (bkz. `HamOyuncuGunu`).
   */
  oyuncuGunuCek?(gun: string): Promise<HamOyuncuGunu[]>;
  /**
   * Bir oyuncuya en son verilen bonus YA DA en son bakiye düzeltmesi,
   * hangisi daha yeniyse.
   *
   * Ortak, kendisine geçirilen ya da kayıt olan bir oyuncuya destek
   * ekibinin ne zaman/ne verdiğini portalda hiç göremiyordu. İkisi
   * ayrı Lynon uçları; ortak için tek "en son ne oldu" sorusuna
   * indirgeniyor, hangisi olduğunu `tur` alanı taşıyor.
   *
   * Hiçbiri yoksa (ya da uç hata verirse) `null` — "hiç yok" ile
   * "sorgulanamadı" arasındaki fark burada önemsiz, ikisi de ortak
   * ekranında aynı boş satır.
   */
  sonBonusVeyaDuzeltme?(oyuncuId: string): Promise<SonBonusVeyaDuzeltme | null>;
}

export interface SonBonusVeyaDuzeltme {
  tur: 'bonus' | 'duzeltme';
  ad: string;
  tutar: number;
  tarih: string;
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
