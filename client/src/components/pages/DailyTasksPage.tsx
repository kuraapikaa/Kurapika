import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Gift, Loader2, Lock, Target, User, XCircle, Zap } from 'lucide-react';
import { bonusPanelApi, gamesApi } from '../../api/client';
import { cn } from '../../lib/utils';
import { LobbyMobileNav } from './LobbyMobileNav';
import { lobbyExtraText, type LobbyPageContent, useLobbyPageContent } from '../../lib/lobbyContent';

export function DailyTasksPage() {
  const { content: pageContent } = useLobbyPageContent('daily-tasks');
  const [username, setUsername] = useState('');
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [loginError, setLoginError] = useState('');
  const queryClient = useQueryClient();

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

  return (
    <div className="min-h-screen bg-[#05070c] pb-24 text-white">
      <LobbyMobileNav active="missions" />
      <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
        <header className="mb-5 rounded-[1.7rem] border border-white/[0.08] bg-gradient-to-br from-[#2a1907] via-[#100b04] to-[#05070c] p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d4af37]/25 bg-[#d4af37]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#f4d36f]">
                <Target size={13} />
                {pageContent.eyebrow}
              </div>
              <h1 className="text-3xl font-black tracking-[-0.055em] md:text-5xl">{data?.title || pageContent.title}</h1>
              {data?.description ? (
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-400">{data.description}</p>
              ) : <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-400">{pageContent.subtitle}</p>}
            </div>
            <Link to="/bonus-talep" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black uppercase tracking-widest text-black">
              {pageContent.primaryButton}
              <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        {!activeUser ? (
          <LoginCard
            username={username}
            checking={checking}
            error={loginError}
            content={pageContent}
            onUsernameChange={setUsername}
            onLogin={handleLogin}
          />
        ) : (
          <div className="space-y-5">
            <section className="flex flex-col gap-3 rounded-[1.4rem] border border-white/[0.08] bg-white/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d4af37]/10 text-[#f4d36f]">
                  <User size={21} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Aktif oyuncu</p>
                  <p className="text-sm font-black text-white">{activeUser}</p>
                </div>
              </div>
              <button type="button" onClick={handleLogout} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-300/15 bg-rose-400/10 px-4 text-xs font-black text-rose-200">
                <XCircle size={15} />
                {pageContent.secondaryButton}
              </button>
            </section>

            {tasksQuery.isLoading ? (
              <LoadingBlock />
            ) : tasksQuery.isError ? (
              <ErrorBlock message={(tasksQuery.error as any)?.message || pageContent.unavailableTitle} />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {tasks.map((task: any, index: number) => (
                  <motion.article
                    key={task.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={cn(
                      'rounded-[1.5rem] border p-4',
                      task.claimed
                        ? 'border-emerald-300/20 bg-emerald-300/10'
                        : task.completed
                          ? 'border-[#d4af37]/25 bg-[#d4af37]/10'
                          : 'border-white/[0.08] bg-white/[0.035]'
                    )}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-[#f4d36f]">
                        {task.claimed ? <CheckCircle2 size={23} /> : task.completed ? <Gift size={23} /> : <Lock size={22} />}
                      </div>
                      <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {task.metricLabel}
                      </span>
                    </div>

                    <h2 className="text-lg font-black tracking-[-0.035em] text-white">{task.title}</h2>
                    <p className="mt-1 min-h-[40px] text-xs font-medium leading-5 text-slate-500">{task.description}</p>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs font-black">
                        <span className="text-slate-500">{formatValue(task.value)} / {formatValue(task.target)}</span>
                        <span className="text-[#f4d36f]">{task.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-black/40">
                        <div className="h-full rounded-full bg-[#d4af37] transition-all" style={{ width: `${task.progress}%` }} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Ödül</p>
                        <p className="mt-0.5 text-xs font-black text-white">{task.rewardLabel || 'XP ödülü'}</p>
                      </div>
                      <span className="rounded-lg bg-amber-300/10 px-2.5 py-1 text-xs font-black text-amber-200">{task.xp || 0} XP</span>
                    </div>

                    <button
                      type="button"
                      disabled={!task.completed || task.claimed || claimMutation.isPending}
                      onClick={() => claimMutation.mutate(task.id)}
                      className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-xs font-black uppercase tracking-widest text-black transition disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-600"
                    >
                      {claimMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                      {task.claimed
                        ? lobbyExtraText(pageContent, 'claimedButton', 'Alındı')
                        : task.completed
                          ? lobbyExtraText(pageContent, 'claimButton', 'Ödülü Al')
                          : lobbyExtraText(pageContent, 'incompleteButton', 'Tamamlanmadı')}
                    </button>
                  </motion.article>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function LoginCard({ username, checking, error, content, onUsernameChange, onLogin }: { username: string; checking: boolean; error: string; content: LobbyPageContent; onUsernameChange: (value: string) => void; onLogin: () => void }) {
  return (
    <section className="mx-auto max-w-md rounded-[1.5rem] border border-white/[0.08] bg-white/[0.04] p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d4af37]/10 text-[#f4d36f]">
          {checking ? <Loader2 size={22} className="animate-spin" /> : <User size={22} />}
        </div>
        <div>
          <h2 className="text-lg font-black text-white">{content.formTitle}</h2>
          <p className="text-xs font-medium text-slate-500">{content.formDescription}</p>
        </div>
      </div>
      <input
        value={username}
        onChange={(event) => onUsernameChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && onLogin()}
        placeholder={content.usernamePlaceholder}
        className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/50"
      />
      {error && <div className="mt-3 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-200">{error}</div>}
      <button type="button" disabled={!username.trim() || checking} onClick={onLogin} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] text-xs font-black uppercase tracking-widest text-black disabled:cursor-not-allowed disabled:opacity-60">
        {checking ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
        {content.submitButton}
      </button>
    </section>
  );
}

function LoadingBlock() {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] border border-white/[0.08] bg-white/[0.035]">
      <Loader2 className="animate-spin text-[#f4d36f]" size={30} />
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-[1.5rem] border border-rose-300/15 bg-rose-400/10 p-5 text-sm font-bold text-rose-100">
      {message}
    </div>
  );
}

function formatValue(value: number) {
  return Number(value || 0).toLocaleString('tr-TR');
}
