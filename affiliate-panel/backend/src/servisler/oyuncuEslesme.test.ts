import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import type { BackofficeAdaptoru } from '../adaptorler/tur.js';
import {
  cakismalariListele,
  eslesmeBul,
  eslesmeleriListele,
  oyuncuyuEslestir,
  oyuncuyuYenidenAta,
  varsayilanEslesmeleriDagit,
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

  it('kullanici adi verilirse eslesmeyle birlikte saklar', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'ORT1');

    const sonuc = await oyuncuyuEslestir(k, { lynonOyuncuId: '90012', ref: 'ORT1', kullaniciAdi: 'ayse42' });

    expect(sonuc.eslesme.kullaniciAdi).toBe('ayse42');
    expect(await eslesmeBul(k, '90012')).toMatchObject({ kullaniciAdi: 'ayse42' });
  });

  it('kullanici adi verilmezse null kalir', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'ORT1');

    const sonuc = await oyuncuyuEslestir(k, { lynonOyuncuId: '90013', ref: 'ORT1' });

    expect(sonuc.eslesme.kullaniciAdi).toBeNull();
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

  /**
   * Alt link bazlı yatırım/çekim raporunun (bkz. `altLinkFinansOzeti`)
   * dayanağı: tıklamanın taşıdığı `altLinkId` eşleşmeye kopyalanmalı.
   */
  it('tiklama altLinkId tasiyorsa eslesmeye kopyalar', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'ORT1');
    const tiklama = await tiklamaKaydet(k, {
      ortakAnahtari: 'ORT1',
      medyaId: null,
      altLinkId: 'alt-link-1',
      sorgu: {},
    });

    const sonuc = await oyuncuyuEslestir(k, { lynonOyuncuId: '90010', ref: tiklama.clickId });

    expect(sonuc.eslesme.altLinkId).toBe('alt-link-1');
  });

  it('tiklamasiz (dogrudan ortak anahtariyla) eslesmede altLinkId null', async () => {
    const k = kiraci();
    await onayliOrtak(k, 'ORT1');
    const sonuc = await oyuncuyuEslestir(k, { lynonOyuncuId: '90011', ref: 'ORT1' });
    expect(sonuc.eslesme.altLinkId).toBeNull();
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

  describe('admin gecersiz kilmasi (oyuncuyuYenidenAta)', () => {
    it('kayit yoksa olusturur', async () => {
      const k = kiraci();
      const ortak = await onayliOrtak(k, 'ORT1');

      const sonuc = await oyuncuyuYenidenAta(k, { baglantiId: 'varsayilan', lynonOyuncuId: '80001', ortakAnahtari: 'ORT1' });

      expect(sonuc).toMatchObject({ durum: 'olusturuldu', oncekiOrtakId: null });
      expect(sonuc.eslesme.ortakId).toBe(ortak.id);
      expect(sonuc.eslesme.kaynak).toBe('elle');
      expect(await eslesmeBul(k, '80001')).toMatchObject({ ortakId: ortak.id });
    });

    /**
     * ASIL FARK: oyuncuyuEslestir'in aksine burada IKINCI cagri
     * KAZANIR. Admin eylemi icin dogru davranis bu -- "ilk kayit
     * kazanir" siperi yalnizca S2S bildirimleri icin.
     */
    it('baska ortaktaki oyuncuyu TASIR, oncekiOrtakId doner', async () => {
      const k = kiraci();
      const eski = await onayliOrtak(k, 'ORT1', 'Eski');
      const yeni = await onayliOrtak(k, 'ORT2', 'Yeni');

      await oyuncuyuEslestir(k, { lynonOyuncuId: '80002', ref: 'ORT1' });
      const sonuc = await oyuncuyuYenidenAta(k, { baglantiId: 'varsayilan', lynonOyuncuId: '80002', ortakAnahtari: 'ORT2' });

      expect(sonuc.durum).toBe('tasindi');
      expect(sonuc.oncekiOrtakId).toBe(eski.id);
      expect(sonuc.eslesme.ortakId).toBe(yeni.id);
      expect(await eslesmeBul(k, '80002')).toMatchObject({ ortakId: yeni.id });
    });

    it('tasima cakisma olarak yazilmaz -- bu bir hata degil, admin karari', async () => {
      const k = kiraci();
      await onayliOrtak(k, 'ORT1');
      await onayliOrtak(k, 'ORT2');

      await oyuncuyuEslestir(k, { lynonOyuncuId: '80003', ref: 'ORT1' });
      await oyuncuyuYenidenAta(k, { baglantiId: 'varsayilan', lynonOyuncuId: '80003', ortakAnahtari: 'ORT2' });

      expect(await cakismalariListele(k)).toHaveLength(0);
    });

    it('zaten bu ortaktaysa tasindi DEGIL, zaten-bu-ortakta doner', async () => {
      const k = kiraci();
      const ortak = await onayliOrtak(k, 'ORT1');
      await oyuncuyuEslestir(k, { lynonOyuncuId: '80004', ref: 'ORT1' });

      const sonuc = await oyuncuyuYenidenAta(k, { baglantiId: 'varsayilan', lynonOyuncuId: '80004', ortakAnahtari: 'ORT1' });

      expect(sonuc.durum).toBe('zaten-bu-ortakta');
      expect(sonuc.oncekiOrtakId).toBeNull();
      expect(sonuc.eslesme.ortakId).toBe(ortak.id);
    });

    it('onaysiz ortaga atama reddedilir', async () => {
      const k = kiraci();
      await ortakOlustur(k, {
        ad: 'Bekleyen', eposta: 'bekleyen@ornek.test', parola: 'cok-guclu-parola', ortakAnahtari: 'ORT9',
      });
      await expect(oyuncuyuYenidenAta(k, { baglantiId: 'varsayilan', lynonOyuncuId: '80005', ortakAnahtari: 'ORT9' }))
        .rejects.toThrow(/onaylı değil/i);
    });

    it('kullanici adi verilirse kaydeder', async () => {
      const k = kiraci();
      await onayliOrtak(k, 'ORT1');

      const sonuc = await oyuncuyuYenidenAta(k, { baglantiId: 'varsayilan', lynonOyuncuId: '80007', ortakAnahtari: 'ORT1', kullaniciAdi: 'mehmet99' });

      expect(sonuc.eslesme.kullaniciAdi).toBe('mehmet99');
      expect(await eslesmeBul(k, '80007')).toMatchObject({ kullaniciAdi: 'mehmet99' });
    });

    /**
     * Toplu gecis, oyuncuyu tasirken kullanici adi VERMEYEBILIR (arama
     * sonucu bazen bos donebilir) -- bu durumda daha once ogrenilmis
     * adi SILMEMELI, S2S kaydinin kazandigi bilgiyi kaybetmemek icin.
     */
    it('kullanici adi verilmezse mevcut adi KORUR', async () => {
      const k = kiraci();
      const eski = await onayliOrtak(k, 'ORT1', 'Eski');
      await onayliOrtak(k, 'ORT2', 'Yeni');
      await oyuncuyuEslestir(k, { lynonOyuncuId: '80008', ref: 'ORT1', kullaniciAdi: 'korunan-ad' });

      const sonuc = await oyuncuyuYenidenAta(k, { baglantiId: 'varsayilan', lynonOyuncuId: '80008', ortakAnahtari: 'ORT2' });

      expect(sonuc.eslesme.ortakId).not.toBe(eski.id);
      expect(sonuc.eslesme.kullaniciAdi).toBe('korunan-ad');
    });

    it('kayit tarihi verilirse kaydeder (gecis aninin UZERINE yazmaz)', async () => {
      const k = kiraci();
      await onayliOrtak(k, 'ORT1');

      const sonuc = await oyuncuyuYenidenAta(k, {
        baglantiId: 'varsayilan', lynonOyuncuId: '80009', ortakAnahtari: 'ORT1', kayitTarihi: '2019-05-01T00:00:00.000Z',
      });

      expect(sonuc.eslesme.kayitTarihi).toBe('2019-05-01T00:00:00.000Z');
      expect(sonuc.eslesme.olusturuldu).not.toBe('2019-05-01T00:00:00.000Z');
      expect(await eslesmeBul(k, '80009')).toMatchObject({ kayitTarihi: '2019-05-01T00:00:00.000Z' });
    });

    /** kullanici adindaki ayni korunma kurali: adaptor bu turda tarihi bulamadiysa oncekini SILME. */
    it('kayit tarihi verilmezse mevcut olani KORUR', async () => {
      const k = kiraci();
      const eski = await onayliOrtak(k, 'ORT1', 'Eski');
      await onayliOrtak(k, 'ORT2', 'Yeni');
      await oyuncuyuYenidenAta(k, {
        baglantiId: 'varsayilan', lynonOyuncuId: '80010', ortakAnahtari: 'ORT1', kayitTarihi: '2018-01-01T00:00:00.000Z',
      });

      const sonuc = await oyuncuyuYenidenAta(k, { baglantiId: 'varsayilan', lynonOyuncuId: '80010', ortakAnahtari: 'ORT2' });

      expect(sonuc.eslesme.ortakId).not.toBe(eski.id);
      expect(sonuc.eslesme.kayitTarihi).toBe('2018-01-01T00:00:00.000Z');
    });

    /**
     * ASIL GUVENCE: iki farkli Lynon sitesindeki ayni numarali oyuncu
     * kimligi FARKLI gercek oyunculardir -- ayni satirin ustune yazip
     * BIRINI KAYBETMEMELI.
     */
    it('ayni numarali ID iki farkli baglantida AYRI kayittir, birbirini EZMEZ', async () => {
      const k = kiraci();
      const a = await onayliOrtak(k, 'ORT1', 'Ortak A');
      const b = await onayliOrtak(k, 'ORT2', 'Ortak B');

      await oyuncuyuYenidenAta(k, { baglantiId: 'varsayilan', lynonOyuncuId: '90099', ortakAnahtari: 'ORT1' });
      const sonuc = await oyuncuyuYenidenAta(k, { baglantiId: 'site-b', lynonOyuncuId: '90099', ortakAnahtari: 'ORT2' });

      // Ikinci cagri, BIRINCININ ustune yazan bir "tasima" DEGIL -- yeni bir kayit.
      expect(sonuc.durum).toBe('olusturuldu');
      expect(sonuc.oncekiOrtakId).toBeNull();
      expect(await eslesmeBul(k, '90099', 'varsayilan')).toMatchObject({ ortakId: a.id, baglantiId: 'varsayilan' });
      expect(await eslesmeBul(k, '90099', 'site-b')).toMatchObject({ ortakId: b.id, baglantiId: 'site-b' });
    });

    it('bilinmeyen ortak anahtari reddedilir', async () => {
      await expect(oyuncuyuYenidenAta(kiraci(), { baglantiId: 'varsayilan', lynonOyuncuId: '80006', ortakAnahtari: 'YOK' }))
        .rejects.toThrow(/bulunamadı/i);
    });

    it('oyuncu kimligi zorunlu', async () => {
      const k = kiraci();
      await onayliOrtak(k, 'ORT1');
      await expect(oyuncuyuYenidenAta(k, { baglantiId: 'varsayilan', lynonOyuncuId: '  ', ortakAnahtari: 'ORT1' }))
        .rejects.toThrow(/lynonOyuncuId/);
    });
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

  describe('varsayilanEslesmeleriDagit', () => {
    /** `oyuncular`da olmayan bir ad/oyuncuId `null` döner -- gerçek Lynon aramasıyla aynı. */
    function sahteAramaAdaptoru(oyuncular: Record<string, string>): BackofficeAdaptoru {
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
          if (!oyuncuId) return null;
          return { oyuncuId, kullaniciAdi, kayitTarihi: null };
        },
      };
    }

    it('kullanici adi TEK bir baglantida bulunursa oraya tasir', async () => {
      const k = kiraci();
      const ortak = await onayliOrtak(k, 'ORT1');
      await oyuncuyuYenidenAta(k, {
        baglantiId: 'varsayilan', lynonOyuncuId: '50001', ortakAnahtari: 'ORT1', kullaniciAdi: 'gocOyuncusu',
      });

      const adaptorlar: Record<string, BackofficeAdaptoru> = {
        a: sahteAramaAdaptoru({ gocoyuncusu: '50001' }),
        b: sahteAramaAdaptoru({}),
      };
      const sonuc = await varsayilanEslesmeleriDagit(
        k, [{ id: 'a', ad: 'Site A' }, { id: 'b', ad: 'Site B' }], async (id) => adaptorlar[id],
      );

      expect(sonuc.incelenen).toBe(1);
      expect(sonuc.tasinan).toEqual([{ lynonOyuncuId: '50001', kullaniciAdi: 'gocOyuncusu', baglantiAdi: 'Site A' }]);
      expect(sonuc.belirsiz).toEqual([]);
      expect(await eslesmeBul(k, '50001', 'a')).toMatchObject({ ortakId: ortak.id, baglantiId: 'a' });
      expect(await eslesmeBul(k, '50001', 'varsayilan')).toBeNull();
    });

    it('hicbir baglantida bulunamazsa dokunmaz, belirsiz listesine duser', async () => {
      const k = kiraci();
      await onayliOrtak(k, 'ORT1');
      await oyuncuyuYenidenAta(k, {
        baglantiId: 'varsayilan', lynonOyuncuId: '50002', ortakAnahtari: 'ORT1', kullaniciAdi: 'siliniOyuncu',
      });

      const adaptorlar: Record<string, BackofficeAdaptoru> = { a: sahteAramaAdaptoru({}), b: sahteAramaAdaptoru({}) };
      const sonuc = await varsayilanEslesmeleriDagit(
        k, [{ id: 'a', ad: 'Site A' }, { id: 'b', ad: 'Site B' }], async (id) => adaptorlar[id],
      );

      expect(sonuc.tasinan).toEqual([]);
      expect(sonuc.belirsiz).toEqual([{
        lynonOyuncuId: '50002', kullaniciAdi: 'siliniOyuncu',
        sebep: 'hiçbir aktif bağlantıda bu kullanıcı adı/ID eşleşmesi bulunamadı',
      }]);
      // Bulunamadi -- kayit oldugu gibi 'varsayilan'da kalir, TAHMIN edilip baska yere yazilmaz.
      expect(await eslesmeBul(k, '50002', 'varsayilan')).toMatchObject({ baglantiId: 'varsayilan' });
    });

    it('birden fazla baglantida bulunursa (coliziyon) dokunmaz, belirsiz listesine duser', async () => {
      const k = kiraci();
      await onayliOrtak(k, 'ORT1');
      await oyuncuyuYenidenAta(k, {
        baglantiId: 'varsayilan', lynonOyuncuId: '50003', ortakAnahtari: 'ORT1', kullaniciAdi: 'ikiSiteliOyuncu',
      });

      const adaptorlar: Record<string, BackofficeAdaptoru> = {
        a: sahteAramaAdaptoru({ ikisitelioyuncu: '50003' }),
        b: sahteAramaAdaptoru({ ikisitelioyuncu: '50003' }),
      };
      const sonuc = await varsayilanEslesmeleriDagit(
        k, [{ id: 'a', ad: 'Site A' }, { id: 'b', ad: 'Site B' }], async (id) => adaptorlar[id],
      );

      expect(sonuc.tasinan).toEqual([]);
      expect(sonuc.belirsiz[0]).toMatchObject({ lynonOyuncuId: '50003', sebep: 'birden fazla bağlantıda bulundu: Site A, Site B' });
      expect(await eslesmeBul(k, '50003', 'varsayilan')).toMatchObject({ baglantiId: 'varsayilan' });
    });

    it('kullanici adi bilinmiyorsa otomatik doğrulanamaz, dokunmaz', async () => {
      const k = kiraci();
      await onayliOrtak(k, 'ORT1');
      // kullaniciAdi VERILMEDEN olusturulan bir eslesme -- eski webhook/S2S kayitlarinin cogunu temsil ediyor.
      await oyuncuyuEslestir(k, { lynonOyuncuId: '50004', ref: 'ORT1' });

      const adaptorlar: Record<string, BackofficeAdaptoru> = { a: sahteAramaAdaptoru({}) };
      const sonuc = await varsayilanEslesmeleriDagit(k, [{ id: 'a', ad: 'Site A' }], async (id) => adaptorlar[id]);

      expect(sonuc.tasinan).toEqual([]);
      expect(sonuc.belirsiz).toEqual([{
        lynonOyuncuId: '50004', kullaniciAdi: null, sebep: 'kullanıcı adı bilinmiyor, otomatik doğrulanamadı',
      }]);
    });

    it('zaten AKTIF bir baglantiya etiketli eslesmelere dokunmaz (orphan degil)', async () => {
      const k = kiraci();
      await onayliOrtak(k, 'ORT1');
      await oyuncuyuYenidenAta(k, {
        baglantiId: 'a', lynonOyuncuId: '50005', ortakAnahtari: 'ORT1', kullaniciAdi: 'zatenDogruSitede',
      });

      const adaptorlar: Record<string, BackofficeAdaptoru> = { a: sahteAramaAdaptoru({ zatendogrusitede: '50005' }) };
      const sonuc = await varsayilanEslesmeleriDagit(k, [{ id: 'a', ad: 'Site A' }], async (id) => adaptorlar[id]);

      expect(sonuc.incelenen).toBe(0);
      expect(sonuc.tasinan).toEqual([]);
    });

    it('hedefte zaten ayri bir kayit varsa tasimaz, belirsiz listesine duser', async () => {
      const k = kiraci();
      const a = await onayliOrtak(k, 'ORT1', 'Ortak A');
      const b = await onayliOrtak(k, 'ORT2', 'Ortak B');
      await oyuncuyuYenidenAta(k, {
        baglantiId: 'varsayilan', lynonOyuncuId: '50006', ortakAnahtari: 'ORT1', kullaniciAdi: 'cakisanOyuncu',
      });
      // Hedef baglantida AYNI lynonOyuncuId'ye sahip, BASKA bir kayit zaten var.
      await oyuncuyuYenidenAta(k, {
        baglantiId: 'site-a', lynonOyuncuId: '50006', ortakAnahtari: 'ORT2', kullaniciAdi: 'cakisanOyuncu',
      });

      const adaptorlar: Record<string, BackofficeAdaptoru> = { 'site-a': sahteAramaAdaptoru({ cakisanoyuncu: '50006' }) };
      const sonuc = await varsayilanEslesmeleriDagit(
        k, [{ id: 'site-a', ad: 'Site A' }], async (id) => adaptorlar[id],
      );

      expect(sonuc.tasinan).toEqual([]);
      expect(sonuc.belirsiz[0]).toMatchObject({
        lynonOyuncuId: '50006', sebep: 'Site A altında zaten ayrı bir kayıt var (orada ORT2, burada ORT1)',
      });
      // Ikisi de yerinde kalir -- hicbiri EZILMEDI.
      expect(await eslesmeBul(k, '50006', 'varsayilan')).toMatchObject({ ortakId: a.id });
      expect(await eslesmeBul(k, '50006', 'site-a')).toMatchObject({ ortakId: b.id });
    });
  });
});
