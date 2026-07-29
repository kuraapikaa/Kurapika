import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Store, 
  Star, 
  Zap, 
  Coins, 
  Gift, 
  Package,
  ArrowRight,
  Sparkles,
  RefreshCcw,
  LogIn,
  Wallet
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loyaltyApi } from '../../api/client';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { LobbyMobileNav } from './LobbyMobileNav';
import { lobbyExtraText, useLobbyPageContent } from '../../lib/lobbyContent';

export function LoyaltyHub() {
    const { content: pageContent } = useLobbyPageContent('loyalty');
    const [activeTab, setActiveTab] = useState<'market' | 'inventory'>('market');
    const queryClient = useQueryClient();

    const { data: status, isLoading: statusLoading, isError: statusError } = useQuery({
        queryKey: ['loyalty-status'],
        queryFn: () => loyaltyApi.status(),
        retry: false,
        refetchInterval: 60000 // Puanları her dakika senkronize et
    });

    const { data: market } = useQuery({
        queryKey: ['loyalty-market'],
        queryFn: () => loyaltyApi.marketList(),
        enabled: !!status,
        retry: false
    });

    const buyMutation = useMutation({
        mutationFn: (itemId: string) => loyaltyApi.buyItem(itemId),
        onSuccess: () => {
            toast.success('Ürün başarıyla satın alındı!');
            queryClient.invalidateQueries({ queryKey: ['loyalty-status'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || err.message || 'Bakiye yetersiz veya hata oluştu');
        }
    });

    if (statusLoading) return <div className="narcos-lobby min-h-screen bg-[#0e0c09] font-lobby flex items-center justify-center"><Zap className="animate-spin text-amber-500" /></div>;

    if (statusError || !status) {
        return (
            <div className="narcos-lobby min-h-screen overflow-x-hidden bg-[#0e0c09] font-lobby text-[color:var(--lobby-text,#f3ecdd)] flex flex-col">
                <LobbyMobileNav />
                <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 rounded-[20px] bg-[rgba(243,236,221,0.03)] border border-[rgba(243,236,221,0.05)] flex items-center justify-center text-[color:var(--lobby-muted,#8f8674)] mb-6">
                        <LogIn size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-[color:var(--lobby-text,#f3ecdd)] uppercase tracking-tight mb-2">{pageContent.unavailableTitle}</h1>
                    <p className="text-[color:var(--lobby-muted,#8f8674)] font-bold max-w-xs mb-8 text-sm">{pageContent.unavailableDescription}</p>
                    <Link to="/lobi" className="px-8 py-4 bg-amber-500 text-[#171204] font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-900/20">
                        {pageContent.secondaryButton}
                    </Link>
                </main>
            </div>
        );
    }

    const currentXp = status?.xp || 0;
    const currentLevel = status?.level || 1;
    const progress = ((currentXp % 1000) / 1000) * 100;

    return (
        <div className="narcos-lobby min-h-screen overflow-x-hidden bg-[#0e0c09] font-lobby text-[color:var(--lobby-text,#f3ecdd)] pb-10">
            <LobbyMobileNav />

            {/* Header / Summary Card */}
            <div className="w-full bg-gradient-to-b from-[#111827] to-[#070b14] border-b border-[rgba(243,236,221,0.05)] px-3 py-3 sm:px-4 md:px-8 md:py-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
                        {/* Profile Info */}
                        <div className="flex w-full items-center gap-3 md:w-auto md:gap-5">
                            <div className="relative">
                                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 p-1 sm:h-20 sm:w-20 sm:rounded-[20px]">
                                    <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0f172a] sm:rounded-[22px]">
                                        <Trophy size={28} className="text-amber-500 sm:size-9" />
                                    </div>
                                </div>
                                <div className="absolute -bottom-1.5 -right-2 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black text-[#171204] shadow-lg sm:py-1 sm:text-xs">
                                    LVL {currentLevel}
                                </div>
                            </div>
                            <div className="min-w-0">
                                <h1 className="flex items-center gap-1.5 text-xl sm:text-3xl font-black text-[color:var(--lobby-text,#f3ecdd)] uppercase tracking-tight">
                                    <span className="truncate">{pageContent.title}</span> <Sparkles className="shrink-0 text-amber-400" size={22} />
                                </h1>
                                <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-4 text-[color:var(--lobby-muted,#8f8674)] sm:text-sm sm:leading-5">{pageContent.subtitle}</p>
                            </div>
                        </div>

                        {/* Balance Stats */}
                        <div className="grid w-full grid-cols-3 gap-1.5 md:w-auto md:min-w-[520px] md:gap-2">
                            <div className="min-w-0 rounded-xl border border-[rgba(243,236,221,0.10)] bg-[rgba(243,236,221,0.05)] p-2 sm:p-3 md:p-4">
                                <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 sm:h-10 sm:w-10">
                                    <RefreshCcw size={16} className="text-blue-400 sm:size-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-blue-400/60 sm:text-[10px]">Çevrim</p>
                                    <p className="truncate text-sm font-black text-[color:var(--lobby-text,#f3ecdd)] sm:text-lg">{status?.totalWagerSynced?.toLocaleString()} TL</p>
                                </div>
                            </div>
                            <div className="min-w-0 rounded-xl border border-[rgba(243,236,221,0.10)] bg-[rgba(243,236,221,0.05)] p-2 sm:p-3 md:p-4">
                                <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 sm:h-10 sm:w-10">
                                    <Coins size={16} className="text-emerald-500 sm:size-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-emerald-500/60 sm:text-[10px]">Puan</p>
                                    <p className="truncate text-sm font-black text-[color:var(--lobby-text,#f3ecdd)] sm:text-lg">{status?.points?.toLocaleString() || 0}</p>
                                </div>
                            </div>
                            <div className="min-w-0 rounded-xl border border-[rgba(243,236,221,0.10)] bg-[rgba(243,236,221,0.05)] p-2 sm:p-3 md:p-4">
                                <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 sm:h-10 sm:w-10">
                                    <Wallet size={16} className="text-amber-500 sm:size-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-amber-500/60 sm:text-[10px]">Bakiye</p>
                                    <p className="truncate text-sm font-black text-[color:var(--lobby-text,#f3ecdd)] sm:text-lg">{status?.balance?.toLocaleString()} TL</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 sm:mt-6">
                        <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider sm:text-xs">
                            <motion.span animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-amber-500">Seviye {currentLevel}</motion.span>
                            <span className="text-[color:var(--lobby-muted,#8f8674)]">{currentXp % 1000} / 1000 XP</span>
                            <span className="hidden text-[color:var(--lobby-muted,#8f8674)] min-[390px]:inline">Seviye {currentLevel + 1}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full border border-[rgba(243,236,221,0.05)] bg-[rgba(243,236,221,0.05)] sm:h-3">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 relative"
                            >
                                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:24px_24px] animate-[slide_2s_linear_infinite]" />
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 mt-3 sm:mt-6">
                <div role="tablist" aria-label="Sadakat bölümleri" className="mb-4 flex w-full rounded-xl border border-[rgba(243,236,221,0.05)] bg-[rgba(243,236,221,0.05)] p-1 sm:mb-6 sm:w-fit">
                    {[
                        { id: 'market', label: lobbyExtraText(pageContent, 'marketTab', 'Ödül Marketi'), icon: Store },
                        { id: 'inventory', label: lobbyExtraText(pageContent, 'inventoryTab', 'Envanterim'), icon: Package },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            aria-controls={`tab-panel-${tab.id}`}
                            id={`tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all sm:flex-none sm:px-6 sm:py-3 sm:text-xs",
                                activeTab === tab.id
                                    ? "bg-amber-500 text-[#171204] shadow-lg shadow-amber-500/20"
                                    : "text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)]"
                            )}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'market' && (
                        <motion.div
                            key="market"
                            role="tabpanel"
                            id="tab-panel-market"
                            aria-labelledby="tab-market"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4"
                        >
                            {market?.map((item: any) => (
                                <div key={item.id} className="overflow-hidden rounded-[1.35rem] border border-[rgba(243,236,221,0.05)] bg-[#0f172a] transition-all group hover:border-amber-500/30 sm:rounded-[2rem]">
                                    <div className="relative flex h-24 items-center justify-center overflow-hidden bg-[rgba(243,236,221,0.05)] p-4 sm:aspect-square sm:h-auto sm:p-8">
                                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="relative z-10 rounded-full border border-[rgba(243,236,221,0.10)] bg-[#0e0c09] p-4 shadow-2xl transition-transform group-hover:scale-110 sm:p-6">
                                            {item.rewardType === 'freespin' ? <Star size={34} className="text-amber-500 sm:size-12" /> : <Gift size={34} className="text-emerald-500 sm:size-12" />}
                                        </div>
                                    </div>
                                    <div className="p-3.5 sm:p-6">
                                        <h3 className="mb-1 line-clamp-1 text-sm font-black uppercase tracking-tight text-[color:var(--lobby-text,#f3ecdd)] sm:text-base">{item.name}</h3>
                                        <p className="mb-3 line-clamp-1 text-[10px] font-bold text-[color:var(--lobby-muted,#8f8674)] sm:mb-6">{item.description}</p>
                                        
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <Coins size={16} className="text-emerald-500" />
                                                <span className="text-sm font-black text-[color:var(--lobby-text,#f3ecdd)]">{item.cost}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => buyMutation.mutate(item.id)}
                                                disabled={buyMutation.isPending || (status?.points < item.cost)}
                                                aria-label={status?.points >= item.cost ? `${item.name} satın al` : `${item.name} için bakiye yetersiz`}
                                                className={cn(
                                                    "rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-all sm:px-4 sm:text-[10px]",
                                                    status?.points >= item.cost 
                                                        ? "bg-[rgba(243,236,221,0.05)] hover:bg-amber-500 hover:text-[#171204] border border-[rgba(243,236,221,0.10)]" 
                                                        : "bg-[rgba(243,236,221,0.03)] text-[color:var(--lobby-muted,#8f8674)] cursor-not-allowed"
                                                )}
                                            >
                                                {status?.points >= item.cost ? 'SATIN AL' : 'YETERSİZ'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {activeTab === 'inventory' && (
                        <motion.div
                            key="inventory"
                            role="tabpanel"
                            id="tab-panel-inventory"
                            aria-labelledby="tab-inventory"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex flex-col items-center justify-center rounded-[2rem] border border-[rgba(243,236,221,0.05)] bg-[rgba(243,236,221,0.02)] px-4 py-16 text-center sm:py-20"
                        >
                            <Package size={48} className="text-[color:var(--lobby-muted,#8f8674)] mb-4" aria-hidden="true" />
                            <h3 className="font-black text-[color:var(--lobby-muted,#8f8674)] uppercase">{pageContent.emptyTitle}</h3>
                            <p className="text-xs text-[color:var(--lobby-muted,#8f8674)] font-bold mt-1">{pageContent.emptyDescription}</p>
                            <button type="button" onClick={() => setActiveTab('market')} className="mt-8 text-amber-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-lg px-2 py-1">
                                {pageContent.primaryButton} <ArrowRight size={16} aria-hidden="true" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            <style>{`
                @keyframes slide {
                    from { background-position: 0 0; }
                    to { background-position: 48px 24px; }
                }
            `}</style>
        </div>
    );
}
