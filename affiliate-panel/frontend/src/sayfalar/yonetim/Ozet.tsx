import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { AreaChart, BarList, Card, Metric, SparkAreaChart, Text } from '@tremor/react';
import { api, paraBicimi, useVeri } from '../../api';
import { Button } from '../../components/ui/button';
import { Card as ShadCard, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { BosDurum, HataMesaji, Yukleniyor } from '../../components/durum';
import { agTemaAcik, agTemaKoyu } from '../../lib/agGrid';
import { useTema } from '../../lib/tema';

interface OrtakOzeti {
  ortakAnahtari: string;
  gunSayisi: number;
  oyuncuSayisi: number;
  aktifOyuncuSayisi: number;
  yatirim: number;
  cekim: number;
  ggr: number;
  ftdSayisi: number | null;
  gunlukGgr: Array<{ gun: string; ggr: number }>;
}

interface SenkronSonucu {
  cekilenGun: number;
  yazilanOlcum: number;
  hatali: Array<{ gun: string; mesaj: string }>;
  uyari: string | null;
}

interface GecmisGGRSonucu {
  tarananGun: number;
  eslesenOyuncuGunu: number;
  yazilanOlcum: number;
  hatali: Array<{ gun: string; mesaj: string }>;
  uyari: string | null;
}

/** Tablo hücresindeki eğilim sütunu — günlük GGR'nin küçük bir alan grafiği. */
function EgilimHucresi({ value }: ICellRendererParams<OrtakOzeti, OrtakOzeti['gunlukGgr']>) {
  const noktalar = value ?? [];
  if (noktalar.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <SparkAreaChart
      data={noktalar}
      index="gun"
      categories={['ggr']}
      colors={['blue']}
      className="mt-1.5 h-7 w-24"
    />
  );
}

export function Ozet() {
  const { veri, yukleniyor, hata, yenile } = useVeri<{ bugun: string; ozetler: OrtakOzeti[] }>('/api/yonetim/ozet');
  const [koyu] = useTema();
  const [senkron, setSenkron] = useState<SenkronSonucu | null>(null);
  const [senkronHatasi, setSenkronHatasi] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [gecmis, setGecmis] = useState<GecmisGGRSonucu | null>(null);
  const [gecmisHatasi, setGecmisHatasi] = useState<string | null>(null);
  const [gecmisCalisiyor, setGecmisCalisiyor] = useState(false);

  const sutunlar = useMemo<ColDef<OrtakOzeti>[]>(() => [
    { field: 'ortakAnahtari', headerName: 'Ortak', pinned: 'left', minWidth: 150, cellClass: 'font-medium' },
    { field: 'gunSayisi', headerName: 'Gün', type: 'numericColumn', width: 90 },
    { field: 'oyuncuSayisi', headerName: 'Oyuncu', type: 'numericColumn', width: 100 },
    { field: 'aktifOyuncuSayisi', headerName: 'Aktif', type: 'numericColumn', width: 90 },
    { field: 'yatirim', headerName: 'Yatırım', type: 'numericColumn', width: 130, valueFormatter: (p) => paraBicimi(p.value ?? 0) },
    { field: 'cekim', headerName: 'Çekim', type: 'numericColumn', width: 130, valueFormatter: (p) => paraBicimi(p.value ?? 0) },
    { field: 'ggr', headerName: 'GGR', type: 'numericColumn', width: 130, sort: 'desc', valueFormatter: (p) => paraBicimi(p.value ?? 0) },
    { field: 'gunlukGgr', headerName: 'Eğilim', width: 150, sortable: false, filter: false, cellRenderer: EgilimHucresi },
  ], []);

  const senkronla = async () => {
    setCalisiyor(true);
    setSenkronHatasi(null);
    try {
      setSenkron(await api.gonder<SenkronSonucu>('/api/yonetim/senkron'));
      yenile();
    } catch (h) {
      setSenkronHatasi(h instanceof Error ? h.message : 'Senkron başarısız.');
    } finally {
      setCalisiyor(false);
    }
  };

  const gecmisiDoldur = async () => {
    setGecmisCalisiyor(true);
    setGecmisHatasi(null);
    try {
      setGecmis(await api.gonder<GecmisGGRSonucu>('/api/yonetim/gecmis-ggr-doldur'));
      yenile();
    } catch (h) {
      setGecmisHatasi(h instanceof Error ? h.message : 'Geçmiş doldurma başarısız.');
    } finally {
      setGecmisCalisiyor(false);
    }
  };

  if (yukleniyor) return <Yukleniyor satir={5} />;
  if (hata) return <HataMesaji mesaj={hata} />;

  const ozetler = veri?.ozetler ?? [];
  const topla = (secici: (o: OrtakOzeti) => number) => ozetler.reduce((t, o) => t + secici(o), 0);
  // FTD hicbir ortakta olculmediyse `null`; sifir yazmak "hic ilk yatirim
  // olmadi" demek olurdu, oysa dogrusu "bu baglantidan olculemiyor".
  const ftdToplami = ozetler.some((o) => o.ftdSayisi !== null)
    ? topla((o) => o.ftdSayisi ?? 0)
    : null;

  // Tum ortaklarin gunluk GGR'si gune gore toplaniyor: tek tek serileri
  // ust uste cizmek 20 ortakta okunamaz hale gelir.
  const gunHaritasi = new Map<string, number>();
  for (const o of ozetler) {
    for (const g of o.gunlukGgr) gunHaritasi.set(g.gun, (gunHaritasi.get(g.gun) ?? 0) + g.ggr);
  }
  const gunlukToplam = [...gunHaritasi.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([gun, ggr]) => ({ gun: gun.slice(5), GGR: Math.round(ggr) }));

  const ortakSiralamasi = ozetler
    .slice()
    .sort((a, b) => b.ggr - a.ggr)
    .slice(0, 8)
    .map((o) => ({ name: o.ortakAnahtari, value: Math.round(o.ggr) }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <Text>Ortak</Text>
          <Metric>{ozetler.length}</Metric>
          <Text className="mt-1 text-xs">ölçümü olan</Text>
        </Card>
        <Card>
          <Text>Yatırım</Text>
          <Metric>{paraBicimi(topla((o) => o.yatirim))}</Metric>
        </Card>
        <Card>
          <Text>GGR</Text>
          <Metric>{paraBicimi(topla((o) => o.ggr))}</Metric>
        </Card>
        <Card>
          <Text>İlk yatırım</Text>
          <Metric>{ftdToplami === null ? '—' : ftdToplami}</Metric>
          {ftdToplami === null && <Text className="mt-1 text-xs">bu bağlantıdan ölçülemiyor</Text>}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <Text className="font-medium text-foreground">Toplam günlük GGR</Text>
          {gunlukToplam.length === 0 ? (
            <div className="flex h-44 items-center justify-center">
              <Text>Ölçüm yok.</Text>
            </div>
          ) : (
            <AreaChart
              className="mt-4 h-44"
              data={gunlukToplam}
              index="gun"
              categories={['GGR']}
              colors={['blue']}
              valueFormatter={(v) => paraBicimi(v)}
              showLegend={false}
            />
          )}
        </Card>
        <Card>
          <Text className="font-medium text-foreground">Ortak bazında GGR</Text>
          {ortakSiralamasi.length === 0 ? (
            <div className="flex h-44 items-center justify-center">
              <Text>Ölçüm yok.</Text>
            </div>
          ) : (
            <BarList data={ortakSiralamasi} color="blue" valueFormatter={paraBicimi} className="mt-4" />
          )}
        </Card>
      </div>

      <ShadCard>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ortak performansı</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={senkronla} disabled={calisiyor}>
              {calisiyor ? 'Çekiliyor…' : 'Backoffice’ten çek'}
            </Button>
            <Button variant="outline" size="sm" onClick={gecmisiDoldur} disabled={gecmisCalisiyor}>
              {gecmisCalisiyor ? 'Dolduruluyor…' : 'Geçmiş GGR’yi doldur'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {senkronHatasi && <div className="mb-3"><HataMesaji mesaj={senkronHatasi} /></div>}
          {senkron && (
            <p className="mb-3 text-sm text-muted-foreground">
              {senkron.cekilenGun} gün çekildi, {senkron.yazilanOlcum} ölçüm yazıldı.
              {senkron.hatali.length > 0 && ` ${senkron.hatali.length} gün alınamadı.`}
              {senkron.uyari && ` ${senkron.uyari}`}
            </p>
          )}
          {gecmisHatasi && <div className="mb-3"><HataMesaji mesaj={gecmisHatasi} /></div>}
          {gecmis && (
            <p className="mb-3 text-sm text-muted-foreground">
              {gecmis.tarananGun} gün tarandı, {gecmis.eslesenOyuncuGunu} eşleşen oyuncu günü, {gecmis.yazilanOlcum} ölçüm yazıldı.
              {gecmis.hatali.length > 0 && ` ${gecmis.hatali.length} gün alınamadı.`}
              {gecmis.uyari && ` ${gecmis.uyari}`}
            </p>
          )}

          {ozetler.length === 0 ? (
            <BosDurum mesaj="Henüz ölçüm yok. Backoffice bağlantısını kurup çekmeyi deneyin." />
          ) : (
            <div style={{ height: 420 }}>
              <AgGridReact
                theme={koyu ? agTemaKoyu : agTemaAcik}
                rowData={ozetler}
                columnDefs={sutunlar}
                defaultColDef={{ sortable: true, resizable: true }}
                pagination
                paginationPageSize={10}
                paginationPageSizeSelector={false}
              />
            </div>
          )}
        </CardContent>
      </ShadCard>
    </>
  );
}
