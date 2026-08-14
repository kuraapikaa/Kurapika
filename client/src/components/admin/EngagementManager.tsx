import { useMemo } from 'react';
import { BadgeCheck, Gift, Layers, ListChecks, Plus } from 'lucide-react';
import {
  Alan,
  AlanIcinde,
  Anahtar,
  Bolum,
  BosDurum,
  Dugme,
  Girdi,
  ModulBasligi,
  Olcut,
  OlcutListesi,
  RAKAM,
  Secim,
  SilDugmesi,
  Uyari,
  lira,
  sayi,
} from './oyunUi';

type EngagementMode = 'dailyTasks' | 'battlePass';

interface EngagementManagerProps {
  mode: EngagementMode;
  dailyTasks: any;
  battlePass: any;
  bonusOptions: any[];
  onDailyTasksChange: (config: any) => void;
  onBattlePassChange: (config: any) => void;
}

const MODUL = 'gorev' as const;

/**
 * Gorev metrikleri.
 *
 * Hepsi Players Overview raporunun DONEM (FILTERED) kolonlarindan
 * hesaplaniyor — omur boyu toplamdan degil. Aksi halde "bugun 500 TL yatir"
 * gorevi gecmiste yatirimi olan herkeste aninda tamamlanmis gorunurdu.
 */
const METRIKLER = [
  { id: 'login', label: 'Giriş', birim: 'kez', aciklama: 'Gün içinde giriş yapmak' },
  { id: 'deposit_total', label: 'Yatırım tutarı', birim: 'TL', aciklama: 'Gün içindeki toplam yatırım' },
  { id: 'deposit_count', label: 'Yatırım adedi', birim: 'adet', aciklama: 'Gün içindeki yatırım sayısı' },
  { id: 'wager_total', label: 'Oyun hacmi', birim: 'TL', aciklama: 'Gün içindeki toplam bahis' },
  { id: 'bonus_count', label: 'Bonus adedi', birim: 'adet', aciklama: 'Gün içinde alınan bonus' },
];

const metrikBilgisi = (id: string) => METRIKLER.find((m) => m.id === id) ?? METRIKLER[0];

const VARSAYILAN_GOREV = {
  isActive: true,
  title: 'Günlük Görevler',
  description: 'Gün içindeki gerçek aktivitenizi tamamlayın, XP ve ödül kazanın.',
  resetHour: 0,
  tasks: [],
};

const VARSAYILAN_PASS = {
  isActive: true,
  seasonId: 'season-1',
  title: 'Sezon Kartı',
  description: 'Yatırım, oyun hacmi ve görevlerden XP toplayarak sezon ödüllerini aç.',
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  premiumEnabled: false,
  xpRules: [],
  levels: [],
};

