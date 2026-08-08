import { useId, useState, type ReactNode } from 'react';

/**
 * GRAFİKLER — düz SVG, kütüphane yok.
 *
 * Recharts ~100 kB getiriyor ve kendi tema sistemiyle uğraşmayı
 * gerektiriyor. Buradaki ihtiyaç iki şekil: zaman serisi ve karşılaştırma
 * çubuğu. İkisi de birkaç yüz satır; bağımlılığın bakım maliyeti bu
 * kazancın üstünde kalırdı.
 *
 * ── Ortak kural: BOŞ VERİ, SIFIR VERİ DEĞİLDİR ──
 *
 * Veri yokken sıfır çizgisi çizmek "hiç kazanç yok" der; oysa doğrusu
 * "henüz ölçüm yok". Grafikler bu durumda çizim yerine açıklama
 * gösteriyor.
 */

const bicim = (n: number): string =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n);

/** Eksende okunabilir bir üst sınır: 1/2/5 x 10^n kalıbına yuvarlar. */
function tavan(deger: number): number {
  if (deger <= 0) return 1;
  const buyukluk = 10 ** Math.floor(Math.log10(deger));
  const oran = deger / buyukluk;
  const carpan = oran <= 1 ? 1 : oran <= 2 ? 2 : oran <= 5 ? 5 : 10;
  return carpan * buyukluk;
}

export interface SeriNoktasi {
  etiket: string;
  deger: number;
}

/**
 * Zaman serisi — alan + çizgi.
 *
 * Negatif değerleri de çiziyor: GGR eksiye düşebiliyor ve o ayı
 * grafikten gizlemek, ortağın "neden ödeme almadım" sorusunu
 * cevapsız bırakırdı. Sıfır çizgisi negatif varsa görünür oluyor.
 */
