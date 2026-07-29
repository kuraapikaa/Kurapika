import { useMemo, useState } from 'react';
import { matchesAnyTr } from '../../lib/turkishSearch';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, KeyRound, Loader2, Lock, Plus, Save, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../../api/client';
import { cn } from '../../lib/utils';

const PERMISSIONS = [
  { id: 'dashboard', label: 'Genel görünüm', hint: 'Özet, grafik ve canlı durum' },
  { id: 'players', label: 'Oyuncular', hint: 'Oyuncu listesi ve profil inceleme' },
  { id: 'finance', label: 'Finans', hint: 'Yatırım, çekim ve işlemler' },
  { id: 'bonuses', label: 'Bonuslar', hint: 'Bonus merkezi ve kurallar' },
  { id: 'experience', label: 'Deneyim', hint: 'Oyun, turnuva, sadakat ayarları' },
  { id: 'forms', label: 'Talepler', hint: 'Beni ara ve ortaklık formları' },
  { id: 'reports', label: 'Raporlar', hint: 'Sağlayıcı, bonus ve audit raporları' },
  { id: 'system', label: 'Sistem', hint: 'iFrame, SMS ve kullanıcı sistemi' },
];

const ROLE_OPTIONS = [
  { id: 'manager', label: 'Yönetici' },
  { id: 'operator', label: 'Operatör' },
  { id: 'finance', label: 'Finans' },
  { id: 'support', label: 'Destek' },
  { id: 'viewer', label: 'İzleyici' },
];

const emptyForm = {
  id: '',
  name: '',
  username: '',
  password: '',
  role: 'operator',
  permissions: ['dashboard', 'players'],
  isActive: true,
};

type StaffForm = typeof emptyForm;

