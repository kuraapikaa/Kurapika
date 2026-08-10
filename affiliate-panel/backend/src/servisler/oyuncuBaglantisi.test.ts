import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { oyuncuBaglantisi } from './oyuncuEslesme.js';
import { oyuncuEslesmeleri as eslesmeTablosu } from '../lib/sema.js';
import { veritabani, veritabaniniBaslat, veritabaniniKapat } from '../lib/veritabani.js';
import { testVeritabaniAc } from '../../test/testVeritabani.js';

/**
 * `oyuncuBaglantisi` — "son bonus/düzeltme" özelliğinin güvenlik sınırı.
 *
 * `ortakOyuncuListesi`/`altLinkOyuncuListesi` gibi Postgres'e doğrudan
 * bağlı (depo soyutlamasını atlayan) bir sorgu; yerelde `TEST_DATABASE_URL`
 * yoksa atlanır, CI'da (`testler.yml`) gerçek bir Postgres'e karşı koşar
 * (bkz. `gecmisGGR.test.ts` — aynı örüntü).
 */
const varsaCalistir = String(process.env.TEST_DATABASE_URL || '').trim() ? describe : describe.skip;

const KIRACI = 'oyuncu-baglantisi-kiracisi';

varsaCalistir('oyuncuBaglantisi', () => {
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
});
