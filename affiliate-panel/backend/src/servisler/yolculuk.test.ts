import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { olcumleriYaz } from './olcum.js';
import { ortakOlustur } from './ortaklar.js';
import { oyuncuyuEslestir } from './oyuncuEslesme.js';
import { tiklamaKaydet } from './tiklama.js';
import { musteriYolculugu } from './yolculuk.js';

const kiraci = () => `yolculuk-${randomUUID().slice(0, 8)}`;

async function ortakKur(k: string, anahtar: string, simdi: Date) {
  return ortakOlustur(
    k,
    { ad: `Ortak ${anahtar}`, eposta: `${anahtar.toLowerCase()}@ornek.com`, ortakAnahtari: anahtar, durum: 'onaylandi' },
    simdi,
  );
}

const tik = (k: string, ortakAnahtari: string, referrer: string | null, zaman: Date) =>
  tiklamaKaydet(k, { ortakAnahtari, referrer }, zaman);

const olcumSatiri = (ortakAnahtari: string, gun: string, ftdSayisi: number | null) => ({
  gun,
  ortakAnahtari,
  oyuncuSayisi: 5,
  aktifOyuncuSayisi: 3,
  yatirim: 1000,
  cekim: 100,
  ggr: 500,
  ftdSayisi,
  kaynak: 'cekme' as const,
});

