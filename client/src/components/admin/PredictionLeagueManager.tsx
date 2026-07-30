import { useState } from 'react';
import { toast } from 'sonner';
import { ImageUp, Plus, Trash2, Trophy } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LynonAssignmentValuesField } from './LynonAssignmentValuesField';
import { gamesApi } from '../../api/client';

type PredictionMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  league: string;
  startsAt: string;
  /** Tahminlerin kapandigi an; bos birakilirsa startsAt gecerli. */
  predictionClosesAt?: string;
  status: 'open' | 'closed' | 'finished';
  homeScore: number | null;
  awayScore: number | null;
};

type PredictionLeagueConfig = {
  isActive: boolean;
  title: string;
  description: string;
  prize: string;
  rules: string;
  weeklyTopCount?: number;
  weeklyRewardLabel?: string;
  weeklyRewardCampaignId?: string | number | null;
  weeklyRewardAssignmentValues?: Record<string, unknown>;
  monthlyRewardLabel?: string;
  monthlyRewardCampaignId?: string | number | null;
  monthlyRewardAssignmentValues?: Record<string, unknown>;
  monthlyPlayer?: { title?: string; mainText?: string; subtitle?: string; imageUrl?: string };
  matches: PredictionMatch[];
};

const emptyMatch = (): PredictionMatch => ({
  id: `match-${Date.now()}`,
  homeTeam: 'Ev Sahibi',
  awayTeam: 'Deplasman',
  homeLogoUrl: '',
  awayLogoUrl: '',
  league: 'Süper Lig',
  startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().slice(0, 16),
  predictionClosesAt: '',
  status: 'open',
  homeScore: null,
  awayScore: null,
});

