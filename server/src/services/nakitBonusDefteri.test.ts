import { randomUUID } from 'crypto';
import { existsSync, rmSync } from 'fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  bugunYerelVerilmisMi,
  rezerveEt,
  rezervasyonuKaldir,
  tamamlandiIsaretle,
} from './nakitBonusDefteri.js';

/**
 * PARA SIZINTISI REGRESYON TESTI — yerel defter.
 *
 * Vaka: oyuncu 2492369, 2026-08-03 22:01-22:03 arasinda ayni %30 KAYIP
 * BONUSU'nu (kural 1874) UC KEZ aldi, denemeler arasinda tam bir dakika
 * vardi. Lynon'dan turetilen kontrol (nakitBonusGecmisi.ts) bunu
 * yakalayamadi. Bu defter, Lynon'un okuma tutarliligina bagli olmadan
 * KENDI kaydini tutup kontrol ediyor.
 */

const tenant = () => `test-${randomUUID().slice(0, 8)}`;

afterEach(() => {
  const dizin = new URL('../data/nakit-bonus-defteri', import.meta.url);
  try {
    if (existsSync(dizin)) rmSync(dizin, { recursive: true, force: true });
  } catch {
    /* temizlik en iyi caba; sonraki test kendi tenant'inda calisir */
  }
});

describe('nakit bonus defteri', () => {
  it('rezerve edilip tamamlanan kayit bugun verilmis sayilir', async () => {
    const t = tenant();
    const simdi = new Date('2026-08-03T22:01:00+03:00');
    const id = await rezerveEt(t, '2492369', '1874', 2500, simdi);
    await tamamlandiIsaretle(t, id);

    expect(await bugunYerelVerilmisMi(t, '2492369', '1874', simdi)).toBe(true);
  });

  /** ASIL VAKA: bir dakika arayla gelen ikinci istek engellenmeli. */
  it('bir dakika sonraki ikinci deneme engellenir', async () => {
    const t = tenant();
    const ilk = new Date('2026-08-03T22:01:00+03:00');
    const ikinci = new Date('2026-08-03T22:02:00+03:00');
    const ucuncu = new Date('2026-08-03T22:03:00+03:00');

    const id1 = await rezerveEt(t, '2492369', '1874', 2500, ilk);
    await tamamlandiIsaretle(t, id1);

    expect(await bugunYerelVerilmisMi(t, '2492369', '1874', ikinci)).toBe(true);
    expect(await bugunYerelVerilmisMi(t, '2492369', '1874', ucuncu)).toBe(true);
  });

  it('sadece PENDING kayit engellemez — yazma basarisiz olursa tekrar denenebilir', async () => {
    const t = tenant();
    const simdi = new Date('2026-08-03T22:01:00+03:00');
    await rezerveEt(t, '2492369', '1874', 2500, simdi);
    // tamamlandiIsaretle cagrilmadi: Lynon yazmasi basarisiz oldu senaryosu.
    expect(await bugunYerelVerilmisMi(t, '2492369', '1874', simdi)).toBe(false);
  });

  it('rezervasyon kaldirilinca tekrar denenebilir hale gelir', async () => {
    const t = tenant();
    const simdi = new Date('2026-08-03T22:01:00+03:00');
    const id = await rezerveEt(t, '2492369', '1874', 2500, simdi);
    await rezervasyonuKaldir(t, id);
    await tamamlandiIsaretle(t, id); // artik yok; sessizce yok sayilir

    expect(await bugunYerelVerilmisMi(t, '2492369', '1874', simdi)).toBe(false);
  });

  it('yarinki gun icin engellemez — gun sinirini asmaz', async () => {
    const t = tenant();
    const bugun = new Date('2026-08-03T22:01:00+03:00');
    const yarin = new Date('2026-08-04T09:00:00+03:00');

    const id = await rezerveEt(t, '2492369', '1874', 2500, bugun);
    await tamamlandiIsaretle(t, id);

    expect(await bugunYerelVerilmisMi(t, '2492369', '1874', yarin)).toBe(false);
  });

  it('farkli kural ayni oyuncuyu engellemez', async () => {
    const t = tenant();
    const simdi = new Date('2026-08-03T22:01:00+03:00');
    const id = await rezerveEt(t, '2492369', '1874', 2500, simdi);
    await tamamlandiIsaretle(t, id);

    expect(await bugunYerelVerilmisMi(t, '2492369', '1870', simdi)).toBe(false);
  });

  it('farkli oyuncu ayni kuralda engellenmez', async () => {
    const t = tenant();
    const simdi = new Date('2026-08-03T22:01:00+03:00');
    const id = await rezerveEt(t, '2492369', '1874', 2500, simdi);
    await tamamlandiIsaretle(t, id);

    expect(await bugunYerelVerilmisMi(t, '9999999', '1874', simdi)).toBe(false);
  });

  it('kural anahtari buyuk/kucuk harf duyarsiz karsilastirilir', async () => {
    // Gercek kurallar sayisal ID (ornek: "1874"); harf iceren bir anahtar
    // secilirken Turkce 'I' kuralina TAKILMAYAN bir kelime kullaniliyor —
    // 'i/İ/ı' locale'e gore farkli kucultuluyor, bu testin konusu degil.
    const t = tenant();
    const simdi = new Date('2026-08-03T22:01:00+03:00');
    const id = await rezerveEt(t, '2492369', 'Bonus-A', 2500, simdi);
    await tamamlandiIsaretle(t, id);

    expect(await bugunYerelVerilmisMi(t, '2492369', 'bonus-a', simdi)).toBe(true);
    expect(await bugunYerelVerilmisMi(t, '2492369', 'BONUS-A', simdi)).toBe(true);
  });

  it('kiracilar birbirinin defterini gormez', async () => {
    const bir = tenant();
    const iki = tenant();
    const simdi = new Date('2026-08-03T22:01:00+03:00');
    const id = await rezerveEt(bir, '2492369', '1874', 2500, simdi);
    await tamamlandiIsaretle(bir, id);

    expect(await bugunYerelVerilmisMi(iki, '2492369', '1874', simdi)).toBe(false);
  });
});
