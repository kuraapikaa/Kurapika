import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { dashboardApi } from '../api/client';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { formatNumber } from '../lib/format';
import { useNotificationStore } from '../store/notifications';

export function GlobalNotifications() {
    const knownDeposits = useRef<Set<number>>(new Set());
    const knownWithdrawals = useRef<Set<number>>(new Set());
    const isInitialLoad = useRef(true);
    const addNotification = useNotificationStore((state) => state.addNotification);

    useEffect(() => {
        const fetchLatestTransfers = async () => {
            try {
                const today = new Date();
                const dateRange = { startDate: today.toISOString(), endDate: today.toISOString() };

                const [depRes, withRes] = await Promise.all([
                    dashboardApi.deposits(dateRange),
                    dashboardApi.withdrawalRequests(dateRange)
                ]);

                const deposits = depRes.Data?.Documents?.Objects || [];
                const withdrawals = withRes.Data?.ClientRequests || [];

                // If it's the very first time this runs, we just populate the sets and DON'T notify.
                if (isInitialLoad.current) {
                    deposits.forEach((d: any) => knownDeposits.current.add(d.Id));
                    withdrawals.forEach((w: any) => knownWithdrawals.current.add(w.Id));
                    isInitialLoad.current = false;
                    return;
                }

                // Check for new Deposits
                deposits.forEach((dep: any) => {
                    if (!knownDeposits.current.has(dep.Id)) {
                        knownDeposits.current.add(dep.Id);

                        // Notification specifically if state is Success or pending
                        if (dep.State === 1 || dep.State === 2) {
                            addNotification({
                                type: 'deposit',
                                title: `Yeni Yatırım (${dep.CurrencyId})`,
                                message: `${dep.ClientId} numaralı oyuncu - ${dep.PaymentSystemName || 'Sistem'}`,
                                amount: dep.Amount,
                                currency: dep.CurrencyId,
                                clientId: String(dep.ClientId)
                            });

                            toast.custom(() => (
                                <div className="flex items-start gap-3 p-4 bg-zinc-900/90 border border-emerald-500/20 backdrop-blur-xl rounded-2xl shadow-2xl animate-in fade-in slide-in-from-right-8 pointer-events-auto w-80">
                                    <div className="p-2 bg-emerald-500/10 rounded-full shrink-0">
                                        <ArrowUpFromLine size={20} className="text-emerald-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-white flex items-center justify-between">
                                            Yeni Yatırım
                                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-mono">
                                                {dep.CurrencyId}
                                            </span>
                                        </h4>
                                        <p className="text-xs text-zinc-400 mt-1 truncate">
                                            <span className="font-bold text-zinc-300">{dep.ClientId}</span> numaralı oyuncu
                                        </p>
                                        <div className="mt-2 flex items-center justify-between">
                                            <span className="font-mono font-black text-emerald-400 text-lg">
                                                + {formatNumber(dep.Amount)} ₺
                                            </span>
                                            <span className="text-[10px] text-zinc-500 truncate max-w-[100px]" title={dep.PaymentSystemName || ""}>
                                                {dep.PaymentSystemName || "Sistem"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ), { duration: 6000 });
                        }
                    }
                });

                // Check for new Withdrawals
                withdrawals.forEach((wth: any) => {
                    if (!knownWithdrawals.current.has(wth.Id)) {
                        knownWithdrawals.current.add(wth.Id);

                        // Notify if new withdrawal request (Waiting / pending)
                        if (wth.State === 1 || wth.State === 0) {
                            addNotification({
                                type: 'withdrawal',
                                title: `Yeni Çekim (${wth.CurrencyId})`,
                                message: `${wth.ClientId} numaralı oyuncu - ${wth.PaymentSystemName || 'Sistem'}`,
                                amount: wth.Amount,
                                currency: wth.CurrencyId,
                                clientId: String(wth.ClientId)
                            });

                            toast.custom(() => (
                                <div className="flex items-start gap-3 p-4 bg-zinc-900/90 border border-amber-500/20 backdrop-blur-xl rounded-2xl shadow-2xl animate-in fade-in slide-in-from-right-8 pointer-events-auto w-80">
                                    <div className="p-2 bg-amber-500/10 rounded-full shrink-0">
                                        <ArrowDownToLine size={20} className="text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-white flex items-center justify-between">
                                            Yeni Çekim Talebi
                                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md font-mono">
                                                {wth.CurrencyId}
                                            </span>
                                        </h4>
                                        <p className="text-xs text-zinc-400 mt-1 truncate">
                                            <span className="font-bold text-zinc-300">{wth.ClientId}</span> talep etti
                                        </p>
                                        <div className="mt-2 flex items-center justify-between">
                                            <span className="font-mono font-black text-amber-400 text-lg">
                                                - {formatNumber(wth.Amount)} ₺
                                            </span>
                                            <span className="text-[10px] text-zinc-500 truncate max-w-[100px]" title={wth.PaymentSystemName || ""}>
                                                {wth.PaymentSystemName || "Sistem"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ), { duration: 8000 });
                        }
                    }
                });

            } catch (error) {
                // Silently fail on poll errors to avoid console spam
                console.warn("Notification poll failed", error);
            }
        };

        // Poll every 30 seconds
        const interval = setInterval(fetchLatestTransfers, 30_000);

        // Initial fetch immediately
        fetchLatestTransfers();

        return () => clearInterval(interval);
    }, []);

    return null;
}
