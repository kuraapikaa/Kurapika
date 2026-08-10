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
import { DIKEY_ETIKETI, type Dikey } from '../../dikey-gorunum';

/**
 * YÖNETİM ÖZETİ — program geneli.
 *
 * ── Bu sürümde iki değişiklik ──
 *
 * 1. GRAFİK RENKLERİ. Tremor serileri `violet` ile çiziliyordu; bu
 *    menekşe kimlikten kalan bir artıktı ve altın/gümüş paletin yanında
 *    ekranın en dikkat çeken öğesi yanlış renkteydi. Casino `amber`
 *    (altın ailesinin Tremor karşılığı), spor `slate` (gümüş) —
 *    paletin iş bölümüyle aynı: altın para, gümüş ikincil.
 *
 *    Tremor renk adlarını Tailwind paletinden alıyor; CSS değişkeni
 *    kabul etmiyor. Bu yüzden `var(--tayf-3)` yerine ona en yakın
 *    adlandırılmış renk kullanılıyor — grafikler tema değiştiğinde
 *    kendi açık/koyu varyantlarına Tremor tarafından geçiriliyor.
 *
 * 2. CASINO / SPOR KOLONLARI. Tablo tek bir GGR taşıyordu; iki dikey
 *    ayrı oranlarla ödendiği için yöneticinin en çok ihtiyaç duyduğu
 *    kırılım buydu. Kolonlar `dikeyler` alanı geldiğinde görünüyor,
 *    yoksa hiç eklenmiyor — boş bir kolon "veri yok" değil "sıfır" gibi
 *    okunurdu.
 */

interface DikeyOzeti {
  dikey: Dikey;
  gunSayisi: number;
  oyuncuSayisi: number;
  aktifOyuncuSayisi: number;
  yatirim: number;
  cekim: number;
  ggr: number;
  ftdSayisi: number | null;
}

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
  /** Dikey kırılımı; backend göçünden sonra dolu. */
  dikeyler?: DikeyOzeti[];
  gunlukDikeyGgr?: Array<{ gun: string; dikey: Dikey; ggr: number }>;
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

interface OrtakPlanBilgisi {
  ortakAnahtari: string;
  planId: string | null;
}

interface Plan {
  id: string;
  ad: string;
}

interface Bakiye {
  bakiye: number;
}

/** Bir ortağın belirli dikeydeki GGR'si; kolon değeri olarak kullanılıyor. */
const dikeyGgr = (o: OrtakOzeti, d: Dikey): number | null => {
  const satir = o.dikeyler?.find((x) => x.dikey === d);
  // Kayit YOKSA null: 0 yazmak "o dikeyde trafik denendi ve kazandirmadi"
  // gibi okunur, oysa dogrusu "o dikeyde hic olcum yok".
  return satir ? satir.ggr : null;
};

/** Tablo hücresindeki eğilim sütunu — günlük GGR'nin küçük bir alan grafiği. */
function EgilimHucresi({ value }: ICellRendererParams<OrtakOzeti, OrtakOzeti['gunlukGgr']>) {
  const noktalar = value ?? [];
  if (noktalar.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <SparkAreaChart
      data={noktalar}
      index="gun"
      categories={['ggr']}
      colors={['amber']}
      className="mt-1.5 h-7 w-24"
    />
  );
}

