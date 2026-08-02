import { describe, expect, it } from 'vitest';
import { yatirimMi, yeniYatirimGerekiyorMu } from './bonusYatirimHakki.js';
import { parseDateToTime } from './accountSnapshotService.js';

/**
 * PARA SIZINTISI REGRESYON TESTI.
 *
 * Bildirilen vaka: oyuncu 2496091, "100 FS - Telegram Katil Bonusu"
 * (kampanya 1885) bonusunu cok sayida almis.
 *
 * Mekanizma: kampanya atama yolunda hicbir mukerrer korumasi yoktu. Tek
 * engel perDayLimit/perWeekLimit, onlar da kuralda acikca ayarlanmadikca
 * calismiyor. Kuralin tek sarti `requiresTelegramMember`; oyuncu kanala
 * bir kez katiliyor ve o sart sonsuza kadar dogru kaliyor.
 */

const GUN = 24 * 60 * 60 * 1000;
const simdi = Date.parse('2026-08-02T00:00:00Z');
const gunOnce = (n: number) => new Date(simdi - n * GUN).toISOString();

const coz = parseDateToTime;

const atama = (ad: string, tarih: string, id?: number) =>
  ({ Id: id, Name: ad, CreatedLocal: tarih });

const yatirim = (tarih: string) => ({ DocumentTypeName: 'Yatırım', CreatedLocal: tarih });

const calistir = (input: {
  atamalar?: any[];
  nakit?: any[];
  yatirimlar?: any[];
  promo?: any;
}) =>
  yeniYatirimGerekiyorMu({
    atamalar: input.atamalar ?? [],
    nakit: input.nakit ?? [],
    yatirimlar: input.yatirimlar ?? [],
    promo: input.promo ?? { id: 1885, title: '100 FS - Telegram Katıl Bonusu' },
    coz,
  });

describe('bildirilen vaka: Telegram katıl bonusu', () => {
  it('hiç alınmamışsa geçer', () => {
    expect(calistir({}).uygun).toBe(true);
  });

  it('bir kez alınmış ve arada yatırım YOK → RED', () => {
    const sonuc = calistir({
      atamalar: [atama('100 FS - Telegram Katıl Bonusu', gunOnce(1), 1885)],
    });
    expect(sonuc.uygun).toBe(false);
    expect((sonuc as any).neden).toContain('yeni yatırım');
  });

  it('yatırım şartı olmayan bonus fiilen ömürde bir kez olur', () => {
    // Hic yatirim yok — oyuncu kanala katildi diye tekrar tekrar alamaz.
    const sonuc = calistir({
      atamalar: [atama('100 FS - Telegram Katıl Bonusu', gunOnce(5), 1885)],
      yatirimlar: [],
    });
    expect(sonuc.uygun).toBe(false);
  });

  it('araya yeni yatırım girdiyse tekrar alınabilir', () => {
    const sonuc = calistir({
      atamalar: [atama('100 FS - Telegram Katıl Bonusu', gunOnce(3), 1885)],
      yatirimlar: [yatirim(gunOnce(1))],
    });
    expect(sonuc.uygun).toBe(true);
  });

  it('yatırım verilişten ÖNCEyse hakkı açmaz', () => {
    const sonuc = calistir({
      atamalar: [atama('100 FS - Telegram Katıl Bonusu', gunOnce(1), 1885)],
      yatirimlar: [yatirim(gunOnce(3))],
    });
    expect(sonuc.uygun).toBe(false);
  });

  it('birden fazla veriliş varsa EN SON verilişe bakılır', () => {
    const sonuc = calistir({
      atamalar: [
        atama('100 FS - Telegram Katıl Bonusu', gunOnce(5), 1885),
        atama('100 FS - Telegram Katıl Bonusu', gunOnce(1), 1885),
      ],
      // Yatirim ilk verilisten sonra ama ikinciden once — yetmez.
      yatirimlar: [yatirim(gunOnce(3))],
    });
    expect(sonuc.uygun).toBe(false);
  });
});

