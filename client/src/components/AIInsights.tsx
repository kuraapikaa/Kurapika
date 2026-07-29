import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/client';
import { useDateRange } from '../context/DateRangeContext';
import { Card } from './ui/Card';
import {
    Sparkles, TrendingUp, AlertCircle,
    Gift, ArrowRight, Zap, Lightbulb,
    Target, ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export function AIInsights() {
    const { dateRange } = useDateRange();

    const { data: insightsData, isLoading } = useQuery({
        queryKey: ['business-insights', dateRange.startDate, dateRange.endDate],
        queryFn: () => adminApi.businessInsights(dateRange),
        refetchInterval: 600000, // 10 mins
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse mt-8">
                {[1, 2].map(i => (
                    <div key={i} className="h-48 rounded-xl bg-[rgba(242,244,248,0.50)] border border-white/5" />
                ))}
            </div>
        );
    }

    if (!insightsData) return null;

    const insights = insightsData.insights || [];
    const bonuses = insightsData.bonuses || [];

    return (
        <div className="space-y-8 mt-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-white uppercase tracking-tight">İşletme Analitikleri</h2>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Veri Odaklı Stratejik Raporlama</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Insights Section */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 px-1">
                        <Lightbulb size={14} className="text-amber-400" />
                        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">Kritik Analizler</span>
                    </div>
                    {insights.length === 0 ? (
                        <Card className="p-8 border-dashed border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center space-y-3">
                            <ShieldCheck size={32} className="text-zinc-700" />
                            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-tight">Kritik Risk Tespit Edilmedi</p>
                        </Card>
                    ) : insights.map((insight: any, i: number) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <Card className={cn(
                                "relative overflow-hidden p-6 border-white/5 bg-[rgba(242,244,248,0.60)] backdrop-blur-2xl group hover:scale-[1.01] transition-all duration-500 shadow-2xl",
                                insight.type === 'critical' ? "border-rose-500/20 shadow-rose-500/5" :
                                    insight.type === 'warning' ? "border-amber-500/20 shadow-amber-500/5" : "border-blue-500/20 shadow-blue-500/5"
                            )}>
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                                        insight.type === 'critical' ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                                            insight.type === 'warning' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    )}>
                                        {insight.type === 'critical' || insight.type === 'warning' ? <AlertCircle size={24} /> : <TrendingUp size={24} />}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-white uppercase tracking-tight antialiased">{insight.title}</h4>
                                            {insight.metric && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-white/10 text-white/80 uppercase tracking-tighter">{insight.metric}</span>
                                            )}
                                        </div>
                                        <p className="text-xs font-semibold text-zinc-400 leading-relaxed">{insight.description}</p>
                                        <div className="pt-4 mt-4 border-t border-white/5 relative bg-white/[0.02] -mx-6 px-3 py-2.5">
                                            <div className="flex items-center gap-2 text-blue-400 mb-1.5">
                                                <Target size={14} />
                                                <span className="text-[9px] font-semibold uppercase tracking-widest text-blue-300">Stratejik Tavsiye</span>
                                            </div>
                                            <p className="text-[12px] font-bold text-zinc-200 leading-normal">{insight.recommendation}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute bottom-0 left-0 h-1.5 bg-white/5 w-full">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${insight.impact}%` }}
                                        className={cn(
                                            "h-full rounded-full relative",
                                            insight.type === 'critical' ? "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]" :
                                                insight.type === 'warning' ? "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]" : "bg-blue-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                                        )}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                                    </motion.div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Bonus Recommendations Section */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 px-1">
                        <Gift size={14} className="text-teal-400" />
                        <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-widest">Bonus & Kampanya Önerileri</span>
                    </div>
                    {bonuses.length === 0 ? (
                        <Card className="p-8 border-dashed border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center space-y-3">
                            <Zap size={32} className="text-zinc-700" />
                            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-tight">Yeni Kampanya Önerisi Yok</p>
                        </Card>
                    ) : bonuses.map((bonus: any, i: number) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-teal-500/5 border-white/5 group hover:border-blue-500/20 transition-all duration-300 shadow-xl backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-teal-400 border border-white/5">
                                            <Zap size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-white uppercase tracking-tight">{bonus.bonusName}</h4>
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase">{bonus.targetGroup}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Tahmini Artış</p>
                                        <p className="text-lg font-semibold text-white">+{bonus.estimatedCvr}%</p>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Önerilen Oran</span>
                                        <span className="text-xs font-semibold text-blue-400">{bonus.suggestedAmount}</span>
                                    </div>
                                    <p className="text-[11px] font-medium text-zinc-400 leading-relaxed italic border-t border-white/5 pt-3">
                                        "{bonus.reasoning}"
                                    </p>
                                </div>
                                <button className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-zinc-950 text-[10px] font-semibold uppercase tracking-widest hover:bg-zinc-200 transition-all group/btn shadow-lg">
                                    Kampanya Oluştur <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                </button>
                            </Card>
                        </motion.div>
                    ))}

                    <Card className="relative overflow-hidden p-6 bg-[rgba(242,244,248,0.20)] border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-4 py-10 group">
                        {/* Scanning Line Animation */}
                        <motion.div
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            className="absolute left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent z-0"
                        />

                        <div className="relative z-10 flex flex-col items-center space-y-4">
                            <div className="relative">
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute inset-0 bg-blue-500 rounded-full blur-xl"
                                />
                                <div className="relative h-12 w-12 rounded-full bg-zinc-900 border border-blue-500/30 flex items-center justify-center shadow-2xl">
                                    <Zap size={20} className="text-blue-400 animate-pulse" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-white uppercase tracking-[0.2em] animate-pulse">Analiz Motoru Aktif</p>
                                <div className="flex items-center gap-1.5 justify-center">
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3].map(i => (
                                            <motion.div
                                                key={i}
                                                animate={{ height: [4, 12, 4] }}
                                                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                                                className="w-1 bg-blue-500/60 rounded-full"
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Veri İşleme Devam Ediyor</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap justify-center gap-2 max-w-[280px]">
                                {['Syncing KPI', 'Pattern Match', 'GGR Audit'].map((tag, idx) => (
                                    <span key={idx} className="text-[8px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-zinc-500 uppercase tracking-tighter">
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            <p className="text-[10px] text-zinc-400 font-medium leading-relaxed max-w-[300px] border-t border-white/5 pt-4">
                                YZ modelleri verilerinizi saniyeler içinde analiz etmeye devam ediyor. <br />
                                <span className="text-blue-500/60 font-semibold italic">Sistemsel optimizasyon aktif.</span>
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
