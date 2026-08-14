import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Gift, Star, Zap, Medal, TrendingUp, ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { tournamentApi } from '@/api/client';
import { cn } from '@/lib/utils';
import { lobbyExtraText, renderLobbyTemplate, useLobbyPageContent } from '@/lib/lobbyContent';

interface LeaderboardItem {
    PlayerId: number;
    UserName: string;
    Name: string;
    BetAmount: number;
    WinAmount: number;
    Profit: number;
    Round: number;
}

export default function TurnuvaSayfasi() {
    const { type = 'gunluk' } = useParams<{ type: string }>();
    const { content: pageContent } = useLobbyPageContent('tournament');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<LeaderboardItem[]>([]);
    const [mockupsPool, setMockupsPool] = useState<LeaderboardItem[]>([]);
    const [lastRealTopScore, setLastRealTopScore] = useState(500000);

    // Turnuva Ayarları
    const tournamentConfig = {
        gunluk: {
            title: 'GÜNLÜK',
            prize: '50.000₺',
            icon: Zap,
            color: 'from-amber-400 to-orange-600',
            bgGlow: 'bg-orange-600/10'
        },
        haftalik: {
            title: 'HAFTALIK',
            prize: '250.000₺',
            icon: TrendingUp,
            color: 'from-blue-400 to-blue-600',
            bgGlow: 'bg-blue-600/10'
        },
        aylik: {
            title: 'AYLIK',
            prize: '500.000₺',
            icon: Trophy,
            color: 'from-blue-400 to-teal-600',
            bgGlow: 'bg-blue-600/10'
        }
    }[type] || {
        title: 'GÜNLÜK',
        prize: '50.000₺',
        icon: Zap,
        color: 'from-amber-400 to-orange-600',
        bgGlow: 'bg-orange-600/10'
    };

    const generateInitialMockups = (baseScore: number) => {
        const names = ['Ahmet', 'Burak', 'Canan', 'Deniz', 'Ece', 'Fatih', 'Gamze', 'Hakan', 'Irmak', 'Jale', 'Kaan', 'Leyla', 'Murat', 'Nilay', 'Ozan', 'Pelin', 'Rıza', 'Selin', 'Taner', 'Umut'];
        return names.map((name, i) => ({
            PlayerId: -(i + 1),
            UserName: name,
            Name: name,
            BetAmount: i < 3
                ? baseScore + (300000 - (i * 80000)) + Math.floor(Math.random() * 20000)
                : Math.floor(baseScore * (0.1 + Math.random() * 0.8)),
            WinAmount: 0,
            Profit: 0,
            Round: Math.floor(Math.random() * 100)
        }));
    };

    const formatDate = (date: Date) => {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = String(date.getFullYear()).slice(-2);
        return `${d}-${m}-${y}`;
    };

    const maskUsername = (username: string) => {
        if (!username) return '*****';
        return username.charAt(0).toUpperCase() + '*****';
    };

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const now = new Date();
            let fromDate = new Date();
            let toDate = new Date();
            toDate.setDate(now.getDate() + 1);

            if (type === 'gunluk') {
                fromDate = new Date(now);
            } else if (type === 'haftalik') {
                fromDate.setDate(now.getDate() - 7);
            } else if (type === 'aylik') {
                fromDate.setDate(now.getDate() - 30);
            }

            const res = await tournamentApi.leaderboard({
                FromDate: formatDate(fromDate),
                ToDate: formatDate(toDate)
            });

            if (res.Result?.ReportByTResultViewModel) {
                const realData = res.Result.ReportByTResultViewModel;
                const topScore = realData.length > 0 ? (realData[0].BetAmount || 500000) : 500000;
                setLastRealTopScore(topScore);

                if (mockupsPool.length === 0) {
                    setMockupsPool(generateInitialMockups(topScore));
                }

                setData(realData);
            } else {
                setData([]);
            }
        } catch (error) {
            console.error('Leaderboard fetch error:', error);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    // Live update mockups
    useEffect(() => {
        const interval = setInterval(() => {
            setMockupsPool(prev => {
                const updated = prev.map((m) => {
                    // Random increase between 1k and 15k
                    const increase = Math.floor(Math.random() * 14000) + 1000;
                    let newScore = m.BetAmount + increase;
                    
                    // Logic to ensure mockups (especially the top ones) stay competitive
                    // but allow shuffles between them
                    if (newScore < lastRealTopScore + 20000) {
                        newScore = lastRealTopScore + 50000 + Math.floor(Math.random() * 100000);
                    }

                    return { 
                        ...m, 
                        BetAmount: newScore,
                        WinAmount: Math.floor(newScore * (0.4 + Math.random() * 0.4)) 
                    };
                });
                // Sort by score
                return updated.sort((a, b) => b.BetAmount - a.BetAmount);
            });
        }, 5000); // Update every 5 seconds for more "action"

        return () => clearInterval(interval);
    }, [lastRealTopScore]);

    useEffect(() => {
        setMockupsPool([]);
        fetchLeaderboard();
    }, [type]);

    const combinedLeaderboard = useMemo(() => {
        // Just merge and sort. Since mockups have logic to be > lastRealTopScore, 
        // they will naturally take the top spots.
        return [...mockupsPool, ...data].sort((a, b) => b.BetAmount - a.BetAmount);
    }, [data, mockupsPool]);

    return (
        <div className="narcos-lobby min-h-screen bg-[#0e0c09] text-[color:var(--lobby-text,#f3ecdd)] font-lobby relative overflow-hidden flex flex-col items-center">

            {/* Background elements */}
            <div className="fixed inset-0 pointer-events-none">
                <div className={cn("absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] transition-all duration-1000", tournamentConfig.bgGlow)} />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[100px]" />
            </div>

            {/* Header Navigation */}
            <div className="w-full bg-[#0c121e] border-b border-[rgba(243,236,221,0.05)] px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
                <div className="flex items-center gap-6 overflow-x-auto no-scrollbar w-full md:w-auto">
                    <Link to="/lobi" className="flex items-center gap-2 text-sm font-bold text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)] transition-colors whitespace-nowrap">
                        <ArrowLeft size={16} /> {pageContent.secondaryButton}
                    </Link>
                    <Link to="/turnuva/gunluk" className={cn("flex items-center gap-2 text-sm font-bold transition-colors whitespace-nowrap", type === 'gunluk' ? "text-[color:var(--lobby-text,#f3ecdd)]" : "text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)]")}>
                        <Zap size={16} /> {lobbyExtraText(pageContent, 'dailyLabel', 'Günlük')}
                    </Link>
                    <Link to="/turnuva/haftalik" className={cn("flex items-center gap-2 text-sm font-bold transition-colors whitespace-nowrap", type === 'haftalik' ? "text-[color:var(--lobby-text,#f3ecdd)]" : "text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)]")}>
                        <TrendingUp size={16} /> {lobbyExtraText(pageContent, 'weeklyLabel', 'Haftalık')}
                    </Link>
                    <Link to="/turnuva/aylik" className={cn("flex items-center gap-2 text-sm font-bold transition-colors whitespace-nowrap", type === 'aylik' ? "text-[color:var(--lobby-text,#f3ecdd)]" : "text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)]")}>
                        <Trophy size={16} /> {lobbyExtraText(pageContent, 'monthlyLabel', 'Aylık')}
                    </Link>
                    <div className="w-px h-4 bg-[rgba(243,236,221,0.10)] mx-2 hidden md:block" />
                    <Link to="/bonus-talep" className="flex items-center gap-2 text-sm font-bold text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)] transition-colors whitespace-nowrap">
                        <Gift size={16} /> {pageContent.primaryButton}
                    </Link>
                </div>
            </div>

            <div className="w-full max-w-6xl px-4 md:px-8 py-8 relative z-10">

                {/* Hero Banner */}
                <motion.div
                    key={type}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full rounded-[3rem] p-8 md:p-14 overflow-hidden border border-[rgba(243,236,221,0.05)] mb-10"
                >
                    <div className={cn("absolute inset-0 bg-gradient-to-br opacity-40 z-0", tournamentConfig.color.includes('purple') ? 'from-blue-900/40 via-[#0e0c09] to-[#0e0c09]' : tournamentConfig.color.includes('amber') ? 'from-amber-900/20 via-[#0e0c09] to-[#0e0c09]' : 'from-blue-900/20 via-[#0e0c09] to-[#0e0c09]')} />
                    <div className="absolute right-0 top-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="max-w-xl text-center md:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(243,236,221,0.05)] text-[color:var(--lobby-text,#f3ecdd)] text-[10px] font-black uppercase tracking-widest mb-6 border border-[rgba(243,236,221,0.05)]">
                                <tournamentConfig.icon size={14} className="text-[color:var(--lobby-text,#f3ecdd)]" />
                                {tournamentConfig.title} {lobbyExtraText(pageContent, 'tournamentSuffix', 'TURNUVA')}
                            </div>
                            <h1 className="text-5xl md:text-8xl font-black text-[color:var(--lobby-text,#f3ecdd)] mb-6 leading-tight tracking-tighter uppercase">
                                <span className={cn("text-transparent bg-clip-text bg-gradient-to-r", tournamentConfig.color)}>
                                    {tournamentConfig.prize}
                                </span> <br />
                                {lobbyExtraText(pageContent, 'prizePoolTitle', 'ÖDÜL HAVUZU')}
                            </h1>
                            <p className="text-lg text-[color:var(--lobby-muted,#8f8674)] font-medium leading-relaxed max-w-sm">
                                {renderLobbyTemplate(pageContent.subtitle, { period: tournamentConfig.title.toLowerCase() })}
                            </p>
                        </div>

                        <div className="relative group">
                            <div className={cn("absolute inset-0 blur-[60px] rounded-full animate-pulse transition-all duration-1000", tournamentConfig.bgGlow.replace('10', '40'))} />
                            <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-[3.5rem] bg-[rgba(243,236,221,0.03)] border border-[rgba(243,236,221,0.10)] flex items-center justify-center shadow-2xl rotate-6 group-hover:rotate-0 transition-all duration-700">
                                <tournamentConfig.icon size={120} className={cn("transition-all duration-700", tournamentConfig.color.includes('amber') ? 'text-amber-400' : tournamentConfig.color.includes('purple') ? 'text-blue-400' : 'text-blue-400')} />
                                <div className="absolute -bottom-2 -right-2 w-16 h-16 rounded-xl bg-[rgba(243,236,221,0.03)] border border-[rgba(243,236,221,0.10)] flex items-center justify-center">
                                    <Star size={32} className="text-amber-400 fill-amber-400 animate-spin-slow" />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Leaderboard Section */}
                <div className="flex items-center justify-between px-2 mb-6">
                    <h2 className="text-xl font-black text-[color:var(--lobby-text,#f3ecdd)] flex items-center gap-3">
                        <div className={cn("w-2 h-8 rounded-full bg-gradient-to-b", tournamentConfig.color)} />
                        {pageContent.title}
                    </h2>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-[color:var(--lobby-muted,#8f8674)] uppercase">{lobbyExtraText(pageContent, 'updateLabel', 'GÜNCELLEME')}</span>
                            <span className="text-xs font-bold text-[color:var(--lobby-muted,#8f8674)]">{lobbyExtraText(pageContent, 'liveLabel', 'Anlık')}</span>
                        </div>
                    </div>
                </div>

                <div className="w-full bg-[rgba(243,236,221,0.03)] border border-[rgba(243,236,221,0.05)] rounded-[2.5rem] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[rgba(243,236,221,0.05)] bg-[rgba(243,236,221,0.05)]">
                                    <th className="px-3 md:px-8 py-4 md:py-6 text-[10px] font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest">SIRA</th>
                                    <th className="px-3 md:px-8 py-4 md:py-6 text-[10px] font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest">OYUNCU</th>
                                    <th className="px-3 md:px-8 py-4 md:py-6 text-[10px] font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest text-right">BAHİS</th>
                                    <th className="px-3 md:px-8 py-4 md:py-6 text-[10px] font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest text-right hidden sm:table-cell">KAZANÇ</th>
                                    <th className="px-3 md:px-8 py-4 md:py-6 text-[10px] font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest text-right hidden md:table-cell">SKOR</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                <AnimatePresence mode="wait">
                                    {loading ? (
                                        <motion.tr
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                        >
                                            <td colSpan={5} className="px-4 py-32 text-center text-[color:var(--lobby-muted,#8f8674)] animate-pulse font-bold uppercase tracking-widest">
                                                {pageContent.loadingText}
                                            </td>
                                        </motion.tr>
                                    ) : combinedLeaderboard.length > 0 ? (
                                        combinedLeaderboard.map((player, index) => (
                                            <motion.tr
                                                layout
                                                key={player.PlayerId}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.03 }}
                                                className="group hover:bg-[rgba(243,236,221,0.02)] transition-colors"
                                            >
                                                <td className="px-3 md:px-8 py-4 md:py-5">
                                                    <div className="flex items-center gap-2">
                                                        {index === 0 && <Medal className="text-amber-400" size={20} aria-label="Birinci" />}
                                                        {index === 1 && <Medal className="text-[color:var(--lobby-muted,#8f8674)]" size={20} aria-label="İkinci" />}
                                                        {index === 2 && <Medal className="text-amber-700" size={20} aria-label="Üçüncü" />}
                                                        {index > 2 && <span className="w-6 text-center text-sm font-black text-[color:var(--lobby-muted,#8f8674)]">#{index + 1}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-3 md:px-8 py-4 md:py-5">
                                                    <span className="text-sm font-black text-[color:var(--lobby-text,#f3ecdd)] group-hover:text-blue-400 transition-colors uppercase">
                                                        {maskUsername(player.UserName)}
                                                    </span>
                                                </td>
                                                <td className="px-3 md:px-8 py-4 md:py-5 text-right font-black text-[color:var(--lobby-muted,#8f8674)]">
                                                    ₺{player.BetAmount.toLocaleString('tr-TR')}
                                                </td>
                                                <td className="px-3 md:px-8 py-4 md:py-5 text-right font-black text-emerald-500 hidden sm:table-cell">
                                                    ₺{player.WinAmount.toLocaleString('tr-TR')}
                                                </td>
                                                <td className="px-3 md:px-8 py-4 md:py-5 text-right hidden md:table-cell">
                                                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[rgba(243,236,221,0.05)] border border-[rgba(243,236,221,0.05)] text-[10px] font-black text-[color:var(--lobby-muted,#8f8674)]">
                                                        {Math.floor(player.BetAmount / 100)} PUAN
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-20 text-center text-[color:var(--lobby-muted,#8f8674)] font-bold uppercase tracking-widest">{pageContent.emptyTitle}</td>
                                        </tr>
                                    )}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .animate-spin-slow { animation: spin 8s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
