import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { registerGlobalErrorHandler } from './lib/errorHandler.js';
import { cerceveAtasiDirektifi, gomulebilirMi, listeyiAyristir, sabitListeyiCoz } from './lib/cerceveAtaslari.js';
import { registerRequestId } from './lib/requestId.js';
import { createRedisSessionStore } from './lib/redisClient.js';
import { resolveTenantKeyForRequest } from './lib/tenant.js';
import { runWithTenant, varsayilanTenantKey } from './lib/tenantContext.js';
import { ensureTenantRuntime } from './lib/tenantRuntimeConfig.js';

const { cors: corsConfig } = config;
const isProduction = process.env.NODE_ENV === 'production';
const sessionTtlMs = Number(process.env.SESSION_TTL_MS) || 1000 * 60 * 60 * 8;

export function parseSessionCookieSecure(gomulebilir = false): boolean | 'auto' {
  const value = String(process.env.SESSION_COOKIE_SECURE || '').trim().toLowerCase();
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  // SameSite=None çerezi Secure olmadan tarayıcı tarafından tümüyle reddedilir.
  return gomulebilir ? true : 'auto';
}

/**
 * Panel ana sitede iframe olarak gömülü çalıştığında (FRAME_ANCESTORS dolu),
 * istekler tarayıcı için "cross-site" sayılır ve SameSite=Lax çerez HİÇ
 * gönderilmez. Bu durumda /api/bonus-panel/login başarılı dönse bile sonraki
 * her istek oturumsuz kalır: çark/kazı-kazan "Önce kullanıcı adı doğrulaması
 * yapmalısınız", bonus talebi ise "Oturum süreniz dolmuş." hatası verir.
 * Gömme açıkken varsayılanı 'none' yapıyoruz; ENV ile açıkça ezilebilir.
 */
export function parseSessionSameSite(gomulebilir = false): 'lax' | 'strict' | 'none' {
  const value = String(process.env.SESSION_COOKIE_SAMESITE || '').trim().toLowerCase();
  if (value === 'strict' || value === 'lax' || value === 'none') return value;
  return gomulebilir ? 'none' : 'lax';
}

/**
 * CHIPS (Partitioned çerez).
 *
 * SameSite=None tek başına yetmiyor: Chrome üçüncü taraf çerezleri engellediğinde
 * gömülü paneldeki isteklerde `cookie` başlığı hiç gönderilmiyor ve tarayıcı
 * `Sec-Fetch-Storage-Access: none` diyor. Oturum kuruluyor ama sonraki her istek
 * 401 dönüyordu.
 *
 * `Partitioned` ile çerez üst seviye siteye göre bölümlenir; her gömen alan adı
 * (narcosbahis481.com, tacobahis334.com ...) kendi oturumunu tutar ve tarayıcı
 * üçüncü taraf engeline takılmadan gönderir. Panele doğrudan girildiğinde de
 * kendi bölümünde çalışır. `Partitioned` yalnızca Secure + SameSite=None çerezde
 * geçerlidir; koşul sağlanmazsa eklemiyoruz.
 */
export function parseSessionPartitioned(sameSite: string, secure: boolean | 'auto'): boolean {
  const value = String(process.env.SESSION_COOKIE_PARTITIONED || '').trim().toLowerCase();
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  return sameSite === 'none' && secure === true;
}

/**
 * Fastify uygulama instance'ını oluşturur ve temel pluginleri kaydeder.
 * Ana index.ts'den ayrılarak test edilebilirlik ve modülerlik sağlar.
 */
