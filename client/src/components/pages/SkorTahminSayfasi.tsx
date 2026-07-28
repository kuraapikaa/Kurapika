import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Loader2, Medal, Send, Trophy, User } from 'lucide-react';
import { bonusPanelApi, gamesApi } from '../../api/client';
import { cn, resolveTeamLogoUrl } from '../../lib/utils';
import { lobbyExtraText } from '../../lib/lobbyContent';
import { useLobbyPageTheme, hexToRgba, type LobbyPalette } from '../../lib/lobbyTheme';
import { useOtomatikOturum } from '../../lib/useParentUsername';
import { LobbyPageShell, LobbyCard, LobbyIdentityBar, LobbySectionTitle } from './LobbyPageShell';

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
  const { content: pageContent, palette, rootStyle, backgroundStyle } = useLobbyPageTheme('prediction');
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

  // Ana sitede giriş yapmış oyuncunun kimliği (iframe -> postMessage).
  // Panel oturumunu da kurar; aksi halde sunucu uçları 401 döner.
  const { username: otoAd } = useOtomatikOturum();
  useEffect(() => {
    if (!otoAd) return;
    setActiveUser(otoAd);
    setUsername(otoAd);
  }, [otoAd]);

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
        setMessage(lobbyExtraText(pageContent, 'userNotFoundError', 'Kullanıcı adı bulunamadı.'));
      }
    } catch {
      setMessage(lobbyExtraText(pageContent, 'connectionError', 'Bağlantı hatası oluştu.'));
    } finally {
      setChecking(false);
    }
  };

  const submitPrediction = async (match: Match) => {
    const current = scores[match.id] || { home: '', away: '' };
    const homeScore = Number(current.home);
    const awayScore = Number(current.away);

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      setMessage(lobbyExtraText(pageContent, 'validScoreError', 'Lütfen geçerli skor girin.'));
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

  const rewardLabel = boardPeriod === 'weekly' ? league?.rewards?.weekly?.label : league?.rewards?.monthly?.label;
  const dateFallback = lobbyExtraText(pageContent, 'dateUnknown', 'Tarih seçilmedi');

  return (
    <LobbyPageShell
      active="prediction"
      palette={palette}
      rootStyle={rootStyle}
      backgroundStyle={backgroundStyle}
      eyebrow={pageContent.eyebrow}
      title={league?.title || pageContent.title}
      subtitle={league?.description || pageContent.subtitle}
      wide
      aside={
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl border"
          style={{
            borderColor: hexToRgba(palette.accentColor, 0.24),
            backgroundColor: hexToRgba(palette.accentColor, 0.12),
            color: palette.accentColor,
          }}
        >
          <Trophy size={20} />
        </span>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {activeUser && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-black text-white">
              <User size={12} style={{ color: palette.accentColor }} />
              {activeUser}
            </span>
          )}
          <span
            className="rounded-lg border px-2.5 py-1.5 text-[10px] font-black tabular-nums"
            style={{
              borderColor: hexToRgba(palette.accentColor, 0.22),
              backgroundColor: hexToRgba(palette.accentColor, 0.1),
              color: palette.accentColor,
            }}
          >
            {openMatches.length} {lobbyExtraText(pageContent, 'openStatus', 'Tahmine açık')}
          </span>
          <span className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 text-[10px] font-black text-zinc-500">
            {matches.length} {lobbyExtraText(pageContent, 'matchesTitle', 'Tahmin maçları')}
          </span>
        </div>
      }
    >
      {!activeUser && (
        <LobbyIdentityBar
          palette={palette}
          label={pageContent.formTitle}
          placeholder={pageContent.usernamePlaceholder}
          value={username}
          onChange={setUsername}
          onSubmit={handleCheck}
          submitLabel={pageContent.submitButton}
          busy={checking}
          icon={checking ? <Loader2 size={17} className="animate-spin" /> : <User size={17} />}
          message={<p className="text-[11px] font-medium text-zinc-600">{pageContent.formDescription}</p>}
        />
      )}

      {message && (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-zinc-300">
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <LobbyCard padded={false}>
          <div className="px-3.5 pb-2 pt-3.5 md:px-4">
            <LobbySectionTitle
              title={lobbyExtraText(pageContent, 'matchesTitle', 'Tahmin maçları')}
              action={`${openMatches.length}/${matches.length}`}
            />
          </div>

          {loading ? (
            <div className="flex min-h-[180px] items-center justify-center">
              <Loader2 className="animate-spin" size={22} style={{ color: palette.accentColor }} />
            </div>
          ) : matches.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {matches.map((match, index) => {
                const open = isMatchOpen(match);
                const current = scores[match.id] || { home: '', away: '' };
                const finished = match.status === 'finished' && match.homeScore !== null && match.awayScore !== null;

                return (
                  <motion.li
                    key={match.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.025, 0.2) }}
                    className="flex flex-col gap-2.5 px-3.5 py-2.5 transition hover:bg-white/[0.02] md:flex-row md:items-center md:justify-between md:gap-3 md:px-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em]">
                        <span className="rounded-lg bg-white/[0.06] px-1.5 py-1 text-zinc-500">{match.league}</span>
                        <span
                          className={cn(
                            'rounded-lg px-1.5 py-1',
                            open ? '' : match.status === 'finished' ? 'bg-emerald-300/10 text-emerald-300' : 'bg-white/[0.04] text-zinc-600'
                          )}
                          style={open ? { backgroundColor: hexToRgba(palette.accentColor, 0.12), color: palette.accentColor } : undefined}
                        >
                          {open
                            ? lobbyExtraText(pageContent, 'openStatus', 'Tahmine açık')
                            : match.status === 'finished'
                              ? lobbyExtraText(pageContent, 'finishedStatus', 'Sonuçlandı')
                              : lobbyExtraText(pageContent, 'closedStatus', 'Kapalı')}
                        </span>
                        {finished && (
                          <span className="rounded-lg bg-white/[0.06] px-1.5 py-1 tabular-nums text-white">
                            {match.homeScore} - {match.awayScore}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">
                        <TeamBadge logoUrl={resolveTeamLogoUrl(match.homeLogoUrl)} alt={match.homeTeam} />
                        <h3 className="truncate text-[12px] font-black leading-tight text-white md:text-[13px]">
                          {match.homeTeam} - {match.awayTeam}
                        </h3>
                        <TeamBadge logoUrl={resolveTeamLogoUrl(match.awayLogoUrl)} alt={match.awayTeam} />
                      </div>

                      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
                        <CalendarClock size={12} /> {formatMatchDate(match.startsAt, dateFallback)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <ScoreInput
                        value={current.home}
                        palette={palette}
                        disabled={!activeUser || !open}
                        onChange={(value) => setScores({ ...scores, [match.id]: { ...current, home: value } })}
                      />
                      <span className="text-[11px] font-black text-zinc-700">:</span>
                      <ScoreInput
                        value={current.away}
                        palette={palette}
                        disabled={!activeUser || !open}
                        onChange={(value) => setScores({ ...scores, [match.id]: { ...current, away: value } })}
                      />
                      <button
                        type="button"
                        disabled={!activeUser || !open || savingMatchId === match.id}
                        onClick={() => submitPrediction(match)}
                        aria-label={lobbyExtraText(pageContent, 'submitAria', 'Tahmini gönder')}
                        className="ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-white transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.secondaryColor})`,
                          boxShadow: `0 8px 22px ${hexToRgba(palette.primaryColor, 0.26)}`,
                        }}
                      >
                        {savingMatchId === match.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-black text-white">{pageContent.emptyTitle}</p>
              <p className="mt-1 text-[12px] font-medium text-zinc-500">{pageContent.emptyDescription}</p>
            </div>
          )}
        </LobbyCard>

        <div className="flex flex-col gap-3.5">
          <LobbyCard className="relative overflow-hidden">
            <img
              src={monthlyPlayer.imageUrl || '/assets/brand/narcosbahis.png'}
              alt={monthlyPlayer.title || lobbyExtraText(pageContent, 'monthlyPlayerTitle', 'Ayın oyuncusu')}
              className="pointer-events-none absolute -bottom-5 -right-5 h-24 w-24 object-contain opacity-25"
            />
            <div className="relative z-10 max-w-[78%]">
              <p className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: palette.accentColor }}>
                {monthlyPlayer.title || lobbyExtraText(pageContent, 'monthlyPlayerTitle', 'Ayın oyuncusu')}
              </p>
              <p className="mt-1.5 text-[13px] font-black leading-tight tracking-[-0.02em] text-white">
                {monthlyPlayer.mainText || league?.prize || lobbyExtraText(pageContent, 'prizePoolLabel', 'Ödül havuzu')}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold leading-4" style={{ color: palette.mutedTextColor }}>
                {monthlyPlayer.subtitle || league?.rewards?.monthly?.label || league?.rules}
              </p>
            </div>
          </LobbyCard>

          <LobbyCard padded={false}>
            <div className="flex items-center justify-between gap-2 px-3.5 pb-2.5 pt-3.5 md:px-4">
              <h2 className="truncate text-[13px] font-black tracking-[-0.02em] text-white">
                {lobbyExtraText(pageContent, 'leaderboardTitle', 'Skor tablosu')}
              </h2>
              <div className="flex shrink-0 rounded-xl border border-white/[0.08] bg-black/25 p-1">
                {(['weekly', 'monthly'] as const).map((period) => {
                  const isActive = boardPeriod === period;
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setBoardPeriod(period)}
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] transition',
                        isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                      )}
                      style={
                        isActive
                          ? { background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.secondaryColor})` }
                          : undefined
                      }
                    >
                      {period === 'weekly'
                        ? lobbyExtraText(pageContent, 'weeklyTab', 'Haftalık')
                        : lobbyExtraText(pageContent, 'monthlyTab', 'Aylık')}
                    </button>
                  );
                })}
              </div>
            </div>

            {rewardLabel && (
              <p
                className="mx-3.5 mb-2.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold md:mx-4"
                style={{
                  borderColor: hexToRgba(palette.primaryColor, 0.18),
                  backgroundColor: hexToRgba(palette.primaryColor, 0.08),
                  color: palette.mutedTextColor,
                }}
              >
                {rewardLabel}
              </p>
            )}

            <div className="overflow-x-auto pb-1">
              {leaderboard.length ? (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-y border-white/[0.05] bg-white/[0.02]">
                      <th className="sticky top-0 px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 md:px-4">#</th>
                      <th className="sticky top-0 px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                        {lobbyExtraText(pageContent, 'playerColumn', 'Oyuncu')}
                      </th>
                      <th className="sticky top-0 px-3.5 py-1.5 text-right text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 md:px-4">
                        {lobbyExtraText(pageContent, 'pointsColumn', 'Puan')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {leaderboard.slice(0, 10).map((item: any, index: number) => (
                      <tr key={item.username} className="transition hover:bg-white/[0.02]">
                        <td className="px-3.5 py-2 md:px-4">
                          {index < 3 ? (
                            <Medal size={14} style={{ color: index === 0 ? palette.accentColor : index === 1 ? '#a1a1aa' : '#b45309' }} />
                          ) : (
                            <span className="text-[11px] font-black tabular-nums text-zinc-600">{index + 1}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-[12px] font-black text-white">{maskUsername(item.username)}</td>
                        <td className="px-3.5 py-2 text-right text-[12px] font-black tabular-nums md:px-4" style={{ color: palette.accentColor }}>
                          {item.points}P
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-4 py-8 text-center text-[11px] font-bold text-zinc-600">
                  {lobbyExtraText(pageContent, 'leaderboardEmpty', 'İlk tahmini bekliyor.')}
                </p>
              )}
            </div>
          </LobbyCard>
        </div>
      </div>
    </LobbyPageShell>
  );
}

function TeamBadge({ logoUrl, alt }: { logoUrl: string | null; alt: string }) {
  if (!logoUrl) return null;

  return (
    <img
      src={logoUrl}
      alt={alt}
      className="h-6 w-6 shrink-0 rounded-full border border-white/10 bg-black/30 object-contain"
      onError={(event) => {
        const target = event.currentTarget as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}

function ScoreInput({
  value,
  disabled,
  palette,
  onChange,
}: {
  value: string;
  disabled: boolean;
  palette: LobbyPalette;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-12 rounded-xl border border-white/[0.08] bg-black/35 text-center text-[13px] font-black text-white outline-none transition focus:border-[color:var(--lobby-primary)] disabled:text-zinc-700"
      style={{ caretColor: palette.accentColor }}
    />
  );
}

function isMatchOpen(match: Match) {
  const startsAt = match.startsAt ? new Date(match.startsAt).getTime() : null;
  return match.status === 'open' && (!startsAt || startsAt > Date.now());
}

function formatMatchDate(value: string, fallback: string) {
  if (!value) return fallback;
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
