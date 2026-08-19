import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, ChevronDown, ChevronUp, Loader2, Medal, Send, Trophy, User } from 'lucide-react';
import { bonusPanelApi, gamesApi } from '@/api/client';
import { cn, resolveTeamLogoUrl } from '@/lib/utils';
import { lobbyExtraText } from '@/lib/lobbyContent';
import { useLobbyPageTheme, hexToRgba, type LobbyPalette } from '@/lib/lobbyTheme';
import { useOtomatikOturum } from '@/lib/useParentUsername';
import { LobbyPageShell, LobbyCard, LobbyIdentityBar, LobbySectionTitle } from '@/components/player/LobbyPageShell';

type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  /** Tahminlerin acildigi an; bos ise hemen acik. */
  predictionOpensAt?: string | null;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  league: string;
  startsAt: string;
  /** Tahminlerin kapandigi an; bos ise startsAt kullanilir. */
  predictionClosesAt?: string;
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
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(243,236,221,0.08)] bg-[rgba(243,236,221,0.05)] px-2.5 py-1.5 text-[10px] font-black text-[color:var(--lobby-text,#f3ecdd)]">
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
          <span className="rounded-lg border border-[rgba(243,236,221,0.06)] bg-black/25 px-2.5 py-1.5 text-[10px] font-black text-[color:var(--lobby-muted,#8f8674)]">
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
          message={<p className="text-[11px] font-medium text-[color:var(--lobby-muted,#8f8674)]">{pageContent.formDescription}</p>}
        />
      )}

      {message && (
        <p className="cam-kontrol px-3 py-2.5 text-[11px] font-bold text-[color:var(--lobby-text,#f3ecdd)]">
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
                    // MOBILE-FIRST: kart artik her ekranda DIKEY akiyor.
                    // Onceden md'de yatay satira gecip takim adlarini ve
                    // skoru ayni hizaya sikistiriyordu; 48px logolarla o
                    // duzen dar ekranda tasardi.
                    className="flex flex-col gap-3 px-3.5 py-4 transition hover:bg-[rgba(243,236,221,0.02)] md:px-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em]">
                        <span className="rounded-lg bg-[rgba(243,236,221,0.06)] px-1.5 py-1 text-[color:var(--lobby-muted,#8f8674)]">{match.league}</span>
                        <span
                          className={cn(
                            'rounded-lg px-1.5 py-1',
                            open ? '' : match.status === 'finished' ? 'bg-emerald-300/10 text-emerald-300' : 'bg-[rgba(243,236,221,0.04)] text-[color:var(--lobby-muted,#8f8674)]'
                          )}
                          style={open ? { backgroundColor: hexToRgba(palette.accentColor, 0.12), color: palette.accentColor } : undefined}
                        >
                          {open
                            ? lobbyExtraText(pageContent, 'openStatus', 'Tahmine açık')
                            : match.status === 'finished'
                              ? lobbyExtraText(pageContent, 'finishedStatus', 'Sonuçlandı')
                              : isMatchPending(match)
                                // "Kapalı" demek yaniltici olurdu: mac kapanmadi,
                                // HENUZ ACILMADI. Operator de oyuncu da farki bilmeli.
                                ? lobbyExtraText(pageContent, 'pendingStatus', 'Yakında')
                                : lobbyExtraText(pageContent, 'closedStatus', 'Kapalı')}
                        </span>
                        {finished && (
                          <span className="rounded-lg bg-[rgba(243,236,221,0.06)] px-1.5 py-1 tabular-nums text-[color:var(--lobby-text,#f3ecdd)]">
                            {match.homeScore} - {match.awayScore}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--lobby-muted,#8f8674)]">
                        <CalendarClock size={12} /> {formatMatchDate(match.startsAt, dateFallback)}
                      </p>
                    </div>

                    {/*
                      Referans duzen: ev armasi — skor — deplasman armasi.
                      Armalar `flex-1` ile esit pay aliyor, secici `shrink-0`;
                      uzun takim adi skoru yerinden oynatmiyor.
                    */}
                    <div className="flex items-start justify-center gap-2 sm:gap-4">
                      <TeamBadge logoUrl={resolveTeamLogoUrl(match.homeLogoUrl)} alt={match.homeTeam} />

                      <div className="flex shrink-0 items-center gap-1.5 pt-1 sm:gap-2">
                        <ScoreInput
                          label={`${match.homeTeam} skoru`}
                          value={current.home}
                          palette={palette}
                          disabled={!activeUser || !open}
                          onChange={(value) => setScores({ ...scores, [match.id]: { ...current, home: value } })}
                        />
                        <span className="text-[16px] font-black text-[color:var(--lobby-muted,#8f8674)]">:</span>
                        <ScoreInput
                          label={`${match.awayTeam} skoru`}
                          value={current.away}
                          palette={palette}
                          disabled={!activeUser || !open}
                          onChange={(value) => setScores({ ...scores, [match.id]: { ...current, away: value } })}
                        />
                      </div>

                      <TeamBadge logoUrl={resolveTeamLogoUrl(match.awayLogoUrl)} alt={match.awayTeam} />
                    </div>

                    {/*
                      Gonder tam genislikte: 40x40 ikon dugmesi dokunma
                      hedefinin altindaydi ve skorun yaninda kaybolyordu.
                    */}
                    <button
                      type="button"
                      disabled={!activeUser || !open || savingMatchId === match.id}
                      onClick={() => submitPrediction(match)}
                      className="dokunma flex w-full items-center justify-center gap-2 rounded-full px-4 text-[12px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-text,#f3ecdd)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.secondaryColor})`,
                        boxShadow: `0 8px 22px ${hexToRgba(palette.primaryColor, 0.26)}`,
                      }}
                    >
                      {savingMatchId === match.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      {lobbyExtraText(pageContent, 'submitAria', 'Tahmini gönder')}
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-black text-[color:var(--lobby-text,#f3ecdd)]">{pageContent.emptyTitle}</p>
              <p className="mt-1 text-[12px] font-medium text-[color:var(--lobby-muted,#8f8674)]">{pageContent.emptyDescription}</p>
            </div>
          )}
        </LobbyCard>

        <div className="flex flex-col gap-3.5">
          {/* Ayın oyuncusu: görsel özne, dekor değil.
              Önceden absolute + 96px + opacity-25 ile köşeye sıkışmış, arka
              plan dokusu gibi duruyordu. Artık akışta, tam opaklıkta ve
              metinle yan yana; arkasındaki altın hâle onu zeminden ayırıyor. */}
          <LobbyCard className="relative overflow-hidden">
            <div className="flex items-stretch gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: palette.accentColor }}>
                  {monthlyPlayer.title || lobbyExtraText(pageContent, 'monthlyPlayerTitle', 'Ayın oyuncusu')}
                </p>
                <p className="mt-1.5 text-[13px] font-black leading-tight tracking-[-0.02em] text-[color:var(--lobby-text,#f3ecdd)]">
                  {monthlyPlayer.mainText || league?.prize || lobbyExtraText(pageContent, 'prizePoolLabel', 'Ödül havuzu')}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold leading-4" style={{ color: palette.mutedTextColor }}>
                  {monthlyPlayer.subtitle || league?.rewards?.monthly?.label || league?.rules}
                </p>
              </div>
              <div className="relative flex w-[92px] shrink-0 items-end justify-center self-stretch">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[86px] rounded-full blur-[26px]"
                  style={{ backgroundColor: hexToRgba(palette.primaryColor, 0.22) }}
                />
                <img
                  src={monthlyPlayer.imageUrl || '/assets/brand/narcosbahis.png'}
                  alt={monthlyPlayer.title || lobbyExtraText(pageContent, 'monthlyPlayerTitle', 'Ayın oyuncusu')}
                  loading="lazy"
                  className="relative z-10 h-[104px] w-full object-contain object-bottom drop-shadow-[0_10px_20px_rgba(0,0,0,.45)]"
                />
              </div>
            </div>
          </LobbyCard>

          <LobbyCard padded={false}>
            <div className="flex items-center justify-between gap-2 px-3.5 pb-2.5 pt-3.5 md:px-4">
              <h2 className="truncate text-[13px] font-black tracking-[-0.02em] text-[color:var(--lobby-text,#f3ecdd)]">
                {lobbyExtraText(pageContent, 'leaderboardTitle', 'Skor tablosu')}
              </h2>
              <div className="flex shrink-0 rounded-xl border border-[rgba(243,236,221,0.08)] bg-black/25 p-1">
                {(['weekly', 'monthly'] as const).map((period) => {
                  const isActive = boardPeriod === period;
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setBoardPeriod(period)}
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] transition',
                        isActive ? 'text-[color:var(--lobby-text,#f3ecdd)]' : 'text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)]'
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
                    <tr className="border-y border-[rgba(243,236,221,0.05)] bg-[rgba(243,236,221,0.02)]">
                      <th className="sticky top-0 px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)] md:px-4">#</th>
                      <th className="sticky top-0 px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)]">
                        {lobbyExtraText(pageContent, 'playerColumn', 'Oyuncu')}
                      </th>
                      <th className="sticky top-0 px-3.5 py-1.5 text-right text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)] md:px-4">
                        {lobbyExtraText(pageContent, 'pointsColumn', 'Puan')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {leaderboard.slice(0, 10).map((item: any, index: number) => (
                      <tr key={item.username} className="transition hover:bg-[rgba(243,236,221,0.02)]">
                        <td className="px-3.5 py-2 md:px-4">
                          {index < 3 ? (
                            <Medal size={14} style={{ color: index === 0 ? palette.accentColor : index === 1 ? '#a1a1aa' : '#b45309' }} />
                          ) : (
                            <span className="text-[11px] font-black tabular-nums text-[color:var(--lobby-muted,#8f8674)]">{index + 1}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-[12px] font-black text-[color:var(--lobby-text,#f3ecdd)]">{maskUsername(item.username)}</td>
                        <td className="px-3.5 py-2 text-right text-[12px] font-black tabular-nums md:px-4" style={{ color: palette.accentColor }}>
                          {item.points}P
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-4 py-8 text-center text-[11px] font-bold text-[color:var(--lobby-muted,#8f8674)]">
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

/**
 * TAKIM ROZETI — logo + ad, dikey.
 *
 * Logo 24px'ti; referans tasarimda arma skorla ayni gorsel agirlikta.
 * 48px (mobil) / 56px (sm+) yapildi ve takim adi ALTINA alindi: eskiden
 * "Ev - Deplasman" tek satirda yazildigi icin uzun adlar kirpiliyordu
 * ("Istanbul Basaksehir" -> "Istanbul Bas...").
 *
 * Logo yoksa bilesen KAYBOLMUYOR; ad yine gerekiyor ve iki takim
 * hizasi bozulmamali. Yer tutucu olarak takimin bas harfi.
 */
function TeamBadge({ logoUrl, alt }: { logoUrl: string | null; alt: string }) {
  const basHarf = String(alt ?? '').trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-full border border-[rgba(243,236,221,0.10)] bg-black/30 object-contain p-1 sm:h-14 sm:w-14"
          onError={(event) => {
            // Kirik gorselde ikon yerine bas harfe dus; hiza korunur.
            const target = event.currentTarget as HTMLImageElement;
            target.style.display = 'none';
            const kardes = target.nextElementSibling as HTMLElement | null;
            if (kardes) kardes.style.display = 'flex';
          }}
        />
      ) : null}
      <span
        style={{ display: logoUrl ? 'none' : 'flex' }}
        aria-hidden="true"
        className="h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgba(243,236,221,0.10)] bg-black/30 text-[18px] font-black text-[color:var(--lobby-muted,#8f8674)] sm:h-14 sm:w-14"
      >
        {basHarf}
      </span>
      <span className="line-clamp-2 w-full text-center text-[11px] font-black leading-tight text-[color:var(--lobby-text,#f3ecdd)] sm:text-[12px]">
        {alt}
      </span>
    </div>
  );
}

const SKOR_TAVANI = 20;

/**
 * SKOR SECICI — yukari/asagi basamakli.
 *
 * Onceden `<input type="number">` idi. Telefonda uc sorunu vardi:
 *
 *   1. Sayisal klavye aciliyor, ekranin yarisini kapatiyordu; oyuncu bir
 *      skor icin klavye ac-kapa yapmak zorundaydi.
 *   2. Tarayicinin kendi ok dugmeleri masaustunde ~10px, dokunmatikte
 *      hic yok.
 *   3. Serbest metin: "-3", "999", "abc" yazilabiliyor, dogrulama
 *      gonderimde patliyordu.
 *
 * Basamakli secici klavye actirmiyor, hedefler 44px ve deger yapisal
 * olarak 0..SKOR_TAVANI arasinda kaliyor.
 */
function ScoreInput({
  value,
  disabled,
  palette,
  onChange,
  label,
}: {
  value: string;
  disabled: boolean;
  palette: LobbyPalette;
  onChange: (value: string) => void;
  label: string;
}) {
  const sayi = Number.parseInt(value, 10);
  const mevcut = Number.isFinite(sayi) && sayi >= 0 ? Math.min(sayi, SKOR_TAVANI) : 0;
  const yaz = (yeniDeger: number) => onChange(String(Math.max(0, Math.min(SKOR_TAVANI, yeniDeger))));

  /** Ok dugmesi: 44px dokunma hedefi, dokunmatikte hover yok. */
  const ok = (yon: 'yukari' | 'asagi') => (
    <button
      type="button"
      disabled={disabled || (yon === 'yukari' ? mevcut >= SKOR_TAVANI : mevcut <= 0)}
      onClick={() => yaz(yon === 'yukari' ? mevcut + 1 : mevcut - 1)}
      aria-label={`${label} ${yon === 'yukari' ? 'artır' : 'azalt'}`}
      className="dokunma flex w-full items-center justify-center text-[color:var(--lobby-muted,#8f8674)] transition active:scale-95 disabled:opacity-25"
    >
      {yon === 'yukari' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
    </button>
  );

  return (
    <div
      className="cam-kontrol flex w-[58px] shrink-0 flex-col items-center overflow-hidden sm:w-[64px]"
      role="group"
      aria-label={label}
    >
      {ok('yukari')}
      {/*
        Deger alani: `aria-live` ile ok'a basildiginda ekran okuyucu yeni
        skoru duyurur — gorsel degisiklik tek basina erisilebilir degil.
      */}
      <span
        aria-live="polite"
        className="flex h-11 w-full items-center justify-center border-y border-[rgba(243,236,221,0.06)] bg-black/25 text-[22px] font-black tabular-nums leading-none"
        style={{ color: disabled ? undefined : palette.textColor }}
      >
        {mevcut}
      </span>
      {ok('asagi')}
    </div>
  );
}

/**
 * Panelden gelen `datetime-local` dizgesi saat dilimi TASIMIYOR
 * (`2026-08-20T18:00`). Duz `new Date(...)` onu CIHAZIN dilimine gore
 * okur: Turkiye'deki oyuncu 18:00, Almanya'daki 17:00, sunucu (UTC) 21:00
 * anlar. Ayni mac ucunde uc farkli "kapanis" demekti.
 *
 * Istanbul ofseti acikca ekleniyor; sunucudaki `istanbulYerelAn` ile AYNI
 * kural. Dizgede dilim zaten varsa dokunulmaz.
 */
function istanbulAn(value?: string | null): number {
  const metin = String(value ?? '').trim();
  if (!metin) return Number.NaN;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(metin)) return new Date(metin).getTime();
  const m = metin.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/);
  if (!m) return new Date(metin).getTime();
  return new Date(`${m[1]}T${m[2]}${m[3] ?? ':00'}+03:00`).getTime();
}

/** Tahminler henuz acilmadi mi? */
function isMatchPending(match: Match) {
  const acilis = istanbulAn(match.predictionOpensAt);
  return Number.isFinite(acilis) && acilis > Date.now();
}

function isMatchOpen(match: Match) {
  // Sunucudaki tahminKapanisZamani ile ayni kural: acik son tarih varsa o,
  // yoksa baslama saati. Ikisi ayrisirsa arayuz "acik" gosterip sunucu
  // reddederdi.
  //
  // ACILIS de burada: ileri tarihli baslangic girilmis bir mac, kapanisi
  // gelmemis olsa bile ACIK DEGILDIR.
  if (isMatchPending(match)) return false;
  const acikKapanis = istanbulAn(match.predictionClosesAt);
  const kapanis = Number.isFinite(acikKapanis) ? acikKapanis : istanbulAn(match.startsAt);
  return match.status === 'open' && (!Number.isFinite(kapanis) || kapanis > Date.now());
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
