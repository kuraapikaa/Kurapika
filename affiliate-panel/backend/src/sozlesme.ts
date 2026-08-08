/**
 * API SÖZLEŞMESİ — sunucu ile arayüz arasındaki TEK kaynak.
 *
 * Buradan önce arayüz her yanıt şeklini elle yazıyordu: 41 adet
 * `interface` sunucudaki karşılığının kopyasıydı ve aralarında hiçbir
 * bağ yoktu. Sunucuda bir alan adı değiştiğinde derleyici susuyor,
 * hata çalışma anında ve genelde üretimde çıkıyordu.
 *
 * ── Neden ayrı bir dosya, neden servisten doğrudan import değil ──
 *
 * Arayüzün servis içlerine uzanması, iç yapıyı sözleşmeye çevirirdi:
 * bir servisi bölmek arayüzü kırardı. Bu dosya kasıtlı bir sınır —
 * dışarıya ne söz verdiğimiz burada yazılı ve tek bakışta okunuyor.
 *
 * ── Çalışma anında maliyeti yok ──
 *
 * Arayüz bunları `import type` ile alıyor; tipler derlemede siliniyor
 * ve sunucu kodundan pakete hiçbir şey girmiyor.
 *
 * KURAL: bir uç yeni bir şekil döndürüyorsa şekli BURAYA yazın.
 * Rotanın içinde satır içi tanımlamak, sözleşmeyi tekrar görünmez
 * kılar.
 */

import type { Baglanti } from './adaptorler/kayit.js';
import type { AdaptorAlani, AdaptorYetenegi } from './adaptorler/tur.js';
import type { AltLink } from './servisler/altLink.js';
import type { Donem, OrtakHakedisi } from './servisler/hakedis.js';
import type { KademeBagi } from './servisler/kademeler.js';
import type { KomisyonPlani } from './servisler/komisyon.js';
import type { Medya, MedyaTuru } from './servisler/medya.js';
import type { OrtakGunlukOlcum, OrtakOzeti } from './servisler/olcum.js';
import type { OrtakDurumu, OrtakGorunumu } from './servisler/ortaklar.js';
import type { OtoBonusAyari, OtoBonusDurumuYaniti, OtoBonusKaydi } from './servisler/otoBonus.js';
import type { AltLinkOyuncusu, EslesmeCakismasi, OyuncuEslesmesi } from './servisler/oyuncuEslesme.js';
import type { TopluAtamaSatiri, TopluAtamaSonucu } from './servisler/topluAtama.js';
import type { PostbackAyari, PostbackKaydi } from './servisler/postback.js';
import type { KuyrukOzeti } from './depolar/olayKuyrugu.js';
import type { SirDurumu } from './servisler/webhookSirri.js';
import type { SiteAdresiDurumu } from './servisler/siteAdresi.js';
import type { CuzdanHareketi, OrtakBakiyesi } from './servisler/cuzdan.js';
import type { AnahtarDurumu } from './servisler/s2sAnahtari.js';
import type { SenkronSonucu } from './servisler/senkron.js';
import type { Tiklama, TiklamaOzeti } from './servisler/tiklama.js';
import type { KaliteSinyali } from './servisler/trafikKalitesi.js';
import type { MusteriYolculuguSonucu } from './servisler/yolculuk.js';
import type { Marka } from './rotalar/marka.js';

/* ── Alan tipleri; arayüz bunları doğrudan kullanıyor ────────────── */
export type {
  AdaptorAlani, AdaptorYetenegi, AltLink, Baglanti, Donem, KademeBagi,
  KaliteSinyali, KomisyonPlani, Marka, Medya, MedyaTuru, MusteriYolculuguSonucu, OrtakDurumu,
  OrtakGorunumu, OrtakGunlukOlcum, OrtakHakedisi, OrtakOzeti, OtoBonusAyari,
  OtoBonusDurumuYaniti, OtoBonusKaydi, PostbackAyari, PostbackKaydi, SenkronSonucu,
  Tiklama, TiklamaOzeti, TopluAtamaSatiri, TopluAtamaSonucu, SiteAdresiDurumu, AltLinkOyuncusu,
};

/* ── Oturum ──────────────────────────────────────────────────────── */

export interface OturumYaniti {
  girisli: boolean;
  rol?: 'yonetici' | 'ortak';
  ad?: string;
  kiraci?: string;
  ortakAnahtari?: string | null;
}

/* ── Yönetim ─────────────────────────────────────────────────────── */

export interface AdaptorTanimGorunumu {
  ad: string;
  etiket: string;
  aciklama: string;
  yetenekler: AdaptorYetenegi[];
  alanlar: AdaptorAlani[];
}

export type BaglantiGorunumu =
  | { kurulu: false }
  | {
      kurulu: true;
      adaptor: string;
      etiket: string;
      aktif: boolean;
      updatedAt: string;
      /** Sır alanları MASKELİ; düz değer buradan asla dönmez. */
      ayar: Record<string, string>;
    };

export interface OdemeYontemleriYaniti {
  yontemler: string[];
  kaynak: 'backoffice' | 'yok' | 'hata';
  mesaj?: string;
}

export interface FtdDurumu {
  olculuyorMu: boolean;
  olcumBaslangici: string | null;
  defterdekiOyuncu: number;
}

