/**
 * withdrawalEngine'den ayrılmış promosyon değerlendirme modülü.
 * evaluateForAccount fonksiyonu bonus/promosyon kurallarını kontrol eder.
 */
import type { NormalizedPromo } from '../lib/promosParser.js';
import { parseDateToTime } from './accountSnapshotService.js';
import type { PromoSpec, RulesConfig } from './rulesService.js';
import type { AccountSnapshot, ChecklistItem, PromoChecklist } from './withdrawalEngine.js';
import type { BCBonus, TransactionTypeSummary } from '../types/betconstruct.js';

/** Profil işlemlerinde yatırım olarak kabul edilen doküman türleri. */
const DEPOSIT_TYPE_KEYS = ['Yatırım', 'Deposit', 'Yatırım Talebi Ödemesi'];
const WITHDRAWAL_PAID_TYPE_KEYS = ['Çekim Talebi Ödemesi', 'Çekim talebi Ödemesi', 'Withdrawal Payment'];

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────

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

export function getSpecForPromo(specs: RulesConfig, promo: NormalizedPromo): PromoSpec | undefined {
  const byId = promo.id != null ? specs.PROMO_SPECS[String(promo.id)] : undefined;
  return byId ?? findSpecByTitle(specs, promo.title ?? '');
}

export function getSpecForBonus(specs: RulesConfig, bonusId: number, bonusName: string): PromoSpec | undefined {
  return specs.PROMO_SPECS[String(bonusId)] ?? findSpecByTitle(specs, bonusName);
}

// ─── Minimum Yatırım Kontrolü ────────────────────────────────────────────────

function depositBasis(account: AccountSnapshot, spec: PromoSpec | undefined): number {
  return spec?.isNextDayBonus === true
    ? Number((account as any).previousDayDepositTotal ?? 0)
    : Number(account.lastDeposit?.amount ?? 0);
}

function depositBasisLabel(spec: PromoSpec | undefined): string {
  return spec?.isNextDayBonus === true ? 'Önceki gün toplam yatırımı' : 'Son yatırım';
}

function checkMinDeposit(account: AccountSnapshot, spec: PromoSpec | undefined, promo: NormalizedPromo): ChecklistItem | null {
  const requiredMinDep = spec?.minDep ?? promo.minDeposit;
  if (requiredMinDep == null) return null;

  const actual = spec?.isNextDayBonus === true ? depositBasis(account, spec) : Number(account.totalDeposits ?? 0);
  const ok = actual >= requiredMinDep;
  return {
    id: 'min-deposit',
    label: `Minimum Yatırım Şartı (${requiredMinDep} TRY)`,
    ok,
    reason: ok ? `UYGUN: ${depositBasisLabel(spec)} ${actual} TRY` : `Eksik: ${Math.max(0, requiredMinDep - actual)} TRY`,
  };
}

function checkDepositRange(account: AccountSnapshot, spec: PromoSpec | undefined): ChecklistItem | null {
  const basisAmount = depositBasis(account, spec);
  if (spec?.minDepositAmount == null && spec?.maxDepositAmount == null) return null;

  const minOk = spec.minDepositAmount != null ? basisAmount >= spec.minDepositAmount : true;
  const maxOk = spec.maxDepositAmount != null ? basisAmount <= spec.maxDepositAmount : true;
  const ok = minOk && maxOk;
  const rangeText = `${spec.minDepositAmount != null ? spec.minDepositAmount : '—'}–${spec.maxDepositAmount != null ? spec.maxDepositAmount : '—'} TRY`;

  return {
    id: 'deposit-amount-range',
    label: `${spec.isNextDayBonus ? 'Önceki Gün Toplam Yatırım' : 'Tek Seferlik Yatırım'} Aralığı (${rangeText})`,
    ok,
    reason: `${depositBasisLabel(spec)}: ${basisAmount} TRY`,
  };
}
function checkNewUserOnly(byType: Record<string, TransactionTypeSummary>, spec: PromoSpec | undefined): ChecklistItem | null {
  if (spec?.onlyNewUsersNoDepositNoWithdraw !== true) return null;

  const depositCount = getDepositCount(byType);
  const depositSum = getDepositSum(byType);
  const withdrawalPaid = WITHDRAWAL_PAID_TYPE_KEYS.reduce((sum, key) => sum + (byType[key]?.totalAmount ?? 0), 0);
  const ok = depositCount === 0 && depositSum === 0 && withdrawalPaid === 0;
  return {
    id: 'only-new-users-no-deposit-withdraw',
    label: 'Sadece yatırım/çekim geçmişi olmayan yeni kullanıcı alabilir',
    ok,
    reason: ok ? 'UYGUN' : `Yatırım adedi: ${depositCount}, yatırım toplam: ${depositSum}, çekim: ${withdrawalPaid}`,
  };
}

