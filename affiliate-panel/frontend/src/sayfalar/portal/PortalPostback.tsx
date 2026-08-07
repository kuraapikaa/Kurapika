import { useEffect, useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';

interface Ayar { sablon: string; olaylar: string[]; aktif: boolean; updatedAt: string }
interface Kayit {
  id: string;
  olay: string;
  durum: 'basarili' | 'basarisiz' | 'engellendi';
  httpDurum: number | null;
  mesaj: string | null;
  gonderildi: string;
}

const OLAYLAR = ['tiklama', 'kayit', 'ilk-yatirim', 'yatirim', 'onaylanan-komisyon'];
const DURUM_RENGI = { basarili: 'olumlu', basarisiz: 'olumsuz', engellendi: 'uyari' } as const;

export function PortalPostback() {
  const { veri, yukleniyor, hata, yenile } = useVeri<{ ayar: Ayar | null; kayitlar: Kayit[] }>('/api/portal/postback');
  const [sablon, setSablon] = useState('');
  const [secili, setSecili] = useState<string[]>([]);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);

  useEffect(() => {
    if (veri?.ayar) {
      setSablon(veri.ayar.sablon);
      setSecili(veri.ayar.olaylar);
    }
  }, [veri?.ayar]);

  const kaydet = async () => {
    setIslemHatasi(null);
    setKaydedildi(false);
    try {
      await api.yaz('/api/portal/postback', { sablon, olaylar: secili, aktif: true });
      setKaydedildi(true);
      yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'Kaydedilemedi.');
    }
  };

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  return (
    <>
      <Kart baslik="Postback adresiniz">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Bir dönüşüm olduğunda sunucumuz bu adrese istek atar. Yalnızca <strong>https</strong>{' '}
          kabul edilir ve iç ağa çözümlenen adresler reddedilir. Kullanabileceğiniz makrolar:{' '}
          <code>{'{clickid}'}</code> <code>{'{payout}'}</code> <code>{'{event}'}</code>{' '}
          <code>{'{btag}'}</code> <code>{'{sub1}'}</code>…<code>{'{sub5}'}</code>
        </p>

        <Alan etiket="Şablon" deger={sablon} degisti={setSablon} ipucu="https://tracker.ornek.com/pb?cid={clickid}&payout={payout}" />

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

        <div className="mt-3 flex items-center gap-3">
          <Buton tur="birincil" onClick={kaydet}>Kaydet</Buton>
          {kaydedildi && <span className="text-sm" style={{ color: 'var(--olumlu)' }}>Kaydedildi.</span>}
        </div>

        {islemHatasi && <div className="mt-3"><Hata mesaj={islemHatasi} /></div>}
      </Kart>

      <Kart baslik="Gönderim geçmişi">
        {(veri?.kayitlar ?? []).length === 0 ? (
          <Bos mesaj="Henüz gönderim yok." />
        ) : (
          <Tablo basliklar={['Zaman', 'Olay', 'Durum', 'Açıklama']}>
            {veri!.kayitlar.map((k) => (
              <Satir key={k.id}>
                <Hucre>{gunBicimi(k.gonderildi)}</Hucre>
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
