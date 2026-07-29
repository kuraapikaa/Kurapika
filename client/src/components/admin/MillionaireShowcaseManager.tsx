import { Crown, Eye, Film, Link2, Plus, Sparkles, Trash2, Trophy } from 'lucide-react';
import { cn } from '../../lib/utils';

type MillionaireRecord = {
  id: string;
  title: string;
  amount: string;
  player: string;
  game: string;
  imageUrl?: string;
  posterUrl?: string;
  videoUrl?: string;
  featured?: boolean;
};

type SocialLink = {
  id: string;
  label: string;
  url: string;
};

type MillionaireShowcaseConfig = {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  showTicker: boolean;
  showSocial: boolean;
  disclaimer: string;
  socialLinks: SocialLink[];
  records: MillionaireRecord[];
};

const DEFAULT_SHOWCASE: MillionaireShowcaseConfig = {
  isActive: true,
  eyebrow: 'Büyük Kazanç Vitrini',
  title: 'Büyük kazanç anları burada parlıyor',
  description: 'Öne çıkan kazanç kayıtlarını, video anlarını ve yüksek ödül hikayelerini lobide tek vitrinde göster.',
  ctaLabel: 'Kazancı izle',
  showTicker: true,
  showSocial: false,
  disclaimer: '18+ Sorumlu oyun. Görseller ve videolar yalnızca izinli içeriklerle kullanılmalıdır.',
  socialLinks: [],
  records: []
};

const emptyRecord = (): MillionaireRecord => ({
  id: `win-${Date.now()}`,
  title: 'Yeni büyük kazanç',
  amount: '₺100.000',
  player: 'K***',
  game: 'Öne çıkan oyun',
  imageUrl: '',
  posterUrl: '',
  videoUrl: '',
  featured: false
});

const emptySocial = (): SocialLink => ({
  id: `social-${Date.now()}`,
  label: 'Sosyal kanal',
  url: ''
});

const parseAmount = (amount: string) => Number(String(amount || '').replace(/[^\d]/g, '')) || 0;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0
  }).format(value);

