/**
 * Lynon pano metrikleri.
 *
 * ── Bildirilen sorun ──────────────────────────────────────────────────
 *
 * "Dashboard hâlâ yanlış gösteriyor."
 *
 * Tarih penceresi duzeltildikten sonra da yanlisti, cunku sorun tarihte
 * degil ESLEMEDEYDI. `dashboardData` 24 alan doner; pano bunlarin 7'sini
 * gosteriyordu ve gosterdiklerinin bir kismi YANLIS ALANDAN geliyordu:
 *
 *   PlayersLoggedIn: numberFrom(data['PLAYERS LOGGED IN'])
 *     -> Bu alan yanitta HIC YOK. "Aktif Oyuncu" surekli 0.
 *
 *   LoginCount: numberFrom(data['LOGIN COUNT'] ?? data['PLAYERS LOGGED IN'])
 *     -> Ikisi de yok. "Günlük Girişler" surekli 0.
 *
 *   DepositCount: data['TOTAL DEPOSITS COUNT'] ?? data['UNIQUE PLAYER DEPOSITS']
 *     -> Ilk alan yok; ikinciye dusuyor. Ekranda "2 işlem · 2 oyuncu"
 *        yaziyor — ayni sayi iki ayri etiketle. Yatirim ADEDI degil,
 *        yatirim yapan OYUNCU sayisi.
 *
 *   Profit: numberFrom(data.PROFIT ?? data.GGR)
 *     -> PROFIT ve GGR AYRI metrikler. Ornek gunde PROFIT -52.984,08
 *        iken GGR +14.668,99. Birini digerinin yerine koymak isaretini
 *        bile ters cevirebiliyor.
 *
 * ── Kural ─────────────────────────────────────────────────────────────
 *
 * FARKLI METRIKLER ARASINDA SESSIZ GERI DUSUS YOK. Alan yoksa metrik
 * "veri yok" olarak isaretlenir; baska bir metrigin degeri onun
 * etiketiyle gosterilmez. Bir panoyu yalanci yapan sey tam olarak budur.
 */

export type MetrikBirimi = 'para' | 'adet' | 'oyuncu';

export type MetrikGrubu = 'finans' | 'oyun' | 'bonus' | 'oyuncu';

export type PanoMetrigi = {
  anahtar: string;
  etiket: string;
  /** Alan yanitta yoksa null — sifir DEGIL. */
  deger: number | null;
  birim: MetrikBirimi;
  grup: MetrikGrubu;
  /** Yanitta hic bulunmayan alan; ekran bunu "—" gosterir. */
  veriYok: boolean;
  /** Operatore ne anlama geldigini soyler. */
  aciklama?: string;
  /**
   * IZLENEBILIRLIK — "pano yanlis gosteriyor" sikayetini adreslenebilir
   * kilan sey.
   *
   * Bir sayinin yanlis oldugunu soylemek kolay, HANGI sayinin nereden
   * geldigini gostermek zordu. Artik her olcu kendi Lynon alan adini ve
   * ham degerini tasiyor; ekranda uzerine gelince "TOTAL DEPOSITS
   * AMOUNT = 11000 TRY" yaziyor. Esleme hatasi ile ucun kendi hatasi
   * boylece bir bakista ayrilir.
   */
  alan: string;
  /** Ucun donderdigi ham deger; "11000 TRY" gibi metin olabilir. */
  hamDeger: string | null;
};

/**
 * `dashboardData` alan adlari.
 *
 * Degerler "16090 TRY" gibi birim ekli metinler ya da duz sayilar
 * olabiliyor; ikisi de ayni cozucuden geciyor.
 */
