import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type DateRange } from '../api/client';
import { formatNumber, formatDateTimeDisplay } from '../lib/format';
import { DateRangeBar } from './DateRangeBar';
import { Loader2, AlertCircle, ChevronDown, ChevronRight, Activity, Calendar } from 'lucide-react';
import type { GetBetSelectionsResponse } from '../types/dashboard';

interface PlayerSportsBetsProps {
    clientId: number;
}

function todayYMD(offsetDays = 0): string {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function PlayerSportsBets({ clientId }: PlayerSportsBetsProps) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [expandedBetId, setExpandedBetId] = useState<number | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>({ startDate: todayYMD(30), endDate: todayYMD() });

    const betsQuery = useQuery({
        queryKey: ['player-sports-bets', clientId, page, rowsPerPage, dateRange],
        queryFn: () => dashboardApi.clientBetHistory(clientId, {
            SkeepRows: page * rowsPerPage,
            MaxRows: rowsPerPage,
            StartDateLocal: dateRange.startDate,
            EndDateLocal: dateRange.endDate,
        }),
        staleTime: 60 * 1000,
        retry: 1
    });

    const handleRangeChange = (range: DateRange) => {
        setDateRange(range);
        setPage(0);
        setExpandedBetId(null);
    };

    const betSelectionsQuery = useQuery({
        queryKey: ['player-sports-bet-selections', expandedBetId],
        queryFn: () => expandedBetId ? dashboardApi.clientBetSelectionsHistory(expandedBetId, clientId) : Promise.resolve({ HasError: false, Data: [] } as GetBetSelectionsResponse),
        enabled: expandedBetId !== null,
        staleTime: 60 * 1000
    });

    const handleRowClick = (betId: number) => {
        setExpandedBetId(prev => prev === betId ? null : betId);
    };

    const isError = betsQuery.isError || betsQuery.data?.HasError;
    const errorMessage = betsQuery.error instanceof Error ? betsQuery.error.message : betsQuery.data?.AlertMessage;
    const bets = betsQuery.data?.Data?.BetData?.Objects ?? [];
    const totalCount = betsQuery.data?.Data?.BetData?.Count ?? 0;

    if (betsQuery.isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 flex items-start gap-4">
                <AlertCircle className="text-rose-400 mt-1 shrink-0" />
                <div>
                    <h3 className="text-rose-400 font-bold mb-1">Geçmiş Alınamadı</h3>
                    <p className="text-sm text-rose-300/80">{errorMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <Activity size={18} className="text-blue-400" /> Spor Bahisleri ({totalCount})
                </h3>
                <DateRangeBar
                    range={dateRange}
                    onRangeChange={handleRangeChange}
                    onRefresh={() => betsQuery.refetch()}
                    isLoading={betsQuery.isFetching}
                />
            </div>

            {bets.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-slate-900/40 p-8 text-center text-slate-500">
                    Oynanmış spor bahsi bulunmuyor.
                </div>
            ) : (
                <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900 border-b border-white/10">
                            <tr>
                                <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Kupon Id</th>
                                <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tarih</th>
                                <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500 text-right">Tutar</th>
                                <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Oran</th>
                                <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Durum</th>
                                <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500 text-right">Kazanç</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {bets.map(bet => {
                                const isExpanded = expandedBetId === bet.Id;
                                const isWon = bet.StateName === 'Kazandı' || bet.StateName === 'Win';
                                const isLost = bet.StateName === 'Kaybetti' || bet.StateName === 'Lost';
                                const isReturned = bet.StateName === 'İade' || bet.StateName === 'Returned';

                                return (
                                    <React.Fragment key={bet.Id}>
                                        <tr
                                            className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                            onClick={() => bet.Id && handleRowClick(bet.Id)}
                                        >
                                            <td className="p-4 font-mono text-xs text-slate-400 font-bold flex items-center gap-2">
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} className="opacity-50 group-hover:opacity-100 transition-opacity" />}
                                                {bet.Id}
                                                {bet.IsLive && <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-400 uppercase tracking-widest ml-2">Live</span>}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 text-slate-300">
                                                    <Calendar size={12} className="text-slate-500" />
                                                    {bet.CreatedLocal ? formatDateTimeDisplay(bet.CreatedLocal) : '—'}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="font-mono font-medium text-slate-300 bg-slate-800 px-2 py-1 rounded">
                                                    {formatNumber(bet.Amount)} {bet.CurrencyId ?? 'TRY'}
                                                </span>
                                            </td>
                                            <td className="p-4 font-bold text-blue-300">
                                                {Number(bet.Price ?? 0).toFixed(2)}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md ${isWon ? 'bg-emerald-500/20 text-emerald-400' :
                                                    isLost ? 'bg-rose-500/20 text-rose-400' :
                                                        isReturned ? 'bg-amber-500/20 text-amber-400' :
                                                            'bg-slate-500/20 text-slate-400'
                                                    }`}>
                                                    {bet.StateName ?? 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className={`font-mono font-bold ${isWon ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                    {isWon ? `+${formatNumber(bet.WinningAmount)}` : '0.00'}
                                                </span>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-900/40">
                                                <td colSpan={6} className="p-4">
                                                    {betSelectionsQuery.isLoading && expandedBetId === bet.Id ? (
                                                        <div className="flex justify-center p-4"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
                                                    ) : expandedBetId === bet.Id && (!betSelectionsQuery.data?.Data || betSelectionsQuery.data.Data.length === 0) ? (
                                                        <p className="text-slate-500 text-sm text-center italic py-2">Seçim detayı bulunamadı.</p>
                                                    ) : (
                                                        <div className="space-y-2 max-w-4xl mx-auto py-2">
                                                            {betSelectionsQuery.data?.Data?.map((sel: any) => (
                                                                <div key={sel.SelectionId} className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-950 rounded-lg p-3 border border-white/5">
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-400">{sel.SportName} <span className="opacity-50 mx-1">/</span> {sel.CompetitionName}</p>
                                                                        <p className="text-sm font-bold text-slate-200 mt-1">{sel.MatchName}</p>
                                                                        <p className="text-xs text-slate-500 mt-1">{formatDateTimeDisplay(sel.StartTimeLocal)} | <span className="text-amber-500/80">{sel.MatchInfo}</span></p>
                                                                    </div>
                                                                    <div className="text-left sm:text-right shrink-0">
                                                                        <p className="text-xs text-slate-500 uppercase font-semibold">{sel.DisplayMarketName}</p>
                                                                        <div className="text-sm font-bold mt-1">
                                                                            <span className="text-blue-300">{sel.DisplaySelectionName}</span>
                                                                            <span className="text-slate-600 mx-2">•</span>
                                                                            <span className="text-emerald-400">@ {Number(sel.Price).toFixed(2)}</span>
                                                                        </div>
                                                                        <p className="text-xs uppercase font-bold tracking-widest mt-1">
                                                                            {sel.StateName === 'Kazandı' || sel.StateName === 'Win' ? <span className="text-emerald-400">{sel.StateName}</span> :
                                                                                sel.StateName === 'Kaybetti' || sel.StateName === 'Lost' ? <span className="text-rose-400">{sel.StateName}</span> :
                                                                                    <span className="text-slate-400">{sel.StateName}</span>}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalCount > 0 && (
                <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                        <select className="bg-slate-900 border border-white/10 text-slate-300 text-sm rounded-lg px-2 py-1" value={rowsPerPage} onChange={(e) => {
                            setRowsPerPage(Number(e.target.value));
                            setPage(0);
                        }}>
                            {[10, 20, 50, 100].map(val => (
                                <option key={val} value={val}>{val} satır</option>
                            ))}
                        </select>
                        <span className="text-slate-500 text-xs">/ Sayfa</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="text-slate-400 disabled:opacity-30" disabled={page === 0} onClick={() => setPage(page - 1)}>Önceki</button>
                        <span className="text-slate-200 text-sm font-mono">{page + 1} / {Math.ceil(totalCount / rowsPerPage)}</span>
                        <button className="text-slate-400 disabled:opacity-30" disabled={(page + 1) * rowsPerPage >= totalCount} onClick={() => setPage(page + 1)}>Sonraki</button>
                    </div>
                </div>
            )}
        </div>
    );
}
