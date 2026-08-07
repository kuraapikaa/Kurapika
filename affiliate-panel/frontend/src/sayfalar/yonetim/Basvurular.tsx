import { useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Kart, Olcu, Rozet, Yukleniyor } from '../../ui';

interface Basvuru {
  kanallar: string[];
  promosyonYontemleri: string[];
  ulkeler: string | null;
  aylikOyuncu: number | null;
  aylikTrafik: number | null;
  mevcutProgramlar: string | null;
  tercihEdilenModel: string | null;
  aciklama: string | null;
}

interface Ortak {
  id: string;
  ad: string;
  eposta: string;
  ortakAnahtari: string;
  trafikKaynagi: string | null;
  odemeYontemi: string | null;
  odemeDetayi: string | null;
  basvuru: Basvuru;
  createdAt: string;
}

interface Plan { id: string; ad: string }

const YONTEM_ETIKETI: Record<string, string> = {
  seo: 'SEO', ppc: 'PPC', 'sosyal-medya': 'Sosyal medya', 'e-posta': 'E-posta',
  yayin: 'Yayın', influencer: 'Influencer', telegram: 'Telegram',
  forum: 'Forum', uygulama: 'Uygulama', diger: 'Diğer',
};

const MODEL_ETIKETI: Record<string, string> = {
  'gelir-payi': 'Gelir payı', cpa: 'CPA', hibrit: 'Hibrit',
};

const sayi = (n: number | null) =>
  n === null ? '—' : new Intl.NumberFormat('tr-TR').format(n);

export function Basvurular() {
  const liste = useVeri<{ basvurular: Ortak[] }>('/api/yonetim/basvurular');
  const planlar = useVeri<{ planlar: Plan[] }>('/api/yonetim/planlar');
  const [hata, setHata] = useState<string | null>(null);
  const [planSecimi, setPlanSecimi] = useState<Record<string, string>>({});
  const [isleniyor, setIsleniyor] = useState<string | null>(null);

  const karar = async (id: string, durum: 'onaylandi' | 'reddedildi') => {
    setHata(null);
    setIsleniyor(id);
    try {
      // Onaylarken plan da atanıyor: onaylanmış ama plansız bir ortak,
      // varsayılan plana düşer ve bu sessizce yanlış oran olabilir.
      const govde: Record<string, unknown> = { durum };
      if (durum === 'onaylandi' && planSecimi[id]) govde.planId = planSecimi[id];
      await api.yaz(`/api/yonetim/ortaklar/${id}`, govde);
      liste.yenile();
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'İşlem başarısız.');
    } finally {
      setIsleniyor(null);
    }
  };

  if (liste.yukleniyor) return <Yukleniyor />;
  if (liste.hata) return <Hata mesaj={liste.hata} />;

  const basvurular = liste.veri?.basvurular ?? [];
  const beyanToplami = basvurular.reduce((t, o) => t + (o.basvuru.aylikOyuncu ?? 0), 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Olcu etiket="Bekleyen başvuru" deger={String(basvurular.length)} />
        <Olcu
          etiket="Beyan edilen aylık oyuncu"
          deger={sayi(beyanToplami)}
          alt="doğrulanmamış beyan"
        />
        <Olcu
          etiket="En eski bekleyen"
          deger={basvurular.length ? gunBicimi(basvurular[0].createdAt) : '—'}
        />
      </div>

      {hata && <Hata mesaj={hata} />}

      {basvurular.length === 0 ? (
        <Kart><Bos mesaj="Bekleyen başvuru yok." /></Kart>
      ) : (
        basvurular.map((o) => (
          <Kart
            key={o.id}
            baslik={o.ad}
            sag={<span className="text-xs" style={{ color: 'var(--metin-2)' }}>{gunBicimi(o.createdAt)}</span>}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1 text-sm">
                <Satir etiket="E-posta" deger={o.eposta} />
                <Satir etiket="İzleme anahtarı" deger={o.ortakAnahtari} kod />
                <Satir etiket="Ödeme" deger={[o.odemeYontemi, o.odemeDetayi].filter(Boolean).join(' · ') || null} />
                <Satir etiket="Tercih ettiği model" deger={o.basvuru.tercihEdilenModel ? MODEL_ETIKETI[o.basvuru.tercihEdilenModel] : null} />
              </div>

              <div className="space-y-1 text-sm">
                <Satir etiket="Ülkeler" deger={o.basvuru.ulkeler} />
                <Satir etiket="Aylık oyuncu (beyan)" deger={sayi(o.basvuru.aylikOyuncu)} />
                <Satir etiket="Aylık trafik (beyan)" deger={sayi(o.basvuru.aylikTrafik)} />
                <Satir etiket="Mevcut programlar" deger={o.basvuru.mevcutProgramlar} />
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="block text-xs" style={{ color: 'var(--metin-2)' }}>Trafik yöntemleri</span>
                  {o.basvuru.promosyonYontemleri.length === 0 ? (
                    <span style={{ color: 'var(--metin-2)' }}>—</span>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {o.basvuru.promosyonYontemleri.map((y) => (
                        <Rozet key={y} metin={YONTEM_ETIKETI[y] ?? y} />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <span className="block text-xs" style={{ color: 'var(--metin-2)' }}>Kanallar</span>
                  {o.basvuru.kanallar.length === 0 ? (
                    <span style={{ color: 'var(--metin-2)' }}>{o.trafikKaynagi ?? '—'}</span>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {o.basvuru.kanallar.map((k) => (
                        <li key={k} className="break-all text-xs">{k}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {o.basvuru.aciklama && (
              <p
                className="mt-3 rounded-lg border px-3 py-2 text-sm"
                style={{ background: 'var(--yuzey-2)', borderColor: 'var(--kenar)' }}
              >
                {o.basvuru.aciklama}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-48">
                <Alan
                  etiket="Atanacak plan"
                  deger={planSecimi[o.id] ?? ''}
                  degisti={(v) => setPlanSecimi({ ...planSecimi, [o.id]: v })}
                  secenekler={[
                    { deger: '', etiket: 'Varsayılan plan' },
                    ...(planlar.veri?.planlar ?? []).map((p) => ({ deger: p.id, etiket: p.ad })),
                  ]}
                />
              </div>
              <Buton tur="birincil" devredisi={isleniyor === o.id} onClick={() => karar(o.id, 'onaylandi')}>
                Onayla
              </Buton>
              <Buton tur="tehlike" devredisi={isleniyor === o.id} onClick={() => karar(o.id, 'reddedildi')}>
                Reddet
              </Buton>
            </div>
          </Kart>
        ))
      )}
    </>
  );
}

function Satir({ etiket, deger, kod = false }: { etiket: string; deger: string | null; kod?: boolean }) {
  return (
    <div>
      <span className="block text-xs" style={{ color: 'var(--metin-2)' }}>{etiket}</span>
      {deger ? (
        kod ? <code className="text-xs">{deger}</code> : <span className="break-words">{deger}</span>
      ) : (
        <span style={{ color: 'var(--metin-2)' }}>—</span>
      )}
    </div>
  );
}
