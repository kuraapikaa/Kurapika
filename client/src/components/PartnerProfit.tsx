import type { ApiResponse, PartnerProfitData } from '../types/dashboard';
import { formatNumber } from '../lib/format';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { AreaChart, TrendingUp, Cpu, Gamepad2, Trophy, Coins } from 'lucide-react';

interface PartnerProfitProps {
  data: ApiResponse<PartnerProfitData> | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function PartnerProfit({ data, isLoading, error }: PartnerProfitProps) {
  if (error) return null;
  if (isLoading || !data?.Data) {
    return (
      <Card className="p-6">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-white/5" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </Card>
    );
  }

  const d = data.Data;
  const items = [
    { label: 'Spor Cirosu', value: d.SportTurnover, icon: <TrendingUp size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Spor Kazancı', value: d.SportWinning, icon: <Trophy size={16} />, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Casino Cirosu', value: d.CasinoTurnover, icon: <Cpu size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Casino Kazancı', value: d.CasinoWinning, icon: <Gamepad2 size={16} />, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Turnuva Maliyeti', value: d.TournamentCost, icon: <Trophy size={16} />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Bonus', value: d.Bonus, icon: <Coins size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ];

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-5 flex flex-row items-center gap-3">
        <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400 ring-1 ring-blue-500/20">
          <AreaChart size={20} />
        </div>
        <CardTitle className="text-white font-bold text-base mb-0">Partner Kâr Detayları</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {items.map(({ label, value, icon, color, bg }) => (
            <div
              key={label}
              className={cn(
                'group flex flex-col justify-between rounded-xl border border-white/10 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 transition-all hover:border-white/20 hover:bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)]">{label}</span>
                <div className={cn('rounded-lg p-1.5', bg, color)}>{icon}</div>
              </div>
              <div className={cn('mt-3 text-lg font-bold tabular-nums', color)}>
                {formatNumber(value)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
