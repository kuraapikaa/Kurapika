import { describe, expect, it } from 'vitest';
import { SEVIYE_BASINA_XP } from './sadakatIlerlemesi';
import {
  VARSAYILAN_SEVIYELER,
  oyuncununSeviyesi,
  seviyeUyarilari,
  seviyeXp,
  seviyeleriNormalize,
  seviyeyiNormalize,
  tierlerdenSeviyeler,
  type VipSeviye,
} from './vipSeviyeleri';

const seviye = (p: Partial<VipSeviye>): VipSeviye =>
  ({ id: 'x', label: 'X', minLevel: 1, perks: [], ...p });

describe('seviyeXp', () => {
  it('XP esigi minLevel den turetiliyor', () => {
    expect(seviyeXp({ minLevel: 1 })).toBe(0);
    expect(seviyeXp({ minLevel: 16 })).toBe(15 * SEVIYE_BASINA_XP);
  });

  it('bozuk minLevel en dusuk seviyeye dusuyor', () => {
    expect(seviyeXp({ minLevel: 0 })).toBe(0);
    expect(seviyeXp({ minLevel: -5 })).toBe(0);
    expect(seviyeXp({ minLevel: Number.NaN })).toBe(0);
  });
});

describe('oyuncununSeviyesi', () => {
  const liste = [
    seviye({ id: 'a', minLevel: 1 }),
    seviye({ id: 'b', minLevel: 6 }),
    seviye({ id: 'c', minLevel: 16 }),
  ];

  it('seviyesini gecmeyen SON kaydi seciyor', () => {
    expect(oyuncununSeviyesi(1, liste)).toBe(0);
    expect(oyuncununSeviyesi(5, liste)).toBe(0);
    expect(oyuncununSeviyesi(6, liste)).toBe(1);
    expect(oyuncununSeviyesi(99, liste)).toBe(2);
  });

  it('sirasiz liste de dogru calisiyor', () => {
    const karisik = [liste[2], liste[0], liste[1]];
    expect(oyuncununSeviyesi(6, karisik)).toBe(1);
  });

  it('hicbirine girmiyorsa -1', () => {
    expect(oyuncununSeviyesi(0, [seviye({ minLevel: 5 })])).toBe(-1);
  });
});

describe('tierlerdenSeviyeler (goc)', () => {
  const TIERS = [
    { id: 'prestij', label: 'Prestij', badge: '🏅', perks: ['A', 'B'], popular: false },
    { id: 'champion', label: 'Champion', badge: '🏆', perks: ['C'], popular: true },
  ];

  it('icerigi kaybetmiyor', () => {
    const cikti = tierlerdenSeviyeler(TIERS);
    expect(cikti).toHaveLength(2);
    expect(cikti[0]).toMatchObject({ id: 'prestij', label: 'Prestij', badge: '🏅', perks: ['A', 'B'] });
    expect(cikti[1].oneCikan).toBe(true);
  });

  it('esigi olmayan kartlara artan esik uretiyor', () => {
    // Kartlarin hicbir esigi yoktu (seviye elle veriliyordu); esikler
    // burada uretiliyor ve MUTLAKA artan olmali, yoksa ust seviyelere
    // hicbir oyuncu ulasamaz.
    const cikti = tierlerdenSeviyeler([...TIERS, ...TIERS, ...TIERS, ...TIERS, ...TIERS]);
    for (let i = 1; i < cikti.length; i += 1) {
      expect(cikti[i].minLevel).toBeGreaterThan(cikti[i - 1].minLevel);
    }
  });

  it('bos girdide bos donuyor', () => {
    expect(tierlerdenSeviyeler([])).toEqual([]);
    expect(tierlerdenSeviyeler(null)).toEqual([]);
  });
});

describe('seviyeleriNormalize', () => {
  it('ranks varsa onu kullaniyor', () => {
    const cikti = seviyeleriNormalize({ ranks: [{ id: 'r', label: 'R', minLevel: 3 }] });
    expect(cikti).toHaveLength(1);
    expect(cikti[0].minLevel).toBe(3);
  });

  it('ranks yoksa ESKI tiers icerigini tasiyor -- sifirlamiyor', () => {
    // Asil koruma bu: mevcut kiracilarin girdigi ad/simge/avantajlar
    // varsayilanlarla ezilmemeli.
    const cikti = seviyeleriNormalize({ tiers: [{ id: 'elite', label: 'Elite', perks: ['X'] }] });
    expect(cikti[0]).toMatchObject({ id: 'elite', label: 'Elite', perks: ['X'] });
  });

  it('ikisi de yoksa varsayilanlara dusuyor', () => {
    expect(seviyeleriNormalize({}).map((s) => s.id)).toEqual(VARSAYILAN_SEVIYELER.map((s) => s.id));
  });

  it('varsayilanlari PAYLASMIYOR -- duzenleme sizmiyor', () => {
    const a = seviyeleriNormalize({});
    a[0].perks.push('sizinti');
    expect(seviyeleriNormalize({})[0].perks).not.toContain('sizinti');
  });

  it('ciktiyi minLevel sirasina koyuyor', () => {
    const cikti = seviyeleriNormalize({ ranks: [
      { id: 'c', label: 'C', minLevel: 20 },
      { id: 'a', label: 'A', minLevel: 1 },
    ] });
    expect(cikti.map((s) => s.id)).toEqual(['a', 'c']);
  });
});

describe('seviyeyiNormalize', () => {
  it('eski tekil `perk` alanini okuyor', () => {
    // Rutbe merdiveninde avantaj tek bir metindi.
    expect(seviyeyiNormalize({ id: 'a', label: 'A', perk: 'Tek avantaj' }, 0).perks).toEqual(['Tek avantaj']);
  });

  it('eksik alanlari makul degerlerle dolduruyor', () => {
    const s = seviyeyiNormalize({}, 2);
    expect(s.id).toBe('seviye-3');
    expect(s.label).toBe('Seviye 3');
    expect(s.minLevel).toBe(1);
    expect(s.perks).toEqual([]);
  });

  it('ondalikli minLevel tam sayiya iniyor', () => {
    expect(seviyeyiNormalize({ minLevel: 7.9 }, 0).minLevel).toBe(7);
  });
});

describe('seviyeUyarilari', () => {
  it('bos listede uyariyor', () => {
    expect(seviyeUyarilari([])).toHaveLength(1);
  });

  it('1. seviyeden baslamayan merdiven yeni oyuncuyu disarida birakiyor', () => {
    const u = seviyeUyarilari([seviye({ minLevel: 5 })]);
    expect(u.join(' ')).toMatch(/yeni oyuncular/i);
  });

  it('ayni esikten baslayan iki seviyeyi bildiriyor', () => {
    const u = seviyeUyarilari([
      seviye({ id: 'a', label: 'A', minLevel: 10 }),
      seviye({ id: 'b', label: 'B', minLevel: 10 }),
    ]);
    expect(u.join(' ')).toMatch(/ulaşamaz/);
  });

  it('ayni kimligi bildiriyor', () => {
    const u = seviyeUyarilari([
      seviye({ id: 'ayni', label: 'A', minLevel: 1 }),
      seviye({ id: 'ayni', label: 'B', minLevel: 5 }),
    ]);
    expect(u.join(' ')).toMatch(/aynı kimliğe/i);
  });

  it('saglikli merdivende sessiz', () => {
    expect(seviyeUyarilari(VARSAYILAN_SEVIYELER)).toEqual([]);
  });
});
