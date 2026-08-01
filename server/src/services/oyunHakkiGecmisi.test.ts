import { describe, expect, it } from 'vitest';
import { gecmisiEslestir, oyunOduluMu, type GecmisOynama, type Yatirim } from './oyunHakkiGecmisi.js';

/**
 * Oyun haklarini geriye donuk isletmek.
 *
 * "Bir yatirim = bir hak" kurali yerel oynama kayitlarina bakiyor. Kural
 * yururluge girmeden once oynanan turlar bu kaydi tasimadigi icin eski
 * yatirimlar "kullanilmamis" gorunuyordu.
 *
 * Bu eslestirme kayitlara depositId yaziyor. Sayilar oyuncunun hakkini
 * KAPATIYOR; yanlis eslesme mesru oyuncuyu engeller, o yuzden her kural
 * ayri kilitleniyor.
 */

const o = (id: string, tarih: string, patch: Partial<GecmisOynama> = {}): GecmisOynama =>
  ({ id, username: 'ayse', tarih, ...patch });

const y = (id: string, tarih: string): Yatirim => ({ id, tarih });

describe('zamana göre eşleştirme', () => {
  it('oynamadan önceki EN YAKIN yatırıma bağlanır', () => {
    const sonuc = gecmisiEslestir(
      [o('p1', '2026-07-30T15:00:00Z')],
      [y('D1', '2026-07-30T09:00:00Z'), y('D2', '2026-07-30T14:00:00Z')],
    );
    expect(sonuc.satirlar[0].depositId).toBe('D2');
  });

  it('oynamadan SONRAKİ yatırım seçilmez', () => {
    const sonuc = gecmisiEslestir(
      [o('p1', '2026-07-30T10:00:00Z')],
      [y('D1', '2026-07-30T09:00:00Z'), y('D2', '2026-07-30T14:00:00Z')],
    );
    expect(sonuc.satirlar[0].depositId).toBe('D1');
  });

  it('tam aynı anda yapılan yatırım sayılır', () => {
    const sonuc = gecmisiEslestir([o('p1', '2026-07-30T10:00:00Z')], [y('D1', '2026-07-30T10:00:00Z')]);
    expect(sonuc.satirlar[0].depositId).toBe('D1');
  });

  it('yatırım sırası karışık gelse de doğru eşleşir', () => {
    const sonuc = gecmisiEslestir(
      [o('p1', '2026-07-30T15:00:00Z')],
      [y('D2', '2026-07-30T14:00:00Z'), y('D1', '2026-07-30T09:00:00Z')],
    );
    expect(sonuc.satirlar[0].depositId).toBe('D2');
  });
});

describe('eşleşemeyen kayıtlar', () => {
  it('oynamadan önce yatırım yoksa eşleşmez ve ENGEL OLUŞTURMAZ', () => {
    // Kanitlanamayan bir kullanim yuzunden oyuncuyu engellemek dogru degil.
    const sonuc = gecmisiEslestir([o('p1', '2026-07-30T10:00:00Z')], [y('D1', '2026-07-31T10:00:00Z')]);
    expect(sonuc.satirlar[0].depositId).toBeNull();
    expect(sonuc.satirlar[0].neden).toContain('yatırım yok');
    expect(sonuc.eslesmeyen).toBe(1);
    expect(sonuc.tuketilenYatirimlar).toEqual([]);
  });

  it('hiç yatırım yoksa hepsi eşleşmez', () => {
    const sonuc = gecmisiEslestir([o('p1', '2026-07-30T10:00:00Z')], []);
    expect(sonuc.eslesmeyen).toBe(1);
  });

  it('bozuk oynama tarihi nedeniyle eşleşmez', () => {
    const sonuc = gecmisiEslestir([o('p1', 'gecersiz')], [y('D1', '2026-07-30T09:00:00Z')]);
    expect(sonuc.satirlar[0].depositId).toBeNull();
    expect(sonuc.satirlar[0].neden).toContain('tarihi okunamadı');
  });

  it('bozuk yatırım tarihi o yatırımı devre dışı bırakır', () => {
    const sonuc = gecmisiEslestir([o('p1', '2026-07-30T10:00:00Z')], [{ id: 'D1', tarih: 'bozuk' }]);
    expect(sonuc.eslesmeyen).toBe(1);
  });
});