export function ZamanSerisi({
  noktalar,
  yukseklik = 180,
  renk = 'var(--vurgu)',
  bosMesaj = 'Bu dönemde ölçüm yok.',
}: {
  noktalar: SeriNoktasi[];
  yukseklik?: number;
  renk?: string;
  bosMesaj?: string;
}) {
  const id = useId();
  const [secili, setSecili] = useState<number | null>(null);

  if (noktalar.length === 0) {
    return <BosGrafik mesaj={bosMesaj} yukseklik={yukseklik} />;
  }

  const G = 1000;
  const Y = 300;
  const enBuyuk = Math.max(0, ...noktalar.map((n) => n.deger));
  const enKucuk = Math.min(0, ...noktalar.map((n) => n.deger));
  const ust = tavan(enBuyuk || 1);
  const alt = enKucuk < 0 ? -tavan(Math.abs(enKucuk)) : 0;
  const aralik = ust - alt || 1;

  const x = (i: number) => (noktalar.length === 1 ? G / 2 : (i / (noktalar.length - 1)) * G);
  const y = (v: number) => Y - ((v - alt) / aralik) * Y;

  const cizgi = noktalar.map((n, i) => `${x(i)},${y(n.deger)}`).join(' ');
  const alan = `${x(0)},${y(alt)} ${cizgi} ${x(noktalar.length - 1)},${y(alt)}`;
  const sifirY = y(0);

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs" style={{ color: 'var(--metin-2)' }}>
        <span>{bicim(alt)}</span>
        <span>{bicim(ust)}</span>
      </div>
      <svg
        viewBox={`0 0 ${G} ${Y}`}
        preserveAspectRatio="none"
        style={{ height: yukseklik, width: '100%' }}
        role="img"
        aria-label={`${noktalar.length} noktalı zaman serisi`}
        onMouseLeave={() => setSecili(null)}
      >
        <defs>
          <linearGradient id={`dolgu-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={renk} stopOpacity="0.28" />
            <stop offset="100%" stopColor={renk} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Yatay kilavuzlar: goz, degeri cizgiye gore konumlandirabilsin. */}
        {[0.25, 0.5, 0.75].map((o) => (
          <line key={o} x1="0" x2={G} y1={Y * o} y2={Y * o} stroke="var(--kenar)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {alt < 0 && (
          <line x1="0" x2={G} y1={sifirY} y2={sifirY} stroke="var(--metin-2)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        )}

        <polygon points={alan} fill={`url(#dolgu-${id})`} />
        <polyline points={cizgi} fill="none" stroke={renk} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />

        {noktalar.map((n, i) => (
          <rect
            key={n.etiket}
            x={x(i) - G / noktalar.length / 2}
            y={0}
            width={G / noktalar.length}
            height={Y}
            fill="transparent"
            onMouseEnter={() => setSecili(i)}
          />
        ))}
        {secili !== null && (
          <circle cx={x(secili)} cy={y(noktalar[secili].deger)} r="4" fill={renk} vectorEffect="non-scaling-stroke" />
        )}
      </svg>

      <div className="mt-1 flex items-center justify-between text-xs" style={{ color: 'var(--metin-2)' }}>
        <span>{noktalar[0].etiket}</span>
        {/* Secili nokta ORTADA: kenarlarda gosterince uzun etiket tasiyor. */}
        <span style={{ color: secili !== null ? 'var(--metin)' : undefined }}>
          {secili !== null ? `${noktalar[secili].etiket} · ${bicim(noktalar[secili].deger)}` : ''}
        </span>
        <span>{noktalar[noktalar.length - 1].etiket}</span>
      </div>
    </div>
  );
}

/**
 * Karşılaştırma çubukları — yatay.
 *
 * Yatay, çünkü etiketler uzun (ortak anahtarı, kanal adı). Dikey
 * çubukta bu etiketler ya döner ya kısaltılır; ikisi de okumayı
 * zorlaştırır.
 */
export function CubukListesi({
  satirlar,
  bosMesaj = 'Kayıt yok.',
  birim,
}: {
  satirlar: Array<{ etiket: string; deger: number; alt?: string }>;
  bosMesaj?: string;
  birim?: string;
}) {
  if (satirlar.length === 0) {
    return <p className="py-6 text-center text-sm" style={{ color: 'var(--metin-2)' }}>{bosMesaj}</p>;
  }

  const enBuyuk = Math.max(...satirlar.map((s) => Math.abs(s.deger)), 1);

  return (
    <ul className="space-y-2">
      {satirlar.map((s) => (
        <li key={s.etiket}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate" title={s.etiket}>{s.etiket}</span>
            <span className="shrink-0 tabular-nums font-medium">
              {bicim(s.deger)}{birim ? ` ${birim}` : ''}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--yuzey-2)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (Math.abs(s.deger) / enBuyuk) * 100)}%`,
                background: s.deger < 0 ? 'var(--olumsuz)' : 'var(--vurgu)',
              }}
            />
          </div>
          {s.alt && <p className="mt-0.5 text-xs" style={{ color: 'var(--metin-2)' }}>{s.alt}</p>}
        </li>
      ))}
    </ul>
  );
}

function BosGrafik({ mesaj, yukseklik }: { mesaj: string; yukseklik: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed text-sm"
      style={{ height: yukseklik, borderColor: 'var(--kenar)', color: 'var(--metin-2)' }}
    >
      {mesaj}
    </div>
  );
}

/** Bir sayı ve değişim oku; üst şeritteki kartlar için. */
export function OlcuKarti({
  etiket, deger, alt, degisim, ikon,
}: {
  etiket: string;
  deger: string;
  alt?: string;
  /** Yüzde değişim; `null` "karşılaştırılacak dönem yok" demek. */
  degisim?: number | null;
  ikon?: ReactNode;
}) {
  const yonRengi = degisim === undefined || degisim === null
    ? 'var(--metin-2)'
    : degisim >= 0 ? 'var(--olumlu)' : 'var(--olumsuz)';

  return (
    <div className="hud border p-4" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: 'var(--metin-2)' }}>{etiket}</p>
        {ikon}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{deger}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {degisim !== undefined && degisim !== null && (
          <span style={{ color: yonRengi }}>
            {degisim >= 0 ? '▲' : '▼'} %{Math.abs(Math.round(degisim * 10) / 10)}
          </span>
        )}
        {alt && <span style={{ color: 'var(--metin-2)' }}>{alt}</span>}
      </div>
    </div>
  );
}
