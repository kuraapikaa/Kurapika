import { useState, useRef, useEffect } from 'react';
import { Bell, ArrowDownToLine, ArrowUpFromLine, Check, Trash2, X } from 'lucide-react';
import { useNotificationStore } from '../store/notifications';
import { formatNumber } from '../lib/format';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

export function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotificationStore();

    const handleToggle = () => setIsOpen((prev) => !prev);
    const unread = unreadCount();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={handleToggle}
                className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-colors duration-150 group",
                    isOpen ? "bg-white/10 text-white" : "hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200"
                )}
            >
                <Bell size={16} className={cn("transition-transform duration-300", isOpen ? "scale-110" : "group-hover:scale-110")} />

                {unread > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d1119] p-0 shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0a0e15] p-3">
                            <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                                Bildirimler
                                {unread > 0 && (
                                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                                        {unread} Yeni
                                    </span>
                                )}
                            </h3>
                            <div className="flex items-center gap-2">
                                {unread > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white" title="Tümünü okundu işaretle"
                                    >
                                        <Check size={16} />
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button
                                        onClick={clearAll}
                                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400" title="Tümünü temizle"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors md:hidden"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[52vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-10 text-center text-zinc-500">
                                    <Bell size={32} className="mb-4 opacity-20" />
                                    <p className="text-sm">Henüz bildiriminiz yok</p>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            onClick={() => !notif.read && markAsRead(notif.id)}
                                            className={cn(
                                                "relative flex gap-3 p-3 transition-colors border-b border-white/5 cursor-pointer last:border-0 hover:bg-white/5",
                                                notif.read ? "opacity-70" : "bg-white/[0.02]"
                                            )}
                                        >
                                            {!notif.read && (
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                            )}

                                            <div className={cn(
                                                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                                notif.type === 'deposit' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                                            )}>
                                                {notif.type === 'deposit' ? <ArrowUpFromLine size={18} /> : <ArrowDownToLine size={18} />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="truncate text-xs font-semibold text-zinc-100">
                                                        {notif.title}
                                                    </h4>
                                                    <span className="text-[10px] text-zinc-500 shrink-0 whitespace-nowrap mt-0.5">
                                                        {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true, locale: tr })}
                                                    </span>
                                                </div>
                                                <p className="mt-1 truncate text-[11px] text-zinc-400">
                                                    {notif.message}
                                                </p>
                                                <div className="mt-1.5 font-mono text-xs font-bold text-zinc-200">
                                                    {notif.type === 'deposit' ? (
                                                        <span className="text-emerald-400">+ {formatNumber(notif.amount)}</span>
                                                    ) : (
                                                        <span className="text-amber-400">- {formatNumber(notif.amount)}</span>
                                                    )}
                                                    <span className="ml-1 text-xs text-zinc-500">₺</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-white/[0.06] bg-[#0a0e15] p-2 text-center">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Sistem Takip Ediliyor</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
