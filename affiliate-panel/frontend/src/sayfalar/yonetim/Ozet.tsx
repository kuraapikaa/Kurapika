import { useState } from 'react';
import { api, paraBicimi, useVeri } from '../../api';
import { Buton, Bos, Egilim, Hata, Hucre, Kart, Satir, Tablo, Yukleniyor } from '../../ui';
import { CubukListesi, OlcuKarti, ZamanSerisi } from '../../grafik';

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

export function Ozet() {
  const { veri, yukleniyor, hata, yenile } = useVeri<{ bugun: string; ozetler: OrtakOzeti[] }>('/api/yonetim/ozet');
  const [senkron, setSenkron] = useState<SenkronSonucu | null>(null);
  const [senkronHatasi, setSenkronHatasi] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [gecmis, setGecmis] = useState<GecmisGGRSonucu | null>(null);
  const [gecmisHatasi, setGecmisHatasi] = useState<string | null>(null);
  const [gecmisCalisiyor, setGecmisCalisiyor] = useState(false);

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

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

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
    .map(([gun, ggr]) => ({ etiket: gun.slice(5), deger: Math.round(ggr) }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OlcuKarti etiket="Ortak" deger={String(ozetler.length)} alt="ölçümü olan" />
        <OlcuKarti etiket="Yatırım" deger={paraBicimi(topla((o) => o.yatirim))} />
        <OlcuKarti etiket="GGR" deger={paraBicimi(topla((o) => o.ggr))} />
        <OlcuKarti
          etiket="İlk yatırım"
          deger={ftdToplami === null ? '—' : String(ftdToplami)}
          alt={ftdToplami === null ? 'bu bağlantıdan ölçülemiyor' : undefined}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Kart baslik="Toplam günlük GGR">
          <ZamanSerisi noktalar={gunlukToplam} bosMesaj="Ölçüm yok." />
        </Kart>
        <Kart baslik="Ortak bazında GGR">
          <CubukListesi
            satirlar={ozetler.slice(0, 8).map((o) => ({
              etiket: o.ortakAnahtari,
              deger: Math.round(o.ggr),
              alt: `${o.aktifOyuncuSayisi} aktif oyuncu`,
            }))}
            bosMesaj="Ölçüm yok."
          />
        </Kart>
      </div>

      <Kart
        baslik="Ortak performansı"
        sag={
          <div className="flex gap-2">
            <Buton onClick={senkronla} devredisi={calisiyor}>{calisiyor ? 'Çekiliyor…' : 'Backoffice’ten çek'}</Buton>
            <Buton onClick={gecmisiDoldur} devredisi={gecmisCalisiyor}>
              {gecmisCalisiyor ? 'Dolduruluyor…' : 'Geçmiş GGR’yi doldur'}
            </Buton>
          </div>
        }
      >
        {senkronHatasi && <div className="mb-3"><Hata mesaj={senkronHatasi} /></div>}
        {senkron && (
          <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
            {senkron.cekilenGun} gün çekildi, {senkron.yazilanOlcum} ölçüm yazıldı.
            {senkron.hatali.length > 0 && ` ${senkron.hatali.length} gün alınamadı.`}
            {senkron.uyari && ` ${senkron.uyari}`}
          </p>
        )}
        {gecmisHatasi && <div className="mb-3"><Hata mesaj={gecmisHatasi} /></div>}
        {gecmis && (
          <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
            {gecmis.tarananGun} gün tarandı, {gecmis.eslesenOyuncuGunu} eşleşen oyuncu günü, {gecmis.yazilanOlcum} ölçüm yazıldı.
            {gecmis.hatali.length > 0 && ` ${gecmis.hatali.length} gün alınamadı.`}
            {gecmis.uyari && ` ${gecmis.uyari}`}
          </p>
        )}

        {ozetler.length === 0 ? (
          <Bos mesaj="Henüz ölçüm yok. Backoffice bağlantısını kurup çekmeyi deneyin." />
        ) : (
          <Tablo basliklar={['Ortak', 'Gün', 'Oyuncu', 'Aktif', 'Yatırım', 'Çekim', 'GGR', 'Eğilim']}>
            {ozetler.map((o) => (
              <Satir key={o.ortakAnahtari}>
                <Hucre><span className="font-medium">{o.ortakAnahtari}</span></Hucre>
                <Hucre sagda>{o.gunSayisi}</Hucre>
                <Hucre sagda>{o.oyuncuSayisi}</Hucre>
                <Hucre sagda>{o.aktifOyuncuSayisi}</Hucre>
                <Hucre sagda>{paraBicimi(o.yatirim)}</Hucre>
                <Hucre sagda>{paraBicimi(o.cekim)}</Hucre>
                <Hucre sagda>{paraBicimi(o.ggr)}</Hucre>
                <Hucre><Egilim noktalar={o.gunlukGgr.map((g) => g.ggr)} /></Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>
    </>
  );
}
