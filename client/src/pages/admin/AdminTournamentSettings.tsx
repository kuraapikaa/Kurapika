import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Save, Trophy } from 'lucide-react';
import { tournamentApi } from '@/api/client';
import {
  Alan,
  Anahtar,
  Bolum,
  BosDurum,
  Dugme,
  Girdi,
  Izgara,
  IzgaraBaslik,
  IzgaraSatir,
  ModulBasligi,
  Olcut,
  OlcutListesi,
  RAKAM,
  Secim,
  Uyari,
  lira,
  sayi,
} from '@/components/admin/oyunUi';

const MODUL = 'tahmin' as const;

type DonemAnahtari = 'gunluk' | 'haftalik' | 'aylik';

const DONEMLER: Array<{ id: DonemAnahtari; ad: string; gun: number; aciklama: string }> = [
  { id: 'gunluk', ad: 'Günlük', gun: 0, aciklama: 'Bugün 00:00’dan itibaren' },
  { id: 'haftalik', ad: 'Haftalık', gun: 7, aciklama: 'Son 7 gün' },
  { id: 'aylik', ad: 'Aylık', gun: 30, aciklama: 'Son 30 gün' },
];

/**
 * Siralama olcutu.
 *
 * Sunucu bu anahtarlari rapor 1841 kolonlarina esliyor
 * (dashboard.ts turnuvaMetrigi).
 */
const OLCUTLER = [
  { id: 'BetAmount', ad: 'Toplam bahis' },
  { id: 'DepositAmount', ad: 'Toplam yatırım' },
  { id: 'CasinoBetAmount', ad: 'Casino bahsi' },
  { id: 'SportBetAmount', ad: 'Spor bahsi' },
  { id: 'GGR', ad: 'GGR' },
] as const;

/**
 * Skor hesaplama formulleri.
 *
 * Sunucudaki turnuvaSkoru.HESAPLAMA_FORMULLERI ile birebir ayni olmali;
 * ayrisirsa admin burada seceni sunucu tanimaz ve sessizce varsayilana
 * (toplam bahis) duser.
 */
const FORMULLER = [
  { id: 'bahis', ad: 'Toplam bahis', aciklama: 'Skor = dönem içindeki toplam bahis tutarı.' },
  { id: 'bahisXcarpan', ad: 'Toplam bahis × çarpan', aciklama: 'Toplam bahis, aşağıdaki çarpanla ölçeklenir.' },
  { id: 'kazancOrani', ad: 'Kazanç oranı', aciklama: 'Skor = kazanç ÷ bahis. Küçük oyuncuya da şans verir.' },
  { id: 'netKayip', ad: 'Net kayıp', aciklama: 'Skor = oyuncunun net kaybı. Kazanan oyuncular 0 alır.' },
  { id: 'bahisAdedi', ad: 'Bahis adedi', aciklama: 'Skor = bahis sayısı. Tutar değil sıklık ödüllendirilir.' },
] as const;

const VARSAYILAN_KURALLAR = {
  formul: 'bahis',
  skorCarpani: 1,
  tekBahisMin: 0,
  tekBahisMax: 0,
  toplamBahisAdediMin: 0,
  toplamBahisAdediMax: 0,
};

const VARSAYILAN: Record<DonemAnahtari, any> = {
  gunluk: { prize: '50.000', isActive: true, title: '', orderKey: 'BetAmount', topCount: 20, kurallar: { ...VARSAYILAN_KURALLAR } },
  haftalik: { prize: '250.000', isActive: true, title: '', orderKey: 'BetAmount', topCount: 20, kurallar: { ...VARSAYILAN_KURALLAR } },
  aylik: { prize: '500.000', isActive: true, title: '', orderKey: 'BetAmount', topCount: 20, kurallar: { ...VARSAYILAN_KURALLAR } },
};

/** Eski uc "DD-MM-YY" bekliyor; sunucu bunu Turkiye gun sinirina ceviriyor. */
function ddmmyy(date: Date): string {
  const g = String(date.getDate()).padStart(2, '0');
  const a = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return `${g}-${a}-${y}`;
}

