import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Medal, TrendingUp } from 'lucide-react';
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

export function HaftalikTurnuva() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [prize, setPrize] = useState('250.000');

  const formatDate = (date: Date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear()).slice(-2);
    return `${d}-${m}-${y}`;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      tournamentApi.getSettings().then((settings) => {
        if (settings?.haftalik?.prize) setPrize(settings.haftalik.prize);
      }).catch(() => {});

      const now = new Date();
      const fromDate = new Date();
      fromDate.setDate(now.getDate() - 7);
      const toDate = new Date();
      toDate.setDate(now.getDate() + 1);

      const res = await tournamentApi.leaderboard({
        FromDate: formatDate(fromDate),
        ToDate: formatDate(toDate),
      });

      setData(res.Result?.ReportByTResultViewModel ?? []);
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
    <div className="relative flex min-h-screen flex-col items-center overflow-x-hidden bg-[#05060a] pb-8 font-sans text-zinc-200">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <LobbyMobileNav active="tournament" />

      <div className="relative z-10 w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-8 md:px-8">
        <TournamentPeriodSwitch active="haftalik" />

        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative mb-5 w-full overflow-hidden rounded-[2rem] border border-white/5 p-5 sm:mb-10 sm:p-8 md:rounded-[3rem] md:p-14">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-zinc-950 to-zinc-950 opacity-40" />
          <div className="relative z-10 flex flex-col items-center justify-between gap-6 md:flex-row md:gap-10">
            <div className="max-w-xl text-center md:text-left">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-200 sm:mb-6">
                <TrendingUp size={14} /> Haftalık maraton
              </div>
              <h1 className="mb-2 text-4xl font-black uppercase leading-[0.95] tracking-tighter text-white sm:mb-6 sm:text-5xl md:text-8xl">
                <span className="bg-gradient-to-r from-blue-400 to-indigo-600 bg-clip-text text-transparent">{prize}₺</span> <br />
                Ödül havuzu
              </h1>
            </div>
            <div className="relative hidden sm:block">
              <div className="absolute inset-0 animate-pulse rounded-full bg-blue-600/40 blur-[60px]" />
              <div className="relative flex h-48 w-48 rotate-6 items-center justify-center rounded-[3.5rem] border border-white/10 bg-zinc-950/40 shadow-2xl backdrop-blur-3xl md:h-64 md:w-64">
                <TrendingUp size={120} className="text-blue-400" />
              </div>
            </div>
          </div>
        </motion.div>

        <MobileLeaderboard data={data} loading={loading} periodLabel="Haftalık turnuva" />
        <DesktopLeaderboard data={data} loading={loading} />
      </div>
    </div>
  );
}

function MobileLeaderboard({ data, loading, periodLabel }: { data: LeaderboardItem[]; loading: boolean; periodLabel: string }) {
  return (
    <div className="space-y-3 sm:hidden">
      {loading ? (
        <EmptyTournamentCard text="Veriler yükleniyor..." />
      ) : data.length ? (
        data.map((player, index) => (
          <div key={player.PlayerId} className="rounded-3xl border border-white/5 bg-zinc-950/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <RankBadge index={index} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black uppercase text-white">{player.UserName?.slice(0, 3)}***{player.UserName?.slice(-2)}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{periodLabel}</p>
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
        <EmptyTournamentCard text="Veri bulunamadı." />
      )}
    </div>
  );
}

function DesktopLeaderboard({ data, loading }: { data: LeaderboardItem[]; loading: boolean }) {
  return (
    <div className="hidden w-full overflow-hidden rounded-[2.5rem] border border-white/5 bg-zinc-950/40 backdrop-blur-xl sm:block">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 md:px-8 md:py-6">Sıra</th>
              <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 md:px-8 md:py-6">Oyuncu</th>
              <th className="px-3 py-4 text-right text-[10px] font-black uppercase tracking-widest text-zinc-500 md:px-8 md:py-6">Bahis</th>
              <th className="hidden px-3 py-4 text-right text-[10px] font-black uppercase tracking-widest text-zinc-500 sm:table-cell md:px-8 md:py-6">Kazanç</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-20 text-center font-bold uppercase text-zinc-600">Veriler yükleniyor...</td></tr>
            ) : data.length ? data.map((player, index) => (
              <tr key={player.PlayerId} className="group transition-colors hover:bg-white/[0.02]">
                <td className="px-3 py-4 md:px-8 md:py-5"><RankIcon index={index} /></td>
                <td className="px-3 py-4 text-sm font-black uppercase text-white md:px-8 md:py-5">{player.UserName?.slice(0, 3)}***{player.UserName?.slice(-2)}</td>
                <td className="px-3 py-4 text-right font-black text-zinc-400 md:px-8 md:py-5">₺{player.BetAmount.toLocaleString('tr-TR')}</td>
                <td className="hidden px-3 py-4 text-right font-black text-emerald-500 sm:table-cell md:px-8 md:py-5">₺{player.WinAmount.toLocaleString('tr-TR')}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="px-4 py-20 text-center font-bold uppercase text-zinc-600">Veri bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyTournamentCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-zinc-950/40 px-4 py-10 text-center text-xs font-black uppercase tracking-widest text-zinc-600">
      {text}
    </div>
  );
}

function RankBadge({ index }: { index: number }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
      <RankIcon index={index} />
    </div>
  );
}

function RankIcon({ index }: { index: number }) {
  if (index < 3) {
    return <Medal className={index === 0 ? 'text-amber-400' : index === 1 ? 'text-zinc-400' : 'text-amber-700'} size={22} aria-label={index === 0 ? 'Birinci' : index === 1 ? 'İkinci' : 'Üçüncü'} />;
  }

  return <span className="text-sm font-black text-zinc-600">#{index + 1}</span>;
}
