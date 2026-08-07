import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, useVeri } from './api';
import { Buton, Yukleniyor, useTema } from './ui';
import { Giris } from './sayfalar/Giris';
import { Baglanti } from './sayfalar/yonetim/Baglanti';
import { Basvurular } from './sayfalar/yonetim/Basvurular';
import { Donemler } from './sayfalar/yonetim/Donemler';
import { Kademeler } from './sayfalar/yonetim/Kademeler';
import { Medya } from './sayfalar/yonetim/Medya';
import { Ortaklar } from './sayfalar/yonetim/Ortaklar';
import { Ozet } from './sayfalar/yonetim/Ozet';
import { Planlar } from './sayfalar/yonetim/Planlar';
import { Postback } from './sayfalar/yonetim/Postback';
import { Tiklamalar } from './sayfalar/yonetim/Tiklamalar';
import { PortalHakedis } from './sayfalar/portal/PortalHakedis';
import { PortalMedya } from './sayfalar/portal/PortalMedya';
import { PortalOzet } from './sayfalar/portal/PortalOzet';
import { PortalPostback } from './sayfalar/portal/PortalPostback';
import { PortalTiklamalar } from './sayfalar/portal/PortalTiklamalar';

interface Oturum {
  girisli: boolean;
  rol?: 'yonetici' | 'ortak';
  ad?: string;
  kiraci?: string;
  ortakAnahtari?: string | null;
}

const YONETIM_MENUSU = [
  { yol: '/ozet', etiket: 'Özet' },
  { yol: '/basvurular', etiket: 'Başvurular' },
  { yol: '/ortaklar', etiket: 'Ortaklar' },
  { yol: '/planlar', etiket: 'Komisyon planları' },
  { yol: '/medya', etiket: 'Medya' },
  { yol: '/kademeler', etiket: 'Kademeler' },
  { yol: '/postback', etiket: 'Postback' },
  { yol: '/tiklamalar', etiket: 'Tıklamalar' },
  { yol: '/donemler', etiket: 'Hakediş' },
  { yol: '/baglanti', etiket: 'Backoffice bağlantısı' },
];

const PORTAL_MENUSU = [
  { yol: '/portal', etiket: 'Özet' },
  { yol: '/portal/medya', etiket: 'Medya ve linkler' },
  { yol: '/portal/tiklamalar', etiket: 'Tıklamalar' },
  { yol: '/portal/hakedis', etiket: 'Hakediş' },
  { yol: '/portal/postback', etiket: 'Postback' },
];

export function App() {
  const { veri, yukleniyor, yenile } = useVeri<Oturum>('/api/oturum');
  const [koyu, temaDegistir] = useTema();
  const [cikisYapiliyor, setCikisYapiliyor] = useState(false);
  const gezin = useNavigate();

  // Oturum degistiginde kok adrese donuyoruz: yonetici cikip ortak
  // girdiginde, onceki rolun adresinde kalmak "yetkiniz yok" ekrani
  // gosterirdi.
  useEffect(() => {
    if (veri?.girisli) gezin(veri.rol === 'ortak' ? '/portal' : '/ozet', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veri?.girisli, veri?.rol]);

  if (yukleniyor) return <Yukleniyor />;
  if (!veri?.girisli) return <Giris girisYapildi={yenile} />;

  const yonetici = veri.rol === 'yonetici';
  const menu = yonetici ? YONETIM_MENUSU : PORTAL_MENUSU;

  const cikis = async () => {
    setCikisYapiliyor(true);
    await api.gonder('/api/oturum/cikis').catch(() => undefined);
    setCikisYapiliyor(false);
    yenile();
  };

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 border-b px-4 py-3"
        style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <span className="text-base font-semibold">Affiliate Paneli</span>
          <span className="text-xs" style={{ color: 'var(--metin-2)' }}>
            {yonetici ? 'Yönetim' : 'Ortak portali'} · {veri.ad}
            {veri.ortakAnahtari ? ` · ${veri.ortakAnahtari}` : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Buton onClick={temaDegistir}>{koyu ? 'Aydınlık' : 'Karanlık'}</Buton>
            <Buton onClick={cikis} devredisi={cikisYapiliyor}>Çıkış</Buton>
          </div>
        </div>

        <nav className="mx-auto mt-3 flex max-w-7xl flex-wrap gap-1">
          {menu.map((m) => (
            <NavLink
              key={m.yol}
              to={m.yol}
              end={m.yol === '/portal'}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={({ isActive }) => ({
                background: isActive ? 'var(--vurgu)' : 'transparent',
                color: isActive ? 'var(--vurgu-metin)' : 'var(--metin-2)',
              })}
            >
              {m.etiket}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 p-4">
        <Routes>
          {yonetici ? (
            <>
              <Route path="/ozet" element={<Ozet />} />
              <Route path="/basvurular" element={<Basvurular />} />
              <Route path="/ortaklar" element={<Ortaklar />} />
              <Route path="/planlar" element={<Planlar />} />
              <Route path="/medya" element={<Medya />} />
              <Route path="/kademeler" element={<Kademeler />} />
              <Route path="/postback" element={<Postback />} />
              <Route path="/tiklamalar" element={<Tiklamalar />} />
              <Route path="/donemler" element={<Donemler />} />
              <Route path="/baglanti" element={<Baglanti />} />
              <Route path="*" element={<Navigate to="/ozet" replace />} />
            </>
          ) : (
            <>
              <Route path="/portal" element={<PortalOzet />} />
              <Route path="/portal/medya" element={<PortalMedya />} />
              <Route path="/portal/tiklamalar" element={<PortalTiklamalar />} />
              <Route path="/portal/hakedis" element={<PortalHakedis />} />
              <Route path="/portal/postback" element={<PortalPostback />} />
              <Route path="*" element={<Navigate to="/portal" replace />} />
            </>
          )}
        </Routes>
      </main>
    </div>
  );
}
