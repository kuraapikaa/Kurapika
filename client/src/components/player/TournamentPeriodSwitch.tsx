import { Calendar, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type TournamentPeriod = 'gunluk' | 'haftalik' | 'aylik';

const periods = [
  { id: 'gunluk', label: 'Günlük', to: '/turnuva/gunluk', icon: Zap },
  { id: 'haftalik', label: 'Haftalık', to: '/turnuva/haftalik', icon: TrendingUp },
  { id: 'aylik', label: 'Aylık', to: '/turnuva/aylik', icon: Calendar },
] as const;

export function TournamentPeriodSwitch({ active }: { active: TournamentPeriod }) {
  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-xl border border-[rgba(243,236,221,0.06)] bg-black/25 p-1"
      role="tablist"
      aria-label="Turnuva dönemi"
    >
      {periods.map((period) => {
        const Icon = period.icon;
        const isActive = active === period.id;

        return (
          <Link
            key={period.id}
            to={period.to}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-black uppercase leading-none tracking-[0.06em] transition sm:text-[11px]',
              isActive
                ? 'bg-[color:var(--lobby-primary,#e7c574)] text-[#171204] shadow-[0_6px_18px_rgba(255,255,255,.1)]'
                : 'text-[color:var(--lobby-muted,#8f8674)] hover:bg-[rgba(243,236,221,0.055)] hover:text-[color:var(--lobby-text,#f3ecdd)]'
            )}
          >
            <Icon size={13} className="shrink-0" />
            <span className="truncate">{period.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
