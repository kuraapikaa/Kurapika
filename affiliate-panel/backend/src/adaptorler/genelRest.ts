import {
  AdaptorHatasi,
  sayi,
  type AdaptorDurumu,
  type AdaptorTanimi,
  type BackofficeAdaptoru,
  type HamOlcum,
} from './tur.js';

/**
 * GENEL REST ADAPTÖRÜ — eşleme ile çalışan, kod yazmadan bağlanan yol.
 *
 * "Diğer backoffice'ler" için her biri ayrı bir dosya yazmak
 * gerekmiyor. Çoğu backoffice benzer bir şey yapıyor: bir tarih
 * aralığı veriyorsun, JSON satır listesi dönüyor. Değişen tek şey
 * ALAN ADLARI.
 *
 * Bu adaptör alan adlarını YAPILANDIRMADAN alıyor. Yeni bir sağlayıcı
 * eklemek dağıtım gerektirmiyor; panelden eşleme girmek yetiyor.
 *
 * ── Sınırı açık ──
 *
 * Bu yol yalnızca "GET ile JSON satır listesi" şeklindeki API'ler için
 * çalışır. Çok adımlı giriş, imzalı istek, sayfalama ya da GraphQL
 * gerektiren bir sağlayıcı için gerçek bir adaptör dosyası gerekir —
 * Lynon'un kendi adaptörünün ayrı olmasının sebebi tam olarak bu.
 * Yapılandırmayı her şeye yetecek kadar esnetmek, sonunda JSON içine
 * gömülmüş bir programlama diline dönüşürdü.
 */

const ZAMAN_ASIMI_MS = Number(process.env.GENEL_REST_TIMEOUT_MS) || 20_000;

interface GenelAyar {
  temelUrl: string;
  raporYolu: string;
  yetkiBasligi: string;
  yetkiDegeri: string;
  satirYolu: string;
  eslesme: Record<string, string>;
}

const VARSAYILAN_ESLESME: Record<string, string> = {
  ortakAnahtari: 'affiliateId',
  oyuncuSayisi: 'players',
  aktifOyuncuSayisi: 'activePlayers',
  yatirim: 'deposits',
  cekim: 'withdrawals',
  ggr: 'ggr',
  ftdSayisi: 'ftd',
};

function eslesmeCoz(ham: string): Record<string, string> {
  const metin = String(ham ?? '').trim();
  if (!metin) return { ...VARSAYILAN_ESLESME };
  let cozulen: unknown;
  try {
    cozulen = JSON.parse(metin);
  } catch {
    throw new AdaptorHatasi('Alan eşlemesi geçerli bir JSON nesnesi olmalı.');
  }
  if (!cozulen || typeof cozulen !== 'object' || Array.isArray(cozulen)) {
    throw new AdaptorHatasi('Alan eşlemesi bir JSON nesnesi olmalı.');
  }
  const cikti = { ...VARSAYILAN_ESLESME };
  for (const [anahtar, deger] of Object.entries(cozulen as Record<string, unknown>)) {
    if (anahtar in VARSAYILAN_ESLESME && String(deger ?? '').trim()) cikti[anahtar] = String(deger).trim();
  }
  return cikti;
}

function ayariCoz(ham: Record<string, string>): GenelAyar {
  const temelUrl = String(ham.temelUrl ?? '').trim().replace(/\/$/, '');
  try {
    if (new URL(temelUrl).protocol !== 'https:') throw new Error('https');
  } catch {
    throw new AdaptorHatasi('Temel adres geçerli bir https adresi olmalı.');
  }

  const raporYolu = String(ham.raporYolu ?? '').trim();
  if (!raporYolu) throw new AdaptorHatasi('Rapor yolu zorunlu.');
  if (!raporYolu.includes('{start}') || !raporYolu.includes('{end}')) {
    // Tarih yer tutuculari olmadan her tur AYNI araligi ceker ve gunluk
    // olcumlerin hepsi ayni degerle dolar. Sessizce kabul etmek, panelde
    // dogru gorunen tamamen yanlis bir gecmis uretirdi.
    throw new AdaptorHatasi('Rapor yolu {start} ve {end} yer tutucularını içermeli.');
  }

  return {
    temelUrl,
    raporYolu,
    yetkiBasligi: String(ham.yetkiBasligi ?? 'Authorization').trim() || 'Authorization',
    yetkiDegeri: String(ham.yetkiDegeri ?? '').trim(),
    satirYolu: String(ham.satirYolu ?? '').trim(),
    eslesme: eslesmeCoz(ham.eslesme ?? ''),
  };
}

/** `data.items` gibi noktalı bir yoldan diziyi çıkarır. */
function satirlariBul(veri: unknown, yol: string): Array<Record<string, unknown>> {
  let mevcut: unknown = veri;
  if (yol) {
    for (const parca of yol.split('.').map((p) => p.trim()).filter(Boolean)) {
      if (!mevcut || typeof mevcut !== 'object') return [];
      mevcut = (mevcut as Record<string, unknown>)[parca];
    }
  } else if (!Array.isArray(mevcut) && mevcut && typeof mevcut === 'object') {
    // Yol verilmediyse ilk dizi alani makul bir tahmin; yanlissa panelde
    // "0 satir" gorunur ve kullanici yolu elle girer.
    const kayit = mevcut as Record<string, unknown>;
    mevcut = Object.values(kayit).find((deger) => Array.isArray(deger)) ?? mevcut;
  }
  return Array.isArray(mevcut) ? (mevcut as Array<Record<string, unknown>>) : [];
}

