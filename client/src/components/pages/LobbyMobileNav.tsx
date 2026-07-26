import { ArrowLeft, Gift, Goal, ListChecks, PhoneCall, Ticket, Trophy, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

type PublicPage = 'bonus' | 'wheel' | 'scratch' | 'tournament' | 'prediction' | 'missions' | 'call';

const navItems = [
  { id: 'lobby', label: 'Lobi', to: '/lobi', icon: ArrowLeft },
  { id: 'bonus', label: 'Bonus', to: '/bonus-talep', icon: Gift },
  { id: 'wheel', label: 'Çark', to: '/cark', icon: Zap },
  { id: 'scratch', label: 'Kazı', to: '/kazi-kazan', icon: Ticket },
  { id: 'tournament', label: 'Turnuva', to: '/turnuva/gunluk', icon: Trophy },
  { id: 'prediction', label: 'Narcos Skor', to: '/skor-tahmin', icon: Goal },
  { id: 'call', label: 'Aranma Talep', to: '/beni-ara', icon: PhoneCall },
  { id: 'missions', label: 'Görev', to: '/gorevler', icon: ListChecks },] as const;

export function LobbyMobileNav({ active }: { active?: PublicPage }) {
  return (
    <nav className="sticky top-0 z-40 w-full border-b border-blue-400/15 bg-[#060911]/95 px-2 py-2.5 shadow-[0_12px_35px_rgba(0,0,0,.28)] backdrop-blur-2xl sm:px-4 md:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid grid-cols-4 gap-1 rounded-[1.1rem] border border-blue-400/15 bg-[#080d16]/70 p-1 sm:grid-cols-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;

            return (
              <Link
                key={item.id}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[7px] font-black uppercase tracking-[-0.01em] transition active:scale-[0.98] min-[390px]:text-[8px] sm:min-h-[52px] sm:flex-row sm:gap-2 sm:px-2 sm:text-[10px] sm:tracking-[0.04em]',
                  isActive
                    ? 'bg-gradient-to-br from-blue-500 to-teal-400 text-white shadow-[0_10px_26px_rgba(59,130,246,.28)]'
                    : 'text-zinc-400 hover:bg-blue-400/10 hover:text-teal-200'
                )}
              >
                <Icon size={15} className="shrink-0 sm:h-[17px] sm:w-[17px]" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

