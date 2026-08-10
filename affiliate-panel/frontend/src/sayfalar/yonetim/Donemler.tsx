import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Card, Metric, Text } from '@tremor/react';
import { api, gunBicimi, paraBicimi, useVeri } from '../../api';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card as ShadCard, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { BosDurum, HataMesaji, Yukleniyor } from '../../components/durum';
import { agTemaAcik, agTemaKoyu } from '../../lib/agGrid';
import { useTema } from '../../lib/tema';

/**
 * DÖNEM HAKEDİŞİ — mali/hassas.
 *
 * Taslak dönem her açılışta yeniden hesaplanır — ölçümler gün içinde
 * güncellenir. Onaylandıktan sonra KESİNLEŞİR: ortağa söylenen rakamla
 * defterdeki rakam ayrışmasın diye. Devir zinciri yalnızca onaylanmış
 * dönemlerden okunur.
 *
 * ── "Dondurulur" yerine "kesinleşir" ──
 *
 * Eski dil ortakla paylaşılan ekranlarda ters okunuyordu: "dondurmak"
 * kazancın askıya alındığını ima ediyor, oysa anlam tam tersi — rakam
 * artık değişmez. Yönetim ekranında da aynı kelime kullanılıyor ki iki
 * taraf aynı şeyi aynı adıyla görsün.
 */

interface Hakedis {
  brutGelir: number;
  yonetimGideri: number;
  netGelir: number;
  hesapTabani: number;
  gelirPayi: number;
  cpaPayi: number;
  cpaHesaplanamadiSebebi: string | null;
  toplam: number;
  odenecek: number;
  sonrakiDevredenZarar: number;
  sonrakiDevredenOdeme: number;
}

interface Satirveri {
  ortakAnahtari: string;
  ortakAdi: string;
  planAdi: string | null;
  hakedis: Hakedis;
  kademeGeliri: number;
  odenecekToplam: number;
}

interface Donem {
  ay: string;
  durum: 'taslak' | 'onaylandi' | 'odendi';
  satirlar: Satirveri[];
  toplamOdenecek: number;
  hesaplandi: string;
  onaylandi: string | null;
  odendi: string | null;
  uyarilar: string[];
}

const BADGE_OLUMLU = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
const BADGE_UYARI = 'bg-amber-500/15 text-amber-600 dark:text-amber-400';

const DURUM_SINIFI = { taslak: BADGE_UYARI, onaylandi: BADGE_OLUMLU, odendi: BADGE_OLUMLU } as const;
const DURUM_ETIKETI = { taslak: 'Taslak', onaylandi: 'Kesinleşti', odendi: 'Ödendi' } as const;

function DurumRozeti({ durum }: { durum: Donem['durum'] }) {
  return <Badge variant="outline" className={DURUM_SINIFI[durum]}>{DURUM_ETIKETI[durum]}</Badge>;
}

function OrtakHucresi({ data }: ICellRendererParams<Satirveri>) {
  if (!data) return null;
  return (
    <div className="py-1">
      <div className="font-medium">{data.ortakAdi}</div>
      <code className="text-xs text-muted-foreground">{data.ortakAnahtari}</code>
    </div>
  );
}

function CpaHucresi({ data }: ICellRendererParams<Satirveri>) {
  if (!data) return null;
  return data.hakedis.cpaHesaplanamadiSebebi
    ? <span className="text-xs text-amber-600 dark:text-amber-400" title={data.hakedis.cpaHesaplanamadiSebebi}>ölçülemedi</span>
    : <span className="tabular-nums">{paraBicimi(data.hakedis.cpaPayi)}</span>;
}

const buAy = () => new Date().toISOString().slice(0, 7);

