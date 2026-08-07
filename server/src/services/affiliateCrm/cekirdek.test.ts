import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ozettenOlcumler, gunEkle } from './lynonCekme.js';

/**
 * Affiliate/CRM cekirdegi.
 *
 * Depo katmani taklit ediliyor: konu diske yazmak degil, olcumlerin
 * BIRLESTIRILME kurallari. Bu kurallar yanlis olursa panel sessizce
 * yanlis komisyon gosterir.
 */

// Gercek depo (tenantKey, namespace) ile anahtarliyor; taklit de oyle
// yapmali, yoksa siteler arasi ayrisma testi hicbir sey dogrulamaz.
let bellek: Record<string, unknown> = {};
const slot = (o: { tenantKey: string; namespace: string }) => `${o.tenantKey}|${o.namespace}`;
vi.mock('../../lib/documentStore.js', () => ({
  readStoredDocument: async (o: { tenantKey: string; namespace: string; fallback: unknown }) =>
    bellek[slot(o)] ?? (typeof o.fallback === 'function' ? (o.fallback as () => unknown)() : o.fallback),
  writeStoredDocument: async (o: { tenantKey: string; namespace: string }, payload: unknown) => { bellek[slot(o)] = payload; },
}));

async function modul() {
  vi.resetModules();
  return import('./cekirdek.js');
}

const olcum = (gun: string, ortak: string, ek: Partial<Record<string, unknown>> = {}) => ({
  gun, ortakAnahtari: ortak,
  oyuncuSayisi: 10, aktifOyuncuSayisi: 4,
  yatirim: 1000, cekim: 400, ggr: 600,
  ftdSayisi: null, kaynak: 'cekme' as const,
  ...ek,
}) as never;

describe('affiliate/crm cekirdegi', () => {
  beforeEach(() => { bellek = {}; });

  describe('yazma', () => {
    it('olcum yazar ve geri okur', async () => {
      const m = await modul();
      expect(await m.olcumleriYaz('t1', [olcum('2026-08-01', 'BTAG-A')])).toBe(1);
      const okunan = await m.olcumleriOku('t1');
      expect(okunan).toHaveLength(1);
      expect(okunan[0].ortakAnahtari).toBe('BTAG-A');
    });

    /**
     * Idempotent olmak sart: is gunde defalarca calisiyor. Eklemeli
     * olsaydi her tur rakamlari sisirirdi.
     */
    it('ayni gun ve ortak icin uzerine yazar, toplamaz', async () => {
      const m = await modul();
      await m.olcumleriYaz('t1', [olcum('2026-08-01', 'BTAG-A', { yatirim: 1000 })]);
      await m.olcumleriYaz('t1', [olcum('2026-08-01', 'BTAG-A', { yatirim: 1500 })]);
      const okunan = await m.olcumleriOku('t1');
      expect(okunan).toHaveLength(1);
      expect(okunan[0].yatirim).toBe(1500);
    });

    /**
     * Itme olay duzeyinde ve daha kesin; sonradan calisan bir cekme turu
     * onu geri goturmemeli.
     */
    it('cekme, itme olcumunun uzerine YAZMAZ', async () => {
      const m = await modul();
      await m.olcumleriYaz('t1', [olcum('2026-08-01', 'BTAG-A', { kaynak: 'itme', ftdSayisi: 3, yatirim: 2000 })]);
      const yazilan = await m.olcumleriYaz('t1', [olcum('2026-08-01', 'BTAG-A', { kaynak: 'cekme', yatirim: 1000 })]);
      expect(yazilan).toBe(0);
      const okunan = await m.olcumleriOku('t1');
      expect(okunan[0].yatirim).toBe(2000);
      expect(okunan[0].ftdSayisi).toBe(3);
    });

    it('itme, cekme olcumunun uzerine yazar', async () => {
      const m = await modul();
      await m.olcumleriYaz('t1', [olcum('2026-08-01', 'BTAG-A', { kaynak: 'cekme' })]);
      await m.olcumleriYaz('t1', [olcum('2026-08-01', 'BTAG-A', { kaynak: 'itme', ftdSayisi: 2 })]);
      expect((await m.olcumleriOku('t1'))[0].ftdSayisi).toBe(2);
    });

    it('siteler birbirinin verisini gormez', async () => {
      const m = await modul();
      await m.olcumleriYaz('site-a', [olcum('2026-08-01', 'BTAG-A')]);
      expect(await m.olcumleriOku('site-b')).toHaveLength(0);
    });
  });

  describe('ozet', () => {
    /**
     * Oyuncu sayisi bir STOK degeri (o gun kac oyuncu vardi), akis degeri
     * degil. 30 gunu toplamak ayni oyuncuyu 30 kez saymak olurdu.
     */
    it('oyuncu sayisini toplamaz, en yuksek gunu alir', async () => {
      const m = await modul();
      await m.olcumleriYaz('t1', [
        olcum('2026-08-01', 'BTAG-A', { oyuncuSayisi: 10, aktifOyuncuSayisi: 4 }),
        olcum('2026-08-02', 'BTAG-A', { oyuncuSayisi: 14, aktifOyuncuSayisi: 6 }),
      ]);
      const [ozet] = await m.ortakOzetleri('t1');
      expect(ozet.oyuncuSayisi).toBe(14);
      expect(ozet.aktifOyuncuSayisi).toBe(6);
    });

    it('para alanlarini toplar', async () => {
      const m = await modul();
      await m.olcumleriYaz('t1', [
        olcum('2026-08-01', 'BTAG-A', { yatirim: 1000, cekim: 400, ggr: 600 }),
        olcum('2026-08-02', 'BTAG-A', { yatirim: 500, cekim: 100, ggr: 400 }),
      ]);
      const [ozet] = await m.ortakOzetleri('t1');
      expect(ozet.yatirim).toBe(1500);
      expect(ozet.cekim).toBe(500);
      expect(ozet.ggr).toBe(1000);
      expect(ozet.gunSayisi).toBe(2);
    });

    /**
     * FTD yalnizca itme yolunda biliniyor. Hicbir gun bilinmiyorsa null
     * kalmali -- 0 yazmak "hic ilk yatirim olmadi" demek olurdu, oysa
     * dogrusu "olculmedi".
     */
    it('hic olculmemis FTD null kalir, 0 olmaz', async () => {
      const m = await modul();
      await m.olcumleriYaz('t1', [olcum('2026-08-01', 'BTAG-A'), olcum('2026-08-02', 'BTAG-A')]);
      expect((await m.ortakOzetleri('t1'))[0].ftdSayisi).toBeNull();
    });

    it('olculen gunlerin FTD sini toplar', async () => {
      const m = await modul();
      await m.olcumleriYaz('t1', [
        olcum('2026-08-01', 'BTAG-A', { kaynak: 'itme', ftdSayisi: 2 }),
        olcum('2026-08-02', 'BTAG-A', { kaynak: 'itme', ftdSayisi: 3 }),
      ]);
      expect((await m.ortakOzetleri('t1'))[0].ftdSayisi).toBe(5);
    });

    it('ortaklari GGR ye gore siralar ve gunluk seri verir', async () => {
      const m = await modul();
      await m.olcumleriYaz('t1', [
        olcum('2026-08-01', 'KUCUK', { ggr: 100 }),
        olcum('2026-08-01', 'BUYUK', { ggr: 900 }),
        olcum('2026-08-02', 'BUYUK', { ggr: 500 }),
      ]);
      const ozetler = await m.ortakOzetleri('t1');
      expect(ozetler.map((o) => o.ortakAnahtari)).toEqual(['BUYUK', 'KUCUK']);
      expect(ozetler[0].gunlukGgr).toEqual([{ gun: '2026-08-01', ggr: 900 }, { gun: '2026-08-02', ggr: 500 }]);
    });

    it('tarih araligina gore filtreler', async () => {
      const m = await modul();
      await m.olcumleriYaz('t1', [olcum('2026-07-31', 'A'), olcum('2026-08-01', 'A'), olcum('2026-08-05', 'A')]);
      const ozetler = await m.ortakOzetleri('t1', { start: '2026-08-01', end: '2026-08-02' });
      expect(ozetler[0].gunSayisi).toBe(1);
    });
  });

  it('son olculen gunu bulur', async () => {
    const m = await modul();
    expect(await m.sonOlculenGun('t1')).toBeNull();
    await m.olcumleriYaz('t1', [olcum('2026-08-01', 'A'), olcum('2026-08-03', 'A'), olcum('2026-08-02', 'A')]);
    expect(await m.sonOlculenGun('t1')).toBe('2026-08-03');
  });
});

