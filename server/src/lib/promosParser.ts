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

/**
 * Promosyon metnindeki para tutarını sayıya çevirir.
 *
 * Önceki desen `(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)` sayının HER ZAMAN binlik
 * ayracıyla yazıldığını varsayıyordu. `\d{1,3}` açgözlü olduğu için ayraçsız
 * yazımda yalnızca ilk üç hane yakalanıyor, kalanı düşüyordu:
 *   "5000 ₺"  -> 500   (10x düşük)
 *   "10000 ₺" -> 100   (100x düşük)
 *   "2500 ₺"  -> 250
 * Ayraçlı yazım ("1.500 ₺") doğru çalıştığı için hata gözden kaçmış. Bu değer
 * bonus üst sınırı (maxBonus) olarak kullanıldığından doğrudan para etkisi var.
 *
 * Yeni desen iki biçimi ayrı ele alır: ayraçlı gruplama VEYA düz hane dizisi.
 */
function parseCurrencyNumber(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const compact = text.replace(/\s/g, '');
  // 1) ayraçlı: 1.500 / 1.234,56   2) düz: 5000 / 5000,50
  const m = compact.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!m) return undefined;

  let num = m[1];
  const grouped = /[.,]\d{3}(?:[.,]|$)/.test(num);

  if (grouped) {
    const lastComma = num.lastIndexOf(',');
    const lastDot = num.lastIndexOf('.');
    const decIdx = Math.max(lastComma, lastDot);
    const tailLen = num.length - decIdx - 1;
    // Son ayraçtan sonra 1-2 hane varsa o ondalıktır (1.234,56); değilse binlik.
    if (decIdx > -1 && tailLen > 0 && tailLen <= 2) {
      num = `${num.slice(0, decIdx).replace(/[.,]/g, '')}.${num.slice(decIdx + 1)}`;
    } else {
      num = num.replace(/[.,]/g, '');
    }
  } else {
    num = num.replace(',', '.');
  }

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

