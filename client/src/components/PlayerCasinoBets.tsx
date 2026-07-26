import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type DateRange } from '../api/client';
import { formatNumber, formatDateTimeDisplay } from '../lib/format';
import { DateRangeBar } from './DateRangeBar';
import { Loader2, AlertCircle, Dices, Calendar } from 'lucide-react';

interface PlayerCasinoBetsProps {
    clientId: number;
}

function todayYMD(offsetDays = 0): string {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().slice(0, 10);
}

function TypeBadge({ value }: { value: unknown }) {
    const label = String(value || '—');
    const lower = label.toLocaleLowerCase('tr-TR');
    const tone = lower.includes('kazanç')
        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
        : lower.includes('bahis')
            ? 'border-blue-400/20 bg-blue-400/10 text-blue-300'
            : 'border-slate-600/40 bg-slate-700/20 text-slate-300';
    return (
        <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold ${tone}`}>
            {label}
        </span>
    );
}

function StateBadge({ value }: { value: unknown }) {
    const label = String(value || '—');
    const lower = label.toLocaleLowerCase('tr-TR');
    const tone = /işlendi|processed|success|başarılı/.test(lower)
        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
        : /red|hata|fail|iptal/.test(lower)
            ? 'border-rose-400/20 bg-rose-400/10 text-rose-300'
            : 'border-slate-600/40 bg-slate-700/20 text-slate-300';
    return (
        <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold ${tone}`}>
            {label}
        </span>
    );
}

export function PlayerCasinoBets({ clientId }: PlayerCasinoBetsProps) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [dateRange, setDateRange] = useState<DateRange>({ startDate: todayYMD(30), endDate: todayYMD() });

    const betsQuery = useQuery({
        queryKey: ['player-casino-bets', clientId, page, rowsPerPage, dateRange],
        queryFn: () => dashboardApi.clientCasinoHistory(clientId, {
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
    };

    const isError = betsQuery.isError || betsQuery.data?.HasError;
    const errorMessage = betsQuery.error instanceof Error ? betsQuery.error.message : betsQuery.data?.AlertMessage;
    // Assume typical BetConstruct Casino history array structure under Data.Objects or Data.BetData.Objects
    const bets = betsQuery.data?.Data?.Objects || betsQuery.data?.Data?.BetData?.Objects || [];
    const totalCount = betsQuery.data?.Data?.Count || betsQuery.data?.Data?.BetData?.Count || 0;

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
                    <h3 className="text-rose-400 font-bold mb-1">Casino Geçmişi Alınamadı</h3>
                    <p className="text-sm text-rose-300/80">{errorMessage || 'Arka ofis Casino entegrasyonu desteklemiyor olabilir.'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <Dices size={18} className="text-blue-400" /> Casino Geçmişi ({totalCount})
                </h3>
                <DateRangeBar
                    range={dateRange}
                    onRangeChange={handleRangeChange}
                    onRefresh={() => betsQuery.refetch()}
                    isLoading={betsQuery.isFetching}
                />
            </div>

            {bets.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-slate-900/40 p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Dices size={32} className="opacity-20" />
                    <span>Oynanmış casino eli bulunmuyor.</span>
                </div>
            ) : (
                <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900 border-b border-white/10">
                            <tr>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Oyun Adı</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Sağlayıcı</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Oyun Türü</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">İşlem Türü</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Durum</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Tarih</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Tutar</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Kazanç</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">İşlem No</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {bets.map((bet: any) => {
                                const winAmount = bet.WinAmount ?? bet.WinningAmount ?? 0;
                                const isWon = winAmount > 0;
                                const gameName = bet.GameName || bet.Game || '-';
                                const providerName = bet.ProviderName || bet.Provider || '-';
                                const documentId = bet.DocumentId ?? bet.Id ?? bet.DocId;

                                return (
                                    <tr key={bet.Id || bet.DocId || Math.random()} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-bold text-blue-300">
                                            {gameName}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono text-xs text-slate-400 px-2 py-1 bg-white/5 rounded">
                                                {providerName}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono text-[10px] uppercase text-slate-500">{bet.GameType || '—'}</span>
                                        </td>
                                        <td className="p-4">
                                            <TypeBadge value={bet.TypeName} />
                                        </td>
                                        <td className="p-4">
                                            <StateBadge value={bet.StateName} />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Calendar size={12} className="text-slate-500" />
                                                {bet.CreatedLocal || bet.DateLocal ? formatDateTimeDisplay(bet.CreatedLocal || bet.DateLocal) : '—'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-mono font-medium text-slate-300 px-2 py-1 rounded">
                                                {formatNumber(bet.Amount ?? bet.BetAmount ?? 0)} {bet.CurrencyId ?? 'TRY'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`font-mono font-bold ${isWon ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                {isWon ? `+${formatNumber(winAmount)}` : '0.00'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono text-[10px] text-slate-600" title={String(documentId ?? '')}>
                                                {String(documentId ?? '—')}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {totalCount > 0 && (
                <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                        <select className="bg-slate-900 border border-white/10 text-slate-300 text-sm rounded-lg px-2 py-1 outline-none"
                            value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}>
                            {[10, 20, 50, 100].map(val => (
                                <option key={val} value={val}>{val} satır</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="text-slate-400 disabled:opacity-30 hover:text-white transition-colors" disabled={page === 0} onClick={() => setPage(page - 1)}>Önceki</button>
                        <span className="text-slate-200 text-sm font-mono">{page + 1} / {Math.ceil(totalCount / rowsPerPage) || 1}</span>
                        <button className="text-slate-400 disabled:opacity-30 hover:text-white transition-colors" disabled={(page + 1) * rowsPerPage >= totalCount} onClick={() => setPage(page + 1)}>Sonraki</button>
                    </div>
                </div>
            )}
        </div>
    );
}
