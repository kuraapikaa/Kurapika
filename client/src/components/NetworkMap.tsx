import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/client';
import { Loader2, Globe, Server, Monitor, AlertTriangle, UserCircle2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';

interface NetworkMapProps {
    loginIp: string | null;
    clientId: string;
}

export function NetworkMap({ loginIp, clientId }: NetworkMapProps) {
    const clientsQuery = useQuery({
        queryKey: ['clients-by-ip', loginIp],
        queryFn: () => loginIp ? dashboardApi.clientsByIP({ LoginIP: loginIp, ClientId: Number(clientId), MaxRows: 50 }) : Promise.resolve(null),
        enabled: !!loginIp,
        staleTime: 60 * 1000
    });

    if (!loginIp) {
        return (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-20 text-center flex flex-col items-center justify-center text-slate-400 backdrop-blur-sm">
                <div className="relative mb-6">
                    <Globe size={64} className="opacity-10" />
                    <AlertTriangle size={24} className="absolute -bottom-2 -right-2 text-amber-500/50" />
                </div>
                <p className="font-semibold uppercase tracking-[0.3em] text-sm text-slate-400">Veri Eksikliği</p>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">Bu oyuncunun aktif bir IP kaydı bulunamadı. Multi-account analizi için yeterli veri yok.</p>
            </div>
        );
    }

    const { data, isLoading, isError } = clientsQuery;

    if (isLoading) {
        return (
            <div className="flex h-[500px] items-center justify-center flex-col gap-6 bg-white/[0.02] rounded-xl border border-white/5">
                <div className="relative">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-8 border border-dashed border-purple-400/25 rounded-full"
                    />
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-16 border border-dashed border-blue-500/10 rounded-full"
                    />
                    <Globe className="text-purple-400/20" size={80} />
                    <Loader2 size={40} className="animate-spin text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="space-y-2 text-center">
                    <p className="text-purple-300 text-xs font-semibold tracking-[0.4em] uppercase">Ağ Taraması Yapılıyor</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{loginIp} analiz ediliyor...</p>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-12 text-center text-rose-400 flex flex-col items-center gap-4">
                <AlertTriangle size={48} className="opacity-50" />
                <div className="space-y-1">
                    <p className="font-bold">Bağlantı Hatası</p>
                    <p className="text-xs text-rose-400/60">Ağ haritası yüklenirken bir sorun oluştu. API bağlantınızı veya yetkilerinizi kontrol edin.</p>
                </div>
            </div>
        );
    }

    const allClients = data?.Data?.Objects ?? [];
    // Orbit nodes include all clients EXCEPT possibly the current one if we want it to be distinct, 
    // but here we show all accounts associated with this IP.
    const isMultiAccountRisk = allClients.length > 1;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 text-left">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-purple-400/10 rounded-xl">
                            <Globe size={20} className="text-purple-300" />
                        </div>
                        Multi-Account Haritası
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider ml-12">Dijital Parmak İzi ve IP Analizi</p>
                </div>
                {isMultiAccountRisk && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 bg-rose-500/10 text-rose-400 px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider border border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
                    >
                        <AlertTriangle size={14} className="animate-pulse" /> Şüpheli İp Çakışması ({allClients.length} Hesap)
                    </motion.div>
                )}
            </div>

            <div className="relative w-full h-[600px] border border-white/5 bg-white/[0.02] rounded-xl overflow-hidden flex items-center justify-center group shadow-2xl">
                {/* Visual Enhancers */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent opacity-50" />
                <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                {/* Orbit Rings */}
                <div className="absolute w-[320px] h-[320px] border border-white/5 rounded-full" />
                <div className="absolute w-[440px] h-[440px] border border-white/5 rounded-full" />

                {/* Central IP Node */}
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    className="relative z-30"
                >
                    <div className={cn(
                        "group/center w-36 h-36 rounded-full border-2 transition-all duration-500 flex flex-col items-center justify-center p-4 backdrop-blur-xl relative cursor-default",
                        isMultiAccountRisk
                            ? 'border-rose-500/40 bg-rose-950/40 shadow-[0_0_80px_rgba(244,63,94,0.2)]'
                            : 'border-blue-500/40 bg-blue-950/40 shadow-[0_0_80px_rgba(99,102,241,0.15)]'
                    )}>
                        <div className={cn(
                            "absolute -inset-3 rounded-full border border-dashed animate-spin-slow opacity-30",
                            isMultiAccountRisk ? 'border-rose-400' : 'border-blue-400'
                        )} />
                        <div className="mb-2 p-2 bg-white/5 rounded-xl">
                            <Server className={isMultiAccountRisk ? 'text-rose-400' : 'text-purple-300'} size={24} />
                        </div>
                        <span className={cn(
                            "text-xs font-semibold tracking-wider text-center",
                            isMultiAccountRisk ? 'text-rose-200' : 'text-blue-200'
                        )}>{loginIp}</span>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] mt-1">Giriş IP</p>

                        {/* Hover Tooltip for Central Node */}
                        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/[0.02] border border-white/5 rounded-lg text-[10px] font-bold text-slate-400 whitespace-nowrap opacity-0 group-hover/center:opacity-100 transition-opacity">
                            Analiz Edilen Bağlantı Noktası
                        </div>
                    </div>
                </motion.div>

                {/* Linked Client Nodes */}
                {allClients.map((client, index) => {
                    const totalNodes = allClients.length;
                    const angle = (index / totalNodes) * (2 * Math.PI) - (Math.PI / 2); // Start from top
                    const radius = totalNodes > 6 ? 220 : 180;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    const isCurrentClient = String(client.Id) === String(clientId);

                    return (
                        <div key={client.Id} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
                            {/* SVG Pulse Connections */}
                            <svg className="absolute inset-0 overflow-visible pointer-events-none" style={{ width: 0, height: 0 }}>
                                <motion.line
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 0.3 }}
                                    transition={{ duration: 1.5, delay: index * 0.15 }}
                                    x1="0" y1="0" x2={x} y2={y}
                                    stroke={isMultiAccountRisk ? "#f43f5e" : "#8b5cf6"}
                                    strokeWidth="1.5"
                                    strokeDasharray="8 8"
                                />
                                <motion.circle
                                    animate={{
                                        cx: [0, x],
                                        cy: [0, y],
                                        opacity: [0, 0.8, 0]
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        delay: index * 0.5,
                                        ease: "easeInOut"
                                    }}
                                    r="3"
                                    fill={isMultiAccountRisk ? "#f43f5e" : "#8b5cf6"}
                                />
                            </svg>

                            {/* Node Element */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    x,
                                    y
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 120,
                                    damping: 12,
                                    delay: index * 0.1 + 0.5
                                }}
                                className={cn(
                                    "absolute flex flex-col items-center justify-center w-28 h-28 rounded-xl border backdrop-blur-md p-3 z-20 cursor-pointer pointer-events-auto transition-all duration-300 group/node",
                                    "hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:-translate-y-1",
                                    isCurrentClient
                                        ? 'border-amber-500/50 bg-amber-950/60 shadow-[0_0_20px_rgba(245,158,11,0.1)] ring-4 ring-amber-500/10'
                                        : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-blue-500/50'
                                )}
                                onClick={() => {
                                    if (!isCurrentClient) {
                                        const username = client.ClientLogin || client.Login || client.FirstName || 'Oyuncu';
                                        window.open(`/#/oyuncu/${client.Id}/${username}`, '_blank');
                                    }
                                }}
                            >
                                <div className={cn(
                                    "mb-2 p-1.5 rounded-lg transition-colors",
                                    isCurrentClient ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-400 group-hover/node:bg-purple-400/20 group-hover/node:text-purple-300'
                                )}>
                                    <UserCircle2 size={24} />
                                </div>

                                {isCurrentClient && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--panel-warning,#ff9f0a)] text-[#050609] text-[8px] font-semibold px-2 py-0.5 rounded-full uppercase shadow-lg whitespace-nowrap">
                                        Aktif Profil
                                    </div>
                                )}

                                <span className={cn(
                                    "text-[11px] font-semibold mt-1 leading-tight text-center px-1 max-w-full truncate",
                                    isCurrentClient ? 'text-amber-200' : 'text-slate-300 group-hover/node:text-white'
                                )}>
                                    {String(client.ClientLogin || client.Login || client.FirstName || 'İsimsiz')}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400 mt-1">#{client.Id}</span>

                                {!isCurrentClient && (
                                    <div className="absolute top-2 right-2 opacity-0 group-hover/node:opacity-100 transition-opacity">
                                        <ExternalLink size={10} className="text-purple-300" />
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allClients.map((client) => {
                    const isMatch = String(client.Id) === String(clientId);
                    return (
                        <motion.div
                            key={`list-${client.Id}`}
                            whileHover={{ y: -2 }}
                            className={cn(
                                "flex items-center justify-between p-5 rounded-xl border transition-all duration-300",
                                isMatch
                                    ? "bg-amber-500/5 border-amber-500/20 shadow-lg shadow-amber-500/5"
                                    : "bg-white/[0.02] border-white/5 hover:border-white/5"
                            )}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "p-2.5 rounded-xl",
                                    isMatch ? "bg-amber-500/10 text-amber-400" : "bg-white/[0.02] text-slate-400"
                                )}>
                                    <Monitor size={18} />
                                </div>
                                <div className="flex flex-col text-left">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm text-slate-300">
                                            {client.FirstName || 'İsimsiz'} {client.LastName || ''}
                                        </span>
                                        {isMatch && (
                                            <span className="bg-[color:var(--panel-warning,#ff9f0a)] text-[#050609] text-[8px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-tighter">İnceleniyor</span>
                                        )}
                                    </div>
                                    <span className="text-xs font-mono text-slate-400 mt-0.5 tracking-tight">
                                        #{String(client.Id)} • {String(client.ClientLogin || client.Login || 'N/A')}
                                    </span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    const username = client.ClientLogin || client.Login || client.FirstName || 'Oyuncu';
                                    window.open(`/#/oyuncu/${client.Id}/${username}`, '_blank');
                                }}
                                className={cn(
                                    "text-[10px] font-semibold uppercase tracking-wider gap-2",
                                    isMatch ? "text-amber-500 hover:bg-amber-500/10" : "text-purple-300 hover:bg-purple-400/10"
                                )}
                            >
                                Profil <ExternalLink size={12} />
                            </Button>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

