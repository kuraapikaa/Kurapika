import { randomUUID } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ftdBonuslariniIsle, otoBonusAyarla, otoBonusDurumu } from './otoBonus.js';

const kiraci = () => `oto-bonus-${randomUUID().slice(0, 8)}`;

/**
 * Testler gerçek saat yerine sabit bir "şimdi" kullanıyor: tazelik
 * kuralı (bugün/dün) duvar saatine bağlı ve saat gece yarısını
 * geçerken yeşil/kırmızı değişen bir test, hatanın kendisinden daha
 * pahalıya mal olur.
 */
const SIMDI = new Date('2026-08-07T12:00:00+03:00');
const BUGUN = '2026-08-07';

function crmKur() {
  vi.stubEnv('AFF_CRM_URL', 'https://crm.ornek.com');
  vi.stubEnv('AFF_CRM_BONUS_ANAHTARI', 'a'.repeat(32));
}

function fetchTakla(yanitlar: Array<{ ok: boolean; status?: number; govde?: unknown }>) {
  const sahte = vi.fn();
  for (const y of yanitlar) {
    sahte.mockResolvedValueOnce({
      ok: y.ok,
      status: y.status ?? (y.ok ? 201 : 422),
      json: async () => y.govde ?? null,
    });
  }
  vi.stubGlobal('fetch', sahte);
  return sahte;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('oto bonus ayari', () => {
  it('varsayilan kapali ve tutarsiz', async () => {
    const k = kiraci();
    const durum = await otoBonusDurumu(k);
    expect(durum.ayar.aktif).toBe(false);
    expect(durum.ayar.tutarKurus).toBe(0);
  });

  it('acikken pozitif tam kurus tutari zorunlu', async () => {
    const k = kiraci();
    await expect(otoBonusAyarla(k, { aktif: true, tutarKurus: 0 })).rejects.toThrow(/pozitif/);
    await expect(otoBonusAyarla(k, { aktif: true, tutarKurus: 10.5 })).rejects.toThrow(/pozitif/);
  });

  it('ayari yazar ve geri okur', async () => {
    const k = kiraci();
    await otoBonusAyarla(k, { aktif: true, tutarKurus: 5000, bonusKodu: ' HOSGELDIN ', not: '' }, SIMDI);
    const durum = await otoBonusDurumu(k);
    expect(durum.ayar).toMatchObject({ aktif: true, tutarKurus: 5000, bonusKodu: 'HOSGELDIN', not: null });
  });
});

describe('ftd bonus gonderimi', () => {
  it('yapilandirma yoksa CRM hic cagrilmaz', async () => {
    const k = kiraci();
    await otoBonusAyarla(k, { aktif: true, tutarKurus: 5000 }, SIMDI);
    const sahte = fetchTakla([]);

    const sonuc = await ftdBonuslariniIsle(k, BUGUN, ['oyuncu-1'], SIMDI);
    expect(sonuc).toEqual({ gonderilen: 0, basarisiz: 0, atlanan: 1 });
    expect(sahte).not.toHaveBeenCalled();
  });

  it('kural kapaliyken gonderim yapilmaz', async () => {
    const k = kiraci();
    crmKur();
    const sahte = fetchTakla([]);

    const sonuc = await ftdBonuslariniIsle(k, BUGUN, ['oyuncu-1'], SIMDI);
    expect(sonuc.atlanan).toBe(1);
    expect(sahte).not.toHaveBeenCalled();
  });

  it('basarili gonderimi kaydeder ve ayni oyuncuya IKINCI kez gondermez', async () => {
    const k = kiraci();
    crmKur();
    await otoBonusAyarla(k, { aktif: true, tutarKurus: 5000, bonusKodu: 'FTD' }, SIMDI);
    const sahte = fetchTakla([{ ok: true }]);

    const ilk = await ftdBonuslariniIsle(k, BUGUN, ['oyuncu-1'], SIMDI);
    expect(ilk.gonderilen).toBe(1);
    expect(sahte).toHaveBeenCalledTimes(1);

    const [, istek] = sahte.mock.calls[0]!;
    const govde = JSON.parse((istek as { body: string }).body);
    expect(govde).toMatchObject({ playerQuery: 'oyuncu-1', amountCents: 5000, bonusCode: 'FTD' });

    // Defter sifirlansa ve oyuncu yeniden "yeni" gorunse bile ikinci
    // gonderim yok: gercek parayla mukerrerlik affedilmez.
    const ikinci = await ftdBonuslariniIsle(k, BUGUN, ['oyuncu-1'], SIMDI);
    expect(ikinci).toEqual({ gonderilen: 0, basarisiz: 0, atlanan: 1 });
    expect(sahte).toHaveBeenCalledTimes(1);

    const durum = await otoBonusDurumu(k);
    expect(durum.kayitlar[0]).toMatchObject({ oyuncuId: 'oyuncu-1', durum: 'basarili' });
  });

  it('basarisiz gonderim kayda gecer ama gonderilmis SAYILMAZ', async () => {
    const k = kiraci();
    crmKur();
    await otoBonusAyarla(k, { aktif: true, tutarKurus: 5000 }, SIMDI);
    fetchTakla([
      { ok: false, status: 422, govde: { error: 'Oyuncunun platformda kayıtlı telefonu yok' } },
      { ok: true },
    ]);

    const ilk = await ftdBonuslariniIsle(k, BUGUN, ['oyuncu-1'], SIMDI);
    expect(ilk.basarisiz).toBe(1);

    let durum = await otoBonusDurumu(k);
    expect(durum.kayitlar[0]).toMatchObject({ durum: 'basarisiz', mesaj: 'Oyuncunun platformda kayıtlı telefonu yok' });

    // Basarisiz oyuncu tekrar gelirse yeniden denenir (gonderilenler'e girmedi).
    const ikinci = await ftdBonuslariniIsle(k, BUGUN, ['oyuncu-1'], SIMDI);
    expect(ikinci.gonderilen).toBe(1);
    durum = await otoBonusDurumu(k);
    expect(durum.kayitlar[0]).toMatchObject({ durum: 'basarili' });
  });

  it('geri doldurma gunune bonus gondermez, atladigini kayda yazar', async () => {
    const k = kiraci();
    crmKur();
    await otoBonusAyarla(k, { aktif: true, tutarKurus: 5000 }, SIMDI);
    const sahte = fetchTakla([]);

    const sonuc = await ftdBonuslariniIsle(k, '2026-07-20', ['oyuncu-eski'], SIMDI);
    expect(sonuc).toEqual({ gonderilen: 0, basarisiz: 0, atlanan: 1 });
    expect(sahte).not.toHaveBeenCalled();

    const durum = await otoBonusDurumu(k);
    expect(durum.kayitlar[0]).toMatchObject({ oyuncuId: 'oyuncu-eski', durum: 'atlandi' });
  });

  it('dun tespit edilen taze sayilir', async () => {
    const k = kiraci();
    crmKur();
    await otoBonusAyarla(k, { aktif: true, tutarKurus: 5000 }, SIMDI);
    const sahte = fetchTakla([{ ok: true }]);

    const sonuc = await ftdBonuslariniIsle(k, '2026-08-06', ['oyuncu-dun'], SIMDI);
    expect(sonuc.gonderilen).toBe(1);
    expect(sahte).toHaveBeenCalledTimes(1);
  });

  it('ag hatasinda bir kez daha dener, yine olmazsa basarisiz yazar', async () => {
    const k = kiraci();
    crmKur();
    await otoBonusAyarla(k, { aktif: true, tutarKurus: 5000 }, SIMDI);
    const sahte = vi.fn()
      .mockRejectedValueOnce(new Error('baglanti koptu'))
      .mockRejectedValueOnce(new Error('baglanti koptu'));
    vi.stubGlobal('fetch', sahte);

    const sonuc = await ftdBonuslariniIsle(k, BUGUN, ['oyuncu-1'], SIMDI);
    expect(sonuc.basarisiz).toBe(1);
    expect(sahte).toHaveBeenCalledTimes(2);

    const durum = await otoBonusDurumu(k);
    expect(durum.kayitlar[0]!.mesaj).toContain('ulaşılamadı');
  });
});
