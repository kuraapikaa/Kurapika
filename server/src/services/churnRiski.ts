/**
 * OYUNCU KAYBI (CHURN) RİSK MOTORU.
 *
 * Bir oyuncunun siteyi bırakmak üzere olup olmadığını ödeme ve oyun
 * hareketlerinden tahmin eder, operatöre SIRALI bir çalışma listesi
 * verir.
 *
 * ── Neden kural tabanlı, model değil ──────────────────────────────────
 * Elde etiketli bir eğitim verisi yok: "bu oyuncu gitti" diye
 * işaretlenmiş bir geçmiş tutulmuyor. Öğrenen bir model kurmak, önce o
 * etiketi uydurmak demekti ve uydurulmuş etiketle eğitilen model kendi
 * varsayımını doğrular. Bunun yerine sinyaller AÇIK: her puanın yanında
 * neden verildiği yazıyor, operatör katılmadığında tartışabiliyor.
 *
 * ── Sinyaller ─────────────────────────────────────────────────────────
 * En güçlüsü RİTİM KIRILMASI. Mutlak sessizlik süresi yanıltıcıdır:
 * ayda bir yatıran oyuncu için 10 gün normal, her gün yatıran için
 * alarmdır. Bu yüzden sessizlik, oyuncunun KENDİ ortalama aralığına
 * bölünerek ölçülüyor.
 *
 * Diğerleri: hacim düşüşü, çekimle çıkış, büyük kayıp şoku ve mutlak
 * sessizlik. Beşi ağırlıklı toplanıp 0–100 arası bir risk veriyor.
 *
 * ── Neden risk tek başına yetmez ──────────────────────────────────────
 * %90 riskli ama ayda 200 ₺ yatıran bir oyuncuyla %60 riskli ama ayda
 * 50.000 ₺ yatıran oyuncu aynı listede yan yana durmamalı. Risk DEĞERLE
 * çarpılıp öncelik üretiliyor; operatörün sınırlı zamanı en çok kaybı
 * önleyecek yere gidiyor.
 */

import { paraSayisi } from './odemeTutari.js';

export type IslemSatiri = {
  /** 'deposit' | 'withdrawal' */
  tur: string;
  /** Yalnızca 'success' sayılır. */
  durum: string;
  tutar: number;
  /** ISO tarih. */
  tarih: string;
};

export type OyuncuGirdisi = {
  login: string;
  playerId?: number | string;
  /** Başarılı yatırım/çekim hareketleri. */
  islemler: IslemSatiri[];
  /** Son oyun/bahis anı (ISO). Yoksa yalnızca ödeme sinyalleri kullanılır. */
  sonAktiflik?: string | null;
  /** Kayıt tarihi (ISO). Yeni oyuncuyu "riskli" saymamak için. */
  kayitTarihi?: string | null;
  /** Mevcut bakiye — sıfıra yakınsa çıkış ihtimali artar. */
  bakiye?: number | null;
};

export type RiskBileseni = {
  anahtar: 'ritim' | 'sessizlik' | 'dususs' | 'cekimleCikis' | 'kayipSoku';
  ad: string;
  /** 0–100 arası ham puan. */
  puan: number;
  /** Toplam risk içindeki ağırlığı. */
  agirlik: number;
  /** Operatöre gösterilecek gerekçe. Boşsa bileşen tetiklenmemiştir. */
  gerekce: string;
};

export type Segment = 'saglikli' | 'izle' | 'riskli' | 'kritik' | 'kayip' | 'yeni' | 'veriYok';

export type OneriAnahtari =
  | 'bekle'
  | 'kayipBonusu'
  | 'yatirimBonusu'
  | 'freespin'
  | 'ara'
  | 'vipTemas'
  | 'geriKazanim';

export type ChurnSonucu = {
  login: string;
  playerId?: number | string;
  segment: Segment;
  /** 0–100. */
  risk: number;
  /** Risk × değer. Listeyi bu sıralar. */
  oncelik: number;
  bilesenler: RiskBileseni[];
  olculer: {
    sonYatirimGun: number | null;
    sonAktiflikGun: number | null;
    ortalamaAralikGun: number | null;
    gecikmeOrani: number | null;
    sonDonemYatirim: number;
    oncekiDonemYatirim: number;
    dususYuzdesi: number | null;
    yatirimSayisi: number;
    omurBoyuYatirim: number;
    netKayip: number;
    sonIslemCekimMi: boolean;
    uyelikGun: number | null;
  };
  /** Değer katmanı — öneriyi ve önceliği belirler. */
  degerKatmani: 'yuksek' | 'orta' | 'dusuk';
  oneri: OneriAnahtari;
  oneriMetni: string;
  /** Tek cümlelik özet: operatör listeyi tarayarak okuyor. */
  ozet: string;
};

