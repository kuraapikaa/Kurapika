import { describe, expect, it } from 'vitest';
import { sonrakiGirisSerisi } from './loyaltyService.js';

describe('sonrakiGirisSerisi', () => {
  it('ilk giriş (önceki tarih yok) mevcut seriyi korur', () => {
    expect(sonrakiGirisSerisi(undefined, undefined, new Date('2026-08-10T10:00:00Z'))).toBe(1);
    expect(sonrakiGirisSerisi(undefined, 5, new Date('2026-08-10T10:00:00Z'))).toBe(5);
  });

  it('aynı Türkiye takvim günü içindeki tekrar ziyaret seriyi bozmaz', () => {
    // Durum sorgusu 60sn'de bir tazeleniyor; her tazeleme günü artırmamalı.
    const onceki = '2026-08-10T10:00:00Z';
    const simdi = new Date('2026-08-10T10:05:00Z');
    expect(sonrakiGirisSerisi(onceki, 3, simdi)).toBe(3);
  });

  it('tam bir sonraki takvim günü seriyi bir artırır', () => {
    const onceki = '2026-08-10T10:00:00Z';
    const simdi = new Date('2026-08-11T10:00:00Z');
    expect(sonrakiGirisSerisi(onceki, 3, simdi)).toBe(4);
  });

  it('gece yarısını geçen kısa aralık da bir sonraki gün sayılır (İstanbul takvimi, ham ms farkı değil)', () => {
    // 20:50 UTC = İstanbul 23:50 (10 Ağu); 21:10 UTC = İstanbul 00:10 (11 Ağu).
    // Sadece 20 dakika ama takvim günü değişti.
    const onceki = '2026-08-10T20:50:00Z';
    const simdi = new Date('2026-08-10T21:10:00Z');
    expect(sonrakiGirisSerisi(onceki, 2, simdi)).toBe(3);
  });

  it('bir günden fazla atlanırsa seri 1\'e döner', () => {
    const onceki = '2026-08-10T10:00:00Z';
    const simdi = new Date('2026-08-13T10:00:00Z');
    expect(sonrakiGirisSerisi(onceki, 7, simdi)).toBe(1);
  });

  it('geçersiz önceki streak (0 veya undefined) 1 varsayılır', () => {
    const onceki = '2026-08-10T10:00:00Z';
    const simdi = new Date('2026-08-11T10:00:00Z');
    expect(sonrakiGirisSerisi(onceki, 0, simdi)).toBe(2);
    expect(sonrakiGirisSerisi(onceki, undefined, simdi)).toBe(2);
  });
});
