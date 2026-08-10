import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  ortakAnahtariNormalle,
  ortakGirisi,
  ortakGuncelle,
  ortakOlustur,
  ortaklariListele,
  onayliMi,
  onayZorunlu,
} from './ortaklar.js';

/** Her test kendi kiracısında; testler birbirinin verisini görmesin. */
const kiraci = () => `test-${randomUUID().slice(0, 8)}`;

const temel = {
  ad: 'Örnek Ortak',
  eposta: 'ortak@ornek.test',
  parola: 'cok-guclu-parola',
  ortakAnahtari: 'ORT1',
};

describe('ortak anahtari normallestirme', () => {
  it('adres tasimasini bozacak karakterleri atar', () => {
    expect(ortakAnahtariNormalle(' ORT 1&x ')).toBe('ORT1x');
  });

  it('48 karakterde keser', () => {
    expect(ortakAnahtariNormalle('a'.repeat(100))).toHaveLength(48);
  });
});

describe('ortak olusturma', () => {
  it('varsayilan durum bekliyor', async () => {
    const ortak = await ortakOlustur(kiraci(), temel);
    expect(ortak.durum).toBe('bekliyor');
    expect(onayliMi(ortak)).toBe(false);
  });

  it('parola ozeti saklanir, duz parola degil', async () => {
    const ortak = await ortakOlustur(kiraci(), temel);
    expect(ortak.parolaOzeti).not.toContain('cok-guclu-parola');
    expect(ortak.parolaOzeti?.startsWith('scrypt$')).toBe(true);
  });

  it('listede parola ozeti donmez', async () => {
    const k = kiraci();
    await ortakOlustur(k, temel);
    const liste = await ortaklariListele(k);
    expect(liste[0]).not.toHaveProperty('parolaOzeti');
    expect(liste[0].parolaKurulu).toBe(true);
  });

  it('kisa parolayi reddeder', async () => {
    await expect(ortakOlustur(kiraci(), { ...temel, parola: 'kisa' })).rejects.toThrow(/10/);
  });

  it('ayni anahtari ikinci kez kabul etmez', async () => {
    const k = kiraci();
    await ortakOlustur(k, temel);
    await expect(ortakOlustur(k, { ...temel, eposta: 'baska@ornek.test' })).rejects.toThrow(/izleme anahtarı/);
  });

  it('ayni epostayi ikinci kez kabul etmez', async () => {
    const k = kiraci();
    await ortakOlustur(k, temel);
    await expect(ortakOlustur(k, { ...temel, ortakAnahtari: 'ORT2' })).rejects.toThrow(/e-posta/);
  });

  it('gecersiz epostayi reddeder', async () => {
    await expect(ortakOlustur(kiraci(), { ...temel, eposta: 'eposta-degil' })).rejects.toThrow();
  });
});

describe('ortak girisi', () => {
  it('dogru bilgiyle girer', async () => {
    const k = kiraci();
    await ortakOlustur(k, temel);
    const ortak = await ortakGirisi(k, 'ORTAK@ORNEK.TEST', 'cok-guclu-parola');
    expect(ortak.ortakAnahtari).toBe('ORT1');
  });

  /**
   * "Eposta kayitli degil" ile "parola yanlis" ayrimi, hangi
   * epostalarin sistemde oldugunu disariya sayar. Ikisi de AYNI mesaji
   * donmeli.
   */
  it('bilinmeyen eposta ile yanlis parola ayni mesaji doner', async () => {
    const k = kiraci();
    await ortakOlustur(k, temel);
    const bilinmeyen = await ortakGirisi(k, 'yok@ornek.test', 'x').catch((h: Error) => h.message);
    const yanlis = await ortakGirisi(k, temel.eposta, 'yanlis-parola').catch((h: Error) => h.message);
    expect(bilinmeyen).toBe(yanlis);
  });

  it('bekleyen ortak girebilir', async () => {
    const k = kiraci();
    await ortakOlustur(k, temel);
    await expect(ortakGirisi(k, temel.eposta, temel.parola)).resolves.toBeTruthy();
  });

  it('askiya alinmis ortak giremez', async () => {
    const k = kiraci();
    const ortak = await ortakOlustur(k, temel);
    await ortakGuncelle(k, ortak.id, { durum: 'askida' });
    await expect(ortakGirisi(k, temel.eposta, temel.parola)).rejects.toThrow(/kapalı/);
  });
});

describe('onay/red zaman damgasi', () => {
  it('olusturmada bekliyor durumunda ikisi de null', async () => {
    const ortak = await ortakOlustur(kiraci(), temel);
    expect(ortak.onaylanmaTarihi).toBeNull();
    expect(ortak.reddedilmeTarihi).toBeNull();
  });

  it('onaylandi gecisinde onaylanmaTarihi dolar, reddedilmeTarihi bos kalir', async () => {
    const k = kiraci();
    const ortak = await ortakOlustur(k, temel);
    const guncel = await ortakGuncelle(k, ortak.id, { durum: 'onaylandi' });
    expect(guncel.onaylanmaTarihi).not.toBeNull();
    expect(guncel.reddedilmeTarihi).toBeNull();
  });

  it('reddedildi gecisinde reddedilmeTarihi dolar', async () => {
    const k = kiraci();
    const ortak = await ortakOlustur(k, temel);
    const guncel = await ortakGuncelle(k, ortak.id, { durum: 'reddedildi' });
    expect(guncel.reddedilmeTarihi).not.toBeNull();
    expect(guncel.onaylanmaTarihi).toBeNull();
  });

  it('ayni durumu tekrar yazmak tarihi ILERI KAYDIRMAZ', async () => {
    const k = kiraci();
    const ortak = await ortakOlustur(k, temel);
    const ilkOnay = await ortakGuncelle(k, ortak.id, { durum: 'onaylandi' });
    // Baska bir alani (plan) degistirirken govdede durum da AYNI deger
    // olarak gelirse -- yaygin bir istemci deseni -- karar ani sabit kalmali.
    const ikinciYazim = await ortakGuncelle(k, ortak.id, { durum: 'onaylandi', planId: null });
    expect(ikinciYazim.onaylanmaTarihi).toBe(ilkOnay.onaylanmaTarihi);
  });

  it('askiya alip yeniden onaylamak tarihi TAZELER', async () => {
    const k = kiraci();
    const ortak = await ortakOlustur(k, temel, new Date('2026-08-01T00:00:00Z'));
    const ilkOnay = await ortakGuncelle(k, ortak.id, { durum: 'onaylandi' }, new Date('2026-08-02T00:00:00Z'));
    await ortakGuncelle(k, ortak.id, { durum: 'askida' }, new Date('2026-08-03T00:00:00Z'));
    const yenidenOnay = await ortakGuncelle(k, ortak.id, { durum: 'onaylandi' }, new Date('2026-08-04T00:00:00Z'));
    expect(yenidenOnay.onaylanmaTarihi).not.toBe(ilkOnay.onaylanmaTarihi);
    expect(yenidenOnay.onaylanmaTarihi).toBe('2026-08-04T00:00:00.000Z');
  });
});

describe('onay kapisi', () => {
  it('onaysiz ortak izleme linki uretemez', async () => {
    const ortak = await ortakOlustur(kiraci(), temel);
    expect(() => onayZorunlu(ortak)).toThrow(/onaylanmadı/);
  });

  it('onayli ortak gecer', async () => {
    const k = kiraci();
    const ortak = await ortakOlustur(k, temel);
    const onayli = await ortakGuncelle(k, ortak.id, { durum: 'onaylandi' });
    expect(() => onayZorunlu(onayli)).not.toThrow();
  });
});
