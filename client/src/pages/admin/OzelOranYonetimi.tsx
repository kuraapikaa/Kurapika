import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Plus, Save, Search, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/client';
import { cn } from '@/lib/utils';

/**
 * ÖZEL ORAN YÖNETİMİ.
 *
 * Teklif tanımlama ve sonuçlandırma. Sonuçlandırma PARA DAĞITIYOR;
 * bu yüzden önce kuru gösterim zorunlu.
 *
 * ── Neden azami yükümlülük gösteriliyor ───────────────────────────────
 * Bir teklifin en kötü durumda kasaya maliyeti (her katılımcı üst
 * sınırdan kazanırsa) kartın üstünde duruyor. 3.50 oran ile 5.00 oran
 * arasındaki fark, katılımcı sayısıyla çarpıldığında büyüyor ve bunun
 * teklif YAYINDAYKEN görülmesi gerekiyor.
 */

type Teklif = {
  id: string;
  matchName: string;
  marketName?: string;
  selectionName: string;
  specialOdd: number;
  maxStake: number;
  minStake?: number;
  opensAt?: string | null;
  closesAt?: string | null;
  enabled?: boolean;
  status?: string;
  note?: string;
  katilimci: number;
  odenen: number;
  odenenTutar: number;
  azamiYukumluluk: number;
};

type SonucSatiri = {
  login: string; uygun: boolean; ekOdeme: number; mesaj: string;
  durum: string; esasTutar?: number; alinanOran?: number;
};

const para = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n || 0);

/** `datetime-local` alanı ISO bekliyor; boş değer null olmalı. */
const yerelDenIso = (v: string) => (v ? new Date(v).toISOString() : null);
const isoDanYerel = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const bosTeklif = (): Partial<Teklif> => ({
  matchName: '', marketName: 'Maç Sonucu', selectionName: '',
  specialOdd: 3, maxStake: 1000, minStake: 50, enabled: true, status: 'acik', note: '',
});

