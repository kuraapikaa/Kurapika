import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { olaylariIsle } from './olayIsleyici.js';
import { olayKuyrugu, type OlayTuru } from '../depolar/olayKuyrugu.js';
import { oyuncuGunluk, webhookOlaylari } from '../lib/sema.js';
import { veritabani, veritabaniniBaslat, veritabaniniKapat } from '../lib/veritabani.js';
import { testVeritabaniAc } from '../../test/testVeritabani.js';

/**
 * KUYRUK VE İŞÇİ.
 *
 * Buradaki hata para hatası: kaybolan bir yatırım olayı ortağın
 * hakedişinden düşer, iki kez işlenen bir bahis rakamı şişirir.
 */

const varsaCalistir = String(process.env.TEST_DATABASE_URL || '').trim() ? describe : describe.skip;

const KIRACI = 'webhook-kiracisi';

const olay = (tur: OlayTuru, oyuncuId: string, tutar: number, ek: Partial<{ imza: string; alindi: string }> = {}) => ({
  id: randomUUID(),
  imza: ek.imza ?? randomUUID(),
  olayTuru: tur,
  oyuncuId,
  tutar,
  govde: { eventType: tur, playerId: oyuncuId, amount: tutar },
  alindi: ek.alindi ?? '2026-08-09T12:00:00.000Z',
});

varsaCalistir('webhook kuyrugu ve iscisi', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = (await testVeritabaniAc('aff_test_webhook'))!;
    await veritabaniniBaslat();
  });

  afterAll(async () => {
    await veritabaniniKapat();
    delete process.env.DATABASE_URL;
  });

  beforeEach(async () => {
    const vt = veritabani()!;
    await vt.delete(webhookOlaylari);
    await vt.delete(oyuncuGunluk);
  });

  const gunluk = async (oyuncuId: string) => {
    const satirlar = await veritabani()!
      .select().from(oyuncuGunluk).where(eq(oyuncuGunluk.oyuncuId, oyuncuId));
    return satirlar[0] ?? null;
  };

  it('olaylari dogru sutunlara katlar', async () => {
    const kuyruk = olayKuyrugu();
    await kuyruk.ekle(KIRACI, olay('deposit', 'p1', 500));
    await kuyruk.ekle(KIRACI, olay('withdrawal', 'p1', 200));
    await kuyruk.ekle(KIRACI, olay('bet', 'p1', 1000));
    await kuyruk.ekle(KIRACI, olay('win', 'p1', 400));

    const sonuc = await olaylariIsle(KIRACI);
    expect(sonuc).toEqual({ alinan: 4, tamam: 4, hatali: 0 });

    const g = await gunluk('p1');
    expect(g).toMatchObject({ gun: '2026-08-09', yatirim: 500, cekim: 200, bahis: 1000, kazanc: 400, olaySayisi: 4 });
    // GGR = bahis - kazanc; hesabin dayanagi bu iki sutun.
    expect(g!.bahis - g!.kazanc).toBe(600);
  });

  it('ayni turden olaylari toplar', async () => {
    const kuyruk = olayKuyrugu();
    for (const tutar of [100, 250, 75]) await kuyruk.ekle(KIRACI, olay('deposit', 'p2', tutar));
    await olaylariIsle(KIRACI);
    expect((await gunluk('p2'))?.yatirim).toBe(425);
  });

  /** Tekrar gonderilen istek ikinci kez kuyruga GIRMEMELI. */
  it('ayni imzali olay iki kez kuyruga girmez', async () => {
    const kuyruk = olayKuyrugu();
    const imza = 'ayni-imza';
    expect((await kuyruk.ekle(KIRACI, olay('deposit', 'p3', 100, { imza }))).eklendi).toBe(true);
    expect((await kuyruk.ekle(KIRACI, olay('deposit', 'p3', 100, { imza }))).eklendi).toBe(false);

    await olaylariIsle(KIRACI);
    expect((await gunluk('p3'))?.yatirim).toBe(100);
  });

  it('gunu olayin alindigi UTC tarihinden alir', async () => {
    const kuyruk = olayKuyrugu();
    await kuyruk.ekle(KIRACI, olay('deposit', 'p4', 10, { alindi: '2026-08-09T23:59:59.000Z' }));
    await kuyruk.ekle(KIRACI, olay('deposit', 'p4', 20, { alindi: '2026-08-10T00:00:01.000Z' }));
    await olaylariIsle(KIRACI);

    const satirlar = await veritabani()!
      .select().from(oyuncuGunluk).where(eq(oyuncuGunluk.oyuncuId, 'p4'));
    expect(satirlar.map((s) => [s.gun, s.yatirim]).sort()).toEqual([['2026-08-09', 10], ['2026-08-10', 20]]);
  });

  it('islenen olay ikinci turda tekrar alinmaz', async () => {
    const kuyruk = olayKuyrugu();
    await kuyruk.ekle(KIRACI, olay('bet', 'p5', 300));
    await olaylariIsle(KIRACI);

    expect(await olaylariIsle(KIRACI)).toEqual({ alinan: 0, tamam: 0, hatali: 0 });
    expect((await gunluk('p5'))?.bahis).toBe(300);
  });

  it('ozet kuyrugun halini bildirir', async () => {
    const kuyruk = olayKuyrugu();
    await kuyruk.ekle(KIRACI, olay('deposit', 'p6', 50));
    expect(await kuyruk.ozet(KIRACI)).toMatchObject({ bekleyen: 1, tamam: 0 });

    await olaylariIsle(KIRACI);
    expect(await kuyruk.ozet(KIRACI)).toMatchObject({ bekleyen: 0, tamam: 1, hatali: 0 });
  });

  /**
   * Sahiplenme atomik olmali: ayni olayi iki isci alirsa tutar iki kez
   * eklenir. `FOR UPDATE SKIP LOCKED` bunu engelliyor.
   */
  it('es zamanli iki isci ayni olayi iki kez uygulamaz', async () => {
    const kuyruk = olayKuyrugu();
    for (let i = 0; i < 10; i += 1) await kuyruk.ekle(KIRACI, olay('deposit', 'p7', 10));

    const [a, b] = await Promise.all([olaylariIsle(KIRACI), olaylariIsle(KIRACI)]);

    expect(a.alinan + b.alinan).toBe(10);
    // Asil olcut: toplam, olay basina tutarin tam kati olmali.
    expect((await gunluk('p7'))?.yatirim).toBe(100);
    expect((await gunluk('p7'))?.olaySayisi).toBe(10);
  });

  it('bekleyen olay yoksa hicbir sey yapmaz', async () => {
    expect(await olaylariIsle(KIRACI)).toEqual({ alinan: 0, tamam: 0, hatali: 0 });
  });

  it('baska kiracinin olaylarini islemez', async () => {
    const kuyruk = olayKuyrugu();
    await kuyruk.ekle('baska-kiraci', olay('deposit', 'p8', 999));
    expect(await olaylariIsle(KIRACI)).toEqual({ alinan: 0, tamam: 0, hatali: 0 });
    expect(await gunluk('p8')).toBeNull();
  });
});
