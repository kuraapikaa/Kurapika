import type { ApiResponse, SummaryData } from '../types/dashboard';
import { formatNumber } from '../lib/format';
import { cn } from '../lib/utils';
import { ErrorState } from './ui/ErrorState';
import { AdminCard } from './ui/admin';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Gift, LogIn, UserPlus, Users, Wallet } from 'lucide-react';

interface SummaryCardsProps {
  data: ApiResponse<SummaryData> | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

type Accent = 'neutral' | 'emerald' | 'sky';

const ACCENT_CHIP: Record<Accent, string> = {
  neutral: 'border-white/[0.08] bg-white/[0.04] text-slate-300',
  emerald: 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300',
  sky: 'border-sky-400/20 bg-sky-400/[0.08] text-sky-300',
};

function MetricCard({
  label,
  value,
  meta,
  icon,
  accent = 'neutral',
  delay = 0,
}: {
  label: string;
  value: string;
  meta?: string;
  icon: React.ReactNode;
  accent?: Accent;
  delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <AdminCard className="flex min-h-[112px] flex-col justify-between p-4 transition-colors hover:border-white/[0.12]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', ACCENT_CHIP[accent])}>
            {icon}
          </span>
        </div>
        <div className="mt-4">
          <p className="text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">{value}</p>
          {meta && <p className="mt-2 text-[11px] font-medium text-slate-500">{meta}</p>}
        </div>
      </AdminCard>
    </motion.div>
  );
}

export function SummaryCards({ data, isLoading, error, onRetry }: SummaryCardsProps) {
  if (error) {
    return <ErrorState message={error.message} onRetry={onRetry} className="rounded-xl" />;
  }

  if (isLoading || !data?.Data) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[112px] animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.025]" />
        ))}
      </div>
    );
  }

  const d = data.Data;
  const net = d.Deposits - d.Withdrawals;

  // Marj gerçek veriden hesaplanır. Önceki dönem alanı API yanıtında yok, bu
  // yüzden dönemsel değişim yüzdesi gösterilmiyor — uydurulmuş bir trend
  // rakamı finansal panelde gerçek sanılacağı için kaldırıldı.
  const marginPct = d.Deposits > 0 ? (net / d.Deposits) * 100 : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Toplam Yatırım"
          value={`${formatNumber(d.Deposits)} ₺`}
          meta={`${formatNumber(d.DepositCount)} işlem · ${formatNumber(d.DepositClientCount)} oyuncu`}
          icon={<Wallet size={16} />}
          accent="emerald"
        />
        <MetricCard
          label="Toplam Çekim"
          value={`${formatNumber(d.Withdrawals)} ₺`}
          meta={`${formatNumber(d.WithdrawalCount)} işlem · ${formatNumber(d.WithdrawalClientCount)} oyuncu`}
          icon={<ArrowUpRight size={16} />}
          accent="sky"
          delay={0.04}
        />
        <MetricCard
          label="Net Gelir (NGR)"
          value={`${formatNumber(net)} ₺`}
          meta={marginPct != null ? `Marj %${marginPct.toFixed(1)}` : 'Marj hesaplanamıyor'}
          icon={net >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          accent={net >= 0 ? 'emerald' : 'neutral'}
          delay={0.08}
        />
        <MetricCard
          label="Aktif Oyuncu"
          value={formatNumber(d.PlayersLoggedIn)}
          meta={`${formatNumber(d.LoginCount)} giriş`}
          icon={<Users size={16} />}
          delay={0.12}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: 'Günlük Girişler', value: d.LoginCount, icon: <LogIn size={15} />, accent: 'neutral' as Accent },
          { label: 'Yeni Kayıtlar', value: d.PlayersRegistered, icon: <UserPlus size={15} />, accent: 'sky' as Accent },
          { label: 'Bonus Bakiyesi', value: d.PlayersBonusBalance, icon: <Gift size={15} />, accent: 'emerald' as Accent },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 + i * 0.04 }}
          >
            <AdminCard className="flex items-center gap-3 p-3.5 transition-colors hover:border-white/[0.12]">
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', ACCENT_CHIP[item.accent])}>
                {item.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                <p className="mt-1 text-[17px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white">
                  {formatNumber(item.value)}
                </p>
              </div>
            </AdminCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
