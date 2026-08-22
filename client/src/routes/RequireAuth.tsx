/**
 * ADMIN ROTALARININ KIMLIK KAPISI.
 *
 * Eskiden `App.tsx` her yol degisiminde `/api/me` cagiriyor, ayrica
 * "bu yol public mi" listesiyle oyuncu sayfalarinda cagriyi atliyordu.
 * O liste uc ayri yerde tutuluyordu ve uculu birbirinden ayrismisti.
 *
 * Artik oyuncu sayfalari bu kapinin DISINDA; atlanacak bir sey yok.
 * Kontrol yol degisiminde degil, kapinin ilk montajinda bir kez yapilir —
 * kapi admin gezinmesi boyunca monte kalir.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { LoginPage } from '@/components/LoginPage';

export type TenantConfig = { themeColor?: string; logoUrl?: string; adminTitle?: string } | null;

/** Oturumu 401 ile biten istek: sunucu "oturum" gerekcesiyle reddetmis. */
function oturumBittiMi(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  const message = String((error as { message?: string } | null)?.message || '').toLowerCase();
  return status === 401 && message.includes('oturum');
}

type OturumDurumu = {
  /** Giris yapmis yonetici; yetki suzmesi bunun uzerinden yapilir. */
  kullanici: any;
  /** Oturumun yonettigi sitenin adi (bos olabilir). */
  siteAdi: string;
  /** Verilerin gerçekten okunduğu kiracı anahtarı (ör. "default"). */
  kiraciAnahtari: string;
  cikisYap: () => Promise<void>;
};

const OturumContext = createContext<OturumDurumu | null>(null);

export function useOturum(): OturumDurumu {
  const durum = useContext(OturumContext);
  if (!durum) throw new Error('useOturum yalnizca RequireAuth altinda kullanilabilir.');
  return durum;
}

export function RequireAuth({ tenantConfig }: { tenantConfig: TenantConfig }) {
  const queryClient = useQueryClient();
  const [girisYapildi, setGirisYapildi] = useState<boolean | null>(null);
  const [kullanici, setKullanici] = useState<any>(null);
  /** Oturumun yönettiği sitenin adı; panel başlığında gösteriliyor. */
  const [siteAdi, setSiteAdi] = useState('');
  const [kiraciAnahtari, setKiraciAnahtari] = useState('');

  const kimligiOku = async () => {
    const res = await fetch('/api/me', { credentials: 'include' }).catch(() => null);
    if (!res?.ok) {
      setKullanici(null);
      setGirisYapildi(false);
      return;
    }
    const data = await res.json().catch(() => null);
    setKullanici(data?.user || null);
    setSiteAdi(String(data?.siteAdi || '').trim());
    setKiraciAnahtari(String(data?.kiraciAnahtari || '').trim());
    setGirisYapildi(true);
  };

  useEffect(() => {
    void kimligiOku();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * OTURUM SONU YAKALAMA.
   *
   * Onceden `App.tsx` yalnizca kendi tuttugu BES sorguyu tariyordu; bir
   * sayfa kendi sorgusuyla 401 alirsa kullanici bos ekranda kaliyordu.
   * Onbellegi dinlemek her sorguyu kapsar.
   */
  useEffect(() => {
    return queryClient.getQueryCache().subscribe((olay) => {
      if (oturumBittiMi(olay.query?.state?.error)) {
        console.warn('Oturum gecersiz (401). Yonlendiriliyor...');
        setGirisYapildi(false);
      }
    });
  }, [queryClient]);

  const cikisYap = async () => {
    console.log('[auth] Cikis yapiliyor...');
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setGirisYapildi(false);
    setKullanici(null);
    queryClient.clear();
  };

  if (girisYapildi === null) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!girisYapildi) {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <LoginPage onLoginSuccess={kimligiOku} tenantConfig={tenantConfig} />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <OturumContext.Provider value={{ kullanici, siteAdi, kiraciAnahtari, cikisYap }}>
      <Outlet />
    </OturumContext.Provider>
  );
}