const GUN_MS = 86_400_000;

/**
 * Bileşen GÜCÜ — ağırlıklı ortalama değil, kanıt gücü.
 *
 * Önce ağırlıklı ortalama kullanılıyordu ve yanlış davranıyordu: üç
 * günde bir yatıran, 20 gündür ortada olmayan bir oyuncu 44 puan
 * alıyordu ("izle"). Sebebi şuydu -- ritim bileşeni tavana vurmuş
 * olmasına rağmen, sıfır olan diğer dört bileşen toplamı aşağı
 * çekiyordu. Oysa "hacmi düşmemiş" ve "çekim yapmamış" olmak, ritmini
 * tamamen bırakmış bir oyuncuyu MASUM yapmaz.
 *
 * Artık bileşenler birbirini SULANDIRMIYOR, destekliyor: her biri
 * bağımsız bir kanıt sayılıp olasılık gibi birleştiriliyor
 * (`1 - Π(1 - p·g)`). Tek başına güçlü bir sinyal yüksek risk
 * üretebiliyor, birden fazla sinyal ise birikiyor.
 *
 * Sayılar 0–1 arası "bu sinyal tek başına ne kadar belirleyici"
 * demektir; toplamlarının 1 olması gerekmiyor.
 */
export const AGIRLIKLAR: Record<RiskBileseni['anahtar'], number> = {
  // Ritim kirilmasi churn'un TANIMINA en yakin sinyal.
  ritim: 0.85,
  sessizlik: 0.60,
  dususs: 0.45,
  cekimleCikis: 0.35,
  kayipSoku: 0.30,
};

export type Esikler = {
  /** Bu günden yeni oyuncu "yeni" sayılır; ritmi henüz oluşmamıştır. */
  yeniUyelikGun: number;
  /** Bu kadar gün sessiz kalan artık "kayıp" — geri kazanım kampanyası işi. */
  kayipGun: number;
  /** Ritim hesabı için gereken en az yatırım sayısı. */
  enAzYatirim: number;
  /** Son dönem penceresi (gün). */
  donemGun: number;
};

export const VARSAYILAN_ESIKLER: Esikler = {
  yeniUyelikGun: 14,
  kayipGun: 60,
  enAzYatirim: 3,
  donemGun: 30,
};

function gunFarki(aMs: number, bMs: number): number {
  return Math.max(0, Math.floor((aMs - bMs) / GUN_MS));
}

function zaman(iso: unknown): number {
  const t = Date.parse(String(iso ?? ''));
  return Number.isFinite(t) ? t : Number.NaN;
}

/**
 * Ortanca (medyan) — ortalama DEĞİL.
 *
 * Tek bir uzun tatil ortalamayı yukarı çekip "bu oyuncunun ritmi zaten
 * seyrek" dedirtir ve gerçek kırılmayı gizler. Ortanca o tek aykırı
 * değerden etkilenmiyor.
 */
export function ortanca(sayilar: number[]): number | null {
  const liste = sayilar.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (liste.length === 0) return null;
  const orta = Math.floor(liste.length / 2);
  return liste.length % 2 ? liste[orta] : (liste[orta - 1] + liste[orta]) / 2;
}

/** 0–100 arasına kırpar. */
function kirp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Yatırım aralıklarının ortancası — oyuncunun KENDİ ritmi.
 *
 * En az `enAzYatirim` yatırım gerekiyor: iki yatırımdan tek bir aralık
 * çıkar ve tek gözlemle "ritim" demek, gürültüyü kural sanmaktır.
 */
export function yatirimRitmi(yatirimlar: IslemSatiri[], enAz: number): number | null {
  const anlar = yatirimlar
    .map((y) => zaman(y.tarih))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (anlar.length < enAz) return null;

  const araliklar: number[] = [];
  for (let i = 1; i < anlar.length; i += 1) {
    araliklar.push((anlar[i] - anlar[i - 1]) / GUN_MS);
  }
  const orta = ortanca(araliklar);
  // Gunde birden fazla yatiran oyuncuda aralik 0'a yaklasiyor; 0'a
  // bolmemek icin taban 0.5 gun.
  return orta == null ? null : Math.max(0.5, orta);
}

