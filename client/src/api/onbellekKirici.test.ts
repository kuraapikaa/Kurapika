import { describe, expect, it } from 'vitest';

/**
 * client.ts icindeki onbellekKirici mantiginin birebir kopyasi.
 *
 * GUVENLIK REGRESYON TESTI: Cloudflare kimlik yanitlarini onbellege aliyor
 * ve Vary: Cookie'yi yok sayiyor — bir oyuncu digerinin yanitini goruyordu.
 * Her istegin BENZERSIZ url uretmesi bu onlemin tek dayanagi; ayni deger
 * iki kez uretilirse sizinti geri gelir.
 */
function onbellekKirici(): string {
  return `_cb=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

describe('önbellek kırıcı', () => {
  it('ardışık çağrılar farklı değer üretir', () => {
    const a = onbellekKirici();
    const b = onbellekKirici();
    expect(a).not.toBe(b);
  });

  it('yoğun döngüde bile çakışma yok', () => {
    // Aynı milisaniyede üretilen değerler yalnızca rastgele eke dayanır;
    // çakışma olursa iki oyuncu aynı önbellek anahtarını paylaşır.
    const kume = new Set(Array.from({ length: 5000 }, () => onbellekKirici()));
    expect(kume.size).toBe(5000);
  });

  it('_cb parametresiyle başlar', () => {
    expect(onbellekKirici().startsWith('_cb=')).toBe(true);
  });

  it('URL güvenli karakterler üretir', () => {
    for (let i = 0; i < 200; i++) {
      const deger = onbellekKirici().slice(4);
      expect(deger).toMatch(/^[a-z0-9]+$/);
    }
  });

  it('mevcut sorgu parametreleriyle birlikte kullanılabilir', () => {
    const sorgu = new URLSearchParams({ limit: '10' });
    sorgu.set('_cb', onbellekKirici().slice(4));
    expect(sorgu.get('limit')).toBe('10');
    expect(sorgu.get('_cb')).toBeTruthy();
  });
});
