/**
 * ÇEREZ KAVANOZU.
 *
 * Lynon oturumu çerez tabanlı ve giriş akışı kimlik sunucusuyla
 * backoffice arasında birkaç yönlendirmeden geçiyor. `fetch` çerez
 * tutmadığı için kavanoz elle yönetiliyor.
 *
 * Alan ve yol eşleştirmesi RFC 6265'e göre yapılıyor — hepsini her
 * isteğe göndermek, kimlik sunucusunun çerezini backoffice'e ve
 * tersini göndermek olurdu. Ne işe yarar ne de zararsızdır: bazı
 * sunucular tanımadığı oturum çerezini görünce oturumu düşürüyor.
 */

interface Cerez {
  ad: string;
  deger: string;
  alan: string;
  yol: string;
  yalnizcaSunucu: boolean;
  guvenli: boolean;
}

function varsayilanYol(patika: string): string {
  if (!patika || !patika.startsWith('/')) return '/';
  const son = patika.lastIndexOf('/');
  return son <= 0 ? '/' : patika.slice(0, son);
}

function setCookieBasligiAyir(baslik: string | null): string[] {
  if (!baslik) return [];
  // Virgul hem ayirac hem de `Expires` icinde geciyor; yalnizca
  // ardindan `ad=` geliyorsa ayirac saymak dogru bolme veriyor.
  return baslik.split(/,(?=\s*[^;,=\s]+=)/g).map((p) => p.trim()).filter(Boolean);
}

export class CerezKavanozu {
  private readonly cerezler = new Map<string, Cerez>();

  yanittanAl(basliklar: Headers, istekUrl: string): void {
    const cokluOku = (basliklar as unknown as { getSetCookie?: () => string[] }).getSetCookie;
    const satirlar = typeof cokluOku === 'function'
      ? cokluOku.call(basliklar)
      : setCookieBasligiAyir(basliklar.get('set-cookie'));

    const url = new URL(istekUrl);
    for (const satir of satirlar) {
      const parcalar = satir.split(';').map((p) => p.trim()).filter(Boolean);
      const cift = parcalar[0];
      if (!cift) continue;
      const esittir = cift.indexOf('=');
      if (esittir <= 0) continue;

      const cerez: Cerez = {
        ad: cift.slice(0, esittir),
        deger: cift.slice(esittir + 1),
        alan: url.hostname.toLowerCase(),
        yol: varsayilanYol(url.pathname),
        yalnizcaSunucu: true,
        guvenli: false,
      };
      let silinsin = false;

      for (const oznitelik of parcalar.slice(1)) {
        const esit = oznitelik.indexOf('=');
        const anahtar = (esit >= 0 ? oznitelik.slice(0, esit) : oznitelik).trim().toLowerCase();
        const deger = (esit >= 0 ? oznitelik.slice(esit + 1) : '').trim();

        if (anahtar === 'domain' && deger) {
          cerez.alan = deger.replace(/^\./, '').toLowerCase();
          cerez.yalnizcaSunucu = false;
        } else if (anahtar === 'path' && deger.startsWith('/')) {
          cerez.yol = deger;
        } else if (anahtar === 'secure') {
          cerez.guvenli = true;
        } else if (anahtar === 'max-age' && Number(deger) <= 0) {
          silinsin = true;
        } else if (anahtar === 'expires') {
          const an = Date.parse(deger);
          if (Number.isFinite(an) && an <= Date.now()) silinsin = true;
        }
      }

      const anahtar = `${cerez.alan}\t${cerez.yol}\t${cerez.ad}`;
      if (silinsin) this.cerezler.delete(anahtar);
      else this.cerezler.set(anahtar, cerez);
    }
  }

  baslik(istekUrl: string): string {
    const url = new URL(istekUrl);
    const sunucu = url.hostname.toLowerCase();
    const yol = url.pathname || '/';
    const https = url.protocol === 'https:';

    return [...this.cerezler.values()]
      .filter((c) => {
        if (c.guvenli && !https) return false;
        const alanUyar = c.yalnizcaSunucu ? sunucu === c.alan : sunucu === c.alan || sunucu.endsWith(`.${c.alan}`);
        if (!alanUyar) return false;
        if (yol === c.yol) return true;
        if (!yol.startsWith(c.yol)) return false;
        return c.yol.endsWith('/') || yol.charAt(c.yol.length) === '/';
      })
      // Daha ozgul yol once: sunucular ayni adli cerezde ilkini alir.
      .sort((a, b) => b.yol.length - a.yol.length)
      .map((c) => `${c.ad}=${c.deger}`)
      .join('; ');
  }

  get sayi(): number {
    return this.cerezler.size;
  }

  adlar(): string[] {
    return [...new Set([...this.cerezler.values()].map((c) => c.ad))].sort();
  }
}
