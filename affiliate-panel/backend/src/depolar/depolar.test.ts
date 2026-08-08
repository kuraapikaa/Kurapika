import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { belgeOlcumDeposu, postgresOlcumDeposu, type OlcumDeposu, type YazilacakOlcum } from './olcumDeposu.js';
import { belgeTiklamaDeposu, postgresTiklamaDeposu, type Tiklama, type TiklamaDeposu } from './tiklamaDeposu.js';
import {
  belgeEslesmeDeposu,
  postgresEslesmeDeposu,
  type EslesmeDeposu,
  type OyuncuEslesmesi,
} from './eslesmeDeposu.js';
import {
  eslesmeCakismalari as cakismaTablosu,
  olcumler as olcumTablosu,
  oyuncuEslesmeleri as eslesmeTablosu,
  tiklamalar as tiklamaTablosu,
} from '../lib/sema.js';
import { veritabani, veritabaniniBaslat, veritabaniniKapat } from '../lib/veritabani.js';
import { testVeritabaniAc } from '../../test/testVeritabani.js';

/**
 * DENKLİK TESTİ — iki uygulama aynı soruya aynı cevabı vermeli.
 *
 * Postgres uygulamasını tek başına sınamak, "SQL çalışıyor" der ama
 * "SQL, YERİNİ ALDIĞI KODLA AYNI ŞEYİ yapıyor" demez. Taşımanın asıl
 * riski orada: filtre sınırları, sıralama, boş değer sayımı gibi
 * sessizce kayan ayrıntılar. Bu yüzden her senaryo İKİSİNDE de
 * koşuyor ve sonuçlar birbirine karşı doğrulanıyor.
 *
 * Postgres yoksa yalnızca bu dosya atlanıyor; `TEST_DATABASE_URL` ile
 * açılıyor. Diğer testler veritabanı gerektirmemeye devam ediyor.
 */

const TEST_URL = String(process.env.TEST_DATABASE_URL || '').trim();
const varsaCalistir = TEST_URL ? describe : describe.skip;

const tiklama = (ek: Partial<Tiklama> & { clickId: string; zaman: string }): Tiklama => ({
  ortakAnahtari: 'ortak-a',
  medyaId: null,
  alt: {},
  ip: null,
  userAgent: null,
  referrer: null,
  ...ek,
});

const olcum = (ek: Partial<YazilacakOlcum> & { gun: string; ortakAnahtari: string }): YazilacakOlcum => ({
  oyuncuSayisi: 0,
  aktifOyuncuSayisi: 0,
  yatirim: 0,
  cekim: 0,
  ggr: 0,
  ftdSayisi: null,
  kaynak: 'cekme',
  ...ek,
});

