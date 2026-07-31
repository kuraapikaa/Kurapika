import { describe, expect, it } from 'vitest';
import { assignmentValuesForPromoSpec } from './rulesService.js';

/**
 * "Freespin bonusunda iki ayri yerde miktar seciyoruz, cakisir mi?"
 *
 * Kural Merkezi'nde ayni degere ulasan UC giris var:
 *
 *   1. Freespin blogu       -> freespinBetLevel / freespinCount
 *   2. Atama Degerleri ham  -> assignmentValues.BetLevel / .RoundCount
 *   3. Tutar Tipi           -> amountType/fixedAmount -> BonusMoneyAmount
 *
 * Cakisma YOK ama oncelik UI'da gorunmuyor. Bu test onceligi kilitliyor:
 * degisirse admin'in girdigi deger sessizce baska bir sey gonderir.
 */

describe('freespin miktar önceliği', () => {
  it('Freespin bloğu ham atama değerlerini EZER', () => {
    // Admin ham haritaya 50 yazmis ama Freespin blogunda 25 var:
    // gonderilen 25. Ham haritadaki deger sessizce yok sayilir.
    const values = assignmentValuesForPromoSpec({
      assignmentValues: { BetLevel: 5, RoundCount: 50 },
      freespinBetLevel: 2,
      freespinCount: 25,
    });
    expect(values.BetLevel).toBe(2);
    expect(values.RoundCount).toBe(25);
  });

  it('Freespin bloğu boşsa ham atama değeri geçer', () => {
    const values = assignmentValuesForPromoSpec({
      assignmentValues: { BetLevel: 5, RoundCount: 50 },
    });
    expect(values.BetLevel).toBe(5);
    expect(values.RoundCount).toBe(50);
  });

  it('alanlardan yalnızca biri doluysa diğeri ham haritadan gelir', () => {
    // Kismi doldurma en sinsi hali: Count blokta, BetLevel ham haritada.
    const values = assignmentValuesForPromoSpec({
      assignmentValues: { BetLevel: 5, RoundCount: 50 },
      freespinCount: 25,
    });
    expect(values.RoundCount).toBe(25); // blok kazandi
    expect(values.BetLevel).toBe(5);    // ham harita gecti
  });

  it('sıfır geçerli bir değerdir, boş sayılmaz', () => {
    const values = assignmentValuesForPromoSpec({
      assignmentValues: { BetLevel: 9 },
      freespinBetLevel: 0,
    });
    expect(values.BetLevel).toBe(0);
  });

  it('Game: id + providerId birlikte geçerliyse blok kazanır', () => {
    const values = assignmentValuesForPromoSpec({
      assignmentValues: { Game: { id: 111, providerId: 9 } },
      freespinGameId: 195202,
      freespinGameProviderId: 1,
    });
    expect(values.Game).toEqual({ id: 195202, providerId: 1 });
  });

  it('Game: providerId eksikse blok DÜŞER, ham harita bütün olarak geçer', () => {
    // REGRESYON: onceden id blok'tan, providerId ham haritadan aliniyordu ve
    // {id: 195202, providerId: 9} gibi hicbir yerde yapilandirilmamis bir cift
    // uretiliyordu. Kaynaklar karistirilmamali.
    const values = assignmentValuesForPromoSpec({
      assignmentValues: { Game: { id: 111, providerId: 9 } },
      freespinGameId: 195202,
    });
    expect(values.Game).toEqual({ id: 111, providerId: 9 });
  });

  it('Game: blok yarım ve ham seçim yoksa hiç gönderilmez', () => {
    // Yarim secimi gondermektense hic gondermemek dogru: Lynon zorunlu
    // parametre eksik diye reddeder ve hata gorunur olur.
    const values = assignmentValuesForPromoSpec({ freespinGameId: 195202 });
    expect(values.Game).toBeUndefined();
  });

  it('Game: yalnızca providerId doluysa da blok düşer', () => {
    const values = assignmentValuesForPromoSpec({
      assignmentValues: { Game: { id: 111, providerId: 9 } },
      freespinGameProviderId: 4,
    });
    expect(values.Game).toEqual({ id: 111, providerId: 9 });
  });

  it('BetLevel/RoundCount ile BonusMoneyAmount AYRI parametreler — birbirini ezmez', () => {
    // Freespin miktari ile nakit tutar farkli Lynon blok parametreleri;
    // ikisi birlikte gonderilebilir, biri digerini silmez.
    const values = assignmentValuesForPromoSpec({
      assignmentValues: { BonusMoneyAmount: 250 },
      freespinBetLevel: 2,
      freespinCount: 25,
    });
    expect(values).toEqual({ BonusMoneyAmount: 250, BetLevel: 2, RoundCount: 25 });
  });
});

/**
 * dashboard.ts'teki birlestirmenin birebir kopyasi.
 *
 * TUZAK: BonusMoneyAmount ham haritada tanimliysa "Tutar Tipi" hesabi
 * (effectiveAmount) HIC uygulanmaz. Admin Tutar Tipi'ni degistirir,
 * hicbir sey olmaz, uyari da cikmaz.
 */
function atamaDegerleri(
  suppliedValues: Record<string, unknown>,
  ruleAssignmentValues: Record<string, unknown>,
  effectiveAmount: number,
): Record<string, unknown> {
  return {
    ...suppliedValues,
    ...ruleAssignmentValues,
    ...(effectiveAmount > 0 && suppliedValues.BonusMoneyAmount == null && ruleAssignmentValues.BonusMoneyAmount == null
      ? { BonusMoneyAmount: effectiveAmount }
      : {}),
  };
}

describe('BonusMoneyAmount birleştirme', () => {
  it('hiçbir yerde yoksa hesaplanan tutar yazılır', () => {
    expect(atamaDegerleri({}, { BetLevel: 2 }, 500)).toEqual({ BetLevel: 2, BonusMoneyAmount: 500 });
  });

  it('kural ham haritasında varsa hesaplanan tutar UYGULANMAZ', () => {
    // Bildirilen tuzak: Tutar Tipi 500 hesaplasa da gonderilen 250.
    expect(atamaDegerleri({}, { BonusMoneyAmount: 250 }, 500)).toEqual({ BonusMoneyAmount: 250 });
  });

  it('istekte varsa ve kuralda yoksa istek değeri korunur', () => {
    expect(atamaDegerleri({ BonusMoneyAmount: 100 }, {}, 500)).toEqual({ BonusMoneyAmount: 100 });
  });

  it('kural değeri istek değerini ezer', () => {
    expect(atamaDegerleri({ BonusMoneyAmount: 100 }, { BonusMoneyAmount: 250 }, 500)).toEqual({ BonusMoneyAmount: 250 });
  });

  it('hesaplanan tutar 0 ise yazılmaz — bonus tutarsız kalır', () => {
    expect(atamaDegerleri({}, { BetLevel: 2 }, 0)).toEqual({ BetLevel: 2 });
  });
});
