import { beforeEach, describe, expect, it } from 'vitest';
import { jetonCoz, jetonUret } from './oturum.js';

beforeEach(() => {
  process.env.AFF_SESSION_SECRET = 'test-imza-anahtari-yeterince-uzun';
});

const yonetici = { rol: 'yonetici' as const, kiraci: 'ornek', ad: 'admin' };

describe('oturum jetonu', () => {
  it('uretip geri cozer', () => {
    const veri = jetonCoz(jetonUret(yonetici));
    expect(veri?.rol).toBe('yonetici');
    expect(veri?.kiraci).toBe('ornek');
  });

  /**
   * Imza olmasaydi herkes govdeyi degistirip kendini yonetici ilan
   * edebilirdi. Bu test o kapinin kapali oldugunu gosteriyor.
   */
  it('govdesi degistirilmis jetonu reddeder', () => {
    const jeton = jetonUret({ rol: 'ortak', kiraci: 'ornek', ortakAnahtari: 'ORT1', ad: 'Ortak' });
    const [govde, imza] = jeton.split('.');
    const cozulmus = JSON.parse(Buffer.from(govde, 'base64url').toString('utf8'));
    cozulmus.rol = 'yonetici';
    const sahte = `${Buffer.from(JSON.stringify(cozulmus)).toString('base64url')}.${imza}`;
    expect(jetonCoz(sahte)).toBeNull();
  });

  it('baska anahtarla imzalanmis jetonu reddeder', () => {
    const jeton = jetonUret(yonetici);
    process.env.AFF_SESSION_SECRET = 'bambaska-bir-imza-anahtari-uzun';
    expect(jetonCoz(jeton)).toBeNull();
  });

  it('suresi dolmus jetonu reddeder', () => {
    const jeton = jetonUret(yonetici, Date.now() - 48 * 60 * 60 * 1000);
    expect(jetonCoz(jeton)).toBeNull();
  });

  it('bozuk girdiyi reddeder', () => {
    expect(jetonCoz('')).toBeNull();
    expect(jetonCoz('abc')).toBeNull();
    expect(jetonCoz(undefined)).toBeNull();
  });

  /** Kisa/eksik imza anahtari acilista patlamali, sessizce gecmemeli. */
  it('zayif imza anahtarinda hata verir', () => {
    process.env.AFF_SESSION_SECRET = 'kisa';
    expect(() => jetonUret(yonetici)).toThrow(/16/);
  });
});
