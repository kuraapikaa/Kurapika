import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { safeTenantKey } from '../lib/tenant.js';
import { runWithTenant } from '../lib/tenantContext.js';
import { loadTenants, saveTenants } from '../repositories/tenantRepository.js';
import {
  loadTenantConnection,
  saveTenantConnection,
  type TenantBackofficeConnection,
  type TenantLynonConnection,
} from '../repositories/tenantConnectionRepository.js';
import { maskele, sifrelemeHazirMi } from '../lib/secretBox.js';
import { ensureTenantRuntime, invalidateTenantRuntime } from '../lib/tenantRuntimeConfig.js';
import { aktifTenantAnahtarlari } from '../lib/tenantFanout.js';
import { clearLynonSession, ensureLynonSession, getLynonAuthStatus, isLynonConfigured } from '../lib/lynonAuth.js';
import { hashPassword } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TENANTS_FILE = path.join(__dirname, '..', 'data', 'tenants.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(TENANTS_FILE))) {
  fs.mkdirSync(path.dirname(TENANTS_FILE), { recursive: true });
}


function readJsonIfExists(filePath: string, fallback: any) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: any) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function seedTenantFiles(tenantId: string) {
  const key = safeTenantKey(tenantId);
  const dataDir = path.join(__dirname, '..', 'data');
  const seedMap = [
    { legacy: path.join(dataDir, 'game-settings.json'), target: path.join(dataDir, 'game-settings', `${key}.json`), fallback: { wheel: [], scratchcard: { baseWinProbability: 10, rewards: [] } } },
    { legacy: path.join(dataDir, 'wheel-codes.json'), target: path.join(dataDir, 'wheel-codes', `${key}.json`), fallback: [] },
    { legacy: path.join(dataDir, 'forms-settings.json'), target: path.join(dataDir, 'forms-settings', `${key}.json`), fallback: { callReasons: ['Finansal İşlemler (Para Yatırma/Çekme)', 'Bonus İşlemleri', 'Hesap ve Profil İşlemleri', 'Diğer (Şikayet / Öneri)'], partnershipTypes: ['Telegram Grubu', 'Yayıncı (Twitch/Kick)', 'YouTube / Sosyal Medya', 'Diğer'], callActive: true, partnershipActive: true } },
    { legacy: path.join(dataDir, 'forms-data.json'), target: path.join(dataDir, 'forms-data', `${key}.json`), fallback: { callRequests: [], partnershipRequests: [] } },
    { legacy: path.join(dataDir, 'tournaments.json'), target: path.join(dataDir, 'tournaments', `${key}.json`), fallback: { gunluk: { prize: '50.000', isActive: true }, haftalik: { prize: '250.000', isActive: true }, aylik: { prize: '500.000', isActive: true } } },
    { legacy: path.join(dataDir, 'player-loyalty.json'), target: path.join(dataDir, 'player-loyalty', `${key}.json`), fallback: { players: {}, market: [], wagerToPointRatio: 100 } },
    { legacy: path.join(dataDir, 'rules', 'default.json'), target: path.join(dataDir, 'rules', `${key}.json`), fallback: {} },
    { legacy: path.join(dataDir, 'promo-overrides', 'default.json'), target: path.join(dataDir, 'promo-overrides', `${key}.json`), fallback: { overrides: {} } },
  ];

  seedMap.forEach(({ legacy, target, fallback }) => {
    if (!fs.existsSync(target)) writeJson(target, readJsonIfExists(legacy, fallback));
  });
}

