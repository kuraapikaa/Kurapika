import type { ApiResponse, SummaryData } from '../types/dashboard';
import { formatNumber } from '../lib/format';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';
import { ErrorState } from './ui/ErrorState';
import { motion } from 'framer-motion';
import { Activity, ArrowDownRight, ArrowUpRight, Gift, LogIn, UserPlus, Users, Wallet } from 'lucide-react';

interface SummaryCardsProps {
  data: ApiResponse<SummaryData> | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

export function SummaryCards({ data, isLoading, error, onRetry }: SummaryCardsProps) {
  if (error) {
    return <ErrorState message={error.message} onRetry={onRetry} className="rounded-2xl" />;
  }

  if (isLoading || !data?.Data) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-white/[0.07] bg-[#0d1119]" />
        ))}
      </div>
    );
  }

  const d = data.Data;

  const card = (
    label: string,
    value: string,
    sub?: string,
    icon: React.ReactNode = <Activity size={16} />,
    trend?: 'up' | 'down',
    colorClass: 'gold' | 'blue' | 'emerald' | 'amber' = 'gold'
  ) => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="group relative">
      <Card
        className={cn(
          'premium-card flex min-h-[126px] flex-col justify-between overflow-hidden rounded-xl p-3.5',
          'border-white/[0.07] bg-[#0d1119] hover:border-indigo-400/25',
          colorClass === 'emerald' && 'border-emerald-400/15 bg-[#0c1515]',
          colorClass === 'blue' && 'border-indigo-400/15 bg-[#0c111a]'
        )}
      >
        <div className="relative z-10 flex items-start justify-between gap-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border',
            colorClass === 'gold' ? 'border-indigo-400/15 bg-indigo-400/[0.08] text-indigo-300' :
            colorClass === 'emerald' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' :
            'border-indigo-400/15 bg-indigo-400/[0.08] text-indigo-300'
          )}>
            {icon}
          </div>
        </div>

        <div className="relative z-10 mt-3">
          <h3 className="font-mono text-[22px] font-bold tracking-[-0.04em] text-white antialiased md:text-2xl">{value}</h3>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2">
            {trend && (
              <span className={cn('inline-flex items-center gap-1 text-xs font-bold', trend === 'up' ? 'text-emerald-400' : 'text-amber-400')}>
                {trend === 'up' ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
                {trend === 'up' ? '+12.4%' : '-6.1%'}
              </span>
            )}
            {sub && <span className="ml-auto text-[11px] font-semibold text-slate-400">{sub}</span>}
          </div>
        </div>
      </Card>
    </motion.div>
  );

  return (
    <div className="space-y-3">
      <section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {card('Toplam Yatırım', `${formatNumber(d.Deposits)} ₺`, `${d.DepositCount} İşlem`, <Wallet size={18} />, 'up', 'gold')}
          {card('Toplam Çekim', `${formatNumber(d.Withdrawals)} ₺`, `${d.WithdrawalCount} Beklemede`, <ArrowUpRight size={18} className="rotate-180" />, 'down', 'blue')}
          {card('Net Gelir (NGR)', `${formatNumber(d.Deposits - d.Withdrawals)} ₺`, 'Marj %51.1', <Activity size={18} />, (d.Deposits - d.Withdrawals) >= 0 ? 'up' : 'down', 'emerald')}
          {card('Aktif Oyuncu', formatNumber(d.PlayersRegistered), `${d.LoginCount} Giriş`, <Users size={18} />, 'up', 'gold')}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: 'Günlük Girişler', value: d.LoginCount, icon: <LogIn size={18} />, color: 'gold' },
          { label: 'Yeni Kayıtlar', value: d.PlayersRegistered, icon: <UserPlus size={18} />, color: 'blue' },
          { label: 'Bonus Bakiyesi', value: d.PlayersBonusBalance, icon: <Gift size={18} />, color: 'emerald' }
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + (i * 0.05) }}
          >
            <Card className="premium-card rounded-xl border-white/[0.07] bg-[#0d1119] p-3 group hover:border-indigo-400/20">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border',
                  item.color === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
                  item.color === 'blue' ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' :
                  'border-indigo-400/15 bg-indigo-400/[0.08] text-indigo-300'
                )}>
                  {item.icon}
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                  <p className="font-mono text-lg font-bold tracking-tight text-white">{formatNumber(item.value)}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
