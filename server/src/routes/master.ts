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
import { ensureTenantRuntime, tenantBaglantisiKurulduMu, tenantRuntimeYaz } from '../lib/tenantRuntimeConfig.js';
import { aktifTenantAnahtarlari } from '../lib/tenantFanout.js';
import { clearLynonSession, ensureLynonSession, getLynonAuthStatus, isLynonConfigured } from '../lib/lynonAuth.js';
import { hashPassword } from './auth.js';
import { kiraciTanilamasi } from '../lib/kiraciTanilama.js';
import { boolCozumle } from '../lib/baglantiAlanlari.js';
import { kalanSaniye, totpKodu, TotpHatasi } from '../lib/totp.js';
import { varsayilanTenantKey } from '../lib/tenantContext.js';

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
    const tenants = await loadTenants();
    // Her siteye "Lynon bağlantısı girilmiş mi" bilgisi ekleniyor.
    // Bağlantısı olmayan site artık ana sitenin kimlik bilgilerine
    // DÜŞMÜYOR, yani hiç veri gösteremez — bunu panelde görmek gerekiyor,
    // yoksa boş ekranın nedeni anlaşılmaz.
    const zenginlestirilmis = await Promise.all(tenants.map(async (tenant: any) => {
      await ensureTenantRuntime(tenant.id);
      return { ...tenant, baglantiKuruldu: tenantBaglantisiKurulduMu(tenant.id) };
    }));
    return reply.send({ ok: true, data: zenginlestirilmis });
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
       adminTitle: adminTitle || 'Arwen Software Solutions',
       createdAt: new Date().toISOString()
    };
    
    tenants.push(newTenant);
    await saveTenants(tenants);
    seedTenantFiles(newTenant.id);

    /**
     * BAGLANTI BILGILERI KURULUMLA AYNI ADIMDA.
     *
     * Once site olusturuluyor, sonra "Baglanti" penceresi acilip Lynon
     * bilgileri giriliyordu. Arada kalan sitenin hicbir kimligi yoktu ve
     * bu bos aralikta calisan her arka plan isi o site icin sessizce
     * ENV'deki (yani BASKA bir sitenin) bilgilerine dusuyordu.
     *
     * Alanlar opsiyonel: bos birakilirsa davranis eskisi gibi.
     */
    const gelenLynon = (request.body?.lynon || {}) as Record<string, unknown>;
    const gelenBackoffice = (request.body?.backoffice || {}) as Record<string, unknown>;
    const baglantiVerildi = Object.values({ ...gelenLynon, ...gelenBackoffice })
      .some((deger) => deger !== undefined && deger !== null && String(deger).trim() !== '');

    let baglantiUyarisi: string | null = null;
    if (baglantiVerildi) {
      if (sirGirildiMi(gelenLynon, gelenBackoffice) && !sifrelemeHazirMi()) {
        // Site OLUSTU; yalnizca sirlar yazilamadi. Bunu sessizce yutmak,
        // operatorun bilgileri girdigini sanmasina yol acardi.
        baglantiUyarisi = 'Site oluşturuldu ancak TENANT_SECRET_KEY tanımlı olmadığı için bağlantı bilgileri kaydedilemedi.';
      } else {
        const mevcut = await loadTenantConnection(newTenant.id);
        const kayitVerisi = baglantiAlanlariniUygula(mevcut, gelenLynon, gelenBackoffice);
        const kayit = { version: 1 as const, ...kayitVerisi, updatedAt: new Date().toISOString(), updatedBy: 'master' };
        try {
          await saveTenantConnection(newTenant.id, kayit);
          tenantRuntimeYaz(newTenant.id, kayit);
        } catch (error) {
          baglantiUyarisi = error instanceof Error ? error.message : 'Bağlantı bilgileri kaydedilemedi.';
        }
      }
    }

    return reply.send({
      ok: true,
      tenant: newTenant,
      generatedPassword: adminPassword ? undefined : generatedPassword,
      baglantiUyarisi,
    });
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