export function churnRiskiHesapla(
  girdi: OyuncuGirdisi,
  simdiMs: number = Date.now(),
  esikler: Esikler = VARSAYILAN_ESIKLER,
): ChurnSonucu {
  const basarili = (girdi.islemler ?? []).filter(
    (i) => String(i?.durum ?? '').toLowerCase() === 'success',
  );
  const yatirimlar = basarili
    .filter((i) => String(i.tur ?? '').toLowerCase() === 'deposit')
    .sort((a, b) => zaman(a.tarih) - zaman(b.tarih));
  const cekimler = basarili.filter((i) => String(i.tur ?? '').toLowerCase() === 'withdrawal');

  const sonYatirimAn = yatirimlar.length ? zaman(yatirimlar[yatirimlar.length - 1].tarih) : Number.NaN;
  const sonYatirimGun = Number.isFinite(sonYatirimAn) ? gunFarki(simdiMs, sonYatirimAn) : null;

  const sonAktiflikAn = zaman(girdi.sonAktiflik);
  const sonAktiflikGun = Number.isFinite(sonAktiflikAn) ? gunFarki(simdiMs, sonAktiflikAn) : null;

  const kayitAn = zaman(girdi.kayitTarihi);
  const uyelikGun = Number.isFinite(kayitAn) ? gunFarki(simdiMs, kayitAn) : null;

  const omurBoyuYatirim = yatirimlar.reduce((t, y) => t + Math.abs(paraSayisi(y.tutar)), 0);
  const omurBoyuCekim = cekimler.reduce((t, c) => t + Math.abs(paraSayisi(c.tutar)), 0);
  const netKayip = Math.round((omurBoyuYatirim - omurBoyuCekim) * 100) / 100;

  // Son dönem / önceki dönem hacmi.
  const donemMs = esikler.donemGun * GUN_MS;
  const donemBas = simdiMs - donemMs;
  const oncekiBas = simdiMs - donemMs * 2;
  const topla = (bas: number, bit: number) =>
    yatirimlar
      .filter((y) => {
        const t = zaman(y.tarih);
        return Number.isFinite(t) && t >= bas && t < bit;
      })
      .reduce((s, y) => s + Math.abs(paraSayisi(y.tutar)), 0);

  const sonDonemYatirim = Math.round(topla(donemBas, simdiMs) * 100) / 100;
  const oncekiDonemYatirim = Math.round(topla(oncekiBas, donemBas) * 100) / 100;
  const dususYuzdesi = oncekiDonemYatirim > 0
    ? Math.round((1 - sonDonemYatirim / oncekiDonemYatirim) * 100)
    : null;

  const ortalamaAralikGun = yatirimRitmi(yatirimlar, esikler.enAzYatirim);
  const gecikmeOrani = ortalamaAralikGun != null && sonYatirimGun != null
    ? Math.round((sonYatirimGun / ortalamaAralikGun) * 100) / 100
    : null;

  // Son islem cekim mi? "Parasini alip gitti" sinyali.
  const tumSirali = basarili
    .filter((i) => Number.isFinite(zaman(i.tarih)))
    .sort((a, b) => zaman(a.tarih) - zaman(b.tarih));
  const sonIslem = tumSirali[tumSirali.length - 1];
  const sonIslemCekimMi = Boolean(sonIslem && String(sonIslem.tur).toLowerCase() === 'withdrawal');

  const olculer: ChurnSonucu['olculer'] = {
    sonYatirimGun,
    sonAktiflikGun,
    ortalamaAralikGun,
    gecikmeOrani,
    sonDonemYatirim,
    oncekiDonemYatirim,
    dususYuzdesi,
    yatirimSayisi: yatirimlar.length,
    omurBoyuYatirim: Math.round(omurBoyuYatirim * 100) / 100,
    netKayip,
    sonIslemCekimMi,
    uyelikGun,
  };

  // ── Erken çıkışlar ────────────────────────────────────────────────
  const degerKatmani = degeriBelirle(sonDonemYatirim, omurBoyuYatirim);

  if (yatirimlar.length === 0) {
    return bosSonuc(girdi, olculer, 'veriYok', degerKatmani,
      'Başarılı yatırım kaydı yok; risk hesaplanamıyor.');
  }
  if (uyelikGun != null && uyelikGun < esikler.yeniUyelikGun) {
    return bosSonuc(girdi, olculer, 'yeni', degerKatmani,
      `Üyelik ${uyelikGun} günlük; ritim henüz oluşmadı, erken karar verilmiyor.`);
  }

  // ── Bileşenler ────────────────────────────────────────────────────
  const bilesenler: RiskBileseni[] = [
    ritimBileseni(gecikmeOrani, ortalamaAralikGun, sonYatirimGun),
    sessizlikBileseni(sonYatirimGun, sonAktiflikGun, esikler),
    dususBileseni(dususYuzdesi, oncekiDonemYatirim),
    cekimBileseni(sonIslemCekimMi, sonYatirimGun, girdi.bakiye ?? null),
    kayipSokuBileseni(yatirimlar, cekimler, sonYatirimGun, simdiMs),
  ];

  const risk = Math.round(riskiBirlestir(bilesenler));

  const segment = segmentBelirle(risk, sonYatirimGun, esikler);
  const { oneri, oneriMetni } = oneriUret(segment, degerKatmani, olculer);

  return {
    login: girdi.login,
    playerId: girdi.playerId,
    segment,
    risk: kirp(risk),
    oncelik: oncelikHesapla(kirp(risk), degerKatmani, segment),
    bilesenler,
    olculer,
    degerKatmani,
    oneri,
    oneriMetni,
    ozet: ozetYaz(segment, bilesenler, olculer),
  };
}

