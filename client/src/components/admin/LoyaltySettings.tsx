import { useState, useEffect } from 'react';
import { 
  Store, 
  Plus, 
  Trash2, 
  Save, 
  Gift, 
  Coins, 
  RefreshCcw,
  Star,
  RefreshCw
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loyaltyApi, dashboardApi } from '../../api/client';
import { toast } from 'sonner';

export function LoyaltySettings() {
    const queryClient = useQueryClient();
    const [market, setMarket] = useState<any[]>([]);
    const [wagerRatio, setWagerRatio] = useState<number>(100);

    useQuery({
        queryKey: ['admin-loyalty-status-sample'],
        queryFn: () => loyaltyApi.status(),
    });

    const { data: marketData, isLoading: marketLoading, isError: marketError } = useQuery({
        queryKey: ['admin-loyalty-market'],
        queryFn: () => loyaltyApi.marketList(),
    });

    const { data: bonusesData } = useQuery({
        queryKey: ['bonuses-all-for-loyalty'],
        queryFn: () => dashboardApi.bonusesAll(),
    });

    const bonuses = bonusesData?.Result || [];

    useEffect(() => {
        if (marketData) setMarket(marketData);
        // We'll fetch ratio if possible or use a default
    }, [marketData]);

    const saveMutation = useMutation({
        mutationFn: (data: { market: any[], wagerToPointRatio: number }) => 
            fetch('/api/admin/loyalty/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(r => r.json()),
        onSuccess: (res) => {
            if (res.ok) {
                toast.success('Konfigürasyon kaydedildi');
                queryClient.invalidateQueries({ queryKey: ['admin-loyalty-market'] });
                queryClient.invalidateQueries({ queryKey: ['loyalty-status'] });
            } else {
                toast.error(res.error || 'Kaydetme hatası');
            }
        }
    });

    const addMarketItem = () => {
        setMarket([...market, {
            id: 'new_item_' + Date.now(),
            name: 'Yeni Ürün',
            description: 'Ürün açıklaması',
            cost: 500,
            rewardType: 'freespin',
            rewardValue: 10,
            platformBonusId: 0
        }]);
    };

    const removeMarketItem = (id: string) => {
        setMarket(market.filter(item => item.id !== id));
    };

    if (marketLoading) return <div className="p-20 text-center"><RefreshCw className="animate-spin mx-auto text-blue-500" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                   <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">Sadakat Sistemi Ayarları</h1>
                   <p className="text-[color:var(--panel-muted,#8a919c)] text-sm font-bold mt-1">Puan kazanım oranlarını ve ödül marketini yönetin.</p>
                </div>
                <button 
                   onClick={() => saveMutation.mutate({ market, wagerToPointRatio: wagerRatio })}
                   disabled={saveMutation.isPending}
                   className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                >
                   <Save size={18} />
                   AYARLARI KAYDET
                </button>
            </div>

            {/* Ratio Config */}
            <div className="p-8 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <RefreshCcw size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white uppercase tracking-tight">Puan Kazanım Oranı</h3>
                        <p className="text-[color:var(--panel-muted,#8a919c)] text-xs font-bold">Her 1 puan için gereken toplam bahis (turnover) miktarı.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 max-w-sm">
                   <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest px-1">BAHİS MİKTARI (TL)</label>
                        <input 
                            type="number" 
                            value={wagerRatio} 
                            onChange={e => setWagerRatio(Number(e.target.value))}
                            className="w-full bg-black/30 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 py-2.5 text-xl font-semibold text-white outline-none focus:border-amber-500/30 transition-all"
                        />
                   </div>
                   <div className="pt-8 text-[color:var(--panel-faint,#5c6470)] font-semibold">/</div>
                   <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest px-1">KAZANILAN PUAN</label>
                        <div className="w-full bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 py-2.5 text-xl font-semibold text-amber-500 flex items-center gap-3">
                            <Coins size={24} /> 1
                        </div>
                   </div>
                </div>
                <p className="mt-4 text-[10px] text-[color:var(--panel-faint,#5c6470)] font-bold uppercase tracking-widest">
                    Örnek: {wagerRatio} TL bahis yapan oyuncu 1 Store Puanı kazanır.
                </p>
            </div>

            {/* Market Management */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-sm font-semibold text-white uppercase tracking-[0.2em] flex items-center gap-3">
                        <Store size={18} className="text-blue-500" /> ÖDÜL MARKETİ ÜRÜNLERİ
                    </h2>
                    <button 
                        onClick={addMarketItem}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                    >
                        <Plus size={14} /> ÜRÜN EKLE
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {market.map((item, idx) => (
                        <div key={item.id} className="p-6 bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl space-y-4 group hover:border-amber-500/20 transition-all">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                      {item.rewardType === 'freespin' ? <Star size={20} /> : <Gift size={20} />}
                                   </div>
                                   <input 
                                        value={item.name} 
                                        onChange={e => { const newM = [...market]; newM[idx].name = e.target.value; setMarket(newM); }}
                                        className="bg-transparent border-none outline-none font-semibold text-white uppercase tracking-tight w-full"
                                    />
                                </div>
                                <button onClick={() => removeMarketItem(item.id)} className="p-2 text-[color:var(--panel-faint,#5c6470)] hover:text-rose-500 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                             </div>

                             <textarea 
                                value={item.description}
                                onChange={e => { const newM = [...market]; newM[idx].description = e.target.value; setMarket(newM); }}
                                className="w-full bg-black/30 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl p-3 text-xs font-bold text-[color:var(--panel-muted,#8a919c)] outline-none focus:border-amber-500/20 min-h-[60px]"
                            />

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest">MALİYET (PUAN)</label>
                                    <input type="number" value={item.cost} onChange={e => { const newM = [...market]; newM[idx].cost = Number(e.target.value); setMarket(newM); }} className="w-full bg-black/30 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-amber-500/40" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest">ÖDÜL MİKTARI</label>
                                    <input type="number" value={item.rewardValue} onChange={e => { const newM = [...market]; newM[idx].rewardValue = Number(e.target.value); setMarket(newM); }} className="w-full bg-black/30 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 py-2 text-xs font-semibold text-amber-500 outline-none focus:border-amber-500/40" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest">BONUS (PLATFORM ID)</label>
                                    <select 
                                        value={item.platformBonusId} 
                                        onChange={e => { const newM = [...market]; newM[idx].platformBonusId = Number(e.target.value); setMarket(newM); }} 
                                        className="w-full bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 py-2 text-[10px] font-semibold text-white outline-none focus:border-amber-500/50 appearance-none cursor-pointer pr-4 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%23fbbf24%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.5rem_center] bg-[length:1.2em_1.2em] bg-no-repeat"
                                    >
                                        <option value="0" className="bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] text-[color:var(--panel-muted,#8a919c)]">Manuel ID Girişi / Yok</option>
                                        {bonuses.map((b: any) => (
                                            <option key={b.Id} value={b.Id} className="bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] text-white">
                                                [{b.Id}] {b.Name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1 col-span-3">
                                    <label className="text-[10px] font-semibold text-[color:var(--panel-faint,#5c6470)] uppercase tracking-widest">ÖDÜL TİPİ</label>
                                    <select 
                                        value={item.rewardType} 
                                        onChange={e => { const newM = [...market]; newM[idx].rewardType = e.target.value as any; setMarket(newM); }} 
                                        className="w-full bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-3 py-2 text-[10px] font-semibold text-white outline-none focus:border-amber-500/50 appearance-none cursor-pointer pr-4 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%23fbbf24%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.5rem_center] bg-[length:1.2em_1.2em] bg-no-repeat"
                                    >
                                        <option value="freespin" className="bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] text-white">Freespin</option>
                                        <option value="cash" className="bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] text-white">Nakit Para</option>
                                        <option value="bonus" className="bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] text-white">Özel Bonus</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {marketError && (
                <div className="p-8 bg-rose-500/5 border border-rose-500/10 rounded-xl text-center">
                    <p className="text-rose-500 font-bold">Veriler yüklenemedi. Yetkiniz olduğundan emin olun.</p>
                </div>
            )}
        </div>
    );
}
