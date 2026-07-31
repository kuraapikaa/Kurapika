import { describe, expect, it } from 'vitest';

/**
 * dashboard.ts icindeki sanalNakitBonuslar() mantiginin birebir kopyasi.
 *
 * BILDIRILEN HATA: Kural Merkezi'nde aktif isaretlenen bonuslar bonus
 * talep ekraninda cikmiyordu.
 *
 * Kok neden: /promos/auto'nun Lynon dali yalnizca PartnerBonusId > 0 olan
 * kampanyalari donduruyor ve ERKEN CIKIYORDU. Nakit tipi kurallarin Lynon
 * kampanya karsiligi yok (partnerBonusId yok), dolayisiyla katalogdan
 * hicbir zaman gelmezler — canlida hic gorunmuyorlardi. Sanal uretim
 * yalnizca eski BetConstruct dalinda vardi.
 */
function sanalNakitBonuslar(
  rules: { PROMO_SPECS?: Record<string, unknown>; PROMO_TITLE_SPECS?: Record<string, unknown> } | undefined,
  overrides: any,
  mevcutIdler: Set<string>,
): any[] {
  const tumKurallar = [
    ...Object.entries(rules?.PROMO_SPECS ?? {}),
    ...Object.entries(rules?.PROMO_TITLE_SPECS ?? {}),
  ];
  const sonuc: any[] = [];
  const eklenen = new Set<string>();

  for (const [key, spec] of tumKurallar) {
    const kural = spec as Record<string, any>;
    if (kural?.type !== 'cash') continue;
    if (kural?.enabled === false) continue;
    if (eklenen.has(key) || mevcutIdler.has(String(key))) continue;
    eklenen.add(key);

    const o = overrides?.byExternalId?.[key];
    sonuc.push({
      id: key,
      promoTitle: o?.title || kural.title || key,
      image: o?.image || '',
      detailHtml: o?.detailHtml || '',
      rules: { externalId: key, ...kural, enabled: true },
      backofficeId: key,
      isVirtual: true,
      tags: ['Nakit'],
    });
  }
  return sonuc;
}

const KURALLAR = {
  PROMO_SPECS: {
    'kayip-bonusu': { type: 'cash', enabled: true, title: "%30'a Varan Kayip Bonusu" },
    'dorduncu-yatirim-hediyesi': { type: 'cash', enabled: true, title: '4. Yatirimin Bizden Hediye!' },
    'carsamba-happy-days': { type: 'cash', enabled: true, title: '%400 Carsamba Happy Days' },
    'kapali-bonus': { type: 'cash', enabled: false, title: 'Kapali' },
    '1873': { type: 'partner', enabled: true, partnerBonusId: '1873' },
  },
  PROMO_TITLE_SPECS: {},
};

describe('sanal nakit bonuslar', () => {
  it('aktif nakit kurallar listeye girer — bildirilen hata', () => {
    const sonuc = sanalNakitBonuslar(KURALLAR, undefined, new Set());
    expect(sonuc.map((b) => b.id).sort()).toEqual([
      'carsamba-happy-days',
      'dorduncu-yatirim-hediyesi',
      'kayip-bonusu',
    ]);
  });

  it('kapalı kural listeye girmez', () => {
    const sonuc = sanalNakitBonuslar(KURALLAR, undefined, new Set());
    expect(sonuc.some((b) => b.id === 'kapali-bonus')).toBe(false);
  });

  it('partner tipi kural sanal üretilmez — platform katalogundan gelir', () => {
    const sonuc = sanalNakitBonuslar(KURALLAR, undefined, new Set());
    expect(sonuc.some((b) => b.id === '1873')).toBe(false);
  });

  it('enabled belirtilmemişse aktif sayılır', () => {
    const sonuc = sanalNakitBonuslar(
      { PROMO_SPECS: { x: { type: 'cash', title: 'X' } } },
      undefined,
      new Set(),
    );
    expect(sonuc).toHaveLength(1);
  });

  it('platform listesinde zaten varsa tekrar eklenmez', () => {
    const sonuc = sanalNakitBonuslar(KURALLAR, undefined, new Set(['kayip-bonusu']));
    expect(sonuc.some((b) => b.id === 'kayip-bonusu')).toBe(false);
    expect(sonuc).toHaveLength(2);
  });

  it('aynı anahtar iki sözlükte varsa bir kez eklenir', () => {
    const sonuc = sanalNakitBonuslar(
      {
        PROMO_SPECS: { 'kayip-bonusu': { type: 'cash', enabled: true, title: 'A' } },
        PROMO_TITLE_SPECS: { 'kayip-bonusu': { type: 'cash', enabled: true, title: 'B' } },
      },
      undefined,
      new Set(),
    );
    expect(sonuc).toHaveLength(1);
    expect(sonuc[0].promoTitle).toBe('A');
  });

  it('rules.enabled her zaman true — istemci enabled !== false ile süzüyor', () => {
    // BonusTalepSayfasi `rules?.enabled !== false` filtresi uyguluyor;
    // sanal bonus buradan gecmezse ekranda yine gorunmez.
    const sonuc = sanalNakitBonuslar(KURALLAR, undefined, new Set());
    expect(sonuc.every((b) => b.rules.enabled === true)).toBe(true);
  });

  it('kural alanları rules içine taşınır — talep ekranı bunları kullanıyor', () => {
    const sonuc = sanalNakitBonuslar(
      { PROMO_SPECS: { k: { type: 'cash', enabled: true, title: 'K', amountType: 'tieredPercentage', lossBonus: true } } },
      undefined,
      new Set(),
    );
    expect(sonuc[0].rules).toMatchObject({ externalId: 'k', amountType: 'tieredPercentage', lossBonus: true });
  });

  it('override başlığı ve görseli kural değerini ezer', () => {
    const sonuc = sanalNakitBonuslar(
      { PROMO_SPECS: { k: { type: 'cash', enabled: true, title: 'Kural adı' } } },
      { byExternalId: { k: { title: 'Panelden verilen ad', image: 'x.jpg' } } },
      new Set(),
    );
    expect(sonuc[0].promoTitle).toBe('Panelden verilen ad');
    expect(sonuc[0].image).toBe('x.jpg');
  });

  it('başlık yoksa anahtar kullanılır — bonus adsız görünmez', () => {
    const sonuc = sanalNakitBonuslar({ PROMO_SPECS: { 'bir-kural': { type: 'cash' } } }, undefined, new Set());
    expect(sonuc[0].promoTitle).toBe('bir-kural');
  });

  it('boş girdi çökmez', () => {
    expect(sanalNakitBonuslar(undefined, undefined, new Set())).toEqual([]);
    expect(sanalNakitBonuslar({}, undefined, new Set())).toEqual([]);
  });
});
