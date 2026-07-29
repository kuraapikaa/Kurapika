import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/client';
import { formatNumber, formatDateTimeDisplay } from '../lib/format';
import { Radar, Loader2, AlertCircle, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function LiveRadar() {
    const [minStake, setMinStake] = useState(100);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const siteBetsQuery = useQuery({
        queryKey: ['site-bet-history-radar', autoRefresh],
        queryFn: () => dashboardApi.siteBetHistory({ MaxRows: 100, State: 1 }),
        refetchInterval: autoRefresh ? 8000 : false,
        staleTime: 5000,
    });

    const isError = siteBetsQuery.isError || siteBetsQuery.data?.HasError;
    const errorMessage = siteBetsQuery.error instanceof Error ? siteBetsQuery.error.message : siteBetsQuery.data?.AlertMessage;
    const bets = siteBetsQuery.data?.Data?.BetData?.Objects ?? [];

    // Filtreleme: Minimum tutar ve sadece son X zamanlı olanlar vs. Canlıları ayırma.
    const radarBets = bets
        .filter(b => b.Amount >= minStake && b.State === 1)
        .sort((a, b) => (b.Id ?? 0) - (a.Id ?? 0));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Radar className="text-rose-500 animate-spin-slow" size={32} />
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold uppercase tracking-widest text-[color:var(--panel-text,#f2f4f8)] flex items-center gap-2">
                            Canlı Radar <span className="font-mono text-rose-500 text-sm">{radarBets.length > 0 ? `(${radarBets.length})` : ''}</span>
                        </h2>
                        <p className="text-sm text-[color:var(--panel-muted,#8a919c)] font-medium">Site genelindeki yüksek tutarlı son bahislerin gerçek zamanlı akışı</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-2 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl">
                    <div className="flex items-center gap-2 px-3 border-r border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                        <span className="text-xs uppercase font-bold text-[color:var(--panel-muted,#8a919c)]">Min. Tutar</span>
                        <select className="bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] text-[color:var(--panel-text-dim,#c8cdd5)] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg text-sm px-2 py-1 outline-none"
                            value={minStake} onChange={(e) => setMinStake(Number(e.target.value))}>
                            <option value={10}>10 TRY</option>
                            <option value={100}>100 TRY</option>
                            <option value={500}>500 TRY</option>
                            <option value={1000}>1.000 TRY</option>
                            <option value={5000}>5.000 TRY</option>
                            <option value={10000}>10.000 TRY</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 pr-2">
                        <span className="text-xs uppercase font-bold text-[color:var(--panel-muted,#8a919c)]">Oto. Yenileme</span>
                        <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${autoRefresh ? 'bg-rose-500' : 'bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))]'}`} onClick={() => setAutoRefresh(!autoRefresh)}>
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </div>
            </div>

            {isError ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-8 flex items-center gap-4 justify-center">
                    <AlertCircle className="text-rose-400 shrink-0" size={32} />
                    <div>
                        <h3 className="text-rose-400 font-bold mb-1">Radar Bağlantısı Koptu</h3>
                        <p className="text-sm text-rose-300/80">{errorMessage}</p>
                    </div>
                </div>
            ) : radarBets.length === 0 ? (
                <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-24 flex flex-col items-center justify-center gap-4">
                    {siteBetsQuery.isLoading ? (
                        <>
                            <Loader2 className="animate-spin text-rose-500" size={48} />
                            <p className="text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest font-bold">Frekans Taranıyor...</p>
                        </>
                    ) : (
                        <>
                            <Radar className="text-[color:var(--panel-faint,#5c6470)] mx-auto opacity-50" size={64} />
                            <p className="text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest font-bold text-center">Belirlenen limitte bahis yok</p>
                            <p className="text-[color:var(--panel-faint,#5c6470)] text-sm">Alt limiti düşürebilirsiniz.</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence>
                        {radarBets.map(bet => {
                            const isHighStake = bet.Amount >= 5000;

                            return (
                                <motion.div
                                    key={`radar-${bet.Id}`}
                                    initial={{ opacity: 0, y: -20, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                    className={`relative rounded-xl border p-5 overflow-hidden shadow-2xl ${isHighStake ? 'border-amber-500/50 bg-amber-950/20 shadow-amber-900/10' : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] shadow-black/50'
                                        }`}
                                >
                                    {isHighStake && (
                                        <div className="absolute top-0 right-0 p-2">
                                            <div className="bg-amber-500/20 text-amber-400 text-[9px] font-semibold uppercase tracking-widest px-2 py-1 rounded-bl-lg flex items-center gap-1">
                                                <Flame size={10} /> Balina Seçimi
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)] mb-0.5">Oyuncu</p>
                                            <p className="text-sm font-bold text-white flex items-center gap-2">
                                                {bet.ClientFirstName ?? '-'} {bet.ClientLastName?.slice(0, 1) ?? ''}.
                                                <a href={`/#/oyuncu/${bet.ClientId}/${bet.ClientLogin || bet.ClientFirstName || 'Oyuncu'}`} target="_blank" rel="noreferrer" className="text-[color:var(--panel-muted,#8a919c)] hover:text-blue-400 transition-colors font-mono text-xs">
                                                    #{bet.ClientId}
                                                </a>
                                            </p>
                                        </div>
                                        {bet.IsLive && (
                                            <span className="bg-rose-500 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]">Live</span>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-end mb-4 bg-black/20 rounded-xl p-3 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)] mb-1">Tutar</p>
                                            <p className={`font-mono text-xl font-semibold ${isHighStake ? 'text-amber-400' : 'text-[color:var(--panel-text-dim,#c8cdd5)]'}`}>
                                                {formatNumber(bet.Amount)} <span className="text-sm">TRY</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)] mb-1">Total Oran</p>
                                            <p className="font-bold text-blue-300">@{Number(bet.Price ?? 0).toFixed(2)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] pt-3">
                                        <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">
                                            Kupon: <span className="font-mono">{bet.Id}</span>
                                        </p>
                                        <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">
                                            {formatDateTimeDisplay(bet.CreatedLocal)}
                                        </p>
                                    </div>

                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
                                        <Radar size={120} />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
