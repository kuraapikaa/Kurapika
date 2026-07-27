import { describe, expect, it } from 'vitest';
import { parsePromoContent } from './promosParser.js';

const maxOf = (metin: string) =>
  (parsePromoContent(1, 'T', `<p>${metin}</p>`) as any).maxBonus;
const minOf = (metin: string) =>
  (parsePromoContent(1, 'T', `<p>${metin}</p>`) as any).minDeposit;

/**
 * Eski desen sayının hep binlik ayraçlı yazıldığını varsayıyordu; \d{1,3}
 * açgözlü olduğu için ayraçsız yazımda son hane(ler) düşüyordu.
 */
describe('promosParser para ayrıştırma', () => {
  it('ayraçsız 4+ haneli tutarları tam okur', () => {
    expect(maxOf('Maksimum bonus 5000 ₺')).toBe(5000);   // eskiden 500
    expect(maxOf('Maksimum bonus 10000 ₺')).toBe(10000); // eskiden 100
    expect(maxOf('Maksimum tutar 2500 ₺')).toBe(2500);   // eskiden 250
  });

  it('boşluksuz para simgesiyle de çalışır', () => {
    expect(maxOf('Maksimum bonus 5000₺')).toBe(5000);
  });

  it('binlik ayraçlı yazımı korur (regresyon)', () => {
    expect(maxOf('Maksimum bonus 1.500 ₺')).toBe(1500);
    expect(maxOf('Maksimum bonus 10.000 ₺')).toBe(10000);
  });

  it('ondalık kısmı doğru ayırır', () => {
    expect(maxOf('Maksimum bonus 1.234,56 ₺')).toBe(1234.56);
    expect(maxOf('Maksimum bonus 5000,50 ₺')).toBe(5000.5);
  });

  it('üç haneli tutarlar bozulmadı (regresyon)', () => {
    expect(maxOf('Maksimum bonus 500 ₺')).toBe(500);
    expect(maxOf('Maksimum bonus 250 ₺')).toBe(250);
  });

  it('minimum yatırım da aynı ayrıştırıcıyı kullanır', () => {
    expect(minOf('minimum yatırım 2500 ₺')).toBe(2500);
    expect(minOf('minimum yatırım 1.000 ₺')).toBe(1000);
  });
});
