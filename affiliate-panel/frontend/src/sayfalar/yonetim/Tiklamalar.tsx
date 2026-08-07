import { gunBicimi, useVeri } from '../../api';
import { Bos, Hata, Hucre, Kart, Satir, Tablo, Yukleniyor } from '../../ui';

interface Ozet {
  ortakAnahtari: string;
  toplam: number;
  medyaBazinda: Array<{ medyaId: string | null; sayi: number }>;
  altBazinda: Array<{ anahtar: string; deger: string; sayi: number }>;
}

interface Tiklama {
  clickId: string;
  ortakAnahtari: string;
  medyaId: string | null;
  alt: Record<string, string>;
  referrer: string | null;
  zaman: string;
}

export function Tiklamalar() {
  const { veri, yukleniyor, hata } = useVeri<{ ozet: Ozet[]; tiklamalar: Tiklama[] }>('/api/yonetim/tiklamalar');

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  return (
    <>
      <Kart baslik="Ortak bazında tıklama">
        {(veri?.ozet ?? []).length === 0 ? (
          <Bos mesaj="Henüz tıklama yok. Ortaklar izlemeli linki kullandığında burada görünür." />
        ) : (
          <Tablo basliklar={['Ortak', 'Tıklama', 'Kreatif kırılımı', 'Alt kanal kırılımı']}>
            {veri!.ozet.map((o) => (
              <Satir key={o.ortakAnahtari}>
                <Hucre><code className="text-xs">{o.ortakAnahtari}</code></Hucre>
                <Hucre sagda>{o.toplam}</Hucre>
                <Hucre>
                  <span className="text-xs" style={{ color: 'var(--metin-2)' }}>
                    {o.medyaBazinda.slice(0, 3).map((m) => `${m.medyaId ?? 'doğrudan'}: ${m.sayi}`).join(' · ') || '—'}
                  </span>
                </Hucre>
                <Hucre>
                  <span className="text-xs" style={{ color: 'var(--metin-2)' }}>
                    {o.altBazinda.slice(0, 3).map((a) => `${a.anahtar}=${a.deger}: ${a.sayi}`).join(' · ') || '—'}
                  </span>
                </Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>

      <Kart baslik="Son tıklamalar">
        {(veri?.tiklamalar ?? []).length === 0 ? (
          <Bos mesaj="Kayıt yok." />
        ) : (
          <Tablo basliklar={['Zaman', 'Ortak', 'Medya', 'Alt kanallar', 'Kaynak']}>
            {veri!.tiklamalar.slice(0, 100).map((t) => (
              <Satir key={t.clickId}>
                <Hucre>{gunBicimi(t.zaman)}</Hucre>
                <Hucre><code className="text-xs">{t.ortakAnahtari}</code></Hucre>
                <Hucre><span className="text-xs">{t.medyaId ?? '—'}</span></Hucre>
                <Hucre>
                  <span className="text-xs">
                    {Object.entries(t.alt).map(([a, d]) => `${a}=${d}`).join(' · ') || '—'}
                  </span>
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
