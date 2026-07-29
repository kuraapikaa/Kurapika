import { useNavigate } from 'react-router-dom';
import type { GetClientsResponse, ClientItem } from '../types/dashboard';
import { formatNumber, formatDateDisplay } from '../lib/format';
import { cn } from '../lib/utils';
import { getPlayerCategoryFromListRow } from '../lib/playerCategories';
import { Card } from './ui/Card';
import { Users, Filter, ShieldCheck, ShieldAlert, Mail, Phone, MapPin, ExternalLink, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function PlayersTable({
  rows,
  totalCount,
  onPlayerClick,
  kpis,
  kpiLoadingMap
}: {
  rows: ClientItem[];
  totalCount: number;
  onPlayerClick: (id: number, login: string) => void;
  kpis: Record<number, any>;
  kpiLoadingMap: Record<number, boolean>;
}) {
  return (
    <Card className="premium-card overflow-hidden p-0 bg-white/[0.025] border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
      <div className="flex items-center justify-between border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/40 px-4 py-2.5 backdrop-blur-3xl">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em] antialiased">Oyuncu Portföyü & Analiz</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-tighter">Sistem Kaydı</span>
            <span className="text-xs font-semibold text-white tabular-nums">{formatNumber(totalCount)}</span>
          </div>
          <div className="w-px h-6 bg-white/5" />
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-tighter">Aktif Görünüm</span>
            <span className="text-xs font-semibold text-blue-400 tabular-nums">{rows.length}</span>
          </div>
        </div>
      </div>
      <div className="overflow-auto scrollbar-hide">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-[color:var(--panel-muted,#8a919c)] border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20">
              <th className="px-3 py-2.5 font-semibold pl-4 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">Oyuncu / ID</th>
              <th className="px-3 py-2.5 font-semibold border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">Kategori</th>
              <th className="px-3 py-2.5 font-semibold border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">İletişim</th>
              <th className="px-3 py-2.5 font-semibold border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">BTag</th>
              <th className="px-3 py-2.5 font-semibold border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">Partner & Konum</th>
              <th className="px-3 py-2.5 text-right font-semibold border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">P / L Analizi</th>
              <th className="px-3 py-2.5 text-right font-semibold border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">Cüzdan</th>
              <th className="px-3 py-2.5 font-semibold border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">Tarihçe</th>
              <th className="px-3 py-2.5 text-center font-semibold pr-4 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">Durum</th>
            </tr>
          </thead>
          <tbody className="relative z-10">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-32 text-center">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-[50px] opacity-10" />
                    <Users size={56} className="relative mx-auto mb-8 text-[color:var(--panel-faint,#5c6470)]" />
                  </div>
                  <p className="text-[11px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em]">Filtrelere uygun kullanıcı analizi bulunamadı.</p>
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {rows.map((row: ClientItem, idx: number) => {
                  const kpi = kpis[row.Id];
                  const isKpiLoading = kpiLoadingMap[row.Id];
                  const category = getPlayerCategoryFromListRow(row, kpi ?? undefined);

                  const getNum = (obj: any, fields: string[]) => {
                    if (!obj) return undefined;
                    for (const f of fields) {
                      const valRaw = obj[f];
                      if (valRaw !== undefined && valRaw !== null && valRaw !== '') {
                        const cleaned = String(valRaw).replace(/[^\d.-]/g, '');
                        const val = parseFloat(cleaned);
                        if (!isNaN(val)) return val;
                      }
                    }
                    return undefined;
                  };

                  const kpiDep = getNum(kpi, ['DepositAmount', 'TotalDepositAmount', 'TotalDeposit', 'Deposit']);
                  const kpiWith = getNum(kpi, ['WithdrawalAmount', 'TotalWithdrawAmount', 'TotalWithdrawal', 'TotalWithdraw', 'WithdrawAmount', 'Withdrawal']);
                  const kpiPL = getNum(kpi, ['ProfitAndLose', 'ProfitLoss', 'GGR', 'GamingProfitAndLose']);

                  const cleanRowData = (val: any) => {
                    if (val == null || val === '') return 0;
                    const cleaned = String(val).replace(/[^\d.-]/g, '');
                    const parsed = parseFloat(cleaned);
                    return isNaN(parsed) ? 0 : parsed;
                  };

                  const totalDep = kpiDep !== undefined ? kpiDep : cleanRowData(row.TotalDeposit);
                  let totalWith = kpiWith !== undefined ? kpiWith : cleanRowData(row.TotalWithdraw);
                  if (kpiWith === undefined && kpiDep !== undefined && kpiPL !== undefined) {
                    totalWith = kpiDep - kpiPL;
                  }

                  const netPL = totalDep - totalWith;
                  const currentBalance = getNum(kpi, ['Balance', 'CurrentBalance', 'RealBalance', 'TotalBalance']) ?? cleanRowData(row.Balance);

                  return (
                    <motion.tr
                      key={row.Id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.4) }}
                      className="group transition-all duration-300 hover:bg-blue-500/[0.02]"
                    >
                      <td className="px-3 py-2.5 pl-4 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 rounded-xl blur-lg opacity-0 group-hover:opacity-20 transition-opacity" />
                            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] font-semibold text-[11px] text-[color:var(--panel-muted,#8a919c)] group-hover:border-blue-500/30 group-hover:text-blue-400 transition-all shadow-inner">
                              {row.FirstName?.[0]}{row.LastName?.[0] || row.FirstName?.[1] || '?'}
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPlayerClick(row.Id, row.Login || 'N/A');
                              }}
                              className="relative z-10 text-left font-semibold text-white hover:text-blue-400 uppercase tracking-tight antialiased transition-all cursor-pointer"
                            >
                              {row.Login}
                            </button>
                            <span className="text-[10px] text-[color:var(--panel-faint,#5c6470)] font-bold uppercase tracking-tighter">ID: {row.Id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                        <span
                          className="inline-flex rounded-lg px-2.5 py-1 text-[9px] font-semibold uppercase tracking-widest border border-[color:var(--panel-border,rgba(242,244,248,0.1))]"
                          style={{ backgroundColor: `${category.colorBg}22`, color: category.colorText, borderColor: `${category.colorText}33` }}
                          title={category.label}
                        >
                          {category.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                        <div className="flex flex-col gap-1.5 text-[10px]">
                          <div className="flex items-center gap-2 text-[color:var(--panel-muted,#8a919c)] hover:text-blue-400 transition-colors group/mail">
                            <Mail size={12} className="text-[color:var(--panel-faint,#5c6470)] group-hover/mail:text-blue-500" />
                            <span className="truncate max-w-[140px] font-medium">{row.Email || 'E-posta yok'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[color:var(--panel-muted,#8a919c)]">
                            <Phone size={12} className="text-[color:var(--panel-faint,#5c6470)]" />
                            <span className="font-bold tabular-nums">{row.MobilePhone || row.Phone || 'Telefon yok'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                        {row.BTag ? (
                          <span className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-400 border border-blue-500/20 neon-glow-indigo uppercase tracking-widest">
                            {row.BTag}
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase italic tracking-tighter">BTag Yok</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                        <div className="flex flex-col gap-1 text-[10px]">
                          <span className="font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] uppercase tracking-tight">{row.PartnerName || 'Bilinmiyor'}</span>
                          <div className="flex items-center gap-1.5 text-[color:var(--panel-faint,#5c6470)]">
                            <MapPin size={10} />
                            <span className="font-medium">{row.City || 'N/A'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right relative border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                        {isKpiLoading && (
                          <div className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        )}
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[9px] text-[color:var(--panel-faint,#5c6470)] font-semibold uppercase">NET:</span>
                            <span className={cn(
                              "text-xs font-semibold tabular-nums tracking-tighter",
                              netPL >= 0 ? "text-blue-400 neon-glow-indigo" : "text-rose-400"
                            )}>
                              {formatNumber(netPL)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 opacity-60">
                            <span className="text-[8px] text-emerald-500 font-semibold">+{formatNumber(totalDep)}</span>
                            <span className="text-[8px] text-rose-500 font-semibold">-{formatNumber(totalWith)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                        <div className="flex flex-col items-end">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-semibold text-white tabular-nums tracking-tighter">
                              {formatNumber(currentBalance)}
                            </span>
                            <span className="text-[9px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase">{row.CurrencyId}</span>
                          </div>
                          <span className="text-[8px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest mt-0.5">Mevcut Varlık</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                        <div className="flex flex-col gap-1.5 text-[9px]">
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-[color:var(--panel-faint,#5c6470)] font-semibold uppercase tracking-tighter">KAYIT:</span>
                            <span className="font-bold tabular-nums text-[color:var(--panel-muted,#8a919c)]">{formatDateDisplay(row.CreatedLocalDate)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-[color:var(--panel-faint,#5c6470)] font-semibold uppercase tracking-tighter">GİRİŞ:</span>
                            <span className="font-bold tabular-nums text-[color:var(--panel-muted,#8a919c)]">{formatDateDisplay(row.LastLoginLocalDate)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center pr-4 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                        <div className="flex flex-col items-center gap-2">
                          {row.IsLocked ? (
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[9px] font-semibold text-rose-500 border border-rose-500/20 uppercase tracking-widest">
                              <ShieldAlert size={10} strokeWidth={3} /> KİLİTLİ
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[9px] font-semibold text-emerald-400 border border-emerald-500/20 neon-glow-emerald uppercase tracking-widest">
                              <ShieldCheck size={10} strokeWidth={3} /> AKTİF
                            </div>
                          )}
                          <span className="text-[8px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-tighter">{row.Status || 'DOĞRULANDI'}</span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface AllPlayersListProps {
  data: GetClientsResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  rowsPerPage: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  btagTerm: string;
  onBTagChange: (value: string) => void;
}

export function AllPlayersList({
  data,
  isLoading,
  error,
  currentPage,
  onPageChange,
  rowsPerPage,
  searchTerm,
  onSearchChange,
  btagTerm,
  onBTagChange
}: AllPlayersListProps) {
  const navigate = useNavigate();

  const objects = data?.Data?.Objects ?? [];
  const count = data?.Data?.Count ?? 0;
  const totalPages = Math.ceil(count / rowsPerPage);

  // Lynon oyuncu listesi bakiye ve mali KPI alanlarıyla zenginleştirilir.
  // Satır başına ayrı KPI çağrısı yerine aynı toplu yanıt kullanılır.
  const kpis = Object.fromEntries(objects.map((player) => [player.Id, player]));
  const kpiLoadingMap: Record<number, boolean> = {};

  if (error) {
    return (
      <div className="animate-in rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center text-rose-400 backdrop-blur-xl">
        <ShieldAlert size={48} className="mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-bold">Veri İletişim Hatası</h3>
        <p className="mt-2 text-sm opacity-70">{error.message}</p>
      </div>
    );
  }

  if (data?.HasError) {
    return (
      <div className="animate-in rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center text-amber-400 backdrop-blur-xl">
        <ShieldAlert size={48} className="mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-bold">API Uyarısı</h3>
        <p className="mt-2 text-sm opacity-70">{data.AlertMessage || 'Bilinmeyen sistem hatası'}</p>
      </div>
    );
  }

  // Sayfa numaralarını oluştur (Maksimum 7 buton göster, aktif sayfa ortada olacak şekilde)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <section className="flex flex-col gap-10 h-full">
      <header className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.04] text-[color:var(--panel-text-dim,#c8cdd5)]">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white tracking-tighter uppercase antialiased">Oyuncu Yönetimi</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em]">Merkezi Üye Arama & CRM Analizi</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-[10px] font-semibold text-white shadow-xl shadow-blue-500/20 hover:bg-blue-400 transition-all uppercase tracking-widest">
              <ExternalLink size={14} strokeWidth={3} /> DIŞA AKTAR
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 relative group">
                        <div className="relative flex h-10 items-center gap-2.5 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-3">
              <Search className="text-[color:var(--panel-muted,#8a919c)]" size={20} />
              <input
                type="text"
                placeholder="KULLANICI ADI VEYA OYUNCU ID İLE ARA..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-[color:var(--panel-faint,#5c6470)] tracking-widest uppercase"
              />
            </div>
          </div>
          <div className="lg:col-span-3 relative group">
                        <div className="relative flex h-10 items-center gap-2.5 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-3">
              <Filter className="text-[color:var(--panel-muted,#8a919c)]" size={20} />
              <input
                type="text"
                placeholder="BTAG FİLTRESİ..."
                value={btagTerm}
                onChange={(e) => onBTagChange(e.target.value)}
                className="flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-[color:var(--panel-faint,#5c6470)] tracking-widest uppercase"
              />
            </div>
          </div>
          <div className="lg:col-span-3">
            <button className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.03] hover:bg-white/[0.07] text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] hover:text-white transition-all uppercase tracking-widest">
              <Filter size={16} /> GELİŞMİŞ FİLTRELEME
            </button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex h-96 flex-col items-center justify-center gap-4 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.40)]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Veritabanı taranıyor...</p>
        </div>
      ) : (
        <>
          <PlayersTable
            rows={objects}
            totalCount={count}
            kpis={kpis}
            kpiLoadingMap={kpiLoadingMap}
            onPlayerClick={(clientId, clientLogin) => {
              navigate(`/oyuncu/${clientId}/${clientLogin}`);
            }}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-6 py-8 px-2">
              <div className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest">
                Sayfa {currentPage} / {totalPages}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.02] text-[color:var(--panel-muted,#8a919c)] hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition-all"
                >
                  <ChevronLeft size={18} strokeWidth={3} />
                </button>

                <div className="flex items-center gap-1.5 mx-2">
                  {getPageNumbers().map((p, i) => (
                    typeof p === 'number' ? (
                      <button
                        key={i}
                        onClick={() => onPageChange(p)}
                        className={cn(
                          "flex h-10 min-w-[40px] px-3 items-center justify-center rounded-xl text-[11px] font-semibold transition-all border",
                          currentPage === p
                            ? "bg-blue-500 border-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                            : "border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.01] text-[color:var(--panel-muted,#8a919c)] hover:bg-white/5 hover:text-[color:var(--panel-text-dim,#c8cdd5)]"
                        )}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={i} className="px-1 text-[color:var(--panel-faint,#5c6470)] font-extrabold">...</span>
                    )
                  ))}
                </div>

                <button
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.02] text-[color:var(--panel-muted,#8a919c)] hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition-all"
                >
                  <ChevronRight size={18} strokeWidth={3} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
