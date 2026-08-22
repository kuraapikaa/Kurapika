import { describe, expect, it } from 'vitest';
import { rutbeXp, VARSAYILAN_RUTBELER, type Rutbe } from '@/components/player/VipRutbeMerdiveni';
import { SEVIYE_BASINA_XP, sadakatIlerlemesi } from './sadakatIlerlemesi';

/**
 * VIP rütbe merdiveni, sadakat XP sistemiyle AYNI ölçüyü kullanmak
 * zorunda. Ayrışsalardı oyuncu 20. seviyede olup "Altın için 16. seviye
 * gerekli" yazarken rütbesi Gümüş görünürdü.
 */

const rutbe = (minLevel: number): Rutbe => ({ id: 'x', label: 'X', minLevel });

describe('rutbeXp', () => {
  it('XP eşiğini seviyeden türetir', () => {
    // Seviye 1 baslangictir: 0 XP.
    expect(rutbeXp(rutbe(1))).toBe(0);
    expect(rutbeXp(rutbe(6))).toBe(5 * SEVIYE_BASINA_XP);
    expect(rutbeXp(rutbe(16))).toBe(15 * SEVIYE_BASINA_XP);
  });

  it('geçersiz seviyede negatife düşmez', () => {
    expect(rutbeXp(rutbe(0))).toBe(0);
    expect(rutbeXp(rutbe(-5))).toBe(0);
  });
});

describe('merdiven ile sadakat sistemi tutarlı', () => {
  it('eşiğe denk gelen XP, o rütbenin seviyesini verir', () => {
    // Merdiven "Altın icin 15.000 XP" diyorsa, 15.000 XP'si olan oyuncu
    // GERCEKTEN 16. seviyede olmali.
    for (const r of VARSAYILAN_RUTBELER) {
      const xp = rutbeXp(r);
      expect(sadakatIlerlemesi(xp).seviye, r.label).toBe(r.minLevel);
    }
  });

  it('eşiğin bir XP altı, bir önceki seviyede kalır', () => {
    for (const r of VARSAYILAN_RUTBELER.filter((x) => x.minLevel > 1)) {
      expect(sadakatIlerlemesi(rutbeXp(r) - 1).seviye, r.label).toBe(r.minLevel - 1);
    }
  });
});

describe('varsayılan rütbeler', () => {
  it('seviyeye göre ARTAN sırada', () => {
    const seviyeler = VARSAYILAN_RUTBELER.map((r) => r.minLevel);
    expect([...seviyeler].sort((a, b) => a - b)).toEqual(seviyeler);
  });

  it('ilk rütbe 1. seviyeden başlar — kimse rütbesiz kalmasın', () => {
    expect(VARSAYILAN_RUTBELER[0].minLevel).toBe(1);
  });

  it('seviye aralıkları çakışmaz', () => {
    for (let i = 1; i < VARSAYILAN_RUTBELER.length; i += 1) {
      expect(VARSAYILAN_RUTBELER[i].minLevel).toBeGreaterThan(VARSAYILAN_RUTBELER[i - 1].minLevel);
    }
  });

  it('her rütbenin kimliği benzersiz', () => {
    const idler = VARSAYILAN_RUTBELER.map((r) => r.id);
    expect(new Set(idler).size).toBe(idler.length);
  });
});

describe('oyuncunun rütbesi', () => {
  /** Bileşendeki seçimle aynı kural: seviyeyi geçmeyen SON rütbe. */
  const rutbeBul = (seviye: number) =>
    VARSAYILAN_RUTBELER.reduce((m, r, i) => (seviye >= r.minLevel ? i : m), -1);

  it('aralık içindeki seviyede doğru rütbeyi verir', () => {
    expect(VARSAYILAN_RUTBELER[rutbeBul(1)].label).toBe('Bronz');
    expect(VARSAYILAN_RUTBELER[rutbeBul(5)].label).toBe('Bronz');
    expect(VARSAYILAN_RUTBELER[rutbeBul(6)].label).toBe('Gümüş');
    expect(VARSAYILAN_RUTBELER[rutbeBul(20)].label).toBe('Altın');
    expect(VARSAYILAN_RUTBELER[rutbeBul(999)].label).toBe('Efsane');
  });

  it('seviye 0 ise rütbe yok', () => {
    expect(rutbeBul(0)).toBe(-1);
  });
});
