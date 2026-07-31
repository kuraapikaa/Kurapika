import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Medal, Trophy, Zap } from 'lucide-react';
import { gamesApi } from '../../api/client';
import { TournamentPeriodSwitch } from './TournamentPeriodSwitch';
import { lobbyExtraText, renderLobbyTemplate } from '../../lib/lobbyContent';
import { useLobbyPageTheme, hexToRgba } from '../../lib/lobbyTheme';
import { LobbyPageShell, LobbyCard } from './LobbyPageShell';

interface LeaderboardItem {
  PlayerId: number;
  UserName: string;
  Name: string;
  BetAmount: number;
  WinAmount: number;
  Profit: number;
  Round: number;
}

export type TournamentPeriod = 'gunluk' | 'haftalik' | 'aylik';

type PeriodConfig = {
  /** tournamentApi.getSettings() içindeki anahtar. */
  settingsKey: TournamentPeriod;
  /** Skor tablosunun kaç gün geriye bakacağı (günlükte 0 = bugün). */
  lookbackDays: number;
  /** Ödül havuzu, ayarlardan gelmezse gösterilecek değer. */
  fallbackPrize: string;
  /** pageContent.extra içindeki dönem etiketi anahtarı ve varsayılanı. */
  labelKey: string;
  labelFallback: string;
};

const PERIODS: Record<TournamentPeriod, PeriodConfig> = {
  gunluk: { settingsKey: 'gunluk', lookbackDays: 0, fallbackPrize: '50.000', labelKey: 'dailyLabel', labelFallback: 'GÜNLÜK' },
  haftalik: { settingsKey: 'haftalik', lookbackDays: 7, fallbackPrize: '250.000', labelKey: 'weeklyLabel', labelFallback: 'HAFTALIK' },
  aylik: { settingsKey: 'aylik', lookbackDays: 30, fallbackPrize: '500.000', labelKey: 'monthlyLabel', labelFallback: 'AYLIK' },
};

/**
 * Günlük/haftalık/aylık turnuva sayfalarının ortak gövdesi. Üç sayfa daha önce
 * birbirinin kopyasıydı ve ayrı ayrı güncellenmek zorundaydı; tek fark dönemin
 * tarih aralığı, ayar anahtarı ve varsayılan ödülü.
 */
