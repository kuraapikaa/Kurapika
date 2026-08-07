import dotenv from 'dotenv';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, createReadStream, statSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// .env aranacak yollar (sırayla yükle, override: true ile son yüklenen kazanır)
const cwdEnv = resolve(process.cwd(), '.env');
const serverDirEnv = resolve(__dirname, '..', '.env');       // server/.env
const projectRootEnv = resolve(__dirname, '..', '..', '.env'); // proje kökü .env
const envPaths = [cwdEnv, serverDirEnv, projectRootEnv];
const loaded: string[] = [];
envPaths.forEach((p) => {
  if (existsSync(p)) {
    const result = dotenv.config({ path: p, override: true });
    if (result.parsed) loaded.push(p);
  }
});
console.log('[env] cwd:', process.cwd());
console.log('[env] __dirname:', __dirname);
console.log('[env] Denenen yollar:', envPaths);
console.log('[env] Yüklenen .env:', loaded.length ? loaded : 'YOK');
if (loaded.length === 0) {
  console.warn('[env] Hiç .env dosyası bulunamadı. .env dosyasını proje köküne veya server/ klasörüne koyun.');
} else {
  const token = process.env.AUTH_TOKEN || process.env.DASHBOARD_AUTH;
  const lynonConfigured = Boolean(
    (process.env.LYNON_PANEL_USERNAME || process.env.BACKOFFICE_PANEL_USERNAME || process.env.PANEL_USERNAME) &&
    (process.env.LYNON_PANEL_PASSWORD || process.env.BACKOFFICE_PANEL_PASSWORD || process.env.PANEL_PASSWORD) &&
    (
      process.env.LYNON_PANEL_OTP_SECRET ||
      process.env.LYNON_PANEL_OTP_TOKEN ||
      process.env.BACKOFFICE_PANEL_OTP_SECRET ||
      process.env.BACKOFFICE_PANEL_OTP_TOKEN ||
      process.env.PANEL_OTP_SECRET ||
      process.env.PANEL_OTP_TOKEN
    )
  );
  if (token) {
    console.log('[env] API token configured.');
  } else if (lynonConfigured) {
    console.log('[env] Lynon panel credentials configured.');
  } else {
    console.warn('[env] AUTH_TOKEN/DASHBOARD_AUTH veya Lynon panel bilgileri tanımlı değil.');
  }
}

import { config } from './config.js';
import { buildApp, TOKEN_UPDATE_RATE_LIMIT } from './app.js';
import { authRoutes } from './routes/auth.js';
import { registerAuthMiddleware } from './middleware/authGuard.js';
import { maybeSendDemoMock } from './lib/demoMockData.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { gamesRoutes } from './routes/games.js';
import { affiliateRoutes } from './routes/affiliate.js';
import { bugscrmRoutes } from './routes/bugscrm.js';
import { formsRoutes } from './routes/forms.js';
import { masterRoutes } from './routes/master.js';
import { loyaltyRoutes } from './routes/loyalty.js';
import { lynonRoutes } from './routes/lynon.js';
import {
  scheduler,
  registerAutoWithdrawJob,
  registerNextDayBonusJob,
  registerLoyaltyRetentionJob,
  registerHedefBakiyeJob,
  registerTelegramRaporJob,
  registerOtomatikKategoriJob,
  registerMutabakatJob,
  registerOyuncuBakiyeJob,
  registerAffiliateCrmJob,
} from './jobs/scheduler.js';
import { enforceEnvironment } from './lib/envValidator.js';
import { spaKabuguDonsunMu } from './lib/spaKabugu.js';
import { watchConfigFile, getWatcherStatus } from './lib/configWatcher.js';
import { closeDatabase, getDatabaseStatus, initializeDatabase } from './lib/database.js';
import { closeRedis, getRedisStatus, initializeRedis } from './lib/redisClient.js';
import { hydrateTenantRuntime } from './lib/tenantRuntimeConfig.js';
import { sifrelemeHazirMi } from './lib/secretBox.js';

// ─── Ortam Değişkeni Doğrulama ─────────────────────────────────────────────
enforceEnvironment();

