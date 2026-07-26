import { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { dashboardApi } from '../api/client';
import { formatNumber, formatDateDisplay } from '../lib/format';
import {
    Clock,
    AlertTriangle,
    ArrowRight,
    Loader2,
    UserX,
    ChevronLeft,
    ChevronRight,
    Crown,
    Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export function ChurnPrevention() {
    const [inactivityDays, setInactivityDays] = useState(3);
    const [page, setPage] = useState(1);
    const [showVipOnly, setShowVipOnly] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const rowsPerPage = showVipOnly ? 200 : 50; // VIP araması için havuzu genişletiyoruz

    // Calculate the threshold date (current time - inactivityDays)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - inactivityDays);

    // Format for API: "DD-MM-YY - HH:mm:ss"
    const formatDateForAPI = (date: Date) => {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = String(date.getFullYear()).slice(-2);
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${d}-${m}-${y} - ${h}:${min}:${s}`;
    };

    const maxLoginDate = formatDateForAPI(thresholdDate);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['churn-players', inactivityDays, page],
        queryFn: () => dashboardApi.clients({
            MaxLastTimeLoginDateLocal: maxLoginDate,
            SkeepRows: (page - 1) * rowsPerPage,
            MaxRows: rowsPerPage,
            IsOrderedDesc: true,
            OrderedItem: 1
        }),
        staleTime: 2 * 60 * 1000,
    });

    const players = data?.Data?.Objects ?? [];
    const totalCount = data?.Data?.Count ?? 0;
    const totalPages = Math.ceil(totalCount / rowsPerPage);

    // Parallel KPI fetching for visible players to find VIPs
    const kpiQueries = useQueries({
        queries: players.map((p: any) => ({
            queryKey: ['client-kpi', p.Id],
            queryFn: () => dashboardApi.clientKpi(p.Id),
            staleTime: 5 * 60 * 1000,
            enabled: players.length > 0,
        }))
    });

    const kpiMap = kpiQueries.reduce((acc: Record<number, any>, q, i) => {
        if (q.data?.Data && players[i]) {
            acc[players[i].Id] = q.data.Data;
        }
        return acc;
    }, {});

    const processedPlayers = players.filter((p: any) => {
        const kpi = kpiMap[p.Id];
        const totalDep = kpi?.TotalDeposit || p.TotalDeposit || 0;
        const isVip = totalDep > 5000 || (kpi?.ProfitAndLose || 0) > 5000;

        const matchesSearch = p.Login?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesVip = showVipOnly ? isVip : true;

        return matchesSearch && matchesVip;
    });

    return (
        <div className="animate-in space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between bg-slate-900/40 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-rose-500/20 p-3 text-rose-400 shadow-xl shadow-rose-500/10">
                        <UserX size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Kayıp Hatırlatıcı (Churn)</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">İnaktif Oyuncu Takip Paneli</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* VIP Toggle */}
                    <button
                        onClick={() => {
                            setShowVipOnly(!showVipOnly);
                            setPage(1);
                        }}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-black transition-all border",
                            showVipOnly
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400 shadow-lg shadow-amber-500/20"
                                : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                        )}
                    >
                        <Crown size={16} /> VIP ADAYLARI
                    </button>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Kullanıcı adı ara..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                            className="h-11 w-64 rounded-2xl border border-white/10 bg-slate-950/60 pl-11 pr-4 text-sm font-medium text-white transition-all focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 p-1.5">
                        <span className="pl-3 text-[10px] font-black text-slate-500 uppercase">Süre:</span>
                        <div className="flex gap-1">
                            {[3, 7, 15, 30].map((days) => (
                                <button
                                    key={days}
                                    onClick={() => {
                                        setInactivityDays(days);
                                        setPage(1);
                                    }}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
                                        inactivityDays === days
                                            ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
                                            : "text-slate-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {days}G+
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-blue-300">Stratejik Bilgi</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        En son <strong>{inactivityDays} gün önce</strong> giriş yapmış oyuncular listelenmektedir.
                        Geri kazanım için VIP adaylarını ve yüksek bakiyeli oyuncuları önceliklendirin.
                        <span className="block mt-1 opacity-70 italic font-medium">Not: VIP filtresi mevcut sayfadaki {rowsPerPage} oyuncu arasından tarama yapar.</span>
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-[2.5rem] border border-white/5 bg-slate-900/40 backdrop-blur-md overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <Clock size={18} className="text-rose-400" />
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">İnaktif Oyuncu Listesi</h3>
                    </div>
                    {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        GÖSTERİLEN: {processedPlayers.length} / TOPLAM {totalCount}
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-white/5 opacity-70">
                                <th className="px-8 py-5">Oyuncu / ID</th>
                                <th className="px-8 py-5">Son Giriş</th>
                                <th className="px-8 py-5">Kayıt Tarihi</th>
                                <th className="px-8 py-5 text-right">Bakiye</th>
                                <th className="px-8 py-5 text-right">Toplam Yatırım</th>
                                <th className="px-8 py-5 text-center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-rose-500 opacity-50" />
                                        <p className="mt-2 text-xs font-bold text-slate-500 uppercase tracking-widest">Taranıyor...</p>
                                    </td>
                                </tr>
                            ) : processedPlayers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 rounded-full bg-slate-800 text-slate-500">
                                                <UserX size={32} />
                                            </div>
                                            <p className="text-slate-500 italic text-sm">
                                                {showVipOnly
                                                    ? `Taranan bu sayfadaki ${rowsPerPage} oyuncu arasında kriterlere uygun VIP adayı bulunamadı. Lütfen sonraki sayfalara göz atın (Toplam inaktif havuzu: ${totalCount}).`
                                                    : "Seçili kriterde inaktif oyuncu bulunamadı."}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                processedPlayers.map((player: any) => {
                                    const kpi = kpiMap[player.Id];
                                    const totalDep = kpi?.TotalDeposit || player.TotalDeposit || 0;
                                    const isVipCandidate = totalDep > 5000 || (kpi?.ProfitAndLose || 0) > 5000;
                                    const isHighBalance = (player.Balance || 0) > 1000;

                                    return (
                                        <tr key={player.Id} className={cn(
                                            "group transition-colors relative",
                                            isVipCandidate ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]" : "hover:bg-white/[0.02]"
                                        )}>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-white">
                                                            {player.Login}
                                                        </span>
                                                        {isVipCandidate && (
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-500 border border-amber-500/30">
                                                                <Crown size={10} /> VIP ADAYI
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                                        ID: #{player.Id} · {player.FirstName || ''} {player.LastName || ''}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className={cn(
                                                        "text-xs font-bold",
                                                        isVipCandidate ? "text-amber-400" : "text-rose-400"
                                                    )}>
                                                        {formatDateDisplay(player.LastLoginLocalDate)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 uppercase">
                                                        {calculateInactivity(player.LastLoginLocalDate)} GÜNDÜR YOK
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="text-xs font-medium text-slate-400">
                                                    {formatDateDisplay(player.CreatedLocalDate)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={cn(
                                                        "text-sm font-black tabular-nums",
                                                        isHighBalance ? "text-emerald-400" : (player.Balance || 0) > 10 ? "text-white" : "text-slate-600"
                                                    )}>
                                                        {formatNumber(player.Balance || 0)} {player.CurrencyId}
                                                    </span>
                                                    {isHighBalance && (
                                                        <span className="text-[9px] font-bold text-emerald-500/70 uppercase">Yüksek Bakiye</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={cn(
                                                        "text-sm font-black tabular-nums",
                                                        isVipCandidate ? "text-amber-500" : "text-slate-300"
                                                    )}>
                                                        {formatNumber(totalDep)}
                                                    </span>
                                                    {kpi && (
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase">P/L: {formatNumber(kpi.ProfitAndLose)}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <Link
                                                    to={`/oyuncu/${player.Id}/${player.Login}`}
                                                    className={cn(
                                                        "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black transition-all uppercase tracking-widest",
                                                        isVipCandidate
                                                            ? "bg-amber-600 text-white border-amber-500 hover:bg-amber-500"
                                                            : "bg-white/5 border-white/10 text-slate-300 hover:bg-rose-500 hover:text-white hover:border-rose-500"
                                                    )}
                                                >
                                                    İncele <ArrowRight size={12} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-8 py-6 border-t border-white/5 bg-slate-900/20">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Sayfa {page} / {totalPages} · Toplam {totalCount} Kayıt
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-20 transition-all border border-white/5"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-20 transition-all border border-white/5"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function calculateInactivity(lastLogin: string | null): number {
    if (!lastLogin) return 999;
    const last = new Date(lastLogin);
    const now = new Date();
    const diff = now.getTime() - last.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}
