/**
 * Anlik oyuncu bakiye ozeti — rapor 1843 ("Player Balance").
 *
 * Uc, o an aktif her oyuncuyu (Player ID, Full Name, Username, bakiye
 * alanlari) tek tek donduruyor — 1000+ satir olabiliyor. Telegram'a
 * satir satir atmak ne okunabilir ne de anlamli; istenen "kasada su an
 * toplam ne kadar oyuncu bakiyesi var" sorusunun cevabi. Bu yuzden bu
 * modul yalnizca TOPLAMI (`reportsSummary`) cikarir ve bicimler; tekil
 * oyuncu satirlari hic tasinmaz.
 */

import {
  gorselMesaj, kalinIsaretle, kalinSatir, kodIsaretle, onIzgaraBlogu,
} from './telegramService.js';

type AnyRecord = Record<string, any>;

export type OyuncuBakiyeOzeti = {
  gun: string;
  saat: string | null;
  /** Rapor kac oyuncu dondurdu — satir listesi yoksa olculemez, null. */
  oyuncuSayisi: number | null;
  gercekBakiye: number | null;
  bonusBakiye: number | null;
  toplamBakiye: number | null;
};

function sayi(deger: unknown): number {
  if (deger === null || deger === undefined || deger === '') return 0;
  const n = Number(deger);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Rapor govdesini ozetler.
 *
 * `reportsSummary` varsa ORADAN okunur — 1000+ satiri toplamak yerine
 * ucun kendi ozetine guvenmek, sayfalamadan kaynakli fark riskini
 * ortadan kaldirir (`mutabakatToplami` ile ayni yaklasim). Ozet yoksa
 * satirlardan toplanir. Ne ozet ne satir varsa TUM alanlar null —
 * "bakiye sıfır" ile "ölçülemedi" farkli seyler.
 */
export function oyuncuBakiyeOzetiCikar(
  data: AnyRecord | null | undefined,
  gun: string,
  saat: string | null = null,
): OyuncuBakiyeOzeti {
  const govde = (data ?? {}) as AnyRecord;
  const satirlar: AnyRecord[] = Array.isArray(govde.reports) ? govde.reports : [];
  const ozet: AnyRecord | null =
    govde.reportsSummary && typeof govde.reportsSummary === 'object' ? govde.reportsSummary : null;

  const olculebiliyor = ozet !== null || satirlar.length > 0;

  const alanOku = (anahtar: string): number | null => {
    if (!olculebiliyor) return null;
    if (ozet && ozet[anahtar] !== undefined && ozet[anahtar] !== null && ozet[anahtar] !== '') {
      return sayi(ozet[anahtar]);
    }
    return satirlar.reduce((toplam, satir) => toplam + sayi(satir[anahtar]), 0);
  };

  return {
    gun,
    saat,
    oyuncuSayisi: satirlar.length > 0 ? satirlar.length : null,
    gercekBakiye: alanOku('Total Real Balance (TRY)'),
    bonusBakiye: alanOku('Total Bonus Balance (TRY)'),
    toplamBakiye: alanOku('Total Balance (TRY)'),
  };
}

export type TopBakiyeliOyuncu = {
  id: string;
  ad: string;
  gercekBakiye: number | null;
  toplamBakiye: number;
  /** Rapor 1843'te yok; ayri bir uctan (playersOverview) sonradan doldurulur. */
  toplamYatirim: number | null;
  toplamCekim: number | null;
};

/**
 * En yuksek TOPLAM bakiyeli oyuncular.
 *
 * Rapor 1843 satirlarindan cikar; yatirim/cekim toplami bu raporda YOK
 * (yalnizca tarih var, tutar yok) — cagiran bunlari ayri bir uctan
 * doldurup `toplamYatirim`/`toplamCekim`'i gunceller. Burada null
 * birakilmasi bilinclidir: "olculemedi" ile "0 TL" karistirilmaz.
 */
export function topBakiyeliOyuncular(
  data: AnyRecord | null | undefined,
  azami = 10,
): TopBakiyeliOyuncu[] {
  const govde = (data ?? {}) as AnyRecord;
  const satirlar: AnyRecord[] = Array.isArray(govde.reports) ? govde.reports : [];

  return satirlar
    .map((satir) => {
      const id = String(satir?.['Player ID'] ?? '').trim();
      const ad = String(satir?.Username ?? satir?.['Full Name'] ?? id).trim();
      const toplamBakiyeDeger = satir?.['Total Balance (TRY)'];
      return {
        id,
        ad,
        gercekBakiye: satir?.['Total Real Balance (TRY)'] != null ? sayi(satir['Total Real Balance (TRY)']) : null,
        toplamBakiye: toplamBakiyeDeger != null ? sayi(toplamBakiyeDeger) : 0,
        toplamYatirim: null as number | null,
        toplamCekim: null as number | null,
      };
    })
    .filter((oyuncu) => oyuncu.id)
    .sort((a, b) => b.toplamBakiye - a.toplamBakiye)
    .slice(0, azami);
}

/** Para alanları: her zaman 2 ondalık — "0,80" değil "0,8" gösterilsin diye. */
const TL = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Oyuncu sayısı gibi tam sayı alanlar. */
const TAM = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
/** Trend farkı: kuruş gürültüsü olmadan, yuvarlanmış tam sayı (işaret ayrıca yazılıyor). */
const TAM_FARK = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

/** Mesaj basliklarini ayiran ince cizgi; sohbette blok blok okunsun. */
const AYIRAC = '━━━━━━━━━━━━━━━━━━━━━';

function para(deger: number | null): string {
  return deger === null ? '—' : `${TL.format(deger)} TRY`;
}

/** "YYYY-MM-DD" -> "GG.AA.YYYY". */
function gunGoster(gun: string): string {
  const [yil, ay, g] = gun.split('-');
  return yil && ay && g ? `${g}.${ay}.${yil}` : gun;
}

/**
 * Büyük yatırım/çekim tutarlarını kısaltır: 1000 -> "1K", 1500 -> "1.5K".
 * Tablo hizasını bozmadan çok haneli tutarları okunur tutmak için;
 * ondalık noktası kasıtlı olarak İNGİLİZCE ("." ) -- bu kısaltma biçimi
 * her yerde böyle tanınıyor, Türkçe virgüllü tutarlarla karıştırılmasın.
 */
function kisaSayi(deger: number | null): string {
  if (deger === null) return '—';
  const yuvarlak = Math.round(deger);
  if (Math.abs(yuvarlak) < 1000) return String(yuvarlak);
  const bin = yuvarlak / 1000;
  const birOndalik = Math.round(bin * 10) / 10;
  const govde = Number.isInteger(birOndalik) ? String(birOndalik) : birOndalik.toFixed(1);
  return `${govde}K`;
}

/**
 * Onceki ozete gore trend oku. Ikisinden biri bilinmiyorsa BOS DONER —
 * `telegramRaporu.kasaMesaji`daki ayni mantik: karisik trend okumaktansa
 * hic gostermemek daha dogru.
 */
function trendYaz(simdi: number | null, onceki: number | null | undefined): string {
  if (simdi === null || onceki === null || onceki === undefined) return '';
  const fark = Math.round(simdi - onceki);
  if (fark === 0) return ' ▪️ 0';
  return fark > 0 ? ` 📈 +${TAM_FARK.format(fark)}` : ` 📉 -${TAM_FARK.format(Math.abs(fark))}`;
}

/**
 * Kullanıcı adı test/demo hesap desenine uyuyor mu.
 *
 * Backoffice'te ayrı bir "test hesabı" alanı yok; gözlemlenen tek
 * ortak işaret kullanıcı adında "test" geçmesi (jackietest, tttesttt,
 * narcostest, test...). Yanlış pozitif riski var ("testere42" gibi
 * gerçek bir kullanıcı da işaretlenir) ama bedeli düşük: yalnızca ❓
 * ekliyor, veriyi filtrelemiyor/gizlemiyor -- operatör kararını hâlâ
 * kendisi veriyor.
 */
function testHesabiMi(kullaniciAdi: string): boolean {
  return /test/i.test(kullaniciAdi);
}

/**
 * Sütun genişliklerini veriye göre hesaplayıp hizalı bir `<pre>` tablosu
 * satırları üretir. `hizalama[i] === 'sag'` olan sütun sağa, diğerleri
 * sola yaslanır.
 */
function tabloSatirlari(basliklar: string[], satirlar: string[][], sagaYasla: boolean[]): string[] {
  const genislikler = basliklar.map((b, i) => Math.max(b.length, ...satirlar.map((s) => s[i]?.length ?? 0)));
  const satirYaz = (hucreler: string[]) => hucreler
    .map((h, i) => (sagaYasla[i] ? h.padStart(genislikler[i]) : h.padEnd(genislikler[i])))
    .join('  ')
    .trimEnd();
  return [satirYaz(basliklar), ...satirlar.map(satirYaz)];
}

/**
 * Telegram mesaji.
 *
 * `onceki` verilirse bir onceki gonderime gore trend oku eklenir — 7.5
 * dakikada bir gelen bir mesajda "yon" bir bakista gorulsun diye.
 *
 * `topOyuncular` verilirse en yuksek bakiyeli oyuncular ayri bir
 * bolumde, sabit genislikli bir tabloda listelenir; test/demo hesaplar
 * ❓ ile isaretlenir.
 */
export function oyuncuBakiyeMesaji(
  ozet: OyuncuBakiyeOzeti,
  onceki?: OyuncuBakiyeOzeti | null,
  topOyuncular?: TopBakiyeliOyuncu[],
): string {
  const ETIKETLER = {
    oyuncu: 'Aktif Oyuncu', gercek: 'Gerçek Bakiye', bonus: 'Bonus Bakiye', toplam: 'Toplam Bakiye',
  };
  const etiketGenislik = Math.max(...Object.values(ETIKETLER).map((e) => e.length));
  const etiket = (e: string) => e.padEnd(etiketGenislik, ' ');

  const paraDegerleri = [ozet.gercekBakiye, ozet.bonusBakiye, ozet.toplamBakiye]
    .map((d) => (d === null ? '—' : TL.format(d)));
  const paraGenislik = Math.max(...paraDegerleri.map((s) => s.length));
  const paraHizali = (deger: number | null, index: number) => {
    const metin = paraDegerleri[index].padStart(paraGenislik);
    return deger === null ? metin : `${metin} TRY`;
  };

  const satirlar: Array<string | null> = [
    kalinSatir('👛✨ ANLIK OYUNCU BAKİYESİ'),
    `📅 ${kodIsaretle(`${gunGoster(ozet.gun)}${ozet.saat ? ` · ${ozet.saat}` : ''}`)}`,
    '',
    kalinSatir('📊 GENEL BAKİYE ÖZETİ'),
    onIzgaraBlogu([
      `👥 ${etiket(ETIKETLER.oyuncu)}: ${ozet.oyuncuSayisi === null ? '—' : TAM.format(ozet.oyuncuSayisi)}`,
      `💰 ${etiket(ETIKETLER.gercek)}: ${paraHizali(ozet.gercekBakiye, 0)}${trendYaz(ozet.gercekBakiye, onceki?.gercekBakiye)}`,
      `🎁 ${etiket(ETIKETLER.bonus)}: ${paraHizali(ozet.bonusBakiye, 1)}${trendYaz(ozet.bonusBakiye, onceki?.bonusBakiye)}`,
      `✅ ${etiket(ETIKETLER.toplam)}: ${paraHizali(ozet.toplamBakiye, 2)}${trendYaz(ozet.toplamBakiye, onceki?.toplamBakiye)}`,
    ]),
  ];

  if (topOyuncular && topOyuncular.length > 0) {
    const testliVar = topOyuncular.some((o) => testHesabiMi(o.ad));
    // Test isareti (❓) AYRI bir sutun -- BAKIYE'nin icine gomulseydi
    // isaretli/isaretsiz satirlar farkli genislikte olur, ardindaki
    // YAT/CEK sutunu satirdan satira kayardi.
    const satirVerisi = topOyuncular.map((oyuncu, index) => {
      const sira = index + 1 < 10 ? `${index + 1}.` : String(index + 1);
      const bakiye = TL.format(oyuncu.toplamBakiye);
      const isaret = testHesabiMi(oyuncu.ad) ? '❓' : '';
      const yatCek = `${kisaSayi(oyuncu.toplamYatirim)} / ${kisaSayi(oyuncu.toplamCekim)}`;
      return [sira, oyuncu.ad, bakiye, isaret, yatCek];
    });

    satirlar.push(
      '',
      AYIRAC,
      kalinSatir(`🏆 EN YÜKSEK BAKİYELİ TOP ${topOyuncular.length} ÜYE`),
      '',
      onIzgaraBlogu(tabloSatirlari(
        ['#', 'KULLANICI', 'BAKİYE (TRY)', '', 'YAT / ÇEK'],
        satirVerisi,
        [false, false, true, false, true],
      )),
    );

    if (testliVar) {
      satirlar.push('', `${kalinIsaretle('❓ Not:')} Test/Demo hesapları listede işaretlenmiştir.`);
    }
  }

  return gorselMesaj(satirlar);
}
