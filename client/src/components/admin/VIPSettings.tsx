import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gamesApi, formsApi } from '../../api/client';
import { toast } from 'sonner';
import {
  Crown, Loader2, Plus, Save, Trash2,
  ChevronDown, ChevronUp, Users
} from 'lucide-react';
import { cn } from '../../lib/utils';

type VIPTier = { id: string; badge: string; label: string; sublabel: string; minDeposit: string; popular: boolean; perks: string[] };
type VIPStat = { id: string; value: string; label: string };
type VIPFaq = { id: string; q: string; a: string };

interface VIPConfig {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  stats: VIPStat[];
  tiers: VIPTier[];
  faq: VIPFaq[];
  formActive: boolean;
  formTitle: string;
  formButtonText: string;
  formSuccessMessage: string;
  showStats: boolean;
  showFaq: boolean;
}

const DEFAULT_VIP: VIPConfig = {
  isActive: true,
  eyebrow: 'VIP Üyelik Programı',
  title: 'Ayrıcalıklı deneyim, özel avantajlar',
  description: 'Sadık oyuncularımıza özel 4 kademeli VIP programıyla kazancını ve deneyimini üst seviyeye taşı.',
  stats: [
    { id: 's1', value: '15K+', label: 'VIP Üye' },
    { id: 's2', value: '7/24', label: 'Destek' },
    { id: 's3', value: '%99', label: 'Memnuniyet' },
    { id: 's4', value: '8M₺', label: 'Aylık Bonus' },
  ],
  tiers: [
    { id: 'prestij', badge: '🏅', label: 'Prestij', sublabel: 'Başlangıç', minDeposit: '10.000 TL', popular: false, perks: ['7/24 Kişisel VIP Asistanı', 'Öncelikli müşteri desteği'] },
    { id: 'champion', badge: '🏆', label: 'Champion', sublabel: 'Popüler', minDeposit: '50.000 TL', popular: true, perks: ['Tüm Prestij avantajları', 'Özel etkinliklere davet'] },
    { id: 'elite', badge: '💠', label: 'Elite', sublabel: 'Premium', minDeposit: '100.000 TL', popular: false, perks: ['Tüm Champion avantajları', 'VIP çekim limitleri'] },
    { id: 'master', badge: '👑', label: 'Master', sublabel: 'Ultimate', minDeposit: '250.000 TL', popular: false, perks: ['Tüm Elite avantajları', 'Limitsiz avantajlar'] },
  ],
  faq: [
    { id: 'f1', q: 'VIP üyelik nasıl alınır?', a: 'Formu doldurarak başvuru yapabilirsiniz.' },
  ],
  formActive: true,
  formTitle: 'VIP başvurusu',
  formButtonText: 'Başvur',
  formSuccessMessage: 'VIP başvurunuz alındı! Ekibimiz en kısa sürede sizinle iletişime geçecek.',
  showStats: true,
  showFaq: true,
};

type AdminTab = 'settings' | 'applications';

function normalizeVipConfig(vip?: Partial<VIPConfig>): VIPConfig {
  const sourceTiers = Array.isArray(vip?.tiers) ? vip.tiers : [];
  const tiers = DEFAULT_VIP.tiers.map((defaultTier, index) => ({
    ...defaultTier,
    ...(sourceTiers.find((tier) => tier.id === defaultTier.id) || sourceTiers[index] || {}),
  }));

  return {
    ...DEFAULT_VIP,
    ...vip,
    tiers,
  };
}