export function Ozet() {
  const { veri, yukleniyor, hata, yenile } = useVeri<{ bugun: string; ozetler: OrtakOzeti[] }>('/api/yonetim/ozet');
  // Plan adini kolonda gostermek icin: ozet ucu plan tasimiyor (olcum
  // verisi), ortak kaydi tasiyor. Ayri bir ucta cakmak yerine burada
  // birlestiriyoruz -- ikisi de zaten baska ekranlarda cekilen ucular.
  const { veri: ortakVeri } = useVeri<{ ortaklar: OrtakPlanBilgisi[] }>('/api/yonetim/ortaklar');
  const { veri: planVeri } = useVeri<{ planlar: Plan[] }>('/api/yonetim/planlar');
  // Komisyon KPI'si icin: cuzdan zaten butun ortaklarin bakiyesini
  // topluyor, ayri bir toplama ucu gerekmiyor. Veritabani yoksa (yerel
  // gelistirme) `bakiyeler` bos donuyor, KPI sessizce "—" gosteriyor.
  const { veri: cuzdanVeri } = useVeri<{ bakiyeler: Bakiye[]; veritabaniVarMi: boolean }>('/api/yonetim/cuzdanlar');
  const [koyu] = useTema();
  const [senkron, setSenkron] = useState<SenkronSonucu | null>(null);
  const [senkronHatasi, setSenkronHatasi] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [gecmis, setGecmis] = useState<GecmisGGRSonucu | null>(null);
  const [gecmisHatasi, setGecmisHatasi] = useState<string | null>(null);
  const [gecmisCalisiyor, setGecmisCalisiyor] = useState(false);

  const ozetler = veri?.ozetler ?? [];
  // Dikey kolonlari YALNIZCA veri varsa: bos kolon eklemek, olculmeyeni
  // sifir gibi gostermek olur.
  const dikeyVar = ozetler.some((o) => (o.dikeyler?.length ?? 0) > 0);

  const planAdiHaritasi = useMemo(() => {
    const planlar = new Map((planVeri?.planlar ?? []).map((p) => [p.id, p.ad]));
    const harita = new Map<string, string>();
    for (const o of ortakVeri?.ortaklar ?? []) {
      harita.set(o.ortakAnahtari, o.planId ? (planlar.get(o.planId) ?? '—') : 'Varsayılan');
    }
    return harita;
  }, [ortakVeri, planVeri]);

  const sutunlar = useMemo<ColDef<OrtakOzeti>[]>(() => {
    const temel: ColDef<OrtakOzeti>[] = [
      { field: 'ortakAnahtari', headerName: 'Ortak', pinned: 'left', minWidth: 150, cellClass: 'font-medium' },
      { field: 'gunSayisi', headerName: 'Gün', type: 'numericColumn', width: 90 },
      { field: 'oyuncuSayisi', headerName: 'Oyuncu', type: 'numericColumn', width: 100 },
      { field: 'aktifOyuncuSayisi', headerName: 'Aktif', type: 'numericColumn', width: 90 },
      {
        colId: 'ftd',
        headerName: 'FTD',
        type: 'numericColumn',
        width: 90,
        valueGetter: (p) => p.data?.ftdSayisi ?? null,
        // `null` icin tire; 0 ile ayni gorunmesi "hic ilk yatirim yok"
        // ile "olculemiyor"u ayni gostermek olur (bkz. ustteki KPI kartinin
        // ayni ayrimi).
        valueFormatter: (p) => (p.value === null || p.value === undefined ? '—' : String(p.value)),
      },
      { field: 'yatirim', headerName: 'Yatırım', type: 'numericColumn', width: 130, valueFormatter: (p) => paraBicimi(p.value ?? 0) },
      { field: 'cekim', headerName: 'Çekim', type: 'numericColumn', width: 130, valueFormatter: (p) => paraBicimi(p.value ?? 0) },
    ];

    const dikeySutunlari: ColDef<OrtakOzeti>[] = dikeyVar
      ? (['casino', 'spor'] as const).map((d) => ({
        colId: `ggr-${d}`,
        headerName: `${DIKEY_ETIKETI[d]} GGR`,
        type: 'numericColumn',
        width: 140,
        valueGetter: (p) => (p.data ? dikeyGgr(p.data, d) : null),
        // `null` icin tire; 0 ile ayni gorunmesi olcum eksikligini gizler.
        valueFormatter: (p) => (p.value === null || p.value === undefined ? '—' : paraBicimi(p.value)),
      }))
      : [];

    return [
      ...temel,
      ...dikeySutunlari,
      { field: 'ggr', headerName: 'Toplam GGR', type: 'numericColumn', width: 140, sort: 'desc', valueFormatter: (p) => paraBicimi(p.value ?? 0) },
      {
        colId: 'plan',
        headerName: 'Plan',
        width: 140,
        valueGetter: (p) => (p.data ? planAdiHaritasi.get(p.data.ortakAnahtari) ?? '—' : '—'),
      },
      { field: 'gunlukGgr', headerName: 'Eğilim', width: 150, sortable: false, filter: false, cellRenderer: EgilimHucresi },
    ];
  }, [dikeyVar, planAdiHaritasi]);

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

  // Dikey serisi varsa grafik IKI kategoriye ayriliyor. Toplami da
  // ciziyor olsaydik ucuncu bir cizgi iki serinin uzerine binerdi;
  // toplam zaten ust seritteki kartta yaziyor.
  const dikeyGunHaritasi = new Map<string, { casino: number; spor: number }>();
  for (const o of ozetler) {
    for (const g of o.gunlukDikeyGgr ?? []) {
      const m = dikeyGunHaritasi.get(g.gun) ?? { casino: 0, spor: 0 };
      if (g.dikey === 'casino') m.casino += g.ggr;
      else if (g.dikey === 'spor') m.spor += g.ggr;
      dikeyGunHaritasi.set(g.gun, m);
    }
  }
  const dikeySeri = dikeyGunHaritasi.size > 0;

  const gunlukToplam = dikeySeri
    ? [...dikeyGunHaritasi.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([gun, m]) => ({ gun: gun.slice(5), Casino: Math.round(m.casino), Spor: Math.round(m.spor) }))
    : [...gunHaritasi.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([gun, ggr]) => ({ gun: gun.slice(5), GGR: Math.round(ggr) }));

  const ortakSiralamasi = ozetler
    .slice()
    .sort((a, b) => b.ggr - a.ggr)
    .slice(0, 8)
    .map((o) => ({ name: o.ortakAnahtari, value: Math.round(o.ggr) }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
          {dikeyVar && (
            <Text className="mt-1 text-xs">
              Casino {paraBicimi(topla((o) => dikeyGgr(o, 'casino') ?? 0))}
              {' · '}
              Spor {paraBicimi(topla((o) => dikeyGgr(o, 'spor') ?? 0))}
            </Text>
          )}
        </Card>
        <Card>
          <Text>İlk yatırım</Text>
          <Metric>{ftdToplami === null ? '—' : ftdToplami}</Metric>
          {ftdToplami === null && <Text className="mt-1 text-xs">bu bağlantıdan ölçülemiyor</Text>}
        </Card>
        <Card>
          <Text>Komisyon</Text>
          <Metric>
            {cuzdanVeri?.veritabaniVarMi
              ? paraBicimi(cuzdanVeri.bakiyeler.reduce((t, b) => t + Math.max(0, b.bakiye), 0))
              : '—'}
          </Metric>
          <Text className="mt-1 text-xs">
            {cuzdanVeri?.veritabaniVarMi ? 'ödenmemiş cüzdan bakiyesi' : 'veritabanı yok'}
          </Text>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <Text className="font-medium text-foreground">
            {dikeySeri ? 'Günlük GGR — casino / spor' : 'Toplam günlük GGR'}
          </Text>
          {gunlukToplam.length === 0 ? (
            <div className="flex h-44 items-center justify-center">
              <Text>Ölçüm yok.</Text>
            </div>
          ) : (
            <AreaChart
              className="mt-4 h-44"
              data={gunlukToplam}
              index="gun"
              // Altin casino, gumus spor — paletin is bolumuyle ayni.
              categories={dikeySeri ? ['Casino', 'Spor'] : ['GGR']}
              colors={dikeySeri ? ['amber', 'slate'] : ['amber']}
              valueFormatter={(v) => paraBicimi(v)}
              showLegend={dikeySeri}
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
            <BarList data={ortakSiralamasi} color="amber" valueFormatter={paraBicimi} className="mt-4" />
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

          {!dikeyVar && ozetler.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Casino/spor kırılımı yok: bağlantı ölçümlerde dikey bilgisi vermiyor. Ayrışma
              başladığı dönemden itibaren burada iki ayrı kolon olarak görünür.
            </p>
          )}
        </CardContent>
      </ShadCard>
    </>
  );
}
