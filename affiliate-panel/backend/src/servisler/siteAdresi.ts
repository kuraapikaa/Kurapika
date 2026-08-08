import { degistir, kayitOku, oku } from '../lib/depo.js';

/**
 * SİTE GÜNCEL ADRESİ.
 *
 * Bahis siteleri erişim engelleriyle sık karşılaşıyor ve alan adını
 * düzenli değiştiriyor. Medyasız bir alt link (bkz. `altLink.ts`) belirli
 * bir kreatife değil, doğrudan sitenin GÜNCEL adresine gitmeli — o adres
 * her medya kaydında ayrı ayrı güncellenmesi gereken bir alan olsaydı,
 * bir tanesi unutulduğunda o kanaldaki trafik sessizce ölü bir adrese
 * düşerdi. Tek, merkezi bir değer bu riski ortadan kaldırıyor.
 *
 * Sır DEĞİL: bu adres zaten oyuncuya açıkça gösteriliyor, şifrelemeye
 * gerek yok (krş. `webhookSirri.ts`).
 */

const ALAN = 'site-adresi';

interface AdresBelgesi {
  adres: string | null;
  guncellendi: string | null;
}

const cozBelge = (ham: unknown): AdresBelgesi => {
  const kayit = kayitOku(ham);
  return {
    adres: typeof kayit.adres === 'string' ? kayit.adres : null,
    guncellendi: typeof kayit.guncellendi === 'string' ? kayit.guncellendi : null,
  };
};

export class SiteAdresiHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'SiteAdresiHatasi';
  }
}

export interface SiteAdresiDurumu {
  adres: string | null;
  guncellendi: string | null;
}

export async function siteAdresiDurumu(kiraci: string): Promise<SiteAdresiDurumu> {
  const belge = await oku<AdresBelgesi>(kiraci, ALAN, cozBelge);
  return { adres: belge.adres, guncellendi: belge.guncellendi };
}

/** Yalnızca yönlendirme kodunun kullandığı dar okuma; durum ayrıntısı taşımaz. */
export async function siteAdresiOku(kiraci: string): Promise<string | null> {
  const belge = await oku<AdresBelgesi>(kiraci, ALAN, cozBelge);
  return belge.adres;
}

/**
 * Adresi yazar. Boş gövde adresi TEMİZLER (medyasız linkler tekrar
 * "landing yoksa 404" davranışına döner) — admin bilerek boşaltabilsin
 * diye ayrı bir "sil" ucu yerine boş değer kabul ediliyor.
 */
export async function siteAdresiYaz(kiraci: string, ham: string, simdi = new Date()): Promise<SiteAdresiDurumu> {
  const temiz = String(ham ?? '').trim();
  let adres: string | null = null;

  if (temiz) {
    let url: URL;
    try {
      url = new URL(temiz);
    } catch {
      throw new SiteAdresiHatasi('Geçerli bir adres girin.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new SiteAdresiHatasi('Adres yalnızca http/https olabilir.');
    }
    adres = url.toString();
  }

  await degistir<AdresBelgesi, void>(kiraci, ALAN, cozBelge, (belge) => {
    belge.adres = adres;
    belge.guncellendi = simdi.toISOString();
  });
  return { adres, guncellendi: simdi.toISOString() };
}
