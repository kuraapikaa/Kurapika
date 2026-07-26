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
        <div className="glass-card rounded-2xl border border-white/5 bg-slate-900/40 p-4 transition-all hover:border-white/10 hover:bg-slate-900/60">
            <div className="flex items-start justify-between">
                <div className={`rounded-xl p-2.5 ${colorClass}`}>
                    <Icon size={20} />
                </div>
                {subValue && (
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{subValue}</span>
                )}
            </div>
            <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
                <p className="mt-1 text-xl font-black text-white">{value}</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-slate-950/80" onClick={onClose} />

            <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900 shadow-2xl animate-in scale-in-95 duration-300">
                {/* Header - Fixed */}
                <div className="flex shrink-0 items-center justify-between p-6 pb-4 sm:p-8 sm:pb-6 border-b border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl shadow-blue-500/20">
                            <User size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-white">
                                {kpi?.Name || kpi?.Login || username || 'Oyuncu'}
                            </h2>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-left">Müşteri ID: #{clientId}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full bg-white/5 p-3 text-slate-400 hover:bg-white/10 hover:text-white transition-all ring-1 ring-white/10"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 pt-4 sm:p-8 sm:pt-6 space-y-8 text-left scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Profil verileri analiz ediliyor...</p>
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
                                <h3 className="mb-4 text-xs font-black uppercase italic tracking-widest text-blue-400">Mali Özet</h3>
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
                                    <h3 className="mb-4 text-xs font-black uppercase italic tracking-widest text-blue-400">Sportbook Performansı</h3>
                                    <div className="space-y-4">
                                        <div className="glass-card flex items-center justify-between rounded-2xl bg-slate-950/40 p-4 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400"><TrendingUp size={18} /></div>
                                                <span className="text-xs font-bold text-slate-300">Toplam Bahis</span>
                                            </div>
                                            <span className="text-sm font-black text-white">{formatNumber(kpi.TotalSportStakes)} <span className="text-[10px] text-slate-500">TRY</span></span>
                                        </div>
                                        <div className="glass-card flex items-center justify-between rounded-2xl bg-slate-950/40 p-4 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400"><Trophy size={18} /></div>
                                                <span className="text-xs font-bold text-slate-300">Toplam Kazanç</span>
                                            </div>
                                            <span className="text-sm font-black text-emerald-400">{formatNumber(kpi.TotalSportWinnings)} <span className="text-[10px] text-slate-500">TRY</span></span>
                                        </div>
                                        <div className="glass-card flex items-center justify-between rounded-2xl bg-slate-950/40 p-4 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-yellow-500/10 p-2 text-yellow-400"><Activity size={18} /></div>
                                                <span className="text-xs font-bold text-slate-300">Sport Verimlilik</span>
                                            </div>
                                            <span className={`text-sm font-black ${kpi.SportProfitness >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {formatNumber(kpi.SportProfitness)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-4 text-xs font-black uppercase italic tracking-widest text-blue-400">Casino Performansı</h3>
                                    <div className="space-y-4">
                                        <div className="glass-card flex items-center justify-between rounded-2xl bg-slate-950/40 p-4 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400"><Dices size={18} /></div>
                                                <span className="text-xs font-bold text-slate-300">Casino Ciro</span>
                                            </div>
                                            <span className="text-sm font-black text-white">{formatNumber(kpi.TotalCasinoStakes)} <span className="text-[10px] text-slate-500">TRY</span></span>
                                        </div>
                                        <div className="glass-card flex items-center justify-between rounded-2xl bg-slate-950/40 p-4 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400"><ArrowUpRight size={18} /></div>
                                                <span className="text-xs font-bold text-slate-300">Casino Kazanç</span>
                                            </div>
                                            <span className="text-sm font-black text-emerald-400">{formatNumber(kpi.TotalCasinoWinnings)} <span className="text-[10px] text-slate-500">TRY</span></span>
                                        </div>
                                        <div className="glass-card flex items-center justify-between rounded-2xl bg-slate-950/40 p-4 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400"><TrendingDown size={18} /></div>
                                                <span className="text-xs font-bold text-slate-300">Casino Verimlilik</span>
                                            </div>
                                            <span className={`text-sm font-black ${kpi.CasinoProfitness >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {formatNumber(kpi.CasinoProfitness)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Account Details */}
                            <div className="rounded-3xl border border-white/5 bg-slate-950/40 p-6">
                                <h4 className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Hesap ve Güvenlik Detayları</h4>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                                    <div className="flex items-center gap-4">
                                        <div className="rounded-xl bg-slate-800 p-3 text-slate-400"><ShieldCheck size={24} /></div>
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase">Doğrulama</p>
                                            <p className="text-sm font-bold text-white">{kpi.IsVerified ? 'Onaylı Hesap' : 'Onaysız'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="rounded-xl bg-slate-800 p-3 text-slate-400"><Calendar size={24} /></div>
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase">İlk Yatırım</p>
                                            <p className="text-sm font-bold text-white">{kpi.FirstDepositTimeLocal ? formatDateDisplay(kpi.FirstDepositTimeLocal) : '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="rounded-xl bg-slate-800 p-3 text-slate-400"><Activity size={24} /></div>
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase">Son İşlem</p>
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
