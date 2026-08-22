import { describe, expect, it } from 'vitest';
import { aralikOzeti, aralikSayisi } from './bonusAralikOzeti';

describe('aralikSayisi', () => {
  it('metin ve sayiyi ayni sekilde okuyor', () => {
    // Editorde alanlar metin olarak tutuluyor, kayitta sayi olabiliyor.
    expect(aralikSayisi('1500')).toBe(1500);
    expect(aralikSayisi(1500)).toBe(1500);
  });

  it('bos degeri null sayiyor', () => {
    expect(aralikSayisi('')).toBeNull();
    expect(aralikSayisi('   ')).toBeNull();
    expect(aralikSayisi(null)).toBeNull();
    expect(aralikSayisi(undefined)).toBeNull();
  });

  it('SIFIRI bos saymiyor', () => {
    // 0 gecerli bir alt sinir; bosla karistirmak "her yatirim" kuralini
    // eksik gosterirdi.
    expect(aralikSayisi(0)).toBe(0);
    expect(aralikSayisi('0')).toBe(0);
  });

  it('sayi olmayani null yapiyor', () => {
    expect(aralikSayisi('abc')).toBeNull();
  });
});

describe('aralikOzeti', () => {
  it('kapali araligi okunur yaziyor', () => {
    const o = aralikOzeti({ min: 1000, max: 4999, partnerBonusId: '1952' });
    expect(o.durum).toBe('tamam');
    expect(o.metin).toBe('1.000 – 4.999 ₺ yatırımda → 1952');
  });

  it('bos ust sinir "ve uzeri" demek', () => {
    // Bos kutu bir eksiklik degil; boyle yazilmazsa operatör unutulmus
    // saniyordu.
    const o = aralikOzeti({ min: 5000, max: '', partnerBonusId: '1953' });
    expect(o.durum).toBe('tamam');
    expect(o.metin).toBe('5.000 ₺ ve üzeri yatırımda → 1953');
  });

  it('sifir alt sinirli kademe gecerli', () => {
    expect(aralikOzeti({ min: 0, max: 999, partnerBonusId: '1' }).durum).toBe('tamam');
  });

  it('eksik alanlari bildiriyor', () => {
    expect(aralikOzeti({ min: '', max: 100, partnerBonusId: '1' }).durum).toBe('eksik');
    expect(aralikOzeti({ min: 100, max: 200, partnerBonusId: '' }).durum).toBe('eksik');
    expect(aralikOzeti({}).durum).toBe('eksik');
  });

  it('ters araligi GECERSIZ isaretliyor', () => {
    // Kaydederken sunucu zaten reddediyor; hatayi kaydetmeden once
    // gostermek arada kalan turu ortadan kaldiriyor.
    const o = aralikOzeti({ min: 500, max: 100, partnerBonusId: '1' });
    expect(o.durum).toBe('gecersiz');
    expect(o.metin).toMatch(/küçük olamaz/);
  });

  it('min ile max esit olabilir', () => {
    expect(aralikOzeti({ min: 100, max: 100, partnerBonusId: '1' }).durum).toBe('tamam');
  });

  it('bonus ID bosluklari kirpiliyor', () => {
    expect(aralikOzeti({ min: 1, max: 2, partnerBonusId: '  ' }).durum).toBe('eksik');
    expect(aralikOzeti({ min: 1, max: 2, partnerBonusId: ' 77 ' }).metin).toMatch(/→ 77$/);
  });
});
