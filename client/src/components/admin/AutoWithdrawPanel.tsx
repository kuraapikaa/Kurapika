import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Wallet, Loader2, Zap, CheckCircle2, XCircle, Clock, AlertCircle, Inbox, Search, ChevronLeft, ChevronRight, Filter, ArrowUpFromLine, ArrowDownToLine, ListOrdered } from 'lucide-react';
import type { WithdrawalRequestItem, WithdrawalRequestsResponse } from '../../types/dashboard';
import { dashboardApi } from '../../api/client';
import { checkWithdrawal, getWithdrawalAutoStatus } from '../../api/admin';
import { WithdrawalChecklistModal } from './WithdrawalChecklistModal';
import { formatNumber, formatDateTimeWithSeconds } from '../../lib/format';
import { useDateRange } from '../../context/DateRangeContext';

type WithdrawStatus = 'paid' | 'rejected' | 'pending' | 'other';

/**
 * Çekim durumu sınıflandırması.
 *
 * Düz `.toLowerCase()` Türkçe "İ" (U+0130) harfini `i` + birleşen nokta
 * (U+0069 U+0307) yapar; bu yüzden `/iptal/i` "İptal" ile ASLA eşleşmiyordu ve
 * iptal edilen çekimler reddedilen toplamına girmiyordu. `toLocaleLowerCase('tr-TR')`
 * doğru sonucu verir. Ayrıca eski desendeki çıplak `red` alternatifi alt-dizi
 * eşleşmesi yapıyordu ("Credited", "Transferred" gibi durumları da yakalardı);
 * kelime sınırlı hâle getirildi.
 */
export function classifyWithdrawStatus(stateName?: string | null): WithdrawStatus {
  const v = String(stateName ?? '').toLocaleLowerCase('tr-TR').normalize('NFC');
  if (!v) return 'other';
  if (/ödendi|paid|başarılı|success/.test(v)) return 'paid';
  if (/reddedildi|\bred\b|reject|cancel|iptal|başarısız|failed/.test(v)) return 'rejected';
  if (/izin verildi|bekliyor|beklemede|onay|pending|allow|yeni|new|created|oluşturuldu/.test(v)) return 'pending';
  return 'other';
}

function StatusBadge({ stateName }: { stateName?: string | null }) {
  const kind = classifyWithdrawStatus(stateName);
  if (kind === 'paid')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
        <CheckCircle2 size={12} />
        Ödendi
      </span>
    );
  if (kind === 'rejected')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold text-rose-400 ring-1 ring-rose-500/30">
        <XCircle size={12} />
        Reddedildi
      </span>
    );
  if (kind === 'pending')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-400 ring-1 ring-amber-500/30">
        <Clock size={12} />
        Beklemede
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/15 px-2.5 py-1 text-[10px] font-bold text-slate-400 ring-1 ring-slate-500/20">
      {stateName || '—'}
    </span>
  );
}

