/**
 * "En iyi …" listesi.
 *
 * `TopSports` ve `TopCasinoGames` aynı tabloyu iki kez yazıyordu: aynı
 * sütunlar (ad, ciro, kazanç, net kâr), aynı satır yapısı, farklı
 * dolgular ve farklı başlık biçimleri. İkisi de artık bunu kullanıyor;
 * panoda tek bir liste dili var.
 *
 * Sıra numarası YALNIZCA gerçekten sıralı listelerde gösterilir. Ciroya
 * göre sıralanan sporlarda sıra bilgi taşır; kazino oyunları listesinde
 * taşımıyordu ve orada numara koymak bilgiymiş gibi görünen bir süs olur.
 */
import { cn } from '../lib/utils';
import {
  PanoBos,
  PanoHata,
  PanoHucreYazi,
  PanoKart,
  PanoBaslik,
  PanoSatir,
  PanoTablo,
  PanoYukleniyor,
  sayiYaz,
  type PanoVurgu,
} from './ui/pano';

export interface EnIyiSatir {
  kimlik: string | number;
  ad: string;
  ciro: number | null;
  kazanc: number | null;
  kar: number | null;
}

export function EnIyiListe({
  baslik,
  ipucu,
  simge,
  vurgu = 'notr',
  satirlar,
  isLoading,
  error,
  siraliMi,
  bosMesaj,
}: {
  baslik: string;
  ipucu?: string;
  simge?: React.ReactNode;
  vurgu?: PanoVurgu;
  satirlar: EnIyiSatir[];
  isLoading: boolean;
  error: Error | null;
  /** Sıra numarası göster — liste gerçekten sıralıysa. */
  siraliMi?: boolean;
  bosMesaj: string;
}) {
  return (
    <PanoKart vurgu={vurgu}>
      <PanoBaslik baslik={baslik} ipucu={ipucu} simge={simge} vurgu={vurgu} />

      {error && <PanoHata mesaj={error.message} />}
      {!error && isLoading && <PanoYukleniyor satir={5} />}

      {!error && !isLoading && satirlar.length === 0 && <PanoBos>{bosMesaj}</PanoBos>}

      {!error && !isLoading && satirlar.length > 0 && (
        <PanoTablo
          basliklar={[
            { ad: baslik.includes('Spor') ? 'Spor branşı' : 'Oyun' },
            { ad: 'Ciro', sag: true },
            { ad: 'Kazanç', sag: true },
            { ad: 'Net kâr', sag: true },
          ]}
        >
          {satirlar.map((satir, i) => (
            <PanoSatir key={satir.kimlik}>
              <PanoHucreYazi>
                <span className="flex items-center gap-2.5">
                  {siraliMi && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[10px] font-semibold tabular-nums text-[color:var(--panel-muted,#8a919c)]">
                      {i + 1}
                    </span>
                  )}
                  <span className="font-semibold text-white">{satir.ad}</span>
                </span>
              </PanoHucreYazi>
              <PanoHucreYazi sag>{sayiYaz(satir.ciro, 'para')}</PanoHucreYazi>
              <PanoHucreYazi sag renk="text-rose-300/80">{sayiYaz(satir.kazanc, 'para')}</PanoHucreYazi>
              <PanoHucreYazi sag>
                <span className={cn('font-semibold', (satir.kar ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                  {sayiYaz(satir.kar, 'para')}
                </span>
              </PanoHucreYazi>
            </PanoSatir>
          ))}
        </PanoTablo>
      )}
    </PanoKart>
  );
}
