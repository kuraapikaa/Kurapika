import { useEffect, useState, type ReactNode } from 'react';

/**
 * ORTAK BİLEŞENLER.
 *
 * Renkler CSS değişkenlerinden geliyor, Tailwind renk sınıflarından
 * değil. Sebep: aynı bileşen iki temada da doğru görünmeli ve her
 * bileşene `dark:` varyantı yazmak, bir yerde unutulduğunda aydınlık
 * temada okunmaz metin üretir — sessiz ve yalnızca kullanıcı
 * şikâyetiyle fark edilen bir hata türü.
 */

export const KART = 'rounded-xl border p-4';
export const kartStil = { background: 'var(--yuzey)', borderColor: 'var(--kenar)' };

export function Kart({ baslik, sag, children }: { baslik?: string; sag?: ReactNode; children: ReactNode }) {
  return (
    <section className={KART} style={kartStil}>
      {(baslik || sag) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {baslik && <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--metin-2)' }}>{baslik}</h2>}
          {sag}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * `transition-colors` BİLEREK KULLANILMIYOR.
 *
 * Tailwind'in varsayılan `transition` sınıfı `color` ve `border-color`'ı
 * da animasyonluyor. Renkler kök CSS değişkeninden geldiği için tema
 * değiştiğinde Chromium bu düğümün rengini geçiş öncesi değerde
 * bırakıyor ve bir daha güncellemiyor.
 *
 * Ölçüldü: tema koyuya geçtiğinde kök `--olumsuz` `#fb7185` olmasına
 * rağmen "Sil" düğmesi `#be123c`'de kalıyordu (2.8:1 kontrast). Aynı
 * inline stille o an DOM'a eklenen yeni bir düğme doğru rengi alıyordu —
 * yani sorun eleman türü değil, geçişin kilitlediği mevcut düğüm.
 */
export function Buton({
  children, onClick, tur = 'ikincil', tip = 'button', devredisi = false, tam = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tur?: 'birincil' | 'ikincil' | 'tehlike';
  tip?: 'button' | 'submit';
  devredisi?: boolean;
  tam?: boolean;
}) {
  const stiller: Record<string, React.CSSProperties> = {
    birincil: { background: 'var(--vurgu)', color: 'var(--vurgu-metin)', borderColor: 'var(--vurgu)' },
    ikincil: { background: 'var(--yuzey-2)', color: 'var(--metin)', borderColor: 'var(--kenar)' },
    tehlike: { background: 'transparent', color: 'var(--olumsuz)', borderColor: 'var(--olumsuz)' },
  };
  return (
    <button
      type={tip}
      onClick={onClick}
      disabled={devredisi}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-50 ${tam ? 'w-full' : ''}`}
      style={stiller[tur]}
    >
      {children}
    </button>
  );
}

export function Alan({
  etiket, deger, degisti, tip = 'text', ipucu, cokSatir = false, secenekler,
}: {
  etiket: string;
  deger: string;
  degisti: (yeni: string) => void;
  tip?: string;
  ipucu?: string;
  cokSatir?: boolean;
  secenekler?: Array<{ deger: string; etiket: string }>;
}) {
  const ortak = 'w-full rounded-lg border px-3 py-2 text-sm outline-none';
  const stil = { background: 'var(--yuzey-2)', borderColor: 'var(--kenar)', color: 'var(--metin)' };

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--metin-2)' }}>{etiket}</span>
      {secenekler ? (
        <select className={ortak} style={stil} value={deger} onChange={(e) => degisti(e.target.value)}>
          {secenekler.map((s) => <option key={s.deger} value={s.deger}>{s.etiket}</option>)}
        </select>
      ) : cokSatir ? (
        <textarea className={`${ortak} min-h-24 font-mono`} style={stil} value={deger} onChange={(e) => degisti(e.target.value)} />
      ) : (
        <input className={ortak} style={stil} type={tip} value={deger} onChange={(e) => degisti(e.target.value)} />
      )}
      {ipucu && <span className="mt-1 block text-xs" style={{ color: 'var(--metin-2)' }}>{ipucu}</span>}
    </label>
  );
}

export function Onay({ etiket, deger, degisti }: { etiket: string; deger: boolean; degisti: (yeni: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={deger} onChange={(e) => degisti(e.target.checked)} />
      <span>{etiket}</span>
    </label>
  );
}

export function Rozet({ metin, renk = 'notr' }: { metin: string; renk?: 'notr' | 'olumlu' | 'uyari' | 'olumsuz' }) {
  const renkler = {
    notr: 'var(--metin-2)', olumlu: 'var(--olumlu)', uyari: 'var(--uyari)', olumsuz: 'var(--olumsuz)',
  };
  return (
    <span
      className="inline-block rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color: renkler[renk], borderColor: renkler[renk] }}
    >
      {metin}
    </span>
  );
}

export function Bos({ mesaj }: { mesaj: string }) {
  return <p className="py-6 text-center text-sm" style={{ color: 'var(--metin-2)' }}>{mesaj}</p>;
}

export function Hata({ mesaj }: { mesaj: string }) {
  return (
    <p className="rounded-lg border px-3 py-2 text-sm" style={{ color: 'var(--olumsuz)', borderColor: 'var(--olumsuz)' }}>
      {mesaj}
    </p>
  );
}

export function Yukleniyor() {
  return <p className="py-6 text-center text-sm" style={{ color: 'var(--metin-2)' }}>Yükleniyor…</p>;
}

export function Tablo({ basliklar, children }: { basliklar: string[]; children: ReactNode }) {
  return (
    // Genis tablo SAYFAYI degil KENDINI kaydiriyor; aksi halde mobilde
    // butun duzen yana kayar.
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr style={{ color: 'var(--metin-2)' }}>
            {basliklar.map((b) => (
              <th key={b} className="whitespace-nowrap border-b px-2 py-2 text-xs font-semibold uppercase" style={{ borderColor: 'var(--kenar)' }}>
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Satir({ children }: { children: ReactNode }) {
  return <tr className="border-b last:border-0" style={{ borderColor: 'var(--kenar)' }}>{children}</tr>;
}

export function Hucre({ children, sagda = false }: { children: ReactNode; sagda?: boolean }) {
  return <td className={`px-2 py-2 ${sagda ? 'text-right tabular-nums' : ''}`}>{children}</td>;
}

/** Küçük sayı kartı; panelin üst şeridi. */
export function Olcu({ etiket, deger, alt }: { etiket: string; deger: string; alt?: string }) {
  return (
    <div className={KART} style={kartStil}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--metin-2)' }}>{etiket}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{deger}</p>
      {alt && <p className="mt-1 text-xs" style={{ color: 'var(--metin-2)' }}>{alt}</p>}
    </div>
  );
}

/**
 * Eğilim çizgisi — düz SVG.
 *
 * Grafik kütüphanesi eklemek, tek bir çizgi için ~100 kB paket ve
 * kendi tema sistemiyle uğraşmak demekti. Nokta sayısı azsa çizgi
 * yerine tek nokta gösteriliyor; iki noktadan az veriyle "eğilim"
 * çizmek yanıltıcı olur.
 */
export function Egilim({ noktalar }: { noktalar: number[] }) {
  if (noktalar.length < 2) {
    return <span className="text-xs" style={{ color: 'var(--metin-2)' }}>—</span>;
  }
  const enBuyuk = Math.max(...noktalar);
  const enKucuk = Math.min(...noktalar);
  const aralik = enBuyuk - enKucuk || 1;
  const yol = noktalar
    .map((n, i) => `${(i / (noktalar.length - 1)) * 100},${28 - ((n - enKucuk) / aralik) * 24}`)
    .join(' ');

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-7 w-24">
      <polyline points={yol} fill="none" stroke="var(--vurgu)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const TEMA_ANAHTARI = 'aff-tema';

export function useTema(): [boolean, () => void] {
  const [koyu, setKoyu] = useState(() => {
    const kayitli = localStorage.getItem(TEMA_ANAHTARI);
    if (kayitli) return kayitli === 'koyu';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('koyu', koyu);
    localStorage.setItem(TEMA_ANAHTARI, koyu ? 'koyu' : 'acik');
  }, [koyu]);

  return [koyu, () => setKoyu((k) => !k)];
}
