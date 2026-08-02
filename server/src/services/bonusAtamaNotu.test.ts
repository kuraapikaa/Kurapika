import { describe, expect, it } from 'vitest';
import { atamaNotu, nottanKural, nottanYatirimKimligi } from './bonusAtamaNotu.js';
import { oyunOduluMu } from './oyunHakkiGecmisi.js';

const t = new Date('2026-08-02T00:14:00Z'); // TR: 02.08.2026 03:14

describe('atama notu', () => {
  it('tüm alanlar yazılır', () => {
    const not = atamaNotu(
      {
        kaynak: 'panel',
        kuralAnahtari: 'kayip-bonusu',
        baslik: 'Kayıp Bonusu',
        talepEden: 'destek1',
        yatirimId: '98123',
        yatirimTutari: 1000,
        tutar: 250,
      },
      t,
    );
    expect(not).toContain('Kaynak: panel');
    expect(not).toContain('Kural: kayip-bonusu (Kayıp Bonusu)');
    expect(not).toContain('Talep: destek1');
    expect(not).toContain('Yatırım: #98123');
    expect(not).toContain('Tutar: 250 TRY');
    expect(not).toContain('02.08.2026');
  });

  it('boş alanlar tamamen atlanır', () => {
    const not = atamaNotu({ kuralAnahtari: 'x' }, t);
    expect(not).not.toContain('Yatırım');
    expect(not).not.toContain('Tutar');
    expect(not).not.toContain('Talep');
  });

  it('başlık anahtarla aynıysa tekrarlanmaz', () => {
    expect(atamaNotu({ kuralAnahtari: 'x', baslik: 'x' }, t)).toContain('Kural: x |');
  });

  it('sıfır ve negatif tutar yazılmaz', () => {
    const not = atamaNotu({ kuralAnahtari: 'x', tutar: 0, yatirimTutari: -5, yatirimId: '1' }, t);
    expect(not).not.toContain('Tutar:');
    expect(not).toContain('Yatırım: #1');
    expect(not).not.toContain('(');
  });

  it('200 karakteri aşmaz', () => {
    const not = atamaNotu(
      { kuralAnahtari: 'k'.repeat(300), baslik: 'b'.repeat(300), talepEden: 'u'.repeat(300) },
      t,
    );
    expect(not.length).toBeLessThanOrEqual(200);
  });
});

describe('geri okuma', () => {
  it('yatırım kimliği geri okunur', () => {
    const not = atamaNotu({ kuralAnahtari: 'x', yatirimId: '98123', yatirimTutari: 1000 }, t);
    expect(nottanYatirimKimligi(not)).toBe('98123');
  });

  it('kural anahtarı geri okunur', () => {
    const not = atamaNotu({ kuralAnahtari: 'kayip-bonusu', baslik: 'Kayıp Bonusu' }, t);
    expect(nottanKural(not)).toBe('kayip-bonusu');
  });

  it('elle yazılmış nottan kimlik uydurulmaz', () => {
    expect(nottanYatirimKimligi('Musteri telafisi')).toBeNull();
    expect(nottanKural('Musteri telafisi')).toBeNull();
    expect(nottanYatirimKimligi(null)).toBeNull();
  });
});

describe('önek korunması', () => {
  /**
   * oyunHakkiGecmisi.oyunOduluMu bu oneki ariyor; geriye donuk oyun hakki
   * eslestirmesi buna dayaniyor. Not zenginlestirilirken bozulmamali.
   */
  it('oyun ödülü öneki tanınmaya devam eder', () => {
    const not = atamaNotu(
      { onek: 'Narcosbahis oyun ödülü: 50 TL', kaynak: 'oyun', talepEden: 'ayse', tutar: 50 },
      t,
    );
    expect(oyunOduluMu(not)).toBe(true);
    expect(not).toContain('Tutar: 50 TRY');
  });

  it('panel notu oyun ödülü sayılmaz', () => {
    expect(oyunOduluMu(atamaNotu({ kaynak: 'panel', kuralAnahtari: 'x' }, t))).toBe(false);
  });
});
