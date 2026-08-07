import type { ReactNode } from 'react';

/**
 * Affiliate suit ekranlarının ortak yüzeyleri.
 *
 * Renkler doğrudan yazılmıyor, `--panel-*` token'larından okunuyor:
 * panel açık/koyu tema arasında çevrilebiliyor ve gömülü bir `#fff`
 * açık temada görünmez kalırdı.
 */

export const KART =
  'rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]';

export const GIRDI =
  'h-10 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-sm text-white outline-none transition focus:border-cyan-400/40';

export const ETIKET =
  'text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]';

export const BUTON_ANA =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-500/15 px-4 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/25 disabled:cursor-wait disabled:opacity-60';

export const BUTON_SESSIZ =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-4 text-xs font-bold text-[color:var(--panel-muted,#8a919c)] transition hover:text-white disabled:cursor-wait disabled:opacity-60';

/**
 * Yönlendirme metni `--panel-muted` ile yazılıyor, `--panel-faint` ile
 * değil.
 *
 * `faint` panelin mikro etiket seviyesi: tarih, ölçü, "3 gün" gibi
 * göz ucuyla bakılan bilgiler. Ölçümde koyu temada 3.4:1 veriyor ve o
 * kullanım için kabul edilmiş. Ama alan altındaki açıklama ve boş durum
 * metni OKUNMASI gereken cümleler; kullanıcı bir alanı nasıl
 * dolduracağını oradan öğreniyor. Onları da aynı soluklukta yazmak,
 * yardımı fiilen görünmez yapardı.
 */
export function Alan({ etiket, children, ipucu }: { etiket: string; children: ReactNode; ipucu?: string }) {
  return (
    <label className="block">
      <span className={ETIKET}>{etiket}</span>
      <div className="mt-1.5">{children}</div>
      {ipucu && <p className="mt-1 text-[11px] text-[color:var(--panel-muted,#8a919c)]">{ipucu}</p>}
    </label>
  );
}

export function BosDurum({ baslik, aciklama, ikon }: { baslik: string; aciklama: string; ikon?: ReactNode }) {
  return (
    <div className={`${KART} flex flex-col items-center gap-2 py-12 text-center`}>
      {ikon && <div className="text-[color:var(--panel-faint,#5c6470)]">{ikon}</div>}
      <p className="text-sm font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">{baslik}</p>
      <p className="max-w-md text-xs text-[color:var(--panel-muted,#8a919c)]">{aciklama}</p>
    </div>
  );
}

export function HataSatiri({ mesaj }: { mesaj: string }) {
  if (!mesaj) return null;
  return (
    <p className="rounded-lg border border-rose-300/25 bg-rose-300/[0.08] px-3 py-2 text-xs font-semibold text-rose-300">
      {mesaj}
    </p>
  );
}

export function Rozet({ ton, children }: { ton: 'basarili' | 'bekliyor' | 'hata' | 'notr'; children: ReactNode }) {
  const sinif = {
    basarili: 'bg-emerald-500/10 text-emerald-300',
    bekliyor: 'bg-amber-500/10 text-amber-300',
    hata: 'bg-rose-500/10 text-rose-300',
    notr: 'bg-white/5 text-[color:var(--panel-muted,#8a919c)]',
  }[ton];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sinif}`}>
      {children}
    </span>
  );
}

/**
 * Küçük eğilim çizgisi (sparkline).
 *
 * Recharts yerine düz SVG: bu grafik satır içinde, 40px yüksekliğinde ve
 * eksensiz. Recharts'ın `ResponsiveContainer`'ı her satır için bir
 * ölçüm gözlemcisi kurar; yüzlerce satırlık bir tabloda bu ölçülebilir
 * bir yavaşlama demek.
 */
export function EgilimCizgisi({ degerler, genislik = 120, yukseklik = 32 }: { degerler: number[]; genislik?: number; yukseklik?: number }) {
  if (degerler.length < 2) {
    return <span className="text-[11px] text-[color:var(--panel-muted,#8a919c)]">Eğilim için yeterli gün yok</span>;
  }

  const enAz = Math.min(...degerler);
  const enCok = Math.max(...degerler);
  const aralik = enCok - enAz || 1;
  const adim = genislik / (degerler.length - 1);
  const noktalar = degerler
    .map((d, i) => `${(i * adim).toFixed(1)},${(yukseklik - ((d - enAz) / aralik) * yukseklik).toFixed(1)}`)
    .join(' ');

  // Son gun onceki gunden dusukse kirmizi: renk veriyi tekrar etmiyor,
  // yonu soyluyor.
  const dusus = degerler[degerler.length - 1] < degerler[degerler.length - 2];
  const renk = dusus ? 'var(--panel-danger, #ff453a)' : 'var(--panel-success, #30d158)';

  return (
    <svg width={genislik} height={yukseklik} viewBox={`0 0 ${genislik} ${yukseklik}`} className="overflow-visible">
      <polyline points={noktalar} fill="none" stroke={renk} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