export function OzelOranYonetimi() {
  const queryClient = useQueryClient();
  const [duzenlenen, setDuzenlenen] = useState<Partial<Teklif> | null>(null);
  const [sonuc, setSonuc] = useState<{ id: string; satirlar: SonucSatiri[]; toplam: number; kuru: boolean } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ozel-oran'],
    queryFn: () => adminApi.ozelOranListesi(),
  });
  const teklifler: Teklif[] = data?.teklifler ?? [];

  const kaydet = useMutation({
    mutationFn: (teklif: Partial<Teklif>) => adminApi.ozelOranKaydet(teklif),
    onSuccess: (c: any) => {
      if (!c?.ok) return toast.error(c?.message || 'Kaydedilemedi');
      toast.success('Teklif kaydedildi');
      setDuzenlenen(null);
      queryClient.invalidateQueries({ queryKey: ['ozel-oran'] });
    },
    onError: () => toast.error('Kaydedilemedi'),
  });

  const sil = useMutation({
    mutationFn: (id: string) => adminApi.ozelOranSil(id),
    onSuccess: () => {
      toast.success('Teklif silindi');
      queryClient.invalidateQueries({ queryKey: ['ozel-oran'] });
    },
  });

  const sonuclandir = useMutation({
    mutationFn: (args: { id: string; kuru: boolean }) => adminApi.ozelOranSonuclandir(args.id, args.kuru),
    onSuccess: (c: any, args) => {
      if (!c?.ok) return toast.error(c?.message || 'Sonuçlandırılamadı');
      setSonuc({ id: args.id, satirlar: c.satirlar ?? [], toplam: c.toplam ?? 0, kuru: args.kuru });
      if (!args.kuru) {
        toast.success(`${para(c.toplam)} ₺ ödendi.`);
        queryClient.invalidateQueries({ queryKey: ['ozel-oran'] });
      }
      if (c.uyari) toast.warning(c.uyari);
    },
    onError: () => toast.error('Sonuçlandırılamadı'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-slate-400">
          Oyuncu bahsi sitede alır; maç sonuçlanınca <b className="text-slate-200">özel oran ile alınan oran arasındaki fark</b> bakiyesine yazılır.
        </p>
        <button
          onClick={() => setDuzenlenen(bosTeklif())}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-black transition hover:bg-amber-300"
        >
          <Plus size={15} /> Teklif ekle
        </button>
      </div>

      {duzenlenen && (
        <TeklifFormu
          teklif={duzenlenen}
          onDegis={setDuzenlenen}
          onKaydet={() => kaydet.mutate(duzenlenen)}
          onIptal={() => setDuzenlenen(null)}
          kaydediliyor={kaydet.isPending}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-amber-300" size={26} /></div>
      ) : teklifler.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-white/[0.06] py-12 text-center text-xs font-semibold text-slate-500">
          Tanımlı özel oran yok.
        </p>
      ) : (
        <div className="space-y-3">
          {teklifler.map((t) => (
            <div key={t.id} className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-4 backdrop-blur-xl">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{t.matchName}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                    {t.marketName ? `${t.marketName} · ` : ''}{t.selectionName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-black tabular-nums text-amber-300">{Number(t.specialOdd).toFixed(2)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">özel oran</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-500">
                <span>{t.katilimci} katılımcı</span>
                <span>üst sınır {para(t.maxStake)} ₺</span>
                {/* En kotu durum: teklif YAYINDAYKEN gorulmeli. */}
                <span className={cn('font-black', t.azamiYukumluluk > 50_000 ? 'text-rose-300' : 'text-slate-400')}>
                  azami yükümlülük {para(t.azamiYukumluluk)} ₺
                </span>
                {t.odenen > 0 && <span className="text-emerald-300">{t.odenen} ödeme · {para(t.odenenTutar)} ₺</span>}
                <span className={cn('rounded px-1.5 py-0.5',
                  t.status === 'sonuclandi' ? 'bg-slate-500/15 text-slate-400' : 'bg-emerald-400/10 text-emerald-300')}>
                  {t.status === 'sonuclandi' ? 'sonuçlandı' : 'açık'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setDuzenlenen(t)}
                  className="h-8 rounded-3xl border border-white/[0.06] bg-white/[0.03] px-3 text-[10px] font-bold text-slate-200 transition hover:bg-white/[0.08]"
                >
                  Düzenle
                </button>
                {/*
                  Kuru gosterim ZORUNLU degil ama ONCE sunuluyor: para
                  dagitan bir islemi tek tikla calistirmak, yanlis bir
                  teklif tanimini binlerce liraya cevirirdi.
                */}
                <button
                  onClick={() => sonuclandir.mutate({ id: t.id, kuru: true })}
                  disabled={sonuclandir.isPending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-3xl border border-white/[0.06] bg-white/[0.03] px-3 text-[10px] font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  <Search size={12} /> Kim ne alacak?
                </button>
                {sonuc?.id === t.id && sonuc.kuru && sonuc.toplam > 0 && (
                  <button
                    onClick={() => sonuclandir.mutate({ id: t.id, kuru: false })}
                    disabled={sonuclandir.isPending}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-rose-400 px-3 text-[10px] font-bold text-black transition hover:bg-rose-300 disabled:opacity-50"
                  >
                    <Save size={12} /> {para(sonuc.toplam)} ₺ öde
                  </button>
                )}
                <button
                  onClick={() => { if (confirm(`"${t.matchName}" teklifi silinsin mi?`)) sil.mutate(t.id); }}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-3xl px-3 text-[10px] font-bold text-slate-500 transition hover:text-rose-300"
                >
                  <Trash2 size={12} /> Sil
                </button>
              </div>

              {sonuc?.id === t.id && <SonucListesi sonuc={sonuc} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SonucListesi({ sonuc }: { sonuc: { satirlar: SonucSatiri[]; toplam: number; kuru: boolean } }) {
  if (sonuc.satirlar.length === 0) {
    return <p className="mt-3 text-[11px] font-semibold text-slate-500">Katılımcı yok.</p>;
  }
  return (
    <div className="mt-3 space-y-1.5 border-t border-white/[0.05] pt-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {sonuc.kuru ? 'Kuru gösterim — hiçbir şey yazılmadı' : 'Ödeme sonucu'} · toplam {para(sonuc.toplam)} ₺
      </p>
      {sonuc.satirlar.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="w-28 shrink-0 font-bold text-slate-200">{s.login}</span>
          <span className={cn('w-24 shrink-0 text-right font-black tabular-nums',
            s.ekOdeme > 0 ? 'text-emerald-300' : 'text-slate-600')}>
            {s.ekOdeme > 0 ? `${para(s.ekOdeme)} ₺` : '—'}
          </span>
          <span className={cn('min-w-0 flex-1 text-slate-500',
            s.durum === 'telafiBekliyor' && 'font-bold text-rose-300')}>
            {s.durum === 'telafiBekliyor' && <AlertTriangle size={11} className="mr-1 inline" />}
            {s.mesaj}
          </span>
        </div>
      ))}
    </div>
  );
}

function TeklifFormu({ teklif, onDegis, onKaydet, onIptal, kaydediliyor }: {
  teklif: Partial<Teklif>;
  onDegis: (t: Partial<Teklif>) => void;
  onKaydet: () => void;
  onIptal: () => void;
  kaydediliyor: boolean;
}) {
  const eksik = !teklif.matchName?.trim() || !teklif.selectionName?.trim() || !(Number(teklif.specialOdd) > 1);

  return (
    <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-5">
      <p className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
        <TrendingUp size={13} /> {teklif.id ? 'Teklifi düzenle' : 'Yeni teklif'}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Alan etiket="Maç adı *" ipucu="Bahis geçmişindeki maç adıyla kelime bazında eşleşir.">
          <Girdi value={teklif.matchName ?? ''} onChange={(v) => onDegis({ ...teklif, matchName: v })} placeholder="Galatasaray - Fenerbahçe" />
        </Alan>
        <Alan etiket="Pazar" ipucu="Boş: pazar aranmaz.">
          <Girdi value={teklif.marketName ?? ''} onChange={(v) => onDegis({ ...teklif, marketName: v })} placeholder="Maç Sonucu" />
        </Alan>
        <Alan etiket="Seçim *">
          <Girdi value={teklif.selectionName ?? ''} onChange={(v) => onDegis({ ...teklif, selectionName: v })} placeholder="Galatasaray" />
        </Alan>
        <Alan etiket="Özel oran *" ipucu="1.00 üzerinde olmalı.">
          <Girdi type="number" value={String(teklif.specialOdd ?? '')} onChange={(v) => onDegis({ ...teklif, specialOdd: Number(v) })} />
        </Alan>
        <Alan etiket="Üst sınır (₺)" ipucu="Ek ödemeye esas en yüksek bahis.">
          <Girdi type="number" value={String(teklif.maxStake ?? '')} onChange={(v) => onDegis({ ...teklif, maxStake: Number(v) })} />
        </Alan>
        <Alan etiket="Alt sınır (₺)" ipucu="0 = aranmaz.">
          <Girdi type="number" value={String(teklif.minStake ?? 0)} onChange={(v) => onDegis({ ...teklif, minStake: Number(v) })} />
        </Alan>
        <Alan etiket="Açılış" ipucu="Bu andan önce alınan bahis kapsam dışı.">
          <Girdi type="datetime-local" value={isoDanYerel(teklif.opensAt)} onChange={(v) => onDegis({ ...teklif, opensAt: yerelDenIso(v) })} />
        </Alan>
        <Alan etiket="Kapanış">
          <Girdi type="datetime-local" value={isoDanYerel(teklif.closesAt)} onChange={(v) => onDegis({ ...teklif, closesAt: yerelDenIso(v) })} />
        </Alan>
        <Alan etiket="Not" ipucu="Oyuncuya gösterilir.">
          <Girdi value={teklif.note ?? ''} onChange={(v) => onDegis({ ...teklif, note: v })} />
        </Alan>
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <button onClick={onIptal} className="h-9 rounded-3xl border border-white/[0.06] px-4 text-xs font-bold text-slate-400 hover:text-white">
          İptal
        </button>
        <button
          onClick={onKaydet}
          disabled={eksik || kaydediliyor}
          title={eksik ? 'Maç adı, seçim ve 1.00 üzeri oran zorunlu' : undefined}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-400 px-5 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {kaydediliyor ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Kaydet
        </button>
      </div>
    </section>
  );
}

function Alan({ etiket, ipucu, children }: { etiket: string; ipucu?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{etiket}</label>
      {children}
      {ipucu && <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{ipucu}</p>}
    </div>
  );
}

function Girdi({ value, onChange, type = 'text', placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-3xl border border-white/[0.05] bg-black/30 px-3 text-xs font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/40 [color-scheme:dark]"
    />
  );
}
