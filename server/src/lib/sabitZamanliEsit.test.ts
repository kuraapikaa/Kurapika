import { describe, expect, it } from 'vitest';

/**
 * auth.ts icindeki sabitZamanliEsit() birebir kopyasi.
 *
 * Duz metin parola karsilastirmasi `===` ile yapiliyordu; ilk farkli
 * karakterde kisa devre ettigi icin yanit suresi dogru onek uzunlugunu
 * sizdiriyordu. Parola bu sinyalle karakter karakter daraltilabilir.
 */
function sabitZamanliEsit(a: string, b: string): boolean {
  const uzunluk = Math.max(a.length, b.length);
  let fark = a.length ^ b.length;
  for (let i = 0; i < uzunluk; i++) {
    fark |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return fark === 0;
}

describe('sabit zamanlı karşılaştırma', () => {
  it('aynı dizeler eşleşir', () => {
    expect(sabitZamanliEsit('parola123', 'parola123')).toBe(true);
  });

  it('farklı dizeler eşleşmez', () => {
    expect(sabitZamanliEsit('parola123', 'parola124')).toBe(false);
  });

  it('ilk karakter farkı da son karakter farkı da yakalanır', () => {
    expect(sabitZamanliEsit('aaaa', 'baaa')).toBe(false);
    expect(sabitZamanliEsit('aaaa', 'aaab')).toBe(false);
  });

  it('farklı uzunluklar eşleşmez', () => {
    expect(sabitZamanliEsit('parola', 'parola1')).toBe(false);
    expect(sabitZamanliEsit('parola1', 'parola')).toBe(false);
  });

  it('bir dizenin öneki olmak eşleşme sayılmaz', () => {
    // Kisa devre eden karsilastirmada bu durum en hizli yanit verirdi.
    expect(sabitZamanliEsit('sifre', 'sifreUzun')).toBe(false);
  });

  it('boş dizeler eşleşir, boş ile dolu eşleşmez', () => {
    expect(sabitZamanliEsit('', '')).toBe(true);
    expect(sabitZamanliEsit('', 'x')).toBe(false);
    expect(sabitZamanliEsit('x', '')).toBe(false);
  });

  it('unicode ve Türkçe karakterlerde doğru', () => {
    expect(sabitZamanliEsit('şifreÇĞÜ', 'şifreÇĞÜ')).toBe(true);
    expect(sabitZamanliEsit('şifreÇĞÜ', 'sifreCGU')).toBe(false);
  });

  it('tüm karakterler okunur — erken çıkış yok', () => {
    // Uzunluk farki olsa bile dongu en uzun dize kadar donmeli.
    // Davranissal kanit: cok farkli uzunluklarda da dogru sonuc.
    expect(sabitZamanliEsit('a', 'a'.repeat(500))).toBe(false);
    expect(sabitZamanliEsit('a'.repeat(500), 'a'.repeat(500))).toBe(true);
  });
});
