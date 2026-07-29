import type { InfiniteData } from '@tanstack/react-query';
import type { GetBetReportResponse } from '../types/dashboard';
import { formatNumber } from '../lib/format';
import { BarChart3, Hash, Banknote, Trophy, TrendingUp, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';

/** CreatedLocal "YYYY-MM-DD..." veya "DD-MM-YY ..." formatında olabilir */
function parseLocalDate(localStr: string | null | undefined): string | null {
  if (!localStr || typeof localStr !== 'string') return null;
  const iso = localStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ddmmyy = localStr.match(/^(\d{2})-(\d{2})-(\d{2})/);
  if (ddmmyy) return `20${ddmmyy[3]}-${ddmmyy[2]}-${ddmmyy[1]}`;
  return null;
}

interface BetReportDashboardProps {
  data: InfiniteData<GetBetReportResponse> | undefined;
  isLoading: boolean;
  error: Error | null;
  dateRange?: { startDate: string; endDate: string };
}

export function BetReportDashboard({
  data,
  isLoading,
  error,
  dateRange,
}: BetReportDashboardProps) {
  if (error) {
    return (
      <div className="animate-in rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center text-rose-400 backdrop-blur-xl">
        <ShieldAlert size={48} className="mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-bold">Veri İletişim Hatası</h3>
        <p className="mt-2 text-sm opacity-70">{error.message}</p>
      </div>
    );
  }

  const firstPage = data?.pages?.[0];
  if (firstPage?.HasError) {
    return (
      <div className="animate-in rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center text-amber-400 backdrop-blur-xl">
        <ShieldAlert size={48} className="mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-bold">API Uyarısı</h3>
        <p className="mt-2 text-sm opacity-70">{firstPage.AlertMessage ?? 'Bilinmeyen sistem hatası'}</p>
      </div>
    );
  }

  const rawObjects = (data?.pages ?? []).flatMap((p) => p.Data?.BetData?.Objects ?? []);
  const inRange = dateRange
    ? (o: Record<string, unknown>) => {
      const d = parseLocalDate(String(o.CreatedLocal ?? o.Created ?? ''));
      if (!d) return true;
      return d >= dateRange.startDate && d <= dateRange.endDate;
    }
    : () => true;
  const objects = rawObjects.filter((o) => inRange(o as Record<string, unknown>));
  const totalCount = firstPage?.Data?.BetData?.Count ?? objects.length;
  const totalStake = objects.reduce((s, o) => s + (Number((o as Record<string, unknown>).Amount) || 0), 0);
  const totalWinning = objects.reduce((s, o) => s + (Number((o as Record<string, unknown>).WinningAmount) || 0), 0);
  const avgStake = objects.length > 0 ? totalStake / objects.length : 0;
  const isPartial = totalCount > objects.length;

  const cards = [
    {
      label: 'Toplam Bahis Sayısı',
      value: formatNumber(totalCount),
      sub: isPartial ? `${formatNumber(objects.length)} kayıt yüklendi` : 'Tüm kayıtlar analiz edildi',
      icon: Hash,
      color: 'cyan',
      glowClass: 'neon-glow-cyan',
      borderClass: 'border-cyan-500/20',
      iconClass: 'text-cyan-400',
    },
    {
      label: 'Toplam Bahis Tutarı',
      value: `${formatNumber(totalStake)}`,
      currency: 'TRY',
      sub: isPartial ? 'Yüklenen kayıtlar baz alınmıştır' : 'Net yatırım hacmi',
      icon: Banknote,
      color: 'emerald',
      glowClass: 'neon-glow-emerald',
      borderClass: 'border-emerald-500/20',
      iconClass: 'text-emerald-400',
    },
    {
      label: 'Toplam Kazanç Ödemesi',
      value: `${formatNumber(totalWinning)}`,
      currency: 'TRY',
      sub: isPartial ? 'İnceleme altındaki veri seti' : 'Toplam oyuncu kazancı',
      icon: Trophy,
      color: 'amber',
      glowClass: 'neon-glow-amber',
      borderClass: 'border-amber-500/20',
      iconClass: 'text-amber-400',
    },
    {
      label: 'Ortalama Bahis Hacmi',
      value: `${formatNumber(avgStake)}`,
      currency: 'TRY',
      sub: `${formatNumber(objects.length)} işlem üzerinden`,
      icon: TrendingUp,
      color: 'zinc',
      glowClass: 'neon-glow-zinc',
      borderClass: 'border-zinc-500/20',
      iconClass: 'text-zinc-400',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-white/5 bg-[rgba(242,244,248,0.40)]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Bahis motoru analiz ediliyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className={cn(
              "group relative overflow-hidden p-6 border-white/[0.05] bg-[rgba(242,244,248,0.20)] backdrop-blur-3xl transition-all duration-500 hover:scale-[1.02] hover:bg-[rgba(242,244,248,0.40)]",
              card.borderClass
            )}>
              <div className={cn("absolute -right-4 -top-4 h-24 w-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-700", `bg-${card.color}-500`)} />

              <div className="relative flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-black/40 border border-white/5", card.iconClass, card.glowClass)}>
                    <card.icon size={20} />
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{card.label}</span>
                </div>

                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold text-white tabular-nums tracking-tighter antialiased">
                      {card.value}
                    </span>
                    {card.currency && (
                      <span className="text-xs font-semibold text-zinc-600 uppercase">{card.currency}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[9px] font-bold text-zinc-500 uppercase tracking-tighter opacity-70">
                    {card.sub}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {isPartial && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4 rounded-xl border border-amber-500/10 bg-amber-500/5 p-4 backdrop-blur-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/20 neon-glow-amber">
            <BarChart3 size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-white uppercase tracking-wider">Kısmi Veri Analizi</p>
            <p className="text-[10px] font-bold text-amber-500/70 uppercase tracking-tight mt-0.5">
              Özet veriler şu an sadece ilk {formatNumber(objects.length)} kaydı kapsamaktadır. Tam analiz için listenin tamamını yükleyiniz.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
