import type { ApiResponse, TopCasinoGameItem } from '../types/dashboard';
import { Gamepad2 } from 'lucide-react';
import { EnIyiListe } from './EnIyiListe';

interface TopCasinoGamesProps {
  data: ApiResponse<TopCasinoGameItem[]> | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function TopCasinoGames({ data, isLoading, error }: TopCasinoGamesProps) {
  const rows = data?.Data ?? [];

  return (
    <EnIyiListe
      baslik="En çok ciro yapan kazino oyunları"
      ipucu="Seçili tarih aralığı"
      simge={<Gamepad2 size={16} />}
      vurgu="hacim"
      isLoading={isLoading}
      error={error}
      bosMesaj="Bu aralıkta kazino oyunu oynanmamış."
      satirlar={rows.map((r) => ({
        kimlik: r.GameId,
        ad: r.Name,
        ciro: r.Turnover,
        kazanc: r.WinningAmount,
        kar: r.ProfitAmount,
      }))}
    />
  );
}