export function VIPSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('settings');
  const [config, setConfig] = useState<VIPConfig | null>(null);
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const gamesConfigQuery = useQuery({
    queryKey: ['admin-games-config'],
    queryFn: () => gamesApi.config(),
  });

  useEffect(() => {
    if (gamesConfigQuery.data?.data?.vip) {
      setConfig(normalizeVipConfig(gamesConfigQuery.data.data.vip));
      return;
    }

    if (gamesConfigQuery.isSuccess || gamesConfigQuery.isError) {
      setConfig(normalizeVipConfig());
    }
  }, [gamesConfigQuery.data, gamesConfigQuery.isError, gamesConfigQuery.isSuccess]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('VIP config is not ready.');
      const current = await gamesApi.config();
      return gamesApi.saveConfig({ ...(current?.data || {}), vip: config });
    },
    onSuccess: () => {
      toast.success('VIP ayarları kaydedildi.');
      queryClient.invalidateQueries({ queryKey: ['admin-games-config'] });
    },
    onError: () => toast.error('Kaydetme başarısız.'),
  });

  const formsQuery = useQuery({
    queryKey: ['admin-forms'],
    queryFn: () => formsApi.getAdminForms(),
    enabled: activeTab === 'applications',
  });

  const updateStatus = useMutation({
    mutationFn: (body: { id: string; status: string }) => formsApi.updateVipStatus(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-forms'] }),
  });

  const deleteApp = useMutation({
    mutationFn: (id: string) => formsApi.deleteVipForm({ id }),
    onSuccess: () => {
      toast.success('Başvuru silindi.');
      queryClient.invalidateQueries({ queryKey: ['admin-forms'] });
    },
  });

  if (!config) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-white/40" size={28} />
      </div>
    );
  }

  const vipApps: any[] = formsQuery.data?.data?.vipRequests || [];

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 p-4 pb-28 md:p-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 p-1">
          {([['settings', Crown, 'Ayarlar'], ['applications', Users, 'Başvurular']] as const).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition',
                activeTab === id ? 'bg-cyan-400 text-[#050609]' : 'text-[color:var(--panel-muted,#8a919c)] hover:text-white'
              )}
            >
              <Icon size={14} />
              {label}
              {id === 'applications' && vipApps.length > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] text-white">{vipApps.filter((a) => a.status === 'pending').length || ''}</span>
              )}
            </button>
          ))}
        </div>
        {activeTab === 'settings' && (
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[color:var(--panel-info,#64d2ff)] px-5 text-xs font-semibold uppercase tracking-widest text-[#050609] transition hover:bg-[color:var(--panel-info,#64d2ff)] disabled:opacity-60"
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Kaydet
          </button>
        )}
      </div>

      {activeTab === 'settings' && (
        <div className="space-y-5">
          {/* Genel */}
          <Section title="Genel Ayarlar">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Toggle label="VIP sekmesini göster" value={config.isActive} onChange={(v) => setConfig({ ...config, isActive: v })} />
              <Toggle label="İstatistikleri göster" value={config.showStats} onChange={(v) => setConfig({ ...config, showStats: v })} />
              <Toggle label="SSS bölümünü göster" value={config.showFaq} onChange={(v) => setConfig({ ...config, showFaq: v })} />
              <Toggle label="Başvuru formunu göster" value={config.formActive} onChange={(v) => setConfig({ ...config, formActive: v })} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Üst başlık (eyebrow)" value={config.eyebrow} onChange={(v) => setConfig({ ...config, eyebrow: v })} />
              <Field label="Başlık" value={config.title} onChange={(v) => setConfig({ ...config, title: v })} />
              <Field label="Açıklama" value={config.description} onChange={(v) => setConfig({ ...config, description: v })} className="md:col-span-2" />
            </div>
          </Section>

          {/* İstatistikler */}
          <Section title="İstatistikler">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {config.stats.map((stat) => (
                <div key={stat.id} className="space-y-2 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-3">
                  <Field label="Değer" value={stat.value} onChange={(v) => setConfig({ ...config, stats: config.stats.map((s) => s.id === stat.id ? { ...s, value: v } : s) })} />
                  <Field label="Etiket" value={stat.label} onChange={(v) => setConfig({ ...config, stats: config.stats.map((s) => s.id === stat.id ? { ...s, label: v } : s) })} />
                </div>
              ))}
            </div>
          </Section>

          {/* VIP Seviyeleri */}
          <Section title="VIP Seviyeleri">
            <div className="space-y-2">
              {config.tiers.map((tier) => (
                <div key={tier.id} className="overflow-hidden rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20">
                  <button
                    type="button"
                    onClick={() => setExpandedTier(expandedTier === tier.id ? null : tier.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{tier.badge}</span>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">{tier.label}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--panel-faint,#5c6470)]">{tier.sublabel}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">Min. yatırım: {tier.minDeposit || 'Belirtilmedi'}</p>
                      </div>
                      {tier.popular && <span className="rounded-full bg-[color:var(--panel-warning,#ff9f0a)]/20 px-2 py-0.5 text-[9px] font-semibold text-amber-300">Popüler</span>}
                    </div>
                    {expandedTier === tier.id ? <ChevronUp size={16} className="text-[color:var(--panel-muted,#8a919c)]" /> : <ChevronDown size={16} className="text-[color:var(--panel-muted,#8a919c)]" />}
                  </button>
                  {expandedTier === tier.id && (
                    <div className="border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        <Field label="Emoji/Badge" value={tier.badge} onChange={(v) => updateTier(tier.id, 'badge', v)} />
                        <Field label="İsim" value={tier.label} onChange={(v) => updateTier(tier.id, 'label', v)} />
                        <Field label="Alt başlık" value={tier.sublabel} onChange={(v) => updateTier(tier.id, 'sublabel', v)} />
                        <Field label="Minimum yatırım" value={tier.minDeposit || ''} onChange={(v) => updateTier(tier.id, 'minDeposit', v)} />
                        <div className="flex items-end">
                          <Toggle label="Popüler rozeti" value={tier.popular} onChange={(v) => updateTier(tier.id, 'popular', v)} />
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--panel-faint,#5c6470)]">Avantajlar</p>
                        <div className="space-y-2">
                          {tier.perks.map((perk, pi) => (
                            <div key={pi} className="flex gap-2">
                              <input
                                value={perk}
                                onChange={(e) => {
                                  const perks = [...tier.perks];
                                  perks[pi] = e.target.value;
                                  updateTier(tier.id, 'perks', perks);
                                }}
                                className="flex-1 h-9 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-xs font-bold text-white outline-none placeholder:text-[color:var(--panel-faint,#5c6470)] focus:border-cyan-400/40"
                              />
                              <button
                                type="button"
                                onClick={() => updateTier(tier.id, 'perks', tier.perks.filter((_, i) => i !== pi))}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-300/15 bg-rose-400/10 text-rose-300"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => updateTier(tier.id, 'perks', [...tier.perks, ''])}
                            className="flex h-9 items-center gap-2 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.03] px-3 text-xs font-semibold text-[color:var(--panel-muted,#8a919c)] hover:text-white"
                          >
                            <Plus size={13} /> Avantaj ekle
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* SSS */}
          <Section title="SSS (Sık Sorulan Sorular)">
            <div className="space-y-2">
              {config.faq.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20">
                  <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(expandedFaq === item.id ? null : item.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-bold text-white">{item.q || 'Yeni soru'}</p>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, faq: config.faq.filter((f) => f.id !== item.id) })}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-300/15 bg-rose-400/10 text-rose-300"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === item.id ? null : item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--panel-muted,#8a919c)] hover:bg-white/[0.04] hover:text-white"
                      >
                        {expandedFaq === item.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>
                  {expandedFaq === item.id && (
                    <div className="border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] p-3 space-y-2">
                      <Field label="Soru" value={item.q} onChange={(v) => setConfig({ ...config, faq: config.faq.map((f) => f.id === item.id ? { ...f, q: v } : f) })} />
                      <Field label="Cevap" value={item.a} onChange={(v) => setConfig({ ...config, faq: config.faq.map((f) => f.id === item.id ? { ...f, a: v } : f) })} multiline />
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setConfig({ ...config, faq: [...config.faq, { id: `f${Date.now()}`, q: '', a: '' }] })}
                className="flex h-9 items-center gap-2 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.03] px-4 text-xs font-semibold text-[color:var(--panel-muted,#8a919c)] hover:text-white"
              >
                <Plus size={13} /> Soru ekle
              </button>
            </div>
          </Section>

          {/* Form */}
          <Section title="Başvuru Formu Metinleri">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Form başlığı" value={config.formTitle} onChange={(v) => setConfig({ ...config, formTitle: v })} />
              <Field label="Buton metni" value={config.formButtonText} onChange={(v) => setConfig({ ...config, formButtonText: v })} />
              <Field label="Başarı mesajı" value={config.formSuccessMessage} onChange={(v) => setConfig({ ...config, formSuccessMessage: v })} className="md:col-span-2" />
            </div>
          </Section>
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="space-y-3">
          {formsQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-white/40" size={24} /></div>
          ) : vipApps.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.02]">
              <Crown className="text-[color:var(--panel-faint,#5c6470)]" size={28} />
              <p className="text-sm font-bold text-[color:var(--panel-faint,#5c6470)]">Henüz VIP başvurusu yok</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30">
                    {['Kullanıcı', 'Ad Soyad', 'E-posta', 'Telefon', 'Tarih', 'Durum', ''].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-[color:var(--panel-faint,#5c6470)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vipApps.map((app) => (
                    <tr key={app.id} className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-semibold text-white">{app.username}</td>
                      <td className="px-3 py-2.5 text-[color:var(--panel-muted,#8a919c)]">{app.name || '—'}</td>
                      <td className="px-3 py-2.5 text-[color:var(--panel-muted,#8a919c)]">{app.email || '—'}</td>
                      <td className="px-3 py-2.5 text-[color:var(--panel-muted,#8a919c)]">{app.phone || '—'}</td>
                      <td className="px-3 py-2.5 text-[color:var(--panel-faint,#5c6470)]">{new Date(app.createdAt).toLocaleDateString('tr-TR')}</td>
                      <td className="px-3 py-2.5">
                        <select
                          value={app.status}
                          onChange={(e) => updateStatus.mutate({ id: app.id, status: e.target.value })}
                          className="rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-2 py-1 text-xs font-bold text-white outline-none"
                        >
                          <option value="pending">Bekliyor</option>
                          <option value="approved">Onaylandı</option>
                          <option value="rejected">Reddedildi</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => deleteApp.mutate(app.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-300/15 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );

  function updateTier(id: string, key: string, value: any) {
    setConfig((prev) => prev ? { ...prev, tiers: prev.tiers.map((t) => t.id === id ? { ...t, [key]: value } : t) } : prev);
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 md:p-5">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--panel-muted,#8a919c)]">{title}</p>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 px-3 py-2.5">
      <span className="text-xs font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn('flex h-6 w-11 items-center rounded-full border transition', value ? 'border-cyan-400/40 bg-cyan-400/20' : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/5')}
      >
        <span className={cn('h-4 w-4 rounded-full transition-transform', value ? 'translate-x-5 bg-[color:var(--panel-info,#64d2ff)]' : 'translate-x-0.5 bg-[color:var(--panel-faint,#5c6470)]')} />
      </button>
    </label>
  );
}

function Field({ label, value, onChange, className, multiline }: { label: string; value: string; onChange: (v: string) => void; className?: string; multiline?: boolean }) {
  const base = 'w-full rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-xs font-bold text-white outline-none placeholder:text-[color:var(--panel-faint,#5c6470)] focus:border-cyan-400/40';
  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[color:var(--panel-faint,#5c6470)]">{label}</p>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={cn(base, 'py-2 resize-none')} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cn(base, 'h-9')} />
      )}
    </div>
  );
}
