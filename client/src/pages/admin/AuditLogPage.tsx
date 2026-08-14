import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { FileText, RefreshCw } from 'lucide-react';
import { formatDateTimeWithSeconds } from '@/lib/format';

const ACTION_LABELS: Record<string, string> = {
  login: 'Giriş',
  logout: 'Çıkış',
  lead_create: 'Lead eklendi',
  lead_update: 'Lead güncellendi',
  lead_delete: 'Lead silindi',
  message_add: 'Mesaj eklendi',
  agent_create: 'Temsilci eklendi',
  agent_update: 'Temsilci güncellendi',
  agent_delete: 'Temsilci silindi',
};

export function AuditLogPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => adminApi.audit(500),
  });

  const entries = data?.data ?? [];

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Audit kaydı yüklenemedi'}
        onRetry={() => refetch()}
        className="rounded-2xl"
      />
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-semibold text-white">
            <span className="grid h-9 w-9 place-items-center rounded-2xl border border-purple-400/20 bg-purple-400/10">
              <FileText size={18} className="text-purple-300" />
            </span>
            Audit kaydı
          </h1>
          <p className="mt-1 text-sm text-slate-400">Giriş, lead ve temsilci işlemleri</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2 rounded-full" disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Yenile
        </Button>
      </header>

      <Card className="overflow-hidden rounded-2xl border-white/5 bg-white/[0.02] p-0 backdrop-blur-xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingState label="Yükleniyor..." />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-400">Henüz kayıt yok.</div>
        ) : (
          <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
            <table className="w-full bg-transparent text-left text-sm">
              {/* Yapisik zemin yerine cam: sticky baslik alttaki satirlari
                  bulaniklastirarak ustte kaliyor. */}
              <thead className="sticky top-0 border-b border-white/5 bg-[#0b0a10]/80 text-xs uppercase tracking-wider text-slate-500 backdrop-blur-xl">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tarih</th>
                  <th className="px-5 py-3 font-semibold">Kullanıcı</th>
                  <th className="px-5 py-3 font-semibold">Rol</th>
                  <th className="px-5 py-3 font-semibold">İşlem</th>
                  <th className="px-5 py-3 font-semibold">Kaynak</th>
                  <th className="px-5 py-3 font-semibold">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {entries.map((e, i) => (
                  <tr key={i} className="transition-colors hover:bg-white/5">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-400">{formatDateTimeWithSeconds(e.at)}</td>
                    <td className="px-5 py-3 font-medium text-white">{e.user}</td>
                    <td className="px-5 py-3 text-slate-400">{e.role}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold leading-none text-emerald-300">
                        {ACTION_LABELS[e.action] ?? e.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{e.resource ?? '–'}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-slate-400" title={e.detail}>{e.detail ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
