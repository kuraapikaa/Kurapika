/**
 * YATIRIMLAR. Tarih araligi ust bardan gelir.
 */
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/client';
import { DepositsList } from '@/components/DepositsList';
import { useDateRange } from '@/context/DateRangeContext';

export function YatirimlarSayfasi() {
  const { dateRange } = useDateRange();

  const yatirimlar = useQuery({
    queryKey: ['deposits', dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardApi.deposits(dateRange),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <DepositsList
      data={yatirimlar.data}
      isLoading={yatirimlar.isLoading}
      error={yatirimlar.error ?? null}
    />
  );
}
