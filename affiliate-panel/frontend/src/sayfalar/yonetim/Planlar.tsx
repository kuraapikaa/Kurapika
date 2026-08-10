import { useState } from 'react';
import { api, paraBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Onay, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';
import { DIKEY_ETIKETI, DIKEY_RENGI } from '../../dikey-gorunum';
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
 *
 * ── Dikey oranları da varsayılan olarak BOŞ ──
 *
 * Casino ve spor için ayrı oran girmek zorunlu değil: boş bırakılırsa
 * düz oran ikisine de uygulanıyor (bugünkü davranış). Hazır bir spor
 * oranı yazmak, kimsenin karar vermediği bir farkı sessizce uygulamak
 * olurdu — işletme payıyla aynı gerekçe.
 */
const BOS_PLAN = {
  ad: '', tur: 'gelir-payi', gelirPayiYuzde: '30', cpaTutari: '0',
  yonetimGideriYuzde: '0', yonetimGideriSabit: '0',
  asgariOdeme: '0', negatifDevir: true, varsayilan: false,
  // "esik:yuzde" ciftleri, satir satir. Bos birakilirsa duz oran gecerli.
  kademeler: '', kademeModu: 'topluca',
  // Dikey ezmeleri; bos = duz oran gecerli.
  casinoYuzde: '', casinoCpa: '', sporYuzde: '', sporCpa: '',
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

/**
 * Form alanlarını `dikeyOranlari` gövdesine çevirir.
 *
 * Boş alan `undefined` kalıyor, 0 DEĞİL: `casinoYuzde: 0` "casino payı
 * sıfır" demek, boş bırakmak ise "düz oranı kullan" demek. İkisini
 * karıştırmak, oranı sessizce sıfırlayıp ortağa hiç ödeme yapmamak olur.
 */
function dikeyOranlariCoz(f: typeof BOS_PLAN): Record<string, unknown> | undefined {
  const bir = (yuzde: string, cpa: string) => {
    const o: Record<string, number> = {};
    if (yuzde.trim() !== '') o.yuzde = Number(yuzde);
    if (cpa.trim() !== '') o.cpaTutari = Number(cpa);
    return Object.keys(o).length ? o : undefined;
  };
  const casino = bir(f.casinoYuzde, f.casinoCpa);
  const spor = bir(f.sporYuzde, f.sporCpa);
  if (!casino && !spor) return undefined;
  return { ...(casino ? { casino } : {}), ...(spor ? { spor } : {}) };
}

const kademeOzeti = (p: Plan): string => {
  if (!p.gelirKademeleri?.length) return `%${p.gelirPayiYuzde}`;
  const mod = p.kademeModu === 'dilimli' ? 'dilimli' : 'topluca';
  return `${p.gelirKademeleri.map((k) => `${k.esik}+ → %${k.yuzde}`).join(', ')} (${mod})`;
};

/** Plan satırındaki dikey ezmesi özeti; yoksa tire. */
const dikeyOzeti = (p: Plan): string => {
  const d = (p as Plan & { dikeyOranlari?: Record<string, { yuzde?: number; cpaTutari?: number }> }).dikeyOranlari;
  if (!d) return '—';
  return (['casino', 'spor'] as const)
    .filter((k) => d[k])
    .map((k) => {
      const o = d[k]!;
      const parca = [o.yuzde !== undefined ? `%${o.yuzde}` : null, o.cpaTutari !== undefined ? paraBicimi(o.cpaTutari) : null]
        .filter(Boolean).join(' + ');
      return `${DIKEY_ETIKETI[k]}: ${parca}`;
    })
    .join(' · ') || '—';
};

/**
 * HAZIR PLAN SABLONLARI.
 *
 * Bos formdan bir hibrit plan kurmak, hangi alanlarin birlikte anlamli
 * oldugunu bilmeyi gerektiriyor: hibritte hem yuzde hem CPA dolmali,
 * kademeli planda ilk esik 0 olmali. Sablon bu bilgiyi forma tasiyor;
 * kullanici degistirip kaydediyor.
 *
 * ── Rakamlar YENI PROGRAMA gore ──
 *
 * Eski sablonlar 10.000/50.000 esikleri ve 500 CPA tasiyordu. Site
 * gunluk ortalama 4.000 TL net yatirim aliyor; o esikler hicbir ortagin
 * ulasamayacagi bir vitrin kurup ilk odemede guveni kirardi. Esikler
 * ulasilabilir, CPA gercek oyuncu degerine yakin.
 *
 * Sablonun isi dogru SEKLI vermek, dogru RAKAMI degil — hepsi
 * degistirilebilir.
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
      kademeler: ['0:25', '5000:30', '15000:35', '40000:40'].join('\n'), kademeModu: 'topluca',
    },
  },
  {
    ad: 'CPA',
    aciklama: 'Oyuncu başı sabit ödeme. Ortak için öngörülebilir, site için riskli.',
    deger: { ad: 'CPA 300', tur: 'cpa', gelirPayiYuzde: '0', cpaTutari: '300', kademeler: '' },
  },
  {
    ad: 'Hibrit',
    aciklama: 'Düşürülmüş gelir payı + oyuncu başı ödeme. İkisinin riski paylaşılır.',
    deger: { ad: 'Hibrit %15 + 150', tur: 'hibrit', gelirPayiYuzde: '15', cpaTutari: '150', kademeler: '' },
  },
  {
    ad: 'Casino / spor ayrı',
    aciklama: 'Spor bahsin marjı düşük; iki dikeye ayrı oran verir.',
    deger: {
      ad: 'Dikey bazlı gelir payı', tur: 'gelir-payi', gelirPayiYuzde: '30', cpaTutari: '0',
      casinoYuzde: '30', casinoCpa: '300', sporYuzde: '22', sporCpa: '250', kademeler: '',
    },
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

  const kademeler = kademeleriCoz(form.kademeler);
  const dikeyOranlari = dikeyOranlariCoz(form);
  const yuzdeVar = form.tur === 'gelir-payi' || form.tur === 'hibrit';
  const cpaVar = form.tur === 'cpa' || form.tur === 'hibrit';

  // ORNEK HESAP — plan kaydedilmeden once ne odeyecegini gosteriyor.
  // Referans tutar 10.000 TL: sitenin gunluk hacmine yakin bir aylik
  // casino GGR'i. Buyuk yuvarlak bir sayi (100.000) secmek, hicbir
  // ortagin gormeyecegi bir tutar uzerinden karar vermek olurdu.
  const ornekBrut = 10000;
  const ornekYuzdeGider = ornekBrut * (Number(form.yonetimGideriYuzde || 0) / 100);
  const ornekSabitGider = Math.min(Number(form.yonetimGideriSabit || 0), Math.max(0, ornekBrut - ornekYuzdeGider));
  const ornekTaban = ornekBrut - ornekYuzdeGider - ornekSabitGider;
  // Kademe varsa ulasilan kademenin orani, yoksa duz oran. Dilimli mod
  // burada HESAPLANMIYOR: ornegin isi buyuklugu gostermek, komisyon
  // motorunu ikinci kez uygulamak degil (iki uygulama birbirinden
  // sapabilir ve yanlis olan hangisi belirsiz kalir).
  const ornekOran = (() => {
    const casino = form.casinoYuzde.trim() !== '' ? Number(form.casinoYuzde) : Number(form.gelirPayiYuzde || 0);
    if (!kademeler.length) return casino;
    const ulasilan = [...kademeler].filter((k) => ornekTaban >= k.esik).sort((a, b) => b.esik - a.esik)[0];
    return ulasilan ? ulasilan.yuzde : casino;
  })();
  const ornekPay = yuzdeVar ? ornekTaban * (ornekOran / 100) : 0;

  return (
    <>
      <Kart baslik="Hazır şablonlar">
        <p className="mb-3 max-w-3xl text-sm" style={{ color: 'var(--metin-2)' }}>
          Şablon formu doldurur; rakamları değiştirip kaydedin. Eşikler bu sitenin hacmine göre
          ulaşılabilir tutuldu — bağlayıcı değil, hepsi değiştirilebilir.
        </p>
        <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-5">
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

      {/* PLAN KURUCU — solda alanlar, sagda canli ozet.
          Ozet SABIT (sticky): uzun formu doldururken "bu plan ne
          odeyecek" sorusunun cevabi her an gorunur olmali, aksi halde
          kaydet'e basmadan once kimse kontrol etmiyor. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-start">
        <div className="space-y-3">
          <Kart baslik="Plan kimliği">
            <div className="grid gap-3 md:grid-cols-2">
              <Alan etiket="Plan adı" deger={form.ad} degisti={(v) => setForm({ ...form, ad: v })} />
              <Alan
                etiket="Komisyon modeli"
                deger={form.tur}
                degisti={(v) => setForm({ ...form, tur: v })}
                secenekler={[
                  { deger: 'gelir-payi', etiket: 'Gelir payı (RevShare)' },
                  { deger: 'cpa', etiket: 'CPA — oyuncu başı' },
                  { deger: 'hibrit', etiket: 'Hibrit — ikisi birlikte' },
                ]}
              />
            </div>
          </Kart>

          <Kart baslik="Oranlar">
            <div className="grid gap-3 md:grid-cols-2">
              {yuzdeVar && (
                <Alan
                  etiket="Gelir payı %"
                  deger={form.gelirPayiYuzde}
                  degisti={(v) => setForm({ ...form, gelirPayiYuzde: v })}
                  tip="number"
                  ipucu="Dikey ezmesi girilmezse casino ve spor için bu oran geçerli."
                />
              )}
              {cpaVar && (
                <Alan
                  etiket="CPA tutarı"
                  deger={form.cpaTutari}
                  degisti={(v) => setForm({ ...form, cpaTutari: v })}
                  tip="number"
                  ipucu="İlk yatırım başına. Toplam düzeyinde rapor veren bağlantılarda ölçülemez."
                />
              )}
            </div>

            {/* DIKEY EZMESI — kapali, cunku zorunlu degil.
                Acik gelseydi dort bos alan daha gorunur ve "doldurulmasi
                gereken" bir sey gibi okunurdu; oysa bos birakmak gecerli
                ve en yaygin secim. */}
            <details className="mt-4">
              <summary className="cursor-pointer list-none text-sm font-medium" style={{ color: 'var(--vurgu)' }}>
                + Casino ve spor için ayrı oran ver
              </summary>
              <div className="mt-3 rounded-lg p-4" style={{ background: 'var(--yuzey-2)' }}>
                <p className="mb-3 max-w-2xl text-xs leading-relaxed" style={{ color: 'var(--metin-2)' }}>
                  Spor bahsin brüt marjı casinodan yapısal olarak düşük; aynı yüzdeyi ikisine
                  uygulamak spor trafiğini taşınamaz hale getirir.{' '}
                  <strong style={{ color: 'var(--metin)' }}>Boş bırakılan alan</strong> için yukarıdaki
                  düz oran geçerli — boş bırakmak sıfır DEĞİL.
                </p>
                {(['casino', 'spor'] as const).map((d) => (
                  <div key={d} className="mt-3 first:mt-0">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--metin-2)' }}>
                      <span aria-hidden className="h-1.5 w-1.5 rounded-sm" style={{ background: DIKEY_RENGI[d] }} />
                      {DIKEY_ETIKETI[d]}
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Alan
                        etiket="Gelir payı %"
                        deger={d === 'casino' ? form.casinoYuzde : form.sporYuzde}
                        degisti={(v) => setForm({ ...form, [d === 'casino' ? 'casinoYuzde' : 'sporYuzde']: v })}
                        tip="number"
                      />
                      <Alan
                        etiket="CPA tutarı"
                        deger={d === 'casino' ? form.casinoCpa : form.sporCpa}
                        degisti={(v) => setForm({ ...form, [d === 'casino' ? 'casinoCpa' : 'sporCpa']: v })}
                        tip="number"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </Kart>

          <Kart baslik="Hacim kademeleri">
            <div className="grid gap-3 md:grid-cols-2">
              <Alan
                etiket="Kademeler (opsiyonel)"
                deger={form.kademeler}
                degisti={(v) => setForm({ ...form, kademeler: v })}
                cokSatir
                ipucu="Her satıra bir kademe: eşik:yüzde. Örn. 0:25 / 5000:30 / 15000:35. İlk eşik 0 olmalı. Boşsa düz oran geçerli."
              />
              <Alan
                etiket="Kademe uygulaması"
                deger={form.kademeModu}
                degisti={(v) => setForm({ ...form, kademeModu: v })}
                secenekler={[
                  { deger: 'topluca', etiket: 'Toplu — ulaşılan oran tüm tutara' },
                  { deger: 'dilimli', etiket: 'Dilimli — her dilim kendi oranıyla' },
                ]}
                ipucu="15.000’de %35 eşiği olan bir planda toplu 5.250, dilimli ~4.400 öder. Fark sözleşmeye göre değişir."
              />
            </div>

            {/* Yazilan metnin COZULMUS hali: bir yazim hatasi (":" yerine
                "-", eksik esik) burada hemen gorunuyor. Kaydettikten sonra
                fark etmek, yanlis oranla bir donem odemek demek. */}
            {form.kademeler.trim() !== '' && (
              <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--yuzey-2)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--metin-2)' }}>Okunan kademeler</p>
                {kademeler.length === 0 || kademeler.some((k) => Number.isNaN(k.esik) || Number.isNaN(k.yuzde)) ? (
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--olumsuz)' }}>
                    Satırlar okunamadı. Biçim <code>eşik:yüzde</code> olmalı (örn. <code>5000:30</code>).
                  </p>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[...kademeler].sort((a, b) => a.esik - b.esik).map((k) => (
                        <span key={k.esik} className="rounded-md px-2 py-1 text-xs" style={{ background: 'var(--vurgu-yumusak)', color: 'var(--vurgu)' }}>
                          {paraBicimi(k.esik)}+ → %{k.yuzde}
                        </span>
                      ))}
                    </div>
                    {!kademeler.some((k) => k.esik === 0) && (
                      <p className="mt-2 text-xs" style={{ color: 'var(--uyari)' }}>
                        İlk eşik 0 değil: eşiğin altındaki tutar için hangi oranın geçerli olacağı
                        belirsiz kalır. <code>0:{form.gelirPayiYuzde}</code> satırı eklemeniz önerilir.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </Kart>

          <Kart baslik="Hesap kuralları">
            <div className="grid gap-3 md:grid-cols-2">
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
                etiket="Asgari ödeme"
                deger={form.asgariOdeme}
                degisti={(v) => setForm({ ...form, asgariOdeme: v })}
                tip="number"
                ipucu="Altında kalan tutar ödenmez, sonraki aya devreder. Yeni programda düşük tutmak, ortağın ilk ayında ödeme almasını sağlar."
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <Onay
                etiket="Negatif ay sonraki döneme devretsin"
                deger={form.negatifDevir}
                degisti={(v) => setForm({ ...form, negatifDevir: v })}
              />
              <Onay
                etiket="Varsayılan plan"
                deger={form.varsayilan}
                degisti={(v) => setForm({ ...form, varsayilan: v })}
              />
            </div>
          </Kart>
        </div>

        <div className="space-y-3 lg:sticky lg:top-20">
          <Kart baslik="Özet">
            <div className="space-y-2.5">
              {[
                ['Model', TUR_ETIKETI[form.tur as keyof typeof TUR_ETIKETI] ?? form.tur],
                ['Gelir payı', yuzdeVar ? `%${form.gelirPayiYuzde || 0}` : '—'],
                ['CPA', cpaVar ? paraBicimi(Number(form.cpaTutari || 0)) : '—'],
                ['Dikey ezmesi', dikeyOranlari ? 'var' : 'yok'],
                ['Kademe', kademeler.length ? `${kademeler.length} kademe · ${form.kademeModu === 'dilimli' ? 'dilimli' : 'toplu'}` : 'yok'],
                ['İşletme payı', `%${form.yonetimGideriYuzde || 0}${Number(form.yonetimGideriSabit) > 0 ? ` + ${paraBicimi(Number(form.yonetimGideriSabit))}` : ''}`],
                ['Asgari ödeme', paraBicimi(Number(form.asgariOdeme || 0))],
                ['Negatif devir', form.negatifDevir ? 'açık' : 'kapalı'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-2 text-sm">
                  <span className="shrink-0" style={{ color: 'var(--metin-2)' }}>{k}</span>
                  <span aria-hidden className="min-w-3 flex-1 border-b border-dotted" style={{ borderColor: 'var(--kenar)' }} />
                  <span className="shrink-0 tabular-nums">{v}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg p-3.5" style={{ background: 'var(--vurgu-yumusak)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--vurgu)' }}>
                Örnek hesap
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--metin-2)' }}>
                {paraBicimi(ornekBrut)} casino GGR →{' '}
                {(ornekYuzdeGider + ornekSabitGider) > 0
                  ? <>işletme payı {paraBicimi(ornekYuzdeGider + ornekSabitGider)} düşülür → </>
                  : null}
                {paraBicimi(ornekTaban)} taban →{' '}
                <strong style={{ color: 'var(--vurgu)' }}>%{ornekOran} = {paraBicimi(ornekPay)}</strong>
                {cpaVar && Number(form.cpaTutari) > 0 && (
                  <> + CPA (ilk yatırım × {paraBicimi(Number(form.cpaTutari))})</>
                )}
              </p>
              {Number(form.asgariOdeme) > ornekPay && (
                <p className="mt-2 text-xs" style={{ color: 'var(--uyari)' }}>
                  Bu tutar asgari ödemenin ({paraBicimi(Number(form.asgariOdeme))}) altında kalıyor —
                  ödeme yapılmaz, sonraki döneme devreder.
                </p>
              )}
            </div>
          </Kart>

          <Buton
            tur="birincil"
            tam
            devredisi={!form.ad.trim()}
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
                // Backend dikeyOranlari'ni henuz tanimiyorsa alan sessizce
                // yok sayilir; plan duz oranla calismaya devam eder.
                ...(dikeyOranlari ? { dikeyOranlari } : {}),
              });
              setForm({ ...BOS_PLAN });
            })}
          >
            Planı kaydet
          </Buton>
          {!form.ad.trim() && (
            <p className="text-xs" style={{ color: 'var(--metin-2)' }}>
              Kaydetmek için plana bir ad verin.
            </p>
          )}
        </div>
      </div>

      {(islemHatasi || hata) && <Hata mesaj={islemHatasi ?? hata!} />}

      <Kart baslik="Planlar">
        {(veri?.planlar ?? []).length === 0 ? (
          <Bos mesaj="Plan yok. Plan tanımlanmadan hiçbir hakediş hesaplanamaz." />
        ) : (
          <Tablo basliklar={['Plan', 'Model', 'Gelir payı / kademeler', 'Casino / Spor', 'CPA', 'İşletme payı', 'Asgari', 'Devir', 'İşlem']}>
            {veri!.planlar.map((p) => (
              <Satir key={p.id}>
                <Hucre>
                  <span className="font-medium">{p.ad}</span>{' '}
                  {p.varsayilan && <Rozet metin="varsayılan" renk="olumlu" />}
                </Hucre>
                <Hucre>{TUR_ETIKETI[p.tur]}</Hucre>
                <Hucre><span className="text-xs">{kademeOzeti(p)}</span></Hucre>
                <Hucre><span className="text-xs">{dikeyOzeti(p)}</span></Hucre>
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
