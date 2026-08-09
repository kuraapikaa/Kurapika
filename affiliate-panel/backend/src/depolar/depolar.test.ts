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
  oyuncuGunluk as gunlukTablosu,
  oyuncuGunlukRapor as gunlukRaporTablosu,
  tiklamalar as tiklamaTablosu,
} from '../lib/sema.js';
import { veritabani, veritabaniniBaslat, veritabaniniKapat } from '../lib/veritabani.js';
import {
  altLinkFinansOzeti,
  altLinkOyuncuListesi,
  ortakGunlukGeliriGuncelle,
  ortakOyuncuListesi,
  oyunculariIcinGelirleriGuncelle,
} from '../servisler/oyuncuEslesme.js';
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
  altLinkId: null,
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
    await vt!.delete(gunlukTablosu);
    await vt!.delete(gunlukRaporTablosu);
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

    /**
     * KESİN eşleştirme: `altLinkId`'ye göre, imza (medya+alt) TAHMİNİNE
     * göre değil. `altLinkId`'siz tıklamalar (c1..c5, yukarıdaki
     * `ornekler`) burada hiç görünmemeli.
     */
    it('altLinkId tasiyanlari kesin sayar, tasimayanlari yok sayar', async () => {
      const ozet = await ikisindeDe(tiklamaUygulamalari, async (depo: TiklamaDeposu) => {
        await doldur(depo);
        await depo.ekle(KIRACI, tiklama({
          clickId: 'l1', zaman: '2026-08-06T10:00:00.000Z', altLinkId: 'link-1',
        }));
        await depo.ekle(KIRACI, tiklama({
          clickId: 'l2', zaman: '2026-08-07T10:00:00.000Z', altLinkId: 'link-1',
        }));
        await depo.ekle(KIRACI, tiklama({
          clickId: 'l3', zaman: '2026-08-06T10:00:00.000Z', ortakAnahtari: 'ortak-b', altLinkId: 'link-2',
        }));
        return depo.altLinkOzeti(KIRACI);
      });

      expect(ozet.sort((a, b) => a.altLinkId.localeCompare(b.altLinkId))).toEqual([
        { altLinkId: 'link-1', sayi: 2, sonTiklama: '2026-08-07T10:00:00.000Z' },
        { altLinkId: 'link-2', sayi: 1, sonTiklama: '2026-08-06T10:00:00.000Z' },
      ]);
    });

    it('ortak anahtarina gore suzulebiliyor', async () => {
      const ozet = await ikisindeDe(tiklamaUygulamalari, async (depo: TiklamaDeposu) => {
        await depo.ekle(KIRACI, tiklama({ clickId: 'x1', zaman: '2026-08-06T10:00:00.000Z', altLinkId: 'link-a' }));
        await depo.ekle(KIRACI, tiklama({
          clickId: 'x2', zaman: '2026-08-06T10:00:00.000Z', ortakAnahtari: 'ortak-b', altLinkId: 'link-b',
        }));
        return depo.altLinkOzeti(KIRACI, 'ortak-a');
      });
      expect(ozet).toEqual([{ altLinkId: 'link-a', sayi: 1, sonTiklama: '2026-08-06T10:00:00.000Z' }]);
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
      baglantiId: 'varsayilan',
      lynonOyuncuId,
      ortakId,
      ortakAnahtari: ortakId.toUpperCase(),
      clickId: null,
      medyaId: null,
      altLinkId: null,
      kullaniciAdi: null,
      alt: {},
      kaynak: 'kayit',
      olusturuldu: '2026-08-01T00:00:00.000Z',
      kayitTarihi: null,
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

  /**
   * `altLinkFinansOzeti`, `oyuncuEslesmeleri` (hangi oyuncu hangi linkten
   * geldi) ile `oyuncuGunluk`u (webhook'tan katlanan gerçek tutarlar)
   * oyuncu kimliğinden birleştiriyor. Webhook borusu Postgres'e özel
   * olduğu için bu fonksiyonun tek gerçek testi burada, ilişkisel
   * tablolara doğrudan satır yazarak.
   */
  describe('altLinkFinansOzeti', () => {
    it('altLinkId tasiyan oyuncularin gunluk toplamlarini linke gore birlestirir', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values([
        {
          kiraci: KIRACI, lynonOyuncuId: 'p1', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
          clickId: null, medyaId: null, altLinkId: 'link-1', alt: {}, kaynak: 'kayit',
          olusturuldu: new Date('2026-08-01T00:00:00Z'),
        },
        {
          kiraci: KIRACI, lynonOyuncuId: 'p2', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
          clickId: null, medyaId: null, altLinkId: 'link-1', alt: {}, kaynak: 'kayit',
          olusturuldu: new Date('2026-08-01T00:00:00Z'),
        },
        {
          // altLinkId YOK: dogrudan /c/... linkinden geldi, raporda gorunmemeli.
          kiraci: KIRACI, lynonOyuncuId: 'p3', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
          clickId: null, medyaId: null, altLinkId: null, alt: {}, kaynak: 'kayit',
          olusturuldu: new Date('2026-08-01T00:00:00Z'),
        },
      ]);

      await vt.insert(gunlukTablosu).values([
        // p1: iki farkli gun, toplanmali.
        {
          kiraci: KIRACI, gun: '2026-08-01', oyuncuId: 'p1', yatirim: 100, cekim: 20, bahis: 0, kazanc: 0,
          olaySayisi: 1, guncellendi: new Date('2026-08-01T00:00:00Z'),
        },
        {
          kiraci: KIRACI, gun: '2026-08-02', oyuncuId: 'p1', yatirim: 50, cekim: 0, bahis: 0, kazanc: 0,
          olaySayisi: 1, guncellendi: new Date('2026-08-02T00:00:00Z'),
        },
        {
          kiraci: KIRACI, gun: '2026-08-01', oyuncuId: 'p2', yatirim: 30, cekim: 10, bahis: 0, kazanc: 0,
          olaySayisi: 1, guncellendi: new Date('2026-08-01T00:00:00Z'),
        },
        {
          kiraci: KIRACI, gun: '2026-08-01', oyuncuId: 'p3', yatirim: 999, cekim: 999, bahis: 0, kazanc: 0,
          olaySayisi: 1, guncellendi: new Date('2026-08-01T00:00:00Z'),
        },
      ]);

      const ozet = await altLinkFinansOzeti(KIRACI);

      expect(ozet).toEqual([{
        altLinkId: 'link-1',
        oyuncuSayisi: 2,
        yatirim: 180, // p1: 100+50, p2: 30
        cekim: 30, // p1: 20+0, p2: 10
      }]);
    });

    it('oyuncuGunluk satiri olmayan oyuncu icin sifir dondurur (fan-out yok)', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values({
        kiraci: KIRACI, lynonOyuncuId: 'p4', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
        clickId: null, medyaId: null, altLinkId: 'link-2', alt: {}, kaynak: 'kayit',
        olusturuldu: new Date('2026-08-01T00:00:00Z'),
      });

      expect(await altLinkFinansOzeti(KIRACI)).toEqual([
        { altLinkId: 'link-2', oyuncuSayisi: 1, yatirim: 0, cekim: 0 },
      ]);
    });

    it('rapor kaynagi webhook yoksa rakami saglar; ikisi de varsa TOPLANMAZ, buyuk olan esas alinir', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values([
        {
          // Yalnizca rapor kaynagi var -- webhook hic kurulmamis tenant senaryosu.
          kiraci: KIRACI, lynonOyuncuId: 'p7', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
          clickId: null, medyaId: null, altLinkId: 'link-rapor', alt: {}, kaynak: 'kayit',
          olusturuldu: new Date('2026-08-01T00:00:00Z'),
        },
        {
          // Ikisi de var: rapor DAHA BUYUK -- webhook'un henuz katlamadigi
          // bir kismi rapor zaten yakalamis olabilir.
          kiraci: KIRACI, lynonOyuncuId: 'p8', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
          clickId: null, medyaId: null, altLinkId: 'link-rapor', alt: {}, kaynak: 'kayit',
          olusturuldu: new Date('2026-08-01T00:00:00Z'),
        },
      ]);
      await vt.insert(gunlukTablosu).values([
        { kiraci: KIRACI, gun: '2026-08-01', oyuncuId: 'p8', yatirim: 40, cekim: 5, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date() },
      ]);
      await vt.insert(gunlukRaporTablosu).values([
        { kiraci: KIRACI, gun: '2026-08-01', oyuncuId: 'p7', yatirim: 300, cekim: 60, bahis: 0, kazanc: 0, guncellendi: new Date() },
        { kiraci: KIRACI, gun: '2026-08-01', oyuncuId: 'p8', yatirim: 400, cekim: 90, bahis: 0, kazanc: 0, guncellendi: new Date() },
      ]);

      expect(await altLinkFinansOzeti(KIRACI)).toEqual([{
        altLinkId: 'link-rapor',
        oyuncuSayisi: 2,
        // p7: rapor tek kaynak -> 300. p8: max(webhook 40, rapor 400) = 400.
        // 40+5'in TOPLANMADIGI (340 degil 400/300 toplami 700) burada dogrulaniyor.
        yatirim: 700,
        cekim: 150,
      }]);
    });

    it('ortakId ile suzulebiliyor', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values([
        {
          kiraci: KIRACI, lynonOyuncuId: 'p5', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
          clickId: null, medyaId: null, altLinkId: 'link-a', alt: {}, kaynak: 'kayit',
          olusturuldu: new Date('2026-08-01T00:00:00Z'),
        },
        {
          kiraci: KIRACI, lynonOyuncuId: 'p6', ortakId: 'ortak-b', ortakAnahtari: 'ORTAK-B',
          clickId: null, medyaId: null, altLinkId: 'link-b', alt: {}, kaynak: 'kayit',
          olusturuldu: new Date('2026-08-01T00:00:00Z'),
        },
      ]);

      expect(await altLinkFinansOzeti(KIRACI, 'ortak-a')).toEqual([
        { altLinkId: 'link-a', oyuncuSayisi: 1, yatirim: 0, cekim: 0 },
      ]);
    });
  });

  describe('altLinkOyuncuListesi', () => {
    it('linkten gelen oyunculari kullanici adi ve tutarlarla listeler', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values([
        {
          kiraci: KIRACI, lynonOyuncuId: 'p10', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
          clickId: null, medyaId: null, altLinkId: 'link-liste', kullaniciAdi: 'ahmet01', alt: {},
          kaynak: 'kayit', olusturuldu: new Date('2026-08-01T10:00:00Z'),
        },
        {
          // Kullanici adi bilinmiyor -- eski (bu ozellikten once) bir kayit olabilir.
          kiraci: KIRACI, lynonOyuncuId: 'p11', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
          clickId: null, medyaId: null, altLinkId: 'link-liste', kullaniciAdi: null, alt: {},
          kaynak: 'kayit', olusturuldu: new Date('2026-08-02T10:00:00Z'),
        },
        {
          // Baska bir link: listede gorunmemeli.
          kiraci: KIRACI, lynonOyuncuId: 'p12', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
          clickId: null, medyaId: null, altLinkId: 'baska-link', kullaniciAdi: 'baska', alt: {},
          kaynak: 'kayit', olusturuldu: new Date('2026-08-01T10:00:00Z'),
        },
      ]);
      await vt.insert(gunlukTablosu).values([
        { kiraci: KIRACI, gun: '2026-08-01', oyuncuId: 'p10', yatirim: 200, cekim: 50, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date() },
        { kiraci: KIRACI, gun: '2026-08-02', oyuncuId: 'p10', yatirim: 100, cekim: 0, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date() },
      ]);

      const liste = await altLinkOyuncuListesi(KIRACI, 'link-liste');
      // En yeni once.
      expect(liste).toEqual([
        { lynonOyuncuId: 'p11', kullaniciAdi: null, yatirim: 0, cekim: 0, olusturuldu: '2026-08-02T10:00:00.000Z', kayitTarihi: null },
        { lynonOyuncuId: 'p10', kullaniciAdi: 'ahmet01', yatirim: 300, cekim: 50, olusturuldu: '2026-08-01T10:00:00.000Z', kayitTarihi: null },
      ]);
    });

    it('webhook hic veri vermemisse rapor kaynagindan gosterir', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values({
        kiraci: KIRACI, lynonOyuncuId: 'p13', ortakId: 'ortak-a', ortakAnahtari: 'ORTAK-A',
        clickId: null, medyaId: null, altLinkId: 'link-rapor-liste', kullaniciAdi: 'raporlu01', alt: {},
        kaynak: 'kayit', olusturuldu: new Date('2026-08-01T10:00:00Z'),
      });
      await vt.insert(gunlukRaporTablosu).values([
        { kiraci: KIRACI, gun: '2026-08-01', oyuncuId: 'p13', yatirim: 250, cekim: 40, bahis: 0, kazanc: 0, guncellendi: new Date() },
      ]);

      expect(await altLinkOyuncuListesi(KIRACI, 'link-rapor-liste')).toEqual([
        { lynonOyuncuId: 'p13', kullaniciAdi: 'raporlu01', yatirim: 250, cekim: 40, olusturuldu: '2026-08-01T10:00:00.000Z', kayitTarihi: null },
      ]);
    });

    it('esleseni olmayan link icin bos liste doner', async () => {
      expect(await altLinkOyuncuListesi(KIRACI, 'yok-boyle-link')).toEqual([]);
    });
  });

  /**
   * `ortakOyuncuListesi`, `altLinkOyuncuListesi`den farkli olarak
   * `altLinkId`'ye BAKMIYOR -- toplu affiliate gecisiyle (kullanici
   * adiyla) tasinan bir oyuncunun `altLinkId`'si hep `null`dur ve
   * `altLinkOyuncuListesi` onu hicbir zaman gostermez. Bu test tam o
   * senaryoyu kapsiyor: `altLinkId: null` olan bir satirin da listede
   * cikmasi gerekiyor.
   */
  describe('ortakOyuncuListesi', () => {
    it('altLinkId olsun olmasin ortaga esles mis TUM oyunculari listeler', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values([
        {
          // Toplu gecisle tasinan oyuncu: altLinkId YOK, tiklama gecmisi yok.
          // kayitTarihi, Lynon'dan bulunan GERCEK kayit ani -- `olusturuldu`
          // (gecis anindan) FARKLI olmali; ekran bunu tercih etmeli.
          kiraci: KIRACI, lynonOyuncuId: 'p20', ortakId: 'ortak-b', ortakAnahtari: 'ORTAK-B',
          clickId: null, medyaId: null, altLinkId: null, kullaniciAdi: 'gecis-kullanicisi', alt: {},
          kaynak: 'elle', olusturuldu: new Date('2026-08-03T10:00:00Z'), kayitTarihi: new Date('2019-05-01T00:00:00Z'),
        },
        {
          // Organik gelen oyuncu: altLinkId VAR.
          kiraci: KIRACI, lynonOyuncuId: 'p21', ortakId: 'ortak-b', ortakAnahtari: 'ORTAK-B',
          clickId: null, medyaId: null, altLinkId: 'link-organik', kullaniciAdi: 'organik01', alt: {},
          kaynak: 'kayit', olusturuldu: new Date('2026-08-01T10:00:00Z'),
        },
        {
          // Baska ortak: listede gorunmemeli.
          kiraci: KIRACI, lynonOyuncuId: 'p22', ortakId: 'ortak-c', ortakAnahtari: 'ORTAK-C',
          clickId: null, medyaId: null, altLinkId: null, kullaniciAdi: 'baska-ortagin-oyuncusu', alt: {},
          kaynak: 'elle', olusturuldu: new Date('2026-08-03T10:00:00Z'),
        },
      ]);
      await vt.insert(gunlukTablosu).values([
        { kiraci: KIRACI, gun: '2026-08-03', oyuncuId: 'p20', yatirim: 500, cekim: 120, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date() },
      ]);

      const liste = await ortakOyuncuListesi(KIRACI, 'ortak-b');
      // En yeni once.
      expect(liste).toEqual([
        {
          lynonOyuncuId: 'p20', kullaniciAdi: 'gecis-kullanicisi', yatirim: 500, cekim: 120,
          olusturuldu: '2026-08-03T10:00:00.000Z', kayitTarihi: '2019-05-01T00:00:00.000Z',
        },
        {
          lynonOyuncuId: 'p21', kullaniciAdi: 'organik01', yatirim: 0, cekim: 0,
          olusturuldu: '2026-08-01T10:00:00.000Z', kayitTarihi: null,
        },
      ]);
    });

    /**
     * TAM KULLANICININ BILDIRDIGI SENARYO: toplu gecisle tasinan bir
     * oyuncunun webhook'tan hicbir zaman verisi olmaz (Lynon webhook'u
     * hic kurulmamis olabilir) -- ama admin "Geçmiş GGR'yi doldur"
     * calistirdiginda (bkz. gecmisGGR.ts) rapor kaynagi doluyor ve bu
     * liste artik 0 degil gercek rakami gostermeli.
     */
    it('webhook hic kurulmamis olsa da rapor kaynagindan gercek rakami gosterir', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values({
        kiraci: KIRACI, lynonOyuncuId: 'p23', ortakId: 'ortak-d', ortakAnahtari: 'ORTAK-D',
        clickId: null, medyaId: null, altLinkId: null, kullaniciAdi: 'gecis-raporlu', alt: {},
        kaynak: 'elle', olusturuldu: new Date('2026-08-03T10:00:00Z'),
      });
      await vt.insert(gunlukRaporTablosu).values([
        { kiraci: KIRACI, gun: '2026-08-01', oyuncuId: 'p23', yatirim: 1000, cekim: 200, bahis: 0, kazanc: 0, guncellendi: new Date() },
        { kiraci: KIRACI, gun: '2026-08-02', oyuncuId: 'p23', yatirim: 500, cekim: 0, bahis: 0, kazanc: 0, guncellendi: new Date() },
      ]);

      expect(await ortakOyuncuListesi(KIRACI, 'ortak-d')).toEqual([{
        lynonOyuncuId: 'p23', kullaniciAdi: 'gecis-raporlu', yatirim: 1500, cekim: 200,
        olusturuldu: '2026-08-03T10:00:00.000Z', kayitTarihi: null,
      }]);
    });

    it('esleseni olmayan ortak icin bos liste doner', async () => {
      expect(await ortakOyuncuListesi(KIRACI, 'yok-boyle-ortak')).toEqual([]);
    });
  });

  /**
   * `ortakGunlukGeliriGuncelle`, webhook'tan gelen `oyuncuGunluk`u
   * `oyuncuEslesmeleri` ile birlestirip `olcumler`e `kaynak: 'itme'` ile
   * yaziyor -- Lynon'un BTag raporuna hic ihtiyac duymadan. Bu, panelin
   * kendi trafigini Lynon'un third-party affiliate kaydina hic katilmadan
   * dogru raporlayabilmesinin dayanagi.
   */
  describe('ortakGunlukGeliriGuncelle', () => {
    it('ortaga baglı oyuncularin gunluk toplamini olculere kaynak=itme ile yazar', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values([
        {
          kiraci: KIRACI, lynonOyuncuId: 'g1', ortakId: 'ortak-gelir', ortakAnahtari: 'ORTAK-GELIR',
          clickId: null, medyaId: null, altLinkId: null, alt: {}, kaynak: 'kayit',
          olusturuldu: new Date('2026-08-01T00:00:00Z'),
        },
        {
          kiraci: KIRACI, lynonOyuncuId: 'g2', ortakId: 'ortak-gelir', ortakAnahtari: 'ORTAK-GELIR',
          clickId: null, medyaId: null, altLinkId: null, alt: {}, kaynak: 'kayit',
          olusturuldu: new Date('2026-08-01T00:00:00Z'),
        },
      ]);
      await vt.insert(gunlukTablosu).values([
        { kiraci: KIRACI, gun: '2026-08-05', oyuncuId: 'g1', yatirim: 100, cekim: 10, bahis: 500, kazanc: 300, olaySayisi: 2, guncellendi: new Date() },
        { kiraci: KIRACI, gun: '2026-08-05', oyuncuId: 'g2', yatirim: 0, cekim: 0, bahis: 200, kazanc: 250, olaySayisi: 1, guncellendi: new Date() },
      ]);

      const sonuc = await ortakGunlukGeliriGuncelle(KIRACI, '2026-08-05', 'ortak-gelir', 'ORTAK-GELIR', new Date());
      expect(sonuc).toEqual({ yazildiMi: true, yatirim: 100, cekim: 10 });

      const satirlar = await vt.select().from(olcumTablosu);
      expect(satirlar).toHaveLength(1);
      expect(satirlar[0]).toMatchObject({
        kiraci: KIRACI, gun: '2026-08-05', ortakAnahtari: 'ORTAK-GELIR',
        oyuncuSayisi: 2, aktifOyuncuSayisi: 2,
        yatirim: 100, cekim: 10,
        ggr: 700 - 550, // toplam bahis - toplam kazanc = 150
        ftdSayisi: null, kaynak: 'itme',
      });
    });

    it('itme yazdiktan sonra gelen cekme (Lynon senkronu) onu EZMEZ', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values({
        kiraci: KIRACI, lynonOyuncuId: 'g3', ortakId: 'ortak-ezmez', ortakAnahtari: 'ORTAK-EZMEZ',
        clickId: null, medyaId: null, altLinkId: null, alt: {}, kaynak: 'kayit',
        olusturuldu: new Date('2026-08-01T00:00:00Z'),
      });
      await vt.insert(gunlukTablosu).values({
        kiraci: KIRACI, gun: '2026-08-06', oyuncuId: 'g3', yatirim: 50, cekim: 0, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date(),
      });

      await ortakGunlukGeliriGuncelle(KIRACI, '2026-08-06', 'ortak-ezmez', 'ORTAK-EZMEZ', new Date());

      const { olcumleriYaz } = await import('../servisler/olcum.js');
      await olcumleriYaz(KIRACI, [{
        gun: '2026-08-06', ortakAnahtari: 'ORTAK-EZMEZ', oyuncuSayisi: 999, aktifOyuncuSayisi: 999,
        yatirim: 0, cekim: 0, ggr: 0, ftdSayisi: 3, kaynak: 'cekme',
      }], new Date());

      const satirlar = await vt.select().from(olcumTablosu);
      // Cekme yok sayildi; itme deger korundu.
      expect(satirlar.find((s) => s.ortakAnahtari === 'ORTAK-EZMEZ')).toMatchObject({
        yatirim: 50, oyuncuSayisi: 1, kaynak: 'itme',
      });
    });

    it('o gun ortaga ait hic olay yoksa yazmaz', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values({
        kiraci: KIRACI, lynonOyuncuId: 'g4', ortakId: 'ortak-bos', ortakAnahtari: 'ORTAK-BOS',
        clickId: null, medyaId: null, altLinkId: null, alt: {}, kaynak: 'kayit',
        olusturuldu: new Date('2026-08-01T00:00:00Z'),
      });

      const sonuc = await ortakGunlukGeliriGuncelle(KIRACI, '2026-08-07', 'ortak-bos', 'ORTAK-BOS', new Date());
      expect(sonuc).toEqual({ yazildiMi: false, yatirim: 0, cekim: 0 });
      expect(await vt.select().from(olcumTablosu)).toHaveLength(0);
    });
  });

  /**
   * Kullanıcı adından toplu affiliate geçişi sonrası, transfer edilen
   * oyuncunun ÖNCEDEN birikmiş webhook günlerinin hedef ortağa hemen
   * yansıması bu fonksiyona dayanıyor (bkz. `topluAtama.ts`).
   */
  describe('oyunculariIcinGelirleriGuncelle', () => {
    it('transfer edilen oyuncunun onceki gunlerini YENI ortaga yazar', async () => {
      const vt = veritabani()!;
      // Oyuncu simdi 'ortak-yeni'ye ait ama 3 gun once (eski ortaktayken
      // ya da hic eslesme yokken) webhook verisi birikmis.
      await vt.insert(eslesmeTablosu).values({
        kiraci: KIRACI, lynonOyuncuId: 'tasinan-1', ortakId: 'ortak-yeni', ortakAnahtari: 'ORTAK-YENI',
        clickId: null, medyaId: null, altLinkId: null, alt: {}, kaynak: 'elle',
        olusturuldu: new Date('2026-08-08T00:00:00Z'),
      });
      await vt.insert(gunlukTablosu).values([
        { kiraci: KIRACI, gun: '2026-08-01', oyuncuId: 'tasinan-1', yatirim: 200, cekim: 0, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date() },
        { kiraci: KIRACI, gun: '2026-08-02', oyuncuId: 'tasinan-1', yatirim: 0, cekim: 50, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date() },
      ]);

      const sonuc = await oyunculariIcinGelirleriGuncelle(KIRACI, ['tasinan-1'], new Date());
      expect(sonuc).toEqual({ guncellenenOrtakGunu: 2 });

      const satirlar = await vt.select().from(olcumTablosu);
      expect(satirlar.map((s) => [s.gun, s.ortakAnahtari, s.yatirim, s.cekim]).sort()).toEqual([
        ['2026-08-01', 'ORTAK-YENI', 200, 0],
        ['2026-08-02', 'ORTAK-YENI', 0, 50],
      ]);
    });

    it('esleseni olmayan oyuncu icin bir sey yazmaz', async () => {
      const vt = veritabani()!;
      await vt.insert(gunlukTablosu).values({
        kiraci: KIRACI, gun: '2026-08-03', oyuncuId: 'yetim-1', yatirim: 500, cekim: 0, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date(),
      });

      const sonuc = await oyunculariIcinGelirleriGuncelle(KIRACI, ['yetim-1'], new Date());
      expect(sonuc).toEqual({ guncellenenOrtakGunu: 0 });
      expect(await vt.select().from(olcumTablosu)).toHaveLength(0);
    });

    it('webhook gunu hic yoksa bos doner', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values({
        kiraci: KIRACI, lynonOyuncuId: 'yeni-uye-1', ortakId: 'ortak-taze', ortakAnahtari: 'ORTAK-TAZE',
        clickId: null, medyaId: null, altLinkId: null, alt: {}, kaynak: 'elle',
        olusturuldu: new Date(),
      });

      const sonuc = await oyunculariIcinGelirleriGuncelle(KIRACI, ['yeni-uye-1'], new Date());
      expect(sonuc).toEqual({ guncellenenOrtakGunu: 0 });
      expect(await vt.select().from(olcumTablosu)).toHaveLength(0);
    });

    it('ayni gunde birden fazla transfer edilen oyuncuyu TEK satirda toplar', async () => {
      const vt = veritabani()!;
      await vt.insert(eslesmeTablosu).values([
        {
          kiraci: KIRACI, lynonOyuncuId: 'coklu-1', ortakId: 'ortak-coklu', ortakAnahtari: 'ORTAK-COKLU',
          clickId: null, medyaId: null, altLinkId: null, alt: {}, kaynak: 'elle', olusturuldu: new Date(),
        },
        {
          kiraci: KIRACI, lynonOyuncuId: 'coklu-2', ortakId: 'ortak-coklu', ortakAnahtari: 'ORTAK-COKLU',
          clickId: null, medyaId: null, altLinkId: null, alt: {}, kaynak: 'elle', olusturuldu: new Date(),
        },
      ]);
      await vt.insert(gunlukTablosu).values([
        { kiraci: KIRACI, gun: '2026-08-04', oyuncuId: 'coklu-1', yatirim: 100, cekim: 0, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date() },
        { kiraci: KIRACI, gun: '2026-08-04', oyuncuId: 'coklu-2', yatirim: 50, cekim: 0, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date() },
      ]);

      const sonuc = await oyunculariIcinGelirleriGuncelle(KIRACI, ['coklu-1', 'coklu-2'], new Date());
      // Ayni (gun, ortak) cifti tekillestirildi: 2 oyuncu ama 1 guncelleme.
      expect(sonuc).toEqual({ guncellenenOrtakGunu: 1 });

      const satirlar = await vt.select().from(olcumTablosu);
      expect(satirlar).toHaveLength(1);
      expect(satirlar[0]).toMatchObject({ gun: '2026-08-04', ortakAnahtari: 'ORTAK-COKLU', yatirim: 150, oyuncuSayisi: 2 });
    });
  });
});