export function MillionaireShowcaseManager({
  config,
  onUpdate
}: {
  config?: Partial<MillionaireShowcaseConfig>;
  onUpdate: (config: MillionaireShowcaseConfig) => void;
}) {
  const safeConfig: MillionaireShowcaseConfig = {
    ...DEFAULT_SHOWCASE,
    ...(config || {}),
    records: Array.isArray(config?.records) ? config.records : DEFAULT_SHOWCASE.records,
    socialLinks: Array.isArray(config?.socialLinks) ? config.socialLinks : DEFAULT_SHOWCASE.socialLinks
  };

  const totalAmount = safeConfig.records.reduce((sum, record) => sum + parseAmount(record.amount), 0);
  const featuredRecord = safeConfig.records.find((record) => record.featured) || safeConfig.records[0];
  const videoCount = safeConfig.records.filter((record) => Boolean(record.videoUrl)).length;

  const updateConfig = (patch: Partial<MillionaireShowcaseConfig>) => {
    onUpdate({ ...safeConfig, ...patch });
  };

  const updateRecord = (id: string, patch: Partial<MillionaireRecord>) => {
    const records = safeConfig.records.map((record) => {
      if (record.id !== id) {
        return patch.featured ? { ...record, featured: false } : record;
      }

      return { ...record, ...patch };
    });

    onUpdate({ ...safeConfig, records });
  };

  const addRecord = () => {
    onUpdate({ ...safeConfig, records: [...safeConfig.records, emptyRecord()] });
  };

  const removeRecord = (id: string) => {
    onUpdate({ ...safeConfig, records: safeConfig.records.filter((record) => record.id !== id) });
  };

  const updateSocial = (id: string, patch: Partial<SocialLink>) => {
    onUpdate({
      ...safeConfig,
      socialLinks: safeConfig.socialLinks.map((link) => link.id === id ? { ...link, ...patch } : link)
    });
  };

  const addSocial = () => {
    onUpdate({ ...safeConfig, socialLinks: [...safeConfig.socialLinks, emptySocial()] });
  };

  const removeSocial = (id: string) => {
    onUpdate({ ...safeConfig, socialLinks: safeConfig.socialLinks.filter((link) => link.id !== id) });
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-[color:var(--panel-warning,#ff9f0a)]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                  <Crown size={13} />
                  Lobi vitrini
                </div>
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">Büyük Kazanç Vitrini</h2>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[color:var(--panel-muted,#8a919c)]">
                  Lobide görünecek kazanç alanını, kayıtları ve video bağlantılarını buradan yönetin.
                </p>
              </div>

              <label className="flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--panel-text-dim,#c8cdd5)]">
                <input
                  type="checkbox"
                  checked={safeConfig.isActive}
                  onChange={(event) => updateConfig({ isActive: event.target.checked })}
                  className="h-4 w-4 accent-amber-300"
                />
                Lobide aktif
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard label="Toplam vitrin" value={formatCurrency(totalAmount)} icon={Trophy} tone="amber" />
              <StatCard label="Kazanç kaydı" value={safeConfig.records.length} icon={Sparkles} tone="emerald" />
              <StatCard label="Video ekli" value={videoCount} icon={Film} tone="sky" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field label="Üst etiket" value={safeConfig.eyebrow} onChange={(value) => updateConfig({ eyebrow: value })} />
              <Field label="Buton metni" value={safeConfig.ctaLabel} onChange={(value) => updateConfig({ ctaLabel: value })} />
              <Field label="Başlık" value={safeConfig.title} onChange={(value) => updateConfig({ title: value })} />
              <Field label="Uyarı metni" value={safeConfig.disclaimer} onChange={(value) => updateConfig({ disclaimer: value })} />
              <TextArea label="Açıklama" value={safeConfig.description} onChange={(value) => updateConfig({ description: value })} className="lg:col-span-2" />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ToggleCard
                title="Kayan kazanç bandı"
                description="Vitrindeki kazançları lobinin içinde hareketli şerit olarak gösterir."
                checked={safeConfig.showTicker}
                onChange={(showTicker) => updateConfig({ showTicker })}
              />
              <ToggleCard
                title="Sosyal link alanı"
                description="Vitrin altında izinli sosyal kanal bağlantılarını gösterir."
                checked={safeConfig.showSocial}
                onChange={(showSocial) => updateConfig({ showSocial })}
              />
            </div>
          </div>

          <div className="border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-5 lg:border-l lg:border-t-0 md:p-6">
            <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-faint,#5c6470)]">Canlı önizleme</p>
                  <h3 className="text-lg font-semibold text-white">Lobi kartı</h3>
                </div>
                <Eye size={18} className="text-amber-300" />
              </div>

              <div className="overflow-hidden rounded-xl border border-amber-300/15 bg-gradient-to-br from-[#18120a] via-[#090b10] to-[#05070b] p-4">
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-[color:var(--panel-warning,#ff9f0a)]/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                  <Sparkles size={12} />
                  {safeConfig.eyebrow}
                </div>
                <h4 className="text-3xl font-semibold leading-none tracking-[-0.05em] text-white">{safeConfig.title}</h4>
                <p className="mt-3 line-clamp-3 text-sm font-medium leading-6 text-[color:var(--panel-muted,#8a919c)]">{safeConfig.description}</p>

                {featuredRecord && (
                  <div className="mt-6 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.04] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">Öne çıkan kayıt</p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-white">{featuredRecord.title}</p>
                        <p className="mt-1 text-xs font-bold text-[color:var(--panel-muted,#8a919c)]">{featuredRecord.player} · {featuredRecord.game}</p>
                      </div>
                      <p className="shrink-0 text-2xl font-semibold text-amber-200">{featuredRecord.amount}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]">
        <div className="flex flex-col gap-3 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-faint,#5c6470)]">İçerik</p>
            <h3 className="text-xl font-semibold text-white">Kazanç kayıtları</h3>
          </div>
          <button
            type="button"
            onClick={addRecord}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--panel-warning,#ff9f0a)] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#050609] transition hover:bg-[color:var(--panel-warning,#ff9f0a)]"
          >
            <Plus size={16} />
            Kayıt ekle
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-2 md:p-6">
          {safeConfig.records.map((record, index) => (
            <RecordEditor
              key={record.id}
              record={record}
              index={index}
              onUpdate={(patch) => updateRecord(record.id, patch)}
              onRemove={() => removeRecord(record.id)}
            />
          ))}

          {safeConfig.records.length === 0 && (
            <div className="xl:col-span-2 rounded-xl border border-dashed border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 p-10 text-center">
              <Trophy className="mx-auto mb-3 text-[color:var(--panel-faint,#5c6470)]" size={34} />
              <p className="text-sm font-bold text-[color:var(--panel-muted,#8a919c)]">Henüz kazanç kaydı eklenmedi.</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-faint,#5c6470)]">Bağlantılar</p>
            <h3 className="text-xl font-semibold text-white">Sosyal linkler</h3>
          </div>
          <button
            type="button"
            onClick={addSocial}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.04] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white/[0.07]"
          >
            <Plus size={15} />
            Link ekle
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {safeConfig.socialLinks.map((link) => (
            <div key={link.id} className="grid grid-cols-1 gap-3 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 p-4 md:grid-cols-[180px_minmax(0,1fr)_42px]">
              <Field label="Etiket" value={link.label} onChange={(value) => updateSocial(link.id, { label: value })} />
              <Field label="URL" value={link.url} onChange={(value) => updateSocial(link.id, { url: value })} />
              <button
                type="button"
                onClick={() => removeSocial(link.id)}
                aria-label="Sosyal linki sil"
                className="mt-auto flex h-11 items-center justify-center rounded-lg border border-rose-300/15 bg-rose-400/10 text-rose-300"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {safeConfig.socialLinks.length === 0 && (
            <div className="lg:col-span-2 rounded-lg border border-dashed border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-8 text-center">
              <Link2 className="mx-auto mb-3 text-[color:var(--panel-faint,#5c6470)]" size={28} />
              <p className="text-sm font-bold text-[color:var(--panel-muted,#8a919c)]">Sosyal link eklenmedi.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RecordEditor({
  record,
  index,
  onUpdate,
  onRemove
}: {
  record: MillionaireRecord;
  index: number;
  onUpdate: (patch: Partial<MillionaireRecord>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-semibold',
            record.featured
              ? 'border-amber-300/30 bg-[color:var(--panel-warning,#ff9f0a)]/15 text-amber-200'
              : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.04] text-[color:var(--panel-muted,#8a919c)]'
          )}>
            #{index + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Kazanç kartı</p>
            <p className="text-xs font-semibold text-[color:var(--panel-faint,#5c6470)]">Görsel, poster ve video URL alanları</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Kazanç kaydını sil"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-300/15 bg-rose-400/10 text-rose-300"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Başlık" value={record.title} onChange={(value) => onUpdate({ title: value })} />
        <Field label="Tutar" value={record.amount} onChange={(value) => onUpdate({ amount: value })} />
        <Field label="Oyuncu" value={record.player} onChange={(value) => onUpdate({ player: value })} />
        <Field label="Oyun" value={record.game} onChange={(value) => onUpdate({ game: value })} />
        <Field label="Görsel URL" value={record.imageUrl || ''} onChange={(value) => onUpdate({ imageUrl: value })} />
        <Field label="Poster URL" value={record.posterUrl || ''} onChange={(value) => onUpdate({ posterUrl: value })} />
        <Field label="Video URL" value={record.videoUrl || ''} onChange={(value) => onUpdate({ videoUrl: value })} className="md:col-span-2" />
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.035] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--panel-text-dim,#c8cdd5)]">
        <input
          type="checkbox"
          checked={Boolean(record.featured)}
          onChange={(event) => onUpdate({ featured: event.target.checked })}
          className="h-4 w-4 accent-amber-300"
        />
        Öne çıkan kayıt yap
      </label>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Trophy; tone: 'amber' | 'emerald' | 'sky' }) {
  const toneClass = {
    amber: 'border-amber-300/15 bg-[color:var(--panel-warning,#ff9f0a)]/10 text-amber-200',
    emerald: 'border-emerald-300/15 bg-emerald-300/10 text-emerald-200',
    sky: 'border-sky-300/15 bg-sky-300/10 text-sky-200'
  }[tone];

  return (
    <div className="rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg border', toneClass)}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-faint,#5c6470)]">{label}</p>
          <p className="truncate text-xl font-semibold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  onChange
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-amber-300"
      />
      <span>
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="mt-1 block text-xs font-medium leading-5 text-[color:var(--panel-muted,#8a919c)]">{description}</span>
      </span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  className
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-faint,#5c6470)]">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-sm font-bold text-white outline-none transition focus:border-amber-300/45"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  className
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-faint,#5c6470)]">{label}</label>
      <textarea
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="min-h-28 w-full resize-y rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 py-3 text-sm font-bold leading-6 text-white outline-none transition focus:border-amber-300/45"
      />
    </div>
  );
}
