import { afterEach, describe, expect, it } from 'vitest';
import { parseSessionCookieSecure, parseSessionSameSite } from './app.js';

const ESKI_SAMESITE = process.env.SESSION_COOKIE_SAMESITE;
const ESKI_SECURE = process.env.SESSION_COOKIE_SECURE;

function ayarla(sameSite?: string, secure?: string) {
  if (sameSite === undefined) delete process.env.SESSION_COOKIE_SAMESITE;
  else process.env.SESSION_COOKIE_SAMESITE = sameSite;
  if (secure === undefined) delete process.env.SESSION_COOKIE_SECURE;
  else process.env.SESSION_COOKIE_SECURE = secure;
}

afterEach(() => {
  ayarla(ESKI_SAMESITE, ESKI_SECURE);
});

describe('oturum çerezi SameSite ayarı', () => {
  it('gömme kapalıyken varsayılan lax', () => {
    ayarla(undefined, undefined);
    expect(parseSessionSameSite(false)).toBe('lax');
  });

  it('gömme açıkken varsayılan none — iframe içinde lax çerez hiç gönderilmez', () => {
    ayarla(undefined, undefined);
    expect(parseSessionSameSite(true)).toBe('none');
  });

  it('ENV değeri gömme açıkken de varsayılanı ezer', () => {
    ayarla('lax', undefined);
    expect(parseSessionSameSite(true)).toBe('lax');
  });

  it('geçersiz ENV değeri yok sayılır ve varsayılana düşer', () => {
    ayarla('saçma', undefined);
    expect(parseSessionSameSite(true)).toBe('none');
    expect(parseSessionSameSite(false)).toBe('lax');
  });
});

describe('oturum çerezi Secure ayarı', () => {
  it('gömme kapalıyken varsayılan auto', () => {
    ayarla(undefined, undefined);
    expect(parseSessionCookieSecure(false)).toBe('auto');
  });

  it('gömme açıkken zorunlu true — SameSite=None Secure olmadan reddedilir', () => {
    ayarla(undefined, undefined);
    expect(parseSessionCookieSecure(true)).toBe(true);
  });

  it('ENV açıkça false derse ona uyulur', () => {
    ayarla(undefined, 'false');
    expect(parseSessionCookieSecure(true)).toBe(false);
  });
});
