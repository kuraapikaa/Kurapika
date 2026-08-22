import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowDown, ArrowUp, Crown, ImageUp, Loader2,
  Plus, Save, Trash2, TrendingUp, X,
} from 'lucide-react';
import { gamesApi } from '@/api/client';
import { cn } from '@/lib/utils';
import { SEVIYE_BASINA_XP } from '@/lib/sadakatIlerlemesi';
import {
  EN_BUYUK_KENAR, gorseliKucult, kbYaz, veriUriBoyutu,
} from '@/lib/gorselKucult';
import {
  oyuncununSeviyesi, seviyeUyarilari, seviyeXp,
  seviyeleriNormalize, seviyeleriSirala, type VipSeviye,
} from '@/lib/vipSeviyeleri';

/**
 * VIP SEVİYE AYARLARI.
 *
 * ── Neden baştan yazıldı ──────────────────────────────────────────────
 * Eski sayfa VIP'i BAŞVURUYLA yönetiyordu: oyuncu form dolduruyor, burada
 * bir başvuru listesi onaylanıyordu. Yanı sıra iki ayrı merdiven vardı ve
 * birbirlerinden habersizdiler -- pazarlama kartları (`tiers`, eşiği yok)
 * ve XP merdiveni (`ranks`, panelden hiç düzenlenemiyordu). Oyuncu VIP
 * sayfasında ikisini birden görüyor, hangisinin gerçek olduğunu
 * anlayamıyordu.
 *
 * Artık tek bir liste var ve ölçüsü XP: oyuncunun sadakat seviyesi
 * (sunucuda `level = floor(xp/1000)+1`) hangi eşiği geçtiyse VIP seviyesi
 * odur. Onay, başvuru, elle atama yok.
 *
 * ── Eşik nasıl yazılıyor ──────────────────────────────────────────────
 * Operatör BAŞLANGIÇ SEVİYESİ giriyor, gereken XP ondan türetilip anında
 * gösteriliyor. İkisi ayrı ayrı girilseydi biri değişip diğeri kalınca
 * merdiven kendi içinde çelişirdi.
 */

type VipYapilandirma = {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  stats: Array<{ id: string; value: string; label: string }>;
  faq: Array<{ id: string; q: string; a: string; kategori?: string }>;
  ranks: VipSeviye[];
  showStats: boolean;
  showFaq: boolean;
  /** Başvuru formu artık seviyeyi belirlemiyor; varsayılan kapalı. */
  formActive: boolean;
};

const xpYaz = (n: number) => new Intl.NumberFormat('tr-TR').format(Math.max(0, Math.round(n)));

const yeniKimlik = (onEk: string) => `${onEk}-${Math.random().toString(36).slice(2, 8)}`;

function yapilandirmayiNormalize(ham: any): VipYapilandirma {
  const kayit = ham ?? {};
  return {
    isActive: kayit.isActive !== false,
    eyebrow: String(kayit.eyebrow ?? 'VIP Üyelik Programı'),
    title: String(kayit.title ?? 'Ayrıcalıklı deneyim, özel avantajlar'),
    description: String(
      kayit.description ??
        'Oynadıkça XP kazan, seviyen yükseldikçe VIP ayrıcalıkların otomatik olarak açılsın.',
    ),
    stats: Array.isArray(kayit.stats) ? kayit.stats : [],
    faq: Array.isArray(kayit.faq) ? kayit.faq : [],
    ranks: seviyeleriNormalize(kayit),
    showStats: kayit.showStats !== false,
    showFaq: kayit.showFaq !== false,
    formActive: kayit.formActive === true,
  };
}

