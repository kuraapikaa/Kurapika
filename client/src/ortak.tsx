/**
 * Ortak paneli — AYRI uygulama girisi.
 *
 * Panel (yonetim) ve lobi (oyuncu) uygulamalarindan bagimsiz bir Vite
 * girisi. Gerekcesi tek satirlik degil:
 *
 *   - Ortak, admin panelinin JS'ini indirmemeli. Ayni pakette olsalardi
 *     yonetim ekranlarinin kodu ortagin tarayicisina da inerdi.
 *   - Kimlik ayri (session.affiliateUser). Ana uygulamanin acilista
 *     yaptigi /api/me, /api/tenant-info cagrilari burada anlamsiz ve
 *     401 uretiyordu.
 *   - Ayri URL: /ortak.html — ortagin panele girmek icin oyuncu lobisinden
 *     gecmesi gerekmiyor.
 *
 * Rotalama YOK: panelin tek bir ekrani var (giris → ozet). Router eklemek
 * paket boyutunu bir kazanci olmadan buyuturdu.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { AffiliatePortal } from './components/affiliate/AffiliatePortal';

const kok = document.getElementById('ortak-root');
if (!kok) throw new Error('Ortak paneli kök öğesi bulunamadı.');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Ortak verisi dakikalar mertebesinde degisiyor; her sekme
      // odaginda yeniden cekmek gereksiz istek uretiyordu.
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      retry: 1,
    },
  },
});

createRoot(kok).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AffiliatePortal />
    </QueryClientProvider>
  </StrictMode>,
);
