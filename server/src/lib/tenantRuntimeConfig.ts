import { config } from '../config.js';
import { loadTenants } from '../repositories/tenantRepository.js';
import { bosBaglanti, loadTenantConnection, type TenantConnection } from '../repositories/tenantConnectionRepository.js';
import { currentTenantKey, safeTenantKey, varsayilanTenantKey } from './tenantContext.js';

/**
 * TENANT BAŞINA ETKİN LYNON/BACKOFFICE YAPILANDIRMASI.
 *
 * Kaynak sırası: master panelden girilen (şifreli) kayıt > ortam
 * değişkeni. Boş bırakılan her alan ENV'e düşer, bu yüzden mevcut tek
 * siteli kurulum hiçbir kayıt olmadan aynen çalışır.
 *
 * Erişim SENKRON olmak zorunda: `lynonBackofficeService` içindeki 90'dan
 * fazla çağrı `config.lynon`'u senkron okuyordu ve hepsini `await`li hale
 * getirmek bu değişikliği incelenemez yapardı. Bu yüzden kayıtlar bellekte
 * bir haritada tutulur; harita isteğin/işin BAŞINDA `ensureTenantRuntime`
 * ile doldurulur. Doldurulmamış bir tenant için ENV değerleri döner —
 * yanlış bir siteye bağlanmak yerine varsayılana düşmek güvenli taraftır.
 */

export interface LynonRuntime {
  enabled: boolean;
  backofficeBaseUrl: string;
  idBaseUrl: string;
  returnUrl: string;
  siteId: number;
  currency: string;
  username: string;
  password: string;
  otpSecret: string;
  otpToken: string;
  deviceFingerprint: string;
  trustDevice: boolean;
  otpAlgorithm: string;
  otpDigits: number;
  otpPeriodSeconds: number;
  sessionTtlMs: number;
  timeoutMs: number;
  /** `sl-timezone`; tanımsızsa çağıran ENV varsayılanını kullanır. */
  timezoneOffset: number | null;
}

export interface BackofficeRuntime {
  authToken: string;
  dashboardAuthToken: string;
}

const cache = new Map<string, TenantConnection>();
/** Aynı tenant için eşzamanlı yüklemeleri tekilleştirir. */
const yuklemeler = new Map<string, Promise<TenantConnection>>();

function metin(deger: unknown, varsayilan: string): string {
  const s = typeof deger === 'string' ? deger.trim() : '';
  return s !== '' ? s : varsayilan;
}

function sayi(deger: unknown, varsayilan: number): number {
  const n = Number(deger);
  return Number.isFinite(n) && n > 0 ? n : varsayilan;
}

/** ENV varsayılanı; kayıt yokken ve tek siteli kurulumda geçerli olan. */
function envLynon(): LynonRuntime {
  const ofset = process.env.LYNON_TIMEZONE_OFFSET?.trim();
  return {
    enabled: config.lynon.enabled,
    backofficeBaseUrl: config.lynon.backofficeBaseUrl,
    idBaseUrl: config.lynon.idBaseUrl,
    returnUrl: config.lynon.returnUrl,
    siteId: config.lynon.siteId,
    currency: config.lynon.currency,
    username: config.lynon.username,
    password: config.lynon.password,
    otpSecret: config.lynon.otpSecret,
    otpToken: config.lynon.otpToken,
    deviceFingerprint: config.lynon.deviceFingerprint,
    trustDevice: config.lynon.trustDevice,
    otpAlgorithm: config.lynon.otpAlgorithm,
    otpDigits: config.lynon.otpDigits,
    otpPeriodSeconds: config.lynon.otpPeriodSeconds,
    sessionTtlMs: config.lynon.sessionTtlMs,
    timeoutMs: config.lynon.timeoutMs,
    timezoneOffset: ofset && Number.isFinite(Number(ofset)) ? Number(ofset) : null,
  };
}

/**
 * Kayıtta gerçek bir kimlik bilgisi var mı?
 *
 * Adres veya site kimliği tek başına yetmez: giriş yapmak için kullanıcı
 * adı, parola ve TOTP sırrı gerekiyor. Bunlardan biri bile kayıtta yoksa
 * o site "kendi bağlantısı var" sayılamaz.
 */
function kendiKimligiVar(ustu: TenantConnection['lynon'] | undefined): boolean {
  return Boolean(ustu && (ustu.username || ustu.password || ustu.otpSecret || ustu.otpToken));
}

