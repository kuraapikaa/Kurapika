import { useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgePlus,
  CheckCircle2,
  Copy,
  Gift,
  LayoutGrid,
  Monitor,
  PackageCheck,
  Palette,
  Plus,
  RotateCcw,
  Smartphone,
  Target,
  Ticket,
  Trash2,
  TrendingUp,
  Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LynonAssignmentValuesField } from './LynonAssignmentValuesField';

export interface WheelSlice {
  id: string | number;
  label: string;
  bgColor: string;
  textColor: string;
  probability: number;
  type: 'bonus' | 'cash' | 'physical' | 'none';
  rewardKind?: 'freebet' | 'freespin' | 'cash' | 'physical';
  bonusId: string | null;
  isLoss: boolean;
  amount: number;
  detail?: string;
  stock?: number;
  requiresConfiguration?: boolean;
  assignmentValues?: Record<string, unknown>;
}

interface WheelClaim {
  id: string;
  username: string;
  createdAt: string;
  status: 'pending' | 'completed' | 'granted' | 'fulfillment_pending' | 'fulfilled' | 'cancelled' | 'failed';
  label: string;
  rewardType: 'bonus' | 'cash' | 'physical' | 'none';
  amount: number;
  code?: string | null;
  message?: string | null;
  fulfillmentNote?: string | null;
  fulfilledAt?: string | null;
}

export interface WheelAppearance {
  rimColor: string;
  centerColor: string;
  pointerColor: string;
  glowColor: string;
  pageAccentColor: string;
  borderWidth: number;
  centerSize: number;
  labelSize: number;
  glowStrength: number;
  glossy: boolean;
}

interface WheelManagerProps {
  wheel: WheelSlice[];
  appearance: Partial<WheelAppearance>;
  minInvestment: number;
  bonusOptions: any[];
  onUpdate: (newWheel: WheelSlice[]) => void;
  onAppearanceChange: (appearance: WheelAppearance) => void;
  onMinInvestmentChange: (val: number) => void;
  codes: any[];
  onCodesUpdate: (newCodes: any[]) => void;
  claims: WheelClaim[];
  claimsLoading: boolean;
  updatingClaimId?: string;
  onUpdateClaim: (claimId: string, status: 'fulfilled' | 'cancelled', note?: string) => void;
}

type WheelTab = 'slices' | 'appearance' | 'codes' | 'claims';

const DEFAULT_APPEARANCE: WheelAppearance = {
  rimColor: '#111827',
  centerColor: '#0f172a',
  pointerColor: '#f8fafc',
  glowColor: '#3b82f6',
  pageAccentColor: '#3b82f6',
  borderWidth: 10,
  centerSize: 64,
  labelSize: 14,
  glowStrength: 0,
  glossy: false
};

const SLICE_COLORS = [
  '#06b6d4',
  '#14b8a6',
  '#f43f5e',
  '#f59e0b',
  '#1d4ed8',
  '#22c55e',
  '#3b82f6',
  '#c95c1b',
  '#84cc16',
  '#fb7185'
];

const TABS: Array<{ id: WheelTab; label: string; icon: typeof Target }> = [
  { id: 'slices', label: 'Dilimler', icon: Target },
  { id: 'appearance', label: 'Görünüm', icon: Palette },
  { id: 'codes', label: 'Kodlar', icon: Ticket },
  { id: 'claims', label: 'Teslimatlar', icon: PackageCheck }
];

const CLAIM_STATUS_LABELS: Record<WheelClaim['status'], string> = {
  pending: 'İşleniyor',
  completed: 'Tamamlandı',
  granted: 'Tanımlandı',
  fulfillment_pending: 'Teslimat bekliyor',
  fulfilled: 'Teslim edildi',
  cancelled: 'İptal edildi',
  failed: 'Başarısız'
};

function claimStatusClass(status: WheelClaim['status']) {
  if (status === 'fulfilled' || status === 'granted' || status === 'completed') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  if (status === 'fulfillment_pending' || status === 'pending') return 'border-amber-400/20 bg-amber-400/10 text-amber-200';
  if (status === 'failed' || status === 'cancelled') return 'border-rose-400/20 bg-rose-400/10 text-rose-300';
  return 'border-white/10 bg-white/[0.04] text-slate-300';
}

function validHex(color: string | undefined, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color || '') ? color! : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle)
  };
}