/**
 * Bileşenleri tek riske çevirir.
 *
 * `1 - Π(1 - p·g)` — bağımsız kanıtların birleştirilmesindeki standart
 * form. İki özelliği önemli:
 *
 *  · Tek bir güçlü sinyal yüksek risk üretebiliyor. Ağırlıklı ortalamada
 *    üretemiyordu ve sessizce yanlış cevap veriyordu.
 *  · Sinyaller BİRİKİYOR: ritmi kırılmış VE parasını çekmiş oyuncu,
 *    yalnızca birini yapandan daha riskli çıkıyor.
 *
 * Sıfır puanlı bileşen sonucu hiç değiştirmiyor -- çarpanı 1 kalıyor --
 * yani kanıt yokluğu masumiyet delili sayılmıyor.
 */
function riskiBirlestir(bilesenler: RiskBileseni[]): number {
  let kalan = 1;
  for (const b of bilesenler) {
    const katki = Math.max(0, Math.min(1, (b.puan / 100) * b.agirlik));
    kalan *= 1 - katki;
  }
  return kirp((1 - kalan) * 100);
}

/**
 * RİTİM KIRILMASI — en belirleyici sinyal.
 *
 * Mutlak sessizlik yanıltıcı: ayda bir yatıran için 10 gün normal, her
 * gün yatıran için alarm. Oyuncunun kendi ortancasına bölüyoruz.
 * 1 kat = tam zamanında, 2 kat = gecikmiş, 4 kat ve üstü = kopmuş.
 */
function ritimBileseni(
  gecikmeOrani: number | null,
  ortalama: number | null,
  sonYatirimGun: number | null,
): RiskBileseni {
  const temel = { anahtar: 'ritim' as const, ad: 'Ritim kırılması', agirlik: AGIRLIKLAR.ritim };
  if (gecikmeOrani == null || ortalama == null) {
    return { ...temel, puan: 0, gerekce: '' };
  }
  // 1 kat -> 0, 4 kat -> 100. Arasi dogrusal.
  const puan = kirp(((gecikmeOrani - 1) / 3) * 100);
  if (puan <= 0) return { ...temel, puan: 0, gerekce: '' };

  return {
    ...temel,
    puan,
    gerekce: `Normalde ${ortalama.toFixed(1)} günde bir yatırıyor; son yatırımın üzerinden `
      + `${sonYatirimGun} gün geçti (${gecikmeOrani.toFixed(1)} katı).`,
  };
}

