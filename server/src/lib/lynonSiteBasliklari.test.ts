import { afterEach, describe, expect, it } from 'vitest';
import { siteHeaders } from './lynonAuth.js';
import { config } from '../config.js';

const ONCEKI = process.env.LYNON_TIMEZONE_OFFSET;

afterEach(() => {
  if (ONCEKI === undefined) delete process.env.LYNON_TIMEZONE_OFFSET;
  else process.env.LYNON_TIMEZONE_OFFSET = ONCEKI;
});

/**
 * Bu baslikları Lynon backoffice arayuzu her istekte gonderiyor; panel
 * ikisini de hic gondermiyordu. `sl-timezone` eksikligi tarih-only
 * pencerelerin UTC sayilmasina, yani gunun ilk uc saatinin rapordan
 * dusmesine yol aciyordu.
 */
describe('Lynon site başlıkları', () => {
  it('sl-timezone arayüzle aynı: -3', () => {
    expect(siteHeaders()['sl-timezone']).toBe('-3');
  });

  it('sl-id yapılandırılmış site kimliği', () => {
    expect(siteHeaders()['sl-id']).toBe(String(config.lynon.siteId));
  });

  it('başlık değerleri metin — fetch sayısal başlık kabul etmez', () => {
    for (const deger of Object.values(siteHeaders())) {
      expect(typeof deger).toBe('string');
    }
  });

  it('başka dilimdeki bir site için ezilebilir', () => {
    process.env.LYNON_TIMEZONE_OFFSET = '-5';
    expect(siteHeaders()['sl-timezone']).toBe('-5');
  });

  it('bozuk override sessizce yutulmaz, varsayılana döner', () => {
    process.env.LYNON_TIMEZONE_OFFSET = 'bozuk';
    expect(siteHeaders()['sl-timezone']).toBe('-3');
  });

  it('boş override varsayılanı ezmez', () => {
    process.env.LYNON_TIMEZONE_OFFSET = '';
    expect(siteHeaders()['sl-timezone']).toBe('-3');
  });
});
