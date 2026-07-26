import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Crown, Gift, Layers, Loader2, Lock, Star, Trophy, User, XCircle, Zap } from 'lucide-react';
import { bonusPanelApi, gamesApi } from '../../api/client';
import { cn } from '../../lib/utils';
import { LobbyMobileNav } from './LobbyMobileNav';
import { lobbyExtraText, type LobbyPageContent, useLobbyPageContent } from '../../lib/lobbyContent';

export function BattlePassPage() {
  const { content: pageContent } = useLobbyPageContent('battle-pass');
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

  const passQuery = useQuery({
    queryKey: ['battle-pass-status', activeUser],
    queryFn: () => gamesApi.battlePassStatus(),
    enabled: !!activeUser,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const claimMutation = useMutation({
    mutationFn: (body: { level: number; track: 'free' | 'premium' }) => gamesApi.claimBattlePassReward(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['battle-pass-status'] }),
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
    queryClient.removeQueries({ queryKey: ['battle-pass-status'] });
  };

  const data = passQuery.data?.data;
  const levels = data?.levels || [];
  const xp = data?.xp || { total: 0, nextRequired: null, activity: 0, tasks: 0 };
  const nextRequired = Number(xp.nextRequired || 0);
  const progressToNext = nextRequired > 0 ? Math.min(100, Math.round((Number(xp.total || 0) / nextRequired) * 100)) : 100;
  const endsAtLabel = useMemo(() => data?.endsAt ? new Date(data.endsAt).toLocaleDateString('tr-TR') : '', [data?.endsAt]);

  return (
    <div className="min-h-screen bg-[#05070c] pb-24 text-white">
      <LobbyMobileNav active="missions" />
      <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
        <header className="mb-5 overflow-hidden rounded-[1.8rem] border border-amber-300/15 bg-gradient-to-br from-amber-950/45 via-[#0b0d13] to-[#05070c] p-5 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
                <Layers size={13} />
                {pageContent.eyebrow}
              </div>
              <h1 className="text-3xl font-black tracking-[-0.06em] md:text-5xl">{data?.title || pageContent.title}</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-400">{data?.description || pageContent.subtitle}</p>
            </div>
            <Link to="/gorevler" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black uppercase tracking-widest text-black">
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
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_180px]">
              <div className="rounded-[1.4rem] border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300">
                    <User size={21} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Aktif oyuncu</p>
                    <p className="truncate text-sm font-black text-white">{activeUser}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="mb-2 flex items-center justify-between text-xs font-black">
                  <span className="text-slate-500">Toplam XP</span>
                  <span className="text-amber-200">{Number(xp.total || 0).toLocaleString('tr-TR')} XP</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${progressToNext}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <span>Aktivite: {Number(xp.activity || 0).toLocaleString('tr-TR')}</span>
                  <span>{lobbyExtraText(pageContent, 'taskXpLabel', 'Görev')}: {Number(xp.tasks || 0).toLocaleString('tr-TR')}</span>
                  {endsAtLabel && <span>Bitiş: {endsAtLabel}</span>}
                </div>
              </div>

              <button type="button" onClick={handleLogout} className="inline-flex min-h-[54px] sm:min-h-[76px] items-center justify-center gap-2 sm:col-span-2 lg:col-span-1 rounded-[1.4rem] border border-rose-300/15 bg-rose-400/10 px-4 text-xs font-black text-rose-200">
                <XCircle size={15} />
                {pageContent.secondaryButton}
              </button>
            </section>

            {passQuery.isLoading ? (
              <LoadingBlock />
            ) : passQuery.isError ? (
              <ErrorBlock message={(passQuery.error as any)?.message || pageContent.unavailableTitle} />
            ) : (
              <div className="space-y-4">
                <div className="rounded-[1.4rem] border border-white/[0.08] bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge icon={Trophy} label={`Seviye ${data?.currentLevel || 0}`} />
                    <Badge icon={Star} label={`${Number(xp.total || 0).toLocaleString('tr-TR')} XP`} />
                    <Badge icon={Crown} label={data?.premiumEnabled ? 'Premium aktif' : 'Premium kapalı'} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {levels.map((level: any, index: number) => (
                    <motion.article
                      key={level.level}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.035 }}
                      className={cn(
                        'rounded-[1.5rem] border p-4',
                        level.unlocked ? 'border-amber-300/25 bg-amber-300/10' : 'border-white/[0.08] bg-white/[0.035]'
                      )}
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border text-lg font-black', level.unlocked ? 'border-amber-300/25 bg-amber-300/15 text-amber-200' : 'border-white/10 bg-black/25 text-slate-500')}>
                            {level.unlocked ? level.level : <Lock size={20} />}
                          </div>
                          <div>
                            <h2 className="text-lg font-black tracking-[-0.035em] text-white">Seviye {level.level}</h2>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-600">{Number(level.requiredXp || 0).toLocaleString('tr-TR')} XP</p>
                          </div>
                        </div>
                        {level.unlocked && <CheckCircle2 className="text-emerald-300" size={22} />}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <RewardCard
                          title={lobbyExtraText(pageContent, 'freeTrack', 'Ücretsiz')}
                          label={level.freeRewardLabel}
                          claimed={level.freeClaimed}
                          disabled={!level.unlocked || level.freeClaimed || claimMutation.isPending}
                          claimedLabel={lobbyExtraText(pageContent, 'claimedButton', 'Alındı')}
                          claimLabel={lobbyExtraText(pageContent, 'claimButton', 'Ödülü Al')}
                          onClaim={() => claimMutation.mutate({ level: Number(level.level), track: 'free' })}
                        />
                        <RewardCard
                          title={lobbyExtraText(pageContent, 'premiumTrack', 'Premium')}
                          label={level.premiumRewardLabel}
                          claimed={level.premiumClaimed}
                          disabled={!data?.premiumEnabled || !level.unlocked || level.premiumClaimed || claimMutation.isPending}
                          premium
                          claimedLabel={lobbyExtraText(pageContent, 'claimedButton', 'Alındı')}
                          claimLabel={lobbyExtraText(pageContent, 'claimButton', 'Ödülü Al')}
                          onClaim={() => claimMutation.mutate({ level: Number(level.level), track: 'premium' })}
                        />
                      </div>
                    </motion.article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function RewardCard({ title, label, claimed, disabled, claimedLabel, claimLabel, premium = false, onClaim }: { title: string; label: string; claimed: boolean; disabled: boolean; claimedLabel: string; claimLabel: string; premium?: boolean; onClaim: () => void }) {
  return (
    <div className={cn('rounded-2xl border p-3', premium ? 'border-blue-300/15 bg-blue-400/10' : 'border-white/[0.08] bg-black/20')}>
      <div className="mb-3 flex items-center gap-2">
        <Gift size={16} className={premium ? 'text-blue-200' : 'text-amber-200'} />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</span>
      </div>
      <p className="min-h-[36px] text-sm font-black text-white">{label || 'XP ödülü'}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onClaim}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-[10px] font-black uppercase tracking-widest text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-600"
      >
        <Zap size={14} />
        {claimed ? claimedLabel : claimLabel}
      </button>
    </div>
  );
}

function Badge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 text-xs font-black text-slate-300">
      <Icon size={15} className="text-amber-300" />
      {label}
    </span>
  );
}

function LoginCard({ username, checking, error, content, onUsernameChange, onLogin }: { username: string; checking: boolean; error: string; content: LobbyPageContent; onUsernameChange: (value: string) => void; onLogin: () => void }) {
  return (
    <section className="mx-auto max-w-md rounded-[1.5rem] border border-white/[0.08] bg-white/[0.04] p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300">
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
        className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-slate-700 focus:border-amber-300/50"
      />
      {error && <div className="mt-3 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-200">{error}</div>}
      <button type="button" disabled={!username.trim() || checking} onClick={onLogin} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-xs font-black uppercase tracking-widest text-black disabled:cursor-not-allowed disabled:opacity-60">
        {checking ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
        {content.submitButton}
      </button>
    </section>
  );
}

function LoadingBlock() {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] border border-white/[0.08] bg-white/[0.035]">
      <Loader2 className="animate-spin text-amber-300" size={30} />
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
