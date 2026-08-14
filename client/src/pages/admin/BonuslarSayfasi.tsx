/**
 * BONUS MERKEZI: aktif kampanyalar + free bet teklifleri.
 */
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/client';
import { BonusList } from '@/components/BonusList';
import { FreeBetBonusList } from '@/components/FreeBetBonusList';

export function BonuslarSayfasi() {
  const bonuslar = useQuery({
    queryKey: ['bonuses'],
    queryFn: () => dashboardApi.bonusesAll(),
    staleTime: 2 * 60 * 1000,
  });

  const freebet = useQuery({
    queryKey: ['freebet-bonuses'],
    queryFn: () => dashboardApi.freebetBonuses(),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <>
      <BonusList data={bonuslar?.data} isLoading={bonuslar?.isLoading ?? false} error={bonuslar?.error ?? null} />
      <FreeBetBonusList data={freebet?.data} isLoading={freebet?.isLoading ?? false} error={freebet?.error ?? null} />
    </>
  );
}
