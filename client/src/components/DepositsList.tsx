import { useNavigate } from 'react-router-dom';
import type { DepositsResponse } from '../types/dashboard';
import { formatNumber, formatDateTimeDisplay } from '../lib/format';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Wallet, AlertCircle, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DepositsListProps {
    data: DepositsResponse | undefined;
    isLoading: boolean;
    error: Error | null;
}

export function DepositsList({ data, isLoading, error }: DepositsListProps) {
    const navigate = useNavigate();

    if (error) {
        return (
            <Card className={cn('p-8 text-center border-rose-500/20 bg-rose-500/5 text-rose-400')}>
                <AlertCircle size={48} className="mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-bold">Yatırım Listesi Alınamadı</h3>
                <p className="mt-2 text-sm opacity-80">{error.message}</p>
            </Card>
        );
    }

    if (data?.HasError) {
        return (
            <Card className={cn('p-8 text-center border-amber-500/20 bg-amber-500/5 text-amber-400')}>
                <AlertCircle size={48} className="mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-bold">Sistem Uyarısı</h3>
                <p className="mt-2 text-sm opacity-80">{data.AlertMessage || 'İstek şu an işlenemiyor.'}</p>
            </Card>
        );
    }

    const deposits = [...(data?.Data?.Documents?.Objects ?? [])].sort((a, b) => {
        const dateA = a.CreatedLocal ? new Date(a.CreatedLocal).getTime() : 0;
        const dateB = b.CreatedLocal ? new Date(b.CreatedLocal).getTime() : 0;
        return dateB - dateA;
    });
    const totalAmount = data?.Data?.TotalAmount ?? 0;
    const count = data?.Data?.Documents?.Count ?? deposits.length;

    const columnLabels: Record<string, string> = {
        ClientId: 'Müşteri ID',
        ClientLogin: 'Kullanıcı',
        ClientName: 'Ad Soyad',
        Amount: 'Tutar',
        CurrencyId: 'Döviz',
        Id: 'İşlem No',
        TypeName: 'İşlem Türü',
        CreatedLocal: 'Tarih/Saat',
        PaymentSystemName: 'Yöntem',
        UserName: 'Onaylayan',
        Note: 'Notlar',
    };

    const allKeys = [
        'ClientId', 'ClientLogin', 'ClientName', 'Amount', 'CurrencyId',
        'Id', 'TypeName', 'CreatedLocal', 'PaymentSystemName', 'UserName', 'Note'
    ];

    function formatCell(key: string, val: unknown, row: any): React.ReactNode {
        if (val == null) return <span className="text-slate-600">–</span>;
        if (key === 'CreatedLocal')
            return <span className="tabular-nums opacity-80 text-left">{formatDateTimeDisplay(String(val))}</span>;
        if (key === 'Amount' && typeof val === 'number')
            return <span className="font-bold text-white tabular-nums">{formatNumber(val)}</span>;

        if (key === 'ClientId') return <span className="text-[10px] font-bold text-slate-500">#{String(val)}</span>;
        if (key === 'ClientLogin') {
            const clientId = row.ClientId;
            const clientLogin = row.ClientLogin;
            return (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (clientId && clientLogin) navigate(`/oyuncu/${clientId}/${clientLogin}`);
                    }}
                    className="relative z-10 font-bold text-emerald-400 hover:text-emerald-200 hover:underline transition-all cursor-pointer text-left"
                >
                    {String(val)}
                </button>
            );
        }

        return <span className="truncate max-w-[150px] block text-left" title={String(val)}>{String(val)}</span>;
    }

    return (
        <section className="flex flex-col gap-8 h-full">
            <header className="flex flex-wrap items-center justify-between gap-6 px-1">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="absolute -inset-1 rounded-xl bg-emerald-500/20 blur opacity-75 animate-pulse" />
                        <div className="relative rounded-xl bg-black border border-emerald-500/20 p-3.5 text-emerald-400 shadow-2xl">
                            <Wallet size={24} />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold text-white tracking-tighter uppercase antialiased">Yatırım İşlemleri</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em]">Finansal Giriş & Bakiye Hareketleri</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="premium-card flex items-center gap-6 rounded-xl px-6 py-3 border-white/5 bg-[rgba(242,244,248,0.40)] shadow-inner">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">Toplam İşlem</span>
                            <span className="text-sm font-semibold text-white tabular-nums">{formatNumber(count)}</span>
                        </div>
                        <div className="h-8 w-px bg-white/5" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">Toplam Tutar</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-semibold text-emerald-400 tabular-nums neon-glow-emerald">{formatNumber(totalAmount)}</span>
                                <span className="text-[9px] font-bold text-emerald-600/60 tracking-tighter">TRY</span>
                            </div>
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" className="rounded-xl border-white/5 bg-white/5 hover:bg-white/10 uppercase font-semibold text-[10px] tracking-widest gap-2">
                        <Download size={14} /> DIŞA AKTAR
                    </Button>
                </div>
            </header>

            {isLoading ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-white/5 bg-[rgba(242,244,248,0.40)] min-h-[400px]">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Yatırım verileri senkronize ediliyor...</p>
                </div>
            ) : (
                <Card className="premium-card flex-1 overflow-hidden flex flex-col p-0 bg-[rgba(242,244,248,0.20)] border-white/[0.05]">
                    <div className="overflow-auto scrollbar-hide relative h-full">
                        <table className="w-full text-sm border-separate border-spacing-0">
                            <thead className="sticky top-0 z-20 bg-black/60 backdrop-blur-3xl border-b border-white/5">
                                <tr>
                                    {allKeys.map((key, idx) => (
                                        <th key={key} className={cn(
                                            "px-3 py-2.5 font-semibold text-[10px] uppercase tracking-[0.15em] text-zinc-500 text-left whitespace-nowrap border-b border-white/[0.04]",
                                            idx === 0 && "pl-8"
                                        )}>
                                            {columnLabels[key] ?? key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="relative z-10">
                                {deposits.length === 0 ? (
                                    <tr>
                                        <td colSpan={allKeys.length} className="p-24 text-center">
                                            <div className="relative inline-block">
                                                <div className="absolute inset-0 bg-zinc-500 rounded-full blur-[40px] opacity-10" />
                                                <Wallet size={48} className="relative mx-auto mb-6 text-zinc-800" />
                                            </div>
                                            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Şu an için yatırım kaydı bulunamadı.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    <AnimatePresence>
                                        {deposits.map((row, rowIdx) => (
                                            <motion.tr
                                                key={row.Id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: Math.min(rowIdx * 0.03, 0.5) }}
                                                className="group transition-all duration-300 hover:bg-emerald-500/[0.02]"
                                            >
                                                {allKeys.map((key, colIdx) => (
                                                    <td key={key} className={cn(
                                                        "px-3 py-2.5 whitespace-nowrap text-zinc-400 group-hover:text-white transition-colors border-b border-white/[0.02]",
                                                        colIdx === 0 && "pl-8 font-semibold text-zinc-500"
                                                    )}>
                                                        {formatCell(key, (row as any)[key], row)}
                                                    </td>
                                                ))}
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </section>
    );
}
