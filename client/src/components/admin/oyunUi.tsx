import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Oyun yonetimi arayuz kiti — "oran tahtasi".
 *
 * Bes oyun modulu de ayni seyi yapiyor: OLASILIK x ODEME. Onceki ekranlar
 * bunu form gibi gosteriyordu; operator "bu odulun etiketi ne" diye degil
 * "bunu yayina alirsam 100 oyunda ne oderim" diye bakiyor. Kit bu soruyu
 * ekranin merkezine aliyor.
 *
 * Iki karar bilincli:
 *
 *   1. Sayilar her yerde TABULAR. Oran tahtasinda gozun sutunu takip
 *      edebilmesi icin rakamlar ayni genislikte olmali.
 *   2. Agirlik grafigi yerine PAY seridi. Recharts cubugu ham agirligi
 *      gosteriyordu; "agirlik 10" tek basina hicbir sey ifade etmiyor,
 *      anlamli olan toplamdaki payi. Serit hem bunu gosteriyor hem de
 *      render yolundan agir bir bagimliligi kaldiriyor.
 */

// ─── Modul kimlikleri ────────────────────────────────────────────────────────

export type ModulAnahtari = 'cark' | 'kazi' | 'tahmin' | 'vitrin' | 'gorev';

/** Vurgu rengi YALNIZCA kimlik cipinde ve odak halkasinda kullanilir. */
export const MODUL_VURGU: Record<ModulAnahtari, string> = {
  cark: '#ff9f0a',
  kazi: '#ffd60a',
  tahmin: '#64d2ff',
  vitrin: '#bf5af2',
  gorev: '#30d158',
};

const YUZEY = 'border border-white/5 bg-white/[0.02]';

// ─── Sayi bicimleme ──────────────────────────────────────────────────────────

const TR = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

export function sayi(value: number): string {
  return Number.isFinite(value) ? TR.format(value) : '0';
}

export function lira(value: number): string {
  return `${sayi(Math.round(value))} ₺`;
}

/** Tabular rakam sinifi — her sayisal hucrede kullanilir. */
export const RAKAM = 'tabular-nums';

// ─── Modul kabugu ────────────────────────────────────────────────────────────

