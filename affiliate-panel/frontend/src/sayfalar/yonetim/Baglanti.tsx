import { useEffect, useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Onay, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';
import type { AdaptorTanimGorunumu as AdaptorTanimi, BaglantiGorunumu as Gorunum } from '@sunucu/sozlesme.js';
import { AKIS_IKONU, NasilCalisir } from '../../sihirbaz';


const YETENEK_ETIKETI: Record<string, string> = {
  'olcum-cekme': 'Ölçüm çekme',
  'ortak-listesi': 'Ortak listesi',
  'oyuncu-baglama': 'Oyuncu bağlama',
};

type Dogrulama = { baglandi: boolean; mesaj: string; ayrinti?: Record<string, unknown> };

export function Baglanti() {
  const katalog = useVeri<{ adaptorler: AdaptorTanimi[] }>('/api/yonetim/adaptorler');
  const baglantilar = useVeri<{ baglantilar: Gorunum[] }>('/api/yonetim/baglantilar');

  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);
  const [ad, setAd] = useState('');
  const [secilen, setSecilen] = useState('');
  const [ayar, setAyar] = useState<Record<string, string>>({});
  const [aktif, setAktif] = useState(true);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const [dogrulamalar, setDogrulamalar] = useState<Record<string, Dogrulama>>({});
  const [calisiyor, setCalisiyor] = useState(false);

  const tanimlar = katalog.veri?.adaptorler ?? [];
  const tanim = tanimlar.find((t) => t.ad === secilen) ?? null;

  const varsayilanAyar = (t: AdaptorTanimi | undefined, kayitli: Record<string, string> = {}) => {
    const cikti: Record<string, string> = {};
    for (const alan of t?.alanlar ?? []) {
      // SIR alanlari BOS baslatiliyor. Kayitli deger maskeli geliyor
      // ("••••1234"); formu maskeyle doldurmak, kullanici baska bir alani
      // degistirdiginde parolanin maskeye ezilmesi demek olurdu.
      cikti[alan.ad] = alan.sir ? '' : (kayitli[alan.ad] ?? alan.varsayilan ?? '');
    }
    return cikti;
  };

  useEffect(() => {
    if (!tanimlar.length || secilen) return;
    setSecilen(tanimlar[0].ad);
    setAyar(varsayilanAyar(tanimlar[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanimlar.length]);

  const adaptorDegistir = (yeni: string) => {
    setSecilen(yeni);
    setAyar(varsayilanAyar(tanimlar.find((t) => t.ad === yeni)));
  };

  const baslaYeni = () => {
    setDuzenlenenId(null);
    setAd('');
    setAktif(true);
    if (tanimlar.length) {
      setSecilen(tanimlar[0].ad);
      setAyar(varsayilanAyar(tanimlar[0]));
    }
  };

  const baslaDuzenle = (b: Gorunum) => {
    setDuzenlenenId(b.id);
    setAd(b.ad);
    setSecilen(b.adaptor);
    setAktif(b.aktif);
    setAyar(varsayilanAyar(tanimlar.find((t) => t.ad === b.adaptor), b.ayar));
  };

  const calistir = async (is: () => Promise<unknown>) => {
    setIslemHatasi(null);
    setCalisiyor(true);
    try {
      await is();
      baglantilar.yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'İşlem başarısız.');
    } finally {
      setCalisiyor(false);
    }
  };

  if (katalog.yukleniyor || baglantilar.yukleniyor) return <Yukleniyor />;

  const liste = baglantilar.veri?.baglantilar ?? [];

  return (
    <>
      <Kart baslik="Backoffice bağlantısı nasıl çalışır">
        <p className="mb-4 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>
          Panelin hiçbir servisi, hiçbir ekranı ve hiçbir komisyon hesabı sağlayıcının alan adlarını
          bilmez. Dışarının şekli tek bir <strong style={{ color: 'var(--metin)' }}>adaptör</strong>{' '}
          arayüzünde içerinin modeline çevrilir — yeni bir backoffice eklemek çekirdeğe, depoya,
          komisyona ya da arayüze dokunmadan tek bir dosya yazmaktan ibaret.
        </p>
        <NasilCalisir
          adimlar={[
            {
              ikon: AKIS_IKONU.sec,
              baslik: '1. Adaptörü seçin',
              metin: 'Kataloglu bir sağlayıcı ya da herhangi bir JSON API için genel REST.',
            },
            {
              ikon: AKIS_IKONU.adres,
              baslik: '2. Sırları girin',
              metin: 'Şifreleme anahtarı yoksa bağlantı kaydedilmez — düz metne düşmez.',
            },
            {
              ikon: AKIS_IKONU.test,
              baslik: '3. Doğrulayın ve açın',
              metin: 'Test çekimi yapılır, ölçümler karşılaştırılır, sonra canlıya alınır.',
            },
          ]}
        />
      </Kart>

      <Kart baslik="Bağlantılar">
        {liste.length === 0 ? (
          <Bos mesaj="Henüz backoffice bağlantısı kurulu değil. Panelin geri kalanı (ortaklar, medya, hakediş) çalışmaya devam eder; yalnızca ölçüm çekilemez." />
        ) : (
          <Tablo basliklar={['Ad', 'Tür', 'Durum', 'Güncellendi', 'İşlem']}>
            {liste.map((b) => (
              <Satir key={b.id}>
                <Hucre><strong>{b.ad}</strong></Hucre>
                <Hucre>{b.etiket}</Hucre>
                <Hucre><Rozet metin={b.aktif ? 'Aktif' : 'Pasif'} renk={b.aktif ? 'olumlu' : 'notr'} /></Hucre>
                <Hucre>{gunBicimi(b.updatedAt)}</Hucre>
                <Hucre>
                  <div className="flex flex-wrap gap-1">
                    <Buton
                      devredisi={calisiyor}
                      onClick={() => calistir(async () => {
                        const sonuc = await api.gonder<Dogrulama>(`/api/yonetim/baglantilar/${b.id}/dogrula`);
                        setDogrulamalar((onceki) => ({ ...onceki, [b.id]: sonuc }));
                      })}
                    >
                      Sına
                    </Buton>
                    <Buton devredisi={calisiyor} onClick={() => baslaDuzenle(b)}>Düzenle</Buton>
                    <Buton
                      tur="tehlike"
                      devredisi={calisiyor}
                      onClick={() => calistir(async () => {
                        await api.sil(`/api/yonetim/baglantilar/${b.id}`);
                        if (duzenlenenId === b.id) baslaYeni();
                      })}
                    >
                      Kaldır
                    </Buton>
                  </div>
                </Hucre>
              </Satir>
            ))}
          </Tablo>
        )}

        {Object.entries(dogrulamalar).map(([id, d]) => {
          const b = liste.find((x) => x.id === id);
          if (!b) return null;
          return (
            <div key={id} className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: d.baglandi ? 'var(--olumlu)' : 'var(--olumsuz)' }}>
              <p style={{ color: d.baglandi ? 'var(--olumlu)' : 'var(--olumsuz)' }}>{b.ad}: {d.mesaj}</p>
              {d.ayrinti && (
                <pre className="mt-2 overflow-x-auto text-xs" style={{ color: 'var(--metin-2)' }}>
                  {JSON.stringify(d.ayrinti, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </Kart>

      {islemHatasi && <Hata mesaj={islemHatasi} />}

      <Kart baslik={duzenlenenId ? 'Bağlantıyı düzenle' : 'Yeni bağlantı ekle'}>
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <Alan etiket="Ad" deger={ad} degisti={setAd} ipucu="örn. Narcosbahis. Boş bırakılırsa backoffice türü kullanılır." />
          <Alan
            etiket="Backoffice türü"
            deger={secilen}
            degisti={adaptorDegistir}
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
              {tanim.alanlar.map((alan) => {
                const duzenlenen = duzenlenenId ? liste.find((b) => b.id === duzenlenenId) : null;
                return (
                  <Alan
                    key={alan.ad}
                    etiket={`${alan.etiket}${alan.zorunlu ? ' *' : ''}`}
                    deger={ayar[alan.ad] ?? ''}
                    degisti={(v) => setAyar({ ...ayar, [alan.ad]: v })}
                    tip={alan.tur === 'parola' ? 'password' : alan.tur === 'sayi' ? 'number' : 'text'}
                    cokSatir={alan.tur === 'cokSatir'}
                    secenekler={alan.secenekler}
                    ipucu={
                      alan.sir && duzenlenen
                        ? `${alan.ipucu ? `${alan.ipucu} · ` : ''}Kayıtlı: ${duzenlenen.ayar[alan.ad] ?? '—'}. Boş bırakılırsa değişmez.`
                        : alan.ipucu
                    }
                  />
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-4">
              <Onay etiket="Aktif" deger={aktif} degisti={setAktif} />
              <Buton
                tur="birincil"
                devredisi={calisiyor}
                onClick={() => calistir(async () => {
                  const govde = { ad, adaptor: tanim.ad, ayar, aktif };
                  if (duzenlenenId) {
                    await api.yaz(`/api/yonetim/baglantilar/${duzenlenenId}`, govde);
                  } else {
                    await api.gonder('/api/yonetim/baglantilar', govde);
                  }
                  baslaYeni();
                })}
              >
                {duzenlenenId ? 'Güncelle' : 'Ekle'}
              </Buton>
              {duzenlenenId && (
                <Buton devredisi={calisiyor} onClick={baslaYeni}>Vazgeç</Buton>
              )}
            </div>
          </>
        )}
      </Kart>
    </>
  );
}
