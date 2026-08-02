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

  /**
   * "Veri yok" ile "değer sıfır" ayrı gösterilir. Sunucu artık yanıtta
   * bulunmayan alanı null gönderiyor; 0 çizmek ölçümün yokluğunu gerçek
   * bir sıfır gibi gösteriyordu (ör. Rake alanı yanıtta hiç yok).
   */
  const sayi = (v: number | null | undefined) => (v == null ? '—' : formatNumber(v));

  const items = [
    { label: 'Spor Cirosu', value: d.SportTurnover, icon: <TrendingUp size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Spor Kazancı', value: d.SportWinning, icon: <Trophy size={16} />, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Casino Cirosu', value: d.CasinoTurnover, icon: <Cpu size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Casino Kazancı', value: d.CasinoWinning, icon: <Gamepad2 size={16} />, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Turnuva Maliyeti', value: d.TournamentCost, icon: <Trophy size={16} />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    // Uc ayri olcu ARTIK AYRI; onceden biri digerinin yerine geciyordu.
    { label: 'Bonus Bahis', value: d.BonusBet, icon: <Coins size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Bonus Ödemesi', value: d.BonusPayout, icon: <Coins size={16} />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Freespin Kazancı', value: d.FreespinWin, icon: <Coins size={16} />, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Cashback', value: d.Cashback, icon: <Coins size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  const oyunTurleri = d.oyunTurleri ?? [];

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
              <div className={cn('mt-3 text-lg font-bold tabular-nums', value == null ? 'text-[color:var(--panel-faint,#5c6470)]' : color)}>
                {sayi(value)}
              </div>
            </div>
          ))}
        </div>

        {/*
          * Oyun turu kirilimi — rapor 1846. Onceden bu rapor yalnizca
          * casino/spor toplamlarini turetmek icin okunuyor, satirlarin
          * kendisi hic gosterilmiyordu.
          */}
        {oyunTurleri.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[520px] text-left">
              <thead className="bg-black/25 text-[10px] font-bold uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)]">
                <tr>
                  <th className="px-4 py-2.5">Oyun Türü</th>
                  <th className="px-4 py-2.5 text-right">Bahis Adedi</th>
                  <th className="px-4 py-2.5 text-right">Ciro</th>
                  <th className="px-4 py-2.5 text-right">Kazanç</th>
                  <th className="px-4 py-2.5 text-right">GGR</th>
                </tr>
              </thead>
              <tbody>
                {oyunTurleri.map((satir) => (
                  <tr key={satir.tur} className="border-t border-white/[0.06] text-sm text-[color:var(--panel-text-dim,#c8cdd5)]">
                    <td className="px-4 py-2.5 font-semibold text-white">{satir.tur}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{sayi(satir.bahisAdedi)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{sayi(satir.ciro)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{sayi(satir.kazanc)}</td>
                    <td className={cn('px-4 py-2.5 text-right font-bold tabular-nums', (satir.ggr ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                      {sayi(satir.ggr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {d.oyunTuruKaynagi === 'alinamadi' && (
          <p className="mt-4 text-[11px] text-amber-400/90">
            Oyun türü raporu (1846) alınamadı; casino ve spor toplamları pano özetinden türetildi.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
