import { useEffect, useState } from 'react';
import { api, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Satir, Tablo, Yukleniyor } from '../../ui';
import type { YonetimUclari } from '@sunucu/sozlesme.js';

type Durum = YonetimUclari['/kademeler'];

export function Kademeler() {
  const { veri, yukleniyor, hata, yenile } = useVeri<Durum>('/api/yonetim/kademeler');
  const [yuzdeler, setYuzdeler] = useState('');
  const [alt, setAlt] = useState('');
  const [ust, setUst] = useState('');
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);

  useEffect(() => {
    if (veri) setYuzdeler(veri.kademeYuzdeleri.join(', '));
  }, [veri]);

  const calistir = async (is: () => Promise<unknown>) => {
    setIslemHatasi(null);
    try {
      await is();
      yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'İşlem başarısız.');
    }
  };

  if (yukleniyor) return <Yukleniyor />;

  return (
    <>
      <Kart baslik="Kademe yüzdeleri">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Bir ortak, getirdiği alt ortakların kazancından pay alır. Pay alt ortağın kazancından{' '}
          <strong>kesilmez</strong>, üstüne eklenir — bu bir pazarlama gideridir. Toplam %100’ü geçemez.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Alan
              etiket="Seviye yüzdeleri"
              deger={yuzdeler}
              degisti={setYuzdeler}
              ipucu="Virgülle ayrılmış. Örn. 5, 2 → 1. seviye %5, 2. seviye %2."
            />
          </div>
          <Buton
            tur="birincil"
            onClick={() => calistir(() => api.yaz('/api/yonetim/kademeler/yuzdeler', {
              yuzdeler: yuzdeler.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)),
            }))}
          >
            Kaydet
          </Buton>
        </div>
      </Kart>

      <Kart baslik="Yeni bağ">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1"><Alan etiket="Alt ortak anahtarı" deger={alt} degisti={setAlt} /></div>
          <div className="min-w-48 flex-1"><Alan etiket="Üst ortak anahtarı" deger={ust} degisti={setUst} /></div>
          <Buton
            tur="birincil"
            onClick={() => calistir(async () => {
              await api.gonder('/api/yonetim/kademeler/bag', { ortakAnahtari: alt, ustOrtakAnahtari: ust });
              setAlt('');
              setUst('');
            })}
          >
            Bağla
          </Buton>
        </div>
      </Kart>

      {(islemHatasi || hata) && <Hata mesaj={islemHatasi ?? hata!} />}

      <Kart baslik="Bağlar">
        {(veri?.baglar ?? []).length === 0 ? (
          <Bos mesaj="Kademe bağı yok; tüm ortaklar düz seviyede." />
        ) : (
          <Tablo basliklar={['Alt ortak', 'Üst ortak', 'İşlem']}>
            {veri!.baglar.map((b) => (
              <Satir key={b.ortakAnahtari}>
                <Hucre><code className="text-xs">{b.ortakAnahtari}</code></Hucre>
                <Hucre><code className="text-xs">{b.ustOrtakAnahtari}</code></Hucre>
                <Hucre>
                  <Buton
                    tur="tehlike"
                    onClick={() => calistir(() => api.sil(`/api/yonetim/kademeler/bag/${encodeURIComponent(b.ortakAnahtari)}`))}
                  >
                    Kaldır
                  </Buton>
                </Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>
    </>
  );
}