// ─── İlk Yatırım Kontrolü ───────────────────────────────────────────────────

function checkFirstDeposit(byType: Record<string, TransactionTypeSummary>, spec: PromoSpec | undefined): ChecklistItem | null {
  if (spec?.isFirstDepositBonus !== true) return null;

  const depositCount = getDepositCount(byType);
  const ok = depositCount <= 1;
  return {
    id: 'first-deposit-only',
    label: 'İlk yatırım bonusu (yalnızca 1. yatırım)',
    ok,
    reason: ok ? 'UYGUN' : `Yatırım adedi: ${depositCount}`,
  };
}

// ─── Kullanım Limiti Kontrolü ────────────────────────────────────────────────

function checkUsageLimits(account: AccountSnapshot, spec: PromoSpec | undefined, promo: NormalizedPromo): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  if (spec?.perDayLimit == null && spec?.perWeekLimit == null) return items;

  const bonuses = (account.bonuses as BCBonus[]) ?? [];
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const promoTitle = String(promo.title ?? '').toLowerCase();
  const promoId = promo.id != null ? Number(promo.id) : null;

  const matchesPromo = (b: BCBonus) => {
    const name = String(b?.Name ?? '').toLowerCase();
    const id = b?.Id != null ? Number(b.Id) : null;
    if (promoId != null && id != null && id === promoId) return true;
    if (!promoTitle) return false;
    return name.includes(promoTitle) || promoTitle.includes(name);
  };

  const parseBonusTime = (b: BCBonus) => {
    const t = b?.CreatedLocal ? parseDateToTime(String(b.CreatedLocal)) : 0;
    return t || 0;
  };

  const matched = bonuses.filter(matchesPromo);
  const dayCount = matched.filter((b) => parseBonusTime(b) >= dayAgo).length;
  const weekCount = matched.filter((b) => parseBonusTime(b) >= weekAgo).length;

  if (spec!.perDayLimit != null) {
    const ok = dayCount < spec!.perDayLimit;
    items.push({
      id: 'per-day-limit',
      label: `Günlük kullanım limiti (< ${spec!.perDayLimit})`,
      ok,
      reason: ok ? `Son 24 saatte kullanım: ${dayCount}` : `Limit aşıldı: ${dayCount}/${spec!.perDayLimit}`,
    });
  }
  if (spec!.perWeekLimit != null) {
    const ok = weekCount < spec!.perWeekLimit;
    items.push({
      id: 'per-week-limit',
      label: `Haftalık kullanım limiti (< ${spec!.perWeekLimit})`,
      ok,
      reason: ok ? `Son 7 günde kullanım: ${weekCount}` : `Limit aşıldı: ${weekCount}/${spec!.perWeekLimit}`,
    });
  }

  return items;
}

// ─── Bonus Tutar Hesaplama ───────────────────────────────────────────────────

interface BonusCalculation {
  item: ChecklistItem;
  calculatedAmount?: number;
}

