import { describe, expect, it } from 'vitest';
import { ASGARI_TIKLAMA, kaliteRaporu, riskBandi } from './trafikKalitesi.js';
import type { OrtakGunlukOlcum } from './olcum.js';
import type { Tiklama } from './tiklama.js';

const tiklama = (ek: Partial<Tiklama> = {}): Tiklama => ({
  clickId: Math.random().toString(36).slice(2),
  ortakAnahtari: 'ORT1',
  medyaId: 'm1',
  alt: {},
  ip: '1.2.3.4',
  userAgent: 'tarayici-a',
  referrer: null,
  zaman: '2026-08-01T10:00:00Z',
  ...ek,
});

const olcum = (ek: Partial<OrtakGunlukOlcum> = {}): OrtakGunlukOlcum => ({
  gun: '2026-08-01',
  ortakAnahtari: 'ORT1',
  oyuncuSayisi: 10,
  aktifOyuncuSayisi: 8,
  yatirim: 5000,
  cekim: 1000,
  ggr: 3000,
  ftdSayisi: 2,
  kaynak: 'cekme',
  yazildi: '2026-08-01T23:00:00Z',
  ...ek,
});

/** Her tiklamaya farkli IP ve tarayici: saglikli trafik. */
const cesitli = (adet: number) =>
  Array.from({ length: adet }, (_, i) =>
    tiklama({ ip: `10.0.${Math.floor(i / 250)}.${i % 250}`, userAgent: `tarayici-${i % 20}` }));

describe('trafik kalitesi', () => {
  /**
   * On iki tiklamayla kalite hukmu vermek mumkun degil: tek bir tekrar
   * eden IP orani %50'ye cikarir. Uydurulmus bir skor yoklugundan
   * kotudur cunku ona gore karar verilir.
   */
  describe('yetersiz veri', () => {
    it('esigin altinda skor URETMEZ', () => {
      const r = kaliteRaporu('ORT1', cesitli(10), [olcum()]);
      expect(r.riskSkoru).toBeNull();
      expect(r.skorsuzlukSebebi).toContain(String(ASGARI_TIKLAMA));
    });

    it('hic tiklama yoksa da skor uretmez', () => {
      const r = kaliteRaporu('ORT1', [], []);
      expect(r.riskSkoru).toBeNull();
      expect(riskBandi(r.riskSkoru)).toBe('veri-yok');
    });

    it('esikte skor uretmeye baslar', () => {
      const r = kaliteRaporu('ORT1', cesitli(ASGARI_TIKLAMA), [olcum()]);
      expect(r.riskSkoru).not.toBeNull();
    });
  });

  describe('saglikli trafik', () => {
    it('dusuk risk bandinda kalir', () => {
      const r = kaliteRaporu('ORT1', cesitli(200), [
        olcum({ oyuncuSayisi: 20, aktifOyuncuSayisi: 16, ggr: 20_000 }),
      ]);
      expect(r.riskSkoru).not.toBeNull();
      expect(riskBandi(r.riskSkoru)).toBe('dusuk');
    });
  });

  describe('supheli trafik', () => {
    it('tek IP ve tek tarayicidan gelen hacim yuksek risk uretir', () => {
      const bot = Array.from({ length: 200 }, () =>
        tiklama({ ip: '5.5.5.5', userAgent: 'tek-tarayici' }));
      const r = kaliteRaporu('ORT1', bot, [olcum({ oyuncuSayisi: 1, aktifOyuncuSayisi: 0, ggr: 0 })]);
      expect(riskBandi(r.riskSkoru)).toBe('yuksek');
    });

    it('tekil IP oranini dogru raporlar', () => {
      const bot = Array.from({ length: 100 }, () => tiklama({ ip: '5.5.5.5' }));
      const r = kaliteRaporu('ORT1', bot, [olcum()]);
      const sinyal = r.sinyaller.find((s) => s.ad === 'Tekil IP oranı');
      expect(sinyal?.deger).toBe('%1');
      expect(sinyal?.risk).toBe(100);
    });

    it('kaydolup hic oynamayan kitleyi isaretler', () => {
      const r = kaliteRaporu('ORT1', cesitli(100), [
        olcum({ oyuncuSayisi: 50, aktifOyuncuSayisi: 1, ggr: 100 }),
      ]);
      const sinyal = r.sinyaller.find((s) => s.ad === 'Aktif oyuncu oranı');
      expect(sinyal!.risk).toBeGreaterThan(80);
    });

    /** Negatif GGR sansin dogal sonucu, sahtekarlik degil -- ama sifira
     *  yakin ve pozitif olmayan deger "hic para birakmadi" demek. */
    it('sifir GGR ureten oyuncular risk sayilir', () => {
      const r = kaliteRaporu('ORT1', cesitli(100), [
        olcum({ oyuncuSayisi: 40, aktifOyuncuSayisi: 30, ggr: 0 }),
      ]);
      const sinyal = r.sinyaller.find((s) => s.ad === 'Oyuncu başına GGR');
      expect(sinyal!.risk).toBe(60);
    });
  });

  describe('izolasyon', () => {
    it('yalnizca kendi ortaginin verisine bakar', () => {
      const karisik = [...cesitli(50), ...Array.from({ length: 200 }, () =>
        tiklama({ ortakAnahtari: 'BASKA', ip: '9.9.9.9', userAgent: 'bot' }))];
      const r = kaliteRaporu('ORT1', karisik, [olcum(), olcum({ ortakAnahtari: 'BASKA', oyuncuSayisi: 999 })]);
      expect(r.tiklama).toBe(50);
      expect(r.oyuncu).toBe(10);
    });
  });

  describe('risk bandi', () => {
    it('esikleri dogru ayirir', () => {
      expect(riskBandi(null)).toBe('veri-yok');
      expect(riskBandi(0)).toBe('dusuk');
      expect(riskBandi(34)).toBe('dusuk');
      expect(riskBandi(35)).toBe('orta');
      expect(riskBandi(64)).toBe('orta');
      expect(riskBandi(65)).toBe('yuksek');
      expect(riskBandi(100)).toBe('yuksek');
    });
  });

  /**
   * Skor tek basina bir sey ifade etmiyor; panel bilesenleri de
   * gostermek zorunda. "78 risk" degil, "tiklamalarin %80'i tek
   * IP'den" karar verdiriyor.
   */
  it('her sinyalin aciklamasi var', () => {
    const r = kaliteRaporu('ORT1', cesitli(100), [olcum()]);
    expect(r.sinyaller.length).toBeGreaterThan(3);
    for (const s of r.sinyaller) {
      expect(s.aciklama.length).toBeGreaterThan(20);
      expect(s.deger).toBeTruthy();
    }
  });
});
