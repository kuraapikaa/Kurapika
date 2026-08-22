import { describe, expect, it } from 'vitest';
import {
  haneler,
  satirTelefonlari,
  telefonAnahtari,
  telefonEslesiyorMu,
  telefonlaBul,
  telefonMu,
} from './telefonEslesme.js';

describe('telefonMu', () => {
  it('yaygın yazımların hepsini telefon sayar', () => {
    for (const numara of ['0555 123 45 67', '+90 555 123 45 67', '905551234567', '5551234567', '0555-123-45-67']) {
      expect(telefonMu(numara)).toBe(true);
    }
  });

  it('kullanıcı adlarını telefon SAYMAZ', () => {
    // Kural dar tutuldu: yanlis tahmin yanlis oyuncuyu sorgulamak demek.
    for (const ad of ['test777', 'bosdag', 'halil4554', 'explode33', '0532abc', 'user_123456789']) {
      expect(telefonMu(ad)).toBe(false);
    }
  });

  it('Türkçe harf içeren ad telefon sayılmaz', () => {
    expect(telefonMu('şahin1234567890')).toBe(false);
  });

  it('10 haneden kısa sayı telefon sayılmaz', () => {
    // "123456789" bir kullanici adi olabilir; telefon sanip yanlis
    // kisiyi getirmektense kullanici adi olarak aramak dogru.
    expect(telefonMu('123456789')).toBe(false);
    expect(telefonMu('777')).toBe(false);
  });

  it('boş girdi telefon değil', () => {
    expect(telefonMu('')).toBe(false);
    expect(telefonMu(null)).toBe(false);
  });
});

describe('telefonAnahtari', () => {
  it('aynı numaranın tüm yazımları AYNI anahtarı verir', () => {
    const beklenen = '5551234567';
    for (const numara of ['0555 123 45 67', '+90 555 123 45 67', '905551234567', '5551234567']) {
      expect(telefonAnahtari(numara)).toBe(beklenen);
    }
  });

  it('10 haneden kısa numarada elde ne varsa o', () => {
    // Kirpmak farkli numaralari esitlerdi.
    expect(telefonAnahtari('2123456')).toBe('2123456');
  });
});

describe('telefonEslesiyorMu', () => {
  it('farklı yazımlar eşleşir', () => {
    expect(telefonEslesiyorMu('+90 555 123 45 67', '05551234567')).toBe(true);
  });

  it('farklı numaralar eşleşmez', () => {
    expect(telefonEslesiyorMu('05551234567', '05551234568')).toBe(false);
  });

  it('boş anahtar hiçbir şeyle eşleşmez', () => {
    // Aksi halde telefonu olmayan her oyuncu her aramaya cevap verirdi.
    expect(telefonEslesiyorMu('', '05551234567')).toBe(false);
    expect(telefonEslesiyorMu('05551234567', '')).toBe(false);
    expect(telefonEslesiyorMu('', '')).toBe(false);
  });
});

describe('satirTelefonlari', () => {
  it('farklı alan adlarını toplar', () => {
    expect(satirTelefonlari({ Phone: '0555', MobilePhone: '0532', phoneNumber: '', mobile: null }))
      .toEqual(['0555', '0532']);
  });
});

describe('telefonlaBul', () => {
  const oyuncular = [
    { Login: 'ali', Phone: '+90 555 123 45 67' },
    { Login: 'veli', MobilePhone: '0532 999 88 77' },
    { Login: 'ayse', Phone: '' },
  ];

  it('numarası eşleşen oyuncuyu bulur', () => {
    const s = telefonlaBul(oyuncular, '05551234567');
    expect(s.durum).toBe('bulundu');
    expect(s.durum === 'bulundu' && s.oyuncu.Login).toBe('ali');
  });

  it('MobilePhone alanından da bulur', () => {
    const s = telefonlaBul(oyuncular, '+905329998877');
    expect(s.durum === 'bulundu' && s.oyuncu.Login).toBe('veli');
  });

  it('eşleşme yoksa "yok"', () => {
    expect(telefonlaBul(oyuncular, '05000000000').durum).toBe('yok');
  });

  it('birden fazla eşleşmede "coklu" — rastgele seçmez', () => {
    // Ayni numarayi paylasan iki hesaptan hangisinin kastedildigi
    // bilinemez; rastgele birini secip rapora koymak sessizce yanlis
    // oyuncunun parasini gostermek olurdu.
    const s = telefonlaBul([
      { Login: 'a', Phone: '05551234567' },
      { Login: 'b', MobilePhone: '+90 555 123 45 67' },
    ], '5551234567');
    expect(s.durum).toBe('coklu');
    expect(s.durum === 'coklu' && s.adaylar).toHaveLength(2);
  });

  it('boş liste ve boş aramada çökmez', () => {
    expect(telefonlaBul([], '05551234567').durum).toBe('yok');
    expect(telefonlaBul(null, '05551234567').durum).toBe('yok');
    expect(telefonlaBul(oyuncular, '').durum).toBe('yok');
  });
});

describe('haneler', () => {
  it('rakam dışını atar', () => {
    expect(haneler('+90 (555) 123-45-67')).toBe('905551234567');
    expect(haneler('abc')).toBe('');
  });
});
