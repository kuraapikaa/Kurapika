import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Pause,
  Play,
  PlugZap,
  Plus,
  Save,
  Copy,
  RefreshCw,
  Search,
  Server,
  Timer,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { masterApi } from '@/api/client';
import { cn } from '@/lib/utils';

const initialForm = {
  siteName: '',
  domain: '',
  adminEmail: '',
  adminPassword: '',
  partnerId: '',
  expireDate: '',
  themeColor: '#22d3ee',
  logoUrl: '',
  adminTitle: '',
};

type TenantForm = typeof initialForm;

export function MasterPanel() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<TenantForm>(initialForm);
  /** Bağlantı ayarları açık olan site; null ise kapalı. */
  const [connectionTenant, setConnectionTenant] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['master-tenants'],
    queryFn: () => masterApi.getTenants(),
  });

  /**
   * Çok kiracılı çözümlemenin durumu. Panel site listesini gösteriyordu
   * ama isteklerin hangi kiracıya düştüğünü göstermiyordu; veritabanı
   * silindiğinde site sayısı sıfıra düştü, her istek yedek kiracıya
   * gitmeye başladı ve panel çalışmaya devam ettiği için fark edilmedi.
   */
  const { data: durum } = useQuery({
    queryKey: ['master-durum'],
    queryFn: () => masterApi.getDurum(),
    refetchInterval: 60_000,
  });

  const tenants = data?.data || [];
  const filteredTenants = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter((tenant: any) =>
      [tenant.siteName, tenant.domain, tenant.adminEmail, tenant.partnerId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [search, tenants]);

  const stats = useMemo(() => {
    const active = tenants.filter((tenant: any) => tenant.isActive).length;
    const passive = tenants.length - active;
    const expiring = tenants.filter((tenant: any) => {
      if (!tenant.expireDate) return false;
      const diff = new Date(tenant.expireDate).getTime() - Date.now();
      return diff > 0 && diff < 1000 * 60 * 60 * 24 * 14;
    }).length;
    return { total: tenants.length, active, passive, expiring };
  }, [tenants]);

  const createMutation = useMutation({
    mutationFn: () => masterApi.createTenant(form),
    onSuccess: () => {
      toast.success('Yeni müşteri paneli oluşturuldu');
      handleReset();
      queryClient.invalidateQueries({ queryKey: ['master-tenants'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; data: any }) => masterApi.updateTenant(args.id, args.data),
    onSuccess: () => {
      toast.success('Panel ayarları güncellendi');
      handleReset();
      queryClient.invalidateQueries({ queryKey: ['master-tenants'] });
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleReset = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const updateForm = (key: keyof TenantForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleEdit = (tenant: any) => {
    setForm({
      siteName: tenant.siteName || '',
      domain: tenant.domain || '',
      adminEmail: tenant.adminEmail || '',
      adminPassword: tenant.adminPassword || '',
      partnerId: tenant.partnerId || '',
      expireDate: tenant.expireDate || '',
      themeColor: tenant.themeColor || '#22d3ee',
      logoUrl: tenant.logoUrl || '',
      adminTitle: tenant.adminTitle || '',
    });
    setEditingId(tenant.id);
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white/[0.02] text-slate-200">
        <Loader2 size={34} className="animate-spin text-cyan-300" />
      </div>
    );
  }

  return (
    <div className="master-shell min-h-screen overflow-hidden bg-[#07090e] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,.11),transparent_30%),radial-gradient(circle_at_85%_0%,rgba(168,85,247,.10),transparent_28%),linear-gradient(180deg,#070b11,#080d14)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      </div>

      <main className="relative mx-auto w-full max-w-[1900px] space-y-4 p-4">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/[0.05] bg-white/10 p-8 md:flex-row md:items-center md:justify-between backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 grid-cols-2 place-items-center gap-1 rounded-full border border-purple-400/25 bg-blue-400/[0.1] p-2.5 text-purple-300">
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300/75">Master control</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-[-0.03em] text-white md:text-2xl">Müşteri panelleri</h1>
              <p className="mt-1 max-w-2xl text-xs font-medium text-slate-400">Tenant erişimlerini, domainleri ve marka ayarlarını tek merkezden yönetin.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] pl-9 pr-3 text-xs font-semibold text-white outline-none transition focus:border-blue-400/40 sm:w-64 backdrop-blur-xl"
                placeholder="Panel, domain veya e-posta ara"
              />
            </div>
            <button
              onClick={() => {
                if (showAdd && !editingId) setShowAdd(false);
                else {
                  handleReset();
                  setShowAdd(true);
                }
              }}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-400 px-4 text-xs font-bold text-white transition hover:bg-blue-300"
            >
              <Plus size={18} /> Yeni panel
            </button>
          </div>
        </header>

        <TenantResolutionBanner durum={durum} />

        <section className="grid grid-cols-2 gap-8 xl:grid-cols-4">
          <MetricCard label="Toplam panel" value={stats.total} icon={Server} tone="cyan" />
          <MetricCard label="Aktif" value={stats.active} icon={CheckCircle2} tone="emerald" />
          <MetricCard label="Pasif" value={stats.passive} icon={Pause} tone="rose" />
          <MetricCard label="Yaklaşan bitiş" value={stats.expiring} icon={Calendar} tone="amber" />
        </section>

        {showAdd && (
          <motion.section
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-white/[0.05] bg-white/10 p-8 backdrop-blur-xl"
          >
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[color:var(--panel-info,#64d2ff)]/10 blur-3xl" />
            <div className="relative mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">{editingId ? 'Düzenleme modu' : 'Yeni kurulum'}</p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-white">{editingId ? 'Panel ayarlarını düzenle' : 'Yeni müşteri paneli oluştur'}</h2>
              </div>
              <button onClick={handleReset} className="rounded-3xl border border-white/[0.05] bg-white/[0.03] p-2 text-slate-400 transition hover:text-white backdrop-blur-xl">
                <X size={18} />
              </button>
            </div>

            <div className="relative grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Site adı" value={form.siteName} onChange={(value) => updateForm('siteName', value)} placeholder="Örn: Bugs Casino" />
              <Field label="Domain" value={form.domain} onChange={(value) => updateForm('domain', value)} placeholder="ornek-domain.com" />
              <Field label="Admin e-posta" value={form.adminEmail} onChange={(value) => updateForm('adminEmail', value)} placeholder="admin@domain.com" />
              <Field label="Admin şifre" value={form.adminPassword} onChange={(value) => updateForm('adminPassword', value)} placeholder="Opsiyonel" />
              <Field label="Partner ID" value={form.partnerId} onChange={(value) => updateForm('partnerId', value)} placeholder="Opsiyonel" />
              <Field label="Bitiş tarihi" value={form.expireDate} onChange={(value) => updateForm('expireDate', value)} type="date" />
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Tema rengi</label>
                <div className="flex items-center gap-2 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-1 backdrop-blur-xl">
                  <input type="color" value={form.themeColor} onChange={(event) => updateForm('themeColor', event.target.value)} className="h-10 w-12 cursor-pointer rounded-full border-0 bg-transparent" />
                  <input value={form.themeColor} onChange={(event) => updateForm('themeColor', event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm font-bold text-white outline-none" />
                </div>
              </div>
              <Field label="Logo URL" value={form.logoUrl} onChange={(value) => updateForm('logoUrl', value)} placeholder="Logo bağlantısı" />
              <Field label="Panel başlığı" value={form.adminTitle} onChange={(value) => updateForm('adminTitle', value)} placeholder="Örn: Arwen Software Solutions" />
            </div>

            <div className="relative mt-4 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button onClick={handleReset} className="h-9 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-4 text-xs font-bold text-slate-400 transition hover:text-white backdrop-blur-xl">
                İptal
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 h-9 rounded-xl bg-blue-400 px-5 text-xs font-bold text-white transition hover:bg-blue-300 disabled:cursor-wait disabled:opacity-70"
              >
                {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                {isSaving ? 'Kaydediliyor...' : editingId ? 'Ayarları kaydet' : 'Paneli oluştur'}
              </button>
            </div>
          </motion.section>
        )}

        <section className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {filteredTenants.map((tenant: any) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              onEdit={() => handleEdit(tenant)}
              onConnection={() => setConnectionTenant(tenant)}
              onToggle={() => updateMutation.mutate({ id: tenant.id, data: { isActive: !tenant.isActive } })}
              isUpdating={updateMutation.isPending}
            />
          ))}

          {filteredTenants.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-white/[0.05] bg-white/10 py-12 text-center backdrop-blur-xl">
              <Sparkles className="mx-auto mb-4 text-slate-500" size={32} />
              <p className="text-sm font-bold text-slate-400">Gösterilecek müşteri paneli bulunamadı.</p>
              <p className="mt-1 text-xs text-slate-500">Aramayı temizleyin veya yeni panel oluşturun.</p>
            </div>
          )}
        </section>
      </main>

      {connectionTenant && (
        <ConnectionModal tenant={connectionTenant} onClose={() => setConnectionTenant(null)} />
      )}
    </div>
  );
}

/**
 * ÇOK KİRACILI ÇÖZÜMLEME DURUMU.
 *
 * Üç sessiz arıza burada görünür oluyor:
 *  1. Hiç site yok  → her istek yedek kiracıya düşer ve bonus kuralları,
 *     oyun ayarları, kimlikler siteler arasında PAYLAŞILIR.
 *  2. Domain'i olmayan aktif site → host eşleşmesi onu hiç bulamaz;
 *     panelde görünür ama hiçbir istek ona ulaşmaz.
 *  3. Aynı domain iki sitede → eşleşme ilk siteye gider, diğeri sessizce
 *     erişilemez olur.
 *
 * Üçü de panel "çalışıyor" görünürken olur; bu yüzden uyarıyı düzeltmenin
 * yapılacağı yerde, listenin üstünde gösteriyoruz.
 */
function TenantResolutionBanner({ durum }: { durum: any }) {
  if (!durum?.ok) return null;
  const tanilama = durum.tanilama || {};
  const alanAdiOlmayan: string[] = durum.alanAdiOlmayan || [];
  const cakisanlar: Array<{ domain: string; siteler: string[] }> = durum.cakisanAlanAdlari || [];
  const sorunlar: Array<{ tur: 'kritik' | 'uyari'; metin: string }> = [];

  if (tanilama.uyari) sorunlar.push({ tur: 'kritik', metin: tanilama.uyari });
  if (alanAdiOlmayan.length > 0) {
    sorunlar.push({
      tur: 'uyari',
      metin: `Domain tanımsız: ${alanAdiOlmayan.join(', ')}. Host eşleşmesi bu siteleri bulamaz; istekler "${durum.yedekAnahtar}" kiracısına düşer.`,
    });
  }
  for (const c of cakisanlar) {
    sorunlar.push({
      tur: 'kritik',
      metin: `"${c.domain}" birden fazla siteye tanımlı (${c.siteler.join(', ')}). Eşleşme ilkine gider, diğerleri erişilemez kalır.`,
    });
  }

  if (sorunlar.length === 0) {
    return (
      <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-emerald-200">
          <CheckCircle2 size={16} />
          <span>Çözümleme sağlıklı — {tanilama.aktifSite} aktif site domainiyle eşleşiyor.</span>
          <span className="font-medium text-emerald-200/70">Eşleşmeyen istekler: {durum.yedekAnahtar}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-3xl border border-amber-300/25 bg-amber-300/[0.07] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
        <ShieldAlert size={16} /> Çok kiracılı çözümleme
      </div>
      {sorunlar.map((sorun, i) => (
        <p
          key={i}
          className={cn(
            'text-xs font-semibold leading-relaxed',
            sorun.tur === 'kritik' ? 'text-rose-200' : 'text-amber-200/90'
          )}
        >
          {sorun.metin}
        </p>
      ))}
      <p className="pt-1 text-[11px] font-medium text-amber-200/60">
        Toplam {tanilama.siteSayisi ?? 0} site, {tanilama.aktifSite ?? 0} aktif. Eşleşmeyen istekler "{durum.yedekAnahtar}" kiracısına düşer.
      </p>
    </section>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: 'cyan' | 'emerald' | 'rose' | 'amber' }) {
  const toneClass = {
    cyan: 'bg-[color:var(--panel-info,#64d2ff)]/10 text-cyan-300 border-cyan-300/20',
    emerald: 'bg-emerald-300/10 text-emerald-300 border-emerald-300/20',
    rose: 'bg-rose-300/10 text-rose-300 border-rose-300/20',
    amber: 'bg-amber-300/10 text-amber-300 border-amber-300/20',
  }[tone];

  return (
    <div className="rounded-3xl border border-white/[0.05] bg-white/10 p-8.5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full border', toneClass)}>
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-white">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] px-3 text-xs font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/40 [color-scheme:dark] backdrop-blur-xl"
        placeholder={placeholder}
      />
    </div>
  );
}

/** Üç durumlu seçim: boş = ENV değerini kullan. */
function SecimAlani({ label, value, onChange, secenekler, ipucu }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secenekler: Array<[string, string]>;
  ipucu?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] px-3 text-xs font-semibold text-white outline-none transition focus:border-blue-400/40 [color-scheme:dark] backdrop-blur-xl"
      >
        {secenekler.map(([deger, etiket]) => (
          <option key={deger} value={deger}>{etiket}</option>
        ))}
      </select>
      {ipucu && <p className="mt-1 text-[10px] text-slate-500">{ipucu}</p>}
    </div>
  );
}

function TenantCard({ tenant, onEdit, onConnection, onToggle, isUpdating }: { tenant: any; onEdit: () => void; onConnection: () => void; onToggle: () => void; isUpdating: boolean }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/[0.05] bg-white/10 p-8 transition hover:border-purple-400/25 backdrop-blur-xl">
      <div className={cn('hidden absolute right-0 top-0 h-36 w-36 rounded-full blur-3xl', tenant.isActive ? 'bg-emerald-400/10' : 'bg-rose-400/10')} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/[0.035]">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt="" className="h-7 w-7 rounded-full object-contain" />
              ) : (
                <Globe className="text-cyan-300" size={20} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold tracking-[-0.025em] text-white">{tenant.siteName || 'İsimsiz panel'}</h3>
              <a href={`https://${tenant.domain}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-xs font-bold text-slate-400 transition hover:text-cyan-300">
                {tenant.domain || 'domain yok'} <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={isUpdating}
          className={cn(
            'shrink-0 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] transition disabled:cursor-wait disabled:opacity-70',
            tenant.isActive ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-300' : 'border-rose-300/20 bg-rose-300/10 text-rose-300'
          )}
        >
          {tenant.isActive ? 'Aktif' : 'Pasif'}
        </button>
      </div>

      <div className="relative mt-4 grid gap-8">
        <InfoRow icon={Shield} label="E-posta" value={tenant.adminEmail || 'Tanımsız'} />
        <InfoRow icon={Lock} label="Şifre" value={tenant.adminPassword ? '••••••••' : 'Tanımsız'} />
        <InfoRow icon={KeyRound} label="Partner" value={tenant.partnerId || 'Yok'} />
        <InfoRow icon={Calendar} label="Bitiş" value={tenant.expireDate || 'Süresiz'} />
        <InfoRow icon={Database} label="Kurulum" value={tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'} />
      </div>

      <div className="relative mt-4 flex gap-2">
        <button onClick={onEdit} className="flex h-8 flex-1 items-center justify-center rounded-3xl border border-white/[0.05] bg-white/[0.035] text-[10px] font-bold text-slate-200 transition hover:bg-white/[0.08] backdrop-blur-xl">
          <span className="inline-flex items-center gap-2"><Settings size={14} /> Ayarlar</span>
        </button>
        <button onClick={onConnection} className="flex h-8 flex-1 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.08] text-[10px] font-bold text-cyan-200 transition hover:bg-cyan-300/[0.14] backdrop-blur-xl">
          <span className="inline-flex items-center gap-2"><PlugZap size={14} /> Bağlantı</span>
        </button>
        <button
          onClick={onToggle}
          disabled={isUpdating}
          className={cn(
            'flex h-8 flex-1 items-center justify-center rounded-xl text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-70',
            tenant.isActive ? 'bg-rose-400/10 text-rose-300 hover:bg-rose-400/15' : 'bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15'
          )}
        >
          <span className="inline-flex items-center gap-2">{tenant.isActive ? <Pause size={14} /> : <Play size={14} />} {tenant.isActive ? 'Pasifleştir' : 'Aktifleştir'}</span>
        </button>
      </div>
    </article>
  );
}

/**
 * ALT SİTENİN KENDİ LYNON/BACKOFFICE BAĞLANTISI.
 *
 * Boş bırakılan her alan ortam değişkenindeki değere düşer; form bunu
 * yer tutucularda açıkça söyler. Sır alanları sunucudan MASKELİ gelir ve
 * boş gönderildiğinde "değiştirme" anlamına gelir — aksi halde forma
 * dokunmadan kaydet'e basmak sitenin şifresini silerdi.
 */
function ConnectionModal({ tenant, onClose }: { tenant: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [lynon, setLynon] = useState<Record<string, string>>({});
  const [backoffice, setBackoffice] = useState<Record<string, string>>({});
  const [testSonucu, setTestSonucu] = useState<{ ok: boolean; message: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['master-connection', tenant.id],
    queryFn: () => masterApi.getConnection(tenant.id),
  });

  const mevcut = data?.data;
  const sifrelemeHazir = data?.sifrelemeHazir !== false;

  const kaydet = useMutation({
    mutationFn: () => masterApi.updateConnection(tenant.id, { lynon, backoffice }),
    onSuccess: (cevap: any) => {
      if (cevap?.ok === false) {
        toast.error(cevap.message || 'Kaydedilemedi');
        return;
      }
      toast.success('Bağlantı bilgileri kaydedildi');
      setLynon({});
      setBackoffice({});
      setTestSonucu(null);
      queryClient.invalidateQueries({ queryKey: ['master-connection', tenant.id] });
    },
    onError: () => toast.error('Kaydedilemedi'),
  });

  const test = useMutation({
    mutationFn: () => masterApi.testConnection(tenant.id),
    onSuccess: (cevap: any) => setTestSonucu({ ok: Boolean(cevap?.ok), message: cevap?.message || '' }),
    onError: (hata: any) => setTestSonucu({ ok: false, message: hata?.message || 'Bağlantı denenemedi.' }),
  });

  const alan = (key: string, value: string) => setLynon((current) => ({ ...current, [key]: value }));

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative my-8 w-full max-w-3xl rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Site bağlantısı</p>
            <h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-white">{tenant.siteName || tenant.domain}</h2>
            <p className="mt-1 text-xs font-medium text-slate-400">
              Boş bırakılan alanlar sunucunun ortam değişkenindeki değeri kullanır.
            </p>
          </div>
          <button onClick={onClose} className="rounded-3xl border border-white/[0.05] bg-white/[0.03] p-2 text-slate-400 transition hover:text-white backdrop-blur-xl">
            <X size={18} />
          </button>
        </div>

        {!sifrelemeHazir && (
          <div className="mb-4 rounded-3xl border border-amber-300/25 bg-amber-300/[0.08] p-8 text-xs font-semibold text-amber-200 backdrop-blur-xl">
            <span className="inline-flex items-center gap-2"><ShieldAlert size={15} /> TENANT_SECRET_KEY tanımlı değil.</span>
            <p className="mt-1 font-medium text-amber-200/80">
              Şifre, OTP sırrı ve token alanları şifrelenemediği için kaydedilemez. Adres ve site kimliği gibi sır olmayan alanlar kaydedilebilir.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-cyan-300" /></div>
        ) : (
          <>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Lynon backoffice</p>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Backoffice adresi" value={lynon.backofficeBaseUrl ?? ''} onChange={(v) => alan('backofficeBaseUrl', v)} placeholder={mevcut?.lynon?.backofficeBaseUrl || 'ENV değeri'} />
              <Field label="Kimlik (ID) adresi" value={lynon.idBaseUrl ?? ''} onChange={(v) => alan('idBaseUrl', v)} placeholder={mevcut?.lynon?.idBaseUrl || 'ENV değeri'} />
              <Field label="Site ID" value={lynon.siteId ?? ''} onChange={(v) => alan('siteId', v)} placeholder={mevcut?.lynon?.siteId ? String(mevcut.lynon.siteId) : 'ENV değeri'} />
              <Field label="Para birimi" value={lynon.currency ?? ''} onChange={(v) => alan('currency', v)} placeholder={mevcut?.lynon?.currency || 'ENV değeri'} />
              <Field label="Panel kullanıcısı" value={lynon.username ?? ''} onChange={(v) => alan('username', v)} placeholder={mevcut?.lynon?.username || 'ENV değeri'} />
              <Field label="Panel şifresi" value={lynon.password ?? ''} onChange={(v) => alan('password', v)} placeholder={mevcut?.lynon?.passwordMask || 'ENV değeri'} type="password" />
              <Field label="Saat dilimi ofseti" value={lynon.timezoneOffset ?? ''} onChange={(v) => alan('timezoneOffset', v)} placeholder={mevcut?.lynon?.timezoneOffset != null ? String(mevcut.lynon.timezoneOffset) : 'ENV değeri'} />
              {/*
                Cihaz alanlari sunucuda ZATEN destekleniyordu ama panelde
                hic gorunmuyordu. `trustDevice` acilana kadar Lynon
                "User isn't authorized" donduruyor ve sebebi hicbir yerde
                yazmiyordu; parmak izi bos birakildiginda sunucu degismeyen
                girdilerden kararli bir deger turetiyor.
              */}
              <Field label="Cihaz parmak izi" value={lynon.deviceFingerprint ?? ''} onChange={(v) => alan('deviceFingerprint', v)} placeholder={mevcut?.lynon?.deviceFingerprint || 'Boş: otomatik türetilir'} />
              <SecimAlani
                label="Cihaza güven"
                value={lynon.trustDevice ?? (mevcut?.lynon?.trustDevice == null ? '' : String(mevcut.lynon.trustDevice))}
                onChange={(v) => alan('trustDevice', v)}
                secenekler={[['', 'ENV değeri'], ['true', 'Açık — önerilen'], ['false', 'Kapalı']]}
                ipucu="Kapalıyken Lynon her istekte yeniden doğrulama isteyip &quot;User isn't authorized&quot; dönebilir."
              />
            </div>

            <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">İki adımlı doğrulama (TOTP)</p>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
              <Field label="OTP sırrı" value={lynon.otpSecret ?? ''} onChange={(v) => alan('otpSecret', v)} placeholder={mevcut?.lynon?.otpSecretMask || 'ENV değeri'} type="password" />
              <Field label="OTP token (tek seferlik)" value={lynon.otpToken ?? ''} onChange={(v) => alan('otpToken', v)} placeholder={mevcut?.lynon?.otpTokenMask || 'ENV değeri'} type="password" />
              <SecimAlani
                label="Algoritma"
                value={lynon.otpAlgorithm ?? (mevcut?.lynon?.otpAlgorithm || '')}
                onChange={(v) => alan('otpAlgorithm', v)}
                secenekler={[['', 'ENV değeri (SHA1)'], ['sha1', 'SHA1'], ['sha256', 'SHA256'], ['sha512', 'SHA512']]}
              />
              <Field label="Hane sayısı" value={lynon.otpDigits ?? ''} onChange={(v) => alan('otpDigits', v)} placeholder={mevcut?.lynon?.otpDigits != null ? String(mevcut.lynon.otpDigits) : 'ENV değeri (6)'} />
              <Field label="Periyot (saniye)" value={lynon.otpPeriodSeconds ?? ''} onChange={(v) => alan('otpPeriodSeconds', v)} placeholder={mevcut?.lynon?.otpPeriodSeconds != null ? String(mevcut.lynon.otpPeriodSeconds) : 'ENV değeri (30)'} />
            </div>

            {/*
              Kaydedilen sirrin dogru olup olmadigi baska turlu ancak bir
              sonraki gercek girisin dusmesiyle anlasiliyordu.
            */}
            <div className="mt-3">
              <TotpKarti tenantId={tenant.id} />
            </div>

            <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Bu sitenin durumu</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <InfoRow icon={KeyRound} label="Kiracı" value={tenant.id} />
              <InfoRow icon={Globe} label="Domain" value={tenant.domain || 'TANIMSIZ — host eşleşmesi çalışmaz'} />
              <InfoRow icon={Database} label="Güncellendi" value={mevcut?.updatedAt ? new Date(mevcut.updatedAt).toLocaleString('tr-TR') : 'Hiç'} />
              <InfoRow icon={Shield} label="Değiştiren" value={mevcut?.updatedBy || '—'} />
            </div>

            <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Backoffice token</p>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <Field
                label="Backoffice token"
                value={backoffice.authToken ?? ''}
                onChange={(v) => setBackoffice((c) => ({ ...c, authToken: v }))}
                placeholder={mevcut?.backoffice?.authTokenMask || 'ENV değeri'}
                type="password"
              />
              <Field
                label="Dashboard token"
                value={backoffice.dashboardAuthToken ?? ''}
                onChange={(v) => setBackoffice((c) => ({ ...c, dashboardAuthToken: v }))}
                placeholder={mevcut?.backoffice?.dashboardAuthTokenMask || 'ENV değeri'}
                type="password"
              />
            </div>

            {testSonucu && (
              <div className={cn(
                'mt-4 rounded-3xl border p-8 text-xs font-semibold backdrop-blur-xl',
                testSonucu.ok ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200' : 'border-rose-300/25 bg-rose-300/[0.08] text-rose-200'
              )}>
                {testSonucu.ok ? 'Bağlantı kuruldu.' : testSonucu.message || 'Bağlantı kurulamadı.'}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <button
                onClick={() => test.mutate()}
                disabled={test.isPending}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-4 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-70 backdrop-blur-xl"
              >
                {test.isPending ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
                {test.isPending ? 'Deneniyor...' : 'Bağlantıyı dene'}
              </button>
              <div className="flex gap-3">
                <button onClick={onClose} className="h-9 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-4 text-xs font-bold text-slate-400 transition hover:text-white backdrop-blur-xl">
                  Kapat
                </button>
                <button
                  onClick={() => kaydet.mutate()}
                  disabled={kaydet.isPending}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-400 px-5 text-xs font-bold text-white transition hover:bg-blue-300 disabled:cursor-wait disabled:opacity-70"
                >
                  {kaydet.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {kaydet.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

/**
 * ANLIK TOTP KODU.
 *
 * Neden var: operatör OTP sırrını kaydediyor, doğru olup olmadığını ise
 * ancak bir sonraki gerçek girişin düşmesiyle öğreniyordu — ve o giriş
 * gece yarısı bir rapor işinin ortasında olabiliyor. Burada üretilen kod
 * authenticator uygulamasındakiyle aynıysa sır doğrudur.
 *
 * Kodu sunucu üretir, sır tarayıcıya HİÇ gelmez. Geri sayım yerelde
 * işler ama sıfıra ulaştığında kod sunucudan yeniden istenir; saat
 * kayması olan bir makinede yerel hesap yanlış kod gösterirdi.
 */
function TotpKarti({ tenantId }: { tenantId: string }) {
  const [kalan, setKalan] = useState<number | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['master-otp', tenantId],
    queryFn: () => masterApi.getTenantOtp(tenantId),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data?.kalanSaniye == null) { setKalan(null); return; }
    setKalan(data.kalanSaniye);
  }, [data]);

  useEffect(() => {
    if (kalan == null) return;
    if (kalan <= 0) { refetch(); return; }
    const t = setTimeout(() => setKalan((k) => (k == null ? null : k - 1)), 1000);
    return () => clearTimeout(t);
  }, [kalan, refetch]);

  const kopyala = async () => {
    if (!data?.kod) return;
    try {
      await navigator.clipboard.writeText(String(data.kod));
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 1500);
    } catch {
      toast.error('Kopyalanamadı');
    }
  };

  const periyot = Number(data?.periyot) || 30;
  const oran = kalan == null ? 0 : Math.max(0, Math.min(1, kalan / periyot));

  return (
    <div className="rounded-3xl border border-white/[0.05] bg-black/20 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
          <Timer size={13} /> Anlık TOTP kodu
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-slate-300 transition hover:text-white disabled:opacity-60"
        >
          <RefreshCw size={12} className={cn(isFetching && 'animate-spin')} /> Yenile
        </button>
      </div>

      {isFetching && !data ? (
        <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-cyan-300" /></div>
      ) : data?.ok ? (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={kopyala}
              title="Kopyala"
              className="group inline-flex items-center gap-3 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 transition hover:bg-cyan-300/[0.13]"
            >
              <span className="font-mono text-2xl font-bold tracking-[0.25em] text-cyan-200">{data.kod}</span>
              {kopyalandi ? <CheckCircle2 size={16} className="text-emerald-300" /> : <Copy size={16} className="text-cyan-300/60 group-hover:text-cyan-200" />}
            </button>

            {kalan != null && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', kalan <= 5 ? 'bg-rose-400' : 'bg-cyan-300')}
                    style={{ width: `${oran * 100}%` }}
                  />
                </div>
                <span className={cn('text-xs font-bold tabular-nums', kalan <= 5 ? 'text-rose-300' : 'text-slate-400')}>{kalan}s</span>
              </div>
            )}
          </div>

          {data.sabit ? (
            <p className="mt-3 text-[11px] font-semibold leading-relaxed text-amber-200/90">{data.uyari}</p>
          ) : (
            <p className="mt-3 text-[11px] font-medium text-slate-500">
              {String(data.algoritma || '').toUpperCase()} · {data.hane} hane · {periyot}s.
              Authenticator uygulamanızdaki kodla aynıysa sır doğru kaydedilmiş.
            </p>
          )}
        </>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400">
          {data?.message || 'Kod üretilemedi.'}
        </p>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, title }: { icon: any; label: string; value: string; title?: string }) {
  return (
    <div className="flex min-h-8 items-center gap-2 rounded-3xl border border-white/[0.05] bg-black/15 px-2.5 py-1.5 text-[11px] backdrop-blur-xl" title={title}>
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</span>
      <span className="min-w-0 truncate font-semibold text-slate-200">{value}</span>
    </div>
  );
}
