import { useState } from 'react';
import { api, paraBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Onay, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';

interface Plan {
  id: string;
  ad: string;
  tur: 'gelir-payi' | 'cpa' | 'hibrit';
  gelirPayiYuzde: number;
  cpaTutari: number;
  yonetimGideriYuzde: number;
  asgariOdeme: number;
  negatifDevir: boolean;
  varsayilan: boolean;
}

const TUR_ETIKETI = { 'gelir-payi': 'Gelir payı', cpa: 'CPA', hibrit: 'Hibrit' } as const;

const BOS_PLAN = {
  ad: '', tur: 'gelir-payi', gelirPayiYuzde: '30', cpaTutari: '0',
  yonetimGideriYuzde: '20', asgariOdeme: '0', negatifDevir: true, varsayilan: false,
};

export function Planlar() {
  const { veri, yukleniyor, hata, yenile } = useVeri<{ planlar: Plan[] }>('/api/yonetim/planlar');
  const [form, setForm] = useState({ ...BOS_PLAN });
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
      <Kart baslik="Yeni komisyon planı">
        <div className="grid gap-3 md:grid-cols-3">
          <Alan etiket="Plan adı" deger={form.ad} degisti={(v) => setForm({ ...form, ad: v })} />
          <Alan
            etiket="Tür"
            deger={form.tur}
            degisti={(v) => setForm({ ...form, tur: v })}
            secenekler={[
              { deger: 'gelir-payi', etiket: 'Gelir payı (RevShare)' },
              { deger: 'cpa', etiket: 'CPA' },
              { deger: 'hibrit', etiket: 'Hibrit' },
            ]}
          />
          <Alan
            etiket="İşletme payı %"
            deger={form.yonetimGideriYuzde}
            degisti={(v) => setForm({ ...form, yonetimGideriYuzde: v })}
            tip="number"
            ipucu="Brütten düşülüp net gelir bulunur."
          />
          <Alan
            etiket="Gelir payı %"
            deger={form.gelirPayiYuzde}
            degisti={(v) => setForm({ ...form, gelirPayiYuzde: v })}
            tip="number"
          />
          <Alan
            etiket="CPA tutarı"
            deger={form.cpaTutari}
            degisti={(v) => setForm({ ...form, cpaTutari: v })}
            tip="number"
            ipucu="İlk yatırım başına. Toplam düzeyinde rapor veren bağlantılarda ölçülemez."
          />
          <Alan
            etiket="Asgari ödeme"
            deger={form.asgariOdeme}
            degisti={(v) => setForm({ ...form, asgariOdeme: v })}
            tip="number"
            ipucu="Altında kalan tutar ödenmez, sonraki aya devreder."
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Onay
            etiket="Negatif ay sonraki döneme devretsin"
            deger={form.negatifDevir}
            degisti={(v) => setForm({ ...form, negatifDevir: v })}
          />
          <Onay etiket="Varsayılan plan" deger={form.varsayilan} degisti={(v) => setForm({ ...form, varsayilan: v })} />
          <Buton
            tur="birincil"
            onClick={() => calistir(async () => {
              await api.gonder('/api/yonetim/planlar', {
                ...form,
                gelirPayiYuzde: Number(form.gelirPayiYuzde),
                cpaTutari: Number(form.cpaTutari),
                yonetimGideriYuzde: Number(form.yonetimGideriYuzde),
                asgariOdeme: Number(form.asgariOdeme),
              });
              setForm({ ...BOS_PLAN });
            })}
          >
            Plan ekle
          </Buton>
        </div>
      </Kart>

      {(islemHatasi || hata) && <Hata mesaj={islemHatasi ?? hata!} />}

      <Kart baslik="Planlar">
        {(veri?.planlar ?? []).length === 0 ? (
          <Bos mesaj="Plan yok. Plan tanımlanmadan hiçbir hakediş hesaplanamaz." />
        ) : (
          <Tablo basliklar={['Plan', 'Tür', 'Gelir payı', 'CPA', 'İşletme payı', 'Asgari', 'Devir', 'İşlem']}>
            {veri!.planlar.map((p) => (
              <Satir key={p.id}>
                <Hucre>
                  <span className="font-medium">{p.ad}</span>{' '}
                  {p.varsayilan && <Rozet metin="varsayılan" renk="olumlu" />}
                </Hucre>
                <Hucre>{TUR_ETIKETI[p.tur]}</Hucre>
                <Hucre sagda>%{p.gelirPayiYuzde}</Hucre>
                <Hucre sagda>{paraBicimi(p.cpaTutari)}</Hucre>
                <Hucre sagda>%{p.yonetimGideriYuzde}</Hucre>
                <Hucre sagda>{paraBicimi(p.asgariOdeme)}</Hucre>
                <Hucre>{p.negatifDevir ? 'Açık' : 'Kapalı'}</Hucre>
                <Hucre>
                  <div className="flex gap-1">
                    {!p.varsayilan && (
                      <Buton onClick={() => calistir(() => api.yaz(`/api/yonetim/planlar/${p.id}`, { varsayilan: true }))}>
                        Varsayılan yap
                      </Buton>
                    )}
                    <Buton tur="tehlike" onClick={() => calistir(() => api.sil(`/api/yonetim/planlar/${p.id}`))}>Sil</Buton>
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
