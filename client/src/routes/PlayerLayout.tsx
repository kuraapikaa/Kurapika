/**
 * OYUNCU SAYFALARININ KABUGU.
 *
 * `narcos-theme` sinifi burada aciliyor. Onceden bu karar `App.tsx`
 * icindeki bir yol listesine bakiyordu; ayni amacla tutulan UC liste
 * birbirinden ayrismisti ve `/yazi-tura` ile `/tas-kagit-makas` yalnizca
 * render listesinde olup TEMA listesinde olmadigi icin panel temasiyla
 * aciliyordu.
 *
 * Artik kural yapisal: bu layout'un altinda olmak temanin ta kendisi.
 * Yeni bir oyuncu sayfasi eklemek icin ayrica bir yere yazmak gerekmez.
 */
import { Suspense, useEffect, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Sayfa basina yukleme rengi. Tailwind sinif adlarini tarayarak topladigi
 * icin sinif dizileri TAM yazilmali; `border-${renk}-400` calismaz.
 */
const HALKA_RENKLERI = {
  teal: 'border-teal-400/30 border-t-teal-400',
  amber: 'border-amber-400/30 border-t-amber-400',
  orange: 'border-orange-400/30 border-t-orange-400',
  emerald: 'border-emerald-400/30 border-t-emerald-400',
  cyan: 'border-cyan-400/30 border-t-cyan-400',
  sky: 'border-sky-400/30 border-t-sky-400',
  blue: 'border-blue-400/30 border-t-blue-400',
} as const;

export type HalkaRengi = keyof typeof HALKA_RENKLERI;

/** Lobi zemini iki tonda: oyun sayfalari #0a0f1a, vitrin/turnuva #070b14. */
export type Zemin = '#0a0f1a' | '#070b14';

function Yukleniyor({ renk, zemin }: { renk: HalkaRengi; zemin: Zemin }) {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: zemin }}>
      <div className={`w-10 h-10 border-2 rounded-full animate-spin ${HALKA_RENKLERI[renk]}`} />
    </div>
  );
}

/**
 * Rota elemanini kendi yukleme rengiyle sarar. Her sayfanin kendi
 * `Suspense` siniri korunur — tek bir ortak fallback, sayfalarin
 * birbirinden ayrilan aksan renklerini duzlestirirdi.
 */
export function oyuncuSayfasi(icerik: ReactNode, renk: HalkaRengi, zemin: Zemin = '#070b14') {
  return <Suspense fallback={<Yukleniyor renk={renk} zemin={zemin} />}>{icerik}</Suspense>;
}

export function PlayerLayout() {
  useEffect(() => {
    document.documentElement.classList.add('narcos-theme');
    return () => document.documentElement.classList.remove('narcos-theme');
  }, []);

  return <Outlet />;
}
