import { paraBicimi, useVeri } from '../../api';
import { Bos, Egilim, Hata, Hucre, Kart, Olcu, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';

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
  eposta: string;
  ortakAnahtari: string;
  durum: 'bekliyor' | 'onaylandi' | 'askida' | 'reddedildi';
  odemeYontemi: string | null;
  odemeDetayi: string | null;
}

const DURUM_ETIKETI = {
  bekliyor: 'Başvurunuz inceleniyor', onaylandi: 'Onaylı', askida: 'Askıda', reddedildi: 'Reddedildi',
} as const;

export function PortalOzet() {
  const ben = useVeri<Ben>('/api/portal/ben');
  const ozet = useVeri<{ aralik: { start: string; end: string }; ozet: Ozet; altOrtaklar: string[] }>('/api/portal/ozet');

  if (ben.yukleniyor || ozet.yukleniyor) return <Yukleniyor />;
  if (ben.hata) return <Hata mesaj={ben.hata} />;

  const o = ozet.veri?.ozet;

  return (
    <>
      <Kart baslik="Hesabınız">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <strong>{ben.veri?.ad}</strong>
          <code className="text-xs">{ben.veri?.ortakAnahtari}</code>
          <Rozet
            metin={ben.veri ? DURUM_ETIKETI[ben.veri.durum] : ''}
            renk={ben.veri?.durum === 'onaylandi' ? 'olumlu' : 'uyari'}
          />
        </div>
        {ben.veri?.durum !== 'onaylandi' && (
          <p className="mt-2 text-sm" style={{ color: 'var(--uyari)' }}>
            Hesabınız onaylanana kadar izleme linki üretilemez. Onaydan önce gönderilen trafiğin
            hakedişi hesaplanmaz.
          </p>
        )}
      </Kart>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Olcu etiket="Oyuncu" deger={String(o?.oyuncuSayisi ?? 0)} alt={`${o?.aktifOyuncuSayisi ?? 0} aktif`} />
        <Olcu etiket="Yatırım" deger={paraBicimi(o?.yatirim ?? 0)} />
        <Olcu etiket="GGR" deger={paraBicimi(o?.ggr ?? 0)} />
        <Olcu
          etiket="İlk yatırım"
          deger={o?.ftdSayisi === null || o?.ftdSayisi === undefined ? '—' : String(o.ftdSayisi)}
          alt={o?.ftdSayisi === null ? 'ölçülemiyor' : undefined}
        />
      </div>

      <Kart baslik={`Günlük GGR · ${ozet.veri?.aralik.start} – ${ozet.veri?.aralik.end}`}>
        {!o || o.gunlukGgr.length === 0 ? (
          <Bos mesaj="Bu dönemde ölçüm yok." />
        ) : (
          <>
            <div className="mb-3"><Egilim noktalar={o.gunlukGgr.map((g) => g.ggr)} /></div>
            <Tablo basliklar={['Gün', 'GGR']}>
              {[...o.gunlukGgr].reverse().slice(0, 31).map((g) => (
                <Satir key={g.gun}>
                  <Hucre>{g.gun}</Hucre>
                  <Hucre sagda>{paraBicimi(g.ggr)}</Hucre>
                </Satir>
              ))}
            </Tablo>
          </>
        )}
      </Kart>

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
    </>
  );
}