/**
 * ORTAM DEĞİŞKENİ YALNIZCA VARSAYILAN SİTENİN.
 *
 * Burada eskiden kaydı olmayan HER tenant `envLynon()`'a düşüyordu. Bu,
 * çok kiracılığın engellemesi gereken şeyi tam olarak üretiyordu: master
 * panelden yeni bir site oluşturmak — bağlantısı hiç girilmeden —
 * o siteye ANA SİTENİN Lynon kullanıcı adını, parolasını, TOTP sırrını
 * ve site kimliğini veriyordu. `isLynonConfigured()` true dönüyor, panel
 * sorunsuz açılıyor ve alt sitenin ekranında ana sitenin oyuncuları,
 * bakiyeleri ve çekim talepleri görünüyordu. Hata da vermiyordu.
 *
 * Artık ENV yalnızca varsayılan (tek siteli kurulumun) tenant'ı için
 * geçerli. Kendi kimlik bilgisi girilmemiş bir alt site
 * "yapılandırılmamış" sayılır: Lynon kapalı görünür, panel bunu söyler.
 * Yanlış siteye bağlanmaktansa hiç bağlanmamak doğru taraftır.
 */
function envDevralinabilirMi(tenantKey: string, ustu: TenantConnection['lynon'] | undefined): boolean {
  return tenantKey === varsayilanTenantKey() || kendiKimligiVar(ustu);
}

function birlestir(kayit: TenantConnection | undefined, tenantKey: string): LynonRuntime {
  const env = envLynon();
  const ustu = kayit?.lynon;

  if (!envDevralinabilirMi(tenantKey, ustu)) {
    return {
      ...env,
      enabled: false,
      username: '',
      password: '',
      otpSecret: '',
      otpToken: '',
      // Site kimliği ve adresler de düşürülür: eksik bir kayıtla ana
      // sitenin siteId'sine istek atmak, kimlik bilgisi sızmasa bile
      // yanlış siteyi sorgulamak demek.
      siteId: ustu?.siteId && Number.isFinite(Number(ustu.siteId)) ? Number(ustu.siteId) : 0,
      backofficeBaseUrl: metin(ustu?.backofficeBaseUrl, ''),
      idBaseUrl: metin(ustu?.idBaseUrl, ''),
      returnUrl: '',
    };
  }

  if (!ustu) return env;

  const backofficeBaseUrl = metin(ustu.backofficeBaseUrl, env.backofficeBaseUrl);
  return {
    enabled: typeof ustu.enabled === 'boolean' ? ustu.enabled : env.enabled,
    backofficeBaseUrl,
    idBaseUrl: metin(ustu.idBaseUrl, env.idBaseUrl),
    // returnUrl açıkça verilmediyse backoffice adresini İZLER. Aksi halde
    // alt site kendi backoffice'ine bağlanırken giriş akışı ENV'deki
    // BAŞKA bir siteye geri dönerdi.
    returnUrl: metin(ustu.returnUrl, metin(ustu.backofficeBaseUrl, '') ? `${backofficeBaseUrl}/` : env.returnUrl),
    siteId: sayi(ustu.siteId, env.siteId),
    currency: metin(ustu.currency, env.currency),
    username: metin(ustu.username, env.username),
    password: metin(ustu.password, env.password),
    otpSecret: metin(ustu.otpSecret, env.otpSecret),
    otpToken: metin(ustu.otpToken, env.otpToken),
    deviceFingerprint: metin(ustu.deviceFingerprint, env.deviceFingerprint),
    trustDevice: typeof ustu.trustDevice === 'boolean' ? ustu.trustDevice : env.trustDevice,
    otpAlgorithm: metin(ustu.otpAlgorithm, env.otpAlgorithm).toUpperCase(),
    otpDigits: sayi(ustu.otpDigits, env.otpDigits),
    otpPeriodSeconds: sayi(ustu.otpPeriodSeconds, env.otpPeriodSeconds),
    sessionTtlMs: env.sessionTtlMs,
    timeoutMs: env.timeoutMs,
    timezoneOffset: Number.isFinite(Number(ustu.timezoneOffset)) ? Number(ustu.timezoneOffset) : env.timezoneOffset,
  };
}

