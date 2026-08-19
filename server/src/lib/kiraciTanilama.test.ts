import { describe, expect, it } from 'vitest';
import { kiraciTanilamasi } from './kiraciTanilama.js';

/**
 * "Bonus kurallari tenant basina olacak."
 *
 * Kurallar zaten kiraci basina saklaniyor; ayrismamalarinin sebebi
 * `tenants` kaydinin BOS olmasiydi. Kayit yoksa Host hicbir seye
 * eslesmiyor, her istek yedek anahtara dusuyor ve butun siteler ayni
 * kurallari paylasiyor. Hicbir uyari uretilmiyordu.
 */
describe('kiraciTanilamasi', () => {
  it('site YOKSA uyarir — cok kiracililik fiilen kapali', () => {
    const t = kiraciTanilamasi([], 'default');
    expect(t.siteSayisi).toBe(0);
    expect(t.uyari).toMatch(/Tanımlı site YOK/);
    expect(t.uyari).toContain('default');
  });

  it('null/undefined girdiyi bos sayar', () => {
    expect(kiraciTanilamasi(null, 'default').siteSayisi).toBe(0);
    expect(kiraciTanilamasi(undefined, 'default').uyari).not.toBeNull();
  });

  it('site var ama hicbiri aktif degilse uyarir', () => {
    const t = kiraciTanilamasi([{ id: 'a', domain: 'a.com', isActive: false }], 'default');
    expect(t.aktifSite).toBe(0);
    expect(t.uyari).toMatch(/hiçbiri aktif değil/);
  });

  it('aktif site var ama alan adi yoksa uyarir — Host eslesemez', () => {
    const t = kiraciTanilamasi([{ id: 'a' }], 'default');
    expect(t.uyari).toMatch(/alan adı tanımlı değil/);
  });

  it('saglikli kurulumda uyari YOK', () => {
    const t = kiraciTanilamasi(
      [{ id: 'a', domain: 'a.com' }, { id: 'b', domain: 'b.com', isActive: true }],
      'default',
    );
    expect(t.siteSayisi).toBe(2);
    expect(t.aktifSite).toBe(2);
    expect(t.uyari).toBeNull();
  });

  it('isActive belirtilmemis site AKTIF sayilir', () => {
    // `isActive !== false` kurali; tenant.ts ile ayni.
    expect(kiraciTanilamasi([{ id: 'a', domain: 'a.com' }], 'default').aktifSite).toBe(1);
  });

  it('yedek anahtar ciktida yer alir', () => {
    expect(kiraciTanilamasi([], 'narcos').yedekAnahtar).toBe('narcos');
  });
});
