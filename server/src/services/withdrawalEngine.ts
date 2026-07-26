/**
 * Withdrawal Engine — Facade Modülü
 * 
 * Tüm çekim kuralları, promosyon değerlendirme ve risk analizi
 * ayrı modüllere taşındı. Bu dosya geriye dönük uyumluluk için
 * hepsini tek noktadan re-export eder.
 * 
 * Modüller:
 * - promoEvaluator.ts  → evaluateForAccount, getSpecForPromo, getSpecForBonus
 * - riskAnalyzer.ts    → evaluateRiskAnalysis
 * - Bu dosya            → evaluateWithdrawalRules, evaluateWagerSummary, evaluateBonusRules, types
 */
import { parseDateToTime } from './accountSnapshotService.js';
import { getRules, type PromoSpec, type RulesConfig } from './rulesService.js';
import type { TransactionTypeSummary, BCBonus } from '../types/betconstruct.js';

// ─── Re-exports (Geriye Dönük Uyumluluk) ─────────────────────────────────────
export { evaluateForAccount, getSpecForPromo, getSpecForBonus } from './promoEvaluator.js';
export { evaluateRiskAnalysis } from './riskAnalyzer.js';

// ─── Rules Cache ─────────────────────────────────────────────────────────────

const defaultEmptySpecs: RulesConfig = { PROMO_SPECS: {}, PROMO_TITLE_SPECS: {} };
const rulesCache = new Map<string, RulesConfig>();

export async function getRulesForTenant(tenantKey: string): Promise<RulesConfig> {
  const key = String(tenantKey || 'default').trim() || 'default';
  const cached = rulesCache.get(key);
  if (cached) return cached;
  const loaded = await getRules(key).catch(() => defaultEmptySpecs);
  rulesCache.set(key, loaded);
  return loaded;
}

export async function refreshRules(tenantKey: string): Promise<void> {
  const key = String(tenantKey || 'default').trim() || 'default';
  rulesCache.delete(key);
  const loaded = await getRules(key).catch(() => defaultEmptySpecs);
  rulesCache.set(key, loaded);
}

// ─── Tip Tanımları (Tüm Modüller Tarafından Kullanılır) ──────────────────────

export interface AccountSnapshot {
  id: number | string;
  registrationDate?: string;
  totalDeposits?: number;
  wageringRemaining?: number;
  /** Analizin baz alındığı yatırım = çekim verilen tarihten önceki son yatırım. Tüm kontrol mantığı (çevrim, bonus, wager) buna göre. */
  lastDeposit?: { amount: number; dateLocal: string };
  /** Baz yatırımdan sonra yapılan toplam bahis miktarı (anapara çevrimi için). */
  totalBetAmountSinceLastDeposit?: number;
  /** Profil işlemleri penceresinde (son 30 gün) hiç çekim ödemesi yoksa true — ilk çekim olarak işaretlenir. */
  isFirstWithdrawal?: boolean;
  recentGames?: string[];
  flags?: string[];
  balance?: number;
  notes?: Array<{ id: number; note: string; createdLocal: string }>;
  profileTransactions?: BCBonus[] | any[];
  playedGameNames?: string[];
  lastLoginDateLocal?: string;
  isNoDepositOverride?: boolean;
  isWeeklyDiscountBaseline?: boolean;
  [key: string]: unknown;
}

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface ChecklistItem {
  id: string;
  label: string;
  ok: boolean;
  reason?: string;
  /** Risk analizi maddelerinde kullanılır: gösterim ve öncelik. */
  severity?: RiskSeverity;
}

export interface PromoChecklist {
  promoId: number;
  promoTitle: string;
  overallOk: boolean;
  items: ChecklistItem[];
  calculatedAmount?: number;
}

export interface RuleSetResult {
  overallOk: boolean;
  items: ChecklistItem[];
}

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────

/** Profil işlemlerinde yatırım olarak kabul edilen doküman türleri (DocumentTypeName). */
const DEPOSIT_TYPE_KEYS = ['Yatırım', 'Deposit', 'Yatırım Talebi Ödemesi'];

function getDepositSum(byType: Record<string, TransactionTypeSummary>): number {
  return DEPOSIT_TYPE_KEYS.reduce((sum, key) => sum + (byType[key]?.totalAmount ?? 0), 0);
}

function getDepositCount(byType: Record<string, TransactionTypeSummary>): number {
  return DEPOSIT_TYPE_KEYS.reduce((sum, key) => sum + (byType[key]?.count ?? 0), 0);
}

