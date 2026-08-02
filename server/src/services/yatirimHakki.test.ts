import { describe, expect, it } from 'vitest';
import { kullanilmisYatirimlar, yatirimHakki, type OyunKaydi } from './yatirimHakki.js';

/**
 * Bir yatirim = bir oyun hakki.
 *
 * Onceki durum:
 *   Cark  — yalnizca GUNLUK limit. Yatirim kaydedilmedigi icin oyuncu tek
 *           yatirimla her gun yeniden cevirebiliyordu.
 *   Kazi  — hicbir sinir yoktu; uc dogrudan cagrilarak sinirsiz oynaniyordu.
 *
 * Bu sayilar bonus dagitiyor; her kural ayri kilitleniyor.
 */

const k = (patch: Partial<OyunKaydi> = {}): OyunKaydi => ({
  username: 'ayse',
  depositId: 'D1',
  oyun: 'cark',
  status: 'granted',
  ...patch,
});

describe('bir yatırım bir hak', () => {
  it('hiç oynanmamış yatırımla oynanır', () => {
    expect(yatirimHakki([], 'ayse', 'cark', 'D1')).toEqual({ uygun: true, depositId: 'D1' });
  });

  it('aynı yatırımla İKİNCİ kez oynanamaz — bildirilen kural', () => {
    const sonuc = yatirimHakki([k()], 'ayse', 'cark', 'D1');
    expect(sonuc.uygun).toBe(false);
    expect((sonuc as any).neden).toContain('Yeni yatırım');
  });

  it('YENİ yatırımla tekrar oynanır', () => {
    expect(yatirimHakki([k()], 'ayse', 'cark', 'D2').uygun).toBe(true);
  });

  it('gün değişse bile aynı yatırım hakkı yenilemez', () => {
    // Eski davranista gunluk limit sifirlaniyordu; artik yatirim baglayici.
    expect(yatirimHakki([k()], 'ayse', 'cark', 'D1').uygun).toBe(false);
  });
});

describe('oyuncu ve oyun ayrımı', () => {
  it('başka oyuncunun kaydı engellemez', () => {
    expect(yatirimHakki([k({ username: 'mehmet' })], 'ayse', 'cark', 'D1').uygun).toBe(true);
  });

  it('çarkta kullanılan yatırım kazı kazanı engellemez', () => {
    // Iki ayri oyun; her biri kendi hakkini tuketir.
    expect(yatirimHakki([k({ oyun: 'cark' })], 'ayse', 'kazikazan', 'D1').uygun).toBe(true);
  });

  it('kazı kazanda kullanılan yatırım kazı kazanı engeller', () => {
    expect(yatirimHakki([k({ oyun: 'kazikazan' })], 'ayse', 'kazikazan', 'D1').uygun).toBe(false);
  });

  it('kullanıcı adı büyük/küçük harf duyarsız', () => {
    expect(yatirimHakki([k({ username: 'AYSE' })], 'ayse', 'cark', 'D1').uygun).toBe(false);
  });

  it('oyun alanı olmayan ESKİ kayıt çark sayılır', () => {
    const eski = { username: 'ayse', depositId: 'D1', status: 'granted' } as OyunKaydi;
    expect(yatirimHakki([eski], 'ayse', 'cark', 'D1').uygun).toBe(false);
    expect(yatirimHakki([eski], 'ayse', 'kazikazan', 'D1').uygun).toBe(true);
  });
});

describe('durum filtresi', () => {
  it('başarısız deneme hak yakmaz', () => {
    expect(yatirimHakki([k({ status: 'failed' })], 'ayse', 'cark', 'D1').uygun).toBe(true);
  });

  it('pending hak tüketir — yarım kalan işlem tekrar oynatmaz', () => {
    expect(yatirimHakki([k({ status: 'pending' })], 'ayse', 'cark', 'D1').uygun).toBe(false);
  });

  it('durum yoksa hak tüketmiş sayılır', () => {
    const kayit = { username: 'ayse', depositId: 'D1', oyun: 'cark' } as OyunKaydi;
    expect(yatirimHakki([kayit], 'ayse', 'cark', 'D1').uygun).toBe(false);
  });
});

describe('yatırım kimliği yoksa', () => {
  it('hak YOK — kimliksiz istek sınırsız oynayamaz', () => {
    const sonuc = yatirimHakki([], 'ayse', 'cark', undefined);
    expect(sonuc.uygun).toBe(false);
    expect((sonuc as any).neden).toContain('yatırım yapmalısınız');
  });

  it('boş dize de kimlik sayılmaz', () => {
    expect(yatirimHakki([], 'ayse', 'cark', '   ').uygun).toBe(false);
    expect(yatirimHakki([], 'ayse', 'cark', null).uygun).toBe(false);
  });

  it('sayısal kimlik metinle eşleşir', () => {
    expect(yatirimHakki([k({ depositId: 950893 })], 'ayse', 'cark', '950893').uygun).toBe(false);
  });
});

