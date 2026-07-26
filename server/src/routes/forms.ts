import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveTenantKeyForRequest, safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEGACY_FORMS_DATA_FILE = path.join(__dirname, '..', 'data', 'forms-data.json');
const LEGACY_FORMS_SETTINGS_FILE = path.join(__dirname, '..', 'data', 'forms-settings.json');
const TENANT_FORMS_DIR = path.join(__dirname, '..', 'data', 'forms-data');
const TENANT_FORMS_SETTINGS_DIR = path.join(__dirname, '..', 'data', 'forms-settings');

function tenantFormsPath(tenantKey: string) {
  return path.join(TENANT_FORMS_DIR, `${safeTenantKey(tenantKey)}.json`);
}

function tenantFormsSettingsPath(tenantKey: string) {
  return path.join(TENANT_FORMS_SETTINGS_DIR, `${safeTenantKey(tenantKey)}.json`);
}

function defaultSettings() {
  return {
    callReasons: ['Finansal İşlemler (Para Yatırma/Çekme)', 'Bonus İşlemleri', 'Hesap ve Profil İşlemleri', 'Diğer (Şikayet / Öneri)'],
    partnershipTypes: ['Telegram Grubu', 'Yayıncı (Twitch/Kick)', 'YouTube / Sosyal Medya', 'Diğer'],
    callActive: true,
    partnershipActive: true,
    callTitle: 'Beni Ara',
    callDescription: 'Müşteri temsilcilerimizin sizi araması için form doldurun.',
    callSuccessMessage: 'Talebiniz alınmıştır. Sizi en kısa sürede arayacağız.',
    callButtonText: 'Talep Gönder',
    partnershipTitle: 'Ortaklık Başvurusu',
    partnershipDescription: 'Telegram grubu sahipleri, yayıncılar ve partnerler için ortaklık formu.',
    partnershipSuccessMessage: 'Ortaklık talebiniz başarıyla alınmıştır. Ekibimiz sizinle iletişime geçecektir.',
    partnershipButtonText: 'Başvuru Gönder',
  };
}

async function readSettings(tenantKey = 'default') {
  return readStoredDocument<any>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'forms-settings',
    filePath: tenantFormsSettingsPath(tenantKey),
    fallback: () => {
      if (tenantKey === 'default' && fs.existsSync(LEGACY_FORMS_SETTINGS_FILE)) {
        try { return JSON.parse(fs.readFileSync(LEGACY_FORMS_SETTINGS_FILE, 'utf-8')); } catch { /* use defaults */ }
      }
      return defaultSettings();
    },
  });
}

async function writeSettings(data: any, tenantKey = 'default') {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'forms-settings', filePath: tenantFormsSettingsPath(tenantKey) },
    data,
  );
}

async function readForms(tenantKey = 'default') {
  return readStoredDocument<any>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'forms-data',
    filePath: tenantFormsPath(tenantKey),
    fallback: () => {
      if (tenantKey === 'default' && fs.existsSync(LEGACY_FORMS_DATA_FILE)) {
        try { return JSON.parse(fs.readFileSync(LEGACY_FORMS_DATA_FILE, 'utf-8')); } catch { /* use defaults */ }
      }
      return { callRequests: [], partnershipRequests: [], vipRequests: [] };
    },
  });
}

async function writeForms(data: any, tenantKey = 'default') {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'forms-data', filePath: tenantFormsPath(tenantKey) },
    data,
  );
}