export async function masterRoutes(app: FastifyInstance) {
  // Master Login
  app.post('/master/login', async (request: any, reply) => {
    const { username, password } = request.body || {};
    const isProduction = process.env.NODE_ENV === 'production';
    const masterUser = process.env.MASTER_USER || '';
    const masterPass = process.env.MASTER_PASS || '';

    if (isProduction && (!masterUser || !masterPass)) {
      return reply.status(503).send({ ok: false, message: 'Master login disabled until credentials are configured.' });
    }

    if (username === masterUser && password === masterPass) {
      request.session.isMaster = true;
      return reply.send({ ok: true, message: 'Master giriş başarılı.' });
    }
    return reply.status(401).send({ ok: false, message: 'Geçersiz yetki.' });
  });

  app.post('/master/logout', async (request: any, reply) => {
     request.session.isMaster = false;
     return reply.send({ ok: true });
  });

  app.get('/master/check', async (request: any, reply) => {
     if (request.session.isMaster) {
        return reply.send({ ok: true });
     }
     return reply.status(401).send({ ok: false });
  });

  // Master Tenants API
  app.get('/master/tenants', async (request: any, reply) => {
    if (!request.session.isMaster) return reply.status(401).send({ error: 'Yetkisiz' });
    return reply.send({ ok: true, data: await loadTenants() });
  });

  app.post('/master/tenants', async (request: any, reply) => {
    if (!request.session.isMaster) return reply.status(401).send({ error: 'Yetkisiz' });
    const { siteName, domain, adminEmail, adminPassword, partnerId, expireDate, themeColor, logoUrl, adminTitle } = request.body || {};
    if (!siteName || !domain) return reply.status(400).send({ ok: false, message: 'Site adı ve domain zorunludur' });

    const tenants = await loadTenants();
    const generatedPassword = adminPassword || crypto.randomBytes(18).toString('base64url');
    const newTenant = {
       id: crypto.randomUUID(),
       siteName,
       domain,
       adminEmail: adminEmail || 'admin@' + domain,
       adminPasswordHash: await hashPassword(generatedPassword),
       partnerId: partnerId || '',
       isActive: true,
       expireDate: expireDate || null,
       themeColor: themeColor || '#8b5cf6',
       logoUrl: logoUrl || '',
       adminTitle: adminTitle || 'Bugs Software Portal',
       createdAt: new Date().toISOString()
    };
    
    tenants.push(newTenant);
    await saveTenants(tenants);
    seedTenantFiles(newTenant.id);
    
    return reply.send({ ok: true, tenant: newTenant, generatedPassword: adminPassword ? undefined : generatedPassword });
  });

  app.put('/master/tenants/:id', async (request: any, reply) => {
    if (!request.session.isMaster) return reply.status(401).send({ error: 'Yetkisiz' });
    const { id } = request.params as any;
    const { siteName, domain, adminEmail, adminPassword, partnerId, expireDate, isActive, themeColor, logoUrl, adminTitle } = request.body || {};
    
    const tenants = await loadTenants();
    const idx = tenants.findIndex((t: any) => t.id === id);
    if (idx === -1) return reply.status(404).send({ error: 'Bulunamadı' });

    if (siteName !== undefined) tenants[idx].siteName = siteName;
    if (domain !== undefined) tenants[idx].domain = domain;
    if (adminEmail !== undefined) tenants[idx].adminEmail = adminEmail;
    if (adminPassword !== undefined && String(adminPassword).trim()) {
      tenants[idx].adminPasswordHash = await hashPassword(String(adminPassword));
      delete tenants[idx].adminPassword;
    }
    if (partnerId !== undefined) tenants[idx].partnerId = partnerId;
    if (expireDate !== undefined) tenants[idx].expireDate = expireDate;
    if (typeof isActive === 'boolean') tenants[idx].isActive = isActive;
    if (themeColor !== undefined) tenants[idx].themeColor = themeColor;
    if (logoUrl !== undefined) tenants[idx].logoUrl = logoUrl;
    if (adminTitle !== undefined) tenants[idx].adminTitle = adminTitle;

    await saveTenants(tenants);
    return reply.send({ ok: true, tenant: tenants[idx] });
  });

  // ─── Alt Site Bağlantıları (Lynon / Backoffice) ──────────────────────────
  //
  // Her tenant kendi backoffice'ine bağlanır. Sırlar `secretBox` ile
  // şifreli saklanır ve panele ASLA açık dönmez — yalnızca "tanımlı mı"
  // bilgisi ve son iki karakter gösterilir.

  async function tenantVarMi(id: string): Promise<boolean> {
    return (await loadTenants()).some((tenant: any) => tenant.id === id);
  }

  app.get('/master/tenants/:id/connection', async (request: any, reply) => {
    if (!request.session.isMaster) return reply.status(401).send({ error: 'Yetkisiz' });
    const { id } = request.params as any;
    if (!(await tenantVarMi(id))) return reply.status(404).send({ ok: false, message: 'Tenant bulunamadı' });

    const kayit = await loadTenantConnection(id);
    return reply.send({
      ok: true,
      sifrelemeHazir: sifrelemeHazirMi(),
      data: {
        lynon: {
          enabled: kayit.lynon.enabled ?? null,
          backofficeBaseUrl: kayit.lynon.backofficeBaseUrl ?? '',
          idBaseUrl: kayit.lynon.idBaseUrl ?? '',
          siteId: kayit.lynon.siteId ?? null,
          currency: kayit.lynon.currency ?? '',
          username: kayit.lynon.username ?? '',
          deviceFingerprint: kayit.lynon.deviceFingerprint ?? '',
          trustDevice: kayit.lynon.trustDevice ?? null,
          otpAlgorithm: kayit.lynon.otpAlgorithm ?? '',
          otpDigits: kayit.lynon.otpDigits ?? null,
          otpPeriodSeconds: kayit.lynon.otpPeriodSeconds ?? null,
          timezoneOffset: kayit.lynon.timezoneOffset ?? null,
          // Sırlar maskeli: varlıkları görünür, içerikleri değil.
          passwordMask: maskele(kayit.lynon.password),
          otpSecretMask: maskele(kayit.lynon.otpSecret),
          otpTokenMask: maskele(kayit.lynon.otpToken),
        },
        backoffice: {
          authTokenMask: maskele(kayit.backoffice.authToken),
          dashboardAuthTokenMask: maskele(kayit.backoffice.dashboardAuthToken),
        },
        updatedAt: kayit.updatedAt ?? null,
        updatedBy: kayit.updatedBy ?? null,
      },
    });
  });

  app.put('/master/tenants/:id/connection', async (request: any, reply) => {
    if (!request.session.isMaster) return reply.status(401).send({ error: 'Yetkisiz' });
    const { id } = request.params as any;
    if (!(await tenantVarMi(id))) return reply.status(404).send({ ok: false, message: 'Tenant bulunamadı' });

    const govde = request.body || {};
    const gelenLynon = govde.lynon || {};
    const gelenBackoffice = govde.backoffice || {};

    const mevcut = await loadTenantConnection(id);
    const lynon: TenantLynonConnection = { ...mevcut.lynon };
    const backoffice: TenantBackofficeConnection = { ...mevcut.backoffice };

    // BOŞ ALAN "DEĞİŞTİRME" DEMEK, "SİL" DEĞİL.
    //
    // Sır alanları panele maskeli döndüğü için form her açıldığında boş
    // gelir. Boş değeri kayda yazsaydık, kullanıcının parolaya hiç
    // dokunmadan "kaydet"e basması sitenin Lynon şifresini silerdi.
    const metinAta = <K extends keyof TenantLynonConnection>(alan: K, deger: unknown) => {
      if (typeof deger !== 'string') return;
      const kirpik = deger.trim();
      if (kirpik === '') return;
      (lynon[alan] as unknown) = kirpik;
    };
    const sayiAta = <K extends keyof TenantLynonConnection>(alan: K, deger: unknown) => {
      if (deger === undefined || deger === null || deger === '') return;
      const n = Number(deger);
      if (Number.isFinite(n)) (lynon[alan] as unknown) = n;
    };

    metinAta('backofficeBaseUrl', gelenLynon.backofficeBaseUrl);
    metinAta('idBaseUrl', gelenLynon.idBaseUrl);
    metinAta('returnUrl', gelenLynon.returnUrl);
    metinAta('currency', gelenLynon.currency);
    metinAta('username', gelenLynon.username);
    metinAta('password', gelenLynon.password);
    metinAta('otpSecret', gelenLynon.otpSecret);
    metinAta('otpToken', gelenLynon.otpToken);
    metinAta('deviceFingerprint', gelenLynon.deviceFingerprint);
    metinAta('otpAlgorithm', gelenLynon.otpAlgorithm);
    sayiAta('siteId', gelenLynon.siteId);
    sayiAta('otpDigits', gelenLynon.otpDigits);
    sayiAta('otpPeriodSeconds', gelenLynon.otpPeriodSeconds);
    if (gelenLynon.timezoneOffset !== undefined && gelenLynon.timezoneOffset !== null && gelenLynon.timezoneOffset !== '') {
      const n = Number(gelenLynon.timezoneOffset);
      if (Number.isFinite(n)) lynon.timezoneOffset = n;
    }
    if (typeof gelenLynon.enabled === 'boolean') lynon.enabled = gelenLynon.enabled;
    if (typeof gelenLynon.trustDevice === 'boolean') lynon.trustDevice = gelenLynon.trustDevice;

    if (typeof gelenBackoffice.authToken === 'string' && gelenBackoffice.authToken.trim()) {
      backoffice.authToken = gelenBackoffice.authToken.trim();
    }
    if (typeof gelenBackoffice.dashboardAuthToken === 'string' && gelenBackoffice.dashboardAuthToken.trim()) {
      backoffice.dashboardAuthToken = gelenBackoffice.dashboardAuthToken.trim();
    }

    const sirGirildi = [gelenLynon.password, gelenLynon.otpSecret, gelenLynon.otpToken, gelenBackoffice.authToken, gelenBackoffice.dashboardAuthToken]
      .some((deger) => typeof deger === 'string' && deger.trim() !== '');
    if (sirGirildi && !sifrelemeHazirMi()) {
      return reply.status(400).send({
        ok: false,
        message: 'TENANT_SECRET_KEY tanımlı değil. Kimlik bilgileri şifrelenemediği için kaydedilmedi.',
      });
    }

    try {
      await saveTenantConnection(id, {
        version: 1,
        lynon,
        backoffice,
        updatedAt: new Date().toISOString(),
        updatedBy: 'master',
      });
    } catch (error) {
      return reply.status(400).send({ ok: false, message: error instanceof Error ? error.message : 'Kaydedilemedi' });
    }

    // Bellekteki kopya ve açık Lynon oturumu artık eski bilgilere ait.
    invalidateTenantRuntime(id);
    await ensureTenantRuntime(id);
    clearLynonSession(safeTenantKey(id));

    return reply.send({ ok: true });
  });

  /** Girilen bilgilerle gerçekten oturum açılabiliyor mu — kaydettikten sonra tek tuşla. */
  app.post('/master/tenants/:id/connection/test', async (request: any, reply) => {
    if (!request.session.isMaster) return reply.status(401).send({ error: 'Yetkisiz' });
    const { id } = request.params as any;
    if (!(await tenantVarMi(id))) return reply.status(404).send({ ok: false, message: 'Tenant bulunamadı' });

    await ensureTenantRuntime(id);
    const key = safeTenantKey(id);
    return runWithTenant(key, async () => {
      if (!isLynonConfigured()) {
        return reply.send({ ok: false, message: 'Lynon bilgileri eksik (kullanıcı adı, şifre ve OTP sırrı/token gerekli).' });
      }
      // Önceki oturum başarılı görünüp yeni bilgileri hiç denemesin.
      clearLynonSession(key);
      try {
        await ensureLynonSession();
        return reply.send({ ok: true, message: 'Bağlantı kuruldu.', durum: getLynonAuthStatus() });
      } catch (error) {
        return reply.send({ ok: false, message: error instanceof Error ? error.message : 'Bağlantı kurulamadı.' });
      }
    });
  });

  /** Arka plan işlerinin durumu; hangi site için ne zaman çalıştığı. */
  app.get('/master/jobs', async (request: any, reply) => {
    if (!request.session.isMaster) return reply.status(401).send({ error: 'Yetkisiz' });
    const { scheduler } = await import('../jobs/scheduler.js');
    return reply.send({ ok: true, data: scheduler.getStatus(), siteler: await aktifTenantAnahtarlari() });
  });
}