export function VIPSettings() {
  const queryClient = useQueryClient();
  const [cfg, setCfg] = useState<VipYapilandirma | null>(null);
  const [acikSeviye, setAcikSeviye] = useState<string | null>(null);
  /** Önizleme için denenen sadakat seviyesi. */
  const [denemeSeviyesi, setDenemeSeviyesi] = useState(1);

  const yapilandirma = useQuery({
    queryKey: ['admin-games-config'],
    queryFn: () => gamesApi.config(),
  });

  useEffect(() => {
    if (cfg) return;
    if (yapilandirma.data) setCfg(yapilandirmayiNormalize(yapilandirma.data?.data?.vip));
    else if (yapilandirma.isError) setCfg(yapilandirmayiNormalize(null));
  }, [cfg, yapilandirma.data, yapilandirma.isError]);

  const kaydet = useMutation({
    mutationFn: async () => {
      if (!cfg) throw new Error('Ayarlar henüz yüklenmedi.');
      const mevcut = await gamesApi.config();
      /*
       * `tiers` KASITLI olarak yazılmıyor: seviyeler artık `ranks`.
       * Eski alan kaydın içinde kalırsa (mevcut.data.vip'ten gelerek)
       * oyuncu sayfası hangisini çizeceğini bilemez ve iki merdiven
       * sorunu geri döner.
       */
      const oncekiVip = (mevcut?.data?.vip ?? {}) as any;
      const { tiers: _eskiKartlar, ...korunan } = oncekiVip;
      return gamesApi.saveConfig({
        ...(mevcut?.data || {}),
        vip: { ...korunan, ...cfg, ranks: seviyeleriSirala(cfg.ranks) },
      });
    },
    onSuccess: () => {
      toast.success('VIP seviyeleri kaydedildi.');
      queryClient.invalidateQueries({ queryKey: ['admin-games-config'] });
    },
    onError: (hata: any) => toast.error(hata?.message || 'Kaydetme başarısız.'),
  });

  const seviyeler = cfg?.ranks ?? [];
  const uyarilar = useMemo(() => seviyeUyarilari(seviyeler), [seviyeler]);
  const denenenIndis = useMemo(
    () => oyuncununSeviyesi(denemeSeviyesi, seviyeler),
    [denemeSeviyesi, seviyeler],
  );
  const logoAgirligi = useMemo(
    () => seviyeler.reduce((t, s) => t + veriUriBoyutu(s.logoUrl), 0),
    [seviyeler],
  );

  if (!cfg) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-white/40" size={28} />
      </div>
    );
  }

  const guncelle = (yama: Partial<VipYapilandirma>) => setCfg({ ...cfg, ...yama });

  const seviyeGuncelle = (id: string, yama: Partial<VipSeviye>) =>
    guncelle({ ranks: seviyeler.map((s) => (s.id === id ? { ...s, ...yama } : s)) });

  const seviyeEkle = () => {
    const enYuksek = seviyeler.reduce((m, s) => Math.max(m, s.minLevel), 0);
    const id = yeniKimlik('seviye');
    guncelle({
      ranks: [
        ...seviyeler,
        { id, label: 'Yeni seviye', minLevel: enYuksek + 10, badge: '⭐', perks: [] },
      ],
    });
    setAcikSeviye(id);
  };

  const seviyeSil = (id: string) => guncelle({ ranks: seviyeler.filter((s) => s.id !== id) });

  /**
   * Sıra değiştirme, eşikleri TAKAS ederek çalışıyor.
   * Yalnızca dizideki yeri değişseydi liste kaydedilirken `minLevel`e göre
   * yeniden sıralanır ve düğme hiçbir şey yapmamış gibi görünürdü.
   */
  const seviyeTasi = (id: string, yon: -1 | 1) => {
    const sirali = seviyeleriSirala(seviyeler);
    const i = sirali.findIndex((s) => s.id === id);
    const j = i + yon;
    if (i < 0 || j < 0 || j >= sirali.length) return;
    const a = sirali[i];
    const b = sirali[j];
    guncelle({
      ranks: seviyeler.map((s) =>
        s.id === a.id ? { ...s, minLevel: b.minLevel } : s.id === b.id ? { ...s, minLevel: a.minLevel } : s,
      ),
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-5 backdrop-blur-xl">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
            <Crown size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-[-0.02em] text-white">VIP seviyeleri</h1>
            <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-slate-400">
              Seviyeler <b className="text-slate-200">otomatik</b> belirleniyor: oyuncunun sadakat
              seviyesi (her {xpYaz(SEVIYE_BASINA_XP)} XP bir seviye) hangi eşiği geçtiyse VIP seviyesi
              odur. Başvuru, onay veya elle atama yok.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] font-bold text-slate-300">
            <input
              type="checkbox"
              checked={cfg.isActive}
              onChange={(e) => guncelle({ isActive: e.target.checked })}
              className="h-3.5 w-3.5 accent-amber-400"
            />
            Sayfa yayında
          </label>
          <button
            type="button"
            onClick={() => kaydet.mutate()}
            disabled={kaydet.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff9f0a] px-4 text-xs font-black uppercase tracking-widest text-[#050609] transition hover:brightness-110 disabled:opacity-50"
          >
            {kaydet.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Kaydet
          </button>
        </div>
      </header>

      {uyarilar.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-4">
          {uyarilar.map((uyari) => (
            <p key={uyari} className="flex items-start gap-2 text-[11px] font-semibold leading-5 text-amber-200">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {uyari}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-3">
          {seviyeleriSirala(seviyeler).map((seviye, sira, hepsi) => {
            const acik = acikSeviye === seviye.id;
            const sonraki = hepsi[sira + 1];
            return (
              <article
                key={seviye.id}
                className={cn(
                  'overflow-hidden rounded-2xl border bg-white/[0.02] transition',
                  denenenIndis === sira ? 'border-amber-400/40' : 'border-white/[0.05]',
                )}
              >
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <SeviyeLogosu
                    seviye={seviye}
                    onDegis={(logoUrl) => seviyeGuncelle(seviye.id, { logoUrl })}
                  />

                  <div className="min-w-[160px] flex-1">
                    <input
                      value={seviye.label}
                      onChange={(e) => seviyeGuncelle(seviye.id, { label: e.target.value })}
                      placeholder="Seviye adı"
                      className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm font-bold text-white outline-none transition focus:border-amber-400/50"
                    />
                    <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                      {xpYaz(seviyeXp(seviye))} XP
                      {sonraki
                        ? ` — ${xpYaz(seviyeXp(sonraki) - 1)} XP arası`
                        : ' ve üzeri'}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Başlangıç seviyesi
                    <input
                      type="number"
                      min={1}
                      value={seviye.minLevel}
                      onChange={(e) =>
                        seviyeGuncelle(seviye.id, { minLevel: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="h-9 w-20 rounded-lg border border-white/5 bg-white/[0.02] px-2 text-center text-sm font-bold text-white outline-none transition focus:border-amber-400/50"
                    />
                  </label>

                  <div className="flex items-center gap-1">
                    <IkonDugme etiket="Yukarı taşı" onClick={() => seviyeTasi(seviye.id, -1)} pasif={sira === 0}>
                      <ArrowUp size={14} />
                    </IkonDugme>
                    <IkonDugme
                      etiket="Aşağı taşı"
                      onClick={() => seviyeTasi(seviye.id, 1)}
                      pasif={sira === hepsi.length - 1}
                    >
                      <ArrowDown size={14} />
                    </IkonDugme>
                    <button
                      type="button"
                      onClick={() => setAcikSeviye(acik ? null : seviye.id)}
                      className="rounded-lg border border-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:bg-white/[0.04]"
                    >
                      {seviye.perks.length} avantaj
                    </button>
                    <IkonDugme etiket="Seviyeyi sil" onClick={() => seviyeSil(seviye.id)} tehlike>
                      <Trash2 size={14} />
                    </IkonDugme>
                  </div>
                </div>

                {acik && (
                  <div className="space-y-3 border-t border-white/5 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
                        Simge
                        <input
                          value={seviye.badge ?? ''}
                          onChange={(e) => seviyeGuncelle(seviye.id, { badge: e.target.value })}
                          placeholder="🥇"
                          className="h-9 w-16 rounded-lg border border-white/5 bg-white/[0.02] text-center text-base outline-none focus:border-amber-400/50"
                        />
                        <span className="text-[10px] font-medium text-slate-500">logo yoksa kullanılır</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(seviye.oneCikan)}
                          onChange={(e) => seviyeGuncelle(seviye.id, { oneCikan: e.target.checked })}
                          className="h-3.5 w-3.5 accent-amber-400"
                        />
                        Sayfada öne çıkar
                      </label>
                    </div>

                    <AvantajListesi
                      perks={seviye.perks}
                      onDegis={(perks) => seviyeGuncelle(seviye.id, { perks })}
                    />
                  </div>
                )}
              </article>
            );
          })}

          <button
            type="button"
            onClick={seviyeEkle}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400 transition hover:border-amber-400/30 hover:text-amber-200"
          >
            <Plus size={15} />
            Seviye ekle
          </button>
        </section>

        <aside className="space-y-4">
          {/*
            ÖNİZLEME. Eşikleri yazarken "bu XP'de oyuncu hangi seviyede
            olur" sorusunun cevabı ancak canlıda görülüyordu; yanlış bir
            eşik ise sessizce yanlış kalıyordu.
          */}
          <div className="space-y-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <TrendingUp size={13} />
              Önizleme
            </p>
            <label className="block text-[11px] font-semibold text-slate-400">
              Sadakat seviyesi
              <input
                type="range"
                min={1}
                max={80}
                value={denemeSeviyesi}
                onChange={(e) => setDenemeSeviyesi(Number(e.target.value))}
                className="mt-2 w-full accent-amber-400"
              />
            </label>
            <div className="rounded-xl bg-black/30 p-3">
              <p className="text-[11px] font-semibold text-slate-400">
                Seviye {denemeSeviyesi} · {xpYaz((denemeSeviyesi - 1) * SEVIYE_BASINA_XP)} XP
              </p>
              <p className="mt-1 text-sm font-black text-white">
                {denenenIndis >= 0
                  ? seviyeleriSirala(seviyeler)[denenenIndis].label
                  : 'Hiçbir VIP seviyesinde değil'}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sayfa metni</p>
            <Alan etiket="Üst başlık" deger={cfg.eyebrow} onDegis={(eyebrow) => guncelle({ eyebrow })} />
            <Alan etiket="Başlık" deger={cfg.title} onDegis={(title) => guncelle({ title })} />
            <Alan
              etiket="Açıklama"
              deger={cfg.description}
              onDegis={(description) => guncelle({ description })}
              cokSatir
            />
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-300">
              <input
                type="checkbox"
                checked={cfg.showFaq}
                onChange={(e) => guncelle({ showFaq: e.target.checked })}
                className="h-3.5 w-3.5 accent-amber-400"
              />
              Sık sorulan sorular görünsün
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-300">
              <input
                type="checkbox"
                checked={cfg.showStats}
                onChange={(e) => guncelle({ showStats: e.target.checked })}
                className="h-3.5 w-3.5 accent-amber-400"
              />
              İstatistik şeridi görünsün
            </label>
          </div>

          {/*
            Logolar oyun yapılandırmasının içinde saklanıyor ve o yanıt her
            oyuncuya gidiyor. Görseller yüklenirken küçültülüyor ama toplam
            ağırlığı görmek, kimsenin fark etmeden lobiyi yavaşlatmasını
            önlüyor.
          */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Logo ağırlığı</p>
            <p className="mt-2 text-lg font-black text-white">{kbYaz(logoAgirligi)}</p>
            <p className="mt-1 text-[10px] font-medium leading-4 text-slate-500">
              Logolar yapılandırmayla birlikte her oyuncuya gidiyor. Yüklenen görseller
              {' '}{EN_BUYUK_KENAR} px&apos;e küçültülüp WebP&apos;ye çevriliyor.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Seviye logosu: yükle, önizle, kaldır. */
function SeviyeLogosu({
  seviye,
  onDegis,
}: {
  seviye: VipSeviye;
  onDegis: (logoUrl: string | undefined) => void;
}) {
  const [yukleniyor, setYukleniyor] = useState(false);
  const girdiRef = useRef<HTMLInputElement>(null);

  const secildi = async (dosya?: File) => {
    if (!dosya) return;
    setYukleniyor(true);
    try {
      const sonuc = await gorseliKucult(dosya);
      onDegis(sonuc.veriUri);
      toast.success(`Logo yüklendi (${sonuc.genislik}×${sonuc.yukseklik}, ${kbYaz(sonuc.bayt)}).`);
    } catch (hata: any) {
      toast.error(hata?.message || 'Görsel yüklenemedi.');
    } finally {
      setYukleniyor(false);
      // Aynı dosya art arda seçilebilsin: input değeri değişmezse
      // `change` bir daha tetiklenmiyor.
      if (girdiRef.current) girdiRef.current.value = '';
    }
  };

  return (
    <div className="relative shrink-0">
      <label
        className="grid h-14 w-14 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 text-xl transition hover:border-amber-400/40"
        title={seviye.logoUrl ? 'Logoyu değiştir' : 'Logo yükle'}
      >
        {yukleniyor ? (
          <Loader2 size={16} className="animate-spin text-slate-400" />
        ) : seviye.logoUrl ? (
          <img src={seviye.logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="grid place-items-center gap-0.5 text-center">
            <span>{seviye.badge || '—'}</span>
            <ImageUp size={11} className="text-slate-500" />
          </span>
        )}
        <input
          ref={girdiRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => void secildi(e.target.files?.[0])}
        />
        <span className="sr-only">{seviye.label} logosu yükle</span>
      </label>

      {seviye.logoUrl && (
        <button
          type="button"
          onClick={() => onDegis(undefined)}
          title="Logoyu kaldır"
          className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-[#0b0d12] text-slate-400 transition hover:text-rose-300"
        >
          <X size={11} />
          <span className="sr-only">{seviye.label} logosunu kaldır</span>
        </button>
      )}
    </div>
  );
}

function AvantajListesi({ perks, onDegis }: { perks: string[]; onDegis: (perks: string[]) => void }) {
  return (
    <div className="space-y-2">
      {perks.map((perk, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={perk}
            onChange={(e) => onDegis(perks.map((p, j) => (j === i ? e.target.value : p)))}
            placeholder="Avantaj"
            className="h-9 flex-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 text-xs font-semibold text-white outline-none transition focus:border-amber-400/50"
          />
          <IkonDugme etiket="Avantajı sil" onClick={() => onDegis(perks.filter((_, j) => j !== i))} tehlike>
            <Trash2 size={13} />
          </IkonDugme>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onDegis([...perks, ''])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 transition hover:text-amber-200"
      >
        <Plus size={12} />
        Avantaj ekle
      </button>
    </div>
  );
}

function Alan({
  etiket,
  deger,
  onDegis,
  cokSatir,
}: {
  etiket: string;
  deger: string;
  onDegis: (v: string) => void;
  cokSatir?: boolean;
}) {
  const ortak =
    'w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs font-semibold text-white outline-none transition focus:border-amber-400/50';
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{etiket}</span>
      {cokSatir ? (
        <textarea rows={3} value={deger} onChange={(e) => onDegis(e.target.value)} className={ortak} />
      ) : (
        <input value={deger} onChange={(e) => onDegis(e.target.value)} className={ortak} />
      )}
    </label>
  );
}

function IkonDugme({
  etiket,
  onClick,
  pasif,
  tehlike,
  children,
}: {
  etiket: string;
  onClick: () => void;
  pasif?: boolean;
  tehlike?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pasif}
      title={etiket}
      aria-label={etiket}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-lg border border-white/5 text-slate-400 transition',
        pasif ? 'opacity-30' : tehlike ? 'hover:bg-rose-500/10 hover:text-rose-300' : 'hover:bg-white/[0.05] hover:text-white',
      )}
    >
      {children}
    </button>
  );
}
