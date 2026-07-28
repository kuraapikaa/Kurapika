import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_DIR = join(__dirname, '..', 'data', 'rules');

function safeTenantKey(tenantKey: string) {
  const k = String(tenantKey || 'default').trim() || 'default';
  // only allow simple filename-safe keys
  return k.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function rulesPathForTenant(tenantKey: string) {
  return join(RULES_DIR, `${safeTenantKey(tenantKey)}.json`);
}

export type PromoSpec = {
    /** Oto bonus listesinde görünsün/kullanılsın mı? (varsayılan: true) */
    enabled?: boolean;
    minDep?: number;
    /** Bonus için tek seferlik yatırım alt sınırı (son yatırım tutarı baz alınır). */
    minDepositAmount?: number;
    /** Bonus için tek seferlik yatırım üst sınırı (son yatırım tutarı baz alınır). */
    maxDepositAmount?: number;
    /** Bu bonustan yararlananlar sonrasında kayıp bonusu alabilir mi? (metadata) */
    canReceiveLossBonus?: boolean;
    /** Bu bonustan yararlananlar sonrasında çark bonusu alabilir mi? (metadata) */
    canReceiveWheelBonus?: boolean;
    /** Günlük kullanım limiti (bonus adı/ID eşleşmesine göre). */
    perDayLimit?: number;
    /** Haftalık kullanım limiti (bonus adı/ID eşleşmesine göre). */
    perWeekLimit?: number;
    /** İlk yatırım bonusu mu? true ise yalnızca ilk yatırımda/ilk yatırımlar arasında geçerli. */
    isFirstDepositBonus?: boolean;
    /** Sadece yatırım/çekim geçmişi olmayan yeni kullanıcı alabilir mi? */
    onlyNewUsersNoDepositNoWithdraw?: boolean;
    principalWagerMult?: number;
    bonusWagerMult?: number;
    /** Otomatik çekim onayında ürün bazlı çevrim kontrolü: casino bahisleri için ayrı çarpan. */
    casinoWagering?: number;
    /** Otomatik çekim onayında ürün bazlı çevrim kontrolü: spor bahisleri için ayrı çarpan. */
    sportWagering?: number;
    /** Spor kuponu şartı: son yatırımdan sonraki spor bahislerinden en az biri bu orana eşit/üstü olmalı. */
    minSportOdds?: number;
    maxPayoutMult?: number;
    maxPayoutFixed?: number;

    // New Fields
    type?: 'partner' | 'cash';
    partnerBonusId?: string;
    amountType?: 'fixed' | 'percentage' | 'full' | 'tiered' | 'tieredRange' | 'tieredPercentage';
    fixedAmount?: number;
    percentageAmount?: number;
    tieredAmounts?: Array<{ min: number; bonus: number }>;
    tieredRanges?: Array<{ min: number; max: number; bonus: number }>;
    /**
     * Yüzdeli barem aralığı: yatırım tutarı [min, max] aralığına düşerse bonus,
     * sabit tutar yerine o aralığın yüzdesi olarak hesaplanır. maxBonus verilirse
     * hesaplanan tutar o tavanla sınırlanır.
     */
    tieredPercentageRanges?: Array<{ min: number; max: number; percent: number; maxBonus?: number }>;
    /**
     * Bonus tutarının hangi tabana göre hesaplanacağı. Belirtilmezse lossBonus
     * kuralları net kaybı, diğerleri son yatırımı kullanır.
     */
    basisSource?: 'lastDeposit' | 'netLoss';
    checkPendingWithdrawal?: boolean;
    checkLastTransactionIsDeposit?: boolean;
    checkSingleInvestmentUsage?: boolean;
    checkSameDayUsage?: boolean;
    requiresPhoneVerified?: boolean;
    requiresEmailVerified?: boolean;
    checkIPDuplicate?: boolean;
    allowedProviders?: string[];
    minBalanceToClaim?: number;
    maxBalanceToClaim?: number;
    maxKpiLimit?: number;
    lossBonus?: boolean;
    requestWithinHours?: number;
    balanceBelow?: number;
    noOpenBets?: boolean;
    activeDays?: string[];
    startTime?: string;
    endTime?: string;
    category?: string;
    excludeFromLossCalculations?: boolean;
    isAutoCharge?: boolean;
    /** Önceki takvim günündeki başarılı yatırımların toplamını baz alır (Europe/Istanbul). */
    isNextDayBonus?: boolean;
    /** Ertesi gün bonusunu Türkiye saatiyle 00:15'te uygun oyunculara otomatik tanımlar. */
    autoGrantNextDayAt0015?: boolean;
    /** Lynon kampanya atamasında gereken dinamik blok değerleri. */
    assignmentValues?: Record<string, unknown>;
    /** F: Process FreeSpin / Bet Level -> BetLevel */
    freespinBetLevel?: number;
    /** F: Process FreeSpin / Count -> RoundCount */
    freespinCount?: number;
    /** F: Process FreeSpin / Games -> Game (oyun ID'si veya Lynon seçim nesnesi) */
    freespinGame?: unknown;
    /** F: Process FreeSpin / Games seçimindeki oyun kimliği */
    freespinGameId?: number;
    /** F: Process FreeSpin / Games seçimindeki sağlayıcı kimliği */
    freespinGameProviderId?: number;
    allowedSegments?: string[];
    newPlayerMaxDays?: number;
    newPlayerMaxDeposits?: number;
};

type FreespinGameSelection = { id: number; providerId: number };

function normalizeFreespinGame(value: unknown): unknown {
  let parsed = value;
  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if (!trimmed) return undefined;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    } else {
      return trimmed;
    }
  }

  if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const id = Number(record.id ?? record.Id);
    const providerId = Number(record.providerId ?? record.ProviderId);
    if (Number.isInteger(id) && id > 0 && Number.isInteger(providerId) && providerId > 0) {
      return { id, providerId } satisfies FreespinGameSelection;
    }
  }
  return parsed;
}

