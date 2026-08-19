import { describe, expect, it } from 'vitest';
import { tahmineAcikMi, tahminAcilisZamani, tahminKapanisZamani } from './games.js';

/**
 * TAHMIN PENCERESI: ACILIS + KAPANIS.
 *
 * Bildirilen vaka: "Tahmin baslangic tarihi ileri tarihli olsa da mac
 * tahmine acik gozukuyor."
 *
 * Sebep boyle bir alanin HIC OLMAMASIYDI. Panelde "Baslangic" macin
 * kickoff'uydu (`startsAt`) ve kapanis icin YEDEK olarak kullaniliyordu;
 * ileri tarih girmek maci daha da ACIK tutuyordu.
 */
const AN = Date.parse('2026-06-15T12:00:00+03:00');

describe('tahminAcilisZamani', () => {
  it('dilimsiz dizgeyi Istanbul saati sayar', () => {
    expect(new Date(tahminAcilisZamani({ predictionOpensAt: '2026-06-15T18:00' })!).toISOString())
      .toBe('2026-06-15T15:00:00.000Z');
  });

  it('alan yoksa null — hemen acik', () => {
    expect(tahminAcilisZamani({})).toBeNull();
  });
});

describe('tahmineAcikMi', () => {
  it('ACILIS ILERIDE ise KAPALI — bildirilen hata', () => {
    const mac = { status: 'open', predictionOpensAt: '2026-06-15T20:00', predictionClosesAt: '2026-06-16T20:00' };
    expect(tahmineAcikMi(mac, AN)).toBe(false);
  });

  it('acilis gectiyse ve kapanis gelmediyse ACIK', () => {
    const mac = { status: 'open', predictionOpensAt: '2026-06-15T08:00', predictionClosesAt: '2026-06-15T20:00' };
    expect(tahmineAcikMi(mac, AN)).toBe(true);
  });

  it('kapanis gectiyse KAPALI', () => {
    const mac = { status: 'open', predictionOpensAt: '2026-06-15T08:00', predictionClosesAt: '2026-06-15T10:00' };
    expect(tahmineAcikMi(mac, AN)).toBe(false);
  });

  it('acilis yoksa eski davranis surer — mevcut maclar etkilenmez', () => {
    expect(tahmineAcikMi({ status: 'open', predictionClosesAt: '2026-06-15T20:00' }, AN)).toBe(true);
    expect(tahmineAcikMi({ status: 'open', predictionClosesAt: '2026-06-15T10:00' }, AN)).toBe(false);
  });

  it('durum open degilse acilis/kapanis ne olursa olsun KAPALI', () => {
    for (const status of ['closed', 'finished']) {
      expect(tahmineAcikMi({ status, predictionOpensAt: '2026-06-15T08:00' }, AN)).toBe(false);
    }
  });

  it('acilis ve kapanis birlikte: pencere disinda kapali, icinde acik', () => {
    const mac = { status: 'open', predictionOpensAt: '2026-06-15T13:00', predictionClosesAt: '2026-06-15T15:00' };
    expect(tahmineAcikMi(mac, Date.parse('2026-06-15T12:59:00+03:00'))).toBe(false);
    expect(tahmineAcikMi(mac, Date.parse('2026-06-15T14:00:00+03:00'))).toBe(true);
    expect(tahmineAcikMi(mac, Date.parse('2026-06-15T15:01:00+03:00'))).toBe(false);
  });

  it('kapanis bossa startsAt yedegi calisir', () => {
    expect(new Date(tahminKapanisZamani({ startsAt: '2026-06-15T18:00' })!).toISOString())
      .toBe('2026-06-15T15:00:00.000Z');
  });
});
