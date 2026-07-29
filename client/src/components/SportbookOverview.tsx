import type { ApiResponse, SportbookOverviewData } from '../types/dashboard';
import { formatNumber } from '../lib/format';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Activity, Layers, Radio } from 'lucide-react';

interface SportbookOverviewProps {
  data: ApiResponse<SportbookOverviewData> | undefined;
  isLoading: boolean;
  error: Error | null;
}

function typeBadge(isLive: boolean | null) {
  if (isLive === true) return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/20"><Radio size={10} /> Live</span>;
  if (isLive === false) return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 border border-blue-500/20">Pre-match</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(242,244,248,0.10)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)] border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">Total</span>;
}

export function SportbookOverview({ data, isLoading, error }: SportbookOverviewProps) {
  const details = data?.Data?.Details ?? [];
  const counts = data?.Data?.BetCountsPerType;

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-5 flex flex-row items-center gap-3">
        <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400 ring-1 ring-blue-500/20">
          <Activity size={20} />
        </div>
        <CardTitle className="text-white font-bold text-base mb-0">Spor Kitabı Özeti</CardTitle>
      </CardHeader>

      {error && (
        <div className={cn('mb-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-400')}>
          {error.message}
        </div>
      )}

      {isLoading && (
        <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <div className="text-xs font-medium text-[color:var(--panel-muted,#8a919c)]">Spor kitabı verileri işleniyor…</div>
        </div>
      )}

      {!error && !isLoading && (
        <CardContent className="p-0 space-y-6">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left text-[10px] uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">
                    <th className="px-4 py-4 font-extrabold">Tür</th>
                    <th className="px-4 py-4 text-right font-extrabold">Ciro</th>
                    <th className="px-4 py-4 text-right font-extrabold">Kazanç</th>
                    <th className="px-4 py-4 text-right font-extrabold">Bahis Sayısı</th>
                    <th className="px-4 py-4 text-right font-extrabold">GGR</th>
                    <th className="px-4 py-4 text-right font-extrabold">Kar %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {details.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[color:var(--panel-muted,#8a919c)]">Veri yok</td>
                    </tr>
                  ) : (
                    details.map((row, i) => (
                      <tr
                        key={i}
                        className="group transition-all duration-300 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-4">{typeBadge(row.IsLive)}</td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums text-[color:var(--panel-text-dim,#c8cdd5)]">{formatNumber(row.Turnover)}</td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums text-[color:var(--panel-muted,#8a919c)]">{formatNumber(row.WinningAmount)}</td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums text-[color:var(--panel-muted,#8a919c)]">{formatNumber(row.NumberOfBets)}</td>
                        <td className="px-4 py-4 text-right font-bold tabular-nums text-white">{formatNumber(row.GGR)}</td>
                        <td className="px-4 py-4 text-right">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${row.Profitness >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatNumber(row.Profitness)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {counts && Object.keys(counts).length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['Single', 'Multiple', 'System', 'Chain'] as const).map((key) => (
                <div
                  key={key}
                  className="rounded-xl border border-white/5 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 transition-all duration-300 hover:bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] hover:border-white/10"
                >
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)]">
                    <Layers size={12} className="text-blue-500/50" />
                    {key}
                  </div>
                  <div className="text-lg font-bold tabular-nums text-[color:var(--panel-text-dim,#c8cdd5)]">{formatNumber(counts[key])}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
