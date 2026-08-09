import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { uygulamaKur } from '../app.js';

/**
 * ROTA TESTLERİ.
 *
 * Servis testleri bir sınıf hatayı yakalamıyor: servis DOĞRU davranıp
 * rota yanlış olabiliyor. Bu dosyanın varlık sebebi tam olarak bu —
 * `parolaOzeti` servis listesinde maskeleniyordu ama oluşturma ucunda
 * ham dönüyordu ve hiçbir servis testi bunu göremezdi.
 */

let app: FastifyInstance;
let cerez = '';
const kiraci = `rota-${randomUUID().slice(0, 8)}`;

const basliklar = () => ({ cookie: cerez, 'x-kiraci': kiraci });

beforeAll(async () => {
  app = await uygulamaKur();
  const giris = await app.inject({
    method: 'POST',
    url: '/api/oturum/yonetici',
    headers: { 'x-kiraci': kiraci },
    payload: { kullanici: 'test-admin', parola: 'test-parolasi-uzun' },
  });
  expect(giris.statusCode).toBe(200);
  cerez = giris.headers['set-cookie']!.toString().split(';')[0];
});

afterAll(async () => {
  await app.close();
});

describe('yetki kapisi', () => {
  it('oturumsuz istek 401 doner', async () => {
    const yanit = await app.inject({ method: 'GET', url: '/api/yonetim/ortaklar' });
    expect(yanit.statusCode).toBe(401);
  });

  it('ortak oturumu yonetim ucuna giremez', async () => {
    const ortakGirisi = await app.inject({
      method: 'POST',
      url: '/api/oturum/basvuru',
      headers: { 'x-kiraci': kiraci },
      payload: { ad: 'Basvuran', eposta: 'basvuran@ornek.test', parola: 'cok-guclu-parola', ortakAnahtari: 'BASV1' },
    });
    expect(ortakGirisi.statusCode).toBe(201);

    const giris = await app.inject({
      method: 'POST',
      url: '/api/oturum/ortak',
      headers: { 'x-kiraci': kiraci },
      payload: { eposta: 'basvuran@ornek.test', parola: 'cok-guclu-parola' },
    });
    const ortakCerezi = giris.headers['set-cookie']!.toString().split(';')[0];

    const yanit = await app.inject({
      method: 'GET',
      url: '/api/yonetim/ortaklar',
      headers: { cookie: ortakCerezi },
    });
    expect(yanit.statusCode).toBe(401);
  });

  /**
   * Kiraci OTURUMDAN geliyor, baslıktan degil. Aksi halde gecerli bir
   * oturuma sahip biri basligi degistirerek baska kiracinin verisine
   * ulasirdi.
   */
  it('baslik oturumdaki kiraciyi ezemez', async () => {
    const yanit = await app.inject({
      method: 'GET',
      url: '/api/oturum',
      headers: { cookie: cerez, 'x-kiraci': 'baska-kiraci' },
    });
    expect(yanit.json().kiraci).toBe(kiraci);
  });
});

describe('ortak uclari', () => {
  it('parola ozetini ASLA dondurmez', async () => {
    const olustur = await app.inject({
      method: 'POST',
      url: '/api/yonetim/ortaklar',
      headers: basliklar(),
      payload: { ad: 'Sizinti Testi', eposta: 'sizinti@ornek.test', ortakAnahtari: 'SIZ1', parola: 'cok-guclu-parola' },
    });
    expect(olustur.statusCode).toBe(201);
    expect(olustur.body).not.toContain('scrypt$');
    expect(olustur.json()).not.toHaveProperty('parolaOzeti');

    const guncelle = await app.inject({
      method: 'PUT',
      url: `/api/yonetim/ortaklar/${olustur.json().id}`,
      headers: basliklar(),
      payload: { durum: 'onaylandi' },
    });
    expect(guncelle.body).not.toContain('scrypt$');

    const liste = await app.inject({ method: 'GET', url: '/api/yonetim/ortaklar', headers: basliklar() });
    expect(liste.body).not.toContain('scrypt$');
  });

  /** Basvuru acik bir uc; gonderilen `durum` dikkate ALINMAMALI. */
  it('basvuruda gonderilen durum yok sayilir', async () => {
    const yanit = await app.inject({
      method: 'POST',
      url: '/api/oturum/basvuru',
      headers: { 'x-kiraci': kiraci },
      payload: {
        ad: 'Kurnaz', eposta: 'kurnaz@ornek.test', parola: 'cok-guclu-parola',
        ortakAnahtari: 'KUR1', durum: 'onaylandi',
      },
    });
    expect(yanit.json().durum).toBe('bekliyor');
  });

  it('parolasiz basvuruyu reddeder', async () => {
    const yanit = await app.inject({
      method: 'POST',
      url: '/api/oturum/basvuru',
      headers: { 'x-kiraci': kiraci },
      payload: { ad: 'Parolasiz', eposta: 'parolasiz@ornek.test', ortakAnahtari: 'PAR1' },
    });
    expect(yanit.statusCode).toBe(400);
  });
});