function calculateBonusAmount(account: AccountSnapshot, spec: PromoSpec): BonusCalculation | null {
  if (!spec.amountType) return null;

  const basis = depositBasis(account, spec);
  const basisLabel = depositBasisLabel(spec);
  let amount = 0;
  let calcDesc = '';

  if (spec.amountType === 'fixed') {
    amount = spec.fixedAmount ?? 0;
    calcDesc = `${amount} TRY sabit tutar`;
  } else if (spec.amountType === 'percentage') {
    amount = (basis * (spec.percentageAmount ?? 0)) / 100;
    calcDesc = `${basisLabel} (${basis} TRY) × %${spec.percentageAmount ?? 0}`;
  } else if (spec.amountType === 'full') {
    amount = basis;
    calcDesc = `${basisLabel} (${basis} TRY)`;
  } else if (spec.amountType === 'tiered' && spec.tieredAmounts) {
    const sorted = [...spec.tieredAmounts].sort((a, b) => b.min - a.min);
    const tier = sorted.find((item) => basis >= item.min);
    if (tier) {
      amount = tier.bonus;
      calcDesc = `${basisLabel} ${basis} TRY; ${tier.min} TRY baremi (${amount} TRY)`;
    } else {
      calcDesc = `Eksik: minimum ${sorted[sorted.length - 1]?.min ?? 0} TRY gerekli; ${basisLabel.toLocaleLowerCase('tr-TR')} ${basis} TRY.`;
    }
  }

  if (amount > 0) {
    return {
      item: { id: 'bonus-calculation', label: `Bonus Hakedişi: ${amount.toFixed(2)} TRY`, ok: true, reason: `Hesaplama: ${calcDesc}` },
      calculatedAmount: amount,
    };
  }
  if (spec.amountType === 'tiered') {
    return { item: { id: 'bonus-calculation', label: 'Bonus Hakedişi: 0 TRY', ok: false, reason: calcDesc } };
  }
  return null;
}
const defaultEmptySpecs: RulesConfig = { PROMO_SPECS: {}, PROMO_TITLE_SPECS: {} };

