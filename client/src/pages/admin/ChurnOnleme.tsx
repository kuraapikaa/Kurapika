import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Download,
  Gift,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  UserX,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/api/client';
import { cn } from '@/lib/utils';

/**
 * CHURN ÖNLEME.
 *
 * Kayıp riski taşıyan oyuncuların ÖNCELİKLİ çalışma listesi. Her satır
 * "neden riskli" ve "ne yapılmalı" bilgisini taşıyor; operatör listeyi
 * yukarıdan aşağı işliyor.
 *
 * ── Neden sadece risk yüzdesi göstermiyoruz ───────────────────────────
 * Yüzde tek başına eyleme dönüşmüyor: %82 riskli bir oyuncu için ne
 * yapılacağı belli değil. Bu yüzden her satırda gerekçe (hangi sinyal
 * tetiklendi) ve öneri (hangi teklif uygun) yan yana duruyor.
 */

type Bilesen = { anahtar: string; ad: string; puan: number; agirlik: number; gerekce: string };

type Satir = {
  login: string;
  playerId?: number;
  segment: 'saglikli' | 'izle' | 'riskli' | 'kritik' | 'kayip' | 'yeni' | 'veriYok';
  risk: number;
  oncelik: number;
  bilesenler: Bilesen[];
  degerKatmani: 'yuksek' | 'orta' | 'dusuk';
  oneri: string;
  oneriMetni: string;
  ozet: string;
  olculer: {
    sonYatirimGun: number | null;
    ortalamaAralikGun: number | null;
    gecikmeOrani: number | null;
    sonDonemYatirim: number;
    oncekiDonemYatirim: number;
    dususYuzdesi: number | null;
    omurBoyuYatirim: number;
    netKayip: number;
    yatirimSayisi: number;
    sonIslemCekimMi: boolean;
    uyelikGun: number | null;
  };
};

type Sonuc = {
  ok: boolean;
  satirlar: Satir[];
  dagilim: Record<string, number>;
  riskliHacim: number;
  taranan: number;
  pencereGun: number;
  uyari?: string | null;
  message?: string;
};

const para = (n: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n || 0);

const SEGMENT_ADI: Record<Satir['segment'], string> = {
  kritik: 'Kritik',
  riskli: 'Riskli',
  izle: 'İzle',
  saglikli: 'Sağlıklı',
  kayip: 'Kayıp',
  yeni: 'Yeni',
  veriYok: 'Veri yok',
};

/** Segment rengi: kritikten sağlıklıya doğru soğuyor. */
const SEGMENT_RENGI: Record<Satir['segment'], string> = {
  kritik: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  riskli: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  izle: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  saglikli: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  kayip: 'border-slate-500/25 bg-slate-500/10 text-slate-400',
  yeni: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  veriYok: 'border-white/10 bg-white/[0.04] text-slate-500',
};

/** Öneri → görsel + hedef sayfa. Operatör tek tıkla eyleme geçebilsin. */
const ONERI_BILGI: Record<string, { ad: string; ikon: any; yol?: string }> = {
  bekle: { ad: 'Bekle', ikon: RefreshCw },
  kayipBonusu: { ad: 'Kayıp bonusu', ikon: Gift, yol: '/bonus-kurallari' },
  yatirimBonusu: { ad: 'Yatırım bonusu', ikon: Gift, yol: '/bonus-kurallari' },
  freespin: { ad: 'Freespin', ikon: Sparkles, yol: '/bonuslar' },
  ara: { ad: 'Ara', ikon: Phone, yol: '/admin/formlar' },
  vipTemas: { ad: 'VIP teması', ikon: Phone, yol: '/admin/vip-ayarlari' },
  geriKazanim: { ad: 'Geri kazanım', ikon: UserX, yol: '/bonus-kurallari' },
};

const DEGER_ADI: Record<Satir['degerKatmani'], string> = {
  yuksek: 'Yüksek değer',
  orta: 'Orta değer',
  dusuk: 'Düşük değer',
};

