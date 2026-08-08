import { gunAnahtari, gunAraligi, gunEkle } from '../lib/gunler.js';
import { olcumleriOku, ortakOzetleri } from './olcum.js';
import { ortakAnahtarindanBul } from './ortaklar.js';
import { eslesmeGunlukSayilar } from './oyuncuEslesme.js';
import { tiklamaGunlukSayilar, tiklamaKaynakOzeti } from './tiklama.js';

/**
 * MÜŞTERİ YOLCULUĞU — tıklamadan ilk yatırıma huni.
 *
 * Panel şimdiye kadar tıklama ve ölçüm rakamlarını AYRI ekranlarda
 * gösteriyordu; "kaç tıklamadan kaç kayıt, kaç kayıttan kaç ilk
 * yatırım çıktı" sorusunun cevabı yoktu. Bu servis üç ayrı kaynağı
 * (tıklama, oyuncu eşleşmesi, günlük ölçüm) TEK bir zaman ekseninde
 * birleştiriyor.
 *
 * ── Neden tek kullanıcının yolculuğu değil, huni ──
 *
 * Tek bir oyuncunun tıklama → kayıt → ilk yatırım zincirini birebir
 * izlemek çekici görünüyor ama iki gerçek bunu YANILTICI kılıyor:
 * (1) tıklama ile kayıt arasında saatler, günler geçebiliyor ve aynı
 * kişi başka bir cihazdan/oturumdan kayıt olabiliyor — "bu tıklama bu
 * kaydı ürettiı" iddiası çoğu zaman ispatsız bir varsayım olurdu;
 * (2) ilk yatırım defteri (`ilkYatirim.ts`) yalnızca oyuncunun kimliğini
 * tutuyor, TARİHİNİ değil — belirli bir oyuncunun yatırım anını iddia
 * etmek elimizdeki veriden daha kesin bir şey söylemek olurdu. Huni
 * bunun yerine dürüst olanı yapıyor: her basamağı kendi doğru kaynağından
 * sayıyor ve aralarındaki oranı gösteriyor, birebir bir çizgi çekmiyor.
 *
 * ── Kaynak kırılımı neden yalnızca TIKLAMA seviyesinde ──
 *
 * Oyuncu eşleşmesi `medyaId` ve `alt` (sub1..sub5) taşıyor ama
 * `referrer`'ı taşımıyor — kayıt anında referrer diye bir kavram yok,
 * o yalnızca tıklama anında ölçülüyor. Kaydı "kaynağa" bağlamak, kayıt
 * tablosuna hiç yazılmamış bir alanı var gibi göstermek olurdu. Bu
 * yüzden "trafik nereden geliyor" sorusu TIKLAMA hacmiyle cevaplanıyor;
 * huninin kayıt/ilk-yatırım basamakları kaynağa göre kırılmıyor.
 */

export interface YolculukSorgusu {
  start?: string;
  end?: string;
  /** Boşsa tüm ortaklar birlikte. */
  ortakAnahtari?: string;
}

export interface GunlukAsama {
  gun: string;
  tiklama: number;
  kayit: number;
  /** `null` = bu gün için ilk yatırım ölçülmüyor (kalibrasyon sürüyor). */
  ilkYatirim: number | null;
}

export interface AsamaToplamlari {
  tiklama: number;
  kayit: number;
  /** `null` = dönem boyunca hiçbir gün ölçülemedi; `0` ile KARIŞTIRILMAZ. */
  ilkYatirim: number | null;
  aktifOyuncu: number;
}

export interface DonusumOranlari {
  /** Yüzde, 0-100. Tıklama yoksa `null` — %0 anlamsız bir iddia olurdu. */
  tiklamaKayit: number | null;
  /** Kayıt yoksa ya da ilk yatırım ölçülmüyorsa `null`. */
  kayitIlkYatirim: number | null;
}

export interface KaynakSatiri {
  kaynak: string;
  tiklama: number;
  /** Toplam tıklama içindeki payı, 0-100. */
  yuzde: number;
}

export interface MusteriYolculuguSonucu {
  aralik: { start: string; end: string };
  gunluk: GunlukAsama[];
  toplam: AsamaToplamlari;
  donusum: DonusumOranlari;
  /** En çok tıklama getiren kaynaklar; kalanı "Diğer kaynaklar" satırında. */
  kaynaklar: KaynakSatiri[];
}

const KAYNAK_ADEDI = 8;

function oranHesapla(pay: number, payda: number): number | null {
  if (!payda) return null;
  return Math.round((pay / payda) * 1000) / 10;
}

