import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tiklama kaydi ve yonlendirme.
 *
 * Izleme dongusunun kapanan halkasi: link -> TIKLAMA -> donusum.
 * `clickId` burada doguyor; postback'in `{clickid}` makrosu ancak
 * bununla dolabiliyor.
 */

let bellek: Record<string, unknown> = {};
const slot = (o: { tenantKey: string; namespace: string }) => `${o.tenantKey}|${o.namespace}`;
vi.mock('../../lib/documentStore.js', () => ({
  readStoredDocument: async (o: { tenantKey: string; namespace: string; fallback: unknown }) =>
    bellek[slot(o)] ?? (typeof o.fallback === 'function' ? (o.fallback as () => unknown)() : o.fallback),
  writeStoredDocument: async (o: { tenantKey: string; namespace: string }, p: unknown) => { bellek[slot(o)] = p; },
}));

async function modul() {
  vi.resetModules();
  return import('./tiklama.js');
}

describe('tiklama', () => {
  beforeEach(() => { bellek = {}; });

  describe('kayit', () => {
    it('clickId uretir ve alanlari saklar', async () => {
      const m = await modul();
      const t = await m.tiklamaKaydet('t1', {
        bTag: 'ORTAK1',
        medyaId: 'm-1',
        sorgu: { sub1: 'youtube', sub2: 'video-12' },
        ip: '8.8.8.8',
        userAgent: 'Mozilla/5.0',
        referrer: 'https://youtube.com/x',
      });
      expect(t.clickId).toMatch(/^[0-9a-f-]{36}$/);
      expect(t.bTag).toBe('ORTAK1');
      expect(t.medyaId).toBe('m-1');
      expect(t.alt).toEqual({ sub1: 'youtube', sub2: 'video-12' });
    });

    it('her tiklama ayri clickId alir', async () => {
      const m = await modul();
      const a = await m.tiklamaKaydet('t1', { bTag: 'A' });
      const b = await m.tiklamaKaydet('t1', { bTag: 'A' });
      expect(a.clickId).not.toBe(b.clickId);
    });

    it('bTag yoksa reddeder', async () => {
      const m = await modul();
      await expect(m.tiklamaKaydet('t1', { bTag: '' })).rejects.toThrow(/bTag/);
    });

    it('tanimsiz alt parametreleri atar', async () => {
      const m = await modul();
      const t = await m.tiklamaKaydet('t1', { bTag: 'A', sorgu: { sub1: 'x', sub9: 'y', baska: 'z' } });
      expect(t.alt).toEqual({ sub1: 'x' });
    });

    /** Uzun user-agent kaydi sisirir; bas kismi teshis icin yeter. */
    it('user-agent i kirpar', async () => {
      const m = await modul();
      const t = await m.tiklamaKaydet('t1', { bTag: 'A', userAgent: 'x'.repeat(500) });
      expect(t.userAgent).toHaveLength(200);
    });

    it('siteler birbirinin tiklamasini gormez', async () => {
      const m = await modul();
      await m.tiklamaKaydet('site-a', { bTag: 'A' });
      expect(await m.tiklamalariListele('site-b')).toHaveLength(0);
    });

    it('clickId ile geri bulunur', async () => {
      const m = await modul();
      const t = await m.tiklamaKaydet('t1', { bTag: 'A' });
      expect((await m.tiklamaBul('t1', t.clickId))?.bTag).toBe('A');
      expect(await m.tiklamaBul('t1', 'olmayan')).toBeNull();
    });
  });

  describe('yonlendirme', () => {
    const tiklama = {
      clickId: 'c-123', bTag: 'ORTAK1', medyaId: 'm-1',
      alt: { sub1: 'yt' }, ip: null, userAgent: null, referrer: null, zaman: '2026-08-07T00:00:00Z',
    };

    it('clickId yi hedefe ekler', async () => {
      const m = await modul();
      const url = new URL(m.yonlendirmeAdresi('https://site.com/kayit', tiklama));
      // Oyuncu bizim alan adimizdan cikiyor; cerezle tasimak mumkun degil.
      expect(url.searchParams.get('clickid')).toBe('c-123');
      expect(url.searchParams.get('btag')).toBe('ORTAK1');
      expect(url.searchParams.get('mid')).toBe('m-1');
      expect(url.searchParams.get('sub1')).toBe('yt');
    });

    it('hedefteki mevcut parametreleri korur', async () => {
      const m = await modul();
      const url = new URL(m.yonlendirmeAdresi('https://site.com/?promo=yaz', tiklama));
      expect(url.searchParams.get('promo')).toBe('yaz');
    });

    /**
     * ACIK YONLENDIRME KORUMASI. Hedef adres yalnizca sunucuda kayitli
     * medyadan gelir; buraya gecersiz ya da http disi bir sema
     * ulasirsa yonlendirme URETILMEMELI.
     */
    it('http disi semayi reddeder', async () => {
      const m = await modul();
      expect(() => m.yonlendirmeAdresi('javascript:alert(1)', tiklama)).toThrow();
      expect(() => m.yonlendirmeAdresi('data:text/html,x', tiklama)).toThrow();
    });

    it('gecersiz adresi reddeder', async () => {
      const m = await modul();
      expect(() => m.yonlendirmeAdresi('site.com', tiklama)).toThrow();
    });
  });

  describe('ozet', () => {
    it('ortak, medya ve alt kanal kirilimi verir', async () => {
      const m = await modul();
      await m.tiklamaKaydet('t1', { bTag: 'A', medyaId: 'm1', sorgu: { sub1: 'yt' } });
      await m.tiklamaKaydet('t1', { bTag: 'A', medyaId: 'm1', sorgu: { sub1: 'yt' } });
      await m.tiklamaKaydet('t1', { bTag: 'A', medyaId: 'm2', sorgu: { sub1: 'tg' } });
      await m.tiklamaKaydet('t1', { bTag: 'B', medyaId: 'm1' });

      const ozet = await m.tiklamaOzeti('t1');
      expect(ozet[0].bTag).toBe('A');
      expect(ozet[0].toplam).toBe(3);
      expect(ozet[0].medyaBazinda[0]).toEqual({ medyaId: 'm1', sayi: 2 });
      expect(ozet[0].altBazinda[0]).toEqual({ anahtar: 'sub1', deger: 'yt', sayi: 2 });
      expect(ozet[1].bTag).toBe('B');
    });

    it('ortaklari tiklama sayisina gore siralar', async () => {
      const m = await modul();
      await m.tiklamaKaydet('t1', { bTag: 'AZ' });
      await m.tiklamaKaydet('t1', { bTag: 'COK' });
      await m.tiklamaKaydet('t1', { bTag: 'COK' });
      expect((await m.tiklamaOzeti('t1')).map((o) => o.bTag)).toEqual(['COK', 'AZ']);
    });
  });

  describe('listeleme', () => {
    it('ortaga gore filtreler', async () => {
      const m = await modul();
      await m.tiklamaKaydet('t1', { bTag: 'A' });
      await m.tiklamaKaydet('t1', { bTag: 'B' });
      expect(await m.tiklamalariListele('t1', { bTag: 'A' })).toHaveLength(1);
    });

    it('en yeniyi basa koyar', async () => {
      const m = await modul();
      await m.tiklamaKaydet('t1', { bTag: 'ILK' }, new Date('2026-08-01T00:00:00Z'));
      await m.tiklamaKaydet('t1', { bTag: 'SON' }, new Date('2026-08-02T00:00:00Z'));
      expect((await m.tiklamalariListele('t1'))[0].bTag).toBe('SON');
    });
  });
});
