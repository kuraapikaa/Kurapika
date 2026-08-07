import { useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';

interface Ayar {
  ortakAnahtari: string;
  sablon: string;
  olaylar: string[];
  aktif: boolean;
  updatedAt: string;
}

interface Kayit {
  id: string;
  ortakAnahtari: string;
  olay: string;
  url: string;
  durum: 'basarili' | 'basarisiz' | 'engellendi';
  httpDurum: number | null;
  mesaj: string | null;
  gonderildi: string;
}

const OLAYLAR = ['tiklama', 'kayit', 'ilk-yatirim', 'yatirim', 'onaylanan-komisyon'];

const DURUM_RENGI = { basarili: 'olumlu', basarisiz: 'olumsuz', engellendi: 'uyari' } as const;

export function Postback() {
  const { veri, yukleniyor, hata, yenile } = useVeri<{ ayarlar: Ayar[]; kayitlar: Kayit[] }>('/api/yonetim/postback');
  const [ortakAnahtari, setOrtakAnahtari] = useState('');
  const [sablon, setSablon] = useState('');
  const [secili, setSecili] = useState<string[]>(['ilk-yatirim']);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);

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
      <Kart baslik="Postback ayarı">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Adres yalnızca <strong>https</strong> olabilir ve iç ağa çözümlenen adresler engellenir —
          isteği bizim sunucumuz attığı için kontrol edilmeyen bir adres, iç servislerimize erişim
          kapısı olurdu. Makrolar: <code>{'{clickid}'}</code> <code>{'{payout}'}</code>{' '}
          <code>{'{event}'}</code> <code>{'{btag}'}</code> <code>{'{sub1}'}</code>…
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Alan etiket="Ortak anahtarı" deger={ortakAnahtari} degisti={setOrtakAnahtari} />
          <Alan etiket="Şablon" deger={sablon} degisti={setSablon} ipucu="https://tracker.ornek.com/pb?cid={clickid}" />
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          {OLAYLAR.map((o) => (
            <label key={o} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={secili.includes(o)}
                onChange={(e) => setSecili(e.target.checked ? [...secili, o] : secili.filter((x) => x !== o))}
              />
              <span>{o}</span>
            </label>
          ))}
        </div>

        <div className="mt-3">
          <Buton
            tur="birincil"
            onClick={() => calistir(async () => {
              await api.yaz('/api/yonetim/postback', { ortakAnahtari, sablon, olaylar: secili, aktif: true });
              setOrtakAnahtari('');
              setSablon('');
            })}
          >
            Kaydet
          </Buton>
        </div>
      </Kart>

      {(islemHatasi || hata) && <Hata mesaj={islemHatasi ?? hata!} />}

      <Kart baslik="Ayarlar">
        {(veri?.ayarlar ?? []).length === 0 ? (
          <Bos mesaj="Postback ayarı yok." />
        ) : (
          <Tablo basliklar={['Ortak', 'Şablon', 'Olaylar', 'Durum', 'İşlem']}>
            {veri!.ayarlar.map((a) => (
              <Satir key={a.ortakAnahtari}>
                <Hucre><code className="text-xs">{a.ortakAnahtari}</code></Hucre>
                <Hucre><span className="block max-w-sm truncate text-xs" title={a.sablon}>{a.sablon}</span></Hucre>
                <Hucre><span className="text-xs">{a.olaylar.join(', ')}</span></Hucre>
                <Hucre><Rozet metin={a.aktif ? 'Aktif' : 'Pasif'} renk={a.aktif ? 'olumlu' : 'notr'} /></Hucre>
                <Hucre>
                  <Buton
                    tur="tehlike"
                    onClick={() => calistir(() => api.sil(`/api/yonetim/postback/${encodeURIComponent(a.ortakAnahtari)}`))}
                  >
                    Sil
                  </Buton>
                </Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>

      <Kart baslik="Son gönderimler">
        {(veri?.kayitlar ?? []).length === 0 ? (
          <Bos mesaj="Henüz gönderim yok." />
        ) : (
          <Tablo basliklar={['Zaman', 'Ortak', 'Olay', 'Durum', 'Açıklama']}>
            {veri!.kayitlar.slice(0, 50).map((k) => (
              <Satir key={k.id}>
                <Hucre>{gunBicimi(k.gonderildi)}</Hucre>
                <Hucre><code className="text-xs">{k.ortakAnahtari}</code></Hucre>
                <Hucre>{k.olay}</Hucre>
                <Hucre><Rozet metin={k.durum} renk={DURUM_RENGI[k.durum]} /></Hucre>
                <Hucre>
                  <span className="text-xs" style={{ color: 'var(--metin-2)' }}>
                    {k.mesaj ?? (k.httpDurum ? `HTTP ${k.httpDurum}` : '—')}
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