/**
 * MUTLAK SESSİZLİK — ritmi hesaplanamayan oyuncular için de çalışan
 * yedek sinyal.
 *
 * Yatırım ve oyun aktifliğinin HANGİSİ daha yeniyse o sayılıyor:
 * yatırmayan ama hâlâ oynayan oyuncu sessiz değildir, bakiyesini
 * eritiyordur.
 */
function sessizlikBileseni(
  sonYatirimGun: number | null,
  sonAktiflikGun: number | null,
  esikler: Esikler,
): RiskBileseni {
  const temel = { anahtar: 'sessizlik' as const, ad: 'Sessizlik', agirlik: AGIRLIKLAR.sessizlik };
  const gunler = [sonYatirimGun, sonAktiflikGun].filter((g): g is number => g != null);
  if (gunler.length === 0) return { ...temel, puan: 0, gerekce: '' };

  const gun = Math.min(...gunler);
  const puan = kirp((gun / esikler.kayipGun) * 100);
  if (puan < 10) return { ...temel, puan, gerekce: '' };

  const kaynak = sonAktiflikGun != null && sonAktiflikGun === gun ? 'hiçbir hareket' : 'yatırım';
  return { ...temel, puan, gerekce: `${gun} gündür ${kaynak} yok.` };
}

/**
 * HACİM DÜŞÜŞÜ — oyuncu hâlâ burada ama küçülüyor.
 *
 * Sessizlikten ÖNCE gelen sinyal: çoğu oyuncu bir günde bırakmıyor,
 * önce harcamasını kısıyor. Bu bileşen o pencereyi yakalıyor.
 */
function dususBileseni(dususYuzdesi: number | null, oncekiDonem: number): RiskBileseni {
  const temel = { anahtar: 'dususs' as const, ad: 'Hacim düşüşü', agirlik: AGIRLIKLAR.dususs };
  // Onceki donemde hic yatirim yoksa dususten soz edilemez; sifirdan
  // sifira gitmek bir sinyal degil.
  if (dususYuzdesi == null || oncekiDonem <= 0) return { ...temel, puan: 0, gerekce: '' };
  if (dususYuzdesi <= 0) return { ...temel, puan: 0, gerekce: '' };

  const puan = kirp(dususYuzdesi);
  return {
    ...temel,
    puan,
    gerekce: `Son 30 günde yatırımı bir önceki 30 güne göre %${dususYuzdesi} azaldı.`,
  };
}

/**
 * ÇEKİMLE ÇIKIŞ — "parasını alıp gitti".
 *
 * Son işlemi çekim olan ve sonrasında yatırmayan oyuncu, kasadan
 * çıkışını yapmış demektir. Bakiyesi de sıfıra yakınsa geri dönmek için
 * bir sebebi kalmamıştır.
 */
function cekimBileseni(
  sonIslemCekimMi: boolean,
  sonYatirimGun: number | null,
  bakiye: number | null,
): RiskBileseni {
  const temel = { anahtar: 'cekimleCikis' as const, ad: 'Çekimle çıkış', agirlik: AGIRLIKLAR.cekimleCikis };
  if (!sonIslemCekimMi) return { ...temel, puan: 0, gerekce: '' };

  const bakiyeBos = bakiye != null && bakiye < 10;
  const puan = bakiyeBos ? 100 : 65;
  return {
    ...temel,
    puan,
    gerekce: bakiyeBos
      ? `Son işlemi çekim ve bakiyesi boş (${(bakiye ?? 0).toFixed(2)} ₺); dönmek için sebebi yok.`
      : `Son işlemi çekim; ${sonYatirimGun ?? '?'} gündür yeniden yatırmadı.`,
  };
}

/**
 * BÜYÜK KAYIP ŞOKU.
 *
 * Bahiste en sık görülen bırakma tetikleyicisi: alışılmadık büyüklükte
 * bir yatırımın ardından gelen sessizlik. Oyuncu "son bir deneme" yapıp
 * kaybetmiş ve küsmüştür.
 *
 * Ölçü: son yatırım, kendi ortanca yatırımının kaç katı? Üç kat ve
 * üstüyse ve sonrasında hareket yoksa şok sayılıyor.
 */
