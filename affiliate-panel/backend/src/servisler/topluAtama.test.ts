import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BackofficeAdaptoru } from '../adaptorler/tur.js';
import { olcumler as olcumTablosu, oyuncuGunluk as gunlukTablosu } from '../lib/sema.js';
import { veritabani, veritabaniniBaslat, veritabaniniKapat } from '../lib/veritabani.js';
import { testVeritabaniAc } from '../../test/testVeritabani.js';
import { eslesmeBul, oyuncuyuEslestir } from './oyuncuEslesme.js';
import { ortakGuncelle, ortakOlustur } from './ortaklar.js';
import { kullaniciAdlariniAyikla, topluAtamaYap, TOPLU_ATAMA_LIMITI } from './topluAtama.js';

const kiraci = () => `test-${randomUUID().slice(0, 8)}`;

async function onayliOrtak(k: string, anahtar: string, ad = 'Ortak') {
  const ortak = await ortakOlustur(k, {
    ad, eposta: `${anahtar.toLowerCase()}@ornek.test`, parola: 'cok-guclu-parola', ortakAnahtari: anahtar,
  });
  await ortakGuncelle(k, ortak.id, { durum: 'onaylandi' });
  return ortak;
}

/**
 * SAHTE ADAPTÖR — gerçek Lynon bağlantısı olmadan servis mantığını
 * sınamak için. `oyuncular` haritası kullanıcı adından oyuncu kimliğine;
 * haritada olmayan bir ad "bulunamadı" sonucu üretir, tıpkı gerçek Lynon
 * aramasının eşleşmeyen bir sorguda yaptığı gibi.
 */
function sahteAdaptor(
  oyuncular: Record<string, string>,
  secenekler: { baglamaBasarisiz?: Set<string>; baglamaYok?: boolean } = {},
): BackofficeAdaptoru {
  return {
    tanimAdi: 'sahte',
    async dogrula() {
      return { baglandi: true, mesaj: 'ok' };
    },
    async gunuCek() {
      return [];
    },
    async oyuncuAra(kullaniciAdi: string) {
      const oyuncuId = oyuncular[kullaniciAdi.toLocaleLowerCase('tr-TR')];
      return oyuncuId ? { oyuncuId, kullaniciAdi } : null;
    },
    ...(secenekler.baglamaYok ? {} : {
      async oyuncuyuBagla(girdi: { oyuncuId: string; ortakAnahtari: string }) {
        if (secenekler.baglamaBasarisiz?.has(girdi.oyuncuId)) {
          throw new Error('Lynon: bağlantı zaman aşımına uğradı.');
        }
        return { basarili: true, mesaj: `Oyuncu ${girdi.oyuncuId}, ${girdi.ortakAnahtari} ortağına bağlandı.` };
      },
    }),
  };
}

describe('kullaniciAdlariniAyikla', () => {
  it('satir sonlariyla ayirir, bosluklari temizler', () => {
    expect(kullaniciAdlariniAyikla('oyuncu1\noyuncu2\n\noyuncu3').adlar).toEqual(['oyuncu1', 'oyuncu2', 'oyuncu3']);
  });

  it('virgul ve noktali virgulle de ayirir', () => {
    expect(kullaniciAdlariniAyikla('a, b; c').adlar).toEqual(['a', 'b', 'c']);
  });

  it('buyuk/kucuk harf duyarsiz tekrarlari eler', () => {
    const sonuc = kullaniciAdlariniAyikla('Oyuncu1\noyuncu1\nOYUNCU1\noyuncu2');
    expect(sonuc.adlar).toEqual(['Oyuncu1', 'oyuncu2']);
    expect(sonuc.tekrarSayisi).toBe(2);
  });

  it('bos girdi bos liste doner', () => {
    expect(kullaniciAdlariniAyikla('   \n  \n').adlar).toEqual([]);
  });
});

