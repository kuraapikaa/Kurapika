import { useState, Fragment, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, type InfiniteData } from '@tanstack/react-query';
import type { GetBetReportResponse, BetReportItem } from '../types/dashboard';
import { formatNumber, formatDateTimeDisplay } from '../lib/format';
import { dashboardApi } from '../api/client';
import { BarChart3, ChevronDown, User, List, X, ShieldAlert, Zap, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';

interface BetReportListProps {
  data: InfiniteData<GetBetReportResponse> | undefined;
  isLoading: boolean;
  error: Error | null;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  dateRange?: { startDate: string; endDate: string };
  showHeader?: boolean;
}

const AMOUNT_KEYS = new Set([
  'Amount', 'FreeBetAmount', 'BonusAmount', 'RealBetAmount', 'BonusBetAmount',
  'WagerBonusWinAmount', 'WinningBonus', 'WinningAmount', 'PossibleWin',
  'EquivalentWinning', 'EquivalentAmount', 'EquivalentPossibleWin',
  'EquivalentGGRAmount', 'TaxAmount', 'RemainingAmount', 'EquivalentRemainingAmount',
]);

const HIDDEN_COLUMNS = new Set([
  'UpdateVersion', 'BetSelections', 'Details', 'WageringBonusId',
  'MannuallySettledUserId', 'ManuallySettledUserName', 'StakeTaxAmount',
  'PaidCashDeskName', 'SourceName', 'InfoCashDeskId', 'InfoCashDeskName',
  'InfoBetshopId', 'ClientCashDeskId', 'ClientCashDeskName', 'CashDeskId',
  'CashDeskName', 'BetShopGroupId', 'ClientBetShopGroupId', 'PartnerClientCategoryId',
  'BonusType', 'BonusId', 'Barcode', 'IsCounterOffer', 'IsAutoCashOut',
  'IsCashOutDisabled', 'IsEachWay', 'RecalculatedCount', 'SystemMinCount',
  'ClientBonusId', 'ParentBetId', 'AcceptTypeId', 'CheckStatus', 'InputMethod',
  'Number', 'Created', 'PaidDate', 'CheckDate', 'CalcDate',
]);

const COLUMN_ORDER: string[] = [
  'Id', 'CreatedLocal', 'ClientId', 'ClientLogin', 'ClientName',
  'TypeName', 'Amount', 'CurrencyId', 'Price', 'StateName', 'WinningAmount',
  'PossibleWin', 'IsLive', 'IsTest', 'ClientLoginIP', 'DocumentId',
  'PartnerId', 'FreeBetAmount', 'BonusAmount', 'Source', 'SelectionCount', 'BTag',
];

const COLUMN_LABELS: Record<string, string> = {
  Id: 'Bahis ID', CreatedLocal: 'İşlem Tarihi', ClientId: 'Üye ID', ClientLogin: 'Kullanıcı',
  ClientName: 'Ad Soyad', TypeName: 'Tür', Amount: 'Miktar', CurrencyId: 'Döviz',
  Price: 'Oran', StateName: 'Durum', WinningAmount: 'Kazanç', PossibleWin: 'Olası',
  IsLive: 'Canlı', IsTest: 'Test', ClientLoginIP: 'IP Adresi', DocumentId: 'Belge',
  PartnerId: 'Partner', FreeBetAmount: 'FreeBet', BonusAmount: 'Bonus',
  Source: 'Kaynak', SelectionCount: 'Seçim', BTag: 'BTag',
};

function parseLocalDate(localStr: string | null | undefined): string | null {
  if (!localStr || typeof localStr !== 'string') return null;
  const iso = localStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ddmmyy = localStr.match(/^(\d{2})-(\d{2})-(\d{2})/);
  if (ddmmyy) return `20${ddmmyy[3]}-${ddmmyy[2]}-${ddmmyy[1]}`;
  return null;
}

export function BetReportList({
  data, isLoading, error, onLoadMore, hasNextPage, isFetchingNextPage, dateRange, showHeader = true,
}: BetReportListProps) {
  const navigate = useNavigate();
  const [selectionsModalBetId, setSelectionsModalBetId] = useState<number | null>(null);

  const selectionsQuery = useQuery({
    queryKey: ['bet-selections', selectionsModalBetId],
    queryFn: () => dashboardApi.betSelections(selectionsModalBetId!),
    enabled: selectionsModalBetId != null,
    staleTime: 60 * 1000,
  });

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center text-rose-400 backdrop-blur-xl">
        <ShieldAlert size={48} className="mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-bold">Veri İletişim Hatası</h3>
        <p className="mt-2 text-sm opacity-70">{error.message}</p>
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

  const filtered = rawObjects.filter((o) => inRange(o as Record<string, unknown>));
  const objects = [...filtered].sort((a, b) => {
    const tA = (a as any).CreatedLocal ? new Date(String((a as any).CreatedLocal)).getTime() : 0;
    const tB = (b as any).CreatedLocal ? new Date(String((b as any).CreatedLocal)).getTime() : 0;
    if (isNaN(tA) || isNaN(tB)) return 0;
    return tB - tA;
  });

  const rawKeys = objects.length > 0 ? Object.keys(objects[0] as object) : [];
  const orderSet = new Set(COLUMN_ORDER);
  const allKeys: string[] = [
    ...COLUMN_ORDER.filter((k) => rawKeys.includes(k) && !HIDDEN_COLUMNS.has(k)),
    ...rawKeys.filter((k) => !orderSet.has(k) && !HIDDEN_COLUMNS.has(k)).sort(),
  ];

  function formatCell(key: string, val: unknown, row: BetReportItem): string | ReactNode {
    if (val == null) return <span className="text-slate-500">/</span>;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
      return <span className="tabular-nums text-slate-400 font-medium">{formatDateTimeDisplay(val)}</span>;
    }
    if (typeof val === 'number' && AMOUNT_KEYS.has(key)) {
      const isNegative = val < 0;
      return <span className={cn("font-semibold tabular-nums tracking-tighter", isNegative ? "text-rose-500" : "text-white")}>{formatNumber(val)}</span>;
    }
    if (typeof val === 'boolean') {
      return val ?
        <span className="inline-flex items-center gap-1 text-cyan-400 font-semibold text-[10px] uppercase"><Zap size={10} /> EVET</span> :
        <span className="text-slate-500 font-bold text-[10px] uppercase">HAYIR</span>;
    }
    if (key === 'StateName') {
      const v = String(val).toUpperCase();
      const isWon = /KAZAL|WON|KABUL/i.test(v);
      const isLost = /KAYIP|LOST|RED/i.test(v);
      const isPending = /BEKLE|NEW/i.test(v);

      return (
        <span className={cn(
          "inline-flex items-center rounded-lg px-2.5 py-1 text-[9px] font-semibold border uppercase tracking-wider",
          isWon ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 neon-glow-emerald" :
            isLost ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
              isPending ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                "bg-[rgba(242,244,248,0.08)] text-slate-400 border-white/5"
        )}>
          {v}
        </span>
      );
    }
    if (key === 'Id') {
      return <span className="text-[10px] font-semibold text-cyan-500/70 tabular-nums">#{String(val)}</span>;
    }
    if (key === 'ClientLogin') {
      const clientId = (row as any).ClientId;
      const login = String(val);
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (clientId != null && login) navigate(`/oyuncu/${Number(clientId)}/${encodeURIComponent(login)}`);
          }}
          className="flex items-center gap-1.5 font-semibold text-white hover:text-cyan-400 transition-colors uppercase tracking-tight"
        >
          <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center">
            <User size={10} className="text-slate-400" />
          </div>
          {login}
        </button>
      );
    }
    return <span className="font-bold text-slate-300">{String(val)}</span>;
  }

  const totalCiro = objects.reduce((s, o) => s + (Number((o as any).Amount) || 0), 0);
  const totalCount =
    (data?.pages?.[0] as any)?.Data?.BetData?.Count ??
    (data?.pages?.[0] as any)?.Data?.BetData?.Objects?.length ??
    objects.length;

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card className="flex-1 flex flex-col overflow-hidden bg-white/[0.02] border-white/5 p-0">
        {showHeader && (
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-black/40 px-8 py-5 backdrop-blur-3xl">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] antialiased">Bahis Veri Akışı & Sinyal Analizi</span>
            </div>
            {!isLoading && (
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">İşlem Hacmi</span>
                  <span className="text-xs font-semibold text-white tabular-nums">{formatNumber(objects.length)}</span>
                </div>
                <div className="w-px h-6 bg-white/5" />
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Toplam Ciro</span>
                  <span className="text-xs font-semibold text-emerald-400 tabular-nums">{formatNumber(totalCiro)} <span className="text-[8px] opacity-50">TRY</span></span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto scrollbar-hide">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-slate-400 bg-black/80 backdrop-blur-md">
                <th className="px-3 py-2.5 font-semibold pl-4 border-b border-white/5">Eylem</th>
                {allKeys.map((key) => (
                  <th key={key} className="px-3 py-2.5 font-semibold border-b border-white/5 whitespace-nowrap">
                    {COLUMN_LABELS[key] ?? key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="relative z-10 transition-opacity duration-300">
              {isLoading ? (
                <tr>
                  <td colSpan={allKeys.length + 1} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Veri paketleri senkronize ediliyor...</p>
                    </div>
                  </td>
                </tr>
              ) : objects.length === 0 ? (
                <tr>
                  <td colSpan={allKeys.length + 1} className="p-32 text-center">
                    <BarChart3 size={56} className="mx-auto mb-8 text-slate-500" />
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Analiz edilecek bahis kaydı bulunamadı.</p>
                  </td>
                </tr>
              ) : (
                objects.map((row, idx) => {
                  const r = row as any;
                  const rowId = r.Id || r.BetId || r.DocumentId || `row-${idx}`;
                  const isExpanded = selectionsModalBetId === Number(r.Id);

                  return (
                    <Fragment key={rowId}>
                      <tr className="group transition-all duration-300 hover:bg-cyan-500/[0.02]">
                        <td className="px-3 py-2.5 pl-4 border-b border-white/5">
                          <button
                            type="button"
                            onClick={() => setSelectionsModalBetId(isExpanded ? null : Number(r.Id))}
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
                              isExpanded ? "bg-cyan-500 border-cyan-400 text-white" : "bg-white/[0.02] border-white/5 text-slate-400 hover:border-cyan-500/30 hover:text-cyan-400"
                            )}
                          >
                            {isExpanded ? <X size={14} /> : <List size={14} />}
                          </button>
                        </td>
                        {allKeys.map((key) => (
                          <td key={key} className="px-3 py-2.5 border-b border-white/5 whitespace-nowrap">
                            {formatCell(key, r[key], row as BetReportItem)}
                          </td>
                        ))}
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={allKeys.length + 1} className="p-0 border-b border-white/5">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="bg-black/40 backdrop-blur-3xl p-8"
                            >
                              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.02] overflow-hidden">
                                <div className="flex items-center justify-between px-8 py-5 border-b border-cyan-500/10 bg-black/20">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                                      <Zap size={16} />
                                    </div>
                                    <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Bahis Seçimleri & Piyasa Detayı</span>
                                  </div>
                                </div>
                                <div className="p-4">
                                  {selectionsQuery.isLoading ? (
                                    <div className="flex items-center justify-center py-10">
                                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {selectionsQuery.data?.Data?.map((sel, sIdx) => {
                                        const s = sel as any;
                                        const isWon = /WON|KAZAN/i.test(s.StateName);
                                        const isLost = /LOST|KAYIP/i.test(s.StateName);
                                        return (
                                          <div key={sIdx} className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
                                            <div className="flex items-start justify-between gap-4">
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <Globe size={10} className="text-slate-500" />
                                                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider truncate">{s.SportName} · {s.CompetitionName}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-white uppercase tracking-tight truncate mb-3">{s.MatchName}</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                  <div className="flex flex-col">
                                                    <span className="text-[8px] font-semibold text-slate-500 uppercase">Piyasa</span>
                                                    <span className="text-[11px] font-bold text-slate-300 truncate">{s.MarketName}</span>
                                                  </div>
                                                  <div className="flex flex-col">
                                                    <span className="text-[8px] font-semibold text-slate-500 uppercase">Seçim</span>
                                                    <span className="text-[11px] font-semibold text-cyan-400 truncate">{s.SelectionName}</span>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex flex-col items-end gap-3">
                                                <div className="text-right">
                                                  <span className="text-[8px] font-semibold text-slate-500 uppercase">Oran</span>
                                                  <p className="text-lg font-semibold text-white tabular-nums">{formatNumber(s.Price)}</p>
                                                </div>
                                                <span className={cn(
                                                  "px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border",
                                                  isWon ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                    isLost ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                                                      "bg-[rgba(242,244,248,0.08)] text-slate-400 border-white/5"
                                                )}>{s.StateName}</span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && objects.length > 0 && (
          <div className="shrink-0 border-t border-white/5 bg-black/40 px-8 py-6 backdrop-blur-3xl flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Listedeki Veri</span>
                <span className="text-xs font-semibold text-white">
                  {formatNumber(objects.length)} {totalCount > objects.length && <span className="text-slate-400"> / {formatNumber(totalCount)}</span>}
                </span>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Toplam Hacim</span>
                <span className="text-xs font-semibold text-emerald-400">{formatNumber(totalCiro)} <span className="text-[8px] opacity-50">TRY</span></span>
              </div>
            </div>

            {hasNextPage && (
              <button
                type="button"
                onClick={() => onLoadMore?.()}
                disabled={isFetchingNextPage}
                className="group relative flex items-center gap-3 rounded-xl bg-cyan-600 px-8 py-3.5 text-[11px] font-semibold text-white shadow-xl shadow-cyan-600/20 hover:bg-cyan-500 transition-all uppercase tracking-wider disabled:opacity-20"
              >
                {isFetchingNextPage ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/5 border-t-white" />
                ) : (
                  <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
                )}
                {isFetchingNextPage ? "VERİ ÇEKİLİYOR..." : "DAHA FAZLA YÜKLE"}
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
