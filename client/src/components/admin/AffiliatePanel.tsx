import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  ChevronLeft,
  Mail,
  MapPin,
  PieChart,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { dashboardApi } from '../../api/client';
import { formatDateDisplay, formatNumber } from '../../lib/format';
import type { ClientItem } from '../../types/dashboard';

interface AffiliateStats {
  bTag: string;
  totalPlayers: number;
  activePlayers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netRevenue: number;
  conversionRate: number;
}

function istanbulDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function AffiliatePanel() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBTag, setSelectedBTag] = useState<string | null>(null);

  const range = useMemo(() => ({
    startDate: istanbulDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)),
    endDate: istanbulDate(new Date()),
  }), []);

  const summaryQuery = useQuery({
    queryKey: ['affiliate-summary', range.startDate, range.endDate],
    queryFn: () => dashboardApi.affiliateSummary(range),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const summary = summaryQuery.data?.Data as any;
  const bTagStats = useMemo<AffiliateStats[]>(() => {
    const rows = Array.isArray(summary?.Objects) ? summary.Objects : [];
    return rows.map((item: any) => ({
      bTag: String(item.bTag ?? item.BTag ?? 'BTag Yok'),
      totalPlayers: numberValue(item.totalPlayers ?? item.PlayersCount),
      activePlayers: numberValue(item.activePlayers ?? item.ActivePlayersCount),
      totalDeposits: numberValue(item.totalDeposits ?? item.TotalDepositAmount),
      totalWithdrawals: numberValue(item.totalWithdrawals ?? item.TotalWithdrawAmount),
      netRevenue: numberValue(item.netRevenue ?? item.GGR),
      conversionRate: numberValue(item.conversionRate),
    }));
  }, [summary]);

  const filteredStats = useMemo(
    () => bTagStats.filter((item) => item.bTag.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'))),
    [bTagStats, searchTerm],
  );

  const playersQuery = useQuery({
    queryKey: ['affiliate-btag-players', selectedBTag],
    queryFn: () => dashboardApi.clients({ BTag: selectedBTag, MaxRows: 100, SkeepRows: 0 }),
    enabled: Boolean(selectedBTag && selectedBTag !== 'BTag Yok'),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const players = playersQuery.data?.Data?.Objects ?? [];

  const totalPlayers = numberValue(summary?.TotalPlayers ?? bTagStats.reduce((sum, item) => sum + item.totalPlayers, 0));
  const activePlayers = bTagStats.reduce((sum, item) => sum + item.activePlayers, 0);
  const totalGgr = bTagStats.reduce((sum, item) => sum + item.netRevenue, 0);

  if (selectedBTag) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSelectedBTag(null)} className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/5 p-2 text-[color:var(--panel-muted,#8a919c)] hover:text-white" title="Geri dön">
              <ChevronLeft size={18} />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-white">{selectedBTag} oyuncuları</h2>
              <p className="text-xs text-[color:var(--panel-muted,#8a919c)]">BTag ayrıntısı istek üzerine, en fazla 100 kayıtla yüklenir.</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">
          {selectedBTag === 'BTag Yok' ? (
            <div className="p-10 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">BTag değeri olmayan oyuncular için ayrıntılı arama yapılmaz.</div>
          ) : playersQuery.isLoading ? (
            <div className="p-10 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">Oyuncular yükleniyor...</div>
          ) : players.length === 0 ? (
            <div className="p-10 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">Bu BTag için oyuncu bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 text-[10px] uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)]">
                  <tr>
                    <th className="px-5 py-4">Oyuncu</th>
                    <th className="px-5 py-4">İletişim</th>
                    <th className="px-5 py-4">Konum</th>
                    <th className="px-5 py-4 text-right">Bakiye</th>
                    <th className="px-5 py-4">Kayıt / Son giriş</th>
                    <th className="px-5 py-4 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {players.map((player: ClientItem) => (
                    <tr key={player.Id} className="hover:bg-white/[0.03]">
                      <td className="px-5 py-4">
                        <button type="button" onClick={() => navigate(`/player-profile/${player.Id}/${encodeURIComponent(player.Login)}`)} className="font-bold text-white hover:text-cyan-300">
                          {player.Login}
                        </button>
                        <div className="mt-1 text-[10px] text-[color:var(--panel-faint,#5c6470)]">#{player.Id}</div>
                      </td>
                      <td className="px-5 py-4 text-[color:var(--panel-muted,#8a919c)]"><span className="flex items-center gap-1"><Mail size={12} />{player.Email || 'E-posta yok'}</span></td>
                      <td className="px-5 py-4 text-[color:var(--panel-muted,#8a919c)]"><span className="flex items-center gap-1"><MapPin size={12} />{player.City || '—'}</span></td>
                      <td className="px-5 py-4 text-right font-bold text-white">{formatNumber(numberValue(player.Balance))} {player.CurrencyId || 'TRY'}</td>
                      <td className="px-5 py-4 text-[color:var(--panel-muted,#8a919c)]">{formatDateDisplay(player.CreatedLocalDate)} / {formatDateDisplay(player.LastLoginLocalDate)}</td>
                      <td className="px-5 py-4 text-center">
                        {player.IsLocked ? <span className="inline-flex items-center gap-1 text-rose-400"><ShieldAlert size={13} /> Kilitli</span> : <span className="inline-flex items-center gap-1 text-emerald-400"><ShieldCheck size={13} /> Aktif</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Toplam affiliate', value: formatNumber(bTagStats.length), icon: Users, color: 'text-cyan-300' },
    { label: 'Toplam oyuncu', value: formatNumber(totalPlayers), icon: Target, color: 'text-emerald-300' },
    { label: 'Net gelir (GGR)', value: `${formatNumber(totalGgr)} ₺`, icon: TrendingUp, color: 'text-blue-300' },
    { label: 'Aktif oyuncu', value: formatNumber(activePlayers), icon: UserCheck, color: 'text-amber-300' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">Affiliate merkezi</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">BTag performansı</h2>
          <p className="mt-1 text-sm text-[color:var(--panel-muted,#8a919c)]">Oyuncu ve mali performans, Lynon Oyuncu Genel Bakış raporundan tek istekte hesaplanır.</p>
        </div>
        <label className="relative block w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--panel-faint,#5c6470)]" size={16} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="BTag ara..." className="h-10 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-400/40" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4">
            <div className={`mb-3 inline-flex rounded-lg bg-white/[0.04] p-2 ${card.color}`}><card.icon size={17} /></div>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--panel-faint,#5c6470)]">{card.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">
        <div className="flex items-center justify-between border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-5 py-4">
          <div className="flex items-center gap-2"><BarChart3 size={17} className="text-cyan-300" /><h3 className="text-sm font-bold text-white">BTag kârlılık listesi</h3></div>
          <span className="text-[10px] text-[color:var(--panel-faint,#5c6470)]">{filteredStats.length} kayıt</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 text-[10px] uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)]">
              <tr><th className="px-5 py-4">BTag / Kaynak</th><th className="px-5 py-4">Oyuncu</th><th className="px-5 py-4">Aktif</th><th className="px-5 py-4 text-right">Yatırım / Çekim</th><th className="px-5 py-4 text-right">GGR</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {summaryQuery.isLoading ? (
                <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">BTag raporu hazırlanıyor; oyuncu sayısı rapordan dinamik hesaplanıyor...</td></tr>
              ) : summaryQuery.error ? (
                <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-rose-400"><AlertCircle className="mx-auto mb-2" size={24} />{summaryQuery.error.message}</td></tr>
              ) : filteredStats.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">BTag kaydı bulunamadı.</td></tr>
              ) : filteredStats.map((item) => (
                <tr key={item.bTag} onClick={() => setSelectedBTag(item.bTag)} className="cursor-pointer hover:bg-white/[0.03]">
                  <td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-bold text-white"><PieChart size={14} className="text-cyan-300" />{item.bTag}</span></td>
                  <td className="px-5 py-4 font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">{formatNumber(item.totalPlayers)}</td>
                  <td className="px-5 py-4"><span className="text-emerald-300">{formatNumber(item.activePlayers)}</span><span className="ml-2 text-[color:var(--panel-faint,#5c6470)]">%{formatNumber(item.conversionRate)}</span></td>
                  <td className="px-5 py-4 text-right"><span className="text-emerald-300">{formatNumber(item.totalDeposits)}</span><span className="mx-2 text-[color:var(--panel-faint,#5c6470)]">/</span><span className="text-rose-300">{formatNumber(item.totalWithdrawals)}</span></td>
                  <td className={`px-5 py-4 text-right font-semibold ${item.netRevenue >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>{formatNumber(item.netRevenue)} ₺</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}