import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { geceHakedisiIsle, islenecekAylar } from './geceIsi.js';
import { bakiye, hareketEkle, hareketleriListele } from '../servisler/cuzdan.js';
import { donemOnayla } from '../servisler/hakedis.js';
import { planOlustur } from '../servisler/komisyon.js';
import { olcumleriYaz } from '../servisler/olcum.js';
import { ortakGuncelle, ortakOlustur } from '../servisler/ortaklar.js';
import { veritabaniniBaslat, veritabaniniKapat } from '../lib/veritabani.js';
import { testVeritabaniAc } from '../../test/testVeritabani.js';

/**
 * GECE HAKEDİŞ İŞİ.
 *
 * Buradaki her hata doğrudan para: eksik yazmak ortağın alacağını
 * yutar, fazla yazmak olmayan bir borcu ödetir.
 */

const varsaCalistir = String(process.env.TEST_DATABASE_URL || '').trim() ? describe : describe.skip;

const kiraci = () => `gece-${randomUUID().slice(0, 8)}`;

/** Gece işi "dünü" işlediği için saat 00:00'ı temsil eden an. */
const gece = (gun: string) => new Date(`${gun}T00:30:00+03:00`);

async function kurulum(k: string, ek: Record<string, unknown> = {}) {
  const plan = await planOlustur(k, {
    ad: 'Standart',
    tur: 'gelir-payi',
    gelirPayiYuzde: 30,
    yonetimGideriYuzde: 20,
    asgariOdeme: 0,
    varsayilan: true,
    ...ek,
  });
  const ortak = await ortakOlustur(k, {
    ad: 'Ortak A', eposta: 'a@ornek.test', parola: 'cok-guclu-parola', ortakAnahtari: 'ORT1',
  });
  await ortakGuncelle(k, ortak.id, { durum: 'onaylandi', planId: plan.id });
  return { plan, ortak };
}

const olcum = (gun: string, ggr: number) => ({
  gun, ortakAnahtari: 'ORT1',
  oyuncuSayisi: 5, aktifOyuncuSayisi: 3, yatirim: 0, cekim: 0,
  ggr, ftdSayisi: null, kaynak: 'cekme' as const,
});