export async function formsRoutes(app: FastifyInstance) {
  app.get('/forms/settings', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    return reply.send({ ok: true, data: await readSettings(tenantKey) });
  });

  app.post('/forms/call', async (request: any, reply) => {
    const { username, phone, reason } = request.body || {};
    if (!username || !phone) {
      return reply.status(400).send({ ok: false, message: 'Kullanıcı adı ve telefon zorunludur.' });
    }

    const tenantKey = await resolveTenantKeyForRequest(request);
    const db = await readForms(tenantKey);
    db.callRequests.unshift({
      id: Date.now().toString(),
      username,
      phone,
      reason: reason || 'Belirtilmedi',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    await writeForms(db, tenantKey);
    return reply.send({ ok: true, message: 'Talebiniz alınmıştır. Sizi en kısa sürede arayacağız.' });
  });

  app.post('/forms/partnership', async (request: any, reply) => {
    const { type, contact, channelUrl, audienceSize, message } = request.body || {};
    if (!contact || !channelUrl) {
      return reply.status(400).send({ ok: false, message: 'İletişim bilgisi ve Kanal/Sayfa URL zorunludur.' });
    }

    const tenantKey = await resolveTenantKeyForRequest(request);
    const db = await readForms(tenantKey);
    db.partnershipRequests.unshift({
      id: Date.now().toString(),
      type: type || 'Yayıncı',
      contact,
      channelUrl,
      audienceSize: audienceSize || '',
      message: message || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    await writeForms(db, tenantKey);
    return reply.send({ ok: true, message: 'Ortaklık talebiniz başarıyla alınmıştır. Ekibimiz sizinle iletişime geçecektir.' });
  });

  app.get('/admin/forms', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request);
    return reply.send({ ok: true, data: await readForms(tenantKey) });
  });

  app.post('/admin/forms/update', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Yetkisiz' });

    const { collection, id, status } = request.body || {};
    const tenantKey = await resolveTenantKeyForRequest(request);
    const db = await readForms(tenantKey);

    const { note } = request.body || {};

    if (collection === 'call' && db.callRequests) {
      const idx = db.callRequests.findIndex((r: any) => r.id === id);
      if (idx > -1) {
        if (status !== undefined) db.callRequests[idx].status = status;
        if (note !== undefined) db.callRequests[idx].note = note;
      }
    } else if (collection === 'partnership' && db.partnershipRequests) {
      const idx = db.partnershipRequests.findIndex((r: any) => r.id === id);
      if (idx > -1) {
        if (status !== undefined) db.partnershipRequests[idx].status = status;
        if (note !== undefined) db.partnershipRequests[idx].note = note;
      }
    }

    await writeForms(db, tenantKey);
    return reply.send({ ok: true });
  });

  app.post('/admin/forms/delete', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Yetkisiz' });

    const { collection, id } = request.body || {};
    const tenantKey = await resolveTenantKeyForRequest(request);
    const db = await readForms(tenantKey);

    if (collection === 'call' && db.callRequests) {
      db.callRequests = db.callRequests.filter((r: any) => r.id !== id);
    } else if (collection === 'partnership' && db.partnershipRequests) {
      db.partnershipRequests = db.partnershipRequests.filter((r: any) => r.id !== id);
    }

    await writeForms(db, tenantKey);
    return reply.send({ ok: true });
  });

  app.post('/forms/vip', async (request: any, reply) => {
    const { username, name, email, phone } = request.body || {};
    if (!username) {
      return reply.status(400).send({ ok: false, message: 'Kullanıcı adı zorunludur.' });
    }
    const tenantKey = await resolveTenantKeyForRequest(request);
    const db = await readForms(tenantKey);
    if (!Array.isArray(db.vipRequests)) db.vipRequests = [];
    db.vipRequests.unshift({
      id: Date.now().toString(),
      username,
      name: name || '',
      email: email || '',
      phone: phone || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    await writeForms(db, tenantKey);
    return reply.send({ ok: true, message: 'VIP başvurunuz alındı. Ekibimiz sizinle iletişime geçecek.' });
  });

  app.post('/admin/forms/vip/update', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Yetkisiz' });
    const { id, status, note } = request.body || {};
    const tenantKey = await resolveTenantKeyForRequest(request);
    const db = await readForms(tenantKey);
    if (!Array.isArray(db.vipRequests)) db.vipRequests = [];
    const idx = db.vipRequests.findIndex((r: any) => r.id === id);
    if (idx > -1) {
      if (status !== undefined) db.vipRequests[idx].status = status;
      if (note !== undefined) db.vipRequests[idx].note = note;
    }
    await writeForms(db, tenantKey);
    return reply.send({ ok: true });
  });

  app.post('/admin/forms/vip/delete', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Yetkisiz' });
    const { id } = request.body || {};
    const tenantKey = await resolveTenantKeyForRequest(request);
    const db = await readForms(tenantKey);
    if (!Array.isArray(db.vipRequests)) db.vipRequests = [];
    db.vipRequests = db.vipRequests.filter((r: any) => r.id !== id);
    await writeForms(db, tenantKey);
    return reply.send({ ok: true });
  });

  app.post('/admin/forms/settings', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Yetkisiz' });

    const tenantKey = await resolveTenantKeyForRequest(request);
    await writeSettings(request.body || {}, tenantKey);
    return reply.send({ ok: true });
  });
}