await initializeDatabase();
await initializeRedis();

// Alt sitelerin Lynon/backoffice bağlantı kayıtları belleğe alınır. Arka
// plan işleri istek bağlamı olmadan çalıştığı için bu, ilk turda yanlış
// (varsayılan) siteye bağlanmamalarının tek güvencesi.
const yuklenenTenant = await hydrateTenantRuntime();
console.log(`[tenant] ${yuklenenTenant} site yapılandırması yüklendi.${sifrelemeHazirMi() ? '' : ' TENANT_SECRET_KEY tanımlı değil; panelden kimlik bilgisi kaydedilemez.'}`);

const { port } = config;

// ─── Uygulama Oluşturma ─────────────────────────────────────────────────────
const app = await buildApp();

// ─── Auth Rotaları (Login, Logout, Me, Bonus Panel) ─────────────────────────
await app.register(authRoutes);

// ─── Auth Middleware (Korunan Rotalar) ───────────────────────────────────────
registerAuthMiddleware(app);

app.addHook('preHandler', async (request, reply) => {
  await maybeSendDemoMock(request, reply);
});

// ─── İş Mantığı Rotaları ─────────────────────────────────────────────────────
await app.register(dashboardRoutes, { prefix: '/api', config });
await app.register(lynonRoutes, { prefix: '/api' });
await app.register(gamesRoutes, { prefix: '/api' });
await app.register(formsRoutes, { prefix: '/api' });
await app.register(affiliateRoutes, { prefix: '/api' });
await app.register(bugscrmRoutes, { prefix: '/api' });
await app.register(masterRoutes, { prefix: '/api' });
await app.register(loyaltyRoutes, { prefix: '/api' });

// ─── Audit Log (Sadece Admin) ────────────────────────────────────────────────
app.get<{ Querystring: { limit?: string } }>('/api/audit', async (request: any, reply) => {
  const user = request.session?.user;
  if (user?.role !== 'admin') return reply.status(403).send({ error: 'Yetkisiz' });
  const limit = Math.min(parseInt(request.query?.limit ?? '500', 10) || 500, 2000);
  const { readAuditLog } = await import('./lib/auditLog.js');
  return reply.send({ data: await readAuditLog(limit) });
});

// ─── Token Güncelleme ────────────────────────────────────────────────────────
app.post<{ Body: { token: string } }>('/api/update-token', { config: { rateLimit: TOKEN_UPDATE_RATE_LIMIT } }, async (request, reply) => {
  const updateSecret = process.env.TOKEN_UPDATE_SECRET;
  if (updateSecret) {
    const provided = String(request.headers['x-token-update-secret'] || '');
    if (provided !== updateSecret) return reply.status(403).send({ ok: false, message: 'Forbidden' });
  }

  const { token } = request.body ?? {};
  if (!token) return reply.status(400).send({ ok: false, message: 'Token is missing' });

  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const tokenFile1 = path.join(__dirname, '..', '.backoffice-auth.json');
    const tokenFile2 = path.join(__dirname, '..', '.dashboard-auth.json');

    fs.writeFileSync(tokenFile1, JSON.stringify({ token: token.trim() }));
    fs.writeFileSync(tokenFile2, JSON.stringify({ token: token.trim() }));

    console.log('[auth-sync] Auth token updated.');
    return reply.send({ ok: true, message: 'Tokens updated successfully' });
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ ok: false, message: 'Failed to write token files' });
  }
});

// ─── Health Check (Scheduler Status dahil) ───────────────────────────────────
app.get('/api/health', async (_, reply) => {
  const { getDashboardToken, getBackofficeToken } = await import('./lib/authStore.js');
  const dashboardToken = getDashboardToken();
  const backofficeToken = getBackofficeToken();
  const { getLynonAuthStatus } = await import('./lib/lynonAuth.js');
  return reply.send({
    ok: true,
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
    dashboardToken: dashboardToken ? { configured: true } : null,
    backofficeToken: backofficeToken ? { configured: true } : null,
    lynon: getLynonAuthStatus(),
    jobs: scheduler.getStatus(),
    circuitBreakers: (await import('./lib/httpClient.js')).getCircuitBreakerStatus(),
    configWatchers: getWatcherStatus(),
    persistence: { database: getDatabaseStatus(), redis: getRedisStatus() },
  });
});

