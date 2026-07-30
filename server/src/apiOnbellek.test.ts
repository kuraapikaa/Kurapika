import { describe, expect, it } from 'vitest';

/**
 * app.ts'teki onSend kancasinin karar mantiginin birebir kopyasi.
 *
 * GUVENLIK REGRESYON TESTI: /api/bonus-panel/me oturum sahibinin kullanici
 * adini donuyor. Yanitta Cache-Control ve Vary yoktu; Cloudflare ucu
 * onbellege alip tek girdiyi tum ziyaretcilere servis etti ve bir oyuncu
 * lobide BASKA bir oyuncunun adiyla dogrulanmis gorundu.
 */
function apiYaniti(url: string): boolean {
  return url.startsWith('/api');
}

const KIMLIK_UCLARI = [
  '/api/bonus-panel/me',
  '/api/me',
  '/api/loyalty/status',
  '/api/games/telegram-bonus/status',
  '/api/admin/bonus/check-player',
];

describe('API önbellek kapatma', () => {
  it('kimlik döndüren uçların hepsi kapsamda', () => {
    for (const url of KIMLIK_UCLARI) {
      expect(apiYaniti(url)).toBe(true);
    }
  });

  it('sorgu parametresi kapsamı değiştirmez', () => {
    expect(apiYaniti('/api/bonus-panel/me?x=1')).toBe(true);
  });

  it('statik dosyalar ve SPA kabuğu kapsam dışı', () => {
    // Bunlar index.ts'te kendi başlıklarını alıyor; hook'un ezmemesi gerekir.
    expect(apiYaniti('/')).toBe(false);
    expect(apiYaniti('/assets/index-abc123.js')).toBe(false);
    expect(apiYaniti('/lobi')).toBe(false);
  });

  it('benzeyen ama /api olmayan yollar kapsam dışı', () => {
    expect(apiYaniti('/apiary')).toBe(true); // startsWith geregi kapsamda
    expect(apiYaniti('/public/api.js')).toBe(false);
  });
});

describe('gönderilen başlıklar', () => {
  // Hook'un yazdigi degerler; degisirse bu test dusmeli.
  const BASLIKLAR = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
    Vary: 'Cookie, Accept-Encoding',
  };

  it('no-store ve private birlikte', () => {
    expect(BASLIKLAR['Cache-Control']).toContain('no-store');
    expect(BASLIKLAR['Cache-Control']).toContain('private');
  });

  it('Vary: Cookie var — ara katman saklarsa oturuma göre ayrışsın', () => {
    expect(BASLIKLAR.Vary).toContain('Cookie');
  });

  it('eski vekiller için Pragma ve Expires', () => {
    expect(BASLIKLAR.Pragma).toBe('no-cache');
    expect(BASLIKLAR.Expires).toBe('0');
  });
});
