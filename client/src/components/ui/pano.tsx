/**
 * Pano tasarım dili.
 *
 * ── Neden ─────────────────────────────────────────────────────────────
 *
 * Panonun parçaları farklı zamanlarda yazıldı ve her biri kendi
 * kurallarını getirdi: kart dolgusu `p-6` ile `p-4` arasında değişiyor,
 * başlık simgesi kimi yerde 20px `rounded-xl ring-1`, kimi yerde 16px
 * `rounded-lg border`; tablo başlıkları `tracking-[0.2em] font-extrabold`
 * ile `tracking-wider font-bold` arasında gidip geliyor; üç ayrı
 * "yükleniyor" göstergesi ve üç ayrı hata bloğu var. Aynı ekranda üç
 * farklı ürün gibi duruyordu.
 *
 * Bu dosya tek sözlük: kart, başlık, sayı, tablo, boş durum. Panodaki
 * her parça bunları kullanır.
 *
 * ── Renk anlamı taşır ─────────────────────────────────────────────────
 *
 * Vurgu rengi dekorasyon değil: para girişi yeşil, para çıkışı kırmızı,
 * maliyet/risk amber, hacim mavi, oyuncu mor. Bir sayının rengi kasanın
 * bakış açısından iyi mi kötü mü olduğunu söyler — aritmetik işaretini
 * değil. `PROFIT -50.318` ile `GGR +33.123` yan yana durduğunda bu
 * çelişki GÖRÜNÜR olmalı; operatörün kaçırmaması gereken şey tam olarak
 * bu.
 */
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { formatNumber } from '../../lib/format';

export type PanoVurgu = 'giris' | 'cikis' | 'maliyet' | 'hacim' | 'oyuncu' | 'notr';

const CIP: Record<PanoVurgu, string> = {
  giris: 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300',
  cikis: 'border-rose-400/20 bg-rose-400/[0.08] text-rose-300',
  maliyet: 'border-amber-400/20 bg-amber-400/[0.08] text-amber-300',
  hacim: 'border-sky-400/20 bg-sky-400/[0.08] text-sky-300',
  oyuncu: 'border-violet-400/20 bg-violet-400/[0.08] text-violet-300',
  notr: 'border-white/[0.08] bg-white/[0.04] text-[color:var(--panel-text-dim,#c8cdd5)]',
};

const SERIT: Record<PanoVurgu, string> = {
  giris: 'from-emerald-400/50',
  cikis: 'from-rose-400/50',
  maliyet: 'from-amber-400/50',
  hacim: 'from-sky-400/50',
  oyuncu: 'from-violet-400/50',
  notr: 'from-white/20',
};

const NOKTA: Record<PanoVurgu, string> = {
  giris: 'bg-emerald-400',
  cikis: 'bg-rose-400',
  maliyet: 'bg-amber-400',
  hacim: 'bg-sky-400',
  oyuncu: 'bg-violet-400',
  notr: 'bg-white/40',
};

const YAZI: Record<PanoVurgu, string> = {
  giris: 'text-emerald-300',
  cikis: 'text-rose-300',
  maliyet: 'text-amber-300',
  hacim: 'text-sky-300',
  oyuncu: 'text-violet-300',
  notr: 'text-white',
};

// ─── Kart ────────────────────────────────────────────────────────────────

/** Panodaki tek kart primitifi. Dolgu ve kenarlık her yerde aynı. */
export function PanoKart({
  children,
  className,
  vurgu,
}: {
  children: ReactNode;
  className?: string;
  /** Üst kenardaki ince şerit; kartı bakışla ayırır. */
  vurgu?: PanoVurgu;
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))]',
        'bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] backdrop-blur-xl',
        className,
      )}
    >
      {vurgu && <span className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent', SERIT[vurgu])} />}
      {children}
    </section>
  );
}

