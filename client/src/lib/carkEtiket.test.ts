import { describe, expect, it } from 'vitest';
import { KARAKTER_ORANI, carkEtiketOlculeri, carkEtiketSatirlari, enAzSatirUzunlugu } from './carkEtiket';

/** Gerçek çarkta kullanılan türden, uzunluğu değişken ödül adları. */
const ETIKETLER = [
  '500 ₺ Freespin Paketi', '%50 Yatırım Bonusu', 'Bir dahaki sefere',
  '250 ₺ Deneme Bonusu', '1.000 ₺ Nakit', '%25 Kayıp İadesi',
  'Pas', '100 Freespin', '5.000 ₺ Çevrimsiz', 'Sürpriz Ödül',
  '%10 Anlık Cashback', 'Tekrar Çevir',
];

/** Lobideki çerçeveli çark: size 560 -> radius ~274, göbek 32. */
const LOBI = { radius: 274, centerRadius: 32, labelSize: 14, etiketler: ETIKETLER };
/** Panel önizlemesi: size 360 -> radius 156. */
const PANEL = { radius: 156, centerRadius: 32, labelSize: 14, etiketler: ETIKETLER };

describe('carkEtiketOlculeri', () => {
  it('buyuk carkta panelde secilen puntoyu ezmiyor', () => {
    // Asil hata buydu: 560 px'lik carkta 12 dilim varken punto 9'a
    // dusuruluyor, yazilar gereksiz yere kirpiliyordu.
    const olcu = carkEtiketOlculeri({ ...LOBI, count: 12 });
    expect(olcu.fontSize).toBe(14);
    expect(olcu.maxCharacters).toBeGreaterThanOrEqual(14);
  });

  it('en uzun odul adi kirpilmadan siginca punto dusurulmuyor', () => {
    // Bir cark, odulun ne oldugunu gosteremiyorsa isini yapmiyor.
    const olcu = carkEtiketOlculeri({ ...LOBI, count: 12 });
    for (const etiket of ETIKETLER) {
      const satirlar = carkEtiketSatirlari(etiket, olcu.maxCharacters, olcu.maxLines);
      expect(satirlar.join(' ')).toBe(etiket.replace(/\s+/g, ' ').trim());
    }
  });

  it('etiketler uzadikca punto kuculuyor -- kirpilmiyor', () => {
    const kisa = carkEtiketOlculeri({ ...LOBI, count: 12, etiketler: ['Pas', '100 ₺'] });
    const uzun = carkEtiketOlculeri({
      ...LOBI, count: 12,
      etiketler: ['Cok Uzun Bir Odul Adi Daha Da Uzun Devam Ediyor'],
    });
    expect(uzun.fontSize).toBeLessThan(kisa.fontSize);
  });

  it('ayni dilim sayisinda buyuk cark daha fazla karakter aliyor', () => {
    const buyuk = carkEtiketOlculeri({ ...LOBI, count: 12 });
    const kucuk = carkEtiketOlculeri({ ...PANEL, count: 12 });
    expect(buyuk.maxCharacters).toBeGreaterThan(kucuk.maxCharacters);
  });

  it('dilim sayisi arttikca satir sayisi azaliyor', () => {
    const az = carkEtiketOlculeri({ ...LOBI, count: 6 });
    const cok = carkEtiketOlculeri({ ...LOBI, count: 24 });
    expect(az.maxLines).toBeGreaterThanOrEqual(cok.maxLines);
    expect(cok.maxLines).toBeGreaterThanOrEqual(1);
  });

  it('yazi bandi dilim alanindan tasmiyor', () => {
    for (const count of [3, 6, 8, 12, 16, 24]) {
      const o = carkEtiketOlculeri({ ...LOBI, count });
      const yariUzunluk = (o.maxCharacters * o.fontSize * KARAKTER_ORANI) / 2;
      // Yazi, yaziRadius'ta ortalaniyor; iki ucu da dilim icinde kalmali.
      expect(o.yaziRadius - yariUzunluk).toBeGreaterThan(LOBI.centerRadius);
      expect(o.yaziRadius + yariUzunluk).toBeLessThanOrEqual(LOBI.radius);
    }
  });

  it('satir yigini dilimin ic ucunda komsu dilime tasmiyor', () => {
    // Satirlar yay boyunca yigiliyor. Yazinin EN IC noktasindaki yay
    // genisligi, yigin yuksekligini tasiyabilmeli -- yoksa yazi komsu
    // dilimin uzerine biner.
    for (const count of [8, 12, 16, 24]) {
      const o = carkEtiketOlculeri({ ...LOBI, count });
      const yariUzunluk = (o.maxCharacters * o.fontSize * KARAKTER_ORANI) / 2;
      const icUc = o.yaziRadius - yariUzunluk;
      const yayIcUcta = ((Math.PI * 2) / count) * icUc;
      const yiginYuksekligi = o.maxLines * o.fontSize * 1.15;
      expect(yayIcUcta).toBeGreaterThanOrEqual(yiginYuksekligi);
    }
  });

  it('cok dar bir carkta bile okunabilir bir alt sinir birakiyor', () => {
    const o = carkEtiketOlculeri({ radius: 40, centerRadius: 22, count: 24, etiketler: ETIKETLER });
    expect(o.fontSize).toBeGreaterThanOrEqual(7);
    // 40 px yariçapli bir çarkta 5 karakter geometrinin verdigi gercek
    // cevap; burada aranan, bozulmadan bir sonuc uretmesi.
    expect(o.maxCharacters).toBeGreaterThanOrEqual(4);
    expect(o.maxLines).toBeGreaterThanOrEqual(1);
  });

  it('bozuk punto degeri gecerli bir olcuye dusuyor', () => {
    const o = carkEtiketOlculeri({ ...LOBI, count: 8, labelSize: Number.NaN });
    expect(Number.isFinite(o.fontSize)).toBe(true);
    expect(o.fontSize).toBeGreaterThanOrEqual(8);
  });

  it('telefon boyutunda uzun odul adlari kirpilmadan iki satira siginiyor', () => {
    // 375 px'lik ekranda cark ~232 px; hepsi tek satira sigmaz. Dogru
    // davranis, tek satirda KIRPMAK degil iki satira BOLMEK.
    const TELEFON = { radius: 110, centerRadius: 26, labelSize: 13, etiketler: ETIKETLER };
    const olcu = carkEtiketOlculeri({ ...TELEFON, count: 12 });
    expect(olcu.maxLines).toBe(2);
    for (const etiket of ETIKETLER) {
      const satirlar = carkEtiketSatirlari(etiket, olcu.maxCharacters, olcu.maxLines);
      expect(satirlar.join(' ')).toBe(etiket);
    }
  });

  describe('enAzSatirUzunlugu', () => {
    it('kelime bolunemedigi icin "uzunluk / satir" degil', () => {
      // "250 ₺ DENEME BONUSU" 19 karakter; iki satira 10 ile SIGMAZ
      // (kelimeler "250 ₺" + "DENEME" + "BONUSU" olarak dagilir).
      expect(enAzSatirUzunlugu('250 ₺ Deneme Bonusu', 2)).toBeGreaterThan(10);
      expect(carkEtiketSatirlari('250 ₺ Deneme Bonusu', enAzSatirUzunlugu('250 ₺ Deneme Bonusu', 2), 2)
        .join(' ')).toBe('250 ₺ Deneme Bonusu');
    });

    it('tek satirda etiketin tam uzunlugunu istiyor', () => {
      expect(enAzSatirUzunlugu('1.000 ₺ Nakit', 1)).toBe('1.000 ₺ Nakit'.length);
    });

    it('bolunemeyen tek kelimeden asagi inmiyor', () => {
      expect(enAzSatirUzunlugu('Cevrimsizbonus', 3)).toBe('Cevrimsizbonus'.length);
    });
  });
});
