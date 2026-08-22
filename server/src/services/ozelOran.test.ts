import { describe, expect, it } from 'vitest';
import {
  azamiYukumluluk,
  ekOdemeHesapla,
  katilimiDegerlendir,
  kazandiMi,
  metinEslesiyorMu,
  teklifAcikMi,
  uygunBahsiBul,
  type BahisSatiri,
  type OzelOranTeklifi,
} from './ozelOran.js';

const SIMDI = Date.parse('2026-08-22T18:00:00Z');
const SAAT = 3_600_000;

const teklif = (ekle: Partial<OzelOranTeklifi> = {}): OzelOranTeklifi => ({
  id: 't1',
  matchName: 'Galatasaray - Fenerbahçe',
  marketName: 'Maç Sonucu',
  selectionName: 'Galatasaray',
  specialOdd: 3.5,
  maxStake: 1000,
  minStake: 50,
  opensAt: new Date(SIMDI - 24 * SAAT).toISOString(),
  closesAt: new Date(SIMDI + 2 * SAAT).toISOString(),
  enabled: true,
  status: 'acik',
  ...ekle,
});

const bahis = (ekle: Partial<BahisSatiri> = {}): BahisSatiri => ({
  Id: 9001,
  Amount: 500,
  Price: 2.1,
  StateName: 'Won',
  MatchName: 'Galatasaray SK - Fenerbahçe SK',
  MarketName: 'Maç Sonucu',
  SelectionName: 'Galatasaray SK',
  CreatedLocal: new Date(SIMDI - 2 * SAAT).toISOString(),
  IsBonusBet: false,
  ...ekle,
});

describe('metinEslesiyorMu', () => {
  it('takım eklerine rağmen eşleşir — İKİ yönde de', () => {
    // Panelde "Galatasaray", Lynon'da "Galatasaray SK". Alt dizge
    // arasaydik hicbir mac tutmaz ve modul sessizce HIC KIMSEYE odeme
    // yapmazdi.
    expect(metinEslesiyorMu('Galatasaray SK', 'Galatasaray')).toBe(true);
    expect(metinEslesiyorMu('Galatasaray', 'Galatasaray SK')).toBe(true);
  });

  it('MAÇ ADINI ekli hâliyle eşleştirir', () => {
    expect(metinEslesiyorMu('Galatasaray SK - Fenerbahçe SK', 'Galatasaray - Fenerbahçe')).toBe(true);
  });

  it('takımlardan biri tutmuyorsa eşleşmez', () => {
    expect(metinEslesiyorMu('Galatasaray SK - Beşiktaş JK', 'Galatasaray - Fenerbahçe')).toBe(false);
  });

  it('Türkçe büyük/küçük harfe duyarsız', () => {
    expect(metinEslesiyorMu('BEŞİKTAŞ', 'beşiktaş')).toBe(true);
  });

  it('ilgisiz metni eşleştirmez', () => {
    expect(metinEslesiyorMu('Trabzonspor', 'Galatasaray')).toBe(false);
  });

  it('aranan boşsa her şey eşleşir — pazar opsiyonel', () => {
    expect(metinEslesiyorMu('herhangi', '')).toBe(true);
  });
});

describe('kazandiMi', () => {
  it('bilinen kazanma durumlarını tanır', () => {
    for (const d of ['Won', 'win', 'Kazandı', 'winner']) expect(kazandiMi(d)).toBe(true);
  });

  it('kaybeden ve bekleyeni tanımaz', () => {
    for (const d of ['Lost', 'Pending', 'Cashout', '']) expect(kazandiMi(d)).toBe(false);
  });
});

