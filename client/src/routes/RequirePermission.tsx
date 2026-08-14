/**
 * MODUL YETKI KAPISI.
 *
 * Yetki, rotanin kendi kaydindan (`routeMeta`) okunur. Eskiden ayri bir
 * `TAB_PERMISSION` haritasi vardi ve yeni bir ekran oraya yazilmayi
 * unutursa yetki kontrolunden sessizce kaciyordu.
 *
 * Kart calisma alaninin ICINDE render edilir — sol menu ve baslik yerinde
 * kalir, yalnizca icerik degisir.
 */
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { canAccessRoute, findRouteMeta } from './routeMeta';
import { useOturum } from './RequireAuth';

export function RequirePermission() {
  const { kullanici } = useOturum();
  const { pathname } = useLocation();
  const meta = findRouteMeta(pathname || '/');

  if (!canAccessRoute(kullanici, meta?.permission)) return <YetkiYokKarti />;

  return <Outlet />;
}

function YetkiYokKarti() {
  return (
    <motion.div
      key="access-denied"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.75rem] border border-amber-300/20 bg-amber-300/[0.07] p-8 text-center"
    >
      <ShieldCheck className="mx-auto mb-4 text-amber-200" size={34} />
      <h3 className="text-xl font-black text-white">Bu bölüm için yetkiniz yok</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-slate-400">
        Bu alt panel hesabına ilgili modül izni verilmemiş. Müşteri admini kullanıcı sistemi ekranından yetki ekleyebilir.
      </p>
    </motion.div>
  );
}
