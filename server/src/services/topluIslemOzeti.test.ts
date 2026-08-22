import { describe, expect, it } from 'vitest';
import { genelToplam, kullaniciAdlariniAyikla, oyuncuOzeti, satirDokumu, type OdemeSatiri } from './topluIslemOzeti.js';

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

  it('amount YOKSA actualAmount kullanılır', () => {
    const o = oyuncuOzeti([
      { transactionType: 'deposit', actualAmount: 250, createdAt: '2026-08-01T10:00:00Z', status: 'success' },
    ]);
    expect(o.yatirim.toplam).toBe(250);
  });

  it('amount SIFIR ise sıfır sayılır — actualAmount devreye girmez', () => {
    // `mapTransaction` ile ayni kural (`amount ?? actualAmount`). Once
    // "ilk sifir olmayan deger" aliniyordu; bu, panelin 0 gosterdigi bir
    // satiri burada 250 gosteriyordu ve iki ekran ayni oyuncu icin iki
    // farkli toplam veriyordu.
    const o = oyuncuOzeti([
      { transactionType: 'deposit', amount: 0, actualAmount: 250, createdAt: '2026-08-01T10:00:00Z', status: 'success' },
    ]);
    expect(o.yatirim.toplam).toBe(0);
  });

  it('BİÇİMLENMİŞ metin tutarları doğru okur', () => {
    // Bildirilen hata: tutarlar yanlis geliyordu. Sebep `Number()` idi;
    // `Number("1.234,56")` NaN veriyor ve NaN sessizce 0'a dusuyordu.
    const o = oyuncuOzeti([
      satir('deposit', '1.234,56' as never, '2026-08-01T10:00:00Z'),
      satir('deposit', '2,500.00' as never, '2026-08-02T10:00:00Z'),
      satir('withdrawal', '1 000,25 ₺' as never, '2026-08-03T10:00:00Z'),
    ]);
    expect(o.yatirim.toplam).toBe(3734.56);
    expect(o.cekim.toplam).toBe(1000.25);
  });

  it('sayıya çevrilemeyen tutar 0 sayılır, satır yine de sayılır', () => {
    const o = oyuncuOzeti([satir('deposit', 'yok' as never, '2026-08-01T10:00:00Z')]);
    expect(o.yatirim.toplam).toBe(0);
    expect(o.yatirim.adet).toBe(1);
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
    bekleyenCekim: { toplam: 0, adet: 0, ilk: null, son: null },
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

describe('bekleyen çekimler', () => {
  it('bekleyen çekim toplama KATILMAZ, ayrı raporlanır', () => {
    // Panelin islem listesi cekimlerde `status !== 'failed'` kullaniyor,
    // yani bekleyenleri de gosteriyor. Burada yalnizca odenmis olanlar
    // sayiliyor; farki gostermezsek "toplamlar yanlis" gibi gorunur.
    const o = oyuncuOzeti([
      satir('withdrawal', 1000, '2026-08-01T10:00:00Z', 'success'),
      satir('withdrawal', 400, '2026-08-02T10:00:00Z', 'pending'),
      satir('withdrawal', 250, '2026-08-03T10:00:00Z', 'pendingProviderApproval'),
    ]);
    expect(o.cekim.toplam).toBe(1000);
    expect(o.bekleyenCekim.toplam).toBe(650);
    expect(o.bekleyenCekim.adet).toBe(2);
    expect(o.net).toBe(-1000);
  });

  it('reddedilen çekim hiçbir toplamda yok', () => {
    const o = oyuncuOzeti([
      satir('withdrawal', 999, '2026-08-01T10:00:00Z', 'failed'),
      satir('withdrawal', 111, '2026-08-01T10:00:00Z', 'rejected'),
    ]);
    expect(o.cekim.toplam).toBe(0);
    expect(o.bekleyenCekim.toplam).toBe(0);
  });

  it('bekleyen çekim ÇEKİM aralığını kullanır', () => {
    const o = oyuncuOzeti(
      [satir('withdrawal', 500, '2026-07-01T10:00:00Z', 'pending'),
       satir('withdrawal', 300, '2026-08-05T10:00:00Z', 'pending')],
      undefined,
      { baslangic: '2026-08-01T00:00:00Z' },
    );
    expect(o.bekleyenCekim.toplam).toBe(300);
  });
});

describe('satirDokumu', () => {
  it('ham satır sayısını, türleri ve durumları sayar', () => {
    const d = satirDokumu([
      satir('deposit', 100, '2026-08-01T10:00:00Z', 'success'),
      satir('deposit', 200, '2026-08-02T10:00:00Z', 'failed'),
      satir('withdrawal', 50, '2026-08-03T10:00:00Z', 'pending'),
      { transactionType: 'transfer', amount: 1, createdAt: '2026-08-04T10:00:00Z', status: 'success' },
    ]);
    expect(d.hamSatir).toBe(4);
    expect(d.turler).toEqual({ deposit: 2, withdrawal: 1, transfer: 1 });
    // transfer satiri durum dokumune girmez: yatirim/cekim degil.
    expect(d.durumlar).toEqual({ success: 1, failed: 1, pending: 1 });
  });

  it('aralık dışında kalan UYGUN satırları ayrı sayar', () => {
    // "3 yatirim geldi ama 1'i araliga giriyor" ile "zaten 1 yatirim
    // geldi" arasindaki farki gostermek icin.
    const d = satirDokumu(
      [satir('deposit', 100, '2026-07-01T10:00:00Z'),
       satir('deposit', 200, '2026-07-15T10:00:00Z'),
       satir('deposit', 300, '2026-08-10T10:00:00Z')],
      { baslangic: '2026-08-01T00:00:00Z' },
    );
    expect(d.turler.deposit).toBe(3);
    expect(d.aralikDisi).toBe(2);
  });

  it('örnek satırda okuduğumuz alanları ve alan ADLARINI verir', () => {
    // "1 kayit geldi ve tutari yanlis" durumunda tek soru kaliyor: tutar
    // hangi alanda? Alan adlari bunu tahmin etmeden gosteriyor.
    const d = satirDokumu([
      { transactionType: 'deposit', status: 'success', amount: 2000, realAmount: 500,
        createdAt: '2026-08-01T10:00:00Z', userId: 7 },
    ]);
    expect(d.ornekler).toHaveLength(1);
    expect(d.ornekler[0]).toMatchObject({ tur: 'deposit', durum: 'success', amount: 2000 });
    expect(d.ornekler[0].alanlar).toContain('realAmount');
  });

  it('en fazla 3 örnek döner', () => {
    const cok = Array.from({ length: 10 }, (_, i) =>
      satir('deposit', i, '2026-08-01T10:00:00Z'));
    expect(satirDokumu(cok).ornekler).toHaveLength(3);
  });

  it('boş girdide çökmez', () => {
    expect(satirDokumu([])).toEqual({ hamSatir: 0, turler: {}, durumlar: {}, aralikDisi: 0, ornekler: [] });
    expect(satirDokumu(null).hamSatir).toBe(0);
  });
});
