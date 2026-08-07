import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ortakOlarakKaydet, OrtakKaydiHatasi } from './lynonOrtakKaydi.js';

/**
 * Oyuncuyu ortak (affiliate) olarak kaydetme.
 *
 * Gozlenen istek:
 *   PUT api/affiliate/api/v1.0/affiliatePlayers/137/2518114/register
 *   { email, countryCode, affiliateType, playerExternalId, userName,
 *     walletNumber }
 *   -> 200, content-length: 0
 */

const lynonRequest = vi.fn();
const auditKayitlari: unknown[][] = [];

vi.mock('../../lib/lynonAuth.js', () => ({ lynonRequest: (...a: unknown[]) => lynonRequest(...a) }));
vi.mock('../../lib/tenantRuntimeConfig.js', () => ({ lynonCfg: () => ({ siteId: siteId }) }));
vi.mock('../../lib/auditLog.js', () => ({ audit: (...a: unknown[]) => { auditKayitlari.push(a); } }));

let siteId = 137;

const gecerli = {
  playerId: '2518114',
  email: 'ykocakaya26@icloud.com',
  userName: 'yigit2000',
  affiliateType: 'affnook',
  countryCode: 'TR',
  playerExternalId: 'test',
  walletNumber: '02950300',
};

describe('ortak kaydi', () => {
  beforeEach(() => {
    lynonRequest.mockReset();
    lynonRequest.mockResolvedValue({});
    auditKayitlari.length = 0;
    siteId = 137;
  });

  it('gozlenen yolu ve govdeyi birebir gonderir', async () => {
    await ortakOlarakKaydet('t1', gecerli);
    expect(lynonRequest).toHaveBeenCalledWith(
      'api/affiliate/api/v1.0/affiliatePlayers/137/2518114/register',
      {
        method: 'PUT',
        body: {
          email: 'ykocakaya26@icloud.com',
          userName: 'yigit2000',
          affiliateType: 'affnook',
          countryCode: 'TR',
          playerExternalId: 'test',
          walletNumber: '02950300',
        },
      },
    );
  });

  it('site kimligini tenant yapilandirmasindan alir', async () => {
    siteId = 999;
    await ortakOlarakKaydet('t1', gecerli);
    expect(lynonRequest.mock.calls[0][0]).toContain('/affiliatePlayers/999/');
  });

  /**
   * Bos string gondermek, Lynon tarafinda var olan bir degeri silmek
   * anlamina gelebilir; alan hic konmamali.
   */
  it('bos istege bagli alanlari govdeye koymaz', async () => {
    await ortakOlarakKaydet('t1', { ...gecerli, playerExternalId: '', walletNumber: '   ' });
    const govde = lynonRequest.mock.calls[0][1].body;
    expect(govde).not.toHaveProperty('playerExternalId');
    expect(govde).not.toHaveProperty('walletNumber');
  });

  it('ulke kodunu buyuk harfe cevirir', async () => {
    await ortakOlarakKaydet('t1', { ...gecerli, countryCode: 'tr' });
    expect(lynonRequest.mock.calls[0][1].body.countryCode).toBe('TR');
  });

  describe('dogrulama', () => {
    it.each(['email', 'userName', 'affiliateType', 'countryCode'] as const)('%s eksikse reddeder', async (alan) => {
      await expect(ortakOlarakKaydet('t1', { ...gecerli, [alan]: '' })).rejects.toThrow(OrtakKaydiHatasi);
      expect(lynonRequest).not.toHaveBeenCalled();
    });

    it('gecersiz e-postayi reddeder', async () => {
      await expect(ortakOlarakKaydet('t1', { ...gecerli, email: 'duz-metin' })).rejects.toThrow(/email/);
      expect(lynonRequest).not.toHaveBeenCalled();
    });

    it('site kimligi yoksa istek atmaz', async () => {
      siteId = 0;
      await expect(ortakOlarakKaydet('t1', gecerli)).rejects.toThrow(/site kimligi/i);
      expect(lynonRequest).not.toHaveBeenCalled();
    });
  });

  describe('tip dogrulamasi', () => {
    it('katalogda olmayan tipi reddeder', async () => {
      await expect(
        ortakOlarakKaydet('t1', { ...gecerli, affiliateType: 'uydurma' }, { kabulEdilenTipler: ['affnook', 'tap'] }),
      ).rejects.toThrow(/katalogda yok/);
      expect(lynonRequest).not.toHaveBeenCalled();
    });

    it('katalogdaki tipi kabul eder', async () => {
      await ortakOlarakKaydet('t1', gecerli, { kabulEdilenTipler: ['affnook', 'tap'] });
      expect(lynonRequest).toHaveBeenCalledOnce();
    });

    /**
     * Liste gomulu olsaydi Lynon yeni bir tip ekledeginde panel onu
     * sessizce reddederdi. Liste verilmezse karar Lynon'a birakilir.
     */
    it('liste verilmezse dogrulamayi atlar', async () => {
      await ortakOlarakKaydet('t1', { ...gecerli, affiliateType: 'yeni-tip' });
      expect(lynonRequest).toHaveBeenCalledOnce();
    });
  });

  /**
   * Uc BOS yanit donuyor; panelin elinde baska hicbir kanit yok.
   * Denetim kaydi tek iz.
   */
  it('denetime kim-kimi-hangi-tiple yazar', async () => {
    await ortakOlarakKaydet('t1', gecerli, { aktor: 'operator1' });
    expect(auditKayitlari).toHaveLength(1);
    const [aktor, , eylem, hedef, detay] = auditKayitlari[0] as string[];
    expect(aktor).toBe('operator1');
    expect(eylem).toBe('affiliate_player_register');
    expect(hedef).toBe('2518114');
    expect(detay).toContain('yigit2000');
    expect(detay).toContain('affnook');
  });

  it('istek basarisiz olursa denetime yazmaz', async () => {
    lynonRequest.mockRejectedValue(new Error('Lynon API 500'));
    await expect(ortakOlarakKaydet('t1', gecerli)).rejects.toThrow();
    expect(auditKayitlari).toHaveLength(0);
  });
});
