import { useState, useEffect } from 'react';
import { Trophy, Save, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { tournamentApi } from '../../api/client';

export function AdminTournamentSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await tournamentApi.getSettings();
      setSettings(data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ayarlar yüklenirken hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await tournamentApi.saveSettings(settings);
      setMessage({ type: 'success', text: 'Ayarlar başarıyla kaydedildi' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Kaydedilirken hata oluştu' });
    } finally {
      setSaving(false);
    }
  };

  const updatePrize = (key: string, prize: string) => {
    setSettings((prev: any) => ({
      ...prev,
      [key]: { ...prev[key], prize }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Trophy className="text-amber-500" /> Turnuva Yönetimi
        </h2>
        <p className="text-[color:var(--panel-muted,#8a919c)] text-sm mt-1">Sitedeki turnuvaların ödül havuzlarını ve aktiflik durumlarını buradan yönetin.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {/* Daily */}
          <div className="p-6 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center justify-between">
              Günlük Turnuva
              <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] uppercase font-semibold">24 Saat</div>
            </h3>
            <div>
              <label className="block text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase mb-2">Ödül Havuzu (₺)</label>
              <input 
                type="text" 
                value={settings.gunluk.prize}
                onChange={(e) => updatePrize('gunluk', e.target.value)}
                className="w-full h-12 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-white font-bold focus:border-blue-500/40 outline-none transition-all"
                placeholder="Örn: 50.000"
              />
            </div>
          </div>

          {/* Weekly */}
          <div className="p-6 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center justify-between">
              Haftalık Turnuva
              <div className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] uppercase font-semibold">7 Gün</div>
            </h3>
            <div>
              <label className="block text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase mb-2">Ödül Havuzu (₺)</label>
              <input 
                type="text" 
                value={settings.haftalik.prize}
                onChange={(e) => updatePrize('haftalik', e.target.value)}
                className="w-full h-12 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-white font-bold focus:border-blue-500/40 outline-none transition-all"
                placeholder="Örn: 250.000"
              />
            </div>
          </div>

          {/* Monthly */}
          <div className="p-6 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center justify-between">
              Aylık Turnuva
              <div className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] uppercase font-semibold">30 Gün</div>
            </h3>
            <div>
              <label className="block text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase mb-2">Ödül Havuzu (₺)</label>
              <input 
                type="text" 
                value={settings.aylik.prize}
                onChange={(e) => updatePrize('aylik', e.target.value)}
                className="w-full h-12 bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 text-white font-bold focus:border-blue-500/40 outline-none transition-all"
                placeholder="Örn: 500.000"
              />
            </div>
          </div>
        </div>

        <button 
          disabled={saving}
          className="w-full md:w-auto px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50"
        >
          {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
          DEĞİŞİKLİKLERİ KAYDET
        </button>
      </form>
    </div>
  );
}
