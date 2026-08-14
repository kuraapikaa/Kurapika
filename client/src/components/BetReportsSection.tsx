import { useState } from 'react';
import type { InfiniteData } from '@tanstack/react-query';
import type { GetBetReportResponse } from '../types/dashboard';
import { BetReportDashboard } from './BetReportDashboard';
import { BetReportList } from './BetReportList';
import { BarChart3, LayoutGrid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

type BetReportsSubTab = 'summary' | 'list';

interface BetReportsSectionProps {
  data: InfiniteData<GetBetReportResponse> | undefined;
  isLoading: boolean;
  error: Error | null;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  dateRange?: { startDate: string; endDate: string };
}

export function BetReportsSection({
  data,
  isLoading,
  error,
  onLoadMore,
  hasNextPage,
  isFetchingNextPage,
  dateRange,
}: BetReportsSectionProps) {
  const [subTab, setSubTab] = useState<BetReportsSubTab>('summary');

  return (
    <section className="flex flex-col gap-10 h-full">
      <header className="flex flex-wrap items-center justify-between gap-8 px-1">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-xl bg-cyan-500/20 blur opacity-75 animate-pulse" />
            <div className="relative rounded-3xl bg-black border border-cyan-500/20 p-8.5 text-cyan-400 shadow-2xl backdrop-blur-xl">
              <BarChart3 size={24} />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white tracking-tighter uppercase antialiased">Bahis Raporları</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Merkezi Bahis Analizi & Performans İzleme</p>
            </div>
          </div>
        </div>

        <div className="inline-flex p-1.5 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/[0.05] relative gap-1">
          {[
            { id: 'summary' as const, label: 'ÖZET ANALİZ', icon: LayoutGrid },
            { id: 'list' as const, label: 'DETAYLI LİSTE', icon: List },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={cn(
                "relative group flex items-center gap-2 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-all duration-500 rounded-xl overflow-hidden",
                subTab === id ? "text-white" : "text-slate-400 hover:text-slate-300"
              )}
            >
              {subTab === id && (
                <motion.div
                  layoutId="betReportsSubTab"
                  className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/20 rounded-3xl neon-glow-cyan backdrop-blur-xl"
                />
              )}
              <Icon size={14} className={cn("relative z-10 transition-transform group-hover:scale-110", subTab === id ? "text-cyan-400" : "text-slate-500")} />
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex-1"
        >
          {subTab === 'summary' ? (
            <BetReportDashboard
              data={data}
              isLoading={isLoading}
              error={error}
              dateRange={dateRange}
            />
          ) : (
            <BetReportList
              data={data}
              isLoading={isLoading}
              error={error}
              onLoadMore={onLoadMore}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              dateRange={dateRange}
              showHeader={false}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
