import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ImageUp, Loader2, Plus, Trophy } from 'lucide-react';
import {
  Alan,
  Anahtar,
  Bolum,
  BosDurum,
  Dugme,
  Girdi,
  ModulBasligi,
  Olcut,
  OlcutListesi,
  RAKAM,
  Secim,
  SilDugmesi,
  Uyari,
  sayi,
} from './oyunUi';
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

const MODUL = 'tahmin' as const;

const DURUMLAR = [
  { id: 'open', label: 'Tahmine açık' },
  { id: 'closed', label: 'Tahmin kapalı' },
  { id: 'finished', label: 'Bitti' },
] as const;

const yeniMac = (): PredictionMatch => ({
  id: `match-${Date.now()}`,
  homeTeam: 'Ev sahibi',
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

/** Tahmin kapanisi: acikca verilmisse o, yoksa maç baslangici. */
function kapanisAni(mac: PredictionMatch): string {
  return (mac.predictionClosesAt || '').trim() || mac.startsAt;
}

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
  const [sonuc, setSonuc] = useState<any>(null);

  const maclar = config.matches || [];

  const alanGuncelle = (key: keyof PredictionLeagueConfig, value: any) => onUpdate({ ...config, [key]: value });
  const macGuncelle = (id: string, patch: Partial<PredictionMatch>) =>
    onUpdate({ ...config, matches: maclar.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const ayinOyuncusu = (patch: Record<string, string>) =>
    alanGuncelle('monthlyPlayer', { ...(config.monthlyPlayer || {}), ...patch });

  const logoGetir = async (matchId: string, teamName: string, field: 'homeLogoUrl' | 'awayLogoUrl') => {
    const name = teamName.trim();
    if (!name) return;
    const mac = maclar.find((m) => m.id === matchId);
    if (mac?.[field]) return; // Zaten logo varsa uzerine yazma.
    try {
      const res = await gamesApi.teamLogo(name);
      if (res?.ok && res.imageUrl) macGuncelle(matchId, { [field]: res.imageUrl });
    } catch {
      // Sessizce gec: admin logoyu elle girebilir.
    }
  };

  const odulDagit = async (period: 'weekly' | 'monthly', dryRun: boolean) => {
    if (
      !dryRun &&
      !window.confirm(
        `${period === 'weekly' ? 'Haftalık' : 'Aylık'} ödüller seçili Lynon kampanyasıyla gerçek hesaplara dağıtılacak. Devam edilsin mi?`,
      )
    ) {
      return;
    }
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
      setSonuc(json);
      const rows = json?.data?.winners ?? json?.data?.results ?? [];
      toast.success(
        dryRun ? `${rows.length} kazanan önizlendi.` : `${rows.filter((r: any) => r.ok).length} ödül Lynon'a işlendi.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Skor ödülleri işlenemedi.');
    } finally {
      setSettling(null);
    }
  };

  const ozet = useMemo(() => {
    const simdi = Date.now();
    const zaman = (v: string) => {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    };
    return {
      toplam: maclar.length,
      acik: maclar.filter((m) => m.status === 'open').length,
      bitmis: maclar.filter((m) => m.status === 'finished').length,
      // Durumu "acik" ama kapanisi gecmis maclar: oyuncu tahmin yapamaz
      // ama listede acik gorunur.
      suresiGecmis: maclar.filter((m) => {
        if (m.status !== 'open') return false;
        const t = zaman(kapanisAni(m));
        return t !== null && t < simdi;
      }).length,
      skorsuz: maclar.filter((m) => m.status === 'finished' && (m.homeScore == null || m.awayScore == null)).length,
    };
  }, [maclar]);

  return (
    <div className="space-y-5">
      <ModulBasligi
        modul={MODUL}
        ikon={<Trophy size={20} />}
        baslik="Skor Tahmin"
        aciklama="Maç listesi, tahmin ligi ve dönem ödülleri."
        saginda={
          <Dugme modul={MODUL} tur="birincil" onClick={() => onUpdate({ ...config, matches: [...maclar, yeniMac()] })}>
            <Plus size={14} /> Maç ekle
          </Dugme>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Bolum baslik="Lig ayarları">
            <div className="space-y-4 px-5 py-4">
              <Anahtar
                modul={MODUL}
                acik={config.isActive !== false}
                onDegis={(isActive) => alanGuncelle('isActive', isActive)}
                etiket="Tahmin ligi yayında"
                aciklama="Kapalıyken lobide skor tahmin sekmesi görünmez."
              />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Alan etiket="Başlık">
                  <Girdi modul={MODUL} value={config.title || ''} onChange={(e) => alanGuncelle('title', e.target.value)} />
                </Alan>
                <Alan etiket="Ödül metni">
                  <Girdi modul={MODUL} value={config.prize || ''} onChange={(e) => alanGuncelle('prize', e.target.value)} />
                </Alan>
                <Alan etiket="Açıklama" className="lg:col-span-2">
                  <Girdi modul={MODUL} value={config.description || ''} onChange={(e) => alanGuncelle('description', e.target.value)} />
                </Alan>
                <Alan etiket="Kurallar" className="lg:col-span-2">
                  <Girdi modul={MODUL} value={config.rules || ''} onChange={(e) => alanGuncelle('rules', e.target.value)} />
                </Alan>
              </div>
            </div>
          </Bolum>

          <Bolum baslik="Maçlar" aciklama="Tahmin kapanışı boş bırakılırsa maç başlangıcı kullanılır.">
            {maclar.length === 0 ? (
              <BosDurum
                ikon={<Trophy size={26} />}
                baslik="Maç yok. Oyuncular boş bir tahmin listesi görür."
                eylem={
                  <Dugme modul={MODUL} tur="birincil" onClick={() => onUpdate({ ...config, matches: [yeniMac()] })}>
                    <Plus size={14} /> İlk maçı ekle
                  </Dugme>
                }
              />
            ) : (
              <div className="space-y-3 p-4">
                {maclar.map((mac) => (
                  <div key={mac.id} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-white">
                        {mac.homeLogoUrl && <img src={mac.homeLogoUrl} alt="" className="h-5 w-5 rounded-full object-contain" />}
                        <span className="truncate">{mac.homeTeam || 'Ev sahibi'}</span>
                        <span className="text-slate-500">–</span>
                        <span className="truncate">{mac.awayTeam || 'Deplasman'}</span>
                        {mac.awayLogoUrl && <img src={mac.awayLogoUrl} alt="" className="h-5 w-5 rounded-full object-contain" />}
                        {mac.status === 'finished' && mac.homeScore != null && mac.awayScore != null && (
                          <span className={`${RAKAM} ml-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold`}>
                            {mac.homeScore} – {mac.awayScore}
                          </span>
                        )}
                      </div>
                      <SilDugmesi
                        onClick={() => onUpdate({ ...config, matches: maclar.filter((m) => m.id !== mac.id) })}
                        etiket="Maçı sil"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                      <Alan etiket="Ev sahibi">
                        <Girdi
                          modul={MODUL}
                          value={mac.homeTeam}
                          onChange={(e) => macGuncelle(mac.id, { homeTeam: e.target.value })}
                          onBlur={(e) => logoGetir(mac.id, e.target.value, 'homeLogoUrl')}
                        />
                      </Alan>
                      <Alan etiket="Deplasman">
                        <Girdi
                          modul={MODUL}
                          value={mac.awayTeam}
                          onChange={(e) => macGuncelle(mac.id, { awayTeam: e.target.value })}
                          onBlur={(e) => logoGetir(mac.id, e.target.value, 'awayLogoUrl')}
                        />
                      </Alan>
                      <Alan etiket="Lig">
                        <Girdi modul={MODUL} value={mac.league} onChange={(e) => macGuncelle(mac.id, { league: e.target.value })} />
                      </Alan>
                      <Alan etiket="Durum">
                        <Secim
                          modul={MODUL}
                          value={mac.status}
                          onChange={(e) => macGuncelle(mac.id, { status: e.target.value as PredictionMatch['status'] })}
                        >
                          {DURUMLAR.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </Secim>
                      </Alan>
                      <Alan etiket="Başlangıç">
                        <Girdi
                          modul={MODUL}
                          type="datetime-local"
                          value={(mac.startsAt || '').slice(0, 16)}
                          onChange={(e) => macGuncelle(mac.id, { startsAt: e.target.value })}
                        />
                      </Alan>
                      <Alan etiket="Tahmin kapanışı" ipucu="Boşsa başlangıç anı kullanılır.">
                        <Girdi
                          modul={MODUL}
                          type="datetime-local"
                          value={(mac.predictionClosesAt || '').slice(0, 16)}
                          onChange={(e) => macGuncelle(mac.id, { predictionClosesAt: e.target.value })}
                        />
                      </Alan>
                      <Alan etiket="Ev skoru" ipucu="Bitti durumunda zorunlu.">
                        <Girdi
                          modul={MODUL}
                          sayisal
                          type="number"
                          min={0}
                          value={mac.homeScore ?? ''}
                          onChange={(e) => macGuncelle(mac.id, { homeScore: e.target.value === '' ? null : Number(e.target.value) })}
                        />
                      </Alan>
                      <Alan etiket="Deplasman skoru">
                        <Girdi
                          modul={MODUL}
                          sayisal
                          type="number"
                          min={0}
                          value={mac.awayScore ?? ''}
                          onChange={(e) => macGuncelle(mac.id, { awayScore: e.target.value === '' ? null : Number(e.target.value) })}
                        />
                      </Alan>
                      <Alan etiket="Ev logo URL" className="xl:col-span-2">
                        <Girdi modul={MODUL} value={mac.homeLogoUrl || ''} onChange={(e) => macGuncelle(mac.id, { homeLogoUrl: e.target.value })} placeholder="Takım adından otomatik bulunur" />
                      </Alan>
                      <Alan etiket="Deplasman logo URL" className="xl:col-span-2">
                        <Girdi modul={MODUL} value={mac.awayLogoUrl || ''} onChange={(e) => macGuncelle(mac.id, { awayLogoUrl: e.target.value })} placeholder="Takım adından otomatik bulunur" />
                      </Alan>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Bolum>

          <Bolum baslik="Ayın oyuncusu" aciklama="Lobideki banner içeriği.">
            <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-2">
              <Alan etiket="Başlık">
                <Girdi modul={MODUL} value={config.monthlyPlayer?.title || ''} onChange={(e) => ayinOyuncusu({ title: e.target.value })} />
              </Alan>
              <Alan etiket="Ana metin">
                <Girdi modul={MODUL} value={config.monthlyPlayer?.mainText || ''} onChange={(e) => ayinOyuncusu({ mainText: e.target.value })} />
              </Alan>
              <Alan etiket="Alt metin">
                <Girdi modul={MODUL} value={config.monthlyPlayer?.subtitle || ''} onChange={(e) => ayinOyuncusu({ subtitle: e.target.value })} />
              </Alan>
              <Alan etiket="Görsel">
                <div className="flex items-center gap-2">
                  <Girdi
                    modul={MODUL}
                    value={config.monthlyPlayer?.imageUrl?.startsWith('data:') ? '(yüklenen görsel)' : config.monthlyPlayer?.imageUrl || ''}
                    onChange={(e) => ayinOyuncusu({ imageUrl: e.target.value })}
                    placeholder="https://..."
                  />
                  <label
                    className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-white/5 text-slate-400 transition-colors hover:text-white"
                    title="Görsel yükle"
                  >
                    <ImageUp size={15} />
                    <span className="sr-only">Ayın oyuncusu görseli yükle</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => ayinOyuncusu({ imageUrl: String(reader.result || '') });
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </Alan>
            </div>
          </Bolum>
        </div>

        <aside className="space-y-5">
          <Bolum baslik="Maç durumu">
            <OlcutListesi>
              <Olcut etiket="Toplam maç" deger={sayi(ozet.toplam)} vurgulu />
              <Olcut etiket="Tahmine açık" deger={sayi(ozet.acik)} />
              <Olcut etiket="Sonuçlanan" deger={sayi(ozet.bitmis)} />
            </OlcutListesi>
          </Bolum>

          {ozet.suresiGecmis > 0 && (
            <Uyari tur="dikkat">
              {ozet.suresiGecmis} maçın tahmin süresi geçmiş ama durumu hâlâ açık. Oyuncu tahmin yapamaz, listede açık görünür.
            </Uyari>
          )}
          {ozet.skorsuz > 0 && (
            <Uyari tur="hata">
              {ozet.skorsuz} maç "bitti" işaretli ama skoru girilmemiş. Bu maçlar puanlamaya girmez.
            </Uyari>
          )}

          <Bolum baslik="Dönem ödülleri" aciklama="Sıralamaya göre Lynon kampanyası atar.">
            <div className="space-y-6 px-5 py-4">
              {(['weekly', 'monthly'] as const).map((period) => {
                const haftalik = period === 'weekly';
                const etiketAnahtari = haftalik ? 'weeklyRewardLabel' : 'monthlyRewardLabel';
                const kampanyaAnahtari = haftalik ? 'weeklyRewardCampaignId' : 'monthlyRewardCampaignId';
                const degerAnahtari = haftalik ? 'weeklyRewardAssignmentValues' : 'monthlyRewardAssignmentValues';
                const kampanya = config[kampanyaAnahtari];
                return (
                  <div key={period} className="space-y-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {haftalik ? 'Haftalık' : 'Aylık'}
                    </div>
                    {haftalik && (
                      <Alan etiket="Kaç kişi ödüllendirilsin">
                        <Girdi
                          modul={MODUL}
                          sayisal
                          type="number"
                          min={1}
                          value={config.weeklyTopCount ?? 3}
                          onChange={(e) => alanGuncelle('weeklyTopCount', Number(e.target.value))}
                        />
                      </Alan>
                    )}
                    <Alan etiket="Ödül etiketi">
                      <Girdi
                        modul={MODUL}
                        value={(config[etiketAnahtari] as string) || ''}
                        onChange={(e) => alanGuncelle(etiketAnahtari, e.target.value)}
                      />
                    </Alan>
                    <Alan etiket="Lynon kampanyası">
                      <Secim
                        modul={MODUL}
                        value={String(kampanya || '')}
                        onChange={(e) => alanGuncelle(kampanyaAnahtari, e.target.value || null)}
                      >
                        <option value="">Seçilmedi</option>
                        {bonusOptions.map((o) => <option key={o.id} value={o.id}>{o.display}</option>)}
                      </Secim>
                    </Alan>
                    {kampanya && (
                      <LynonAssignmentValuesField
                        label="Atama değerleri"
                        values={config[degerAnahtari] as Record<string, unknown>}
                        onChange={(v) => alanGuncelle(degerAnahtari, v)}
                      />
                    )}
                    <div className="flex gap-2">
                      <Dugme modul={MODUL} className="flex-1" disabled={settling !== null} onClick={() => odulDagit(period, true)}>
                        {settling === `${period}:preview` ? <Loader2 size={13} className="animate-spin" /> : null}
                        Önizle
                      </Dugme>
                      <Dugme
                        modul={MODUL}
                        tur="birincil"
                        className="flex-1"
                        disabled={settling !== null || !kampanya}
                        onClick={() => odulDagit(period, false)}
                        title={!kampanya ? 'Önce Lynon kampanyası seçin' : undefined}
                      >
                        {settling === `${period}:grant` ? <Loader2 size={13} className="animate-spin" /> : null}
                        Dağıt
                      </Dugme>
                    </div>
                  </div>
                );
              })}
            </div>
          </Bolum>

          {sonuc && (
            <Bolum baslik="Son işlem sonucu">
              <pre className="max-h-64 overflow-auto px-5 py-4 text-[10px] leading-relaxed text-slate-400">
                {JSON.stringify(sonuc?.data ?? sonuc, null, 2)}
              </pre>
            </Bolum>
          )}
        </aside>
      </div>
    </div>
  );
}
