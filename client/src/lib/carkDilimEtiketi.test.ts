import { describe, expect, it } from 'vitest';
import { VARSAYILAN_ETIKET, etiketUzerineYazilsinMi, yeniEtiket } from './carkDilimEtiketi';

const ADLAR = ['Hosgeldin Bonusu', '50 FS - Fortune of Olympus', 'Kayip Bonusu'];

describe('etiketUzerineYazilsinMi', () => {
  it('bos etiketi dolduruyor', () => {
    expect(etiketUzerineYazilsinMi('', ADLAR)).toBe(true);
    expect(etiketUzerineYazilsinMi('   ', ADLAR)).toBe(true);
    expect(etiketUzerineYazilsinMi(null, ADLAR)).toBe(true);
  });

  it('yer tutucunun uzerine yaziyor', () => {
    expect(etiketUzerineYazilsinMi(VARSAYILAN_ETIKET, ADLAR)).toBe(true);
  });

  it('ham ID gorunmemeli -- uzerine yaziyor', () => {
    // Elle bonus ID yazildiginda eskiden etiket "2499894" oluyordu ve
    // cark oyuncuya bunu gosteriyordu.
    expect(etiketUzerineYazilsinMi('2499894', ADLAR)).toBe(true);
  });

  it('daha once otomatik gelmis kampanya adinin uzerine yaziyor', () => {
    expect(etiketUzerineYazilsinMi('Kayip Bonusu', ADLAR)).toBe(true);
  });

  it('ELLE yazilmis etikete DOKUNMUYOR', () => {
    // Asil koruma bu: operator kisaltmissa emegi silinmesin.
    expect(etiketUzerineYazilsinMi('500 ₺ Freespin Paketi', ADLAR)).toBe(false);
    expect(etiketUzerineYazilsinMi('iPhone 17 Pro Max', ADLAR)).toBe(false);
  });

  it('bosluk farki elle yazilmis saymiyor', () => {
    expect(etiketUzerineYazilsinMi('  Kayip Bonusu  ', ADLAR)).toBe(true);
  });
});

describe('yeniEtiket', () => {
  it('otomatik etiketi kampanya adiyla degistiriyor', () => {
    expect(yeniEtiket(VARSAYILAN_ETIKET, 'Hosgeldin Bonusu', ADLAR)).toBe('Hosgeldin Bonusu');
  });

  it('elle yazilani koruyor', () => {
    expect(yeniEtiket('Ozel Ad', 'Hosgeldin Bonusu', ADLAR)).toBe('Ozel Ad');
  });

  it('kampanya adi yoksa etiketi bozmuyor', () => {
    expect(yeniEtiket('Ozel Ad', '', ADLAR)).toBe('Ozel Ad');
    expect(yeniEtiket('Ozel Ad', null, ADLAR)).toBe('Ozel Ad');
  });
});
