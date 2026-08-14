/**
 * CEKIM TALEPLERI. Tarih araligi ust bardan gelir.
 */
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/client';
import { WithdrawalRequestsList } from '@/components/WithdrawalRequestsList';
import { useDateRange } from '@/context/DateRangeContext';

export function CekimTalepleriSayfasi() {
  const { dateRange } = useDateRange();

  const talepler = useQuery({
    queryKey: ['withdrawal-requests', dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardApi.withdrawalRequests(dateRange),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <WithdrawalRequestsList
      data={talepler.data}
      isLoading={talepler.isLoading}
      error={talepler.error ?? null}
      onRetry={() => talepler.refetch()}
    />
  );
}
