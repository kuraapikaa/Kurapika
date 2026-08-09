import { createHash } from 'crypto';
import { CerezKavanozu } from './cerezKavanozu.js';
import { totpUret } from '../lib/totp.js';
import {
  AdaptorHatasi,
  type AdaptorDurumu,
  type AdaptorTanimi,
  type BackofficeAdaptoru,
  type HamOlcum,
  type HamOrtak,
  type HamOyuncuGunu,
  type OyuncuBagi,
} from './tur.js';

/**
 * LYNON ADAPTÖRÜ.
 *
 * Lynon'a ÜÇÜNCÜ TARAF olarak bağlanıyoruz: panel, backoffice'e kendi
 * kullanıcısıyla giriş yapıp raporlarını okuyor. Lynon'un third-party
 * affiliate ekranına kaydolmak GEREKMİYOR.
 *
 * ── Bu yolun bilinen sınırı ──
 *
 * Rapor TOPLAM düzeyinde veri veriyor. Kayıt anı, ilk yatırım anı ve
 * tıklama→dönüşüm ilişkisi olay bazında gelmiyor. Bu yüzden `ftdSayisi`
 * `null` dönüyor — "sıfır" demek yanlış olurdu, doğrusu "bu yoldan
 * ölçülemiyor". Panel bu farkı gösteriyor; olmayan veriyi varmış gibi
 * sunmak komisyon hesabını sessizce bozardı.
 *
 * ── Saat dilimi ──
 *
 * `sl-timezone` başlığı gönderilmezse Lynon tarih-only parametreleri
 * UTC sayıyor ve gün Türkiye saatiyle 03:00'te başlıyor. Aynı gün için
 * arayüz ile panelin rakamları tutmuyor; fark tam olarak 00:00–03:00
 * arasındaki işlemler. Ölçülmüş bir hata, tahmin değil.
 */

const OTURUM_TTL_MS = 15 * 60 * 1000;
const ZAMAN_ASIMI_MS = Number(process.env.LYNON_TIMEOUT_MS) || 30_000;

/** Lynon `getTimezoneOffset()` işaret kuralını kullanıyor: +03:00 → -3. */
const ISTANBUL_SL_TIMEZONE = -3;

const TARAYICI_KIMLIGI =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

interface LynonAyari {
  backofficeUrl: string;
  idUrl: string;
  siteId: string;
  kullanici: string;
  parola: string;
  otpSecret: string;
  paraBirimi: string;
  raporId: number;
  odemeRaporId: number;
  slTimezone: number;
}

function ayariCoz(ham: Record<string, string>): LynonAyari {
  const url = (deger: string, alan: string): string => {
    const metin = String(deger ?? '').trim().replace(/\/$/, '');
    if (!metin) throw new AdaptorHatasi(`${alan} zorunlu.`);
    try {
      const cozulen = new URL(metin);
      if (cozulen.protocol !== 'https:') throw new Error('https');
    } catch {
      throw new AdaptorHatasi(`${alan} geçerli bir https adresi olmalı.`);
    }
    return metin;
  };

  return {
    backofficeUrl: url(ham.backofficeUrl, 'Backoffice adresi'),
    idUrl: url(ham.idUrl, 'Kimlik sunucusu adresi'),
    siteId: String(ham.siteId ?? '').trim(),
    kullanici: String(ham.kullanici ?? '').trim(),
    parola: String(ham.parola ?? ''),
    otpSecret: String(ham.otpSecret ?? '').trim(),
    paraBirimi: String(ham.paraBirimi ?? 'TRY').trim().toUpperCase() || 'TRY',
    raporId: Number(ham.raporId) || 1841,
    odemeRaporId: Number(ham.odemeRaporId) || 1842,
    slTimezone: Number.isFinite(Number(ham.slTimezone)) && String(ham.slTimezone ?? '').trim()
      ? Number(ham.slTimezone)
      : ISTANBUL_SL_TIMEZONE,
  };
}

const kayitOku = (deger: unknown): Record<string, unknown> =>
  deger && typeof deger === 'object' && !Array.isArray(deger) ? (deger as Record<string, unknown>) : {};

function jsonCoz(metin: string): unknown {
  const kirp = metin.trim();
  if (!kirp) return {};
  try {
    return JSON.parse(kirp);
  } catch {
    return kirp;
  }
}

/** Türkiye günü sınırlarını ISO ana çevirir; rapor tam an bekliyor. */
const gunBasi = (gun: string) => new Date(`${gun}T00:00:00.000+03:00`).toISOString();
const gunSonu = (gun: string) => new Date(`${gun}T23:59:59.999+03:00`).toISOString();

