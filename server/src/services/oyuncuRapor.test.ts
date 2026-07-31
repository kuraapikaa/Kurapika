import { describe, expect, it } from 'vitest';
import {
  loginAnahtari,
  raporSatiriCozumle,
  raporSayisi,
  siralamaOlustur,
  type OyuncuRaporSatiri,
} from './oyuncuRaporService.js';

/**
 * Rapor 1841 cozumlemesi.
 *
 * En kritik davranis: FILTERED kolonlarinin omur boyu kolonlarindan AYRI
 * tutulmasi. Karisirsa "bugun 500 TL yatir" gorevi, gecmiste yatirimi olan
 * herkeste aninda tamamlanmis gorunur.
 */

/** Kullanicinin verdigi gercek cevaptan alinmis satir. */
const GERCEK_SATIR = {
  'Player ID': '2488553',
  'User Name': 'nejla44',
  'Affiliate Id': null,
  FullName: 'Nejla Akgümüş',
  Category: 'Yeni Oyuncu',
  Email: 'aslannej1@gmail.com',
  'Is Mail Verified': true,
  PhoneNumber: '+905464987614',
  'Is Phone Verified': true,
  Currency: 'TRY',
  'TOTAL BALANCE': '0.4',
  'REAL BALANCE': '0.4',
  'BONUS BALANCE': '0',
  'TOTAL DEPOSITS AMOUNT': '0',
  'TOTAL DEPOSITS COUNT': '0',
  'TOTAL WITHDRAWALS AMOUNT': '0',
  'TOTAL WITHDRAWALS COUNT': '0',
  'TOTAL BET AMOUNT': '202',
  'TOTAL WIN AMOUNT': '88.6',
  GGR: '113.4',
  'CASINO REAL BETS': '202',
  'CASINO REAL WINS': '88.6',
  'CASINO GGR': '113.4',
  'SPORT REAL BETS': '0',
  'TOTAL DEPOSITS AMOUNT FILTERED': '0',
  'TOTAL DEPOSITS COUNT FILTERED': '0',
  'TOTAL BET AMOUNT FILTERED': '0',
  'GGR FILTERED': '0',
  'CASINO REAL BETS FILTERED': '0',
  'SPORT REAL BETS FILTERED': '0',
};

describe('rapor sayısı çözümleme', () => {
  it('string sayıları çözer', () => {
    expect(raporSayisi('202')).toBe(202);
    expect(raporSayisi('113.4')).toBe(113.4);
    expect(raporSayisi('0')).toBe(0);
  });

  it('boş ve null güvenli', () => {
    expect(raporSayisi(null)).toBe(0);
    expect(raporSayisi(undefined)).toBe(0);
    expect(raporSayisi('')).toBe(0);
    expect(raporSayisi('-')).toBe(0);
  });

  it('negatif değer korunur — GGR eksi olabilir', () => {
    expect(raporSayisi('-4500.75')).toBe(-4500.75);
  });

  it('nokta ondalık ayırıcıdır — uç değişmez format kullanıyor', () => {
    // "12.500" bu ucta 12,5 demek; 12.500 DEGIL. Yerel-format tahmini
    // yapilsaydi deger 1000 kat sisebilirdi.
    expect(raporSayisi('12.500')).toBe(12.5);
    expect(raporSayisi('0.4')).toBe(0.4);
  });

  it('belirsiz karışık ayırıcı 0 döner — tahmin edilmez', () => {
    // Sessizce yanlis sayi uretmektense eksik gostermek dogru.
    expect(raporSayisi('1.234,56')).toBe(0);
    expect(raporSayisi('1,234.56')).toBe(0);
  });

  it('tek ondalık virgül belirsiz değil, kabul edilir', () => {
    expect(raporSayisi('113,4')).toBe(113.4);
  });

  it('para birimi eki temizlenir', () => {
    expect(raporSayisi('1500 ₺')).toBe(1500);
  });
});