export function TournamentLeaderboardPage({ period }: { period: TournamentPeriod }) {
  const cfg = PERIODS[period];
  const { content: pageContent, palette, rootStyle, backgroundStyle } = useLobbyPageTheme('tournament');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [prize, setPrize] = useState(cfg.fallbackPrize);
  const [liveTitle, setLiveTitle] = useState('');
  const [isActive, setIsActive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setPrize(cfg.fallbackPrize);
      setLiveTitle('');
      setIsActive(null);
      try {
        // OYUNCUYA ACIK uclar.
        //
        // Onceden /tournament/leaderboard ve /admin/tournaments/settings
        // cagriliyordu; ikisi de dashboard altinda ve authGuard'in
        // arkasinda. Oyuncunun panel oturumu olmadigi icin her istek 401
        // doniyor, sayfa hep bos ve "0 Oyuncu" gorunuyordu.
        const [ayarSonuc, siraSonuc] = await Promise.allSettled([
          gamesApi.tournamentPublicSettings(),
          gamesApi.tournamentLeaderboard(period, 20),
        ]);
        if (cancelled) return;

        if (ayarSonuc.status === 'fulfilled' && ayarSonuc.value?.ok) {
          const periodSettings = ayarSonuc.value.data?.[cfg.settingsKey];
          if (periodSettings?.prize) setPrize(periodSettings.prize);
          if (typeof periodSettings?.title === 'string' && periodSettings.title.trim()) {
            setLiveTitle(periodSettings.title.trim());
          }
          if (typeof periodSettings?.isActive === 'boolean') setIsActive(periodSettings.isActive);
        }

        if (siraSonuc.status === 'fulfilled' && siraSonuc.value?.ok) {
          const rows = siraSonuc.value.data?.rows ?? [];
          setData(rows.map((row: any) => ({
            PlayerId: 0,
            // Sunucu kullanici adini maskeli donuyor (A***): uc herkese
            // acik, tam ad + bahis hacmi birlikte yayinlanmamali.
            UserName: row.oyuncu,
            Name: row.oyuncu,
            BetAmount: Number(row.bahis) || 0,
            WinAmount: Number(row.kazanc) || 0,
            Profit: (Number(row.kazanc) || 0) - (Number(row.bahis) || 0),
            Round: 0,
          })));
        } else {
          setData([]);
        }
      } catch (error) {
        console.error('Leaderboard fetch error:', error);
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [period, cfg.settingsKey, cfg.lookbackDays, cfg.fallbackPrize]);

  const periodLabel = lobbyExtraText(pageContent, cfg.labelKey, cfg.labelFallback);
  const prizePoolTitle = lobbyExtraText(pageContent, 'prizePoolTitle', 'ÖDÜL HAVUZU');

  return (
    <LobbyPageShell
      active="tournament"
      palette={palette}
      rootStyle={rootStyle}
      backgroundStyle={backgroundStyle}
      eyebrow={pageContent.eyebrow}
      title={liveTitle || pageContent.title}
      subtitle={renderLobbyTemplate(pageContent.subtitle, { period: periodLabel })}
      wide
      aside={
        <div
          className="rounded-xl border px-3 py-2"
          style={{
            borderColor: hexToRgba(palette.accentColor, 0.24),
            backgroundColor: hexToRgba(palette.accentColor, 0.1),
          }}
        >
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--lobby-muted,#8f8674)]">{prizePoolTitle}</p>
          <p
            className="mt-0.5 text-2xl font-black leading-none tracking-[-0.04em] tabular-nums"
            style={{ color: palette.accentColor }}
          >
            {prize}₺
          </p>
        </div>
      }
      toolbar={
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black"
              style={{
                borderColor: hexToRgba(palette.accentColor, 0.22),
                backgroundColor: hexToRgba(palette.accentColor, 0.1),
                color: palette.accentColor,
              }}
            >
              <Zap size={12} />
              {periodLabel} {lobbyExtraText(pageContent, 'tournamentSuffix', 'TURNUVA')}
            </span>
            <span className="rounded-lg border border-[rgba(243,236,221,0.08)] bg-[rgba(243,236,221,0.05)] px-2.5 py-1.5 text-[10px] font-black text-[color:var(--lobby-text,#f3ecdd)]">
              {lobbyExtraText(pageContent, 'liveLabel', 'Anlık')}
            </span>
            {isActive === false ? (
              <span className="rounded-lg border border-rose-300/15 bg-rose-400/10 px-2.5 py-1.5 text-[10px] font-black text-rose-200">
                {pageContent.unavailableTitle}
              </span>
            ) : (
              <span className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.08] px-2.5 py-1.5 text-[10px] font-black tabular-nums text-emerald-300">
                {data.length} {lobbyExtraText(pageContent, 'playerColumn', 'Oyuncu')}
              </span>
            )}
          </div>
          <TournamentPeriodSwitch active={period} />
        </div>
      }
    >
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <LobbyCard padded={false}>
          <div className="flex items-baseline justify-between gap-3 px-3.5 pb-2.5 pt-3.5 md:px-4">
            <h2 className="flex min-w-0 items-center gap-2 truncate text-[13px] font-black tracking-[-0.02em] text-[color:var(--lobby-text,#f3ecdd)]">
              <Trophy size={14} style={{ color: palette.accentColor }} />
              {lobbyExtraText(pageContent, 'leaderboardTitle', 'Sıralama')}
            </h2>
            <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)]">
              {lobbyExtraText(pageContent, 'updateLabel', 'GÜNCELLEME')}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] border-collapse text-left">
              <thead>
                <tr className="border-y border-[rgba(243,236,221,0.05)] bg-[rgba(243,236,221,0.02)]">
                  <th className="sticky top-0 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)] md:px-4">
                    {lobbyExtraText(pageContent, 'rankColumn', 'Sıra')}
                  </th>
                  <th className="sticky top-0 px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)]">
                    {lobbyExtraText(pageContent, 'playerColumn', 'Oyuncu')}
                  </th>
                  <th className="sticky top-0 px-2 py-1.5 text-right text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)]">
                    {lobbyExtraText(pageContent, 'betColumn', 'Bahis')}
                  </th>
                  <th className="sticky top-0 px-3 py-1.5 text-right text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)] md:px-4">
                    {lobbyExtraText(pageContent, 'winColumn', 'Kazanç')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <Loader2 className="mx-auto animate-spin" size={22} style={{ color: palette.accentColor }} />
                      <p className="mt-2 text-[11px] font-bold text-[color:var(--lobby-muted,#8f8674)]">{pageContent.loadingText}</p>
                    </td>
                  </tr>
                ) : data.length ? (
                  data.map((player, index) => (
                    <tr key={player.PlayerId} className="transition hover:bg-[rgba(243,236,221,0.02)]">
                      <td className="px-3 py-2 md:px-4">
                        {index < 3 ? (
                          <Medal
                            size={15}
                            aria-label={index === 0 ? 'Birinci' : index === 1 ? 'İkinci' : 'Üçüncü'}
                            style={{ color: index === 0 ? palette.accentColor : index === 1 ? '#a1a1aa' : '#b45309' }}
                          />
                        ) : (
                          <span className="text-[11px] font-black tabular-nums text-[color:var(--lobby-muted,#8f8674)]">{index + 1}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-[12px] font-black uppercase text-[color:var(--lobby-text,#f3ecdd)]">
                        {player.UserName?.slice(0, 3)}***{player.UserName?.slice(-2)}
                      </td>
                      <td className="px-2 py-2 text-right text-[12px] font-black tabular-nums text-[color:var(--lobby-muted,#8f8674)]">
                        ₺{player.BetAmount.toLocaleString('tr-TR')}
                      </td>
                      <td className="px-3 py-2 text-right text-[12px] font-black tabular-nums text-emerald-400 md:px-4">
                        ₺{player.WinAmount.toLocaleString('tr-TR')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <p className="text-sm font-black text-[color:var(--lobby-text,#f3ecdd)]">{pageContent.emptyTitle}</p>
                      <p className="mt-1 text-[12px] font-medium text-[color:var(--lobby-muted,#8f8674)]">{pageContent.emptyDescription}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </LobbyCard>
      </motion.div>
    </LobbyPageShell>
  );
}
