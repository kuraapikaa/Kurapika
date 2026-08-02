import type { ApiResponse, TopSportItem } from '../types/dashboard';
import { Trophy } from 'lucide-react';
import { EnIyiListe } from './EnIyiListe';

interface TopSportsProps {
  data: ApiResponse<TopSportItem[]> | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function TopSports({ data, isLoading, error }: TopSportsProps) {
  const rows = data?.Data ?? [];

  return (
    <EnIyiListe
      baslik="En çok ciro yapan spor branşları"
      ipucu="Seçili tarih aralığı"
      simge={<Trophy size={16} />}
      vurgu="maliyet"
      // Ciroya gore sirali; numara burada bilgi tasiyor.
      siraliMi
      isLoading={isLoading}
      error={error}
      bosMesaj="Bu aralıkta spor bahsi yok."
      satirlar={rows.map((r) => ({
        kimlik: r.SportId,
        ad: r.Name,
        ciro: r.Turnover,
        kazanc: r.WinningAmount,
        kar: r.ProfitAmount,
      }))}
    />
  );
}