/** Başlık eşlemesi için normalize: küçük harf, boşluk birleştir, % kaldır. */
function normalizeTitleForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/%/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findSpecByTitle(specs: RulesConfig, title: string): PromoSpec | undefined {
  const n = normalizeTitleForMatch(title);
  if (specs.PROMO_TITLE_SPECS[n]) return specs.PROMO_TITLE_SPECS[n];
  for (const [key, spec] of Object.entries(specs.PROMO_TITLE_SPECS)) {
    if (n.includes(key) || key.includes(n)) return spec;
  }
  return undefined;
}

function _getSpecForBonus(specs: RulesConfig, bonusId: number, bonusName: string): PromoSpec | undefined {
  return specs.PROMO_SPECS[String(bonusId)] ?? findSpecByTitle(specs, bonusName);
}

// ─── Çekim Kuralları ─────────────────────────────────────────────────────────

/** Çekim kuralları: bakiye, çevrim, tutarlılık. */
export function evaluateWithdrawalRules(account: AccountSnapshot, specs: RulesConfig = defaultEmptySpecs): RuleSetResult {
  const items: ChecklistItem[] = [];
  const balance = account.balance ?? 0;
  const wageringRemaining = account.wageringRemaining ?? 0;
  const byType = (account.profileTransactionsByType as Record<string, TransactionTypeSummary>) ?? {};

  items.push({
    id: 'balance-non-negative',
    label: 'Bakiye negatif değil',
    ok: balance >= 0,
    reason: balance < 0 ? `Bakiye: ${balance} TRY` : undefined,
  });

  items.push({
    id: 'wagering-complete-before-withdraw',
    label: 'Çekim öncesi tüm çevrimler tamamlanmış',
    ok: wageringRemaining <= 0,
    reason: wageringRemaining > 0 ? `Kalan çevrim tutarı: ${wageringRemaining} TRY` : undefined,
  });

  const withdrawalReq = byType['Çekim Talebi'] ?? byType['Withdrawal Request'];
  const byPass = balance >= 0;
  if (withdrawalReq && (withdrawalReq.count > 0 || withdrawalReq.totalAmount !== 0)) {
    items.push({
      id: 'withdrawal-vs-balance',
      label: 'Çekim talebi bakiyeyi aşmıyor',
      ok: byPass,
      reason: !byPass ? `Bakiye ${balance} TRY, çekim talepleri mevcut` : undefined,
    });
  }

  if ((account as any).profileTransactionsCount != null) {
    items.push({
      id: 'transactions-loaded',
      label: 'Profil işlemleri analiz edildi',
      ok: true,
      reason: undefined,
    });
  }

  return { overallOk: items.every((i) => i.ok), items };
}

// ─── Wager Özeti ─────────────────────────────────────────────────────────────

