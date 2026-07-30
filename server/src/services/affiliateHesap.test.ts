import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Affiliate hesap servisi.
 *
 * Iki sey burada kilitleniyor:
 *   1. passwordHash disari SIZMAMALI — hesaplar() ve hesapEkle() gibi disari
 *      donen her yol hesapGorunum()'dan gecmeli.
 *   2. BTag ve e-posta BENZERSIZ olmali — ayni BTag iki hesaba baglanirsa
 *      komisyon iki kez odenir.
 *
 * documentStore'u bellekte taklit ediyoruz: testin diske ya da DB'ye
 * dokunmasi gerekmiyor, davranisi dogruluyoruz.
 */

const bellek = new Map<string, unknown>();

vi.mock('../lib/documentStore.js', () => ({
  readStoredDocument: async ({ namespace, tenantKey, fallback }: any) => {
    const anahtar = `${tenantKey}:${namespace}`;
    return bellek.has(anahtar) ? bellek.get(anahtar) : fallback();
  },
  writeStoredDocument: async ({ namespace, tenantKey }: any, data: unknown) => {
    bellek.set(`${tenantKey}:${namespace}`, data);
  },
}));

vi.mock('fs', () => ({
  default: { mkdirSync: () => undefined },
  mkdirSync: () => undefined,
}));

const {
  hesapEkle,
  hesapGuncelle,
  hesapSil,
  hesaplar,
  hesapBulKimlikIcin,
  hesapGorunum,
  komisyonHesapla,
  sonGirisIsle,
  AffiliateHesapHatasi,
} = await import('./affiliateAccountService.js');

const TEMEL = { bTag: 'NARCOS01', ad: 'Test Ortak', email: 'ortak@example.com', passwordHash: 'hash-degeri' };

beforeEach(() => bellek.clear());

describe('parola hash sızıntısı', () => {
  it('hesaplar() passwordHash döndürmez', async () => {
    await hesapEkle(TEMEL);
    const liste = await hesaplar();
    expect(liste).toHaveLength(1);
    expect(liste[0]).not.toHaveProperty('passwordHash');
  });

  it('hesapEkle() dönüşünde passwordHash yok', async () => {
    const hesap = await hesapEkle(TEMEL);
    expect(hesap).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(hesap)).not.toContain('hash-degeri');
  });

  it('hesapGuncelle() dönüşünde passwordHash yok', async () => {
    const olusan = await hesapEkle(TEMEL);
    const guncel = await hesapGuncelle(olusan.id, { ad: 'Yeni Ad', passwordHash: 'yeni-hash' });
    expect(guncel).not.toHaveProperty('passwordHash');
    expect(guncel.ad).toBe('Yeni Ad');
  });

  it('hesapBulKimlikIcin() hash DÖNDÜRÜR — yalnızca kimlik doğrulama yolu için', async () => {
    // Bu tek istisna kasitli; parola karsilastirmasi hash olmadan yapilamaz.
    await hesapEkle(TEMEL);
    const hesap = await hesapBulKimlikIcin('ortak@example.com');
    expect(hesap?.passwordHash).toBe('hash-degeri');
    // Ama gorunume cevrilince gitmeli.
    expect(hesapGorunum(hesap!)).not.toHaveProperty('passwordHash');
  });
});

describe('benzersizlik', () => {
  it('aynı e-posta ikinci kez eklenemez', async () => {
    await hesapEkle(TEMEL);
    await expect(hesapEkle({ ...TEMEL, bTag: 'BASKA' })).rejects.toThrow(AffiliateHesapHatasi);
  });

  it('e-posta karşılaştırması büyük/küçük harf duyarsız', async () => {
    await hesapEkle(TEMEL);
    await expect(hesapEkle({ ...TEMEL, bTag: 'BASKA', email: 'ORTAK@Example.COM' })).rejects.toThrow();
  });

  it('aynı BTag ikinci ortağa bağlanamaz — komisyon iki kez ödenirdi', async () => {
    await hesapEkle(TEMEL);
    await expect(hesapEkle({ ...TEMEL, email: 'baska@example.com' })).rejects.toThrow(/BTag/);
  });

  it('BTag karşılaştırması büyük/küçük harf duyarsız', async () => {
    await hesapEkle(TEMEL);
    await expect(hesapEkle({ ...TEMEL, email: 'baska@example.com', bTag: 'narcos01' })).rejects.toThrow(/BTag/);
  });

  it('güncellemede BTag çakışması engellenir', async () => {
    await hesapEkle(TEMEL);
    const ikinci = await hesapEkle({ ...TEMEL, email: 'iki@example.com', bTag: 'NARCOS02' });
    await expect(hesapGuncelle(ikinci.id, { bTag: 'NARCOS01' })).rejects.toThrow(/BTag/);
  });

  it('kendi BTag’ini korumak çakışma sayılmaz', async () => {
    const hesap = await hesapEkle(TEMEL);
    const guncel = await hesapGuncelle(hesap.id, { bTag: 'NARCOS01', ad: 'Değişti' });
    expect(guncel.ad).toBe('Değişti');
  });
});

