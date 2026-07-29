import type { ApiResponse, TopCasinoGameItem } from '../types/dashboard';
import { formatNumber } from '../lib/format';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Gamepad2, Zap } from 'lucide-react';

interface TopCasinoGamesProps {
  data: ApiResponse<TopCasinoGameItem[]> | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function TopCasinoGames({ data, isLoading, error }: TopCasinoGamesProps) {
  const rows = data?.Data ?? [];

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-5 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400 ring-1 ring-blue-500/20">
            <Gamepad2 size={20} />
          </div>
          <CardTitle className="text-white font-bold text-base mb-0">En İyi Casino Oyunları</CardTitle>
        </div>
        <div className={cn('flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded-full ring-1 ring-emerald-500/20')}>
          <Zap size={12} />
          Popüler
        </div>
      </CardHeader>

      <CardContent className="p-0">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">
        {error && (
          <div className="p-8 text-center text-rose-400">
            <div className="mb-2 font-bold italic opacity-50">Hata</div>
            {error.message}
          </div>
        )}
        {isLoading && (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <div className="text-sm font-medium text-[color:var(--panel-muted,#8a919c)]">Oyun verileri çekiliyor...</div>
          </div>
        )}
        {!error && !isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-[color:var(--panel-muted,#8a919c)]">
                  <th className="px-5 py-4 font-extrabold">Oyun Adı</th>
                  <th className="px-5 py-4 text-right font-extrabold">Ciro</th>
                  <th className="px-5 py-4 text-right font-extrabold">Kazanç</th>
                  <th className="px-5 py-4 text-right font-extrabold">Net Kâr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-[color:var(--panel-muted,#8a919c)]">
                      Hiçbir oyun verisi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.GameId}
                      className="group transition-all duration-300 hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(168,85,247,0.5)] opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] group-hover:text-blue-300 transition-colors">{r.Name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-[color:var(--panel-text-dim,#c8cdd5)]">
                        {formatNumber(r.Turnover)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-[color:var(--panel-muted,#8a919c)]">
                        {formatNumber(r.WinningAmount)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${r.ProfitAmount >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {formatNumber(r.ProfitAmount)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </CardContent>
    </Card>
  );
}
