import { BrainCircuit, AlertTriangle, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface AIPlayerInsightProps {
    data: any; // KPI Data
    ipData: any; // IP Data
}

export function AIPlayerInsight({ data, ipData }: AIPlayerInsightProps) {
    if (!data) return null;

    // Simulate an AI summarization logic instead of connecting to an actual LLM for the sake of real-time speed.
    // Calculate player persona and risk
    const linkedAccountsCount = ipData?.Data?.Objects?.length || 0;
    const isMultiAccount = linkedAccountsCount > 1;

    const profitMargin = data.ProfitAndLose; // Net Kar/Zarar
    const isWinner = profitMargin < 0; // Negative profit means site lost, player won.

    const sportVolume = data.TotalSportStakes || 0;
    const casinoVolume = data.TotalCasinoStakes || 0;
    const totalVolume = sportVolume + casinoVolume;
    let preferredCategory = "Henüz işlem yapmamış";
    if (totalVolume > 0) {
        const casinoRatio = (casinoVolume / totalVolume) * 100;
        preferredCategory = casinoRatio > 60 ? "Canlı Casino & Slot" : casinoRatio < 40 ? "Spor Bahisleri" : "Karma (Spor & Casino)";
    }

    // Persona Logic
    let persona = "Standart Oyuncu";
    let personaColor = "text-[color:var(--panel-muted,#8a919c)]";
    let icon = <ShieldCheck size={18} className="text-[color:var(--panel-muted,#8a919c)]" />;

    if (data.DepositCount === 0 && data.DepositAmount === 0) {
        persona = "Yeni / Pasif Kayıt";
        personaColor = "text-[color:var(--panel-muted,#8a919c)]";
        icon = <ShieldCheck size={18} className="text-[color:var(--panel-muted,#8a919c)]" />;
    } else if (data.DepositAmount > 100000) {
        persona = "VIP Balina";
        personaColor = "text-amber-400";
        icon = <Sparkles size={18} className="text-amber-400" />;
    } else if (isWinner && sportVolume > 0 && profitMargin <= -50000) {
        persona = "Profesyonel Bahisçi / Arbitraj Şüphesi";
        personaColor = "text-rose-400";
        icon = <AlertTriangle size={18} className="text-rose-400" />;
    } else if (data.DepositCount > 20 && data.DepositAmount < 5000) {
        persona = "Mikro Oyuncu (Düşük Bakiye, Yüksek İşlem)";
        personaColor = "text-blue-400";
        icon = <Zap size={18} className="text-blue-400" />;
    }

    // Risk Logic
    let riskLevel = "DÜŞÜK";
    let riskColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (isMultiAccount && isWinner) {
        riskLevel = "KRİTİK";
        riskColor = "bg-rose-500/20 text-rose-500 border-rose-500/50 animate-pulse";
    } else if (isMultiAccount || isWinner) {
        riskLevel = "ORTA";
        riskColor = "bg-amber-500/20 text-amber-400 border-amber-500/30";
    }

    const registrationDate = data.RegistrationDate || data.rawDetail?.registrationDate || data.CreatedLocalDate;
    const isNewPlayer = registrationDate ? (Date.now() - new Date(registrationDate).getTime()) <= 30 * 24 * 60 * 60 * 1000 : data.DepositCount === 0;
    const hasNoBonus = Number(data.BonusBalance ?? 0) <= 0 && Number(data.TotalSportBonusStakes ?? 0) + Number(data.TotalCasinoBonusStakes ?? 0) <= 0;
    const profileTags = [
        isNewPlayer && { label: 'New Player', tone: 'border-sky-400/30 bg-[color:var(--panel-accent,#0a84ff)]/10 text-sky-200' },
        hasNoBonus && { label: 'No Bonus User', tone: 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.10)] text-[color:var(--panel-text-dim,#c8cdd5)]' },
        hasNoBonus && Number(data.DepositAmount ?? 0) > 0 && { label: 'No Gift User', tone: 'border-amber-400/30 bg-amber-400/10 text-amber-200' },
        (isMultiAccount || isWinner) && { label: 'Risk Review', tone: 'border-orange-400/30 bg-orange-400/10 text-orange-200' },
        Number(data.DepositAmount ?? 0) >= 100000 && { label: 'VIP', tone: 'border-[color:var(--panel-border-strong,rgba(10,132,255,0.34))] bg-[rgba(10,132,255,0.1)] text-[color:var(--panel-info,#64d2ff)]' },
        Number(data.DepositAmount ?? 0) >= 25000 && Number(data.DepositAmount ?? 0) < 100000 && { label: 'Before VIP', tone: 'border-[rgba(10,132,255,0.25)] bg-[rgba(10,132,255,0.05)] text-[color:var(--panel-warning,#ff9f0a)]' },
        Number(data.DepositAmount ?? 0) >= 100000 && (isMultiAccount || isWinner) && { label: 'High Value - High Risk', tone: 'border-rose-400/40 bg-rose-500/15 text-rose-200' },
        casinoVolume >= 25000 && casinoVolume > sportVolume * 2 && isWinner && { label: 'Risky Roulette', tone: 'border-teal-400/30 bg-teal-400/10 text-teal-200' },
        sportVolume >= 25000 && isWinner && { label: 'Surebet', tone: 'border-blue-400/30 bg-[color:var(--panel-accent,#0a84ff)]/10 text-blue-200' },
        riskLevel !== 'DÜŞÜK' && { label: 'High Risk', tone: 'border-rose-400/30 bg-rose-500/10 text-rose-200' },
        isWinner && { label: 'Negative', tone: 'border-rose-400/25 bg-rose-500/10 text-rose-200' },
        (isMultiAccount || Number(data.WithdrawalAmount ?? 0) > Number(data.DepositAmount ?? 0) * 0.9) && { label: 'Review', tone: 'border-orange-400/25 bg-orange-400/10 text-orange-200' },
    ].filter(Boolean) as Array<{ label: string; tone: string }>;
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-6 md:p-8 backdrop-blur-md mb-8 relative overflow-hidden group"
        >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-colors" />

            <div className="flex flex-col md:flex-row gap-6 items-start relative z-10">
                <div className="flex-shrink-0 bg-blue-500/20 p-4 rounded-xl border border-blue-500/30">
                    <BrainCircuit size={32} className="text-blue-400" />
                </div>

                <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-blue-300 tracking-wide uppercase">Bugs Software AI Analiz Karnesi</h3>
                        <span className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-widest rounded-full border ${riskColor}`}>
                            Risk Seviyesi: {riskLevel}
                        </span>
                        <div className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest rounded-full border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 ${personaColor}`}>
                            {icon} {persona}
                        </div>
                    </div>

                    {profileTags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {profileTags.map((tag) => (
                                <span key={tag.label} className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${tag.tone}`}>
                                    {tag.label}
                                </span>
                            ))}
                        </div>
                    )}
                    <p className="text-sm md:text-base text-blue-100/80 leading-relaxed font-medium">
                        {totalVolume > 0 ? (
                            <>
                                Bu oyuncu sistemde ağırlıklı olarak <span className="font-bold text-white border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] pb-0.5">{preferredCategory}</span> kategorisinde işlem yapıyor.
                                Bugüne kadar toplam <span className="font-mono text-emerald-400 font-bold">{data.DepositCount} kez</span> yatırım yapmış.
                                Bakiye performansı incelendiğinde şirkete karşı <span className={`font-mono font-bold ${isWinner ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {isWinner ? 'kârda' : 'zararda'}
                                </span>.
                            </>
                        ) : data.DepositCount > 0 ? (
                            <>
                                Bu oyuncu bugüne kadar toplam <span className="font-mono text-emerald-400 font-bold">{data.DepositCount} kez</span> yatırım yapmış ancak hiç bahis hacmi (oyun geçmişi) bulunmamaktadır.
                                Bakiye durumu: <span className="font-bold text-white">{data.DepositAmount - data.WithdrawalAmount} TRY</span>
                            </>
                        ) : (
                            <>
                                Bu hesabın sistemde henüz profilini çizecek finansal hiçbir işlemi (yatırım veya bahis) bulunmamaktadır. Pasif kullanıcıdır.
                            </>
                        )}

                        {isMultiAccount ?
                            <span className="text-amber-400 ml-1">Aynı IP adresi üzerinden {linkedAccountsCount} farklı hesapla bağlantısı tespit edilmiştir, manuel inceleme önerilir.</span>
                            :
                            <span className="text-emerald-400 ml-1">IP veya cihaz analizi sonucunda herhangi bir multi-account ağına rastlanmamıştır.</span>
                        }
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