export function Donemler() {
  const [ay, setAy] = useState(buAy());
  const [koyu] = useTema();
  const liste = useVeri<{ donemler: Array<Omit<Donem, 'satirlar'>> }>('/api/yonetim/donemler');
  const [donem, setDonem] = useState<Donem | null>(null);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const calistir = async (is: () => Promise<Donem>) => {
    setIslemHatasi(null);
    setCalisiyor(true);
    try {
      setDonem(await is());
      liste.yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'İşlem başarısız.');
    } finally {
      setCalisiyor(false);
    }
  };

  const sutunlar = useMemo<ColDef<Satirveri>[]>(() => [
    { headerName: 'Ortak', minWidth: 200, cellRenderer: OrtakHucresi, filterValueGetter: (p) => `${p.data?.ortakAdi ?? ''} ${p.data?.ortakAnahtari ?? ''}` },
    { field: 'planAdi', headerName: 'Plan', width: 140, valueFormatter: (p) => p.value ?? '—' },
    {
      headerName: 'Brüt', width: 120, type: 'rightAligned',
      valueGetter: (p) => p.data?.hakedis.brutGelir ?? 0, valueFormatter: (p) => paraBicimi(p.value),
    },
    {
      headerName: 'Net', width: 120, type: 'rightAligned',
      valueGetter: (p) => p.data?.hakedis.netGelir ?? 0, valueFormatter: (p) => paraBicimi(p.value),
    },
    {
      headerName: 'Taban', width: 120, type: 'rightAligned',
      valueGetter: (p) => p.data?.hakedis.hesapTabani ?? 0, valueFormatter: (p) => paraBicimi(p.value),
    },
    {
      headerName: 'Gelir payı', width: 130, type: 'rightAligned',
      valueGetter: (p) => p.data?.hakedis.gelirPayi ?? 0, valueFormatter: (p) => paraBicimi(p.value),
    },
    {
      headerName: 'CPA', width: 120, type: 'rightAligned', sortable: false, cellRenderer: CpaHucresi,
      valueGetter: (p) => p.data?.hakedis.cpaPayi ?? 0,
    },
    {
      headerName: 'Kademe', width: 120, type: 'rightAligned',
      valueGetter: (p) => p.data?.kademeGeliri ?? 0, valueFormatter: (p) => paraBicimi(p.value),
    },
    {
      headerName: 'Ödenecek', width: 130, type: 'rightAligned', sortable: false,
      valueGetter: (p) => p.data?.odenecekToplam ?? 0,
      cellRenderer: (p: ICellRendererParams<Satirveri, number>) => <strong className="tabular-nums">{paraBicimi(p.value ?? 0)}</strong>,
    },
  ], []);

  if (liste.yukleniyor) return <Yukleniyor satir={6} />;

  return (
    <>
      <ShadCard>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Dönem hesapla</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Taslak dönem her açılışta yeniden hesaplanır — ölçümler gün içinde güncellenir. Onaylandıktan
            sonra <strong>kesinleşir</strong>: ortağa söylenen rakamla defterdeki rakam ayrışmasın diye.
            Devir zinciri yalnızca onaylanmış dönemlerden okunur.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Ay</span>
              <Input type="month" className="h-10 w-auto" value={ay} onChange={(e) => setAy(e.target.value)} />
            </label>
            <Button disabled={calisiyor} onClick={() => calistir(() => api.gonder<Donem>(`/api/yonetim/donemler/${ay}/hesapla`))}>
              Hesapla
            </Button>
            <Button variant="outline" disabled={calisiyor} onClick={() => calistir(() => api.al<Donem>(`/api/yonetim/donemler/${ay}`))}>
              Getir
            </Button>
          </div>
        </CardContent>
      </ShadCard>

      {(islemHatasi || liste.hata) && <HataMesaji mesaj={islemHatasi ?? liste.hata!} />}

      {donem && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <Text>Dönem</Text>
              <Metric>{donem.ay}</Metric>
              <Text className="mt-1 text-xs">{DURUM_ETIKETI[donem.durum]}</Text>
            </Card>
            <Card>
              <Text>Ortak</Text>
              <Metric>{donem.satirlar.length}</Metric>
            </Card>
            <Card>
              <Text>Toplam ödenecek</Text>
              <Metric>{paraBicimi(donem.toplamOdenecek)}</Metric>
            </Card>
            <Card>
              <Text>Hesaplandı</Text>
              <Metric className="text-lg">{gunBicimi(donem.hesaplandi)}</Metric>
            </Card>
          </div>

          {donem.uyarilar.length > 0 && (
            <Alert className={`${BADGE_UYARI} border-amber-500/50`}>
              <AlertDescription>
                <p className="mb-1 font-semibold">Uyarılar</p>
                <ul className="space-y-1 text-sm">
                  {donem.uyarilar.map((u) => <li key={u}>• {u}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <ShadCard>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{donem.ay} hakedişi</CardTitle>
              <div className="flex items-center gap-2">
                <DurumRozeti durum={donem.durum} />
                {donem.durum === 'taslak' && (
                  <Button
                    disabled={calisiyor}
                    onClick={() => {
                      // Onay GERI ALINAMAZ: rakam kesinlesir ve devir
                      // zinciri bu donemden okunmaya baslar. Tek tikla
                      // yapilacak bir is degil.
                      if (window.confirm(
                        `${donem.ay} dönemi onaylanıp kesinleşecek: ${paraBicimi(donem.toplamOdenecek)}. `
                        + 'Onaydan sonra rakam değiştirilemez ve ortakların paneline yazılır. Devam edilsin mi?',
                      )) {
                        calistir(() => api.gonder<Donem>(`/api/yonetim/donemler/${donem.ay}/onayla`));
                      }
                    }}
                  >
                    Onayla ve kesinleştir
                  </Button>
                )}
                {donem.durum === 'onaylandi' && (
                  <Button disabled={calisiyor} onClick={() => calistir(() => api.gonder<Donem>(`/api/yonetim/donemler/${donem.ay}/odendi`))}>
                    Ödendi işaretle
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {donem.satirlar.length === 0 ? (
                <BosDurum mesaj="Bu dönemde hesaplanan ortak yok. Onaylı ortak ve komisyon planı gerekiyor." />
              ) : (
                <div style={{ height: 420 }}>
                  <AgGridReact
                    theme={koyu ? agTemaKoyu : agTemaAcik}
                    rowData={donem.satirlar}
                    columnDefs={sutunlar}
                    defaultColDef={{ sortable: true, resizable: true }}
                    pagination
                    paginationPageSize={15}
                    paginationPageSizeSelector={false}
                  />
                </div>
              )}
            </CardContent>
          </ShadCard>
        </>
      )}

      <ShadCard>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Dönem geçmişi</CardTitle></CardHeader>
        <CardContent>
          {(liste.veri?.donemler ?? []).length === 0 ? (
            <BosDurum mesaj="Henüz hesaplanmış dönem yok." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ay</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                  <TableHead>Hesaplandı</TableHead>
                  <TableHead>Onaylandı</TableHead>
                  <TableHead>Ödendi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.veri!.donemler.map((d) => (
                  <TableRow key={d.ay}>
                    <TableCell>
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={() => { setAy(d.ay); calistir(() => api.al<Donem>(`/api/yonetim/donemler/${d.ay}`)); }}
                      >
                        {d.ay}
                      </button>
                    </TableCell>
                    <TableCell><DurumRozeti durum={d.durum} /></TableCell>
                    <TableCell className="text-right tabular-nums">{paraBicimi(d.toplamOdenecek)}</TableCell>
                    <TableCell className="text-xs">{gunBicimi(d.hesaplandi)}</TableCell>
                    <TableCell className="text-xs">{gunBicimi(d.onaylandi)}</TableCell>
                    <TableCell className="text-xs">{gunBicimi(d.odendi)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </ShadCard>
    </>
  );
}
