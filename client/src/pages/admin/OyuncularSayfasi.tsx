/**
 * OYUNCU LISTESI.
 *
 * Arama, BTag ve sayfa numarasi URL'de (`?arama=&btag=&sayfa=`).
 *
 * Once `App.tsx`'in state'indeydi; App hic sokulmedigi icin degerler
 * ekranlar arasinda duruyordu ama PAYLASILAMIYORDU — "su BTag'in 3.
 * sayfasina bak" demek icin adres yoktu. URL'de tutmak hem derin
 * baglantiyi hem geri/ileri tuslarini calistiriyor, hem de sayfa
 * sokuldugunde kaybolma sorununu ortadan kaldiriyor.
 */
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/client';
import { AllPlayersList } from '@/components/AllPlayersList';

const SAYFA_BASINA = 20;

export function OyuncularSayfasi() {
  const [params, setParams] = useSearchParams();

  const arama = params.get('arama') ?? '';
  const btag = params.get('btag') ?? '';
  const sayfa = Math.max(1, Number(params.get('sayfa')) || 1);

  /**
   * Bos degerler URL'e yazilmaz — `?arama=&btag=&sayfa=1` gurultusu
   * yerine temiz `/oyuncular` kalir. Filtre degisince sayfa 1'e doner.
   */
  const guncelle = (yama: { arama?: string; btag?: string; sayfa?: number }) => {
    setParams((oncekiler) => {
      const yeni = new URLSearchParams(oncekiler);
      for (const [anahtar, deger] of Object.entries(yama)) {
        const metin = String(deger ?? '');
        if (!metin || metin === '1') yeni.delete(anahtar);
        else yeni.set(anahtar, metin);
      }
      return yeni;
    }, { replace: true });
  };

  const oyuncular = useQuery({
    queryKey: ['clients', sayfa, arama, btag],
    queryFn: () => dashboardApi.clients({
      SkeepRows: (sayfa - 1) * SAYFA_BASINA,
      MaxRows: SAYFA_BASINA,
      Login: arama || undefined,
      BTag: btag || undefined,
    }),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <AllPlayersList
      data={oyuncular?.data}
      isLoading={oyuncular?.isLoading ?? false}
      error={oyuncular?.error ?? null}
      currentPage={sayfa}
      onPageChange={(s: number) => guncelle({ sayfa: s })}
      rowsPerPage={SAYFA_BASINA}
      searchTerm={arama}
      onSearchChange={(v: string) => guncelle({ arama: v, sayfa: 1 })}
      btagTerm={btag}
      onBTagChange={(v: string) => guncelle({ btag: v, sayfa: 1 })}
    />
  );
}