varsaCalistir('gece hakedis isi', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = (await testVeritabaniAc('aff_test_gece'))!;
    await veritabaniniBaslat();
  });

  afterAll(async () => {
    await veritabaniniKapat();
    delete process.env.DATABASE_URL;
  });

  it('donem kazancini cuzdana yazar', async () => {
    const k = kiraci();
    const { ortak } = await kurulum(k);
    await olcumleriYaz(k, [olcum('2026-08-10', 10_000)]);

    const sonuc = await geceHakedisiIsle(k, gece('2026-08-11'));

    expect(sonuc.aylar).toEqual(['2026-08']);
    // 10.000 GGR - %20 gider = 8.000 net; %30 pay = 2.400
    expect(await bakiye(k, ortak.id)).toBe(2400);
    expect(sonuc.yazilanHareket).toBe(1);
  });

  it('ayni gece iki kez calisirsa iki kez yazmaz', async () => {
    const k = kiraci();
    const { ortak } = await kurulum(k);
    await olcumleriYaz(k, [olcum('2026-08-10', 10_000)]);

    await geceHakedisiIsle(k, gece('2026-08-11'));
    const ikinci = await geceHakedisiIsle(k, gece('2026-08-11'));

    expect(ikinci.yazilanHareket).toBe(0);
    expect(await bakiye(k, ortak.id)).toBe(2400);
  });

  /** Kademe ve asgari odeme DONEM kavrami; her gece ay yeniden hesaplanip FARK yaziliyor. */
  it('ertesi gece yalnizca FARKI yazar', async () => {
    const k = kiraci();
    const { ortak } = await kurulum(k);
    await olcumleriYaz(k, [olcum('2026-08-10', 10_000)]);
    await geceHakedisiIsle(k, gece('2026-08-11'));

    await olcumleriYaz(k, [olcum('2026-08-11', 5_000)]);
    const ikinciGece = await geceHakedisiIsle(k, gece('2026-08-12'));

    // Toplam 15.000 GGR -> 12.000 net -> 3.600 pay. Fark 1.200.
    expect(await bakiye(k, ortak.id)).toBe(3600);
    const hareketler = await hareketleriListele(k, { ortakId: ortak.id });
    expect(hareketler.map((h) => h.tutar).sort((a, b) => a - b)).toEqual([1200, 2400]);
    expect(ikinciGece.yazilanHareket).toBe(1);
  });

  it('gec gelen bir dusus negatif hareket yazar', async () => {
    const k = kiraci();
    const { ortak } = await kurulum(k);
    await olcumleriYaz(k, [olcum('2026-08-10', 10_000)]);
    await geceHakedisiIsle(k, gece('2026-08-11'));

    // Ayni gun icin duzeltilmis (dusuk) olcum; idempotent yazma uzerine yaziyor.
    await olcumleriYaz(k, [olcum('2026-08-10', 4_000)]);
    await geceHakedisiIsle(k, gece('2026-08-12'));

    // 4.000 -> 3.200 net -> 960 pay.
    expect(await bakiye(k, ortak.id)).toBe(960);
    const sonHareket = (await hareketleriListele(k, { ortakId: ortak.id }))[0];
    expect(sonHareket.tutar).toBe(-1440);
  });

  /**
   * ASIL TUZAK.
   *
   * `hakedis.toplam` icinde onceki donemden devreden ODEME de var.
   * Cuzdana onu da yazmak, gecen ayin kazancini ikinci kez
   * alacaklandirmak olurdu -- odenmemis kazanc zaten bakiyede duruyor.
   */
  it('onceki donemden devreden odemeyi IKINCI kez yazmaz', async () => {
    const k = kiraci();
    // Asgari odeme yuksek: temmuz kazanci odenmeyip agustosa devredecek.
    const { ortak } = await kurulum(k, { asgariOdeme: 100_000 });

    await olcumleriYaz(k, [olcum('2026-07-10', 10_000)]);
    await geceHakedisiIsle(k, gece('2026-07-11'));
    const temmuzBakiye = await bakiye(k, ortak.id);
    expect(temmuzBakiye).toBe(2400);

    // Donem onaylanmali ki devir bir sonraki aya tasinsin.
    await donemOnayla(k, '2026-07');

    await olcumleriYaz(k, [olcum('2026-08-10', 10_000)]);
    await geceHakedisiIsle(k, gece('2026-08-11'));

    // Agustosta YALNIZCA agustos kazanci eklenmeli: 2.400 + 2.400.
    // Devreden 2.400 tekrar yazilsaydi bakiye 7.200 olurdu.
    expect(await bakiye(k, ortak.id)).toBe(4800);
  });

  it('ayin ilk gunlerinde onceki ayi da isler', async () => {
    const k = kiraci();
    const { ortak } = await kurulum(k);
    await olcumleriYaz(k, [olcum('2026-07-31', 10_000)]);

    const sonuc = await geceHakedisiIsle(k, gece('2026-08-03'));
    expect(sonuc.aylar).toEqual(['2026-08', '2026-07']);
    expect(await bakiye(k, ortak.id)).toBe(2400);
  });

  it('onaysiz ortagin cuzdanina yazilmaz', async () => {
    const k = kiraci();
    const plan = await planOlustur(k, {
      ad: 'P', tur: 'gelir-payi', gelirPayiYuzde: 30, yonetimGideriYuzde: 0, asgariOdeme: 0, varsayilan: true,
    });
    const ortak = await ortakOlustur(k, {
      ad: 'Bekleyen', eposta: 'b@ornek.test', parola: 'cok-guclu-parola', ortakAnahtari: 'ORT1',
    });
    await ortakGuncelle(k, ortak.id, { planId: plan.id });
    await olcumleriYaz(k, [olcum('2026-08-10', 10_000)]);

    await geceHakedisiIsle(k, gece('2026-08-11'));
    expect(await bakiye(k, ortak.id)).toBe(0);
  });

  it('olcum yoksa hicbir hareket yazilmaz', async () => {
    const k = kiraci();
    const { ortak } = await kurulum(k);
    const sonuc = await geceHakedisiIsle(k, gece('2026-08-11'));
    expect(sonuc.yazilanHareket).toBe(0);
    expect(await bakiye(k, ortak.id)).toBe(0);
  });

  it('elle odeme bakiyeden dusuyor', async () => {
    const k = kiraci();
    const { ortak } = await kurulum(k);
    await olcumleriYaz(k, [olcum('2026-08-10', 10_000)]);
    await geceHakedisiIsle(k, gece('2026-08-11'));

    await hareketEkle(k, {
      ortakId: ortak.id, tur: 'odeme', tutar: -2000,
      aciklama: 'Havale', kaynakAnahtari: `odeme:${randomUUID()}`,
    });

    expect(await bakiye(k, ortak.id)).toBe(400);
    // Odeme, hakedis tahakkukunu bozmamali: ertesi gece fark yine 0.
    const ertesi = await geceHakedisiIsle(k, gece('2026-08-12'));
    expect(ertesi.yazilanHareket).toBe(0);
    expect(await bakiye(k, ortak.id)).toBe(400);
  });
});

describe('islenecek aylar', () => {
  it('ayin ortasinda yalnizca o ay', () => {
    expect(islenecekAylar('2026-08-15')).toEqual(['2026-08']);
  });

  it('ayin ilk gunlerinde onceki ay da', () => {
    expect(islenecekAylar('2026-08-01')).toEqual(['2026-08', '2026-07']);
    expect(islenecekAylar('2026-08-05')).toEqual(['2026-08', '2026-07']);
  });

  it('altinci gunde artik geriye bakilmiyor', () => {
    expect(islenecekAylar('2026-08-06')).toEqual(['2026-08']);
  });

  it('yil siniri', () => {
    expect(islenecekAylar('2026-01-02')).toEqual(['2026-01', '2025-12']);
  });
});
