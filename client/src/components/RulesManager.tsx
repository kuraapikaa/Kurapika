import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import {
    Settings, AlertCircle, CheckCircle2, Plus,
    Trash2, Edit2, Search, FileCode,
    Info, RefreshCw, Sparkles, ArrowRight, Gift
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardApi } from '../api/client';

interface PromoSpec {
    enabled?: boolean;
    // Basic Info
    type?: 'partner' | 'cash' | 'wheel';
    partnerBonusId?: string;

    // Amount Settings
    amountType?: 'fixed' | 'percentage' | 'full' | 'tiered' | 'tieredRange' | 'tieredPercentage';
    fixedAmount?: number;
    percentageAmount?: number;
    tieredAmounts?: { min: number; bonus: number }[];
    tieredRanges?: { min: number; max: number; bonus: number }[];
    tieredPercentageRanges?: { min: number; max: number; percent: number; maxBonus?: number }[];

    // Automation & Loss Bonus
    isAutoCharge?: boolean;
    isNextDayBonus?: boolean;
    autoGrantNextDayAt0015?: boolean;
    assignmentValues?: Record<string, unknown>;
    freespinBetLevel?: number;
    freespinCount?: number;
    freespinGame?: unknown;
    freespinGameId?: number;
    freespinGameProviderId?: number;
    excludeFromLossCalculations?: boolean;

    // Limits & Rules
    checkPendingWithdrawal?: boolean;
    checkLastTransactionIsDeposit?: boolean;
    checkSingleInvestmentUsage?: boolean;
    checkWheelCodeUsed?: boolean;
    checkSameDayUsage?: boolean;
    requiresPhoneVerified?: boolean;
    requiresTelegramMember?: boolean;
    requiresEmailVerified?: boolean;
    checkIPDuplicate?: boolean;
    allowedProviders?: string[];

    maxKpiLimit?: number;
    newPlayerMaxDeposits?: number;
    maxBalanceToClaim?: number;
    minBalanceToClaim?: number;

    // Constraints
    activeDays?: string[];
    startTime?: string;
    endTime?: string;
    category?: string;

    // Advanced & Limits
    minDep?: number;
    minDepositAmount?: number;
    maxDepositAmount?: number;
    canReceiveLossBonus?: boolean;
    canReceiveWheelBonus?: boolean;
    perDayLimit?: number;
    perWeekLimit?: number;
    isFirstDepositBonus?: boolean;
    onlyNewUsersNoDepositNoWithdraw?: boolean;
    principalWagerMult?: number;
    bonusWagerMult?: number;
    casinoWagering?: number;
    sportWagering?: number;
    minSportOdds?: number;
    maxPayoutMult?: number;
    maxPayoutFixed?: number;
}

interface RulesConfig {
    PROMO_SPECS: Record<string, PromoSpec>;
    PROMO_TITLE_SPECS: Record<string, PromoSpec>;
}

