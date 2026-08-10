/**
 * Kayip bonusu tabani = YATIRIM − CEKIM.
 *
 * ── Neden degisti ─────────────────────────────────────────────────────
 * Onceden taban `kpi.GamingProfitAndLose` idi: toplam bahis eksi toplam
 * kazanc. Bu sayi paranin KIMDEN geldigine bakmiyor — bonusla ve manuel
 * duzeltmeyle verilen parayla yapilan kayiplar da iceride.
 *
 * Gozlenen vaka: oyuncu 10.000 kendi parasini yatirdi, uzerine 2x manuel
 * duzeltme aldi (20.000), toplam 30.000 cevirdi. GGR ~23.000 gorundu ve
 * %30 diliminden 7.000 kayip bonusu yazildi. Oysa oyuncunun kendi
 * kaybettigi para 10.000'di; kasa, kendi verdigi paranin kaybini geri
 * odemis oldu.
 *
 * Yeni taban yalnizca oyuncunun KENDI riske ettigi parayi sayar:
 * bonus ve manuel duzeltme hicbir sekilde tabana girmez, cunku bunlar
 * yatirim islemi degil.
 *
 * ── Donem penceresi ───────────────────────────────────────────────────
 * Taban SON ODENEN CEKIMDEN itibaren hesaplanir, omur boyu degil.
 *
 * Omur boyu alinsaydi iki yil boyunca 500.000 yatirip 400.000 cekmis bir
 * oyuncu her talepte 100.000 taban gosterir ve ayni kaybi tekrar tekrar
 * paraya cevirirdi. Cekim, o donemin kapandigi andir: oyuncu parasini
 * geri aldiysa o para kaybedilmemistir.
 *
 * Kampanya metni de bunu soyluyor: "son yatirimi kaybeden oyunculara",
 * talep 24 saat icinde ve bakiye 10 TL altinda olmali.
 *
 * ── Haftalik varyant ──────────────────────────────────────────────────
 * Bazi kurallar (haftalik kayip bonusu) donemi TAKVIM HAFTASIYLA
 * (Pazartesi 00:00 Europe/Istanbul) sinirlamak ister — "son cekimden
 * beri" omur boyu birikebilirken, haftalik surum her Pazartesi sifirlanir.
 * Iki sinir birlikte uygulanir: `max(son odenen cekim, bu haftanin
 * baslangici)` — bir cekim hafta ortasinda gelirse taban YINE de o
 * cekimden sonrasina daralir, ayni kaybi iki kez odememek icin.
 */

import { istanbulHaftaBaslangiciMs } from '../lib/istanbulGunu.js';

export type OdemeHareketi = {
  /** 'deposit' | 'withdrawal' */
  tur: string;
  /** Lynon durumu; yalnizca 'success' sayilir. */
  durum: string;
  tutar: number;
  /** ISO tarih. */
  tarih: string;
};

function zaman(iso: unknown): number {
  const t = Date.parse(String(iso ?? ''));
  return Number.isFinite(t) ? t : 0;
}

function sayi(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

const BASARILI = 'success';

export type KayipTabaniSecenekleri = {
  /** 'sonOdenenCekim' (varsayilan, omur boyu) | 'haftalik' (takvim haftasiyla da sinirli). */
  donemTipi?: 'sonOdenenCekim' | 'haftalik';
  /** Test edilebilirlik icin "su an" — varsayilan gercek zaman. */
  simdi?: number;
};

export type KayipTabaniSonucu = {
  /** Bonus hesabinda kullanilacak taban. Veri yoksa undefined. */
  netLoss: number | undefined;
  /** Donem baslangici (son odenen cekim); yoksa null. */
  donemBaslangici: string | null;
  /** Donemde sayilan yatirim toplami. */
  donemYatirimi: number;
  /** Donemde odenen cekim toplami. */
  donemCekimi: number;
};

/**
 * Kayip tabanini hesaplar.
 *
 * Hic yatirim yoksa `undefined` doner — "kayip yok" (0) ile "veri yok"
 * ayirt edilmeli. 0 dondurulseydi kural "net kaybi yok" diye reddederdi
 * ve bu dogru sonuc olurdu ama YANLIS gerekceyle; veri eksikligi
 * gorunmez kalirdi.
 */
export function kayipTabani(hareketler: OdemeHareketi[], secenekler: KayipTabaniSecenekleri = {}): KayipTabaniSonucu {
  const liste = (hareketler ?? []).filter((h) => h && String(h.durum ?? '').toLowerCase() === BASARILI);

  const yatirimlar = liste.filter((h) => String(h.tur ?? '').toLowerCase() === 'deposit');
  const cekimler = liste.filter((h) => String(h.tur ?? '').toLowerCase() === 'withdrawal');

  if (yatirimlar.length === 0) {
    return { netLoss: undefined, donemBaslangici: null, donemYatirimi: 0, donemCekimi: 0 };
  }

  // Donem siniri: en son ODENEN cekim. Yoksa hesabin basindan itibaren.
  const sonCekimAni = cekimler.reduce((enBuyuk, c) => Math.max(enBuyuk, zaman(c.tarih)), 0);
  // Haftalik varyantta ayrica bu haftanin baslangiciyla da sinirlanir —
  // hangisi DAHA GEC ise o gecerli (cekim hafta ortasindaysa taban yine
  // ondan sonrasina daralir).
  const donemSiniri = secenekler.donemTipi === 'haftalik'
    ? Math.max(sonCekimAni, istanbulHaftaBaslangiciMs(secenekler.simdi))
    : sonCekimAni;

  const donemYatirimlari = yatirimlar.filter((y) => zaman(y.tarih) > donemSiniri);
  const donemYatirimi = donemYatirimlari.reduce((t, y) => t + sayi(y.tutar), 0);

  // Sinirdan SONRA odenen cekim tanim geregi olmamali; yine de tam olalim
  // (ayni milisaniyede kayit, saat kaymasi vb.).
  const donemCekimi = cekimler
    .filter((c) => zaman(c.tarih) > donemSiniri)
    .reduce((t, c) => t + sayi(c.tutar), 0);

  // Son cekimden beri hic yatirim yoksa donem bos: taban 0, veri eksikligi yok.
  return {
    netLoss: Math.max(0, donemYatirimi - donemCekimi),
    donemBaslangici: donemSiniri > 0 ? new Date(donemSiniri).toISOString() : null,
    donemYatirimi,
    donemCekimi,
  };
}
