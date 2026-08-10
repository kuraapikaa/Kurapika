import type { ReactNode } from 'react';

/**
 * DİKEY GÖRÜNÜM PARÇALARI — casino ve spor bahis yan yana.
 *
 * Tasarımın panel tarafındaki tek yapısal iddiası bu: gelir tek bir
 * rakam değil, İKİ AKIŞ. Toplamı göstermek yetmiyor çünkü iki dikey
 * ayrı oranlarla ödeniyor (bkz. `servisler/dikey.ts`) — ortak "neden
 * bu kadar" sorusunu ancak kırılımı görürse cevaplayabiliyor.
 *
 * Bu dosya `grafik.tsx`'i YENİDEN YAZMIYOR, yanına geliyor: mevcut
 * `OlcuKarti` dikeysiz ekranlarda (tıklama, ödeme) hâlâ doğru bileşen.
 *
 * ── Neden ayrı bir bileşen, `OlcuKarti`'na üçüncü bir prop değil ──
 *
 * Dikey kartı yalnızca "iki satır daha" değil: alt kırılımın toplamı
 * üstteki rakama eşit olmak ZORUNDA (para akış değeri) ama oyuncu
 * sayısında eşit OLMAMALI (aynı oyuncu iki dikeyde de sayılır). İki
 * farklı doğruluk kuralı taşıyan bir kartı tek bileşene sıkıştırmak,
 * çağıran tarafın hangi kuralın geçerli olduğunu bilmesini gerektirir.
 */

export type Dikey = 'casino' | 'spor' | 'bilinmiyor';

export const DIKEY_ETIKETI: Record<Dikey, string> = {
  casino: 'Casino',
  spor: 'Spor',
  bilinmiyor: 'Ayrışmamış',
};

/**
 * Dikeyin rengi — ALTIN casino, GÜMÜŞ spor.
 *
 * Renk ayrımı keyfî değil, paletin iş bölümünü izliyor: casino
 * cironun büyük kısmı, altın oraya ait. `bilinmiyor` ikisinden de
 * değil, bu yüzden soluk metin rengi — bir dikey değil bir EKSİK.
 */
export const DIKEY_RENGI: Record<Dikey, string> = {
  casino: 'var(--tayf-3)',
  spor: 'var(--vurgu-2)',
  bilinmiyor: 'var(--metin-2)',
};

const SIRA: Dikey[] = ['casino', 'spor', 'bilinmiyor'];

export interface DikeyDegeri {
  dikey: Dikey;
  /** Biçimlenmiş değer; para birimi/ondalık kararı çağıran tarafta. */
  metin: string;
}

/**
 * BÖLÜNMÜŞ ÖLÇÜ KARTI — üstte toplam, altında dikey kırılımı.
 *
 * Kırılımda yalnızca ÖLÇÜMÜ OLAN dikeyler görünüyor: spor trafiği
 * getirmeyen bir ortağa sıfırlı bir spor satırı göstermek, "denedim ve
 * kazandırmadı" gibi okunur — oysa doğrusu "hiç denenmedi".
 */
export function DikeyOlcuKarti({
  etiket, deger, alt, degisim, dikeyler, toplamaUyari,
}: {
  etiket: string;
  deger: string;
  alt?: string;
  degisim?: number | null;
  dikeyler?: DikeyDegeri[];
  /** Alt kırılımın toplamı üstteki rakama eşit değilse açıklaması. */
  toplamaUyari?: string;
}) {
  const yonRengi = degisim === undefined || degisim === null
    ? 'var(--metin-2)'
    : degisim >= 0 ? 'var(--olumlu)' : 'var(--olumsuz)';

  const gosterilecek = (dikeyler ?? [])
    .filter((d) => d.dikey !== 'bilinmiyor' || (dikeyler ?? []).length === 1)
    .sort((a, b) => SIRA.indexOf(a.dikey) - SIRA.indexOf(b.dikey));

  return (
    <div className="hud border p-4" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--metin-2)' }}>{etiket}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{deger}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
        {degisim !== undefined && degisim !== null && (
          <span style={{ color: yonRengi }}>
            {degisim >= 0 ? '▲' : '▼'} %{Math.abs(Math.round(degisim * 10) / 10)}
          </span>
        )}
        {alt && <span style={{ color: 'var(--metin-2)' }}>{alt}</span>}
      </div>

      {gosterilecek.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: 'var(--kenar)' }}>
          {gosterilecek.map((d) => (
            <div key={d.dikey} className="min-w-0">
              <p
                className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: 'var(--metin-2)' }}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-sm"
                  style={{ background: DIKEY_RENGI[d.dikey] }}
                />
                <span className="truncate">{DIKEY_ETIKETI[d.dikey]}</span>
              </p>
              <p className="mt-1 truncate font-mono text-sm tabular-nums">{d.metin}</p>
            </div>
          ))}
        </div>
      )}

      {toplamaUyari && (
        <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--metin-2)' }}>{toplamaUyari}</p>
      )}
    </div>
  );
}