function kayipSokuBileseni(
  yatirimlar: IslemSatiri[],
  cekimler: IslemSatiri[],
  sonYatirimGun: number | null,
  simdiMs: number,
): RiskBileseni {
  const temel = { anahtar: 'kayipSoku' as const, ad: 'Büyük kayıp şoku', agirlik: AGIRLIKLAR.kayipSoku };
  if (yatirimlar.length < 3 || sonYatirimGun == null || sonYatirimGun < 3) {
    return { ...temel, puan: 0, gerekce: '' };
  }

  const tutarlar = yatirimlar.map((y) => Math.abs(paraSayisi(y.tutar)));
  const sonTutar = tutarlar[tutarlar.length - 1];
  const ortancaTutar = ortanca(tutarlar.slice(0, -1));
  if (!ortancaTutar || ortancaTutar <= 0) return { ...temel, puan: 0, gerekce: '' };

  const kat = sonTutar / ortancaTutar;
  if (kat < 3) return { ...temel, puan: 0, gerekce: '' };

  // Son yatirimdan sonra cekim yaptiysa kaybetmemis demektir; sok yok.
  const sonYatirimAn = zaman(yatirimlar[yatirimlar.length - 1].tarih);
  const sonrasindaCekim = cekimler.some((c) => {
    const t = zaman(c.tarih);
    return Number.isFinite(t) && t > sonYatirimAn && t <= simdiMs;
  });
  if (sonrasindaCekim) return { ...temel, puan: 0, gerekce: '' };

  const puan = kirp(((kat - 3) / 5) * 60 + 40);
  return {
    ...temel,
    puan,
    gerekce: `Son yatırımı (${sonTutar.toFixed(0)} ₺) normalinin ${kat.toFixed(1)} katı ve `
      + `${sonYatirimGun} gündür dönmedi; büyük kayıp sonrası küsme olabilir.`,
  };
}

/** Değer katmanı: son dönem hacmi ağırlıklı, ömür boyu destekleyici. */
function degeriBelirle(sonDonem: number, omurBoyu: number): ChurnSonucu['degerKatmani'] {
  if (sonDonem >= 25_000 || omurBoyu >= 150_000) return 'yuksek';
  if (sonDonem >= 3_000 || omurBoyu >= 20_000) return 'orta';
  return 'dusuk';
}

function segmentBelirle(risk: number, sonYatirimGun: number | null, esikler: Esikler): Segment {
  // Kayip esigini gecen oyuncu artik "onleme" degil "geri kazanim" isi;
  // ayni listede tutmak, hala kurtarilabilir olanlarin arasini aciyor.
  if (sonYatirimGun != null && sonYatirimGun >= esikler.kayipGun) return 'kayip';
  if (risk >= 70) return 'kritik';
  if (risk >= 45) return 'riskli';
  if (risk >= 25) return 'izle';
  return 'saglikli';
}

/**
 * ÖNCELİK = risk × değer.
 *
 * Operatörün günü sınırlı; listenin başında en çok kaybı önleyecek
 * oyuncu olmalı. "Kayıp" segmenti geri kazanım işi olduğu için bilerek
 * geriye alınıyor -- hâlâ kurtarılabilir olanların önüne geçmesin.
 */
function oncelikHesapla(risk: number, deger: ChurnSonucu['degerKatmani'], segment: Segment): number {
  const carpan = deger === 'yuksek' ? 2.2 : deger === 'orta' ? 1.4 : 1;
  const sonDurum = segment === 'kayip' ? 0.5 : 1;
  return Math.round(risk * carpan * sonDurum);
}

