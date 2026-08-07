import { describe, expect, it } from 'vitest';
import { donguYaratirMi, kademePaylariHesapla, ustZincir, type KademeBagi } from './kademeler.js';

const bag = (bTag: string, ustBTag: string): KademeBagi => ({ bTag, ustBTag, createdAt: '2026-08-01T00:00:00Z' });

/** A <- B <- C: C'yi B getirdi, B'yi A getirdi. */
const ZINCIR = [bag('C', 'B'), bag('B', 'A')];

describe('kademeli ortak yapisi', () => {
  describe('ust zincir', () => {
    it('en yakin ustten baslayarak siralar', () => {
      expect(ustZincir(ZINCIR, 'C', 5)).toEqual(['B', 'A']);
    });

    it('seviye sinirina uyar', () => {
      expect(ustZincir(ZINCIR, 'C', 1)).toEqual(['B']);
    });

    it('ustu olmayan ortak icin bos doner', () => {
      expect(ustZincir(ZINCIR, 'A', 5)).toEqual([]);
    });

    /**
     * Veri bozulsa bile (elle duzenleme, kismi geri yukleme) sonsuz
     * donguye girmemeli: bu fonksiyon komisyon dagitiminda cagriliyor,
     * bir dongu istegi suresiz kilitler ve tum paneli dusururdu.
     */
    it('bozuk veride donguye girmez', () => {
      const bozuk = [bag('A', 'B'), bag('B', 'A')];
      expect(ustZincir(bozuk, 'A', 10)).toEqual(['B']);
    });

    it('kendine isaret eden bagda donmez', () => {
      expect(ustZincir([bag('A', 'A')], 'A', 10)).toEqual([]);
    });
  });

  describe('dongu tespiti', () => {
    it('ortak kendi ustu olamaz', () => {
      expect(donguYaratirMi([], 'A', 'A')).toBe(true);
    });

    it('dolayli donguyu yakalar', () => {
      // A <- B zaten var; simdi A'nin ustu B yapilmak isteniyor.
      expect(donguYaratirMi([bag('B', 'A')], 'A', 'B')).toBe(true);
    });

    it('derin dolayli donguyu yakalar', () => {
      expect(donguYaratirMi(ZINCIR, 'A', 'C')).toBe(true);
    });

    it('gecerli bagda dongu yok der', () => {
      expect(donguYaratirMi(ZINCIR, 'D', 'C')).toBe(false);
    });
  });

  describe('kademe paylari', () => {
    it('seviye basina yuzdeyi uygular', () => {
      expect(kademePaylariHesapla(ZINCIR, [5, 2], 'C', 1000)).toEqual([
        { ustBTag: 'B', seviye: 1, yuzde: 5, tutar: 50 },
        { ustBTag: 'A', seviye: 2, yuzde: 2, tutar: 20 },
      ]);
    });

    it('yuzde dizisinden derin gitmez', () => {
      expect(kademePaylariHesapla(ZINCIR, [5], 'C', 1000)).toHaveLength(1);
    });

    it('kazanc yoksa pay yok', () => {
      expect(kademePaylariHesapla(ZINCIR, [5, 2], 'C', 0)).toEqual([]);
      expect(kademePaylariHesapla(ZINCIR, [5, 2], 'C', -100)).toEqual([]);
    });

    it('sifir yuzdeli seviyeyi elemeye alir', () => {
      expect(kademePaylariHesapla(ZINCIR, [0, 2], 'C', 1000))
        .toEqual([{ ustBTag: 'A', seviye: 2, yuzde: 2, tutar: 20 }]);
    });

    /** Kayan nokta artiklari odeme kayitlarinda 0.30000000000000004 birakiyordu. */
    it('kurusa yuvarlar', () => {
      const [pay] = kademePaylariHesapla([bag('B', 'A')], [3], 'B', 10.1);
      expect(pay.tutar).toBe(0.3);
    });

    it('ustu olmayan ortakta pay uretmez', () => {
      expect(kademePaylariHesapla(ZINCIR, [5, 2], 'A', 1000)).toEqual([]);
    });
  });
});
