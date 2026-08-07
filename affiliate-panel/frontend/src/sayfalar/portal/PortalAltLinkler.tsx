import { useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';

interface AltLink {
  id: string;
  kod: string;
  ad: string;
  medyaId: string;
  alt: Record<string, string>;
  aktif: boolean;
  createdAt: string;
  tamAdres: string | null;
}

interface Medya { id: string; ad: string; tur: string }

const ALTLAR = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'] as const;

/**
 * ALT LİNKLER — ortağın kendi kampanya bağlantıları.
 *
 * Her seferinde parametreleri elle yazmak yerine bir kez kurulup isim
 * verilen kısa adresler. Aynı link her defasında aynı kırılıma yazıyor;
 * elle yazılan bir harf farkı trafiği ayrı bir kanal olarak sayardı ve
 * bu geriye dönük düzeltilemez.
 */
export function PortalAltLinkler() {
  const liste = useVeri<{ linkler: AltLink[]; temelHazir: boolean }>('/api/portal/alt-linkler');
  const medyalar = useVeri<{ medyalar: Medya[] }>('/api/portal/medya');
  const [form, setForm] = useState({ ad: '', medyaId: '' });
  const [alt, setAlt] = useState<Record<string, string>>({});
  const [hata, setHata] = useState<string | null>(null);
  const [kopyalanan, setKopyalanan] = useState<string | null>(null);

  const calistir = async (is: () => Promise<unknown>) => {
    setHata(null);
    try {
      await is();
      liste.yenile();
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'İşlem başarısız.');
    }
  };

  if (liste.yukleniyor) return <Yukleniyor />;

  const medyaSecenekleri = [
    { deger: '', etiket: 'Medya seçin' },
    ...(medyalar.veri?.medyalar ?? []).map((m) => ({ deger: m.id, etiket: `${m.ad} (${m.tur})` })),
  ];

  return (
    <>
      <Kart baslik="Yeni alt link">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Kampanya başına bir link kurun, isim verin. Kısa adres alırsınız; parametreler adreste
          <strong> görünmez</strong>, kayıttan gelir. Böylece kanal isimlendirmeniz dışarıya sızmaz
          ve linki elle düzenleyen biri trafiği başka bir kırılıma yazamaz.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Alan etiket="Link adı" deger={form.ad} degisti={(v) => setForm({ ...form, ad: v })} ipucu="örn. Instagram bio — Ekim" />
          <Alan
            etiket="Medya"
            deger={form.medyaId}
            degisti={(v) => setForm({ ...form, medyaId: v })}
            secenekler={medyaSecenekleri}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-5">
          {ALTLAR.map((a) => (
            <Alan key={a} etiket={a} deger={alt[a] ?? ''} degisti={(v) => setAlt({ ...alt, [a]: v })} />
          ))}
        </div>

        <div className="mt-3">
          <Buton
            tur="birincil"
            onClick={() => calistir(async () => {
              await api.gonder('/api/portal/alt-linkler', { ...form, alt });
              setForm({ ad: '', medyaId: '' });
              setAlt({});
            })}
          >
            Oluştur
          </Buton>
        </div>
      </Kart>

      {(hata || liste.hata) && <Hata mesaj={hata ?? liste.hata!} />}

      {liste.veri && !liste.veri.temelHazir && (
        <Kart>
          <p className="text-sm" style={{ color: 'var(--uyari)' }}>
            Panel yöneticisi tıklama adresini tanımlamamış; linkler üretiliyor ama paylaşılabilir
            tam adres oluşturulamıyor.
          </p>
        </Kart>
      )}

      <Kart baslik="Alt linkleriniz">
        {(liste.veri?.linkler ?? []).length === 0 ? (
          <Bos mesaj="Henüz alt link yok." />
        ) : (
          <Tablo basliklar={['Ad', 'Adres', 'Alt kanallar', 'Durum', 'Oluşturma', 'İşlem']}>
            {liste.veri!.linkler.map((l) => (
              <Satir key={l.id}>
                <Hucre><span className="font-medium">{l.ad}</span></Hucre>
                <Hucre>
                  {l.tamAdres ? (
                    <div className="flex items-center gap-2">
                      <code className="break-all text-xs">{l.tamAdres}</code>
                      <button
                        type="button"
                        className="shrink-0 text-xs underline"
                        onClick={() => {
                          // `clipboard` HTTPS disinda reddediyor; sessiz
                          // kalmak "kopyalandi" yanilgisi yaratirdi.
                          navigator.clipboard.writeText(l.tamAdres!)
                            .then(() => setKopyalanan(l.id))
                            .catch(() => setKopyalanan(null));
                        }}
                      >
                        {kopyalanan === l.id ? 'Kopyalandı' : 'Kopyala'}
                      </button>
                    </div>
                  ) : (
                    <code className="text-xs">/l/{l.kod}</code>
                  )}
                </Hucre>
                <Hucre>
                  <span className="text-xs">
                    {Object.entries(l.alt).map(([a, d]) => `${a}=${d}`).join(' · ') || '—'}
                  </span>
                </Hucre>
                <Hucre><Rozet metin={l.aktif ? 'Aktif' : 'Kapalı'} renk={l.aktif ? 'olumlu' : 'notr'} /></Hucre>
                <Hucre>{gunBicimi(l.createdAt)}</Hucre>
                <Hucre>
                  <div className="flex gap-1">
                    <Buton onClick={() => calistir(() => api.yaz(`/api/portal/alt-linkler/${l.id}`, { aktif: !l.aktif }))}>
                      {l.aktif ? 'Kapat' : 'Aç'}
                    </Buton>
                    <Buton
                      tur="tehlike"
                      onClick={() => {
                        // Silinen linkin gecmis tiklamalari kalir ama link
                        // olu baglantiya doner; paylasilmis bir adresi
                        // sessizce kirmamak icin onay soruluyor.
                        if (window.confirm(`"${l.ad}" silinsin mi? Paylaştığınız adres çalışmayı durdurur.`)) {
                          calistir(() => api.sil(`/api/portal/alt-linkler/${l.id}`));
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
