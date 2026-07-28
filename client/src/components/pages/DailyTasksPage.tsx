import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Gift, Loader2, Lock, User, XCircle, Zap } from 'lucide-react';
import { bonusPanelApi, gamesApi } from '../../api/client';
import { cn } from '../../lib/utils';
import { lobbyExtraText } from '../../lib/lobbyContent';
import { useLobbyPageTheme, hexToRgba, type LobbyPalette } from '../../lib/lobbyTheme';
import { useOtomatikOturum } from '../../lib/useParentUsername';
import { LobbyPageShell, LobbyCard, LobbyIdentityBar } from './LobbyPageShell';

export function DailyTasksPage() {
  const { content: pageContent, palette, rootStyle, backgroundStyle } = useLobbyPageTheme('daily-tasks');
  const [username, setUsername] = useState('');
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [loginError, setLoginError] = useState('');
  const queryClient = useQueryClient();

  // Ana sitede giriş yapmış oyuncunun kimliği (iframe -> postMessage).
  // Panel oturumunu da kurar; aksi halde sunucu uçları 401 döner.
  const { username: otoAd } = useOtomatikOturum();
  useEffect(() => {
    if (!otoAd) return;
    setActiveUser(otoAd);
  }, [otoAd]);

  useEffect(() => {
    bonusPanelApi.me().then((res) => {
      if (res.ok) {
        setActiveUser(res.login);
        localStorage.setItem('saved_username', res.login);
      } else {
        const saved = localStorage.getItem('saved_username');
        if (saved) setUsername(saved);
      }
    });
  }, []);

  const tasksQuery = useQuery({
    queryKey: ['daily-tasks-status', activeUser],
    queryFn: () => gamesApi.dailyTasksStatus(),
    enabled: !!activeUser,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const claimMutation = useMutation({
    mutationFn: (taskId: string) => gamesApi.claimDailyTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks-status'] });
      queryClient.invalidateQueries({ queryKey: ['battle-pass-status'] });
    },
  });

  const handleLogin = async () => {
    if (!username.trim() || checking) return;
    setChecking(true);
    setLoginError('');
    try {
      const res = await bonusPanelApi.login(username.trim());
      if (res.ok) {
        setActiveUser(res.login);
        localStorage.setItem('saved_username', res.login);
      } else {
        setLoginError(res.message || lobbyExtraText(pageContent, 'userNotFoundError', 'Kullanıcı doğrulanamadı.'));
      }
    } catch {
      setLoginError(lobbyExtraText(pageContent, 'connectionError', 'Bağlantı hatası oluştu.'));
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await bonusPanelApi.logout();
    setActiveUser(null);
    setUsername('');
    queryClient.removeQueries({ queryKey: ['daily-tasks-status'] });
  };

  const data = tasksQuery.data?.data;
  const tasks = data?.tasks || [];
  const claimedCount = tasks.filter((t: any) => t.claimed).length;
  const readyCount = tasks.filter((t: any) => t.completed && !t.claimed).length;

  return (
    <LobbyPageShell
      active="missions"
      palette={palette}
      rootStyle={rootStyle}
      backgroundStyle={backgroundStyle}
      eyebrow={pageContent.eyebrow}
      title={data?.title || pageContent.title}
      subtitle={data?.description || pageContent.subtitle}
      wide
      aside={
        <div className="flex items-center gap-2">
          {activeUser && (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-rose-200 transition hover:bg-rose-400/20"
            >
              <XCircle size={13} />
              {pageContent.secondaryButton}
            </button>
          )}
          <Link
            to="/bonus-talep"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[10px] font-black uppercase tracking-[0.12em] text-black transition active:scale-[0.98]"
          >
            {pageContent.primaryButton}
            <ArrowRight size={13} />
          </Link>
        </div>
      }
      toolbar={
        activeUser ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-black text-white">
              <User size={12} style={{ color: palette.accentColor }} />
              {activeUser}
            </span>
            <span className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.08] px-2.5 py-1.5 text-[10px] font-black text-emerald-300">
              {claimedCount} alındı
            </span>
            {readyCount > 0 && (
              <span
                className="rounded-lg border px-2.5 py-1.5 text-[10px] font-black"
                style={{
                  borderColor: hexToRgba(palette.accentColor, 0.22),
                  backgroundColor: hexToRgba(palette.accentColor, 0.1),
                  color: palette.accentColor,
                }}
              >
                {readyCount} ödül hazır
              </span>
            )}
            <span className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 text-[10px] font-black text-zinc-500">
              {tasks.length} görev
            </span>
          </div>
        ) : undefined
      }
    >
      {!activeUser ? (
        <div className="mx-auto w-full max-w-xl">
          <LobbyIdentityBar
            palette={palette}
            label={pageContent.formTitle}
            placeholder={pageContent.usernamePlaceholder}
            value={username}
            onChange={setUsername}
            onSubmit={handleLogin}
            submitLabel={pageContent.submitButton}
            busy={checking}
            icon={checking ? <Loader2 size={17} className="animate-spin" /> : <User size={17} />}
            message={
              loginError ? (
                <p className="rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-1.5 text-[11px] font-bold text-rose-200">{loginError}</p>
              ) : (
                <p className="text-[11px] font-medium text-zinc-600">{pageContent.formDescription}</p>
              )
            }
          />
        </div>
      ) : tasksQuery.isLoading ? (
        <LobbyCard className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="animate-spin" size={24} style={{ color: palette.accentColor }} />
        </LobbyCard>
      ) : tasksQuery.isError ? (
        <LobbyCard className="border-rose-300/15 bg-rose-400/[0.07]">
          <p className="text-[12px] font-bold text-rose-100">
            {(tasksQuery.error as any)?.message || pageContent.unavailableTitle}
          </p>
        </LobbyCard>
      ) : tasks.length === 0 ? (
        <LobbyCard className="py-10 text-center">
          <p className="text-sm font-black text-white">{pageContent.emptyTitle}</p>
          <p className="mt-1 text-[12px] font-medium text-zinc-500">{pageContent.emptyDescription}</p>
        </LobbyCard>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task: any, index: number) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              palette={palette}
              busy={claimMutation.isPending}
              onClaim={() => claimMutation.mutate(task.id)}
              claimedLabel={lobbyExtraText(pageContent, 'claimedButton', 'Alındı')}
              claimLabel={lobbyExtraText(pageContent, 'claimButton', 'Ödülü Al')}
              incompleteLabel={lobbyExtraText(pageContent, 'incompleteButton', 'Tamamlanmadı')}
            />
          ))}
        </div>
      )}
    </LobbyPageShell>
  );
}