/** Rapor satırlarında tutar sütunu adı sürüme göre değişiyor; sırayla denenir. */
function tutarSec(satir: Record<string, unknown>, adaylar: string[], varsayilan = 0): number {
  for (const ad of adaylar) {
    const deger = satir[ad];
    if (deger !== undefined && deger !== null && deger !== '') {
      const n = Number(String(deger).replace(/\s/g, '').replace(/,/g, '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return varsayilan;
}

function ilkDolu(...degerler: unknown[]): string {
  for (const deger of degerler) {
    const metin = String(deger ?? '').trim();
    if (metin) return metin;
  }
  return '';
}

class LynonAdaptoru implements BackofficeAdaptoru {
  readonly tanimAdi = 'lynon';
  private readonly ayar: LynonAyari;
  private kavanoz: CerezKavanozu | null = null;
  private girisAni = 0;
  private girisSozu: Promise<CerezKavanozu> | null = null;

  constructor(ham: Record<string, string>) {
    this.ayar = ayariCoz(ham);
  }

  private ortakBasliklar(url: string): Record<string, string> {
    const koken = new URL(url).origin;
    return {
      Accept: 'application/json, text/plain, */*',
      Origin: koken,
      Referer: `${koken}/`,
      'sl-id': this.ayar.siteId,
      'sl-timezone': String(this.ayar.slTimezone),
      'User-Agent': TARAYICI_KIMLIGI,
    };
  }

  private async jsonGonder(
    url: string,
    govde: Record<string, unknown>,
    kavanoz: CerezKavanozu,
  ): Promise<{ durum: number; tamam: boolean; veri: unknown; sunucuAniMs?: number }> {
    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
    try {
      const yanit = await fetch(url, {
        method: 'POST',
        signal: kontrol.signal,
        redirect: 'manual',
        headers: {
          ...this.ortakBasliklar(url),
          'Content-Type': 'application/json',
          Cookie: kavanoz.baslik(url),
        },
        body: JSON.stringify(govde),
      });
      kavanoz.yanittanAl(yanit.headers, url);
      const sunucuAni = Date.parse(yanit.headers.get('date') ?? '');
      return {
        durum: yanit.status,
        tamam: yanit.ok,
        veri: jsonCoz(await yanit.text()),
        sunucuAniMs: Number.isFinite(sunucuAni) ? sunucuAni : undefined,
      };
    } finally {
      clearTimeout(zamanlayici);
    }
  }

  /**
   * Giriş akışını yürütür.
   *
   * `girisSozu` ile eşzamanlı çağrılar TEK bir girişte birleşiyor.
   * Olmasaydı senkron turu başlarken beş istek beş ayrı giriş açardı;
   * Lynon bunu şüpheli davranış sayıp hesabı kilitleyebilir.
   */
  private async oturumAc(): Promise<CerezKavanozu> {
    if (this.kavanoz && Date.now() - this.girisAni < OTURUM_TTL_MS) return this.kavanoz;
    if (this.girisSozu) return this.girisSozu;

    this.girisSozu = this.girisYap().finally(() => {
      this.girisSozu = null;
    });
    return this.girisSozu;
  }

  private async girisYap(): Promise<CerezKavanozu> {
    if (!this.ayar.kullanici || !this.ayar.parola) {
      throw new AdaptorHatasi('Lynon kullanıcı adı ve parolası girilmeli.', 401);
    }

    const kavanoz = new CerezKavanozu();
    const donusUrl = await this.donusUrlBul(kavanoz);
    // Cihaz parmak izi SABIT olmali: her turda degisen bir deger, Lynon
    // tarafinda "yeni cihaz" olarak gorunup her seferinde 2FA tetikler.
    const parmakIzi = createHash('md5')
      .update(`${this.ayar.kullanici}:${this.ayar.siteId}:${this.ayar.backofficeUrl}`)
      .digest('hex');

    const kimlik = await this.jsonGonder(`${this.ayar.idUrl}/api/v1/twofa/credentials`, {
      username: this.ayar.kullanici,
      password: this.ayar.parola,
      returnurl: donusUrl,
      deviceFingerprint: parmakIzi,
    }, kavanoz);

    if (kimlik.tamam && kavanoz.sayi > 0) {
      await this.yonlendirmeyiTamamla(donusUrl, kavanoz);
      this.kavanoz = kavanoz;
      this.girisAni = Date.now();
      return kavanoz;
    }

    // 451 = "2FA gerekli". Diger hata kodlari gercek hata.
    if (!kimlik.tamam && kimlik.durum !== 451) {
      const kayit = kayitOku(kimlik.veri);
      throw new AdaptorHatasi(
        String(kayit.message || kayit.error || `Lynon giriş hatası (${kimlik.durum})`),
        kimlik.durum === 401 ? 401 : 502,
      );
    }

    const meydanOkuma = String(kayitOku(kimlik.veri).token ?? '').trim();
    if (!meydanOkuma) throw new AdaptorHatasi('Lynon 2FA anahtarı dönmedi.', 502);
    if (!this.ayar.otpSecret) throw new AdaptorHatasi('Lynon 2FA istiyor; TOTP secret girilmeli.', 401);

    // Kod, LYNON'un saatine gore uretiliyor: sunucumuzun saati kaymissa
    // kendi saatimizle uretilen kod gecersiz olur ve sebep gorunmez.
    const otp = await this.jsonGonder(`${this.ayar.idUrl}/api/v1/twofa/otp`, {
      token: meydanOkuma,
      otp: totpUret(this.ayar.otpSecret, kimlik.sunucuAniMs ?? Date.now()),
      trustDevice: true,
    }, kavanoz);

    if (!otp.tamam) {
      const kayit = kayitOku(otp.veri);
      throw new AdaptorHatasi(String(kayit.message || kayit.error || `Lynon OTP hatası (${otp.durum})`), 401);
    }

    await this.yonlendirmeyiTamamla(donusUrl, kavanoz);
    this.kavanoz = kavanoz;
    this.girisAni = Date.now();
    return kavanoz;
  }

  /**
   * Yönlendirme zincirlerinin (`donusUrlBul`, `yonlendirmeyiTamamla`) ortak
   * GET adımı -- ikisi de zaman aşımı OLMADAN `fetch` çağırıyordu.
   * `jsonGonder`/`istek`in aksine burada `AbortController` yoktu: Lynon
   * bağlantıyı kabul edip hiç yanıt vermezse (sessiz düşen paket, IP
   * engeli) `await fetch(...)` SONSUZA KADAR asılı kalıyor -- ne hata ne
   * zaman aşımı. Bu, oturum açan HER Lynon çağrısını (toplu atama dahil)
   * geri dönüşsüz kilitleyebiliyordu; arayüzde "İşleniyor…" hiç bitmiyordu.
   */
  private async yonlendirmeGetIste(url: string, kavanoz: CerezKavanozu): Promise<Response> {
    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
    try {
      return await fetch(url, {
        method: 'GET',
        signal: kontrol.signal,
        redirect: 'manual',
        headers: { ...this.ortakBasliklar(url), Cookie: kavanoz.baslik(url) },
      });
    } finally {
      clearTimeout(zamanlayici);
    }
  }

  /**
   * OIDC `response_mode=form_post` sayfasini ayikla.
   *
   * Kimlik sunucusu, giris tamamlaninca HTTP 3xx DEGIL, kendini otomatik
   * POST eden bir HTML sayfasi donuyor (tarayicida JS calisip formu
   * gonderiyor). Bizim yonlendirme takipcimiz yalnizca 3xx anliyordu;
   * bu son adimi hic gormeden "bitti" saniyordu -- backoffice'in ASIL
   * yetkilendirme cerezi (.AspNetCore.Cookies) tam bu adimda, formun
   * gittigi ucun yanitinda geliyor. Form bulunamazsa `null` -- gercekten
   * son sayfaya varilmis demektir.
   */
  private formuAyikla(html: string, temelUrl: string): { url: string; govde: URLSearchParams } | null {
    const formEsleme = /<form\b[^>]*\baction=["']([^"']*)["'][^>]*>([\s\S]*?)<\/form>/i.exec(html);
    if (!formEsleme) return null;

    const govde = new URLSearchParams();
    const girdiDeseni = /<input\b[^>]*>/gi;
    let girdi: RegExpExecArray | null;
    while ((girdi = girdiDeseni.exec(formEsleme[2])) !== null) {
      const etiket = girdi[0];
      const ad = /\bname=["']([^"']*)["']/i.exec(etiket)?.[1];
      if (!ad) continue;
      const deger = /\bvalue=["']([^"']*)["']/i.exec(etiket)?.[1] ?? '';
      govde.set(ad, deger.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    }

    return { url: new URL(formEsleme[1], temelUrl).toString(), govde };
  }

  /** Form otomatik gonderimini TAMAMLAR; sonuc yanitini dondurur. */
  private async formPostuGonder(hedefUrl: string, govde: URLSearchParams, kavanoz: CerezKavanozu): Promise<Response> {
    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
    try {
      const yanit = await fetch(hedefUrl, {
        method: 'POST',
        signal: kontrol.signal,
        redirect: 'manual',
        headers: {
          ...this.ortakBasliklar(hedefUrl),
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: kavanoz.baslik(hedefUrl),
        },
        body: govde.toString(),
      });
      return yanit;
    } finally {
      clearTimeout(zamanlayici);
    }
  }

  /** Backoffice, giriş sonrası nereye dönüleceğini yönlendirmede söylüyor. */
  private async donusUrlBul(kavanoz: CerezKavanozu): Promise<string> {
    let mevcut = this.ayar.backofficeUrl;
    for (let i = 0; i < 8; i += 1) {
      const yanit = await this.yonlendirmeGetIste(mevcut, kavanoz);
      kavanoz.yanittanAl(yanit.headers, mevcut);
      const konum = yanit.headers.get('location');
      if (!konum) break;
      const sonraki = new URL(konum, mevcut).toString();
      const donus = new URL(sonraki).searchParams.get('ReturnUrl');
      if (donus) return donus;
      mevcut = sonraki;
    }
    return this.ayar.backofficeUrl;
  }

  /**
   * Giriş sonrası yönlendirme zinciri; oturum çerezi bu zincirin sonunda
   * düşüyor.
   *
   * ── HTTP yönlendirme YETMİYOR ──
   *
   * Kimlik sunucusu zincirin son adımını 3xx DEĞİL, kendini otomatik POST
   * eden bir HTML sayfasıyla (`response_mode=form_post`) tamamlıyor.
   * Tarayıcıda bunu JS yapıyor; biz elle taklit ediyoruz — aksi halde
   * backoffice'in ASIL yetkilendirme çerezi (`.AspNetCore.Cookies`) hiç
   * gelmiyor, oturum "açık" görünüyor ama her korumalı uç 401 dönüyor.
   */
  private async yonlendirmeyiTamamla(donusUrl: string, kavanoz: CerezKavanozu): Promise<void> {
    if (!donusUrl) return;
    let mevcut = donusUrl.startsWith('http')
      ? donusUrl
      : `${this.ayar.idUrl}/${donusUrl.replace(/^\//, '')}`;

    for (let i = 0; i < 8; i += 1) {
      const yanit = await this.yonlendirmeGetIste(mevcut, kavanoz);
      kavanoz.yanittanAl(yanit.headers, mevcut);
      const konum = yanit.headers.get('location');

      if (konum && yanit.status >= 300 && yanit.status < 400) {
        mevcut = new URL(konum, mevcut).toString();
        continue;
      }

      const turAlan = yanit.headers.get('content-type') ?? '';
      if (yanit.status < 300 && turAlan.includes('html')) {
        const form = this.formuAyikla(await yanit.text(), mevcut);
        if (form) {
          const formYaniti = await this.formPostuGonder(form.url, form.govde, kavanoz);
          kavanoz.yanittanAl(formYaniti.headers, form.url);
          const formKonum = formYaniti.headers.get('location');
          if (formKonum && formYaniti.status >= 300 && formYaniti.status < 400) {
            mevcut = new URL(formKonum, form.url).toString();
            continue;
          }
        }
      }
      return;
    }
  }

  private async istek<T = unknown>(
    yol: string,
    secenekler: {
      metod?: 'GET' | 'POST' | 'PUT';
      sorgu?: Record<string, string | number | undefined>;
      govde?: Record<string, unknown>;
      yenidenDene?: boolean;
    } = {},
  ): Promise<T> {
    const kavanoz = await this.oturumAc();
    const metod = secenekler.metod ?? (secenekler.govde ? 'POST' : 'GET');
    const url = new URL(`${this.ayar.backofficeUrl}/${yol.replace(/^\//, '')}`);
    for (const [anahtar, deger] of Object.entries(secenekler.sorgu ?? {})) {
      if (deger === undefined || deger === '') continue;
      url.searchParams.set(anahtar, String(deger));
    }

    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
    try {
      const yanit = await fetch(url.toString(), {
        method: metod,
        signal: kontrol.signal,
        redirect: 'manual',
        headers: {
          ...this.ortakBasliklar(this.ayar.backofficeUrl),
          ...(metod === 'GET' ? {} : { 'Content-Type': 'application/json' }),
          Cookie: kavanoz.baslik(url.toString()),
        },
        body: metod === 'GET' ? undefined : JSON.stringify(secenekler.govde ?? {}),
      });
      kavanoz.yanittanAl(yanit.headers, url.toString());
      const veri = jsonCoz(await yanit.text());

      // Oturum dustuyse (401/403 ya da giris sayfasina yonlendirme) BIR KEZ
      // yeniden giris denenir. Sinirsiz denemek, gercekten yetkisiz bir
      // hesapta sonsuz doanguye girerdi.
      const oturumDustu = yanit.status === 401 || yanit.status === 403 || (yanit.status >= 300 && yanit.status < 400);
      if (oturumDustu && secenekler.yenidenDene !== false) {
        this.kavanoz = null;
        this.girisAni = 0;
        return this.istek<T>(yol, { ...secenekler, yenidenDene: false });
      }

      if (!yanit.ok) {
        const kayit = kayitOku(veri);
        throw new AdaptorHatasi(
          String(kayit.message || kayit.error || kayit.AlertMessage || `Lynon API ${yanit.status}`),
          502,
        );
      }
      return veri as T;
    } finally {
      clearTimeout(zamanlayici);
    }
  }

  async dogrula(): Promise<AdaptorDurumu> {
    try {
      const kavanoz = await this.oturumAc();
      return {
        baglandi: true,
        mesaj: 'Lynon oturumu açıldı.',
        ayrinti: {
          siteId: this.ayar.siteId,
          cerezSayisi: kavanoz.sayi,
          // Cerez ADLARI teshis icin yeterli; DEGERLERI oturum anahtari,
          // panele donmemeli.
          cerezAdlari: kavanoz.adlar(),
          slTimezone: this.ayar.slTimezone,
        },
      };
    } catch (hata) {
      return { baglandi: false, mesaj: hata instanceof Error ? hata.message : String(hata) };
    }
  }

  /** Oyuncu raporunun HAM satırlarını getirir; `gunuCek` ve `oyuncuGunuCek` bunu paylaşır. */
  private async raporSatirlariniGetir(gun: string): Promise<Array<Record<string, unknown>>> {
    const yanit = await this.istek<Record<string, unknown>>(
      `/api/report/api/v1.0/reportData/summarized/${this.ayar.raporId}`,
      {
        sorgu: {
          startDate: gunBasi(gun),
          endDate: gunSonu(gun),
          'tz-id': '13',
          currency: this.ayar.paraBirimi,
        },
      },
    );

    const veri = kayitOku(yanit);
    const ham = veri.reports ?? veri.Reports ?? veri.Result ?? veri.Objects;
    return Array.isArray(ham) ? (ham as Array<Record<string, unknown>>) : [];
  }

  /**
   * Bir günün ortak bazlı ölçümleri.
   *
   * Rapor OYUNCU satırı döndürüyor; BTag'e göre grupluyoruz. Oyuncu
   * sayısı `Set` ile sayılıyor: aynı oyuncu birden çok satırda
   * görünebiliyor ve satır saymak sayıyı şişirirdi.
   */
  async gunuCek(gun: string): Promise<HamOlcum[]> {
    const satirlar = await this.raporSatirlariniGetir(gun);

    const gruplar = new Map<string, {
      oyuncular: Set<string>;
      aktifler: Set<string>;
      yatiranlar: Set<string>;
      yatirim: number;
      cekim: number;
      ggr: number;
    }>();

    for (const [indeks, satir] of satirlar.entries()) {
      const ortakAnahtari = ilkDolu(satir.BTag, satir['Affiliate Id'], satir['Affiliate ID']);
      // BTag'siz satir = organik trafik. Ortak olcumune yazmak, hicbir
      // ortagin getirmedigi oyuncularin gelirini birine yazmak olurdu.
      if (!ortakAnahtari) continue;

      const oyuncuId = ilkDolu(satir['Player ID'], satir.PlayerId, satir['Player Login'], satir.Login) || `satir-${indeks}`;
      const yatirim = tutarSec(satir, [
        'TOTAL DEPOSITS AMOUNT FILTERED (TRY)', 'TOTAL DEPOSITS AMOUNT (TRY)', 'TOTAL DEPOSITS AMOUNT',
      ]);
      const cekim = tutarSec(satir, [
        'TOTAL WITHDRAWALS AMOUNT FILTERED (TRY)', 'TOTAL WITHDRAWALS AMOUNT (TRY)', 'TOTAL WITHDRAWALS AMOUNT',
      ]);
      const bahis = tutarSec(satir, ['TOTAL BET AMOUNT FILTERED (TRY)', 'TOTAL BET AMOUNT (TRY)', 'TOTAL BET AMOUNT']);
      const kazanc = tutarSec(satir, ['TOTAL WIN AMOUNT FILTERED (TRY)', 'TOTAL WIN AMOUNT (TRY)', 'TOTAL WIN AMOUNT']);
      const ggr = tutarSec(satir, ['GGR FILTERED (TRY)', 'GGR (TRY)', 'GGR'], bahis - kazanc);

      const grup = gruplar.get(ortakAnahtari) ?? {
        oyuncular: new Set<string>(), aktifler: new Set<string>(), yatiranlar: new Set<string>(),
        yatirim: 0, cekim: 0, ggr: 0,
      };
      grup.oyuncular.add(oyuncuId);
      if (yatirim || cekim || bahis || kazanc || ggr) grup.aktifler.add(oyuncuId);
      // Ilk yatirim TURETMESI icin gerekli: kim o gun para yatirdi.
      // Rapor "ilk yatirim" alani vermiyor ama oyuncu bazinda satir
      // verdigi icin bilgi burada.
      if (yatirim > 0) grup.yatiranlar.add(oyuncuId);
      grup.yatirim += yatirim;
      grup.cekim += cekim;
      grup.ggr += ggr;
      gruplar.set(ortakAnahtari, grup);
    }

    return [...gruplar.entries()].map(([ortakAnahtari, g]) => ({
      gun,
      ortakAnahtari,
      oyuncuSayisi: g.oyuncular.size,
      aktifOyuncuSayisi: g.aktifler.size,
      yatirim: g.yatirim,
      cekim: g.cekim,
      ggr: g.ggr,
      // Adaptor FTD'yi BILMIYOR; cekirdek `yatiranOyuncular`dan turetiyor.
      ftdSayisi: null,
      yatiranOyuncular: [...g.yatiranlar],
    }));
  }

  /**
   * Bir günün OYUNCU bazlı ham verisi -- `gunuCek`in aksine BTag'e HİÇ
   * bakmaz, filtrelemez. Aynı oyuncu birden çok satırda görünebiliyor;
   * bu yüzden oyuncu kimliğine göre toplanıyor.
   */
  async oyuncuGunuCek(gun: string): Promise<HamOyuncuGunu[]> {
    const satirlar = await this.raporSatirlariniGetir(gun);

    const gruplar = new Map<string, { yatirim: number; cekim: number; bahis: number; kazanc: number }>();
    for (const [indeks, satir] of satirlar.entries()) {
      const oyuncuId = ilkDolu(satir['Player ID'], satir.PlayerId, satir['Player Login'], satir.Login) || `satir-${indeks}`;
      const yatirim = tutarSec(satir, [
        'TOTAL DEPOSITS AMOUNT FILTERED (TRY)', 'TOTAL DEPOSITS AMOUNT (TRY)', 'TOTAL DEPOSITS AMOUNT',
      ]);
      const cekim = tutarSec(satir, [
        'TOTAL WITHDRAWALS AMOUNT FILTERED (TRY)', 'TOTAL WITHDRAWALS AMOUNT (TRY)', 'TOTAL WITHDRAWALS AMOUNT',
      ]);
      const bahis = tutarSec(satir, ['TOTAL BET AMOUNT FILTERED (TRY)', 'TOTAL BET AMOUNT (TRY)', 'TOTAL BET AMOUNT']);
      const kazanc = tutarSec(satir, ['TOTAL WIN AMOUNT FILTERED (TRY)', 'TOTAL WIN AMOUNT (TRY)', 'TOTAL WIN AMOUNT']);

      const grup = gruplar.get(oyuncuId) ?? { yatirim: 0, cekim: 0, bahis: 0, kazanc: 0 };
      grup.yatirim += yatirim;
      grup.cekim += cekim;
      grup.bahis += bahis;
      grup.kazanc += kazanc;
      gruplar.set(oyuncuId, grup);
    }

    return [...gruplar.entries()].map(([oyuncuId, g]) => ({ oyuncuId, ...g }));
  }

  /**
   * Sitenin ödeme yöntemleri.
   *
   * Kaynak, mutabakatın da kullandığı entegrasyon/ödeme raporu:
   * satırlarda `Integration Name` ve `Payment Name` geliyor. Ayrı bir
   * "ödeme yöntemleri" ucu aramak yerine bunu kullanmak bilinçli —
   * rapor, gerçekten PARA GEÇMİŞ yöntemleri veriyor. Tanımlı ama hiç
   * kullanılmamış bir yöntemi listeye koymak, ortağa seçtirip ödeme
   * gününde "bu yöntem çalışmıyor" demek olurdu.
   *
   * Pencere son 90 gün: daha kısası mevsimlik yöntemleri kaçırır,
   * daha uzunu kapanmış yöntemleri diriltir.
   */
  async odemeYontemleri(): Promise<string[]> {
    const bugun = new Date();
    const baslangic = new Date(bugun.getTime() - 90 * 24 * 60 * 60 * 1000);
    const gun = (d: Date) => d.toISOString().slice(0, 10);

    const yanit = await this.istek<Record<string, unknown>>(
      `/api/report/api/v1.0/reportData/summarized/${this.ayar.odemeRaporId}`,
      {
        sorgu: {
          startDate: gunBasi(gun(baslangic)),
          endDate: gunSonu(gun(bugun)),
          'tz-id': '13',
          currency: this.ayar.paraBirimi,
        },
      },
    );

    const veri = kayitOku(yanit);
    const ham = veri.reports ?? veri.Reports ?? veri.Result ?? veri.Objects;
    const satirlar = Array.isArray(ham) ? (ham as Array<Record<string, unknown>>) : [];

    const yontemler = new Set<string>();
    for (const satir of satirlar) {
      const yontem = ilkDolu(satir['Payment Name'], satir.PaymentName, satir.method, satir.paymentType);
      if (!yontem) continue;
      const entegrasyon = ilkDolu(satir['Integration Name'], satir.IntegrationName, satir.integration);
      // Mutabakattaki anahtarla AYNI bicim: "Entegrasyon · Yontem".
      // Farkli bicim kullanmak, ayni yontemin iki yerde iki ad tasimasi
      // ve eslestirmenin elle yapilmasi demek olurdu.
      yontemler.add(entegrasyon ? `${entegrasyon} · ${yontem}` : yontem);
    }
    return [...yontemler].sort((a, b) => a.localeCompare(b, 'tr'));
  }

  async ortaklariListele(): Promise<HamOrtak[]> {
    const yanit = await this.istek<unknown>('/api/partner/api/v1.0/affiliates');
    const veri = kayitOku(yanit);
    const ham = Array.isArray(yanit) ? yanit : (veri.Data ?? veri.data ?? veri.Objects);
    const satirlar = Array.isArray(ham) ? (ham as Array<Record<string, unknown>>) : [];

    return satirlar
      .map((satir) => ({
        ortakAnahtari: ilkDolu(satir.bTag, satir.BTag, satir.trackingCode, satir.id),
        ad: ilkDolu(satir.name, satir.affiliateName, satir.title) || null,
        eposta: ilkDolu(satir.email) || null,
        durum: ilkDolu(satir.status, satir.state) || null,
      }))
      .filter((o) => o.ortakAnahtari);
  }

  /**
   * Bir oyuncuyu ortağa bağlar.
   *
   * Geriye dönük atıf için: oyuncu izleme linki olmadan kaydolduysa
   * (destek üzerinden, elle) ortağa bağlanması gerekiyor. Lynon bunu
   * ayrı bir uçla yapıyor.
   */
  async oyuncuyuBagla(girdi: OyuncuBagi): Promise<{ basarili: boolean; mesaj: string }> {
    const oyuncuId = String(girdi.oyuncuId ?? '').trim();
    if (!oyuncuId) throw new AdaptorHatasi('oyuncuId zorunlu.');
    if (!girdi.ortakAnahtari) throw new AdaptorHatasi('ortakAnahtari zorunlu.');

    const govde: Record<string, unknown> = { bTag: girdi.ortakAnahtari };
    // Bos alanlari GONDERMIYORUZ: Lynon bos string'i "alani temizle"
    // olarak yorumlayip mevcut degeri silebiliyor.
    for (const [anahtar, deger] of Object.entries(girdi.ek ?? {})) {
      const metin = String(deger ?? '').trim();
      if (metin) govde[anahtar] = metin;
    }

    await this.istek(
      `/api/affiliate/api/v1.0/affiliatePlayers/${encodeURIComponent(this.ayar.siteId)}/${encodeURIComponent(oyuncuId)}/register`,
      { metod: 'PUT', govde },
    );
    return { basarili: true, mesaj: `Oyuncu ${oyuncuId}, ${girdi.ortakAnahtari} ortağına bağlandı.` };
  }

  /**
   * Kullanıcı adından oyuncu kimliği bulur.
   *
   * SADECE TAM EŞLEŞME kabul edilir; Lynon araması bulanık ("test"
   * sorgusu "test777" hesabını da getirebilir). Site kimliği ayrıca
   * doğrulanıyor: farklı bir Lynon sitesindeki aynı kullanıcı adı bu
   * tenant'ın oyuncusu SAYILMAZ.
   */
  async oyuncuAra(kullaniciAdi: string): Promise<{ oyuncuId: string; kullaniciAdi: string } | null> {
    const temiz = String(kullaniciAdi ?? '').trim();
    if (!temiz) return null;

    const yanit = await this.istek<unknown>('/api/user/api/v1.0/userBackOffice', {
      sorgu: { siteId: this.ayar.siteId, query: temiz, page: 1, countPerPage: 50 },
    });
    const veri = kayitOku(yanit);
    const ham = Array.isArray(yanit) ? yanit : (veri.Data ?? veri.data ?? veri.Objects);
    const satirlar = Array.isArray(ham) ? (ham as Array<Record<string, unknown>>) : [];

    const hedef = temiz.toLocaleLowerCase('tr-TR');
    const eslesen = satirlar.find((satir) => {
      const girisAdi = ilkDolu(satir.userName, satir.username, satir.login, satir.Login).toLocaleLowerCase('tr-TR');
      const siteId = ilkDolu(satir.siteId, satir.SiteId);
      return girisAdi === hedef && siteId === String(this.ayar.siteId);
    });
    if (!eslesen) return null;

    const oyuncuId = ilkDolu(eslesen.userId, eslesen.id, eslesen.playerId, eslesen.Id);
    if (!oyuncuId) return null;
    return { oyuncuId, kullaniciAdi: temiz };
  }
}

export const LYNON_TANIMI: AdaptorTanimi = {
  ad: 'lynon',
  etiket: 'Lynon Backoffice',
  aciklama:
    'Panel kullanıcısıyla giriş yapıp Lynon raporlarını okur. Lynon third-party affiliate kaydı gerekmez. ' +
    'Veri toplam düzeyinde geldiği için ilk yatırım (FTD) sayısı bu yoldan ölçülemez.',
  yetenekler: ['olcum-cekme', 'ortak-listesi', 'oyuncu-baglama', 'odeme-yontemleri', 'gecmis-doldurma'],
  alanlar: [
    { ad: 'backofficeUrl', etiket: 'Backoffice adresi', tur: 'metin', zorunlu: true, sir: false, ipucu: 'https://backoffice.ornek.com' },
    { ad: 'idUrl', etiket: 'Kimlik sunucusu', tur: 'metin', zorunlu: true, sir: false, ipucu: 'https://id.ornek.com' },
    { ad: 'siteId', etiket: 'Site kimliği (sl-id)', tur: 'metin', zorunlu: true, sir: false },
    { ad: 'kullanici', etiket: 'Panel kullanıcı adı', tur: 'metin', zorunlu: true, sir: false },
    { ad: 'parola', etiket: 'Panel parolası', tur: 'parola', zorunlu: true, sir: true },
    {
      ad: 'otpSecret',
      etiket: 'TOTP secret',
      tur: 'parola',
      zorunlu: false,
      sir: true,
      ipucu: 'Base32 secret ya da otpauth:// bağlantısı. Hesapta 2FA açıksa zorunlu.',
    },
    { ad: 'paraBirimi', etiket: 'Para birimi', tur: 'metin', zorunlu: false, sir: false, varsayilan: 'TRY' },
    {
      ad: 'raporId',
      etiket: 'Oyuncu raporu kimliği',
      tur: 'sayi',
      zorunlu: false,
      sir: false,
      varsayilan: '1841',
      ipucu: 'Rapor kimlikleri siteye özel. Backoffice > Raporlar adresinden okunur.',
    },
    {
      ad: 'odemeRaporId',
      etiket: 'Ödeme raporu kimliği',
      tur: 'sayi',
      zorunlu: false,
      sir: false,
      varsayilan: '1842',
      ipucu: 'Entegrasyon/ödeme kırılımı raporu. Ödeme yöntemleri buradan okunuyor.',
    },
    {
      ad: 'slTimezone',
      etiket: 'sl-timezone',
      tur: 'sayi',
      zorunlu: false,
      sir: false,
      varsayilan: String(ISTANBUL_SL_TIMEZONE),
      ipucu: 'Türkiye için -3. Yanlış değer günü 3 saat kaydırır.',
    },
  ],
  olustur: (ayar) => new LynonAdaptoru(ayar),
};