/** Bonus kuralındaki Freespin alanlarını Lynon F: Process FreeSpin anahtarlarına dönüştürür. */
export function assignmentValuesForPromoSpec(spec: PromoSpec): Record<string, unknown> {
  const values: Record<string, unknown> = { ...(spec.assignmentValues ?? {}) };
  if (spec.freespinBetLevel !== undefined && spec.freespinBetLevel !== null) values.BetLevel = Number(spec.freespinBetLevel);
  if (spec.freespinCount !== undefined && spec.freespinCount !== null) values.RoundCount = Number(spec.freespinCount);

  const sourceGame = normalizeFreespinGame(spec.freespinGame ?? values.Game);
  const sourceRecord = sourceGame != null && typeof sourceGame === 'object' && !Array.isArray(sourceGame)
    ? sourceGame as Record<string, unknown>
    : {};
  const gameId = Number(spec.freespinGameId ?? sourceRecord.id ?? sourceRecord.Id ?? (typeof sourceGame === 'number' ? sourceGame : NaN));
  const providerId = Number(spec.freespinGameProviderId ?? sourceRecord.providerId ?? sourceRecord.ProviderId);
  if (Number.isInteger(gameId) && gameId > 0 && Number.isInteger(providerId) && providerId > 0) {
    values.Game = { id: gameId, providerId } satisfies FreespinGameSelection;
  } else if (sourceGame !== undefined && sourceGame !== null && sourceGame !== '') {
    values.Game = sourceGame;
  }
  return values;
}

export interface RulesConfig {
    PROMO_SPECS: Record<string, PromoSpec>;
    PROMO_TITLE_SPECS: Record<string, PromoSpec>;
}

export async function getRules(tenantKey: string = 'default'): Promise<RulesConfig> {
  const rulesPath = rulesPathForTenant(tenantKey);
  return readStoredDocument<RulesConfig>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'bonus-rules',
    filePath: rulesPath,
    fallback: async () => {
      const legacyPath = join(__dirname, '..', '..', 'rules-config.json');
      if (existsSync(legacyPath)) {
        try {
          return JSON.parse(await readFile(legacyPath, 'utf-8')) as RulesConfig;
        } catch {
          // Invalid legacy data is ignored and replaced with an empty configuration.
        }
      }
      return { PROMO_SPECS: {}, PROMO_TITLE_SPECS: {} };
    },
  });
}

export async function saveRules(tenantKey: string, config: RulesConfig): Promise<void> {
  const errors: string[] = [];
  for (const [groupName, rules] of Object.entries({
    PROMO_SPECS: config?.PROMO_SPECS ?? {},
    PROMO_TITLE_SPECS: config?.PROMO_TITLE_SPECS ?? {},
  })) {
    for (const [key, spec] of Object.entries(rules)) {
      if (spec.autoGrantNextDayAt0015 === true && spec.isNextDayBonus !== true) {
        errors.push(`${groupName}.${key}: 00:15 otomatik ekleme yalnızca ertesi gün bonuslarında kullanılabilir`);
      }
      const assignmentValues = assignmentValuesForPromoSpec(spec);
      const hasFreespinAssignment = ['BetLevel', 'RoundCount', 'Game'].some((field) => assignmentValues[field] !== undefined && assignmentValues[field] !== null && assignmentValues[field] !== '');
      if (hasFreespinAssignment) {
        if (!Number.isInteger(Number(assignmentValues.BetLevel)) || Number(assignmentValues.BetLevel) <= 0) {
          errors.push(`${groupName}.${key}: Freespin Bet Level pozitif tam sayı olmalıdır`);
        }
        if (!Number.isInteger(Number(assignmentValues.RoundCount)) || Number(assignmentValues.RoundCount) <= 0) {
          errors.push(`${groupName}.${key}: Freespin Count pozitif tam sayı olmalıdır`);
        }
        const game = assignmentValues.Game != null && typeof assignmentValues.Game === 'object' && !Array.isArray(assignmentValues.Game)
          ? assignmentValues.Game as Record<string, unknown>
          : {};
        const gameId = Number(game.id ?? game.Id);
        const providerId = Number(game.providerId ?? game.ProviderId);
        if (!Number.isInteger(gameId) || gameId <= 0 || !Number.isInteger(providerId) || providerId <= 0) {
          errors.push(`${groupName}.${key}: Freespin Games için geçerli Game ID ve Provider ID zorunludur`);
        }
      }
      if (spec.enabled !== false && (spec.type ?? 'partner') === 'partner') {
        const partnerBonusId = Number(spec.partnerBonusId);
        if (!Number.isInteger(partnerBonusId) || partnerBonusId <= 0) {
          errors.push(`${groupName}.${key}: Partner Bonus ID eksik veya geçersiz`);
        }
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join(' | '));
  }

  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'bonus-rules', filePath: rulesPathForTenant(tenantKey) },
    config,
  );
}