function segmentPath(cx: number, cy: number, r: number, start: number, end: number) {
  const p1 = polar(cx, cy, r, start);
  const p2 = polar(cx, cy, r, end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
}

function wheelLabelLines(label: string, maxCharacters = 11, maxLines = 3): string[] {
  const words = String(label || 'Dilim').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const candidate = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
    if (lines.length && candidate.length > maxCharacters) {
      if (lines.length >= maxLines) break;
      lines.push(word);
    } else if (lines.length) {
      lines[lines.length - 1] = candidate;
    } else {
      lines.push(word);
    }
  }
  const consumed = lines.join(' ').length;
  const original = words.join(' ');
  if (original.length > consumed && lines.length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(3, maxCharacters - 1)).trimEnd()}…`;
  }
  return lines.slice(0, maxLines);
}
function ColorField({
  label,
  color,
  onChange,
  compact = false
}: {
  label: string;
  color: string;
  onChange: (color: string) => void;
  compact?: boolean;
}) {
  const safe = validHex(color, '#111827');

  return (
    <label className="block min-w-0">
      <span className={cn('mb-1 block font-black uppercase tracking-widest text-slate-500', compact ? 'text-[9px]' : 'text-[10px]')}>
        {label}
      </span>
      <span className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#070b11] px-2 transition focus-within:border-[#3b82f6]/50">
        <input
          type="color"
          value={safe}
          onChange={event => onChange(event.target.value)}
          className="h-6 w-6 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={color || safe}
          onChange={event => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[11px] font-black uppercase text-slate-200 outline-none"
          spellCheck={false}
        />
      </span>
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix = '',
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const pct = clampNumber(((value - min) / (max - min)) * 100, 0, 100);

  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <span>{label}</span>
        <span className="text-[#5eead4]">{value}{suffix}</span>
      </span>
      <span className="relative block h-2 rounded-full bg-black/50">
        <span className="absolute left-0 top-0 h-full rounded-full bg-[#3b82f6]/60" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={event => onChange(Number(event.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent accent-[#3b82f6]"
        />
      </span>
    </label>
  );
}

export function WheelSvg({
  wheel,
  appearance,
  size = 360,
  rotation = 0,
  spinning = false,
}: {
  wheel: WheelSlice[];
  appearance: WheelAppearance;
  size?: number;
  rotation?: number;
  spinning?: boolean;
}) {
  const reactId = useId().replace(/:/g, '');
  const cx = size / 2;
  const cy = size / 2;
  const rim = clampNumber(Number(appearance.borderWidth) || 10, 7, 22);
  const radius = cx - rim - 14;
  const centerRadius = clampNumber((Number(appearance.centerSize) || 64) / 2, 22, 54);
  const count = Math.max(wheel.length, 1);
  const angle = (Math.PI * 2) / count;
  const glowColor = validHex(appearance.glowColor, '#3b82f6');
  const rimColor = validHex(appearance.rimColor, '#111827');
  const centerColor = validHex(appearance.centerColor, '#0f172a');
  const pointerColor = validHex(appearance.pointerColor, '#f8fafc');
  const idPrefix = `wheel-${reactId}`;
  const slices = wheel.length ? wheel : [{
    id: 'empty', label: 'Dilim Yok', bgColor: '#1f2937', textColor: '#ffffff', probability: 100,
    type: 'none' as const, bonusId: null, isLoss: true, amount: 0,
  }];
  const fontSize = Math.max(7.5, Math.min(Number(appearance.labelSize) || 12, count >= 12 ? 9 : count >= 9 ? 10 : 12));
  const maxCharacters = count >= 12 ? 9 : count >= 9 ? 11 : 14;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block h-auto w-full overflow-visible" role="img" aria-label="Şans çarkı">
      <defs>
        <linearGradient id={`${idPrefix}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6f4308" /><stop offset="22%" stopColor="#f8e29a" /><stop offset="48%" stopColor={glowColor} /><stop offset="72%" stopColor="#7c4d08" /><stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
        <radialGradient id={`${idPrefix}-rim`} cx="35%" cy="25%" r="78%">
          <stop offset="0%" stopColor="#475569" /><stop offset="55%" stopColor={rimColor} /><stop offset="100%" stopColor="#020408" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-hub`} cx="32%" cy="24%" r="78%">
          <stop offset="0%" stopColor="#ffffff" /><stop offset="18%" stopColor="#a8b0bd" /><stop offset="52%" stopColor={centerColor} /><stop offset="100%" stopColor="#030406" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-shade`} cx="45%" cy="38%" r="65%">
          <stop offset="48%" stopColor="rgba(255,255,255,0.06)" /><stop offset="78%" stopColor="rgba(0,0,0,0.18)" /><stop offset="100%" stopColor="rgba(0,0,0,0.62)" />
        </radialGradient>
        <linearGradient id={`${idPrefix}-pointer`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" /><stop offset="45%" stopColor={pointerColor} /><stop offset="100%" stopColor={glowColor} />
        </linearGradient>
        <filter id={`${idPrefix}-shadow`} x="-35%" y="-35%" width="170%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000000" floodOpacity="0.72" />
          {appearance.glowStrength > 0 && <feDropShadow dx="0" dy="0" stdDeviation={Math.max(2, appearance.glowStrength / 10)} floodColor={glowColor} floodOpacity="0.42" />}
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={cx - 5} fill={`url(#${idPrefix}-gold)`} filter={`url(#${idPrefix}-shadow)`} />
      <circle cx={cx} cy={cy} r={cx - rim} fill={`url(#${idPrefix}-rim)`} stroke="rgba(255,255,255,.18)" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={radius + 4} fill="#030509" stroke="rgba(0,0,0,.88)" strokeWidth="3" />

      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: spinning ? 'transform 5s cubic-bezier(.12,.72,.12,1)' : 'transform .25s ease-out' }}>
        {slices.map((slice, index) => {
          const start = -Math.PI / 2 + index * angle;
          const end = start + angle;
          return <path key={slice.id || index} d={segmentPath(cx, cy, radius, start, end)} fill={validHex(slice.bgColor, '#1f2937')} stroke="rgba(3,5,9,.88)" strokeWidth={count >= 10 ? 1.6 : 2.2} />;
        })}
        <circle cx={cx} cy={cy} r={radius} fill={`url(#${idPrefix}-shade)`} pointerEvents="none" />
        {appearance.glossy && <ellipse cx={cx - radius * .16} cy={cy - radius * .22} rx={radius * .72} ry={radius * .43} fill="rgba(255,255,255,.07)" pointerEvents="none" />}
        <circle cx={cx} cy={cy} r={radius * .91} fill="none" stroke="rgba(255,255,255,.24)" strokeWidth="1" pointerEvents="none" />
        {slices.map((slice, index) => {
          const mid = -Math.PI / 2 + (index + 0.5) * angle;
          const labelPoint = polar(cx, cy, radius * (count >= 11 ? 0.70 : 0.68), mid);
          let textRotation = (mid * 180) / Math.PI;
          if (textRotation > 90 || textRotation < -90) textRotation += 180;
          const lines = wheelLabelLines(slice.label, maxCharacters, 3);
          const firstDy = -((lines.length - 1) * fontSize * 0.52);
          return (
            <text key={`label-${slice.id || index}`} x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight="900" letterSpacing="-.15" fill={validHex(slice.textColor, '#ffffff')} stroke="rgba(2,4,8,.92)" strokeWidth={fontSize < 9 ? 2.2 : 2.8} paintOrder="stroke" transform={`rotate(${textRotation}, ${labelPoint.x}, ${labelPoint.y})`}>
              {lines.map((line, lineIndex) => <tspan key={lineIndex} x={labelPoint.x} dy={lineIndex === 0 ? firstDy : fontSize * 1.08}>{line.toLocaleUpperCase('tr-TR')}</tspan>)}
            </text>
          );
        })}
      </g>

      <circle cx={cx} cy={cy} r={centerRadius + 8} fill="#06080d" stroke={`url(#${idPrefix}-gold)`} strokeWidth="5" />
      <circle cx={cx} cy={cy} r={centerRadius} fill={`url(#${idPrefix}-hub)`} stroke="rgba(255,255,255,.34)" strokeWidth="1.5" />
      <circle cx={cx - centerRadius * .2} cy={cy - centerRadius * .22} r={centerRadius * .38} fill="rgba(255,255,255,.12)" />
      <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(9, centerRadius * .34)} fontWeight="900" fill="#ffffff" stroke="rgba(0,0,0,.75)" strokeWidth="2" paintOrder="stroke">ŞANS</text>
      <path d={`M ${cx - 20} 8 L ${cx + 20} 8 L ${cx + 14} 27 L ${cx} 45 L ${cx - 14} 27 Z`} fill={`url(#${idPrefix}-pointer)`} stroke="#fff3bd" strokeWidth="2" strokeLinejoin="round" filter={`url(#${idPrefix}-shadow)`} />
      <circle cx={cx} cy="19" r="5" fill="#ffffff" opacity=".75" />
    </svg>
  );
}
function DeviceSimulationPanel({
  wheel,
  appearance
}: {
  wheel: WheelSlice[];
  appearance: WheelAppearance;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#080d13] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-white">
            <Monitor size={17} className="text-[#3b82f6]" />
            Cihaz Simülasyonu
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Oyuncu ekranının web ve mobil yerleşimini aynı çark verisiyle kontrol edin.</p>
        </div>
        <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#3b82f6]/20 bg-[#3b82f6]/10 px-3 text-[10px] font-black uppercase tracking-widest text-[#5eead4]">
          <Smartphone size={14} />
          Web + Mobil
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#040812]">
          <div className="flex h-10 items-center gap-2 border-b border-white/[0.08] bg-white/[0.03] px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
            <div className="ml-3 flex h-6 min-w-0 flex-1 items-center rounded-md border border-white/[0.07] bg-black/25 px-3 text-[10px] font-bold text-slate-500">
              /#/sans-carki
            </div>
          </div>
          <div
            className="grid min-h-[360px] grid-cols-1 items-center gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]"
            style={appearance.glowStrength > 0 ? { boxShadow: `inset 0 0 70px ${validHex(appearance.glowColor, '#3b82f6')}14` } : undefined}
          >
            <div className="flex justify-center">
              <WheelSvg wheel={wheel} appearance={appearance} size={330} />
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#080d13]/95 p-4">
              <div className="mb-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#3b82f6]">Şans Çarkı</div>
                <div className="mt-1 text-xl font-black text-white">Çark hakkını kullan</div>
              </div>
              <div className="space-y-3">
                <div className="h-11 rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-xs font-bold text-slate-400">Kullanıcı adı</div>
                <div className="h-11 rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-xs font-bold text-slate-400">Çark kodu</div>
                <div className="flex h-11 items-center justify-center rounded-lg bg-[#3b82f6] text-xs font-black uppercase tracking-widest text-zinc-950">Çevir</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center rounded-xl border border-white/[0.08] bg-[#040812] p-4">
          <div className="w-[286px] rounded-[32px] border border-white/15 bg-black p-2 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#060a10]">
              <div className="flex h-8 items-center justify-center border-b border-white/[0.06]">
                <span className="h-1.5 w-16 rounded-full bg-white/15" />
              </div>
              <div className="px-3 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#3b82f6]">Mobil</span>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300">Aktif</span>
                </div>
                <div className="flex justify-center">
                  <WheelSvg wheel={wheel} appearance={appearance} size={214} />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-[11px] font-bold text-slate-500">Kullanıcı adı</div>
                  <div className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-[11px] font-bold text-slate-500">Çark kodu</div>
                  <div className="flex h-10 items-center justify-center rounded-lg bg-[#3b82f6] text-[11px] font-black uppercase tracking-widest text-zinc-950">Çevir</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WheelManager({
  wheel,
  appearance,
  minInvestment,
  bonusOptions,
  onUpdate,
  onAppearanceChange,
  onMinInvestmentChange,
  codes,
  onCodesUpdate,
  claims,
  claimsLoading,
  updatingClaimId,
  onUpdateClaim
}: WheelManagerProps) {
  const [activeTab, setActiveTab] = useState<WheelTab>('slices');
  const wheelAppearance = { ...DEFAULT_APPEARANCE, ...appearance };
  const manualCodes = codes || [];

  const stats = useMemo(() => {
    const totalProb = wheel.reduce((acc, slice) => acc + (Number(slice.probability) || 0), 0);
    const rewardSlices = wheel.filter(slice => !slice.isLoss);
    const rewardProb = rewardSlices.reduce((acc, slice) => acc + (Number(slice.probability) || 0), 0);
    const avgReward = rewardSlices.length
      ? rewardSlices.reduce((acc, slice) => acc + (Number(slice.amount) || 0), 0) / rewardSlices.length
      : 0;

    return {
      count: wheel.length,
      totalProb,
      rewardPercent: totalProb ? Number(((rewardProb / totalProb) * 100).toFixed(1)) : 0,
      avgReward: Number(avgReward.toFixed(1))
    };
  }, [wheel]);

  const updateAppearance = (values: Partial<WheelAppearance>) => {
    onAppearanceChange({ ...wheelAppearance, ...values });
  };

  const handleAddSlice = () => {
    const color = SLICE_COLORS[wheel.length % SLICE_COLORS.length];
    onUpdate([
      ...wheel,
      {
        id: Date.now(),
        label: 'Yeni Ödül',
        bgColor: color,
        textColor: '#ffffff',
        probability: 10,
        type: 'bonus',
        bonusId: null,
        isLoss: false,
        amount: 10
      }
    ]);
  };

  const handleRemoveSlice = (id: string | number) => {
    onUpdate(wheel.filter(slice => slice.id !== id));
  };

  const handleUpdateSlice = (id: string | number, values: Partial<WheelSlice>) => {
    onUpdate(wheel.map(slice => slice.id === id ? { ...slice, ...values } : slice));
  };

  const handleBonusChange = (slice: WheelSlice, value: string) => {
    const selected = bonusOptions.find(option => option.id === value || option.value === value);
    if (selected?.isSpecial) {
      handleUpdateSlice(slice.id, { label: selected.value, bonusId: null, type: 'none', isLoss: true, amount: 0, requiresConfiguration: false });
      return;
    }
    if (selected) {
      handleUpdateSlice(slice.id, { label: selected.value, bonusId: selected.id, type: 'bonus', isLoss: false, requiresConfiguration: true });
      return;
    }
    handleUpdateSlice(slice.id, {
      label: value,
      bonusId: /^\d+$/.test(value) ? value : slice.type === 'bonus' ? null : slice.bonusId,
      type: /^\d+$/.test(value) ? 'bonus' : slice.type,
      isLoss: slice.type === 'none' ? true : slice.isLoss,
    });
  };

  const changeRewardType = (slice: WheelSlice, type: WheelSlice['type']) => {
    if (type === 'none') {
      handleUpdateSlice(slice.id, { type, isLoss: true, amount: 0, bonusId: null, requiresConfiguration: false });
      return;
    }
    handleUpdateSlice(slice.id, {
      type,
      rewardKind: type === 'cash' ? 'cash' : type === 'physical' ? 'physical' : slice.rewardKind,
      isLoss: false,
      bonusId: type === 'bonus' ? slice.bonusId : null,
      requiresConfiguration: true,
    });
  };

  const addManualCode = () => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    onCodesUpdate([{ code, used: false }, ...manualCodes]);
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => undefined);
  };

  const probabilityOk = stats.totalProb === 100;

  const summaryCards = [
    { label: 'Dilim Sayısı', value: `${stats.count}/12`, icon: LayoutGrid },
    { label: 'Toplam Olasılık', value: `%${stats.totalProb}`, icon: Zap },
    { label: 'Kazanma Payı', value: `%${stats.rewardPercent}`, icon: TrendingUp },
    { label: 'Ortalama Ödül', value: `${stats.avgReward} TL`, icon: Gift }
  ];

  return (
    <div className="space-y-5">
      <DeviceSimulationPanel wheel={wheel} appearance={wheelAppearance} />

      <section className="min-w-0 rounded-xl border border-white/10 bg-[#080d13] shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
        <div className="border-b border-white/10 p-4">
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-black uppercase tracking-widest transition',
                      active
                        ? 'bg-[#3b82f6] text-zinc-950'
                        : 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.07] hover:text-slate-200'
                    )}
                  >
                    <Icon size={15} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min. Yatırım</span>
                <span className="relative">
                  <input
                    type="number"
                    value={minInvestment}
                    onChange={event => onMinInvestmentChange(Number(event.target.value))}
                    className="h-10 w-32 rounded-lg border border-white/10 bg-[#060a10] px-3 pr-8 text-sm font-black text-[#5eead4] outline-none transition focus:border-[#3b82f6]/50"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">TL</span>
                </span>
              </label>

              <div className={cn(
                'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-black',
                probabilityOk
                  ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                  : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
              )}>
                {probabilityOk ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                {probabilityOk ? 'Olasılık Dengeli' : 'Olasılık %100 Değil'}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {summaryCards.map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/35 text-[#3b82f6]">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-black uppercase tracking-widest text-slate-500">{card.label}</span>
                      <span className="block text-lg font-black text-white">{card.value}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {activeTab === 'slices' && (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <div className="flex flex-col gap-3 border-b border-white/10 bg-black/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-black text-white">Dilim Yönetimi</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Ödül, pas, tutar ve olasılık ayarlarını buradan düzenleyin.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSlice}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#3b82f6] px-4 text-xs font-black uppercase tracking-widest text-zinc-950 transition hover:bg-[#5eead4]"
                >
                  <Plus size={15} />
                  Dilim Ekle
                </button>
              </div>

              <datalist id="wheel-bonus-options">
                {bonusOptions.map((option: any) => (
                  <option key={`${option.id}-${option.value}`} value={option.id}>
                    {option.display}
                  </option>
                ))}
              </datalist>

              {wheel.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <Target size={34} className="text-slate-700" />
                  <div>
                    <div className="font-black text-white">Henüz dilim yok</div>
                    <div className="mt-1 text-sm text-slate-500">İlk ödül dilimini ekleyerek başlayın.</div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[920px]">
                    <div className="grid grid-cols-[70px_minmax(260px,1fr)_170px_120px_120px_52px] gap-3 border-b border-white/10 bg-black/25 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span>Renk</span>
                      <span>Etiket / Bonus</span>
                      <span>Tip</span>
                      <span>Tutar</span>
                      <span>Olasılık</span>
                      <span />
                    </div>

                    {wheel.map((slice, index) => (
                      <div
                        key={slice.id || index}
                        className="grid grid-cols-[70px_minmax(260px,1fr)_170px_120px_120px_52px] items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0 hover:bg-white/[0.025]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black text-white" style={{ backgroundColor: validHex(slice.bgColor, '#1f2937') }}>
                            {index + 1}
                          </span>
                          <span className="text-[10px] font-black text-slate-600">#{index + 1}</span>
                        </div>

                        <input
                          type="text"
                          list="wheel-bonus-options"
                          value={slice.bonusId ? String(slice.bonusId) : slice.label}
                          onChange={event => handleBonusChange(slice, event.target.value)}
                          className="h-10 rounded-lg border border-white/10 bg-[#060a10] px-3 text-sm font-bold text-white outline-none transition focus:border-[#3b82f6]/50"
                          placeholder="Bonus ID veya etiket"
                        />

                        <select
                          value={slice.type}
                          onChange={event => changeRewardType(slice, event.target.value as WheelSlice['type'])}
                          className="h-10 rounded-lg border border-white/10 bg-[#060a10] px-3 text-xs font-bold text-slate-200 outline-none transition focus:border-[#3b82f6]/50"
                        >
                          <option value="bonus">Lynon bonusu</option>
                          <option value="cash">Nakit / PlayerAccount</option>
                          <option value="physical">Fiziksel ödül</option>
                          <option value="none">Pas</option>
                        </select>

                        <input
                          type="number"
                          value={slice.amount ?? 0}
                          onChange={event => handleUpdateSlice(slice.id, { amount: Number(event.target.value) })}
                          className="h-10 rounded-lg border border-white/10 bg-[#060a10] px-3 text-sm font-black text-slate-100 outline-none transition focus:border-[#3b82f6]/50"
                        />

                        <input
                          type="number"
                          value={slice.probability ?? 0}
                          onChange={event => handleUpdateSlice(slice.id, { probability: Number(event.target.value) })}
                          className="h-10 rounded-lg border border-white/10 bg-[#060a10] px-3 text-sm font-black text-slate-100 outline-none transition focus:border-[#3b82f6]/50"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveSlice(slice.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition hover:bg-rose-500/10 hover:text-rose-400"
                          aria-label="Dilim sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'slices' && wheel.some(slice => !slice.isLoss && slice.type !== 'none') && (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-amber-300/15 bg-black/20 p-4 lg:grid-cols-2">
              {wheel.filter(slice => !slice.isLoss && slice.type !== 'none').map(slice => (
                <div key={`delivery-${slice.id}`} className="space-y-3 rounded-lg border border-white/[0.08] bg-[#070b11] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{slice.label || `Dilim #${slice.id}`}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                        {slice.type === 'bonus' ? `Lynon kampanyası ${slice.bonusId ? `#${slice.bonusId}` : 'seçilmedi'}` : slice.type === 'cash' ? 'PlayerAccount · crediting' : 'Manuel fiziksel teslimat'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateSlice(slice.id, { requiresConfiguration: !slice.requiresConfiguration })}
                      className={cn(
                        'shrink-0 rounded-md border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition',
                        slice.requiresConfiguration
                          ? 'border-amber-300/20 bg-amber-300/10 text-amber-200'
                          : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
                      )}
                    >
                      {slice.requiresConfiguration ? 'Yapılandırma gerekli' : 'Teslimata hazır'}
                    </button>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-600">Ödül açıklaması</span>
                    <input
                      type="text"
                      value={slice.detail || ''}
                      onChange={event => handleUpdateSlice(slice.id, { detail: event.target.value })}
                      className="h-9 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-xs text-slate-300 outline-none focus:border-[#3b82f6]/50"
                      placeholder="Oyuncuya gösterilecek koşul"
                    />
                  </label>

                  {slice.type === 'physical' && (
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-600">Stok</span>
                      <input
                        type="number"
                        min={0}
                        value={slice.stock ?? 0}
                        onChange={event => handleUpdateSlice(slice.id, { stock: Math.max(0, Number(event.target.value)) })}
                        className="h-9 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-xs font-bold text-white outline-none focus:border-[#3b82f6]/50"
                      />
                    </label>
                  )}

                  {slice.type === 'cash' && (
                    <p className="rounded-lg border border-blue-300/10 bg-blue-300/[0.05] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
                      Nakit ödül, Lynon Player Main hesabına <strong className="text-slate-200">crediting</strong> düzeltmesi olarak işlenir.
                    </p>
                  )}

                  {slice.type === 'bonus' && (
                    <LynonAssignmentValuesField
                      label={`${slice.label || `Dilim #${slice.id}`} · Lynon parametreleri`}
                      values={slice.assignmentValues}
                      onChange={assignmentValues => handleUpdateSlice(slice.id, { assignmentValues })}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 p-4">
                  <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-black text-white">Görünüm Ayarları</h2>
                      <p className="mt-1 text-xs font-medium text-slate-500">Çarkın çerçevesi, merkezi, işaretçisi ve efektleri.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAppearanceChange(DEFAULT_APPEARANCE)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-white/[0.04]"
                    >
                      <RotateCcw size={14} />
                      Varsayılana Dön
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <ColorField label="Dış Çerçeve" color={wheelAppearance.rimColor} onChange={rimColor => updateAppearance({ rimColor })} />
                    <ColorField label="Merkez Rengi" color={wheelAppearance.centerColor} onChange={centerColor => updateAppearance({ centerColor })} />
                    <ColorField label="İşaretçi Rengi" color={wheelAppearance.pointerColor} onChange={pointerColor => updateAppearance({ pointerColor })} />
                    <ColorField label="Parlama Rengi" color={wheelAppearance.glowColor} onChange={glowColor => updateAppearance({ glowColor })} />
                    <ColorField label="Sayfa Vurgusu" color={wheelAppearance.pageAccentColor} onChange={pageAccentColor => updateAppearance({ pageAccentColor })} />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <RangeField label="Çerçeve Kalınlığı" value={wheelAppearance.borderWidth} min={4} max={22} suffix="px" onChange={borderWidth => updateAppearance({ borderWidth })} />
                    <RangeField label="Merkez Boyutu" value={wheelAppearance.centerSize} min={36} max={110} suffix="px" onChange={centerSize => updateAppearance({ centerSize })} />
                    <RangeField label="Numara Boyutu" value={wheelAppearance.labelSize} min={10} max={20} suffix="px" onChange={labelSize => updateAppearance({ labelSize })} />
                    <RangeField label="Parlama Gücü" value={wheelAppearance.glowStrength} min={0} max={80} onChange={glowStrength => updateAppearance({ glowStrength })} />
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-white/10">
                  <div className="border-b border-white/10 bg-black/20 px-4 py-3">
                    <h3 className="text-sm font-black text-white">Dilim Renkleri</h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">Dilim renkleri sadece bu sekmede yönetilir.</p>
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      {wheel.map((slice, index) => (
                        <div key={slice.id || index} className="grid grid-cols-1 gap-3 rounded-lg border border-white/[0.08] bg-black/20 p-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white" style={{ backgroundColor: validHex(slice.bgColor, '#1f2937') }}>
                              {index + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black text-white">{slice.label}</span>
                              <span className="text-[10px] font-bold text-slate-600">%{Number(slice.probability) || 0}</span>
                            </span>
                          </div>
                          <ColorField compact label="Zemin" color={slice.bgColor || '#1f2937'} onChange={bgColor => handleUpdateSlice(slice.id, { bgColor })} />
                          <ColorField compact label="Yazı" color={slice.textColor || '#ffffff'} onChange={textColor => handleUpdateSlice(slice.id, { textColor })} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'claims' && (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <div className="flex flex-col gap-2 border-b border-white/10 bg-black/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-black text-white">Çark Ödül Teslimatları</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Lynon bonusu ve nakit ödüller otomatik; fiziksel ödüller onay kuyruğunda ilerler.</p>
                </div>
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {claims.length} kayıt
                </span>
              </div>

              {claimsLoading ? (
                <div className="py-14 text-center text-sm font-bold text-slate-500">Teslimatlar yükleniyor...</div>
              ) : claims.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <PackageCheck size={34} className="text-slate-700" />
                  <div>
                    <div className="font-black text-white">Henüz ödül kaydı yok</div>
                    <div className="mt-1 text-sm text-slate-500">Çark kullanımları burada denetlenebilir olarak listelenecek.</div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full text-left">
                    <thead className="bg-black/25 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Oyuncu</th>
                        <th className="px-4 py-3">Ödül</th>
                        <th className="px-4 py-3">Tür / Tutar</th>
                        <th className="px-4 py-3">Tarih</th>
                        <th className="px-4 py-3">Durum</th>
                        <th className="px-4 py-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claims.map(claim => (
                        <tr key={claim.id} className="border-t border-white/[0.06] text-sm text-slate-300 hover:bg-white/[0.02]">
                          <td className="px-4 py-3">
                            <div className="font-bold text-white">{claim.username}</div>
                            <div className="mt-0.5 font-mono text-[10px] text-slate-600">{claim.id.slice(0, 8)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-[260px] truncate font-bold text-slate-100">{claim.label}</div>
                            {claim.message && <div className="mt-0.5 max-w-[300px] truncate text-[11px] text-slate-500">{claim.message}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{claim.rewardType}</div>
                            <div className="mt-1 font-mono font-black text-white">{claim.amount > 0 ? `${claim.amount.toLocaleString('tr-TR')} TL` : '—'}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                            {new Date(claim.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wider', claimStatusClass(claim.status))}>
                              {CLAIM_STATUS_LABELS[claim.status] || claim.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {claim.rewardType === 'physical' && claim.status === 'fulfillment_pending' ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={updatingClaimId === claim.id}
                                  onClick={() => {
                                    const note = window.prompt('Teslimat notu (isteğe bağlı):', claim.fulfillmentNote || '') ?? undefined;
                                    onUpdateClaim(claim.id, 'fulfilled', note);
                                  }}
                                  className="h-8 rounded-md bg-emerald-400 px-3 text-[10px] font-black uppercase tracking-wider text-emerald-950 disabled:opacity-50"
                                >
                                  Teslim edildi
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingClaimId === claim.id}
                                  onClick={() => onUpdateClaim(claim.id, 'cancelled')}
                                  className="h-8 rounded-md border border-rose-400/20 bg-rose-400/10 px-3 text-[10px] font-black uppercase tracking-wider text-rose-300 disabled:opacity-50"
                                >
                                  İptal
                                </button>
                              </div>
                            ) : (
                              <div className="text-right text-xs font-bold text-slate-600">—</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'codes' && (
            <div className="rounded-xl border border-white/10">
              <div className="flex flex-col gap-3 border-b border-white/10 bg-black/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-black text-white">Manuel Kodlar</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Yatırım şartını atlayan tek kullanımlık kodlar.</p>
                </div>
                <button
                  type="button"
                  onClick={addManualCode}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-400 px-4 text-xs font-black uppercase tracking-widest text-zinc-950 transition hover:bg-blue-300"
                >
                  <BadgePlus size={15} />
                  Kod Üret
                </button>
              </div>

              {manualCodes.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <Ticket size={34} className="text-slate-700" />
                  <div>
                    <div className="font-black text-white">Henüz kod üretilmedi</div>
                    <div className="mt-1 text-sm text-slate-500">Manuel kullanım kodlarını buradan oluşturun.</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {manualCodes.map((code: any, index: number) => (
                    <div
                      key={`${code.code}-${index}`}
                      className={cn(
                        'rounded-xl border p-4',
                        code.used ? 'border-white/[0.06] bg-black/20 opacity-60' : 'border-white/10 bg-white/[0.025]'
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className={cn(
                          'rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest',
                          code.used ? 'bg-slate-800 text-slate-500' : 'bg-emerald-400/10 text-emerald-300'
                        )}>
                          {code.used ? 'Kullanıldı' : 'Aktif'}
                        </span>
                        <div className="flex gap-1">
                          {!code.used && (
                            <button
                              type="button"
                              onClick={() => copyCode(code.code)}
                              className="rounded-lg p-2 text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-200"
                              aria-label="Kodu kopyala"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onCodesUpdate(manualCodes.filter((_: any, itemIndex: number) => itemIndex !== index))}
                            className="rounded-lg p-2 text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-400"
                            aria-label="Kodu sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="font-mono text-xl font-black tracking-[0.18em] text-white">{code.code}</div>
                      <div className="mt-2 text-[11px] font-medium text-slate-500">
                        {code.used
                          ? `${code.usedBy || 'Oyuncu'} - ${code.usedAt ? new Date(code.usedAt).toLocaleDateString('tr-TR') : ''}`
                          : 'Henüz kullanılmadı'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