/** Wager özeti: çevrim koşulu son yatırım bazlı; hem anapara hem bonus çevrimi kontrol edilir. */
export function evaluateWagerSummary(account: AccountSnapshot, specs: RulesConfig = defaultEmptySpecs): RuleSetResult {
  const bonusRemaining = account.wageringRemaining ?? 0;
  const lastDeposit = account.lastDeposit;

  const activeBonuses = (account.bonuses ?? []) as BCBonus[];
  let principalMult = 1;
  let casinoMult: number | null = null;
  let sportMult: number | null = null;
  let minSportOdds: number | null = null;
  for (const b of activeBonuses) {
    const spec = _getSpecForBonus(specs, Number(b.Id), String(b.Name));
    if (spec?.principalWagerMult != null) {
      principalMult = Math.max(principalMult, spec.principalWagerMult);
    }
    if (spec?.casinoWagering != null) {
      casinoMult = Math.max(casinoMult ?? 0, spec.casinoWagering);
    }
    if (spec?.sportWagering != null) {
      sportMult = Math.max(sportMult ?? 0, spec.sportWagering);
    }
    if (spec?.minSportOdds != null) {
      minSportOdds = minSportOdds == null ? spec.minSportOdds : Math.max(minSportOdds, spec.minSportOdds);
    }
  }

  const principalWagerRequired = (lastDeposit?.amount ?? 0) * principalMult;
  const principalWagerPlayed = account.totalBetAmountSinceLastDeposit ?? 0;

  const principalWagerOk = principalWagerPlayed >= principalWagerRequired;
  const bonusWagerOk = bonusRemaining <= 0;

  const items: ChecklistItem[] = [];

  if (principalWagerRequired > 0) {
    items.push({
      id: 'principal-turnover',
      label: `Anapara çevrim kontrolü (Min: ${principalWagerRequired} TRY)`,
      ok: principalWagerOk,
      reason: principalWagerOk
        ? `Tamamlandı (Oynanan: ${principalWagerPlayed.toFixed(2)} TRY)`
        : `Eksik (Oynanan: ${principalWagerPlayed.toFixed(2)} TRY, Gereken: ${principalWagerRequired} TRY)`,
    });
  }

  // Ürün bazlı çevrim: bonus kuralında casino/spor için ayrı çarpan tanımlıysa,
  // toplam anapara çevriminin yanı sıra her ürün kendi çarpanına göre ayrıca kontrol edilir.
  // Bu ayrım yalnızca ürün bazlı oynama verisi olan kaynaklarda (Lynon) mevcuttur;
  // yoksa mevcut toplam anapara çevrimi kontrolü değişmeden geçerliliğini korur.
  const casinoPlayed = (account as any).casinoBetAmountSinceLastDeposit as number | undefined;
  const sportPlayed = (account as any).sportBetAmountSinceLastDeposit as number | undefined;
  if (casinoMult != null && casinoPlayed != null) {
    const required = (lastDeposit?.amount ?? 0) * casinoMult;
    const ok = casinoPlayed >= required;
    items.push({
      id: 'product-wagering-casino',
      label: `Ürün Çevrimi — Casino (Min: ${required.toFixed(2)} TRY)`,
      ok,
      reason: ok
        ? `Tamamlandı (Oynanan: ${casinoPlayed.toFixed(2)} TRY)`
        : `Eksik (Oynanan: ${casinoPlayed.toFixed(2)} TRY, Gereken: ${required.toFixed(2)} TRY)`,
    });
  }
  if (sportMult != null && sportPlayed != null) {
    const required = (lastDeposit?.amount ?? 0) * sportMult;
    const ok = sportPlayed >= required;
    items.push({
      id: 'product-wagering-sport',
      label: `Ürün Çevrimi — Spor (Min: ${required.toFixed(2)} TRY)`,
      ok,
      reason: ok
        ? `Tamamlandı (Oynanan: ${sportPlayed.toFixed(2)} TRY)`
        : `Eksik (Oynanan: ${sportPlayed.toFixed(2)} TRY, Gereken: ${required.toFixed(2)} TRY)`,
    });
  }

  // Spor kuponu şartı: son yatırımdan sonraki spor bahislerinden en az biri, tanımlı minimum orana eşit/üstü olmalı.
  const sportOdds = (account as any).sportOddsSinceLastDeposit as number[] | undefined;
  if (minSportOdds != null && sportOdds != null) {
    const requiredOdds = minSportOdds;
    const ok = sportOdds.some((odds) => odds >= requiredOdds);
    items.push({
      id: 'sport-coupon-min-odds',
      label: `Spor Kuponu Şartı (Min Oran: ${requiredOdds})`,
      ok,
      reason: ok
        ? 'UYGUN: Şartı sağlayan bir kupon bulundu'
        : sportOdds.length > 0
          ? `RED: En yüksek oran ${Math.max(...sportOdds)}, gereken ${requiredOdds}`
          : 'RED: Son yatırımdan sonra spor kuponu bulunamadı',
    });
  }

  items.push({
    id: 'bonus-wagering',
    label: 'Bonus çevrim kontrolü',
    ok: bonusWagerOk,
    reason: bonusWagerOk
      ? 'Tamamlandı'
      : `Eksik (Kalan: ${bonusRemaining.toFixed(2)} TRY)`,
  });

  const overallOk = items.every((i) => i.ok);
  return { overallOk, items };
}

// ─── Bonus Kuralları ─────────────────────────────────────────────────────────