const TANIMLAR: Array<{
  anahtar: string;
  alan: string;
  etiket: string;
  birim: MetrikBirimi;
  grup: MetrikGrubu;
  aciklama?: string;
}> = [
  // ── Finans
  { anahtar: 'yatirim', alan: 'TOTAL DEPOSITS AMOUNT', etiket: 'Toplam Yatırım', birim: 'para', grup: 'finans' },
  { anahtar: 'cekim', alan: 'TOTAL WITHDRAWALS AMOUNT', etiket: 'Toplam Çekim', birim: 'para', grup: 'finans' },
  { anahtar: 'yatirimOyuncu', alan: 'UNIQUE PLAYER DEPOSITS', etiket: 'Yatırım Yapan Oyuncu', birim: 'oyuncu', grup: 'finans' },
  { anahtar: 'cekimOyuncu', alan: 'UNIQUE PLAYER WITHDRAWALS', etiket: 'Çekim Yapan Oyuncu', birim: 'oyuncu', grup: 'finans' },
  { anahtar: 'ilkYatirim', alan: 'FIRST DEPOSIT COUNT', etiket: 'İlk Yatırım', birim: 'adet', grup: 'finans', aciklama: 'Bu aralıkta ilk kez yatırım yapan oyuncu sayısı.' },
  { anahtar: 'gunlukOrtYatirim', alan: 'AVERAGE DAILY DEPOSITS', etiket: 'Günlük Ort. Yatırım', birim: 'para', grup: 'finans' },
  { anahtar: 'iade', alan: 'TOTAL REFUND AMOUNT', etiket: 'İade', birim: 'para', grup: 'finans' },

  // ── Oyun
  {
    anahtar: 'ggr', alan: 'GGR', etiket: 'GGR', birim: 'para', grup: 'oyun',
    aciklama: 'Gerçek bahis eksi gerçek kazanç — oyun marjı.',
  },
  {
    anahtar: 'kar', alan: 'PROFIT', etiket: 'Kâr (PROFIT)', birim: 'para', grup: 'oyun',
    aciklama: 'Lynon’un kâr kalemi. GGR ile AYNI ŞEY DEĞİL; bonus ve freespin maliyetlerini de içerir, işareti GGR’nin tersi olabilir.',
  },
  { anahtar: 'gunlukOrtKar', alan: 'AVERAGE DAILY PROFIT', etiket: 'Günlük Ort. Kâr', birim: 'para', grup: 'oyun' },
  { anahtar: 'gercekBahis', alan: 'TOTAL REAL BET AMOUNT', etiket: 'Gerçek Bahis', birim: 'para', grup: 'oyun' },
  { anahtar: 'gercekKazanc', alan: 'TOTAL REAL WIN AMOUNT', etiket: 'Gerçek Kazanç', birim: 'para', grup: 'oyun' },
  { anahtar: 'bahisAdedi', alan: 'TOTAL BET COUNT', etiket: 'Bahis Adedi', birim: 'adet', grup: 'oyun' },
  { anahtar: 'kazancAdedi', alan: 'TOTAL WIN COUNT', etiket: 'Kazanan Bahis', birim: 'adet', grup: 'oyun' },
  { anahtar: 'bahisOyuncu', alan: 'UNIQUE PLAYER BET', etiket: 'Bahis Yapan Oyuncu', birim: 'oyuncu', grup: 'oyun' },
  { anahtar: 'kazancOyuncu', alan: 'UNIQUE PLAYER WIN', etiket: 'Kazanan Oyuncu', birim: 'oyuncu', grup: 'oyun' },

  // ── Bonus
  { anahtar: 'bonusBahis', alan: 'TOTAL BONUS BET', etiket: 'Bonus Bahis', birim: 'para', grup: 'bonus' },
  { anahtar: 'bonusKazanc', alan: 'TOTAL BONUS WIN', etiket: 'Bonus Kazanç', birim: 'para', grup: 'bonus' },
  { anahtar: 'bonusOdeme', alan: 'TOTAL Bonus PayOut', etiket: 'Bonus Ödemesi', birim: 'para', grup: 'bonus' },
  {
    anahtar: 'freespinKazanc', alan: 'TOTAL FREESPIN WIN', etiket: 'Freespin Kazancı', birim: 'para', grup: 'bonus',
    aciklama: 'Freespin bonuslarından oyunculara giden tutar — doğrudan bonus maliyeti.',
  },
  { anahtar: 'cashback', alan: 'TOTAL Cashback', etiket: 'Cashback', birim: 'para', grup: 'bonus' },

  // ── Oyuncu
  { anahtar: 'yeniKayit', alan: 'PLAYERS REGISTERED', etiket: 'Yeni Kayıt', birim: 'oyuncu', grup: 'oyuncu' },
  { anahtar: 'gercekBakiye', alan: 'USERS REAL BALANCE', etiket: 'Oyuncu Gerçek Bakiyesi', birim: 'para', grup: 'oyuncu' },
  { anahtar: 'bonusBakiye', alan: 'USERS BONUS BALANCE', etiket: 'Oyuncu Bonus Bakiyesi', birim: 'para', grup: 'oyuncu' },
];

