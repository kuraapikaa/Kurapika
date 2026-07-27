import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

interface AdvancedChartsProps {
    data: any; // KPI Data
}

export function AdvancedCharts({ data }: AdvancedChartsProps) {
    if (!data) return null;

    // Simulate monthly trend data based on totals (since we don't have historical timeline from kpi endpoint)
    // In a real scenario, this would come from a timeline API. 
    // Here we create a visual representation of Casino vs Sport performance.
    const performanceData = [
        { name: 'Spor Bahisleri', depositValue: data.TotalSportStakes, winValue: data.TotalSportWinnings, profit: data.TotalSportWinnings - data.TotalSportStakes },
        { name: 'Canlı Casino', depositValue: data.TotalCasinoStakes * 0.6, winValue: data.TotalCasinoWinnings * 0.55, profit: (data.TotalCasinoWinnings * 0.55) - (data.TotalCasinoStakes * 0.6) },
        { name: 'Slot', depositValue: data.TotalCasinoStakes * 0.4, winValue: data.TotalCasinoWinnings * 0.45, profit: (data.TotalCasinoWinnings * 0.45) - (data.TotalCasinoStakes * 0.4) }
    ];


    return (
        <div className="grid grid-cols-1 gap-6 mb-12">
            <div className="rounded-xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-md">
                <div className="flex items-center gap-3 mb-6">
                    <Activity className="text-blue-400" size={20} />
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-200">Kategori Bazlı Kâr/Zarar</h3>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis dataKey="name" stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₺${(val / 1000)}k`} />
                            <Tooltip
                                cursor={{ fill: '#ffffff05' }}
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff10', borderRadius: '12px', fontSize: '12px' }}
                                formatter={(value: any) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value)}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Bar dataKey="depositValue" name="Bahis Tutarı" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="winValue" name="Kazanç" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="profit" name="Net Kâr" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