export function AdminTournamentSettings() {
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mesaj, setMesaj] = useState<{ tur: 'basari' | 'hata'; metin: string } | null>(null);

  const [onizlemeDonem, setOnizlemeDonem] = useState<DonemAnahtari>('gunluk');
  const [onizleme, setOnizleme] = useState<any[] | null>(null);
  const [onizlemeYukleniyor, setOnizlemeYukleniyor] = useState(false);
  const [onizlemeHata, setOnizlemeHata] = useState('');

  useEffect(() => {
    ayarlariGetir();
  }, []);

  const ayarlariGetir = async () => {
    setLoading(true);
    try {
      const data = await tournamentApi.getSettings();
      setSettings({ ...VARSAYILAN, ...(data || {}) });
    } catch {
      setMesaj({ tur: 'hata', metin: 'Ayarlar yüklenemedi.' });
      setSettings({ ...VARSAYILAN });
    } finally {
      setLoading(false);
    }
  };

  const kaydet = async () => {
    setSaving(true);
    setMesaj(null);
    try {
      await tournamentApi.saveSettings(settings);
      setMesaj({ tur: 'basari', metin: 'Ayarlar kaydedildi.' });
    } catch {
      setMesaj({ tur: 'hata', metin: 'Kaydedilemedi.' });
    } finally {
      setSaving(false);
    }
  };

  const donemGuncelle = (key: DonemAnahtari, patch: Record<string, unknown>) => {
    setSettings((onceki) => ({ ...(onceki || {}), [key]: { ...(onceki?.[key] || {}), ...patch } }));
  };

  const kuralGuncelle = (key: DonemAnahtari, patch: Record<string, unknown>) => {
    setSettings((onceki) => ({
      ...(onceki || {}),
      [key]: {
        ...(onceki?.[key] || {}),
        kurallar: { ...VARSAYILAN_KURALLAR, ...(onceki?.[key]?.kurallar || {}), ...patch },
      },
    }));
  };

  /**
   * Canli siralama onizlemesi.
   *
   * "Oyuncu turnuva verileri gorunmuyor" sikayetinin teshisi buradan
   * yapilabilsin: admin, oyuncu sayfasina gitmeden verinin gelip
   * gelmedigini goruyor.
   */
  const onizlemeGetir = async (donem: DonemAnahtari) => {
    const cfg = DONEMLER.find((d) => d.id === donem)!;
    setOnizlemeDonem(donem);
    setOnizlemeYukleniyor(true);
    setOnizlemeHata('');
    setOnizleme(null);
    try {
      const simdi = new Date();
      const baslangic = new Date();
      if (cfg.gun > 0) baslangic.setDate(simdi.getDate() - cfg.gun);
      const bitis = new Date();
      bitis.setDate(simdi.getDate() + 1);

      const res = await tournamentApi.leaderboard({
        FromDate: ddmmyy(cfg.gun > 0 ? baslangic : simdi),
        ToDate: ddmmyy(bitis),
        Take: Number(settings?.[donem]?.topCount) || 20,
        OrderKey: settings?.[donem]?.orderKey || 'BetAmount',
      });
      setOnizleme(res?.Result?.ReportByTResultViewModel ?? []);
    } catch (error) {
      setOnizlemeHata(error instanceof Error ? error.message : 'Sıralama alınamadı.');
    } finally {
      setOnizlemeYukleniyor(false);
    }
  };

  const onizlemeOzeti = useMemo(() => {
    if (!onizleme) return null;
    return {
      oyuncu: onizleme.length,
      toplamBahis: onizleme.reduce((t, s) => t + (Number(s.BetAmount) || 0), 0),
      lider: onizleme[0]?.UserName ?? '—',
    };
  }, [onizleme]);

  if (loading || !settings) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 pb-28 md:p-6">
      <ModulBasligi
        modul={MODUL}
        ikon={<Trophy size={20} />}
        baslik="Turnuva Ayarları"
        aciklama="Günlük, haftalık ve aylık turnuvaların ödülleri, sıralama ölçütü ve yayın durumu."
        saginda={
          <Dugme modul={MODUL} tur="birincil" onClick={kaydet} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Kaydet
          </Dugme>
        }
      />

      {mesaj && <Uyari tur={mesaj.tur === 'basari' ? 'bilgi' : 'hata'}>{mesaj.metin}</Uyari>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {DONEMLER.map((donem) => {
            const cfg = { ...VARSAYILAN[donem.id], ...(settings[donem.id] || {}) };
            const kurallar = { ...VARSAYILAN_KURALLAR, ...(cfg.kurallar || {}) };
            return (
              <Bolum key={donem.id} baslik={`${donem.ad} turnuva`} aciklama={donem.aciklama}>
                <div className="space-y-4 px-5 py-4">
                  <Anahtar
                    modul={MODUL}
                    acik={cfg.isActive !== false}
                    onDegis={(isActive) => donemGuncelle(donem.id, { isActive })}
                    etiket="Yayında"
                    aciklama="Kapalıyken lobide bu etap sekmesi pasif görünür."
                  />
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                    <Alan etiket="Ödül havuzu" ipucu="Lobide yazdığınız gibi görünür.">
                      <Girdi
                        modul={MODUL}
                        value={cfg.prize ?? ''}
                        onChange={(e) => donemGuncelle(donem.id, { prize: e.target.value })}
                        placeholder="50.000"
                      />
                    </Alan>
                    <Alan etiket="Başlık" ipucu="Boşsa varsayılan başlık kullanılır.">
                      <Girdi
                        modul={MODUL}
                        value={cfg.title ?? ''}
                        onChange={(e) => donemGuncelle(donem.id, { title: e.target.value })}
                        placeholder={`${donem.ad} Turnuva`}
                      />
                    </Alan>
                    <Alan etiket="Sıralama ölçütü">
                      <Secim
                        modul={MODUL}
                        value={cfg.orderKey ?? 'BetAmount'}
                        onChange={(e) => donemGuncelle(donem.id, { orderKey: e.target.value })}
                      >
                        {OLCUTLER.map((o) => <option key={o.id} value={o.id}>{o.ad}</option>)}
                      </Secim>
                    </Alan>
                    <Alan etiket="Listelenecek oyuncu">
                      <Girdi
                        modul={MODUL}
                        sayisal
                        type="number"
                        min={1}
                        max={200}
                        value={cfg.topCount ?? 20}
                        onChange={(e) => donemGuncelle(donem.id, { topCount: Number(e.target.value) })}
                      />
                    </Alan>
                  </div>
                  {/* ── Skorlama ─────────────────────────────────────
                      Onceden siralama ham metrigin kendisiydi: turnuva
                      "en cok parasi olan kazanir" haline geliyordu.
                      Bu alanlar kucuk oyuncuya sans tanimak ve bonus
                      avcilarini elemek icin. */}
                  <div className="space-y-4 border-t border-white/5 pt-4">
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-200">
                        Skorlama
                      </h4>
                      <p className="mt-1 text-[11px] font-medium text-slate-400">
                        {FORMULLER.find((f) => f.id === (kurallar.formul ?? 'bahis'))?.aciklama}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <Alan etiket="Calculation Formula" ipucu="Skorun neye göre hesaplanacağı.">
                        <Secim
                          modul={MODUL}
                          value={kurallar.formul ?? 'bahis'}
                          onChange={(e) => kuralGuncelle(donem.id, { formul: e.target.value })}
                        >
                          {FORMULLER.map((f) => <option key={f.id} value={f.id}>{f.ad}</option>)}
                        </Secim>
                      </Alan>
                      <Alan
                        etiket="Score Multiplier"
                        ipucu={kurallar.formul === 'bahisXcarpan'
                          ? 'Skor bu çarpanla ölçeklenir.'
                          : 'Yalnızca “Toplam bahis × çarpan” formülünde kullanılır.'}
                      >
                        <Girdi
                          modul={MODUL}
                          sayisal
                          type="number"
                          min={0.01}
                          step={0.01}
                          disabled={kurallar.formul !== 'bahisXcarpan'}
                          value={kurallar.skorCarpani ?? 1}
                          onChange={(e) => kuralGuncelle(donem.id, { skorCarpani: Number(e.target.value) })}
                        />
                      </Alan>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <Alan etiket="Single Min Bet Amount" ipucu="Ortalama bahsi bunun altında kalan oyuncu elenir. 0 = sınırsız.">
                        <Girdi
                          modul={MODUL}
                          sayisal
                          type="number"
                          min={0}
                          value={kurallar.tekBahisMin ?? 0}
                          onChange={(e) => kuralGuncelle(donem.id, { tekBahisMin: Number(e.target.value) })}
                        />
                      </Alan>
                      <Alan etiket="Single Max Bet Amount" ipucu="Bu tutarın üstü sayılmaz; tek dev bahis listeyi kilitlemesin. 0 = sınırsız.">
                        <Girdi
                          modul={MODUL}
                          sayisal
                          type="number"
                          min={0}
                          value={kurallar.tekBahisMax ?? 0}
                          onChange={(e) => kuralGuncelle(donem.id, { tekBahisMax: Number(e.target.value) })}
                        />
                      </Alan>
                      <Alan etiket="Total Min Bet Count" ipucu="Sıralamaya girmek için gereken en az bahis adedi. 0 = sınırsız.">
                        <Girdi
                          modul={MODUL}
                          sayisal
                          type="number"
                          min={0}
                          value={kurallar.toplamBahisAdediMin ?? 0}
                          onChange={(e) => kuralGuncelle(donem.id, { toplamBahisAdediMin: Number(e.target.value) })}
                        />
                      </Alan>
                      <Alan etiket="Total Max Bet Count" ipucu="Sayılan en fazla bahis adedi. 0 = sınırsız.">
                        <Girdi
                          modul={MODUL}
                          sayisal
                          type="number"
                          min={0}
                          value={kurallar.toplamBahisAdediMax ?? 0}
                          onChange={(e) => kuralGuncelle(donem.id, { toplamBahisAdediMax: Number(e.target.value) })}
                        />
                      </Alan>
                    </div>

                    {/* Bahis ADEDI raporda gelmiyor; adet bazli kurallar
                        sessizce etkisiz kalmasin diye acikca soyluyoruz. */}
                    {(Number(kurallar.toplamBahisAdediMin) > 0
                      || Number(kurallar.toplamBahisAdediMax) > 0
                      || kurallar.formul === 'bahisAdedi') && (
                      <Uyari tur="dikkat">
                        Players Overview raporu bahis <strong>adedi</strong> döndürmüyor. Adede dayalı kurallar
                        (Total Min/Max Bet Count ve “Bahis adedi” formülü) veri gelene kadar etkisiz kalır.
                      </Uyari>
                    )}
                  </div>

                  <Dugme modul={MODUL} onClick={() => onizlemeGetir(donem.id)} disabled={onizlemeYukleniyor}>
                    {onizlemeYukleniyor && onizlemeDonem === donem.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : null}
                    Sıralamayı önizle
                  </Dugme>
                </div>
              </Bolum>
            );
          })}
        </div>

        <aside className="space-y-5">
          <Bolum
            baslik="Canlı sıralama"
            aciklama={`${DONEMLER.find((d) => d.id === onizlemeDonem)?.ad} · Players Overview raporundan`}
          >
            {onizlemeHata ? (
              <div className="px-5 py-4">
                <Uyari tur="hata">{onizlemeHata}</Uyari>
              </div>
            ) : onizlemeYukleniyor ? (
              <div className="px-5 py-10 text-center text-[11px] font-medium text-slate-400">
                Sıralama hesaplanıyor...
              </div>
            ) : !onizleme ? (
              <BosDurum ikon={<Trophy size={24} />} baslik="Bir dönem seçip “Sıralamayı önizle” deyin." />
            ) : onizleme.length === 0 ? (
              <div className="space-y-3 px-5 py-6">
                <p className="text-[13px] font-semibold text-white">
                  Bu dönemde sıralamaya giren oyuncu yok.
                </p>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Rapor çalışıyor ama seçilen ölçütte değeri 0’dan büyük oyuncu bulunmadı.
                  Dönemi genişletin ya da ölçütü değiştirin.
                </p>
              </div>
            ) : (
              <>
                <OlcutListesi>
                  <Olcut etiket="Sıralamadaki oyuncu" deger={sayi(onizlemeOzeti?.oyuncu ?? 0)} vurgulu />
                  <Olcut etiket="Toplam bahis" deger={lira(onizlemeOzeti?.toplamBahis ?? 0)} />
                  <Olcut etiket="Lider" deger={onizlemeOzeti?.lider ?? '—'} />
                </OlcutListesi>
                <div className="border-t border-white/5">
                  <Izgara sutunlar="40px minmax(0,1fr) 110px">
                    <IzgaraBaslik>
                      <span>#</span>
                      <span>Oyuncu</span>
                      <span className="text-right">Bahis</span>
                    </IzgaraBaslik>
                    {onizleme.slice(0, 20).map((satir: any, i: number) => (
                      <IzgaraSatir key={satir.UserName ?? i}>
                        <span className={`${RAKAM} text-[11px] font-bold text-slate-400`}>
                          {i + 1}
                        </span>
                        <span className="truncate text-[12px] font-semibold text-white">
                          {satir.UserName || '—'}
                        </span>
                        <span className={`${RAKAM} text-right text-[12px] font-semibold text-slate-200`}>
                          {lira(Number(satir.BetAmount) || 0)}
                        </span>
                      </IzgaraSatir>
                    ))}
                  </Izgara>
                </div>
              </>
            )}
          </Bolum>

          <Bolum baslik="Veri kaynağı">
            <ul className="space-y-2.5 px-5 py-4 text-[11px] font-medium leading-relaxed text-slate-400">
              <li>
                Sıralama, Players Overview raporunun <span className="font-bold">dönem</span> kolonlarından
                üretilir; ömür boyu toplamdan değil.
              </li>
              <li>Değeri 0 olan oyuncular listeye girmez — turnuvaya katılmamış sayılırlar.</li>
              <li>Eşitlikte sıra alfabetiktir; aynı sayıya sahip oyuncuların yeri istekten isteğe değişmez.</li>
            </ul>
          </Bolum>
        </aside>
      </div>
    </div>
  );
}