export async function musteriYolculugu(
  kiraci: string,
  sorgu: YolculukSorgusu = {},
): Promise<MusteriYolculuguSonucu> {
  const end = sorgu.end || gunAnahtari();
  const start = sorgu.start || gunEkle(end, -29);

  // Ortak anahtari kayit tablosunda `ortakId`ye cevriliyor; eslesme
  // depoya bu anahtarla degil kalici kimlikle yaziliyor (bkz.
  // `oyuncuEslesme.ts` — anahtar degisebiliyor, kimlik degismiyor).
  // Anahtar hicbir ortakla eslesmiyorsa kayit sayaci durustce SIFIR
  // doner; bu bir hata degil, filtrenin kendisi gecersiz demek.
  const ortak = sorgu.ortakAnahtari ? await ortakAnahtarindanBul(kiraci, sorgu.ortakAnahtari) : null;
  const ortakId = ortak?.id;

  const [tiklamaGunler, kayitGunler, olcumler, ozetler, kaynakSatirlari] = await Promise.all([
    tiklamaGunlukSayilar(kiraci, { start, end, ortakAnahtari: sorgu.ortakAnahtari }),
    eslesmeGunlukSayilar(kiraci, { start, end, ...(ortakId ? { ortakId } : {}) }),
    olcumleriOku(kiraci, { start, end, ortakAnahtari: sorgu.ortakAnahtari }),
    ortakOzetleri(kiraci, { start, end, ortakAnahtari: sorgu.ortakAnahtari }),
    tiklamaKaynakOzeti(kiraci, { start, end, ortakAnahtari: sorgu.ortakAnahtari }),
  ]);

  const tiklamaMap = new Map(tiklamaGunler.map((g) => [g.gun, g.sayi]));
  const kayitMap = new Map(kayitGunler.map((g) => [g.gun, g.sayi]));

  // Gunluk FTD: birden fazla ortak varsa (anahtar filtresi yoksa) o
  // gunun butun ortak satirlari toplaniyor. Hicbiri olculmediyse `null`,
  // BIRI bile olculduyse olculmeyenler 0 sayiliyor — `olcum.ts`teki
  // `ozetle()` ile ayni null-guvenli yaklasim.
  const ftdMap = new Map<string, number>();
  const ftdOlculduGunler = new Set<string>();
  for (const o of olcumler) {
    if (o.ftdSayisi === null) continue;
    ftdMap.set(o.gun, (ftdMap.get(o.gun) ?? 0) + o.ftdSayisi);
    ftdOlculduGunler.add(o.gun);
  }

  const gunluk: GunlukAsama[] = gunAraligi(start, end).map((gun) => ({
    gun,
    tiklama: tiklamaMap.get(gun) ?? 0,
    kayit: kayitMap.get(gun) ?? 0,
    ilkYatirim: ftdOlculduGunler.has(gun) ? (ftdMap.get(gun) ?? 0) : null,
  }));

  const toplamTiklama = gunluk.reduce((t, g) => t + g.tiklama, 0);
  const toplamKayit = gunluk.reduce((t, g) => t + g.kayit, 0);
  // Toplamlar ozetler'den: o fonksiyon ortak-basina "ilk hicbiri
  // olculmediyse null" kuralini zaten dogru uyguluyor; burada tekrar
  // yazmak iki yerde ayni mantigi bakimda birbirinden koparma riski
  // tasirdi.
  const ftdOlculenVarMi = ozetler.some((o) => o.ftdSayisi !== null);
  const toplamFtd = ftdOlculenVarMi ? ozetler.reduce((t, o) => t + (o.ftdSayisi ?? 0), 0) : null;
  const toplamAktif = ozetler.reduce((t, o) => t + o.aktifOyuncuSayisi, 0);

  const toplam: AsamaToplamlari = {
    tiklama: toplamTiklama,
    kayit: toplamKayit,
    ilkYatirim: toplamFtd,
    aktifOyuncu: toplamAktif,
  };

  const donusum: DonusumOranlari = {
    tiklamaKayit: oranHesapla(toplamKayit, toplamTiklama),
    kayitIlkYatirim: toplamFtd === null ? null : oranHesapla(toplamFtd, toplamKayit),
  };

  const sirali = [...kaynakSatirlari].sort((a, b) => b.sayi - a.sayi);
  const ustSira = sirali.slice(0, KAYNAK_ADEDI);
  const kalanToplam = sirali.slice(KAYNAK_ADEDI).reduce((t, k) => t + k.sayi, 0);

  const kaynaklar: KaynakSatiri[] = ustSira.map((k) => ({
    kaynak: k.kaynak,
    tiklama: k.sayi,
    yuzde: oranHesapla(k.sayi, toplamTiklama) ?? 0,
  }));
  if (kalanToplam > 0) {
    kaynaklar.push({
      kaynak: 'Diğer kaynaklar',
      tiklama: kalanToplam,
      yuzde: oranHesapla(kalanToplam, toplamTiklama) ?? 0,
    });
  }

  return { aralik: { start, end }, gunluk, toplam, donusum, kaynaklar };
}
