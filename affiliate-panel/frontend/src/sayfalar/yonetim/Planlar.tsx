import { useState } from 'react';
import { api, paraBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Onay, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';
import type { KomisyonPlani as Plan } from '@sunucu/sozlesme.js';

type Kademe = Plan['gelirKademeleri'][number];

const TUR_ETIKETI = { 'gelir-payi': 'Gelir payı', cpa: 'CPA', hibrit: 'Hibrit' } as const;

/**
 * İşletme payı varsayılanı 0.
 *
 * Önceden %20 hazır geliyordu. Bu alan ortağın payının hesaplandığı
 * TABANI küçültüyor; hazır gelen bir değer, kimsenin karar vermediği
 * bir kesintinin sessizce uygulanması demek. Sıfırdan başlayıp bilinçli
 * girilmesi doğru.
 */
const BOS_PLAN = {
  ad: '', tur: 'gelir-payi', gelirPayiYuzde: '30', cpaTutari: '0',
  yonetimGideriYuzde: '0', yonetimGideriSabit: '0',
  asgariOdeme: '0', negatifDevir: true, varsayilan: false,
  // "esik:yuzde" ciftleri, satir satir. Bos birakilirsa duz oran gecerli.
  kademeler: '', kademeModu: 'topluca',
};

/** "0:25" satirlarini API'nin bekledigi listeye cevirir. */
function kademeleriCoz(ham: string): Kademe[] {
  return ham
    // Satir sonu ya da noktali virgul; kullanici hangisini yazarsa yazsin.
    .split(/[\r\n;]+/)
    .map((satir) => satir.trim())
    .filter(Boolean)
    .map((satir) => {
      const [esik, yuzde] = satir.split(':').map((p) => Number(p.trim()));
      return { esik, yuzde };
    });
}

const kademeOzeti = (p: Plan): string => {
  if (!p.gelirKademeleri?.length) return `%${p.gelirPayiYuzde}`;
  const mod = p.kademeModu === 'dilimli' ? 'dilimli' : 'topluca';
  return `${p.gelirKademeleri.map((k) => `${k.esik}+ → %${k.yuzde}`).join(', ')} (${mod})`;
};

/**
 * HAZIR PLAN SABLONLARI.
 *
 * Bos formdan bir hibrit plan kurmak, hangi alanlarin birlikte anlamli
 * oldugunu bilmeyi gerektiriyor: hibritte hem yuzde hem CPA dolmali,
 * kademeli planda ilk esik 0 olmali. Sablon bu bilgiyi forma tasiyor;
 * kullanici degistirip kaydediyor.
 *
 * Oranlar SEKTOR ORTALAMASINA yakin tutuldu ama baglayici degil --
 * sablonun isi dogru SEKLI vermek, dogru RAKAMI degil.
 */
const SABLONLAR: Array<{ ad: string; aciklama: string; deger: Partial<typeof BOS_PLAN> }> = [
  {
    ad: 'Gelir payı (düz)',
    aciklama: 'Tek oran. En basit ve en kolay anlatılan model.',
    deger: { ad: 'Gelir payı %30', tur: 'gelir-payi', gelirPayiYuzde: '30', cpaTutari: '0', kademeler: '' },
  },
  {
    ad: 'Gelir payı (kademeli)',
    aciklama: 'Hacim büyüdükçe oran artar; ortağı büyümeye teşvik eder.',
    deger: {
      ad: 'Kademeli gelir payı', tur: 'gelir-payi', gelirPayiYuzde: '25', cpaTutari: '0',
      kademeler: ['0:25', '10000:35', '50000:45'].join('\n'), kademeModu: 'topluca',
    },
  },
  {
    ad: 'CPA',
    aciklama: 'Oyuncu başı sabit ödeme. Ortak için öngörülebilir, site için riskli.',
    deger: { ad: 'CPA 500', tur: 'cpa', gelirPayiYuzde: '0', cpaTutari: '500', kademeler: '' },
  },
  {
    ad: 'Hibrit',
    aciklama: 'Düşürülmüş gelir payı + oyuncu başı ödeme. İkisinin riski paylaşılır.',
    deger: { ad: 'Hibrit %15 + 250', tur: 'hibrit', gelirPayiYuzde: '15', cpaTutari: '250', kademeler: '' },
  },
];

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
      <Kart baslik="Hazır şablonlar">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Şablon formu doldurur; rakamları değiştirip kaydedin. Oranlar sektör ortalamasına yakın
          örneklerdir, bağlayıcı değildir.
        </p>
        <div className="grid gap-2 md:grid-cols-4">
          {SABLONLAR.map((sb) => (
            <button
              key={sb.ad}
              type="button"
              className="rounded-lg border p-3 text-left transition-opacity hover:opacity-80"
              style={{ background: 'var(--yuzey-2)', borderColor: 'var(--kenar)' }}
              onClick={() => setForm({ ...BOS_PLAN, ...sb.deger })}
            >
              <span className="block text-sm font-medium">{sb.ad}</span>
              <span className="mt-1 block text-xs" style={{ color: 'var(--metin-2)' }}>{sb.aciklama}</span>
            </button>
          ))}
        </div>
      </Kart>

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
            ipucu="KENDİ giderleriniz (ödeme/oyun sağlayıcı payı). Brütten düşülür, kalan üzerinden ortak payı hesaplanır. Backoffice sizden ücret almıyorsa 0 bırakın."
          />
          <Alan
            etiket="İşletme payı (sabit)"
            deger={form.yonetimGideriSabit}
            degisti={(v) => setForm({ ...form, yonetimGideriSabit: v })}
            tip="number"
            ipucu="Dönem başına sabit gider. Brüt geliri aşamaz: gelirin olmadığı ay ortağı borçlu çıkarmaz."
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

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Alan
            etiket="Kademeler (opsiyonel)"
            deger={form.kademeler}
            degisti={(v) => setForm({ ...form, kademeler: v })}
            cokSatir
            ipucu="Her satıra bir kademe: eşik:yüzde. Örn. 0:25 / 10000:35 / 50000:45. İlk eşik 0 olmalı. Boşsa yukarıdaki düz oran geçerli."
          />
          <Alan
            etiket="Kademe uygulaması"
            deger={form.kademeModu}
            degisti={(v) => setForm({ ...form, kademeModu: v })}
            secenekler={[
              { deger: 'topluca', etiket: 'Toplu — ulaşılan oran tüm tutara' },
              { deger: 'dilimli', etiket: 'Dilimli — her dilim kendi oranıyla' },
            ]}
            ipucu="50.000’de %40 eşiği olan bir planda toplu 20.000, dilimli ~15.000 öder. Fark sözleşmeye göre değişir."
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
                yonetimGideriSabit: Number(form.yonetimGideriSabit),
                asgariOdeme: Number(form.asgariOdeme),
                gelirKademeleri: kademeleriCoz(form.kademeler),
                kademeModu: form.kademeModu,
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
          <Tablo basliklar={['Plan', 'Tür', 'Gelir payı / kademeler', 'CPA', 'İşletme payı', 'Asgari', 'Devir', 'İşlem']}>
            {veri!.planlar.map((p) => (
              <Satir key={p.id}>
                <Hucre>
                  <span className="font-medium">{p.ad}</span>{' '}
                  {p.varsayilan && <Rozet metin="varsayılan" renk="olumlu" />}
                </Hucre>
                <Hucre>{TUR_ETIKETI[p.tur]}</Hucre>
                <Hucre><span className="text-xs">{kademeOzeti(p)}</span></Hucre>
                <Hucre sagda>{paraBicimi(p.cpaTutari)}</Hucre>
                <Hucre sagda>
                  %{p.yonetimGideriYuzde}
                  {p.yonetimGideriSabit > 0 && (
                    <span className="text-xs"> + {paraBicimi(p.yonetimGideriSabit)}</span>
                  )}
                </Hucre>
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
