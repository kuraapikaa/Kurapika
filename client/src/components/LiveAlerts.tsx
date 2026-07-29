import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/client';
import { AlertTriangle, Bell, ShieldAlert, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function LiveAlerts() {
    const lastAlertCount = useRef(0);

    const { data, isLoading } = useQuery({
        queryKey: ['live-alerts'],
        queryFn: () => adminApi.liveAlerts(),
        refetchInterval: 30000, // Poll every 30 seconds
    });

    const anomalies = data?.anomalies ?? [];

    useEffect(() => {
        if (anomalies.length > lastAlertCount.current) {
            const newAlert = anomalies[0];
            toast.error('Yeni Şüpheli İşlem!', {
                description: `${newAlert.clientLogin}: ${newAlert.message}`,
                duration: 5000,
            });
        }
        lastAlertCount.current = anomalies.length;
    }, [anomalies]);

    if (isLoading && !data) return null;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-rose-500 rounded-lg blur-lg opacity-40 animate-pulse" />
                        <div className="relative rounded-xl bg-rose-500/10 p-2 text-rose-500 border border-rose-500/20">
                            <Bell size={18} className="animate-bounce" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Sistem Uyarıları</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Anlık Takip</p>
                        </div>
                    </div>
                </div>
                <div className="px-2 py-1 rounded-full bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                    <span className="text-[9px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-tighter">Sistem Durumu: KRİTİK</span>
                </div>
            </div>

            <div className="space-y-3 max-h-[480px] overflow-y-auto overflow-x-hidden pr-3 scrollbar-hide">
                <AnimatePresence mode="popLayout">
                    {anomalies.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="premium-card p-8 text-center border-dashed border-[color:var(--panel-border,rgba(242,244,248,0.1))]"
                        >
                            <ShieldAlert size={32} className="mx-auto text-[color:var(--panel-faint,#5c6470)] mb-3" />
                            <p className="text-[11px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Analiz edilecek veri bekleniyor...</p>
                        </motion.div>
                    ) : (
                        anomalies.slice(0, 10).map((alert: any, i: number) => (
                            <motion.div
                                key={alert.id || i}
                                layout
                                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                className={cn(
                                    "premium-card group relative p-4 transition-all duration-500 border-l-4",
                                    alert.severity === 'high'
                                        ? "border-l-rose-500/80 bg-rose-500/[0.03] hover:bg-rose-500/[0.08] hover:border-l-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.05)]"
                                        : "border-l-amber-500/80 bg-amber-500/[0.03] hover:bg-amber-500/[0.08] hover:border-l-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                                )}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "rounded-lg p-2 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] shadow-inner",
                                            alert.severity === 'high' ? "bg-rose-500/10 text-rose-400 neon-glow-rose" : "bg-amber-500/10 text-amber-400"
                                        )}>
                                            {alert.severity === 'high' ? <ShieldAlert size={14} /> : <AlertTriangle size={14} />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-semibold text-white uppercase tracking-wider">{alert.clientLogin || 'Bilinmiyor'}</span>
                                            <span className="text-[9px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-tighter">{alert.type?.replace(/_/g, ' ')}</span>
                                        </div>
                                    </div>
                                    {alert.clientId && (
                                        <Link
                                            to={`/oyuncu/${alert.clientId}/${alert.clientLogin}`}
                                            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[color:var(--panel-muted,#8a919c)] hover:text-white transition-all border border-[color:var(--panel-border,rgba(242,244,248,0.1))]"
                                        >
                                            <ExternalLink size={14} />
                                        </Link>
                                    )}
                                </div>

                                <p className="mt-3 text-[11px] leading-relaxed text-[color:var(--panel-text-dim,#c8cdd5)] font-medium tracking-tight">
                                    {alert.message}
                                </p>

                                <div className="mt-3 pt-3 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex items-center justify-between">
                                    <span className="text-[8px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.1em]">{alert.date}</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className={cn("w-1.5 h-1.5 rounded-full", alert.severity === 'high' ? "bg-rose-500" : "bg-amber-500")} />
                                        <span className="text-[8px] font-semibold uppercase text-[color:var(--panel-muted,#8a919c)]">{alert.severity === 'high' ? 'TEHLİKELİ' : 'DİKKAT'}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
