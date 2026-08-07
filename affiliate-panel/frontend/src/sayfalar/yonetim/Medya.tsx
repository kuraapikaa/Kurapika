import { useState } from 'react';
import { api, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Onay, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';
import type { Medya as MedyaKaydi } from '@sunucu/sozlesme.js';
type Medya = MedyaKaydi;


const BOS = { ad: '', tur: 'landing', hedefUrl: '', varlikUrl: '', olcu: '', ortakAnahtarlari: '', aktif: true };

export function Medya() {
  const { veri, yukleniyor, hata, yenile } = useVeri<{ medyalar: Medya[] }>('/api/yonetim/medya');
  const [form, setForm] = useState({ ...BOS });
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
      <Kart baslik="Yeni medya">
        <div className="grid gap-3 md:grid-cols-3">
          <Alan etiket="Ad" deger={form.ad} degisti={(v) => setForm({ ...form, ad: v })} />
          <Alan
            etiket="Tür"
            deger={form.tur}
            degisti={(v) => setForm({ ...form, tur: v })}
            secenekler={[
              { deger: 'landing', etiket: 'Landing sayfası' },
              { deger: 'banner', etiket: 'Banner' },
              { deger: 'metin', etiket: 'Metin linki' },
              { deger: 'video', etiket: 'Video' },
            ]}
          />
          <Alan etiket="Ölçü" deger={form.olcu} degisti={(v) => setForm({ ...form, olcu: v })} ipucu="örn. 300x250" />
          <Alan etiket="Hedef adres" deger={form.hedefUrl} degisti={(v) => setForm({ ...form, hedefUrl: v })} ipucu="Tıklayanın gideceği adres." />
          <Alan
            etiket="Kreatif adresi"
            deger={form.varlikUrl}
            degisti={(v) => setForm({ ...form, varlikUrl: v })}
            ipucu="Banner için zorunlu."
          />
          <Alan
            etiket="Kısıtlı ortaklar"
            deger={form.ortakAnahtarlari}
            degisti={(v) => setForm({ ...form, ortakAnahtarlari: v })}
            ipucu="Virgülle ayrılmış anahtarlar. Boşsa herkese açık."
          />
        </div>

        <div className="mt-3 flex items-center gap-4">
          <Onay etiket="Aktif" deger={form.aktif} degisti={(v) => setForm({ ...form, aktif: v })} />
          <Buton
            tur="birincil"
            onClick={() => calistir(async () => {
              await api.gonder('/api/yonetim/medya', {
                ...form,
                ortakAnahtarlari: form.ortakAnahtarlari.split(',').map((s) => s.trim()).filter(Boolean),
              });
              setForm({ ...BOS });
            })}
          >
            Ekle
          </Buton>
        </div>
      </Kart>

      {(islemHatasi || hata) && <Hata mesaj={islemHatasi ?? hata!} />}

      <Kart baslik="Medyalar">
        {(veri?.medyalar ?? []).length === 0 ? (
          <Bos mesaj="Henüz medya yok." />
        ) : (
          <Tablo basliklar={['Medya', 'Tür', 'Hedef', 'Erişim', 'Durum', 'İşlem']}>
            {veri!.medyalar.map((m) => (
              <Satir key={m.id}>
                <Hucre>
                  <div className="font-medium">{m.ad}</div>
                  {m.olcu && <div className="text-xs" style={{ color: 'var(--metin-2)' }}>{m.olcu}</div>}
                </Hucre>
                <Hucre>{m.tur}</Hucre>
                <Hucre>
                  <span className="block max-w-xs truncate text-xs" title={m.hedefUrl}>{m.hedefUrl}</span>
                </Hucre>
                <Hucre>
                  {m.ortakAnahtarlari.length === 0
                    ? <span className="text-xs" style={{ color: 'var(--metin-2)' }}>Herkese açık</span>
                    : <span className="text-xs">{m.ortakAnahtarlari.join(', ')}</span>}
                </Hucre>
                <Hucre><Rozet metin={m.aktif ? 'Aktif' : 'Pasif'} renk={m.aktif ? 'olumlu' : 'notr'} /></Hucre>
                <Hucre>
                  <div className="flex gap-1">
                    <Buton onClick={() => calistir(() => api.yaz(`/api/yonetim/medya/${m.id}`, { aktif: !m.aktif }))}>
                      {m.aktif ? 'Pasifleştir' : 'Aktifleştir'}
                    </Buton>
                    <Buton tur="tehlike" onClick={() => calistir(() => api.sil(`/api/yonetim/medya/${m.id}`))}>Sil</Buton>
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
