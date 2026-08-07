import { useState } from 'react';
import { api, gunBicimi, paraBicimi, useVeri } from '../../api';
import { Bos, Buton, Hata, Hucre, Kart, Olcu, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';

interface Hakedis {
  brutGelir: number;
  yonetimGideri: number;
  netGelir: number;
  hesapTabani: number;
  gelirPayi: number;
  cpaPayi: number;
  cpaHesaplanamadiSebebi: string | null;
  toplam: number;
  odenecek: number;
  sonrakiDevredenZarar: number;
  sonrakiDevredenOdeme: number;
}

interface Satirveri {
  ortakAnahtari: string;
  ortakAdi: string;
  planAdi: string | null;
  hakedis: Hakedis;
  kademeGeliri: number;
  odenecekToplam: number;
}

interface Donem {
  ay: string;
  durum: 'taslak' | 'onaylandi' | 'odendi';
  satirlar: Satirveri[];
  toplamOdenecek: number;
  hesaplandi: string;
  onaylandi: string | null;
  odendi: string | null;
  uyarilar: string[];
}

const DURUM_RENGI = { taslak: 'uyari', onaylandi: 'olumlu', odendi: 'olumlu' } as const;
const DURUM_ETIKETI = { taslak: 'Taslak', onaylandi: 'Onaylandı', odendi: 'Ödendi' } as const;

const buAy = () => new Date().toISOString().slice(0, 7);

export function Donemler() {
  const [ay, setAy] = useState(buAy());
  const liste = useVeri<{ donemler: Array<Omit<Donem, 'satirlar'>> }>('/api/yonetim/donemler');
  const [donem, setDonem] = useState<Donem | null>(null);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const calistir = async (is: () => Promise<Donem>) => {
    setIslemHatasi(null);
    setCalisiyor(true);
    try {
      setDonem(await is());
      liste.yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'İşlem başarısız.');
    } finally {
      setCalisiyor(false);
    }
  };

  if (liste.yukleniyor) return <Yukleniyor />;

  return (
    <>
      <Kart baslik="Dönem hesapla">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Taslak dönem her açılışta yeniden hesaplanır — ölçümler gün içinde güncellenir. Onaylandıktan
          sonra <strong>dondurulur</strong>: ortağa söylenen rakamla defterdeki rakam ayrışmasın diye.
          Devir zinciri yalnızca onaylanmış dönemlerden okunur.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--metin-2)' }}>Ay</span>
            <input
              type="month"
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ background: 'var(--yuzey-2)', borderColor: 'var(--kenar)', color: 'var(--metin)' }}
              value={ay}
              onChange={(e) => setAy(e.target.value)}
            />
          </label>
          <Buton tur="birincil" devredisi={calisiyor} onClick={() => calistir(() => api.gonder<Donem>(`/api/yonetim/donemler/${ay}/hesapla`))}>
            Hesapla
          </Buton>
          <Buton devredisi={calisiyor} onClick={() => calistir(() => api.al<Donem>(`/api/yonetim/donemler/${ay}`))}>
            Getir
          </Buton>
        </div>
      </Kart>

      {(islemHatasi || liste.hata) && <Hata mesaj={islemHatasi ?? liste.hata!} />}

      {donem && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Olcu etiket="Dönem" deger={donem.ay} alt={DURUM_ETIKETI[donem.durum]} />
            <Olcu etiket="Ortak" deger={String(donem.satirlar.length)} />
            <Olcu etiket="Toplam ödenecek" deger={paraBicimi(donem.toplamOdenecek)} />
            <Olcu etiket="Hesaplandı" deger={gunBicimi(donem.hesaplandi)} />
          </div>

          {donem.uyarilar.length > 0 && (
            <Kart baslik="Uyarılar">
              <ul className="space-y-1 text-sm" style={{ color: 'var(--uyari)' }}>
                {donem.uyarilar.map((u) => <li key={u}>• {u}</li>)}
              </ul>
            </Kart>
          )}

          <Kart
            baslik={`${donem.ay} hakedişi`}
            sag={
              <div className="flex items-center gap-2">
                <Rozet metin={DURUM_ETIKETI[donem.durum]} renk={DURUM_RENGI[donem.durum]} />
                {donem.durum === 'taslak' && (
                  <Buton tur="birincil" devredisi={calisiyor} onClick={() => calistir(() => api.gonder<Donem>(`/api/yonetim/donemler/${donem.ay}/onayla`))}>
                    Onayla
                  </Buton>
                )}
                {donem.durum === 'onaylandi' && (
                  <Buton tur="birincil" devredisi={calisiyor} onClick={() => calistir(() => api.gonder<Donem>(`/api/yonetim/donemler/${donem.ay}/odendi`))}>
                    Ödendi işaretle
                  </Buton>
                )}
              </div>
            }
          >
            {donem.satirlar.length === 0 ? (
              <Bos mesaj="Bu dönemde hesaplanan ortak yok. Onaylı ortak ve komisyon planı gerekiyor." />
            ) : (
              <Tablo basliklar={['Ortak', 'Plan', 'Brüt', 'Net', 'Taban', 'Gelir payı', 'CPA', 'Kademe', 'Ödenecek']}>
                {donem.satirlar.map((s) => (
                  <Satir key={s.ortakAnahtari}>
                    <Hucre>
                      <div className="font-medium">{s.ortakAdi}</div>
                      <code className="text-xs" style={{ color: 'var(--metin-2)' }}>{s.ortakAnahtari}</code>
                    </Hucre>
                    <Hucre><span className="text-xs">{s.planAdi ?? '—'}</span></Hucre>
                    <Hucre sagda>{paraBicimi(s.hakedis.brutGelir)}</Hucre>
                    <Hucre sagda>{paraBicimi(s.hakedis.netGelir)}</Hucre>
                    <Hucre sagda>{paraBicimi(s.hakedis.hesapTabani)}</Hucre>
                    <Hucre sagda>{paraBicimi(s.hakedis.gelirPayi)}</Hucre>
                    <Hucre sagda>
                      {s.hakedis.cpaHesaplanamadiSebebi
                        ? <span title={s.hakedis.cpaHesaplanamadiSebebi} style={{ color: 'var(--uyari)' }}>ölçülemedi</span>
                        : paraBicimi(s.hakedis.cpaPayi)}
                    </Hucre>
                    <Hucre sagda>{paraBicimi(s.kademeGeliri)}</Hucre>
                    <Hucre sagda><strong>{paraBicimi(s.odenecekToplam)}</strong></Hucre>
                  </Satir>
                ))}
              </Tablo>
            )}
          </Kart>
        </>
      )}

      <Kart baslik="Dönem geçmişi">
        {(liste.veri?.donemler ?? []).length === 0 ? (
          <Bos mesaj="Henüz hesaplanmış dönem yok." />
        ) : (
          <Tablo basliklar={['Ay', 'Durum', 'Toplam', 'Hesaplandı', 'Onaylandı', 'Ödendi']}>
            {liste.veri!.donemler.map((d) => (
              <Satir key={d.ay}>
                <Hucre><button type="button" className="underline" onClick={() => { setAy(d.ay); calistir(() => api.al<Donem>(`/api/yonetim/donemler/${d.ay}`)); }}>{d.ay}</button></Hucre>
                <Hucre><Rozet metin={DURUM_ETIKETI[d.durum]} renk={DURUM_RENGI[d.durum]} /></Hucre>
                <Hucre sagda>{paraBicimi(d.toplamOdenecek)}</Hucre>
                <Hucre>{gunBicimi(d.hesaplandi)}</Hucre>
                <Hucre>{gunBicimi(d.onaylandi)}</Hucre>
                <Hucre>{gunBicimi(d.odendi)}</Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>
    </>
  );
}
