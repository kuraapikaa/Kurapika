import { useQueries } from '@tanstack/react-query';
import { dashboardApi, type DateRange } from '../api/client';

export function useDashboardData(dateRange: DateRange, options?: { enabled?: boolean }) {
  const [startDate, endDate] = [dateRange.startDate, dateRange.endDate];
  const enabled = (options?.enabled !== false) && Boolean(startDate && endDate);

  return useQueries({
    queries: [
      {
        queryKey: ['summary', startDate, endDate],
        queryFn: () => dashboardApi.summary(dateRange),
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      {
        queryKey: ['partner-profit', startDate, endDate],
        queryFn: () => dashboardApi.partnerProfit(dateRange),
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      {
        queryKey: ['top-sports', startDate, endDate],
        queryFn: () => dashboardApi.topSports(dateRange),
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      {
        queryKey: ['top-casino', startDate, endDate],
        queryFn: () => dashboardApi.topCasinoGames(dateRange),
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      {
        queryKey: ['sportbook-overview', startDate, endDate],
        queryFn: () => dashboardApi.sportbookOverview(dateRange),
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    ],
  });
}
