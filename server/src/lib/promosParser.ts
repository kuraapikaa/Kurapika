import { JSDOM } from 'jsdom';

export interface NormalizedPromo {
  id: number;
  title: string;
  minDeposit?: number;
  maxBonus?: number;
  bonusPercent?: number;
  wagering?: string;
  validityDays?: number;
  allowedGames?: string[];
  exclusions?: string[];
  claimMethod?: string;
  raw?: string;
}

function parseCurrencyNumber(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.replace(/\s/g, '').match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/);
  if (!m) return undefined;
  // normalize thousand separators
  let num = m[1].replace(/\./g, '').replace(',', '.');
  const v = Number(num);
  return Number.isFinite(v) ? v : undefined;
}

export function parsePromoContent(id: number, title: string, htmlContent: string): NormalizedPromo {
  const dom = new JSDOM(htmlContent);
  const text = dom.window.document.body.textContent || '';
  const lower = text.toLowerCase();

  const minMatch = lower.match(/minimum\s*(?:yatırım|minimum|min)[^\d]*(\d[\d.,\s]*)\s*₺/i);
  const minDeposit = parseCurrencyNumber(minMatch ? minMatch[1] : undefined);

  // max bonus
  const maxMatch = lower.match(/maksimum\s*(?:tutar|bonus|alabileceğiniz)\s*[^\d]*(\d[\d.,\s]*)\s*₺/i) ||
    lower.match(/max(?:imum)?\s*[^\d]*(\d[\d.,\s]*)\s*₺/i);
  const maxBonus = parseCurrencyNumber(maxMatch ? maxMatch[1] : undefined);

  // bonus percent like %100, %25
  const percentMatch = text.match(/%(\d{1,3})(?=\s)/);
  const bonusPercent = percentMatch ? Number(percentMatch[1]) : undefined;

  // wagering phrases
  const wagerMatch = text.match(/(çevrim|wager)[^\.\n\r]{0,120}/i);
  const wagering = wagerMatch ? wagerMatch[0].trim() : undefined;

  // validity days
  const daysMatch = lower.match(/(\d{1,3})\s*(gün|day)/i);
  const validityDays = daysMatch ? Number(daysMatch[1]) : undefined;

  // allowed games keywords
  const allowed: string[] = [];
  if (/slot|slotlar|casino/i.test(lower)) allowed.push('casino');
  if (/canlı casino|live casino/i.test(lower)) allowed.push('live-casino');
  if (/spor|football|basketball/i.test(lower)) allowed.push('sport');

  // exclusions: look for e-spor/cyber/virtual mentions
  const exclusions: string[] = [];
  if (/e-?spor|cyber|sanal/i.test(lower)) exclusions.push('esports/virtual');
  if (/rulet.*hariç|rulet.*dış/i.test(lower)) exclusions.push('roulette-exclusions');

  // claim method
  const claimMatch = lower.match(/menü.*(bonus|oto bonus|bonuslar)|otomatik/);
  const claimMethod = claimMatch ? claimMatch[0].trim() : undefined;

  return {
    id,
    title,
    minDeposit,
    maxBonus,
    bonusPercent,
    wagering,
    validityDays,
    allowedGames: allowed,
    exclusions,
    claimMethod,
    raw: text.trim(),
  };
}