describe('baglanti uclari', () => {
  it('adaptor katalogu sir degeri icermez', async () => {
    const yanit = await app.inject({ method: 'GET', url: '/api/yonetim/adaptorler', headers: basliklar() });
    const adaptorler = yanit.json().adaptorler as Array<{ ad: string; alanlar: Array<{ ad: string; sir: boolean }> }>;
    expect(adaptorler.map((a) => a.ad)).toContain('lynon');
    expect(adaptorler.find((a) => a.ad === 'lynon')!.alanlar.some((f) => f.ad === 'parola' && f.sir)).toBe(true);
  });

  it('kaydedilen sir maskelenmis doner', async () => {
    const yaz = await app.inject({
      method: 'POST',
      url: '/api/yonetim/baglantilar',
      headers: basliklar(),
      payload: {
        ad: 'Test bağlantısı',
        adaptor: 'lynon',
        ayar: {
          backofficeUrl: 'https://backoffice.ornek.test',
          idUrl: 'https://id.ornek.test',
          siteId: '99',
          kullanici: 'panel-botu',
          parola: 'gizli-parola-1234',
          otpSecret: 'JBSWY3DPEHPK3PXP',
        },
      },
    });
    expect(yaz.statusCode).toBe(200);
    expect(yaz.body).not.toContain('gizli-parola-1234');
    expect(yaz.body).not.toContain('JBSWY3DPEHPK3PXP');
    const eklenen = yaz.json().baglantilar.find((b: { ayar: { siteId: string } }) => b.ayar.siteId === '99');
    expect(eklenen.ayar.parola).toMatch(/1234$/);
  });

  /**
   * Panel sirlari maskeli gosteriyor. Bos gelen sir alani mevcut degeri
   * KORUMALI; aksi halde kullanici yalnizca site kimligini degistirmek
   * istediginde parola maskeyle ezilirdi.
   */
  it('bos gelen sir alani mevcut degeri korur', async () => {
    const ilk = await app.inject({
      method: 'POST',
      url: '/api/yonetim/baglantilar',
      headers: basliklar(),
      payload: {
        ad: 'Korunacak',
        adaptor: 'lynon',
        ayar: {
          backofficeUrl: 'https://backoffice.ornek.test',
          idUrl: 'https://id.ornek.test',
          siteId: '100',
          kullanici: 'panel-botu',
          parola: 'gizli-parola-1234',
        },
      },
    });
    const id = ilk.json().baglantilar.find((b: { ayar: { siteId: string } }) => b.ayar.siteId === '100').id;

    const yanit = await app.inject({
      method: 'PUT',
      url: `/api/yonetim/baglantilar/${id}`,
      headers: basliklar(),
      payload: {
        adaptor: 'lynon',
        ayar: {
          backofficeUrl: 'https://backoffice.ornek.test',
          idUrl: 'https://id.ornek.test',
          siteId: '100',
          kullanici: 'panel-botu',
          parola: '',
        },
      },
    });
    expect(yanit.statusCode).toBe(200);
    const guncellenen = yanit.json().baglantilar.find((b: { id: string }) => b.id === id);
    expect(guncellenen.ayar.siteId).toBe('100');
    expect(guncellenen.ayar.parola).toMatch(/1234$/);
  });

  it('zorunlu alan eksikse reddeder', async () => {
    const yanit = await app.inject({
      method: 'POST',
      url: '/api/yonetim/baglantilar',
      headers: basliklar(),
      payload: { adaptor: 'genel-rest', ayar: { temelUrl: 'https://api.ornek.test' } },
    });
    expect(yanit.statusCode).toBe(400);
  });
});

describe('tiklama ucu', () => {
  it('bilinmeyen anahtarda 404 doner ve sebep vermez', async () => {
    const yanit = await app.inject({ method: 'GET', url: '/c/YOKBOYLE', headers: { 'x-kiraci': kiraci } });
    expect(yanit.statusCode).toBe(404);
    expect(yanit.body).not.toContain('onay');
  });
});
