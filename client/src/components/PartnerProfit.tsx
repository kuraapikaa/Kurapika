import type { ApiResponse, PartnerProfitData } from '../types/dashboard';
import { cn } from '../lib/utils';
import { AreaChart } from 'lucide-react';
import {
  PanoBaslik,
  PanoHucre,
  PanoHucreYazi,
  PanoKart,
  PanoSatir,
  PanoTablo,
  PanoYukleniyor,
  sayiYaz,
} from './ui/pano';

interface PartnerProfitProps {
  data: ApiResponse<PartnerProfitData> | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function PartnerProfit({ data, isLoading, error }: PartnerProfitProps) {
  if (error) return null;
  if (isLoading || !data?.Data) {
    return (
      <PanoKart vurgu="giris">
        <PanoBaslik baslik="Partner kâr detayları" simge={<AreaChart size={16} />} vurgu="giris" />
        <PanoYukleniyor satir={4} />
      </PanoKart>
    );
  }

  const d = data.Data;

  const olculer = [
    { etiket: 'Spor cirosu', deger: d.SportTurnover },
    { etiket: 'Spor kazancı', deger: d.SportWinning },
    { etiket: 'Casino cirosu', deger: d.CasinoTurnover },
    { etiket: 'Casino kazancı', deger: d.CasinoWinning },
    { etiket: 'Turnuva maliyeti', deger: d.TournamentCost },
    { etiket: 'Rake', deger: d.Rake },
    // Uc ayri olcu ARTIK AYRI; onceden biri digerinin yerine geciyordu.
    { etiket: 'Bonus bahis', deger: d.BonusBet },
    { etiket: 'Bonus ödemesi', deger: d.BonusPayout },
    { etiket: 'Freespin kazancı', deger: d.FreespinWin },
    { etiket: 'Cashback', deger: d.Cashback },
  ];

  const oyunTurleri = d.oyunTurleri ?? [];

  return (
    <PanoKart vurgu="giris">
      <PanoBaslik
        baslik="Partner kâr detayları"
        ipucu="Pano özeti + oyun türü raporu (1846)"
        simge={<AreaChart size={16} />}
        vurgu="giris"
      />

      <div className="p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
          {olculer.map(({ etiket, deger }) => (
            <PanoHucre key={etiket} etiket={etiket} deger={sayiYaz(deger, 'para')} veriYok={deger == null} />
          ))}
        </div>
      </div>

      {/*
        * Oyun türü kırılımı — rapor 1846. Önceden bu rapor yalnızca
        * casino/spor toplamlarını türetmek için okunuyor, satırların
        * kendisi hiç gösterilmiyordu.
        */}
      {oyunTurleri.length > 0 && (
        <div className="border-t border-white/5">
          <PanoTablo
            basliklar={[
              { ad: 'Oyun türü' },
              { ad: 'Bahis adedi', sag: true },
              { ad: 'Ciro', sag: true },
              { ad: 'Kazanç', sag: true },
              { ad: 'GGR', sag: true },
            ]}
          >
            {oyunTurleri.map((satir) => (
              <PanoSatir key={satir.tur}>
                <PanoHucreYazi guclu>{satir.tur}</PanoHucreYazi>
                <PanoHucreYazi sag>{sayiYaz(satir.bahisAdedi)}</PanoHucreYazi>
                <PanoHucreYazi sag>{sayiYaz(satir.ciro, 'para')}</PanoHucreYazi>
                <PanoHucreYazi sag renk="text-rose-300/80">{sayiYaz(satir.kazanc, 'para')}</PanoHucreYazi>
                <PanoHucreYazi sag>
                  <span className={cn('font-semibold', (satir.ggr ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                    {sayiYaz(satir.ggr, 'para')}
                  </span>
                </PanoHucreYazi>
              </PanoSatir>
            ))}
          </PanoTablo>
        </div>
      )}

      {d.oyunTuruKaynagi === 'alinamadi' && (
        <p className="border-t border-white/5 px-6 py-4 text-sm text-amber-300">
          Oyun türü raporu (1846) alınamadı. Casino ve spor toplamları pano özetinden türetildi.
        </p>
      )}
    </PanoKart>
  );
}
