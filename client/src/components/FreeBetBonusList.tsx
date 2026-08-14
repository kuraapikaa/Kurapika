import type { FreeBetBonusResponse, FreeBetBonusItem } from '../types/dashboard';
import { formatNumber, formatDateDisplay } from '../lib/format';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';

interface FreeBetBonusListProps {
  data: FreeBetBonusResponse | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function FreeBetBonusList({ data, isLoading, error }: FreeBetBonusListProps) {
  const list = data?.Data?.Objects ?? [];
  const count = data?.Data?.Count ?? 0;

  return (
    <section className="mt-10">
      <h2 className={cn('mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 border-b border-white/5 pb-2')}>
        Freebet bonusları ({count})
      </h2>
      {error && (
        <Card className={cn('mb-4 border-rose-500/20 bg-rose-500/5 p-4 text-rose-400')}>
          {error.message}
        </Card>
      )}
      {isLoading && (
        <Card className="flex h-24 items-center justify-center text-slate-400">
          Yükleniyor…
        </Card>
      )}
      {!error && !isLoading && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="p-3">ID</th>
                <th className="p-3">BonusId</th>
                <th className="p-3">Ad</th>
                <th className="p-3">Açıklama</th>
                <th className="p-3 text-right">Min seçim</th>
                <th className="p-3 text-right">Min oran</th>
                <th className="p-3 text-right">Min bahis</th>
                <th className="p-3">Başlangıç</th>
                <th className="p-3">Bitiş</th>
                <th className="p-3 text-right">Süre (gün)</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                    Freebet bonusu yok
                  </td>
                </tr>
              ) : (
                list.map((row: FreeBetBonusItem) => (
                  <tr
                    key={row.Id}
                    className="border-b border-white/5 transition hover:bg-white/[0.03] last:border-0"
                  >
                    <td className="p-3 tabular-nums text-slate-400">{row.Id}</td>
                    <td className="p-3 tabular-nums text-slate-400">{row.BonusId}</td>
                    <td className="p-3 font-medium">{row.Name}</td>
                    <td className="max-w-[220px] truncate p-3 text-[#8b949e]" title={row.Description}>
                      {row.Description || '–'}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(row.MinSelCount)}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(row.MinSelPrice)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {row.MinBetPrice != null ? formatNumber(row.MinBetPrice) : '–'}
                    </td>
                    <td className="p-3 tabular-nums">{formatDateDisplay(row.StartDateLocal)}</td>
                    <td className="p-3 tabular-nums">{formatDateDisplay(row.EndDateLocal)}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(row.ExpirationDays)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </section>
  );
}
