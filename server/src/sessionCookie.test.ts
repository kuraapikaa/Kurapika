import { afterEach, describe, expect, it } from 'vitest';
import { parseSessionCookieSecure, parseSessionPartitioned, parseSessionSameSite } from './app.js';

const ESKI_SAMESITE = process.env.SESSION_COOKIE_SAMESITE;
const ESKI_SECURE = process.env.SESSION_COOKIE_SECURE;
const ESKI_PARTITIONED = process.env.SESSION_COOKIE_PARTITIONED;

function ayarla(sameSite?: string, secure?: string, partitioned?: string) {
  if (sameSite === undefined) delete process.env.SESSION_COOKIE_SAMESITE;
  else process.env.SESSION_COOKIE_SAMESITE = sameSite;
  if (secure === undefined) delete process.env.SESSION_COOKIE_SECURE;
  else process.env.SESSION_COOKIE_SECURE = secure;
  if (partitioned === undefined) delete process.env.SESSION_COOKIE_PARTITIONED;
  else process.env.SESSION_COOKIE_PARTITIONED = partitioned;
}

afterEach(() => {
  ayarla(ESKI_SAMESITE, ESKI_SECURE, ESKI_PARTITIONED);
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

describe('oturum çerezi Partitioned (CHIPS) ayarı', () => {
  it('gömme açıkken varsayılan olarak açılır', () => {
    ayarla(undefined, undefined, undefined);
    const sameSite = parseSessionSameSite(true);
    const secure = parseSessionCookieSecure(true);
    expect(parseSessionPartitioned(sameSite, secure)).toBe(true);
  });

  it('gömme kapalıyken kapalı kalır — lax çerezde anlamsız', () => {
    ayarla(undefined, undefined, undefined);
    const sameSite = parseSessionSameSite(false);
    const secure = parseSessionCookieSecure(false);
    expect(parseSessionPartitioned(sameSite, secure)).toBe(false);
  });

  it('SameSite=None olsa da Secure değilse eklenmez — tarayıcı gecersiz sayar', () => {
    expect(parseSessionPartitioned('none', false)).toBe(false);
    expect(parseSessionPartitioned('none', 'auto')).toBe(false);
  });

  it('SameSite lax iken eklenmez', () => {
    expect(parseSessionPartitioned('lax', true)).toBe(false);
  });

  it('ENV ile kapatılabilir', () => {
    ayarla(undefined, undefined, 'false');
    expect(parseSessionPartitioned('none', true)).toBe(false);
  });

  it('ENV ile zorlanabilir', () => {
    ayarla(undefined, undefined, 'true');
    expect(parseSessionPartitioned('lax', false)).toBe(true);
  });
});
