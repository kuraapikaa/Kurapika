import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, ListChecks, Loader2, Palette, Save, Send, Target, Ticket, Trophy, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { gamesApi, dashboardApi } from '../../api/client';
import { cn } from '../../lib/utils';
import { WheelManager } from './WheelManager';
import { ScratchManager } from './ScratchManager';
import { PredictionLeagueManager } from './PredictionLeagueManager';
import { MillionaireShowcaseManager } from './MillionaireShowcaseManager';
import { EngagementManager } from './EngagementManager';
import { LobbyDesignManager } from './LobbyDesignManager';
import { TelegramBonusManager } from './TelegramBonusManager';

type MainTab = 'wheel' | 'scratch' | 'prediction' | 'millionaires' | 'lobby' | 'dailyTasks' | 'telegram';

interface AdminGamesProps {
  initialTab?: MainTab;
}

const MODULE_TABS: Array<{
  id: MainTab;
  label: string;
  description: string;
  icon: typeof Target;
}> = [
  { id: 'wheel', label: 'Şans Çarkı', description: 'Dilimler, oranlar ve görünüm', icon: Target },
  { id: 'scratch', label: 'Kazı Kazan', description: 'Kart ödülleri ve kurallar', icon: Ticket },
  { id: 'prediction', label: 'Skor Tahmin', description: 'Maç listesi ve tahmin ligi', icon: Trophy },
  { id: 'millionaires', label: 'Kazanç Vitrini', description: 'Büyük kazançlar ve video alanı', icon: Crown },
  { id: 'lobby', label: 'Lobi Tasarımı', description: 'Renk, arkaplan ve banner', icon: Palette },
  { id: 'dailyTasks', label: 'Günlük Görevler', description: 'API metrikli görevler', icon: ListChecks },
  { id: 'telegram', label: 'Telegram Bonusu', description: 'Kanal üyeliği doğrulama', icon: Send },];

