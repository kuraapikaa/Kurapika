import { paraBicimi, useVeri } from '../../api';
import { CubukListesi, OlcuKarti, ZamanSerisi } from '../../grafik';
import { Bos, Hata, Kart, Rozet, Yukleniyor } from '../../ui';

interface Ozet {
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

interface Ben {
  ad: string;
  ortakAnahtari: string;
  durum: 'bekliyor' | 'onaylandi' | 'askida' | 'reddedildi';
}

interface TiklamaOzeti {
  toplam: number;
  medyaBazinda: Array<{ medyaId: string | null; sayi: number }>;
  altBazinda: Array<{ anahtar: string; deger: string; sayi: number }>;
}

interface AltLink { id: string; kod: string; ad: string; aktif: boolean }

const DURUM_ETIKETI = {
  bekliyor: 'Başvurunuz inceleniyor', onaylandi: 'Onaylı', askida: 'Askıda', reddedildi: 'Reddedildi',
} as const;

/**
 * Son iki eşit yarıyı karşılaştırır.
 *
 * Önceki dönem yoksa `null` — sıfırdan yüzde değişim hesaplamak
 * "%100 artış" gibi anlamsız bir rakam üretir ve ilk ayında olan bir
 * ortağa yanlış bir başarı hissi verir.
 */
function degisimYuzdesi(seri: number[]): number | null {
  if (seri.length < 4) return null;
  const orta = Math.floor(seri.length / 2);
  const onceki = seri.slice(0, orta).reduce((t, n) => t + n, 0);
  const simdiki = seri.slice(orta).reduce((t, n) => t + n, 0);
  if (onceki === 0) return null;
  return ((simdiki - onceki) / Math.abs(onceki)) * 100;
}

export function PortalOzet() {
  const ben = useVeri<Ben>('/api/portal/ben');
  const ozet = useVeri<{ aralik: { start: string; end: string }; ozet: Ozet; altOrtaklar: string[] }>('/api/portal/ozet');
  const tiklama = useVeri<{ ozet: TiklamaOzeti | null }>('/api/portal/tiklamalar');
  const linkler = useVeri<{ linkler: AltLink[] }>('/api/portal/alt-linkler');

  if (ben.yukleniyor || ozet.yukleniyor) return <Yukleniyor />;
  if (ben.hata) return <Hata mesaj={ben.hata} />;

  const o = ozet.veri?.ozet;
  const seri = (o?.gunlukGgr ?? []).map((g) => ({ etiket: g.gun.slice(5), deger: g.ggr }));
  const t = tiklama.veri?.ozet;

  // Tiklama -> oyuncu donusumu. Tiklama yoksa oran ANLAMSIZ, "%0" degil.
  const donusum = t && t.toplam > 0 && o ? (o.oyuncuSayisi / t.toplam) * 100 : null;

  const linkAdi = new Map((linkler.veri?.linkler ?? []).map((l) => [l.kod, l.ad]));

  return (
    <>
      <Kart>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-semibold">{ben.veri?.ad}</span>
          <code className="text-xs" style={{ color: 'var(--metin-2)' }}>{ben.veri?.ortakAnahtari}</code>
          <Rozet
            metin={ben.veri ? DURUM_ETIKETI[ben.veri.durum] : ''}
            renk={ben.veri?.durum === 'onaylandi' ? 'olumlu' : 'uyari'}
          />
          <span className="ml-auto text-xs" style={{ color: 'var(--metin-2)' }}>
            {ozet.veri?.aralik.start} – {ozet.veri?.aralik.end}
          </span>
        </div>
        {ben.veri?.durum !== 'onaylandi' && (
          <p className="mt-2 text-sm" style={{ color: 'var(--uyari)' }}>
            Hesabınız onaylanana kadar izleme linki üretilemez. Onaydan önce gönderilen trafiğin
            hakedişi hesaplanmaz.
          </p>
        )}
      </Kart>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OlcuKarti
          etiket="GGR"
          deger={paraBicimi(o?.ggr ?? 0)}
          degisim={degisimYuzdesi(seri.map((s) => s.deger))}
          alt="son 30 gün"
        />
        <OlcuKarti etiket="Yatırım" deger={paraBicimi(o?.yatirim ?? 0)} />
        <OlcuKarti
          etiket="Oyuncu"
          deger={String(o?.oyuncuSayisi ?? 0)}
          alt={`${o?.aktifOyuncuSayisi ?? 0} aktif`}
        />
        <OlcuKarti
          etiket="Tıklama"
          deger={String(t?.toplam ?? 0)}
          alt={donusum === null ? 'dönüşüm hesaplanamıyor' : `%${donusum.toFixed(1)} dönüşüm`}
        />
      </div>

      <Kart baslik="Günlük GGR">
        <ZamanSerisi noktalar={seri} bosMesaj="Bu dönemde ölçüm yok." />
        {o?.ftdSayisi === null && (
          <p className="mt-3 text-xs" style={{ color: 'var(--metin-2)' }}>
            İlk yatırım (FTD) sayısı bu bağlantıdan ölçülemiyor; CPA bileşeni olan planlarda bu
            kalem hakedişte ayrıca işaretlenir.
          </p>
        )}
      </Kart>

      <div className="grid gap-3 lg:grid-cols-2">
        <Kart baslik="Alt kanal kırılımı">
          <CubukListesi
            satirlar={(t?.altBazinda ?? []).slice(0, 8).map((a) => ({
              etiket: `${a.anahtar} = ${a.deger}`,
              deger: a.sayi,
            }))}
            birim="tıklama"
            bosMesaj="Henüz alt kanal etiketli tıklama yok."
          />
        </Kart>

        <Kart baslik="Kreatif kırılımı">
          <CubukListesi
            satirlar={(t?.medyaBazinda ?? []).slice(0, 8).map((m) => ({
              etiket: m.medyaId ? (linkAdi.get(m.medyaId) ?? m.medyaId.slice(0, 8)) : 'Doğrudan',
              deger: m.sayi,
            }))}
            birim="tıklama"
            bosMesaj="Henüz tıklama yok."
          />
        </Kart>
      </div>

      {(ozet.veri?.altOrtaklar ?? []).length > 0 && (
        <Kart baslik="Getirdiğiniz ortaklar">
          <p className="mb-2 text-sm" style={{ color: 'var(--metin-2)' }}>
            Bu ortakların kazancından payınız, kendi kazancınızın üstüne eklenir.
          </p>
          <div className="flex flex-wrap gap-2">
            {ozet.veri!.altOrtaklar.map((a) => <code key={a} className="text-xs">{a}</code>)}
          </div>
        </Kart>
      )}

      {!o?.gunSayisi && !t?.toplam && (
        <Kart><Bos mesaj="Henüz veri yok. Alt link oluşturup paylaşmaya başlayın." /></Kart>
      )}
    </>
  );
}
