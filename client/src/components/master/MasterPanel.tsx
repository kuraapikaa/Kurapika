import { useMemo, useState } from 'react';
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
  Plus,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { masterApi } from '../../api/client';
import { cn } from '../../lib/utils';

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

  const { data, isLoading } = useQuery({
    queryKey: ['master-tenants'],
    queryFn: () => masterApi.getTenants(),
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
      <div className="flex min-h-screen items-center justify-center bg-[#070b11] text-slate-300">
        <Loader2 size={34} className="animate-spin text-cyan-300" />
      </div>
    );
  }

  return (
    <div className="master-shell min-h-screen overflow-hidden bg-[#07090e] text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,.11),transparent_30%),radial-gradient(circle_at_85%_0%,rgba(168,85,247,.10),transparent_28%),linear-gradient(180deg,#070b11,#080d14)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      </div>

      <main className="relative mx-auto w-full max-w-[1900px] space-y-4 p-4">
        <header className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-[#0d1119] p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 grid-cols-2 place-items-center gap-1 rounded-lg border border-blue-400/20 bg-blue-400/[0.1] p-2.5 text-blue-300">
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300/75">Master control</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-[-0.03em] text-white md:text-2xl">Müşteri panelleri</h1>
              <p className="mt-1 max-w-2xl text-xs font-medium text-slate-500">Tenant erişimlerini, domainleri ve marka ayarlarını tek merkezden yönetin.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#090d13] pl-9 pr-3 text-xs font-semibold text-white outline-none transition focus:border-blue-400/40 sm:w-64"
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
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-400 px-4 text-xs font-bold text-white transition hover:bg-blue-300"
            >
              <Plus size={18} /> Yeni panel
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard label="Toplam panel" value={stats.total} icon={Server} tone="cyan" />
          <MetricCard label="Aktif" value={stats.active} icon={CheckCircle2} tone="emerald" />
          <MetricCard label="Pasif" value={stats.passive} icon={Pause} tone="rose" />
          <MetricCard label="Yaklaşan bitiş" value={stats.expiring} icon={Calendar} tone="amber" />
        </section>

        {showAdd && (
          <motion.section
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1119] p-4"
          >
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="relative mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">{editingId ? 'Düzenleme modu' : 'Yeni kurulum'}</p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-white">{editingId ? 'Panel ayarlarını düzenle' : 'Yeni müşteri paneli oluştur'}</h2>
              </div>
              <button onClick={handleReset} className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-500 transition hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="relative grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Site adı" value={form.siteName} onChange={(value) => updateForm('siteName', value)} placeholder="Örn: Bugs Casino" />
              <Field label="Domain" value={form.domain} onChange={(value) => updateForm('domain', value)} placeholder="ornek-domain.com" />
              <Field label="Admin e-posta" value={form.adminEmail} onChange={(value) => updateForm('adminEmail', value)} placeholder="admin@domain.com" />
              <Field label="Admin şifre" value={form.adminPassword} onChange={(value) => updateForm('adminPassword', value)} placeholder="Opsiyonel" />
              <Field label="Partner ID" value={form.partnerId} onChange={(value) => updateForm('partnerId', value)} placeholder="Opsiyonel" />
              <Field label="Bitiş tarihi" value={form.expireDate} onChange={(value) => updateForm('expireDate', value)} type="date" />
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tema rengi</label>
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#090d13] p-1">
                  <input type="color" value={form.themeColor} onChange={(event) => updateForm('themeColor', event.target.value)} className="h-10 w-12 cursor-pointer rounded-xl border-0 bg-transparent" />
                  <input value={form.themeColor} onChange={(event) => updateForm('themeColor', event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm font-bold text-white outline-none" />
                </div>
              </div>
              <Field label="Logo URL" value={form.logoUrl} onChange={(value) => updateForm('logoUrl', value)} placeholder="Logo bağlantısı" />
              <Field label="Panel başlığı" value={form.adminTitle} onChange={(value) => updateForm('adminTitle', value)} placeholder="Örn: Bugs Software Portal" />
            </div>

            <div className="relative mt-4 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button onClick={handleReset} className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-bold text-slate-400 transition hover:text-white">
                İptal
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 h-9 rounded-lg bg-blue-400 px-5 text-xs font-bold text-white transition hover:bg-blue-300 disabled:cursor-wait disabled:opacity-70"
              >
                {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                {isSaving ? 'Kaydediliyor...' : editingId ? 'Ayarları kaydet' : 'Paneli oluştur'}
              </button>
            </div>
          </motion.section>
        )}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredTenants.map((tenant: any) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              onEdit={() => handleEdit(tenant)}
              onToggle={() => updateMutation.mutate({ id: tenant.id, data: { isActive: !tenant.isActive } })}
              isUpdating={updateMutation.isPending}
            />
          ))}

          {filteredTenants.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-white/[0.08] bg-[#0d1119] py-12 text-center">
              <Sparkles className="mx-auto mb-4 text-slate-600" size={32} />
              <p className="text-sm font-bold text-slate-400">Gösterilecek müşteri paneli bulunamadı.</p>
              <p className="mt-1 text-xs text-slate-600">Aramayı temizleyin veya yeni panel oluşturun.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: 'cyan' | 'emerald' | 'rose' | 'amber' }) {
  const toneClass = {
    cyan: 'bg-cyan-300/10 text-cyan-300 border-cyan-300/20',
    emerald: 'bg-emerald-300/10 text-emerald-300 border-emerald-300/20',
    rose: 'bg-rose-300/10 text-rose-300 border-rose-300/20',
    amber: 'bg-amber-300/10 text-amber-300 border-amber-300/20',
  }[tone];

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0d1119] p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', toneClass)}>
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
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#090d13] px-3 text-xs font-semibold text-white outline-none transition placeholder:text-slate-700 focus:border-blue-400/40 [color-scheme:dark]"
        placeholder={placeholder}
      />
    </div>
  );
}

