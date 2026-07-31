/**
 * Turnuva skorlamasi.
 *
 * Onceden siralama ham metrigin (toplam bahis) kendisiydi. Bu, turnuvayi
 * "en cok parasi olan kazanir" haline getiriyor; kucuk oyuncunun sansi
 * olmuyor ve bonus avcilarina karsi hicbir filtre yok.
 *
 * Bu modul operatorun turnuvayi ayarlayabilmesi icin gereken kurallari
 * saf fonksiyon olarak topluyor. Saf: bu sayilar odul dagitimini
 * belirliyor, sessizce kaymamali.
 */

/** Skorun neye gore hesaplanacagi. */
export const HESAPLAMA_FORMULLERI = ['bahis', 'bahisXcarpan', 'kazancOrani', 'netKayip', 'bahisAdedi'] as const;
export type HesaplamaFormulu = (typeof HESAPLAMA_FORMULLERI)[number];

export const FORMUL_ADI: Record<HesaplamaFormulu, string> = {
  bahis: 'Toplam bahis',
  bahisXcarpan: 'Toplam bahis × çarpan',
  kazancOrani: 'Kazanç oranı (kazanç ÷ bahis)',
  netKayip: 'Net kayıp',
  bahisAdedi: 'Bahis adedi',
};

export type TurnuvaKurallari = {
  formul: HesaplamaFormulu;
  /** bahisXcarpan formulunde uygulanan carpan. */
  skorCarpani: number;
  /** Tek bir bahsin sayilmasi icin alt sinir. Kucuk bahisleri eler. */
  tekBahisMin: number;
  /** Tek bir bahsin sayilan ust siniri. 0 = sinirsiz. */
  tekBahisMax: number;
  /** Siralamaya girmek icin gereken en az bahis adedi. */
  toplamBahisAdediMin: number;
  /** Sayilan en fazla bahis adedi. 0 = sinirsiz. */
  toplamBahisAdediMax: number;
};

export const VARSAYILAN_KURALLAR: TurnuvaKurallari = {
  formul: 'bahis',
  skorCarpani: 1,
  tekBahisMin: 0,
  tekBahisMax: 0,
  toplamBahisAdediMin: 0,
  toplamBahisAdediMax: 0,
};

function sayi(deger: unknown, varsayilan = 0): number {
  const n = Number(deger);
  return Number.isFinite(n) ? n : varsayilan;
}

/** Gelen ayar nesnesini guvenli kurallara cevirir; eksikler varsayilana duser. */
export function kurallariCozumle(ham: unknown): TurnuvaKurallari {
  const k = (ham ?? {}) as Record<string, unknown>;
  const formul = HESAPLAMA_FORMULLERI.includes(k.formul as HesaplamaFormulu)
    ? (k.formul as HesaplamaFormulu)
    : VARSAYILAN_KURALLAR.formul;
  return {
    formul,
    // Carpan 0 verilirse tum skorlar 0 olur ve siralama anlamsizlasir;
    // en dusuk anlamli deger 0'dan buyuk olmali.
    skorCarpani: Math.max(0.01, sayi(k.skorCarpani, 1)),
    tekBahisMin: Math.max(0, sayi(k.tekBahisMin)),
    tekBahisMax: Math.max(0, sayi(k.tekBahisMax)),
    toplamBahisAdediMin: Math.max(0, Math.floor(sayi(k.toplamBahisAdediMin))),
    toplamBahisAdediMax: Math.max(0, Math.floor(sayi(k.toplamBahisAdediMax))),
  };
}

/** Skorlamaya giren oyuncu verisi (rapor 1841 donem kolonlarindan). */
export type OyuncuOlcumu = {
  login: string;
  playerId: string;
  adSoyad: string;
  bahisTutari: number;
  kazancTutari: number;
  bahisAdedi: number;
  ggr: number;
};

export type SkorSatiri = {
  sira: number;
  login: string;
  playerId: string;
  adSoyad: string;
  skor: number;
  bahisTutari: number;
  kazancTutari: number;
  bahisAdedi: number;
  /** Elendiyse nedeni; siralamaya girenlerde undefined. */
  elenmeNedeni?: string;
};

/**
 * Tek oyuncunun skoru.
 *
 * Elenme durumunda null doner — 0 skorla listeye koymak yerine listeden
 * cikariyoruz; "skoru 0 olan oyuncu" ile "kosullari saglamayan oyuncu"
 * farkli seyler.
 */
