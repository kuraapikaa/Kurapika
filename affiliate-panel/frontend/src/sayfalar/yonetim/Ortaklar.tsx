import { useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';

interface Ortak {
  id: string;
  ortakAnahtari: string;
  ad: string;
  eposta: string;
  durum: 'bekliyor' | 'onaylandi' | 'askida' | 'reddedildi';
  planId: string | null;
  trafikKaynagi: string | null;
  parolaKurulu: boolean;
  createdAt: string;
}

interface Plan { id: string; ad: string }

const DURUM_RENGI = {
  bekliyor: 'uyari', onaylandi: 'olumlu', askida: 'olumsuz', reddedildi: 'olumsuz',
} as const;

const DURUM_ETIKETI = {
  bekliyor: 'Bekliyor', onaylandi: 'Onaylı', askida: 'Askıda', reddedildi: 'Reddedildi',
} as const;

export function Ortaklar() {
  const liste = useVeri<{ ortaklar: Ortak[] }>('/api/yonetim/ortaklar');
  const planlar = useVeri<{ planlar: Plan[] }>('/api/yonetim/planlar');
  const [hata, setHata] = useState<string | null>(null);
  const [yeni, setYeni] = useState({ ad: '', eposta: '', ortakAnahtari: '', parola: '' });

  const calistir = async (is: () => Promise<unknown>) => {
    setHata(null);
    try {
      await is();
      liste.yenile();
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'İşlem başarısız.');
    }
  };

  const planSecenekleri = [
    { deger: '', etiket: 'Varsayılan plan' },
    ...(planlar.veri?.planlar ?? []).map((p) => ({ deger: p.id, etiket: p.ad })),
  ];

  if (liste.yukleniyor) return <Yukleniyor />;

  return (
    <>
      <Kart baslik="Yeni ortak">
        <div className="grid gap-3 md:grid-cols-4">
          <Alan etiket="Ad" deger={yeni.ad} degisti={(v) => setYeni({ ...yeni, ad: v })} />
          <Alan etiket="E-posta" deger={yeni.eposta} degisti={(v) => setYeni({ ...yeni, eposta: v })} tip="email" />
          <Alan etiket="İzleme anahtarı" deger={yeni.ortakAnahtari} degisti={(v) => setYeni({ ...yeni, ortakAnahtari: v })} />
          <Alan etiket="Parola" deger={yeni.parola} degisti={(v) => setYeni({ ...yeni, parola: v })} tip="password" ipucu="En az 10 karakter" />
        </div>
        <div className="mt-3">
          <Buton
            tur="birincil"
            onClick={() => calistir(async () => {
              await api.gonder('/api/yonetim/ortaklar', yeni);
              setYeni({ ad: '', eposta: '', ortakAnahtari: '', parola: '' });
            })}
          >
            Ekle
          </Buton>
        </div>
      </Kart>

      {(hata || liste.hata) && <Hata mesaj={hata ?? liste.hata!} />}

      <Kart baslik="Ortaklar">
        {(liste.veri?.ortaklar ?? []).length === 0 ? (
          <Bos mesaj="Henüz ortak yok." />
        ) : (
          <Tablo basliklar={['Ortak', 'Anahtar', 'Durum', 'Plan', 'Kayıt', 'İşlem']}>
            {liste.veri!.ortaklar.map((o) => (
              <Satir key={o.id}>
                <Hucre>
                  <div className="font-medium">{o.ad}</div>
                  <div className="text-xs" style={{ color: 'var(--metin-2)' }}>{o.eposta}</div>
                  {!o.parolaKurulu && (
                    <div className="text-xs" style={{ color: 'var(--uyari)' }}>Parola kurulu değil — giriş yapamaz</div>
                  )}
                </Hucre>
                <Hucre><code className="text-xs">{o.ortakAnahtari}</code></Hucre>
                <Hucre><Rozet metin={DURUM_ETIKETI[o.durum]} renk={DURUM_RENGI[o.durum]} /></Hucre>
                <Hucre>
                  <select
                    className="rounded-lg border px-2 py-1 text-xs"
                    style={{ background: 'var(--yuzey-2)', borderColor: 'var(--kenar)', color: 'var(--metin)' }}
                    value={o.planId ?? ''}
                    onChange={(e) => calistir(() => api.yaz(`/api/yonetim/ortaklar/${o.id}`, { planId: e.target.value }))}
                  >
                    {planSecenekleri.map((p) => <option key={p.deger} value={p.deger}>{p.etiket}</option>)}
                  </select>
                </Hucre>
                <Hucre>{gunBicimi(o.createdAt)}</Hucre>
                <Hucre>
                  <div className="flex flex-wrap gap-1">
                    {o.durum !== 'onaylandi' && (
                      <Buton onClick={() => calistir(() => api.yaz(`/api/yonetim/ortaklar/${o.id}`, { durum: 'onaylandi' }))}>
                        Onayla
                      </Buton>
                    )}
                    {o.durum !== 'askida' && (
                      <Buton onClick={() => calistir(() => api.yaz(`/api/yonetim/ortaklar/${o.id}`, { durum: 'askida' }))}>
                        Askıya al
                      </Buton>
                    )}
                    <Buton
                      tur="tehlike"
                      onClick={() => {
                        // Ortagi silmek olcumlerini ve gecmis hakedis
                        // satirlarini SAHIPSIZ birakiyor; onay olmadan
                        // tek tikla yapilmamali.
                        if (window.confirm(`${o.ad} silinsin mi? Geçmiş ölçümleri sahipsiz kalır.`)) {
                          calistir(() => api.sil(`/api/yonetim/ortaklar/${o.id}`));
                        }
                      }}
                    >
                      Sil
                    </Buton>
                  </div>
                </Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>
    </>
  );
}
