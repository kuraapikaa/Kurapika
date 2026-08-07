import { useCallback, useEffect, useState } from 'react';

/**
 * API İSTEMCİSİ.
 *
 * `credentials: 'include'`: oturum çerezle taşınıyor, jeton
 * `localStorage`'da tutulmuyor. `localStorage` her betiğe açık; bir XSS
 * oturumu doğrudan çalabilirdi. `httpOnly` çerez betikten okunamıyor.
 *
 * Hata gövdesi `{ hata: "..." }` biçiminde; mesajı olduğu gibi
 * gösteriyoruz çünkü sunucu 4xx'te bilerek açıklayıcı, 5xx'te bilerek
 * suskun.
 */

export class ApiHatasi extends Error {
  constructor(message: string, public durum: number) {
    super(message);
    this.name = 'ApiHatasi';
  }
}

async function istek<T>(yol: string, secenekler: RequestInit = {}): Promise<T> {
  const yanit = await fetch(yol, {
    credentials: 'include',
    headers: secenekler.body ? { 'Content-Type': 'application/json' } : {},
    ...secenekler,
  });

  const metin = await yanit.text();
  let govde: unknown = null;
  try {
    govde = metin ? JSON.parse(metin) : null;
  } catch {
    govde = null;
  }

  if (!yanit.ok) {
    const mesaj = (govde as { hata?: string } | null)?.hata ?? `İstek başarısız (${yanit.status}).`;
    throw new ApiHatasi(mesaj, yanit.status);
  }
  return govde as T;
}

export const api = {
  al: <T>(yol: string) => istek<T>(yol),
  gonder: <T>(yol: string, govde?: unknown) =>
    istek<T>(yol, { method: 'POST', body: JSON.stringify(govde ?? {}) }),
  yaz: <T>(yol: string, govde?: unknown) =>
    istek<T>(yol, { method: 'PUT', body: JSON.stringify(govde ?? {}) }),
  sil: <T>(yol: string) => istek<T>(yol, { method: 'DELETE' }),
};

export interface VeriDurumu<T> {
  veri: T | null;
  yukleniyor: boolean;
  hata: string | null;
  yenile: () => void;
}

/**
 * Basit veri kancası.
 *
 * TanStack Query yerine bu: panelin veri ihtiyacı sade (sayfa açılır,
 * çeker, yazınca yeniler). Önbellek katmanı eklemek, bir yazma
 * sonrasında ekranın bayat kalması gibi asıl sorunları getirirdi —
 * burada `yenile()` her zaman sunucudan okuyor.
 */
export function useVeri<T>(yol: string | null, bagimliliklar: unknown[] = []): VeriDurumu<T> {
  const [veri, setVeri] = useState<T | null>(null);
  const [yukleniyor, setYukleniyor] = useState(Boolean(yol));
  const [hata, setHata] = useState<string | null>(null);
  const [tur, setTur] = useState(0);

  useEffect(() => {
    if (!yol) {
      setVeri(null);
      setYukleniyor(false);
      return;
    }
    let iptal = false;
    setYukleniyor(true);
    setHata(null);

    api.al<T>(yol)
      .then((sonuc) => {
        // Sayfa degistiyse gelen yaniti YAZMIYORUZ: yavas biten eski bir
        // istek, yeni sayfanin verisini ezerdi.
        if (!iptal) setVeri(sonuc);
      })
      .catch((h: Error) => {
        if (!iptal) setHata(h.message);
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });

    return () => {
      iptal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yol, tur, ...bagimliliklar]);

  const yenile = useCallback(() => setTur((t) => t + 1), []);
  return { veri, yukleniyor, hata, yenile };
}

export const paraBicimi = (deger: number): string =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(deger) || 0);

export const gunBicimi = (deger: string | null): string =>
  deger ? new Date(deger).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
