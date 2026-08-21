import { describe, expect, it } from 'vitest';
import { genelToplam, kullaniciAdlariniAyikla, oyuncuOzeti, type OdemeSatiri } from './topluIslemOzeti.js';

const satir = (
  tur: string,
  tutar: number,
  tarih: string,
  durum = 'success',
): OdemeSatiri => ({ transactionType: tur, amount: tutar, createdAt: tarih, status: durum });

describe('oyuncuOzeti — tür ayrımı', () => {
  const veri = [
    satir('deposit', 1000, '2026-08-01T10:00:00Z'),
    satir('deposit', 500, '2026-08-05T10:00:00Z'),
    satir('withdrawal', 300, '2026-08-06T10:00:00Z'),
  ];

  it('yatırım ve çekimi ayrı toplar', () => {
    const o = oyuncuOzeti(veri);
    expect(o.yatirim).toMatchObject({ toplam: 1500, adet: 2 });
    expect(o.cekim).toMatchObject({ toplam: 300, adet: 1 });
    expect(o.net).toBe(1200);
  });

  it('başarısız işlemleri saymaz', () => {
    // Bekleyen ya da reddedilen bir cekim kasadan cikmis para DEGILDIR.
    const o = oyuncuOzeti([
      ...veri,
      satir('withdrawal', 9999, '2026-08-07T10:00:00Z', 'pending'),
      satir('deposit', 8888, '2026-08-07T10:00:00Z', 'failed'),
    ]);
    expect(o.yatirim.toplam).toBe(1500);
    expect(o.cekim.toplam).toBe(300);
  });

  it('boş/geçersiz girdide sıfır döner, çökmez', () => {
    expect(oyuncuOzeti([]).net).toBe(0);
    expect(oyuncuOzeti(null).yatirim.adet).toBe(0);
    expect(oyuncuOzeti(undefined).cekim.adet).toBe(0);
  });
});

describe('oyuncuOzeti — ayrı tarih aralıkları', () => {
  const veri = [
    satir('deposit', 100, '2026-07-01T10:00:00Z'),
    satir('deposit', 200, '2026-08-10T10:00:00Z'),
    satir('withdrawal', 50, '2026-07-02T10:00:00Z'),
    satir('withdrawal', 70, '2026-08-11T10:00:00Z'),
  ];

  it('yatırım ve çekim BAĞIMSIZ aralık kullanır', () => {
    // Modulun varlik sebebi: "agustosta yatiranlarin temmuzdaki cekimleri"
    // tek bir aralikla sorulamiyor.
    const o = oyuncuOzeti(
      veri,
      { baslangic: '2026-08-01T00:00:00Z' },
      { baslangic: '2026-07-01T00:00:00Z', bitis: '2026-07-31T23:59:59Z' },
    );
    expect(o.yatirim.toplam).toBe(200);
    expect(o.cekim.toplam).toBe(50);
    expect(o.net).toBe(150);
  });

  it('yatırımda yalnızca başlangıç verilince üst sınır olmaz', () => {
    const o = oyuncuOzeti(veri, { baslangic: '2026-07-01T00:00:00Z' });
    expect(o.yatirim.toplam).toBe(300);
  });

  it('aralık verilmezse hepsi sayılır', () => {
    const o = oyuncuOzeti(veri);
    expect(o.yatirim.toplam).toBe(300);
    expect(o.cekim.toplam).toBe(120);
  });

  it('sınır anları DAHİL', () => {
    const o = oyuncuOzeti(
      [satir('deposit', 10, '2026-08-01T00:00:00Z'), satir('deposit', 20, '2026-08-31T23:59:59Z')],
      { baslangic: '2026-08-01T00:00:00Z', bitis: '2026-08-31T23:59:59Z' },
    );
    expect(o.yatirim.toplam).toBe(30);
  });

  it('sınırın bir milisaniye dışı HARİÇ', () => {
    const o = oyuncuOzeti(
      [satir('deposit', 10, '2026-07-31T23:59:59.999Z')],
      { baslangic: '2026-08-01T00:00:00Z' },
    );
    expect(o.yatirim.toplam).toBe(0);
  });

  it('ilk ve son işlem tarihini bildirir', () => {
    // Verinin gercekten kapsandigini gormek icin: bos bir aralik ile
    // "hic islem yok" birbirinden ayirt edilebilmeli.
    const o = oyuncuOzeti(veri, { baslangic: '2026-07-01T00:00:00Z' });
    expect(o.yatirim.ilk).toBe('2026-07-01T10:00:00.000Z');
    expect(o.yatirim.son).toBe('2026-08-10T10:00:00.000Z');
    expect(oyuncuOzeti([]).yatirim.ilk).toBeNull();
  });
});

