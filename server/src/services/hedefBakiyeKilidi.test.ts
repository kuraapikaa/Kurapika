import { describe, expect, it } from 'vitest';
import {
  hedefKarari,
  hedefNotu,
  izinliKisitMi,
  kilitAdaylari,
  kisitGovdeleri,
  kisitliMi,
  type BonusOturumu,
  type Kisit,
} from './hedefBakiyeKilidi.js';

/** Kullanicinin yapistirdigi gercek restrictions yaniti. */
const GERCEK_KISITLAR: Kisit[] = [
  { restriction: 'casinoBet', isRestricted: true, lastNote: 'enable', updatedAt: '2026-08-03T02:09:09.413405Z' },
  { restriction: 'sportsBet', isRestricted: false },
  { restriction: 'withdraw', isRestricted: false },
  { restriction: 'deposit', isRestricted: false },
  { restriction: 'promotions', isRestricted: false },
];

describe('kisitliMi', () => {
  it('gerçek yanıtta açık kısıtı bulur', () => {
    expect(kisitliMi(GERCEK_KISITLAR, 'casinoBet')).toBe(true);
    expect(kisitliMi(GERCEK_KISITLAR, 'sportsBet')).toBe(false);
  });

  it('büyük/küçük harf farkını yutar', () => {
    expect(kisitliMi(GERCEK_KISITLAR, 'CASINOBET')).toBe(true);
  });

  it('kayıt yoksa kısıtlı sayılmaz', () => {
    expect(kisitliMi([], 'casinoBet')).toBe(false);
    expect(kisitliMi(null, 'casinoBet')).toBe(false);
  });
});

describe('izinli kısıtlar', () => {
  it('yalnızca bahis kısıtlarına izin verir', () => {
    expect(izinliKisitMi('casinoBet')).toBe(true);
    expect(izinliKisitMi('sportsBet')).toBe(true);
  });

  it('çekim ve yatırım bu akıştan kapatılamaz', () => {
    // Hedefe ulaşan oyuncunun parasını çekebilmesi gerekir.
    expect(izinliKisitMi('withdraw')).toBe(false);
    expect(izinliKisitMi('deposit')).toBe(false);
    expect(izinliKisitMi('promotions')).toBe(false);
  });
});

describe('hedefKarari', () => {
  const esik = 2500;

  it('eşiğin üstünde kapatır', () => {
    const karar = hedefKarari({ bakiye: 2500.01, esik, zatenKisitli: false });
    expect(karar.kapat).toBe(true);
  });

  it('eşiğe eşitken kapatmaz — "geçtiği an" deniyor', () => {
    expect(hedefKarari({ bakiye: 2500, esik, zatenKisitli: false }).kapat).toBe(false);
  });

  it('eşiğin altında kapatmaz', () => {
    expect(hedefKarari({ bakiye: 100, esik, zatenKisitli: false }).kapat).toBe(false);
  });

  it('bakiye okunamadıysa kapatmaz', () => {
    expect(hedefKarari({ bakiye: null, esik, zatenKisitli: false }).kapat).toBe(false);
    expect(hedefKarari({ bakiye: NaN, esik, zatenKisitli: false }).kapat).toBe(false);
  });

  it('zaten kısıtlıysa tekrar yazmaz', () => {
    // Idempotanlik: job her dakika çalışıyor, aynı oyuncuya her turda
    // PUT atmamalı.
    expect(hedefKarari({ bakiye: 99_999, esik, zatenKisitli: true }).kapat).toBe(false);
  });

  it('geçersiz eşikle kapatmaz', () => {
    expect(hedefKarari({ bakiye: 99_999, esik: 0, zatenKisitli: false }).kapat).toBe(false);
    expect(hedefKarari({ bakiye: 99_999, esik: NaN, zatenKisitli: false }).kapat).toBe(false);
  });

  it('gerekçe her durumda yazılır', () => {
    expect(hedefKarari({ bakiye: 3000, esik, zatenKisitli: false }).neden).toContain('2500');
    expect(hedefKarari({ bakiye: null, esik, zatenKisitli: false }).neden).toContain('okunamadı');
  });
});

describe('hedefNotu', () => {
  it('Lynon not sınırını aşmaz', () => {
    expect(hedefNotu(2500, 3120.5).length).toBeLessThanOrEqual(50);
  });

  it('eşiği ve bakiyeyi içerir', () => {
    expect(hedefNotu(2500, 3120.5)).toBe('Hedef 2500 TRY asildi (3121)');
  });
});

describe('kilitAdaylari', () => {
  const simdi = Date.parse('2026-08-03T06:00:00Z');
  const taban: BonusOturumu = {
    playerId: 2501238,
    campaignId: 1885,
    bonusId: 1687,
    assignedDate: '2026-08-03T02:00:16Z',
    claimedDate: '2026-08-03T02:00:27Z',
  };

  it('hedef kampanyanın oyuncusunu seçer', () => {
    expect(kilitAdaylari([taban], { campaignId: 1885, bonusId: 1687, gunPenceresi: 3, simdi })).toEqual([2501238]);
  });

  it('başka kampanyanın oyuncusunu almaz', () => {
    const baska = { ...taban, campaignId: 1900, bonusId: 1700 };
    expect(kilitAdaylari([baska], { campaignId: 1885, bonusId: 1687, gunPenceresi: 3, simdi })).toEqual([]);
  });

  it('kampanya kimliği değişse bonus kimliği yakalar', () => {
    const klon = { ...taban, campaignId: 9999 };
    expect(kilitAdaylari([klon], { campaignId: 1885, bonusId: 1687, gunPenceresi: 3, simdi })).toEqual([2501238]);
  });

  it('pencerenin dışındaki eski verilişi almaz', () => {
    const eski = { ...taban, assignedDate: '2026-07-01T00:00:00Z', claimedDate: '2026-07-01T00:00:00Z' };
    expect(kilitAdaylari([eski], { campaignId: 1885, bonusId: 1687, gunPenceresi: 3, simdi })).toEqual([]);
  });

  it('aynı oyuncuyu bir kez döner', () => {
    expect(
      kilitAdaylari([taban, { ...taban }], { campaignId: 1885, bonusId: 1687, gunPenceresi: 3, simdi }),
    ).toEqual([2501238]);
  });

  it('kimlik yoksa ya da tarih bozuksa atlar', () => {
    const bozuk = [{ ...taban, playerId: null }, { ...taban, assignedDate: 'yok', claimedDate: null }];
    expect(kilitAdaylari(bozuk, { campaignId: 1885, bonusId: 1687, gunPenceresi: 3, simdi })).toEqual([]);
  });

  it('boş girdi çökmez', () => {
    expect(kilitAdaylari(null, { campaignId: 1885, bonusId: 1687, gunPenceresi: 3, simdi })).toEqual([]);
  });
});

describe('kisitGovdeleri', () => {
  it('iki aday gövde üretir', () => {
    const govdeler = kisitGovdeleri('casinoBet', true, 'not');
    expect(govdeler).toHaveLength(2);
    expect(govdeler[0]).toEqual({ restriction: 'casinoBet', isRestricted: true, note: 'not' });
    expect(govdeler[1]).toEqual({ restrictions: [{ restriction: 'casinoBet', isRestricted: true, note: 'not' }] });
  });
});