function oneriUret(
  segment: Segment,
  deger: ChurnSonucu['degerKatmani'],
  olculer: ChurnSonucu['olculer'],
): { oneri: OneriAnahtari; oneriMetni: string } {
  if (segment === 'yeni') {
    return { oneri: 'bekle', oneriMetni: 'Yeni üye; ritmi oluşana kadar müdahale etme.' };
  }
  if (segment === 'veriYok') {
    return { oneri: 'bekle', oneriMetni: 'Yatırım geçmişi yok; kampanya hedeflemesi için uygun değil.' };
  }
  if (segment === 'saglikli') {
    return { oneri: 'bekle', oneriMetni: 'Ritmi yerinde; müdahaleye gerek yok.' };
  }
  if (segment === 'kayip') {
    return {
      oneri: 'geriKazanim',
      oneriMetni: `${olculer.sonYatirimGun} gündür yatırım yok. Geri kazanım kampanyası (yüksek oranlı ilk yatırım bonusu) dışında dönme ihtimali düşük.`,
    };
  }

  // Yuksek degerli oyuncuya once INSAN temasi: otomatik bonus, iliskiyi
  // kurtarmiyor ve bu segmentte kaybin bedeli en yuksek.
  if (deger === 'yuksek') {
    return {
      oneri: 'vipTemas',
      oneriMetni: 'Yüksek değerli oyuncu. Önce VIP temsilcisi araması, ardından kişiye özel teklif.',
    };
  }

  // Buyuk kayip sonrasi kusen oyuncuya yatirim bonusu teklif etmek
  // "yine yatir" demektir; once kaybini telafi eden teklif dogru.
  if (olculer.netKayip > 0 && olculer.sonIslemCekimMi === false) {
    return {
      oneri: 'kayipBonusu',
      oneriMetni: `Net kaybı ${olculer.netKayip.toFixed(0)} ₺. Kayıp bonusu, yeniden yatırım istemeden değer sunar.`,
    };
  }

  if (olculer.sonIslemCekimMi) {
    return {
      oneri: 'yatirimBonusu',
      oneriMetni: 'Parasını çekip ayrılmış. Geri getirmek için yatırım eşleşmeli bonus uygun.',
    };
  }

  if (deger === 'dusuk') {
    return {
      oneri: 'freespin',
      oneriMetni: 'Düşük değerli oyuncu; maliyeti düşük bir freespin denemesi yeterli.',
    };
  }

  return { oneri: 'ara', oneriMetni: 'Aranma talebi oluştur; sebebini öğrenmeden teklif verme.' };
}

/** Listede tek satırda okunacak özet. */
function ozetYaz(segment: Segment, bilesenler: RiskBileseni[], olculer: ChurnSonucu['olculer']): string {
  if (segment === 'yeni') return `Yeni üye (${olculer.uyelikGun} gün).`;
  if (segment === 'veriYok') return 'Yatırım geçmişi yok.';
  if (segment === 'saglikli') return 'Ritmi yerinde.';

  // En yuksek PUANLI degil, toplama en cok KATKI yapan bilesen: agirlik
  // carpilmadan bakmak, yuzde 100 puanli ama agirligi dusuk bir
  // bileseni one cikarip yaniltirdi.
  const baskin = [...bilesenler]
    .filter((b) => b.gerekce)
    .sort((a, b) => b.puan * b.agirlik - a.puan * a.agirlik)[0];
  return baskin ? baskin.gerekce : `${olculer.sonYatirimGun} gündür yatırım yok.`;
}

function bosSonuc(
  girdi: OyuncuGirdisi,
  olculer: ChurnSonucu['olculer'],
  segment: Segment,
  degerKatmani: ChurnSonucu['degerKatmani'],
  ozet: string,
): ChurnSonucu {
  const { oneri, oneriMetni } = oneriUret(segment, degerKatmani, olculer);
  return {
    login: girdi.login,
    playerId: girdi.playerId,
    segment,
    risk: 0,
    oncelik: 0,
    bilesenler: [],
    olculer,
    degerKatmani,
    oneri,
    oneriMetni,
    ozet,
  };
}

/** Segment dağılımı — panelin üst şeridi. */
export function segmentDagilimi(sonuclar: ChurnSonucu[]): Record<Segment, number> {
  const bos: Record<Segment, number> = {
    saglikli: 0, izle: 0, riskli: 0, kritik: 0, kayip: 0, yeni: 0, veriYok: 0,
  };
  for (const s of sonuclar) bos[s.segment] += 1;
  return bos;
}

/**
 * RİSK ALTINDAKİ PARA.
 *
 * "12 oyuncu riskli" tek başına karar verdirmiyor; "risk altındaki
 * aylık hacim 84.000 ₺" verdiriyor. Yalnızca müdahale edilebilir
 * segmentler sayılıyor -- "kayıp" olanlar zaten durmuş, onları riske
 * eklemek bugünkü kaybı olduğundan büyük gösterirdi.
 */
export function riskAltindakiHacim(sonuclar: ChurnSonucu[]): number {
  const hedef: Segment[] = ['izle', 'riskli', 'kritik'];
  const toplam = sonuclar
    .filter((s) => hedef.includes(s.segment))
    .reduce((t, s) => t + s.olculer.sonDonemYatirim, 0);
  return Math.round(toplam * 100) / 100;
}