describe('doğrulama', () => {
  it('zorunlu alanlar boşsa reddedilir', async () => {
    await expect(hesapEkle({ ...TEMEL, email: '' })).rejects.toThrow(/E-posta/);
    await expect(hesapEkle({ ...TEMEL, bTag: '' })).rejects.toThrow(/BTag/);
    await expect(hesapEkle({ ...TEMEL, ad: '' })).rejects.toThrow(/ad/i);
    await expect(hesapEkle({ ...TEMEL, passwordHash: '' })).rejects.toThrow(/Parola/);
  });

  it('revshare payı 0-100 aralığına kıstırılır', async () => {
    const asiri = await hesapEkle({ ...TEMEL, revsharePayi: 500 });
    expect(asiri.revsharePayi).toBe(100);
    const negatif = await hesapEkle({ ...TEMEL, email: 'iki@x.com', bTag: 'B2', revsharePayi: -20 });
    expect(negatif.revsharePayi).toBe(0);
  });

  it('geçersiz komisyon modeli varsayılana düşer', async () => {
    const hesap = await hesapEkle({ ...TEMEL, komisyonModeli: 'uydurma' as never });
    expect(hesap.komisyonModeli).toBe('revshare');
  });

  it('olmayan hesabın güncellenmesi/silinmesi 404', async () => {
    await expect(hesapGuncelle('yok', { ad: 'x' })).rejects.toThrow(/bulunamadı/);
    await expect(hesapSil('yok')).rejects.toThrow(/bulunamadı/);
  });

  it('son giriş kaydedilir, olmayan hesapta çökmez', async () => {
    const hesap = await hesapEkle(TEMEL);
    await sonGirisIsle(hesap.id);
    expect((await hesaplar())[0].sonGiris).toBeTruthy();
    await expect(sonGirisIsle('yok')).resolves.toBeUndefined();
  });
});

describe('komisyon hesabı', () => {
  const revshare = { komisyonModeli: 'revshare' as const, revsharePayi: 25, cpaTutari: 300 };
  const cpa = { komisyonModeli: 'cpa' as const, revsharePayi: 25, cpaTutari: 300 };
  const hibrit = { komisyonModeli: 'hibrit' as const, revsharePayi: 10, cpaTutari: 100 };

  it('revshare yalnızca net gelirin yüzdesi', () => {
    const s = komisyonHesapla(10000, 20, revshare);
    expect(s.revshare).toBe(2500);
    expect(s.cpa).toBe(0);
    expect(s.toplam).toBe(2500);
  });

  it('cpa yalnızca dönüşen oyuncu başına', () => {
    const s = komisyonHesapla(10000, 20, cpa);
    expect(s.revshare).toBe(0);
    expect(s.cpa).toBe(6000);
  });

  it('hibrit ikisini toplar', () => {
    const s = komisyonHesapla(10000, 20, hibrit);
    expect(s.revshare).toBe(1000);
    expect(s.cpa).toBe(2000);
    expect(s.toplam).toBe(3000);
  });

  it('NEGATİF net gelir sıfıra kırpılır — ortaktan para talep edilmez', () => {
    const s = komisyonHesapla(-50000, 10, revshare);
    expect(s.revshare).toBe(0);
    expect(s.toplam).toBe(0);
  });

  it('negatif oyuncu sayısı sıfıra kırpılır', () => {
    expect(komisyonHesapla(0, -5, cpa).cpa).toBe(0);
  });

  it('bozuk sayı girdisi çökmez', () => {
    const s = komisyonHesapla(NaN, Infinity, revshare);
    expect(Number.isFinite(s.toplam)).toBe(true);
    expect(s.toplam).toBe(0);
  });

  it('açıklama hesabı okunur biçimde gösterir', () => {
    expect(komisyonHesapla(10000, 20, hibrit).aciklama).toContain('×');
  });
});