function TaskCard({
  task,
  index,
  palette,
  busy,
  onClaim,
  claimedLabel,
  claimLabel,
  incompleteLabel,
}: {
  task: any;
  index: number;
  palette: LobbyPalette;
  busy: boolean;
  onClaim: () => void;
  claimedLabel: string;
  claimLabel: string;
  incompleteLabel: string;
}) {
  const canClaim = task.completed && !task.claimed;
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.24) }}
      className={cn(
        'flex flex-col rounded-2xl border p-3 backdrop-blur-2xl transition',
        task.claimed
          ? 'border-emerald-300/20 bg-emerald-300/[0.07]'
          : canClaim
            ? 'border-white/15 bg-white/[0.06]'
            : 'border-white/[0.075] bg-white/[0.032]'
      )}
      style={canClaim ? { borderColor: hexToRgba(palette.accentColor, 0.28) } : undefined}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/25"
          style={{ color: task.claimed ? '#6ee7b7' : palette.accentColor }}
        >
          {task.claimed ? <CheckCircle2 size={17} /> : task.completed ? <Gift size={17} /> : <Lock size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13px] font-black leading-tight text-white">{task.title}</h2>
          <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-zinc-500">{task.description}</p>
        </div>
        {task.metricLabel && (
          <span className="shrink-0 rounded border border-white/10 bg-black/25 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-zinc-500">
            {task.metricLabel}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-black">
          <span className="tabular-nums text-zinc-500">
            {formatValue(task.value)} / {formatValue(task.target)}
          </span>
          <span className="tabular-nums" style={{ color: palette.accentColor }}>{task.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, Math.max(0, Number(task.progress) || 0))}%`,
              background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.accentColor})`,
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-2.5 py-2">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">Ödül</p>
          <p className="mt-0.5 truncate text-[11px] font-black text-white">{task.rewardLabel || 'XP ödülü'}</p>
        </div>
        <span className="shrink-0 rounded bg-amber-300/10 px-2 py-1 text-[11px] font-black tabular-nums text-amber-200">
          {task.xp || 0} XP
        </span>
      </div>

      <button
        type="button"
        disabled={!canClaim || busy}
        onClick={onClaim}
        className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.14em] transition active:scale-[0.99] disabled:cursor-not-allowed"
        style={
          canClaim
            ? { background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.secondaryColor})`, color: '#fff' }
            : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }
        }
      >
        {busy && canClaim ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
        {task.claimed ? claimedLabel : task.completed ? claimLabel : incompleteLabel}
      </button>
    </motion.article>
  );
}

function formatValue(value: number) {
  return Number(value || 0).toLocaleString('tr-TR');
}