describe('topluAtamaYap', () => {
  it('bulunan kullanicilar hedef ortaga baglanir', async () => {
    const k = kiraci();
    const ortak = await onayliOrtak(k, 'ORT1');
    const adaptor = sahteAdaptor({ oyuncu1: '111', oyuncu2: '222' });

    const sonuc = await topluAtamaYap(k, adaptor, 'oyuncu1\noyuncu2', 'ORT1');

    expect(sonuc).toMatchObject({ toplam: 2, basarili: 2, bulunamadi: 0, hatali: 0 });
    expect(await eslesmeBul(k, '111')).toMatchObject({ ortakId: ortak.id });
    expect(await eslesmeBul(k, '222')).toMatchObject({ ortakId: ortak.id });
    // Adaptorun oyuncuAra'dan donen kullanici adi eslesmeye de gecmeli --
    // raporda opak lynonOyuncuId yerine okunur adi gostermenin dayanagi bu.
    expect(await eslesmeBul(k, '111')).toMatchObject({ kullaniciAdi: 'oyuncu1' });
  });

  it('bulunamayan kullanici ayri sayilir, digerlerini engellemez', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'ORT1');
    const adaptor = sahteAdaptor({ oyuncu1: '111' });

    const sonuc = await topluAtamaYap(k, adaptor, 'oyuncu1\nhayalet-kullanici', 'ORT1');

    expect(sonuc).toMatchObject({ toplam: 2, basarili: 1, bulunamadi: 1 });
    const bulunamayan = sonuc.satirlar.find((s) => s.kullaniciAdi === 'hayalet-kullanici');
    expect(bulunamayan?.durum).toBe('bulunamadi');
  });

  /**
   * ASIL DEGER: zaten baska bir ortakta olan bir oyuncu da tasinabilmeli
   * -- "geçiş" kelimesinin karsiligi bu.
   */
  it('baska ortaktaki oyuncuyu YENI ortaga tasir', async () => {
    const k = kiraci();
    const eski = await onayliOrtak(k, 'ORT1', 'Eski');
    const yeni = await onayliOrtak(k, 'ORT2', 'Yeni');
    await oyuncuyuEslestir(k, { lynonOyuncuId: '111', ref: 'ORT1' });

    const adaptor = sahteAdaptor({ oyuncu1: '111' });
    const sonuc = await topluAtamaYap(k, adaptor, 'oyuncu1', 'ORT2');

    expect(sonuc.satirlar[0]).toMatchObject({ durum: 'basarili', eslesmeDurumu: 'tasindi', oncekiOrtakId: eski.id });
    expect(await eslesmeBul(k, '111')).toMatchObject({ ortakId: yeni.id });
  });

  /**
   * Backoffice cagrisi basarisiz olursa satir 'hata' DEGIL 'basarili'
   * kalir -- ic esleme zaten dogru yapildi, yalnizca Lynon'un kendi
   * raporunun senkron olmadigi ayri bir alanda isaretlenir.
   */
  it('backoffice baglama basarisiz olsa da ic eslesme kalici olur', async () => {
    const k = kiraci();
    const ortak = await onayliOrtak(k, 'ORT1');
    const adaptor = sahteAdaptor({ oyuncu1: '111' }, { baglamaBasarisiz: new Set(['111']) });

    const sonuc = await topluAtamaYap(k, adaptor, 'oyuncu1', 'ORT1');

    expect(sonuc.satirlar[0]).toMatchObject({ durum: 'basarili', backofficeBasarili: false });
    expect(sonuc.satirlar[0].backofficeMesaji).toMatch(/zaman aşımı/i);
    expect(await eslesmeBul(k, '111')).toMatchObject({ ortakId: ortak.id });
  });

  it('adaptor oyuncuAra desteklemiyorsa reddedilir', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'ORT1');
    const adaptorArasiz: BackofficeAdaptoru = {
      tanimAdi: 'arasiz',
      async dogrula() { return { baglandi: true, mesaj: 'ok' }; },
      async gunuCek() { return []; },
    };
    await expect(topluAtamaYap(k, adaptorArasiz, 'oyuncu1', 'ORT1')).rejects.toThrow(/arama desteklemiyor/i);
  });

  it('bos kullanici listesi reddedilir', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'ORT1');
    const adaptor = sahteAdaptor({});
    await expect(topluAtamaYap(k, adaptor, '   ', 'ORT1')).rejects.toThrow(/en az bir/i);
  });

  it('bos ortak anahtari reddedilir', async () => {
    const adaptor = sahteAdaptor({ oyuncu1: '111' });
    await expect(topluAtamaYap(kiraci(), adaptor, 'oyuncu1', '')).rejects.toThrow(/ortakAnahtari/);
  });

  it('bilinmeyen ortak anahtari satir bazinda hata sayilir, tur durmaz', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'ORT1');
    const adaptor = sahteAdaptor({ oyuncu1: '111', oyuncu2: '222' });

    const sonuc = await topluAtamaYap(k, adaptor, 'oyuncu1\noyuncu2', 'YOK-ORTAK');

    expect(sonuc.hatali).toBe(2);
    expect(sonuc.satirlar.every((s) => s.durum === 'hata')).toBe(true);
  });

  /** Sinirin ustundeki bir liste tur baslamadan ONCE reddedilmeli. */
  it(`${TOPLU_ATAMA_LIMITI + 1} kullanici siniri asar, hicbiri islenmez`, async () => {
    const k = kiraci();
    await onayliOrtak(k, 'ORT1');
    const cok = Array.from({ length: TOPLU_ATAMA_LIMITI + 1 }, (_, i) => `oyuncu${i}`).join('\n');
    const adaptor = sahteAdaptor({});

    await expect(topluAtamaYap(k, adaptor, cok, 'ORT1')).rejects.toThrow(new RegExp(`en fazla ${TOPLU_ATAMA_LIMITI}`));
  });

  it('tekrar eden kullanici adlari bir kez islenir', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'ORT1');
    const adaptor = sahteAdaptor({ oyuncu1: '111' });

    const sonuc = await topluAtamaYap(k, adaptor, 'oyuncu1\nOyuncu1\nOYUNCU1', 'ORT1');

    expect(sonuc.toplam).toBe(1);
    expect(sonuc.tekrarSayisi).toBe(2);
  });
});

