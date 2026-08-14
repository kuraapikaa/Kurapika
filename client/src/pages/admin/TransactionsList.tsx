import { useState } from 'react';
import { DURUM_SINIFI, durumAyrintisi, islemDurumu } from '@/lib/islemDurumu';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/client';
import { useDateRange } from '@/context/DateRangeContext';
import { formatNumber, formatDateTimeWithSeconds } from '@/lib/format';
import { TRANSACTION_TYPES } from '@/lib/constants';
import {
    History,
    Filter,
    Loader2,
    Clock,
    User,
    Gamepad2,
    FileText,
    RotateCcw,
    Check,
    ChevronLeft,
    ChevronsLeft,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

const ROWS_PER_PAGE_OPTIONS = [20, 50, 100, 200, 500];

// Tarih araligi artik prop degil: sayfa rotaya bagli ve aralik zaten
// DateRangeProvider'da.
export function TransactionsList() {
    const { dateRange } = useDateRange();
    const [isFilterOpen, setIsFilterOpen] = useState(true);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);
    const [jumpPage, setJumpPage] = useState('1');

    const [filters, setFilters] = useState({
        ClientId: '',
        ClientLogin: '',
        ExternalId: '',
        Id: '',
        AmountFrom: '',
        AmountTo: '',
        CashDeskId: null as number | null,
        CurrencyId: '',
        TypeId: '',
        UserName: '',
        PaymentSystemId: null as number | null,
        IsTest: null as boolean | null,
    });

    const [activeFilters, setActiveFilters] = useState(filters);

    const { data, isLoading, error } = useQuery({
        queryKey: ['all-transactions', dateRange.startDate, dateRange.endDate, page, activeFilters],
        queryFn: () => dashboardApi.clientTransactions({
            ...activeFilters,
            // Lynon tür kodları '.' içerir (financial.Bet); sunucu yalnızca
            // DocumentTypeIds'i okur, TypeId'yi yok sayar.
            DocumentTypeIds: activeFilters.TypeId?.includes('.') ? [activeFilters.TypeId] : [],
            dateRange,
            SkeepRows: (page - 1) * rowsPerPage,
            MaxRows: rowsPerPage
        }),
        staleTime: 30 * 1000,
    });

    const transactions = data?.Data?.Objects || [];
    // Lynon modunda sunucu kanonik tür listesini döndürür (financial.* / payment.*).
    // Eski numerik TRANSACTION_TYPES yalnızca legacy BetConstruct için geçerli;
    // Lynon'a gönderildiğinde sunucu tarafında hiç okunmadığı için filtre ölüydü.
    const serverTypes = data?.Data?.TransactionTypes;
    const isLynon = data?.Data?.Provider === 'lynon' || (serverTypes?.length ?? 0) > 0;
    const typeOptions = isLynon
        ? [{ label: 'Tümü', value: '' }, ...(serverTypes ?? []).map(t => ({ label: t.name, value: t.id }))]
        : TRANSACTION_TYPES.map(t => ({ label: t.name, value: t.id }));
    const totalCount = data?.Data?.Count || 0;
    const totalPages = Math.ceil(totalCount / rowsPerPage);



    const handlePageChange = (newPage: number) => {
        const validatedPage = Math.max(1, Math.min(totalPages, newPage));
        setPage(validatedPage);
        setJumpPage(validatedPage.toString());
    };

    const handleJumpPage = (e: React.FormEvent) => {
        e.preventDefault();
        const num = parseInt(jumpPage);
        if (!isNaN(num)) {
            handlePageChange(num);
        }
    };

    const handleApplyFilters = () => {
        setPage(1);
        setActiveFilters(filters);
    };

    const handleResetFilters = () => {
        const reset = {
            ClientId: '',
            ClientLogin: '',
            ExternalId: '',
            Id: '',
            AmountFrom: '',
            AmountTo: '',
            CashDeskId: null,
            CurrencyId: '',
            TypeId: '',
            UserName: '',
            PaymentSystemId: null,
            IsTest: null,
        };
        setFilters(reset);
        setActiveFilters(reset);
        setPage(1);
    };

    if (error) {
        return (
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-12 text-center text-rose-400 backdrop-blur-xl">
                <p className="text-lg font-semibold uppercase tracking-widest">Hata</p>
                <p className="mt-2 text-sm opacity-70">{(error as any).message || 'İşlemler yüklenemedi.'}</p>
            </div>
        );
    }

    return (
        <section className="animate-in space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-400/10 text-purple-300 ring-1 ring-purple-400/20">
                        <History size={24} />
                    </div>
                    <div className="text-left">
                        <h2 className="text-xl font-semibold tracking-tight text-white">İşlem Geçmişi</h2>
                        <p className="text-sm text-slate-400">Tüm finansal hareketler</p>
                    </div>
                </div>

                {/* Rows Per Page Selector (Top) */}
                <div className="flex items-center gap-3 rounded-full border border-white/5 bg-white/[0.02] px-4 py-2 backdrop-blur-xl">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">SATIR SAYISI:</span>
                    <select
                        value={rowsPerPage}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            setRowsPerPage(val);
                            setPage(1);
                            setJumpPage('1');
                        }}
                        className="h-8 rounded-full border border-white/5 bg-black/30 px-3 text-xs font-bold text-slate-200 outline-none transition-all focus:ring-1 focus:ring-purple-400/40"
                    >
                        {ROWS_PER_PAGE_OPTIONS.map(opt => (
                            <option key={opt} value={opt} className="bg-white/[0.02]">{opt}</option>
                        ))}
                    </select>
                </div>
            </div>



            {/* Filter Section */}
            <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-xl overflow-hidden transition-all">
                <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2 text-purple-300">
                        <Filter size={18} />
                        <span className="text-sm font-bold uppercase tracking-wider">Filtre</span>
                    </div>
                    {isFilterOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </button>

                {isFilterOpen && (
                    <div className="p-6 border-t border-white/5 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-8">
                            {/* Row 1 */}
                            <FilterInput label="Tarih seçici" value={`${dateRange.startDate} / ${dateRange.endDate}`} disabled icon={Clock} />
                            <FilterSelect
                                label="Vezne"
                                value={filters.CashDeskId?.toString() || ''}
                                onChange={(v) => setFilters({ ...filters, CashDeskId: v ? parseInt(v) : null })}
                                options={[{ label: 'Tümü', value: '' }]}
                            />
                            <FilterSelect
                                label="Para Birimi"
                                value={filters.CurrencyId}
                                onChange={(v) => setFilters({ ...filters, CurrencyId: v })}
                                options={[{ label: 'Tümü', value: '' }, { label: 'TRY', value: 'TRY' }, { label: 'USD', value: 'USD' }, { label: 'EUR', value: 'EUR' }]}
                            />
                            <FilterSelect
                                label="Tür"
                                value={filters.TypeId}
                                onChange={(v) => setFilters({ ...filters, TypeId: v })}
                                options={typeOptions}
                            />
                            <FilterInput label="Oyuncu Kimliği" value={filters.ClientId} onChange={(v) => setFilters({ ...filters, ClientId: v })} />
                            <FilterInput label="Dış Kimlik" value={filters.ExternalId} onChange={(v) => setFilters({ ...filters, ExternalId: v })} />

                            {/* Row 2 */}
                            <FilterInput label="Müşteri Girişi" value={filters.ClientLogin} onChange={(v) => setFilters({ ...filters, ClientLogin: v })} />
                            <FilterInput label="Kullanıcı Adı" value={filters.UserName} onChange={(v) => setFilters({ ...filters, UserName: v })} />
                            <FilterInput label="Miktardan" value={filters.AmountFrom} onChange={(v) => setFilters({ ...filters, AmountFrom: v })} />
                            <FilterInput label="Miktarına" value={filters.AmountTo} onChange={(v) => setFilters({ ...filters, AmountTo: v })} />
                            <FilterInput label="İşlem Kimliği" value={filters.Id} onChange={(v) => setFilters({ ...filters, Id: v })} />
                            <FilterSelect
                                label="Ödeme Türü"
                                value={filters.PaymentSystemId?.toString() || ''}
                                onChange={(v) => setFilters({ ...filters, PaymentSystemId: v ? parseInt(v) : null })}
                                options={[{ label: 'Tümü', value: '' }]}
                            />

                            {/* Row 3 */}
                            <FilterSelect
                                label="Denemede"
                                value={filters.IsTest === null ? '' : filters.IsTest.toString()}
                                onChange={(v) => setFilters({ ...filters, IsTest: v === '' ? null : v === 'true' })}
                                options={[{ label: 'Her İkisi de', value: '' }, { label: 'Evet', value: 'true' }, { label: 'Hayır', value: 'false' }]}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                            <button
                                onClick={handleResetFilters}
                                className="flex items-center gap-2 rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/10 hover:text-white transition-all ring-1 ring-white/5 uppercase tracking-widest"
                            >
                                <RotateCcw size={16} />
                                Sıfırla
                            </button>
                            <button
                                onClick={handleApplyFilters}
                                className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all uppercase tracking-widest"
                            >
                                <Check size={16} />
                                Uygula
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Table Section */}
            <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-xl overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-6">
                        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
                        <p className="text-sm font-semibold text-slate-400 uppercase tracking-[0.4em] animate-pulse">İşlemler Alınıyor...</p>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="py-32 text-center text-slate-400 italic text-sm">Bu filtrelerle kayıtlı işlem bulunamadı.</div>
                ) : (
                    <div className="overflow-x-auto overflow-y-auto max-h-[700px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 sticky top-0 bg-white/[0.02] backdrop-blur-md z-10">
                                    <th className="pb-4 pl-6 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Oyuncu Info</th>
                                    <th className="pb-4 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">İşlem Detayı</th>
                                    <th className="pb-4 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Miktar</th>
                                    <th className="pb-4 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Tarih</th>
                                    <th className="pb-4 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">İşlem Yapan</th>
                                    <th className="pb-4 pt-2 pr-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Durum</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {transactions.map((tx: any) => (
                                    <tr key={tx.Id} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="py-6 pl-6">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.02] text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all ring-1 ring-white/5 shadow-inner">
                                                    <User size={18} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-semibold text-white tracking-tight">{tx.ClientLogin}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: #{tx.ClientId}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-6">
                                            <div className="text-left">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-purple-300 tracking-tight">{tx.TypeName}</span>
                                                    {tx.GameId && tx.GameId > 0 && (
                                                        <div className="rounded-md bg-purple-400/10 px-1.5 py-0.5" title={`Oyun ID: ${tx.GameId}`}>
                                                            <Gamepad2 size={12} className="text-purple-300" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Ref: #{tx.Id}</span>
                                                    {tx.Note && <span className="h-1 w-1 rounded-full bg-white/10" />}
                                                    {tx.Note && <p className="text-[10px] text-slate-400 line-clamp-1 italic max-w-xs">{tx.Note}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-6">
                                            <div className="flex flex-col items-start">
                                                <span className={`text-base font-semibold ${tx.Amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {tx.Amount >= 0 ? '+' : ''}{formatNumber(tx.Amount)} {tx.CurrencyId}
                                                </span>
                                                {tx.ExchangedAmount !== tx.Amount && (
                                                    <span className="text-[9px] text-slate-500 font-bold tracking-tighter uppercase">Baz: {formatNumber(tx.ExchangedAmount)} TRY</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-6">
                                            <div className="flex items-center gap-2 text-slate-400 group-hover:text-white transition-colors">
                                                <Clock size={14} className="opacity-50" />
                                                <span className="text-xs font-bold">{formatDateTimeWithSeconds(tx.CreatedLocal)}</span>
                                            </div>
                                        </td>
                                        <td className="py-6">
                                            <div className="flex items-center gap-2 bg-white/5 py-1.5 px-3 rounded-xl w-fit ring-1 ring-white/5">
                                                <FileText size={14} className="text-slate-400" />
                                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{tx.UserName}</span>
                                            </div>
                                        </td>
                                        <td className="py-6 pr-6 text-right">
                                            {(() => {
                                                // Once `tx.State === 10` bakiliyordu; Lynon State'i STRING
                                                // oldugu icin bu kosul hicbir zaman tutmuyor ve reddedilen
                                                // islem "ISLEMDE" gorunuyordu. Tek kaynak: islemDurumu().
                                                const durum = islemDurumu(tx);
                                                return (
                                                    <span
                                                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ring-1 ${DURUM_SINIFI[durum]}`}
                                                        title={durumAyrintisi(tx)}
                                                    >
                                                        {durumAyrintisi(tx)}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {!isLoading && transactions.length > 0 && (
                    <div className="mt-6 border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between px-6 gap-4">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
                            Toplam {formatNumber(totalCount)} işlemden {(page - 1) * rowsPerPage + 1}-{Math.min(page * rowsPerPage, totalCount)} arası gösteriliyor
                        </p>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handlePageChange(1)}
                                disabled={page === 1}
                                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white disabled:opacity-20 transition-all"
                                title="İlk Sayfa"
                            >
                                <ChevronsLeft size={16} />
                            </button>
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white disabled:opacity-20 transition-all"
                                title="Önceki Sayfa"
                            >
                                <ChevronLeft size={16} />
                            </button>

                            <form onSubmit={handleJumpPage} className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-purple-400/10 ring-1 ring-purple-400/20 mx-1">
                                <input
                                    type="text"
                                    value={jumpPage}
                                    onChange={(e) => setJumpPage(e.target.value)}
                                    onBlur={() => setJumpPage(page.toString())}
                                    className="w-8 bg-transparent text-center text-sm font-semibold text-white outline-none"
                                />
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">/</span>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{totalPages}</span>
                            </form>

                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === totalPages}
                                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white disabled:opacity-20 transition-all"
                                title="Sonraki Sayfa"
                            >
                                <ChevronLeft size={16} className="rotate-180" />
                            </button>
                            <button
                                onClick={() => handlePageChange(totalPages)}
                                disabled={page === totalPages}
                                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white disabled:opacity-20 transition-all"
                                title="Son Sayfa"
                            >
                                <ChevronsLeft size={16} className="rotate-180" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

interface FilterInputProps {
    label: string;
    value: string;
    onChange?: (v: string) => void;
    disabled?: boolean;
    icon?: any;
}

function FilterInput({ label, value, onChange, disabled, icon: Icon }: FilterInputProps) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pl-1">{label}</label>
            <div className="relative">
                {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    disabled={disabled}
                    className={`h-10 w-full rounded-2xl border border-white/5 bg-white/[0.02] ${Icon ? 'pl-9' : 'px-3'} py-2 text-xs font-medium text-white transition-all focus:border-blue-500/50 focus:ring-1 focus:ring-purple-400/20 outline-none disabled:opacity-50`}
                />
            </div>
        </div>
    );
}

interface FilterSelectProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { label: string; value: string }[];
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pl-1">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                className="h-10 w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs font-medium text-white transition-all focus:border-blue-500/50 focus:ring-1 focus:ring-purple-400/20 outline-none appearance-none backdrop-blur-xl"
            >
                {options.map((opt: any) => (
                    <option key={opt.value} value={opt.value} className="bg-white/[0.02]">{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