export async function evaluateForAccount(
  account: AccountSnapshot,
  promo: NormalizedPromo,
  specs: RulesConfig = defaultEmptySpecs,
  _tenantKey: string = 'default'
): Promise<PromoChecklist> {
  const items: ChecklistItem[] = [];
  const spec = getSpecForPromo(specs, promo);

  if (!spec) {
    items.push({
      id: 'missing-rule',
      label: 'Bonus kuralı tanımlı değil',
      ok: false,
      reason: 'Bu kampanya için panelde aktif ve eksiksiz bir kural bulunamadı. Bonus talebi engellendi.',
    });
    return {
      promoId: promo.id,
      promoTitle: promo.title,
      overallOk: false,
      items,
    };
  }

  if (spec.enabled === false) {
    items.push({
      id: 'disabled-rule',
      label: 'Bonus kuralı pasif',
      ok: false,
      reason: 'Bu kampanya kural merkezi üzerinden pasif durumda. Bonus talebi engellendi.',
    });
    return {
      promoId: promo.id,
      promoTitle: promo.title,
      overallOk: false,
      items,
    };
  }

  const dataCompleteness = (account as any).dataCompleteness as Record<string, boolean> | undefined;
  if (dataCompleteness) {
    const missingSources = Object.entries(dataCompleteness)
      .filter(([, complete]) => !complete)
      .map(([source]) => source);
    if (missingSources.length > 0) {
      items.push({
        id: 'incomplete-lynon-data',
        label: 'Lynon uygunluk kaynakları eksiksiz okunmalı',
        ok: false,
        reason: `Eksik kaynaklar: ${missingSources.join(', ')}`,
      });
      return { promoId: promo.id, promoTitle: promo.title, overallOk: false, items };
    }
  }

  const byType = (account.profileTransactionsByType as Record<string, TransactionTypeSummary>) ?? {};

  if (spec.isNextDayBonus === true) {
    const previousDayTotal = Number((account as any).previousDayDepositTotal ?? 0);
    const previousDayCount = Number((account as any).previousDayDepositCount ?? 0);
    const previousDayKey = String((account as any).previousDayDateKey ?? 'bilinmiyor');
    items.push({
      id: 'previous-day-deposit',
      label: `Ertesi Gün Bonusu — ${previousDayKey} başarılı yatırımları`,
      ok: previousDayCount > 0 && previousDayTotal > 0,
      reason: previousDayCount > 0
        ? `${previousDayCount} başarılı yatırım, toplam ${previousDayTotal.toFixed(2)} TRY`
        : 'Önceki takvim gününde başarılı yatırım bulunamadı.',
    });
  }

  // 1. Minimum Yatırım
  const minDepCheck = checkMinDeposit(account, spec, promo);
  if (minDepCheck) items.push(minDepCheck);

  // 1.b Tek seferlik yatırım aralığı
  const depRangeCheck = checkDepositRange(account, spec);
  if (depRangeCheck) items.push(depRangeCheck);

  // 1.c Sadece yeni kullanıcı
  const newUserCheck = checkNewUserOnly(byType, spec);
  if (newUserCheck) items.push(newUserCheck);

  // 1.d İlk yatırım bonusu
  const firstDepCheck = checkFirstDeposit(byType, spec);
  if (firstDepCheck) items.push(firstDepCheck);

  // 1.e Kullanım limitleri
  items.push(...checkUsageLimits(account, spec, promo));

  // 2. Çevrim Şartı (Anapara + Bonus)
  const lastDepAmount = depositBasis(account, spec);
  const principalMult = spec?.principalWagerMult ?? 1;
  const bonusMult = spec?.bonusWagerMult ?? 0;

  const activeBonus = (account.bonuses as BCBonus[])?.find(b =>
    promo.title.toLowerCase().includes(b.Name.toLowerCase()) ||
    b.Name.toLowerCase().includes(promo.title.toLowerCase())
  );

  const bonusRemaining = activeBonus?.ToWagerAmount ?? account.wageringRemaining ?? 0;
  const playedAmount = account.totalBetAmountSinceLastDeposit ?? 0;
  const requiredPrincipalWager = lastDepAmount * principalMult;

  const isFreeSpin = activeBonus?.BonusType === 5 || (activeBonus?.Name && /freespin|free spin/i.test(activeBonus.Name));

  let freeSpinWinAmount = 0;
  if (isFreeSpin) {
    const activeBonusTime = activeBonus?.CreatedLocal ? parseDateToTime(activeBonus.CreatedLocal) : 0;
    const freespinTxs = (account.profileTransactions ?? []).filter((tx: any) => {
      const isKazanc = String(tx.DocumentTypeName).trim() === 'Kazanç Artar';
      const hasFS = /freespin|free spin/i.test(String(tx.Game ?? '')) || /freespin|free spin/i.test(String(tx.Note ?? ''));
      const txTime = parseDateToTime(tx.CreatedLocal);
      return isKazanc && hasFS && txTime >= activeBonusTime;
    });
    freeSpinWinAmount = freespinTxs.reduce((sum, tx) => sum + (Math.abs(Number(tx.Amount)) || 0), 0);
  }

  const fsText = isFreeSpin && freeSpinWinAmount > 0 ? ` (İşlemlerden yansıyan FS Kazancı: ${freeSpinWinAmount.toFixed(2)} TRY)` : '';

  if (requiredPrincipalWager > 0) {
    const ok = playedAmount >= requiredPrincipalWager;
    items.push({
      id: 'principal-wager',
      label: `Anapara Çevrimi (${principalMult}x)`,
      ok,
      reason: ok ? 'TAMAMLANDI' : `Eksik: ${Math.round(requiredPrincipalWager - playedAmount)} TRY daha bahis yapılmalı.`,
    });
  }

  if (promo.wagering || bonusMult > 0 || bonusRemaining > 0) {
    const ok = bonusRemaining <= 0;
    items.push({
      id: 'bonus-wagering',
      label: `Bonus Çevrimi ${promo.wagering ? `(${promo.wagering})` : ''}`,
      ok,
      reason: ok ? 'TAMAMLANDI' : `Eksik: ${bonusRemaining.toFixed(2)} TRY daha çevrim gerekli.`,
    });
  }

  // 3. Maksimum Kazanç
  const balance = account.balance ?? 0;
  const bonusAmount = activeBonus?.Amount ?? 0;
  const effectiveBonusAmount = isFreeSpin && freeSpinWinAmount > 0 ? freeSpinWinAmount : bonusAmount;
  let maxPayout = spec?.maxPayoutFixed;

  if (isFreeSpin && maxPayout == null && spec?.maxPayoutMult == null) {
    maxPayout = 5000;
  }

  if (spec?.maxPayoutMult != null && effectiveBonusAmount > 0) {
    const multPayout = effectiveBonusAmount * spec.maxPayoutMult;
    const maxVal = spec.maxPayoutFixed != null ? Math.min(multPayout, spec.maxPayoutFixed) : multPayout;
    if (isFreeSpin && /500 freespin/i.test(activeBonus?.Name ?? '')) {
      maxPayout = Math.max(1000, maxVal);
    } else {
      maxPayout = maxVal;
    }
  }

  if (maxPayout != null) {
    const ok = balance <= maxPayout;
    const bonusExceededAmount = balance - maxPayout;
    items.push({
      id: 'max-payout-check',
      label: `Maksimum Kazanç Limiti (${maxPayout} TRY)${fsText}`,
      ok,
      reason: ok ? 'LIMIT DAHİLİNDE' : `Hata: Mevcut bakiye (${balance.toFixed(2)} TRY) çekilebilir tutarı (${maxPayout.toFixed(2)} TRY) aşıyor. Fazla tutar: ${bonusExceededAmount.toFixed(2)} TRY silinmeli!`,
    });
  }

  // 4. İzin Verilen Oyunlar
  if (promo.allowedGames && promo.allowedGames.length > 0) {
    const recent = account.recentGames ?? [];
    const intersection = recent.filter((g) => promo.allowedGames!.includes(g));
    const ok = intersection.length > 0;
    items.push({
      id: 'allowed-games-check',
      label: `Geçerli Oyunlar: ${promo.allowedGames.join(', ')}`,
      ok,
      reason: ok ? 'UYGUN' : `Hata: Son aktivitelerde izin verilen oyunlar bulunamadı.`,
    });
  }

  const overallOkInitial = items.every((i) => i.ok || i.id === 'exclusions-notice' || i.id === 'max-payout-check');
  const result: PromoChecklist = {
    promoId: promo.id,
    promoTitle: promo.title,
    overallOk: overallOkInitial,
    items,
  };

  // 5. Gelişmiş Bağımsız Kurallar
  if (spec) {
    // 5.a Açıkta Çekim Kontrolü
    if (spec.checkPendingWithdrawal) {
      const pendingCount = Number((account as any).pendingWithdrawalCount ?? ((byType['Çekim Talebi']?.count ?? 0) + (byType['Withdrawal Request']?.count ?? 0)));
      const ok = pendingCount === 0;
      items.push({
        id: 'check-pending-withdrawal',
        label: 'Açıkta Bekleyen Çekim Talebi Kontrolü',
        ok,
        reason: ok ? 'UYGUN: Bekleyen çekim yok' : `RED: Bekleyen ${pendingCount} adet çekim talebi mevcut`,
      });
    }

    // 5.b Son İşlem Yatırım mı?
    if (spec.checkLastTransactionIsDeposit) {
      const txs = (account.profileTransactions ?? []) as any[];
      const lastTx = txs[0];
      const isDeposit = spec.isNextDayBonus === true
        ? Number((account as any).previousDayDepositCount ?? 0) > 0
        : Boolean(lastTx && DEPOSIT_TYPE_KEYS.includes(String(lastTx.DocumentTypeName).trim()));
      items.push({
        id: 'check-last-tx-deposit',
        label: spec.isNextDayBonus ? 'Önceki Gün Başarılı Yatırım Kontrolü' : 'Son İşlem Yatırım Kontrolü',
        ok: isDeposit,
        reason: isDeposit
          ? (spec.isNextDayBonus ? 'UYGUN: Önceki gün başarılı yatırım var' : 'UYGUN: Son işlem yatırım')
          : `RED: Son işlem yatırım değil (${lastTx?.DocumentTypeName || 'Bilinmiyor'})`,
      });
    }
    // 5.b.2 Yatırım ID Takibi
    if (spec.checkSingleInvestmentUsage) {
      const investment = spec.isNextDayBonus === true ? (account as any).previousDayLastDeposit : account.lastDeposit;
      const lastDepTime = investment ? parseDateToTime(investment.dateLocal) : 0;
      const bonuses = (account.bonuses as BCBonus[]) ?? [];
      const usedBonus = bonuses.find(b => {
        const claimTime = parseDateToTime(b.CreatedLocal);
        return claimTime > lastDepTime;
      });
      const ok = !usedBonus;
      items.push({
        id: 'check-single-investment',
        label: 'Yatırım ID Takibi (Tek Yatırım-Tek Bonus)',
        ok,
        reason: ok ? 'UYGUN: Bu yatırım için henüz bonus alınmamış' : `RED: Bu yatırım için zaten bonus alındı (${usedBonus!.Name})`,
      });
    }

    // 5.c Aynı Gün Tekrar Alamaz
    if (spec.checkSameDayUsage) {
      const bonuses = (account.bonuses as BCBonus[]) ?? [];
      const now = new Date();
      const todayStr = now.toLocaleDateString('tr-TR');
      const sameDayCount = bonuses.filter(b => {
        const d = new Date(parseDateToTime(b.CreatedLocal));
        return d.toLocaleDateString('tr-TR') === todayStr &&
               (b.Id === promo.id || b.Name === promo.title);
      }).length;
      const ok = sameDayCount === 0;
      items.push({
        id: 'check-same-day-usage',
        label: 'Aynı Gün Tekrar Alamaz Kontrolü',
        ok,
        reason: ok ? 'UYGUN: Bugün alınmamış' : `RED: Bu bonus bugün zaten alındı`,
      });
    }

    // 5.d Max KPI Limiti
    if (spec.maxKpiLimit != null) {
      const kpi = Number((account as any).totalKpi ?? (account as any).netLoss ?? 0);
      const ok = kpi <= spec.maxKpiLimit;
      items.push({
        id: 'max-kpi-limit',
        label: `Max KPI Limiti (${spec.maxKpiLimit} TRY)`,
        ok,
        reason: ok ? 'UYGUN: Limit dahilinde' : `RED: KPI Sınırı aşıldı (Kullanıcı KPI: ${kpi} TRY)`,
      });
    }

    // 5.e Yeni Oyuncu
    if (spec.newPlayerMaxDays != null || spec.newPlayerMaxDeposits != null) {
      const age = Number((account as any).accountAgeDays ?? 0);
      const depCount = getDepositCount(byType);

      if (spec.newPlayerMaxDays != null) {
        const ok = age <= spec.newPlayerMaxDays;
        items.push({
          id: 'new-player-days',
          label: `Yeni Oyuncu Süre Limiti (${spec.newPlayerMaxDays} Gün)`,
          ok,
          reason: ok ? `UYGUN: Hesap ${age} günlük` : `RED: Hesap çok eski (${age} günlük)`,
        });
      }

      if (spec.newPlayerMaxDeposits != null) {
        const ok = depCount <= spec.newPlayerMaxDeposits;
        items.push({
          id: 'new-player-deposits',
          label: `Min Yatırım Adedi Limiti (${spec.newPlayerMaxDeposits} Yatırım)`,
          ok,
          reason: ok ? `UYGUN: Toplam ${depCount} yatırım` : `RED: Yatırım adedi çok yüksek (${depCount})`,
        });
      }
    }

    // 5.f Max Bakiye
    if (spec.minBalanceToClaim != null) {
      const balance = Number(account.balance ?? 0);
      const ok = balance >= spec.minBalanceToClaim;
      items.push({
        id: 'min-balance-to-claim',
        label: `Min Bakiye Limiti (${spec.minBalanceToClaim} TRY)`,
        ok,
        reason: ok ? 'UYGUN: Bakiye alt limitin üzerinde' : `RED: Bakiye yetersiz (${balance} TRY)`,
      });
    }

    if (spec.maxBalanceToClaim != null) {
      const balance = Number(account.balance ?? 0);
      const ok = balance <= spec.maxBalanceToClaim;
      items.push({
        id: 'max-balance-to-claim',
        label: `Max Bakiye Limiti (${spec.maxBalanceToClaim} TRY)`,
        ok,
        reason: ok ? 'UYGUN: Bakiye limit dahilinde' : `RED: Bakiye çok yüksek (${balance} TRY)`,
      });
    }

    // 5.g Zaman Kısıtlamaları
    if (spec.lossBonus === true) {
      const netLoss = Number((account as any).netLoss ?? 0);
      items.push({
        id: 'loss-bonus-net-loss',
        label: 'Net Kayıp Kontrolü',
        ok: netLoss > 0,
        reason: netLoss > 0 ? `UYGUN: Net kayıp ${netLoss.toFixed(2)} TRY` : 'RED: Oyuncunun doğrulanmış net kaybı yok.',
      });
    }
    if (spec.requestWithinHours != null) {
      const requestDeposit = spec.isNextDayBonus === true ? (account as any).previousDayLastDeposit : account.lastDeposit;
      const lastDepositTime = requestDeposit?.dateLocal ? parseDateToTime(requestDeposit.dateLocal) : 0;
      const elapsedHours = lastDepositTime > 0 ? (Date.now() - lastDepositTime) / 3_600_000 : Number.POSITIVE_INFINITY;
      const ok = elapsedHours >= 0 && elapsedHours <= spec.requestWithinHours;
      items.push({
        id: 'request-within-hours',
        label: `Son Yatırımdan Sonra Talep Süresi (${spec.requestWithinHours} saat)`,
        ok,
        reason: ok ? `UYGUN: ${elapsedHours.toFixed(1)} saat geçti` : lastDepositTime ? `RED: ${elapsedHours.toFixed(1)} saat geçti` : 'RED: Başarılı yatırım bulunamadı.',
      });
    }
    if (spec.balanceBelow != null) {
      const balance = Number(account.balance ?? 0);
      const ok = balance <= spec.balanceBelow;
      items.push({
        id: 'balance-below',
        label: `Bakiye Üst Sınırı (${spec.balanceBelow} TRY)`,
        ok,
        reason: ok ? 'UYGUN' : `RED: Mevcut bakiye ${balance} TRY`,
      });
    }
    if (spec.noOpenBets === true) {
      const openBetCount = Number((account as any).openBetCount ?? 0);
      items.push({
        id: 'no-open-bets',
        label: 'Açık Bahis Kontrolü',
        ok: openBetCount === 0,
        reason: openBetCount === 0 ? 'UYGUN: Açık bahis yok' : `RED: ${openBetCount} açık bahis var`,
      });
    }

    if (spec.activeDays && spec.activeDays.length > 0) {
      const daysMap: Record<string, number> = {
        sunday: 0, pazar: 0,
        monday: 1, pazartesi: 1,
        tuesday: 2, salı: 2, sali: 2,
        wednesday: 3, çarşamba: 3, carsamba: 3,
        thursday: 4, perşembe: 4, persembe: 4,
        friday: 5, cuma: 5,
        saturday: 6, cumartesi: 6,
      };
      const currentDayName = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Istanbul',
        weekday: 'long',
      }).format(new Date()).toLowerCase();
      const currentDay = daysMap[currentDayName];
      const activeIndices = spec.activeDays.map((day) => daysMap[String(day).trim().toLocaleLowerCase('tr-TR')]);
      const ok = activeIndices.includes(currentDay);
      items.push({
        id: 'active-days-check',
        label: `Gün Kısıtlaması (${spec.activeDays.join(', ')})`,
        ok,
        reason: ok ? 'UYGUN: Bugün bonus günü' : 'RED: Bu bonus bugün aktif değil',
      });
    }

    if (spec.startTime && spec.endTime) {
      const now = new Date();
      const [sh, sm] = spec.startTime.split(':').map(Number);
      const [eh, em] = spec.endTime.split(':').map(Number);
      const start = new Date(); start.setHours(sh, sm, 0);
      const end = new Date(); end.setHours(eh, em, 0);
      const ok = now >= start && now <= end;
      items.push({
        id: 'active-hours-check',
        label: `Saat Kısıtlaması (${spec.startTime} - ${spec.endTime})`,
        ok,
        reason: ok ? 'UYGUN: Bonus saatleri içerisinde' : `RED: Bonus şuan aktif değil (Saat: ${now.getHours()}:${now.getMinutes()})`,
      });
    }

    // Bonus Tutar Hesaplama
    const calc = calculateBonusAmount(account, spec);
    if (calc) {
      items.push(calc.item);
      if (calc.calculatedAmount != null) {
        result.calculatedAmount = calc.calculatedAmount;
      }
    }
  }

  // 6. Özel Şartlar
  if (promo.exclusions && promo.exclusions.length > 0) {
    items.push({
      id: 'exclusions-notice',
      label: `Yasaklı Bahisler: ${promo.exclusions.join(', ')}`,
      ok: true,
      reason: 'BİLGİ: Çekim öncesi bu kurallar manuel doğrulanmalıdır.',
    });
  }

  result.overallOk = items.every((i) => i.ok || i.id === 'exclusions-notice' || i.id === 'max-payout-check' || i.id === 'bonus-calculation');
  return result;
}
