import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formsApi } from '../../api/client';
import {
  Loader2, Phone, Handshake, CheckCircle, Clock, Settings, Save, Plus, Trash2,
  Search, Download, StickyNote, X, AlertTriangle, FileText, Type
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

function exportCSV(data: any[], filename: string, columns: { key: string; label: string }[]) {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const rows = data.map(row =>
    columns.map(c => `"${(row[c.key] ?? '').toString().replace(/"/g, '""')}"`).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className={cn('rounded-xl border p-4 space-y-1', color)}>
      <p className="text-xs font-bold uppercase tracking-widest opacity-60">{label}</p>
      <p className="text-3xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs opacity-50">{sub}</p>}
    </div>
  );
}

function NoteModal({
  currentNote, onClose, onSave, isSaving
}: {
  currentNote: string;
  onClose: () => void; onSave: (note: string) => void; isSaving: boolean;
}) {
  const [note, setNote] = useState(currentNote);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0e1421] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <StickyNote size={16} className="text-amber-400" /> Admin Notu
          </h3>
          <button onClick={onClose} className="text-[color:var(--panel-muted,#8a919c)] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
            placeholder="Bu talep için not ekleyin..."
            className="w-full bg-black/40 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/40 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 text-[color:var(--panel-muted,#8a919c)] hover:text-white text-sm font-bold transition-colors">
              İptal
            </button>
            <button
              onClick={() => onSave(note)}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#050609] text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminForms() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'call' | 'partnership' | 'settings'>('call');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [noteModal, setNoteModal] = useState<{ collection: string; id: string; note: string; status: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ collection: string; id: string } | null>(null);

  // Settings state
  const [callReasons, setCallReasons] = useState<string[]>([]);
  const [partnershipTypes, setPartnershipTypes] = useState<string[]>([]);
  const [callActive, setCallActive] = useState(true);
  const [partnershipActive, setPartnershipActive] = useState(true);
  const [callTitle, setCallTitle] = useState('');
  const [callDescription, setCallDescription] = useState('');
  const [callSuccessMessage, setCallSuccessMessage] = useState('');
  const [callButtonText, setCallButtonText] = useState('');
  const [partnershipTitle, setPartnershipTitle] = useState('');
  const [partnershipDescription, setPartnershipDescription] = useState('');
  const [partnershipSuccessMessage, setPartnershipSuccessMessage] = useState('');
  const [partnershipButtonText, setPartnershipButtonText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-forms'],
    queryFn: () => formsApi.getAdminForms(),
    refetchInterval: 30_000,
  });

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['forms-settings'],
    queryFn: () => formsApi.getSettings(),
  });

  useEffect(() => {
    const s = settingsData?.data;
    if (!s) return;
    setCallReasons(s.callReasons || []);
    setPartnershipTypes(s.partnershipTypes || []);
    setCallActive(s.callActive ?? true);
    setPartnershipActive(s.partnershipActive ?? true);
    setCallTitle(s.callTitle || 'Beni Ara');
    setCallDescription(s.callDescription || 'Müşteri temsilcilerimizin sizi araması için form doldurun.');
    setCallSuccessMessage(s.callSuccessMessage || 'Talebiniz alınmıştır. Sizi en kısa sürede arayacağız.');
    setCallButtonText(s.callButtonText || 'Talep Gönder');
    setPartnershipTitle(s.partnershipTitle || 'Ortaklık Başvurusu');
    setPartnershipDescription(s.partnershipDescription || 'Telegram grubu sahipleri, yayıncılar ve partnerler için ortaklık formu.');
    setPartnershipSuccessMessage(s.partnershipSuccessMessage || 'Ortaklık talebiniz başarıyla alınmıştır. Ekibimiz sizinle iletişime geçecektir.');
    setPartnershipButtonText(s.partnershipButtonText || 'Başvuru Gönder');
  }, [settingsData]);

  const updateMutation = useMutation({
    mutationFn: (args: { collection: string; id: string; status?: string; note?: string }) =>
      formsApi.updateFormStatus(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-forms'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (args: { collection: string; id: string }) => formsApi.deleteForm(args),
    onSuccess: () => {
      toast.success('Kayıt silindi');
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['admin-forms'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: any) => formsApi.updateSettings(settings),
    onSuccess: () => {
      toast.success('Ayarlar kaydedildi');
      queryClient.invalidateQueries({ queryKey: ['forms-settings'] });
    },
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      callReasons: callReasons.filter(r => r.trim()),
      partnershipTypes: partnershipTypes.filter(r => r.trim()),
      callActive,
      partnershipActive,
      callTitle,
      callDescription,
      callSuccessMessage,
      callButtonText,
      partnershipTitle,
      partnershipDescription,
      partnershipSuccessMessage,
      partnershipButtonText,
    });
  };

  const handleMarkCompleted = (collection: string, id: string) => {
    updateMutation.mutate(
      { collection, id, status: 'completed' },
      { onSuccess: () => toast.success('Durum güncellendi') }
    );
  };

  const handleSaveNote = (note: string) => {
    if (!noteModal) return;
    updateMutation.mutate(
      { collection: noteModal.collection, id: noteModal.id, note, status: noteModal.status },
      {
        onSuccess: () => {
          toast.success('Not kaydedildi');
          setNoteModal(null);
        },
      }
    );
  };

  const calls = data?.data?.callRequests || [];
  const partnerships = data?.data?.partnershipRequests || [];

  const today = new Date().toDateString();
  const callStats = useMemo(() => ({
    total: calls.length,
    pending: calls.filter((r: any) => r.status !== 'completed').length,
    completed: calls.filter((r: any) => r.status === 'completed').length,
    today: calls.filter((r: any) => new Date(r.createdAt).toDateString() === today).length,
  }), [calls, today]);

  const partnershipStats = useMemo(() => ({
    total: partnerships.length,
    pending: partnerships.filter((r: any) => r.status !== 'completed').length,
    completed: partnerships.filter((r: any) => r.status === 'completed').length,
    today: partnerships.filter((r: any) => new Date(r.createdAt).toDateString() === today).length,
  }), [partnerships, today]);

  const filteredCalls = useMemo(() => calls.filter((r: any) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || r.username?.toLowerCase().includes(q) || r.phone?.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }), [calls, statusFilter, searchTerm]);

  const filteredPartnerships = useMemo(() => partnerships.filter((r: any) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || r.contact?.toLowerCase().includes(q) || r.channelUrl?.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }), [partnerships, statusFilter, searchTerm]);

  if (isLoading || settingsLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-white opacity-40" size={32} /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 pb-24">
      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Beni Ara · Bekliyor" value={callStats.pending} color="border-sky-500/20 bg-sky-500/5" />
        <StatCard label="Beni Ara · Toplam" value={callStats.total} sub={`Bugün: ${callStats.today}`} color="border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.02]" />
        <StatCard label="Ortaklık · Bekliyor" value={partnershipStats.pending} color="border-blue-500/20 bg-blue-500/5" />
        <StatCard label="Ortaklık · Toplam" value={partnershipStats.total} sub={`Bugün: ${partnershipStats.today}`} color="border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.02]" />
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setActiveTab('call'); setStatusFilter('all'); setSearchTerm(''); }}
          className={cn('px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all', activeTab === 'call' ? 'bg-sky-500 text-[#050609]' : 'bg-white/5 text-[color:var(--panel-muted,#8a919c)] hover:text-white')}
        >
          <Phone size={15} /> Beni Ara
          {callStats.pending > 0 && (
            <span className={cn('rounded-full text-xs font-semibold px-1.5 py-0.5 min-w-[20px] text-center', activeTab === 'call' ? 'bg-black/30 text-[#050609]' : 'bg-sky-500/20 text-sky-400')}>
              {callStats.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('partnership'); setStatusFilter('all'); setSearchTerm(''); }}
          className={cn('px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all', activeTab === 'partnership' ? 'bg-blue-500 text-white' : 'bg-white/5 text-[color:var(--panel-muted,#8a919c)] hover:text-white')}
        >
          <Handshake size={15} /> Ortaklık
          {partnershipStats.pending > 0 && (
            <span className={cn('rounded-full text-xs font-semibold px-1.5 py-0.5 min-w-[20px] text-center', activeTab === 'partnership' ? 'bg-black/20 text-white' : 'bg-blue-500/20 text-blue-400')}>
              {partnershipStats.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn('px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all', activeTab === 'settings' ? 'bg-[color:var(--panel-text,#f2f4f8)] text-[#050609]' : 'bg-white/5 text-[color:var(--panel-muted,#8a919c)] hover:text-white')}
        >
          <Settings size={15} /> Form Ayarları
        </button>
      </div>

      {/* List content */}
      {(activeTab === 'call' || activeTab === 'partnership') && (
        <div className="space-y-3">
          {/* Filter / search bar */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--panel-muted,#8a919c)]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Ara..."
                  className="bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg pl-8 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[color:var(--panel-border,rgba(242,244,248,0.1))] w-48"
                />
              </div>
              <div className="flex gap-1 bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg p-1">
                {(['all', 'pending', 'completed'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn('px-3 py-1 rounded-md text-xs font-bold transition-all', statusFilter === s ? 'bg-white/10 text-white' : 'text-[color:var(--panel-muted,#8a919c)] hover:text-white')}
                  >
                    {s === 'all' ? 'Tümü' : s === 'pending' ? 'Bekliyor' : 'Tamamlandı'}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                if (activeTab === 'call') {
                  exportCSV(filteredCalls, 'beni-ara-talepleri.csv', [
                    { key: 'createdAt', label: 'Tarih' },
                    { key: 'username', label: 'Kullanıcı' },
                    { key: 'phone', label: 'Telefon' },
                    { key: 'reason', label: 'Sebep' },
                    { key: 'status', label: 'Durum' },
                    { key: 'note', label: 'Not' },
                  ]);
                } else {
                  exportCSV(filteredPartnerships, 'ortaklik-basvurulari.csv', [
                    { key: 'createdAt', label: 'Tarih' },
                    { key: 'type', label: 'Tür' },
                    { key: 'contact', label: 'İletişim' },
                    { key: 'channelUrl', label: 'Kanal URL' },
                    { key: 'audienceSize', label: 'Kitle' },
                    { key: 'message', label: 'Mesaj' },
                    { key: 'status', label: 'Durum' },
                    { key: 'note', label: 'Not' },
                  ]);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[color:var(--panel-muted,#8a919c)] hover:text-white text-xs font-bold transition-colors"
            >
              <Download size={14} /> CSV İndir
            </button>
          </div>

          <div className="bg-[rgba(242,244,248,0.50)] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl overflow-hidden">
            {activeTab === 'call' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[color:var(--panel-muted,#8a919c)]">
                  <thead className="bg-black/20 text-xs uppercase font-semibold text-[color:var(--panel-muted,#8a919c)]">
                    <tr>
                      <th className="px-5 py-4">Tarih</th>
                      <th className="px-5 py-4">Kullanıcı</th>
                      <th className="px-5 py-4">Telefon</th>
                      <th className="px-5 py-4">Sebep</th>
                      <th className="px-5 py-4">Not</th>
                      <th className="px-5 py-4">Durum</th>
                      <th className="px-5 py-4 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredCalls.map((r: any) => (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-[color:var(--panel-muted,#8a919c)]">
                          {new Date(r.createdAt).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-white">{r.username}</td>
                        <td className="px-5 py-3.5 text-sky-400 font-medium">{r.phone}</td>
                        <td className="px-5 py-3.5 text-[color:var(--panel-text-dim,#c8cdd5)] max-w-[160px] truncate" title={r.reason}>{r.reason}</td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => setNoteModal({ collection: 'call', id: r.id, note: r.note || '', status: r.status })}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors',
                              r.note ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' : 'bg-white/5 text-[color:var(--panel-faint,#5c6470)] hover:text-[color:var(--panel-text-dim,#c8cdd5)] hover:bg-white/10'
                            )}
                            title={r.note || 'Not ekle'}
                          >
                            <StickyNote size={12} />
                            {r.note ? <span className="max-w-[80px] truncate">{r.note}</span> : 'Ekle'}
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
                            r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          )}>
                            {r.status === 'completed' ? <><CheckCircle size={11} /> İlgilenildi</> : <><Clock size={11} /> Bekliyor</>}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {r.status !== 'completed' && (
                              <button
                                onClick={() => handleMarkCompleted('call', r.id)}
                                disabled={updateMutation.isPending}
                                className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-[#050609] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                              >
                                İlgilenildi
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDelete({ collection: 'call', id: r.id })}
                              className="p-1.5 rounded-lg text-[color:var(--panel-faint,#5c6470)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredCalls.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-[color:var(--panel-faint,#5c6470)]">
                          <FileText size={32} className="mx-auto mb-2 opacity-30" />
                          Kayıt bulunamadı
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'partnership' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[color:var(--panel-muted,#8a919c)]">
                  <thead className="bg-black/20 text-xs uppercase font-semibold text-[color:var(--panel-muted,#8a919c)]">
                    <tr>
                      <th className="px-5 py-4">Tarih</th>
                      <th className="px-5 py-4">Tür & İletişim</th>
                      <th className="px-5 py-4">Kanal URL / Kitle</th>
                      <th className="px-5 py-4 max-w-xs">Mesaj</th>
                      <th className="px-5 py-4">Not</th>
                      <th className="px-5 py-4">Durum</th>
                      <th className="px-5 py-4 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredPartnerships.map((r: any) => (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-[color:var(--panel-muted,#8a919c)]">
                          {new Date(r.createdAt).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-blue-400 text-xs">{r.type}</div>
                          <div className="text-white text-sm mt-0.5">{r.contact}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <a href={r.channelUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline text-xs max-w-[140px] truncate block">{r.channelUrl}</a>
                          {r.audienceSize && <div className="text-xs text-[color:var(--panel-muted,#8a919c)] mt-0.5">Kitle: {r.audienceSize}</div>}
                        </td>
                        <td className="px-5 py-3.5 max-w-[140px] truncate text-xs" title={r.message}>{r.message || <span className="text-[color:var(--panel-faint,#5c6470)]">—</span>}</td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => setNoteModal({ collection: 'partnership', id: r.id, note: r.note || '', status: r.status })}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors',
                              r.note ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' : 'bg-white/5 text-[color:var(--panel-faint,#5c6470)] hover:text-[color:var(--panel-text-dim,#c8cdd5)] hover:bg-white/10'
                            )}
                            title={r.note || 'Not ekle'}
                          >
                            <StickyNote size={12} />
                            {r.note ? <span className="max-w-[80px] truncate">{r.note}</span> : 'Ekle'}
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
                            r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          )}>
                            {r.status === 'completed' ? <><CheckCircle size={11} /> Dönüş Yapıldı</> : <><Clock size={11} /> Bekliyor</>}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {r.status !== 'completed' && (
                              <button
                                onClick={() => handleMarkCompleted('partnership', r.id)}
                                disabled={updateMutation.isPending}
                                className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-[#050609] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                              >
                                Dönüş Yapıldı
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDelete({ collection: 'partnership', id: r.id })}
                              className="p-1.5 rounded-lg text-[color:var(--panel-faint,#5c6470)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredPartnerships.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-[color:var(--panel-faint,#5c6470)]">
                          <FileText size={32} className="mx-auto mb-2 opacity-30" />
                          Kayıt bulunamadı
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <div className="bg-[rgba(242,244,248,0.50)] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl p-6 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Beni Ara settings */}
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Phone size={17} className="text-sky-400" /> Beni Ara Formu
                </h3>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setCallActive(v => !v)}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors cursor-pointer',
                      callActive ? 'bg-sky-500' : 'bg-white/10'
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      callActive ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </div>
                  <span className="text-sm font-bold text-[color:var(--panel-muted,#8a919c)]">{callActive ? 'Aktif' : 'Pasif'}</span>
                </label>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest flex items-center gap-2">
                  <Type size={11} /> Form İçeriği
                </p>
                <div>
                  <label className="text-xs text-[color:var(--panel-muted,#8a919c)] mb-1 block">Başlık</label>
                  <input
                    type="text"
                    value={callTitle}
                    onChange={e => setCallTitle(e.target.value)}
                    className="w-full bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-[color:var(--panel-muted,#8a919c)] mb-1 block">Açıklama</label>
                  <textarea
                    value={callDescription}
                    onChange={e => setCallDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/40 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[color:var(--panel-muted,#8a919c)] mb-1 block">Buton Yazısı</label>
                    <input
                      type="text"
                      value={callButtonText}
                      onChange={e => setCallButtonText(e.target.value)}
                      className="w-full bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[color:var(--panel-muted,#8a919c)] mb-1 block">Başarı Mesajı</label>
                    <input
                      type="text"
                      value={callSuccessMessage}
                      onChange={e => setCallSuccessMessage(e.target.value)}
                      className="w-full bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/40"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block">
                  Aranma Sebepleri Seçenekleri
                </label>
                {callReasons.map((reason, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={reason}
                      onChange={e => {
                        const a = [...callReasons];
                        a[idx] = e.target.value;
                        setCallReasons(a);
                      }}
                      className="flex-1 bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/40"
                    />
                    <button
                      onClick={() => setCallReasons(callReasons.filter((_, i) => i !== idx))}
                      className="px-3 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setCallReasons([...callReasons, ''])}
                  className="w-full py-2 border border-dashed border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[color:var(--panel-muted,#8a919c)] hover:text-white hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all"
                >
                  <Plus size={15} /> Seçenek Ekle
                </button>
              </div>
            </div>

            {/* Ortaklık settings */}
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Handshake size={17} className="text-blue-400" /> Ortaklık Formu
                </h3>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setPartnershipActive(v => !v)}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors cursor-pointer',
                      partnershipActive ? 'bg-blue-500' : 'bg-white/10'
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      partnershipActive ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </div>
                  <span className="text-sm font-bold text-[color:var(--panel-muted,#8a919c)]">{partnershipActive ? 'Aktif' : 'Pasif'}</span>
                </label>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest flex items-center gap-2">
                  <Type size={11} /> Form İçeriği
                </p>
                <div>
                  <label className="text-xs text-[color:var(--panel-muted,#8a919c)] mb-1 block">Başlık</label>
                  <input
                    type="text"
                    value={partnershipTitle}
                    onChange={e => setPartnershipTitle(e.target.value)}
                    className="w-full bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-[color:var(--panel-muted,#8a919c)] mb-1 block">Açıklama</label>
                  <textarea
                    value={partnershipDescription}
                    onChange={e => setPartnershipDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[color:var(--panel-muted,#8a919c)] mb-1 block">Buton Yazısı</label>
                    <input
                      type="text"
                      value={partnershipButtonText}
                      onChange={e => setPartnershipButtonText(e.target.value)}
                      className="w-full bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[color:var(--panel-muted,#8a919c)] mb-1 block">Başarı Mesajı</label>
                    <input
                      type="text"
                      value={partnershipSuccessMessage}
                      onChange={e => setPartnershipSuccessMessage(e.target.value)}
                      className="w-full bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest block">
                  Başvuru Türleri
                </label>
                {partnershipTypes.map((type, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={type}
                      onChange={e => {
                        const a = [...partnershipTypes];
                        a[idx] = e.target.value;
                        setPartnershipTypes(a);
                      }}
                      className="flex-1 bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40"
                    />
                    <button
                      onClick={() => setPartnershipTypes(partnershipTypes.filter((_, i) => i !== idx))}
                      className="px-3 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setPartnershipTypes([...partnershipTypes, ''])}
                  className="w-full py-2 border border-dashed border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[color:var(--panel-muted,#8a919c)] hover:text-white hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all"
                >
                  <Plus size={15} /> Tür Ekle
                </button>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
              className="bg-emerald-500 hover:bg-emerald-400 text-[#050609] px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {updateSettingsMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Ayarları Kaydet
            </button>
          </div>
        </div>
      )}

      {/* Note modal */}
      {noteModal && (
        <NoteModal
          currentNote={noteModal.note}
          onClose={() => setNoteModal(null)}
          onSave={handleSaveNote}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0e1421] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl overflow-hidden shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Kaydı Sil</h3>
                  <p className="text-xs text-[color:var(--panel-muted,#8a919c)] mt-0.5">Bu işlem geri alınamaz.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2 rounded-lg bg-white/5 text-[color:var(--panel-muted,#8a919c)] hover:text-white text-sm font-bold transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={() => deleteMutation.mutate(confirmDelete)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
