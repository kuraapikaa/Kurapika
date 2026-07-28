import { useEffect, useState } from 'react';
import { bonusPanelApi } from '../api/client';

/**
 * Panel ana sitede iframe olarak gömülü çalışır. Oyuncunun oturumu ana sitede
 * olduğu için kullanıcı adını panel kendi başına bilemez; ana sitedeki tema
 * script'i (narcos-panel-gomme.js) sitenin /api/v1/me ucundan okuyup
 * postMessage ile buraya iletir.
 *
 * GÜVENLİK NOTU: bu kullanıcı adı kimlik KANITI değildir, yalnızca kolaylıktır.
 * Panel zaten kullanıcı adını doğrulamasız kabul ediyordu (elle yazılan ad da
 * doğrulanmıyordu), dolayısıyla bu değişiklik güvenlik seviyesini düşürmez —
 * ama yükseltmez de. Gerçek çözüm imzalı bir jeton (ör. HMAC'li kısa ömürlü
 * token) olurdu; bunun için ana sitenin uç noktası gerekiyor.
 */

// Yalnızca bu origin'lerden gelen mesajlar dikkate alınır.
const IZINLI_ORIGINLER = [
  /^https:\/\/(?:[a-z0-9-]+\.)?narcosbahis\.com$/i,
  /^https:\/\/(?:[a-z0-9-]+\.)?narcosbahis\d*\.com$/i,
  /^https:\/\/(?:[a-z0-9-]+\.)?narcosgir\.com$/i,
  /^https:\/\/(?:[a-z0-9-]+\.)?tacobahis\d*\.com$/i,
];

function originIzinliMi(origin: string): boolean {
  return IZINLI_ORIGINLER.some((desen) => desen.test(origin));
}

export function gomuluMu(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin erişim hatası da gömülü olduğumuz anlamına gelir.
    return true;
  }
}

export function useParentUsername(): { username: string | null; bekleniyor: boolean } {
  const [username, setUsername] = useState<string | null>(null);
  // Gömülü değilsek beklenecek bir şey yok; hemen sonuçlan.
  const [bekleniyor, setBekleniyor] = useState<boolean>(() => gomuluMu());

  useEffect(() => {
    if (!gomuluMu()) return;

    const dinle = (olay: MessageEvent) => {
      if (!originIzinliMi(olay.origin)) return;
      const veri: any = olay.data;
      if (!veri || veri.tur !== 'narcos-kullanici') return;
      const ad = String(veri.kullaniciAdi ?? '').trim();
      if (!ad) return;
      setUsername(ad);
      setBekleniyor(false);
      try { localStorage.setItem('saved_username', ad); } catch { /* depolama kapalı */ }
    };

    window.addEventListener('message', dinle);

    // Üst pencereye hazır olduğumuzu bildir: iframe'in yüklenmesi ile ana
    // sitedeki /api/v1/me yanıtının hangisinin önce biteceği garanti değil.
    try {
      window.parent.postMessage({ tur: 'narcos-panel-hazir' }, '*');
    } catch { /* üst pencereye erişilemiyor */ }

    // Kimlik hiç gelmezse arayüz süresiz "yükleniyor" durumunda kalmasın.
    const zamanAsimi = setTimeout(() => setBekleniyor(false), 4000);

    return () => {
      window.removeEventListener('message', dinle);
      clearTimeout(zamanAsimi);
    };
  }, []);

  return { username, bekleniyor };
}

/**
 * Ana siteden gelen kullanıcı adıyla PANEL OTURUMUNU da kurar.
 *
 * Kullanıcı adını ekranda göstermek yetmiyor: çark ve kazı-kazan uçları
 * sunucuda `request.session.bonusPanelUser` arıyor (games.ts). Oturum
 * kurulmazsa oyuncu adını görür ama "Önce kullanıcı adı doğrulaması
 * yapmalısınız" hatası alır.
 *
 * Panelin kendi oturumu zaten varsa ona dokunmayız.
 */
export function useOtomatikOturum(): { username: string | null; bekleniyor: boolean } {
  const { username: ustPencereAdi, bekleniyor: kimlikBekleniyor } = useParentUsername();
  const [username, setUsername] = useState<string | null>(null);
  const [oturumDeneniyor, setOturumDeneniyor] = useState(false);

  // Panelin mevcut oturumu
  useEffect(() => {
    let iptal = false;
    bonusPanelApi.me().then((res) => {
      if (!iptal && res.ok) setUsername(res.login);
    }).catch(() => { /* oturum yok */ });
    return () => { iptal = true; };
  }, []);

  // Ana siteden kimlik geldiyse oturumu onunla kur
  useEffect(() => {
    if (!ustPencereAdi || username) return;
    let iptal = false;
    setOturumDeneniyor(true);
    bonusPanelApi.login(ustPencereAdi)
      .then((res: any) => {
        if (iptal) return;
        if (res?.ok && res.login) {
          setUsername(res.login);
          try { localStorage.setItem('saved_username', res.login); } catch { /* yok */ }
        }
      })
      .catch(() => { /* ağ hatası: elle akış devrede kalır */ })
      .finally(() => { if (!iptal) setOturumDeneniyor(false); });
    return () => { iptal = true; };
  }, [ustPencereAdi, username]);

  return { username, bekleniyor: (kimlikBekleniyor || oturumDeneniyor) && !username };
}
