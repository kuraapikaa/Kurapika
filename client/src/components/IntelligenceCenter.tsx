import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/client';
import { Card } from './ui/Card';
import {
    BrainCircuit, Users, ShieldAlert, BadgeCheck,
    Activity, TrendingUp, AlertTriangle,
    Zap, Info, Search, ChevronRight,
    ShieldCheck, Fingerprint, Network
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export function IntelligenceCenter() {
    const [activeView, setActiveView] = useState<'clusters' | 'scorecards'>('clusters');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedLogin, setSelectedLogin] = useState<string | null>(null);

    const { data: clustersData } = useQuery({
        queryKey: ['intelligence-clusters'],
        queryFn: () => adminApi.intelligenceClusters(),
        refetchInterval: 300000, // 5 mins
    });

    const { data: scorecardData, isLoading: scorecardLoading, error: scorecardError } = useQuery({
        queryKey: ['player-scorecard', selectedId, selectedLogin],
        queryFn: () => {
            if (selectedId) return adminApi.playerScorecard(selectedId);
            if (selectedLogin) return adminApi.playerScorecardByLogin(selectedLogin);
            return null;
        },
        enabled: !!selectedId || !!selectedLogin,
    });

    const handleSearch = () => {
        if (!searchQuery.trim()) return;

        const isNumeric = /^\d+$/.test(searchQuery.trim());
        if (isNumeric) {
            setSelectedId(Number(searchQuery.trim()));
            setSelectedLogin(null);
        } else {
            setSelectedLogin(searchQuery.trim());
            setSelectedId(null);
        }
        setActiveView('scorecards');
    };

    return (
        <div className="space-y-8 p-6 animate-in fade-in duration-700">
            {/* Header Panel */}
            <header className="relative p-10 overflow-hidden rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] shadow-2xl">
                <div className="absolute top-0 right-0 -mr-24 -mt-24 h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />
                <div className="absolute bottom-0 left-0 -ml-24 -mb-24 h-80 w-80 rounded-full bg-teal-500/10 blur-[120px]" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-500 p-[1px] shadow-2xl shadow-blue-500/20">
                            <div className="flex h-full w-full items-center justify-center rounded-[23px] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">
                                <BrainCircuit className="text-white" size={32} />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                                İstihbarat <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-400 to-emerald-400">Merkezi</span>
                            </h1>
                            <div className="mt-2 flex items-center gap-3">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-[11px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em]">Sistem İzleme Aktif</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-1.5 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] backdrop-blur-xl">
                        <button
                            onClick={() => setActiveView('clusters')}
                            className={cn(
                                "flex items-center gap-2 px-6 py-3 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all",
                                activeView === 'clusters' ? "bg-blue-500 text-white shadow-xl shadow-blue-500/20" : "text-[color:var(--panel-muted,#8a919c)] hover:text-white"
                            )}
                        >
                            <Network size={16} /> ÇAKIŞMA RADARI
                        </button>
                        <button
                            onClick={() => setActiveView('scorecards')}
                            className={cn(
                                "flex items-center gap-2 px-6 py-3 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all",
                                activeView === 'scorecards' ? "bg-teal-500 text-white shadow-xl shadow-teal-500/20" : "text-[color:var(--panel-muted,#8a919c)] hover:text-white"
                            )}
                        >
                            <BadgeCheck size={16} /> OYUNCU KARNESİ
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">

                {/* Statistics Bar */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="p-6 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex items-center gap-5">
                        <div className="h-14 w-14 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400"><Users size={24} /></div>
                        <div>
                            <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Tespit Edilen Kümeler</p>
                            <p className="text-2xl font-semibold text-white">{clustersData?.clusters?.length || 0}</p>
                        </div>
                    </Card>
                    <Card className="p-6 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex items-center gap-5">
                        <div className="h-14 w-14 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400"><ShieldAlert size={24} /></div>
                        <div>
                            <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Kritik Riskli Oyuncular</p>
                            <p className="text-2xl font-semibold text-white">12</p>
                        </div>
                    </Card>
                    <Card className="p-6 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex items-center gap-5">
                        <div className="h-14 w-14 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400"><Activity size={24} /></div>
                        <div>
                            <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Günlük Analiz Hacmi</p>
                            <p className="text-2xl font-semibold text-white">~1.2k</p>
                        </div>
                    </Card>
                    <Card className="p-6 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex items-center gap-5">
                        <div className="h-14 w-14 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Zap size={24} /></div>
                        <div>
                            <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Sistem Analiz Verimliliği</p>
                            <p className="text-2xl font-semibold text-white">%98.4</p>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-12">
                    <AnimatePresence mode="wait">
                        {activeView === 'clusters' ? (
                            <motion.div
                                key="clusters"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400"><Fingerprint size={20} /></div>
                                        <h2 className="text-xl font-semibold text-white uppercase tracking-tight">Çoklu Hesap Radarı</h2>
                                    </div>
                                    <p className="text-xs font-bold text-[color:var(--panel-muted,#8a919c)] italic">Son 3 saniye içinde güncellendi.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {clustersData?.clusters?.map((cluster: any) => (
                                        <Card key={cluster.id} className="relative overflow-hidden p-8 border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] backdrop-blur-md hover:border-blue-500/30 transition-all group">
                                            <div className="absolute top-0 right-0 p-3">
                                                <div className={cn(
                                                    "px-2 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-wider",
                                                    cluster.riskScore > 70 ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                                                )}>
                                                    RISK: %{cluster.riskScore}
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-[0.2em]">{cluster.type} TEMELLİ ÇAKIŞMA</p>
                                                    <p className="text-sm font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">{cluster.reason}</p>
                                                </div>

                                                <div className="space-y-3">
                                                    {cluster.clients.map((client: any) => (
                                                        <div key={client.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] group/client hover:bg-white/10 transition-all">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-semibold text-white">{client.login}</span>
                                                                <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)] font-bold uppercase">ID: {client.id}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => { setSelectedId(client.id); setSelectedLogin(null); setActiveView('scorecards'); }}
                                                                className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 opacity-0 group-hover/client:opacity-100 transition-all"
                                                            >
                                                                <ChevronRight size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex items-center justify-between">
                                                    <span className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest">Tespit: Sistem</span>
                                                    <button className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 uppercase tracking-widest">İNCELEME BAŞLAT</button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}

                                    {(!clustersData?.clusters || clustersData.clusters.length === 0) && (
                                        <div className="col-span-full py-32 text-center rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-dashed border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                            <ShieldCheck className="mx-auto text-emerald-500/30 mb-6" size={64} />
                                            <p className="text-lg font-semibold text-[color:var(--panel-muted,#8a919c)]">Çakışan hesap kümesi bulunmadı.</p>
                                            <p className="text-sm text-[color:var(--panel-faint,#5c6470)] font-bold mt-2 uppercase tracking-widest">Tüm ağ temiz görünüyor.</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="scorecards"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                {/* Search Header */}
                                <Card className="p-8 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border-[color:var(--panel-border,rgba(242,244,248,0.1))] shadow-2xl">
                                    <div className="flex flex-col md:flex-row items-end gap-6">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-2 px-1">
                                                <Search size={14} className="text-teal-400" />
                                                <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-widest">Oyuncu Analiz Motoru</span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="ID veya Kullanıcı Adı girerek profil karnesi oluşturun..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                                className="w-full h-16 bg-black/40 border-2 border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-6 text-xl font-semibold text-white focus:outline-none focus:border-teal-500/50 transition-all"
                                            />
                                        </div>
                                        <button
                                            onClick={handleSearch}
                                            className="h-16 px-12 bg-[color:var(--panel-accent,#0a84ff)] text-white rounded-xl text-[12px] font-semibold shadow-2xl hover:bg-[color:var(--panel-accent-deep,#0060df)] transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest"
                                        >
                                            <Zap size={18} /> ANALİZİ BAŞLAT
                                        </button>
                                    </div>
                                </Card>

                                <AnimatePresence mode="wait">
                                    {scorecardError ? (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center">
                                            <AlertTriangle className="mx-auto text-rose-500 mb-4" size={48} />
                                            <p className="text-lg font-semibold text-white uppercase tracking-tight">ANALİZ HATASI</p>
                                            <p className="text-sm text-[color:var(--panel-muted,#8a919c)] font-bold mt-2">{(scorecardError as any)?.response?.data?.AlertMessage || 'Kullanıcı bulunamadı veya sistem hatası oluştu.'}</p>
                                        </motion.div>
                                    ) : scorecardLoading ? (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20">
                                            <div className="h-12 w-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin mb-4" />
                                            <p className="text-xs font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.3em] animate-pulse">Pattern Analizi Yapılıyor</p>
                                        </motion.div>
                                    ) : scorecardData?.scorecard ? (
                                        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                            {/* Score Card Section */}
                                            <Card className="lg:col-span-1 p-10 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border-[color:var(--panel-border,rgba(242,244,248,0.1))] relative overflow-hidden flex flex-col items-center text-center">
                                                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />

                                                <div className="relative mb-10">
                                                    <svg className="h-48 w-48 -rotate-90">
                                                        <circle cx="96" cy="96" r="88" className="stroke-zinc-800 fill-none" strokeWidth="12" />
                                                        <circle
                                                            cx="96" cy="96" r="88"
                                                            className={cn(
                                                                "fill-none transition-all duration-1000 ease-out",
                                                                scorecardData.scorecard.trustScore > 70 ? "stroke-emerald-500" : scorecardData.scorecard.trustScore > 40 ? "stroke-amber-500" : "stroke-rose-500"
                                                            )}
                                                            strokeWidth="12"
                                                            strokeDasharray={552.92}
                                                            strokeDashoffset={552.92 - (552.92 * scorecardData.scorecard.trustScore) / 100}
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        <span className="text-5xl font-semibold text-white">{scorecardData.scorecard.trustScore}</span>
                                                        <span className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest mt-1">GÜVEN PUANI</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2 mb-10">
                                                    <h3 className="text-2xl font-semibold text-white uppercase tracking-tight">{scorecardData.scorecard.login}</h3>
                                                    <p className="text-xs font-bold text-[color:var(--panel-muted,#8a919c)]">ID: {scorecardData.scorecard.clientId}</p>
                                                </div>

                                                <div className={cn(
                                                    "w-full py-4 rounded-xl text-[11px] font-semibold tracking-[0.2em] uppercase shadow-lg",
                                                    scorecardData.scorecard.riskLevel === 'low' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                                        scorecardData.scorecard.riskLevel === 'medium' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                                            "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                                )}>
                                                    RISK SEVİYESİ: {scorecardData.scorecard.riskLevel}
                                                </div>

                                                <div className="mt-8 pt-8 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] w-full text-left">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <span className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest">Profil Sınıfı</span>
                                                        <span className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-[10px] font-semibold uppercase">{scorecardData.scorecard.category}</span>
                                                    </div>
                                                </div>
                                            </Card>

                                            {/* Insight Details */}
                                            <div className="lg:col-span-2 space-y-8">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <Card className="p-8 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border-[color:var(--panel-border,rgba(242,244,248,0.1))] space-y-6">
                                                        <div className="flex items-center gap-3">
                                                            <TrendingUp size={20} className="text-blue-400" />
                                                            <h4 className="text-sm font-semibold text-white uppercase tracking-widest">Performans Metrikleri</h4>
                                                        </div>
                                                        <div className="space-y-5">
                                                            <MetricRow label="Yatırım/Çekim Oranı" value={(scorecardData.scorecard.metrics.depositWithdrawalRatio * 100).toFixed(1) + '%'} progress={scorecardData.scorecard.metrics.depositWithdrawalRatio} />
                                                            <MetricRow label="Bonus Kullanım Oranı" value={(scorecardData.scorecard.metrics.bonusUsageRate * 100).toFixed(1) + '%'} progress={scorecardData.scorecard.metrics.bonusUsageRate} color="bg-amber-500" />
                                                            <MetricRow label="Sadakat Skoru" value={scorecardData.scorecard.metrics.loyaltyScore.toFixed(0) + '/100'} progress={scorecardData.scorecard.metrics.loyaltyScore / 100} color="bg-emerald-500" />
                                                        </div>
                                                    </Card>

                                                    <Card className="p-8 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border-[color:var(--panel-border,rgba(242,244,248,0.1))] space-y-6">
                                                        <div className="flex items-center gap-3">
                                                            <AlertTriangle size={20} className="text-rose-400" />
                                                            <h4 className="text-sm font-semibold text-white uppercase tracking-widest">Kritik Bulgular</h4>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {scorecardData.scorecard.topFlags.map((flag: string, i: number) => (
                                                                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                                                                    <div className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                                                    <p className="text-[11px] font-bold text-[color:var(--panel-text-dim,#c8cdd5)] leading-relaxed">{flag}</p>
                                                                </div>
                                                            ))}
                                                            {scorecardData.scorecard.topFlags.length === 0 && (
                                                                <div className="flex items-center justify-center p-10 text-[color:var(--panel-faint,#5c6470)]">
                                                                    <p className="text-xs font-bold italic">Negatif bulguya rastlanmadı.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Card>
                                                </div>

                                                <Card className="p-10 bg-gradient-to-br from-blue-500/10 to-transparent border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                    <div className="flex items-center gap-4 mb-8">
                                                        <Activity size={24} className="text-blue-400" />
                                                        <h4 className="text-lg font-semibold text-white tracking-tight">Sistem Karar Tavsiyesi</h4>
                                                    </div>
                                                    <div className="p-6 rounded-xl bg-black/40 border border-blue-500/30">
                                                        <p className="text-sm font-bold text-[color:var(--panel-text-dim,#c8cdd5)] leading-relaxed">
                                                            {scorecardData.scorecard.trustScore > 80
                                                                ? "Bu oyuncu patternleri tamamen normal ve güvenli sınırlar içerisinde. Manuel onay beklemeden VIP hızında işlem yapılabilir."
                                                                : scorecardData.scorecard.trustScore > 50
                                                                    ? "Normal seyrediyor ancak yüksek bonus kullanımı mevcut. Çekim talepleri anapara çevrimi kontrol edildikten sonra onaylanmalıdır."
                                                                    : "Kritik risk tespit edildi. Aynı IP/Cihaz üzerinde çakışan üyelikler olabilir veya bonus manipülasyonu patterni sergiliyor. Ödemeyi askıya alıp detaylı inceleme yapınız."}
                                                        </p>
                                                    </div>
                                                </Card>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div className="py-40 text-center text-[color:var(--panel-faint,#5c6470)]">
                                            <Info size={48} className="mx-auto mb-6 opacity-20" />
                                            <p className="text-sm font-bold uppercase tracking-widest">Analiz Başlatmak İçin Bir ClientId Seçin</p>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </div>
    );
}

function MetricRow({ label, value, progress, color }: any) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">{label}</span>
                <span className="text-xs font-semibold text-white">{value}</span>
            </div>
            <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={cn("h-full rounded-full", color || "bg-blue-500")}
                />
            </div>
        </div>
    );
}