describe('oyuncuOzeti — tutar ve tarih alanları', () => {
  it('çekim negatif gelse de mutlak değer sayılır', () => {
    // Lynon kimi kurulumda cekimi negatif donduruyor; isaretine guvenmek
    // toplami sessizce sifira yaklastirirdi.
    const o = oyuncuOzeti([satir('withdrawal', -500, '2026-08-01T10:00:00Z')]);
    expect(o.cekim.toplam).toBe(500);
  });

  it('amount boşsa actualAmount kullanılır', () => {
    const o = oyuncuOzeti([
      { transactionType: 'deposit', amount: 0, actualAmount: 250, createdAt: '2026-08-01T10:00:00Z', status: 'success' },
    ]);
    expect(o.yatirim.toplam).toBe(250);
  });

  it('createdAt yoksa creationDate kullanılır', () => {
    const o = oyuncuOzeti(
      [{ transactionType: 'deposit', amount: 100, creationDate: '2026-08-05T10:00:00Z', status: 'success' }],
      { baslangic: '2026-08-01T00:00:00Z' },
    );
    expect(o.yatirim.toplam).toBe(100);
  });

  it('tarihi okunamayan satır aralık verilince ELENIR', () => {
    // Tarihsiz bir satiri "araliga girer" saymak, secilen donemin disindaki
    // parayi toplama sokardi.
    const o = oyuncuOzeti(
      [{ transactionType: 'deposit', amount: 100, createdAt: 'bozuk', status: 'success' }],
      { baslangic: '2026-08-01T00:00:00Z' },
    );
    expect(o.yatirim.toplam).toBe(0);
  });

  it('type/state alan adlarını da tanır', () => {
    const o = oyuncuOzeti([{ type: 'deposit', state: 'success', amount: 75, createdAt: '2026-08-01T10:00:00Z' }]);
    expect(o.yatirim.toplam).toBe(75);
  });

  it('kuruşlu tutarlarda kayan nokta birikimi yuvarlanır', () => {
    const o = oyuncuOzeti([
      satir('deposit', 0.1, '2026-08-01T10:00:00Z'),
      satir('deposit', 0.2, '2026-08-02T10:00:00Z'),
    ]);
    expect(o.yatirim.toplam).toBe(0.3);
  });
});

describe('kullaniciAdlariniAyikla', () => {
  it('satır sonu, virgül, noktalı virgül ve sekmeyi ayırıcı sayar', () => {
    expect(kullaniciAdlariniAyikla('ali\nveli, ayse;fatma\tzeynep'))
      .toEqual(['ali', 'veli', 'ayse', 'fatma', 'zeynep']);
  });

  it('tekrarları eler ama sırayı korur', () => {
    expect(kullaniciAdlariniAyikla('ali veli ali ayse')).toEqual(['ali', 'veli', 'ayse']);
  });

  it('tekrar karşılaştırması Türkçe küçültmeyle yapılır', () => {
    // "İSMAİL" ile "ismail" ayni kisi. Ingilizce toLowerCase 'İ' -> 'i̇'
    // uretip ikisini FARKLI sayardi.
    expect(kullaniciAdlariniAyikla('İSMAİL ismail')).toHaveLength(1);
  });

  it('listeye kullanıcının YAZDIĞI hali girer', () => {
    // Lynon'a kendi yazdigi bicimde sormak, eslesmeyi bize bagli
    // olmaktan cikarir.
    expect(kullaniciAdlariniAyikla('TestKullanici')).toEqual(['TestKullanici']);
  });

  it('boş girdide boş liste', () => {
    expect(kullaniciAdlariniAyikla('')).toEqual([]);
    expect(kullaniciAdlariniAyikla('   \n , ; ')).toEqual([]);
    expect(kullaniciAdlariniAyikla(null)).toEqual([]);
  });

  it('sınırı aşan liste kırpılır', () => {
    const cok = Array.from({ length: 60 }, (_, i) => 'k' + i).join('\n');
    expect(kullaniciAdlariniAyikla(cok, 50)).toHaveLength(50);
  });
});

describe('genelToplam', () => {
  const ozet = (y: number, c: number) => ({
    yatirim: { toplam: y, adet: 1, ilk: null, son: null },
    cekim: { toplam: c, adet: 1, ilk: null, son: null },
    net: y - c,
  });

  it('yalnızca bulunan oyuncuları toplar', () => {
    const t = genelToplam([
      { bulundu: true, ozet: ozet(1000, 400) },
      { bulundu: true, ozet: ozet(500, 100) },
      { bulundu: false },
    ]);
    expect(t).toEqual({ yatirimToplam: 1500, cekimToplam: 500, net: 1000, bulunan: 2, bulunamayan: 1 });
  });

  it('bulunamayan sayısı görünür kalır', () => {
    // "10 kullanicidan 7'si bulundu" bilgisi kaybolursa toplam sessizce
    // eksik okunur.
    const t = genelToplam([{ bulundu: false }, { bulundu: false }]);
    expect(t.bulunamayan).toBe(2);
    expect(t.yatirimToplam).toBe(0);
  });

  it('boş listede sıfır', () => {
    expect(genelToplam([])).toEqual({ yatirimToplam: 0, cekimToplam: 0, net: 0, bulunan: 0, bulunamayan: 0 });
  });
});
