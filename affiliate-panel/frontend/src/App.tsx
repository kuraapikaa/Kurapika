import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, useVeri } from './api';
import { IKON, Kabuk, type MenuOgesi } from './kabuk';
import { Buton, Yukleniyor, useTema } from './ui';
import { Landing } from './sayfalar/Landing';
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
import { PortalAltLinkler } from './sayfalar/portal/PortalAltLinkler';
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

/**
 * Menü, sektördeki affiliate platformlarının düzenini izliyor:
 * ortaklar, teklifler (komisyon planları), istatistik, ödemeler.
 * Bu paneli ilk kez açan biri nereye bakacağını zaten biliyor.
 */
const YONETIM_MENUSU: MenuOgesi[] = [
  { yol: '/ozet', etiket: 'Panel', ikon: IKON.pano },
  {
    yol: '/ortaklar',
    etiket: 'Ortaklar',
    ikon: IKON.ortak,
    altlar: [
      { yol: '/ortaklar', etiket: 'Tüm ortaklar' },
      { yol: '/basvurular', etiket: 'Başvurular' },
      { yol: '/kademeler', etiket: 'Kademeler' },
    ],
  },
  { yol: '/planlar', etiket: 'Komisyon planları', ikon: IKON.teklif },
  { yol: '/medya', etiket: 'Medya', ikon: IKON.medya },
  {
    yol: '/tiklamalar',
    etiket: 'İstatistik',
    ikon: IKON.istatistik,
    altlar: [{ yol: '/tiklamalar', etiket: 'Tıklamalar' }],
  },
  { yol: '/donemler', etiket: 'Hakediş', ikon: IKON.odeme },
  {
    yol: '/baglanti',
    etiket: 'Ayarlar',
    ikon: IKON.ayar,
    altlar: [
      { yol: '/baglanti', etiket: 'Backoffice bağlantısı' },
      { yol: '/postback', etiket: 'Postback' },
    ],
  },
];

const PORTAL_MENUSU: MenuOgesi[] = [
  { yol: '/portal', etiket: 'Panel', ikon: IKON.pano, tam: true },
  { yol: '/portal/alt-linkler', etiket: 'Alt linkler', ikon: IKON.link },
  { yol: '/portal/medya', etiket: 'Medya', ikon: IKON.medya },
  { yol: '/portal/tiklamalar', etiket: 'Tıklamalar', ikon: IKON.istatistik },
  { yol: '/portal/hakedis', etiket: 'Hakediş', ikon: IKON.odeme },
  { yol: '/portal/postback', etiket: 'Postback', ikon: IKON.ayar },
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

  // Giris yapmamis ziyaretci CIPLAK BIR GIRIS KUTUSU degil, programin ne
  // teklif ettigini anlatan sayfayi goruyor: bu adres ortaklara
  // paylasilan adres ve ilk kez gelen biri kapiyla karsilasmamali.
  if (!veri?.girisli) return <Landing girisYapildi={yenile} />;

  const yonetici = veri.rol === 'yonetici';

  const cikis = async () => {
    setCikisYapiliyor(true);
    await api.gonder('/api/oturum/cikis').catch(() => undefined);
    setCikisYapiliyor(false);
    yenile();
  };

  return (
    <Kabuk
      menu={yonetici ? YONETIM_MENUSU : PORTAL_MENUSU}
      baslik={yonetici ? 'Yönetim' : 'Ortak paneli'}
      altBaslik={veri.ortakAnahtari ?? veri.ad ?? ''}
      sagUst={
        <>
          <Buton onClick={temaDegistir}>{koyu ? 'Aydınlık' : 'Karanlık'}</Buton>
          <Buton onClick={cikis} devredisi={cikisYapiliyor}>Çıkış</Buton>
        </>
      }
    >
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
            <Route path="/portal/alt-linkler" element={<PortalAltLinkler />} />
            <Route path="/portal/medya" element={<PortalMedya />} />
            <Route path="/portal/tiklamalar" element={<PortalTiklamalar />} />
            <Route path="/portal/hakedis" element={<PortalHakedis />} />
            <Route path="/portal/postback" element={<PortalPostback />} />
            <Route path="*" element={<Navigate to="/portal" replace />} />
          </>
        )}
      </Routes>
    </Kabuk>
  );
}