class GenelRestAdaptoru implements BackofficeAdaptoru {
  readonly tanimAdi = 'genel-rest';
  private readonly ayar: GenelAyar;

  constructor(ham: Record<string, string>) {
    this.ayar = ayariCoz(ham);
  }

  private async cek(gun: string): Promise<unknown> {
    const yol = this.ayar.raporYolu.replace(/\{start\}/g, gun).replace(/\{end\}/g, gun);
    const url = `${this.ayar.temelUrl}/${yol.replace(/^\//, '')}`;
    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
    try {
      const yanit = await fetch(url, {
        signal: kontrol.signal,
        // Yonlendirme izlenmiyor: yetki basligi baska bir sunucuya
        // tasinabilirdi.
        redirect: 'manual',
        headers: {
          Accept: 'application/json',
          ...(this.ayar.yetkiDegeri ? { [this.ayar.yetkiBasligi]: this.ayar.yetkiDegeri } : {}),
        },
      });
      if (!yanit.ok) throw new AdaptorHatasi(`Rapor isteği başarısız (HTTP ${yanit.status}).`, 502);
      return await yanit.json();
    } finally {
      clearTimeout(zamanlayici);
    }
  }

  async dogrula(): Promise<AdaptorDurumu> {
    const bugun = new Date().toISOString().slice(0, 10);
    try {
      const satirlar = satirlariBul(await this.cek(bugun), this.ayar.satirYolu);
      return {
        baglandi: true,
        mesaj: `Bağlantı çalışıyor. Bugün için ${satirlar.length} satır döndü.`,
        // Ornek satirin ANAHTARLARI eslemeyi kurmak icin gerekli; degerleri
        // gondermek gercek oyuncu/ortak verisini panele tasirdi.
        ayrinti: { ornekAlanlar: satirlar.length ? Object.keys(satirlar[0]) : [] },
      };
    } catch (hata) {
      return { baglandi: false, mesaj: hata instanceof Error ? hata.message : String(hata) };
    }
  }

  async gunuCek(gun: string): Promise<HamOlcum[]> {
    const satirlar = satirlariBul(await this.cek(gun), this.ayar.satirYolu);
    const e = this.ayar.eslesme;

    return satirlar
      .map((satir): HamOlcum | null => {
        const ortakAnahtari = String(satir[e.ortakAnahtari] ?? '').trim();
        if (!ortakAnahtari) return null;
        const ftd = satir[e.ftdSayisi];
        return {
          gun,
          ortakAnahtari,
          oyuncuSayisi: sayi(satir[e.oyuncuSayisi]),
          aktifOyuncuSayisi: sayi(satir[e.aktifOyuncuSayisi]),
          yatirim: sayi(satir[e.yatirim]),
          cekim: sayi(satir[e.cekim]),
          ggr: sayi(satir[e.ggr]),
          // Alan HIC yoksa `null` (olculmedi); varsa degeri — 0 da gecerli.
          ftdSayisi: ftd === undefined || ftd === null || ftd === '' ? null : sayi(ftd),
        };
      })
      .filter((o): o is HamOlcum => o !== null);
  }
}

export const GENEL_REST_TANIMI: AdaptorTanimi = {
  ad: 'genel-rest',
  etiket: 'Genel REST (eşlemeli)',
  aciklama:
    'Tarih aralığı verildiğinde JSON satır listesi dönen herhangi bir backoffice. Alan adları panelden eşlenir, ' +
    'kod yazmak gerekmez. Çok adımlı giriş veya sayfalama gerektiren sağlayıcılar için uygun değildir.',
  yetenekler: ['olcum-cekme'],
  alanlar: [
    { ad: 'temelUrl', etiket: 'Temel adres', tur: 'metin', zorunlu: true, sir: false, ipucu: 'https://api.ornek.com' },
    {
      ad: 'raporYolu',
      etiket: 'Rapor yolu',
      tur: 'metin',
      zorunlu: true,
      sir: false,
      ipucu: '/v1/affiliates/report?from={start}&to={end}',
    },
    { ad: 'yetkiBasligi', etiket: 'Yetki başlığı', tur: 'metin', zorunlu: false, sir: false, varsayilan: 'Authorization' },
    { ad: 'yetkiDegeri', etiket: 'Yetki değeri', tur: 'parola', zorunlu: false, sir: true, ipucu: 'Bearer eyJ...' },
    {
      ad: 'satirYolu',
      etiket: 'Satır dizisinin yolu',
      tur: 'metin',
      zorunlu: false,
      sir: false,
      ipucu: 'data.items — boş bırakılırsa ilk dizi alanı kullanılır',
    },
    {
      ad: 'eslesme',
      etiket: 'Alan eşlemesi (JSON)',
      tur: 'cokSatir',
      zorunlu: false,
      sir: false,
      varsayilan: JSON.stringify(VARSAYILAN_ESLESME, null, 2),
    },
  ],
  olustur: (ayar) => new GenelRestAdaptoru(ayar),
};
