import type { ApiResponse, SportbookOverviewData } from '../types/dashboard';
import { cn } from '../lib/utils';
import { Activity, Radio } from 'lucide-react';
import {
  PanoBolum,
  PanoBos,
  PanoHata,
  PanoHucre,
  PanoHucreYazi,
  PanoKart,
  PanoBaslik,
  PanoSatir,
  PanoTablo,
  PanoYukleniyor,
  sayiYaz,
} from './ui/pano';

interface SportbookOverviewProps {
  data: ApiResponse<SportbookOverviewData> | undefined;
  isLoading: boolean;
  error: Error | null;
}

/** Canlı / maç öncesi ayrımı; rozet biçimi panonun geri kalanıyla aynı. */
function turRozeti(isLive: boolean | null) {
  const ortak = 'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]';
  if (isLive === true) {
    return <span className={cn(ortak, 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300')}><Radio size={10} /> Canlı</span>;
  }
  if (isLive === false) {
    return <span className={cn(ortak, 'border-sky-400/20 bg-sky-400/[0.08] text-sky-300')}>Maç öncesi</span>;
  }
  return <span className={cn(ortak, 'border-white/[0.08] bg-white/[0.04] text-slate-400')}>Toplam</span>;
}

const KUPON_ADI: Record<string, string> = {
  Single: 'Tekli',
  Multiple: 'Kombine',
  System: 'Sistem',
  Chain: 'Zincir',
};

export function SportbookOverview({ data, isLoading, error }: SportbookOverviewProps) {
  const details = data?.Data?.Details ?? [];
  const counts = data?.Data?.BetCountsPerType;

  return (
    <PanoKart vurgu="hacim">
      <PanoBaslik
        baslik="Spor kitabı özeti"
        ipucu="Canlı ve maç öncesi kırılımı"
        simge={<Activity size={16} />}
        vurgu="hacim"
      />

      {error && <PanoHata mesaj={error.message} />}
      {!error && isLoading && <PanoYukleniyor satir={4} />}

      {!error && !isLoading && details.length === 0 && <PanoBos>Bu aralıkta spor bahsi yok.</PanoBos>}

      {!error && !isLoading && details.length > 0 && (
        <PanoTablo
          basliklar={[
            { ad: 'Tür' },
            { ad: 'Ciro', sag: true },
            { ad: 'Kazanç', sag: true },
            { ad: 'Bahis sayısı', sag: true },
            { ad: 'GGR', sag: true },
            { ad: 'Marj', sag: true },
          ]}
          minGenislik={620}
        >
          {details.map((row, i) => (
            <PanoSatir key={i}>
              <PanoHucreYazi>{turRozeti(row.IsLive)}</PanoHucreYazi>
              <PanoHucreYazi sag>{sayiYaz(row.Turnover, 'para')}</PanoHucreYazi>
              <PanoHucreYazi sag renk="text-rose-300/80">{sayiYaz(row.WinningAmount, 'para')}</PanoHucreYazi>
              <PanoHucreYazi sag>{sayiYaz(row.NumberOfBets)}</PanoHucreYazi>
              <PanoHucreYazi sag guclu>{sayiYaz(row.GGR, 'para')}</PanoHucreYazi>
              <PanoHucreYazi sag>
                <span className={cn('font-semibold', (row.Profitness ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                  %{sayiYaz(row.Profitness)}
                </span>
              </PanoHucreYazi>
            </PanoSatir>
          ))}
        </PanoTablo>
      )}

      {!error && !isLoading && counts && Object.keys(counts).length > 0 && (
        <div className="border-t border-white/5 p-4">
          <PanoBolum baslik="Kupon türleri" vurgu="hacim" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
            {(['Single', 'Multiple', 'System', 'Chain'] as const).map((key) => (
              <PanoHucre
                key={key}
                etiket={KUPON_ADI[key]}
                deger={sayiYaz(counts[key])}
                veriYok={counts[key] == null}
              />
            ))}
          </div>
        </div>
      )}
    </PanoKart>
  );
}
