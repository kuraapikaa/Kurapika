import { describe, expect, it } from 'vitest';
import { ozetle } from './olcum.js';
import type { OrtakGunlukOlcum } from '../depolar/olcumDeposu.js';

const olcum = (ek: Partial<OrtakGunlukOlcum> = {}): OrtakGunlukOlcum => ({
  gun: '2026-08-01',
  ortakAnahtari: 'ortak-1',
  oyuncuSayisi: 10,
  aktifOyuncuSayisi: 5,
  yatirim: 1000,
  cekim: 200,
  ggr: 800,
  ftdSayisi: null,
  dikey: 'bilinmiyor',
  kaynak: 'cekme',
  yazildi: '2026-08-01T12:00:00.000Z',
  ...ek,
});

describe('ozetle', () => {
  /**
   * EN ÖNEMLİ TEST (BACKEND.md madde 2): aynı gün casino + spor satırı
   * gelirse gunSayisi 1 kalmalı, 2 DEĞİL — eski kod satır sayardı.
   */
  it('aynı günün casino + spor satırı birbirini ezmez, gunSayisi 1 kalır', () => {
    const [ozet] = ozetle([
      olcum({ dikey: 'casino', ggr: 5000 }),
      olcum({ dikey: 'spor', ggr: 1000 }),
    ]);
    expect(ozet.gunSayisi).toBe(1);
    expect(ozet.ggr).toBe(6000); // ikisi toplaniyor
    expect(ozet.gunlukGgr).toEqual([{ gun: '2026-08-01', ggr: 6000 }]);
  });

  it('iki farklı gün gerçekten iki gün sayılır', () => {
    const [ozet] = ozetle([
      olcum({ gun: '2026-08-01', dikey: 'casino', ggr: 1000 }),
      olcum({ gun: '2026-08-02', dikey: 'casino', ggr: 2000 }),
    ]);
    expect(ozet.gunSayisi).toBe(2);
  });

  it('dikey kırılımı yalnızca ölçümü olan dikeyleri içerir', () => {
    const [ozet] = ozetle([olcum({ dikey: 'casino', ggr: 5000 })]);
    expect(ozet.dikeyler).toHaveLength(1);
    expect(ozet.dikeyler[0].dikey).toBe('casino');
  });

  it('dikey satırlarının toplamı ortak toplamına eşit olmak zorunda değil (oyuncu sayısı çakışabilir)', () => {
    const [ozet] = ozetle([
      olcum({ dikey: 'casino', ggr: 5000, oyuncuSayisi: 8 }),
      olcum({ dikey: 'spor', ggr: 1000, oyuncuSayisi: 8 }),
    ]);
    // Ortak duzeyi gun bazinda en yuksegi alir (tekillik korunur).
    expect(ozet.oyuncuSayisi).toBe(8);
    // Dikey satirlari kendi icinde ayri sayilir, toplanmaz.
    expect(ozet.dikeyler.find((d) => d.dikey === 'casino')?.oyuncuSayisi).toBe(8);
    expect(ozet.dikeyler.find((d) => d.dikey === 'spor')?.oyuncuSayisi).toBe(8);
  });

  it('dikeysiz (bilinmiyor) tek satır eski davranışla aynı özet üretir', () => {
    const [ozet] = ozetle([olcum({ dikey: 'bilinmiyor', ggr: 4000, ftdSayisi: 2 })]);
    expect(ozet.ggr).toBe(4000);
    expect(ozet.ftdSayisi).toBe(2);
    expect(ozet.dikeyler).toEqual([
      expect.objectContaining({ dikey: 'bilinmiyor', ggr: 4000, ftdSayisi: 2 }),
    ]);
  });

  it('bir dikeyde ftdSayisi null, diğerinde sayı varsa ortak toplamı ÖLÇÜLMÜŞ sayılır', () => {
    const [ozet] = ozetle([
      olcum({ dikey: 'casino', ggr: 3000, ftdSayisi: 2 }),
      olcum({ dikey: 'spor', ggr: 1000, ftdSayisi: null }),
    ]);
    expect(ozet.ftdSayisi).toBe(2);
  });

  it('farklı ortaklar ayrı özet satırı olarak kalır, ggr azalana göre sıralanır', () => {
    const ozetler = ozetle([
      olcum({ ortakAnahtari: 'kucuk', ggr: 100, dikey: 'casino' }),
      olcum({ ortakAnahtari: 'buyuk', ggr: 9000, dikey: 'casino' }),
    ]);
    expect(ozetler.map((o) => o.ortakAnahtari)).toEqual(['buyuk', 'kucuk']);
  });
});
