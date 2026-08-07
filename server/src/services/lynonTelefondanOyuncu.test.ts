import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Telefon numarasindan oyuncu bulma.
 *
 * Bu yol var cunku Lynon'un `userBackOffice` aramasi telefonu KAPSAMIYOR.
 * Canlida olculdu: `905369824414`, `5369824414`, `05369824414` ve
 * `+905369824414` bicimlerinin dordu de `{"account":null}` dondu, ayni anda
 * `snnads01` kullanici adi sorgusu aninda hesabi getirdi. Numaradan oyuncuya
 * ulasma tum WhatsApp CRM entegrasyonunun dayandigi sey oldugu icin, bu
 * dosyanin kirmizi olmasi entegrasyonun tamamen olu olmasi demek.
 */

const lynonRequest = vi.fn();
vi.mock('../lib/lynonAuth.js', () => ({
  lynonRequest: (...a: unknown[]) => lynonRequest(...a),
  lynonRaporIstek: (...a: unknown[]) => lynonRequest(...a),
}));
vi.mock('../lib/tenantRuntimeConfig.js', () => ({
  lynonCfg: () => ({
    siteId: 137,
    backofficeBaseUrl: 'https://backoffice.narcosbahis.com',
    currency: 'TRY',
  }),
}));

async function modul() {
  vi.resetModules();
  return import('./lynonBackofficeService.js');
}

describe('telefondan oyuncu cozumu', () => {
  beforeEach(() => lynonRequest.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('son 10 hane esitse bulur — yazim bicimi fark etmez', async () => {
    // Rapor kaydinda numara 0'li tutuluyor, sorgu ise ulke kodlu geliyor:
    // WhatsApp numarayi her zaman ulke koduyla verdigi icin gercek durum bu.
    lynonRequest.mockResolvedValue({
      reports: [
        { 'Player ID': '111', PhoneNumber: '05551110000' },
        { 'Player ID': '2519618', PhoneNumber: '05369824414' },
      ],
    });

    const m = await modul();

    for (const sorgu of ['905369824414', '+90 536 982 44 14', '05369824414', '5369824414']) {
      expect(await m.lynonOyuncuIdTelefondan(sorgu)).toBe('2519618');
    }

    // Kayitli olmayan numara sessizce yanlis oyuncuya baglanmamali.
    expect(await m.lynonOyuncuIdTelefondan('905000000000')).toBeNull();
  });

  it('10 haneden kisa girdi ile arama yapmaz', async () => {
    const m = await modul();

    // Kisa girdi ile son-N karsilastirmasi yanlis oyuncuyu dondurebilir:
    // "824414" birden fazla numaranin sonuyla eslesir. Bu durumda hic
    // aramamak, yanlis hesaba bakmaktan iyidir.
    expect(await m.lynonOyuncuIdTelefondan('824414')).toBeNull();
    expect(await m.lynonOyuncuIdTelefondan('')).toBeNull();
    // Rapor hic cagrilmamali.
    expect(lynonRequest).not.toHaveBeenCalled();
  });
});
