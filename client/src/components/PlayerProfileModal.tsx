import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/client';
import { formatNumber, formatDateDisplay } from '../lib/format';
import {
    X,
    User,
    TrendingUp,
    TrendingDown,
    Wallet,
    Dices,
    Trophy,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    ShieldCheck,
    Calendar,
    DollarSign
} from 'lucide-react';

interface PlayerProfileModalProps {
    clientId: number;
    username: string;
    onClose: () => void;
}

export function PlayerProfileModal({ clientId, username, onClose }: PlayerProfileModalProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['client-kpi', clientId],
        queryFn: () => dashboardApi.clientKpi(clientId),
        staleTime: 60 * 1000,
    });

    const kpi = data?.Data;

    const StatBox = ({ title, value, icon: Icon, colorClass, subValue }: any) => (
        <div className="glass-card rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 transition-all hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">
            <div className="flex items-start justify-between">
                <div className={`rounded-xl p-2.5 ${colorClass}`}>
                    <Icon size={20} />
                </div>
                {subValue && (
                    <span className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase">{subValue}</span>
                )}
            </div>
            <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">{title}</p>
                <p className="mt-1 text-xl font-semibold text-white">{value}</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]" onClick={onClose} />

            <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] shadow-2xl animate-in scale-in-95 duration-300">
                {/* Header - Fixed */}
                <div className="flex shrink-0 items-center justify-between p-6 pb-4 sm:p-8 sm:pb-6 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl shadow-blue-500/20">
                            <User size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight text-white">
                                {kpi?.Name || kpi?.Login || username || 'Oyuncu'}
                            </h2>
                            <p className="text-xs font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest text-left">Müşteri ID: #{clientId}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full bg-white/5 p-3 text-[color:var(--panel-muted,#8a919c)] hover:bg-white/10 hover:text-white transition-all ring-1 ring-white/10"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 pt-4 sm:p-8 sm:pt-6 space-y-8 text-left scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                            <p className="text-sm font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest animate-pulse">Profil verileri analiz ediliyor...</p>
                        </div>
                    ) : error || !kpi ? (
                        <div className="py-20 text-center text-rose-400">
                            <p className="font-bold">Bir hata oluştu</p>
                            <p className="text-sm opacity-70">Profil verileri şu an alınamıyor.</p>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            {/* Financial Summary */}
                            <div>
                                <h3 className="mb-4 text-xs font-semibold uppercase italic tracking-widest text-blue-400">Mali Özet</h3>
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                    <StatBox
                                        title="Net Kar/Zarar"
                                        value={`${formatNumber(kpi.ProfitAndLose)} TRY`}
                                        icon={DollarSign}
                                        colorClass={kpi.ProfitAndLose >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}
                                    />
                                    <StatBox
                                        title="Bakiye"
                                        value={`${formatNumber(kpi.DepositAmount - kpi.WithdrawalAmount)} TRY`}
                                        icon={Wallet}
                                        colorClass="bg-blue-500/10 text-blue-400"
                                    />
                                    <StatBox
                                        title="Toplam Yatırım"
                                        value={`${formatNumber(kpi.DepositAmount)} TRY`}
                                        subValue={`${kpi.DepositCount} İşlem`}
                                        icon={ArrowUpRight}
                                        colorClass="bg-emerald-500/10 text-emerald-400"
                                    />
                                    <StatBox
                                        title="Toplam Çekim"
                                        value={`${formatNumber(kpi.WithdrawalAmount)} TRY`}
                                        subValue={`${kpi.WithdrawalCount} İşlem`}
                                        icon={ArrowDownRight}
                                        colorClass="bg-rose-500/10 text-rose-400"
                                    />
                                </div>
                            </div>

                            {/* Game Stats */}
                            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                                <div>
                                    <h3 className="mb-4 text-xs font-semibold uppercase italic tracking-widest text-blue-400">Sportbook Performansı</h3>
                                    <div className="space-y-4">
                                        <div className="glass-card flex items-center justify-between rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400"><TrendingUp size={18} /></div>
                                                <span className="text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">Toplam Bahis</span>
                                            </div>
                                            <span className="text-sm font-semibold text-white">{formatNumber(kpi.TotalSportStakes)} <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">TRY</span></span>
                                        </div>
                                        <div className="glass-card flex items-center justify-between rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400"><Trophy size={18} /></div>
                                                <span className="text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">Toplam Kazanç</span>
                                            </div>
                                            <span className="text-sm font-semibold text-emerald-400">{formatNumber(kpi.TotalSportWinnings)} <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">TRY</span></span>
                                        </div>
                                        <div className="glass-card flex items-center justify-between rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-yellow-500/10 p-2 text-yellow-400"><Activity size={18} /></div>
                                                <span className="text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">Sport Verimlilik</span>
                                            </div>
                                            <span className={`text-sm font-semibold ${kpi.SportProfitness >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {formatNumber(kpi.SportProfitness)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-4 text-xs font-semibold uppercase italic tracking-widest text-blue-400">Casino Performansı</h3>
                                    <div className="space-y-4">
                                        <div className="glass-card flex items-center justify-between rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400"><Dices size={18} /></div>
                                                <span className="text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">Casino Ciro</span>
                                            </div>
                                            <span className="text-sm font-semibold text-white">{formatNumber(kpi.TotalCasinoStakes)} <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">TRY</span></span>
                                        </div>
                                        <div className="glass-card flex items-center justify-between rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400"><ArrowUpRight size={18} /></div>
                                                <span className="text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">Casino Kazanç</span>
                                            </div>
                                            <span className="text-sm font-semibold text-emerald-400">{formatNumber(kpi.TotalCasinoWinnings)} <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">TRY</span></span>
                                        </div>
                                        <div className="glass-card flex items-center justify-between rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400"><TrendingDown size={18} /></div>
                                                <span className="text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">Casino Verimlilik</span>
                                            </div>
                                            <span className={`text-sm font-semibold ${kpi.CasinoProfitness >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {formatNumber(kpi.CasinoProfitness)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Account Details */}
                            <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-6">
                                <h4 className="mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--panel-muted,#8a919c)]">Hesap ve Güvenlik Detayları</h4>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                                    <div className="flex items-center gap-4">
                                        <div className="rounded-xl bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] p-3 text-[color:var(--panel-muted,#8a919c)]"><ShieldCheck size={24} /></div>
                                        <div>
                                            <p className="text-[9px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase">Doğrulama</p>
                                            <p className="text-sm font-bold text-white">{kpi.IsVerified ? 'Onaylı Hesap' : 'Onaysız'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="rounded-xl bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] p-3 text-[color:var(--panel-muted,#8a919c)]"><Calendar size={24} /></div>
                                        <div>
                                            <p className="text-[9px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase">İlk Yatırım</p>
                                            <p className="text-sm font-bold text-white">{kpi.FirstDepositTimeLocal ? formatDateDisplay(kpi.FirstDepositTimeLocal) : '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="rounded-xl bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] p-3 text-[color:var(--panel-muted,#8a919c)]"><Activity size={24} /></div>
                                        <div>
                                            <p className="text-[9px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase">Son İşlem</p>
                                            <p className="text-sm font-bold text-white">{kpi.LastSportBetTimeLocal ? formatDateDisplay(kpi.LastSportBetTimeLocal) : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
