import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { yaz } from './depo.js';
import { olcumler as olcumTablosu, tiklamalar as tiklamaTablosu } from './sema.js';
import { belgeleriTablolaraTasi } from './tasima.js';
import { veritabani, veritabaniniBaslat, veritabaniniKapat } from './veritabani.js';
import { testVeritabaniAc } from '../../test/testVeritabani.js';

/**
 * TAŞIMA TESTİ — üretimde bir kez koşacak, geri alınamaz.
 *
 * Buradaki hata, panelin geçmişini sessizce kaybetmek ya da taşınmış
 * veriyi eski hâliyle geri ezmek demek. İkisi de kullanıcıya "veriler
 * kayboldu" olarak görünür; ikisi de sonradan onarılamaz.
 */

const TEST_URL = String(process.env.TEST_DATABASE_URL || '').trim();
const varsaCalistir = TEST_URL ? describe : describe.skip;

const KIRACI = 'tasima-kiracisi';

varsaCalistir('belgeden tabloya tasima', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = (await testVeritabaniAc('aff_test_tasima'))!;
    await veritabaniniBaslat();
  });

  afterAll(async () => {
    await veritabaniniKapat();
    delete process.env.DATABASE_URL;
  });

  beforeEach(async () => {
    const vt = veritabani()!;
    await vt.delete(tiklamaTablosu);
    await vt.delete(olcumTablosu);
    await vt.execute('DELETE FROM aff_belgeler');
  });

  const belgeleriKur = async () => {
    await yaz(KIRACI, 'tiklamalar', {
      version: 1,
      tiklamalar: [
        {
          clickId: 'eski-1', ortakAnahtari: 'ortak-a', medyaId: 'm1',
          alt: { alt1: 'facebook' }, ip: '1.2.3.4', userAgent: 'UA', referrer: null,
          zaman: '2026-07-01T10:00:00.000Z',
        },
        {
          clickId: 'eski-2', ortakAnahtari: 'ortak-b', medyaId: null,
          alt: {}, ip: null, userAgent: null, referrer: null,
          zaman: '2026-07-02T10:00:00.000Z',
        },
      ],
    });
    await yaz(KIRACI, 'olcumler', {
      version: 1,
      olcumler: {
        '2026-07-01|ortak-a': {
          gun: '2026-07-01', ortakAnahtari: 'ortak-a', oyuncuSayisi: 5, aktifOyuncuSayisi: 3,
          yatirim: 100, cekim: 40, ggr: 60, ftdSayisi: 2, kaynak: 'cekme',
          yazildi: '2026-07-01T23:00:00.000Z',
        },
        '2026-07-02|ortak-a': {
          gun: '2026-07-02', ortakAnahtari: 'ortak-a', oyuncuSayisi: 6, aktifOyuncuSayisi: 4,
          yatirim: 200, cekim: 50, ggr: 150, ftdSayisi: null, kaynak: 'itme',
          yazildi: '2026-07-02T23:00:00.000Z',
        },
      },
    });
  };

  it('gecmisi tabloya tasir ve alanlari korur', async () => {
    await belgeleriKur();
    const sonuc = await belgeleriTablolaraTasi();
    expect(sonuc).toEqual([{ kiraci: KIRACI, tiklama: 2, olcum: 2 }]);

    const vt = veritabani()!;
    const tiklamalar = await vt.select().from(tiklamaTablosu);
    expect(tiklamalar).toHaveLength(2);
    const ilk = tiklamalar.find((t) => t.clickId === 'eski-1')!;
    expect(ilk.kiraci).toBe(KIRACI);
    expect(ilk.alt).toEqual({ alt1: 'facebook' });
    expect(ilk.ip).toBe('1.2.3.4');
    expect(ilk.zaman.toISOString()).toBe('2026-07-01T10:00:00.000Z');

    const olcumler = await vt.select().from(olcumTablosu);
    expect(olcumler).toHaveLength(2);
    // `null` ile `0` ayrimi tasimada da korunmali.
    expect(olcumler.find((o) => o.gun === '2026-07-01')!.ftdSayisi).toBe(2);
    expect(olcumler.find((o) => o.gun === '2026-07-02')!.ftdSayisi).toBeNull();
    expect(olcumler.find((o) => o.gun === '2026-07-02')!.kaynak).toBe('itme');
  });

  it('ikinci calistirmada tekrar tasimaz', async () => {
    await belgeleriKur();
    await belgeleriTablolaraTasi();
    expect(await belgeleriTablolaraTasi()).toEqual([]);

    const vt = veritabani()!;
    expect(await vt.select().from(tiklamaTablosu)).toHaveLength(2);
    expect(await vt.select().from(olcumTablosu)).toHaveLength(2);
  });

  /**
   * İşaret kaybolursa taşıma yeniden koşar. O sırada tabloya yazılmış
   * YENİ veri, eski belgedeki hâliyle geri EZİLMEMELİ.
   */
  it('isaret kaybolsa bile yeni veriyi geri ezmez', async () => {
    await belgeleriKur();
    await belgeleriTablolaraTasi();

    const vt = veritabani()!;
    await vt.update(olcumTablosu).set({ ggr: 9999 });
    // Isareti sil: taşıma bir daha koşacak.
    await vt.execute("DELETE FROM aff_belgeler WHERE alan = 'tasima-durumu'");

    await belgeleriTablolaraTasi();
    const olcumler = await vt.select().from(olcumTablosu);
    expect(olcumler.every((o) => o.ggr === 9999)).toBe(true);
  });

  it('belge yoksa hicbir sey yapmaz', async () => {
    await yaz(KIRACI, 'ortaklar', { version: 1, ortaklar: [] });
    expect(await belgeleriTablolaraTasi()).toEqual([]);
    expect(await veritabani()!.select().from(tiklamaTablosu)).toHaveLength(0);
  });

  it('bozuk kayitlar partiyi dusurmez, saglamlari tasir', async () => {
    await yaz(KIRACI, 'tiklamalar', {
      version: 1,
      tiklamalar: [
        { clickId: 'saglam', ortakAnahtari: 'a', medyaId: null, alt: {}, ip: null, userAgent: null, referrer: null, zaman: '2026-07-01T10:00:00.000Z' },
        { clickId: '', ortakAnahtari: 'a', zaman: '2026-07-01T10:00:00.000Z' },
        { clickId: 'zamansiz', ortakAnahtari: 'a', zaman: 'gecersiz-tarih' },
      ],
    });
    const sonuc = await belgeleriTablolaraTasi();
    expect(sonuc).toEqual([{ kiraci: KIRACI, tiklama: 1, olcum: 0 }]);
    expect(await veritabani()!.select().from(tiklamaTablosu)).toHaveLength(1);
  });
});
