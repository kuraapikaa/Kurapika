import { useEffect, useState } from 'react';
import { hexToHsl, tercihEdilenMetinRengi } from './lib/renk';
import maskotLogo from './gorseller/maskot-logo.webp';

/**
 * MARKA — logo ve panel adı.
 *
 * Sunucudan geliyor (`/api/marka`), koda gömülü değil: panel çok
 * kiracılı ve aynı kod tabanı farklı markalar için çalışıyor. Logoyu
 * depoya koymak da mümkündü ama her logo değişikliği dağıtım
 * gerektirirdi.
 *
 * ── Logo yoksa ne olur ──
 *
 * Kırık görsel yerine METİN LOGOSU çiziliyor. Bir panelin "logo
 * yüklenemedi" ikonuyla açılması, çalışan ama bakımsız görünen bir
 * ürün izlenimi bırakır; metin logosu her zaman doğru görünür.
 *
 * Görsel yüklenemezse (adres bozuk, CDN düşük) `onError` ile yine
 * metne düşülüyor — sunucunun adresi vermesi görselin var olduğunu
 * garanti etmiyor.
 */

export interface MarkaBilgisi {
  ad: string;
  logoUrl: string | null;
  vurgu: string | null;
}

const VARSAYILAN: MarkaBilgisi = { ad: 'Bugs Affiliate', logoUrl: null, vurgu: null };

export function useMarka(): MarkaBilgisi {
  const [marka, setMarka] = useState<MarkaBilgisi>(VARSAYILAN);

  useEffect(() => {
    let iptal = false;
    fetch('/api/marka', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : VARSAYILAN))
      .then((m: MarkaBilgisi) => {
        if (iptal) return;
        setMarka({ ...VARSAYILAN, ...m });
        // Marka rengi kok degiskeni EZIYOR; boylece butun panel (butonlar,
        // grafikler, secili menu) tek bir degerle markaya uyuyor.
        if (m.vurgu) {
          document.documentElement.style.setProperty('--vurgu', m.vurgu);
          // Ayni rengi Shadcn tarafinin `--primary`'sine de yaziyoruz --
          // iki katman (eski ui.tsx, yeni shadcn bilesenleri) Asama 5'e
          // kadar yan yana yasiyor ve ikisi de ayni kiraci rengini
          // gostermeli.
          const hsl = hexToHsl(m.vurgu);
          if (hsl) {
            document.documentElement.style.setProperty('--primary', hsl.triple);
            document.documentElement.style.setProperty('--ring', hsl.triple);
            document.documentElement.style.setProperty('--primary-foreground', tercihEdilenMetinRengi(hsl.l));
          }
        }
      })
      .catch(() => undefined);
    return () => { iptal = true; };
  }, []);

  return marka;
}

export function Logo({ marka, boyut = 'orta' }: { marka: MarkaBilgisi; boyut?: 'orta' | 'buyuk' }) {
  const [gorselBozuk, setGorselBozuk] = useState(false);
  const yukseklik = boyut === 'buyuk' ? 40 : 28;

  if (marka.logoUrl && !gorselBozuk) {
    return (
      <img
        src={marka.logoUrl}
        alt={marka.ad}
        style={{ height: yukseklik, width: 'auto', maxWidth: boyut === 'buyuk' ? 240 : 170 }}
        onError={() => setGorselBozuk(true)}
      />
    );
  }

  // Kiracinin kendi logoUrl'u yoksa VARSAYILAN marka (Bugs Affiliate) icin
  // maskot gorseli gosteriliyor; baska bir kiracinin adiysa (logosuz ama
  // ismi farkli beyaz etiket) hala metin logosuna dusuluyor -- maskot
  // yalnizca kendi markamizin kimligi, baskasina zorla giydirilmiyor.
  if (marka.ad === VARSAYILAN.ad) {
    return (
      <img
        src={maskotLogo}
        alt={marka.ad}
        style={{ height: yukseklik, width: 'auto', maxWidth: boyut === 'buyuk' ? 240 : 170 }}
      />
    );
  }

  return <MetinLogosu ad={marka.ad} boyut={boyut} />;
}

/**
 * Metin logosu — altın degrade.
 *
 * `background-clip: text` ile: degradeyi harflerin içine almanın
 * görselsiz tek yolu. Desteklemeyen bir tarayıcıda `color` yedeği
 * devrede kalıyor, yazı okunur.
 */
function MetinLogosu({ ad, boyut }: { ad: string; boyut: 'orta' | 'buyuk' }) {
  const [ilk, ...kalan] = ad.split(' ');
  return (
    <span
      className={`font-bold tracking-tight ${boyut === 'buyuk' ? 'text-3xl' : 'text-lg'}`}
      style={{
        color: 'var(--marka-alt)',
        backgroundImage: 'linear-gradient(100deg, var(--marka-ust), var(--marka-orta) 45%, var(--marka-alt))',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {ilk}
      {kalan.length > 0 && <span className="font-light"> {kalan.join(' ')}</span>}
    </span>
  );
}