/** Kart başlığı: 8×8 simge kutusu + 11px başlık. Tek biçim. */
export function PanoBaslik({
  baslik,
  ipucu,
  simge,
  vurgu = 'notr',
  sag,
}: {
  baslik: string;
  ipucu?: string;
  simge?: ReactNode;
  vurgu?: PanoVurgu;
  sag?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[color:var(--panel-border,rgba(242,244,248,0.08))] px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {simge && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', CIP[vurgu])}>
            {simge}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-white">{baslik}</h3>
          {ipucu && <p className="mt-0.5 truncate text-[11px] text-[color:var(--panel-faint,#5c6470)]">{ipucu}</p>}
        </div>
      </div>
      {sag && <div className="shrink-0">{sag}</div>}
    </div>
  );
}

/** Kart içinde bölüm ayıracı — grup adı + renk noktası + çizgi. */
export function PanoBolum({ baslik, vurgu = 'notr' }: { baslik: string; vurgu?: PanoVurgu }) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', NOKTA[vurgu])} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">
        {baslik}
      </p>
      <span className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}

// ─── Sayı ────────────────────────────────────────────────────────────────

export type SayiBirimi = 'para' | 'adet' | 'oyuncu';

/**
 * "Veri yok" ile "değer sıfır" AYRI gösterilir.
 *
 * Panonun yanlış okunmasının sebeplerinden biri buydu: yanıtta hiç
 * olmayan alanlar 0 çiziliyor, operatör de o günün gerçekten sıfır
 * olduğunu sanıyordu.
 */
export function sayiYaz(deger: number | null | undefined, birim: SayiBirimi = 'adet'): string {
  if (deger == null) return '—';
  return birim === 'para' ? `${formatNumber(deger)} ₺` : formatNumber(deger);
}

/** İşareti açıkça yazar; yön okunabilir olsun. */
export function isaretliYaz(deger: number | null | undefined, birim: SayiBirimi = 'para'): string {
  if (deger == null) return '—';
  const govde = sayiYaz(Math.abs(deger), birim);
  return deger < 0 ? `−${govde}` : `+${govde}`;
}

// ─── Ölçü kutusu ─────────────────────────────────────────────────────────

