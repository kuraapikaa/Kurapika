import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';
import { compare, hash } from 'bcryptjs';
import type { SessionUser, BonusPanelUser, Tenant } from '../types/betconstruct.js';
import { ServiceError } from '../lib/errorHandler.js';
import { LOGIN_RATE_LIMIT } from '../app.js';
import { LoginSchema, BonusPanelLoginSchema } from '../lib/schemas.js';
import { getBypassUser, isPanelAuthDisabled } from '../middleware/authGuard.js';
import { loadTenants, saveTenants } from '../repositories/tenantRepository.js';

// ─── Secrets: .env'den oku, hardcoded değil ──────────────────────────────────
const ADMIN_USER = (process.env.ADMIN_USER || 'admin').replace(/['"]/g, '').trim();
const ADMIN_PASS = (process.env.ADMIN_PASS || '').replace(/['"]/g, '').trim();

// ─── Şifreleme Yardımcıları ─────────────────────────────────────────────────
const BCRYPT_ROUNDS = 12;

/**
 * Iki dizeyi SABIT ZAMANDA karsilastirir.
 *
 * Duz metin karsilastirmasi `===` ile yapiliyordu; ilk farkli karakterde
 * kisa devre ettigi icin yanit suresi dogru onek uzunlugunu sizdirir.
 * Parola tahmini bu sinyalle karakter karakter daraltilabilir.
 *
 * Uzunluklar farkliysa yine de tam tur donulur — erken cikis uzunlugu
 * sizdirirdi.
 */
function sabitZamanliEsit(a: string, b: string): boolean {
  const uzunluk = Math.max(a.length, b.length);
  let fark = a.length ^ b.length;
  for (let i = 0; i < uzunluk; i++) {
    fark |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return fark === 0;
}

/**
 * Parola dogrulama sonucu.
 *
 * `yukseltilmeli`: dogrulama DUZ METIN uzerinden gecti demektir; cagiran
 * taraf hash'e cevirip kaydetmeli.
 */
type ParolaSonucu = { gecerli: boolean; yukseltilmeli: boolean };

/**
 * Tenant sifresini dogrula.
 *
 * Duz metin destegi KALDIRILMADI ama kalici degil: dogru duz metin parola
 * girildiginde cagiran taraf onu bcrypt'e cevirip kaydediyor, boylece
 * kayit bir sonraki giriste hash'li hale geliyor.
 *
 * Dogrudan kaldirmak, parolasi hala duz metin tutulan tenant'lari
 * kilitlerdi; kademeli gecis kilitlemeden kapatiyor.
 */
async function verifyTenantPassword(tenant: Tenant, inputPassword: string): Promise<ParolaSonucu> {
  if (tenant.adminPasswordHash) {
    return { gecerli: await compare(inputPassword, tenant.adminPasswordHash), yukseltilmeli: false };
  }
  if (tenant.adminPassword) {
    const gecerli = sabitZamanliEsit(tenant.adminPassword, inputPassword);
    return { gecerli, yukseltilmeli: gecerli };
  }
  return { gecerli: false, yukseltilmeli: false };
}

/**
 * Düz metin şifreyi bcrypt ile hashle.
 * Tenant şifre geçişi ve yeni tenant oluşturma için kullanılır.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, BCRYPT_ROUNDS);
}

async function verifyStaffPassword(
  staff: NonNullable<Tenant['staffUsers']>[number],
  inputPassword: string,
): Promise<ParolaSonucu> {
  if (staff.passwordHash) {
    return { gecerli: await compare(inputPassword, staff.passwordHash), yukseltilmeli: false };
  }
  if (staff.password) {
    const gecerli = sabitZamanliEsit(staff.password, inputPassword);
    return { gecerli, yukseltilmeli: gecerli };
  }
  return { gecerli: false, yukseltilmeli: false };
}

function getManageableTenantId(user: SessionUser | undefined, tenants: Tenant[]): string | undefined {
  if (user?.tenantId) return user.tenantId;
  if (user?.role === 'admin' && !user.staffId) return tenants.find((tenant) => tenant.isActive !== false)?.id;
  return undefined;
}

// ─── Auth Route'ları ─────────────────────────────────────────────────────────
export async function authRoutes(app: FastifyInstance): Promise<void> {

  // ─── Login ──────────────────────────────────────────────────────────────────
  app.post('/api/login', { schema: { body: LoginSchema, tags: ['auth'] }, config: { rateLimit: LOGIN_RATE_LIMIT } }, async (request: FastifyRequest<{ Body: { username?: string; password?: string; provider?: 'lynon' | 'betconstruct' } }>, reply: FastifyReply) => {
    const { username, password, provider } = (request.body as { username?: string; password?: string; provider?: 'lynon' | 'betconstruct' }) || {};
    const dataProvider = provider === 'betconstruct' ? 'betconstruct' : 'lynon';
    const inputUser = String(username || '').trim();
    const inputPass = String(password || '').trim();

    if (!inputUser || !inputPass) {
      throw new ServiceError('Kullanıcı adı ve şifre gerekli', 400);
    }

    console.log(`[auth] Giriş denemesi: "${inputUser}"`);

    // 1) Tenants'dan kontrol (Her müşterinin kendi girişi)
    const tenants = await loadTenants();
    for (const tenant of tenants) {
      if (tenant.adminEmail !== inputUser || tenant.isActive === false) continue;

      const { gecerli: passwordMatch, yukseltilmeli } = await verifyTenantPassword(tenant, inputPass);
      if (passwordMatch) {
        // Duz metin parola bir daha diskte kalmasin: dogrulanan degeri
        // hash'e cevirip acik kopyayi siliyoruz.
        if (yukseltilmeli) {
          tenant.adminPasswordHash = await hashPassword(inputPass);
          delete (tenant as { adminPassword?: string }).adminPassword;
          await saveTenants(tenants);
          console.log(`[auth] Tenant parolasi hash'e yukseltildi: ${inputUser}`);
        }
        console.log(`[auth] Müşteri girişi BAŞARILI: ${inputUser} (Site: ${tenant.siteName})`);
        const sessionUser: SessionUser = {
          username: inputUser,
          role: 'admin',
          tenantId: tenant.id,
          siteName: tenant.siteName,
          dataProvider,
        };
        (request as any).session.user = sessionUser;
        await (request as any).session.save();
        return reply.send({ ok: true });
      }
    }

    // 2) Global Admin: env değişkenlerinden
    for (const tenant of tenants) {
      if (tenant.isActive === false) continue;
      const staff = tenant.staffUsers?.find((item) => item.username === inputUser && item.isActive !== false);
      if (!staff) continue;

      const { gecerli: passwordMatch, yukseltilmeli: staffYukselt } = await verifyStaffPassword(staff, inputPass);
      if (passwordMatch) {
        if (staffYukselt) {
          staff.passwordHash = await hashPassword(inputPass);
          delete (staff as { password?: string }).password;
          console.log(`[auth] Personel parolasi hash'e yukseltildi: ${staff.username}`);
        }
        staff.lastLoginAt = new Date().toISOString();
        await saveTenants(tenants);
        const sessionUser: SessionUser = {
          username: staff.username,
          role: 'operator',
          tenantId: tenant.id,
          siteName: tenant.siteName,
          staffId: staff.id,
          displayName: staff.name,
          permissions: staff.permissions || [],
          dataProvider,
        };
        (request as any).session.user = sessionUser;
        await (request as any).session.save();
        return reply.send({ ok: true });
      }
    }

    const isEnvMatch = Boolean(ADMIN_USER && ADMIN_PASS && inputUser === ADMIN_USER && inputPass === ADMIN_PASS);

    if (isEnvMatch) {
      console.log(`[auth] Giriş BAŞARILI (admin): ${inputUser}`);
      const sessionUser: SessionUser = { username: inputUser, role: 'admin', dataProvider };
      (request as any).session.user = sessionUser;
      await (request as any).session.save();

      try {
        const { audit } = await import('../lib/auditLog.js');
        audit(inputUser, 'admin', 'login');
      } catch (auditErr) {
        console.warn('[auth] Audit log hatası (önemsiz):', auditErr);
      }

      return reply.send({ ok: true });
    }

    console.log(`[auth] Giriş HATALI: ${inputUser}`);
    throw new ServiceError('Kullanıcı adı veya şifre yanlış', 401);
  });

  // ─── Tenant Info ──────────────────────────────────────────────────────────
  app.get('/api/tenant-info', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { resolveTenantKeyFromHost } = await import('../lib/tenant.js');
      const tenantId = await resolveTenantKeyFromHost(request);
      const tenants = await loadTenants();
      const tenant = tenants.find((t) => t.id === tenantId);
      if (tenant) {
        return reply.send({
          ok: true,
          themeColor: tenant.themeColor || '#8b5cf6',
          logoUrl: tenant.logoUrl || '',
          adminTitle: tenant.adminTitle || tenant.siteName || 'Arwen Software Solutions',
        });
      }
      return reply.send({ ok: false, message: 'Tenant not found' });
    } catch {
      return reply.send({ ok: false });
    }
  });

  // ─── Logout ─────────────────────────────────────────────────────────────────
  app.post('/api/logout', async (request: any, reply: FastifyReply) => {
    const user = request.session?.user as SessionUser | undefined;
    if (user) {
      const { audit } = await import('../lib/auditLog.js');
      audit(user.username ?? '?', user.role ?? 'admin', 'logout');
    }
    request.session.destroy();
    return reply.send({ ok: true });
  });

  // ─── Me ───────────────────────────────────────────────────────────────────
  app.get('/api/me', async (request: any, reply: FastifyReply) => {
    if (isPanelAuthDisabled()) {
      const user = request.session?.user || getBypassUser();
      request.session.user = user;
      await request.session.save();
      return reply.send({ ok: true, user, authDisabled: true });
    }

    const user = request.session?.user as SessionUser | undefined;
    if (!user) return reply.status(401).send({ ok: false });
    // role yoksa eski oturum = admin kabul et
    const u: SessionUser = { ...user, role: user.role ?? 'admin' };

    /*
     * OTURUMUN SITESI.
     *
     * `/api/tenant-info` de bir ad donduruyor ama o HOST'tan cozuluyor ve
     * giris oncesi calisiyor. Panelde gosterilmesi gereken, oturumun
     * YONETTIGI site: master panelden baska bir kiraciya gecildiginde
     * host ayni kalir, yonetilen site degisir. Host'tan okunan ad o
     * durumda yanlis site adi gosterirdi.
     */
    let siteAdi = '';
    try {
      const tenants = await loadTenants();
      const tenant = tenants.find((item) => item.id === getManageableTenantId(u, tenants));
      siteAdi = String(tenant?.adminTitle || tenant?.siteName || '').trim();
    } catch {
      // Kiraci okunamazsa panel calismaya devam etsin; rozet yedege duser.
    }

    return reply.send({ ok: true, user: u, siteAdi });
  });

  // ─── Bonus Panel Login ───────────────────────────────────────────────────
  app.get('/api/admin/staff-users', async (request: any, reply: FastifyReply) => {
    const user = request.session?.user as SessionUser | undefined;
    if (user?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });

    const tenants = await loadTenants();
    const tenantId = getManageableTenantId(user, tenants);
    const tenant = tenants.find((item) => item.id === tenantId);
    if (!tenant) return reply.status(404).send({ ok: false, message: 'Panel bulunamadı' });

    const users = (tenant.staffUsers || []).map(({ passwordHash, password, ...staff }) => staff);
    return reply.send({ ok: true, data: users });
  });

  app.post('/api/admin/staff-users', async (request: any, reply: FastifyReply) => {
    const user = request.session?.user as SessionUser | undefined;
    if (user?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });

    const { name, username, password, role, permissions, isActive } = request.body || {};
    const cleanName = String(name || '').trim();
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '').trim();
    if (!cleanName || !cleanUsername || !cleanPassword) {
      return reply.status(400).send({ ok: false, message: 'Ad, kullanıcı adı ve şifre zorunludur' });
    }

    const tenants = await loadTenants();
    const tenantId = getManageableTenantId(user, tenants);
    const tenant = tenants.find((item) => item.id === tenantId);
    if (!tenant) return reply.status(404).send({ ok: false, message: 'Panel bulunamadı' });
    tenant.staffUsers = tenant.staffUsers || [];
    const usernameTaken = tenants.some((item) =>
      item.adminEmail === cleanUsername || item.staffUsers?.some((staff) => staff.username === cleanUsername)
    );
    if (usernameTaken) return reply.status(409).send({ ok: false, message: 'Bu kullanıcı adı zaten kullanılıyor' });

    const newStaff = {
      id: crypto.randomUUID(),
      name: cleanName,
      username: cleanUsername,
      passwordHash: await hashPassword(cleanPassword),
      role: role || 'operator',
      permissions: Array.isArray(permissions) ? permissions.map(String) : [],
      isActive: typeof isActive === 'boolean' ? isActive : true,
      createdAt: new Date().toISOString(),
    };
    tenant.staffUsers.push(newStaff as any);
    await saveTenants(tenants);
    const { passwordHash, password: legacyPassword, ...safeStaff } = newStaff as any;
    return reply.send({ ok: true, data: safeStaff });
  });

  app.put('/api/admin/staff-users/:id', async (request: any, reply: FastifyReply) => {
    const user = request.session?.user as SessionUser | undefined;
    if (user?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });

    const { id } = request.params as { id: string };
    const { name, username, password, role, permissions, isActive } = request.body || {};
    const tenants = await loadTenants();
    const tenantId = getManageableTenantId(user, tenants);
    const tenant = tenants.find((item) => item.id === tenantId);
    if (!tenant) return reply.status(404).send({ ok: false, message: 'Panel bulunamadı' });

    const staff = tenant.staffUsers?.find((item) => item.id === id);
    if (!staff) return reply.status(404).send({ ok: false, message: 'Çalışan bulunamadı' });

    if (username !== undefined) {
      const cleanUsername = String(username || '').trim();
      if (!cleanUsername) return reply.status(400).send({ ok: false, message: 'Kullanıcı adı boş olamaz' });
      const usernameTaken = tenants.some((item) =>
        item.adminEmail === cleanUsername || item.staffUsers?.some((candidate) => candidate.id !== id && candidate.username === cleanUsername)
      );
      if (usernameTaken) return reply.status(409).send({ ok: false, message: 'Bu kullanıcı adı zaten kullanılıyor' });
      staff.username = cleanUsername;
    }
    if (name !== undefined) staff.name = String(name || '').trim();
    if (role !== undefined) staff.role = role;
    if (Array.isArray(permissions)) staff.permissions = permissions.map(String);
    if (typeof isActive === 'boolean') staff.isActive = isActive;
    if (password !== undefined && String(password).trim()) {
      staff.passwordHash = await hashPassword(String(password).trim());
      delete staff.password;
    }

    await saveTenants(tenants);
    const { passwordHash, password: legacyPassword, ...safeStaff } = staff as any;
    return reply.send({ ok: true, data: safeStaff });
  });

  app.delete('/api/admin/staff-users/:id', async (request: any, reply: FastifyReply) => {
    const user = request.session?.user as SessionUser | undefined;
    if (user?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });

    const { id } = request.params as { id: string };
    const tenants = await loadTenants();
    const tenantId = getManageableTenantId(user, tenants);
    const tenant = tenants.find((item) => item.id === tenantId);
    if (!tenant) return reply.status(404).send({ ok: false, message: 'Panel bulunamadı' });
    tenant.staffUsers = (tenant.staffUsers || []).filter((item) => item.id !== id);
    await saveTenants(tenants);
    return reply.send({ ok: true });
  });

  app.post('/api/bonus-panel/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request: FastifyRequest<{ Body: { username?: string } }>, reply: FastifyReply) => {
    const { username } = (request.body as { username?: string }) || {};
    const inputUser = String(username || '').trim();

    console.log(`[bonus-panel] Yeni giriş denemesi: "${inputUser}"`);

    if (!inputUser) {
      throw new ServiceError('Kullanıcı adı girin', 400);
    }

    const { findClientByLogin } = await import('./bonusPanelHelper.js');
    const found = await findClientByLogin(inputUser);
    if (found) {
      const panelUser: BonusPanelUser = { login: inputUser };
      (request as any).session.bonusPanelUser = panelUser;
      await (request as any).session.save();
      console.log(`[bonus-panel] Giriş başarılı: "${inputUser}"`);
      return reply.send({ ok: true, login: inputUser });
    }

    console.log(`[bonus-panel] Giriş başarısız (Geçersiz kullanıcı): "${inputUser}"`);
    throw new ServiceError('Geçersiz kullanıcı adı', 401);
  });

  app.get('/api/bonus-panel/me', async (request: any, reply: FastifyReply) => {
    const panelUser = request.session?.bonusPanelUser as BonusPanelUser | undefined;
    if (!panelUser?.login) return reply.send({ ok: false });
    return reply.send({ ok: true, login: panelUser.login });
  });

  app.post('/api/bonus-panel/logout', async (request: any, reply: FastifyReply) => {
    request.session.bonusPanelUser = undefined;
    await request.session.save();
    return reply.send({ ok: true });
  });
}