export function ChurnOnleme() {
  const [gunSayisi, setGunSayisi] = useState(60);
  const [enFazlaOyuncu, setEnFazlaOyuncu] = useState(150);
  const [kayipGun, setKayipGun] = useState(60);
  const [segmentSuzgeci, setSegmentSuzgeci] = useState<Satir['segment'] | 'hepsi'>('hepsi');
  const [acikSatir, setAcikSatir] = useState<string | null>(null);

  const analiz = useMutation<Sonuc>({
    mutationFn: () => adminApi.churnAnaliz({ gunSayisi, enFazlaOyuncu, kayipGun }),
    onSuccess: (cevap) => {
      if (!cevap?.ok) return toast.error(cevap?.message || 'Analiz yapılamadı');
      if (cevap.uyari) toast.warning(cevap.uyari);
      else toast.success(`${cevap.taranan} oyuncu tarandı.`);
    },
    onError: () => toast.error('Analiz yapılamadı'),
  });

  const sonuc = analiz.data;

  const suzulmus = useMemo(() => {
    if (!sonuc?.satirlar) return [];
    if (segmentSuzgeci === 'hepsi') return sonuc.satirlar;
    return sonuc.satirlar.filter((s) => s.segment === segmentSuzgeci);
  }, [sonuc, segmentSuzgeci]);

  const csvIndir = () => {
    if (!suzulmus.length) return;
    const basliklar = ['Kullanıcı', 'Segment', 'Risk', 'Öncelik', 'Değer', 'Son yatırım (gün)',
      'Ritim (gün)', 'Gecikme katı', 'Son 30g', 'Önceki 30g', 'Öneri', 'Gerekçe'];
    const satirlar = suzulmus.map((s) => [
      s.login, SEGMENT_ADI[s.segment], s.risk, s.oncelik, DEGER_ADI[s.degerKatmani],
      s.olculer.sonYatirimGun ?? '', s.olculer.ortalamaAralikGun ?? '', s.olculer.gecikmeOrani ?? '',
      s.olculer.sonDonemYatirim, s.olculer.oncekiDonemYatirim,
      ONERI_BILGI[s.oneri]?.ad ?? s.oneri, s.ozet.replace(/;/g, ','),
    ]);
    // Noktali virgul + BOM: Turkce Excel virgulu ondalik ayirici sayiyor.
    const csv = [basliklar, ...satirlar].map((r) => r.join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `churn-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-5 backdrop-blur-xl">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <SayiAlani
            etiket="Tarama penceresi"
            birim="gün"
            deger={gunSayisi}
            onChange={setGunSayisi}
            ipucu="Bu süre içinde yatırım yapmış oyuncular taranır."
          />
          <SayiAlani
            etiket="En fazla oyuncu"
            birim="kişi"
            deger={enFazlaOyuncu}
            onChange={setEnFazlaOyuncu}
            ipucu="Her oyuncu için ayrı sorgu yapılır; yüksek değer taramayı uzatır."
          />
          <SayiAlani
            etiket="Kayıp eşiği"
            birim="gün"
            deger={kayipGun}
            onChange={setKayipGun}
            ipucu="Bu süreyi aşan sessizlik artık geri kazanım işi sayılır."
          />
          <div className="flex items-end">
            <button
              onClick={() => analiz.mutate()}
              disabled={analiz.isPending}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-rose-400 px-4 text-xs font-bold text-black transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analiz.isPending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {analiz.isPending ? 'Taranıyor...' : 'Analizi çalıştır'}
            </button>
          </div>
        </div>
        {analiz.isPending && (
          <p className="mt-3 text-center text-xs font-semibold text-slate-500">
            Her oyuncunun tüm ödeme geçmişi tek tek çekiliyor; bu birkaç dakika sürebilir.
          </p>
        )}
      </section>

      {sonuc?.ok && (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <OzetKarti
              etiket="Risk altındaki hacim"
              deger={`${para(sonuc.riskliHacim)} ₺`}
              ton="rose"
              ikon={TrendingDown}
              alt="Son 30 gün · izle+riskli+kritik"
            />
            {(['kritik', 'riskli', 'izle', 'kayip'] as const).map((seg) => (
              <button
                key={seg}
                onClick={() => setSegmentSuzgeci((m) => (m === seg ? 'hepsi' : seg))}
                className={cn(
                  'rounded-3xl border p-4 text-left backdrop-blur-xl transition',
                  SEGMENT_RENGI[seg],
                  segmentSuzgeci === seg && 'ring-2 ring-white/20',
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">{SEGMENT_ADI[seg]}</p>
                <p className="mt-2 text-xl font-bold tracking-[-0.03em]">{sonuc.dagilim[seg] ?? 0}</p>
                <p className="mt-0.5 text-[10px] opacity-60">
                  {segmentSuzgeci === seg ? 'süzgeç açık' : 'süzmek için tıkla'}
                </p>
              </button>
            ))}
          </section>

          <section className="overflow-hidden rounded-3xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {suzulmus.length} oyuncu · {sonuc.taranan} tarandı · öncelik sırasıyla
              </p>
              <div className="flex items-center gap-2">
                {segmentSuzgeci !== 'hepsi' && (
                  <button
                    onClick={() => setSegmentSuzgeci('hepsi')}
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold text-slate-400 transition hover:text-white"
                  >
                    süzgeci temizle
                  </button>
                )}
                <button
                  onClick={csvIndir}
                  className="inline-flex h-8 items-center gap-2 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-3 text-[10px] font-bold text-slate-300 transition hover:text-white"
                >
                  <Download size={13} /> CSV indir
                </button>
              </div>
            </div>

            {suzulmus.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs font-semibold text-slate-500">
                Bu süzgeçte oyuncu yok.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {suzulmus.map((s) => (
                  <SatirKarti
                    key={s.login}
                    satir={s}
                    acik={acikSatir === s.login}
                    onAc={() => setAcikSatir((m) => (m === s.login ? null : s.login))}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SatirKarti({ satir, acik, onAc }: { satir: Satir; acik: boolean; onAc: () => void }) {
  const oneri = ONERI_BILGI[satir.oneri] ?? { ad: satir.oneri, ikon: RefreshCw };
  const OneriIkon = oneri.ikon;
  const o = satir.olculer;

  return (
    <li className="transition hover:bg-white/[0.02]">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        {/* Risk sayisi: listeyi tararken goz once buraya gidiyor. */}
        <div className="flex w-12 shrink-0 flex-col items-center">
          <span className={cn('text-lg font-bold tabular-nums',
            satir.risk >= 70 ? 'text-rose-300' : satir.risk >= 45 ? 'text-orange-300' : 'text-slate-400')}>
            {satir.risk}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-slate-600">risk</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onAc} className="text-sm font-bold text-slate-100 transition hover:text-white">
              {satir.login}
            </button>
            <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]', SEGMENT_RENGI[satir.segment])}>
              {SEGMENT_ADI[satir.segment]}
            </span>
            {satir.degerKatmani === 'yuksek' && (
              <span className="rounded bg-amber-300/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                {DEGER_ADI.yuksek}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[11px] font-medium text-slate-400" title={satir.ozet}>
            {satir.ozet}
          </p>
        </div>

        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-xs font-bold tabular-nums text-slate-200">{para(o.sonDonemYatirim)} ₺</p>
          <p className="text-[10px] text-slate-600">son 30 gün</p>
        </div>

        {/* Oneri: ne yapilacagi listede gorunuyor, tiklayinca ilgili sayfa. */}
        {oneri.yol ? (
          <Link
            to={oneri.yol}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-3xl border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/[0.09]"
            title={satir.oneriMetni}
          >
            <OneriIkon size={12} /> {oneri.ad} <ArrowRight size={11} className="opacity-50" />
          </Link>
        ) : (
          <span className="shrink-0 rounded-3xl border border-white/[0.05] px-3 py-1.5 text-[10px] font-bold text-slate-500" title={satir.oneriMetni}>
            {oneri.ad}
          </span>
        )}
      </div>

      {acik && (
        <div className="border-t border-white/[0.04] bg-black/20 px-5 py-4">
          <p className="mb-3 text-[11px] font-semibold leading-relaxed text-slate-300">{satir.oneriMetni}</p>

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Olcu ad="Son yatırım" deger={o.sonYatirimGun != null ? `${o.sonYatirimGun} gün önce` : '—'} />
            <Olcu ad="Kendi ritmi" deger={o.ortalamaAralikGun != null ? `${o.ortalamaAralikGun.toFixed(1)} günde bir` : '—'} />
            <Olcu ad="Gecikme" deger={o.gecikmeOrani != null ? `${o.gecikmeOrani.toFixed(1)}×` : '—'} />
            <Olcu ad="Yatırım sayısı" deger={String(o.yatirimSayisi)} />
            <Olcu ad="Son 30 gün" deger={`${para(o.sonDonemYatirim)} ₺`} />
            <Olcu ad="Önceki 30 gün" deger={`${para(o.oncekiDonemYatirim)} ₺`} />
            <Olcu ad="Ömür boyu" deger={`${para(o.omurBoyuYatirim)} ₺`} />
            <Olcu ad="Net kayıp" deger={`${para(o.netKayip)} ₺`} />
          </div>

          {/*
            Bilesenler: puanin NEREDEN geldigi. Operatorun katilmadigi bir
            skoru tartisabilmesi icin gerekce sart -- kapali bir sayi
            guvenilmez, guvenilmeyen liste de islenmez.
          */}
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Risk sinyalleri</p>
          <div className="space-y-1.5">
            {satir.bilesenler.filter((b) => b.puan > 0).map((b) => (
              <div key={b.anahtar} className="flex items-start gap-3">
                <div className="mt-1 h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-rose-400/70" style={{ width: `${b.puan}%` }} />
                </div>
                <span className="w-28 shrink-0 text-[10px] font-bold text-slate-300">{b.ad}</span>
                <span className="min-w-0 flex-1 text-[10px] leading-relaxed text-slate-500">
                  {b.gerekce || `${Math.round(b.puan)} puan`}
                </span>
              </div>
            ))}
            {satir.bilesenler.every((b) => b.puan === 0) && (
              <p className="text-[10px] text-slate-600">Tetiklenen sinyal yok.</p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Olcu({ ad, deger }: { ad: string; deger: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">{ad}</p>
      <p className="mt-0.5 text-xs font-bold tabular-nums text-slate-200">{deger}</p>
    </div>
  );
}

function OzetKarti({ etiket, deger, ton, ikon: Ikon, alt }: {
  etiket: string; deger: string; ton: 'rose'; ikon: any; alt: string;
}) {
  return (
    <div className={cn('rounded-3xl border p-4 backdrop-blur-xl',
      ton === 'rose' && 'border-rose-400/25 bg-rose-400/[0.07]')}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{etiket}</p>
        <Ikon size={14} className="text-rose-300" />
      </div>
      <p className="mt-2 text-xl font-bold tracking-[-0.03em] text-white tabular-nums">{deger}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{alt}</p>
    </div>
  );
}

function SayiAlani({ etiket, birim, deger, onChange, ipucu }: {
  etiket: string; birim: string; deger: number; onChange: (n: number) => void; ipucu: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {etiket} <span className="text-slate-600">({birim})</span>
      </label>
      <input
        type="number"
        value={deger}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-9 w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] px-3 text-xs font-semibold text-white outline-none backdrop-blur-xl transition focus:border-rose-300/40 [color-scheme:dark]"
      />
      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{ipucu}</p>
    </div>
  );
}

/** Uyarı ikonu kullanılmadığında bile import edilmesin diye burada. */
export const CHURN_UYARI_IKONU = AlertTriangle;