varsaCalistir('depo denkligi', () => {
  const KIRACI = 'denklik-kiracisi';
  let tiklamaUygulamalari: Array<[string, TiklamaDeposu]>;
  let olcumUygulamalari: Array<[string, OlcumDeposu]>;
  let eslesmeUygulamalari: Array<[string, EslesmeDeposu]>;

  beforeAll(async () => {
    process.env.DATABASE_URL = (await testVeritabaniAc('aff_test_depolar'))!;
    await veritabaniniBaslat();
    tiklamaUygulamalari = [['postgres', postgresTiklamaDeposu()], ['belge', belgeTiklamaDeposu()]];
    olcumUygulamalari = [['postgres', postgresOlcumDeposu()], ['belge', belgeOlcumDeposu()]];
    eslesmeUygulamalari = [['postgres', postgresEslesmeDeposu()], ['belge', belgeEslesmeDeposu()]];
  });

  afterAll(async () => {
    await veritabaniniKapat();
    delete process.env.DATABASE_URL;
  });

  beforeEach(async () => {
    const vt = veritabani();
    await vt!.delete(tiklamaTablosu);
    await vt!.delete(olcumTablosu);
    await vt!.delete(eslesmeTablosu);
    await vt!.delete(cakismaTablosu);
    // Belge uygulamasi ayni kiraciyi kullaniyor; onun da sifirlanmasi sart.
    const { yaz } = await import('../lib/depo.js');
    await yaz(KIRACI, 'tiklamalar', { version: 1, tiklamalar: [] });
    await yaz(KIRACI, 'olcumler', { version: 1, olcumler: {} });
    await yaz(KIRACI, 'oyuncu-eslesmeleri', { version: 1, eslesmeler: [] });
    await yaz(KIRACI, 'eslesme-cakismalari', { version: 1, cakismalar: [] });
  });

  /** Senaryoyu her iki uygulamada koşup sonuçları eşitliğe zorlar. */
  async function ikisindeDe<T>(
    uygulamalar: Array<[string, { }]>,
    senaryo: (depo: never) => Promise<T>,
  ): Promise<T> {
    const sonuclar: Array<[string, T]> = [];
    for (const [ad, depo] of uygulamalar) {
      sonuclar.push([ad, await senaryo(depo as never)]);
    }
    expect(sonuclar[1][1], `${sonuclar[0][0]} ile ${sonuclar[1][0]} ayristi`).toEqual(sonuclar[0][1]);
    return sonuclar[0][1];
  }

  describe('tiklamalar', () => {
    const ornekler: Tiklama[] = [
      tiklama({ clickId: 'c1', zaman: '2026-08-01T10:00:00.000Z', medyaId: 'm1', alt: { alt1: 'facebook' } }),
      tiklama({ clickId: 'c2', zaman: '2026-08-02T10:00:00.000Z', medyaId: 'm1', alt: { alt1: 'facebook' } }),
      tiklama({ clickId: 'c3', zaman: '2026-08-03T10:00:00.000Z', medyaId: 'm2', alt: { alt1: 'google', alt2: 'x' } }),
      tiklama({ clickId: 'c4', zaman: '2026-08-04T10:00:00.000Z', ortakAnahtari: 'ortak-b', medyaId: null }),
      // Bos alt degeri: kanal degil, ortagin bos gonderdigi parametre.
      tiklama({ clickId: 'c5', zaman: '2026-08-05T10:00:00.000Z', ortakAnahtari: 'ortak-b', alt: { alt1: '' } }),
    ];

    const doldur = async (depo: TiklamaDeposu) => {
      for (const t of ornekler) await depo.ekle(KIRACI, t);
    };

    it('en yeniden eskiye siralar', async () => {
      const sira = await ikisindeDe<string[]>(tiklamaUygulamalari, async (depo: TiklamaDeposu) => {
        await doldur(depo);
        return (await depo.listele(KIRACI, {})).map((t) => t.clickId);
      });
      expect(sira).toEqual(['c5', 'c4', 'c3', 'c2', 'c1']);
    });

    it('ortak ve medyaya gore suzer', async () => {
      const sonuc = await ikisindeDe<string[]>(tiklamaUygulamalari, async (depo: TiklamaDeposu) => {
        await doldur(depo);
        return (await depo.listele(KIRACI, { ortakAnahtari: 'ortak-a', medyaId: 'm1' })).map((t) => t.clickId);
      });
      expect(sonuc).toEqual(['c2', 'c1']);
    });

    /** Bitis gunu SONUNA kadar dahil; gun 00:00'da kesilmemeli. */
    it('tarih araligini iki uctan da kapsar', async () => {
      const sonuc = await ikisindeDe<string[]>(tiklamaUygulamalari, async (depo: TiklamaDeposu) => {
        await doldur(depo);
        return (await depo.listele(KIRACI, { start: '2026-08-02', end: '2026-08-04' })).map((t) => t.clickId);
      });
      expect(sonuc).toEqual(['c4', 'c3', 'c2']);
    });

    it('limit en yenileri birakir', async () => {
      const sonuc = await ikisindeDe<string[]>(tiklamaUygulamalari, async (depo: TiklamaDeposu) => {
        await doldur(depo);
        return (await depo.listele(KIRACI, { limit: 2 })).map((t) => t.clickId);
      });
      expect(sonuc).toEqual(['c5', 'c4']);
    });

    it('kayitlari alan alan ayni dondurur', async () => {
      const kayit = await ikisindeDe<Tiklama | null>(tiklamaUygulamalari, async (depo: TiklamaDeposu) => {
        await doldur(depo);
        return depo.bul(KIRACI, 'c3');
      });
      expect(kayit).toEqual(ornekler[2]);
    });

    it('baska kiracinin tiklamasini dondurmez', async () => {
      const depo = postgresTiklamaDeposu();
      await depo.ekle('baska-kiraci', tiklama({ clickId: 'yabanci', zaman: '2026-08-01T00:00:00.000Z' }));
      expect(await depo.bul(KIRACI, 'yabanci')).toBeNull();
    });

    it('ozeti medya ve alt kirilimiyla cikarir', async () => {
      const ozet = await ikisindeDe(tiklamaUygulamalari, async (depo: TiklamaDeposu) => {
        await doldur(depo);
        return depo.ozetle(KIRACI, {});
      });

      expect(ozet.map((o) => [o.ortakAnahtari, o.toplam])).toEqual([['ortak-a', 3], ['ortak-b', 2]]);
      expect(ozet[0].medyaBazinda).toEqual([{ medyaId: 'm1', sayi: 2 }, { medyaId: 'm2', sayi: 1 }]);
      expect(ozet[0].altBazinda).toEqual([
        { anahtar: 'alt1', deger: 'facebook', sayi: 2 },
        { anahtar: 'alt1', deger: 'google', sayi: 1 },
        { anahtar: 'alt2', deger: 'x', sayi: 1 },
      ]);
      // c5'in bos `alt1`'i sayilmadi; c4'un medyasi null olarak gruplandi.
      expect(ozet[1].altBazinda).toEqual([]);
      expect(ozet[1].medyaBazinda).toEqual([{ medyaId: null, sayi: 2 }]);
    });
  });

  describe('olcumler', () => {
    it('ayni gun ve ortak icin UZERINE yazar, satir cogaltmaz', async () => {
      const sonuc = await ikisindeDe(olcumUygulamalari, async (depo: OlcumDeposu) => {
        await depo.yaz(KIRACI, [olcum({ gun: '2026-08-01', ortakAnahtari: 'a', ggr: 100 })], new Date('2026-08-01T00:00:00Z'));
        await depo.yaz(KIRACI, [olcum({ gun: '2026-08-01', ortakAnahtari: 'a', ggr: 250 })], new Date('2026-08-02T00:00:00Z'));
        return (await depo.listele(KIRACI, {})).map((o) => [o.gun, o.ortakAnahtari, o.ggr]);
      });
      expect(sonuc).toEqual([['2026-08-01', 'a', 250]]);
    });

    it('itme kaydini sonradan gelen cekme EZMEZ', async () => {
      const sonuc = await ikisindeDe(olcumUygulamalari, async (depo: OlcumDeposu) => {
        await depo.yaz(KIRACI, [olcum({ gun: '2026-08-01', ortakAnahtari: 'a', ggr: 500, kaynak: 'itme' })], new Date());
        await depo.yaz(KIRACI, [olcum({ gun: '2026-08-01', ortakAnahtari: 'a', ggr: 10, kaynak: 'cekme' })], new Date());
        return (await depo.listele(KIRACI, {})).map((o) => [o.ggr, o.kaynak]);
      });
      expect(sonuc).toEqual([[500, 'itme']]);
    });

    it('ayni parti icinde tekrar eden gunu teke indirir', async () => {
      const sonuc = await ikisindeDe(olcumUygulamalari, async (depo: OlcumDeposu) => {
        const yazilan = await depo.yaz(KIRACI, [
          olcum({ gun: '2026-08-01', ortakAnahtari: 'a', ggr: 1 }),
          olcum({ gun: '2026-08-01', ortakAnahtari: 'a', ggr: 2 }),
        ], new Date());
        return { yazilan, satirlar: (await depo.listele(KIRACI, {})).map((o) => o.ggr) };
      });
      expect(sonuc).toEqual({ yazilan: 1, satirlar: [2] });
    });

    it('ftd null ile 0 arasindaki farki korur', async () => {
      const sonuc = await ikisindeDe(olcumUygulamalari, async (depo: OlcumDeposu) => {
        await depo.yaz(KIRACI, [
          olcum({ gun: '2026-08-01', ortakAnahtari: 'a', ftdSayisi: null }),
          olcum({ gun: '2026-08-01', ortakAnahtari: 'b', ftdSayisi: 0 }),
        ], new Date());
        return (await depo.listele(KIRACI, {})).map((o) => [o.ortakAnahtari, o.ftdSayisi]);
      });
      expect(sonuc).toEqual([['a', null], ['b', 0]]);
    });

    it('gun araligini iki uctan da kapsar ve gun-ortak sirasiyla dondurur', async () => {
      const sonuc = await ikisindeDe(olcumUygulamalari, async (depo: OlcumDeposu) => {
        await depo.yaz(KIRACI, [
          olcum({ gun: '2026-08-03', ortakAnahtari: 'b' }),
          olcum({ gun: '2026-08-01', ortakAnahtari: 'z' }),
          olcum({ gun: '2026-08-03', ortakAnahtari: 'a' }),
          olcum({ gun: '2026-08-05', ortakAnahtari: 'c' }),
        ], new Date());
        return (await depo.listele(KIRACI, { start: '2026-08-01', end: '2026-08-03' }))
          .map((o) => `${o.gun}|${o.ortakAnahtari}`);
      });
      expect(sonuc).toEqual(['2026-08-01|z', '2026-08-03|a', '2026-08-03|b']);
    });

    it('son olculen gunu verir', async () => {
      const sonuc = await ikisindeDe(olcumUygulamalari, async (depo: OlcumDeposu) => {
        await depo.yaz(KIRACI, [
          olcum({ gun: '2026-07-30', ortakAnahtari: 'a' }),
          olcum({ gun: '2026-08-09', ortakAnahtari: 'a' }),
          olcum({ gun: '2026-08-02', ortakAnahtari: 'a' }),
        ], new Date());
        return depo.sonGun(KIRACI);
      });
      expect(sonuc).toBe('2026-08-09');
    });

    it('kayit yoksa son gun null', async () => {
      const sonuc = await ikisindeDe(olcumUygulamalari, (depo: OlcumDeposu) => depo.sonGun(KIRACI));
      expect(sonuc).toBeNull();
    });
  });

  describe('oyuncu eslesmeleri', () => {
    const eslesme = (lynonOyuncuId: string, ortakId: string, ek: Partial<OyuncuEslesmesi> = {}): OyuncuEslesmesi => ({
      lynonOyuncuId,
      ortakId,
      ortakAnahtari: ortakId.toUpperCase(),
      clickId: null,
      medyaId: null,
      alt: {},
      kaynak: 'kayit',
      olusturuldu: '2026-08-01T00:00:00.000Z',
      ...ek,
    });

    it('ilk kayit yazilir', async () => {
      const sonuc = await ikisindeDe(eslesmeUygulamalari, async (depo: EslesmeDeposu) => {
        const { eklendi, kayitli } = await depo.ekleYokSayarak(KIRACI, eslesme('p1', 'ortak-a'));
        return { eklendi, ortakId: kayitli.ortakId };
      });
      expect(sonuc).toEqual({ eklendi: true, ortakId: 'ortak-a' });
    });

    /** Kuralın kendisi. İki uygulamada da AYNI cevabı vermek zorunda. */
    it('mevcut kaydin uzerine YAZMAZ, mevcudu dondurur', async () => {
      const sonuc = await ikisindeDe(eslesmeUygulamalari, async (depo: EslesmeDeposu) => {
        await depo.ekleYokSayarak(KIRACI, eslesme('p2', 'ortak-a'));
        const ikinci = await depo.ekleYokSayarak(KIRACI, eslesme('p2', 'ortak-b', {
          olusturuldu: '2026-08-09T00:00:00.000Z',
        }));
        const kalan = await depo.bul(KIRACI, 'p2');
        return {
          eklendi: ikinci.eklendi,
          donen: ikinci.kayitli.ortakId,
          kalan: kalan?.ortakId,
          zaman: kalan?.olusturuldu,
        };
      });
      expect(sonuc).toEqual({
        eklendi: false,
        donen: 'ortak-a',
        kalan: 'ortak-a',
        zaman: '2026-08-01T00:00:00.000Z',
      });
    });

    describe('zorlaAta (admin gecersiz kilmasi)', () => {
      it('kayit yoksa olusturur, onceki kayit null doner', async () => {
        const sonuc = await ikisindeDe(eslesmeUygulamalari, async (depo: EslesmeDeposu) => {
          const { oncekiKayit } = await depo.zorlaAta(KIRACI, eslesme('p10', 'ortak-a'));
          const kalan = await depo.bul(KIRACI, 'p10');
          return { oncekiKayit, kalanOrtak: kalan?.ortakId };
        });
        expect(sonuc).toEqual({ oncekiKayit: null, kalanOrtak: 'ortak-a' });
      });

      /** ekleYokSayarak'in aksine burada IKINCI yazma KAZANIR. */
      it('mevcut kaydin UZERINE yazar ve eskisini dondurur', async () => {
        const sonuc = await ikisindeDe(eslesmeUygulamalari, async (depo: EslesmeDeposu) => {
          await depo.zorlaAta(KIRACI, eslesme('p11', 'ortak-a', { olusturuldu: '2026-08-01T00:00:00.000Z' }));
          const { oncekiKayit } = await depo.zorlaAta(
            KIRACI, eslesme('p11', 'ortak-b', { olusturuldu: '2026-08-09T00:00:00.000Z' }),
          );
          const kalan = await depo.bul(KIRACI, 'p11');
          return { oncekiOrtak: oncekiKayit?.ortakId, kalanOrtak: kalan?.ortakId, kalanZaman: kalan?.olusturuldu };
        });
        expect(sonuc).toEqual({ oncekiOrtak: 'ortak-a', kalanOrtak: 'ortak-b', kalanZaman: '2026-08-09T00:00:00.000Z' });
      });
    });

    it('ortaga gore suzer, en yeni once', async () => {
      const sonuc = await ikisindeDe(eslesmeUygulamalari, async (depo: EslesmeDeposu) => {
        await depo.ekleYokSayarak(KIRACI, eslesme('p1', 'ortak-a', { olusturuldu: '2026-08-01T00:00:00.000Z' }));
        await depo.ekleYokSayarak(KIRACI, eslesme('p2', 'ortak-b', { olusturuldu: '2026-08-02T00:00:00.000Z' }));
        await depo.ekleYokSayarak(KIRACI, eslesme('p3', 'ortak-a', { olusturuldu: '2026-08-03T00:00:00.000Z' }));
        return {
          hepsi: (await depo.listele(KIRACI, {})).map((e) => e.lynonOyuncuId),
          yalnizA: (await depo.listele(KIRACI, { ortakId: 'ortak-a' })).map((e) => e.lynonOyuncuId),
        };
      });
      expect(sonuc).toEqual({ hepsi: ['p3', 'p2', 'p1'], yalnizA: ['p3', 'p1'] });
    });

    it('cakismalari en yeniden eskiye tutar', async () => {
      const sonuc = await ikisindeDe(eslesmeUygulamalari, async (depo: EslesmeDeposu) => {
        for (const [i, zaman] of ['2026-08-01', '2026-08-03', '2026-08-02'].entries()) {
          await depo.cakismaYaz(KIRACI, {
            id: `c${i}`,
            lynonOyuncuId: 'p1',
            denenenOrtakId: 'ortak-b',
            denenenOrtakAnahtari: 'ORTAK-B',
            mevcutOrtakId: 'ortak-a',
            zaman: `${zaman}T00:00:00.000Z`,
          });
        }
        return (await depo.cakismalariListele(KIRACI, 10)).map((c) => c.zaman.slice(0, 10));
      });
      expect(sonuc).toEqual(['2026-08-03', '2026-08-02', '2026-08-01']);
    });

    /**
     * ASIL GUVENCE: kural VERITABANINDA.
     *
     * Uygulama katmanindaki her kontrol, iki surec ayni anda calistiginda
     * atlanabilir. Bu test, korumanin koda degil KISITA bagli oldugunu
     * gosteriyor: `ON CONFLICT` olmadan ikinci satir veritabani
     * tarafindan reddediliyor.
     *
     * Bu yuzden `ekleYokSayarak` "once bak, yoksa yaz" desenine
     * donerse -- ki gorunuste ayni isi yapar -- eszamanli iki bildirimde
     * hata firlatir; sessizce iki sahip uretmesi mumkun degil.
     *
     * NOT: gercek eszamanliligi tek surecte guvenilir sekilde
     * uretemedim; Promise.all ile denedigimde havuz baglantilari sirayla
     * acildigi icin cagrilar seri kosuyordu ve test, hatali bir
     * uygulamayi da geciriyordu. Onun yerine dayanak noktasi -- kisitin
     * kendisi -- dogrudan sinaniyor.
     */
    it('kisit ayni oyuncu icin IKINCI satiri reddediyor (postgres)', async () => {
      const vt = veritabani()!;
      const satir = (ortakId: string) => ({
        kiraci: KIRACI,
        lynonOyuncuId: 'kisit-testi',
        ortakId,
        ortakAnahtari: 'X',
        clickId: null,
        medyaId: null,
        alt: {},
        kaynak: 'kayit',
        olusturuldu: new Date('2026-08-01T00:00:00Z'),
      });

      await vt.insert(eslesmeTablosu).values(satir('ortak-a'));

      // Drizzle hatayi sariyor; asil sebep `cause`ta. Postgres 23505 =
      // unique_violation. Mesaj metnine bakmak, surum degisiminde
      // sessizce gecen bir teste donusurdu.
      const hata = await vt.insert(eslesmeTablosu).values(satir('ortak-b')).catch((h: unknown) => h);
      expect(hata).toBeInstanceOf(Error);
      expect((hata as { cause?: { code?: string } }).cause?.code).toBe('23505');

      const kalan = await vt.select().from(eslesmeTablosu);
      expect(kalan).toHaveLength(1);
      expect(kalan[0].ortakId).toBe('ortak-a');
    });

    /** Cok sayida talep sonunda TEK sahip birakmali. */
    it('ayni oyuncuya gelen bes talep tek sahip birakir (postgres)', async () => {
      const depo = postgresEslesmeDeposu();
      const sonuclar = await Promise.all(
        ['ortak-a', 'ortak-b', 'ortak-c', 'ortak-d', 'ortak-e'].map((ortakId) =>
          depo.ekleYokSayarak(KIRACI, eslesme('cok-talep', ortakId))),
      );

      expect(sonuclar.filter((s) => s.eklendi)).toHaveLength(1);
      // Kaybedenlerin hepsi AYNI kaydi gormeli; yoksa "kim sahip" sorusu
      // istege gore farkli cevaplanirdi.
      const sahip = sonuclar.find((s) => s.eklendi)!.kayitli.ortakId;
      expect(sonuclar.every((s) => s.kayitli.ortakId === sahip)).toBe(true);
      expect((await depo.bul(KIRACI, 'cok-talep'))?.ortakId).toBe(sahip);
    });
  });
});
