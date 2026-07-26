import type { NormalizedPromo } from '../lib/promosParser.js';

/**
 * Bonus uygulama kontrol raporu CSV içeriği üretir.
 */
export function buildBonusControlReportCsv(promos: NormalizedPromo[]): string {
  const header = 'id;title;minDeposit;maxBonus;bonusPercent;wagering;validityDays';
  const rows = promos.map((p) =>
    [
      p.id,
      `"${(p.title || '').replace(/"/g, '""')}"`,
      p.minDeposit ?? '',
      p.maxBonus ?? '',
      p.bonusPercent ?? '',
      `"${(p.wagering || '').replace(/"/g, '""')}"`,
      p.validityDays ?? '',
    ].join(';')
  );
  return [header, ...rows].join('\n');
}
