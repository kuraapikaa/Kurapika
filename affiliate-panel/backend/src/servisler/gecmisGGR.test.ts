import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gecmisGGRDoldur } from './gecmisGGR.js';
import type { BackofficeAdaptoru } from '../adaptorler/tur.js';
import { olcumler as olcumTablosu, oyuncuEslesmeleri as eslesmeTablosu, oyuncuGunlukRapor as raporTablosu } from '../lib/sema.js';
import { veritabani, veritabaniniBaslat, veritabaniniKapat } from '../lib/veritabani.js';
import { testVeritabaniAc } from '../../test/testVeritabani.js';

/**
 * GEÇMİŞ GGR DOLDURMA.
 *
 * Buradaki asıl risk: panelin BİLMEDİĞİ bir oyuncunun rakamını bir
 * ortağa yazmak (uydurma atıf) ya da hiç eşleşme kurulmamışken sessizce
 * hiçbir şey yapmamak yerine hata fırlatmak.
 */

const varsaCalistir = String(process.env.TEST_DATABASE_URL || '').trim() ? describe : describe.skip;

const KIRACI = 'gecmis-ggr-kiracisi';

/** Gün → oyuncu satırları haritasından sahte adaptör üretir. */
function sahteAdaptor(satirlarByGun: Record<string, Array<{ oyuncuId: string; yatirim?: number; cekim?: number; bahis?: number; kazanc?: number }>>): BackofficeAdaptoru {
  return {
    tanimAdi: 'sahte',
    async dogrula() {
      return { baglandi: true, mesaj: 'ok' };
    },
    async gunuCek() {
      return [];
    },
    async oyuncuGunuCek(gun: string) {
      const satirlar = satirlarByGun[gun] ?? [];
      return satirlar.map((s) => ({
        oyuncuId: s.oyuncuId, yatirim: s.yatirim ?? 0, cekim: s.cekim ?? 0, bahis: s.bahis ?? 0, kazanc: s.kazanc ?? 0,
      }));
    },
  };
}

