import { afterEach, describe, expect, it } from 'vitest';
import { coz, maskele, parolaDogrula, parolaOzeti, sifrele, sifreliMi, sifrelemeHazirMi } from './sifre.js';

const ANAHTAR = process.env.AFF_SECRET_KEY;

afterEach(() => {
  process.env.AFF_SECRET_KEY = ANAHTAR;
});

describe('sir kutusu', () => {
  it('sifreleyip geri cozer', () => {
    const sifreli = sifrele('lynon-parolasi');
    expect(sifreliMi(sifreli)).toBe(true);
    expect(sifreli).not.toContain('lynon-parolasi');
    expect(coz(sifreli)).toBe('lynon-parolasi');
  });

  it('ayni degeri iki kez sifrelemez', () => {
    const bir = sifrele('deger');
    expect(sifrele(bir)).toBe(bir);
  });

  it('her sifrelemede farkli ciktı uretir', () => {
    // Sabit IV kullanilsaydi ayni sir ayni ciktiyi verir ve iki kaydin
    // ayni parolayi tasidigi disaridan gorunurdu.
    expect(sifrele('deger')).not.toBe(sifrele('deger'));
  });

  /**
   * Sessizce duz metne dusmek en kotu secenek: kurulum calisiyor
   * gorunur, sir duz yazilir ve kimse fark etmez.
   */
  it('anahtar yoksa yazmayi REDDEDER', () => {
    process.env.AFF_SECRET_KEY = '';
    expect(sifrelemeHazirMi()).toBe(false);
    expect(() => sifrele('sir')).toThrow(/AFF_SECRET_KEY/);
  });

  /** Anahtar dondurulduyse panel acilmali; tek kayit yuzunden dusmemeli. */
  it('yanlis anahtarla cozmede null doner, firlatmaz', () => {
    const sifreli = sifrele('sir');
    process.env.AFF_SECRET_KEY = 'bambaska-bir-anahtar-yeterince-uzun';
    expect(coz(sifreli)).toBeNull();
  });

  it('kurcalanmis metni reddeder', () => {
    const sifreli = sifrele('sir');
    expect(coz(`${sifreli.slice(0, -4)}AAAA`)).toBeNull();
  });

  it('maskede yalnizca son 4 hane gorunur', () => {
    expect(maskele('1234567890')).toMatch(/•+7890$/);
    expect(maskele('')).toBe('');
  });
});

describe('parola ozeti', () => {
  it('dogru parolayi dogrular', () => {
    const ozet = parolaOzeti('cok-guclu-parola');
    expect(parolaDogrula('cok-guclu-parola', ozet)).toBe(true);
  });

  it('yanlis parolayi reddeder', () => {
    expect(parolaDogrula('yanlis', parolaOzeti('cok-guclu-parola'))).toBe(false);
  });

  it('her ozet farkli tuz kullanir', () => {
    expect(parolaOzeti('ayni')).not.toBe(parolaOzeti('ayni'));
  });

  it('bozuk ozet kaydinda false doner', () => {
    expect(parolaDogrula('x', 'bozuk')).toBe(false);
    expect(parolaDogrula('x', '')).toBe(false);
  });
});
