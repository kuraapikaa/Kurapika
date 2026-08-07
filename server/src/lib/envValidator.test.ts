import { afterEach, describe, it, expect } from 'vitest';
import { validateEnvironment } from '../lib/envValidator.js';

describe('envValidator', () => {
  it('should return warnings when SESSION_SECRET is not set', () => {
    const original = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;

    const result = validateEnvironment();
    expect(result.warnings.some(w => w.includes('SESSION_SECRET'))).toBe(true);

    // Restore
    if (original) process.env.SESSION_SECRET = original;
  });

  it('should return no errors when AUTH_TOKEN is set', () => {
    const original = process.env.AUTH_TOKEN;
    process.env.AUTH_TOKEN = 'test-token-for-validation';

    const result = validateEnvironment();
    expect(result.errors.some(e => e.includes('AUTH_TOKEN'))).toBe(false);

    // Restore
    if (original) process.env.AUTH_TOKEN = original;
    else delete process.env.AUTH_TOKEN;
  });

  it('should validate PORT format', () => {
    const original = process.env.PORT;
    process.env.PORT = 'not-a-port';

    const result = validateEnvironment();
    expect(result.warnings.some(w => w.includes('PORT'))).toBe(true);

    // Restore
    if (original) process.env.PORT = original;
    else delete process.env.PORT;
  });

  /**
   * PRODUCTION DEPO KONTROLU.
   *
   * Bu blogun varlik sebebi olculdu: Railway'de DATABASE_URL bos
   * stringken env-check "Tum ortam degiskenleri dogrulandi" yaziyor,
   * hemen ardindan initializeDatabase yakalanmamis hata firlatiyordu.
   * Dogrulayicinin varlik sebebi tam olarak bu durumu onlemekti.
   */
  describe('production depo degiskenleri', () => {
    const YEDEK = { ...process.env };

    const uretimOrtami = (ek: Record<string, string> = {}) => {
      process.env.NODE_ENV = 'production';
      process.env.SESSION_SECRET = 'x'.repeat(64);
      process.env.MASTER_USER = 'master';
      process.env.MASTER_PASS = 'parola';
      process.env.CORS_ORIGIN = 'https://ornek.test';
      process.env.DATABASE_URL = 'postgres://kullanici@sunucu:5432/db';
      process.env.REDIS_URL = 'redis://sunucu:6379';
      delete process.env.DATABASE_REQUIRED;
      delete process.env.REDIS_REQUIRED;
      delete process.env.PANEL_AUTH_DISABLED;
      Object.assign(process.env, ek);
    };

    afterEach(() => {
      // Bu testler process.env'i degistiriyor; sizdirmak diger test
      // dosyalarini ortamdan etkiler hale getirir.
      for (const anahtar of Object.keys(process.env)) {
        if (!(anahtar in YEDEK)) delete process.env[anahtar];
      }
      Object.assign(process.env, YEDEK);
    });

    it('DATABASE_URL yoksa production hatasi verir', () => {
      uretimOrtami();
      delete process.env.DATABASE_URL;
      expect(validateEnvironment().errors.some(e => e.includes('DATABASE_URL'))).toBe(true);
    });

    /** Railway'de gorulen gercek durum: degisken TANIMLI ama bos. */
    it('DATABASE_URL bos string ise de hata verir', () => {
      uretimOrtami({ DATABASE_URL: '' });
      expect(validateEnvironment().errors.some(e => e.includes('DATABASE_URL'))).toBe(true);
    });

    it('sadece bosluk iceren deger de kabul edilmez', () => {
      uretimOrtami({ DATABASE_URL: '   ' });
      expect(validateEnvironment().errors.some(e => e.includes('DATABASE_URL'))).toBe(true);
    });

    it('REDIS_URL yoksa production hatasi verir', () => {
      uretimOrtami();
      delete process.env.REDIS_URL;
      expect(validateEnvironment().errors.some(e => e.includes('REDIS_URL'))).toBe(true);
    });

    /** Esik `database.ts`/`redisClient.ts` ile ayni olmali. */
    it('DATABASE_REQUIRED=false ise zorunlu saymaz', () => {
      uretimOrtami({ DATABASE_REQUIRED: 'false', DATABASE_URL: '' });
      expect(validateEnvironment().errors.some(e => e.includes('DATABASE_URL'))).toBe(false);
    });

    it('ikisi de tanimliysa depo hatasi uretmez', () => {
      uretimOrtami();
      const hatalar = validateEnvironment().errors;
      expect(hatalar.some(e => e.includes('DATABASE_URL'))).toBe(false);
      expect(hatalar.some(e => e.includes('REDIS_URL'))).toBe(false);
    });

    it('development ortaminda zorunlu degil', () => {
      uretimOrtami({ NODE_ENV: 'development', DATABASE_URL: '', REDIS_URL: '' });
      const hatalar = validateEnvironment().errors;
      expect(hatalar.some(e => e.includes('DATABASE_URL'))).toBe(false);
      expect(hatalar.some(e => e.includes('REDIS_URL'))).toBe(false);
    });
  });
});