/**
   * Gelen bağlantı alanlarını mevcut kaydın ÜSTÜNE yazar.
   *
   * Hem "bağlantıyı güncelle" hem de "yeni site oluştur" bu fonksiyonu
   * kullanıyor. İki ayrı kopya olsaydı biri yeni bir alanı destekleyip
   * diğeri desteklemezdi ve fark ancak o alan sessizce kaydedilmediğinde
   * görünürdü -- `trustDevice` ile tam olarak bu yaşandı.
   *
   * TEK KURAL: boş = "değiştirme", "sil" DEĞİL. Sır alanları panele
   * maskeli döndüğü için form her açıldığında boş gelir; boşu kayda
   * yazsaydık, parolaya hiç dokunmadan "kaydet"e basmak sitenin Lynon
   * şifresini silerdi.
   */
  function baglantiAlanlariniUygula(
    mevcut: { lynon: TenantLynonConnection; backoffice: TenantBackofficeConnection },
    gelenLynon: Record<string, unknown>,
    gelenBackoffice: Record<string, unknown>,
  ): { lynon: TenantLynonConnection; backoffice: TenantBackofficeConnection } {
    const lynon: TenantLynonConnection = { ...mevcut.lynon };
    const backoffice: TenantBackofficeConnection = { ...mevcut.backoffice };
  
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
    const boolAta = <K extends keyof TenantLynonConnection>(alan: K, deger: unknown) => {
      const sonuc = boolCozumle(deger);
      if (sonuc.degisti) (lynon[alan] as unknown) = sonuc.deger;
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
    sayiAta('timezoneOffset', gelenLynon.timezoneOffset);
    boolAta('enabled', gelenLynon.enabled);
    boolAta('trustDevice', gelenLynon.trustDevice);
  
    if (typeof gelenBackoffice.authToken === 'string' && gelenBackoffice.authToken.trim()) {
      backoffice.authToken = gelenBackoffice.authToken.trim();
    }
    if (typeof gelenBackoffice.dashboardAuthToken === 'string' && gelenBackoffice.dashboardAuthToken.trim()) {
      backoffice.dashboardAuthToken = gelenBackoffice.dashboardAuthToken.trim();
    }
  
    return { lynon, backoffice };
  }
  
  /** Sır alanlarından herhangi biri girilmiş mi? Şifreleme gerektirir. */
  function sirGirildiMi(gelenLynon: Record<string, unknown>, gelenBackoffice: Record<string, unknown>): boolean {
    return [gelenLynon.password, gelenLynon.otpSecret, gelenLynon.otpToken, gelenBackoffice.authToken, gelenBackoffice.dashboardAuthToken]
      .some((deger) => typeof deger === 'string' && deger.trim() !== '');
  }

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
    const { lynon, backoffice } = baglantiAlanlariniUygula(mevcut, gelenLynon, gelenBackoffice);

    if (sirGirildiMi(gelenLynon, gelenBackoffice) && !sifrelemeHazirMi()) {
      return reply.status(400).send({
        ok: false,
        message: 'TENANT_SECRET_KEY tanımlı değil. Kimlik bilgileri şifrelenemediği için kaydedilmedi.',
      });
    }

    const kayit = { version: 1 as const, lynon, backoffice, updatedAt: new Date().toISOString(), updatedBy: 'master' };
    try {
      await saveTenantConnection(id, kayit);
    } catch (error) {
      return reply.status(400).send({ ok: false, message: error instanceof Error ? error.message : 'Kaydedilemedi' });
    }

    // Belleğe DOĞRUDAN yazılıyor: geçersiz kılıp yeniden okumak arada bir
    // pencere bırakırdı ve o anda gelen istek eski bağlantıyla çalışırdı.
    // Açık Lynon oturumu da artık eski bilgilere ait.
    tenantRuntimeYaz(id, kayit);
    clearLynonSession(safeTenantKey(id));

    return reply.send({ ok: true, baglantiKuruldu: tenantBaglantisiKurulduMu(id) });
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


  /**
   * SITENIN ANLIK TOTP KODU.
   *
   * Neden var: operator OTP sirrini kaydediyor ama dogru olup olmadigini
   * ancak bir sonraki gercek girisin dusmesiyle ogreniyordu -- ve o giris
   * bir rapor isinin ortasinda, gece yarisinda olabiliyor. Burasi sirri
   * KAYDETMEDEN once dogrulamayi mumkun kiliyor: uretilen kod
   * authenticator uygulamasindakiyle ayni ise sir dogrudur.
   *
   * Sirrin KENDISI donmez, yalnizca ondan turetilen 30 saniyelik kod.
   * Kod zaten panelin her Lynon girisinde urettigi degerin ayni; bu uc
   * yeni bir yetki vermiyor, var olani gorunur kiliyor. Yine de master
   * oturumu sart.
   */
  app.get('/master/tenants/:id/otp', async (request: any, reply) => {
    if (!request.session.isMaster) return reply.status(401).send({ error: 'Yetkisiz' });
    const { id } = request.params as any;
    if (!(await tenantVarMi(id))) return reply.status(404).send({ ok: false, message: 'Tenant bulunamadı' });

    const kayit = await loadTenantConnection(id);
    const token = String(kayit.lynon.otpToken ?? '').trim();
    const sir = String(kayit.lynon.otpSecret ?? '').trim();

    // Token alani ONCELIKLI -- giris akisi da oyle davraniyor
    // (lynonAuth.currentOtp). Burada farkli davransaydik onizleme
    // "calisiyor" derken giris baska bir kod gonderirdi.
    if (/^\d{6}$/.test(token)) {
      return reply.send({
        ok: true, kod: token, kaynak: 'token', sabit: true,
        kalanSaniye: null, periyot: null,
        uyari: 'Sabit OTP token tanımlı. Tek seferlik kodlar dakikalar içinde geçersiz olur; kalıcı çalışma için OTP sırrı kullanın.',
      });
    }

    if (!sir) {
      return reply.send({ ok: false, kaynak: 'yok', message: 'Bu site için OTP sırrı tanımlı değil.' });
    }

    try {
      const simdi = Date.now();
      const sonuc = totpKodu(sir, {
        algorithm: kayit.lynon.otpAlgorithm as never,
        digits: kayit.lynon.otpDigits as never,
        periodSeconds: kayit.lynon.otpPeriodSeconds as never,
      }, simdi);
      return reply.send({
        ok: true,
        kod: sonuc.kod,
        kaynak: sonuc.kaynak === 'anlikKod' ? 'token' : 'sir',
        sabit: sonuc.kaynak === 'anlikKod',
        periyot: sonuc.options.periodSeconds,
        kalanSaniye: sonuc.kaynak === 'anlikKod' ? null : kalanSaniye(sonuc.options.periodSeconds, simdi),
        algoritma: sonuc.options.algorithm,
        hane: sonuc.options.digits,
      });
    } catch (hata) {
      return reply.send({
        ok: false,
        kaynak: 'sir',
        message: hata instanceof TotpHatasi
          ? 'OTP sırrı geçerli bir Base32 TOTP secret değil. Authenticator kurulum sırrını (A-Z, 2-7) yazın.'
          : 'Kod üretilemedi.',
      });
    }
  });

  /**
   * COK KIRACILI DURUM OZETI.
   *
   * Master paneli site listesini gosteriyordu ama COZUMLEMENIN nasil
   * calistigini gostermiyordu. DB silindiginde site sayisi sifira
   * dustu ve her istek "default" kiracisina dusmeye basladi -- panel
   * calismaya devam ettigi icin haftalarca fark edilmedi. Uyariyi,
   * duzeltmenin yapilacagi yerde gostermek icin bu uc var.
   */
  app.get('/master/durum', async (request: any, reply) => {
    if (!request.session.isMaster) return reply.status(401).send({ error: 'Yetkisiz' });
    const tenants = (await loadTenants()) as Array<any>;
    const yedek = varsayilanTenantKey();

    // Ayni domain iki siteye yazilmissa host eslesmesi ilk eslesene
    // gider ve digeri SESSIZCE erisilemez olur.
    const sayac = new Map<string, string[]>();
    for (const t of tenants) {
      const d = String(t?.domain ?? '').trim().toLowerCase().replace(/^www\./, '');
      if (!d) continue;
      sayac.set(d, [...(sayac.get(d) ?? []), String(t?.siteName || t?.id || '?')]);
    }
    const cakisanlar = [...sayac.entries()].filter(([, l]) => l.length > 1)
      .map(([domain, siteler]) => ({ domain, siteler }));

    return reply.send({
      ok: true,
      tanilama: kiraciTanilamasi(tenants, yedek),
      yedekAnahtar: yedek,
      alanAdiOlmayan: tenants
        .filter((t) => t?.isActive !== false && !String(t?.domain ?? '').trim())
        .map((t) => String(t?.siteName || t?.id || '?')),
      cakisanAlanAdlari: cakisanlar,
    });
  });

  /** Arka plan işlerinin durumu; hangi site için ne zaman çalıştığı. */
  app.get('/master/jobs', async (request: any, reply) => {
    if (!request.session.isMaster) return reply.status(401).send({ error: 'Yetkisiz' });
    const { scheduler } = await import('../jobs/scheduler.js');
    return reply.send({ ok: true, data: scheduler.getStatus(), siteler: await aktifTenantAnahtarlari() });
  });
}