describe('bonus eşleştirme', () => {
  it('kimlik eşleşmesi yeter', () => {
    expect(calistir({ atamalar: [atama('Bambaşka Ad', gunOnce(1), 1885)] }).uygun).toBe(false);
  });

  it('ad eşleşmesi yeter (kimlik yokken)', () => {
    expect(calistir({ atamalar: [atama('100 FS - Telegram Katıl Bonusu', gunOnce(1))] }).uygun).toBe(false);
  });

  it('BAŞKA bonusun verilişi bu bonusu engellemez', () => {
    expect(calistir({ atamalar: [atama('Kayıp Bonusu', gunOnce(1), 1306)] }).uygun).toBe(true);
  });

  it('büyük/küçük harf farkı engellemeyi bozmaz', () => {
    expect(calistir({ atamalar: [atama('100 fs - telegram katıl bonusu', gunOnce(1))] }).uygun).toBe(false);
  });
});

describe('nakit bonuslar da sayılır', () => {
  const promo = { id: 'kayip-bonusu', title: 'Kayıp Bonusu' };

  it('bakiye düzeltmesiyle verilmiş bonus tekrarı engeller', () => {
    const sonuc = calistir({
      promo,
      nakit: [{ kuralAnahtari: 'kayip-bonusu', zaman: simdi - GUN }],
    });
    expect(sonuc.uygun).toBe(false);
  });

  it('araya yatırım girdiyse geçer', () => {
    const sonuc = calistir({
      promo,
      nakit: [{ kuralAnahtari: 'kayip-bonusu', zaman: simdi - 3 * GUN }],
      yatirimlar: [yatirim(gunOnce(1))],
    });
    expect(sonuc.uygun).toBe(true);
  });

  it('başka kuralın nakit kullanımı karışmaz', () => {
    expect(calistir({ promo, nakit: [{ kuralAnahtari: 'baska', zaman: simdi - GUN }] }).uygun).toBe(true);
  });

  it('kampanya ve nakit birlikte — en son olan esas alınır', () => {
    const sonuc = calistir({
      promo: { id: 'kayip-bonusu', title: 'Kayıp Bonusu' },
      atamalar: [atama('Kayıp Bonusu', gunOnce(5))],
      nakit: [{ kuralAnahtari: 'kayip-bonusu', zaman: simdi - GUN }],
      yatirimlar: [yatirim(gunOnce(3))],
    });
    // Yatirim kampanya verilisinden sonra ama nakit verilisinden once.
    expect(sonuc.uygun).toBe(false);
  });
});

describe('yatırım türü tanıma', () => {
  it('bilinen yatırım türleri', () => {
    expect(yatirimMi({ DocumentTypeName: 'Yatırım' })).toBe(true);
    expect(yatirimMi({ DocumentTypeName: 'Deposit' })).toBe(true);
    expect(yatirimMi({ DocumentTypeName: 'Yatırım Talebi Ödemesi' })).toBe(true);
  });

  it('çekim yatırım sayılmaz', () => {
    expect(yatirimMi({ DocumentTypeName: 'Çekim Talebi Ödemesi' })).toBe(false);
    expect(yatirimMi({} as never)).toBe(false);
  });

  it('çekim hakkı açmaz', () => {
    const sonuc = calistir({
      atamalar: [atama('100 FS - Telegram Katıl Bonusu', gunOnce(3), 1885)],
      yatirimlar: [{ DocumentTypeName: 'Çekim Talebi Ödemesi', CreatedLocal: gunOnce(1) }],
    });
    expect(sonuc.uygun).toBe(false);
  });
});

