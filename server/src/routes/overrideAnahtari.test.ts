import { describe, expect, it } from 'vitest';
import { specBonusIdSahipleniyorMu } from '../services/bonusAraliklari.js';

/**
 * "BONUS GORUNUMU & ICERIK"TEKI GORSELLER LOBIYE YANSIMIYORDU.
 *
 * Panel override'i KURAL ANAHTARIYLA kaydediyor
 * (`externalId={Number(key)}`), lobi ise KAMPANYA ID'siyle ariyordu.
 * Kural anahtari ile bonus ID ayni degilse (ornek: kural 1874 ->
 * kampanya 2046) yonetici gorseli kaydediyor ama lobide hic gorunmuyordu.
 *
 * Duzeltme: kampanya ID'siyle bulunamazsa, o kampanyayi SAHIPLENEN
 * kuralin anahtariyla bakiliyor. Bu test, arama zincirinin dayandigi
 * sahiplenme yuklemini kilitliyor.
 */
describe('override anahtari cozumleme', () => {
  const specs: Record<string, any> = {
    // Anahtar 1874 ama kampanya 2046 — bildirilen vakanin ta kendisi.
    '1874': { partnerBonusId: '2046', title: 'Kayıp Bonusu' },
    // Anahtar = kampanya (yaygin durum)
    '3001': { partnerBonusId: '3001' },
    // Aralikli kural: uc kampanyayi birden sahipleniyor
    '4000': { partnerBonusRanges: [
      { min: 0, max: 999, partnerBonusId: '5001' },
      { min: 1000, max: null, partnerBonusId: '5002' },
    ] },
  };

  const anahtarBul = (campaignId: string) =>
    specs[campaignId] ? campaignId
      : Object.entries(specs).find(([, spec]) => specBonusIdSahipleniyorMu(spec, campaignId))?.[0] ?? null;

  it('anahtar ile bonus ID FARKLI olan kurali bulur', () => {
    expect(anahtarBul('2046')).toBe('1874');
  });

  it('anahtar ile bonus ID ayni oldugunda dogrudan bulur', () => {
    expect(anahtarBul('3001')).toBe('3001');
  });

  it('aralikli kuralin her kademesi ayni kurala cozulur', () => {
    expect(anahtarBul('5001')).toBe('4000');
    expect(anahtarBul('5002')).toBe('4000');
  });

  it('sahipsiz kampanyada null — yanlis override uygulanmaz', () => {
    expect(anahtarBul('9999')).toBeNull();
  });
});
