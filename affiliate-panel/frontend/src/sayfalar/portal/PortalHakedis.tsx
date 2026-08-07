import { paraBicimi, useVeri } from '../../api';
import { Bos, Hata, Hucre, Kart, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';

interface Satirveri {
  planAdi: string | null;
  kademeGeliri: number;
  odenecekToplam: number;
  hakedis: {
    brutGelir: number;
    netGelir: number;
    hesapTabani: number;
    gelirPayi: number;
    cpaPayi: number;
    cpaHesaplanamadiSebebi: string | null;
    toplam: number;
    odenecek: number;
    sonrakiDevredenZarar: number;
    sonrakiDevredenOdeme: number;
  };
}

interface Donem {
  ay: string;
  durum: 'onaylandi' | 'odendi';
  satir: Satirveri;
}

export function PortalHakedis() {
  const { veri, yukleniyor, hata } = useVeri<{ donemler: Donem[] }>('/api/portal/hakedis');

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  const donemler = veri?.donemler ?? [];

  return (
    <>
      <Kart baslik="Hakediş dönemleri">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Yalnızca <strong>onaylanmış</strong> dönemler görünür. Ay kapanmadan hesaplanan taslak
          rakamlar gün içinde değişebildiği için burada gösterilmiyor.
        </p>

        {donemler.length === 0 ? (
          <Bos mesaj="Onaylanmış dönem yok." />
        ) : (
          <Tablo basliklar={['Ay', 'Durum', 'Plan', 'Net gelir', 'Gelir payı', 'CPA', 'Kademe', 'Ödenecek']}>
            {donemler.map((d) => (
              <Satir key={d.ay}>
                <Hucre>{d.ay}</Hucre>
                <Hucre>
                  <Rozet metin={d.durum === 'odendi' ? 'Ödendi' : 'Onaylandı'} renk="olumlu" />
                </Hucre>
                <Hucre><span className="text-xs">{d.satir.planAdi ?? '—'}</span></Hucre>
                <Hucre sagda>{paraBicimi(d.satir.hakedis.netGelir)}</Hucre>
                <Hucre sagda>{paraBicimi(d.satir.hakedis.gelirPayi)}</Hucre>
                <Hucre sagda>
                  {d.satir.hakedis.cpaHesaplanamadiSebebi
                    ? <span title={d.satir.hakedis.cpaHesaplanamadiSebebi} style={{ color: 'var(--metin-2)' }}>—</span>
                    : paraBicimi(d.satir.hakedis.cpaPayi)}
                </Hucre>
                <Hucre sagda>{paraBicimi(d.satir.kademeGeliri)}</Hucre>
                <Hucre sagda><strong>{paraBicimi(d.satir.odenecekToplam)}</strong></Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>

      {donemler.some((d) => d.satir.hakedis.sonrakiDevredenOdeme > 0 || d.satir.hakedis.sonrakiDevredenZarar < 0) && (
        <Kart baslik="Devreden bakiye">
          <Tablo basliklar={['Ay', 'Devreden ödeme', 'Devreden zarar']}>
            {donemler
              .filter((d) => d.satir.hakedis.sonrakiDevredenOdeme > 0 || d.satir.hakedis.sonrakiDevredenZarar < 0)
              .map((d) => (
                <Satir key={d.ay}>
                  <Hucre>{d.ay}</Hucre>
                  <Hucre sagda>{paraBicimi(d.satir.hakedis.sonrakiDevredenOdeme)}</Hucre>
                  <Hucre sagda>{paraBicimi(d.satir.hakedis.sonrakiDevredenZarar)}</Hucre>
                </Satir>
              ))}
          </Tablo>
          <p className="mt-2 text-xs" style={{ color: 'var(--metin-2)' }}>
            Asgari ödemenin altında kalan tutar silinmez, sonraki döneme eklenir. Negatif net gelir
            varsa (büyük kazanan oyuncu) sonraki dönemin gelir tabanından düşülür.
          </p>
        </Kart>
      )}
    </>
  );
}
