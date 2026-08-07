import { useState } from 'react';
import { api, useVeri } from '../../api';
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
  odemeYontemi: string | null;
  createdAt: string;
}

interface Plan { id: string; ad: string }

interface OdemeYontemleri {
  yontemler: string[];
  kaynak: 'backoffice' | 'yok' | 'hata';
  mesaj?: string;
}

const DURUM_RENGI = {
  bekliyor: 'uyari', onaylandi: 'olumlu', askida: 'olumsuz', reddedildi: 'olumsuz',
} as const;

const DURUM_ETIKETI = {
  bekliyor: 'Bekliyor', onaylandi: 'Onaylı', askida: 'Askıda', reddedildi: 'Reddedildi',
} as const;

export function Ortaklar() {
  const liste = useVeri<{ ortaklar: Ortak[] }>('/api/yonetim/ortaklar');
  const planlar = useVeri<{ planlar: Plan[] }>('/api/yonetim/planlar');
  // Odeme yontemleri backoffice'ten: serbest metin "Papara", "papara",
  // "PAPARA TR" gibi uc ayri deger uretiyor ve odeme gunu hangisinin
  // hangisi oldugu elle cozuluyordu.
  const odeme = useVeri<OdemeYontemleri>('/api/yonetim/odeme-yontemleri');
  const [hata, setHata] = useState<string | null>(null);
  const [yeni, setYeni] = useState({ ad: '', eposta: '', ortakAnahtari: '', parola: '' });
  // Uretilen parola YALNIZCA burada, bir kez gorunur; hicbir listede yok.
  const [uretilen, setUretilen] = useState<{ ad: string; parola: string } | null>(null);

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

      {uretilen && (
        <Kart baslik="Yeni parola">
          <p className="mb-2 text-sm">
            <strong>{uretilen.ad}</strong> için yeni parola:
          </p>
          <code
            className="block break-all rounded-lg border px-3 py-2 text-sm"
            style={{ background: 'var(--yuzey-2)', borderColor: 'var(--kenar)' }}
          >
            {uretilen.parola}
          </code>
          <p className="mt-2 text-xs" style={{ color: 'var(--uyari)' }}>
            Bu parola bir daha gösterilmeyecek — depoda yalnızca geri çevrilemez özeti tutuluyor.
            Ortağa iletin, sonra bu kutuyu kapatın.
          </p>
          <div className="mt-2">
            <Buton onClick={() => setUretilen(null)}>Kapat</Buton>
          </div>
        </Kart>
      )}

      <Kart
        baslik="Ödeme yöntemleri"
        sag={<Buton onClick={() => odeme.yenile()}>Backoffice’ten yenile</Buton>}
      >
        {odeme.veri?.kaynak === 'backoffice' && odeme.veri.yontemler.length > 0 ? (
          <>
            <p className="mb-2 text-sm" style={{ color: 'var(--metin-2)' }}>
              Son 90 günde gerçekten para geçmiş {odeme.veri.yontemler.length} yöntem. Ortağın ödeme
              yöntemi bu listeden seçiliyor.
            </p>
            <div className="flex flex-wrap gap-1">
              {odeme.veri.yontemler.map((y) => <Rozet key={y} metin={y} />)}
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--metin-2)' }}>
            {odeme.veri?.kaynak === 'hata'
              ? `Backoffice’ten okunamadı: ${odeme.veri.mesaj}. Ödeme yöntemi serbest metin olarak girilecek.`
              : 'Backoffice bağlantısı yok; ödeme yöntemi serbest metin olarak girilecek.'}
          </p>
        )}
      </Kart>

      <Kart baslik="Ortaklar">
        {(liste.veri?.ortaklar ?? []).length === 0 ? (
          <Bos mesaj="Henüz ortak yok." />
        ) : (
          <Tablo basliklar={['Ortak', 'Anahtar', 'Durum', 'Plan', 'Ödeme yöntemi', 'İşlem']}>
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
                <Hucre>
                  {(odeme.veri?.yontemler ?? []).length > 0 ? (
                    <select
                      className="rounded-lg border px-2 py-1 text-xs"
                      style={{ background: 'var(--yuzey-2)', borderColor: 'var(--kenar)', color: 'var(--metin)' }}
                      value={o.odemeYontemi ?? ''}
                      onChange={(e) => calistir(() => api.yaz(`/api/yonetim/ortaklar/${o.id}`, { odemeYontemi: e.target.value }))}
                    >
                      <option value="">Seçilmedi</option>
                      {/* Ortagin mevcut degeri listede yoksa yine de gorunmeli;
                          aksi halde secici onu sessizce bosaltirdi. */}
                      {o.odemeYontemi && !(odeme.veri?.yontemler ?? []).includes(o.odemeYontemi) && (
                        <option value={o.odemeYontemi}>{o.odemeYontemi} (listede yok)</option>
                      )}
                      {(odeme.veri?.yontemler ?? []).map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  ) : (
                    <span className="text-xs">{o.odemeYontemi ?? '—'}</span>
                  )}
                </Hucre>
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
                      onClick={() => calistir(async () => {
                        const y = await api.gonder<{ parola: string }>(`/api/yonetim/ortaklar/${o.id}/parola-sifirla`);
                        setUretilen({ ad: o.ad, parola: y.parola });
                      })}
                    >
                      Parola sıfırla
                    </Buton>
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
