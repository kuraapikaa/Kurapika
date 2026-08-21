import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Download, Loader2, Search, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/client';
import { cn } from '@/lib/utils';

/**
 * TOPLU YATIRIM / ÇEKİM SORGUSU.
 *
 * Operatör bir kullanıcı adı listesi yapıştırıyor; her biri için toplam
 * yatırım ve toplam çekim dönüyor.
 *
 * ── Neden iki ayrı tarih aralığı ──────────────────────────────────────
 * "Şu tarihten sonra yatıranların şu hafta içindeki çekimleri" tek bir
 * aralıkla sorulamıyor. Yatırım ve çekim bağımsız aralık kullanabiliyor;
 * ikisi de boş bırakılabilir, o zaman tüm geçmiş sayılır.
 */

type Satir = {
  login: string;
  bulundu: boolean;
  playerId?: number;
  lynonLogin?: string;
  hata?: string | null;
  ozet?: {
    yatirim: { toplam: number; adet: number; ilk: string | null; son: string | null };
    cekim: { toplam: number; adet: number; ilk: string | null; son: string | null };
    net: number;
  } | null;
};

type Sonuc = {
  ok: boolean;
  satirlar: Satir[];
  toplam: { yatirimToplam: number; cekimToplam: number; net: number; bulunan: number; bulunamayan: number };
  istenen: number;
  message?: string;
};

