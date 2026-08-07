import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  cakismalariListele,
  eslesmeBul,
  eslesmeleriListele,
  oyuncuyuEslestir,
} from './oyuncuEslesme.js';
import { ortakGuncelle, ortakOlustur } from './ortaklar.js';
import { tiklamaKaydet } from './tiklama.js';

/** Her test kendi kiracısında; testler birbirinin verisini görmesin. */
const kiraci = () => `test-${randomUUID().slice(0, 8)}`;

async function onayliOrtak(k: string, anahtar: string, ad = 'Ortak') {
  const ortak = await ortakOlustur(k, {
    ad,
    eposta: `${anahtar.toLowerCase()}@ornek.test`,
    parola: 'cok-guclu-parola',
    ortakAnahtari: anahtar,
  });
  await ortakGuncelle(k, ortak.id, { durum: 'onaylandi' });
  return ortak;
}

describe('oyuncu eslesmesi', () => {
  it('ortak anahtariyla eslesme kurar', async () => {
    const k = kiraci();
    const ortak = await onayliOrtak(k, 'ORT1');

    const sonuc = await oyuncuyuEslestir(k, { lynonOyuncuId: '90001', ref: 'ORT1' });

    expect(sonuc.durum).toBe('olusturuldu');
    expect(sonuc.eslesme.ortakId).toBe(ortak.id);
    expect(sonuc.eslesme.ortakAnahtari).toBe('ORT1');
    expect(await eslesmeBul(k, '90001')).toMatchObject({ ortakId: ortak.id });
  });

  /**
   * Tiklama kimligi tercih ediliyor: medya ve alt kanal yalnizca onda var.
   * Ortak bilgisi de tiklamadan aliniyor -- tiklama sunucunun kendi kaydi,
   * istek ise disaridan geliyor.
   */
  it('tiklama kimligiyle geldiginde kanal kirilimini de tasir', async () => {
    const k = kiraci();
    const ortak = await onayliOrtak(k, 'ORT1');
    const tiklama = await tiklamaKaydet(k, {
      ortakAnahtari: 'ORT1',
      medyaId: 'medya-7',
      sorgu: { sub1: 'facebook', sub2: 'tr' },
    });

    const sonuc = await oyuncuyuEslestir(k, { lynonOyuncuId: '90002', ref: tiklama.clickId });

    expect(sonuc.durum).toBe('olusturuldu');
    expect(sonuc.eslesme.ortakId).toBe(ortak.id);
    expect(sonuc.eslesme.clickId).toBe(tiklama.clickId);
    expect(sonuc.eslesme.medyaId).toBe('medya-7');
    expect(sonuc.eslesme.alt).toEqual({ sub1: 'facebook', sub2: 'tr' });
  });

  describe('ilk kayit kazanir', () => {
    it('baska ortak devralamaz, ilk sahip korunur', async () => {
      const k = kiraci();
      const birinci = await onayliOrtak(k, 'ORT1', 'Birinci');
      await onayliOrtak(k, 'ORT2', 'Ikinci');

      await oyuncuyuEslestir(k, { lynonOyuncuId: '90003', ref: 'ORT1' });
      const ikinci = await oyuncuyuEslestir(k, { lynonOyuncuId: '90003', ref: 'ORT2' });

      expect(ikinci.durum).toBe('baska-ortaga-ait');
      // Donen eslesme MEVCUT sahibi gosteriyor, talep edeni degil.
      expect(ikinci.eslesme.ortakId).toBe(birinci.id);
      expect(await eslesmeBul(k, '90003')).toMatchObject({ ortakId: birinci.id });
    });

    it('reddedilen talebi cakisma olarak yazar', async () => {
      const k = kiraci();
      const birinci = await onayliOrtak(k, 'ORT1', 'Birinci');
      const ikinci = await onayliOrtak(k, 'ORT2', 'Ikinci');

      await oyuncuyuEslestir(k, { lynonOyuncuId: '90004', ref: 'ORT1' });
      await oyuncuyuEslestir(k, { lynonOyuncuId: '90004', ref: 'ORT2' });

      const cakismalar = await cakismalariListele(k);
      expect(cakismalar).toHaveLength(1);
      expect(cakismalar[0]).toMatchObject({
        lynonOyuncuId: '90004',
        denenenOrtakId: ikinci.id,
        mevcutOrtakId: birinci.id,
      });
    });

    /**
     * S2S bildirimleri yeniden denenir. Ayni ortagin ayni oyuncuyu tekrar
     * bildirmesini cakisma saymak, her ag hatasini sahtecilik suphesine
     * cevirirdi.
     */
    it('ayni ortagin tekrari cakisma DEGILDIR', async () => {
      const k = kiraci();
      const ortak = await onayliOrtak(k, 'ORT1');

      await oyuncuyuEslestir(k, { lynonOyuncuId: '90005', ref: 'ORT1' });
      const tekrar = await oyuncuyuEslestir(k, { lynonOyuncuId: '90005', ref: 'ORT1' });

      expect(tekrar.durum).toBe('zaten-ayni-ortak');
      expect(tekrar.eslesme.ortakId).toBe(ortak.id);
      expect(await cakismalariListele(k)).toHaveLength(0);
    });

    it('ilk kaydin zamani ve kanali degismez', async () => {
      const k = kiraci();
      await onayliOrtak(k, 'ORT1');
      await onayliOrtak(k, 'ORT2');

      const ilk = await oyuncuyuEslestir(
        k, { lynonOyuncuId: '90006', ref: 'ORT1' }, new Date('2026-08-01T00:00:00Z'),
      );
      await oyuncuyuEslestir(
        k, { lynonOyuncuId: '90006', ref: 'ORT2' }, new Date('2026-08-09T00:00:00Z'),
      );

      expect((await eslesmeBul(k, '90006'))?.olusturuldu).toBe(ilk.eslesme.olusturuldu);
    });
  });

  describe('reddedilen girdiler', () => {
    it('onaysiz ortaga oyuncu baglanmaz', async () => {
      const k = kiraci();
      await ortakOlustur(k, {
        ad: 'Bekleyen', eposta: 'b@ornek.test', parola: 'cok-guclu-parola', ortakAnahtari: 'ORT9',
      });
      await expect(oyuncuyuEslestir(k, { lynonOyuncuId: '90007', ref: 'ORT9' }))
        .rejects.toThrow(/onaylı değil/i);
    });

    it('bilinmeyen ref reddedilir', async () => {
      await expect(oyuncuyuEslestir(kiraci(), { lynonOyuncuId: '90008', ref: 'YOK' }))
        .rejects.toThrow(/bulunamadı/i);
    });

    it('oyuncu kimligi zorunlu', async () => {
      const k = kiraci();
      await onayliOrtak(k, 'ORT1');
      await expect(oyuncuyuEslestir(k, { lynonOyuncuId: '  ', ref: 'ORT1' }))
        .rejects.toThrow(/lynonOyuncuId/);
    });

    it('ref zorunlu', async () => {
      await expect(oyuncuyuEslestir(kiraci(), { lynonOyuncuId: '90009', ref: '' }))
        .rejects.toThrow(/ref/);
    });
  });

  it('ortaga gore suzuluyor ve en yeni once donuyor', async () => {
    const k = kiraci();
    const a = await onayliOrtak(k, 'ORTA');
    await onayliOrtak(k, 'ORTB');

    await oyuncuyuEslestir(k, { lynonOyuncuId: '1', ref: 'ORTA' }, new Date('2026-08-01T00:00:00Z'));
    await oyuncuyuEslestir(k, { lynonOyuncuId: '2', ref: 'ORTB' }, new Date('2026-08-02T00:00:00Z'));
    await oyuncuyuEslestir(k, { lynonOyuncuId: '3', ref: 'ORTA' }, new Date('2026-08-03T00:00:00Z'));

    expect((await eslesmeleriListele(k)).map((e) => e.lynonOyuncuId)).toEqual(['3', '2', '1']);
    expect((await eslesmeleriListele(k, { ortakId: a.id })).map((e) => e.lynonOyuncuId)).toEqual(['3', '1']);
  });

  it('kiracilar birbirinin eslesmesini gormez', async () => {
    const bir = kiraci();
    const iki = kiraci();
    await onayliOrtak(bir, 'ORT1');
    await onayliOrtak(iki, 'ORT1');

    await oyuncuyuEslestir(bir, { lynonOyuncuId: '777', ref: 'ORT1' });

    expect(await eslesmeBul(iki, '777')).toBeNull();
    // Ayni oyuncu kimligi baska kiracida SERBEST: farkli Lynon sitesi,
    // farkli oyuncu.
    const digeri = await oyuncuyuEslestir(iki, { lynonOyuncuId: '777', ref: 'ORT1' });
    expect(digeri.durum).toBe('olusturuldu');
  });
});