describe('bozuk girdi', () => {
  it('null satırlar ve boş listeler çökmez', () => {
    expect(
      yeniYatirimGerekiyorMu({
        atamalar: [null as never],
        nakit: [null as never],
        yatirimlar: [null as never],
        promo: { id: 1, title: 'x' },
        coz,
      }).uygun,
    ).toBe(true);
  });

  it('tarihi okunamayan veriliş sayılmaz', () => {
    expect(calistir({ atamalar: [atama('100 FS - Telegram Katıl Bonusu', 'çöp', 1885)] }).uygun).toBe(true);
  });

  it('boş kural anahtarı nakit kullanımlarını yanlışlıkla eşleştirmez', () => {
    const sonuc = calistir({
      promo: { id: '', title: '' },
      nakit: [{ kuralAnahtari: '', zaman: simdi - GUN }],
    });
    expect(sonuc.uygun).toBe(true);
  });
});

/**
 * UCTAN UCA: kural degerlendiricisi bu maddeyi VARSAYILAN olarak
 * uyguluyor ve madde overallOk'u dusuruyor.
 */
describe('gerçek kuralla uçtan uca', () => {
  const kural = { enabled: true, title: '100 FS - Telegram Katıl Bonusu', requiresTelegramMember: false };
  const kurallar = { PROMO_SPECS: { '1885': kural }, PROMO_TITLE_SPECS: {} } as any;

  const hesap = (bonuslar: any[], hareketler: any[] = []) =>
    ({
      id: 2496091, balance: 0, bonuses: bonuslar,
      balanceCorrections: [], profileTransactions: hareketler, profileTransactionsByType: {},
      dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
    }) as any;

  const degerlendir = async (bonuslar: any[], hareketler: any[] = []) => {
    const { evaluateForAccount } = await import('./promoEvaluator.js');
    return evaluateForAccount(
      hesap(bonuslar, hareketler),
      { id: 1885, title: '100 FS - Telegram Katıl Bonusu' } as any,
      kurallar, 'default', 'bonus',
    );
  };

  it('hiç alınmamışsa madde geçer', async () => {
    const r = await degerlendir([]);
    expect(r.items.find((i: any) => i.id === 'deposit-scoped-usage')?.ok).toBe(true);
  });

  it('bir kez alınmış, yeni yatırım yok → madde DÜŞER ve talebi engeller', async () => {
    const r = await degerlendir([
      { Id: 1885, Name: '100 FS - Telegram Katıl Bonusu', CreatedLocal: gunOnce(1) },
    ]);
    const madde = r.items.find((i: any) => i.id === 'deposit-scoped-usage');
    expect(madde?.ok).toBe(false);
    // Madde ENGELLEMEYEN listesinde OLMAMALI; yoksa sizinti kapanmaz.
    expect(r.overallOk).toBe(false);
  });

  it('araya yatırım girmişse tekrar alınabilir', async () => {
    const r = await degerlendir(
      [{ Id: 1885, Name: '100 FS - Telegram Katıl Bonusu', CreatedLocal: gunOnce(3) }],
      [{ DocumentTypeName: 'Yatırım', CreatedLocal: gunOnce(1) }],
    );
    expect(r.items.find((i: any) => i.id === 'deposit-scoped-usage')?.ok).toBe(true);
  });

  it('allowMultiplePerDeposit açıksa madde hiç eklenmez', async () => {
    const { evaluateForAccount } = await import('./promoEvaluator.js');
    const r = await evaluateForAccount(
      hesap([{ Id: 1885, Name: '100 FS - Telegram Katıl Bonusu', CreatedLocal: gunOnce(1) }]),
      { id: 1885, title: '100 FS - Telegram Katıl Bonusu' } as any,
      { PROMO_SPECS: { '1885': { ...kural, allowMultiplePerDeposit: true } }, PROMO_TITLE_SPECS: {} } as any,
      'default', 'bonus',
    );
    expect(r.items.find((i: any) => i.id === 'deposit-scoped-usage')).toBeUndefined();
  });
});

/**
 * KAPSAM AYRIMI.
 *
 * autoWithdrawJob `checklists.every((c) => c.overallOk)` istiyor. Bu madde
 * cekim kapsaminda da dusseydi, bonusunu almis her oyuncunun OTOMATIK
 * CEKIMI bloke olurdu. Verme kurali odeme kuralina karismamali.
 */