const para = (deger: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(deger || 0);

const kisaTarih = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

export function TopluIslemOzeti() {
  const [kullanicilar, setKullanicilar] = useState('');
  const [yatirimBaslangic, setYatirimBaslangic] = useState('');
  const [yatirimBitis, setYatirimBitis] = useState('');
  const [cekimBaslangic, setCekimBaslangic] = useState('');
  const [cekimBitis, setCekimBitis] = useState('');
  const [siralama, setSiralama] = useState<'giris' | 'yatirim' | 'cekim' | 'net'>('giris');

  /** Kaç isim yazıldığını sorgudan ÖNCE göstermek, yanlış yapıştırmayı erken yakalatıyor. */
  const adSayisi = useMemo(() => {
    const gorulen = new Set<string>();
    for (const parca of kullanicilar.split(/[\s,;]+/)) {
      const kirpik = parca.trim();
      if (kirpik) gorulen.add(kirpik.toLocaleLowerCase('tr-TR'));
    }
    return gorulen.size;
  }, [kullanicilar]);

  const sorgu = useMutation<Sonuc>({
    mutationFn: () =>
      adminApi.topluIslemOzeti({
        kullanicilar,
        yatirimBaslangic,
        yatirimBitis,
        cekimBaslangic,
        cekimBitis,
      }),
    onSuccess: (cevap) => {
      if (!cevap?.ok) toast.error(cevap?.message || 'Sorgulanamadı');
      else if (cevap.toplam.bulunamayan > 0) {
        toast.warning(`${cevap.toplam.bulunan} kullanıcı bulundu, ${cevap.toplam.bulunamayan} tanesi bulunamadı.`);
      }
    },
    onError: () => toast.error('Sorgulanamadı'),
  });

  const sonuc = sorgu.data;

  const siraliSatirlar = useMemo(() => {
    if (!sonuc?.satirlar) return [];
    const liste = [...sonuc.satirlar];
    if (siralama === 'giris') return liste;
    // Bulunamayanlar her zaman SONDA: sıralama onları listenin ortasına
    // dağıtırsa eksik veri gözden kaçar.
    return liste.sort((a, b) => {
      if (a.bulundu !== b.bulundu) return a.bulundu ? -1 : 1;
      const deger = (s: Satir) =>
        siralama === 'yatirim' ? s.ozet?.yatirim.toplam ?? 0
          : siralama === 'cekim' ? s.ozet?.cekim.toplam ?? 0
            : s.ozet?.net ?? 0;
      return deger(b) - deger(a);
    });
  }, [sonuc, siralama]);

  /** Sonucu CSV olarak indir — operatör raporu Excel'e taşıyor. */
  const csvIndir = () => {
    if (!sonuc?.satirlar?.length) return;
    const basliklar = ['Kullanıcı', 'Durum', 'Oyuncu ID', 'Yatırım', 'Yatırım adet', 'Çekim', 'Çekim adet', 'Net'];
    const satirlar = siraliSatirlar.map((s) => [
      s.login,
      s.bulundu ? 'Bulundu' : (s.hata || 'Bulunamadı'),
      s.playerId ?? '',
      s.ozet?.yatirim.toplam ?? '',
      s.ozet?.yatirim.adet ?? '',
      s.ozet?.cekim.toplam ?? '',
      s.ozet?.cekim.adet ?? '',
      s.ozet?.net ?? '',
    ]);
    // Ayırıcı NOKTALI VİRGÜL: Türkçe Excel ondalık ayırıcı olarak virgül
    // kullanıyor, virgüllü CSV sütunları kaydırırdı. BOM olmadan Excel
    // Türkçe karakterleri bozuyor.
    const csv = [basliklar, ...satirlar].map((r) => r.join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `toplu-islem-ozeti-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-5 backdrop-blur-xl">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <label className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Kullanıcı adları</span>
              <span className={cn('text-[10px] font-bold', adSayisi > 0 ? 'text-cyan-300' : 'text-slate-600')}>
                {adSayisi} kişi
              </span>
            </label>
            <textarea
              value={kullanicilar}
              onChange={(e) => setKullanicilar(e.target.value)}
              rows={8}
              spellCheck={false}
              className="w-full resize-y rounded-3xl border border-white/[0.05] bg-white/[0.02] p-4 font-mono text-xs font-semibold text-white outline-none backdrop-blur-xl transition placeholder:text-slate-600 focus:border-cyan-300/40"
              placeholder={'test777\nbosdag\nkullanici3'}
            />
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Her satıra bir ad; virgül, noktalı virgül ve sekme de ayırıcı sayılır. Tekrarlar elenir.
            </p>
          </div>

          <div className="space-y-4">
            <TarihKutusu
              baslik="Yatırım aralığı"
              ikon={ArrowDownToLine}
              ton="emerald"
              baslangic={yatirimBaslangic}
              bitis={yatirimBitis}
              onBaslangic={setYatirimBaslangic}
              onBitis={setYatirimBitis}
            />
            <TarihKutusu
              baslik="Çekim aralığı"
              ikon={ArrowUpFromLine}
              ton="rose"
              baslangic={cekimBaslangic}
              bitis={cekimBitis}
              onBaslangic={setCekimBaslangic}
              onBitis={setCekimBitis}
            />
            <p className="text-[10px] leading-relaxed text-slate-500">
              İki aralık bağımsızdır; boş bırakılan sınır uygulanmaz. Seçilen bitiş günü sonuca DAHİLDİR.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {kullanicilar && (
            <button
              onClick={() => setKullanicilar('')}
              className="inline-flex h-9 items-center gap-2 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-4 text-xs font-bold text-slate-400 transition hover:text-white"
            >
              <X size={15} /> Listeyi temizle
            </button>
          )}
          <button
            onClick={() => sorgu.mutate()}
            disabled={sorgu.isPending || adSayisi === 0}
            title={adSayisi === 0 ? 'En az bir kullanıcı adı girin' : undefined}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-400 px-5 text-xs font-bold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sorgu.isPending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {sorgu.isPending ? `${adSayisi} kişi sorgulanıyor...` : 'Sorgula'}
          </button>
        </div>
      </section>

      {sorgu.isPending && (
        <p className="text-center text-xs font-semibold text-slate-500">
          Her kullanıcı Lynon'da tek tek aranıyor; uzun listelerde bu bir dakikayı bulabilir.
        </p>
      )}

      {sonuc?.ok && (
        <>
          <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <ToplamKarti etiket="Toplam yatırım" deger={sonuc.toplam.yatirimToplam} ton="emerald" ikon={ArrowDownToLine} />
            <ToplamKarti etiket="Toplam çekim" deger={sonuc.toplam.cekimToplam} ton="rose" ikon={ArrowUpFromLine} />
            <ToplamKarti etiket="Net" deger={sonuc.toplam.net} ton={sonuc.toplam.net >= 0 ? 'emerald' : 'rose'} ikon={Users} />
            <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-4 backdrop-blur-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Kapsam</p>
              <p className="mt-2 text-xl font-bold tracking-[-0.03em] text-white">
                {sonuc.toplam.bulunan}<span className="text-slate-600"> / {sonuc.istenen}</span>
              </p>
              {sonuc.toplam.bulunamayan > 0 && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
                  <AlertTriangle size={11} /> {sonuc.toplam.bulunamayan} bulunamadı
                </p>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-5 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Sırala</span>
                {([['giris', 'Giriş sırası'], ['yatirim', 'Yatırım'], ['cekim', 'Çekim'], ['net', 'Net']] as const).map(([deger, etiket]) => (
                  <button
                    key={deger}
                    onClick={() => setSiralama(deger)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-bold transition',
                      siralama === deger ? 'bg-cyan-300/15 text-cyan-200' : 'text-slate-500 hover:text-slate-300'
                    )}
                  >
                    {etiket}
                  </button>
                ))}
              </div>
              <button
                onClick={csvIndir}
                className="inline-flex h-8 items-center gap-2 rounded-3xl border border-white/[0.05] bg-white/[0.03] px-3 text-[10px] font-bold text-slate-300 transition hover:text-white"
              >
                <Download size={13} /> CSV indir
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-[0.15em] text-slate-500">
                    <th className="px-5 py-2.5 text-left font-semibold">Kullanıcı</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Yatırım</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Adet</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Çekim</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Adet</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {siraliSatirlar.map((satir, i) => (
                    <tr key={`${satir.login}-${i}`} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-2.5">
                        <span className="font-bold text-slate-200">{satir.lynonLogin || satir.login}</span>
                        {!satir.bulundu && (
                          <span className="ml-2 rounded bg-amber-300/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                            {satir.hata || 'bulunamadı'}
                          </span>
                        )}
                      </td>
                      {satir.bulundu && satir.ozet ? (
                        <>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-300">{para(satir.ozet.yatirim.toplam)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-500" title={`${kisaTarih(satir.ozet.yatirim.ilk)} – ${kisaTarih(satir.ozet.yatirim.son)}`}>
                            {satir.ozet.yatirim.adet}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums text-rose-300">{para(satir.ozet.cekim.toplam)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-500" title={`${kisaTarih(satir.ozet.cekim.ilk)} – ${kisaTarih(satir.ozet.cekim.son)}`}>
                            {satir.ozet.cekim.adet}
                          </td>
                          <td className={cn('px-5 py-2.5 text-right font-bold tabular-nums', satir.ozet.net >= 0 ? 'text-emerald-200' : 'text-rose-200')}>
                            {para(satir.ozet.net)}
                          </td>
                        </>
                      ) : (
                        <td colSpan={5} className="px-5 py-2.5 text-right text-slate-600">—</td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/[0.08] bg-white/[0.02] text-[11px]">
                    <td className="px-5 py-3 font-bold uppercase tracking-[0.15em] text-slate-400">Toplam</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-300">{para(sonuc.toplam.yatirimToplam)}</td>
                    <td />
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-rose-300">{para(sonuc.toplam.cekimToplam)}</td>
                    <td />
                    <td className={cn('px-5 py-3 text-right font-bold tabular-nums', sonuc.toplam.net >= 0 ? 'text-emerald-200' : 'text-rose-200')}>
                      {para(sonuc.toplam.net)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function TarihKutusu({ baslik, ikon: Ikon, ton, baslangic, bitis, onBaslangic, onBitis }: {
  baslik: string;
  ikon: any;
  ton: 'emerald' | 'rose';
  baslangic: string;
  bitis: string;
  onBaslangic: (v: string) => void;
  onBitis: (v: string) => void;
}) {
  const renk = ton === 'emerald' ? 'text-emerald-300 border-emerald-300/20' : 'text-rose-300 border-rose-300/20';
  return (
    <div className="rounded-3xl border border-white/[0.05] bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className={cn('inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]', renk.split(' ')[0])}>
          <Ikon size={13} /> {baslik}
        </p>
        {(baslangic || bitis) && (
          <button
            onClick={() => { onBaslangic(''); onBitis(''); }}
            className="text-[10px] font-bold text-slate-500 transition hover:text-slate-300"
          >
            temizle
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">Başlangıç</label>
          <input
            type="date"
            value={baslangic}
            onChange={(e) => onBaslangic(e.target.value)}
            className="h-8 w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] px-2.5 text-[11px] font-semibold text-white outline-none transition focus:border-cyan-300/40 [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">Bitiş</label>
          <input
            type="date"
            value={bitis}
            onChange={(e) => onBitis(e.target.value)}
            className="h-8 w-full rounded-3xl border border-white/[0.05] bg-white/[0.02] px-2.5 text-[11px] font-semibold text-white outline-none transition focus:border-cyan-300/40 [color-scheme:dark]"
          />
        </div>
      </div>
    </div>
  );
}

function ToplamKarti({ etiket, deger, ton, ikon: Ikon }: { etiket: string; deger: number; ton: 'emerald' | 'rose'; ikon: any }) {
  const renk = ton === 'emerald'
    ? 'bg-emerald-300/10 text-emerald-300 border-emerald-300/20'
    : 'bg-rose-300/10 text-rose-300 border-rose-300/20';
  return (
    <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{etiket}</p>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-full border', renk)}>
          <Ikon size={14} />
        </div>
      </div>
      <p className="mt-2 text-xl font-bold tracking-[-0.03em] text-white tabular-nums">{para(deger)} ₺</p>
    </div>
  );
}