// ─── Statik Dosya Sunumu (Production) ────────────────────────────────────────
const isProduction = config.nodeEnv === 'production';
if (isProduction) {
  const clientDist = resolve(join(__dirname, '..', '..', 'client', 'dist'));
  const mime: Record<string, string> = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  };
  // Vite çıktısında /assets/* dosya adları içerik hash'i taşır (index-a1b2c3.js);
  // içerik değişince ad da değişir, bu yüzden uzun süre önbelleğe alınabilirler.
  // HTML ve hash'siz dosyalar her istekte doğrulanmalı.
  const cacheControlFor = (resolvedPath: string, ext: string): string => {
    if (ext === '.html') return 'no-cache, must-revalidate';
    const hashli = /[.-][A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(resolvedPath);
    return hashli ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
  };

  // Ortak paneli ayri bir Vite girisi (/ortak.html). Eskiden SPA icinde
  // /ortak-paneli rotasiydi; disariya verilmis baglantilar kirilmasin.
  app.get('/ortak-paneli', async (_request, reply) => reply.redirect('/ortak.html', 301));

  app.get('*', async (request, reply) => {
    const pathname = request.url?.split('?')[0] ?? '/';
    const safePath = join(clientDist, pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''));
    const resolved = resolve(safePath);
    if (!resolved.startsWith(clientDist)) {
      return reply.status(403).send({ HasError: true, AlertMessage: 'Forbidden' });
    }
    if (existsSync(resolved) && statSync(resolved).isFile()) {
      const ext = resolved.slice(resolved.lastIndexOf('.'));
      if (mime[ext]) reply.type(mime[ext]);
      reply.header('Cache-Control', cacheControlFor(resolved, ext));
      return reply.send(createReadStream(resolved));
    }
    if (!spaKabuguDonsunMu(pathname)) {
      return reply.status(404).type('text/plain').send('Bulunamadı.');
    }

    const indexHtml = join(clientDist, 'index.html');
    // SPA kabuğu asla önbelleğe alınmamalı: güvenlik başlıkları (CSP,
    // frame-ancestors) yanıtla birlikte taşındığı için önbellekten servis
    // edilen eski bir kopya, sunucu güncellense bile eski politikayı uygular.
    // Ayrıca yeni deploy'lar kullanıcılara ulaşmaz.
    reply.header('Cache-Control', 'no-cache, must-revalidate');
    return reply.type('text/html').send(createReadStream(indexHtml));
  });
} else {
  app.get('/', async (_, reply) => {
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>Dashboard API</title></head>
      <body>
        <h1>Backend running</h1>
        <p>API: <a href="/api/health">/api/health</a></p>
        <p>Docs: <a href="/docs">/docs (Swagger)</a></p>
        <p>Frontend (Vite): <a href="http://localhost:5173">http://localhost:5173</a></p>
      </body></html>
    `);
  });
}

// ─── Sunucuyu Başlat ─────────────────────────────────────────────────────────
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} alındı; bağlantılar kapatılıyor.`);
  scheduler.stop();
  await app.close().catch(() => undefined);
  await closeRedis().catch(() => undefined);
  await closeDatabase().catch(() => undefined);
}
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });

