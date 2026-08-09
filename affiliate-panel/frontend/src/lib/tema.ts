import { useEffect, useState } from 'react';

/**
 * Açık/koyu tema — `<html>` üzerinde `koyu` sınıfı, `localStorage`'da
 * kalıcı. `ui.tsx` ve Shadcn tabanlı sayfalar (Landing/Basvuru) aynı
 * hook'u paylaşıyor; iki bileşen katmanı da aynı `koyu` sınıfını okuyor.
 */
const TEMA_ANAHTARI = 'aff-tema';

export function useTema(): [boolean, () => void] {
  const [koyu, setKoyu] = useState(() => {
    const kayitli = localStorage.getItem(TEMA_ANAHTARI);
    if (kayitli) return kayitli === 'koyu';
    // Marka karari: varsayilan GECE. Cyberpunk kimligin asil sahnesi
    // koyu tema; isletim sistemi tercihi degil kayitli secim eziyor.
    return true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('koyu', koyu);
    localStorage.setItem(TEMA_ANAHTARI, koyu ? 'koyu' : 'acik');
  }, [koyu]);

  return [koyu, () => setKoyu((k) => !k)];
}
