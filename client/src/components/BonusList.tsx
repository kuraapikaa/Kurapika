import type { BonusListResponse, BonusListItem } from '../types/dashboard';
import { formatNumber, formatDateDisplay } from '../lib/format';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';
import { Gift, Calendar, Clock, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function isBonusActive(row: BonusListItem): boolean {
  return !row.IsDisabled;
}

function BonusTable({ rows, emptyMessage, status }: { rows: BonusListItem[]; emptyMessage: string; status: 'active' | 'inactive' }) {
  return (
    <Card className="premium-card overflow-hidden p-0 bg-white/[0.02] border-white/5">
      <div className="overflow-auto scrollbar-hide">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-black/40 backdrop-blur-3xl border-b border-white/5">
              <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-[0.2em] text-slate-400 text-left whitespace-nowrap border-b border-white/5 pl-4">ID / EXT ID / Partner</th>
              <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-[0.2em] text-slate-400 text-left whitespace-nowrap border-b border-white/5">Bonus Adı</th>
              <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-[0.2em] text-slate-400 text-left whitespace-nowrap border-b border-white/5">Tür</th>
              <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-[0.2em] text-slate-400 text-left whitespace-nowrap border-b border-white/5">Zaman Çizelgesi</th>
              <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-[0.2em] text-slate-400 text-left whitespace-nowrap border-b border-white/5">Parametreler</th>
              <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap border-b border-white/5 pr-4">Durum</th>
            </tr>
          </thead>
          <tbody className="relative z-10">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-24 text-center">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-slate-500 rounded-full blur-[40px] opacity-10" />
                    <Gift size={48} className="relative mx-auto mb-6 text-slate-500" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {rows.map((row: BonusListItem, idx: number) => (
                  <motion.tr
                    key={row.Id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.4) }}
                    className="group transition-all duration-300 hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2.5 pl-4 border-b border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-slate-500 tracking-wider">#{row.Id}</span>
                        <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-tighter">EXT: #{row.ExternalId}</span>
                        <span className="text-[10px] font-bold text-blue-400/60 uppercase tracking-tighter truncate max-w-[120px]">{row.Partner?.Name ?? 'Global'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 border-b border-white/5">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-white uppercase tracking-tight antialiased group-hover:text-blue-300 transition-colors">{row.Name}</span>
                        {row.Description && (
                          <span className="text-[10px] font-medium text-slate-400 line-clamp-1 max-w-[240px]" title={row.Description}>
                            {row.Description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 border-b border-white/5">
                      <span className="inline-flex rounded-lg bg-white/5 border border-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-400 group-hover:bg-white/10 transition-all uppercase tracking-wider">
                        {row.Type?.Name ?? 'Genel'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-white/5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-md bg-white/5">
                            <Calendar size={10} className="text-slate-400" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums uppercase">{formatDateDisplay(row.BeginDate)} – {formatDateDisplay(row.EndDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-md bg-white/5">
                            <Clock size={10} className="text-slate-400" />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter">Süre: {formatNumber(row.ExpirationDays)} gün</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 border-b border-white/5">
                      <div className="text-[10px]">
                        {row.FreeSpinDefinition ? (
                          <div className="flex items-center gap-3">
                            <span className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-blue-400 font-semibold uppercase tracking-wider neon-glow-indigo">FreeSpin</span>
                            <span className="font-semibold text-slate-300 tabular-nums">{row.FreeSpinDefinition.FreeSpinsMinCount} &mdash; {row.FreeSpinDefinition.FreeSpinsMaxCount}</span>
                          </div>
                        ) : row.DepositDefinition ? (
                          <div className="flex items-center gap-3">
                            <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 font-semibold uppercase tracking-wider text-amber-300">Yatırım</span>
                            <span className="font-semibold text-slate-300 tabular-nums">ÇEVRİM: {row.DepositDefinition.BonusWFactor ?? '–'}x</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-bold uppercase tracking-wider italic">Standart Analiz</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right pr-4 border-b border-white/5">
                      {status === 'active' ? (
                        <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 neon-glow-emerald">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          AKTİF
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                          <XCircle size={12} strokeWidth={2.5} />
                          PASİF
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface BonusListProps {
  data: BonusListResponse | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function BonusList({ data, isLoading, error }: BonusListProps) {
  const list = data?.Result ?? [];
  const activeList = list.filter(isBonusActive);
  const inactiveList = list.filter((row) => !isBonusActive(row));

  return (
    <section className="flex flex-col gap-10 h-full">
      <header className="flex flex-wrap items-center justify-between gap-6 px-1">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-xl bg-blue-500/20 blur opacity-75 animate-pulse" />
            <div className="relative rounded-3xl bg-black border border-blue-500/20 p-8.5 text-blue-400 shadow-2xl backdrop-blur-xl">
              <Gift size={24} />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white tracking-tighter uppercase antialiased">Promosyon Merkezi</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Toplam {activeList.length} Aktif Kampanya & Kod</p>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <Card className={cn('border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-400')}>
          {error.message}
        </Card>
      )}

      {isLoading && (
        <Card className="flex h-64 flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-400">Promosyon verileri yükleniyor…</p>
        </Card>
      )}

      {!error && !isLoading && (
        <div className="space-y-16">
          <div className="space-y-6">
            <div className="flex items-center gap-4 px-2">
              <div className="h-8 w-1 rounded-full bg-emerald-500 neon-glow-emerald shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <h3 className="text-lg font-semibold text-white uppercase tracking-wider">Aktif Kampanyalar <span className="ml-3 text-xs font-semibold text-slate-500">[{activeList.length}]</span></h3>
            </div>
            <BonusTable rows={activeList} status="active" emptyMessage="Görünüşe göre şu an aktif bir promosyon yok." />
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 px-2">
              <div className="h-8 w-1 rounded-full bg-white/5" />
              <h3 className="text-lg font-semibold text-slate-400 uppercase tracking-wider">Arşivlenen Teklifler <span className="ml-3 text-xs font-semibold text-slate-500">[{inactiveList.length}]</span></h3>
            </div>
            <div className="opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
              <BonusTable rows={inactiveList} status="inactive" emptyMessage="Geçmiş kampanya verisi temizlendi veya bulunamadı." />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