/** Panonun üst sırasındaki büyük ölçü. */
export function PanoOlcu({
  etiket,
  deger,
  alt,
  simge,
  vurgu = 'notr',
  veriYok,
}: {
  etiket: string;
  deger: string;
  alt?: string;
  simge?: ReactNode;
  vurgu?: PanoVurgu;
  veriYok?: boolean;
}) {
  return (
    <PanoKart vurgu={vurgu} className="flex min-h-[116px] flex-col justify-between p-4 transition-colors hover:border-white/[0.16]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">
          {etiket}
        </p>
        {simge && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', CIP[vurgu])}>
            {simge}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p
          className={cn(
            'text-[26px] font-semibold leading-none tracking-[-0.035em] tabular-nums',
            veriYok ? 'text-[color:var(--panel-faint,#5c6470)]' : YAZI[vurgu],
          )}
        >
          {deger}
        </p>
        {alt && <p className="mt-2 text-[11px] font-medium text-[color:var(--panel-muted,#8a919c)]">{alt}</p>}
      </div>
    </PanoKart>
  );
}

/** Izgara içindeki küçük ölçü. */
export function PanoHucre({
  etiket,
  deger,
  aciklama,
  veriYok,
}: {
  etiket: string;
  deger: string;
  aciklama?: string;
  veriYok?: boolean;
}) {
  return (
    <div
      title={aciklama}
      className="rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-white/[0.07] hover:bg-white/[0.02]"
    >
      <p className="text-[10px] font-medium leading-tight text-[color:var(--panel-faint,#5c6470)]">
        {etiket}
        {aciklama && <span className="ml-1 text-[color:var(--panel-muted,#8a919c)]">ⓘ</span>}
      </p>
      <p
        className={cn(
          'mt-1 text-[15px] font-semibold leading-none tabular-nums tracking-[-0.02em]',
          veriYok ? 'text-[color:var(--panel-faint,#5c6470)]' : 'text-white',
        )}
      >
        {deger}
      </p>
    </div>
  );
}

// ─── Günün akışı ─────────────────────────────────────────────────────────

/**
 * Günün kasa sayımı: giren, çıkan, kalan.
 *
 * Panonun imza öğesi. Yatırım ve çekim yan yana rakam olarak durduğunda
 * aradaki oran okunmuyordu; tek çubukta oransal olarak görünce günün
 * yönü bir bakışta anlaşılıyor.
 */
export function AkisSeridi({
  yatirim,
  cekim,
}: {
  yatirim: number | null;
  cekim: number | null;
}) {
  if (yatirim == null && cekim == null) return null;

  const giren = yatirim ?? 0;
  const cikan = cekim ?? 0;
  const toplam = giren + cikan;
  const girenPay = toplam > 0 ? (giren / toplam) * 100 : 50;
  const net = giren - cikan;

  return (
    <PanoKart className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">
            Günün akışı
          </p>
          <p
            className={cn(
              'mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.035em] tabular-nums',
              net >= 0 ? 'text-emerald-300' : 'text-rose-300',
            )}
          >
            {isaretliYaz(net)}
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-[10px] font-medium text-[color:var(--panel-faint,#5c6470)]">Giren</p>
            <p className="mt-1 text-[15px] font-semibold tabular-nums text-emerald-300">{sayiYaz(yatirim, 'para')}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-[color:var(--panel-faint,#5c6470)]">Çıkan</p>
            <p className="mt-1 text-[15px] font-semibold tabular-nums text-rose-300">{sayiYaz(cekim, 'para')}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div className="bg-emerald-400/70 transition-all duration-500" style={{ width: `${girenPay}%` }} />
        <div className="bg-rose-400/70 transition-all duration-500" style={{ width: `${100 - girenPay}%` }} />
      </div>
    </PanoKart>
  );
}

// ─── Tablo ───────────────────────────────────────────────────────────────

/** Panodaki tek tablo biçimi. */
export function PanoTablo({ basliklar, children, minGenislik = 520 }: {
  basliklar: Array<{ ad: string; sag?: boolean }>;
  children: ReactNode;
  minGenislik?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left" style={{ minWidth: minGenislik }}>
        <thead>
          <tr className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.08))]">
            {basliklar.map(({ ad, sag }) => (
              <th
                key={ad}
                className={cn(
                  'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-muted,#8a919c)]',
                  sag && 'text-right',
                )}
              >
                {ad}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function PanoSatir({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-white/[0.04] text-sm text-[color:var(--panel-text-dim,#c8cdd5)] last:border-b-0 hover:bg-white/[0.02]">
      {children}
    </tr>
  );
}

export function PanoHucreYazi({ children, sag, guclu, renk }: {
  children: ReactNode;
  sag?: boolean;
  guclu?: boolean;
  renk?: string;
}) {
  return (
    <td className={cn('px-4 py-2.5', sag && 'text-right tabular-nums', guclu && 'font-semibold text-white', renk)}>
      {children}
    </td>
  );
}

// ─── Durumlar ────────────────────────────────────────────────────────────

/** Tek yükleniyor göstergesi. Önceden üç ayrı biçim vardı. */
export function PanoYukleniyor({ satir = 3 }: { satir?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: satir }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-white/[0.04]" />
      ))}
    </div>
  );
}

/** Tek hata bloğu. Ne olduğunu söyler, suçlamaz. */
export function PanoHata({ mesaj }: { mesaj: string }) {
  return (
    <div className="m-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-300">Veri alınamadı</p>
      <p className="mt-1 text-[12px] text-[color:var(--panel-text-dim,#c8cdd5)]">{mesaj}</p>
    </div>
  );
}

/** Tek boş durum. Ne olacağını söyler. */
export function PanoBos({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-xs text-[color:var(--panel-faint,#5c6470)]">{children}</p>;
}
