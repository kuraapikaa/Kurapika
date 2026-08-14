import { describe, expect, it } from 'vitest';
import { sporSatiriMi } from './lynonBackofficeService.js';

/**
 * RAPOR 1840 SUZGEC REGRESYONU.
 *
 * Bildirilen vaka: panodaki "en cok oynanan" kartlari yanlis/eksik.
 *
 * Mekanizma: kasino listesi satirlari `Game Type` icinde "casino"
 * gecenlere gore suzuyordu. Oysa rapor o sutuna OYUN TURUNU yaziyor.
 * Asagidaki satir gercek bir yanittan alindi (1840, 2026-08-14, TRY) ve
 * turu "Slot" — yani eski suzgec bu satiri ELIYORDU. Slotlar cirosun
 * buyuk kismini olusturdugu icin liste ya bostu ya da yalnizca turunde
 * "casino" gecen bir avuc satiri gosteriyordu.
 *
 * Dogru yuklem: spor OLMAYAN her sey kasinodur.
 */
const GERCEK_SLOT_SATIRI = {
  'Game ID': '197470',
  'Game Name': '40 Shining Crown Bell Link',
  'Game Type': 'Slot',
  'Provider Name': 'EGT Digital',
  Currency: 'TRY',
  'Bet Sum Amount': '490',
  'Win Sum Amount': '343',
  GGR: '147',
  'Unique User Count': '1',
  'Bet Count': '39',
};

describe('sporSatiriMi', () => {
  it('gercek slot satirini spor saymaz — kasino listesinde kalir', () => {
    expect(sporSatiriMi(GERCEK_SLOT_SATIRI)).toBe(false);
  });

  it('turunde "casino" gecmeyen diger kasino turlerini de disarida birakmaz', () => {
    for (const tur of ['Live Casino', 'Table Games', 'Crash', 'Instant Win', 'Bingo']) {
      expect(sporSatiriMi({ 'Game Type': tur })).toBe(false);
    }
  });

  it('spor satirlarini turunden tanir', () => {
    for (const tur of ['Sport', 'Sports', 'Sportsbook', 'sportsbook', 'Live Sport']) {
      expect(sporSatiriMi({ 'Game Type': tur })).toBe(true);
    }
  });

  it('tur bos gelirse saglayici adindan tanir', () => {
    expect(sporSatiriMi({ 'Game Type': '', 'Provider Name': 'BetConstruct Sportsbook' })).toBe(true);
  });

  it('turu olmayan satiri kasino tarafinda birakir', () => {
    // Eski davranis da boyleydi; kaynak sutunu eksikse veri kaybolmasin.
    expect(sporSatiriMi({ 'Game Name': 'Bilinmeyen' })).toBe(false);
  });

  it('PascalCase alan adlarini da okur', () => {
    expect(sporSatiriMi({ GameType: 'Sportsbook' })).toBe(true);
    expect(sporSatiriMi({ GameType: 'Slot' })).toBe(false);
  });

  it('iki liste birbirini tamamlar: hicbir satir ikisinde birden ya da hicbirinde olmaz', () => {
    const satirlar = [
      GERCEK_SLOT_SATIRI,
      { 'Game Type': 'Live Casino' },
      { 'Game Type': 'Sportsbook' },
      {},
    ];
    const spor = satirlar.filter(sporSatiriMi);
    const kasino = satirlar.filter((row) => !sporSatiriMi(row));
    expect(spor.length + kasino.length).toBe(satirlar.length);
    expect(spor.some((row) => kasino.includes(row))).toBe(false);
  });
});
