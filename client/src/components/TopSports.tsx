import type { ApiResponse, TopSportItem } from '../types/dashboard';
import { formatNumber } from '../lib/format';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Trophy } from 'lucide-react';

interface TopSportsProps {
  data: ApiResponse<TopSportItem[]> | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function TopSports({ data, isLoading, error }: TopSportsProps) {
  const rows = data?.Data ?? [];

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-5 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400 ring-1 ring-amber-500/20">
            <Trophy size={20} />
          </div>
          <CardTitle className="text-white font-bold text-base mb-0">En İyi Sporlar (Ciro)</CardTitle>
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Canlı Performans</span>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
          {error && (
            <div className="p-8 text-center text-rose-400">
              <div className="mb-2 font-bold italic opacity-50">Hata</div>
              {error.message}
            </div>
          )}
          {isLoading && (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <div className="text-sm font-medium text-slate-500">Veriler yükleniyor...</div>
            </div>
          )}
          {!error && !isLoading && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    <th className="px-5 py-4 font-extrabold">Spor Branşı</th>
                    <th className="px-5 py-4 text-right font-extrabold">Ciro</th>
                    <th className="px-5 py-4 text-right font-extrabold">Kazanç</th>
                    <th className="px-5 py-4 text-right font-extrabold">Net Kâr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        Gösterilecek veri bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr
                        key={r.SportId}
                        className="group transition-all duration-300 hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-[10px] font-bold text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                              {i + 1}
                            </div>
                            <span className="font-semibold text-slate-200 group-hover:text-white">{r.Name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-slate-300 font-medium">
                          {formatNumber(r.Turnover)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-rose-400/80">
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
