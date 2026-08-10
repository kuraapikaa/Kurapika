import { useCallback, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { api, useVeri } from '../../api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { FormSaha } from '../../components/form-saha';
import { HataMesaji, Yukleniyor } from '../../components/durum';
import { KisaKimlik } from '../../tablo';
import { agTemaAcik, agTemaKoyu } from '../../lib/agGrid';
import { useTema } from '../../lib/tema';
import { DIKEY_ETIKETI, type Dikey } from '../../dikey-gorunum';
import type { KomisyonPlani as Plan, OdemeYontemleriYaniti as OdemeYontemleri, OrtakGorunumu as Ortak } from '@sunucu/sozlesme.js';

interface DikeyOzeti {
  dikey: Dikey;
  ggr: number;
}

interface OrtakOzeti {
  ortakAnahtari: string;
  ggr: number;
  dikeyler?: DikeyOzeti[];
}

interface KademeBagi {
  ortakAnahtari: string;
  ustOrtakAnahtari: string;
}

/**
 * Bu ortağın kademe zincirindeki konumu — Kademeler.tsx'teki `ustZincir`
 * (backend) ile aynı fikir, burada istemcide: bu ekran zaten `/kademeler`i
 * çekiyor olsa da yalnızca "seviye" göstermek için ayrı bir uç açmaya
 * gerek yok, tüm bağlar listesi (genelde küçük) zaten elde.
 */
function kademeSeviyesi(ortakAnahtari: string, baglar: KademeBagi[]): number | null {
  const ustHaritasi = new Map(baglar.map((b) => [b.ortakAnahtari, b.ustOrtakAnahtari]));
  if (!ustHaritasi.has(ortakAnahtari)) return null;
  let seviye = 0;
  let anahtar: string | undefined = ortakAnahtari;
  const gorulen = new Set<string>();
  while (anahtar && ustHaritasi.has(anahtar) && !gorulen.has(anahtar)) {
    gorulen.add(anahtar);
    anahtar = ustHaritasi.get(anahtar);
    seviye += 1;
  }
  return seviye;
}

const DURUM_ETIKETI = {
  bekliyor: 'Bekliyor', onaylandi: 'Onaylı', askida: 'Askıda', reddedildi: 'Reddedildi',
} as const;

const DURUM_SINIFI = {
  bekliyor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  onaylandi: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  askida: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  reddedildi: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
} as const;

const YOK_SECENEK = '__yok__';

interface SutunBaglami {
  planlar: Plan[];
  odemeYontemleri: string[];
  calistir: (is: () => Promise<unknown>) => void;
  parolaSifirla: (o: Ortak) => void;
  dikeyHaritasi: Map<string, OrtakOzeti>;
  dikeyVar: boolean;
  baglar: KademeBagi[];
}

function OrtakHucresi({ data }: ICellRendererParams<Ortak>) {
  if (!data) return null;
  return (
    <div className="py-1">
      <div className="font-medium">{data.ad}</div>
      <div className="text-xs text-muted-foreground">{data.eposta}</div>
      {!data.parolaKurulu && <div className="text-xs text-amber-600 dark:text-amber-400">Parola yok — giriş yapamaz</div>}
    </div>
  );
}

function DurumHucresi({ value }: ICellRendererParams<Ortak, Ortak['durum']>) {
  if (!value) return null;
  return <Badge variant="outline" className={DURUM_SINIFI[value]}>{DURUM_ETIKETI[value]}</Badge>;
}

function AnahtarHucresi({ value }: ICellRendererParams<Ortak, string>) {
  return <KisaKimlik deger={value ?? ''} />;
}

function PlanHucresi(props: ICellRendererParams<Ortak, unknown, SutunBaglami>) {
  const { data, context } = props;
  if (!data) return null;
  return (
    <Select
      value={data.planId ?? YOK_SECENEK}
      onValueChange={(v) => context.calistir(() => api.yaz(`/api/yonetim/ortaklar/${data.id}`, { planId: v === YOK_SECENEK ? '' : v }))}
    >
      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={YOK_SECENEK}>Varsayılan</SelectItem>
        {context.planlar.map((p) => <SelectItem key={p.id} value={p.id}>{p.ad}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function OdemeHucresi(props: ICellRendererParams<Ortak, unknown, SutunBaglami>) {
  const { data, context } = props;
  if (!data) return null;
  if (context.odemeYontemleri.length === 0) {
    return <span className="text-xs">{data.odemeYontemi ?? '—'}</span>;
  }
  const mevcutListedeYok = data.odemeYontemi && !context.odemeYontemleri.includes(data.odemeYontemi);
  return (
    <Select
      value={data.odemeYontemi || YOK_SECENEK}
      onValueChange={(v) => context.calistir(() => api.yaz(`/api/yonetim/ortaklar/${data.id}`, { odemeYontemi: v === YOK_SECENEK ? '' : v }))}
    >
      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={YOK_SECENEK}>Seçilmedi</SelectItem>
        {/* Ortagin mevcut degeri listede yoksa yine de gorunmeli; aksi
            halde secici onu sessizce bosaltirdi. */}
        {mevcutListedeYok && <SelectItem value={data.odemeYontemi!}>{data.odemeYontemi} (listede yok)</SelectItem>}
        {context.odemeYontemleri.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function KayitHucresi({ value }: ICellRendererParams<Ortak, string>) {
  return <span className="text-xs">{value?.slice(0, 10)}</span>;
}

function IslemHucresi(props: ICellRendererParams<Ortak, unknown, SutunBaglami>) {
  const { data, context } = props;
  if (!data) return null;
  return (
    <div className="flex flex-wrap gap-1 py-1">
      {data.durum !== 'onaylandi' && (
        <Button size="sm" variant="outline" onClick={() => context.calistir(() => api.yaz(`/api/yonetim/ortaklar/${data.id}`, { durum: 'onaylandi' }))}>Onayla</Button>
      )}
      {data.durum !== 'askida' && (
        <Button size="sm" variant="outline" onClick={() => context.calistir(() => api.yaz(`/api/yonetim/ortaklar/${data.id}`, { durum: 'askida' }))}>Askıya al</Button>
      )}
      <Button size="sm" variant="outline" onClick={() => context.parolaSifirla(data)}>Parola</Button>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => {
          // Silmek olcumleri ve gecmis hakedis satirlarini SAHIPSIZ
          // birakiyor; onaysiz tek tikla yapilmamali.
          if (window.confirm(`${data.ad} silinsin mi? Geçmiş ölçümleri sahipsiz kalır.`)) {
            context.calistir(() => api.sil(`/api/yonetim/ortaklar/${data.id}`));
          }
        }}
      >
        Sil
      </Button>
    </div>
  );
}

export function Ortaklar() {
  const liste = useVeri<{ ortaklar: Ortak[] }>('/api/yonetim/ortaklar');
  const planlar = useVeri<{ planlar: Plan[] }>('/api/yonetim/planlar');
  // Odeme yontemleri backoffice'ten: serbest metin "Papara", "papara",
  // "PAPARA TR" gibi uc ayri deger uretiyor ve odeme gunu hangisinin
  // hangisi oldugu elle cozuluyordu.
  const odeme = useVeri<OdemeYontemleri>('/api/yonetim/odeme-yontemleri');
  // Casino/Spor GGR icin: bu ekran ortak KAYDINI listeliyor, GGR olcum
  // verisi Ozet'in cektigi ucta. Ayri bir "ortak + GGR" ucu acmak yerine
  // Ozet'te zaten kurulan /ozet'i burada da cekip anahtarla birlestiriyoruz.
  const ozet = useVeri<{ ozetler: OrtakOzeti[] }>('/api/yonetim/ozet');
  const kademe = useVeri<{ baglar: KademeBagi[] }>('/api/yonetim/kademeler');
  const [koyu] = useTema();
  const [hata, setHata] = useState<string | null>(null);
  const [yeni, setYeni] = useState({ ad: '', eposta: '', ortakAnahtari: '', parola: '' });
  // Uretilen parola YALNIZCA burada, bir kez gorunur; hicbir listede yok.
  const [uretilen, setUretilen] = useState<{ ad: string; parola: string } | null>(null);
  const [arama, setArama] = useState('');
  // null = tumu. Durum suzgeci aramadan BAGIMSIZ: ikisi birlikte daraltiyor.
  const [durumSuzgeci, setDurumSuzgeci] = useState<Ortak['durum'] | null>(null);

  const calistir = useCallback(async (is: () => Promise<unknown>) => {
    setHata(null);
    try {
      await is();
      liste.yenile();
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'İşlem başarısız.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parolaSifirla = useCallback((o: Ortak) => {
    calistir(async () => {
      const y = await api.gonder<{ parola: string }>(`/api/yonetim/ortaklar/${o.id}/parola-sifirla`);
      setUretilen({ ad: o.ad, parola: y.parola });
    });
  }, [calistir]);

  const dikeyHaritasi = useMemo(
    () => new Map((ozet.veri?.ozetler ?? []).map((o) => [o.ortakAnahtari, o])),
    [ozet.veri],
  );
  const dikeyVar = useMemo(
    () => (ozet.veri?.ozetler ?? []).some((o) => (o.dikeyler?.length ?? 0) > 0),
    [ozet.veri],
  );

  const baglam: SutunBaglami = useMemo(() => ({
    planlar: planlar.veri?.planlar ?? [],
    odemeYontemleri: odeme.veri?.yontemler ?? [],
    calistir,
    parolaSifirla,
    dikeyHaritasi,
    dikeyVar,
    baglar: kademe.veri?.baglar ?? [],
  }), [planlar.veri, odeme.veri, calistir, parolaSifirla, dikeyHaritasi, dikeyVar, kademe.veri]);

  const sutunlar = useMemo<ColDef<Ortak>[]>(() => {
    const temel: ColDef<Ortak>[] = [
      { field: 'ad', headerName: 'Ortak', minWidth: 220, cellRenderer: OrtakHucresi, filterValueGetter: (p) => `${p.data?.ad ?? ''} ${p.data?.eposta ?? ''}` },
      { field: 'ortakAnahtari', headerName: 'Anahtar', width: 130, cellRenderer: AnahtarHucresi },
      { field: 'durum', headerName: 'Durum', width: 120, cellRenderer: DurumHucresi, valueFormatter: (p) => DURUM_ETIKETI[p.value as Ortak['durum']] },
      { field: 'planId', headerName: 'Plan', width: 160, sortable: false, cellRenderer: PlanHucresi },
      {
        field: 'trafikKaynagi',
        headerName: 'Kaynak',
        width: 140,
        valueFormatter: (p) => (p.value ? String(p.value) : '—'),
      },
    ];

    const dikeySutunlari: ColDef<Ortak>[] = dikeyVar
      ? (['casino', 'spor'] as const).map((d) => ({
        colId: `ggr-${d}`,
        headerName: `${DIKEY_ETIKETI[d]} GGR`,
        type: 'numericColumn',
        width: 130,
        valueGetter: (p) => {
          if (!p.data) return null;
          const satir = dikeyHaritasi.get(p.data.ortakAnahtari)?.dikeyler?.find((x) => x.dikey === d);
          return satir ? satir.ggr : null;
        },
        valueFormatter: (p) => (p.value === null || p.value === undefined ? '—' : new Intl.NumberFormat('tr-TR').format(p.value)),
      }))
      : [];

    return [
      ...temel,
      ...dikeySutunlari,
      {
        colId: 'kademe',
        headerName: 'Kademe',
        width: 100,
        valueGetter: (p) => (p.data ? kademeSeviyesi(p.data.ortakAnahtari, kademe.veri?.baglar ?? []) : null),
        valueFormatter: (p) => (p.value === null || p.value === undefined ? '—' : `${p.value}. seviye`),
      },
      { field: 'odemeYontemi', headerName: 'Ödeme yöntemi', width: 170, sortable: false, cellRenderer: OdemeHucresi },
      { field: 'createdAt', headerName: 'Kayıt', width: 110, cellRenderer: KayitHucresi },
      { headerName: 'İşlem', minWidth: 260, sortable: false, filter: false, cellRenderer: IslemHucresi },
    ];
  }, [dikeyVar, dikeyHaritasi, kademe.veri]);

  if (liste.yukleniyor) return <Yukleniyor satir={6} />;

  const tumOrtaklar = liste.veri?.ortaklar ?? [];
  const gorunen = durumSuzgeci ? tumOrtaklar.filter((x) => x.durum === durumSuzgeci) : tumOrtaklar;
  // Sayilar SUZGECTEN ONCEKI listeden: bir duruma gecince digerlerinin
  // sayaci sifirlanirsa cipler kullanilamaz hale gelir.
  const durumSayilari = (['bekliyor', 'onaylandi', 'askida', 'reddedildi'] as const)
    .map((d) => ({ durum: d, sayi: tumOrtaklar.filter((x) => x.durum === d).length }))
    // Hic ortagi olmayan durum cip olarak GOSTERILMIYOR: bos bir suzgec
    // tiklandiginda "sonuc yok" gosterir, bu bir secenek degil bir cikmaz.
    .filter((d) => d.sayi > 0);

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Yeni ortak</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <FormSaha id="ort-ad" etiket="Ad" deger={yeni.ad} degisti={(v) => setYeni({ ...yeni, ad: v })} />
            <FormSaha id="ort-eposta" etiket="E-posta" deger={yeni.eposta} degisti={(v) => setYeni({ ...yeni, eposta: v })} tip="email" />
            <FormSaha id="ort-anahtar" etiket="İzleme anahtarı" deger={yeni.ortakAnahtari} degisti={(v) => setYeni({ ...yeni, ortakAnahtari: v })} />
            <FormSaha id="ort-parola" etiket="Parola" deger={yeni.parola} degisti={(v) => setYeni({ ...yeni, parola: v })} tip="password" ipucu="En az 10 karakter" />
          </div>
          <div className="mt-3">
            <Button
              onClick={() => calistir(async () => {
                await api.gonder('/api/yonetim/ortaklar', yeni);
                setYeni({ ad: '', eposta: '', ortakAnahtari: '', parola: '' });
              })}
            >
              Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {(hata || liste.hata) && <HataMesaji mesaj={hata ?? liste.hata!} />}

      {uretilen && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Yeni parola</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-2 text-sm"><strong>{uretilen.ad}</strong> için yeni parola:</p>
            <code className="block break-all rounded-lg border bg-muted px-3 py-2 text-sm">{uretilen.parola}</code>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Bu parola bir daha gösterilmeyecek — depoda yalnızca geri çevrilemez özeti tutuluyor.
              Ortağa iletin, sonra bu kutuyu kapatın.
            </p>
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => setUretilen(null)}>Kapat</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ödeme yöntemleri</CardTitle>
          <Button variant="outline" size="sm" onClick={() => odeme.yenile()}>Backoffice’ten yenile</Button>
        </CardHeader>
        <CardContent>
          {odeme.veri?.kaynak === 'backoffice' && odeme.veri.yontemler.length > 0 ? (
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                Son 90 günde gerçekten para geçmiş {odeme.veri.yontemler.length} yöntem. Ortağın ödeme
                yöntemi bu listeden seçiliyor.
              </p>
              <div className="flex flex-wrap gap-1">
                {odeme.veri.yontemler.map((y) => <Badge key={y} variant="secondary">{y}</Badge>)}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {odeme.veri?.kaynak === 'hata'
                ? `Backoffice’ten okunamadı: ${odeme.veri.mesaj}. Ödeme yöntemi serbest metin olarak girilecek.`
                : 'Backoffice bağlantısı yok; ödeme yöntemi serbest metin olarak girilecek.'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ortaklar
            <span className="ml-2 font-normal tabular-nums">
              {gorunen.length}{durumSuzgeci ? ` / ${tumOrtaklar.length}` : ''}
            </span>
          </CardTitle>
          <Input
            placeholder="Ara: ad, e-posta, anahtar, durum, plan…"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            className="h-8 w-64"
          />
        </CardHeader>
        <CardContent>
          {/* DURUM ÇİPLERİ — ekranda yalnızca serbest metin araması vardı;
              "bekleyenleri göster" gibi en sık ihtiyaç, kullanıcının doğru
              kelimeyi yazmasına bağlıydı. Çipler AG Grid'in kendi süzgecini
              kullanmıyor ve `quickFilterText` üzerine binmiyor: ayrı bir dizi
              süzgeci, ikisi birlikte daraltıyor. */}
          {durumSayilari.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={durumSuzgeci === null ? 'default' : 'outline'}
                onClick={() => setDurumSuzgeci(null)}
              >
                Tümü <span className="ml-1.5 tabular-nums opacity-70">{tumOrtaklar.length}</span>
              </Button>
              {durumSayilari.map((d) => (
                <Button
                  key={d.durum}
                  size="sm"
                  variant={durumSuzgeci === d.durum ? 'default' : 'outline'}
                  onClick={() => setDurumSuzgeci(durumSuzgeci === d.durum ? null : d.durum)}
                >
                  {DURUM_ETIKETI[d.durum]}
                  <span className="ml-1.5 tabular-nums opacity-70">{d.sayi}</span>
                </Button>
              ))}
            </div>
          )}
          <div style={{ height: 520 }}>
            <AgGridReact
              theme={koyu ? agTemaKoyu : agTemaAcik}
              rowData={gorunen}
              columnDefs={sutunlar}
              context={baglam}
              defaultColDef={{ sortable: true, resizable: true, filter: 'agTextColumnFilter' }}
              quickFilterText={arama}
              pagination
              paginationPageSize={15}
              paginationPageSizeSelector={false}
              overlayNoRowsTemplate="Filtreye uyan ortak yok."
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