export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true, // Proxy arkasında (Railway, Cloudflare vb.) session cookie'lerinin doğru çalışması için
    // Varsayılan 1MB limiti, admin panelindeki base64 gömülü görsel yüklemelerini (ör. Ayın Oyuncusu fotoğrafı)
    // kırpıyordu; bu ayarları taşıyan /admin/games/config isteği için yeterli boşluk bırakıyoruz.
    bodyLimit: 15 * 1024 * 1024,
  });

  // ─── Güvenlik Pluginleri ──────────────────────────────────────────────────
  //
  // FRAME_ANCESTORS         : sabit izinli origin listesi
  // FRAME_ANCESTOR_PATTERNS : joker kalıplar (ör. https://narcosbahis*.com)
  //
  // Ana sitenin adresi düzenli olarak dönüyor (…484 → …485). Sabit liste her
  // dönüşte geçersiz kalıyor, tarayıcı çerçeveyi reddediyor ve panel açılmıyor;
  // elle güncelleyip yeniden dağıtmak gerekiyordu. CSP alan adının ORTASINDA
  // joker kabul etmediği için bu statik olarak yazılamıyor — direktif artık
  // istek başına üretiliyor. Ayrıntı ve güvenlik gerekçesi: lib/cerceveAtaslari.ts
  // FRAME_ANCESTOR_RANGE: sayısal aralık şablonu, açılışta bir kez açılır.
  //   https://narcosbahis{480-560}.com
  // Liste her istekte AYNI kaldığı için CDN'in yanıtı önbelleğe alması
  // sorun çıkarmaz. PATTERNS ise direktifi istek başına değiştirir; HTML'i
  // önbellekleyen bir CDN arkasında (bu kurulumda Cloudflare) tercih
  // edilmemeli. Gerekçe: lib/cerceveAtaslari.ts
  const frameAncestors = sabitListeyiCoz({
    adresler: process.env.FRAME_ANCESTORS,
    araliklar: process.env.FRAME_ANCESTOR_RANGE,
  });
  const frameAncestorPatterns = listeyiAyristir(process.env.FRAME_ANCESTOR_PATTERNS);
  const gomulebilir = gomulebilirMi(frameAncestors, frameAncestorPatterns);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        /**
         * İSTEK BAŞINA hesaplanır: gömen sayfanın origin'i `Referer`'dan
         * okunur, kalıplara karşı doğrulanır ve yalnızca eşleşirse eklenir.
         * Eşleşme yoksa ya da Referer gelmediyse liste `'self'` + sabit
         * listedir, yani KAPALI tarafa düşer.
         *
         * SPA kabuğu `Cache-Control: no-cache` ile servis edildiği için bu
         * başlık her istekte yeniden üretilir (bkz. index.ts).
         */
        frameAncestors: [
          (req: unknown) => cerceveAtasiDirektifi({
            sabitler: frameAncestors,
            kaliplar: frameAncestorPatterns,
            referer: (req as { headers?: Record<string, string | string[] | undefined> })
              ?.headers?.referer as string | undefined,
          }).join(' '),
        ],
        /**
         * scriptSrc'de 'unsafe-inline' YOK — bilerek.
         *
         * Panelde admin tarafindan girilen HTML uc yerde ham olarak
         * render ediliyor (bonus detailHtml: BonusTalepSayfasi,
         * PromoDetailModal, RulesManager). 'unsafe-inline' acikken bu
         * alanlara yazilan <script> ya da onerror= calisirdi.
         *
         * Derlenmis cikti yalnizca harici <script src> kullaniyor
         * (index.html ve ortak.html'de inline script/olay isleyici yok),
         * dolayisiyla kaldirmak mesru hicbir seyi bozmuyor.
         */
        scriptSrc: ["'self'"],
        // styleSrc'de kaliyor: React satir ici stil (style={{...}}) uretiyor.
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:'],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    // X-Frame-Options tek bir origin kabul eder ve eski tarayıcılarda
    // frame-ancestors'ı ezer; gömme izni verildiğinde kapatılmalı, yoksa
    // CSP doğru olsa bile iframe engellenir.
    frameguard: gomulebilir ? false : { action: 'sameorigin' },
    crossOriginResourcePolicy: { policy: gomulebilir ? 'cross-origin' : 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    hidePoweredBy: true,
  });

  await app.register(cors, {
    origin: corsConfig.origin as boolean | string | RegExp,
    credentials: true,
  });

  /**
   * YANIT SIKISTIRMA.
   *
   * Panel sikistirmasiz JSON gonderiyordu. Bonus raporu binlerce satir,
   * oyuncu listesi yuzlerce kayit, istemci paketi 1 MB'in uzerinde —
   * hepsi ham. JSON ve JS metinsel oldugu icin gzip tipik olarak 5-10
   * kat kuculuyor.
   *
   * Railway giden trafigi faturaliyor; bu tek satir en dogrudan
   * tasarruf kalemi. Ayrica Cloudflare'in arkasindaki gecikme de duser.
   *
   * `threshold` altindaki kucuk yanitlar sikistirilmaz: 200 baytlik bir
   * govdeyi sikistirmak CPU harcar, kazanc getirmez.
   */
  await app.register(compress, {
    global: true,
    threshold: 1024,
    encodings: ['br', 'gzip', 'deflate'],
  });

  // ─── Request ID (Correlation) ─────────────────────────────────────────────
  await registerRequestId(app);

  // ─── Rate Limiting ────────────────────────────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: Number(process.env.RATE_LIMIT_MAX) || (isProduction ? 90 : 200),
    timeWindow: '1 minute',
    allowList: isProduction ? [] : ['127.0.0.1', '::1'],
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'TooManyRequests',
      message: `Cok fazla istek. Limit: ${context.max} istek/${context.after}. Lutfen ${context.after} sonra tekrar deneyin.`,
    }),
  });

  // ─── OpenAPI / Swagger ────────────────────────────────────────────────────
  if (!isProduction || process.env.ENABLE_DOCS === 'true') {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'BetConstruct Dashboard API',
        description: 'BetConstruct backoffice middleware - withdrawal engine, bonus management, reporting',
        version: '2.0.0',
      },
      servers: [
        { url: `http://localhost:${config.port}`, description: 'Development' },
      ],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'dashboard', description: 'Dashboard proxy endpoints' },
        { name: 'withdrawal', description: 'Withdrawal engine endpoints' },
        { name: 'bonus', description: 'Bonus management endpoints' },
        { name: 'report', description: 'Reporting endpoints' },
        { name: 'system', description: 'System and health endpoints' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });
  }

  // ─── Oturum Yönetimi ─────────────────────────────────────────────────────
  const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : 'dev-only-change-me-session-secret-min-32-chars');

  if (isProduction && sessionSecret.length < 64) {
    throw new Error('SECURITY: Production icin SESSION_SECRET en az 64 karakter olmali.');
  }

  if (!isProduction && !process.env.SESSION_SECRET) {
    console.warn('[security] SESSION_SECRET tanimli degil. Sadece development icin gecici anahtar kullaniliyor.');
  }

  await app.register(fastifyCookie);
  const sessionStore = createRedisSessionStore(sessionTtlMs);
  if (!sessionStore && isProduction) {
    throw new Error('SECURITY: Production session store için Redis bağlantısı zorunludur.');
  }

  const cookieSecure = parseSessionCookieSecure(gomulebilir);
  const cookieSameSite = parseSessionSameSite(gomulebilir);
  const cookiePartitioned = parseSessionPartitioned(cookieSameSite, cookieSecure);

  await app.register(fastifySession, {
    secret: sessionSecret,
    saveUninitialized: false,
    ...(sessionStore ? { store: sessionStore as any } : {}),
    cookie: {
      secure: cookieSecure,
      httpOnly: true,
      sameSite: cookieSameSite,
      path: '/',
      maxAge: sessionTtlMs,
      ...(cookiePartitioned ? { partitioned: true } : {}),
    },
  });

  if (gomulebilir && cookieSameSite !== 'none') {
    app.log.warn(
      '[session] FRAME_ANCESTORS/FRAME_ANCESTOR_PATTERNS tanımlı ama SESSION_COOKIE_SAMESITE=none değil. ' +
      'Panel iframe içinde çalışırken oturum çerezi gönderilmez; giriş sonrası tüm istekler 401 döner.'
    );
  }
  if (gomulebilir && cookieSameSite === 'none' && !cookiePartitioned) {
    app.log.warn(
      '[session] Oturum çerezi Partitioned değil. Chrome üçüncü taraf çerezleri engellediğinde ' +
      'gömülü panelde çerez hiç gönderilmez (Sec-Fetch-Storage-Access: none) ve tüm istekler 401 döner.'
    );
  }
  app.log.info(
    `[session] cerez: sameSite=${cookieSameSite} secure=${cookieSecure} partitioned=${cookiePartitioned} gomulu=${gomulebilir}`
  );

  // ─── API yanıtları asla önbelleğe alınmamalı ──────────────────────────────
  //
  // GÜVENLİK: /api/bonus-panel/me gibi uçlar oturum sahibinin kimliğini
  // döndürüyor. Yanıtta Cache-Control ve Vary: Cookie yoktu; Cloudflare bu
  // ucu önbelleğe alıp (cf-cache-status: EXPIRED ile doğrulandı) TEK girdiyi
  // tüm ziyaretçilere servis ediyordu. Sonuç: bir oyuncu lobide BAŞKA bir
  // oyuncunun kullanıcı adıyla doğrulanmış görünüyordu.
  //
  // Tek tek uçları işaretlemek yerine /api altındaki her yanıtı kapatıyoruz:
  // hangi ucun kimlik sızdırdığını tek tek doğru bilmek zorunda kalmayalım,
  // yeni uç eklendiğinde de varsayılan güvenli olsun. Statik dosyalar ve SPA
  // kabuğu bu hook'un dışında (onlar index.ts'te kendi başlıklarını alıyor).
  app.addHook('onSend', async (request, reply, payload) => {
    if (!request.url?.startsWith('/api')) return payload;
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    reply.header('Pragma', 'no-cache');           // eski vekiller
    reply.header('Expires', '0');
    // Bir ara katman yine de saklarsa en azından oturuma göre ayrıştırsın.
    reply.header('Vary', 'Cookie, Accept-Encoding');
    return payload;
  });

  // ─── Tenant Bağlamı ────────────────────────────────────────────────────────
  //
  // Panelin çok kiracılı çalışmasının TEK giriş noktası burası. İsteğin
  // hangi siteye ait olduğu bir kez çözülür (oturum > master'ın
  // ?tenantId'si > Host eşleşmesi), o tenant'ın bağlantı kaydı belleğe
  // alınır ve isteğin geri kalanı `AsyncLocalStorage` bağlamı içinde
  // çalışır. Lynon oturumu, kimlik bilgileri ve kural dosyası bu bağlamı
  // okuduğu için aşağıdaki hiçbir rotanın tenant'ı elden taşıması
  // gerekmiyor.
  //
  // Kanca CALLBACK biçiminde: `done()` bağlamın İÇİNDE çağrıldığı için
  // sonraki kancalar ve rota işleyicisi aynı bağlamı görür. `async`
  // yazılsaydı bağlam kanca döner dönmez kapanır, işleyici varsayılan
  // tenant'a düşerdi.
  app.addHook('preHandler', (request, _reply, done) => {
    // Yalnızca /api. Uygulamanın TÜM rotaları /api altında; statik
    // dosyalar ve SPA kabuğu tenant bilmiyor. Onları da kapsasaydık her
    // js/css/png isteği tenant listesi için bir okuma tetiklerdi.
    if (!request.url?.startsWith('/api')) return done();

    resolveTenantKeyForRequest(request as never)
      .then(async (key) => {
        await ensureTenantRuntime(key);
        return key;
      })
      // Tenant çözülemezse isteği düşürmek yerine varsayılana dönüyoruz;
      // tek siteli kurulumda tenants.json hiç olmayabilir.
      .catch(() => varsayilanTenantKey())
      .then((key) => {
        (request as { tenantKey?: string }).tenantKey = key;
        runWithTenant(key, () => done());
      })
      // SON ÇARE: `done()` HER DURUMDA çağrılmalı. Buraya kadar sızan bir
      // hatada zincir sessizce ölür ve istek zaman aşımına kadar askıda
      // kalırdı — yanlış tenant'a düşmekten çok daha kötüsü.
      .catch((error) => {
        request.log.error({ err: error }, '[tenant] bağlam kurulamadı; varsayılana düşülüyor');
        done();
      });
  });

  // ─── Global Error Handler ─────────────────────────────────────────────────
  registerGlobalErrorHandler(app);

  return app;
}

// ─── Rota Bazlı Rate Limit Yapılandırmaları ──────────────────────────────────

/** Login: brute-force koruması — 5 deneme / 1 dakika / IP */
export const LOGIN_RATE_LIMIT = {
  max: 5,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'TooManyRequests',
    message: 'Cok fazla giris denemesi. 1 dakika sonra tekrar deneyin.',
  }),
};

/** Token güncelleme: 3 istek / dakika */
export const TOKEN_UPDATE_RATE_LIMIT = {
  max: 3,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'TooManyRequests',
    message: 'Token guncelleme limiti asildi.',
  }),
};

/** Bonus charge: 10 istek / dakika */
export const BONUS_CHARGE_RATE_LIMIT = {
  max: 10,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'TooManyRequests',
    message: 'Bonus ekleme limiti asildi. Lutfen bekleyin.',
  }),
};

/** SMS gönderimi: 5 istek / dakika */
export const SMS_RATE_LIMIT = {
  max: 5,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'TooManyRequests',
    message: 'SMS gonderim limiti asildi.',
  }),
};
