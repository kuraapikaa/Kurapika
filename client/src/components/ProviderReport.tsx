import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/client';
import { useDateRange } from '../context/DateRangeContext';
import { formatNumber } from '../lib/format';
import { BarChart3, TrendingUp, TrendingDown, Target, Zap, Loader2, AlertCircle, Info, Calculator } from 'lucide-react';

export function ProviderReport() {
    const { dateRange } = useDateRange();
    const [royaltyRate, setRoyaltyRate] = useState(15); // Varsayılan %15

    const { data: providerData, isLoading: isProviderLoading, error: providerError, refetch } = useQuery({
        queryKey: ['provider-report', dateRange.startDate, dateRange.endDate],
        queryFn: () => dashboardApi.providerReport(dateRange),
    });

    const { data: partnerDataResponse, isLoading: isPartnerLoading } = useQuery({
        queryKey: ['partner-profit', dateRange.startDate, dateRange.endDate],
        queryFn: () => dashboardApi.partnerProfit(dateRange),
    });

    const { data: bonusDataResponse, isLoading: isBonusLoading } = useQuery({
        queryKey: ['client-bonus-report', dateRange.startDate, dateRange.endDate],
        queryFn: () => dashboardApi.bonusReport(dateRange),
    });

    const isLoading = isProviderLoading || isPartnerLoading || isBonusLoading;
    const error = providerError;
    const data = providerData;
    const partnerData = partnerDataResponse?.Data;

    const bonusList = bonusDataResponse?.Data?.ClientBonusReportData?.Objects ?? [];

    const reportData = data?.Result;
    const casinoProviders = reportData?.ReportByTResultViewModel ?? [];

    const sportTurnover = partnerData?.SportTurnover ?? 0;
    const sportWinning = partnerData?.SportWinning ?? 0;
    const sportProfit = sportTurnover - sportWinning;

    const totalBonusGiven = bonusList.reduce((acc: number, item: any) => acc + (item.Amount || 0), 0);
    const totalBonusWin = bonusList.reduce((acc: number, item: any) => acc + (item.TotalPaidAmount > 0 ? item.TotalPaidAmount : (item.WinAmount || 0)), 0);
    const bonusProfit = totalBonusGiven - totalBonusWin;

    // Extend providers list with Sportsbook and Bonus
    const providers = [
        ...casinoProviders,
        ...(sportTurnover > 0 || sportWinning > 0 ? [{
            ProviderName: "Betconstruct Sportsbook",
            ProviderPrefix: "S-BOOK",
            BetAmount: sportTurnover,
            WinAmount: sportWinning,
            Profit: sportProfit,
            BetAmountByReportCurrency: sportTurnover,
            WinAmountByReportCurrency: sportWinning,
            ProfitByReportCurrency: sportProfit,
        }] : []),
        ...(totalBonusGiven > 0 || totalBonusWin > 0 ? [{
            ProviderName: "Verilen Toplam Bonus",
            ProviderPrefix: "BONUS",
            BetAmount: totalBonusGiven,
            WinAmount: totalBonusWin,
            Profit: bonusProfit,
            BetAmountByReportCurrency: totalBonusGiven,
            WinAmountByReportCurrency: totalBonusWin,
            ProfitByReportCurrency: bonusProfit,
        }] : [])
    ];

    const totalTurnover = (reportData?.TotalBetAmountByReportCurrency ?? 0) + sportTurnover + totalBonusGiven;
    const totalWin = (reportData?.TotalWinAmountByReportCurrency ?? 0) + sportWinning + totalBonusWin;
    const totalProfit = totalTurnover - totalWin; // (reportData?.TotalProfitByReportCurrency ?? 0) + sportProfit + bonusProfit

    const estimatedInvoice = totalProfit > 0 ? (totalProfit * royaltyRate) / 100 : 0;

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                    <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Rapor Hazırlanıyor...</p>
                </div>
            </div>
        );
    }

    if (error || data?.HasError) {
        return (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-12 text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-rose-500/50" />
                <h3 className="text-lg font-bold text-rose-400">Rapor Yüklenemedi</h3>
                <p className="text-sm text-slate-500 mt-2">{data?.ErrorDescription || (error as Error)?.message}</p>
                <button
                    onClick={() => refetch()}
                    className="mt-6 rounded-xl bg-rose-500/20 px-6 py-2 text-sm font-bold text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/30"
                >
                    Tekrar Dene
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                    label="Toplam Ciro (GGR)"
                    value={totalTurnover}
                    icon={<BarChart3 className="text-blue-400" />}
                    trend="neutral"
                />
                <StatCard
                    label="Oyuncu Kazancı & Bonus"
                    value={totalWin}
                    icon={<Zap className="text-amber-400" />}
                    trend="neutral"
                />
                <StatCard
                    label="Net Kar (NGR)"
                    value={totalProfit}
                    icon={<Target className="text-emerald-400" />}
                    trend={totalProfit >= 0 ? 'up' : 'down'}
                />

                {/* Faturalandırma Kartı */}
                <div className="rounded-xl border border-blue-500/30 bg-blue-950/40 p-5 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                        <Calculator size={24} className="text-blue-400" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 mb-1">Tahmini Fatura</p>
                    <p className="text-xl font-semibold text-white tabular-nums">
                        {formatNumber(estimatedInvoice)} <span className="text-xs font-normal text-slate-500">TRY</span>
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Royalty:</span>
                        <select
                            className="bg-slate-800 text-[10px] font-semibold text-blue-300 border border-white/5 rounded px-1 py-0.5 focus:ring-0 cursor-pointer"
                            value={royaltyRate}
                            onChange={(e) => setRoyaltyRate(Number(e.target.value))}
                        >
                            <option value="10">%10</option>
                            <option value="12">%12</option>
                            <option value="15">%15</option>
                            <option value="18">%18</option>
                            <option value="20">%20</option>
                        </select>
                    </div>
                </div>

                <StatCard
                    label="Toplam Spin"
                    value={reportData?.TotalRound ?? 0}
                    icon={<Info className="text-blue-400" />}
                    trend="neutral"
                />
            </div>

            {/* Table Section */}
            <div className="rounded-xl border border-white/5 bg-slate-900/40 shadow-xl overflow-hidden">
                <div className="border-b border-white/5 bg-white/5 px-3 py-2.5 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <BarChart3 size={18} className="text-blue-400" />
                        Sağlayıcı Performansı (%{royaltyRate} Tahmini Maliyet)
                    </h3>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {providers.length} Sağlayıcı Listelendi
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                                <th className="px-3 py-2.5">Sağlayıcı</th>
                                <th className="px-3 py-2.5 text-right">Ciro (Bet)</th>
                                <th className="px-3 py-2.5 text-right">Ödenen (Win)</th>
                                <th className="px-3 py-2.5 text-right">Karlılık (NGR)</th>
                                <th className="px-3 py-2.5 text-right">Royalty (%{royaltyRate})</th>
                                <th className="px-3 py-2.5 text-right">RTP (%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {providers.map((item, idx) => {
                                const rtp = item.BetAmount > 0 ? (item.WinAmount / item.BetAmount) * 100 : 0;
                                const isProfit = item.Profit >= 0;
                                const providerRoyalty = (item.ProfitByReportCurrency * royaltyRate) / 100;

                                return (
                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors">
                                                    {item.ProviderName}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono">{item.ProviderPrefix}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-300">
                                            {formatNumber(item.BetAmountByReportCurrency)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-400">
                                            {formatNumber(item.WinAmountByReportCurrency)}
                                        </td>
                                        <td className={`px-3 py-2.5 text-right font-mono font-semibold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {formatNumber(item.ProfitByReportCurrency)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-500">
                                            {isProfit ? formatNumber(providerRoyalty) : '0.00'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={`font-bold ${rtp > 97 ? 'text-amber-400' : 'text-slate-400'}`}>
                                                    %{rtp.toFixed(2)}
                                                </span>
                                                <div className="h-1 w-16 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${rtp > 97 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${Math.min(rtp, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, trend }: { label: string; value: number; icon: React.ReactNode; trend: 'up' | 'down' | 'neutral' }) {
    return (
        <div className="rounded-xl border border-white/5 bg-slate-900/50 p-5 shadow-lg group hover:border-white/10 transition-all">
            <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-white/5 group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                {trend !== 'neutral' && (
                    <div className={`p-1 rounded-lg ${trend === 'up' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                        {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </div>
                )}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
            <p className="text-xl font-semibold text-white tabular-nums">
                {formatNumber(value)} <span className="text-xs font-normal text-slate-500">TRY</span>
            </p>
        </div>
    );
}