export function RulesManager() {
    const queryClient = useQueryClient();
    const activeTab = 'id';
    const [searchTerm, setSearchTerm] = useState('');
    const [editKey, setEditKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<PromoSpec | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newType, setNewType] = useState<'partner' | 'cash'>('partner');

    const { data: partnerBonusesRes } = useQuery({
        queryKey: ['partner-bonuses-list'],
        queryFn: () => dashboardApi.partnerBonusList({}),
        staleTime: 10 * 60 * 1000,
    });

    const { data: freebetsRes } = useQuery({
        queryKey: ['freebets-list'],
        queryFn: async () => {
            const res = await fetch('/api/admin/bonus/freebets');
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
    });

    const { data: promosAutoRes } = useQuery({
        queryKey: ['promos-auto-list'],
        queryFn: async () => {
            const res = await fetch('/api/promos/auto?includeUnconfigured=true');
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
    });

    const promos: any[] = useMemo(() => {
        const rowsFrom = (response: any): any[] => {
            const root = response?.Data ?? response?.Result ?? response;
            if (Array.isArray(root)) return root;
            if (Array.isArray(root?.Objects)) return root.Objects;
            if (Array.isArray(root?.Result)) return root.Result;
            return [];
        };
        const normalize = (bonus: any) => {
            const partnerBonusId = bonus?.PartnerBonusId ?? bonus?.CampaignId ?? bonus?.campaignId ?? null;
            return {
                ...bonus,
                Id: partnerBonusId ?? bonus?.Id ?? bonus?.ExternalId ?? bonus?.id ?? bonus?.templateId,
                PartnerBonusId: partnerBonusId,
                IsAssignable: bonus?.IsAssignable ?? partnerBonusId != null,
                Name: bonus?.Name ?? bonus?.title ?? bonus?.systemName ?? bonus?.name ?? 'Adsız Lynon Bonusu',
                lynonSource: bonus?.Type?.Name ?? bonus?.source ?? null,
                lynonParameters: bonus?.bonusBlocksConfiguration ?? bonus?.parameters ?? null,
            };
        };
        const partnerBonuses = rowsFrom(partnerBonusesRes).map(normalize);
        const freebets = rowsFrom(freebetsRes).map(normalize);
        const siteBonuses = rowsFrom(promosAutoRes?.Data?.promotions).map((p: any) => normalize({
            ...p,
            Id: p.backofficeId ?? p.platformBonusDefinitionId ?? p.id,
            Name: p.promoTitle ?? p.title,
            lynonParameters: p.rules,
        }));
        const unique = new Map<string, any>();
        [...partnerBonuses, ...freebets, ...siteBonuses].forEach((bonus) => {
            if (bonus.Id != null && String(bonus.Id).trim() !== '' && !unique.has(String(bonus.Id))) {
                unique.set(String(bonus.Id), bonus);
            }
        });
        return Array.from(unique.values());
    }, [partnerBonusesRes, freebetsRes, promosAutoRes]);

    console.log('[RulesManager] Yüklenen Toplam Promosyon Sayısı:', promos.length);

    const normalizeTitleForKey = (s: string): string =>
        String(s ?? '')
            .toLowerCase()
            .replace(/%/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    const promoTitleByExternalId = useMemo(() => {
        const m = new Map<number, string>();
        for (const p of promos) {
            const id = p.Id != null && String(p.Id).trim() !== '' ? Number(p.Id) : NaN;
            if (Number.isFinite(id)) m.set(id, p.Name);
        }
        return m;
    }, [promos]);

    const promoTitleByNormalizedTitle = useMemo(() => {
        const m = new Map<string, string>();
        for (const p of promos) {
            const k = normalizeTitleForKey(p.Name);
            if (k) m.set(k, p.Name);
        }
        return m;
    }, [promos]);

    const getPromoTitleForRuleKey = (key: string): string | null => {
        const k = String(key ?? '').trim();
        if (!k) return null;
        if (activeTab === 'id') {
            // Find by exact string match or numeric match
            const match = promos.find(p => String(p.Id).trim() === k);
            return match ? match.Name : null;
        }
        const norm = normalizeTitleForKey(k);
        if (!norm) return null;
        return promoTitleByNormalizedTitle.get(norm) ?? null;
    };

    const addOptions = useMemo(() => {
        if (!promos || promos.length === 0) return [];
        if (activeTab === 'id') {
            return promos
                .map((p) => {
                    const partnerId = p.PartnerBonusId != null && String(p.PartnerBonusId).trim() !== ''
                        ? Number(p.PartnerBonusId)
                        : undefined;
                    return {
                        value: partnerId != null && Number.isFinite(partnerId) ? String(partnerId) : '',
                        label: `${p.Name}${partnerId != null && Number.isFinite(partnerId) ? ` — Partner Bonus ID: ${partnerId}` : ' — Atanabilir kampanya ID bulunamadı'}`,
                        disabled: !(partnerId != null && Number.isFinite(partnerId)),
                    };
                })
                .filter((o) => o.value);
        }
        return promos
            .map((p) => {
                const key = normalizeTitleForKey(p.Name);
                return {
                    value: key,
                    label: p.Name,
                    disabled: !key,
                };
            })
                .filter((o) => o.value);
    }, [promos, activeTab]);

    const selectedBonusLabel = useMemo(() => {
        const key = String(newKey ?? '').trim();
        if (!key) return null;
        if (activeTab === 'id') {
            const id = Number(key);
            if (!Number.isFinite(id)) return null;
            return promoTitleByExternalId.get(id) ?? null;
        }
        // title mode: key is normalized title key
        const k = normalizeTitleForKey(key);
        return promoTitleByNormalizedTitle.get(k) ?? null;
    }, [newKey, activeTab, promoTitleByExternalId, promoTitleByNormalizedTitle]);

    const { data: config, isLoading } = useQuery<RulesConfig>({
        queryKey: ['admin-rules'],
        queryFn: async () => {
            const res = await fetch('/api/admin/rules');
            return res.json();
        },
    });

    const mutation = useMutation({
        mutationFn: async (newConfig: RulesConfig) => {
            const res = await fetch('/api/admin/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig),
            });
            const json = await res.json();
            if (!res.ok || json?.HasError) throw new Error(json?.AlertMessage || 'Kurallar kaydedilemedi');
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-rules'] });
            toast.success('Kural motoru güncellendi', {
                icon: <Sparkles size={16} className="text-emerald-400" />,
                style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' }
            });
            setEditKey(null);
            setIsAdding(false);
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Güncelleme sırasında hata oluştu');
        },
    });

    const handleUpdateRule = (key: string, spec: PromoSpec) => {
        if (!config) return;
        const newConfig = { ...config };
        const targetMap = activeTab === 'id' ? 'PROMO_SPECS' : 'PROMO_TITLE_SPECS';
        newConfig[targetMap] = { ...newConfig[targetMap], [key]: spec };
        mutation.mutate(newConfig);
    };

    const handleDeleteRule = (key: string) => {
        if (!config || !window.confirm(`${key} kuralını silmek istediğinize emin misiniz?`)) return;
        const newConfig = { ...config };
        const targetMap = activeTab === 'id' ? 'PROMO_SPECS' : 'PROMO_TITLE_SPECS';
        const updatedMap = { ...newConfig[targetMap] };
        delete updatedMap[key];
        newConfig[targetMap] = updatedMap;
        mutation.mutate(newConfig);
    };

    const handleAddRule = () => {
        if (!newKey.trim()) {
            toast.error('Giriş geçersiz');
            return;
        }
        handleUpdateRule(newKey.trim(), { type: newType, partnerBonusId: newType === 'partner' ? newKey.trim() : undefined, enabled: true });
        setNewKey('');
        setIsAdding(false);
    };

    const filteredRules = useMemo<Array<[string, PromoSpec]>>(() => {
        if (!config) return [];
        const source = activeTab === 'id' ? config.PROMO_SPECS : config.PROMO_TITLE_SPECS;
        const merged = new Map<string, PromoSpec>(Object.entries(source) as Array<[string, PromoSpec]>);

        // Lynon kataloğundaki her kampanya, henüz kural kaydı olmasa da görünür.
        if (activeTab === 'id') {
            for (const promo of promos) {
                const partnerBonusId = String(promo?.PartnerBonusId ?? '').trim();
                if (!partnerBonusId || merged.has(partnerBonusId)) continue;
                merged.set(partnerBonusId, {
                    enabled: false,
                    type: 'partner',
                    partnerBonusId,
                });
            }
        }

        const needle = searchTerm.toLocaleLowerCase('tr-TR').trim();
        return Array.from(merged.entries())
            .filter(([key]) => {
                if (!needle) return true;
                const title = getPromoTitleForRuleKey(key) ?? '';
                return `${key} ${title}`.toLocaleLowerCase('tr-TR').includes(needle);
            })
            .sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0], 'tr'));
    }, [config, activeTab, searchTerm, promos, promoTitleByNormalizedTitle]);

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center p-40 space-y-4">
            <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest animate-pulse">Sistem Yükleniyor</p>
        </div>
    );

    return (
        <div className="max-w-[1400px] mx-auto space-y-10 py-6 animate-in fade-in duration-700">
            {/* Premium Header */}
            <header className="relative overflow-hidden rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] p-8 md:p-12">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-blue-500/10 blur-[100px]" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 p-[1px] shadow-lg shadow-blue-500/20">
                            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">
                                <Settings className="text-white" size={24} />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-4xl font-semibold tracking-tighter text-white md:text-5xl">
                                Kural <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-400 to-cyan-400">Merkezi</span>
                            </h1>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="h-1 w-8 rounded-full bg-blue-500" />
                                <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.3em]">Advanced Neural Logic Engine</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-rules'] })}
                            className="group flex items-center justify-center h-12 w-12 rounded-xl bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:bg-white/10 transition-all active:scale-95"
                        >
                            <RefreshCw size={20} className={cn("text-[color:var(--panel-muted,#8a919c)] group-hover:text-white transition-colors", mutation.isPending && "animate-spin")} />
                        </button>
                        <Button
                            variant="primary"
                            onClick={() => setIsAdding(!isAdding)}
                            className="h-12 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-xl shadow-blue-500/20 border-none font-semibold tracking-widest text-xs"
                        >
                            <Plus size={18} className="mr-2" /> YENİ KURAL EKLE
                        </Button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <div className="lg:col-span-9 space-y-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--panel-muted,#8a919c)] group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Kural veya ID ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-14 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] backdrop-blur-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl pl-12 pr-4 text-sm text-white placeholder:text-[color:var(--panel-faint,#5c6470)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/20 transition-all font-bold"
                            />
                        </div>
                    </div>

                    <AnimatePresence>
                        {isAdding && (
                            <motion.div
                                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                className="relative group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent blur-2xl rounded-xl" />
                                <div className="relative p-8 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-blue-500/20 shadow-2xl overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Plus size={80} className="text-blue-500" />
                                    </div>
                                    <div className="relative z-10 flex flex-col gap-8">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                <Plus size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-white uppercase tracking-tight">YENİ BONUS KURALI TANIMLA</h3>
                                                <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em]">{activeTab === 'id' ? 'Platform ID Bazlı Mapping' : 'Başlık Bazlı Mapping'}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Tür Seçimi */}
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest ml-1">Bonus Tipi (Hangi yöntemle eklenecek?)</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => setNewType('partner')}
                                                        className={cn(
                                                            "flex items-center justify-center gap-2 h-14 rounded-xl border font-semibold text-[11px] transition-all uppercase tracking-widest",
                                                            newType === 'partner'
                                                                ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                                                                : "bg-black/20 border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[color:var(--panel-muted,#8a919c)] hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))]"
                                                        )}
                                                    >
                                                        <Gift size={16} /> Platform Bonusu
                                                    </button>
                                                    <button
                                                        onClick={() => setNewType('cash')}
                                                        className={cn(
                                                            "flex items-center justify-center gap-2 h-14 rounded-xl border font-semibold text-[11px] transition-all uppercase tracking-widest",
                                                            newType === 'cash'
                                                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                                : "bg-black/20 border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[color:var(--panel-muted,#8a919c)] hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))]"
                                                        )}
                                                    >
                                                        <Sparkles size={16} /> Nakit Ekleme
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest ml-1">
                                                    {newType === 'partner' ? 'Platform Bonus ID' : 'Referans ID / Tanımlayıcı'}
                                                </label>
                                                {newType === 'partner' ? (
                                                    <select
                                                        value={newKey}
                                                        onChange={(e) => setNewKey(e.target.value)}
                                                        className="w-full h-16 bg-black/40 border border-[color:var(--panel-accent,#0a84ff)]/25 rounded-xl px-5 text-sm text-white focus:outline-none focus:border-[color:var(--panel-accent,#0a84ff)]/70 transition-all font-semibold"
                                                    >
                                                        <option value="">Lynon kampanyası seçin ({promos.length})</option>
                                                        {addOptions.map((option) => (
                                                            <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={newKey}
                                                        onChange={(e) => setNewKey(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
                                                        placeholder="Bir isim veya ID girin"
                                                        className="w-full h-16 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-6 text-lg text-white placeholder:text-[color:var(--panel-faint,#5c6470)] focus:outline-none focus:border-[color:var(--panel-accent,#0a84ff)]/50 transition-all font-semibold"
                                                    />
                                                )}
                                                <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-bold ml-1 uppercase tracking-wider">
                                                    {newType === 'partner'
                                                        ? 'Lynon’dan gelen aktif kampanyayı seçin; kampanya blok ve şablon parametreleri atama anında Lynon’dan okunur.'
                                                        : 'Kuralı tanımlamak için kullanılacak benzersiz bir anahtar girin.'}
                                                </p>
                                            </div>
                                        </div>

                                        {selectedBonusLabel && (
                                            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3">
                                                <CheckCircle2 size={16} className="text-emerald-500" />
                                                <p className="text-sm font-semibold text-emerald-400">Hedef Bonus: {selectedBonusLabel}</p>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                            <button onClick={() => setIsAdding(false)} className="px-8 py-3 text-[11px] font-semibold text-[color:var(--panel-muted,#8a919c)] hover:text-white transition-colors">İPTAL</button>
                                            <Button variant="primary" onClick={handleAddRule} className="h-12 px-12 rounded-xl bg-[color:var(--panel-accent,#0a84ff)] text-white font-semibold text-[11px] shadow-2xl border-none hover:bg-[color:var(--panel-accent-deep,#0060df)]">KURALI OLUŞTUR</Button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="grid grid-cols-1 gap-4">
                        {filteredRules.map(([key, spec]) => (
                            <div
                                key={key}
                                className={cn(
                                    "relative rounded-xl border transition-all duration-300",
                                    editKey === key
                                        ? "bg-blue-500/5 border-blue-500/50 p-8"
                                        : "bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))] p-6 md:px-8 group"
                                )}
                            >
                                <AnimatePresence mode="wait">
                                    {editKey === key ? (
                                        <motion.div key="edit" initial={{ opacity: 0, scale: 0.99, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="space-y-12">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                <div className="flex items-center gap-5">
                                                    <div className="h-16 w-16 rounded-[20px] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex items-center justify-center text-blue-400 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
                                                        <FileCode size={32} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="text-3xl font-semibold text-white tracking-tighter">{key}</h3>
                                                            {spec.enabled === false && <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[9px] font-semibold border border-rose-500/20 uppercase tracking-widest">Pasif</span>}
                                                        </div>
                                                         {getPromoTitleForRuleKey(key) && (
                                                            <div className="text-sm font-bold text-emerald-400/90 flex items-center gap-2">
                                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                                {getPromoTitleForRuleKey(key)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => setEditKey(null)}
                                                        className="px-6 py-3 rounded-xl bg-white/5 text-[11px] font-semibold text-[color:var(--panel-muted,#8a919c)] hover:text-white transition-all uppercase tracking-widest"
                                                    >
                                                        İPTAL
                                                    </button>
                                                    <Button
                                                        variant="primary"
                                                        onClick={() => handleUpdateRule(key, editValue!)}
                                                        className="h-12 px-10 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 font-semibold text-[11px] border-none shadow-xl shadow-blue-500/10 uppercase tracking-widest"
                                                        disabled={mutation.isPending}
                                                    >
                                                        {mutation.isPending ? 'KAYDEDİLİYOR...' : 'KURALI GÜNCELLE'}
                                                    </Button>
                                                </div>
                                            </div>
                                            {/* Advanced Rule Engine Sections */}
                                            <div className="space-y-8">
                                                {/* Section: Type & Amount */}
                                                <div className="space-y-4">
                                                    <h4 className="text-[10px] font-semibold text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                        Tür & Tutar Ayarları
                                                    </h4>
                                                    <div className="mb-4">
                                                        <ToggleField
                                                            label="Kural Durumu"
                                                            description="Bu bonusun uygunluk kontrollerinde ve ödül atamalarında kullanılmasını belirler."
                                                            value={editValue?.enabled}
                                                            onChange={(value) => setEditValue({ ...editValue, enabled: value })}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Bonus Tipi</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Bonusun hangi mekanizma ile ekleneceğini belirler.</p>
                                                            <select
                                                                value={editValue?.type ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, type: e.target.value as any })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all outline-none font-bold"
                                                            >
                                                                <option value="">Seçiniz...</option>
                                                                <option value="partner">Partner Bonus</option>
                                                                <option value="cash">Nakit Ekleme</option>
                                                            </select>
                                                        </div>
                                                        {editValue?.type === 'partner' && (
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Partner Bonus ID</label>
                                                                <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Backoffice üzerindeki bonusun benzersiz tanımlayıcısı.</p>
                                                                <input
                                                                    type="text"
                                                                    value={editValue?.partnerBonusId ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, partnerBonusId: e.target.value })}
                                                                    className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all outline-none font-bold"
                                                                    placeholder="Örn: 656569"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Tutar Tipi</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Eklenecek miktarın nasıl hesaplanacağını seçin.</p>
                                                            <select
                                                                value={editValue?.amountType ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, amountType: e.target.value as any })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all outline-none font-bold"
                                                            >
                                                                <option value="">Seçiniz...</option>
                                                                <option value="fixed">Sabit Tutar</option>
                                                                <option value="percentage">Yatırım Yüzdesi</option>
                                                                <option value="full">Tam Yatırım</option>
                                                                <option value="tiered">Baremli Tutar</option>
                                                                <option value="tieredRange">Baremli Yatırım Aralığı</option>
                                                                <option value="tieredPercentage">Yüzdeli Yatırım Baremi Aralığı</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                        {editValue?.amountType === 'fixed' && (
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Sabit Tutar (₺)</label>
                                                                <input
                                                                    type="number"
                                                                    value={editValue?.fixedAmount ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, fixedAmount: Number(e.target.value) })}
                                                                    className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all outline-none font-bold"
                                                                />
                                                            </div>
                                                        )}
                                                        {editValue?.amountType === 'percentage' && (
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Yüzde (%)</label>
                                                                <input
                                                                    type="number"
                                                                    value={editValue?.percentageAmount ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, percentageAmount: Number(e.target.value) })}
                                                                    className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all outline-none font-bold"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {editValue?.amountType === 'tiered' && (
                                                        <div className="p-4 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Barem Ayarları</label>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setEditValue({ ...editValue, tieredAmounts: [...(editValue?.tieredAmounts || []), { min: 0, bonus: 0 }] })}
                                                                    className="text-[10px] h-7 px-3"
                                                                >
                                                                    + Barem Ekle
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(editValue.tieredAmounts || []).map((tier, idx) => (
                                                                    <div key={idx} className="flex gap-2 items-center">
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Min Yatırım"
                                                                            value={tier.min}
                                                                            onChange={(e) => {
                                                                                const newTiers = [...(editValue.tieredAmounts || [])];
                                                                                newTiers[idx].min = Number(e.target.value);
                                                                                setEditValue({ ...editValue, tieredAmounts: newTiers });
                                                                            }}
                                                                            className="flex-1 h-10 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 text-xs text-white"
                                                                        />
                                                                        <ArrowRight size={14} className="text-[color:var(--panel-faint,#5c6470)]" />
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Bonus"
                                                                            value={tier.bonus}
                                                                            onChange={(e) => {
                                                                                const newTiers = [...(editValue.tieredAmounts || [])];
                                                                                newTiers[idx].bonus = Number(e.target.value);
                                                                                setEditValue({ ...editValue, tieredAmounts: newTiers });
                                                                            }}
                                                                            className="flex-1 h-10 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 text-xs text-white"
                                                                        />
                                                                        <button
                                                                            onClick={() => {
                                                                                const newTiers = (editValue.tieredAmounts || []).filter((_, i) => i !== idx);
                                                                                setEditValue({ ...editValue, tieredAmounts: newTiers });
                                                                            }}
                                                                            className="p-2 text-[color:var(--panel-muted,#8a919c)] hover:text-rose-500"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {editValue?.amountType === 'tieredRange' && (
                                                        <div className="p-4 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Yatırım Aralığı Ayarları</label>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setEditValue({ ...editValue, tieredRanges: [...(editValue?.tieredRanges || []), { min: 0, max: 0, bonus: 0 }] })}
                                                                    className="text-[10px] h-7 px-3"
                                                                >
                                                                    + Aralık Ekle
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(editValue.tieredRanges || []).map((range, idx) => (
                                                                    <div key={idx} className="flex gap-2 items-center">
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Min Yatırım"
                                                                            value={range.min}
                                                                            onChange={(e) => {
                                                                                const newRanges = [...(editValue.tieredRanges || [])];
                                                                                newRanges[idx] = { ...newRanges[idx], min: Number(e.target.value) };
                                                                                setEditValue({ ...editValue, tieredRanges: newRanges });
                                                                            }}
                                                                            className="flex-1 h-10 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 text-xs text-white"
                                                                        />
                                                                        <ArrowRight size={14} className="text-[color:var(--panel-faint,#5c6470)]" />
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Max Yatırım"
                                                                            value={range.max}
                                                                            onChange={(e) => {
                                                                                const newRanges = [...(editValue.tieredRanges || [])];
                                                                                newRanges[idx] = { ...newRanges[idx], max: Number(e.target.value) };
                                                                                setEditValue({ ...editValue, tieredRanges: newRanges });
                                                                            }}
                                                                            className="flex-1 h-10 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 text-xs text-white"
                                                                        />
                                                                        <ArrowRight size={14} className="text-[color:var(--panel-faint,#5c6470)]" />
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Bonus"
                                                                            value={range.bonus}
                                                                            onChange={(e) => {
                                                                                const newRanges = [...(editValue.tieredRanges || [])];
                                                                                newRanges[idx] = { ...newRanges[idx], bonus: Number(e.target.value) };
                                                                                setEditValue({ ...editValue, tieredRanges: newRanges });
                                                                            }}
                                                                            className="flex-1 h-10 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 text-xs text-white"
                                                                        />
                                                                        <button
                                                                            onClick={() => {
                                                                                const newRanges = (editValue.tieredRanges || []).filter((_, i) => i !== idx);
                                                                                setEditValue({ ...editValue, tieredRanges: newRanges });
                                                                            }}
                                                                            className="p-2 text-[color:var(--panel-muted,#8a919c)] hover:text-rose-500"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {editValue?.amountType === 'tieredPercentage' && (
                                                        <div className="p-4 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Yüzdeli Yatırım Baremi Aralığı</label>
                                                                    <p className="mt-1 pl-1 text-[10px] text-[color:var(--panel-faint,#5c6470)]">Yatırım aralığa düşerse bonus, sabit tutar yerine yatırımın yüzdesi olarak hesaplanır. Tavan boş bırakılırsa sınır uygulanmaz.</p>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setEditValue({ ...editValue, tieredPercentageRanges: [...(editValue?.tieredPercentageRanges || []), { min: 0, max: 0, percent: 0 }] })}
                                                                    className="text-[10px] h-7 px-3 shrink-0"
                                                                >
                                                                    + Aralık Ekle
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(editValue.tieredPercentageRanges || []).map((range, idx) => {
                                                                    const update = (patch: Partial<{ min: number; max: number; percent: number; maxBonus?: number }>) => {
                                                                        const next = [...(editValue.tieredPercentageRanges || [])];
                                                                        next[idx] = { ...next[idx], ...patch };
                                                                        setEditValue({ ...editValue, tieredPercentageRanges: next });
                                                                    };
                                                                    return (
                                                                        <div key={idx} className="flex gap-2 items-center">
                                                                            <input
                                                                                type="number"
                                                                                placeholder="Min Yatırım"
                                                                                value={range.min}
                                                                                onChange={(e) => update({ min: Number(e.target.value) })}
                                                                                className="flex-1 h-10 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 text-xs text-white"
                                                                            />
                                                                            <ArrowRight size={14} className="text-[color:var(--panel-faint,#5c6470)] shrink-0" />
                                                                            <input
                                                                                type="number"
                                                                                placeholder="Max Yatırım"
                                                                                value={range.max}
                                                                                onChange={(e) => update({ max: Number(e.target.value) })}
                                                                                className="flex-1 h-10 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 text-xs text-white"
                                                                            />
                                                                            <ArrowRight size={14} className="text-[color:var(--panel-faint,#5c6470)] shrink-0" />
                                                                            <div className="relative flex-1">
                                                                                <input
                                                                                    type="number"
                                                                                    placeholder="Yüzde"
                                                                                    value={range.percent}
                                                                                    onChange={(e) => update({ percent: Number(e.target.value) })}
                                                                                    className="w-full h-10 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl pl-6 pr-3 text-xs text-white"
                                                                                />
                                                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-400">%</span>
                                                                            </div>
                                                                            <input
                                                                                type="number"
                                                                                placeholder="Tavan (ops.)"
                                                                                value={range.maxBonus ?? ''}
                                                                                onChange={(e) => update({ maxBonus: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                                                className="flex-1 h-10 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 text-xs text-white"
                                                                            />
                                                                            <button
                                                                                onClick={() => setEditValue({ ...editValue, tieredPercentageRanges: (editValue.tieredPercentageRanges || []).filter((_, i) => i !== idx) })}
                                                                                className="p-2 text-[color:var(--panel-muted,#8a919c)] hover:text-rose-500 shrink-0"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Lynon F: Process FreeSpin */}
                                                <div className="space-y-4 pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                    <div>
                                                        <h4 className="text-[10px] font-semibold text-amber-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                                            Freespin / F: Process FreeSpin
                                                        </h4>
                                                        <p className="mt-1 text-[10px] text-[color:var(--panel-faint,#5c6470)]">Bet Level ve Count ile birlikte Game ID ve Provider ID zorunludur. Lynon bu değerleri F: Process FreeSpin bloğuna gönderir.</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                                        <label className="space-y-2">
                                                            <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">Bet Level*</span>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                step={1}
                                                                value={editValue?.freespinBetLevel ?? ''}
                                                                onChange={(event) => setEditValue({ ...editValue, freespinBetLevel: event.target.value === '' ? undefined : Number(event.target.value) })}
                                                                placeholder="Örn. 1"
                                                                className="h-10 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/40 px-3 text-xs text-white outline-none focus:border-amber-400/40"
                                                            />
                                                        </label>
                                                        <label className="space-y-2">
                                                            <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">Count*</span>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                step={1}
                                                                value={editValue?.freespinCount ?? ''}
                                                                onChange={(event) => setEditValue({ ...editValue, freespinCount: event.target.value === '' ? undefined : Number(event.target.value) })}
                                                                placeholder="Örn. 100"
                                                                className="h-10 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/40 px-3 text-xs text-white outline-none focus:border-amber-400/40"
                                                            />
                                                        </label>
                                                        <label className="space-y-2">
                                                            <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">Game ID*</span>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                step={1}
                                                                value={editValue?.freespinGameId ?? (editValue?.freespinGame as any)?.id ?? (editValue?.freespinGame as any)?.Id ?? ''}
                                                                onChange={(event) => setEditValue({ ...editValue, freespinGameId: event.target.value === '' ? undefined : Number(event.target.value) })}
                                                                placeholder="Örn. 195202"
                                                                className="h-10 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/40 px-3 text-xs text-white outline-none focus:border-amber-400/40"
                                                            />
                                                        </label>
                                                        <label className="space-y-2">
                                                            <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">Provider ID*</span>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                step={1}
                                                                value={editValue?.freespinGameProviderId ?? (editValue?.freespinGame as any)?.providerId ?? (editValue?.freespinGame as any)?.ProviderId ?? ''}
                                                                onChange={(event) => setEditValue({ ...editValue, freespinGameProviderId: event.target.value === '' ? undefined : Number(event.target.value) })}
                                                                placeholder="Örn. 1"
                                                                className="h-10 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/40 px-3 text-xs text-white outline-none focus:border-amber-400/40"
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                                {/* Section: Automation & Rules */}
                                                <div className="space-y-4 pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                    <h4 className="text-[10px] font-semibold text-rose-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                                        Otomasyon Ayarları
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        <ToggleField
                                                            label="Otomatik Ekleme"
                                                            description="Onay gerektirmeden direkt platforma eklenir."
                                                            value={editValue?.isAutoCharge}
                                                            onChange={(v) => setEditValue({ ...editValue, isAutoCharge: v })}
                                                        />
                                                        <ToggleField
                                                            label="Ertesi gün bonusu mu?"
                                                            description="Uygunluğu ve bonus tutarını Türkiye saatine göre bir önceki günün başarılı yatırımları toplamından hesaplar."
                                                            value={editValue?.isNextDayBonus}
                                                            onChange={(v) => setEditValue({ ...editValue, isNextDayBonus: v, autoGrantNextDayAt0015: v ? editValue?.autoGrantNextDayAt0015 : false })}
                                                        />
                                                        <ToggleField
                                                            label="00:15'te Otomatik Ekle"
                                                            description="Ertesi gün 00:15'te uygun üyeleri Lynon'da kontrol eder ve ödülü idempotent olarak yalnızca bir kez tanımlar."
                                                            value={editValue?.autoGrantNextDayAt0015}
                                                            onChange={(v) => setEditValue({ ...editValue, isNextDayBonus: v ? true : editValue?.isNextDayBonus, autoGrantNextDayAt0015: v })}
                                                        />                                                        <ToggleField
                                                            label="Kayıp Hesabından Hariç Tut"
                                                            description="Bu bonus için kullanılan yatırımlar kayıp hesabına dahil edilmez."
                                                            value={editValue?.excludeFromLossCalculations}
                                                            onChange={(v) => setEditValue({ ...editValue, excludeFromLossCalculations: v })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Section: Rule Engine Switches */}
                                                <div className="space-y-4 pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                    <h4 className="text-[10px] font-semibold text-sky-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                                        Bağımsız Kural Kontrolleri
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        <ToggleField
                                                            label="Açıkta Çekim Kontrolü"
                                                            description="Bekleyen çekim talebi olan kullanıcıları reddeder."
                                                            value={editValue?.checkPendingWithdrawal}
                                                            onChange={(v) => setEditValue({ ...editValue, checkPendingWithdrawal: v })}
                                                        />
                                                        <ToggleField
                                                            label="Son Yatırım Kontrolü"
                                                            description="Kullanıcının son işleminin yatırım olmasını zorunlu kılar."
                                                            value={editValue?.checkLastTransactionIsDeposit}
                                                            onChange={(v) => setEditValue({ ...editValue, checkLastTransactionIsDeposit: v })}
                                                        />
                                                        <ToggleField
                                                            label="Yatırım ID Takibi"
                                                            description="Bir yatırımın yalnızca bir kez bonus için kullanılmasını sağlar."
                                                            value={editValue?.checkSingleInvestmentUsage}
                                                            onChange={(v) => setEditValue({ ...editValue, checkSingleInvestmentUsage: v })}
                                                        />
                                                        <ToggleField
                                                            label="Aynı Gün Tekrar Alamaz"
                                                            description="Kullanıcının aynı gün içerisinde bu kuralı 2. kez kullanmasını engeller."
                                                            value={editValue?.checkSameDayUsage}
                                                            onChange={(v) => setEditValue({ ...editValue, checkSameDayUsage: v })}
                                                        />
                                                        <ToggleField
                                                            label="Sadece İşlem Görmemiş Üyeler"
                                                            description="Sadece hiç yatırımı, çekimi ve bahsi olmayan 'bakir' üyeler yararlanabilir."
                                                            value={editValue?.onlyNewUsersNoDepositNoWithdraw}
                                                            onChange={(v) => setEditValue({ ...editValue, onlyNewUsersNoDepositNoWithdraw: v })}
                                                        />
                                                        <ToggleField
                                                            label="Telefon Numarası Onayı Zorunlu"
                                                            description="Yalnızca telefon numarası onaylı kullanıcılar bu bonustan yararlanabilir."
                                                            value={editValue?.requiresPhoneVerified}
                                                            onChange={(v) => setEditValue({ ...editValue, requiresPhoneVerified: v })}
                                                        />
                                                        <ToggleField
                                                            label="Telegram Kanal Üyeliği Zorunlu"
                                                            description="Bonus verilmeden önce oyuncunun Telegram kanalına üyeliği canlı sorgulanır. Hesabını bağlamamış veya kanaldan ayrılmış oyuncu alamaz."
                                                            value={editValue?.requiresTelegramMember}
                                                            onChange={(v) => setEditValue({ ...editValue, requiresTelegramMember: v })}
                                                        />
                                                        <ToggleField
                                                            label="E-posta Onayı Zorunlu"
                                                            description="Yalnızca e-posta adresi onaylı kullanıcılar bu bonustan yararlanabilir."
                                                            value={editValue?.requiresEmailVerified}
                                                            onChange={(v) => setEditValue({ ...editValue, requiresEmailVerified: v })}
                                                        />
                                                        <ToggleField
                                                            label="Aynı IP Kontrolü"
                                                            description="Son giriş IP'sini paylaşan başka bir hesap varsa bonusu reddeder (çoklu hesap şüphesi)."
                                                            value={editValue?.checkIPDuplicate}
                                                            onChange={(v) => setEditValue({ ...editValue, checkIPDuplicate: v })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Section: Limits */}
                                                <div className="space-y-4 pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                    <h4 className="text-[10px] font-semibold text-amber-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                        Gelişmiş Limitler
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Min Bakiye Limiti</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Bonus talebi anındaki minimum bakiye sınırı.</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.minBalanceToClaim ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, minBalanceToClaim: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="N/A"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Max Bakiye Limiti</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Bonus talebi anındaki maksimum bakiye sınırı.</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.maxBalanceToClaim ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, maxBalanceToClaim: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="N/A"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section: Wager & Payout Rules */}
                                                <div className="space-y-4 pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                    <h4 className="text-[10px] font-semibold text-amber-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                        Çevrim & Ödeme Kuralları
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Ana Para Çevrimi</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Anaparanın kaç katı çevrilmeli?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.principalWagerMult ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, principalWagerMult: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="0 (çevrim şartı yok)"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Bonus Çevrimi</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Bonusun kaç katı çevrilmeli?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.bonusWagerMult ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, bonusWagerMult: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="0 (Çevrimsiz)"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Ürün Çevrimi — Casino</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Otomatik çekim onayında casino bahisleri için ayrı çarpan.</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.casinoWagering ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, casinoWagering: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="Kullanılmıyor"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Ürün Çevrimi — Spor</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Otomatik çekim onayında spor bahisleri için ayrı çarpan.</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.sportWagering ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, sportWagering: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="Kullanılmıyor"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Spor Kuponu Şartı (Min Oran)</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Otomatik çekim onayında en az bu orana sahip bir kupon aranır.</p>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={editValue?.minSportOdds ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, minSportOdds: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="Kullanılmıyor"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Kazanç Çarpanı (Max)</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Bonusun max kaç katı çekilebilir?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.maxPayoutMult ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, maxPayoutMult: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="10 (Örn)"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Sabit Max Kazanç</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Çekilebilecek maksimum net tutar.</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.maxPayoutFixed ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, maxPayoutFixed: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="Sınırsız"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section: Advanced Deposit Limits */}
                                                <div className="space-y-4 pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                    <h4 className="text-[10px] font-semibold text-cyan-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                                                        Gelişmiş Yatırım Limitleri
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Min Yatırım (Aralık)</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Yatırım tutarı en az kaç olmalı?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.minDepositAmount ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, minDepositAmount: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="Alt sınır"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Max Yatırım (Aralık)</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Yatırım tutarı en fazla kaç olmalı?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.maxDepositAmount ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, maxDepositAmount: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="Üst sınır"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Günlük Kullanım</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Bir günde kaç kez alınabilir?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.perDayLimit ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, perDayLimit: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="Sınırsız"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Haftalık Kullanım</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Bir haftada kaç kez alınabilir?</p>
                                                            <input
                                                                type="number"
                                                                value={editValue?.perWeekLimit ?? ''}
                                                                onChange={(e) => setEditValue({ ...editValue, perWeekLimit: Number(e.target.value) })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="Sınırsız"
                                                            />
                                                        </div>
                                                        <div className="space-y-2 md:col-span-2">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">İzin Verilen Sağlayıcılar</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Virgülle ayırın. Boş bırakılırsa tüm sağlayıcılar geçerlidir. Ör: Pragmatic Play, Evolution</p>
                                                            <input
                                                                type="text"
                                                                value={(editValue?.allowedProviders ?? []).join(', ')}
                                                                onChange={(e) => setEditValue({
                                                                    ...editValue,
                                                                    allowedProviders: e.target.value
                                                                        .split(',')
                                                                        .map((p) => p.trim())
                                                                        .filter(Boolean),
                                                                })}
                                                                className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                placeholder="Pragmatic Play"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section: Additional Logic Switches */}
                                                <div className="space-y-4 pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                    <h4 className="text-[10px] font-semibold text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                        Ekstra Kontrol Switchleri
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        <ToggleField
                                                            label="İlk Yatırım Bonusu"
                                                            description="Sadece kullanıcının ilk yatırımı için geçerli kıl."
                                                            value={editValue?.isFirstDepositBonus}
                                                            onChange={(v) => setEditValue({ ...editValue, isFirstDepositBonus: v })}
                                                        />
                                                        <ToggleField
                                                            label="Kayıp Bonusu Alabilir"
                                                            description="Bu bonusu alan kullanıcılar kayıp bonusundan da yararlanabilsin mi?"
                                                            value={editValue?.canReceiveLossBonus}
                                                            onChange={(v) => setEditValue({ ...editValue, canReceiveLossBonus: v })}
                                                        />
                                                        <ToggleField
                                                            label="Wheel Bonus Alabilir"
                                                            description="Bu bonusu alan kullanıcılar şans çarkından da yararlanabilsin mi?"
                                                            value={editValue?.canReceiveWheelBonus}
                                                            onChange={(v) => setEditValue({ ...editValue, canReceiveWheelBonus: v })}
                                                        />
                                                    </div>
                                                </div>


                                                {/* Section: Time & Category Constraints */}
                                                <div className="space-y-4 pt-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                    <h4 className="text-[10px] font-semibold text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                        Zaman & Kategori Kısıtlamaları
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-3">
                                                            <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Aktif Günler</label>
                                                            <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium pl-1 mb-1">Bonusun hangi günlerde talep edilebileceğini seçin.</p>
                                                            <div className="grid grid-cols-4 gap-2">
                                                                {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, idx) => {
                                                                    const dayKey = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][idx];
                                                                    const isActive = editValue?.activeDays?.includes(dayKey);
                                                                    return (
                                                                        <button
                                                                            key={day}
                                                                            onClick={() => {
                                                                                const current = editValue?.activeDays || [];
                                                                                const next = current.includes(dayKey)
                                                                                    ? current.filter(d => d !== dayKey)
                                                                                    : [...current, dayKey];
                                                                                setEditValue({ ...editValue, activeDays: next });
                                                                            }}
                                                                            className={cn(
                                                                                "h-10 rounded-xl text-[10px] font-semibold transition-all border",
                                                                                isActive ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] text-[color:var(--panel-faint,#5c6470)] border-[color:var(--panel-border,rgba(242,244,248,0.1))]"
                                                                            )}
                                                                        >
                                                                            {day}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Başlangıç Saati</label>
                                                                <input
                                                                    type="time"
                                                                    value={editValue?.startTime ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, startTime: e.target.value })}
                                                                    className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Bitiş Saati</label>
                                                                <input
                                                                    type="time"
                                                                    value={editValue?.endTime ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, endTime: e.target.value })}
                                                                    className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                />
                                                            </div>
                                                            <div className="col-span-2 space-y-2">
                                                                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Kategori Filtresi</label>
                                                                <input
                                                                    type="text"
                                                                    value={editValue?.category ?? ''}
                                                                    onChange={(e) => setEditValue({ ...editValue, category: e.target.value })}
                                                                    className="w-full h-12 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-xs text-white focus:border-blue-500 transition-all font-bold"
                                                                    placeholder="Örn: Slot, Canlı Casino..."
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>


                                            {activeTab === 'id' && (
                                                <div className="space-y-6">
                                                    <LynonCampaignEditor campaignId={Number(key)} />
                                                    <PromoContentEditor
                                                        externalId={Number(key)}
                                                        promoTitle={getPromoTitleForRuleKey(key) ?? undefined}
                                                    />
                                                </div>
                                            )}                                        </motion.div>
                                    ) : (
                                        <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="space-y-4 flex-1">
                                                <div className="space-y-1">
                                                    <span className="text-lg font-semibold text-white tracking-tight">{key}</span>
                                                    {getPromoTitleForRuleKey(key) && (
                                                        <p className="text-[11px] font-semibold text-emerald-300">
                                                            {getPromoTitleForRuleKey(key)}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-8">
                                                    {spec.type && (
                                                        <div className="space-y-1 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                                            <p className="text-[9px] font-semibold text-blue-500/70 uppercase">Bonus Tipi</p>
                                                            <p className="text-sm font-semibold text-blue-400">
                                                                {spec.type === 'partner' ? `Partner #${spec.partnerBonusId}` : 'Nakit'}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {spec.amountType && (
                                                        <div className="space-y-1 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                                            <p className="text-[9px] font-semibold text-emerald-500/70 uppercase">Tutar Ayarı</p>
                                                            <p className="text-sm font-semibold text-emerald-400">
                                                                {spec.amountType === 'fixed' ? `${spec.fixedAmount}₺ Sabit` :
                                                                 spec.amountType === 'percentage' ? `%${spec.percentageAmount}` :
                                                                 spec.amountType === 'full' ? 'Tam Yatırım' :
                                                                 spec.amountType === 'tieredRange' ? 'Baremli Yatırım Aralığı' :
                                                                 spec.amountType === 'tieredPercentage' ? 'Yüzdeli Barem Aralığı' : 'Baremli'}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div className="space-y-1 p-3 rounded-xl bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                        <p className="text-[9px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase">Kontroller</p>
                                                        <div className="flex gap-1.5 mt-1">
                                                            {spec.checkPendingWithdrawal && <div className="w-2 h-2 rounded-full bg-rose-500" title="Çekim Kontrolü" />}
                                                            {spec.checkLastTransactionIsDeposit && <div className="w-2 h-2 rounded-full bg-amber-500" title="Son İşlem" />}
                                                            {spec.checkSingleInvestmentUsage && <div className="w-2 h-2 rounded-full bg-emerald-500" title="Tekil Yatırım" />}
                                                            {spec.checkWheelCodeUsed && <div className="w-2 h-2 rounded-full bg-blue-500" title="Çark Kontrolü" />}
                                                            {spec.isAutoCharge && <div className="w-2 h-2 rounded-full bg-blue-500" title="Oto Ekleme" />}
                                                        </div>
                                                    </div>
                                                    {spec.maxKpiLimit && <StatItem label="Max KPI" value={spec.maxKpiLimit} unit="TRY" color="rose-400" />}
                                                    {spec.maxBalanceToClaim && <StatItem label="Max Bakiye" value={spec.maxBalanceToClaim} unit="TRY" color="amber-400" />}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                <button
                                                    onClick={() => {
                                                        const linked = promos.find((promo) => String(promo?.PartnerBonusId ?? '') === String(key));
                                                        setEditKey(key);
                                                        setEditValue({ ...spec, partnerBonusId: spec.partnerBonusId ?? (linked?.PartnerBonusId != null ? String(linked.PartnerBonusId) : undefined) });
                                                    }}
                                                    className="h-12 w-12 flex items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-lg"
                                                    title="Düzenle"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRule(key)}
                                                    className="h-12 w-12 flex items-center justify-center rounded-xl bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] hover:bg-rose-500 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[color:var(--panel-muted,#8a919c)] hover:text-white transition-all shadow-lg"
                                                    title="Sil"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-8">
                    <Card className="p-8 border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl group-hover:bg-emerald-500/10 transition-all duration-1000" />
                        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                            <div className="h-20 w-20 rounded-full border-4 border-dashed border-emerald-500/20 flex items-center justify-center bg-emerald-500/5">
                                <CheckCircle2 className="text-emerald-500" size={32} />
                            </div>
                            <div>
                                <h4 className="text-xl font-semibold text-white tracking-tight">Analiz Motoru Aktif</h4>
                                <div className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em] mt-2 italic flex items-center justify-center gap-2">
                                    <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                                    Senkronizasyon Başarılı
                                </div>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-8 border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-blue-500 to-transparent opacity-20" />
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                                <Info size={18} />
                            </div>
                            <h4 className="text-xs font-semibold text-white uppercase tracking-widest">Sistem Rehberi</h4>
                        </div>

                        <div className="space-y-8">
                            <section className="space-y-4">
                                <h5 className="text-[9px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] pb-2">🎯 TEMEL MANTIK</h5>
                                <div className="space-y-3">
                                    <div>
                                        <h6 className="text-[10px] font-bold text-white mb-1">ID Bazlı Mod</h6>
                                        <p className="text-[10px] text-[color:var(--panel-muted,#8a919c)] leading-relaxed font-medium">Promosyonu BetConstruct üzerindeki unik ID'si ile eşleştirir. En güvenli yöntemdir.</p>
                                    </div>
                                    <div>
                                        <h6 className="text-[10px] font-bold text-white mb-1">Başlık Bazlı Mod</h6>
                                        <p className="text-[10px] text-[color:var(--panel-muted,#8a919c)] leading-relaxed font-medium">Gelen bonus başlığını normalize ederek eşleştirir. Dönemsel kampanyalar için uygundur.</p>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h5 className="text-[9px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] pb-2">⚙️ OTOMASYON</h5>
                                <div className="space-y-3">
                                    <div>
                                        <h6 className="text-[10px] font-bold text-white mb-1">Otomatik Ekleme</h6>
                                        <p className="text-[10px] text-[color:var(--panel-muted,#8a919c)] leading-relaxed font-medium">Bu aktifse, analiz motoru onayı verir vermez bonus platforma (BC) direkt eklenir.</p>
                                    </div>
                                    <div>
                                        <h6 className="text-[10px] font-bold text-white mb-1">Baremli Tutar</h6>
                                        <p className="text-[10px] text-[color:var(--panel-muted,#8a919c)] leading-relaxed font-medium">Yatırım tutarına göre kademeli bir bonus verilmesini sağlar. (Örn: 100-500₺ → 50₺ Bonus)</p>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h5 className="text-[9px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] pb-2">🛡️ KRİTİK KONTROLLER</h5>
                                <div className="space-y-3">
                                    <div>
                                        <h6 className="text-[10px] font-bold text-teal-400 mb-1">Single ID Takibi</h6>
                                        <p className="text-[10px] text-[color:var(--panel-muted,#8a919c)] leading-relaxed font-medium">Aynı yatırım fişinin (Deposit ID) birden fazla bonus için kullanılmasını engeller.</p>
                                    </div>
                                    <div>
                                        <h6 className="text-[10px] font-bold text-teal-400 mb-1">Only New Player</h6>
                                        <p className="text-[10px] text-[color:var(--panel-muted,#8a919c)] leading-relaxed font-medium">Sadece sisteme yeni kayıt olmuş ve hiç işlemi olmayan 'saf' üyelerin taleplerini karşılar.</p>
                                    </div>
                                </div>
                            </section>

                            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                <div className="flex gap-3">
                                    <AlertCircle className="text-amber-500 shrink-0" size={16} />
                                    <p className="text-[10px] font-bold text-amber-500/80 leading-relaxed italic">Değişikliklerin sunucuda aktif hale gelmesi yaklaşık 3 saniye sürer.</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function StatItem({ label, value, unit, color }: any) {
    if (value === undefined || value === null) return null;
    return (
        <div className="space-y-1 px-4 py-2 rounded-xl bg-white/[0.02] border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
            <p className="text-[9px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">{label}</p>
            <p className={cn("text-sm font-semibold", color || "text-[color:var(--panel-text-dim,#c8cdd5)]")}>
                {value} <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)] font-bold uppercase">{unit}</span>
            </p>
        </div>
    );
}

function ToggleField({ label, description, value, onChange }: { label: string; description?: string; value: boolean | undefined; onChange: (v: boolean | undefined) => void }) {
    return (
        <div className="group space-y-4 p-6 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:border-blue-500/20 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/5">
            <div className="min-h-[48px]">
                <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] group-hover:text-white uppercase tracking-[0.1em] transition-colors">{label}</p>
                {description && <p className="text-[11px] text-[color:var(--panel-faint,#5c6470)] font-medium mt-2 leading-relaxed line-clamp-2">{description}</p>}
            </div>
            <div className="flex p-1.5 bg-black/60 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] shadow-inner">
                {[
                    { val: true, label: 'EVET', color: 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' },
                    { val: false, label: 'HAYIR', color: 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]' },
                    { val: undefined, label: 'KAPALI', color: 'bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] text-[color:var(--panel-muted,#8a919c)] border border-[color:var(--panel-border,rgba(242,244,248,0.1))]' }
                ].map((opt) => (
                    <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() => onChange(opt.val)}
                        className={cn(
                            "relative flex-1 h-10 rounded-xl text-[10px] font-semibold tracking-widest transition-all duration-500 flex items-center justify-center",
                            value === opt.val ? opt.color : "text-[color:var(--panel-faint,#5c6470)] hover:text-[color:var(--panel-muted,#8a919c)]"
                        )}
                    >
                        {value === opt.val && (
                            <motion.div
                                layoutId={`toggle-glow-${label}`}
                                className={cn("absolute inset-0 rounded-xl z-0", opt.color.split(' ')[0])}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10">{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function LynonCampaignEditor({ campaignId }: { campaignId: number }) {
    const queryClient = useQueryClient();
    const validId = Number.isInteger(campaignId) && campaignId > 0;
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['lynon-campaign-details', campaignId],
        enabled: validId,
        queryFn: async () => {
            const response = await fetch(`/api/admin/bonus/lynon-campaign/${campaignId}`, { credentials: 'include' });
            const json = await response.json();
            if (!response.ok || json?.HasError) throw new Error(json?.AlertMessage || 'Lynon kampanyası okunamadı');
            return json;
        },
        staleTime: 60 * 1000,
    });
    const [campaignJson, setCampaignJson] = useState('{}');
    const [bonusesJson, setBonusesJson] = useState('[]');

    useEffect(() => {
        if (!data?.Data) return;
        setCampaignJson(JSON.stringify(data.Data.campaign ?? {}, null, 2));
        setBonusesJson(JSON.stringify(data.Data.bonuses ?? [], null, 2));
    }, [data]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const campaign = JSON.parse(campaignJson);
            const bonuses = JSON.parse(bonusesJson);
            if (!campaign || typeof campaign !== 'object' || Array.isArray(campaign)) throw new Error('Kampanya JSON nesne olmalı.');
            if (!Array.isArray(bonuses)) throw new Error('Bonus blokları JSON dizisi olmalı.');
            const response = await fetch(`/api/admin/bonus/lynon-campaign/${campaignId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ campaign, bonuses }),
            });
            const json = await response.json();
            if (!response.ok || json?.HasError) throw new Error(json?.AlertMessage || 'Lynon parametreleri kaydedilemedi');
            return json;
        },
        onSuccess: () => {
            toast.success('Lynon kampanya ve bonus blokları güncellendi');
            queryClient.invalidateQueries({ queryKey: ['lynon-campaign-details', campaignId] });
            queryClient.invalidateQueries({ queryKey: ['partner-bonuses-list'] });
            queryClient.invalidateQueries({ queryKey: ['admin-partner-bonuses'] });
        },
        onError: (mutationError: Error) => toast.error(mutationError.message),
    });

    if (!validId) return null;
    return (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.035] p-6 md:p-8 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">Lynon Bonus Engine V2</p>
                    <h4 className="mt-1 text-xl font-semibold text-white">Kampanya ve tüm blok parametreleri</h4>
                    <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[color:var(--panel-muted,#8a919c)]">Tarih, para birimi, atama limiti, şablon, assignmentLimits ve blocksConfiguration değerleri doğrudan Lynon’a kaydedilir. ID ve site alanları değiştirilemez.</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => refetch()} disabled={isLoading} className="h-11 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/5 px-4 text-xs font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] hover:bg-white/10 disabled:opacity-50">
                        <RefreshCw size={15} className={cn('mr-2 inline', isLoading && 'animate-spin')} /> YENİLE
                    </button>
                    <Button type="button" variant="primary" onClick={() => saveMutation.mutate()} disabled={isLoading || saveMutation.isPending} className="h-11 rounded-xl border-none bg-amber-400 px-6 text-xs font-semibold text-[#050609] hover:bg-[color:var(--panel-warning,#ff9f0a)]">
                        {saveMutation.isPending ? 'LYNON’A KAYDEDİLİYOR...' : 'LYNON’A KAYDET'}
                    </Button>
                </div>
            </div>
            {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs font-bold text-rose-300">{(error as Error).message}</div>}
            {isLoading ? (
                <div className="py-10 text-center text-xs font-semibold uppercase tracking-widest text-[color:var(--panel-faint,#5c6470)]">Parametreler yükleniyor...</div>
            ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <label className="space-y-2">
                        <span className="block text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">Kampanya parametreleri</span>
                        <textarea value={campaignJson} onChange={(event) => setCampaignJson(event.target.value)} spellCheck={false} className="min-h-[360px] w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/50 p-4 font-mono text-[11px] leading-relaxed text-amber-100 outline-none focus:border-amber-400/50" />
                    </label>
                    <label className="space-y-2">
                        <span className="block text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">Bonuslar ve blocksConfiguration</span>
                        <textarea value={bonusesJson} onChange={(event) => setBonusesJson(event.target.value)} spellCheck={false} className="min-h-[360px] w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/50 p-4 font-mono text-[11px] leading-relaxed text-emerald-100 outline-none focus:border-emerald-400/50" />
                    </label>
                </div>
            )}
            <div className="text-[10px] font-bold text-[color:var(--panel-faint,#5c6470)]">Şablon: {(data?.Data?.templates ?? []).map((template: any) => `#${template.id ?? template.templateId} ${template.systemName ?? template.name ?? ''}`).join(' · ') || 'Şablon bilgisi yok'} · Blok kataloğu: {data?.Data?.blocks?.length ?? 0}</div>
        </div>
    );
}

function PromoContentEditor({ externalId, promoTitle }: { externalId: number; promoTitle?: string }) {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['admin-promo-overrides'],
        queryFn: async () => {
            const res = await fetch('/api/admin/promos/overrides', { credentials: 'include' });
            return res.json();
        },
        staleTime: 30 * 1000,
    });

    const current = ((data as any)?.data?.byExternalId ?? {})?.[String(externalId)] ?? {};

    const [title, setTitle] = useState<string>('');
    const [image, setImage] = useState<string>('');
    const [detailHtml, setDetailHtml] = useState<string>('');

    useEffect(() => {
        setTitle(String(current?.title ?? ''));
        setImage(String(current?.image ?? ''));
        setDetailHtml(String(current?.detailHtml ?? ''));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [externalId, (current as any)?.title, (current as any)?.image, (current as any)?.detailHtml]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                externalId,
                override: {
                    title: title.trim() || undefined,
                    image: image.trim() || undefined,
                    detailHtml: detailHtml.trim() || undefined,
                }
            };
            const res = await fetch('/api/admin/promos/overrides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-promo-overrides'] });
            queryClient.invalidateQueries({ queryKey: ['promos-list'] });
            toast.success('Bonus içeriği güncellendi');
        },
        onError: () => toast.error('Bonus içeriği kaydedilemedi'),
    });

    const clearMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/admin/promos/overrides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ externalId, override: null }),
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-promo-overrides'] });
            queryClient.invalidateQueries({ queryKey: ['promos-list'] });
            toast.success('Override sıfırlandı');
        },
        onError: () => toast.error('Sıfırlama başarısız'),
    });

    return (
        <div className="space-y-6 p-8 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/50 via-blue-500/50 to-transparent opacity-30" />

            <div className="flex flex-col md:flex-row items-start justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex items-center justify-center text-emerald-400">
                        <Sparkles size={24} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em]">Platform Override Content</p>
                        <h4 className="text-xl font-semibold text-white">Bonus Görünümü & İçerik</h4>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        disabled={clearMutation.isPending || isLoading}
                        onClick={() => clearMutation.mutate()}
                        className="px-6 py-2.5 rounded-xl bg-white/5 text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] hover:text-white transition-all uppercase tracking-widest"
                    >
                        SIFIRLA
                    </button>
                    <Button
                        variant="primary"
                        disabled={saveMutation.isPending || isLoading}
                        onClick={() => saveMutation.mutate()}
                        className="h-11 px-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#050609] font-semibold text-[10px] border-none shadow-lg shadow-emerald-500/10 uppercase tracking-widest"
                    >
                        {saveMutation.isPending ? 'KAYDEDİLİYOR...' : 'İÇERİĞİ GÜNCELLE'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Alternatif Başlık</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full h-14 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-5 text-sm text-white focus:border-blue-500/50 transition-all outline-none font-bold"
                            placeholder="Orijinal başlığı gizlemek için doldurun..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Preview Görsel URL</label>
                        <input
                            value={image}
                            onChange={(e) => setImage(e.target.value)}
                            className="w-full h-14 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-5 text-sm text-white focus:border-blue-500/50 transition-all outline-none font-bold"
                            placeholder="https://..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">Açıklama (HTML)</label>
                        <textarea
                            value={detailHtml}
                            onChange={(e) => setDetailHtml(e.target.value)}
                            className="w-full min-h-[220px] bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-5 py-4 text-sm text-[color:var(--panel-text-dim,#c8cdd5)] focus:border-blue-500/50 transition-all outline-none leading-relaxed"
                            placeholder="HTML formatında bonus detaylarını girin..."
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block pl-1">CANLI ÖNİZLEME</label>
                    <div className="relative rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-6 h-full min-h-[400px] overflow-hidden group/preview">
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity" />

                        {image?.trim() ? (
                            <img src={image.trim()} alt="" className="w-full aspect-video object-cover rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] shadow-2xl mb-6" />
                        ) : (
                            <div className="w-full aspect-video rounded-xl bg-black/40 border border-dashed border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex flex-col items-center justify-center text-[color:var(--panel-faint,#5c6470)] gap-3 mb-6">
                                <Sparkles size={32} className="opacity-20" />
                                <span className="text-[10px] font-semibold uppercase tracking-widest">Görsel Bekleniyor</span>
                            </div>
                        )}

                        <div className="space-y-4 relative z-10">
                            <h5 className="text-xl font-semibold text-white">{title?.trim() || promoTitle || 'Bonus Başlığı'}</h5>
                            <div className="h-px w-12 bg-blue-500" />
                            {detailHtml?.trim() ? (
                                <div className="text-sm text-[color:var(--panel-muted,#8a919c)] font-medium leading-relaxed max-h-[150px] overflow-auto custom-scrollbar pr-2" dangerouslySetInnerHTML={{ __html: detailHtml }} />
                            ) : (
                                <p className="text-sm text-[color:var(--panel-faint,#5c6470)] italic font-medium">İçerik detayı henüz girilmemiş...</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