/**
 * Surec seviyesi hata yakalayicilar.
 *
 * Node 15'ten beri YAKALANMAMIS BIR PROMISE REDDI TUM SURECI SONLANDIRIYOR.
 * Bu uygulama Lynon, Telegram, BetConstruct ve Redis'e surekli cagri yapiyor;
 * arka planda .catch()'siz kalan tek bir promise sunucuyu dusurur ve herkes
 * "connection refused" alir. Yakalayici olmadigi icin de geriye HICBIR IZ
 * kalmiyordu: surec sessizce oluyor, Railway yeniden baslatiyor, elimizde
 * yalnizca kenar logunda 502 kaliyordu.
 *
 * Iki durum bilerek FARKLI ele aliniyor:
 *
 * unhandledRejection — surec OLDURULMEZ. Bunlar cogunlukla basarisiz bir dis
 * cagri; tum sunucuyu dusurmek orantisiz. Loglanir, servis calismaya devam
 * eder.
 *
 * uncaughtException — loglanir ve duzgun kapatilip cikilir. Burada uygulama
 * durumu bozulmus olabilir; ayakta tutmak sessiz veri hatasi uretme riski
 * tasir. Railway ON_FAILURE ile temiz bir ornek baslatir.
 */
process.on('unhandledRejection', (reason) => {
  const detay = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
  console.error('[server] YAKALANMAMIS PROMISE REDDI — servis ayakta kalmaya devam ediyor:', detay);
});

process.on('uncaughtException', (error) => {
  console.error('[server] YAKALANMAMIS ISTISNA — durum bozulmus olabilir, kapatiliyor:', error.stack ?? error.message);
  void shutdown('uncaughtException').finally(() => process.exit(1));
});
console.log(`[server] Dinlemeye başlanıyor: http://localhost:${port}`);
try {
  await app.listen({ port, host: '0.0.0.0' });
  const { getDashboardToken, getBackofficeToken } = await import('./lib/authStore.js');
  const { getLynonAuthStatus } = await import('./lib/lynonAuth.js');
  const dash = getDashboardToken();
  const back = getBackofficeToken();
  const lynon = getLynonAuthStatus();
  console.log(`Dashboard API: http://localhost:${port}`);
  console.log(`Health:        http://localhost:${port}/api/health`);
  if (dash) console.log('Dashboard token configured.');
  else if (lynon.configured) console.log('Dashboard data will use Lynon gateway.');
  else console.warn('Uyarı: Dashboard token veya Lynon panel bilgileri yok.');
  if (back) console.log('Backoffice token configured.');
  else if (lynon.configured) console.log('Backoffice data will use Lynon gateway where documented.');
  else console.warn('Uyarı: Backoffice token veya Lynon panel bilgileri yok.');
  if (lynon.configured) console.log(`Lynon gateway configured (site ${lynon.siteId}).`);

  // ─── Telegram Webhook ───────────────────────────────────────────────────────
  // TELEGRAM_WEBHOOK_URL tanimliysa webhook her acilista `callback_query`
  // dahil yeniden kaydedilir — elle kurulmus, `callback_query`'i hic
  // istememis bir webhook cekim butonlarini sessizce isliyor hale
  // getirebiliyordu. Hata bloklamaz; sunucu ayakta kalmaya devam eder.
  try {
    const { ensureTelegramWebhook } = await import('./services/telegramService.js');
    await ensureTelegramWebhook();
  } catch (err) {
    console.error('[server] Telegram webhook kaydı başarısız:', err instanceof Error ? err.message : err);
  }

  // ─── Background Jobs ──────────────────────────────────────────────────────
  await registerAutoWithdrawJob();
  await registerNextDayBonusJob();
  await registerLoyaltyRetentionJob();
  await registerHedefBakiyeJob();
  await registerTelegramRaporJob();
  await registerOtomatikKategoriJob();
  await registerMutabakatJob();
  await registerOyuncuBakiyeJob();
  await registerAffiliateCrmJob();
  scheduler.start(10000);

  // ─── Config Hot-Reload ─────────────────────────────────────────────────────
  watchConfigFile('src/data/rules.json', 'rules', async () => {
    try {
      const { refreshRules } = await import('./services/withdrawalEngine.js');
      refreshRules('default');
      console.log('[hot-reload] rules.json yeniden yuklendi');
    } catch (err) {
      console.error('[hot-reload] rules.json yuklenirken hata:', err);
    }
  });

  watchConfigFile('src/data/tenants.json', 'tenants', () => {
    console.log('[hot-reload] tenants.json degisti - sonraki istek yeni veriyi kullanacak');
  });

} catch (err) {
  app.log.error(err);
  process.exit(1);
}

