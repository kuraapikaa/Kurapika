import { describe, expect, it } from 'vitest';
import {
  davetBonusuDuzeltmesiVarMi,
  hedefBakiyeDuzeltmeNotu,
  hedefBakiyeDuzeltmeTutari,
  hedefKarari,
  hedefNotu,
  izinliKisitMi,
  kilitAdaylari,
  kisitGovdeleri,
  kisitliMi,
  sadeceHedefBonusuVarMi,
  yatirimYapmisMi,
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

describe('hedefBakiyeDuzeltmeTutari', () => {
  it('bakiyeyi hedefe indirmek için gereken tutarı verir', () => {
    expect(hedefBakiyeDuzeltmeTutari(4409.7, 1000)).toBe(3409.7);
    expect(hedefBakiyeDuzeltmeTutari(2631, 1000)).toBe(1631);
  });

  it('bakiye hedefin altındaysa/eşitse 0 döner — negatif tutar istenmez', () => {
    // Bir önceki turda zaten indirilmiş olabilir; tekrar "düzeltme" tutarı
    // negatif çıkıp lynonAdjustPlayerMainAccount'u (crediting'e döner gibi)
    // yanlış yönde beslemeye çalışmamalı.
    expect(hedefBakiyeDuzeltmeTutari(1000, 1000)).toBe(0);
    expect(hedefBakiyeDuzeltmeTutari(500, 1000)).toBe(0);
  });

  it('geçersiz girdide 0 döner', () => {
    expect(hedefBakiyeDuzeltmeTutari(NaN, 1000)).toBe(0);
    expect(hedefBakiyeDuzeltmeTutari(4000, NaN)).toBe(0);
  });

  it('kuruş farklarını yuvarlar', () => {
    expect(hedefBakiyeDuzeltmeTutari(2500.006, 1000)).toBe(1500.01);
  });
});

describe('hedefBakiyeDuzeltmeNotu', () => {
  it('Lynon not sınırını aşmaz', () => {
    expect(hedefBakiyeDuzeltmeNotu(1000, 4409.7).length).toBeLessThanOrEqual(50);
  });

  it('hedefi ve önceki bakiyeyi içerir', () => {
    expect(hedefBakiyeDuzeltmeNotu(1000, 4409.7)).toBe("Bakiye 1000 TRY'ye sabitlendi (4410)");
  });
});

describe('sadeceHedefBonusuVarMi', () => {
  const hedef = { campaignId: 1885, bonusId: 1687 };

  it('yalnızca hedef bonusu olan oyuncuda true döner', () => {
    const oturumlar: BonusOturumu[] = [
      { playerId: 1, campaignId: 1885, bonusId: 1687 },
    ];
    expect(sadeceHedefBonusuVarMi(oturumlar, 1, hedef)).toBe(true);
  });

  it('hedef bonusu birden fazla kez almış ama başka hiçbir şeyi olmayan oyuncuda true döner', () => {
    const oturumlar: BonusOturumu[] = [
      { playerId: 1, campaignId: 1885, bonusId: 1687 },
      { playerId: 1, campaignId: 1885, bonusId: 1687 },
    ];
    expect(sadeceHedefBonusuVarMi(oturumlar, 1, hedef)).toBe(true);
  });

  it('başka bir kampanyası da olan oyuncuda false döner — gerçek katılımcı, muaf', () => {
    const oturumlar: BonusOturumu[] = [
      { playerId: 1, campaignId: 1885, bonusId: 1687 },
      { playerId: 1, campaignId: 9999, bonusId: 4321 },
    ];
    expect(sadeceHedefBonusuVarMi(oturumlar, 1, hedef)).toBe(false);
  });

  it('hedef bonusu hiç yoksa false döner', () => {
    const oturumlar: BonusOturumu[] = [
      { playerId: 1, campaignId: 9999, bonusId: 4321 },
    ];
    expect(sadeceHedefBonusuVarMi(oturumlar, 1, hedef)).toBe(false);
  });

  it('boş geçmişte false döner', () => {
    expect(sadeceHedefBonusuVarMi([], 1, hedef)).toBe(false);
    expect(sadeceHedefBonusuVarMi(null, 1, hedef)).toBe(false);
  });

  it('gün penceresi sınırı yok — eski verilişler de sayılır', () => {
    // kilitAdaylari'nin aksine burada tarih hiç kontrol edilmiyor; bu
    // ömür boyu bir bonus-çeşitliliği kontrolü.
    const oturumlar: BonusOturumu[] = [
      { playerId: 1, campaignId: 1885, bonusId: 1687, claimedDate: '2020-01-01T00:00:00Z' },
    ];
    expect(sadeceHedefBonusuVarMi(oturumlar, 1, hedef)).toBe(true);
  });

  it('başka oyuncuların bonusları karışmaz', () => {
    const oturumlar: BonusOturumu[] = [
      { playerId: 1, campaignId: 1885, bonusId: 1687 },
      { playerId: 2, campaignId: 9999, bonusId: 4321 },
    ];
    expect(sadeceHedefBonusuVarMi(oturumlar, 1, hedef)).toBe(true);
  });
});

describe('yatirimYapmisMi', () => {
  it('yatırım kaydı varsa true döner', () => {
    expect(yatirimYapmisMi([{ id: 1 }])).toBe(true);
  });

  it('yatırım kaydı yoksa false döner', () => {
    expect(yatirimYapmisMi([])).toBe(false);
    expect(yatirimYapmisMi(null)).toBe(false);
    expect(yatirimYapmisMi(undefined)).toBe(false);
  });
});

describe('davetBonusuDuzeltmesiVarMi', () => {
  it('notunda "davet" geçen bir düzeltme varsa true döner', () => {
    expect(davetBonusuDuzeltmesiVarMi([{ Note: 'Davet bonusu' }])).toBe(true);
  });

  it('büyük/küçük harf farkını yutar', () => {
    expect(davetBonusuDuzeltmesiVarMi([{ Note: 'DAVET BONUSU' }])).toBe(true);
  });

  it('ilgisiz notlarda false döner', () => {
    expect(davetBonusuDuzeltmesiVarMi([{ Note: 'Manuel bakiye düzeltmesi' }])).toBe(false);
  });

  it('boş/eksik girdide false döner', () => {
    expect(davetBonusuDuzeltmesiVarMi([])).toBe(false);
    expect(davetBonusuDuzeltmesiVarMi(null)).toBe(false);
    expect(davetBonusuDuzeltmesiVarMi([{}])).toBe(false);
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
