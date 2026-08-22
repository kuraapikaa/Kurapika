import { useCallback, useEffect, useState } from 'react';

/**
 * Bir elemanın CSS piksel cinsinden genişliğini izler.
 *
 * Çark için gerekli: SVG'nin `viewBox`'ı sabit olsaydı (ör. 560) ve kutu
 * mobilde 206 px'e inseydi, 13 birimlik yazı ekranda 4.8 px'e düşer ve
 * okunmaz olurdu. `size`'ı ölçülen genişlik yapınca 1 SVG birimi = 1 CSS
 * pikseli oluyor: punto her ekranda gerçekte istenen punto, dilime ne
 * kadar yazı sığdığı hesabı da aynı birimde doğru çalışıyor.
 *
 * `RefObject` yerine CALLBACK ref döndürüyor. Ölçülecek eleman koşullu
 * basılıyor (çark ancak oyuncu doğrulandıktan sonra ekrana geliyor);
 * `RefObject` ile effect ilk kareede `null` görüp çıkıyor ve eleman sonradan
 * belirse de bir daha çalışmıyordu -- ölçü hep varsayılanda kalıyordu.
 */
export function useOlculenGenislik(varsayilan: number) {
  const [eleman, setEleman] = useState<HTMLElement | null>(null);
  const [genislik, setGenislik] = useState(varsayilan);

  const ref = useCallback((node: HTMLElement | null) => setEleman(node), []);

  useEffect(() => {
    if (!eleman) return;

    const olc = () => {
      const w = Math.round(eleman.getBoundingClientRect().width);
      if (w > 0) setGenislik(w);
    };
    olc();

    // ResizeObserver'ı olmayan ortamlarda (eski tarayıcı, jsdom) pencere
    // olayına düşüyor -- çark yine doğru boyutta çiziliyor.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', olc);
      return () => window.removeEventListener('resize', olc);
    }

    const gozlemci = new ResizeObserver(olc);
    gozlemci.observe(eleman);
    return () => gozlemci.disconnect();
  }, [eleman]);

  return { ref, genislik };
}