/**
 * İKİ SERİLİ ALAN GRAFİĞİ — casino altın, spor gümüş, üst üste.
 *
 * `ZamanSerisi` tek seri çiziyor; iki dikeyi tek çizgide toplamak
 * "hangi dikey büyüdü" sorusunu görünmez kılıyor. Yığılmış (stacked)
 * DEĞİL üst üste bindirilmiş: yığmak toplamı doğru gösterir ama iki
 * seriyi birbirine göre okumayı imkânsızlaştırır.
 */
export function DikeyZamanSerisi({
  noktalar, bosMesaj = 'Bu dönemde ölçüm yok.', yukseklik = 180,
}: {
  noktalar: Array<{ gun: string; casino: number; spor: number }>;
  bosMesaj?: string;
  yukseklik?: number;
}) {
  if (!noktalar.length) {
    return <p className="py-8 text-center text-sm" style={{ color: 'var(--metin-2)' }}>{bosMesaj}</p>;
  }

  const G = 1000;
  const Y = yukseklik;
  // Tek bir tavan: iki seri AYNI olcekte olmali, aksi halde kucuk seri
  // buyugu kadar yuksek gorunur ve karsilastirma yalan olur.
  const tavan = Math.max(1, ...noktalar.map((n) => Math.max(n.casino, n.spor)));
  const x = (i: number) => (noktalar.length === 1 ? G / 2 : (i / (noktalar.length - 1)) * G);
  const y = (v: number) => Y - (Math.max(0, v) / tavan) * (Y - 8);

  const cizgi = (al: (n: typeof noktalar[number]) => number) =>
    noktalar.map((n, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(al(n)).toFixed(1)}`).join(' ');
  const alan = (al: (n: typeof noktalar[number]) => number) =>
    `${cizgi(al)} L ${x(noktalar.length - 1).toFixed(1)} ${Y} L ${x(0).toFixed(1)} ${Y} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${G} ${Y}`} preserveAspectRatio="none" className="block h-[180px] w-full" role="img">
        <defs>
          <linearGradient id="dikey-casino" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tayf-3)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--tayf-3)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dikey-spor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--vurgu-2)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--vurgu-2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={alan((n) => n.casino)} fill="url(#dikey-casino)" />
        <path d={alan((n) => n.spor)} fill="url(#dikey-spor)" />
        <path d={cizgi((n) => n.spor)} fill="none" stroke="var(--vurgu-2)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d={cizgi((n) => n.casino)} fill="none" stroke="var(--tayf-3)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {(['casino', 'spor'] as const).map((d) => (
          <span key={d} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--metin-2)' }}>
            <span aria-hidden className="h-0.5 w-4 rounded" style={{ background: DIKEY_RENGI[d] }} />
            {DIKEY_ETIKETI[d]}
          </span>
        ))}
        <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--metin-2)' }}>
          {noktalar[0].gun.slice(5)} – {noktalar[noktalar.length - 1].gun.slice(5)}
        </span>
      </div>
    </div>
  );
}

/** Tablo başlığında dikey işareti; `Ozet.tsx` kolonlarında kullanılıyor. */
export function DikeyBasligi({ dikey, children }: { dikey: Dikey; children: ReactNode }) {
  return (
    <span className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: DIKEY_RENGI[dikey] }} />
      {children}
    </span>
  );
}
