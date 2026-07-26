import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { PartnerProfitData } from '../types/dashboard';
import { Card } from './ui/Card';
import { formatNumber } from '../lib/format';

interface DashboardChartsProps {
    data: PartnerProfitData | undefined;
}

export function DashboardCharts({ data }: DashboardChartsProps) {
    if (!data) return null;

    const sportTurnover = data.SportTurnover || 0;
    const sportWinning = data.SportWinning || 0;
    const casinoTurnover = data.CasinoTurnover || 0;
    const casinoWinning = data.CasinoWinning || 0;

    const sportGgr = sportTurnover - sportWinning;
    const casinoGgr = casinoTurnover - casinoWinning;

    const pieData = [
        { name: 'Spor', value: Math.max(0, sportGgr), color: '#6366f1', glow: 'rgba(99, 102, 241, 0.5)' },
        { name: 'Casino', value: Math.max(0, casinoGgr), color: '#10b981', glow: 'rgba(16, 185, 129, 0.5)' },
    ];

    const barData = [
        {
            name: 'Spor',
            Turnover: sportTurnover,
            Winning: sportWinning,
            GGR: sportGgr,
        },
        {
            name: 'Casino',
            Turnover: casinoTurnover,
            Winning: casinoWinning,
            GGR: casinoGgr,
        },
    ];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">{label}</p>
                    <div className="space-y-1.5">
                        {payload.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-[11px] font-bold text-zinc-300">{item.name}:</span>
                                </div>
                                <span className="text-[11px] font-black text-white">{formatNumber(item.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <Card className="premium-card p-8 group">
                <div className="absolute -right-16 -top-16 w-32 h-32 bg-purple-500/10 blur-[80px] rounded-full" />
                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">GGR Dağılımı</h3>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Dikey Bazlı Kâr Oranı</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    </div>
                </div>
                <div className="h-72 w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <defs>
                                <linearGradient id="gradientSpor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#818cf8" />
                                    <stop offset="100%" stopColor="#6366f1" />
                                </linearGradient>
                                <linearGradient id="gradientCasino" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#34d399" />
                                    <stop offset="100%" stopColor="#10b981" />
                                </linearGradient>
                            </defs>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={95}
                                paddingAngle={8}
                                dataKey="value"
                                stroke="none"
                            >
                                <Cell key="cell-0" fill="url(#gradientSpor)" />
                                <Cell key="cell-1" fill="url(#gradientCasino)" />
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(val) => <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">{val}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Centered Total */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-36px]">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Toplam GGR</span>
                        <span className="text-xl font-black text-white tracking-tighter">{formatNumber(sportGgr + casinoGgr)}</span>
                    </div>
                </div>
            </Card>

            <Card className="premium-card p-8 group">
                <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-emerald-500/10 blur-[80px] rounded-full" />
                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Finansal Karşılaştırma</h3>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Ciro ve Net Kazanç Analizi</p>
                    </div>
                    <div className="flex gap-1">
                        {[1, 2, 3].map(i => <div key={i} className="w-1 h-4 bg-white/10 rounded-full" />)}
                    </div>
                </div>
                <div className="h-72 w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.2} />
                                </linearGradient>
                                <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke="#52525b"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontWeight: 900, letterSpacing: '0.1em' }}
                            />
                            <YAxis
                                stroke="#52525b"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                                tick={{ fontWeight: 700 }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                            <Legend iconType="circle" formatter={(val) => <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">{val}</span>} />
                            <Bar dataKey="Turnover" fill="url(#barGradient1)" radius={[10, 10, 0, 0]} name="Ciro" barSize={40} />
                            <Bar dataKey="GGR" fill="url(#barGradient2)" radius={[10, 10, 0, 0]} name="Net GGR" barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
}