export interface KaliteRaporGorunumu {
  ortakAnahtari: string;
  ortakAdi: string;
  durum: OrtakDurumu;
  tiklama: number;
  oyuncu: number;
  /** `null` = veri yetersiz; uydurulmuş bir skor yokluğundan kötüdür. */
  riskSkoru: number | null;
  sinyaller: KaliteSinyali[];
  skorsuzlukSebebi: string | null;
  bant: 'veri-yok' | 'dusuk' | 'orta' | 'yuksek';
}

export interface BtagAnahtari {
  anahtar: string;
  ortakAdi: string;
  durum: OrtakDurumu;
  olcumVar: boolean;
  tiklamaVar: boolean;
}

export interface SahipsizAnahtar {
  anahtar: string;
  gunSayisi: number;
  ggr: number;
  yatirim: number;
  sonGun: string | null;
}

export interface YonetimUclari {
  '/adaptorler': { adaptorler: AdaptorTanimGorunumu[] };
  '/baglanti': BaglantiGorunumu;
  '/odeme-yontemleri': OdemeYontemleriYaniti;
  '/ftd-durumu': FtdDurumu;
  '/ozet': { bugun: string; ozetler: OrtakOzeti[] };
  '/olcumler': { olcumler: OrtakGunlukOlcum[] };
  '/ortaklar': { ortaklar: OrtakGorunumu[] };
  '/basvurular': { basvurular: OrtakGorunumu[] };
  '/planlar': { planlar: KomisyonPlani[] };
  '/site-adresi': SiteAdresiDurumu;
  '/medya': { medyalar: Medya[] };
  '/kademeler': { baglar: KademeBagi[]; kademeYuzdeleri: number[] };
  '/postback': { ayarlar: PostbackAyari[]; kayitlar: PostbackKaydi[] };
  '/oto-bonus': OtoBonusDurumuYaniti;
  '/yolculuk': MusteriYolculuguSonucu;
  '/tiklamalar': { ozet: TiklamaOzeti[]; tiklamalar: Tiklama[] };
  '/trafik-kalitesi': { raporlar: KaliteRaporGorunumu[] };
  '/btag': { anahtarlar: BtagAnahtari[]; sahipsiz: SahipsizAnahtar[]; olcumsuzSayisi: number };
  '/donemler': { donemler: Array<Omit<Donem, 'satirlar'>> };
  '/webhook-durumu': { sir: SirDurumu; kuyruk: KuyrukOzeti; veritabaniVarMi: boolean };
  '/cuzdanlar': {
    bakiyeler: Array<OrtakBakiyesi & { ortakAdi: string | null }>;
    hareketler: Array<CuzdanHareketi & { ortakAdi: string | null }>;
    veritabaniVarMi: boolean;
  };
  '/oyuncu-eslesmeleri': {
    eslesmeler: EslesmeGorunumu[];
    cakismalar: CakismaGorunumu[];
    anahtar: AnahtarDurumu;
  };
  '/oyuncu-eslesmeleri/toplu-atama-siniri': { limit: number };
}

/**
 * Eşleşmeye ortağın ADI ekleniyor.
 *
 * Depoda yalnızca `ortakId` var; ekranda kimlik göstermek okunamaz.
 * Birleştirme sunucuda yapılıyor: arayüzün ortak listesini ayrıca çekip
 * eşleştirmesi, iki isteğin arasında eklenen bir ortakta boş satır
 * gösterirdi.
 */
export interface EslesmeGorunumu extends OyuncuEslesmesi {
  ortakAdi: string | null;
}

export interface CakismaGorunumu extends EslesmeCakismasi {
  denenenOrtakAdi: string | null;
  mevcutOrtakAdi: string | null;
}

/* ── Ortak portali ───────────────────────────────────────────────── */

export interface PortalBen {
  ad: string;
  eposta: string;
  ortakAnahtari: string;
  durum: OrtakDurumu;
  odemeYontemi: string | null;
  odemeDetayi: string | null;
}

/** Alt link + sunucuda hesaplanan alanlar. */
export interface AltLinkGorunumu extends AltLink {
  /** Tam adres SUNUCUDA kuruluyor; arayüz kökü tahmin etmemeli. */
  tamAdres: string | null;
  medyaAdi: string | null;
  tiklama: number;
  sonTiklama: string | null;
  /** Bu linkten gelip bir oyuncuya eşleşen kayıt sayısı. */
  oyuncuSayisi: number;
  yatirim: number;
  cekim: number;
}

export interface PortalUclari {
  '/ben': PortalBen;
  '/ozet': {
    aralik: { start: string; end: string };
    ozet: OrtakOzeti;
    altOrtaklar: string[];
    ftd: FtdDurumu;
  };
  '/medya': { medyalar: Medya[] };
  '/alt-linkler': { linkler: AltLinkGorunumu[]; temelHazir: boolean };
  '/tiklamalar': { ozet: TiklamaOzeti | null; tiklamalar: Tiklama[] };
  '/hakedis': { donemler: Array<{ ay: string; durum: Donem['durum']; satir: OrtakHakedisi | null }> };
  '/postback': { ayar: PostbackAyari | null; kayitlar: PostbackKaydi[] };
  '/yolculuk': MusteriYolculuguSonucu;
}

/* ── Yardımcılar ─────────────────────────────────────────────────── */

/** `useVeri<YonetimYaniti<'/ortaklar'>>('/api/yonetim/ortaklar')` */
export type YonetimYaniti<Y extends keyof YonetimUclari> = YonetimUclari[Y];
export type PortalYaniti<Y extends keyof PortalUclari> = PortalUclari[Y];
