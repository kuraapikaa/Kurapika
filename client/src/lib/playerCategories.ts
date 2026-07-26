import type { RuleSetResult } from '../api/admin';

export type PlayerCategory = {
  id: string;
  label: string;
  colorBg: string;
  colorText: string;
};

interface CategoryInput {
  account: Record<string, unknown>;
  riskScore: number;
  riskAnalysis?: RuleSetResult;
}

/**
 * Oyuncuyu oyun tarzı, risk skoru ve işlem hacmine göre dinamik etiketler.
 * VIP, Agresif, Pasif, Arbitraj Şüphelisi, Düşük Risk vb.
 */
export function getPlayerCategory(input: CategoryInput): PlayerCategory {
  const { account, riskScore, riskAnalysis } = input;
  const totalDeposits = Number(account.totalDeposits ?? 0) || 0;
  const byType = (account.profileTransactionsByType as Record<string, { count: number; totalAmount: number }>) ?? {};
  const depositSum = (byType['Para Yatırma']?.totalAmount ?? 0) + (byType['Deposit']?.totalAmount ?? 0);
  const withdrawalSum =
    (byType['Çekim Talebi Ödemesi']?.totalAmount ?? 0) + (byType['Çekim talebi Ödemesi']?.totalAmount ?? 0);
  const netDeposit = totalDeposits || depositSum;
  const volume = netDeposit + withdrawalSum;
  const totalSportStakes = Number(account.TotalSportStakes ?? 0) || 0;
  const totalCasinoStakes = Number(account.TotalCasinoStakes ?? 0) || 0;
  const hasRiskFlags = (riskAnalysis?.items?.some((i) => !i.ok) ?? false) || riskScore >= 60;
  const withdrawRatio = netDeposit > 0 ? withdrawalSum / netDeposit : 0;

  // Yüksek hacim: VIP adayı
  if (volume >= 50000 || totalSportStakes + totalCasinoStakes >= 100000) {
    if (hasRiskFlags) {
      return { id: 'vip-high-risk', label: 'VIP (Yüksek Risk)', colorBg: 'rgba(251,191,36,0.2)', colorText: '#fbbf24' };
    }
    return { id: 'vip', label: 'VIP', colorBg: 'rgba(34,197,94,0.2)', colorText: '#22c55e' };
  }

  // Arbitraj şüphelisi: yüksek çekim/yatırım oranı + risk bayrakları
  if (withdrawRatio >= 0.9 && hasRiskFlags) {
    return { id: 'arbitrage-suspect', label: 'Arbitraj Şüphelisi', colorBg: 'rgba(239,68,68,0.2)', colorText: '#ef4444' };
  }

  // Risk skoru yüksek
  if (riskScore >= 70) {
    return { id: 'high-risk', label: 'Yüksek Risk', colorBg: 'rgba(239,68,68,0.2)', colorText: '#f59e0b' };
  }

  // Agresif: yüksek bahis hacmi, orta risk
  if (totalSportStakes + totalCasinoStakes >= 20000 && volume >= 5000) {
    return { id: 'aggressive', label: 'Agresif Oyuncu', colorBg: 'rgba(168,85,247,0.2)', colorText: '#a855f7' };
  }

  // Düşük risk
  if (riskScore <= 25 && !hasRiskFlags) {
    return { id: 'low-risk', label: 'Düşük Risk', colorBg: 'rgba(34,197,94,0.2)', colorText: '#22c55e' };
  }

  // Düşük hacim
  if (volume < 1000) {
    return { id: 'passive', label: 'Pasif', colorBg: 'rgba(148,163,184,0.2)', colorText: '#94a3b8' };
  }

  // Varsayılan
  return { id: 'standard', label: 'Standart', colorBg: 'rgba(100,116,139,0.2)', colorText: '#94a3b8' };
}

/** Liste görünümü için: sadece row + KPI ile kategori (risk analizi yok). */
export function getPlayerCategoryFromListRow(
  row: { TotalDeposit?: unknown; TotalWithdraw?: unknown; Id?: number },
  kpi: Record<string, unknown> | null | undefined
): PlayerCategory {
  const dep = Number(row.TotalDeposit ?? kpi?.DepositAmount ?? kpi?.TotalDeposit ?? 0) || 0;
  const withAmt = Number(row.TotalWithdraw ?? kpi?.WithdrawalAmount ?? kpi?.TotalWithdraw ?? 0) || 0;
  const totalSportStakes = Number(kpi?.TotalSportStakes ?? 0) || 0;
  const totalCasinoStakes = Number(kpi?.TotalCasinoStakes ?? 0) || 0;
  const account: Record<string, unknown> = {
    totalDeposits: dep,
    profileTransactionsByType: {
      'Para Yatırma': { count: 0, totalAmount: dep },
      'Çekim Talebi Ödemesi': { count: 0, totalAmount: withAmt },
    },
    TotalSportStakes: totalSportStakes,
    TotalCasinoStakes: totalCasinoStakes,
  };
  return getPlayerCategory({ account, riskScore: 0, riskAnalysis: undefined });
}
