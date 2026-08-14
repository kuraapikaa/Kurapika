/**
 * MASTER PANELI KAPISI.
 *
 * Kendi kimlik ucu (`/api/master/check`) var; admin oturumundan bagimsiz.
 * Eskiden bu kontrol `App.tsx`'in yol degisimine bagli effect'i icinde,
 * "yol /master ile basliyorsa" dalinda duruyordu.
 */
import { Suspense, lazy, useEffect, useState } from 'react';

const MasterLogin = lazy(() => import('@/pages/master/MasterLogin').then((m) => ({ default: m.MasterLogin })));
const MasterPanel = lazy(() => import('@/pages/master/MasterPanel').then((m) => ({ default: m.MasterPanel })));

function Yukleniyor() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#050505]">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
    </div>
  );
}

export function MasterGuard() {
  const [girisYapildi, setGirisYapildi] = useState<boolean | null>(null);

  useEffect(() => {
    let iptal = false;
    fetch('/api/master/check', { credentials: 'include' })
      .then((res) => { if (!iptal) setGirisYapildi(res.ok); })
      .catch(() => { if (!iptal) setGirisYapildi(false); });
    return () => { iptal = true; };
  }, []);

  return (
    <Suspense fallback={<Yukleniyor />}>
      {girisYapildi === null ? (
        <Yukleniyor />
      ) : girisYapildi === false ? (
        <MasterLogin onLoginSuccess={() => setGirisYapildi(true)} />
      ) : (
        <MasterPanel />
      )}
    </Suspense>
  );
}