describe('lynon cekme adaptoru', () => {
  it('lynon ozet satirlarini cekirdek olcumlerine cevirir', () => {
    const olcumler = ozettenOlcumler('2026-08-01', [
      { bTag: 'BTAG-A', totalPlayers: 12, activePlayers: 5, totalDeposits: 1000, totalWithdrawals: 300, netRevenue: 700 },
    ]);
    expect(olcumler).toEqual([{
      gun: '2026-08-01', ortakAnahtari: 'BTAG-A',
      oyuncuSayisi: 12, aktifOyuncuSayisi: 5,
      yatirim: 1000, cekim: 300, ggr: 700,
      ftdSayisi: null, kaynak: 'cekme',
    }]);
  });

  /** Cekme yolu olay duzeyi vermiyor; FTD burada bilinemez. */
  it('cekmede FTD daima null', () => {
    expect(ozettenOlcumler('2026-08-01', [{ bTag: 'A' }])[0].ftdSayisi).toBeNull();
  });

  it('BTag i olmayan satirlari eler', () => {
    expect(ozettenOlcumler('2026-08-01', [{ bTag: '' }, { bTag: '   ' }, {}])).toHaveLength(0);
  });

  it('sayisal olmayan degerleri sifira cevirir', () => {
    const [o] = ozettenOlcumler('2026-08-01', [{ bTag: 'A', totalDeposits: 'abc', netRevenue: null }]);
    expect(o.yatirim).toBe(0);
    expect(o.ggr).toBe(0);
  });

  describe('gunEkle', () => {
    it('ay ve yil sinirini gecer', () => {
      expect(gunEkle('2026-08-01', -1)).toBe('2026-07-31');
      expect(gunEkle('2026-12-31', 1)).toBe('2027-01-01');
    });

    it('yaz saati gecisinde gun kaydirmaz', () => {
      expect(gunEkle('2026-03-29', 1)).toBe('2026-03-30');
      expect(gunEkle('2026-10-25', 1)).toBe('2026-10-26');
    });
  });
});
