import { describe, expect, it } from 'vitest';
import { CARK_EGRISI, ilerlemeIcinZaman, tikZamanlari } from './carkZamanlama';

describe('ilerlemeIcinZaman', () => {
  it('uc noktalari koruyor', () => {
    expect(ilerlemeIcinZaman(0)).toBe(0);
    expect(ilerlemeIcinZaman(1)).toBe(1);
  });

  it('monoton artiyor', () => {
    let onceki = -1;
    for (let i = 0; i <= 20; i += 1) {
      const t = ilerlemeIcinZaman(i / 20);
      expect(t).toBeGreaterThan(onceki);
      onceki = t;
    }
  });

  it('yavaslayan bir egri: ilerlemenin yarisi zamanin cok oncesinde biter', () => {
    // cubic-bezier(.12,.72,.12,1) hizli baslayip uzun yavasliyor.
    expect(ilerlemeIcinZaman(0.5)).toBeLessThan(0.25);
  });

  it('kendi tersini buluyor', () => {
    // Zamani ilerlemeye ceviren dogrudan hesapla karsilastir.
    const [x1, y1, x2, y2] = CARK_EGRISI;
    const deger = (t: number, a: number, b: number) =>
      3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    for (const ilerleme of [0.1, 0.35, 0.6, 0.9]) {
      const zaman = ilerlemeIcinZaman(ilerleme);
      // zaman -> t -> ilerleme yolunu tersinden dogrula
      let alt = 0, ust = 1;
      for (let i = 0; i < 40; i += 1) {
        const t = (alt + ust) / 2;
        if (deger(t, x1, x2) < zaman) alt = t; else ust = t;
      }
      expect(deger((alt + ust) / 2, y1, y2)).toBeCloseTo(ilerleme, 3);
    }
  });
});

describe('tikZamanlari', () => {
  const SURE = 5000;

  it('gecilen her dilim sinirina bir tik dusuyor', () => {
    // 2 tur, 12 dilim -> 24 sinir.
    expect(tikZamanlari(720, 12, SURE)).toHaveLength(24);
  });

  it('tiklar sirali ve sure icinde', () => {
    const t = tikZamanlari(8 * 360 + 90, 12, SURE);
    expect(t.length).toBeGreaterThan(0);
    for (let i = 1; i < t.length; i += 1) expect(t[i]).toBeGreaterThan(t[i - 1]);
    expect(t[0]).toBeGreaterThanOrEqual(0);
    expect(t[t.length - 1]).toBeLessThanOrEqual(SURE);
  });

  it('tiklar sona dogru SEYRELIYOR -- carkin yavaslamasiyla ayni', () => {
    // Esit araliklarla calmak kolay olurdu ama ses gorunen hareketten
    // kopardi. Asil sinav bu.
    const t = tikZamanlari(8 * 360, 12, SURE);
    const ilkAralik = t[1] - t[0];
    const sonAralik = t[t.length - 1] - t[t.length - 2];
    expect(sonAralik).toBeGreaterThan(ilkAralik * 10);
  });

  it('cok uzun donuslerde ugultuya donusmemesi icin BASTAN kirpiyor', () => {
    // Kulagin seyrekleşmeyi duydugu yer donusun SONU; kirpma oradan
    // olsaydi tam da duyulmasi gereken kisim gidecekti.
    const tam = tikZamanlari(20 * 360, 24, SURE, 10_000);
    const kirpik = tikZamanlari(20 * 360, 24, SURE, 30);
    expect(tam.length).toBeGreaterThan(30);
    expect(kirpik).toHaveLength(30);
    expect(kirpik[kirpik.length - 1]).toBeCloseTo(tam[tam.length - 1], 6);
  });

  it('bozuk girdide sessiz kaliyor', () => {
    expect(tikZamanlari(0, 12, SURE)).toEqual([]);
    expect(tikZamanlari(720, 12, 0)).toEqual([]);
    expect(tikZamanlari(Number.NaN, 12, SURE)).toEqual([]);
  });
});
