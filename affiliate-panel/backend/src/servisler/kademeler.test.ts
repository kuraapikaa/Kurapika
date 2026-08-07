import { describe, expect, it } from 'vitest';
import { donguYaratirMi, kademePaylariHesapla, ustZincir, type KademeBagi } from './kademeler.js';

const bag = (ortakAnahtari: string, ustOrtakAnahtari: string): KademeBagi => ({
  ortakAnahtari, ustOrtakAnahtari, createdAt: '2026-08-01T00:00:00Z',
});

const zincir = [bag('C', 'B'), bag('B', 'A')];

describe('ust zincir', () => {
  it('en yakin ustten baslayarak sirali doner', () => {
    expect(ustZincir(zincir, 'C', 5)).toEqual(['B', 'A']);
  });

  it('seviye sinirina uyar', () => {
    expect(ustZincir(zincir, 'C', 1)).toEqual(['B']);
  });

  /**
   * Bu fonksiyon komisyon dagitiminda cagriliyor; bir dongu istegi
   * suresiz kilitler ve tum paneli dusururdu. Veri elle bozulsa bile
   * durmali.
   */
  it('bozuk veride donguye girmez', () => {
    const bozuk = [bag('A', 'B'), bag('B', 'A')];
    expect(ustZincir(bozuk, 'A', 10)).toEqual(['B']);
  });
});

describe('dongu tespiti', () => {
  it('kendi kendine bagi reddeder', () => {
    expect(donguYaratirMi([], 'A', 'A')).toBe(true);
  });

  it('zincirde geriye donusu yakalar', () => {
    expect(donguYaratirMi(zincir, 'A', 'C')).toBe(true);
  });

  it('gecerli bagi kabul eder', () => {
    expect(donguYaratirMi(zincir, 'D', 'C')).toBe(false);
  });
});

describe('kademe paylari', () => {
  it('seviye basina yuzdeyi uygular', () => {
    const paylar = kademePaylariHesapla(zincir, [5, 2], 'C', 1000);
    expect(paylar).toEqual([
      { ustOrtakAnahtari: 'B', seviye: 1, yuzde: 5, tutar: 50 },
      { ustOrtakAnahtari: 'A', seviye: 2, yuzde: 2, tutar: 20 },
    ]);
  });

  /**
   * Pay alt ortagin kazancindan KESILMIYOR, ustune ekleniyor: bu bir
   * pazarlama gideri. Tersi olsaydi alt ortak, kendisini kimin
   * getirdigine bagli olarak farkli kazanirdi.
   */
  it('alt ortagin kazancini degistirmez', () => {
    const kazanc = 1000;
    const paylar = kademePaylariHesapla(zincir, [5, 2], 'C', kazanc);
    expect(paylar.reduce((t, p) => t + p.tutar, 0)).toBe(70);
    expect(kazanc).toBe(1000);
  });

  it('sifir ve negatif kazancta pay dagitmaz', () => {
    expect(kademePaylariHesapla(zincir, [5, 2], 'C', 0)).toEqual([]);
    expect(kademePaylariHesapla(zincir, [5, 2], 'C', -100)).toEqual([]);
  });

  it('kurusa yuvarlar', () => {
    expect(kademePaylariHesapla(zincir, [3.33], 'C', 10.1)[0].tutar).toBe(0.34);
  });

  it('ustu olmayan ortakta bos doner', () => {
    expect(kademePaylariHesapla(zincir, [5, 2], 'A', 1000)).toEqual([]);
  });
});