/** Bonus adına göre gruplama için normalize (aynı kampanya farklı kayıtlarda tek satır). */
function normalizeBonusNameForGroup(name: string): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function evaluateBonusRules(account: AccountSnapshot, specs: RulesConfig = defaultEmptySpecs): RuleSetResult {
  const bonuses = (account.bonuses ?? []) as Array<{ Id?: number; Name?: string; ToWagerAmount?: number; Amount?: number; BonusType?: number; CreatedLocal?: string; [key: string]: unknown }>;
  const items: ChecklistItem[] = [];

  if (bonuses.length === 0) {
    items.push({
      id: 'no-bonuses',
      label: 'Kural Denetimi: Aktif Bonus Yok',
      ok: true,
      reason: 'Hesapta denetlenmesi gereken aktif bonus bulunmamaktadır.',
    });
    return { overallOk: true, items };
  }

  // Aynı isimli bonusları grupla
  const byName = new Map<string, { displayName: string; toWagerSum: number; maxAmount: number; firstId: number; firstBonusType?: number; firstCreatedLocal?: string }>();
  for (const b of bonuses) {
    const key = normalizeBonusNameForGroup(b.Name ?? '');
    const toWager = Number(b.ToWagerAmount) || 0;
    const amount = Number(b.Amount) || 0;
    if (byName.has(key)) {
      const g = byName.get(key)!;
      g.toWagerSum += toWager;
      g.maxAmount = Math.max(g.maxAmount, amount);
    } else {
      byName.set(key, {
        displayName: String(b.Name ?? 'Bonus').trim(),
        toWagerSum: toWager,
        maxAmount: amount,
        firstId: Number(b.Id),
        firstBonusType: b.BonusType,
        firstCreatedLocal: b.CreatedLocal,
      });
    }
  }

  for (const [, g] of byName) {
    const bonusName = g.displayName;
    const bonusId = g.firstId;
    const spec = _getSpecForBonus(specs, bonusId, bonusName);

    const wagerOk = g.toWagerSum <= 0;
    items.push({
      id: `bonus-wager-${bonusId}-${normalizeBonusNameForGroup(bonusName)}`,
      label: `${bonusName} Çevrim Kontrolü`,
      ok: wagerOk,
      reason: wagerOk ? 'TAMAMLANDI' : `Eksik: ${g.toWagerSum.toFixed(2)} TRY daha çevrim gerekli.`,
      severity: 'high',
    });

    if (spec) {
      const balance = account.balance ?? 0;
      const isFreeSpinGroup = g.firstBonusType === 5 || /freespin|free spin/i.test(bonusName);
      let freeSpinWinAmount = 0;

      if (isFreeSpinGroup) {
        const fromTime = g.firstCreatedLocal ? parseDateToTime(g.firstCreatedLocal) : 0;
        const freespinTxs = (account.profileTransactions ?? []).filter((tx: any) => {
          const isKazanc = String(tx.DocumentTypeName).trim() === 'Kazanç Artar';
          const hasFS = /freespin|free spin/i.test(String(tx.Game ?? '')) || /freespin|free spin/i.test(String(tx.Note ?? ''));
          const txTime = parseDateToTime(tx.CreatedLocal);
          return isKazanc && hasFS && txTime >= fromTime;
        });
        freeSpinWinAmount = freespinTxs.reduce((sum, tx) => sum + (Math.abs(Number(tx.Amount)) || 0), 0);
      }

      const bonusAmount = g.maxAmount;
      const effectiveBonusAmount = isFreeSpinGroup && freeSpinWinAmount > 0 ? freeSpinWinAmount : bonusAmount;
      const fsText = isFreeSpinGroup && freeSpinWinAmount > 0 ? ` (İşlemlerden yansıyan FS Kazancı: ${freeSpinWinAmount.toFixed(2)} TRY)` : '';

      let maxPayout = spec.maxPayoutFixed;

      if (isFreeSpinGroup && maxPayout == null && spec.maxPayoutMult == null) {
        maxPayout = 5000;
      }

      if (spec.maxPayoutMult != null && effectiveBonusAmount > 0) {
        const multVal = effectiveBonusAmount * spec.maxPayoutMult;
        const maxVal = spec.maxPayoutFixed != null ? Math.min(multVal, spec.maxPayoutFixed) : multVal;
        if (isFreeSpinGroup && /500 freespin/i.test(bonusName)) {
          maxPayout = Math.max(1000, maxVal);
        } else {
          maxPayout = maxVal;
        }
      }

      if (maxPayout != null) {
        const payoutOk = balance <= maxPayout;
        const bonusExceededAmount = balance - maxPayout;
        items.push({
          id: `bonus-payout-${bonusId}-${normalizeBonusNameForGroup(bonusName)}`,
          label: `${bonusName} Maksimum Kazanç Limiti${fsText}`,
          ok: payoutOk,
          reason: payoutOk
            ? `Limit Dahilinde (Maksimum Çekilebilir: ${maxPayout.toFixed(2)} TRY)`
            : `HATA: Mevcut bakiye (${balance.toFixed(2)} TRY), bu bonusun kazanç limitini (${maxPayout.toFixed(2)} TRY) aşıyor. Fazla tutar: ${bonusExceededAmount.toFixed(2)} TRY silinmeli!`,
          severity: 'high',
        });
      }
    }
  }

  const overallOk = items.every((i) => i.ok);
  return { overallOk, items };
}
