import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Card, Metric, Text } from '@tremor/react';
import { api, gunBicimi, useVeri } from '../../api';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card as ShadCard, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { BosDurum, HataMesaji, Yukleniyor } from '../../components/durum';
import { KisaKimlik } from '../../tablo';
import { agTemaAcik, agTemaKoyu } from '../../lib/agGrid';
import { useTema } from '../../lib/tema';
import type {
  BaglantiGorunumu,
  CakismaGorunumu,
  EslesmeGorunumu,
  OrtakGorunumu,
  TopluAtamaSatiri,
  TopluAtamaSonucu,
  VarsayilanGocSonucu,
  YonetimUclari,
} from '@sunucu/sozlesme.js';

/**
 * OYUNCU ↔ ORTAK EŞLEŞMELERİ.
 *
 * Hakedişin dayanağı bu tablo: bir oyuncunun hangi ortağa ait olduğu
 * burada yazıyor. Yanlışsa para yanlış kişiye gider, eksikse ortak
 * getirdiği oyuncuyu kanıtlayamaz.
 *
 * Çakışmalar ayrı gösteriliyor çünkü tek tek masum, toplu hâlde
 * anlamlıdır: aynı ortaktan yığınla reddedilen talep, o ortağın
 * başkasının trafiğini kendine yazmaya çalıştığının en net işareti.
 */

const BADGE_OLUMLU = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
const BADGE_OLUMSUZ = 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
const BADGE_UYARI = 'bg-amber-500/15 text-amber-600 dark:text-amber-400';

function TiklamaHucresi({ data }: ICellRendererParams<EslesmeGorunumu>) {
  if (!data) return null;
  return data.clickId
    ? <Badge variant="outline" className={BADGE_OLUMLU}>Bağlı</Badge>
    // Tiklama kimligi olmadan geldi: ortak dogru ama hangi banner ya
    // da alt kanaldan geldigi bilinmiyor.
    : <Badge variant="secondary">Yalnızca ref</Badge>;
}

function KanalHucresi({ data }: ICellRendererParams<EslesmeGorunumu>) {
  if (!data) return null;
  const altlar = Object.entries(data.alt).filter(([, d]) => d);
  if (!data.medyaId && altlar.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="text-xs">
      {data.medyaId ? <KisaKimlik deger={data.medyaId} /> : null}
      {altlar.map(([k, d]) => ` ${k}=${d}`).join('')}
    </span>
  );
}