export function AdminGames({ initialTab }: AdminGamesProps = {}) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<any>(null);
  const [mainTab, setMainTab] = useState<MainTab>(initialTab ?? 'wheel');
  const singleTabMode = !!initialTab;

  useEffect(() => {
    if (location.pathname !== '/admin/oyun-ayarlari' && location.pathname.startsWith('/admin/oyun-ayarlari')) {
      window.history.replaceState(null, '', '/admin/oyun-ayarlari');
    }
  }, [location.pathname]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-games-config'],
    queryFn: () => gamesApi.config()
  });

  const bonusesQuery = useQuery({
    queryKey: ['admin-partner-bonuses'],
    queryFn: () => dashboardApi.partnerBonusList({}),
    staleTime: 5 * 60 * 1000
  });

  const freebetQuery = useQuery({
    queryKey: ['admin-freebets'],
    queryFn: () => dashboardApi.freebetBonuses()
  });

  // Kayip turlari ("Tekrar Dene") varsayilan olarak gizli: varsayilan
  // carkta %97 olasilikla geliyorlar ve teslimat kuyrugunu okunmaz hale
  // getiriyorlar. Kayitlar duruyor, yalnizca gorunum suzuluyor.
  const [kayiplariGoster, setKayiplariGoster] = useState(false);

  const wheelClaimsQuery = useQuery({
    queryKey: ['admin-wheel-claims', kayiplariGoster],
    queryFn: () => gamesApi.wheelClaims(kayiplariGoster),
    enabled: mainTab === 'wheel',
    refetchInterval: mainTab === 'wheel' ? 30_000 : false
  });

  const wheelClaimMutation = useMutation({
    mutationFn: ({ claimId, status, note }: { claimId: string; status: 'fulfilled' | 'cancelled'; note?: string }) =>
      gamesApi.updateWheelClaim(claimId, status, note),
    onSuccess: () => {
      toast.success('Teslimat durumu güncellendi.');
      queryClient.invalidateQueries({ queryKey: ['admin-wheel-claims'] });
    },
    onError: () => toast.error('Teslimat durumu güncellenemedi.')
  });

  useEffect(() => {
    if (data?.data) setConfig(data.data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (newConfig: any) => gamesApi.saveConfig(newConfig),
    onSuccess: () => {
      toast.success('Oyun ayarları kaydedildi.');
      queryClient.invalidateQueries({ queryKey: ['admin-games-config'] });
      queryClient.invalidateQueries({ queryKey: ['games-config'] });
    },
    onError: () => toast.error('Ayarlar kaydedilemedi.')
  });

  const uniqueDynamic = (opts: any[]) => {
    const seen = new Set();
    return opts.filter(opt => {
      if (seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    });
  };

  const getAvailableBonuses = () => {
    const defaultOptions = [
      { display: 'Pas Geç', value: 'Pas', id: 'pas', isSpecial: true },
      { display: 'Boş Çıktı', value: 'Boş', id: 'bos', isSpecial: true },
      { display: 'Tekrar Dene', value: 'Tekrar Dene', id: 'tekrar', isSpecial: true }
    ];

    const bonusRoot = bonusesQuery.data?.Data ?? bonusesQuery.data?.Result;
    const bonuses = Array.isArray(bonusRoot) ? bonusRoot : (Array.isArray(bonusRoot?.Objects) ? bonusRoot.Objects : []);
    const freebetRoot = freebetQuery.data?.Data ?? (freebetQuery.data as any)?.Result;
    const freebets = Array.isArray(freebetRoot) ? freebetRoot : (Array.isArray(freebetRoot?.Objects) ? freebetRoot.Objects : []);

    const dynamicOptions = bonuses.map((bonus: any) => ({
      display: `${bonus.Name ?? bonus.title ?? bonus.systemName} (#${bonus.Id ?? bonus.id})`,
      value: bonus.Name ?? bonus.title ?? bonus.systemName,
      id: String(bonus.Id ?? bonus.id)
    }));

    const freebetOptions = freebets.map((bonus: any) => ({
      display: `FreeBet: ${bonus.Name} (#${bonus.Id})`,
      value: bonus.Name ?? bonus.title ?? bonus.systemName,
      id: String(bonus.Id ?? bonus.id)
    }));

    return [...defaultOptions, ...uniqueDynamic(dynamicOptions), ...uniqueDynamic(freebetOptions)];
  };

  if (isLoading || !config) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="animate-spin text-white opacity-50" size={32} />
      </div>
    );
  }

  const bonusOptions = getAvailableBonuses();

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 pb-28 md:p-6">
      <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {singleTabMode && (
            <Link
              to="/admin/oyun-ayarlari"
              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.025] px-3 py-2 text-[11px] font-bold text-[color:var(--panel-muted,#8a919c)] transition hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:text-[color:var(--panel-text-dim,#c8cdd5)]"
              title="Bu ayarlar, diğer tüm oyun modülleriyle birlikte 'Oyun Ayarları' altında tek bir yapılandırmada saklanır."
            >
              <LayoutGrid size={14} />
              Tüm oyun modüllerini gör (Oyun Ayarları)
            </Link>
          )}
          {!singleTabMode && (
            <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7">
              {MODULE_TABS.map(tab => {
                const Icon = tab.icon;
                const active = mainTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setMainTab(tab.id);
                    }}
                    className={cn(
                      'flex min-h-[74px] items-center gap-3 rounded-lg border px-4 text-left transition',
                      active
                        ? 'border-[color:var(--panel-info,#64d2ff)]/35 bg-[color:var(--panel-info,#64d2ff)]/[0.08] text-white'
                        : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.025] text-[color:var(--panel-muted,#8a919c)] hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:bg-white/[0.045] hover:text-[color:var(--panel-text-dim,#c8cdd5)]'
                    )}
                  >
                    <span className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      active ? 'bg-[color:var(--panel-info,#64d2ff)] text-[#050609]' : 'bg-black/35 text-[color:var(--panel-muted,#8a919c)]'
                    )}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{tab.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-semibold text-[color:var(--panel-muted,#8a919c)]">{tab.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => saveMutation.mutate(config)}
            disabled={saveMutation.isPending}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--panel-accent,#0a84ff)] px-5 text-xs font-semibold uppercase tracking-widest text-[#050609] transition hover:bg-[color:var(--panel-info,#64d2ff)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Değişiklikleri Kaydet
          </button>
        </div>
      </div>

      {mainTab === 'wheel' ? (
        <WheelManager
          wheel={config.wheel || []}
          appearance={config.wheelAppearance || {}}
          minInvestment={config.wheelMinInvestment || 0}
          bonusOptions={bonusOptions}
          onUpdate={(newWheel) => setConfig({ ...config, wheel: newWheel })}
          onAppearanceChange={(wheelAppearance) => setConfig({ ...config, wheelAppearance })}
          onMinInvestmentChange={(val) => setConfig({ ...config, wheelMinInvestment: val })}
          codes={config.codes || []}
          onCodesUpdate={(newCodes) => setConfig({ ...config, codes: newCodes })}
          claims={wheelClaimsQuery.data?.data || []}
          claimsLoading={wheelClaimsQuery.isLoading}
          kayipSayisi={wheelClaimsQuery.data?.kayipSayisi ?? 0}
          kayiplariGoster={kayiplariGoster}
          onKayiplariGosterChange={setKayiplariGoster}
          updatingClaimId={wheelClaimMutation.isPending ? wheelClaimMutation.variables?.claimId : undefined}
          onUpdateClaim={(claimId, status, note) => wheelClaimMutation.mutate({ claimId, status, note })}
        />
      ) : mainTab === 'scratch' ? (
        <ScratchManager
          config={config.scratchcard}
          bonusOptions={bonusOptions}
          onUpdate={(newScratchConfig) => setConfig({ ...config, scratchcard: newScratchConfig })}
        />
      ) : mainTab === 'prediction' ? (
        <PredictionLeagueManager
          config={config.predictionLeague}
          bonusOptions={bonusOptions}
          onUpdate={(predictionLeague) => setConfig({ ...config, predictionLeague })}
        />
      ) : mainTab === 'millionaires' ? (
        <MillionaireShowcaseManager
          config={config.millionaires}
          onUpdate={(millionaires) => setConfig({ ...config, millionaires })}
        />
      ) : mainTab === 'lobby' ? (
        <LobbyDesignManager
          config={config.lobby}
          onUpdate={(lobby) => setConfig({ ...config, lobby })}
        />
      ) : mainTab === 'telegram' ? (
        <TelegramBonusManager
          config={config.telegramBonus}
          bonusOptions={bonusOptions}
          onUpdate={(telegramBonus) => setConfig({ ...config, telegramBonus })}
        />
      ) : (
        <EngagementManager
          mode={mainTab}
          dailyTasks={config.dailyTasks}
          battlePass={config.battlePass}
          bonusOptions={bonusOptions}
          onDailyTasksChange={(dailyTasks) => setConfig({ ...config, dailyTasks })}
          onBattlePassChange={() => undefined}
        />
      )}
    </div>
  );
}
