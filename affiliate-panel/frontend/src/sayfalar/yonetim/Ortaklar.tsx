import { useState } from 'react';
import { api, useVeri } from '../../api';
import { Alan, Buton, Hata, Kart, Rozet, Yukleniyor } from '../../ui';
import { FiltrePaneli, KisaKimlik, VeriTablosu, type Sutun } from '../../tablo';

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
  const [filtre, setFiltre] = useState<Record<string, string>>({ ad: '', durum: '', plan: '' });

  const calistir = async (is: () => Promise<unknown>) => {
    setHata(null);
    try {
      await is();
      liste.yenile();
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'İşlem başarısız.');
    }
  };

  const planAdi = new Map((planlar.veri?.planlar ?? []).map((p) => [p.id, p.ad]));

  // Filtreleme ISTEMCIDE: veri zaten tamami cekilmis durumda. Liste
  // sayfalanmaya basladiginda bu sunucuya tasinmali; `filtre` durumu
  // oraya parametre olarak gecer, ekranin geri kalani ayni kalir.
  const sutunSatirlari = (liste.veri?.ortaklar ?? []).filter((o) => {
    const q = filtre.ad.trim().toLowerCase();
    if (q && ![o.ad, o.eposta, o.ortakAnahtari].some((x) => x.toLowerCase().includes(q))) return false;
    if (filtre.durum && o.durum !== filtre.durum) return false;
    if (filtre.plan && o.planId !== filtre.plan) return false;
    return true;
  });

  const sutunlar: Array<Sutun<Ortak>> = [
    {
      ad: 'ortak',
      etiket: 'Ortak',
      deger: (o) => o.ad,
      hucre: (o) => (
        <div>
          <div className="font-medium">{o.ad}</div>
          <div className="text-xs" style={{ color: 'var(--metin-2)' }}>{o.eposta}</div>
          {!o.parolaKurulu && (
            <div className="text-xs" style={{ color: 'var(--uyari)' }}>Parola yok — giriş yapamaz</div>
          )}
        </div>
      ),
    },
    { ad: 'anahtar', etiket: 'Anahtar', deger: (o) => o.ortakAnahtari, hucre: (o) => <KisaKimlik deger={o.ortakAnahtari} /> },
    {
      ad: 'durum',
      etiket: 'Durum',
      deger: (o) => o.durum,
      hucre: (o) => <Rozet metin={DURUM_ETIKETI[o.durum]} renk={DURUM_RENGI[o.durum]} />,
    },
    {
      ad: 'plan',
      etiket: 'Plan',
      deger: (o) => planAdi.get(o.planId ?? '') ?? '',
      hucre: (o) => (
        <select
          className="rounded-lg border px-2 py-1 text-xs"
          style={{ background: 'var(--yuzey-2)', borderColor: 'var(--kenar)', color: 'var(--metin)' }}
          value={o.planId ?? ''}
          onChange={(e) => calistir(() => api.yaz(`/api/yonetim/ortaklar/${o.id}`, { planId: e.target.value }))}
        >
          <option value="">Varsayılan</option>
          {(planlar.veri?.planlar ?? []).map((p) => <option key={p.id} value={p.id}>{p.ad}</option>)}
        </select>
      ),
    },
    {
      ad: 'odeme',
      etiket: 'Ödeme yöntemi',
      deger: (o) => o.odemeYontemi ?? '',
      hucre: (o) => ((odeme.veri?.yontemler ?? []).length > 0 ? (
        <select
          className="rounded-lg border px-2 py-1 text-xs"
          style={{ background: 'var(--yuzey-2)', borderColor: 'var(--kenar)', color: 'var(--metin)' }}
          value={o.odemeYontemi ?? ''}
          onChange={(e) => calistir(() => api.yaz(`/api/yonetim/ortaklar/${o.id}`, { odemeYontemi: e.target.value }))}
        >
          <option value="">Seçilmedi</option>
          {/* Ortagin mevcut degeri listede yoksa yine de gorunmeli; aksi
              halde secici onu sessizce bosaltirdi. */}
          {o.odemeYontemi && !(odeme.veri?.yontemler ?? []).includes(o.odemeYontemi) && (
            <option value={o.odemeYontemi}>{o.odemeYontemi} (listede yok)</option>
          )}
          {(odeme.veri?.yontemler ?? []).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      ) : (
        <span className="text-xs">{o.odemeYontemi ?? '—'}</span>
      )),
    },
    { ad: 'kayit', etiket: 'Kayıt', deger: (o) => o.createdAt, hucre: (o) => <span className="text-xs">{o.createdAt.slice(0, 10)}</span> },
    {
      ad: 'islem',
      etiket: 'İşlem',
      hucre: (o) => (
        <div className="flex flex-wrap gap-1">
          {o.durum !== 'onaylandi' && (
            <Buton onClick={() => calistir(() => api.yaz(`/api/yonetim/ortaklar/${o.id}`, { durum: 'onaylandi' }))}>Onayla</Buton>
          )}
          {o.durum !== 'askida' && (
            <Buton onClick={() => calistir(() => api.yaz(`/api/yonetim/ortaklar/${o.id}`, { durum: 'askida' }))}>Askıya al</Buton>
          )}
          <Buton
            onClick={() => calistir(async () => {
              const y = await api.gonder<{ parola: string }>(`/api/yonetim/ortaklar/${o.id}/parola-sifirla`);
              setUretilen({ ad: o.ad, parola: y.parola });
            })}
          >
            Parola
          </Buton>
          <Buton
            tur="tehlike"
            onClick={() => {
              // Silmek olcumleri ve gecmis hakedis satirlarini SAHIPSIZ
              // birakiyor; onaysiz tek tikla yapilmamali.
              if (window.confirm(`${o.ad} silinsin mi? Geçmiş ölçümleri sahipsiz kalır.`)) {
                calistir(() => api.sil(`/api/yonetim/ortaklar/${o.id}`));
              }
            }}
          >
            Sil
          </Buton>
        </div>
      ),
    },
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

      <FiltrePaneli
        deger={filtre}
        uygulandi={setFiltre}
        alanlar={[
          { ad: 'ad', etiket: 'Ortak / e-posta / anahtar' },
          {
            ad: 'durum',
            etiket: 'Durum',
            secenekler: [
              { deger: '', etiket: 'Hepsi' },
              { deger: 'onaylandi', etiket: 'Onaylı' },
              { deger: 'bekliyor', etiket: 'Bekliyor' },
              { deger: 'askida', etiket: 'Askıda' },
              { deger: 'reddedildi', etiket: 'Reddedildi' },
            ],
          },
          {
            ad: 'plan',
            etiket: 'Plan',
            secenekler: [
              { deger: '', etiket: 'Hepsi' },
              ...(planlar.veri?.planlar ?? []).map((p) => ({ deger: p.id, etiket: p.ad })),
            ],
          },
        ]}
      />

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
        <VeriTablosu
          satirlar={sutunSatirlari}
          anahtar={(o) => o.id}
          bosMesaj="Filtreye uyan ortak yok."
          varsayilanSiralama={{ ad: 'kayit', yon: 'azalan' }}
          sutunlar={sutunlar}
        />
      </Kart>
    </>
  );
}
