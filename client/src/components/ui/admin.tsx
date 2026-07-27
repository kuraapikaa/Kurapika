import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Admin yüzeyi için ortak primitifler.
 *
 * Ölçüm: admin tarafında 63 bileşen, 10 farklı köşe yarıçapı (rounded-lg/xl/2xl/
 * full/md/[2.5rem]/3xl/[2rem]/[1.5rem]/[2px]) ve 8+ farklı kart zemini
 * (slate-900/40, zinc-950, zinc-900, slate-950/40, #080d13 …) karışık
 * kullanılıyordu. Bu dosya tek bir ölçek tanımlar; yeni ekranlar buradan
 * beslenir, eskiler kademeli taşınır.
 *
 * Ölçek — yüzey: rounded-xl (kart) / rounded-lg (kontrol) / rounded-md (rozet)
 *         zemin: bg-white/[0.025] + border-white/[0.07]
 *         iç boşluk: p-4 (kart), gap-3 (ızgara)
 */

const SURFACE = 'border border-white/[0.07] bg-white/[0.025]';

export function AdminCard({
  className,
  children,
  as: As = 'section',
}: {
  className?: string;
  children: ReactNode;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <As className={cn('rounded-xl backdrop-blur-xl', SURFACE, className)}>
      {children}
    </As>
  );
}

/** Kart başlığı — başlık solda, aksiyon/durum sağda. */
export function AdminCardHeader({
  title,
  hint,
  action,
  icon,
  className,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-white/[0.05] px-4 py-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-white">{title}</h3>
          {hint && <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{hint}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-slate-600/40 bg-slate-700/20 text-slate-300',
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  warning: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  danger: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  info: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
};

/** Durum rozeti — 'Doğrulandı', 'İşaretli', 'Bekliyor' gibi. */
export function StatusBadge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold leading-none',
        TONE_CLASS[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Yoğun veri tablosu sarmalayıcı — yatay taşmayı kart içinde tutar. */
export function AdminTable({
  head,
  children,
  minWidth = 720,
  className,
}: {
  head: ReactNode;
  children: ReactNode;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-white/[0.05] bg-white/[0.015]">{head}</tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, align = 'left', className }: { children: ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <th
      className={cn(
        'px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500',
        align === 'right' && 'text-right',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = 'left', className }: { children: ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <td className={cn('px-4 py-2.5 text-[12px] text-slate-300', align === 'right' && 'text-right tabular-nums', className)}>
      {children}
    </td>
  );
}

/** Otomasyon kuralı satırı — açıklama solda, anahtar sağda. */
export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
  action,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-white">{title}</p>
        {description && <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={title}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50',
            checked ? 'bg-emerald-500/80' : 'bg-white/10'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-[18px]' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </div>
  );
}
