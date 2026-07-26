import { describe, expect, it } from 'vitest';
import { buildPromoRuleState, resolvePromoTitle } from './promoCatalog.js';

describe('promo catalog helpers', () => {
  it('uses the best available title and preserves unconfigured promos', () => {
    const promo = { title: '', Name: '', promoTitle: 'Yatırım Bonusu' };

    expect(resolvePromoTitle(promo, 'Bonus')).toBe('Yatırım Bonusu');

    const ruleState = buildPromoRuleState(undefined, { externalId: 42, enabled: true });
    expect(ruleState.enabled).toBe(true);
    expect(ruleState.requiresConfiguration).toBe(true);
    expect(ruleState.externalId).toBe(42);
  });
});
