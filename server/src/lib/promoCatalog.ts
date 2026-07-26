export interface PromoCatalogItem {
  id?: string | number;
  promoTitle?: string;
  title?: string;
  Name?: string;
  name?: string;
  systemName?: string;
  image?: string;
  detailHtml?: string;
  backofficeId?: string | number;
  rules?: Record<string, any>;
  tags?: string[];
  isVirtual?: boolean;
  isFreebet?: boolean;
  platformBonusDefinitionId?: string | number;
  [key: string]: any;
}

export function resolvePromoTitle(promo: PromoCatalogItem | null | undefined, fallback = 'Bonus') {
  const candidates = [
    promo?.promoTitle,
    promo?.title,
    promo?.Name,
    promo?.name,
    promo?.systemName,
    promo?.campaignName,
  ];

  const resolved = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
  return (resolved?.trim() || fallback).trim();
}

export function buildPromoRuleState<T extends Record<string, any> = Record<string, any>>(spec: Record<string, any> | undefined, defaults: T = {} as T): T & { enabled: boolean; requiresConfiguration: boolean } {
  const enabled = spec?.enabled !== false && defaults.enabled !== false;
  return {
    ...defaults,
    ...spec,
    enabled,
    requiresConfiguration: !Boolean(spec),
  };
}