describe('uygunBahsiBul', () => {
  it('uyan kazanmış bahsi bulur', () => {
    const s = uygunBahsiBul([bahis()], teklif());
    expect(s.uygun).toBe(true);
    expect(s.uygun === true && s.tutar).toBe(500);
    expect(s.uygun === true && s.alinanOran).toBe(2.1);
  });

  it('bahis yoksa bildirir', () => {
    expect(uygunBahsiBul([], teklif())).toMatchObject({ uygun: false, kod: 'bahisYok' });
    expect(uygunBahsiBul(null, teklif())).toMatchObject({ uygun: false, kod: 'bahisYok' });
  });

  it('başka maça yapılan bahsi almaz', () => {
    const s = uygunBahsiBul([bahis({ MatchName: 'Beşiktaş - Trabzonspor', SelectionName: 'Beşiktaş' })], teklif());
    expect(s).toMatchObject({ uygun: false, kod: 'bahisYok' });
  });

  it('aynı maçta BAŞKA seçimi almaz', () => {
    const s = uygunBahsiBul([bahis({ SelectionName: 'Fenerbahçe SK' })], teklif());
    expect(s).toMatchObject({ uygun: false, kod: 'bahisYok' });
  });

  it('kaybeden bahsi almaz', () => {
    expect(uygunBahsiBul([bahis({ StateName: 'Lost' })], teklif()))
      .toMatchObject({ uygun: false, kod: 'kazanmadi' });
  });

  it('BONUS bahsi almaz — kasadan iki kez ödeme olurdu', () => {
    expect(uygunBahsiBul([bahis({ IsBonusBet: true })], teklif()))
      .toMatchObject({ uygun: false, kod: 'bonusBahis' });
  });

  it('pencere AÇILMADAN önce alınan bahsi almaz', () => {
    // Oran duyurulmadan once alinmis bahis odullendirilseydi, teklif
    // gecmise donuk para dagitirdi.
    const erken = bahis({ CreatedLocal: new Date(SIMDI - 48 * SAAT).toISOString() });
    expect(uygunBahsiBul([erken], teklif())).toMatchObject({ uygun: false, kod: 'pencereDisi' });
  });

  it('pencere KAPANDIKTAN sonra alınan bahsi almaz', () => {
    const gec = bahis({ CreatedLocal: new Date(SIMDI + 5 * SAAT).toISOString() });
    expect(uygunBahsiBul([gec], teklif())).toMatchObject({ uygun: false, kod: 'pencereDisi' });
  });

  it('tarihi okunamayan bahsi ELEMEZ', () => {
    // Tarih alani bos gelen bir kurulumda hicbir odeme yapilmamasi, veri
    // eksikligini oyuncuya fatura etmek olurdu.
    const s = uygunBahsiBul([bahis({ CreatedLocal: 'bozuk' })], teklif());
    expect(s.uygun).toBe(true);
  });

  it('minimum tutarın altındaki bahsi almaz', () => {
    expect(uygunBahsiBul([bahis({ Amount: 20 })], teklif()))
      .toMatchObject({ uygun: false, kod: 'tutarDusuk' });
  });

  it('birden fazla uyan bahiste EN BÜYÜĞÜ seçilir', () => {
    // Oyuncu ayni maca birkac kupon yapmis olabilir; hangisini
    // kastettigini soramayiz, lehe yorum sikayet uretmez.
    const s = uygunBahsiBul([bahis({ Amount: 200 }), bahis({ Id: 9002, Amount: 800 })], teklif());
    expect(s.uygun === true && s.tutar).toBe(800);
  });

  it('pazar belirtilmemişse pazar aranmaz', () => {
    const s = uygunBahsiBul([bahis({ MarketName: 'Karşılıklı Gol' })], teklif({ marketName: '' }));
    expect(s.uygun).toBe(true);
  });
});