export function Eslesmeler() {
  const [yeniAnahtar, setYeniAnahtar] = useState<string | null>(null);
  const [isliyor, setIsliyor] = useState(false);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const [koyu] = useTema();
  const [arama, setArama] = useState('');

  const { veri, yukleniyor, hata, yenile } = useVeri<YonetimUclari['/oyuncu-eslesmeleri']>(
    '/api/yonetim/oyuncu-eslesmeleri',
  );
  const ortaklarVeri = useVeri<YonetimUclari['/ortaklar']>('/api/yonetim/ortaklar');
  const baglantilarVeri = useVeri<YonetimUclari['/baglantilar']>('/api/yonetim/baglantilar');
  const baglantilar = useMemo(
    () => (baglantilarVeri.veri?.baglantilar ?? []).filter((b) => b.aktif),
    [baglantilarVeri.veri],
  );
  // Coklu site YALNIZCA birden fazla AKTIF baglanti varsa gorunur oluyor --
  // tek baglantili (bugune kadarki HER) kiracida site secimi/sutunu
  // gereksiz gurultu olurdu.
  const cokluSite = baglantilar.length > 1;

  const eslesmeler = veri?.eslesmeler ?? [];
  const cakismalar = veri?.cakismalar ?? [];
  const anahtar = veri?.anahtar;

  const anahtarUret = async () => {
    setIsliyor(true);
    setIslemHatasi(null);
    try {
      const yanit = await api.gonder<{ anahtar: string }>('/api/yonetim/s2s-anahtari', {});
      setYeniAnahtar(yanit.anahtar);
      yenile();
    } catch (h) {
      setIslemHatasi((h as Error).message);
    } finally {
      setIsliyor(false);
    }
  };

  const sutunlar = useMemo<ColDef<EslesmeGorunumu>[]>(() => [
    {
      field: 'lynonOyuncuId', headerName: 'Lynon oyuncu', width: 140,
      cellRenderer: (p: ICellRendererParams<EslesmeGorunumu, string>) => <code className="text-xs">{p.value}</code>,
    },
    {
      headerName: 'Ortak', minWidth: 160,
      valueGetter: (p) => p.data?.ortakAdi ?? p.data?.ortakAnahtari ?? '',
    },
    {
      field: 'ortakAnahtari', headerName: 'Ref kodu', width: 130,
      cellRenderer: (p: ICellRendererParams<EslesmeGorunumu, string>) => <code className="text-xs">{p.value}</code>,
    },
    // Yalnizca birden fazla aktif Lynon baglantisi varsa gorunur -- tek
    // baglantili kiracida her satir zaten ayni degeri tasir, sutun
    // gereksiz gurultu olurdu.
    ...(cokluSite ? [{ field: 'baglantiAdi', headerName: 'Site', width: 130 } as ColDef<EslesmeGorunumu>] : []),
    { headerName: 'Kanal', minWidth: 160, sortable: false, cellRenderer: KanalHucresi },
    { headerName: 'Tıklama', width: 130, sortable: false, cellRenderer: TiklamaHucresi },
    {
      // Toplu gecişte `olusturuldu` admin'in geçişi yaptığı andır, oyuncunun
      // Lynon'a kaydolduğu an DEĞİL; `kayitTarihi` varsa o gerçek anı taşır.
      headerName: 'Kayıt', width: 140,
      valueGetter: (p) => p.data?.kayitTarihi ?? p.data?.olusturuldu ?? '',
      valueFormatter: (p) => (p.value ? gunBicimi(p.value) : ''),
    },
  ], [cokluSite]);

  // Ayni ortaktan gelen tekrarli talepler asil sinyal; tek tek bakmak
  // sorunu gostermiyor.
  const talepEdenSayilari = new Map<string, number>();
  for (const c of cakismalar) {
    const ad = c.denenenOrtakAdi ?? c.denenenOrtakAnahtari;
    talepEdenSayilari.set(ad, (talepEdenSayilari.get(ad) ?? 0) + 1);
  }
  const enCokTalepEden = [...talepEdenSayilari.entries()].sort((a, b) => b[1] - a[1])[0];

  if (yukleniyor) return <Yukleniyor satir={6} />;
  if (hata) return <HataMesaji mesaj={hata} />;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <Text>Eşleşen oyuncu</Text>
          <Metric>{eslesmeler.length}</Metric>
        </Card>
        <Card>
          <Text>Tıklamaya bağlı</Text>
          <Metric>{eslesmeler.filter((e) => e.clickId).length}</Metric>
          <Text className="mt-1 text-xs">kanal kırılımı var</Text>
        </Card>
        <Card>
          <Text>Reddedilen talep</Text>
          <Metric>{cakismalar.length}</Metric>
          {enCokTalepEden && <Text className="mt-1 text-xs">en çok: {enCokTalepEden[0]}</Text>}
        </Card>
        <Card>
          <Text>S2S bağlantısı</Text>
          <Metric>{anahtar?.kuruluMu ? 'Kurulu' : 'Yok'}</Metric>
          <Text className="mt-1 text-xs">{anahtar?.sonKullanim ? `son: ${gunBicimi(anahtar.sonKullanim)}` : 'hiç kullanılmadı'}</Text>
        </Card>
      </div>

      <TopluAtamaKarti ortaklar={ortaklarVeri.veri?.ortaklar ?? []} baglantilar={baglantilar} yenile={yenile} />

      {cokluSite && <VarsayilanGocKarti yenile={yenile} />}

      <ShadCard>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Kayıt bildirimi bağlantısı</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Oyuncu Lynon’a kaydolduğunda siteniz aşağıdaki uca bildirim gönderir ve eşleşme kurulur.
            İstek tarayıcıdan değil <strong>sunucudan</strong> gelmeli: bu uç “şu oyuncu şu ortağa
            ait” diyebiliyor, yani doğrudan paraya dokunuyor.
          </p>

          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{`POST /api/kayit/oyuncu
Authorization: Bearer <s2s-anahtari>
Content-Type: application/json

{ "lynonOyuncuId": "123456", "ref": "<clickid ya da ortak anahtari>" }`}</pre>

          <p className="mt-3 text-xs text-muted-foreground">
            <code>ref</code> olarak tıklama kimliği (<code>clickid</code>) göndermek daha iyi: hangi
            medya ve alt kanaldan gelindiği yalnızca onda var. Ortak anahtarı da kabul edilir.
            Aynı oyuncu için ikinci bir bildirim <strong>sahibi değiştirmez</strong>; yanıt
            <code> durum</code> alanında ne olduğunu söyler.
          </p>

          {islemHatasi && <p className="mt-3 text-sm text-destructive">{islemHatasi}</p>}

          {yeniAnahtar && (
            <Alert className={`mt-3 ${BADGE_UYARI} border-amber-500/50`}>
              <AlertDescription>
                <p className="font-semibold">Bu anahtar bir daha gösterilmeyecek — şimdi kopyalayın.</p>
                <code className="mt-2 block break-all text-xs">{yeniAnahtar}</code>
              </AlertDescription>
            </Alert>
          )}

          <Button className="mt-3" onClick={anahtarUret} disabled={isliyor}>
            {anahtar?.kuruluMu ? 'Yeni anahtar üret (eskisi geçersiz olur)' : 'Anahtar üret'}
          </Button>
        </CardContent>
      </ShadCard>

      <ShadCard>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Reddedilen talepler</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Bir ortak, başka bir ortağa ait oyuncuyu talep etti; ilk kayıt kuralı gereği reddedildi.
            Tek tek bakıldığında çoğu masum — oyuncu ikinci kez, başka bir linkten gelmiştir.
            Aynı ortaktan yığınla gelmesi ise başkasının trafiğini kendine yazma girişimidir.
          </p>
          {cakismalar.length === 0 ? (
            <BosDurum mesaj="Reddedilen talep yok." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lynon oyuncu</TableHead>
                  <TableHead>Talep eden</TableHead>
                  <TableHead>Gerçek sahip</TableHead>
                  <TableHead>Zaman</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...cakismalar].sort((a, b) => b.zaman.localeCompare(a.zaman)).map((c: CakismaGorunumu) => (
                  <TableRow key={c.id}>
                    <TableCell><code className="text-xs">{c.lynonOyuncuId}</code></TableCell>
                    <TableCell>{c.denenenOrtakAdi ?? c.denenenOrtakAnahtari}</TableCell>
                    <TableCell>{c.mevcutOrtakAdi ?? c.mevcutOrtakId}</TableCell>
                    <TableCell className="text-xs">{gunBicimi(c.zaman)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </ShadCard>

      <ShadCard>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Eşleşmeler</CardTitle>
          <Input
            placeholder="Ara: oyuncu, ortak, ref…"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            className="h-8 w-64"
          />
        </CardHeader>
        <CardContent>
          {eslesmeler.length === 0 ? (
            <BosDurum mesaj="Henüz eşleşme yok. Kayıt bildirimi geldiğinde oyuncular burada listelenir." />
          ) : (
            <div style={{ height: 480 }}>
              <AgGridReact
                theme={koyu ? agTemaKoyu : agTemaAcik}
                rowData={eslesmeler}
                columnDefs={sutunlar}
                defaultColDef={{ sortable: true, resizable: true, filter: 'agTextColumnFilter' }}
                quickFilterText={arama}
                pagination
                paginationPageSize={15}
                paginationPageSizeSelector={false}
                overlayNoRowsTemplate="Filtreye uyan eşleşme yok."
              />
            </div>
          )}
        </CardContent>
      </ShadCard>
    </>
  );
}

const KULLANICI_ADI_AYIRICI = /[\r\n,;]+/;

function satirSayisiHesapla(ham: string): number {
  return ham.split(KULLANICI_ADI_AYIRICI).map((s) => s.trim()).filter(Boolean).length;
}

const EAD_SONUC_RENGI: Record<TopluAtamaSatiri['durum'], string> = {
  basarili: BADGE_OLUMLU,
  bulunamadi: '',
  hata: BADGE_OLUMSUZ,
};
const EAD_SONUC_ETIKETI: Record<TopluAtamaSatiri['durum'], string> = {
  basarili: 'Atandı',
  bulunamadi: 'Bulunamadı',
  hata: 'Hata',
};

/**
 * KULLANICI ADINDAN TOPLU AFFİLİATE GEÇİŞİ.
 *
 * Girdi kullanıcı adı listesi + hedef ortak. Zaten başka bir ortakta
 * olan bir oyuncu da BİLEREK taşınabiliyor — "geçiş" tam olarak bu:
 * admin ground truth'u düzeltiyor, "ilk kayıt kazanır" siperi burada
 * (S2S bildirimlerinin aksine) devre dışı.
 */
function TopluAtamaKarti(
  { ortaklar, baglantilar, yenile }: { ortaklar: OrtakGorunumu[]; baglantilar: BaglantiGorunumu[]; yenile: () => void },
) {
  const [hedefOrtak, setHedefOrtak] = useState('');
  const [kullaniciAdlari, setKullaniciAdlari] = useState('');
  // Varsayilan: ilk aktif baglanti -- backend zaten ayni fallback'i
  // uyguluyor (bkz. yonetim.ts), burada onceden secili gostermek sadece
  // kullanicinin ne secildigini gorebilmesi icin.
  const [baglantiId, setBaglantiId] = useState('');
  const [isliyor, setIsliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<TopluAtamaSonucu | null>(null);
  const cokluSite = baglantilar.length > 1;
  const secilenBaglantiId = baglantiId || baglantilar[0]?.id || '';

  const sinirVeri = useVeri<YonetimUclari['/oyuncu-eslesmeleri/toplu-atama-siniri']>(
    '/api/yonetim/oyuncu-eslesmeleri/toplu-atama-siniri',
  );
  const limit = sinirVeri.veri?.limit ?? null;

  const onayliOrtaklar = useMemo(() => ortaklar.filter((o) => o.durum === 'onaylandi'), [ortaklar]);
  const ortakAdi = useMemo(() => new Map(ortaklar.map((o) => [o.id, o.ad])), [ortaklar]);
  const satirSayisi = useMemo(() => satirSayisiHesapla(kullaniciAdlari), [kullaniciAdlari]);
  const sinirAsildi = limit != null && satirSayisi > limit;

  const gonderilebilir = Boolean(hedefOrtak) && satirSayisi > 0 && !sinirAsildi && !isliyor;

  const gonder = async () => {
    setIsliyor(true);
    setHata(null);
    setSonuc(null);
    try {
      const yanit = await api.gonder<TopluAtamaSonucu>('/api/yonetim/oyuncu-eslesmeleri/toplu-atama', {
        kullaniciAdlari,
        ortakAnahtari: hedefOrtak,
        baglantiId: secilenBaglantiId,
      });
      setSonuc(yanit);
      yenile();
    } catch (h) {
      setHata((h as Error).message);
    } finally {
      setIsliyor(false);
    }
  };

  const detay = (s: TopluAtamaSatiri) => {
    if (s.durum === 'hata') return <span className="text-xs text-destructive">{s.hata}</span>;
    if (s.durum === 'bulunamadi') return <span className="text-xs text-muted-foreground">Kullanıcı adı backoffice'te yok</span>;
    if (s.eslesmeDurumu === 'tasindi') {
      const onceki = s.oncekiOrtakId ? (ortakAdi.get(s.oncekiOrtakId) ?? s.oncekiOrtakId) : '—';
      return <span className="text-xs">Taşındı — önceki: {onceki}</span>;
    }
    if (s.eslesmeDurumu === 'zaten-bu-ortakta') return <span className="text-xs text-muted-foreground">Zaten bu ortakta</span>;
    return <span className="text-xs">Yeni eşleşme</span>;
  };

  const backoffice = (s: TopluAtamaSatiri) => {
    if (s.durum !== 'basarili' || s.backofficeBasarili === undefined) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    return s.backofficeBasarili
      ? <Badge variant="outline" className={BADGE_OLUMLU}>Senkron</Badge>
      : <span title={s.backofficeMesaji}><Badge variant="outline" className={BADGE_UYARI}>Senkron değil</Badge></span>;
  };

  return (
    <ShadCard>
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Kullanıcı adından toplu affiliate geçişi</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Destek üzerinden ya da izleme linki olmadan kaydolmuş oyuncuları toplu hâlde bir ortağa
          bağlar. <strong>Zaten başka bir ortakta olan bir oyuncu da taşınır</strong> — bu, S2S
          bildirimindeki "ilk kayıt kazanır" korumasından bilerek farklı: burada ground truth'u
          siz düzeltiyorsunuz.
        </p>

        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Hedef ortak</label>
            <Select value={hedefOrtak} onValueChange={setHedefOrtak}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Seçin…" /></SelectTrigger>
              <SelectContent>
                {onayliOrtaklar.map((o) => (
                  <SelectItem key={o.id} value={o.ortakAnahtari}>{o.ad} ({o.ortakAnahtari})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onayliOrtaklar.length === 0 && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Onaylı ortak yok.</p>}

            {cokluSite && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Site</label>
                <Select value={secilenBaglantiId} onValueChange={setBaglantiId}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {baglantilar.map((b) => <SelectItem key={b.id} value={b.id}>{b.ad}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Arama bu Lynon sitesinde yapılır — aynı numaralı ID farklı sitelerde farklı oyunculara ait olabilir.
                </p>
              </div>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              {satirSayisi} kullanıcı adı
              {limit != null && ` / en fazla ${limit}`}
            </p>
            {sinirAsildi && <p className="mt-1 text-xs text-destructive">Sınır aşıldı — listeyi bölüp ayrı ayrı gönderin.</p>}
          </div>

          <Textarea
            value={kullaniciAdlari}
            onChange={(e) => setKullaniciAdlari(e.target.value)}
            placeholder={'kullanici1\nkullanici2\nkullanici3'}
            rows={6}
            className="font-mono text-xs"
          />
        </div>

        {hata && <p className="mt-3 text-sm text-destructive">{hata}</p>}

        <Button className="mt-3" onClick={gonder} disabled={!gonderilebilir}>
          {isliyor ? 'İşleniyor…' : 'Toplu ata'}
        </Button>

        {sonuc && (
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className={BADGE_OLUMLU}>{sonuc.basarili} atandı</Badge>
              {sonuc.bulunamadi > 0 && <Badge variant="secondary">{sonuc.bulunamadi} bulunamadı</Badge>}
              {sonuc.hatali > 0 && <Badge variant="outline" className={BADGE_OLUMSUZ}>{sonuc.hatali} hata</Badge>}
              {sonuc.tekrarSayisi > 0 && (
                <span className="text-muted-foreground">({sonuc.tekrarSayisi} tekrar eden ad atlandı)</span>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kullanıcı adı</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Detay</TableHead>
                  <TableHead>Backoffice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sonuc.satirlar.map((s) => (
                  <TableRow key={s.kullaniciAdi}>
                    <TableCell>{s.kullaniciAdi}</TableCell>
                    <TableCell>
                      {s.durum === 'bulunamadi'
                        ? <Badge variant="secondary">{EAD_SONUC_ETIKETI[s.durum]}</Badge>
                        : <Badge variant="outline" className={EAD_SONUC_RENGI[s.durum]}>{EAD_SONUC_ETIKETI[s.durum]}</Badge>}
                    </TableCell>
                    <TableCell>{detay(s)}</TableCell>
                    <TableCell>{backoffice(s)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </ShadCard>
  );
}

/**
 * ÇOKLU BAĞLANTI GÖÇÜ.
 *
 * Çoklu bağlantıya geçmeden önce yazılmış eşleşmeler "varsayılan"
 * taşıyor -- bu kimlik artık hiçbir aktif bağlantıyla eşleşmediği için
 * o oyuncular geçmiş GGR taramasında sonsuza dek atlanır. Bu kart, her
 * kaydı kullanıcı adından aktif her bağlantının kendi backoffice'inde
 * arayarak doğrulayıp doğru bağlantıya taşıyan tek seferlik bir bakım
 * eylemi -- tahmin YOK: bulunamayan ya da birden fazla yerde bulunan
 * kayıtlara dokunulmuyor, admin elle karar versin diye listeleniyor.
 */
function VarsayilanGocKarti({ yenile }: { yenile: () => void }) {
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<VarsayilanGocSonucu | null>(null);

  const calistir = async () => {
    if (!window.confirm('Eski eşleşmeler taranıp doğru bağlantıya taşınsın mı? Yalnızca kullanıcı adı tek bir bağlantıda doğrulanan kayıtlar taşınır.')) return;
    setCalisiyor(true);
    setHata(null);
    try {
      setSonuc(await api.gonder<VarsayilanGocSonucu>('/api/yonetim/oyuncu-eslesmeleri/varsayilan-dagit', {}));
      yenile();
    } catch (h) {
      setHata((h as Error).message);
    } finally {
      setCalisiyor(false);
    }
  };

  return (
    <ShadCard>
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Eski eşleşmeleri gerçek bağlantılara dağıt</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Birden fazla bağlantıya geçmeden önce kaydedilmiş oyuncular hâlâ eski, artık hiçbir aktif
          bağlantıyla eşleşmeyen bir kimlik taşıyabilir -- bu yüzden geçmiş GGR taraması onları hiç
          bulamaz. Bu işlem her böyle kaydı, kullanıcı adını aktif her bağlantının kendi
          backoffice'inde arayarak doğrulayıp doğru bağlantıya taşır. Bulunamayan ya da birden fazla
          yerde bulunan kayıtlara <strong>dokunulmaz</strong> -- aşağıda listelenir, elle kontrol gerekir.
        </p>

        {hata && <p className="mb-3 text-sm text-destructive">{hata}</p>}

        {sonuc && (
          <div className="mb-3 space-y-3 text-sm">
            <p className="text-muted-foreground">
              {sonuc.incelenen} kayıt incelendi, <strong>{sonuc.tasinan.length}</strong> taşındı,{' '}
              <strong>{sonuc.belirsiz.length}</strong> elle kontrol gerektiriyor.
            </p>
            {sonuc.tasinan.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {sonuc.tasinan.map((t) => (
                  <li key={t.lynonOyuncuId}>{t.kullaniciAdi ?? t.lynonOyuncuId} → {t.baglantiAdi}</li>
                ))}
              </ul>
            )}
            {sonuc.belirsiz.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-amber-600 dark:text-amber-400">Elle kontrol gerekiyor:</p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {sonuc.belirsiz.map((b) => (
                    <li key={b.lynonOyuncuId}>{b.kullaniciAdi ?? b.lynonOyuncuId}: {b.sebep}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <Button onClick={calistir} disabled={calisiyor}>
          {calisiyor ? 'Dağıtılıyor…' : 'Eski eşleşmeleri dağıt'}
        </Button>
      </CardContent>
    </ShadCard>
  );
}
