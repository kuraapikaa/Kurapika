import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/client';
import { useDateRange } from '../context/DateRangeContext';
import { formatNumber } from '../lib/format';
import { Gift, Search, Loader2, AlertCircle, BarChart3, Trophy, Flame, TrendingDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useState } from 'react';

export function ClientBonusReport() {
    const { dateRange } = useDateRange();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    const { data: response, isLoading, error, refetch } = useQuery({
        queryKey: ['client-bonus-report', dateRange.startDate, dateRange.endDate],
        queryFn: () => dashboardApi.bonusReport(dateRange),
    });

    const reportData = response?.Data?.ClientBonusReportData?.Objects ?? [];
    const filteredData = reportData.filter((item: any) => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return (
            String(item.ClientId).includes(s) ||
            (item.ClientName && item.ClientName.toLowerCase().includes(s)) ||
            (item.Name && item.Name.toLowerCase().includes(s))
        );
    });

    const totalBonusAmount = filteredData.reduce((acc: number, item: any) => acc + (item.Amount || 0), 0);
    const totalBonusCost = filteredData.reduce((acc: number, item: any) => acc + (item.TotalPaidAmount > 0 ? item.TotalPaidAmount : (item.WinAmount || 0)), 0);

    // Ana analiz raporları için Bonus Gruplama
    const bonusStats = filteredData.reduce((acc: Record<string, { count: number; paid: number; amount: number }>, item: any) => {
        const name = item.Name || "Diğer Bonuslar";
        if (!acc[name]) acc[name] = { count: 0, paid: 0, amount: 0 };
        acc[name].count += 1;
        acc[name].paid += (item.TotalPaidAmount > 0 ? item.TotalPaidAmount : (item.WinAmount || 0));
        acc[name].amount += (item.Amount || 0);
        return acc;
    }, {});

    const statsArray = Object.entries(bonusStats).map(([name, stats]) => ({
        name,
        count: (stats as { count: number }).count,
        paid: (stats as { paid: number }).paid,
        amount: (stats as { amount: number }).amount
    }));

    // Dashboard Sıralamaları
    const mostUsedBonuses = [...statsArray].sort((a, b) => b.count - a.count);
    const topPayingBonuses = [...statsArray].sort((a, b) => b.paid - a.paid);
    const topVolumeBonuses = [...statsArray].sort((a, b) => b.amount - a.amount);

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                    <p className="text-sm font-bold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">Rapor Yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (error || response?.HasError) {
        return (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-12 text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-rose-500/50" />
                <h3 className="text-lg font-bold text-rose-400">Rapor Yüklenemedi</h3>
                <p className="text-sm text-[color:var(--panel-muted,#8a919c)] mt-2">{response?.AlertMessage || (error as Error)?.message}</p>
                <button
                    onClick={() => refetch()}
                    className="mt-6 rounded-xl bg-rose-500/20 px-6 py-2 text-sm font-bold text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/30"
                >
                    Tekrar Dene
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 flex flex-col min-h-0 h-full">
            {/* Header Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-3 shrink-0">
                <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.40)] p-5 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                        <Gift size={24} className="text-amber-400" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)] mb-1">Toplam Bonus Tutarı</p>
                    <p className="text-2xl font-semibold text-white tabular-nums">
                        {formatNumber(totalBonusAmount)} <span className="text-sm font-normal text-[color:var(--panel-muted,#8a919c)]">TRY</span>
                    </p>
                </div>
                <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.40)] p-5 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                        <Search size={24} className="text-blue-400" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)] mb-1">Verilen Bonus Sayısı</p>
                    <p className="text-2xl font-semibold text-white tabular-nums">
                        {formatNumber(filteredData.length)}
                    </p>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                        <TrendingDown size={24} className="text-rose-400" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-500 mb-1">Bonus Gideri (Maliyet)</p>
                    <p className="text-2xl font-semibold text-rose-400 tabular-nums">
                        {formatNumber(totalBonusCost)} <span className="text-sm font-normal text-rose-500/50">TRY</span>
                    </p>
                </div>
            </div>

            {/* Dashboard Analiz Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* En Çok Kullanılan Bonuslar */}
                <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.40)] p-5 shadow-lg">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)] flex items-center gap-2 mb-4">
                        <BarChart3 size={16} className="text-blue-400" />
                        En Çok Alınanlar
                    </h3>
                    <div className="space-y-3">
                        {mostUsedBonuses.slice(0, 3).map((bonus, idx) => (
                            <div key={idx} className="flex justify-between items-center group">
                                <span className="text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)] truncate pr-4 group-hover:text-blue-400 transition-colors">
                                    {bonus.name}
                                </span>
                                <span className="text-xs font-mono font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md">
                                    {bonus.count} kez
                                </span>
                            </div>
                        ))}
                        {mostUsedBonuses.length === 0 && <span className="text-xs text-[color:var(--panel-muted,#8a919c)]">Veri yok</span>}
                    </div>
                </div>

                {/* En Çok Kazandıran (Maliyetli) Bonuslar */}
                <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.40)] p-5 shadow-lg">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)] flex items-center gap-2 mb-4">
                        <Trophy size={16} className="text-emerald-400" />
                        En Çok Kazandıranlar
                    </h3>
                    <div className="space-y-3">
                        {topPayingBonuses.slice(0, 3).map((bonus, idx) => (
                            <div key={idx} className="flex flex-col gap-1 group">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)] truncate pr-2 group-hover:text-emerald-400 transition-colors">
                                        {bonus.name}
                                    </span>
                                    <span className="text-xs font-mono font-semibold text-emerald-400">
                                        {formatNumber(bonus.paid)} ₺
                                    </span>
                                </div>
                                <div className="w-full bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] rounded-full h-1 mt-1 overflow-hidden">
                                    <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${Math.min((bonus.paid / (totalBonusCost || 1)) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        ))}
                        {topPayingBonuses.length === 0 && <span className="text-xs text-[color:var(--panel-muted,#8a919c)]">Veri yok</span>}
                    </div>
                </div>

                {/* En Pahalı (Yüksek Mevla) Bonuslar */}
                <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.40)] p-5 shadow-lg">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)] flex items-center gap-2 mb-4">
                        <Flame size={16} className="text-rose-400" />
                        En Yüksek Hacimliler
                    </h3>
                    <div className="space-y-3">
                        {topVolumeBonuses.slice(0, 3).map((bonus, idx) => (
                            <div key={idx} className="flex justify-between items-center group">
                                <span className="text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)] truncate pr-4 group-hover:text-rose-400 transition-colors">
                                    {bonus.name}
                                </span>
                                <span className="text-xs font-mono font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                                    {formatNumber(bonus.amount)} ₺
                                </span>
                            </div>
                        ))}
                        {topVolumeBonuses.length === 0 && <span className="text-xs text-[color:var(--panel-muted,#8a919c)]">Veri yok</span>}
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.40)] shadow-xl overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/5 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)] flex items-center gap-2">
                        <Gift size={18} className="text-amber-400" />
                        Tüm Verilen Bonuslar
                    </h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--panel-muted,#8a919c)]" size={16} />
                        <input
                            type="text"
                            placeholder="Oyuncu ID, Adı veya Bonus Adı..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-10 w-full sm:w-64 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.50)] pl-10 pr-4 text-sm text-white placeholder:text-[color:var(--panel-muted,#8a919c)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="overflow-auto flex-1 h-[600px]">
                    <table className="w-full text-sm text-left relative">
                        <thead className="sticky top-0 z-10 bg-[rgba(242,244,248,0.95)] backdrop-blur-sm">
                            <tr className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">
                                <th className="px-3 py-2.5 whitespace-nowrap">Oyuncu</th>
                                <th className="px-3 py-2.5 whitespace-nowrap">Bonus Türü</th>
                                <th className="px-3 py-2.5 text-right whitespace-nowrap">Verilen (TRY)</th>
                                <th className="px-3 py-2.5 text-right whitespace-nowrap">Ödenen (TRY)</th>
                                <th className="px-3 py-2.5 text-right whitespace-nowrap">Çevrim (Anlık/Hedef)</th>
                                <th className="px-3 py-2.5 whitespace-nowrap text-center">Durum / Sonuç</th>
                                <th className="px-3 py-2.5 whitespace-nowrap">Ekleyen & Tarih</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-[color:var(--panel-muted,#8a919c)]">Kayıt bulunamadı.</td>
                                </tr>
                            ) : (
                                filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((item: any, idx: number) => {
                                    return (
                                        <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">{item.ClientId}</span>
                                                    <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)] truncate max-w-[200px]">{item.ClientName || "-"}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-amber-400">{item.Name || "Bonus"}</span>
                                                    <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)] truncate max-w-[250px]" title={item.Description}>
                                                        {item.Description || "-"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-mono font-semibold text-rose-400">{formatNumber(item.Amount)}</span>
                                                    <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">Real: {formatNumber(item.RealAmount)}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-mono font-semibold text-emerald-400">
                                                        {formatNumber(item.TotalPaidAmount > 0 ? item.TotalPaidAmount : (item.AmountInRc || item.Amount))}
                                                    </span>
                                                    <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">
                                                        Kazanılan: {formatNumber(item.WinAmount || item.TotalPaidAmount || 0)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-mono font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">
                                                        {formatNumber(item.WageredAmount)} / {formatNumber(item.ToWagerAmount)}
                                                    </span>
                                                    <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">
                                                        Kalan Gün: {item.ExpirationDays || "-"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <div className="flex flex-col items-center">
                                                    {item.ResultType === 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-500">Aktif/Bekliyor</span>}
                                                    {item.ResultType === 1 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-500">Kazanıldı</span>}
                                                    {item.ResultType === 2 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-500">Kaybedildi</span>}
                                                    {item.ResultType === 3 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[rgba(242,244,248,0.20)] text-[color:var(--panel-muted,#8a919c)]">İptal Edildi</span>}
                                                    <span className="text-[9px] text-[color:var(--panel-muted,#8a919c)] uppercase mt-1">Accept: {item.AcceptanceType}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-[11px] text-[color:var(--panel-text-dim,#c8cdd5)]">{item.CreatedByUserName || "Sistem"}</span>
                                                    <span className="font-mono text-[10px] text-[color:var(--panel-muted,#8a919c)]">{item.CreatedLocal?.split('T').join(' ').split('.')[0] || "-"}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.95)] px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-[color:var(--panel-muted,#8a919c)]">
                        <span>Gösterilen: </span>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => {
                                setRowsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[rgba(242,244,248,0.50)] px-2 py-1 text-white focus:border-blue-500 focus:outline-none"
                        >
                            {[20, 50, 100, 250, 500].map((pageSize) => (
                                <option key={pageSize} value={pageSize}>
                                    {pageSize} kayıt
                                </option>
                            ))}
                        </select>
                        <span className="ml-2">
                            Toplam {filteredData.length} kayıt
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="rounded-lg p-2 text-[color:var(--panel-muted,#8a919c)] hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronsLeft size={18} />
                        </button>
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="rounded-lg p-2 text-[color:var(--panel-muted,#8a919c)] hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-sm font-medium text-[color:var(--panel-text-dim,#c8cdd5)] min-w-[5rem] text-center w-auto">
                            Sayfa {currentPage} / {Math.ceil(filteredData.length / rowsPerPage) || 1}
                        </span>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredData.length / rowsPerPage) || 1, p + 1))}
                            disabled={currentPage === Math.ceil(filteredData.length / rowsPerPage) || filteredData.length === 0}
                            className="rounded-lg p-2 text-[color:var(--panel-muted,#8a919c)] hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(Math.ceil(filteredData.length / rowsPerPage) || 1)}
                            disabled={currentPage === Math.ceil(filteredData.length / rowsPerPage) || filteredData.length === 0}
                            className="rounded-lg p-2 text-[color:var(--panel-muted,#8a919c)] hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronsRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