/** İçinde bulunulan bağlamın (veya verilen tenant'ın) etkin Lynon ayarı. */
export function lynonCfg(tenantKey?: string): LynonRuntime {
  const key = safeTenantKey(tenantKey ?? currentTenantKey());
  return birlestir(cache.get(key), key);
}

/**
 * Sitenin kendi Lynon bağlantısı girilmiş mi?
 *
 * Master panelin "bu site kurulmuş mu" sorusuna cevap verir; varsayılan
 * site için ENV yeterli sayılır.
 */
export function tenantBaglantisiKurulduMu(tenantKey?: string): boolean {
  const key = safeTenantKey(tenantKey ?? currentTenantKey());
  return envDevralinabilirMi(key, cache.get(key)?.lynon);
}

/**
 * Yalnızca tenant'ın KENDİ kaydı; ortam değişkeni karışmaz.
 *
 * `authStore` gibi ENV ile dosya arasında kendi öncelik sırası olan
 * çağıranlar, "bu tenant için açıkça bir değer girilmiş mi" sorusunu
 * ancak birleştirilmemiş kayda bakarak cevaplayabilir.
 */
export function tenantConnectionOverride(tenantKey?: string): TenantConnection | undefined {
  return cache.get(safeTenantKey(tenantKey ?? currentTenantKey()));
}

/**
 * İçinde bulunulan bağlamın etkin backoffice/dashboard token'ları.
 *
 * ENV token'ı da Lynon kimlik bilgileriyle aynı kurala tabi: yalnızca
 * varsayılan siteye düşer. BetConstruct token'ı bir siteye bağlı bir
 * yetki; alt siteye devretmek onu ana sitenin verisine sokardı.
 */
export function backofficeCfg(tenantKey?: string): BackofficeRuntime {
  const key = safeTenantKey(tenantKey ?? currentTenantKey());
  const kayit = cache.get(key);
  const devralabilir = envDevralinabilirMi(key, kayit?.lynon);
  return {
    authToken: metin(kayit?.backoffice?.authToken, devralabilir ? config.api.backofficeAuthToken : ''),
    dashboardAuthToken: metin(kayit?.backoffice?.dashboardAuthToken, devralabilir ? config.api.authToken : ''),
  };
}

/** Tenant'ın kaydını belleğe alır; bağlam kurulmadan ÖNCE beklenmelidir. */
export async function ensureTenantRuntime(tenantKey: string): Promise<void> {
  const key = safeTenantKey(tenantKey);
  if (cache.has(key)) return;

  let bekleyen = yuklemeler.get(key);
  if (!bekleyen) {
    bekleyen = loadTenantConnection(key)
      .catch(() => bosBaglanti())
      .finally(() => yuklemeler.delete(key));
    yuklemeler.set(key, bekleyen);
  }
  cache.set(key, await bekleyen);
}

/**
 * Kaydı doğrudan belleğe yazar (write-through).
 *
 * Master panel bir bağlantıyı kaydettikten sonra aynı kaydı diskten/
 * veritabanından tekrar okumak zorunda kalmasın diye var. Yazma ile
 * belleğin arasında bir an bile fark olmaması önemli: o aralıkta gelen
 * bir istek eski (ya da hiç) bağlantıyla çalışırdı.
 */
export function tenantRuntimeYaz(tenantKey: string, kayit: TenantConnection): void {
  cache.set(safeTenantKey(tenantKey), kayit);
}

/** Master panelden kayıt değişince çağrılır; sonraki okuma yeniden yükler. */
export function invalidateTenantRuntime(tenantKey?: string): void {
  if (tenantKey === undefined) {
    cache.clear();
    return;
  }
  cache.delete(safeTenantKey(tenantKey));
}

/**
 * Açılışta tüm aktif tenant'ların bağlantısını belleğe alır.
 *
 * Arka plan işleri istek bağlamı olmadan çalışıyor; ilk turda ENV'e
 * düşmemeleri için kayıtlar sunucu ayağa kalkarken okunur.
 */
export async function hydrateTenantRuntime(): Promise<number> {
  await ensureTenantRuntime(varsayilanTenantKey());
  let yuklenen = 1;
  try {
    for (const tenant of await loadTenants()) {
      if (!tenant?.id || tenant.isActive === false) continue;
      await ensureTenantRuntime(tenant.id);
      yuklenen += 1;
    }
  } catch {
    // Tenant listesi okunamadıysa varsayılan tenant yine de hazır.
  }
  return yuklenen;
}
