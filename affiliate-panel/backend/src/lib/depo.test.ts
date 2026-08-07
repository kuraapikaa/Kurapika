import { describe, expect, it } from 'vitest';
import { degistir, diziOku, kayitOku, oku, yaz } from './depo.js';

type Liste = { version: 1; kayitlar: number[] };
const coz = (ham: unknown): Liste => ({ version: 1, kayitlar: diziOku<number>(kayitOku(ham).kayitlar) });

describe('belge deposu', () => {
  it('yazilani geri okur', async () => {
    await yaz('t1', 'ornek', { version: 1, kayitlar: [1, 2] });
    expect((await oku<Liste>('t1', 'ornek', coz)).kayitlar).toEqual([1, 2]);
  });

  it('kayit yoksa cozucunun varsayilanini doner', async () => {
    expect((await oku<Liste>('t-yok', 'ornek', coz)).kayitlar).toEqual([]);
  });

  /**
   * Eski surumde kaydedilmis, alani eksik bir belge `.filter`
   * cagrisinda patlardi. `coz` hem bos hem eksik girdiyi karsiliyor.
   */
  it('eksik alanli eski belgeyi normallestirir', async () => {
    await yaz('t2', 'ornek', { version: 1 });
    expect((await oku<Liste>('t2', 'ornek', coz)).kayitlar).toEqual([]);
  });

  /**
   * OKU-DEGISTIR-YAZ YARISI.
   *
   * Kilit olmasaydi es zamanli 20 yazma ayni listeyi okur, her biri
   * kendi kaydini ekler ve sonuncu digerlerini ezerdi. Tiklama
   * kaydinda bu her gun olurdu ve kayip tiklama geri getirilemez.
   */
  it('es zamanli degisikliklerde kayit kaybetmez', async () => {
    const isler = Array.from({ length: 20 }, (_, i) =>
      degistir<Liste, void>('t3', 'yaris', coz, (belge) => {
        belge.kayitlar.push(i);
      }));
    await Promise.all(isler);

    const sonuc = await oku<Liste>('t3', 'yaris', coz);
    expect(sonuc.kayitlar).toHaveLength(20);
    expect([...sonuc.kayitlar].sort((a, b) => a - b)).toEqual([...Array(20).keys()]);
  });

  it('degistirici hata verirse anahtari kalici kilitlemez', async () => {
    await expect(
      degistir<Liste, void>('t4', 'hata', coz, () => {
        throw new Error('patla');
      }),
    ).rejects.toThrow('patla');

    await degistir<Liste, void>('t4', 'hata', coz, (belge) => {
      belge.kayitlar.push(1);
    });
    expect((await oku<Liste>('t4', 'hata', coz)).kayitlar).toEqual([1]);
  });

  /** Anahtar dosya adina donusuyor; dizin gecisi kesilmeli. */
  it('kiraci anahtarindaki dizin gecisini temizler', async () => {
    await yaz('../../kacis', 'ornek', { version: 1, kayitlar: [9] });
    expect((await oku<Liste>('kacis', 'ornek', coz)).kayitlar).toEqual([9]);
  });
});