const varsaCalistir = String(process.env.TEST_DATABASE_URL || '').trim() ? describe : describe.skip;

/**
 * Toplu geçişin hedef ortağın ÖZETİNE de yansıdığını doğruluyor —
 * yalnızca eşleşme kaydının doğru olması yetmez, ortak sayfasında GGR
 * ve yatırım/çekim rakamlarını GÖREBİLMESİ de gerekiyor (bkz. dosya
 * başındaki `oyunculariIcinGelirleriGuncelle` çağrısı).
 */
varsaCalistir('topluAtamaYap: gecmis webhook verisini hedef ortaga yansitma', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = (await testVeritabaniAc('aff_test_toplu_atama'))!;
    await veritabaniniBaslat();
  });

  afterAll(async () => {
    await veritabaniniKapat();
    delete process.env.DATABASE_URL;
  });

  it('devredilen oyuncunun onceki gunu hedef ortagin ozetinde hemen gorunur', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'HEDEF1');
    const adaptor = sahteAdaptor({ devreden: '555' });

    // Oyuncu, toplu gecisten ONCE zaten webhook'tan biriken bir gune
    // sahip (baska bir baglamdan -- eslesme henuz yokken de olabilir).
    await veritabani()!.insert(gunlukTablosu).values({
      kiraci: k, gun: '2026-08-05', oyuncuId: '555',
      yatirim: 300, cekim: 20, bahis: 0, kazanc: 0, olaySayisi: 1, guncellendi: new Date(),
    });

    await topluAtamaYap(k, adaptor, 'devreden', 'HEDEF1');

    const satirlar = await veritabani()!.select().from(olcumTablosu).where(eq(olcumTablosu.kiraci, k));
    expect(satirlar).toHaveLength(1);
    expect(satirlar[0]).toMatchObject({
      gun: '2026-08-05', ortakAnahtari: 'HEDEF1', yatirim: 300, cekim: 20, kaynak: 'itme',
    });
  });

  it('webhook gecmisi olmayan oyuncu icin olcum satiri uretmez', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'HEDEF2');
    const adaptor = sahteAdaptor({ taze: '556' });

    await topluAtamaYap(k, adaptor, 'taze', 'HEDEF2');

    expect(await veritabani()!.select().from(olcumTablosu).where(eq(olcumTablosu.kiraci, k))).toHaveLength(0);
  });
});
