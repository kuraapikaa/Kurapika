import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DepositsResponse } from '../types/dashboard';
import { formatNumber, formatDateTimeDisplay } from '../lib/format';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Wallet, AlertCircle, Download } from 'lucide-react';
import { DURUM_ETIKETI, DURUM_SINIFI, durumAyrintisi, islemDurumu, type IslemDurumu } from '../lib/islemDurumu';
import { motion, AnimatePresence } from 'framer-motion';

interface DepositsListProps {
    data: DepositsResponse | undefined;
    isLoading: boolean;
    error: Error | null;
}

export function DepositsList({ data, isLoading, error }: DepositsListProps) {
    const navigate = useNavigate();
    const [suzgec, setSuzgec] = useState<IslemDurumu | 'hepsi'>('hepsi');

    if (error) {
        return (
            <Card className={cn('rounded-3xl border-rose-400/25 bg-rose-400/[0.08] p-8 text-center text-rose-300 backdrop-blur-xl')}>
                <AlertCircle size={48} className="mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-bold">Yatırım Listesi Alınamadı</h3>
                <p className="mt-2 text-sm opacity-80">{error.message}</p>
            </Card>
        );
    }

    if (data?.HasError) {
        return (
            <Card className={cn('rounded-3xl border-amber-400/25 bg-amber-400/[0.08] p-8 text-center text-amber-300 backdrop-blur-xl')}>
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
    const sayimlar = deposits.reduce(
        (acc, row) => {
            acc[islemDurumu(row as any)] += 1;
            return acc;
        },
        { basarili: 0, basarisiz: 0, beklemede: 0 } as Record<IslemDurumu, number>,
    );

    const gorunen = suzgec === 'hepsi' ? deposits : deposits.filter((row) => islemDurumu(row as any) === suzgec);

    // TOPLAM TUTAR yalnizca BASARILI islemleri sayar.
    //
    // Sunucunun donduru TotalAmount reddedilen ve bekleyen kayitlari da
    // topluyor; ekranda "toplam yatirim" olarak gosterilince kasaya
    // girmemis para girmis gibi okunuyordu.
    const basariliToplam = deposits
        .filter((row) => islemDurumu(row as any) === 'basarili')
        .reduce((sum, row) => sum + (Number((row as any).Amount) || 0), 0);
    const hamToplam = data?.Data?.TotalAmount ?? 0;
    const count = data?.Data?.Documents?.Count ?? deposits.length;

    const columnLabels: Record<string, string> = {
        __durum: 'Durum',
        ClientId: 'Müşteri ID',
        ClientLogin: 'Kullanıcı',
        ClientName: 'Ad Soyad',
        Amount: 'Tutar',
        CurrencyId: 'Döviz',
        Id: 'İşlem No',
        TypeName: 'İşlem Türü',
        CreatedLocal: 'Tarih/Saat',
        ModifiedLocal: 'Güncelleme',
        PaymentSystemName: 'Yöntem',
        IntegrationName: 'Sağlayıcı',
        __hesap: 'Hesap',
        commissionFee: 'Komisyon',
        reviewerUserName: 'İnceleyen',
        ExternalId: 'Platform ref.',
        Note: 'Notlar',
    };

    // Durum EN BASTA: operatorun once gormesi gereken sey paranin gecip
    // gecmedigi. Onceden bu kolon hic yoktu ve reddedilen yatirim, listede
    // tamamlanmis yatirimla ayni gorunuyordu.
    //
    // Saglayici, hesap, komisyon ve inceleyen alanlari cevapta zaten
    // geliyordu ama hicbiri ekrana cikmiyordu.
    const allKeys = [
        '__durum', 'ClientId', 'ClientLogin', 'ClientName', 'Amount', 'CurrencyId',
        'Id', 'TypeName', 'CreatedLocal', 'ModifiedLocal', 'PaymentSystemName',
        'IntegrationName', '__hesap', 'commissionFee', 'reviewerUserName', 'ExternalId', 'Note'
    ];

    function formatCell(key: string, val: unknown, row: any): React.ReactNode {
        if (key === '__durum') {
            const durum = islemDurumu(row);
            return (
                <span className={cn(
                    'inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ring-1 whitespace-nowrap',
                    DURUM_SINIFI[durum],
                )} title={durumAyrintisi(row)}>
                    {durumAyrintisi(row)}
                </span>
            );
        }
        if (key === '__hesap') {
            // Cevaptaki inputs alani IBAN ve hesap sahibini tasiyor; cekim
            // incelemesinde en cok bakilan bilgi ama hic gosterilmiyordu.
            const inputs = row?.inputs ?? {};
            const no = String(inputs.account_no ?? inputs.accountNo ?? '').trim();
            const ad = String(inputs.account_title ?? inputs.accountTitle ?? '').trim();
            if (!no && !ad) return <span className="text-slate-500">–</span>;
            return (
                <span className="block max-w-[200px] truncate text-left" title={`${ad} ${no}`.trim()}>
                    {ad && <span className="block truncate text-white/80">{ad}</span>}
                    {no && <span className="block truncate tabular-nums text-[10px]">{no}</span>}
                </span>
            );
        }
        if (val == null) return <span className="text-slate-500">–</span>;
        if (key === 'commissionFee') {
            const n = Number(val);
            if (!Number.isFinite(n) || n === 0) return <span className="text-slate-500">–</span>;
            return <span className="tabular-nums text-amber-300">{formatNumber(n)}</span>;
        }
        if (key === 'ModifiedLocal')
            return <span className="tabular-nums opacity-80 text-left">{formatDateTimeDisplay(String(val))}</span>;
        if (key === 'CreatedLocal')
            return <span className="tabular-nums opacity-80 text-left">{formatDateTimeDisplay(String(val))}</span>;
        if (key === 'Amount' && typeof val === 'number')
            return <span className="font-bold text-white tabular-nums">{formatNumber(val)}</span>;

        if (key === 'ClientId') return <span className="text-[10px] font-bold text-slate-400">#{String(val)}</span>;
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
                        <div className="relative rounded-3xl bg-black border border-emerald-500/20 p-8.5 text-emerald-400 shadow-2xl backdrop-blur-xl">
                            <Wallet size={24} />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold text-white tracking-tighter uppercase antialiased">Yatırım İşlemleri</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Finansal Giriş & Bakiye Hareketleri</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="premium-card flex items-center gap-6 rounded-full px-6 py-3 border-white/5 bg-white/[0.02] shadow-inner">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Toplam İşlem</span>
                            <span className="text-sm font-semibold text-white tabular-nums">{formatNumber(count)}</span>
                        </div>
                        <div className="h-8 w-px bg-white/5" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Başarılı Tutar</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-semibold text-emerald-400 tabular-nums neon-glow-emerald">{formatNumber(basariliToplam)}</span>
                                <span className="text-[9px] font-bold text-emerald-600/60 tracking-tighter">TRY</span>
                            </div>
                        </div>
                        {Math.round(hamToplam) !== Math.round(basariliToplam) && (
                            <>
                                <div className="h-8 w-px bg-white/5" />
                                <div className="flex flex-col" title="Reddedilen ve bekleyen işlemler dahil">
                                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Tüm Kayıtlar</span>
                                    <span className="text-sm font-semibold text-slate-400 tabular-nums">{formatNumber(hamToplam)}</span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        {([
                            ['hepsi', `Hepsi ${deposits.length}`],
                            ['basarili', `${DURUM_ETIKETI.basarili} ${sayimlar.basarili}`],
                            ['basarisiz', `${DURUM_ETIKETI.basarisiz} ${sayimlar.basarisiz}`],
                            ['beklemede', `${DURUM_ETIKETI.beklemede} ${sayimlar.beklemede}`],
                        ] as Array<[IslemDurumu | 'hepsi', string]>).map(([id, etiket]) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setSuzgec(id)}
                                aria-pressed={suzgec === id}
                                className={cn(
                                    'rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors',
                                    suzgec === id
                                        ? 'bg-white/10 text-white'
                                        : 'text-slate-400 hover:bg-white/5',
                                )}
                            >
                                {etiket}
                            </button>
                        ))}
                    </div>
                    <Button variant="secondary" size="sm" className="rounded-full border-white/5 bg-white/5 hover:bg-white/10 uppercase font-semibold text-[10px] tracking-wider gap-2">
                        <Download size={14} /> DIŞA AKTAR
                    </Button>
                </div>
            </header>

            {isLoading ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-3xl border border-white/[0.05] bg-white/[0.02] min-h-[400px] backdrop-blur-xl">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Yatırım verileri senkronize ediliyor...</p>
                </div>
            ) : (
                <Card className="premium-card flex flex-1 flex-col overflow-hidden rounded-3xl p-0 backdrop-blur-xl bg-white/[0.02] border-white/[0.05]">
                    <div className="overflow-auto scrollbar-hide relative h-full">
                        <table className="w-full text-sm border-separate border-spacing-0">
                            <thead className="sticky top-0 z-20 bg-[#0b0a10]/80 backdrop-blur-xl border-b border-white/5">
                                <tr>
                                    {allKeys.map((key, idx) => (
                                        <th key={key} className={cn(
                                            "px-3 py-2.5 font-semibold text-[10px] uppercase tracking-[0.2em] text-slate-400 text-left whitespace-nowrap border-b border-white/5",
                                            idx === 0 && "pl-8"
                                        )}>
                                            {columnLabels[key] ?? key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="relative z-10">
                                {gorunen.length === 0 ? (
                                    <tr>
                                        <td colSpan={allKeys.length} className="p-24 text-center">
                                            <div className="relative inline-block">
                                                <div className="absolute inset-0 bg-slate-500 rounded-full blur-[40px] opacity-10" />
                                                <Wallet size={48} className="relative mx-auto mb-6 text-slate-500" />
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{suzgec === 'hepsi' ? 'Şu an için yatırım kaydı bulunamadı.' : `Bu durumda kayıt yok.`}</p>
                                        </td>
                                    </tr>
                                ) : (
                                    <AnimatePresence>
                                        {gorunen.map((row, rowIdx) => (
                                            <motion.tr
                                                key={row.Id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: Math.min(rowIdx * 0.03, 0.5) }}
                                                className="group transition-all duration-300 hover:bg-emerald-500/[0.02]"
                                            >
                                                {allKeys.map((key, colIdx) => (
                                                    <td key={key} className={cn(
                                                        "px-3 py-2.5 whitespace-nowrap text-slate-400 group-hover:text-white transition-colors border-b border-white/5",
                                                        colIdx === 0 && "pl-8 font-semibold text-slate-400"
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
