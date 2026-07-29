import { describe, expect, it } from 'vitest';
import { originIzinliMi } from './useParentUsername';

describe('ana site origin izni', () => {
  it('yayındaki .vip alan adını kabul eder', () => {
    expect(originIzinliMi('https://narcosbahis.vip')).toBe(true);
    expect(originIzinliMi('https://www.narcosbahis.vip')).toBe(true);
  });

  it('numaralı yansı alan adlarını kabul eder', () => {
    expect(originIzinliMi('https://narcosbahis481.com')).toBe(true);
    expect(originIzinliMi('https://narcosbahis12.vip')).toBe(true);
    expect(originIzinliMi('https://tacobahis7.com')).toBe(true);
  });

  it('yalnızca https kabul eder', () => {
    expect(originIzinliMi('http://narcosbahis.vip')).toBe(false);
  });

  it('benzeyen yabancı alan adlarını reddeder', () => {
    expect(originIzinliMi('https://narcosbahis.vip.evil.com')).toBe(false);
    expect(originIzinliMi('https://narcosbahis-vip.com')).toBe(false);
    expect(originIzinliMi('https://evil.com')).toBe(false);
  });
});