varsaCalistir('gecmisGGRDoldur', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = (await testVeritabaniAc('aff_test_gecmis_ggr'))!;
    await veritabaniniBaslat();
  });

  afterAll(async () => {
    await veritabaniniKapat();
    delete process.env.DATABASE_URL;
  });

  beforeEach(async () => {
    const vt = veritabani()!;
    await vt.delete(olcumTablosu);
    await vt.delete(eslesmeTablosu);
    await vt.delete(raporTablosu);
  });

  const eslestir = async (
    lynonOyuncuId: string, ortakId: string, ortakAnahtari: string, baglantiId = 'varsayilan',
  ) => {
    await veritabani()!.insert(eslesmeTablosu).values({
      kiraci: KIRACI, baglantiId, lynonOyuncuId, ortakId, ortakAnahtari,
      clickId: null, medyaId: null, altLinkId: null, kullaniciAdi: null, alt: {},
      kaynak: 'kayit', olusturuldu: new Date('2026-08-01T00:00:00Z'),
    });
  };

  const olcumBul = async (ortakAnahtari: string) => {
    const satirlar = await veritabani()!
      .select().from(olcumTablosu).where(eq(olcumTablosu.ortakAnahtari, ortakAnahtari));
    return satirlar[0] ?? null;
  };

  it('eslesen oyuncularin rakamini ortaga kaynak=itme ile yazar', async () => {
    await eslestir('h1', 'ortak-h', 'ORTAK-H');
    const adaptor = sahteAdaptor({
      '2026-08-05': [{ oyuncuId: 'h1', yatirim: 100, cekim: 20, bahis: 500, kazanc: 300 }],
    });

    const sonuc = await gecmisGGRDoldur(KIRACI, adaptor, 'varsayilan', { bugun: '2026-08-05', geriGun: 1 });

    expect(sonuc).toMatchObject({ tarananGun: 1, eslesenOyuncuGunu: 1, yazilanOlcum: 1, hatali: [] });
    expect(await olcumBul('ORTAK-H')).toMatchObject({
      gun: '2026-08-05', oyuncuSayisi: 1, aktifOyuncuSayisi: 1,
      yatirim: 100, cekim: 20, ggr: 200, ftdSayisi: null, kaynak: 'itme',
    });
  });

  /**
   * ASIL AMAC: Lynon webhook'u hic kurulmamis bir tenant'ta oyuncu bazli
   * yatirim/cekim listelerinin (bkz. `oyuncuEslesme.ts` ·
   * `oyuncuFinansHaritasi`) hala calismasi -- bu, o listelerin okudugu
   * tabloyu bu fonksiyonun da doldurdugunu dogruluyor.
   */
  it('esles mis oyuncunun rakamini oyuncu_gunluk_rapor a da yazar', async () => {
    await eslestir('h1b', 'ortak-h2', 'ORTAK-H2');
    const adaptor = sahteAdaptor({
      '2026-08-05': [{ oyuncuId: 'h1b', yatirim: 100, cekim: 20, bahis: 500, kazanc: 300 }],
    });

    await gecmisGGRDoldur(KIRACI, adaptor, 'varsayilan', { bugun: '2026-08-05', geriGun: 1 });

    const satirlar = await veritabani()!.select().from(raporTablosu).where(eq(raporTablosu.oyuncuId, 'h1b'));
    expect(satirlar).toMatchObject([{ gun: '2026-08-05', yatirim: 100, cekim: 20, bahis: 500, kazanc: 300 }]);
  });

  /**
   * ASIL GUVENCE: iki farkli Lynon sitesi ayni numarali oyuncu ID'sini
   * FARKLI gercek oyunculara verebilir. Bu test, "site-b" raporunu
   * islerken "varsayilan" baglantidaki ayni ID'li (ama TAMAMEN alakasiz)
   * oyuncuya YANLISLIKLA atif yapilmadigini kanitliyor.
   */
  it('coklu site: ayni numarali ID iki farkli baglantida CAKISMAZ', async () => {
    // Ayni lynonOyuncuId ('99'), iki FARKLI siteden iki FARKLI oyuncuya ait.
    await eslestir('99', 'ortak-varsayilan', 'ORTAK-VARSAYILAN', 'varsayilan');
    await eslestir('99', 'ortak-site-b', 'ORTAK-SITE-B', 'site-b');
    const adaptor = sahteAdaptor({
      '2026-08-12': [{ oyuncuId: '99', yatirim: 777 }],
    });

    await gecmisGGRDoldur(KIRACI, adaptor, 'site-b', { bugun: '2026-08-12', geriGun: 1 });

    // Yalnizca site-b'nin ortagina yazilmali.
    expect(await olcumBul('ORTAK-SITE-B')).toMatchObject({ gun: '2026-08-12', yatirim: 777 });
    expect(await olcumBul('ORTAK-VARSAYILAN')).toBeNull();

    const raporSatirlari = await veritabani()!.select().from(raporTablosu).where(eq(raporTablosu.oyuncuId, '99'));
    expect(raporSatirlari).toMatchObject([{ baglantiId: 'site-b', yatirim: 777 }]);
  });

  it('ayni gun tekrar calistirilinca UZERINE yazar, ustune EKLEMEZ', async () => {
    await eslestir('h1c', 'ortak-h3', 'ORTAK-H3');
    const ilkTur = sahteAdaptor({ '2026-08-05': [{ oyuncuId: 'h1c', yatirim: 100 }] });
    const ikinciTur = sahteAdaptor({ '2026-08-05': [{ oyuncuId: 'h1c', yatirim: 100 }] });

    await gecmisGGRDoldur(KIRACI, ilkTur, 'varsayilan', { bugun: '2026-08-05', geriGun: 1 });
    await gecmisGGRDoldur(KIRACI, ikinciTur, 'varsayilan', { bugun: '2026-08-05', geriGun: 1 });

    const satirlar = await veritabani()!.select().from(raporTablosu).where(eq(raporTablosu.oyuncuId, 'h1c'));
    // 200 DEGIL 100: rapor idempotent, tekrar calistirmak katlamamali.
    expect(satirlar).toMatchObject([{ yatirim: 100 }]);
  });

  it('panelin bilmedigi oyuncu icin uydurmaz, sessizce atlar', async () => {
    const adaptor = sahteAdaptor({
      '2026-08-06': [{ oyuncuId: 'yabanci', yatirim: 500 }],
    });

    const sonuc = await gecmisGGRDoldur(KIRACI, adaptor, 'varsayilan', { bugun: '2026-08-06', geriGun: 1 });

    expect(sonuc).toMatchObject({ tarananGun: 1, eslesenOyuncuGunu: 0, yazilanOlcum: 0 });
    expect(await veritabani()!.select().from(olcumTablosu)).toHaveLength(0);
    expect(await veritabani()!.select().from(raporTablosu)).toHaveLength(0);
  });

  it('ayni ortaga baglı birden cok oyuncuyu tek satirda toplar', async () => {
    await eslestir('h2', 'ortak-i', 'ORTAK-I');
    await eslestir('h3', 'ortak-i', 'ORTAK-I');
    const adaptor = sahteAdaptor({
      '2026-08-07': [
        { oyuncuId: 'h2', yatirim: 100 },
        { oyuncuId: 'h3', yatirim: 50, cekim: 10 },
      ],
    });

    await gecmisGGRDoldur(KIRACI, adaptor, 'varsayilan', { bugun: '2026-08-07', geriGun: 1 });

    expect(await olcumBul('ORTAK-I')).toMatchObject({ oyuncuSayisi: 2, aktifOyuncuSayisi: 2, yatirim: 150, cekim: 10 });
  });

  it('birden fazla gunu geriye dogru tarar', async () => {
    await eslestir('h4', 'ortak-j', 'ORTAK-J');
    const adaptor = sahteAdaptor({
      '2026-08-08': [{ oyuncuId: 'h4', yatirim: 10 }],
      '2026-08-09': [{ oyuncuId: 'h4', yatirim: 20 }],
    });

    const sonuc = await gecmisGGRDoldur(KIRACI, adaptor, 'varsayilan', { bugun: '2026-08-09', geriGun: 2 });

    expect(sonuc.tarananGun).toBe(2);
    const satirlar = await veritabani()!
      .select().from(olcumTablosu).where(eq(olcumTablosu.ortakAnahtari, 'ORTAK-J'));
    expect(satirlar.map((s) => [s.gun, s.yatirim]).sort()).toEqual([['2026-08-08', 10], ['2026-08-09', 20]]);
  });

  it('bir gunun hatasi digerlerini durdurmaz', async () => {
    await eslestir('h5', 'ortak-k', 'ORTAK-K');
    const patlayan: BackofficeAdaptoru = {
      tanimAdi: 'sahte',
      async dogrula() { return { baglandi: true, mesaj: 'ok' }; },
      async gunuCek() { return []; },
      async oyuncuGunuCek(gun: string) {
        if (gun === '2026-08-10') throw new Error('rapor gecici olarak alinamadi');
        return [{ oyuncuId: 'h5', yatirim: 30, cekim: 0, bahis: 0, kazanc: 0 }];
      },
    };

    const sonuc = await gecmisGGRDoldur(KIRACI, patlayan, 'varsayilan', { bugun: '2026-08-11', geriGun: 2 });

    expect(sonuc.tarananGun).toBe(1);
    expect(sonuc.hatali).toEqual([{ gun: '2026-08-10', mesaj: 'rapor gecici olarak alinamadi' }]);
    expect(await olcumBul('ORTAK-K')).toMatchObject({ gun: '2026-08-11', yatirim: 30 });
  });

  it('adaptor oyuncuGunuCek desteklemiyorsa reddedilir', async () => {
    const destekesiz: BackofficeAdaptoru = {
      tanimAdi: 'sahte',
      async dogrula() { return { baglandi: true, mesaj: 'ok' }; },
      async gunuCek() { return []; },
    };
    await expect(gecmisGGRDoldur(KIRACI, destekesiz, 'varsayilan', { bugun: '2026-08-09', geriGun: 1 }))
      .rejects.toThrow(/desteklemiyor/i);
  });

  it('genis araligi bir turda kesip uyari doner', async () => {
    await eslestir('h6', 'ortak-l', 'ORTAK-L');
    const adaptor = sahteAdaptor({});

    const sonuc = await gecmisGGRDoldur(KIRACI, adaptor, 'varsayilan', { bugun: '2026-08-09', geriGun: 10, enFazlaGun: 3 });

    expect(sonuc.tarananGun).toBe(3);
    expect(sonuc.uyari).toMatch(/10 günlük/);
  });
});
