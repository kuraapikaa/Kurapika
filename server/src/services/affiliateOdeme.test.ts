import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Affiliate odeme kayitlari.
 *
 * Hakedis hesaplaniyordu ama "odendi mi" tutulmuyordu; ayni donem iki kez
 * odenebiliyordu. Mukerrer koruma ve tutar sabitlemesi burada kilitleniyor.
 */

const bellek = new Map<string, unknown>();

vi.mock('../lib/documentStore.js', () => ({
  readStoredDocument: async ({ namespace, tenantKey, fallback }: any) => {
    const k = `${tenantKey}:${namespace}`;
    return bellek.has(k) ? bellek.get(k) : fallback();
  },
  writeStoredDocument: async ({ namespace, tenantKey }: any, data: unknown) => {
    bellek.set(`${tenantKey}:${namespace}`, data);
  },
}));

vi.mock('fs', () => ({ default: { mkdirSync: () => undefined }, mkdirSync: () => undefined }));

const {
  AffiliateOdemeHatasi,
  bekleyenToplam,
  cakisanKayit,
  odemeDurumGuncelle,
  odemeKaydet,
  odemeler,
  odenmisToplam,
} = await import('./affiliateOdemeService.js');

const TEMEL = {
  ortakId: 'o1',
  bTag: 'NARCOS01',
  donem: '2026-07',
  donemBaslangic: '2026-07-01',
  donemBitis: '2026-07-31',
  tutar: 12_500,
  netGelir: 50_000,
  aktifOyuncu: 40,
  komisyonModeli: 'revshare',
  revsharePayi: 25,
  cpaTutari: 0,
  olusturan: 'operator1',
};

beforeEach(() => bellek.clear());

describe('mükerrer ödeme koruması', () => {
  it('aynı ortak + aynı dönem ikinci kez kaydedilemez', async () => {
    await odemeKaydet(TEMEL);
    await expect(odemeKaydet(TEMEL)).rejects.toThrow(AffiliateOdemeHatasi);
  });

  it('hata mesajı dönemi ve mevcut durumu söyler', async () => {
    await odemeKaydet(TEMEL);
    await expect(odemeKaydet(TEMEL)).rejects.toThrow(/2026-07.*bekliyor/);
  });

  it('iptal edilmiş kayıt engel değil — yanlış girilen düzeltilebilmeli', async () => {
    const ilk = await odemeKaydet(TEMEL);
    await odemeDurumGuncelle(ilk.id, 'iptal', 'operator1');
    const ikinci = await odemeKaydet({ ...TEMEL, tutar: 9_000 });
    expect(ikinci.tutar).toBe(9_000);
  });

  it('ödenmiş kayıt da engel — iki kez ödeme yapılamaz', async () => {
    const ilk = await odemeKaydet(TEMEL);
    await odemeDurumGuncelle(ilk.id, 'odendi', 'operator1');
    await expect(odemeKaydet(TEMEL)).rejects.toThrow(/zaten kayıtlı/);
  });

  it('farklı dönem serbest', async () => {
    await odemeKaydet(TEMEL);
    await expect(odemeKaydet({ ...TEMEL, donem: '2026-08' })).resolves.toBeTruthy();
  });

  it('farklı ortak aynı dönem serbest', async () => {
    await odemeKaydet(TEMEL);
    await expect(odemeKaydet({ ...TEMEL, ortakId: 'o2' })).resolves.toBeTruthy();
  });
});

describe('tutar ve dayanak sabitlenir', () => {
  it('hesaplama dayanakları kayda yazılır — sonradan denetlenebilsin', async () => {
    const k = await odemeKaydet(TEMEL);
    expect(k).toMatchObject({
      tutar: 12_500, netGelir: 50_000, aktifOyuncu: 40,
      komisyonModeli: 'revshare', revsharePayi: 25,
    });
  });

  it('yeni kayıt "bekliyor" başlar', async () => {
    expect((await odemeKaydet(TEMEL)).durum).toBe('bekliyor');
  });

  it('geçersiz tutar reddedilir', async () => {
    await expect(odemeKaydet({ ...TEMEL, tutar: -1 })).rejects.toThrow(/tutar/i);
    await expect(odemeKaydet({ ...TEMEL, tutar: NaN })).rejects.toThrow(/tutar/i);
  });

  it('zorunlu alanlar', async () => {
    await expect(odemeKaydet({ ...TEMEL, ortakId: '' })).rejects.toThrow(/Ortak/);
    await expect(odemeKaydet({ ...TEMEL, donem: '' })).rejects.toThrow(/Dönem/);
  });
});

describe('durum geçişleri', () => {
  it('ödendi işaretlenince tarih ve ödeyen yazılır', async () => {
    const k = await odemeKaydet(TEMEL);
    const g = await odemeDurumGuncelle(k.id, 'odendi', 'muhasebe');
    expect(g.durum).toBe('odendi');
    expect(g.odeyen).toBe('muhasebe');
    expect(g.odenmeTarihi).toBeTruthy();
  });

  it('ödendi -> iptal geçişinde ödeme bilgisi TEMİZLENİR', async () => {
    // Temizlenmezse iptal edilmis kayit hala odenmis gibi raporlanirdi.
    const k = await odemeKaydet(TEMEL);
    await odemeDurumGuncelle(k.id, 'odendi', 'muhasebe');
    const iptal = await odemeDurumGuncelle(k.id, 'iptal', 'operator1');
    expect(iptal.odenmeTarihi).toBeUndefined();
    expect(iptal.odeyen).toBeUndefined();
  });

  it('geçersiz durum reddedilir', async () => {
    const k = await odemeKaydet(TEMEL);
    await expect(odemeDurumGuncelle(k.id, 'uydurma' as never, 'x')).rejects.toThrow(/durum/i);
  });

  it('olmayan kayıt 404', async () => {
    await expect(odemeDurumGuncelle('yok', 'odendi', 'x')).rejects.toThrow(/bulunamadı/);
  });
});

describe('toplamlar', () => {
  it('yalnızca ödenmişler ödenmiş toplama girer', async () => {
    const a = await odemeKaydet(TEMEL);
    await odemeKaydet({ ...TEMEL, donem: '2026-08', tutar: 3_000 });
    const c = await odemeKaydet({ ...TEMEL, donem: '2026-09', tutar: 7_000 });
    await odemeDurumGuncelle(a.id, 'odendi', 'x');
    await odemeDurumGuncelle(c.id, 'iptal', 'x');

    const liste = await odemeler();
    expect(odenmisToplam(liste)).toBe(12_500);
    expect(bekleyenToplam(liste)).toBe(3_000);   // iptal dahil degil
  });

  it('ortak filtresi çalışır', async () => {
    await odemeKaydet(TEMEL);
    await odemeKaydet({ ...TEMEL, ortakId: 'o2' });
    expect(await odemeler('default', 'o2')).toHaveLength(1);
  });

  it('boş listede toplamlar 0', () => {
    expect(odenmisToplam([])).toBe(0);
    expect(bekleyenToplam([])).toBe(0);
  });
});

describe('çakışma yardımcısı', () => {
  it('iptal edilmiş kaydı çakışma saymaz', () => {
    const liste = [{ ortakId: 'o1', donem: '2026-07', durum: 'iptal' }] as never;
    expect(cakisanKayit(liste, 'o1', '2026-07')).toBeUndefined();
  });
});
