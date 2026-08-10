import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { oyuncuBaglantisi, oyuncuSayilariOrtakAnahtariyla } from './oyuncuEslesme.js';
import { oyuncuEslesmeleri as eslesmeTablosu } from '../lib/sema.js';
import { veritabani, veritabaniniBaslat, veritabaniniKapat } from '../lib/veritabani.js';
import { testVeritabaniAc } from '../../test/testVeritabani.js';

/**
 * `oyuncuBaglantisi` ("son bonus/düzeltme" özelliğinin güvenlik sınırı) ve
 * `oyuncuSayilariOrtakAnahtariyla` (yönetim panelindeki "Ortak performansı"
 * ızgarasının kümülatif oyuncu sayısı kaynağı) — ikisi de `ortakOyuncuListesi`/
 * `altLinkOyuncuListesi` gibi Postgres'e doğrudan bağlı (depo soyutlamasını
 * atlayan) sorgular; yerelde `TEST_DATABASE_URL` yoksa atlanır, CI'da
 * (`testler.yml`) gerçek bir Postgres'e karşı koşar (bkz. `gecmisGGR.test.ts`
 * — aynı örüntü).
 */
const varsaCalistir = String(process.env.TEST_DATABASE_URL || '').trim() ? describe : describe.skip;

const KIRACI = 'oyuncu-baglantisi-kiracisi';

varsaCalistir('oyuncuEslesmeleri Postgres sorguları', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = (await testVeritabaniAc('aff_test_oyuncu_baglantisi'))!;
    await veritabaniniBaslat();
  });

  afterAll(async () => {
    await veritabaniniKapat();
    delete process.env.DATABASE_URL;
  });

  beforeEach(async () => {
    await veritabani()!.delete(eslesmeTablosu);
  });

  const eslestir = async (lynonOyuncuId: string, ortakId: string, baglantiId = 'varsayilan') => {
    await veritabani()!.insert(eslesmeTablosu).values({
      kiraci: KIRACI, baglantiId, lynonOyuncuId, ortakId, ortakAnahtari: `ORT-${ortakId}`,
      clickId: null, medyaId: null, altLinkId: null, kullaniciAdi: null, alt: {},
      kaynak: 'kayit', olusturuldu: new Date('2026-08-01T00:00:00Z'),
    });
  };

  it('oyuncu bu ortaga eslesmisse baglantiId doner', async () => {
    await eslestir('501', 'ortak-a', 'site-1');

    expect(await oyuncuBaglantisi(KIRACI, 'ortak-a', '501')).toBe('site-1');
  });

  it('oyuncu BASKA bir ortaga eslesmisse null doner -- baska ortagin bonus gecmisi sizmaz', async () => {
    await eslestir('502', 'ortak-a');

    expect(await oyuncuBaglantisi(KIRACI, 'ortak-b', '502')).toBeNull();
    expect(await oyuncuBaglantisi(KIRACI, 'ortak-a', '502')).toBe('varsayilan');
  });

  it('bilinmeyen oyuncu icin null doner', async () => {
    expect(await oyuncuBaglantisi(KIRACI, 'ortak-a', 'hic-yok')).toBeNull();
  });

  it('baska kiracinin ayni ID li oyuncusunu gormez', async () => {
    await veritabani()!.insert(eslesmeTablosu).values({
      kiraci: 'baska-kiraci', baglantiId: 'varsayilan', lynonOyuncuId: '503', ortakId: 'ortak-a',
      ortakAnahtari: 'ORT-ortak-a', clickId: null, medyaId: null, altLinkId: null, kullaniciAdi: null,
      alt: {}, kaynak: 'kayit', olusturuldu: new Date('2026-08-01T00:00:00Z'),
    });

    expect(await oyuncuBaglantisi(KIRACI, 'ortak-a', '503')).toBeNull();
  });

  describe('oyuncuSayilariOrtakAnahtariyla', () => {
    it('ortak anahtari basina KUMULATIF sayiyi doner -- gunluk stok zirvesi DEGIL', async () => {
      await eslestir('601', 'ortak-a');
      await eslestir('602', 'ortak-a');
      await eslestir('603', 'ortak-b');

      const sayilar = await oyuncuSayilariOrtakAnahtariyla(KIRACI);

      expect(sayilar.get('ORT-ortak-a')).toBe(2);
      expect(sayilar.get('ORT-ortak-b')).toBe(1);
    });

    it('farkli baglantilardan (coklu site) gelen oyunculari da ayni ortak anahtarinda toplar', async () => {
      await eslestir('604', 'ortak-c', 'site-1');
      await eslestir('605', 'ortak-c', 'site-2');

      expect((await oyuncuSayilariOrtakAnahtariyla(KIRACI)).get('ORT-ortak-c')).toBe(2);
    });

    it('baska kiracinin oyuncularini saymaz', async () => {
      await veritabani()!.insert(eslesmeTablosu).values({
        kiraci: 'baska-kiraci-2', baglantiId: 'varsayilan', lynonOyuncuId: '606', ortakId: 'ortak-d',
        ortakAnahtari: 'ORT-ortak-d', clickId: null, medyaId: null, altLinkId: null, kullaniciAdi: null,
        alt: {}, kaynak: 'kayit', olusturuldu: new Date('2026-08-01T00:00:00Z'),
      });

      expect((await oyuncuSayilariOrtakAnahtariyla(KIRACI)).has('ORT-ortak-d')).toBe(false);
    });
  });
});
