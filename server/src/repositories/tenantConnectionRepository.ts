import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { coz, sifrele, sifreliMi } from '../lib/secretBox.js';
import { safeTenantKey } from '../lib/tenantContext.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONNECTION_DIR = join(__dirname, '..', 'data', 'tenant-connections');

/**
 * ALT SİTELERİN KENDİ LYNON/BACKOFFICE BAĞLANTISI.
 *
 * Her tenant kendi backoffice'ine bağlanır: farklı site kimliği, farklı
 * panel kullanıcısı, farklı OTP sırrı. Bu kayıt yalnızca ORTAM
 * DEĞİŞKENİNİ EZER — alan boş bırakılırsa `config.lynon` içindeki ENV
 * değeri geçerli kalır. Mevcut tek siteli kurulum hiçbir kayıt olmadan
 * eskisi gibi çalışmaya devam eder.
 */

export interface TenantLynonConnection {
  enabled?: boolean;
  backofficeBaseUrl?: string;
  idBaseUrl?: string;
  returnUrl?: string;
  siteId?: number;
  currency?: string;
  username?: string;
  /** Şifreli saklanır. */
  password?: string;
  /** Şifreli saklanır. */
  otpSecret?: string;
  /** Şifreli saklanır. */
  otpToken?: string;
  deviceFingerprint?: string;
  trustDevice?: boolean;
  otpAlgorithm?: string;
  otpDigits?: number;
  otpPeriodSeconds?: number;
  /** `sl-timezone` başlığı; site başka bir dilimde çalışıyorsa. */
  timezoneOffset?: number;
}

export interface TenantBackofficeConnection {
  /** Şifreli saklanır. */
  authToken?: string;
  /** Şifreli saklanır. */
  dashboardAuthToken?: string;
}

export interface TenantConnection {
  version: 1;
  lynon: TenantLynonConnection;
  backoffice: TenantBackofficeConnection;
  updatedAt?: string;
  updatedBy?: string;
}

/** Şifrelenerek saklanan alanlar; okurken çözülür, yazarken şifrelenir. */
const LYNON_SIRLARI = ['password', 'otpSecret', 'otpToken'] as const;
const BACKOFFICE_SIRLARI = ['authToken', 'dashboardAuthToken'] as const;

export const bosBaglanti = (): TenantConnection => ({ version: 1, lynon: {}, backoffice: {} });

function dosyaYolu(tenantKey: string): string {
  return join(CONNECTION_DIR, `${safeTenantKey(tenantKey)}.json`);
}

function sirlariCoz(kayit: TenantConnection): TenantConnection {
  const lynon: TenantLynonConnection = { ...kayit.lynon };
  for (const alan of LYNON_SIRLARI) {
    const deger = lynon[alan];
    if (sifreliMi(deger)) {
      const acik = coz(deger);
      // Çözülemeyen sır (anahtar döndürülmüş) YOK sayılır; ENV değerine
      // düşülür ve panelde yeniden girilmesi istenir. Şifreli metni
      // olduğu gibi bırakmak Lynon'a çöp parola göndermek olurdu.
      if (acik === null) delete lynon[alan];
      else lynon[alan] = acik;
    }
  }

  const backoffice: TenantBackofficeConnection = { ...kayit.backoffice };
  for (const alan of BACKOFFICE_SIRLARI) {
    const deger = backoffice[alan];
    if (sifreliMi(deger)) {
      const acik = coz(deger);
      if (acik === null) delete backoffice[alan];
      else backoffice[alan] = acik;
    }
  }

  return { ...kayit, lynon, backoffice };
}

function sirlariSifrele(kayit: TenantConnection): TenantConnection {
  const lynon: TenantLynonConnection = { ...kayit.lynon };
  for (const alan of LYNON_SIRLARI) {
    const deger = lynon[alan];
    if (typeof deger === 'string' && deger !== '' && !sifreliMi(deger)) lynon[alan] = sifrele(deger);
  }

  const backoffice: TenantBackofficeConnection = { ...kayit.backoffice };
  for (const alan of BACKOFFICE_SIRLARI) {
    const deger = backoffice[alan];
    if (typeof deger === 'string' && deger !== '' && !sifreliMi(deger)) backoffice[alan] = sifrele(deger);
  }

  return { ...kayit, lynon, backoffice };
}

/** Sırları ÇÖZÜLMÜŞ bağlantı kaydı. Yalnızca sunucu içi kullanım. */
export async function loadTenantConnection(tenantKey: string): Promise<TenantConnection> {
  const key = safeTenantKey(tenantKey);
  const kayit = await readStoredDocument<TenantConnection>({
    tenantKey: key,
    namespace: 'tenant-connection',
    filePath: dosyaYolu(key),
    fallback: bosBaglanti,
  });
  return sirlariCoz({
    version: 1,
    lynon: kayit?.lynon && typeof kayit.lynon === 'object' ? kayit.lynon : {},
    backoffice: kayit?.backoffice && typeof kayit.backoffice === 'object' ? kayit.backoffice : {},
    updatedAt: kayit?.updatedAt,
    updatedBy: kayit?.updatedBy,
  });
}

export async function saveTenantConnection(tenantKey: string, kayit: TenantConnection): Promise<void> {
  const key = safeTenantKey(tenantKey);
  await writeStoredDocument(
    { tenantKey: key, namespace: 'tenant-connection', filePath: dosyaYolu(key) },
    sirlariSifrele(kayit),
  );
}