export function oyuncuSkoru(
  olcum: OyuncuOlcumu,
  kurallar: TurnuvaKurallari,
): { skor: number } | { elenmeNedeni: string } {
  const { bahisTutari, kazancTutari, bahisAdedi, ggr } = olcum;

  if (kurallar.toplamBahisAdediMin > 0 && bahisAdedi < kurallar.toplamBahisAdediMin) {
    return { elenmeNedeni: `En az ${kurallar.toplamBahisAdediMin} bahis gerekli` };
  }

  // Tek bahis alt/ust siniri, ORTALAMA bahis uzerinden uygulanir.
  //
  // Rapor bahis bazinda dokum vermiyor, oyuncu basina toplam ve adet
  // donuyor. Ortalama, "kucuk bahislerle sıralamaya oynama" ve "tek
  // devasa bahisle listeyi kilitleme" davranislarini ayirt etmeye yetiyor.
  // Bahis bazinda filtre gerekiyorsa ayri bir veri kaynagi gerekir.
  const ortalamaBahis = bahisAdedi > 0 ? bahisTutari / bahisAdedi : 0;
  if (kurallar.tekBahisMin > 0 && ortalamaBahis < kurallar.tekBahisMin) {
    return { elenmeNedeni: `Ortalama bahis ${kurallar.tekBahisMin} altında` };
  }

  // Sayilan bahis adedi ust sinirla kirpilir; kirpma sonrasi tutar
  // orantili olarak azaltilir.
  const sayilanAdet = kurallar.toplamBahisAdediMax > 0
    ? Math.min(bahisAdedi, kurallar.toplamBahisAdediMax)
    : bahisAdedi;
  const adetOrani = bahisAdedi > 0 ? sayilanAdet / bahisAdedi : 0;

  // Tek bahis ust siniri: ortalama bahsin tavani asan kismi sayilmaz.
  const kirpilmisOrtalama = kurallar.tekBahisMax > 0
    ? Math.min(ortalamaBahis, kurallar.tekBahisMax)
    : ortalamaBahis;
  const sayilanTutar = kirpilmisOrtalama * sayilanAdet;

  let ham: number;
  switch (kurallar.formul) {
    case 'bahisXcarpan':
      ham = sayilanTutar * kurallar.skorCarpani;
      break;
    case 'kazancOrani':
      // Bahsi olmayan oyuncunun orani tanimsiz; 0 sayilir.
      ham = sayilanTutar > 0 ? (kazancTutari * adetOrani) / sayilanTutar : 0;
      break;
    case 'netKayip':
      // GGR kasa acisindan pozitif = oyuncu kaybetti. Turnuva "en cok
      // kaybeden" olarak kurulabiliyor; negatif deger 0'a kirpilir.
      ham = Math.max(0, ggr * adetOrani);
      break;
    case 'bahisAdedi':
      ham = sayilanAdet;
      break;
    case 'bahis':
    default:
      ham = sayilanTutar;
  }

  const skor = Number.isFinite(ham) ? Math.max(0, ham) : 0;
  return { skor };
}

/**
 * Siralama.
 *
 * Skoru 0 olan ve elenen oyuncular listeye girmez. Esitlikte login'e gore
 * alfabetik: ayni skora sahip iki oyuncunun sirasi istekten istege
 * degismemeli.
 */
export function turnuvaSiralamasi(
  olcumler: OyuncuOlcumu[],
  kurallar: TurnuvaKurallari,
  limit = 100,
): SkorSatiri[] {
  const gecerli: Array<{ olcum: OyuncuOlcumu; skor: number }> = [];

  for (const olcum of olcumler) {
    const sonuc = oyuncuSkoru(olcum, kurallar);
    if ('elenmeNedeni' in sonuc) continue;
    if (sonuc.skor <= 0) continue;
    gecerli.push({ olcum, skor: sonuc.skor });
  }

  return gecerli
    .sort((a, b) => (b.skor - a.skor) || a.olcum.login.localeCompare(b.olcum.login, 'tr-TR'))
    .slice(0, Math.max(0, limit))
    .map((kayit, index) => ({
      sira: index + 1,
      login: kayit.olcum.login,
      playerId: kayit.olcum.playerId,
      adSoyad: kayit.olcum.adSoyad,
      skor: kayit.skor,
      bahisTutari: kayit.olcum.bahisTutari,
      kazancTutari: kayit.olcum.kazancTutari,
      bahisAdedi: kayit.olcum.bahisAdedi,
    }));
}

/**
 * Kullanici adini maskeler: "medellin_kral" -> "M***".
 *
 * Turnuva tablosu HERKESE ACIK bir uctan donuyor; tam kullanici adi
 * yayinlamak oyuncu adlarini ve bahis hacimlerini disariya acardi.
 * Vitrindeki kazanc kayitlariyla ayni bicim kullaniliyor.
 */
export function loginMaskele(login: string): string {
  const temiz = String(login ?? '').trim();
  if (!temiz) return '***';
  return `${temiz.charAt(0).toLocaleUpperCase('tr-TR')}***`;
}
