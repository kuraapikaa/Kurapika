import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
    Search,
    Gift,
    User,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    TrendingUp,
    ShieldCheck,
    Info,
    ArrowRight,
    Wallet,
    Clock,
    History,
    Check
} from 'lucide-react';
import { Button } from '../ui/Button';
import { LoadingState } from '../ui/LoadingState';
import { adminApi, dashboardApi } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { BonusPlaceholder } from '../ui/BonusPlaceholder';

interface AutoBonusPanelProps {
    /** 'player' = oyuncu bonus talep paneli metinleri */
    variant?: 'admin' | 'player';
    prefilledLogin?: string;
}

export function AutoBonusPanel({ variant = 'admin', prefilledLogin }: AutoBonusPanelProps) {
    const location = useLocation();
    const initialLogin = prefilledLogin || (location.state as any)?.login || '';
    const isPlayerPanel = variant === 'player';

    const [login, setLogin] = useState(initialLogin);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedBonusId, setSelectedBonusId] = useState<number | null>(null);
    const [selectedPromoTitle, setSelectedPromoTitle] = useState<string | null>(null);
    const [isCharging, setIsCharging] = useState(false);
    const [chargeError, setChargeError] = useState<string | null>(null);
    const [chargeSuccess, setChargeSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (initialLogin) {
            handleSearch();
        }
    }, [initialLogin]);

    const { data: bonusDefinitions } = useQuery({
        queryKey: ['bonus-definitions'],
        queryFn: () => dashboardApi.bonusesAll(),
        staleTime: 5 * 60 * 1000,
    });

    const { data: freebetRes } = useQuery({
        queryKey: ['freebet-bonuses'],
        queryFn: () => dashboardApi.freebetBonuses(),
        staleTime: 5 * 60 * 1000,
    });

    const { data: promosRes } = useQuery({
        queryKey: ['promos-list'],
        queryFn: () => dashboardApi.promosAutoList(),
        staleTime: 30 * 60 * 1000,
    });

    // Sadece promotions-data.json'daki bonuslar entegre edilir.
    const promotions = promosRes?.Data?.promotions ?? [];
    const freebetObjects = freebetRes?.Data?.Objects ?? [];

    // GetBonusDefinitions: sadece aktif bonuslar (IsDisabled false, tarih aralığında)
    const now = Date.now();
    const activeBonusDefinitions = (bonusDefinitions?.Result ?? []).filter((b: any) => {
        if (b.IsDisabled === true) return false;
        if (b.BeginDate) {
            const start = new Date(b.BeginDate).getTime();
            if (now < start) return false;
        }
        if (b.EndDate) {
            const end = new Date(b.EndDate).getTime();
            if (now > end) return false;
        }
        return true;
    });

    const getBonusDefinitionId = (b: any) =>
        b?.PartnerBonusId ?? b?.CampaignId ?? b?.DepositDefinition?.BonusDefinitionId ?? b?.FreeSpinDefinition?.BonusDefinitionId ?? b?.Id;

    const richBonuses = promotions.map((p: any, idx: number) => {
        const rules: Record<string, any> = p.rules ?? {};
        // Freebet: promotions-data.json'da descriptionId varsa GetFreeBetBonusesByFilter ile eşleştir
        if (p.descriptionId != null) {
            const freebet = freebetObjects.find((fb: any) => fb.DescriptionId === p.descriptionId);
            if (freebet && !freebet.IsDeleted) {
                return {
                    id: p.id ?? idx,
                    title: p.title,
                    image: p.image,
                    detailHtml: p.detailHtml,
                    backofficeId: freebet.BonusId as number,
                    backofficeName: freebet.Name,
                    isFreebet: true,
                    platformBonusDefinitionId: rules.externalId ?? undefined,
                };
            }
            return {
                id: p.id ?? idx,
                title: p.title,
                image: p.image,
                detailHtml: p.detailHtml,
                backofficeId: undefined,
                backofficeName: undefined,
                isFreebet: true,
                platformBonusDefinitionId: rules.externalId ?? undefined,
            };
        }
        // Normal bonus: öncelik platform "Bonus Tanımlama Kimliği" (externalId) ile eşleştirme
        const extId = rules.externalId != null ? Number(rules.externalId) : null;
        const matched = activeBonusDefinitions.find((b: any) => {
            if (extId != null && Number.isFinite(extId)) {
                if (
                    Number(b.Id) === extId ||
                    Number(b.ExternalId) === extId ||
                    Number(b.PartnerBonusId) === extId ||
                    Number(b.CampaignId) === extId ||
                    Number(b.FreeSpinDefinition?.BonusDefinitionId) === extId ||
                    Number(b.DepositDefinition?.BonusDefinitionId) === extId
                ) return true;
            }
            // Fallback: isim eşleştirme
            return (b.Name && p.title && b.Name.toLowerCase().trim() === p.title.toLowerCase().trim()) ||
                (b.Name && p.title && b.Name.toLowerCase().includes(p.title.toLowerCase().trim())) ||
                (b.Name && p.title && p.title.toLowerCase().includes(b.Name.toLowerCase().trim()));
        });
        return {
            id: p.id ?? idx,
            title: p.title,
            image: p.image,
            detailHtml: p.detailHtml,
            backofficeId: matched ? (getBonusDefinitionId(matched) as number) : undefined,
            backofficeName: matched?.Name,
            isFreebet: false,
            isCash: rules.type === 'nakit' || rules.type === 'cash',
            platformBonusDefinitionId: extId ?? undefined,
        };
    });

    useEffect(() => {
        if ((selectedBonusId != null || selectedPromoTitle) && login) {
            setChargeError(null);
            setChargeSuccess(null);
            handleSearch(undefined, {
                bonusId: selectedBonusId ?? undefined,
                bonusName: selectedPromoTitle ?? undefined
            });
        }
    }, [selectedBonusId, selectedPromoTitle]);

    const handleBonusRequest = async () => {
        if (!account?.id || selectedBonusId == null) return;
        setIsCharging(true);
        setChargeError(null);
        setChargeSuccess(null);
        try {
            const amount = specificBonusCheck?.calculatedAmount;
            const selectedBonus = richBonuses.find(b => b.title === selectedPromoTitle);

            // Nakit dahil tüm ödüller aynı tek-kullanımlık uygunluk izniyle yüklenir.
            // Sunucu, kural tipine göre Lynon campaign assignment veya Player Main
            // crediting düzeltmesini seçer; istemci manual-adjustment ile kontrolü atlayamaz.
            const res: any = await adminApi.chargeBonus({
                ClientId: account.id,
                BonusId: selectedBonusId,
                Amount: amount,
            });

            if ((res as any)?.HasError) {
                setChargeError((res as any).AlertMessage || (res as any).ErrorDescription || 'İşlem sırasında hata oluştu');
            } else {
                const typeLabel = selectedBonus?.isCash ? 'Nakit' : 'Bonus';
                setChargeSuccess(`${typeLabel} başarıyla tanımlandı.${amount ? ` (Tutar: ${amount} TRY)` : ''}`);
                handleSearch(undefined, { bonusId: selectedBonusId, bonusName: selectedPromoTitle ?? undefined });
            }
        } catch (err: any) {
            setChargeError(err.message || 'Bonus talebi gönderilemedi');
        } finally {
            setIsCharging(false);
        }
    };

    const handleSearch = async (e?: React.FormEvent, bonusOptions?: { bonusId?: number; bonusName?: string }) => {
        if (e) e.preventDefault();
        if (!login.trim()) return;

        setIsSearching(true);
        setError(null);
        if (!bonusOptions) {
            setSearchResult(null);
            setSelectedBonusId(null);
            setSelectedPromoTitle(null);
            setChargeError(null);
            setChargeSuccess(null);
        }

        try {
            const res = await adminApi.checkPlayer(login.trim(), bonusOptions);
            if (res.HasError) {
                setError(res.AlertMessage || 'Bir hata oluştu');
            } else {
                setSearchResult(res.Data);
            }
        } catch (err: any) {
            setError(err.message || 'Oyuncu sorgulama başarısız');
        } finally {
            setIsSearching(false);
        }
    };

    const account = searchResult?.account;
    const riskAnalysis = searchResult?.riskAnalysis;
    const withdrawalRules = searchResult?.withdrawalRulesCheck;
    const bonusRules = searchResult?.bonusRules;
    const specificBonusCheck = searchResult?.specificBonusCheck;

    return (
        <div className="space-y-6 pb-20">
            <header className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <Gift className="text-emerald-500" size={24} />
                    </div>
                    {isPlayerPanel ? 'Bonus Talep' : 'Otomatik Bonus Paneli'}
                </h2>
                <p className="text-slate-400 text-sm">
                    {isPlayerPanel
                        ? 'Kullanıcı adınızı yazıp listeden bonus seçin; bonus kurallarına göre talep edebilirsiniz.'
                        : 'Oyuncu kontrollerini sağlayın ve sistem üzerinden hızlıca bonus tanımlayın.'}
                </p>
            </header>

            {/* Search Section */}
            {!isPlayerPanel && (
                <section className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl mb-6">
                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Oyuncu Kullanıcı Adı veya ID"
                                className="w-full bg-black/40 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                            />
                        </div>
                        <Button
                            type="submit"
                            variant="primary"
                            className="px-8 min-h-[48px]"
                            disabled={isSearching || !login.trim()}
                        >
                            {isSearching ? <LoadingState compact /> : 'Sorgula'}
                        </Button>
                    </form>
                </section>
            )}

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3"
                >
                    <XCircle size={18} />
                    {error}
                </motion.div>
            )}

            {/* Results Section */}
            <AnimatePresence mode="wait">
                {searchResult && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={isPlayerPanel ? "flex justify-center" : "grid grid-cols-1 lg:grid-cols-12 gap-6"}
                    >
                        {/* Left Column: Account Details & Checks */}
                        {!isPlayerPanel && (
                            <div className="lg:col-span-7 space-y-6">
                                {/* Profile Overview */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                                                {account?.ClientLogin?.[0]?.toUpperCase() || <User />}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white leading-tight">{account?.ClientLogin}</h3>
                                                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">ID: {account?.id}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-semibold text-emerald-400">
                                                {account?.balance?.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                            </div>
                                            <p className="text-slate-400 text-xs font-medium">Güncel Bakiye</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                                            <p className="text-slate-400 text-[10px] uppercase font-bold mb-1 flex items-center gap-1.5">
                                                <Wallet size={12} className="text-purple-300" /> Son Yatırım
                                            </p>
                                            <p className="text-white font-bold text-sm">
                                                {account?.lastDeposit?.amount?.toLocaleString('tr-TR')} TL
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                                            <p className="text-slate-400 text-[10px] uppercase font-bold mb-1 flex items-center gap-1.5">
                                                <Clock size={12} className="text-amber-400" /> Hesap Yaşı
                                            </p>
                                            <p className="text-white font-bold text-sm">
                                                {account?.accountAgeDays} Gün
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                                            <p className="text-slate-400 text-[10px] uppercase font-bold mb-1 flex items-center gap-1.5">
                                                <TrendingUp size={12} className="text-emerald-400" /> Toplam Yatırım
                                            </p>
                                            <p className="text-white font-bold text-sm">
                                                {account?.totalDeposits?.toLocaleString('tr-TR')} TL
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                                            <p className="text-slate-400 text-[10px] uppercase font-bold mb-1 flex items-center gap-1.5">
                                                <Gift size={12} className="text-rose-400" /> Aktif Bonuslar
                                            </p>
                                            <p className="text-white font-bold text-sm">
                                                {account?.bonuses?.length || 0} Adet
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Checks */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Risk Analizi */}
                                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 backdrop-blur-xl">
                                        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <ShieldCheck className="text-rose-400" size={16} />
                                            Risk Analizi
                                        </h4>
                                        <div className="space-y-3">
                                            {riskAnalysis?.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-start gap-3">
                                                    {item.ok ? <CheckCircle2 size={14} className="text-emerald-500 mt-1 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 mt-1 shrink-0" />}
                                                    <div className="flex-1">
                                                        <p className={`text-xs font-medium ${item.ok ? 'text-slate-200' : 'text-amber-300'}`}>{item.label}</p>
                                                        {(item.reason || item.desc) && <p className="text-[10px] text-slate-400 mt-0.5">{item.reason || item.desc}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                            {(!riskAnalysis || riskAnalysis.items.length === 0) && (
                                                <p className="text-xs text-slate-500 italic">Analiz verisi yok.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bonus Kontrolleri */}
                                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 backdrop-blur-xl">
                                        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <CheckCircle2 className="text-purple-300" size={16} />
                                            Bonus & Çekim Koşulları
                                        </h4>
                                        <div className="space-y-3">
                                            {withdrawalRules?.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex flex-col gap-1">
                                                    <div className="flex items-start gap-3">
                                                        {item.ok ? <CheckCircle2 size={14} className="text-emerald-500 mt-1 shrink-0" /> : <XCircle size={14} className="text-rose-500 mt-1 shrink-0" />}
                                                        <p className={`text-xs font-medium ${item.ok ? 'text-slate-200' : 'text-rose-400'}`}>{item.label}</p>
                                                    </div>
                                                    {(item.reason || item.desc) && <p className="text-[9px] text-slate-400 ml-7">{item.reason || item.desc}</p>}
                                                </div>
                                            ))}
                                            {bonusRules?.items.map((item: any, idx: number) => (
                                                <div key={`b-${idx}`} className="flex flex-col gap-1">
                                                    <div className="flex items-start gap-3">
                                                        {item.ok ? <CheckCircle2 size={14} className="text-emerald-500 mt-1 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 mt-1 shrink-0" />}
                                                        <p className={`text-xs font-medium ${item.ok ? 'text-slate-200' : 'text-amber-400'}`}>{item.label}</p>
                                                    </div>
                                                    {(item.reason || item.desc) && <p className="text-[9px] text-slate-400 ml-7">{item.reason || item.desc}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Transactions Highlight */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 backdrop-blur-xl">
                                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <History className="text-slate-400" size={16} />
                                        Son İşlemler
                                    </h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[11px]">
                                            <thead className="text-slate-500 border-b border-white/5">
                                                <tr>
                                                    <th className="text-left py-2 font-bold uppercase tracking-wider">İşlem</th>
                                                    <th className="text-right py-2 font-bold uppercase tracking-wider">Tutar</th>
                                                    <th className="text-right py-2 font-bold uppercase tracking-wider">Tarih</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 font-medium">
                                                {account?.profileTransactions?.slice(0, 5).map((tx: any, idx: number) => (
                                                    <tr key={idx} className="text-slate-400">
                                                        <td className="py-2.5">
                                                            <span className={tx.Amount > 0 ? 'text-emerald-400' : 'text-slate-200'}>
                                                                {tx.DocumentTypeName}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 text-right font-bold text-white">
                                                            {Number(tx.Amount).toLocaleString('tr-TR')} TL
                                                        </td>
                                                        <td className="py-2.5 text-right text-slate-400 text-[10px]">
                                                            {tx.CreatedLocal}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Right Column: Bonus Selection & Action */}
                        <div className={isPlayerPanel ? "w-full max-w-[600px] space-y-6" : "lg:col-span-5 space-y-6"}>
                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl sticky top-6">
                                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                    <Gift className="text-emerald-400" size={18} />
                                    {isPlayerPanel ? 'Bonus Listesinden Seçin' : 'Tanımlanacak Bonusu Seçin'}
                                </h3>

                                <div className="space-y-3 mb-6 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                                    {richBonuses.map((bonus: any, idx: number) => {
                                        const isSelected = selectedPromoTitle === bonus.title;
                                        const canCharge = bonus.backofficeId != null;
                                        return (
                                            <button
                                                key={bonus.id ?? idx}
                                                onClick={() => {
                                                    setSelectedPromoTitle(bonus.title);
                                                    setSelectedBonusId(bonus.backofficeId ?? null);
                                                }}
                                                className={`w-full text-left p-3 rounded-2xl border transition-all relative overflow-hidden group ${isSelected
                                                    ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                                                    : 'bg-black/30 border-white/5 hover:border-white/5 hover:bg-white/[0.02]'
                                                    } ${!canCharge ? 'opacity-75' : ''}`}
                                            >
                                                <div className="relative z-10 flex gap-4 items-center">
                                                    {bonus.image ? (
                                                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/5">
                                                            <img src={bonus.image} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <BonusPlaceholder size={64} tone="emerald" className="shrink-0 rounded-xl" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`font-bold text-sm truncate ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
                                                            {bonus.title}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                                                            {bonus.isFreebet && <span className="text-amber-400 font-semibold">Freebet</span>}
                                                            {bonus.platformBonusDefinitionId != null && (
                                                                <span className="text-purple-300/80 font-bold">
                                                                    Platform ID: {bonus.platformBonusDefinitionId}
                                                                </span>
                                                            )}
                                                            {bonus.isCash && <span className="text-emerald-400 font-semibold">Nakit Ekleme</span>}
                                                            {canCharge ? (bonus.backofficeId != null ? `#${bonus.backofficeId}` : '') : 'Talep için sistemde tanımlı değil'}
                                                        </p>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="bg-emerald-500 rounded-full p-1 shrink-0 shadow-lg shadow-emerald-500/20">
                                                            <Check size={14} className="text-[#050609]" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}

                                    {richBonuses.length === 0 && !promosRes && (
                                        <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                                            <LoadingState compact />
                                            <p className="text-xs font-medium">Bonus listesi yükleniyor (promotions-data.json)...</p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    {(selectedBonusId != null || selectedPromoTitle) && specificBonusCheck && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-3"
                                        >
                                            <h4 className="text-xs font-bold text-purple-300 uppercase tracking-widest flex items-center justify-between">
                                                <span>Bonus Spesifik Kuralları</span>
                                                {specificBonusCheck.overallOk ? (
                                                    <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[9px]">TÜM ŞARTLAR UYGUN</span>
                                                ) : (
                                                    <span className="bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded text-[9px]">EKSİK ŞARTLAR VAR</span>
                                                )}
                                            </h4>

                                            <div className="space-y-2">
                                                {specificBonusCheck.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex items-start gap-2.5">
                                                        {item.ok ? (
                                                            <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                                                        ) : (
                                                            <XCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-[11px] font-bold ${item.ok ? 'text-slate-200' : 'text-rose-400'}`}>
                                                                {item.label}
                                                            </p>
                                                            {item.reason && (
                                                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                                                                    {item.reason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}

                                    {chargeError && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3"
                                        >
                                            <XCircle size={18} />
                                            {chargeError}
                                        </motion.div>
                                    )}
                                    {chargeSuccess && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3"
                                        >
                                            <CheckCircle2 size={18} />
                                            {chargeSuccess}
                                        </motion.div>
                                    )}

                                    {selectedPromoTitle && selectedBonusId == null && (
                                        <p className="text-amber-500/90 text-xs font-medium">
                                            Bu bonus şu an sistemde tanımlı değil; sadece kural kontrolü gösteriliyor.
                                        </p>
                                    )}
                                    <Button
                                        variant="primary"
                                        className="w-full py-4 text-base font-semibold"
                                        disabled={isCharging || !account?.id || selectedBonusId == null}
                                        onClick={handleBonusRequest}
                                    >
                                        <span className="flex items-center gap-2">
                                            {isCharging ? <LoadingState compact /> : (
                                                <>
                                                    {richBonuses.find(b => b.title === selectedPromoTitle)?.isCash
                                                        ? 'Nakit Ekle / Tanımla'
                                                        : 'Bonus Talep Et / Tanımla'}
                                                    <ArrowRight size={18} />
                                                </>
                                            )}
                                        </span>
                                    </Button>

                                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3">
                                        <Info size={16} className="text-purple-300 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                            Seçtiğiniz bonusun kurallarını ve oyuncunun risk durumunu yukarıdaki panellerden kontrol edebilirsiniz.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty State */}
            {!searchResult && !isSearching && !isPlayerPanel && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-24 text-center"
                >
                    <div className="w-20 h-20 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 shadow-2xl">
                        <User className="text-slate-500" size={40} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-200">Oyuncu Sorgulayın</h3>
                    <p className="text-slate-500 max-w-xs mt-2 text-sm">
                        Kontrolleri sağlayıp otomatik bonus eklemek için kullanıcı adı girerek sorgulamayı başlatın.
                    </p>
                </motion.div>
            )}

            {/* Player Loading State Default (Since search is immediate) */}
            {!searchResult && isPlayerPanel && !error && (
                <div className="py-24 flex flex-col items-center justify-center text-slate-500">
                    <LoadingState compact />
                    <p className="text-sm font-medium mt-4">Kullanıcı bilgileriniz ve uygun bonuslar aranıyor...</p>
                </div>
            )}
        </div>
    );
}
