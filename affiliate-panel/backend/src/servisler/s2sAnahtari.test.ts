import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { anahtarDurumu, anahtarGecerliMi, anahtarSil, anahtarUret } from './s2sAnahtari.js';

const kiraci = () => `test-${randomUUID().slice(0, 8)}`;

describe('s2s anahtari', () => {
  it('uretilen anahtar dogrulanir', async () => {
    const k = kiraci();
    const anahtar = await anahtarUret(k);
    expect(anahtar).toMatch(/^affs2s_/);
    expect(await anahtarGecerliMi(k, anahtar)).toBe(true);
  });

  /**
   * Anahtar kurulu DEGILSE her istek reddedilmeli. "Kurulmamissa serbest"
   * davranisi, kurulumu unutulan bir kiracida ucu herkese acardi.
   */
  it('anahtar kurulu degilse her sey reddedilir', async () => {
    const k = kiraci();
    expect(await anahtarGecerliMi(k, 'ne-olursa')).toBe(false);
    expect(await anahtarGecerliMi(k, '')).toBe(false);
  });

  it('yanlis anahtar reddedilir', async () => {
    const k = kiraci();
    await anahtarUret(k);
    expect(await anahtarGecerliMi(k, 'affs2s_sahte')).toBe(false);
  });

  it('yeni uretim eskisini gecersiz kilar', async () => {
    const k = kiraci();
    const eski = await anahtarUret(k);
    const yeni = await anahtarUret(k);
    expect(await anahtarGecerliMi(k, eski)).toBe(false);
    expect(await anahtarGecerliMi(k, yeni)).toBe(true);
  });

  it('silinen anahtar calismaz', async () => {
    const k = kiraci();
    const anahtar = await anahtarUret(k);
    await anahtarSil(k);
    expect(await anahtarGecerliMi(k, anahtar)).toBe(false);
    expect((await anahtarDurumu(k)).kuruluMu).toBe(false);
  });

  it('bir kiracinin anahtari digerinde gecmez', async () => {
    const bir = kiraci();
    const iki = kiraci();
    const anahtar = await anahtarUret(bir);
    await anahtarUret(iki);
    expect(await anahtarGecerliMi(iki, anahtar)).toBe(false);
  });

  /** Duz anahtar hicbir yerde saklanmiyor; durum yalnizca ozet biliyor. */
  it('durum duz anahtari SIZDIRMAZ', async () => {
    const k = kiraci();
    const anahtar = await anahtarUret(k);
    const durum = await anahtarDurumu(k);
    expect(JSON.stringify(durum)).not.toContain(anahtar);
    expect(durum.kuruluMu).toBe(true);
    expect(durum.olusturuldu).toBeTruthy();
  });

  it('son kullanim zamani dogrulamada guncellenir', async () => {
    const k = kiraci();
    const anahtar = await anahtarUret(k);
    expect((await anahtarDurumu(k)).sonKullanim).toBeNull();

    await anahtarGecerliMi(k, anahtar, new Date('2026-08-09T10:00:00Z'));
    expect((await anahtarDurumu(k)).sonKullanim).toBe('2026-08-09T10:00:00.000Z');
  });

  it('basarisiz deneme son kullanimi guncellemez', async () => {
    const k = kiraci();
    await anahtarUret(k);
    await anahtarGecerliMi(k, 'affs2s_yanlis', new Date('2026-08-09T10:00:00Z'));
    expect((await anahtarDurumu(k)).sonKullanim).toBeNull();
  });
});