function tarihGirdisine(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function tarihtenIso(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function yeniId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function EngagementManager({
  mode,
  dailyTasks,
  battlePass,
  bonusOptions,
  onDailyTasksChange,
  onBattlePassChange,
}: EngagementManagerProps) {
  const daily = {
    ...VARSAYILAN_GOREV,
    ...(dailyTasks || {}),
    tasks: Array.isArray(dailyTasks?.tasks) ? dailyTasks.tasks : [],
  };
  const pass = {
    ...VARSAYILAN_PASS,
    ...(battlePass || {}),
    xpRules: Array.isArray(battlePass?.xpRules) ? battlePass.xpRules : [],
    levels: Array.isArray(battlePass?.levels) ? battlePass.levels : [],
  };

  const gorevGuncelle = (values: any) => onDailyTasksChange({ ...daily, ...values });
  const tekGorev = (id: string, values: any) =>
    gorevGuncelle({ tasks: daily.tasks.map((t: any) => (t.id === id ? { ...t, ...values } : t)) });
  const gorevEkle = () =>
    gorevGuncelle({
      tasks: [
        ...daily.tasks,
        {
          id: yeniId('task'),
          title: 'Yeni görev',
          description: '',
          metric: 'deposit_total',
          target: 500,
          xp: 100,
          rewardLabel: '50 TL bonus',
          rewardBonusId: null,
          rewardAmount: 50,
          active: true,
        },
      ],
    });

  const ozet = useMemo(() => {
    const aktif = daily.tasks.filter((t: any) => t.active !== false);
    return {
      toplam: daily.tasks.length,
      aktif: aktif.length,
      gunlukXp: aktif.reduce((t: number, g: any) => t + (Number(g.xp) || 0), 0),
      gunlukOdul: aktif.reduce((t: number, g: any) => t + (Number(g.rewardAmount) || 0), 0),
      odulsuz: aktif.filter((g: any) => !(Number(g.rewardAmount) > 0) && !g.rewardBonusId).length,
      hedefsiz: aktif.filter((g: any) => !(Number(g.target) > 0)).length,
    };
  }, [daily.tasks]);

  const passGuncelle = (values: any) => onBattlePassChange({ ...pass, ...values });

  if (mode === 'battlePass') {
    return (
      <BattlePassBolumu
        pass={pass}
        bonusOptions={bonusOptions}
        onGuncelle={passGuncelle}
      />
    );
  }

  return (
    <div className="space-y-5">
      <ModulBasligi
        modul={MODUL}
        ikon={<ListChecks size={20} />}
        baslik="Günlük Görevler"
        aciklama="Türkiye (GMT+3) gün penceresinde gerçek aktiviteyle hesaplanır."
        saginda={
          <Dugme modul={MODUL} tur="birincil" onClick={gorevEkle}>
            <Plus size={14} /> Görev ekle
          </Dugme>
        }
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Bolum baslik="Modül ayarları">
            <div className="space-y-4 px-5 py-4">
              <Anahtar
                modul={MODUL}
                acik={daily.isActive !== false}
                onDegis={(isActive) => gorevGuncelle({ isActive })}
                etiket="Görevler yayında"
                aciklama="Kapalıyken lobide görev sekmesi görünmez."
              />
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.4fr_160px]">
                <Alan etiket="Başlık">
                  <Girdi modul={MODUL} value={daily.title} onChange={(e) => gorevGuncelle({ title: e.target.value })} />
                </Alan>
                <Alan etiket="Açıklama">
                  <Girdi
                    modul={MODUL}
                    value={daily.description}
                    onChange={(e) => gorevGuncelle({ description: e.target.value })}
                  />
                </Alan>
                <Alan etiket="Sıfırlama saati" ipucu="Türkiye saati (GMT+3).">
                  <AlanIcinde ek=":00">
                    <Girdi
                      modul={MODUL}
                      sayisal
                      type="number"
                      min={0}
                      max={23}
                      value={daily.resetHour || 0}
                      onChange={(e) => gorevGuncelle({ resetHour: Number(e.target.value) })}
                    />
                  </AlanIcinde>
                </Alan>
              </div>
            </div>
          </Bolum>

          <Bolum
            baslik="Görevler"
            aciklama="Metrik, hedef ve ödül eşleşmeleri."
          >
            {daily.tasks.length === 0 ? (
              <BosDurum
                ikon={<ListChecks size={26} />}
                baslik="Henüz görev yok. Oyuncular boş bir liste görür."
                eylem={
                  <Dugme modul={MODUL} tur="birincil" onClick={gorevEkle}>
                    <Plus size={14} /> İlk görevi ekle
                  </Dugme>
                }
              />
            ) : (
              <div className="space-y-3 p-4">
                {daily.tasks.map((gorev: any) => {
                  const metrik = metrikBilgisi(gorev.metric || 'login');
                  const pasif = gorev.active === false;
                  return (
                    <div
                      key={gorev.id}
                      className={`rounded-2xl border border-white/5 bg-black/20 p-4 transition-opacity ${pasif ? 'opacity-50' : ''}`}
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-[13px] font-semibold text-white">
                            {gorev.title || 'Adsız görev'}
                          </span>
                          {/* Gorevin ne istedigi tek satirda okunabilsin. */}
                          <span className={`${RAKAM} rounded-md bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-slate-400`}>
                            {metrik.label} ≥ {sayi(Number(gorev.target) || 0)} {metrik.birim}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            <input
                              type="checkbox"
                              checked={!pasif}
                              onChange={(e) => tekGorev(gorev.id, { active: e.target.checked })}
                            />
                            Aktif
                          </label>
                          <SilDugmesi
                            onClick={() => gorevGuncelle({ tasks: daily.tasks.filter((t: any) => t.id !== gorev.id) })}
                            etiket={`${gorev.title || 'Görevi'} sil`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-8 xl:grid-cols-4">
                        <Alan etiket="Görev adı">
                          <Girdi modul={MODUL} value={gorev.title || ''} onChange={(e) => tekGorev(gorev.id, { title: e.target.value })} />
                        </Alan>
                        <Alan etiket="Metrik" ipucu={metrik.aciklama}>
                          <Secim
                            modul={MODUL}
                            value={gorev.metric || 'login'}
                            onChange={(e) => tekGorev(gorev.id, { metric: e.target.value })}
                          >
                            {METRIKLER.map((m) => (
                              <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                          </Secim>
                        </Alan>
                        <Alan etiket="Hedef">
                          <AlanIcinde ek={metrik.birim}>
                            <Girdi
                              modul={MODUL}
                              sayisal
                              type="number"
                              min={0}
                              value={gorev.target ?? 1}
                              onChange={(e) => tekGorev(gorev.id, { target: Number(e.target.value) })}
                            />
                          </AlanIcinde>
                        </Alan>
                        <Alan etiket="XP">
                          <Girdi
                            modul={MODUL}
                            sayisal
                            type="number"
                            min={0}
                            value={gorev.xp ?? 0}
                            onChange={(e) => tekGorev(gorev.id, { xp: Number(e.target.value) })}
                          />
                        </Alan>
                        <Alan etiket="Açıklama" className="xl:col-span-2">
                          <Girdi
                            modul={MODUL}
                            value={gorev.description || ''}
                            onChange={(e) => tekGorev(gorev.id, { description: e.target.value })}
                            placeholder="Oyuncuya gösterilecek açıklama"
                          />
                        </Alan>
                        <Alan etiket="Ödül etiketi">
                          <Girdi
                            modul={MODUL}
                            value={gorev.rewardLabel || ''}
                            onChange={(e) => tekGorev(gorev.id, { rewardLabel: e.target.value })}
                          />
                        </Alan>
                        <Alan etiket="Ödül tutarı">
                          <AlanIcinde ek="TL">
                            <Girdi
                              modul={MODUL}
                              sayisal
                              type="number"
                              min={0}
                              value={gorev.rewardAmount ?? 0}
                              onChange={(e) => tekGorev(gorev.id, { rewardAmount: Number(e.target.value) })}
                            />
                          </AlanIcinde>
                        </Alan>
                        <Alan
                          etiket="Lynon kampanyası"
                          className="xl:col-span-4"
                          ipucu="Seçilirse ödül otomatik atanır; boşsa yalnızca kayıt oluşur."
                        >
                          <Secim
                            modul={MODUL}
                            value={String(gorev.rewardBonusId || '')}
                            onChange={(e) => tekGorev(gorev.id, { rewardBonusId: e.target.value || null })}
                          >
                            <option value="">Otomatik atama yok</option>
                            {bonusOptions.map((opt: any) => (
                              <option key={opt.id} value={opt.id}>{opt.display}</option>
                            ))}
                          </Secim>
                        </Alan>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Bolum>
        </div>

        <aside className="space-y-5">
          <Bolum baslik="Günlük yük">
            <OlcutListesi>
              <Olcut etiket="Aktif görev" deger={`${sayi(ozet.aktif)} / ${sayi(ozet.toplam)}`} vurgulu />
              <Olcut etiket="Toplam XP" deger={sayi(ozet.gunlukXp)} />
              <Olcut etiket="Tümü tamamlanırsa" deger={lira(ozet.gunlukOdul)} vurgulu />
            </OlcutListesi>
            <p className="border-t border-white/5 px-5 py-3 text-[11px] font-medium text-slate-400">
              Bir oyuncu günün tüm görevlerini bitirirse maliyet bu kadar.
            </p>
          </Bolum>

          {ozet.hedefsiz > 0 && (
            <Uyari tur="hata">
              {ozet.hedefsiz} aktif görevin hedefi 0. Bu görevler açılır açılmaz tamamlanmış görünür.
            </Uyari>
          )}
          {ozet.odulsuz > 0 && (
            <Uyari tur="dikkat">
              {ozet.odulsuz} aktif görevin ödülü yok. Oyuncu tamamlar ama hiçbir şey almaz.
            </Uyari>
          )}
          {daily.isActive === false && daily.tasks.length > 0 && (
            <Uyari tur="dikkat">Modül kapalı; tanımlı görevler oyuncuya gösterilmiyor.</Uyari>
          )}

          <Bolum baslik="Hesaplama">
            <ul className="space-y-2.5 px-5 py-4 text-[11px] font-medium leading-relaxed text-slate-400">
              <li>
                İlerleme, Players Overview raporunun <span className="font-bold">dönem</span> kolonlarından
                okunur — ömür boyu toplamdan değil.
              </li>
              <li>
                Gün penceresi sıfırlama saatinde başlar ve 24 saat sürer. Saat değişirse
                o günün ilerlemesi yeni pencereye göre yeniden hesaplanır.
              </li>
              <li>
                Ödül kampanyası seçili görevlerde tamamlanma anında atama yapılır; oyuncunun
                ayrıca talep etmesi gerekmez.
              </li>
            </ul>
          </Bolum>
        </aside>
      </div>
    </div>
  );
}

// ─── Sezon kartı ─────────────────────────────────────────────────────────────

/**
 * Sezon karti editoru.
 *
 * DIKKAT: bu ekran su anda admin panelinden ULASILAMIYOR — AdminGames
 * yalnizca mode="dailyTasks" ile cagiriyor ve onBattlePassChange bos bir
 * fonksiyon. Oyuncu tarafi (BattlePassPage) canli calisiyor, yani sezon
 * karti yapilandirilamiyor. Silmek yerine calisir birakildi; sekme olarak
 * acilmasi ayri bir karar.
 */
function BattlePassBolumu({
  pass,
  bonusOptions,
  onGuncelle,
}: {
  pass: any;
  bonusOptions: any[];
  onGuncelle: (values: any) => void;
}) {
  const kuralGuncelle = (id: string, values: any) =>
    onGuncelle({ xpRules: pass.xpRules.map((r: any) => (r.id === id ? { ...r, ...values } : r)) });
  const seviyeGuncelle = (no: number, values: any) =>
    onGuncelle({ levels: pass.levels.map((l: any) => (Number(l.level) === no ? { ...l, ...values } : l)) });

  return (
    <div className="space-y-5">
      <ModulBasligi
        modul={MODUL}
        ikon={<Layers size={20} />}
        baslik="Sezon Kartı"
        aciklama="XP kuralları, sezon tarihleri ve seviye ödülleri."
      />

      <Uyari tur="dikkat">
        Bu ekran admin panelinde bir sekmeye bağlı değil ve değişiklikler kaydedilmiyor.
      </Uyari>

      <Bolum baslik="Sezon">
        <div className="space-y-4 px-5 py-4">
          <Anahtar
            modul={MODUL}
            acik={pass.isActive !== false}
            onDegis={(isActive) => onGuncelle({ isActive })}
            etiket="Sezon yayında"
          />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-4">
            <Alan etiket="Sezon ID">
              <Girdi modul={MODUL} value={pass.seasonId} onChange={(e) => onGuncelle({ seasonId: e.target.value })} />
            </Alan>
            <Alan etiket="Başlık">
              <Girdi modul={MODUL} value={pass.title} onChange={(e) => onGuncelle({ title: e.target.value })} />
            </Alan>
            <Alan etiket="Başlangıç">
              <Girdi
                modul={MODUL}
                type="datetime-local"
                value={tarihGirdisine(pass.startsAt)}
                onChange={(e) => onGuncelle({ startsAt: tarihtenIso(e.target.value) })}
              />
            </Alan>
            <Alan etiket="Bitiş">
              <Girdi
                modul={MODUL}
                type="datetime-local"
                value={tarihGirdisine(pass.endsAt)}
                onChange={(e) => onGuncelle({ endsAt: tarihtenIso(e.target.value) })}
              />
            </Alan>
            <Alan etiket="Açıklama" className="xl:col-span-3">
              <Girdi modul={MODUL} value={pass.description} onChange={(e) => onGuncelle({ description: e.target.value })} />
            </Alan>
          </div>
          <Anahtar
            modul={MODUL}
            acik={pass.premiumEnabled === true}
            onDegis={(premiumEnabled) => onGuncelle({ premiumEnabled })}
            etiket="Premium hat"
            aciklama="İkinci ödül sırasını açar."
          />
        </div>
      </Bolum>

      <Bolum
        baslik="XP kuralları"
        eylem={
          <Dugme
            modul={MODUL}
            tur="birincil"
            onClick={() =>
              onGuncelle({
                xpRules: [
                  ...pass.xpRules,
                  { id: yeniId('xp'), label: 'Yeni XP kuralı', metric: 'deposit_total', unit: 100, xp: 10, cap: 1000, active: true },
                ],
              })
            }
          >
            <Plus size={14} /> Kural ekle
          </Dugme>
        }
      >
        {pass.xpRules.length === 0 ? (
          <BosDurum ikon={<BadgeCheck size={26} />} baslik="XP kuralı yok; oyuncular seviye atlayamaz." />
        ) : (
          <div className="space-y-3 p-4">
            {pass.xpRules.map((kural: any) => (
              <div key={kural.id} className="rounded-3xl border border-white/[0.05] bg-black/20 p-8 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    <input type="checkbox" checked={kural.active !== false} onChange={(e) => kuralGuncelle(kural.id, { active: e.target.checked })} />
                    Aktif
                  </label>
                  <SilDugmesi
                    onClick={() => onGuncelle({ xpRules: pass.xpRules.filter((r: any) => r.id !== kural.id) })}
                    etiket="Kuralı sil"
                  />
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
                  <Alan etiket="Ad">
                    <Girdi modul={MODUL} value={kural.label || ''} onChange={(e) => kuralGuncelle(kural.id, { label: e.target.value })} />
                  </Alan>
                  <Alan etiket="Metrik">
                    <Secim modul={MODUL} value={kural.metric || 'deposit_total'} onChange={(e) => kuralGuncelle(kural.id, { metric: e.target.value })}>
                      {METRIKLER.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </Secim>
                  </Alan>
                  <Alan etiket="Birim">
                    <Girdi modul={MODUL} sayisal type="number" value={kural.unit ?? 1} onChange={(e) => kuralGuncelle(kural.id, { unit: Number(e.target.value) })} />
                  </Alan>
                  <Alan etiket="XP">
                    <Girdi modul={MODUL} sayisal type="number" value={kural.xp ?? 0} onChange={(e) => kuralGuncelle(kural.id, { xp: Number(e.target.value) })} />
                  </Alan>
                  <Alan etiket="Üst sınır">
                    <Girdi modul={MODUL} sayisal type="number" value={kural.cap ?? 0} onChange={(e) => kuralGuncelle(kural.id, { cap: Number(e.target.value) })} />
                  </Alan>
                </div>
              </div>
            ))}
          </div>
        )}
      </Bolum>

      <Bolum
        baslik="Seviye ödülleri"
        eylem={
          <Dugme
            modul={MODUL}
            tur="birincil"
            onClick={() => {
              const sonraki = Math.max(0, ...pass.levels.map((l: any) => Number(l.level) || 0)) + 1;
              onGuncelle({
                levels: [
                  ...pass.levels,
                  {
                    level: sonraki,
                    requiredXp: sonraki * 250,
                    freeRewardLabel: 'Bonus ödülü',
                    freeBonusId: null,
                    freeAmount: 50,
                    premiumRewardLabel: 'Premium bonus',
                    premiumBonusId: null,
                    premiumAmount: 100,
                  },
                ],
              });
            }}
          >
            <Plus size={14} /> Seviye ekle
          </Dugme>
        }
      >
        {pass.levels.length === 0 ? (
          <BosDurum ikon={<Gift size={26} />} baslik="Seviye yok; toplanan XP hiçbir ödüle çıkmıyor." />
        ) : (
          <div className="space-y-3 p-4">
            {pass.levels.map((seviye: any) => (
              <div key={seviye.level} className="rounded-3xl border border-white/[0.05] bg-black/20 p-8 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`${RAKAM} flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--panel-success,#30d158)]/15 text-[13px] font-bold text-[color:var(--panel-success,#30d158)]`}>
                      {seviye.level}
                    </span>
                    <span className={`${RAKAM} text-[11px] font-bold text-slate-400`}>
                      {sayi(Number(seviye.requiredXp) || 0)} XP
                    </span>
                  </div>
                  <SilDugmesi
                    onClick={() => onGuncelle({ levels: pass.levels.filter((l: any) => l.level !== seviye.level) })}
                    etiket={`Seviye ${seviye.level} sil`}
                  />
                </div>
                <div className="grid grid-cols-1 gap-8 xl:grid-cols-4">
                  <Alan etiket="Seviye">
                    <Girdi modul={MODUL} sayisal type="number" value={seviye.level ?? 1} onChange={(e) => seviyeGuncelle(Number(seviye.level), { level: Number(e.target.value) })} />
                  </Alan>
                  <Alan etiket="Gerekli XP">
                    <Girdi modul={MODUL} sayisal type="number" value={seviye.requiredXp ?? 0} onChange={(e) => seviyeGuncelle(Number(seviye.level), { requiredXp: Number(e.target.value) })} />
                  </Alan>
                  <Alan etiket="Ücretsiz ödül">
                    <Girdi modul={MODUL} value={seviye.freeRewardLabel || ''} onChange={(e) => seviyeGuncelle(Number(seviye.level), { freeRewardLabel: e.target.value })} />
                  </Alan>
                  <Alan etiket="Ücretsiz tutar">
                    <AlanIcinde ek="TL">
                      <Girdi modul={MODUL} sayisal type="number" value={seviye.freeAmount ?? 0} onChange={(e) => seviyeGuncelle(Number(seviye.level), { freeAmount: Number(e.target.value) })} />
                    </AlanIcinde>
                  </Alan>
                  <Alan etiket="Ücretsiz kampanya" className="xl:col-span-2">
                    <Secim modul={MODUL} value={String(seviye.freeBonusId || '')} onChange={(e) => seviyeGuncelle(Number(seviye.level), { freeBonusId: e.target.value || null })}>
                      <option value="">Yok</option>
                      {bonusOptions.map((o: any) => <option key={o.id} value={o.id}>{o.display}</option>)}
                    </Secim>
                  </Alan>
                  {pass.premiumEnabled && (
                    <>
                      <Alan etiket="Premium ödül">
                        <Girdi modul={MODUL} value={seviye.premiumRewardLabel || ''} onChange={(e) => seviyeGuncelle(Number(seviye.level), { premiumRewardLabel: e.target.value })} />
                      </Alan>
                      <Alan etiket="Premium kampanya">
                        <Secim modul={MODUL} value={String(seviye.premiumBonusId || '')} onChange={(e) => seviyeGuncelle(Number(seviye.level), { premiumBonusId: e.target.value || null })}>
                          <option value="">Yok</option>
                          {bonusOptions.map((o: any) => <option key={o.id} value={o.id}>{o.display}</option>)}
                        </Secim>
                      </Alan>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Bolum>
    </div>
  );
}
