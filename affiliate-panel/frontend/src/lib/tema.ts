import { useSyncExternalStore } from 'react';

/**
 * Açık/koyu tema — `<html>` üzerinde `koyu` sınıfı, `localStorage`'da
 * kalıcı. `ui.tsx` ve Shadcn tabanlı sayfalar (Landing/Basvuru) aynı
 * hook'u paylaşıyor; iki bileşen katmanı da aynı `koyu` sınıfını okuyor.
 *
 * `dark` sınıfı AYNI ANDA, `koyu` ile birlikte açılıp kapanıyor: bizim
 * kendi renklerimiz CSS değişkenleri üzerinden `koyu` kapsamını okuyor,
 * ama Tremor'un kendi bileşenleri (grafikler) içeriden Tailwind'in
 * standart `dark:` varyantını kullanıyor. İki sınıf farklı tüketiciler
 * için aynı anahtarın iki adı.
 *
 * ── Neden `useState` DEĞİL ──
 *
 * Birden fazla bileşen (üst şeritteki tema düğmesi VE artık AG Grid/
 * Tremor teması seçen sayfalar — bkz. `Ozet.tsx`) aynı anda `useTema()`
 * çağırıyor. `useState` her çağrıda KENDİ kopyasını tutar; biri
 * değiştirince diğeri haberdar olmaz (ölçüldü: üst şeritten tema
 * değiştirilince Ozet'teki tablo eski renkte donup kalıyordu).
 * `useSyncExternalStore` tek, paylaşılan bir dış duruma abone ediyor —
 * hangi bileşen değiştirirse değiştirsin, hepsi aynı anda güncelleniyor.
 */
const TEMA_ANAHTARI = 'aff-tema';
const dinleyiciler = new Set<() => void>();

function kayitliDegerVarMi(): boolean {
  const kayitli = localStorage.getItem(TEMA_ANAHTARI);
  if (kayitli) return kayitli === 'koyu';
  // Marka karari: varsayilan GECE. Cyberpunk kimligin asil sahnesi
  // koyu tema; isletim sistemi tercihi degil kayitli secim eziyor.
  return true;
}

function domyaUygula(koyu: boolean) {
  document.documentElement.classList.toggle('koyu', koyu);
  document.documentElement.classList.toggle('dark', koyu);
  localStorage.setItem(TEMA_ANAHTARI, koyu ? 'koyu' : 'acik');
}

let mevcut = kayitliDegerVarMi();
domyaUygula(mevcut);

function abone(dinleyici: () => void): () => void {
  dinleyiciler.add(dinleyici);
  return () => dinleyiciler.delete(dinleyici);
}

function anlikGoruntu(): boolean {
  return mevcut;
}

function degistir() {
  mevcut = !mevcut;
  domyaUygula(mevcut);
  dinleyiciler.forEach((d) => d());
}

export function useTema(): [boolean, () => void] {
  const koyu = useSyncExternalStore(abone, anlikGoruntu);
  return [koyu, degistir];
}