export function AutoWithdrawPanel() {
  const queryClient = useQueryClient();
  const { dateRange } = useDateRange();
  const [loadingClientId, setLoadingClientId] = useState<number | null>(null);
  const [modalData, setModalData] = useState<{
    account: Record<string, unknown>;
    checklists: any[];
    withdrawalRulesCheck?: any;
    riskAnalysis?: any;
    wagerSummary?: any;
    bonusRules?: any;
  } | null>(null);
  const [checkCache, setCheckCache] = useState<Record<string, NonNullable<typeof modalData>>>({});

  const withdrawalRequestsQuery = useQuery({
    queryKey: ['withdrawal-requests', 'auto-withdraw', dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardApi.withdrawalRequests(dateRange),
    staleTime: 60 * 1000,
  });

  const autoStatusQuery = useQuery({
    queryKey: ['withdrawal-auto-status'],
    queryFn: getWithdrawalAutoStatus,
    staleTime: 30 * 1000,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const data = withdrawalRequestsQuery.data as WithdrawalRequestsResponse | undefined;
  const allRequests = data?.Data?.ClientRequests ?? [];

  // Filtreleme ve Sıralama (Yeniden eskiye)
  const filteredRequests = allRequests
    .filter((req) => {
      // 1) Arama filtresi
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const login = String(req.ClientLogin || '').toLowerCase();
        const idStr = String(req.ClientId || '').toLowerCase();
        if (!login.includes(q) && !idStr.includes(q)) {
          return false;
        }
      }
      // 2) Durum filtresi
      if (statusFilter !== 'all') {
        if (classifyWithdrawStatus(req.StateName) !== statusFilter) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.RequestTimeLocal || a.RequestTime || 0).getTime();
      const timeB = new Date(b.RequestTimeLocal || b.RequestTime || 0).getTime();
      return timeB - timeA;
    });

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage) || 1;
  if (currentPage > totalPages) setCurrentPage(totalPages);

  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const paidRequests = allRequests.filter(r => classifyWithdrawStatus(r.StateName) === 'paid');
  const rejectedRequests = allRequests.filter(r => classifyWithdrawStatus(r.StateName) === 'rejected');

  const paidCount = paidRequests.length;
  const paidAmount = paidRequests.reduce((acc, r) => acc + (r.Amount || 0), 0);

  const rejectedCount = rejectedRequests.length;
  const rejectedAmount = rejectedRequests.reduce((acc, r) => acc + (r.Amount || 0), 0);


  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['withdrawal-requests', 'auto-withdraw'] });
    queryClient.invalidateQueries({ queryKey: ['withdrawal-auto-status'] });
  };

  const handleCheck = async (clientId: number, withdrawalDateLocal?: string | null) => {
    const cacheKey = `${clientId}:${withdrawalDateLocal ?? ''}`;
    const cached = checkCache[cacheKey];
    if (cached) {
      setModalData(cached);
      return;
    }
    setLoadingClientId(clientId);
    setModalData(null);
    try {
      const res = await checkWithdrawal({ clientId, withdrawalDateLocal });
      if (res.HasError || !res.Data) {
        setLoadingClientId(null);
        return;
      }
      const data = {
        account: res.Data.account as Record<string, unknown>,
        checklists: res.Data.checklists ?? [],
        withdrawalRulesCheck: res.Data.withdrawalRulesCheck ?? undefined,
        riskAnalysis: res.Data.riskAnalysis ?? undefined,
        wagerSummary: res.Data.wagerSummary ?? undefined,
        bonusRules: res.Data.bonusRules ?? undefined,
      };
      setCheckCache((prev) => ({ ...prev, [cacheKey]: data }));
      setModalData(data);
    } catch {
      setModalData(null);
    } finally {
      setLoadingClientId(null);
    }
  };

  const lastRun = autoStatusQuery.data?.Data?.lastRunAt;
  const dateLabel = `${dateRange.startDate} — ${dateRange.endDate}`;

  return (
    <div className="animate-in space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-blue-950/30 p-6 shadow-xl shadow-blue-500/5">
        <div className="absolute right-0 top-0 h-64 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-32 w-64 rounded-full bg-blue-500/5 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 ring-2 ring-white/10">
              <Zap size={28} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">Otomatik Çekim Kontrolü</h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                Çekim talepleri · Tarih aralığına göre
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-slate-300 ring-1 ring-white/10">
                  {dateLabel}
                </span>
                {lastRun && (
                  <span className="rounded-full bg-blue-500/15 px-3 py-1 text-[10px] font-bold text-blue-300 ring-1 ring-blue-500/20">
                    Son çalışma: {new Date(lastRun).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={withdrawalRequestsQuery.isLoading}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:from-blue-500 hover:to-blue-500 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            <RefreshCw size={18} className={withdrawalRequestsQuery.isFetching ? 'animate-spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Paid Stats */}
        <div className="group relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition-all duration-300 hover:border-emerald-500/30 hover:bg-emerald-500/10">
          <div className="absolute -right-4 -top-4 opacity-5">
            <CheckCircle2 size={80} className="text-emerald-500" />
          </div>
          <div className="relative flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 transition-all group-hover:scale-110">
              <ArrowUpFromLine size={20} />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500/70">Ödenen Toplam</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-xl font-black tabular-nums text-emerald-400">{formatNumber(paidAmount)}</p>
                <span className="text-[10px] font-bold text-emerald-600/60 uppercase">TRY</span>
              </div>
              <p className="text-[10px] font-bold text-slate-500">{paidCount} İşlem</p>
            </div>
          </div>
        </div>

        {/* Rejected Stats */}
        <div className="group relative overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 transition-all duration-300 hover:border-rose-500/30 hover:bg-rose-500/10">
          <div className="absolute -right-4 -top-4 opacity-5">
            <XCircle size={80} className="text-rose-500" />
          </div>
          <div className="relative flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20 transition-all group-hover:scale-110">
              <ArrowDownToLine size={20} />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-500/70">Reddedilen Toplam</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-xl font-black tabular-nums text-rose-400">{formatNumber(rejectedAmount)}</p>
                <span className="text-[10px] font-bold text-rose-600/60 uppercase">TRY</span>
              </div>
              <p className="text-[10px] font-bold text-slate-500">{rejectedCount} İşlem</p>
            </div>
          </div>
        </div>

        {/* General Stats */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-4 transition-all duration-300 hover:bg-white/[0.08]">
          <div className="absolute -right-4 -top-4 opacity-5">
            <Zap size={80} className="text-slate-400" />
          </div>
          <div className="relative flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400 ring-1 ring-white/10 transition-all group-hover:scale-110">
              <ListOrdered size={20} />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Genel Toplam</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-xl font-black tabular-nums text-white">
                  {formatNumber((allRequests || []).reduce((acc: number, r: any) => acc + (r.Amount || 0), 0))}
                </p>
                <span className="text-[10px] font-bold text-slate-600 uppercase">TRY</span>
              </div>
              <p className="text-[10px] font-bold text-slate-500">{(allRequests || []).length} İşlem</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {loadingClientId !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-slate-950/90 backdrop-blur-md">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
            <Loader2 size={56} className="relative animate-spin text-blue-400" />
          </div>
          <p className="text-xl font-bold text-white">Analiz yapılıyor...</p>
          <p className="text-sm text-slate-400">Oyuncu #{loadingClientId}</p>
        </div>
      )}

      {/* Table card - hidden when analysis is open */}
      {!modalData && (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/40 shadow-xl transition-shadow hover:shadow-2xl hover:shadow-blue-500/5">
          <div className="flex flex-col border-b border-white/5 bg-white/5 sm:flex-row sm:items-center sm:justify-between px-6 py-4 gap-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <Wallet size={16} className="text-blue-400" />
              Çekim talepleri listesi
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="ID veya Kullanıcı Adı..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 w-48 rounded-xl border border-white/10 bg-slate-950/50 pl-9 pr-3 text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              <div className="relative flex items-center gap-2">
                <Filter size={14} className="text-slate-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-xl border border-white/10 bg-slate-950/50 pl-3 pr-8 text-xs font-bold text-slate-300 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none"
                >
                  <option value="all">Tüm Durumlar</option>
                  <option value="pending">Bekleyenler</option>
                  <option value="paid">Ödenenler</option>
                  <option value="rejected">Reddedilenler</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              <div className="text-[10px] font-bold text-slate-500 ml-2">
                Gösterilen: <span className="text-slate-300">{filteredRequests.length}</span>
              </div>
            </div>
          </div>

          {withdrawalRequestsQuery.isLoading ? (
            <div className="p-8">
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl bg-white/5"
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : withdrawalRequestsQuery.error ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-12">
              <AlertCircle size={48} className="text-rose-400/80" />
              <h3 className="font-bold text-rose-300">Liste yüklenemedi</h3>
              <p className="text-center text-sm text-rose-300/80">{(withdrawalRequestsQuery.error as Error).message}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-xl bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/30"
              >
                Tekrar dene
              </button>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800/50 text-slate-500">
                <Inbox size={40} />
              </div>
              <p className="font-bold text-slate-400">Aramanıza veya filtrenize uygun talep bulunamadı.</p>
              <p className="text-xs text-slate-500">Arama metnini değiştirmeyi veya farklı bir aralık seçmeyi deneyin.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                      <th className="px-5 py-4">Oyuncu / Talep</th>
                      <th className="px-5 py-4">Tutar</th>
                      <th className="px-5 py-4">Durum</th>
                      <th className="px-5 py-4">Tarih</th>
                      <th className="px-5 py-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paginatedRequests.map((row: WithdrawalRequestItem, index: number) => (
                      <tr
                        key={row.Id}
                        className="group/row transition-all duration-200 hover:bg-white/[0.04]"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-200">
                            #{row.ClientId}
                          </div>
                          {row.ClientLogin ? (
                            <Link
                              to={`/oyuncu/${row.ClientId}/${row.ClientLogin}`}
                              className="text-xs text-slate-500 transition-colors hover:text-blue-400 block w-fit mt-0.5"
                            >
                              {row.ClientLogin}
                            </Link>
                          ) : (
                            <div className="text-xs text-slate-500 mt-0.5">—</div>
                          )}
                        </td>
                        <td className="px-5 py-4 font-mono text-base font-bold tabular-nums text-slate-300">
                          {formatNumber(row.Amount)} <span className="text-xs font-normal text-slate-500">{row.CurrencyId || 'TRY'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge stateName={row.StateName} />
                        </td>
                        <td className="px-5 py-4 text-xs tabular-nums text-slate-500">
                          {formatDateTimeWithSeconds(row.RequestTimeLocal ?? row.RequestTime ?? null)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleCheck(row.ClientId, row.RequestTimeLocal ?? row.RequestTime ?? undefined)}
                            disabled={loadingClientId !== null}
                            className="group/btn relative overflow-hidden rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:from-emerald-500 hover:to-teal-500 hover:scale-105 hover:shadow-emerald-500/35 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                          >
                            <span className="relative z-10">KONTROL ET</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sayfalama */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-white/5 bg-slate-900/50 px-6 py-4">
                  <span className="text-xs font-medium text-slate-400">
                    Sayfa {currentPage} / {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:hover:bg-white/5"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:hover:bg-white/5"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {modalData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setModalData(null)}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              ← Listeye dön
            </button>
          </div>
          <WithdrawalChecklistModal
            inline
            account={modalData.account as any}
            checklists={modalData.checklists}
            withdrawalRulesCheck={modalData.withdrawalRulesCheck}
            riskAnalysis={modalData.riskAnalysis}
            wagerSummary={modalData.wagerSummary}
            bonusRules={modalData.bonusRules}
            onClose={() => setModalData(null)}
          />
        </div>
      )}

    </div>
  );
}
