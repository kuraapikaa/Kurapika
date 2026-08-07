import type { FastifyInstance } from 'fastify';

/**
 * MARKA — panel adı ve logo.
 *
 * Koda gömmek yerine ortam değişkeninden geliyor. İki sebep:
 *
 * Panel çok kiracılı; aynı kod tabanı farklı markalar için
 * çalışıyor. Marka adını kaynağa yazmak, ikinci site için ayrı bir
 * derleme demek olurdu.
 *
 * Logo dosyasını depoya koymak da mümkündü ama logo değiştiğinde
 * dağıtım gerektirirdi. Adres olarak vermek, pazarlama tarafının
 * dağıtım beklemeden değiştirebilmesi demek.
 *
 * Logo yoksa arayüz metin logosuna düşüyor — kırık görsel yerine
 * çalışan bir şey.
 */

export interface Marka {
  ad: string;
  /** Logo adresi; yoksa arayüz metin logosu çiziyor. */
  logoUrl: string | null;
  /** Vurgu rengi; markaya göre değişebilsin. */
  vurgu: string | null;
}

/** Yalnızca https ya da kök-göreli yol; başka bir şey enjeksiyon yüzeyi. */
function guvenliLogoAdresi(ham: string): string | null {
  const metin = ham.trim();
  if (!metin) return null;
  if (metin.startsWith('/') && !metin.startsWith('//')) return metin;
  try {
    return new URL(metin).protocol === 'https:' ? metin : null;
  } catch {
    return null;
  }
}

/**
 * Renk `#rrggbb` biçiminde olmalı.
 *
 * Serbest bırakmak, değerin doğrudan CSS'e yazıldığı için stil
 * enjeksiyonuna açık kapı bırakırdı (`red; background:url(...)`).
 */
function guvenliRenk(ham: string): string | null {
  const metin = ham.trim();
  return /^#[0-9a-fA-F]{6}$/.test(metin) ? metin : null;
}

export function markaOku(): Marka {
  return {
    ad: String(process.env.AFF_PANEL_ADI || 'Bugs Affiliate').trim() || 'Bugs Affiliate',
    logoUrl: guvenliLogoAdresi(String(process.env.AFF_LOGO_URL || '')),
    vurgu: guvenliRenk(String(process.env.AFF_VURGU_RENGI || '')),
  };
}

export async function markaRotalari(app: FastifyInstance): Promise<void> {
  // Oturum GEREKMIYOR: landing sayfasi da bu bilgiyi kullaniyor ve
  // icinde sir yok.
  app.get('/marka', async () => markaOku());
}