function TenantCard({ tenant, onEdit, onToggle, isUpdating }: { tenant: any; onEdit: () => void; onToggle: () => void; isUpdating: boolean }) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1119] p-4 transition hover:border-blue-400/20">
      <div className={cn('hidden absolute right-0 top-0 h-36 w-36 rounded-full blur-3xl', tenant.isActive ? 'bg-emerald-400/10' : 'bg-rose-400/10')} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035]">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt="" className="h-7 w-7 rounded-lg object-contain" />
              ) : (
                <Globe className="text-cyan-300" size={20} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold tracking-[-0.025em] text-white">{tenant.siteName || 'İsimsiz panel'}</h3>
              <a href={`https://${tenant.domain}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-xs font-bold text-slate-500 transition hover:text-cyan-300">
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

      <div className="relative mt-4 grid gap-2">
        <InfoRow icon={Shield} label="E-posta" value={tenant.adminEmail || 'Tanımsız'} />
        <InfoRow icon={Lock} label="Şifre" value={tenant.adminPassword ? '••••••••' : 'Tanımsız'} />
        <InfoRow icon={KeyRound} label="Partner" value={tenant.partnerId || 'Yok'} />
        <InfoRow icon={Calendar} label="Bitiş" value={tenant.expireDate || 'Süresiz'} />
        <InfoRow icon={Database} label="Kurulum" value={tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'} />
      </div>

      <div className="relative mt-4 flex gap-2">
        <button onClick={onEdit} className="flex h-8 flex-1 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-[10px] font-bold text-slate-200 transition hover:bg-white/[0.08]">
          <span className="inline-flex items-center gap-2"><Settings size={14} /> Ayarlar</span>
        </button>
        <button
          onClick={onToggle}
          disabled={isUpdating}
          className={cn(
            'flex h-8 flex-1 items-center justify-center rounded-lg text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-70',
            tenant.isActive ? 'bg-rose-400/10 text-rose-300 hover:bg-rose-400/15' : 'bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15'
          )}
        >
          <span className="inline-flex items-center gap-2">{tenant.isActive ? <Pause size={14} /> : <Play size={14} />} {tenant.isActive ? 'Pasifleştir' : 'Aktifleştir'}</span>
        </button>
      </div>
    </article>
  );
}

function InfoRow({ icon: Icon, label, value, title }: { icon: any; label: string; value: string; title?: string }) {
  return (
    <div className="flex min-h-8 items-center gap-2 rounded-lg border border-white/[0.055] bg-black/15 px-2.5 py-1.5 text-[11px]" title={title}>
      <Icon className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">{label}</span>
      <span className="min-w-0 truncate font-semibold text-slate-300">{value}</span>
    </div>
  );
}
