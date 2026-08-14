import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowDownToLine, ArrowUpFromLine, Database, Gift, Wallet } from 'lucide-react';
import { dashboardApi, type DateRange } from '../api/client';
import { formatNumber } from '../lib/format';

export function NarcosKpiPanel({ dateRange, enabled }: { dateRange: DateRange; enabled: boolean }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['narcos-operational-kpi', dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardApi.narcosKpi(dateRange),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (error || (!isLoading && !data?.Data)) return null;
  const kpi = data?.Data;
  const cards = [
    { label: 'Yatırım', value: kpi?.players?.deposits, icon: ArrowDownToLine, tone: 'text-emerald-300' },
    { label: 'Çekim', value: kpi?.players?.withdrawals, icon: ArrowUpFromLine, tone: 'text-rose-300' },
    { label: 'GGR', value: kpi?.players?.ggr, icon: Activity, tone: 'text-[color:var(--panel-info,#64d2ff)]' },
    { label: 'Bonus', value: kpi?.bonuses?.amount, icon: Gift, tone: 'text-sky-300' },
    { label: 'Toplam bakiye', value: kpi?.players?.totalBalance, icon: Wallet, tone: 'text-purple-300' },
  ];

  return (
    <section className="rounded-3xl border border-[color:var(--panel-border-strong,rgba(10,132,255,0.34))] bg-white/[0.02] p-8 shadow-[0_14px_45px_rgba(0,0,0,.2)] backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[color:var(--panel-info,#64d2ff)]"><Database size={16} /><span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Lynon canlı rapor KPI</span></div>
        <span className="text-[10px] font-bold text-slate-400">Ana kaynak: Players Overview · GMT+3 · 5 dk önbellek</span>
      </div>
      <div className="grid grid-cols-2 gap-8 lg:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-3xl border border-white/[0.06] bg-black/25 p-8 backdrop-blur-xl">
            <Icon size={16} className={tone} />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">{isLoading ? '—' : `${formatNumber(Number(value || 0))} ₺`}</p>
          </div>
        ))}
      </div>
    </section>
  );
}