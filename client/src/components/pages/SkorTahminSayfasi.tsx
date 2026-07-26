import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Loader2, Medal, Send, ShieldCheck, Trophy, User } from 'lucide-react';
import { bonusPanelApi, gamesApi } from '../../api/client';
import { cn, resolveTeamLogoUrl } from '../../lib/utils';
import { LobbyMobileNav } from './LobbyMobileNav';
import { lobbyExtraText, useLobbyPageContent } from '../../lib/lobbyContent';

type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  league: string;
  startsAt: string;
  status: 'open' | 'closed' | 'finished';
  homeScore: number | null;
  awayScore: number | null;
};

type Prediction = {
  matchId: string;
  homeScore: number;
  awayScore: number;
};

export function SkorTahminSayfasi() {
  const { content: pageContent } = useLobbyPageContent('prediction');
  const [league, setLeague] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [boardPeriod, setBoardPeriod] = useState<'weekly' | 'monthly'>('weekly');

  const loadLeague = async () => {
    setLoading(true);
    try {
      const res = await gamesApi.predictionLeague();
      setLeague(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bonusPanelApi.me().then((res) => {
      if (res.ok) {
        setActiveUser(res.login);
        setUsername(res.login);
      }
    });
    loadLeague();
  }, []);

  useEffect(() => {
    const nextScores: Record<string, { home: string; away: string }> = {};
    league?.myPredictions?.forEach((prediction: Prediction) => {
      nextScores[prediction.matchId] = {
        home: String(prediction.homeScore),
        away: String(prediction.awayScore),
      };
    });
    setScores((prev) => ({ ...nextScores, ...prev }));
  }, [league?.myPredictions]);

  const matches: Match[] = league?.matches || [];
  const openMatches = useMemo(() => matches.filter((match) => isMatchOpen(match)), [matches]);
  const leaderboard = boardPeriod === 'weekly' ? (league?.weeklyLeaderboard || league?.leaderboard || []) : (league?.monthlyLeaderboard || []);
  const monthlyPlayer = league?.monthlyPlayer || {};

  const handleCheck = async () => {
    if (!username.trim() || checking) return;
    setChecking(true);
    setMessage('');
    try {
      const res = await bonusPanelApi.login(username.trim());
      if (res.ok) {
        setActiveUser(res.login);
        setUsername(res.login);
        await loadLeague();
      } else {
        setMessage(lobbyExtraText(pageContent, 'userNotFoundError', 'KullanÄ±cÄ± adÄ± bulunamadÄ±.'));
      }
    } catch {
      setMessage(lobbyExtraText(pageContent, 'connectionError', 'BaÄŸlantÄ± hatasÄ± oluÅŸtu.'));
    } finally {
      setChecking(false);
    }
  };

  const submitPrediction = async (match: Match) => {
    const current = scores[match.id] || { home: '', away: '' };
    const homeScore = Number(current.home);
    const awayScore = Number(current.away);

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      setMessage(lobbyExtraText(pageContent, 'validScoreError', 'LÃ¼tfen geÃ§erli skor girin.'));
      return;
    }

    setSavingMatchId(match.id);
    setMessage('');
    try {
      const res = await gamesApi.submitPrediction({ matchId: match.id, homeScore, awayScore });
      setLeague(res.data);
      setMessage(pageContent.successTitle);
    } catch (error: any) {
      setMessage(error?.message || lobbyExtraText(pageContent, 'submitError', 'Tahmin kaydedilemedi.'));
    } finally {
      setSavingMatchId(null);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05060a] pb-10 font-sans text-zinc-100">
      <LobbyMobileNav active="prediction" />

      <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5 md:px-8 md:py-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] border border-[#d4af37]/25 bg-gradient-to-br from-[#2a1907] via-[#0e0b06] to-[#07080d] p-5 shadow-[0_24px_80px_rgba(0,0,0,.32)] md:p-8"
        >
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#d4af37]/18 blur-[85px]" />
          <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-[1fr_260px] md:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                <Trophy size={13} /> {pageContent.eyebrow}
              </div>
              <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.055em] text-white md:text-6xl">
                {league?.title || pageContent.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-zinc-400 md:text-base">
                {league?.description || pageContent.subtitle}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-[1.5rem] border border-[#d4af37]/25 bg-black/30 p-4">
              <img src={monthlyPlayer.imageUrl || '/assets/brand/narcosbahis.png'} alt="AyÄ±n oyuncusu" className="absolute -right-8 -bottom-8 h-36 w-36 object-contain opacity-35" />
              <div className="relative z-10 max-w-[72%]">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f4d36f]">{monthlyPlayer.title || 'AYIN OYUNCUSU'}</p>
                <p className="mt-2 text-xl font-black leading-tight tracking-[-0.04em] text-white">{monthlyPlayer.mainText || league?.prize || 'Ã–dÃ¼l havuzu'}</p>
                <p className="mt-3 text-xs font-bold leading-5 text-[#e9d5a2]">{monthlyPlayer.subtitle || league?.rewards?.monthly?.label || league?.rules}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {!activeUser && (
          <section className="mt-5 rounded-[1.6rem] border border-white/[0.07] bg-white/[0.04] p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                  <User size={13} /> {pageContent.formTitle}
                </label>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleCheck()}
                  placeholder={pageContent.usernamePlaceholder}
                  className="h-12 w-full rounded-2xl border border-white/[0.07] bg-black/30 px-4 text-sm font-black text-white outline-none placeholder:text-zinc-700 focus:border-[#f4d36f]/40"
                />
              </div>
              <button
                type="button"
                onClick={handleCheck}
                disabled={!username.trim() || checking}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#d4af37] px-6 text-xs font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
              >
                {checking ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {pageContent.submitButton}
              </button>
            </div>
          </section>
        )}

        {message && (
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-sm font-bold text-zinc-300">
            {message}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-3">
            <div className="flex items-end justify-between px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f4d36f]/70">{pageContent.formDescription}</p>
                <h2 className="text-2xl font-black tracking-[-0.04em] text-white">{lobbyExtraText(pageContent, 'matchesTitle', 'Tahmin maÃ§larÄ±')}</h2>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">{openMatches.length} {lobbyExtraText(pageContent, 'openStatus', 'aÃ§Ä±k maÃ§')}</span>
            </div>

            {loading ? (
              <div className="rounded-[1.6rem] border border-white/[0.07] bg-white/[0.035] p-10 text-center text-zinc-500">
                <Loader2 className="mx-auto animate-spin" />
              </div>
            ) : matches.length ? matches.map((match) => {
              const open = isMatchOpen(match);
              const current = scores[match.id] || { home: '', away: '' };

              return (
                <div key={match.id} className="rounded-[1.6rem] border border-white/[0.07] bg-white/[0.04] p-4 md:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">
                        <span className="rounded-full bg-white/[0.06] px-2 py-1">{match.league}</span>
                        <span className={cn('rounded-full px-2 py-1', open ? 'bg-emerald-300/10 text-[#f4d36f]' : 'bg-zinc-700/30 text-zinc-500')}>
                          {open ? lobbyExtraText(pageContent, 'openStatus', 'Tahmine aÃ§Ä±k') : match.status === 'finished' ? lobbyExtraText(pageContent, 'finishedStatus', 'SonuÃ§landÄ±') : lobbyExtraText(pageContent, 'closedStatus', 'KapalÄ±')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <TeamBadge logoUrl={resolveTeamLogoUrl(match.homeLogoUrl)} alt={match.homeTeam} />
                        <h3 className="truncate text-xl font-black text-white">{match.homeTeam} - {match.awayTeam}</h3>
                        <TeamBadge logoUrl={resolveTeamLogoUrl(match.awayLogoUrl)} alt={match.awayTeam} />
                      </div>
                      <p className="mt-2 flex items-center gap-2 text-xs font-bold text-zinc-500">
                        <CalendarClock size={14} /> {formatMatchDate(match.startsAt)}
                      </p>
                    </div>

                    <div className="grid grid-cols-[72px_18px_72px_48px] items-center gap-2">
                      <ScoreInput value={current.home} disabled={!activeUser || !open} onChange={(value) => setScores({ ...scores, [match.id]: { ...current, home: value } })} />
                      <span className="text-center text-zinc-600">:</span>
                      <ScoreInput value={current.away} disabled={!activeUser || !open} onChange={(value) => setScores({ ...scores, [match.id]: { ...current, away: value } })} />
                      <button
                        type="button"
                        disabled={!activeUser || !open || savingMatchId === match.id}
                        onClick={() => submitPrediction(match)}
                        aria-label={lobbyExtraText(pageContent, 'submitAria', 'Tahmini gÃ¶nder')}
                        className="flex h-12 items-center justify-center rounded-2xl bg-[#d4af37] text-black disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {savingMatchId === match.id ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-[1.6rem] border border-white/[0.07] bg-white/[0.035] p-10 text-center text-sm font-bold text-zinc-500">
                {pageContent.emptyTitle}
              </div>
            )}
          </section>

          <aside className="space-y-3">
            <div className="rounded-[1.6rem] border border-[#d4af37]/20 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f4d36f]">Skor tablosu</p>
                <div className="flex rounded-xl border border-white/[0.08] bg-black/25 p-1 text-[9px] font-black uppercase tracking-wider">
                  <button type="button" onClick={() => setBoardPeriod('weekly')} className={cn('rounded-lg px-2.5 py-1.5', boardPeriod === 'weekly' ? 'bg-[#d4af37] text-black' : 'text-zinc-500')}>HaftalÄ±k</button>
                  <button type="button" onClick={() => setBoardPeriod('monthly')} className={cn('rounded-lg px-2.5 py-1.5', boardPeriod === 'monthly' ? 'bg-[#d4af37] text-black' : 'text-zinc-500')}>AylÄ±k</button>
                </div>
              </div>
              <p className="mt-3 rounded-xl border border-[#d4af37]/15 bg-[#d4af37]/[0.06] px-3 py-2 text-[11px] font-bold text-[#ead8a4]">{boardPeriod === 'weekly' ? league?.rewards?.weekly?.label : league?.rewards?.monthly?.label}</p>
              <div className="mt-3 space-y-2">
                {leaderboard.slice(0, 10).map((item: any, index: number) => (
                  <div key={item.username} className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/25 px-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Medal size={18} className={index === 0 ? 'text-[#f4d36f]' : 'text-zinc-500'} />
                      <span className="truncate text-sm font-black text-white">{maskUsername(item.username)}</span>
                    </div>
                    <span className="text-sm font-black text-[#f4d36f]">{item.points}P</span>
                  </div>
                ))}
                {!leaderboard.length && <p className="py-6 text-center text-xs font-bold text-zinc-600">Ä°lk tahmini bekliyor.</p>}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function TeamBadge({ logoUrl, alt }: { logoUrl: string | null; alt: string }) {
  if (!logoUrl) return null;

  return (
    <img
      src={logoUrl}
      alt={alt}
      className="h-8 w-8 rounded-full border border-white/10 object-contain bg-black/30"
      onError={(event) => {
        const target = event.currentTarget as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}

function ScoreInput({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 rounded-2xl border border-white/[0.08] bg-black/35 text-center text-lg font-black text-white outline-none focus:border-[#f4d36f]/40 disabled:text-zinc-700"
    />
  );
}

function isMatchOpen(match: Match) {
  const startsAt = match.startsAt ? new Date(match.startsAt).getTime() : null;
  return match.status === 'open' && (!startsAt || startsAt > Date.now());
}

function formatMatchDate(value: string) {
  if (!value) return 'Tarih seÃ§ilmedi';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function maskUsername(username: string) {
  if (!username) return '*****';
  return `${username.slice(0, 2)}***${username.slice(-1)}`;
}
