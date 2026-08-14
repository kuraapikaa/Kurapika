import { describe, expect, it } from 'vitest';
import { oyunTuruToplamlari, sporSatiriMi } from './lynonBackofficeService.js';

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

/**
 * PANO "CASINO CIROSU 104 ₺" REGRESYONU.
 *
 * Ekranda ayni anda su ikisi duruyordu:
 *
 *   Casino cirosu ....... 104 ₺        <- KPI kutusu (bu fonksiyon)
 *   Live Casino ......... 104,00 ₺     <- oyun turu tablosu
 *   Slot ............. 88.854,55 ₺        (ayni ekran, ayni donem)
 *   Crash Games ....... 3.905,40 ₺
 *
 * `find` ilk eslesen satiri alip digerlerini attigi icin KPI yalnizca
 * "Live Casino" satirini gosteriyordu. Asagidaki rakamlar o ekrandan
 * birebir alindi.
 */
const OYUN_TURU_1846 = [
  { 'Game Type': 'Live Casino', 'Bet Count': '5', 'Total Bets': '104', 'Total Wins': '24', GGR: '80' },
  { 'Game Type': 'Slot', 'Bet Count': '18292', 'Total Bets': '88854.55', 'Total Wins': '126454.83', GGR: '-37600.28' },
  { 'Game Type': 'Crash Games', 'Bet Count': '94', 'Total Bets': '3905.40', 'Total Wins': '3936.93', GGR: '-31.53' },
];

describe('oyunTuruToplamlari', () => {
  it('kasino cirosu butun kasino turlerinin TOPLAMIDIR', () => {
    const { casino } = oyunTuruToplamlari(OYUN_TURU_1846);
    // 104 + 88.854,55 + 3.905,40 — ekranda 104 yaziyordu.
    expect(casino?.ciro).toBeCloseTo(92863.95, 2);
    expect(casino?.kazanc).toBeCloseTo(130415.76, 2);
  });

  it('tek bir turu (Live Casino) tek basina raporlamaz', () => {
    const { casino } = oyunTuruToplamlari(OYUN_TURU_1846);
    expect(casino?.ciro).not.toBe(104);
  });

  it('rapor spor satiri tasimiyorsa spor null doner — sifir degil', () => {
    // null "olcum yok" demek; cagiran taraf pano ham alanlarina duser.
    // Sifir donseydi "spor cirosu gercekten 0" gibi cizilirdi.
    expect(oyunTuruToplamlari(OYUN_TURU_1846).sport).toBeNull();
  });

  it('spor satiri varsa kasino toplamina karismaz', () => {
    const { casino, sport } = oyunTuruToplamlari([
      ...OYUN_TURU_1846,
      { 'Game Type': 'Sportsbook', 'Total Bets': '245456.32', 'Total Wins': '252134.54' },
    ]);
    expect(sport?.ciro).toBeCloseTo(245456.32, 2);
    expect(casino?.ciro).toBeCloseTo(92863.95, 2);
  });

  it('bilinmeyen yeni bir tur eklenirse kasino toplamindan dusmez', () => {
    const { casino } = oyunTuruToplamlari([
      ...OYUN_TURU_1846,
      { 'Game Type': 'Table Games', 'Total Bets': '1000', 'Total Wins': '400' },
    ]);
    expect(casino?.ciro).toBeCloseTo(93863.95, 2);
  });

  it('rapor bos gelirse iki taraf da null', () => {
    expect(oyunTuruToplamlari([])).toEqual({ casino: null, sport: null });
  });

  it('TRY sutunu varsa onu tercih eder', () => {
    const { casino } = oyunTuruToplamlari([
      { 'Game Type': 'Slot', 'Total Bets (TRY)': '500', 'Total Bets': '999', 'Total Wins (TRY)': '100', 'Total Wins': '888' },
    ]);
    expect(casino).toEqual({ ciro: 500, kazanc: 100 });
  });
});