export function PredictionLeagueManager({
  config,
  bonusOptions = [],
  onUpdate,
}: {
  config: PredictionLeagueConfig;
  bonusOptions?: Array<{ id: string; display: string }>;
  onUpdate: (config: PredictionLeagueConfig) => void;
}) {
  const [settling, setSettling] = useState<string | null>(null);
  const [settlementResult, setSettlementResult] = useState<any>(null);

  const runSettlement = async (period: 'weekly' | 'monthly', dryRun: boolean) => {
    if (!dryRun && !window.confirm(`${period === 'weekly' ? 'Haftalık' : 'Aylık'} ödüller seçili Lynon kampanyasıyla gerçek hesaplara dağıtılacak. Devam edilsin mi?`)) return;
    setSettling(`${period}:${dryRun ? 'preview' : 'grant'}`);
    try {
      const response = await fetch('/api/admin/games/prediction-league/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ period, dryRun }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.message || 'Ödül işlemi tamamlanamadı.');
      setSettlementResult(json);
      const rows = json?.data?.winners ?? json?.data?.results ?? [];
      toast.success(dryRun ? `${rows.length} kazanan önizlendi.` : `${rows.filter((row: any) => row.ok).length} ödül Lynon’a işlendi.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Skor ödülleri işlenemedi.');
    } finally {
      setSettling(null);
    }
  };

  const updateField = (key: keyof PredictionLeagueConfig, value: any) => {
    onUpdate({ ...config, [key]: value });
  };

  const updateMonthlyPlayer = (patch: Record<string, string>) => {
    updateField('monthlyPlayer', { ...(config.monthlyPlayer || {}), ...patch });
  };

  const handleMonthlyPlayerImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateMonthlyPlayer({ imageUrl: String(reader.result || '') });
    reader.readAsDataURL(file);
  };
  const updateMatch = (id: string, patch: Partial<PredictionMatch>) => {
    onUpdate({
      ...config,
      matches: config.matches.map((match) => match.id === id ? { ...match, ...patch } : match),
    });
  };

  const fetchTeamLogo = async (matchId: string, teamName: string, field: 'homeLogoUrl' | 'awayLogoUrl') => {
    const name = teamName.trim();
    if (!name) return;
    const match = config.matches.find((m) => m.id === matchId);
    if (match?.[field]) return; // Zaten bir logo girilmişse üzerine yazma.
    try {
      const res = await gamesApi.teamLogo(name);
      if (res?.ok && res.imageUrl) {
        updateMatch(matchId, { [field]: res.imageUrl });
      }
    } catch {
      // Sessizce yut: admin dilerse logoyu manuel URL olarak girebilir.
    }
  };

  const addMatch = () => {
    onUpdate({ ...config, matches: [...(config.matches || []), emptyMatch()] });
  };

  const removeMatch = (id: string) => {
    onUpdate({ ...config, matches: config.matches.filter((match) => match.id !== id) });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/70">Spor etkinliği</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">Skor Tahmin Ligi</h2>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--panel-text-dim,#c8cdd5)]">
            <input
              type="checkbox"
              checked={config.isActive}
              onChange={(event) => updateField('isActive', event.target.checked)}
              className="h-4 w-4 accent-emerald-400"
            />
            Lobide aktif
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field label="Başlık" value={config.title} onChange={(value) => updateField('title', value)} />
          <Field label="Ödül" value={config.prize} onChange={(value) => updateField('prize', value)} />
          <Field label="Açıklama" value={config.description} onChange={(value) => updateField('description', value)} />
          <Field label="Puanlama" value={config.rules} onChange={(value) => updateField('rules', value)} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-amber-300/15 bg-[color:var(--panel-warning,#ff9f0a)]/[0.04] p-4 lg:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">Haftalık ödül</p>
            <p className="mt-1 text-xs font-medium text-[color:var(--panel-muted,#8a919c)]">İlk 10 oyuncu için 200 TL Freebet kampanyası seçin.</p>
            <Field label="Ödül açıklaması" value={config.weeklyRewardLabel || 'İlk 10 oyuncuya kişi başı 200 TL Freebet'} onChange={(value) => updateField('weeklyRewardLabel', value)} />
            <CampaignField label="Lynon kampanyası" value={String(config.weeklyRewardCampaignId || '')} options={bonusOptions} onChange={(value) => updateField('weeklyRewardCampaignId', value || null)} />            <div className="mt-3">
              <LynonAssignmentValuesField label="Haftalık Lynon assignmentValues" values={config.weeklyRewardAssignmentValues} onChange={(value) => updateField('weeklyRewardAssignmentValues', value)} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">Aylık ödül</p>
            <p className="mt-1 text-xs font-medium text-[color:var(--panel-muted,#8a919c)]">Ayın lideri için 500 TL Freebet kampanyası seçin.</p>
            <Field label="Ödül açıklaması" value={config.monthlyRewardLabel || 'Ayın liderine 500 TL Freebet'} onChange={(value) => updateField('monthlyRewardLabel', value)} />
            <CampaignField label="Lynon kampanyası" value={String(config.monthlyRewardCampaignId || '')} options={bonusOptions} onChange={(value) => updateField('monthlyRewardCampaignId', value || null)} />            <div className="mt-3">
              <LynonAssignmentValuesField label="Aylık Lynon assignmentValues" values={config.monthlyRewardAssignmentValues} onChange={(value) => updateField('monthlyRewardAssignmentValues', value)} />
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Lynon ödül dağıtımı</p>
              <p className="mt-1 text-xs text-[color:var(--panel-muted,#8a919c)]">Önizleme yalnızca sıralamayı kontrol eder. Dağıtım işlemi dönem + oyuncu bazında tek sefer çalışır.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button" onClick={() => runSettlement('weekly', true)} disabled={!!settling} className="h-10 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/5 px-3 text-[10px] font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] disabled:opacity-40">HAFTALIK ÖNİZLE</button>
              <button type="button" onClick={() => runSettlement('weekly', false)} disabled={!!settling} className="h-10 rounded-xl bg-emerald-400 px-3 text-[10px] font-semibold text-[#050609] disabled:opacity-40">HAFTALIK DAĞIT</button>
              <button type="button" onClick={() => runSettlement('monthly', true)} disabled={!!settling} className="h-10 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/5 px-3 text-[10px] font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] disabled:opacity-40">AYLIK ÖNİZLE</button>
              <button type="button" onClick={() => runSettlement('monthly', false)} disabled={!!settling} className="h-10 rounded-xl bg-[color:var(--panel-warning,#ff9f0a)] px-3 text-[10px] font-semibold text-[#050609] disabled:opacity-40">AYLIK DAĞIT</button>
            </div>
          </div>
          {settlementResult && (
            <div className="mt-3 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-4 py-3 text-xs font-bold text-[color:var(--panel-muted,#8a919c)]">
              Dönem: {settlementResult.data?.periodKey || '-'} · Kampanya: #{settlementResult.data?.campaignId || '-'} · Kazanan: {(settlementResult.data?.winners ?? settlementResult.data?.results ?? []).length}
            </div>
          )}
        </div>
        <div className="mt-4 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 p-4">
          <div className="mb-3 flex items-center gap-2 text-amber-200"><ImageUp size={16} /><span className="text-xs font-semibold uppercase tracking-[0.14em]">Ayın oyuncusu alanı</span></div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1.2fr_180px]">
            <Field label="Container başlığı" value={config.monthlyPlayer?.title || 'AYIN OYUNCUSU'} onChange={(value) => updateMonthlyPlayer({ title: value })} />
            <Field label="Ana metin" value={config.monthlyPlayer?.mainText || ''} onChange={(value) => updateMonthlyPlayer({ mainText: value })} />
            <Field label="Alt metin" value={config.monthlyPlayer?.subtitle || ''} onChange={(value) => updateMonthlyPlayer({ subtitle: value })} />
            <label className="flex h-[66px] cursor-pointer items-center justify-center rounded-xl border border-dashed border-amber-300/25 bg-[color:var(--panel-warning,#ff9f0a)]/[0.06] px-3 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-100">
              PNG yükle
              <input type="file" accept="image/png,image/webp,image/jpeg" className="sr-only" onChange={(event) => handleMonthlyPlayerImage(event.target.files?.[0])} />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-faint,#5c6470)]">Fikstür</p>
            <h3 className="text-xl font-semibold text-white">Tahmin maçları</h3>
          </div>
          <button
            type="button"
            onClick={addMatch}
            className="flex h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#050609]"
          >
            <Plus size={16} /> Maç ekle
          </button>
        </div>

        <div className="space-y-3">
          {config.matches.map((match) => (
            <div key={match.id} className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_150px_155px]">
                <Field
                  label="Ev sahibi"
                  value={match.homeTeam}
                  onChange={(value) => updateMatch(match.id, { homeTeam: value })}
                  onBlur={() => fetchTeamLogo(match.id, match.homeTeam, 'homeLogoUrl')}
                />
                <Field
                  label="Deplasman"
                  value={match.awayTeam}
                  onChange={(value) => updateMatch(match.id, { awayTeam: value })}
                  onBlur={() => fetchTeamLogo(match.id, match.awayTeam, 'awayLogoUrl')}
                />
                <Field label="Lig" value={match.league} onChange={(value) => updateMatch(match.id, { league: value })} />
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-faint,#5c6470)]">Başlama</label>
                  <input
                    type="datetime-local"
                    value={(match.startsAt || '').slice(0, 16)}
                    onChange={(event) => updateMatch(match.id, { startsAt: event.target.value })}
                    className="h-11 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-xs font-bold text-white outline-none focus:border-emerald-300/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-faint,#5c6470)]">Tahmin bitişi</label>
                  <input
                    type="datetime-local"
                    value={(match.predictionClosesAt || '').slice(0, 16)}
                    onChange={(event) => updateMatch(match.id, { predictionClosesAt: event.target.value })}
                    className="h-11 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-xs font-bold text-white outline-none focus:border-emerald-300/40"
                  />
                  <p className="mt-1.5 text-[10px] text-[color:var(--panel-faint,#5c6470)]">
                    Boş bırakılırsa tahminler maç başlarken kapanır. Başlama saati geçmiş bir maçı tahmine açmak için buraya ileri bir tarih girin.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_160px_120px_120px_44px]">
                <Field label="Ev logo (PNG URL)" value={match.homeLogoUrl || ''} onChange={(value) => updateMatch(match.id, { homeLogoUrl: value })} />
                <Field label="Dep. logo (PNG URL)" value={match.awayLogoUrl || ''} onChange={(value) => updateMatch(match.id, { awayLogoUrl: value })} />
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-faint,#5c6470)]">Durum</label>
                  <select
                    value={match.status}
                    onChange={(event) => updateMatch(match.id, { status: event.target.value as PredictionMatch['status'] })}
                    className="h-11 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-xs font-bold text-white outline-none focus:border-emerald-300/40"
                  >
                    <option value="open">Tahmine açık</option>
                    <option value="closed">Kapalı</option>
                    <option value="finished">Sonuçlandı</option>
                  </select>
                </div>
                <NumberField label="Ev skor" value={match.homeScore} onChange={(value) => updateMatch(match.id, { homeScore: value })} />
                <NumberField label="Dep. skor" value={match.awayScore} onChange={(value) => updateMatch(match.id, { awayScore: value })} />
                <button
                  type="button"
                  onClick={() => removeMatch(match.id)}
                  aria-label="Maçı sil"
                  className="mt-auto flex h-11 items-center justify-center rounded-xl border border-rose-300/15 bg-rose-400/10 text-rose-300"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}

          {config.matches.length === 0 && (
            <div className="rounded-xl border border-dashed border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-8 text-center">
              <Trophy className="mx-auto mb-3 text-[color:var(--panel-faint,#5c6470)]" size={32} />
              <p className="text-sm font-bold text-[color:var(--panel-muted,#8a919c)]">Henüz maç eklenmedi.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CampaignField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ id: string; display: string }>; onChange: (value: string) => void }) {
  return (
    <div className="mt-3">
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-faint,#5c6470)]">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-sm font-bold text-white outline-none focus:border-amber-300/40">
        <option value="">Kampanya seçilmedi</option>
        {options.filter((option) => !option.id.startsWith('pas')).map((option) => <option key={option.id} value={option.id}>{option.display}</option>)}
      </select>
    </div>
  );
}
function Field({ label, value, onChange, onBlur }: { label: string; value: string; onChange: (value: string) => void; onBlur?: () => void }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-faint,#5c6470)]">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className="h-11 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-sm font-bold text-white outline-none focus:border-emerald-300/40"
      />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-faint,#5c6470)]">{label}</label>
      <input
        type="number"
        min={0}
        max={99}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        className={cn(
          'h-11 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-sm font-bold text-white outline-none focus:border-emerald-300/40',
          value == null && 'text-[color:var(--panel-muted,#8a919c)]'
        )}
      />
    </div>
  );
}