describe('tekrar çalıştırılabilirlik', () => {
  it('zaten bağlı kayda DOKUNULMAZ', () => {
    const sonuc = gecmisiEslestir(
      [o('p1', '2026-07-30T15:00:00Z', { depositId: 'ELDEN' })],
      [y('D1', '2026-07-30T09:00:00Z')],
    );
    expect(sonuc.atlanan).toBe(1);
    expect(sonuc.satirlar).toHaveLength(0);
  });

  it('karışık listede yalnızca bağlanmamışlar işlenir', () => {
    const sonuc = gecmisiEslestir(
      [
        o('p1', '2026-07-30T15:00:00Z', { depositId: 'D9' }),
        o('p2', '2026-07-30T16:00:00Z'),
      ],
      [y('D1', '2026-07-30T09:00:00Z')],
    );
    expect(sonuc.atlanan).toBe(1);
    expect(sonuc.eslesen).toBe(1);
  });
});

describe('yatırım tüketimi', () => {
  it('aynı yatırıma düşen iki oynama yatırımı TEK kez tüketir', () => {
    // Amac hakkin kapanmasi, sayim degil.
    const sonuc = gecmisiEslestir(
      [o('p1', '2026-07-30T15:00:00Z'), o('p2', '2026-07-30T16:00:00Z')],
      [y('D1', '2026-07-30T09:00:00Z')],
    );
    expect(sonuc.eslesen).toBe(2);
    expect(sonuc.tuketilenYatirimlar).toEqual(['D1']);
  });

  it('farklı yatırımlar ayrı ayrı tüketilir', () => {
    const sonuc = gecmisiEslestir(
      [o('p1', '2026-07-30T10:00:00Z'), o('p2', '2026-07-30T15:00:00Z')],
      [y('D1', '2026-07-30T09:00:00Z'), y('D2', '2026-07-30T14:00:00Z')],
    );
    expect(sonuc.tuketilenYatirimlar.sort()).toEqual(['D1', 'D2']);
  });
});

describe('bozuk girdi', () => {
  it('boş listeler çökmez', () => {
    expect(gecmisiEslestir([], [])).toMatchObject({ eslesen: 0, eslesmeyen: 0, atlanan: 0 });
    expect(gecmisiEslestir(undefined as never, undefined as never).satirlar).toEqual([]);
  });

  it('kimliksiz oynama atlanır', () => {
    const sonuc = gecmisiEslestir([{ id: '', username: 'a', tarih: '2026-07-30T10:00:00Z' }], []);
    expect(sonuc.satirlar).toHaveLength(0);
  });

  it('kimliksiz yatırım sayılmaz', () => {
    const sonuc = gecmisiEslestir([o('p1', '2026-07-30T10:00:00Z')], [{ id: '  ', tarih: '2026-07-30T09:00:00Z' }]);
    expect(sonuc.eslesmeyen).toBe(1);
  });
});

describe('oyun ödülü tanıma', () => {
  it('chargeBonusToPlayer notunu tanır', () => {
    expect(oyunOduluMu('Narcosbahis oyun ödülü: 50 TL Freespin')).toBe(true);
  });

  it('Türkçe karaktersiz yazım da tanınır', () => {
    expect(oyunOduluMu('Narcosbahis oyun odulu: X')).toBe(true);
  });

  it('başka atama nedeni tanınmaz', () => {
    expect(oyunOduluMu('Ertesi gün otomasyonu 2026-07-30')).toBe(false);
    expect(oyunOduluMu('Narcosbahis panel talebi / destek1')).toBe(false);
    expect(oyunOduluMu('')).toBe(false);
    expect(oyunOduluMu(null)).toBe(false);
  });
});
