import { Calendar, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

type TournamentPeriod = 'gunluk' | 'haftalik' | 'aylik';

const periods = [
  { id: 'gunluk', label: 'Günlük', to: '/turnuva/gunluk', icon: Zap },
  { id: 'haftalik', label: 'Haftalık', to: '/turnuva/haftalik', icon: TrendingUp },
  { id: 'aylik', label: 'Aylık', to: '/turnuva/aylik', icon: Calendar },
] as const;

export function TournamentPeriodSwitch({ active }: { active: TournamentPeriod }) {
  return (
    <section className="mb-4 rounded-[1.55rem] border border-white/[0.07] bg-zinc-950/45 p-2 shadow-[0_14px_40px_rgba(0,0,0,.24)] backdrop-blur-xl sm:mb-6">
      <p className="px-2 pb-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
        Turnuva seç
      </p>
      <div className="grid grid-cols-3 gap-1">
        {periods.map((period) => {
          const Icon = period.icon;
          const isActive = active === period.id;

          return (
            <Link
              key={period.id}
              to={period.to}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[10px] font-black uppercase tracking-[0.08em] transition active:scale-[0.98] sm:min-h-[50px] sm:flex-row sm:gap-2 sm:text-xs',
                isActive
                  ? 'bg-white text-black shadow-[0_10px_24px_rgba(255,255,255,.12)]'
                  : 'bg-white/[0.035] text-zinc-500 hover:bg-white/[0.07] hover:text-white'
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span>{period.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
