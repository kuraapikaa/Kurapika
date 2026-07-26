import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Medal } from 'lucide-react';
import { tournamentApi } from '../../api/client';
import { LobbyMobileNav } from './LobbyMobileNav';
import { TournamentPeriodSwitch } from './TournamentPeriodSwitch';

interface LeaderboardItem {
    PlayerId: number;
    UserName: string;
    Name: string;
    BetAmount: number;
    WinAmount: number;
    Profit: number;
    Round: number;
}

export function GunlukTurnuva() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<LeaderboardItem[]>([]);
    const [prize, setPrize] = useState('50.000');

    const formatDate = (date: Date) => {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = String(date.getFullYear()).slice(-2);
        return `${d}-${m}-${y}`;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Settings fetch
            tournamentApi.getSettings().then(s => {
                if (s?.gunluk?.prize) setPrize(s.gunluk.prize);
            }).catch(() => {});

            // Leaderboard fetch
            const now = new Date();
            let toDate = new Date();
            toDate.setDate(now.getDate() + 1);
            const res = await tournamentApi.leaderboard({
                FromDate: formatDate(now),
                ToDate: formatDate(toDate)
            });
            if (res.Result?.ReportByTResultViewModel) {
                setData(res.Result.ReportByTResultViewModel);
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

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="min-h-screen bg-[#05060a] pb-8 text-zinc-200 font-sans relative overflow-x-hidden flex flex-col items-center">
            
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-600/10 blur-[120px]" />
            </div>

            <LobbyMobileNav active="tournament" />

            <div className="w-full max-w-6xl px-3 sm:px-4 md:px-8 py-5 sm:py-8 relative z-10">
                <TournamentPeriodSwitch active="gunluk" />

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full rounded-[2rem] md:rounded-[3rem] p-5 sm:p-8 md:p-14 overflow-hidden border border-white/5 mb-5 sm:mb-10">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-zinc-950 to-zinc-950 opacity-40" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">
                        <div className="max-w-xl text-center md:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-zinc-200 text-[10px] font-black uppercase tracking-widest mb-4 sm:mb-6 border border-white/5">
                                <Zap size={14} /> GÜNLÜK HEYECAN
                            </div>
                            <h1 className="text-4xl sm:text-5xl md:text-8xl font-black text-white mb-2 sm:mb-6 leading-[0.95] tracking-tighter uppercase">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600">{prize}₺</span> <br />
                                ÖDÜL HAVUZU
                            </h1>
                        </div>
                        <div className="relative group hidden sm:block">
                             <div className="absolute inset-0 bg-orange-600/40 blur-[60px] rounded-full animate-pulse" />
                             <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-[3.5rem] bg-zinc-950/40 backdrop-blur-3xl border border-white/10 flex items-center justify-center rotate-6 shadow-2xl">
                                <Zap size={120} className="text-amber-400" />
                             </div>
                        </div>
                    </div>
                </motion.div>

                <div className="sm:hidden space-y-3">
                    {loading ? (
                        <div className="rounded-3xl border border-white/5 bg-zinc-950/40 px-4 py-10 text-center text-xs font-black uppercase tracking-widest text-zinc-600">
                            Veriler Yükleniyor...
                        </div>
                    ) : data.length ? (
                        data.map((player, index) => (
                            <div key={player.PlayerId} className="rounded-3xl border border-white/5 bg-zinc-950/50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                                            {index < 3 ? (
                                                <Medal className={index === 0 ? 'text-amber-400' : index === 1 ? 'text-zinc-400' : 'text-amber-700'} size={22} aria-label={index === 0 ? 'Birinci' : index === 1 ? 'İkinci' : 'Üçüncü'} />
                                            ) : (
                                                <span className="text-sm font-black text-zinc-500">#{index + 1}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black uppercase text-white">{player.UserName?.slice(0, 3)}***{player.UserName?.slice(-2)}</p>
                                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">Günlük turnuva</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">Bahis</p>
                                        <p className="mt-1 text-sm font-black text-zinc-300">₺{player.BetAmount.toLocaleString('tr-TR')}</p>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between rounded-2xl border border-emerald-400/10 bg-emerald-400/5 px-3 py-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300/70">Kazanç</span>
                                    <span className="text-sm font-black text-emerald-400">₺{player.WinAmount.toLocaleString('tr-TR')}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-3xl border border-white/5 bg-zinc-950/40 px-4 py-10 text-center text-xs font-black uppercase tracking-widest text-zinc-600">
                            Veri bulunamadı.
                        </div>
                    )}
                </div>

                <div className="hidden sm:block w-full bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="px-3 md:px-8 py-4 md:py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">SIRA</th>
                                <th className="px-3 md:px-8 py-4 md:py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">OYUNCU</th>
                                <th className="px-3 md:px-8 py-4 md:py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">BAHİS</th>
                                <th className="px-3 md:px-8 py-4 md:py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right hidden sm:table-cell">KAZANÇ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={4} className="px-4 py-20 text-center text-zinc-600 font-bold uppercase">Veriler Yükleniyor...</td></tr>
                            ) : data.length ? data.map((player, index) => (
                                <tr key={player.PlayerId} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="px-3 md:px-8 py-4 md:py-5">
                                        {index < 3 ? <Medal className={index === 0 ? "text-amber-400" : index === 1 ? "text-zinc-400" : "text-amber-700"} size={24} aria-label={index === 0 ? 'Birinci' : index === 1 ? 'İkinci' : 'Üçüncü'} /> : <span className="text-sm font-black text-zinc-600">#{index + 1}</span>}
                                    </td>
                                    <td className="px-3 md:px-8 py-4 md:py-5 text-sm font-black text-white uppercase">{player.UserName?.slice(0, 3)}***{player.UserName?.slice(-2)}</td>
                                    <td className="px-3 md:px-8 py-4 md:py-5 text-right font-black text-zinc-400">₺{player.BetAmount.toLocaleString('tr-TR')}</td>
                                    <td className="px-3 md:px-8 py-4 md:py-5 text-right font-black text-emerald-500 hidden sm:table-cell">₺{player.WinAmount.toLocaleString('tr-TR')}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan={4} className="px-4 py-20 text-center text-zinc-600 font-bold uppercase">Veri bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
