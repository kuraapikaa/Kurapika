import { describe, expect, it } from 'vitest';
import { spaKabuguDonsunMu } from './spaKabugu.js';

/**
 * Bu testlerin varlik sebebi uretim logunda gorulen bir davranis:
 * sunucu `/.env` ve `/.git/config` gibi yollara 200 donuyordu ve
 * tarayicilar bunu "burada bir sey var" diye okuyup taramayi
 * derinlestiriyordu.
 */
describe('SPA kabugu yonlendirmesi', () => {
  describe('kabuk DONMELI', () => {
    it('kok adres', () => {
      expect(spaKabuguDonsunMu('/')).toBe(true);
      expect(spaKabuguDonsunMu('')).toBe(true);
    });

    it('uzantisiz uygulama rotalari', () => {
      ['/panel', '/ortak-paneli', '/admin/ayarlar', '/a/b/c'].forEach((y) => {
        expect(spaKabuguDonsunMu(y), y).toBe(true);
      });
    });

    /** Hash rotalari sunucuya `/` olarak gelir ama sorgu takili olabilir. */
    it('sorgu dizesi kabugu engellemez', () => {
      expect(spaKabuguDonsunMu('/?utm=x')).toBe(true);
      expect(spaKabuguDonsunMu('/panel?sekme=2')).toBe(true);
    });
  });

  describe('404 DONMELI', () => {
    it('nokta ile baslayan yollar', () => {
      ['/.env', '/.git/config', '/.npmrc', '/.bash_history', '/.vscode/sftp.json', '/.aws/credentials']
        .forEach((y) => expect(spaKabuguDonsunMu(y), y).toBe(false));
    });

    it('ara dizini gizli olan yollar', () => {
      expect(spaKabuguDonsunMu('/public/.git/HEAD')).toBe(false);
    });

    it('diskte bulunamayan uzantili dosyalar', () => {
      ['/x.json', '/db.sql', '/yedek.zip', '/config.yml', '/zzcanary-74a0.json', '/sitemap.xml']
        .forEach((y) => expect(spaKabuguDonsunMu(y), y).toBe(false));
    });

    /** Uzantili yol sorgu takiliyken de dosya istegidir. */
    it('sorgu dizesi uzantiyi gizlemez', () => {
      expect(spaKabuguDonsunMu('/x.json?v=2')).toBe(false);
    });
  });

  /**
   * Uzanti sezgisi fazla hevesli olmamali: surum numarasi iceren bir
   * rotayi dosya sanip 404 donmek, calisan bir baglantiyi kirardi.
   */
  it('surum benzeri parcalari dosya sanmaz', () => {
    expect(spaKabuguDonsunMu('/api-v1.2')).toBe(true);
    expect(spaKabuguDonsunMu('/rapor.2026')).toBe(true);
  });

  it('bozuk girdiyi kabukla karsilar', () => {
    expect(spaKabuguDonsunMu(undefined as unknown as string)).toBe(true);
  });
});