export function UserSystem() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-staff-users'],
    queryFn: () => adminApi.staffUsers(),
  });

  const staffUsers = data?.data || [];
  const filteredUsers = useMemo(() => {
    const term = search.trim();
    if (!term) return staffUsers;
    // Türkçe duyarlı: "ibrahim" sorgusu "İbrahim" kaydını bulmalı.
    return staffUsers.filter((user: any) => matchesAnyTr([user.name, user.username, user.role], term));
  }, [search, staffUsers]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        username: form.username,
        password: form.password,
        role: form.role,
        permissions: form.permissions,
        isActive: form.isActive,
      };
      if (editingId) return adminApi.updateStaffUser(editingId, payload);
      return adminApi.createStaffUser(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Çalışan güncellendi' : 'Çalışan hesabı oluşturuldu');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['admin-staff-users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteStaffUser(id),
    onSuccess: () => {
      toast.success('Çalışan kaldırıldı');
      queryClient.invalidateQueries({ queryKey: ['admin-staff-users'] });
    },
  });

  const updateForm = (key: keyof StaffForm, value: any) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const togglePermission = (permissionId: string) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permissionId)
        ? current.permissions.filter((item) => item !== permissionId)
        : [...current.permissions, permissionId],
    }));
  };

  const selectPreset = (role: string) => {
    const presets: Record<string, string[]> = {
      manager: PERMISSIONS.map((item) => item.id),
      operator: ['dashboard', 'players', 'bonuses', 'forms'],
      finance: ['dashboard', 'finance', 'reports'],
      support: ['dashboard', 'players', 'forms'],
      viewer: ['dashboard', 'reports'],
    };
    setForm((current) => ({ ...current, role, permissions: presets[role] || current.permissions }));
  };

  const editUser = (user: any) => {
    setEditingId(user.id);
    setForm({
      id: user.id,
      name: user.name || '',
      username: user.username || '',
      password: '',
      role: user.role || 'operator',
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      isActive: user.isActive !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeCount = staffUsers.filter((user: any) => user.isActive !== false).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#101722]/90 p-5 shadow-2xl shadow-black/20">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">Kullanıcı sistemi</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-white">Çalışan alt panelleri</h2>
              <p className="mt-2 max-w-2xl text-sm font-medium text-[color:var(--panel-muted,#8a919c)]">
                Müşteri admini ekip üyeleri için ayrı giriş oluşturur; hangi panel bölümlerini göreceklerini buradan seçer.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <MiniStat label="Aktif" value={activeCount} />
              <MiniStat label="Toplam" value={staffUsers.length} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Çalışan adı" value={form.name} onChange={(value) => updateForm('name', value)} placeholder="Örn: Operasyon Ekibi" />
            <Field label="Kullanıcı adı" value={form.username} onChange={(value) => updateForm('username', value)} placeholder="ornek.operator" />
            <Field
              label={editingId ? 'Yeni şifre' : 'Şifre'}
              value={form.password}
              onChange={(value) => updateForm('password', value)}
              placeholder={editingId ? 'Boş bırakılırsa değişmez' : 'Giriş şifresi'}
              type="password"
            />
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-muted,#8a919c)]">Rol şablonu</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => selectPreset(role.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-semibold transition',
                      form.role === role.id
                        ? 'border-cyan-300/40 bg-[color:var(--panel-info,#64d2ff)] text-[#050609]'
                        : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 text-[color:var(--panel-muted,#8a919c)] hover:text-white'
                    )}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-cyan-300" />
                <h3 className="text-sm font-semibold text-white">Yetkiler</h3>
              </div>
              <span className="rounded-full bg-[color:var(--panel-info,#64d2ff)]/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
                {form.permissions.length}/{PERMISSIONS.length} açık
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PERMISSIONS.map((permission) => {
                const selected = form.permissions.includes(permission.id);
                return (
                  <button
                    key={permission.id}
                    type="button"
                    onClick={() => togglePermission(permission.id)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition',
                      selected ? 'border-cyan-300/30 bg-[color:var(--panel-info,#64d2ff)]/[0.10]' : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0b111a] hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))]'
                    )}
                  >
                    <span className={cn('mt-0.5 grid h-5 w-5 place-items-center rounded-lg border', selected ? 'border-cyan-300 bg-[color:var(--panel-info,#64d2ff)] text-[#050609]' : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-transparent')}>
                      <Check size={13} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white">{permission.label}</span>
                      <span className="mt-0.5 block text-xs font-medium text-[color:var(--panel-muted,#8a919c)]">{permission.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => updateForm('isActive', !form.isActive)}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition',
                form.isActive ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/25 bg-rose-400/10 text-rose-200'
              )}
            >
              <Lock size={16} /> {form.isActive ? 'Hesap aktif' : 'Hesap pasif'}
            </button>
            <div className="flex gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="h-11 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-5 text-sm font-bold text-[color:var(--panel-muted,#8a919c)] transition hover:text-white">
                  Vazgeç
                </button>
              )}
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name.trim() || !form.username.trim() || (!editingId && !form.password.trim())}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[color:var(--panel-info,#64d2ff)] px-6 text-sm font-semibold text-[#050609] transition hover:bg-[color:var(--panel-info,#64d2ff)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : editingId ? <Save size={17} /> : <Plus size={17} />}
                {editingId ? 'Kaydet' : 'Çalışan aç'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#101722]/90 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--panel-muted,#8a919c)]">Ekip listesi</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Tanımlı çalışanlar</h3>
            </div>
            <Users className="text-cyan-300" size={24} />
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Çalışan ara"
            className="mb-4 h-11 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/40"
          />

          {isLoading ? (
            <div className="grid h-56 place-items-center text-[color:var(--panel-muted,#8a919c)]">
              <Loader2 className="animate-spin text-cyan-300" />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user: any) => (
                <article key={user.id} className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 rounded-full', user.isActive !== false ? 'bg-emerald-400' : 'bg-rose-400')} />
                        <h4 className="truncate text-sm font-semibold text-white">{user.name}</h4>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[color:var(--panel-muted,#8a919c)]">{user.username}</p>
                    </div>
                    <span className="rounded-full border border-cyan-300/15 bg-[color:var(--panel-info,#64d2ff)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
                      {ROLE_OPTIONS.find((role) => role.id === user.role)?.label || user.role}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(user.permissions || []).slice(0, 5).map((permissionId: string) => (
                      <span key={permissionId} className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)]">
                        {PERMISSIONS.find((item) => item.id === permissionId)?.label || permissionId}
                      </span>
                    ))}
                    {(user.permissions || []).length > 5 && <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)]">+{user.permissions.length - 5}</span>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => editUser(user)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] transition hover:text-white">
                      <UserCog size={15} /> Düzenle
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(user.id)}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-rose-200 transition hover:bg-rose-400/15 disabled:opacity-50"
                      aria-label="Çalışanı sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
              {filteredUsers.length === 0 && (
                <div className="rounded-xl border border-dashed border-[color:var(--panel-border,rgba(242,244,248,0.1))] py-12 text-center">
                  <KeyRound className="mx-auto mb-3 text-[color:var(--panel-faint,#5c6470)]" />
                  <p className="text-sm font-bold text-[color:var(--panel-muted,#8a919c)]">Henüz çalışan hesabı yok.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-muted,#8a919c)]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-[color:var(--panel-faint,#5c6470)] focus:border-cyan-300/40"
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-muted,#8a919c)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
