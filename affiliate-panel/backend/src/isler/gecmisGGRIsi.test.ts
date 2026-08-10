import { randomUUID } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { gecmisGGRTazele } from './gecmisGGRIsi.js';
import { baglantiyiYaz } from '../adaptorler/kayit.js';

/**
 * Bu, geçmiş GGR/finans tazelemesini artık ADMİN'İN ELLE BASMASINI
 * BEKLEMEDEN her gece otomatik çalıştıran işin testi (bkz. dosyanın
 * kendi üst yorumu). Gerçek bir Lynon ağ çağrısı gerektirmeyen iki
 * dalı sınıyor: hiç bağlantı yokken sessiz kalması, ve `oyuncuGunuCek`
 * desteklemeyen bir bağlantıyı (örn. genelRest) ağ çağrısı YAPMADAN
 * atlaması. Lynon'un gerçek uçlarına giden dal zaten `gecmisGGR.test.ts`'te
 * (`gecmisGGRDoldur`, sahte adaptörle) kapsanıyor -- burada tekrar
 * etmiyoruz.
 */
const kiraci = () => `test-ggr-isi-${randomUUID().slice(0, 8)}`;

function sahteGunlukcu() {
  return { warn: vi.fn() };
}

describe('gecmisGGRTazele', () => {
  it('hic aktif baglanti yoksa hicbir sey yapmaz, uyari yazmaz', async () => {
    const gunlukcu = sahteGunlukcu();
    await gecmisGGRTazele(kiraci(), gunlukcu);
    expect(gunlukcu.warn).not.toHaveBeenCalled();
  });

  it('gecmis-doldurma desteklemeyen bir baglantiyi (genelRest) sessizce atlar', async () => {
    const k = kiraci();
    await baglantiyiYaz(k, null, {
      ad: 'Test REST',
      adaptor: 'genel-rest',
      ayar: { temelUrl: 'https://ornek.test', raporYolu: '/rapor?from={start}&to={end}' },
      aktif: true,
    });

    const gunlukcu = sahteGunlukcu();
    await expect(gecmisGGRTazele(k, gunlukcu)).resolves.toBeUndefined();
    expect(gunlukcu.warn).not.toHaveBeenCalled();
  });

  it('pasif baglantiyi hic taramaz', async () => {
    const k = kiraci();
    await baglantiyiYaz(k, null, {
      ad: 'Pasif REST',
      adaptor: 'genel-rest',
      ayar: { temelUrl: 'https://ornek.test', raporYolu: '/rapor?from={start}&to={end}' },
      aktif: false,
    });

    const gunlukcu = sahteGunlukcu();
    await gecmisGGRTazele(k, gunlukcu);
    expect(gunlukcu.warn).not.toHaveBeenCalled();
  });
});
