import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { registerGlobalErrorHandler } from './lib/errorHandler.js';
import { registerRequestId } from './lib/requestId.js';
import { createRedisSessionStore } from './lib/redisClient.js';

const { cors: corsConfig } = config;
const isProduction = process.env.NODE_ENV === 'production';
const sessionTtlMs = Number(process.env.SESSION_TTL_MS) || 1000 * 60 * 60 * 8;

function parseSessionCookieSecure(): boolean | 'auto' {
  const value = String(process.env.SESSION_COOKIE_SECURE || '').trim().toLowerCase();
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return 'auto';
}

function parseSessionSameSite(): 'lax' | 'strict' | 'none' {
  const value = String(process.env.SESSION_COOKIE_SAMESITE || '').trim().toLowerCase();
  if (value === 'strict' || value === 'none') return value;
  return 'lax';
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
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:'],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    hidePoweredBy: true,
  });

  await app.register(cors, {
    origin: corsConfig.origin as boolean | string | RegExp,
    credentials: true,
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

  await app.register(fastifySession, {
    secret: sessionSecret,
    saveUninitialized: false,
    ...(sessionStore ? { store: sessionStore as any } : {}),
    cookie: {
      secure: parseSessionCookieSecure(),
      httpOnly: true,
      sameSite: parseSessionSameSite(),
      path: '/',
      maxAge: sessionTtlMs,
    },
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