describe('musteri yolculugu', () => {
  it('veri yokken sıfır/null huniyle döner, hata fırlatmaz', async () => {
    const k = kiraci();
    const sonuc = await musteriYolculugu(k, { start: '2026-08-01', end: '2026-08-03' });
    expect(sonuc.toplam).toEqual({ tiklama: 0, kayit: 0, ilkYatirim: null, aktifOyuncu: 0 });
    expect(sonuc.donusum).toEqual({ tiklamaKayit: null, kayitIlkYatirim: null });
    expect(sonuc.kaynaklar).toEqual([]);
    expect(sonuc.gunluk).toHaveLength(3);
  });

  it('tanınmayan ortak anahtarı için kayıt sayısı sıfır döner, hata vermez', async () => {
    const k = kiraci();
    const sonuc = await musteriYolculugu(k, { start: '2026-08-01', end: '2026-08-01', ortakAnahtari: 'YOK' });
    expect(sonuc.toplam.kayit).toBe(0);
  });

  it('tıklama, kayıt ve ilk yatırımı doğru günlere yerleştirir', async () => {
    const k = kiraci();
    await ortakKur(k, 'ORT1', new Date('2026-08-01T09:00:00+03:00'));

    // Gun 1: 3 tiklama, 2 kayit, ftd olculdu (1).
    await tik(k, 'ORT1', 'https://www.instagram.com/x', new Date('2026-08-01T10:00:00+03:00'));
    await tik(k, 'ORT1', 'https://www.instagram.com/x', new Date('2026-08-01T11:00:00+03:00'));
    await tik(k, 'ORT1', null, new Date('2026-08-01T12:00:00+03:00'));
    await oyuncuyuEslestir(k, { lynonOyuncuId: 'p1', ref: 'ORT1' }, new Date('2026-08-01T13:00:00+03:00'));
    await oyuncuyuEslestir(k, { lynonOyuncuId: 'p2', ref: 'ORT1' }, new Date('2026-08-01T14:00:00+03:00'));
    await olcumleriYaz(k, [olcumSatiri('ORT1', '2026-08-01', 1)]);

    // Gun 2: 1 tiklama, 0 kayit, ftd olculdu (0).
    await tik(k, 'ORT1', 'https://t.me/kanal', new Date('2026-08-02T10:00:00+03:00'));
    await olcumleriYaz(k, [olcumSatiri('ORT1', '2026-08-02', 0)]);

    const sonuc = await musteriYolculugu(k, { start: '2026-08-01', end: '2026-08-02', ortakAnahtari: 'ORT1' });

    expect(sonuc.gunluk).toEqual([
      { gun: '2026-08-01', tiklama: 3, kayit: 2, ilkYatirim: 1 },
      { gun: '2026-08-02', tiklama: 1, kayit: 0, ilkYatirim: 0 },
    ]);
    // aktifOyuncu bir STOK degeri: gunler arasinda toplanmaz, ayni ortak
    // icin en yuksek gun alinir (bkz. olcum.ts'teki ozetle()) — iki gun
    // de 3 aktif oyuncu yazdigi icin toplam 6 degil 3.
    expect(sonuc.toplam).toEqual({ tiklama: 4, kayit: 2, ilkYatirim: 1, aktifOyuncu: 3 });
    // %50 kayit orani (2/4), %50 ilk yatirim orani (1/2).
    expect(sonuc.donusum).toEqual({ tiklamaKayit: 50, kayitIlkYatirim: 50 });
  });

  it('hicbir gun ilk yatirim olculmediyse toplam ve donusum null doner', async () => {
    const k = kiraci();
    await ortakKur(k, 'ORT1', new Date('2026-08-01T09:00:00+03:00'));
    await tik(k, 'ORT1', null, new Date('2026-08-01T10:00:00+03:00'));
    await oyuncuyuEslestir(k, { lynonOyuncuId: 'p1', ref: 'ORT1' }, new Date('2026-08-01T11:00:00+03:00'));
    await olcumleriYaz(k, [olcumSatiri('ORT1', '2026-08-01', null)]);

    const sonuc = await musteriYolculugu(k, { start: '2026-08-01', end: '2026-08-01', ortakAnahtari: 'ORT1' });
    expect(sonuc.gunluk[0]!.ilkYatirim).toBeNull();
    expect(sonuc.toplam.ilkYatirim).toBeNull();
    expect(sonuc.donusum.kayitIlkYatirim).toBeNull();
  });

  it('tiklama yoksa tiklama-kayit orani null doner, sifir DEGIL', async () => {
    const k = kiraci();
    await ortakKur(k, 'ORT1', new Date('2026-08-01T09:00:00+03:00'));
    await oyuncuyuEslestir(k, { lynonOyuncuId: 'p1', ref: 'ORT1' }, new Date('2026-08-01T11:00:00+03:00'));

    const sonuc = await musteriYolculugu(k, { start: '2026-08-01', end: '2026-08-01', ortakAnahtari: 'ORT1' });
    expect(sonuc.toplam.tiklama).toBe(0);
    expect(sonuc.donusum.tiklamaKayit).toBeNull();
  });

  it('iki ortak arasinda kayit sayimini karistirmaz', async () => {
    const k = kiraci();
    await ortakKur(k, 'ORT1', new Date('2026-08-01T09:00:00+03:00'));
    await ortakKur(k, 'ORT2', new Date('2026-08-01T09:00:00+03:00'));
    await oyuncuyuEslestir(k, { lynonOyuncuId: 'p1', ref: 'ORT1' }, new Date('2026-08-01T10:00:00+03:00'));
    await oyuncuyuEslestir(k, { lynonOyuncuId: 'p2', ref: 'ORT2' }, new Date('2026-08-01T10:00:00+03:00'));
    await oyuncuyuEslestir(k, { lynonOyuncuId: 'p3', ref: 'ORT2' }, new Date('2026-08-01T10:00:00+03:00'));

    const sonucOrt1 = await musteriYolculugu(k, { start: '2026-08-01', end: '2026-08-01', ortakAnahtari: 'ORT1' });
    const sonucTumu = await musteriYolculugu(k, { start: '2026-08-01', end: '2026-08-01' });

    expect(sonucOrt1.toplam.kayit).toBe(1);
    expect(sonucTumu.toplam.kayit).toBe(3);
  });

  it('kaynak kirilimini referrer alan adina gore gruplar ve yuzdeler', async () => {
    const k = kiraci();
    await ortakKur(k, 'ORT1', new Date('2026-08-01T09:00:00+03:00'));
    const zaman = new Date('2026-08-01T10:00:00+03:00');
    await tik(k, 'ORT1', 'https://www.instagram.com/a', zaman);
    await tik(k, 'ORT1', 'https://l.instagram.com/b', zaman);
    await tik(k, 'ORT1', 'https://t.me/kanal', zaman);
    await tik(k, 'ORT1', null, zaman); // dogrudan

    const sonuc = await musteriYolculugu(k, { start: '2026-08-01', end: '2026-08-01', ortakAnahtari: 'ORT1' });

    expect(sonuc.kaynaklar).toEqual([
      { kaynak: 'Instagram', tiklama: 2, yuzde: 50 },
      { kaynak: 'Doğrudan', tiklama: 1, yuzde: 25 },
      { kaynak: 'Telegram', tiklama: 1, yuzde: 25 },
    ]);
  });

  it('sekizden fazla kaynak varsa kalanini "Diger kaynaklar" satirinda toplar', async () => {
    const k = kiraci();
    await ortakKur(k, 'ORT1', new Date('2026-08-01T09:00:00+03:00'));
    const zaman = new Date('2026-08-01T10:00:00+03:00');
    for (let i = 0; i < 10; i += 1) {
      await tik(k, 'ORT1', `https://kaynak-${i}.example/`, zaman);
    }

    const sonuc = await musteriYolculugu(k, { start: '2026-08-01', end: '2026-08-01', ortakAnahtari: 'ORT1' });

    expect(sonuc.kaynaklar).toHaveLength(9);
    const digerSatiri = sonuc.kaynaklar.find((s) => s.kaynak === 'Diğer kaynaklar');
    expect(digerSatiri?.tiklama).toBe(2);
  });
});
