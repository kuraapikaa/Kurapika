import { useEffect, useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { Alan, Buton, Hata, Kart, Onay, Rozet, Yukleniyor } from '../../ui';
import type { AdaptorTanimGorunumu as AdaptorTanimi, BaglantiGorunumu as Gorunum } from '@sunucu/sozlesme.js';


const YETENEK_ETIKETI: Record<string, string> = {
  'olcum-cekme': 'Ölçüm çekme',
  'ortak-listesi': 'Ortak listesi',
  'oyuncu-baglama': 'Oyuncu bağlama',
};

export function Baglanti() {
  const katalog = useVeri<{ adaptorler: AdaptorTanimi[] }>('/api/yonetim/adaptorler');
  const mevcut = useVeri<Gorunum>('/api/yonetim/baglanti');

  const [secilen, setSecilen] = useState('');
  const [ayar, setAyar] = useState<Record<string, string>>({});
  const [aktif, setAktif] = useState(true);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const [dogrulama, setDogrulama] = useState<{ baglandi: boolean; mesaj: string; ayrinti?: Record<string, unknown> } | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const tanimlar = katalog.veri?.adaptorler ?? [];
  const tanim = tanimlar.find((t) => t.ad === secilen) ?? null;

  useEffect(() => {
    if (!tanimlar.length) return;
    const kurulu = mevcut.veri?.kurulu ? mevcut.veri.adaptor : '';
    setSecilen((onceki) => onceki || kurulu || tanimlar[0].ad);
  }, [tanimlar.length, mevcut.veri]);

  useEffect(() => {
    if (!tanim) return;
    const kayitli = mevcut.veri?.kurulu && mevcut.veri.adaptor === tanim.ad ? mevcut.veri.ayar : {};
    const baslangic: Record<string, string> = {};
    for (const alan of tanim.alanlar) {
      // SIR alanlari BOS baslatiliyor. Kayitli deger maskeli geliyor
      // ("••••1234"); formu maskeyle doldurmak, kullanici baska bir alani
      // degistirdiginde parolanin maskeye ezilmesi demek olurdu.
      baslangic[alan.ad] = alan.sir ? '' : (kayitli[alan.ad] ?? alan.varsayilan ?? '');
    }
    setAyar(baslangic);
    if (mevcut.veri?.kurulu) setAktif(mevcut.veri.aktif);
  }, [tanim, mevcut.veri]);

  const calistir = async (is: () => Promise<unknown>) => {
    setIslemHatasi(null);
    setCalisiyor(true);
    try {
      await is();
      mevcut.yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'İşlem başarısız.');
    } finally {
      setCalisiyor(false);
    }
  };

  if (katalog.yukleniyor || mevcut.yukleniyor) return <Yukleniyor />;

  return (
    <>
      <Kart baslik="Mevcut bağlantı">
        {mevcut.veri?.kurulu ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <strong>{mevcut.veri.etiket}</strong>
            <Rozet metin={mevcut.veri.aktif ? 'Aktif' : 'Pasif'} renk={mevcut.veri.aktif ? 'olumlu' : 'notr'} />
            <span style={{ color: 'var(--metin-2)' }}>Güncellendi: {gunBicimi(mevcut.veri.updatedAt)}</span>
            <div className="ml-auto flex gap-2">
              <Buton
                devredisi={calisiyor}
                onClick={() => calistir(async () => setDogrulama(await api.gonder('/api/yonetim/baglanti/dogrula')))}
              >
                Bağlantıyı sına
              </Buton>
              <Buton tur="tehlike" devredisi={calisiyor} onClick={() => calistir(() => api.sil('/api/yonetim/baglanti'))}>
                Kaldır
              </Buton>
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--metin-2)' }}>
            Bağlantı kurulu değil. Panelin geri kalanı (ortaklar, medya, hakediş) çalışmaya devam eder;
            yalnızca ölçüm çekilemez.
          </p>
        )}

        {dogrulama && (
          <div className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: dogrulama.baglandi ? 'var(--olumlu)' : 'var(--olumsuz)' }}>
            <p style={{ color: dogrulama.baglandi ? 'var(--olumlu)' : 'var(--olumsuz)' }}>{dogrulama.mesaj}</p>
            {dogrulama.ayrinti && (
              <pre className="mt-2 overflow-x-auto text-xs" style={{ color: 'var(--metin-2)' }}>
                {JSON.stringify(dogrulama.ayrinti, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Kart>

      {islemHatasi && <Hata mesaj={islemHatasi} />}

      <Kart baslik="Bağlantı kur">
        <div className="mb-3 max-w-sm">
          <Alan
            etiket="Backoffice türü"
            deger={secilen}
            degisti={setSecilen}
            secenekler={tanimlar.map((t) => ({ deger: t.ad, etiket: t.etiket }))}
          />
        </div>

        {tanim && (
          <>
            <p className="mb-2 text-sm" style={{ color: 'var(--metin-2)' }}>{tanim.aciklama}</p>
            <div className="mb-4 flex flex-wrap gap-1">
              {tanim.yetenekler.map((y) => <Rozet key={y} metin={YETENEK_ETIKETI[y] ?? y} />)}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {tanim.alanlar.map((alan) => (
                <Alan
                  key={alan.ad}
                  etiket={`${alan.etiket}${alan.zorunlu ? ' *' : ''}`}
                  deger={ayar[alan.ad] ?? ''}
                  degisti={(v) => setAyar({ ...ayar, [alan.ad]: v })}
                  tip={alan.tur === 'parola' ? 'password' : alan.tur === 'sayi' ? 'number' : 'text'}
                  cokSatir={alan.tur === 'cokSatir'}
                  secenekler={alan.secenekler}
                  ipucu={
                    alan.sir && mevcut.veri?.kurulu && mevcut.veri.adaptor === tanim.ad
                      ? `${alan.ipucu ? `${alan.ipucu} · ` : ''}Kayıtlı: ${mevcut.veri.ayar[alan.ad] ?? '—'}. Boş bırakılırsa değişmez.`
                      : alan.ipucu
                  }
                />
              ))}
            </div>

            <div className="mt-3 flex items-center gap-4">
              <Onay etiket="Aktif" deger={aktif} degisti={setAktif} />
              <Buton
                tur="birincil"
                devredisi={calisiyor}
                onClick={() => calistir(() => api.yaz('/api/yonetim/baglanti', { adaptor: tanim.ad, ayar, aktif }))}
              >
                Kaydet
              </Buton>
            </div>
          </>
        )}
      </Kart>
    </>
  );
}