export function ModulBasligi({
  modul,
  baslik,
  aciklama,
  ikon,
  saginda,
}: {
  modul: ModulAnahtari;
  baslik: string;
  aciklama: string;
  ikon: ReactNode;
  saginda?: ReactNode;
}) {
  const vurgu = MODUL_VURGU[modul];
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${vurgu}1a`, color: vurgu }}
        >
          {ikon}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">{baslik}</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">{aciklama}</p>
        </div>
      </div>
      {saginda}
    </header>
  );
}

// ─── Bölüm ───────────────────────────────────────────────────────────────────

export function Bolum({
  baslik,
  aciklama,
  eylem,
  children,
  className,
}: {
  baslik: string;
  aciklama?: string;
  eylem?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl', YUZEY, className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-white">{baslik}</h3>
          {aciklama && (
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">{aciklama}</p>
          )}
        </div>
        {eylem}
      </div>
      {children}
    </section>
  );
}

// ─── Form ilkelleri ──────────────────────────────────────────────────────────

export const ETIKET = 'block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400';

export function Alan({
  etiket,
  ipucu,
  children,
  className,
}: {
  etiket: string;
  ipucu?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className={ETIKET}>{etiket}</span>
      {children}
      {ipucu && <span className="block text-[10px] font-medium text-slate-500">{ipucu}</span>}
    </label>
  );
}

function odakStili(modul: ModulAnahtari): CSSProperties {
  return { ['--oyun-vurgu' as string]: MODUL_VURGU[modul] };
}

const GIRDI_TEMEL =
  'h-10 w-full rounded-2xl border border-white/5 bg-black/30 px-3 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-[color:var(--oyun-vurgu)]';

export function Girdi({
  modul,
  sayisal,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { modul: ModulAnahtari; sayisal?: boolean }) {
  return (
    <input
      {...props}
      style={{ ...odakStili(modul), ...props.style }}
      className={cn(GIRDI_TEMEL, sayisal && `${RAKAM} font-semibold`, className)}
    />
  );
}

export function Secim({
  modul,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { modul: ModulAnahtari }) {
  return (
    <select {...props} style={{ ...odakStili(modul), ...props.style }} className={cn(GIRDI_TEMEL, className)}>
      {children}
    </select>
  );
}

export function AlanIcinde({ children, ek }: { children: ReactNode; ek: string }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
        {ek}
      </span>
    </div>
  );
}

export function Anahtar({
  modul,
  acik,
  onDegis,
  etiket,
  aciklama,
}: {
  modul: ModulAnahtari;
  acik: boolean;
  onDegis: (deger: boolean) => void;
  etiket: string;
  aciklama?: string;
}) {
  const vurgu = MODUL_VURGU[modul];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      onClick={() => onDegis(!acik)}
      className={cn(
        'flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors',
        acik
          ? 'border-transparent'
          : 'border-white/5 bg-black/20',
      )}
      style={acik ? { background: `${vurgu}14`, borderColor: `${vurgu}59` } : undefined}
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-white">{etiket}</span>
        {aciklama && (
          <span className="mt-0.5 block text-[11px] font-medium text-slate-400">{aciklama}</span>
        )}
      </span>
      <span
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', !acik && 'bg-white/10')}
        style={acik ? { background: vurgu } : undefined}
      >
        <span
          className={cn(
            'absolute top-1 h-4 w-4 rounded-full bg-white transition-all',
            acik ? 'left-6' : 'left-1',
          )}
        />
      </span>
    </button>
  );
}

// ─── Ekonomi göstergeleri ────────────────────────────────────────────────────

/**
 * Imza ogesi: agirlik PAY seridi.
 *
 * Her dilim toplam agirliktaki payi kadar genis. Ham agirlik ("10") tek
 * basina anlamsizdir; operatorun gormesi gereken bu odulun ne siklikta
 * cikacagi. Renk bilerek notr — dikkat sayilarda kalsin.
 */
export function PaySeridi({
  parcalar,
  modul,
}: {
  parcalar: Array<{ id: string | number; etiket: string; agirlik: number }>;
  modul: ModulAnahtari;
}) {
  const gecerli = parcalar.filter((p) => p.agirlik > 0);
  const toplam = gecerli.reduce((t, p) => t + p.agirlik, 0);
  const vurgu = MODUL_VURGU[modul];

  if (toplam <= 0) {
    return (
      <p className="px-5 py-4 text-[11px] font-medium text-slate-500">
        Ağırlık girildiğinde pay dağılımı burada görünür.
      </p>
    );
  }

  return (
    <div className="space-y-2.5 px-5 py-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-black/40">
        {gecerli.map((parca, i) => (
          <span
            key={parca.id}
            title={`${parca.etiket} — %${sayi((parca.agirlik / toplam) * 100)}`}
            style={{
              width: `${(parca.agirlik / toplam) * 100}%`,
              background: vurgu,
              // Ayni renkte kademeli opaklik: dilimler ayirt edilebilsin
              // ama palet tek vurguda kalsin.
              opacity: 1 - (i % 4) * 0.18,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {gecerli.map((parca, i) => (
          <li key={parca.id} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: vurgu, opacity: 1 - (i % 4) * 0.18 }}
            />
            <span className="font-medium text-slate-400">{parca.etiket}</span>
            <span className={cn(RAKAM, 'font-bold text-slate-200')}>
              %{sayi((parca.agirlik / toplam) * 100)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 100 oyun basina beklenen odeme.
 *
 * Operatorun asil sordugu soru bu. Dilim/odul basina (pay x tutar)
 * toplaminin kazanma olasiligiyla carpimi.
 */
export function beklenenMaliyet(
  parcalar: Array<{ agirlik: number; tutar: number }>,
  kazanmaOlasiligi = 100,
): number {
  const toplamAgirlik = parcalar.reduce((t, p) => t + (p.agirlik > 0 ? p.agirlik : 0), 0);
  if (toplamAgirlik <= 0) return 0;
  const oyunBasi = parcalar.reduce(
    (t, p) => t + (p.agirlik > 0 ? (p.agirlik / toplamAgirlik) * p.tutar : 0),
    0,
  );
  return oyunBasi * 100 * (Math.min(100, Math.max(0, kazanmaOlasiligi)) / 100);
}

export function MaliyetKarti({
  tutar,
  altBaslik,
  modul,
}: {
  tutar: number;
  altBaslik: string;
  modul: ModulAnahtari;
}) {
  const vurgu = MODUL_VURGU[modul];
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: `${vurgu}38`, background: `linear-gradient(160deg, ${vurgu}12, transparent 70%)` }}
    >
      <div className={ETIKET}>100 oyunda beklenen ödeme</div>
      <div className={cn(RAKAM, 'mt-2 text-[28px] font-semibold leading-none text-white')}>
        {lira(tutar)}
      </div>
      <p className="mt-2 text-[11px] font-medium text-slate-400">{altBaslik}</p>
    </div>
  );
}

export function Olcut({ etiket, deger, vurgulu }: { etiket: string; deger: ReactNode; vurgulu?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="text-[11px] font-medium text-slate-400">{etiket}</span>
      <span
        className={cn(
          RAKAM,
          'text-[13px] font-semibold',
          vurgulu ? 'text-white' : 'text-slate-200',
        )}
      >
        {deger}
      </span>
    </div>
  );
}

export function OlcutListesi({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-white/[0.06] px-5 py-1">{children}</div>;
}

// ─── Durum ───────────────────────────────────────────────────────────────────

export function BosDurum({ ikon, baslik, eylem }: { ikon: ReactNode; baslik: string; eylem?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
      <span className="text-slate-500">{ikon}</span>
      <p className="text-[13px] font-medium text-slate-400">{baslik}</p>
      {eylem}
    </div>
  );
}

export function Uyari({ tur = 'bilgi', children }: { tur?: 'bilgi' | 'dikkat' | 'hata'; children: ReactNode }) {
  const renk =
    tur === 'hata'
      ? 'border-[color:var(--panel-danger,#ff453a)]/30 bg-[color:var(--panel-danger,#ff453a)]/10 text-[color:var(--panel-danger,#ff453a)]'
      : tur === 'dikkat'
        ? 'border-[color:var(--panel-warning,#ff9f0a)]/30 bg-[color:var(--panel-warning,#ff9f0a)]/10 text-[color:var(--panel-warning,#ff9f0a)]'
        : 'border-white/5 bg-black/20 text-slate-400';
  return (
    <p className={cn('rounded-2xl border px-4 py-2.5 text-[11px] font-semibold', renk)} role={tur === 'hata' ? 'alert' : undefined}>
      {children}
    </p>
  );
}

export function Dugme({
  modul,
  tur = 'ikincil',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { modul: ModulAnahtari; tur?: 'birincil' | 'ikincil' | 'tehlike' }) {
  const vurgu = MODUL_VURGU[modul];
  return (
    <button
      type="button"
      {...props}
      style={tur === 'birincil' ? { background: vurgu, color: '#050609', ...props.style } : props.style}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-xl px-4 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        tur === 'ikincil' &&
          'border border-white/5 text-slate-200 hover:bg-white/[0.04]',
        tur === 'tehlike' && 'text-[color:var(--panel-danger,#ff453a)] hover:bg-[color:var(--panel-danger,#ff453a)]/10',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Satir silme dugmesi — izgara hucrelerinde tek tip. */
export function SilDugmesi({ onClick, etiket }: { onClick: () => void; etiket: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiket}
      title={etiket}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-[color:var(--panel-danger,#ff453a)]/10 hover:text-[color:var(--panel-danger,#ff453a)]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      </svg>
    </button>
  );
}

/** Yatay kaydirilabilir izgara sarmalayici — dar ekranda tablo bozulmasin. */
export function Izgara({ sutunlar, children }: { sutunlar: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <div style={{ ['--oyun-sutunlar' as string]: sutunlar }} className="min-w-[680px]">
        {children}
      </div>
    </div>
  );
}

export function IzgaraBaslik({ children }: { children: ReactNode }) {
  return (
    <div className="grid items-center gap-3 border-b border-white/5 bg-black/20 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
      style={{ gridTemplateColumns: 'var(--oyun-sutunlar)' }}>
      {children}
    </div>
  );
}

export function IzgaraSatir({ children }: { children: ReactNode }) {
  return (
    <div className="grid items-center gap-3 border-b border-white/5 px-5 py-2.5 last:border-b-0 hover:bg-white/[0.02]"
      style={{ gridTemplateColumns: 'var(--oyun-sutunlar)' }}>
      {children}
    </div>
  );
}
