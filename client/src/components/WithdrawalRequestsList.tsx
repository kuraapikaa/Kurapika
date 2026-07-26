import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { WithdrawalRequestItem, WithdrawalRequestsResponse } from '../types/dashboard';
import { formatNumber, formatDateTimeWithSeconds } from '../lib/format';
import { Card } from './ui/Card';
import { ErrorState } from './ui/ErrorState';
import { AlertCircle, Banknote, CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react';
import { dashboardApi } from '../api/client';

interface WithdrawalRequestsListProps {
  data: WithdrawalRequestsResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

type StatusTone = 'paid' | 'rejected' | 'pending' | 'neutral';

function statusTone(value: unknown): StatusTone {
  const status = String(value ?? '').toLocaleLowerCase('tr-TR');
  if (/ödendi|başarılı|success|paid|processed|işlendi/.test(status)) return 'paid';
  if (/reddedildi|başarısız|failed|reject|cancel|iptal/.test(status)) return 'rejected';
  if (/bekliyor|beklemede|pending|created|new|yeni|onay/.test(status)) return 'pending';
  return 'neutral';
}

function StatusBadge({ value }: { value: unknown }) {
  const tone = statusTone(value);
  const styles: Record<StatusTone, string> = {
    paid: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    pending: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    neutral: 'border-slate-600/40 bg-slate-700/20 text-slate-300',
  };
  const Icon = tone === 'paid' ? CheckCircle2 : tone === 'rejected' ? XCircle : Clock3;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold ${styles[tone]}`}>
      <Icon size={11} />
      {String(value || 'Bilinmiyor')}
    </span>
  );
}

function SummaryCard({ label, count, amount, tone }: { label: string; count: number; amount: number; tone: StatusTone }) {
  const accent = tone === 'paid' ? 'text-emerald-300' : tone === 'rejected' ? 'text-rose-300' : tone === 'pending' ? 'text-amber-200' : 'text-blue-300';
  return (
    <Card className="rounded-xl border-slate-700/60 bg-[#0d1119] p-4 shadow-none">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className={`text-xl font-bold tabular-nums ${accent}`}>{formatNumber(amount)} <span className="text-xs">TRY</span></p>
        <span className="rounded-md bg-white/[0.04] px-2 py-1 text-xs font-semibold text-slate-300">{count}</span>
      </div>
    </Card>
  );
}

export function WithdrawalRequestsList({ data, isLoading, error, onRetry }: WithdrawalRequestsListProps) {
  const navigate = useNavigate();

  const rejectMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number | string; amount: number }) =>
      dashboardApi.resolveWithdrawal(id, 'rejected', amount, 0),
    onSuccess: (res) => {
      if (res.HasError) {
        toast.error(res.AlertMessage || 'Çekim talebi reddedilemedi.');
        return;
      }
      toast.success('Çekim talebi reddedildi.');
      onRetry?.();
    },
    onError: () => toast.error('Çekim talebi reddedilemedi.'),
  });

  const handleReject = (row: WithdrawalRequestItem) => {
    const confirmed = window.confirm(
      `${row.ClientLogin || `#${row.ClientId}`} kullanıcısının ${formatNumber(Number(row.Amount || 0))} ${row.CurrencyId || 'TRY'} tutarındaki çekim talebini reddetmek istediğinize emin misiniz?`
    );
    if (!confirmed) return;
    rejectMutation.mutate({ id: row.Id, amount: Number(row.Amount || 0) });
  };

  if (error) return <ErrorState message={error.message} onRetry={onRetry} className="rounded-xl" />;
  if (data?.HasError) {
    return (
      <Card className="rounded-xl border-amber-400/20 bg-amber-400/[0.06] p-6 text-amber-200 shadow-none">
        <AlertCircle size={28} className="mb-3" />
        <h3 className="font-semibold">Çekim talepleri alınamadı</h3>
        <p className="mt-1 text-sm text-amber-100/70">{data.AlertMessage || 'Lynon isteği şu anda işlenemiyor.'}</p>
      </Card>
    );
  }

  const requests = [...(data?.Data?.ClientRequests ?? [])].sort((a, b) =>
    Date.parse(String(b.RequestTimeLocal ?? b.RequestTime ?? '')) - Date.parse(String(a.RequestTimeLocal ?? a.RequestTime ?? ''))
  );
  const byTone = (tone: StatusTone) => requests.filter(row => statusTone(row.StateName || row.State) === tone);
  const amountOf = (rows: WithdrawalRequestItem[]) => rows.reduce((sum, row) => sum + Number(row.Amount || 0), 0);
  const paid = byTone('paid');
  const rejected = byTone('rejected');
  const pending = byTone('pending');
  const totalAmount = Number(data?.Data?.TotalAmount ?? amountOf(requests));

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-700/60 bg-[#0d1119] p-5 shadow-none sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-400/10 text-blue-300">
            <Banknote size={19} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">Çekim talepleri</h2>
            <p className="mt-0.5 text-xs text-slate-500">Lynon ödeme hareketleri · seçili tarih aralığı</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Genel toplam</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-white">{formatNumber(totalAmount)} TRY <span className="ml-2 text-xs text-slate-500">· {requests.length} talep</span></p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Ödenen" count={paid.length} amount={amountOf(paid)} tone="paid" />
        <SummaryCard label="Bekleyen" count={pending.length} amount={amountOf(pending)} tone="pending" />
        <SummaryCard label="Reddedilen" count={rejected.length} amount={amountOf(rejected)} tone="rejected" />
      </div>

      <Card className="min-h-0 flex-1 overflow-hidden rounded-xl border-slate-700/60 bg-[#0d1119] p-0 shadow-none">
        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300/25 border-t-blue-300" />
              Lynon çekim talepleri yükleniyor…
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <Banknote size={34} className="text-slate-700" />
            <p className="mt-4 font-medium text-slate-300">Seçilen tarih aralığında çekim talebi yok.</p>
            <p className="mt-1 text-xs text-slate-600">Üstteki tarih filtresini genişleterek tekrar deneyebilirsiniz.</p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#090d14] text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Yöntem</th>
                  <th className="px-4 py-3">Referans</th>
                  <th className="px-4 py-3">Not / Red nedeni</th>
                  <th className="px-4 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(row => {
                  const reference = String(row.ReferenceNo ?? row.ExternalId ?? row.Id ?? '—');
                  const note = String(row.RejectReason || row.Notes || '—');
                  const isPending = statusTone(row.StateName || row.State) === 'pending';
                  const isRejectingThis = rejectMutation.isPending && rejectMutation.variables?.id === row.Id;
                  return (
                    <tr key={String(row.Id)} className="border-t border-slate-800/80 hover:bg-blue-400/[0.025]">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => row.ClientId && row.ClientLogin && navigate(`/oyuncu/${row.ClientId}/${row.ClientLogin}`)}
                          className="font-semibold text-blue-300 hover:text-blue-200 hover:underline"
                        >
                          {row.ClientLogin || `#${row.ClientId}`}
                        </button>
                        {row.ClientName ? <span className="mt-0.5 block text-[10px] text-slate-600">{row.ClientName}</span> : null}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-white">{formatNumber(Number(row.Amount || 0))} {row.CurrencyId || 'TRY'}</td>
                      <td className="px-4 py-3"><StatusBadge value={row.StateName || row.State} /></td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-400">{row.RequestTimeLocal || row.RequestTime ? formatDateTimeWithSeconds(String(row.RequestTimeLocal || row.RequestTime)) : '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{row.PaymentSystemName || '—'}</td>
                      <td className="max-w-[210px] truncate px-4 py-3 font-mono text-[10px] text-slate-500" title={reference}>{reference}</td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-slate-500" title={note}>{note}</td>
                      <td className="px-4 py-3">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => handleReject(row)}
                            disabled={isRejectingThis}
                            className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/20 bg-rose-400/10 px-2.5 py-1.5 text-[10px] font-bold text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-50"
                          >
                            {isRejectingThis ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                            Reddet
                          </button>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}