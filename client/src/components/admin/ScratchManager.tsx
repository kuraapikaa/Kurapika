import { useState, useMemo } from 'react';
import {
  Ticket, Plus, Trash2, Gift, Sparkles, BarChart3, Layers, Info, ShieldCheck, SlidersHorizontal
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Cell, Tooltip as RechartsTooltip
} from 'recharts';
import { cn } from '../../lib/utils';
import { LynonAssignmentValuesField } from './LynonAssignmentValuesField';

interface ScratchReward {
  id: string | number;
  label: string;
  probability: number;
  type: 'bonus' | 'none';
  bonusId: string | null;
  amount: number;
  assignmentValues?: Record<string, unknown>;
}

interface ScratchManagerProps {
  config: {
    baseWinProbability: number;
    minInvestment?: number;
    rewards: ScratchReward[];
  };
  bonusOptions: any[];
  onUpdate: (newConfig: any) => void;
}

export function ScratchManager({ config, bonusOptions, onUpdate }: ScratchManagerProps) {
  const [editingId, setEditingId] = useState<string | number | null>(null);

  const stats = useMemo(() => {
    const totalWeight = config.rewards.reduce((acc, r) => acc + (Number(r.probability) || 0), 0);
    const avgReward =
      config.rewards.length > 0
        ? config.rewards.reduce((acc, r) => acc + r.amount, 0) / config.rewards.length
        : 0;
    return {
      totalWeight,
      rewardCount: config.rewards.length,
      winProb: config.baseWinProbability,
      avgReward: avgReward.toFixed(1)
    };
  }, [config]);

  const chartData = useMemo(
    () =>
      config.rewards.map(r => ({
        name: r.label.length > 9 ? r.label.substring(0, 9) + '…' : r.label,
        weight: r.probability
      })),
    [config]
  );

  const handleAddReward = () => {
    onUpdate({
      ...config,
      rewards: [
        ...config.rewards,
        { id: Date.now(), label: 'Yeni Odul', probability: 10, type: 'bonus', bonusId: null, amount: 10 }
      ]
    });
  };

  const handleRemove = (id: string | number) => {
    onUpdate({ ...config, rewards: config.rewards.filter(r => r.id !== id) });
    if (editingId === id) setEditingId(null);
  };

  const handleUpdate = (id: string | number, values: Partial<ScratchReward>) => {
    onUpdate({
      ...config,
      rewards: config.rewards.map(r => (r.id === id ? { ...r, ...values } : r))
    });
  };

  const statCards = [
    { label: 'Kazanma Orani', value: `%${stats.winProb}`, icon: Sparkles, tone: 'text-amber-400' },
    { label: 'Odul Cesidi', value: stats.rewardCount, icon: Layers, tone: 'text-blue-400' },
    { label: 'Toplam Agirlik', value: stats.totalWeight, icon: BarChart3, tone: 'text-blue-400' },
    { label: 'Ort. Odul', value: `${stats.avgReward} TL`, icon: Gift, tone: 'text-emerald-400' }
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg border border-white/10 bg-zinc-950/70 p-4">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-md bg-black/40', stat.tone)}>
                  <Icon size={17} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{stat.label}</div>
                  <div className="text-xl font-semibold text-white">{stat.value}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-zinc-950/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Genel Kazanma Olasiligi</div>
              <p className="mt-0.5 text-xs font-medium text-zinc-500">Her oyunda bu oran kadar odul cekilisi yapilir.</p>
            </div>
            <label className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Oran</span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.baseWinProbability}
                  onChange={e => onUpdate({ ...config, baseWinProbability: Number(e.target.value) })}
                  className="h-10 w-28 rounded-md border border-white/10 bg-black/30 px-3 pr-8 text-sm font-semibold text-amber-300 outline-none transition focus:border-amber-500/60"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-600">%</span>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-zinc-950/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Yatırım Şartı</div>
              <p className="mt-0.5 text-xs font-medium text-zinc-500">Oyuncunun kazı kazan oynayabilmesi için gereken minimum son yatırım tutarı. 0 = şartsız.</p>
            </div>
            <label className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Min. Yatırım</span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={config.minInvestment ?? 0}
                  onChange={e => onUpdate({ ...config, minInvestment: Number(e.target.value) })}
                  className="h-10 w-32 rounded-md border border-white/10 bg-black/30 px-3 pr-8 text-sm font-semibold text-amber-300 outline-none transition focus:border-amber-500/60"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-zinc-600">TL</span>
              </div>
            </label>
          </div>

          <section className="overflow-hidden rounded-lg border border-white/10 bg-zinc-950/70">
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Odul Havuzu</h2>
                <p className="mt-0.5 text-xs font-medium text-zinc-500">Kazanildiginda uygulanacak oduller ve agirliklari.</p>
              </div>
              <button
                onClick={handleAddReward}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-500 px-4 text-[11px] font-semibold uppercase tracking-widest text-black transition hover:bg-amber-400"
              >
                <Plus size={14} />
                Odul Ekle
              </button>
            </div>

            {config.rewards.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Ticket size={28} className="text-zinc-700" />
                <p className="text-sm font-bold text-zinc-600">Henuz odul eklenmedi.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[660px]">
                  <div className="grid grid-cols-[minmax(0,2fr)_100px_100px_minmax(140px,1fr)_44px] gap-3 border-b border-white/10 bg-black/20 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    <span>Etiket</span>
                    <span>Tutar</span>
                    <span>Agirlik</span>
                    <span>Bonus ID</span>
                    <span />
                  </div>
                  {config.rewards.map((reward, idx) => (
                    <div
                      key={reward.id || idx}
                      className="grid grid-cols-[minmax(0,2fr)_100px_100px_minmax(140px,1fr)_44px] items-center gap-3 border-b border-white/5 px-5 py-3 last:border-b-0"
                    >
                      <input
                        type="text"
                        value={reward.label}
                        onChange={e => handleUpdate(reward.id, { label: e.target.value })}
                        className="h-9 rounded-md border border-white/10 bg-black/30 px-3 text-xs font-bold text-white outline-none transition focus:border-amber-500/60"
                        placeholder="Odul adi"
                      />
                      <input
                        type="number"
                        value={reward.amount}
                        onChange={e => handleUpdate(reward.id, { amount: Number(e.target.value) })}
                        className="h-9 rounded-md border border-white/10 bg-black/30 px-3 text-xs font-semibold text-emerald-300 outline-none transition focus:border-amber-500/60"
                      />
                      <input
                        type="number"
                        value={reward.probability}
                        onChange={e => handleUpdate(reward.id, { probability: Number(e.target.value) })}
                        className="h-9 rounded-md border border-white/10 bg-black/30 px-3 text-xs font-semibold text-zinc-100 outline-none transition focus:border-amber-500/60"
                      />
                      <select
                        value={reward.bonusId || ''}
                        onChange={e => {
                          const val = e.target.value;
                          const opt = bonusOptions.find(o => o.id === val);
                          handleUpdate(reward.id, {
                            bonusId: val || null,
                            label: opt ? opt.value : reward.label
                          });
                        }}
                        className="h-9 rounded-md border border-white/10 bg-black/30 px-2 text-[11px] font-bold text-zinc-300 outline-none transition focus:border-amber-500/60"
                      >
                        <option value="">Manuel</option>
                        {bonusOptions.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.display}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRemove(reward.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 transition hover:bg-rose-500/10 hover:text-rose-400"
                        aria-label="Odulu sil"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
          {config.rewards.some(reward => reward.type === 'bonus' && reward.bonusId) && (
            <section className="grid grid-cols-1 gap-3 rounded-lg border border-amber-300/15 bg-zinc-950/70 p-4 lg:grid-cols-2">
              {config.rewards.filter(reward => reward.type === 'bonus' && reward.bonusId).map(reward => (
                <LynonAssignmentValuesField
                  key={`assignment-${reward.id}`}
                  label={`${reward.label || `Ödül #${reward.id}`} · Lynon parametreleri`}
                  values={reward.assignmentValues}
                  onChange={assignmentValues => handleUpdate(reward.id, { assignmentValues })}
                />
              ))}
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <BarChart3 size={15} className="text-amber-400" />
              Siklik Dagilimi
            </h2>
            {chartData.length > 0 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="28%">
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#52525b', fontSize: 9, fontWeight: 700 }}
                    />
                    <Bar dataKey="weight" radius={[5, 5, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={i % 2 === 0 ? '#f59e0b' : '#6366f1'} fillOpacity={0.85} />
                      ))}
                    </Bar>
                    <RechartsTooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{
                        backgroundColor: 'rgba(9,9,11,0.96)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fff'
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-52 items-center justify-center text-xs font-bold text-zinc-700">
                Odul eklendikten sonra grafik gorunur
              </div>
            )}
          </section>

          <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Info size={15} className="text-zinc-500" />
              Bilgi
            </h2>
            <div className="space-y-3">
              {[
                { color: 'bg-amber-500', text: 'Agirliklar mutlak oran degil, birbirine gore cikma sikligi ifade eder.' },
                { color: 'bg-blue-500', text: 'Kayip ihtimali "Genel Kazanma" uzerinden hesaplanir; havuzda bos odul eklemeye gerek yoktur.' },
                { color: 'bg-emerald-500', text: 'Bonus ID secildiginde odul oyuncu hesabina aninda ve otomatik yuklenir.' }
              ].map((item, i) => (
                <div key={i} className="flex gap-3 text-[11px] font-medium text-zinc-500">
                  <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.color}`} />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <SlidersHorizontal size={15} className="text-zinc-500" />
              Durum
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Simulasyon Tahmini</div>
                  <div className="mt-1 text-[11px] font-medium text-zinc-500">
                    Her <span className="text-white">100</span> oyunda yaklasik{' '}
                    <span className="text-amber-400">{stats.winProb}</span> oyuncu kazanir. Dagitim yukaridaki agirliklara gore yapilir.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Kayit kontrollu</div>
                  <div className="mt-1 text-[11px] font-medium text-zinc-500">Degisiklikler kaydet butonu ile yayina alinir.</div>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