describe('ekOdemeHesapla', () => {
  it('farkı bahis tutarıyla çarpar', () => {
    // Site zaten 2.10'dan odedi; panel farki tamamliyor.
    const o = ekOdemeHesapla(teklif(), 500, 2.1);
    expect(o.tutar).toBe(700);
    expect(o.aciklama).toContain('500 ₺ × (3.5 − 2.1)');
  });

  it('üst sınırı uygular ve bunu SÖYLER', () => {
    const o = ekOdemeHesapla(teklif({ maxStake: 1000 }), 5000, 2.1);
    expect(o.esasTutar).toBe(1000);
    expect(o.tutar).toBe(1400);
    expect(o.aciklama).toContain('üst sınır');
  });

  it('alınan oran özel orandan YÜKSEKSE ödeme yok', () => {
    // Site zaten daha iyisini vermis; ustune para eklemek kasadan
    // sebepsiz cikis olurdu.
    const o = ekOdemeHesapla(teklif(), 500, 4.0);
    expect(o.tutar).toBe(0);
    expect(o.aciklama).toContain('düşük değil');
  });

  it('oranlar eşitse ödeme yok', () => {
    expect(ekOdemeHesapla(teklif({ specialOdd: 2.1 }), 500, 2.1).tutar).toBe(0);
  });

  it('sıfır tutarda ödeme yok', () => {
    expect(ekOdemeHesapla(teklif(), 0, 2.1).tutar).toBe(0);
  });

  it('üst sınır yoksa tam tutar esas alınır', () => {
    expect(ekOdemeHesapla(teklif({ maxStake: 0 }), 5000, 2.1).esasTutar).toBe(5000);
  });

  it('kuruş yuvarlaması yapılır', () => {
    const o = ekOdemeHesapla(teklif({ specialOdd: 3.33 }), 333, 1.11);
    expect(o.tutar).toBe(Math.round(333 * 2.22 * 100) / 100);
  });
});

describe('katilimiDegerlendir', () => {
  it('uygun katılımcı için ödeme üretir', () => {
    const s = katilimiDegerlendir('test777', [bahis()], teklif());
    expect(s).toMatchObject({ login: 'test777', uygun: true, ekOdeme: 700 });
    expect(s.betId).toBe('9001');
  });

  it('uygunsuz katılımcıda sebep bildirir, ödeme sıfır', () => {
    const s = katilimiDegerlendir('x', [bahis({ StateName: 'Lost' })], teklif());
    expect(s.uygun).toBe(false);
    expect(s.kod).toBe('kazanmadi');
    expect(s.ekOdeme).toBe(0);
  });

  it('bahis bulundu ama ödeme sıfırsa UYGUN sayılmaz', () => {
    // Odeme yapilmayacak bir satiri "uygun" gostermek, operatore
    // olmayan bir borcu var gibi gosterirdi.
    const s = katilimiDegerlendir('x', [bahis({ Price: 5 })], teklif());
    expect(s.uygun).toBe(false);
    expect(s.ekOdeme).toBe(0);
  });
});

describe('teklifAcikMi', () => {
  it('açık teklif açıktır', () => {
    expect(teklifAcikMi(teklif(), SIMDI)).toBe(true);
  });

  it('kapatılmış teklif kapalıdır', () => {
    expect(teklifAcikMi(teklif({ enabled: false }), SIMDI)).toBe(false);
    expect(teklifAcikMi(teklif({ status: 'sonuclandi' }), SIMDI)).toBe(false);
  });

  it('pencere dışında kapalıdır', () => {
    expect(teklifAcikMi(teklif(), SIMDI - 48 * SAAT)).toBe(false);
    expect(teklifAcikMi(teklif(), SIMDI + 48 * SAAT)).toBe(false);
  });

  it('tarih verilmemişse pencere aranmaz', () => {
    expect(teklifAcikMi(teklif({ opensAt: null, closesAt: null }), SIMDI + 999 * SAAT)).toBe(true);
  });
});

describe('azamiYukumluluk', () => {
  it('en kötü durumu hesaplar', () => {
    // 1000 TL x (3.5 - 1) x 10 katilimci
    expect(azamiYukumluluk(teklif(), 10)).toBe(25_000);
  });

  it('katılımcı yoksa sıfır', () => {
    expect(azamiYukumluluk(teklif(), 0)).toBe(0);
  });
});