describe('satır çözümleme', () => {
  const satir = raporSatiriCozumle(GERCEK_SATIR);

  it('kimlik alanları', () => {
    expect(satir.playerId).toBe('2488553');
    expect(satir.login).toBe('nejla44');
    expect(satir.adSoyad).toBe('Nejla Akgümüş');
    expect(satir.kategori).toBe('Yeni Oyuncu');
    expect(satir.telefonDogrulandi).toBe(true);
    expect(satir.emailDogrulandi).toBe(true);
  });

  it('ömür boyu metrikler dolu', () => {
    expect(satir.omurBoyu.bahisTutari).toBe(202);
    expect(satir.omurBoyu.ggr).toBe(113.4);
    expect(satir.omurBoyu.gercekBakiye).toBe(0.4);
  });

  it('DÖNEM metrikleri ömür boyudan AYRI — bu oyuncu bugün oynamadı', () => {
    // Kritik ayrim: omur boyu 202 TL bahis var ama bugun 0.
    // Gunluk gorev bu 0'i gormeli, 202'yi degil.
    expect(satir.donem.bahisTutari).toBe(0);
    expect(satir.donem.casinoBahis).toBe(0);
    expect(satir.donem.yatirimTutari).toBe(0);
    expect(satir.omurBoyu.bahisTutari).toBe(202);
  });

  it('eksik kolonlar 0 döner, çökmez', () => {
    const bos = raporSatiriCozumle({ 'User Name': 'x' });
    expect(bos.donem.yatirimTutari).toBe(0);
    expect(bos.omurBoyu.toplamBakiye).toBe(0);
    expect(bos.login).toBe('x');
  });

  it('Affiliate Id null ise boş string', () => {
    expect(satir.affiliateId).toBe('');
  });

  it('doğrulama bayrakları yalnızca gerçek true ise true', () => {
    // "true" metni ya da 1 gelirse dogrulanmis sayilmamali.
    expect(raporSatiriCozumle({ 'Is Phone Verified': 'true' }).telefonDogrulandi).toBe(false);
    expect(raporSatiriCozumle({ 'Is Phone Verified': 1 }).telefonDogrulandi).toBe(false);
    expect(raporSatiriCozumle({ 'Is Phone Verified': false }).telefonDogrulandi).toBe(false);
  });
});

describe('login anahtarı', () => {
  it('büyük/küçük harf ve boşluk duyarsız', () => {
    expect(loginAnahtari('  NeJla44 ')).toBe('nejla44');
  });

  it('Türkçe İ doğru küçültülür', () => {
    expect(loginAnahtari('İSMAİL')).toBe(loginAnahtari('ismail'));
  });
});

describe('turnuva sıralaması', () => {
  const olustur = (login: string, bahis: number, yatirim = 0): OyuncuRaporSatiri =>
    raporSatiriCozumle({
      'User Name': login,
      'Player ID': `id-${login}`,
      'TOTAL BET AMOUNT FILTERED': String(bahis),
      'TOTAL DEPOSITS AMOUNT FILTERED': String(yatirim),
    });

  const liste = [olustur('ali', 500), olustur('veli', 1500), olustur('ayse', 0), olustur('fatma', 900)];

  it('dönem bahsine göre büyükten küçüğe', () => {
    const sira = siralamaOlustur(liste, 'bahisTutari');
    expect(sira.map((s) => s.login)).toEqual(['veli', 'fatma', 'ali']);
    expect(sira[0].sira).toBe(1);
    expect(sira[0].deger).toBe(1500);
  });

  it('sıfır değerli oyuncu listeye girmez', () => {
    expect(siralamaOlustur(liste, 'bahisTutari').some((s) => s.login === 'ayse')).toBe(false);
  });

  it('eşitlikte sıra kararlı — alfabetik', () => {
    const esit = [olustur('zeynep', 100), olustur('ahmet', 100), olustur('mehmet', 100)];
    expect(siralamaOlustur(esit, 'bahisTutari').map((s) => s.login)).toEqual(['ahmet', 'mehmet', 'zeynep']);
  });

  it('limit uygulanır', () => {
    expect(siralamaOlustur(liste, 'bahisTutari', 2)).toHaveLength(2);
  });

  it('limit 0 boş liste', () => {
    expect(siralamaOlustur(liste, 'bahisTutari', 0)).toEqual([]);
  });

  it('farklı metrikle sıralanabilir', () => {
    const yatirimli = [olustur('a', 10, 5000), olustur('b', 9999, 100)];
    expect(siralamaOlustur(yatirimli, 'yatirimTutari').map((s) => s.login)).toEqual(['a', 'b']);
  });

  it('sıralama ÖMÜR BOYU değil dönem değerini kullanır', () => {
    // Omur boyu devasa ama bu donem hic oynamamis oyuncu turnuvada
    // birinci gorunmemeli.
    const eskiSampiyon = raporSatiriCozumle({
      'User Name': 'eski',
      'TOTAL BET AMOUNT': '9999999',
      'TOTAL BET AMOUNT FILTERED': '0',
    });
    const bugunOynayan = raporSatiriCozumle({
      'User Name': 'yeni',
      'TOTAL BET AMOUNT': '10',
      'TOTAL BET AMOUNT FILTERED': '250',
    });
    expect(siralamaOlustur([eskiSampiyon, bugunOynayan], 'bahisTutari').map((s) => s.login)).toEqual(['yeni']);
  });
});
