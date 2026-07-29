import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/client';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ErrorState } from './ui/ErrorState';
import { LoadingState } from './ui/LoadingState';
import { FileText, RefreshCw } from 'lucide-react';
import { formatDateTimeWithSeconds } from '../lib/format';

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
        className="rounded-xl"
      />
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={24} className="text-blue-500" />
            Audit kaydı
          </h1>
          <p className="text-xs text-[color:var(--panel-muted,#8a919c)] mt-1">Giriş, lead ve temsilci işlemleri</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2" disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Yenile
        </Button>
      </header>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingState label="Yükleniyor..." />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-20 text-center text-[color:var(--panel-muted,#8a919c)]">Henüz kayıt yok.</div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[rgba(242,244,248,0.60)] text-[10px] font-bold uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)] border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] sticky top-0">
                <tr>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">İşlem</th>
                  <th className="px-4 py-3">Kaynak</th>
                  <th className="px-4 py-3">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((e, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-[color:var(--panel-muted,#8a919c)] whitespace-nowrap">{formatDateTimeWithSeconds(e.at)}</td>
                    <td className="px-4 py-2 text-white">{e.user}</td>
                    <td className="px-4 py-2 text-[color:var(--panel-muted,#8a919c)]">{e.role}</td>
                    <td className="px-4 py-2 text-emerald-400">{ACTION_LABELS[e.action] ?? e.action}</td>
                    <td className="px-4 py-2 text-[color:var(--panel-muted,#8a919c)]">{e.resource ?? '–'}</td>
                    <td className="px-4 py-2 text-[color:var(--panel-muted,#8a919c)] max-w-xs truncate" title={e.detail}>{e.detail ?? '–'}</td>
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
