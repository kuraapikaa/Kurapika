import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../api/client';
import type { PromoListItem } from '../../types/promos';

export interface UsePromosListResult {
  promotions: PromoListItem[];
  fetchedAt?: string;
  source?: string;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Fetches structured promo list from /api/promos/list. Returns empty list on 404 or error. */
export function usePromosList(): UsePromosListResult {
  const query = useQuery({
    queryKey: ['promos-list'],
    queryFn: async () => {
      try {
        const res = await dashboardApi.promosList();
        if (res.HasError || !res.Data) return { promotions: [], fetchedAt: undefined, source: undefined };
        return {
          promotions: res.Data.promotions ?? [],
          fetchedAt: res.Data.fetchedAt,
          source: res.Data.source,
        };
      } catch {
        return { promotions: [], fetchedAt: undefined, source: undefined };
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const data = query.data ?? { promotions: [], fetchedAt: undefined, source: undefined };
  return {
    promotions: data.promotions,
    fetchedAt: data.fetchedAt,
    source: data.source,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: () => query.refetch(),
  };
}