describe('kapsam ayrımı — çekimi engellemez', () => {
  it('çekim kapsamında madde hiç eklenmez', async () => {
    const { evaluateForAccount } = await import('./promoEvaluator.js');
    const r = await evaluateForAccount(
      {
        id: 2496091, balance: 0,
        bonuses: [{ Id: 1885, Name: '100 FS - Telegram Katıl Bonusu', CreatedLocal: gunOnce(1) }],
        balanceCorrections: [], profileTransactions: [], profileTransactionsByType: {},
        dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
      } as any,
      { id: 1885, title: '100 FS - Telegram Katıl Bonusu' } as any,
      { PROMO_SPECS: { '1885': { enabled: true, title: '100 FS - Telegram Katıl Bonusu' } }, PROMO_TITLE_SPECS: {} } as any,
      'default',
      'cekim',
    );
    expect(r.items.find((i: any) => i.id === 'deposit-scoped-usage')).toBeUndefined();
  });
});

/**
 * "2X BONUSU ALINAMIYOR" REGRESYON TESTI.
 *
 * Ilk surum adlari ALT DIZE ile karsilastiriyordu:
 *   ad.includes(promoBaslik) || promoBaslik.includes(ad)
 *
 * Ikinci yon olduruyordu: DAHA GENEL adli bir bonus ozel olani yutuyor.
 * "2x Yatırım Bonusu" talebi, oyuncuya daha once verilmis "Yatırım
 * Bonusu" yuzunden engelleniyordu — bunlar AYRI bonuslar.
 */
describe('ad eşleştirme — bildirilen "2x alınamıyor"', () => {
  const iki = (atamaAdi: string) =>
    yeniYatirimGerekiyorMu({
      atamalar: [{ Name: atamaAdi, CreatedLocal: gunOnce(1) }],
      nakit: [],
      yatirimlar: [],
      promo: { title: '2x Yatırım Bonusu' },
      coz,
    });

  it('GENEL adlı başka bonus 2x’i ENGELLEMEZ', () => {
    expect(iki('Yatırım Bonusu').uygun).toBe(true);
  });

  it('sadece "Bonus" adlı atama da engellemez', () => {
    expect(iki('Bonus').uygun).toBe(true);
  });

  it('gerçekten aynı bonus engeller', () => {
    expect(iki('2x Yatırım Bonusu').uygun).toBe(false);
  });

  it('tire/boşluk farkı tolere edilir — Lynon kampanya ve bonus adı ayrışabiliyor', () => {
    const sonuc = yeniYatirimGerekiyorMu({
      atamalar: [{ Name: '100 FS Telegram Katıl Bonusu', CreatedLocal: gunOnce(1) }],
      nakit: [],
      yatirimlar: [],
      promo: { title: '100 FS - Telegram Katıl Bonusu' },
      coz,
    });
    expect(sonuc.uygun).toBe(false);
  });

  it('Türkçe karakter farkı eşleşmeyi bozmaz', () => {
    const sonuc = yeniYatirimGerekiyorMu({
      atamalar: [{ Name: 'KAYIP BONUSU', CreatedLocal: gunOnce(1) }],
      nakit: [],
      yatirimlar: [],
      promo: { title: 'Kayıp Bonusu' },
      coz,
    });
    expect(sonuc.uygun).toBe(false);
  });

  it('kimlik eşleşmesi ada bakmadan çalışır', () => {
    const sonuc = yeniYatirimGerekiyorMu({
      atamalar: [{ Id: 1885, Name: 'Bambaşka', CreatedLocal: gunOnce(1) }],
      nakit: [],
      yatirimlar: [],
      promo: { id: 1885, title: '2x Yatırım Bonusu' },
      coz,
    });
    expect(sonuc.uygun).toBe(false);
  });
});