describe('kullanılmış yatırım listesi', () => {
  it('yalnızca o oyuncunun o oyundaki kimlikleri', () => {
    const kayitlar = [
      k({ depositId: 'D1' }),
      k({ depositId: 'D2' }),
      k({ depositId: 'D3', username: 'mehmet' }),
      k({ depositId: 'D4', oyun: 'kazikazan' }),
    ];
    expect(kullanilmisYatirimlar(kayitlar, 'ayse', 'cark').sort()).toEqual(['D1', 'D2']);
  });

  it('tekrarlı kimlik bir kez listelenir', () => {
    expect(kullanilmisYatirimlar([k(), k()], 'ayse', 'cark')).toEqual(['D1']);
  });

  it('boş liste çökmez', () => {
    expect(kullanilmisYatirimlar([], 'ayse', 'cark')).toEqual([]);
    expect(kullanilmisYatirimlar(undefined as never, 'ayse', 'cark')).toEqual([]);
  });
});

describe('bozuk girdi', () => {
  it('null kayıtlar atlanır', () => {
    expect(yatirimHakki([null as never, k()], 'ayse', 'cark', 'D2').uygun).toBe(true);
  });

  it('boş kayıt listesi çökmez', () => {
    expect(yatirimHakki(undefined as never, 'ayse', 'cark', 'D1').uygun).toBe(true);
  });
});

/**
 * KAZI KAZAN: onceden HICBIR sinir yoktu.
 *
 * /games/scratch/play ne gunluk hak, ne oynama kaydi, ne kontrol
 * iceriyordu. Dogrudan cagrilarak sinirsiz oynanabiliyor ve her kazanan
 * tur yeni bir kampanya bonusu uretiyordu.
 *
 * Bu senaryo eski ve yeni davranisi yan yana kayit altina aliyor.
 */
describe('kazı kazan: sınırsız oynamadan tek hakka', () => {
  it('ESKİ davranış: kayıt tutulmadığında her tur geçerdi', () => {
    // Kayit listesi hep bos kalirsa hak her seferinde uygun cikar —
    // limitsizligin ta kendisi.
    for (let i = 0; i < 5; i++) {
      expect(yatirimHakki([], 'ayse', 'kazikazan', 'D1').uygun).toBe(true);
    }
  });

  it('YENİ davranış: ilk tur geçer, ikinci tur düşer', () => {
    const kayitlar: OyunKaydi[] = [];
    const ilk = yatirimHakki(kayitlar, 'ayse', 'kazikazan', 'D1');
    expect(ilk.uygun).toBe(true);

    // Uc, cekilisten ONCE rezervasyon yaziyor.
    kayitlar.push({ username: 'ayse', depositId: 'D1', oyun: 'kazikazan', status: 'pending' });

    expect(yatirimHakki(kayitlar, 'ayse', 'kazikazan', 'D1').uygun).toBe(false);
  });

  it('yeni yatırım yeni hak açar', () => {
    const kayitlar: OyunKaydi[] = [
      { username: 'ayse', depositId: 'D1', oyun: 'kazikazan', status: 'granted' },
    ];
    expect(yatirimHakki(kayitlar, 'ayse', 'kazikazan', 'D2').uygun).toBe(true);
  });

  it('çark hakkı kazı kazan hakkını tüketmez', () => {
    const kayitlar: OyunKaydi[] = [
      { username: 'ayse', depositId: 'D1', oyun: 'cark', status: 'granted' },
    ];
    expect(yatirimHakki(kayitlar, 'ayse', 'kazikazan', 'D1').uygun).toBe(true);
  });
});

/**
 * GUNLUK SINIR KALDIRILDI.
 *
 * Onceden iki sinir birden vardi: gunluk limit (varsayilan 1) VE yatirim
 * basina hak. Bunlar celisiyordu — gunde uc yatirim yapan oyuncu uc hak
 * kaziniyor ama gunluk limit yuzunden yalnizca birini kullanabiliyordu;
 * kazanilmis hak sessizce yaniyordu.
 *
 * Artik tek kural yatirim. Bu testler o kuralin gun icinde kac kez
 * olursa olsun isledigini ve ayni yatirimin iki kez oynatmadigini
 * birlikte dogruluyor.
 */
describe('aynı gün birden fazla yatırım', () => {
  const oyna = (kayitlar: OyunKaydi[], depositId: string) =>
    yatirimHakki(kayitlar, 'ayse', 'cark', depositId);

  it('üç ayrı yatırım üç hak verir', () => {
    const kayitlar: OyunKaydi[] = [];
    for (const id of ['d1', 'd2', 'd3']) {
      const hak = oyna(kayitlar, id);
      expect(hak.uygun).toBe(true);
      kayitlar.push({ username: 'ayse', oyun: 'cark', depositId: id, status: 'granted' });
    }
    expect(kayitlar).toHaveLength(3);
  });

  it('gün içinde de olsa aynı yatırım ikinci kez oynatmaz', () => {
    const kayitlar: OyunKaydi[] = [
      { username: 'ayse', oyun: 'cark', depositId: 'd1', status: 'granted' },
    ];
    expect(oyna(kayitlar, 'd1').uygun).toBe(false);
    // Ama yeni yatirim hemen hak veriyor — gun degismesi beklenmiyor.
    expect(oyna(kayitlar, 'd2').uygun).toBe(true);
  });

  it('önceki günün yatırımı tekrar oynatmaz', () => {
    // Gunluk limit kalkti diye eski yatirim yeniden canlanmiyor;
    // hak GUNE degil YATIRIMA bagli.
    const kayitlar: OyunKaydi[] = [
      { username: 'ayse', oyun: 'cark', depositId: 'dun-1', status: 'completed' },
    ];
    expect(oyna(kayitlar, 'dun-1').uygun).toBe(false);
  });
});
