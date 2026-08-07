import { gunBicimi, useVeri } from '../../api';
import { Bos, Hata, Hucre, Kart, Olcu, Satir, Tablo, Yukleniyor } from '../../ui';

interface Ozet {
  toplam: number;
  medyaBazinda: Array<{ medyaId: string | null; sayi: number }>;
  altBazinda: Array<{ anahtar: string; deger: string; sayi: number }>;
}

interface Tiklama {
  clickId: string;
  medyaId: string | null;
  alt: Record<string, string>;
  referrer: string | null;
  zaman: string;
}

export function PortalTiklamalar() {
  const { veri, yukleniyor, hata } = useVeri<{ ozet: Ozet | null; tiklamalar: Tiklama[] }>('/api/portal/tiklamalar');

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  const ozet = veri?.ozet;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Olcu etiket="Tıklama" deger={String(ozet?.toplam ?? 0)} alt="son 30 gün" />
        <Olcu etiket="Kullanılan kreatif" deger={String(ozet?.medyaBazinda.length ?? 0)} />
        <Olcu etiket="Alt kanal" deger={String(ozet?.altBazinda.length ?? 0)} />
      </div>

      {ozet && ozet.altBazinda.length > 0 && (
        <Kart baslik="Alt kanal kırılımı">
          <Tablo basliklar={['Alan', 'Değer', 'Tıklama']}>
            {ozet.altBazinda.map((a) => (
              <Satir key={`${a.anahtar}|${a.deger}`}>
                <Hucre>{a.anahtar}</Hucre>
                <Hucre>{a.deger}</Hucre>
                <Hucre sagda>{a.sayi}</Hucre>
              </Satir>
            ))}
          </Tablo>
        </Kart>
      )}

      <Kart baslik="Son tıklamalar">
        {(veri?.tiklamalar ?? []).length === 0 ? (
          <Bos mesaj="Henüz tıklama yok. İzlemeli linki kullandığınızda burada görünür." />
        ) : (
          <Tablo basliklar={['Zaman', 'Kreatif', 'Alt kanallar', 'Kaynak']}>
            {veri!.tiklamalar.map((t) => (
              <Satir key={t.clickId}>
                <Hucre>{gunBicimi(t.zaman)}</Hucre>
                <Hucre><span className="text-xs">{t.medyaId ?? '—'}</span></Hucre>
                <Hucre>
                  <span className="text-xs">{Object.entries(t.alt).map(([a, d]) => `${a}=${d}`).join(' · ') || '—'}</span>
                </Hucre>
                <Hucre>
                  <span className="block max-w-xs truncate text-xs" style={{ color: 'var(--metin-2)' }} title={t.referrer ?? ''}>
                    {t.referrer ?? '—'}
                  </span>
                </Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>
    </>
  );
}
