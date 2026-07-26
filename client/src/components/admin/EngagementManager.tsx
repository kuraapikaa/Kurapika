import type { ReactNode } from 'react';
import { BadgeCheck, Gift, Layers, ListChecks, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

type EngagementMode = 'dailyTasks' | 'battlePass';

interface EngagementManagerProps {
  mode: EngagementMode;
  dailyTasks: any;
  battlePass: any;
  bonusOptions: any[];
  onDailyTasksChange: (config: any) => void;
  onBattlePassChange: (config: any) => void;
}

const METRICS = [
  { id: 'login', label: 'Giriş' },
  { id: 'deposit_total', label: 'Yatırım tutarı' },
  { id: 'deposit_count', label: 'Yatırım adedi' },
  { id: 'wager_total', label: 'Oyun hacmi' },
  { id: 'bonus_count', label: 'Bonus adedi' },
];

const DEFAULT_DAILY = {
  isActive: true,
  title: 'Günlük Görevler',
  description: 'Gün içindeki gerçek aktivitenizi tamamlayın, XP ve ödül kazanın.',
  resetHour: 0,
  tasks: [],
};

const DEFAULT_PASS = {
  isActive: true,
  seasonId: 'season-1',
  title: 'Sezon Kartı',
  description: 'Yatırım, oyun hacmi ve görevlerden XP toplayarak sezon ödüllerini aç.',
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  premiumEnabled: false,
  xpRules: [],
  levels: [],
};

function toDateTimeLocal(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function EngagementManager({
  mode,
  dailyTasks,
  battlePass,
  bonusOptions,
  onDailyTasksChange,
  onBattlePassChange,
}: EngagementManagerProps) {
  const daily = { ...DEFAULT_DAILY, ...(dailyTasks || {}), tasks: Array.isArray(dailyTasks?.tasks) ? dailyTasks.tasks : [] };
  const pass = {
    ...DEFAULT_PASS,
    ...(battlePass || {}),
    xpRules: Array.isArray(battlePass?.xpRules) ? battlePass.xpRules : [],
    levels: Array.isArray(battlePass?.levels) ? battlePass.levels : [],
  };

  const updateDaily = (values: any) => onDailyTasksChange({ ...daily, ...values });
  const updateTask = (id: string, values: any) => updateDaily({
    tasks: daily.tasks.map((task: any) => task.id === id ? { ...task, ...values } : task),
  });
  const addTask = () => updateDaily({
    tasks: [
      ...daily.tasks,
      {
        id: nextId('task'),
        title: 'Yeni görev',
        description: 'Görev açıklaması',
        metric: 'deposit_total',
        target: 500,
        xp: 100,
        rewardLabel: '50 TL Bonus',
        rewardBonusId: null,
        rewardAmount: 50,
        active: true,
      },
    ],
  });

  const updatePass = (values: any) => onBattlePassChange({ ...pass, ...values });
  const updateRule = (id: string, values: any) => updatePass({
    xpRules: pass.xpRules.map((rule: any) => rule.id === id ? { ...rule, ...values } : rule),
  });
  const addRule = () => updatePass({
    xpRules: [
      ...pass.xpRules,
      { id: nextId('xp'), label: 'Yeni XP kuralı', metric: 'deposit_total', unit: 100, xp: 10, cap: 1000, active: true },
    ],
  });
  const updateLevel = (levelNo: number, values: any) => updatePass({
    levels: pass.levels.map((level: any) => Number(level.level) === levelNo ? { ...level, ...values } : level),
  });
  const addLevel = () => {
    const nextLevel = Math.max(0, ...pass.levels.map((level: any) => Number(level.level) || 0)) + 1;
    updatePass({
      levels: [
        ...pass.levels,
        {
          level: nextLevel,
          requiredXp: nextLevel * 250,
          freeRewardLabel: 'Bonus ödülü',
          freeBonusId: null,
          freeAmount: 50,
          premiumRewardLabel: 'Premium bonus',
          premiumBonusId: null,
          premiumAmount: 100,
        },
      ],
    });
  };

  return (
    <section className="space-y-4">
      <datalist id="engagement-bonus-options">
        {bonusOptions.map((option: any) => (
          <option key={`${option.id}-${option.value}`} value={option.id}>
            {option.display}
          </option>
        ))}
      </datalist>

      {mode === 'dailyTasks' ? (
        <div className="space-y-4">
          <HeaderCard
            icon={ListChecks}
            title="Günlük Görevler"
            desc="Türkiye (GMT+3) gün penceresi ve Lynon aktivitesiyle hesaplanır; ödül seçilen canlı kampanyaya atanır."
            active={daily.isActive !== false}
            onActiveChange={(isActive) => updateDaily({ isActive })}
          />

          <div className="rounded-xl border border-white/10 bg-[#080d13] p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.4fr_140px]">
              <TextField label="Başlık" value={daily.title} onChange={(title) => updateDaily({ title })} />
              <TextField label="Açıklama" value={daily.description} onChange={(description) => updateDaily({ description })} />
              <NumberField label="Reset saati (TR / GMT+3)" value={daily.resetHour || 0} onChange={(resetHour) => updateDaily({ resetHour })} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#080d13]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
              <div>
                <h3 className="text-sm font-black text-white">Görevler</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">Metrik, hedef ve ödül eşleşmelerini düzenleyin.</p>
              </div>
              <button type="button" onClick={addTask} className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-xs font-black uppercase tracking-widest text-zinc-950">
                <Plus size={15} />
                Görev Ekle
              </button>
            </div>
            <div className="space-y-3 p-4">
              {daily.tasks.map((task: any) => (
                <div key={task.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                      <input type="checkbox" checked={task.active !== false} onChange={(event) => updateTask(task.id, { active: event.target.checked })} />
                      Aktif
                    </label>
                    <button type="button" onClick={() => updateDaily({ tasks: daily.tasks.filter((item: any) => item.id !== task.id) })} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-rose-500/10 hover:text-rose-400" aria-label="Görevi sil">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                    <TextField label="Görev adı" value={task.title || ''} onChange={(title) => updateTask(task.id, { title })} />
                    <SelectField label="Metrik" value={task.metric || 'login'} options={METRICS} onChange={(metric) => updateTask(task.id, { metric })} />
                    <NumberField label="Hedef" value={task.target || 1} onChange={(target) => updateTask(task.id, { target })} />
                    <NumberField label="XP" value={task.xp || 0} onChange={(xp) => updateTask(task.id, { xp })} />
                    <TextField className="xl:col-span-2" label="Açıklama" value={task.description || ''} onChange={(description) => updateTask(task.id, { description })} />
                    <TextField label="Ödül etiketi" value={task.rewardLabel || ''} onChange={(rewardLabel) => updateTask(task.id, { rewardLabel })} />
                    <NumberField label="Ödül tutarı" value={task.rewardAmount || 0} onChange={(rewardAmount) => updateTask(task.id, { rewardAmount })} />
                    <CampaignSelect label="Lynon ödül kampanyası" value={String(task.rewardBonusId || '')} options={bonusOptions} onChange={(rewardBonusId) => updateTask(task.id, { rewardBonusId: rewardBonusId || null })} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <HeaderCard
            icon={Layers}
            title="Sezon Kartı"
            desc="XP, sezon tarihleri ve level ödülleri gerçek oyuncu aktivitesiyle açılır."
            active={pass.isActive !== false}
            onActiveChange={(isActive) => updatePass({ isActive })}
          />

          <div className="rounded-xl border border-white/10 bg-[#080d13] p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
              <TextField label="Sezon ID" value={pass.seasonId} onChange={(seasonId) => updatePass({ seasonId })} />
              <TextField label="Başlık" value={pass.title} onChange={(title) => updatePass({ title })} />
              <DateField label="Başlangıç" value={pass.startsAt} onChange={(startsAt) => updatePass({ startsAt })} />
              <DateField label="Bitiş" value={pass.endsAt} onChange={(endsAt) => updatePass({ endsAt })} />
              <TextField className="xl:col-span-3" label="Açıklama" value={pass.description} onChange={(description) => updatePass({ description })} />
              <label className="flex h-[66px] items-center gap-3 rounded-lg border border-white/10 bg-black/25 px-3 text-xs font-black uppercase tracking-widest text-slate-400">
                <input type="checkbox" checked={pass.premiumEnabled === true} onChange={(event) => updatePass({ premiumEnabled: event.target.checked })} />
                Premium hat
              </label>
            </div>
          </div>

          <ConfigList
            title="XP Kuralları"
            action="Kural Ekle"
            onAdd={addRule}
            icon={BadgeCheck}
          >
            {pass.xpRules.map((rule: any) => (
              <div key={rule.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                    <input type="checkbox" checked={rule.active !== false} onChange={(event) => updateRule(rule.id, { active: event.target.checked })} />
                    Aktif
                  </label>
                  <button type="button" onClick={() => updatePass({ xpRules: pass.xpRules.filter((item: any) => item.id !== rule.id) })} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-rose-500/10 hover:text-rose-400" aria-label="Kuralı sil">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  <TextField label="Ad" value={rule.label || ''} onChange={(label) => updateRule(rule.id, { label })} />
                  <SelectField label="Metrik" value={rule.metric || 'deposit_total'} options={METRICS} onChange={(metric) => updateRule(rule.id, { metric })} />
                  <NumberField label="Birim" value={rule.unit || 1} onChange={(unit) => updateRule(rule.id, { unit })} />
                  <NumberField label="XP" value={rule.xp || 0} onChange={(xp) => updateRule(rule.id, { xp })} />
                  <NumberField label="Limit" value={rule.cap || 0} onChange={(cap) => updateRule(rule.id, { cap })} />
                </div>
              </div>
            ))}
          </ConfigList>

          <ConfigList
            title="Seviye Ödülleri"
            action="Seviye Ekle"
            onAdd={addLevel}
            icon={Gift}
          >
            {pass.levels.map((level: any) => (
              <div key={level.level} className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-300 text-sm font-black text-zinc-950">{level.level}</div>
                    <div>
                      <div className="text-sm font-black text-white">Seviye {level.level}</div>
                      <div className="text-xs font-bold text-slate-600">{level.requiredXp || 0} XP</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => updatePass({ levels: pass.levels.filter((item: any) => item.level !== level.level) })} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-rose-500/10 hover:text-rose-400" aria-label="Seviyeyi sil">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-7">
                  <NumberField label="Seviye" value={level.level || 1} onChange={(value) => updateLevel(Number(level.level), { level: value })} />
                  <NumberField label="Gerekli XP" value={level.requiredXp || 0} onChange={(requiredXp) => updateLevel(Number(level.level), { requiredXp })} />
                  <TextField label="Ücretsiz ödül" value={level.freeRewardLabel || ''} onChange={(freeRewardLabel) => updateLevel(Number(level.level), { freeRewardLabel })} />
                  <TextField label="Ücretsiz ID" value={level.freeBonusId || ''} list="engagement-bonus-options" onChange={(freeBonusId) => updateLevel(Number(level.level), { freeBonusId })} />
                  <NumberField label="Ücretsiz tutar" value={level.freeAmount || 0} onChange={(freeAmount) => updateLevel(Number(level.level), { freeAmount })} />
                  <TextField label="Premium ödül" value={level.premiumRewardLabel || ''} onChange={(premiumRewardLabel) => updateLevel(Number(level.level), { premiumRewardLabel })} />
                  <TextField label="Premium ID" value={level.premiumBonusId || ''} list="engagement-bonus-options" onChange={(premiumBonusId) => updateLevel(Number(level.level), { premiumBonusId })} />
                </div>
              </div>
            ))}
          </ConfigList>
        </div>
      )}
    </section>
  );
}

function CampaignSelect({ label, value, options, onChange }: { label: string; value: string; options: any[]; onChange: (value: string) => void }) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-[#5eead4]/50">
        <option value="">Canlı Lynon kampanyası seçin</option>
        {options.filter((option: any) => !option.isSpecial).map((option: any) => <option key={option.id} value={option.id}>{option.display}</option>)}
      </select>
    </div>
  );
}
function HeaderCard({ icon: Icon, title, desc, active, onActiveChange }: { icon: any; title: string; desc: string; active: boolean; onActiveChange: (value: boolean) => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#080d13] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-300">
            <Icon size={20} />
          </span>
          <div>
            <h2 className="text-lg font-black text-white">{title}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">{desc}</p>
          </div>
        </div>
        <label className={cn('inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-black uppercase tracking-widest', active ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-slate-500')}>
          <input type="checkbox" checked={active} onChange={(event) => onActiveChange(event.target.checked)} />
          {active ? 'Aktif' : 'Pasif'}
        </label>
      </div>
    </div>
  );
}

function ConfigList({ title, action, icon: Icon, onAdd, children }: { title: string; action: string; icon: any; onAdd: () => void; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#080d13]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <Icon size={18} className="text-cyan-300" />
          <h3 className="text-sm font-black text-white">{title}</h3>
        </div>
        <button type="button" onClick={onAdd} className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-xs font-black uppercase tracking-widest text-zinc-950">
          <Plus size={15} />
          {action}
        </button>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  );
}

function fieldClass(extra?: string) {
  return cn('min-w-0', extra);
}

function TextField({ label, value, onChange, className, list }: { label: string; value: string; onChange: (value: string) => void; className?: string; list?: string }) {
  return (
    <label className={fieldClass(className)}>
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        type="text"
        list={list}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-white/10 bg-[#060a10] px-3 text-sm font-bold text-white outline-none transition focus:border-cyan-300/50"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        type="number"
        value={value ?? 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full rounded-lg border border-white/10 bg-[#060a10] px-3 text-sm font-black text-white outline-none transition focus:border-cyan-300/50"
      />
    </label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        type="datetime-local"
        value={toDateTimeLocal(value)}
        onChange={(event) => onChange(fromDateTimeLocal(event.target.value))}
        className="h-10 w-full rounded-lg border border-white/10 bg-[#060a10] px-3 text-sm font-black text-white outline-none transition focus:border-cyan-300/50"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ id: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-white/10 bg-[#060a10] px-3 text-sm font-black text-white outline-none transition focus:border-cyan-300/50"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