/**
 * "16090 TRY" / "-2401" / 6004 -> sayi.
 *
 * Bosluk ve para birimi ekleri atilir. Cozulemezse null doner; 0 DEGIL —
 * "veri yok" ile "deger sifir" ayrimi bu panonun butun meselesi.
 */
export function metrikSayisi(deger: unknown): number | null {
  if (deger === null || deger === undefined || deger === '') return null;
  if (typeof deger === 'number') return Number.isFinite(deger) ? deger : null;

  const metin = String(deger).trim();
  if (!metin) return null;

  // Sondaki para birimi kodunu ve bosluklari at; sayi kismini birak.
  const temiz = metin.replace(/[^\d.,+-]/g, '').replace(/,/g, '');
  if (temiz === '' || temiz === '-' || temiz === '+') return null;

  const sayi = Number(temiz);
  return Number.isFinite(sayi) ? sayi : null;
}

/**
 * Ham `dashboardData` yanitini etiketli metrik listesine cevirir.
 *
 * Yanitta olmayan alan `veriYok: true` ile listede KALIR: eksik metrigi
 * gizlemek, operatorun "bu sayi neden yok" diye sormasini engeller ve
 * eksikligi sessizce normallestirir.
 */
export function panoMetrikleri(ham: Record<string, unknown> | null | undefined): PanoMetrigi[] {
  const kaynak = ham ?? {};
  return TANIMLAR.map((tanim) => {
    const varMi = Object.prototype.hasOwnProperty.call(kaynak, tanim.alan);
    const ham = varMi ? kaynak[tanim.alan] : undefined;
    const deger = varMi ? metrikSayisi(ham) : null;
    return {
      anahtar: tanim.anahtar,
      etiket: tanim.etiket,
      deger,
      birim: tanim.birim,
      grup: tanim.grup,
      veriYok: !varMi || deger === null,
      aciklama: tanim.aciklama,
      alan: tanim.alan,
      hamDeger: varMi ? String(ham ?? '') : null,
    };
  });
}

/**
 * Yanitta olan ama TANIMLAR'da karsiligi olmayan alanlar.
 *
 * Lynon yeni bir metrik eklediginde panoda sessizce kaybolmasin diye.
 */
export function taninmayanAlanlar(ham: Record<string, unknown> | null | undefined): string[] {
  const bilinen = new Set(TANIMLAR.map((t) => t.alan));
  return Object.keys(ham ?? {}).filter((alan) => !bilinen.has(alan));
}

/** Net gelir = yatirim - cekim. Ikisi de yoksa null. */
export function netGelir(metrikler: PanoMetrigi[]): number | null {
  const bul = (anahtar: string) => metrikler.find((m) => m.anahtar === anahtar)?.deger ?? null;
  const yatirim = bul('yatirim');
  const cekim = bul('cekim');
  if (yatirim === null && cekim === null) return null;
  return (yatirim ?? 0) - (cekim ?? 0);
}
