/**
 * Environment Validation
 *
 * Uygulama başlarken zorunlu ve opsiyonel env variable'ları doğrular.
 * Eksik veya geçersiz değerler için anlaşılır hata mesajları üretir.
 */

interface EnvRule {
  key: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  validatorMessage?: string;
}

const ENV_RULES: EnvRule[] = [
  // ─── Zorunlu (en az birinin olması gerekli) ────────────────────────────────
  {
    key: 'AUTH_TOKEN',
    required: false,
    description: 'BetConstruct backoffice auth token (alternatif: DASHBOARD_AUTH veya BACKOFFICE_AUTH)',
  },
  {
    key: 'DASHBOARD_AUTH',
    required: false,
    description: 'BetConstruct dashboard auth token (alternatif: AUTH_TOKEN)',
  },
  {
    key: 'LYNON_PANEL_USERNAME',
    required: false,
    description: 'Lynon backoffice panel kullanici adi',
  },
  {
    key: 'LYNON_PANEL_PASSWORD',
    required: false,
    description: 'Lynon backoffice panel sifresi',
  },
  {
    key: 'LYNON_PANEL_OTP_SECRET',
    required: false,
    description: 'Lynon TOTP secret (alternatif: LYNON_PANEL_OTP_TOKEN/PANEL_OTP_TOKEN)',
  },

  // ─── Güvenlik ──────────────────────────────────────────────────────────────
  {
    key: 'SESSION_SECRET',
    required: false,
    description: 'Session cookie imzalama anahtarı (min 32 karakter)',
    validator: (v) => v.length >= 32,
    validatorMessage: 'En az 32 karakter olmalı',
  },

  // ─── Opsiyonel ─────────────────────────────────────────────────────────────
  {
    key: 'NODE_ENV',
    required: false,
    description: 'Ortam (development | production)',
    validator: (v) => ['development', 'production', 'test'].includes(v),
    validatorMessage: 'development, production veya test olmalı',
  },
  {
    key: 'PORT',
    required: false,
    description: 'Sunucu portu',
    validator: (v) => !isNaN(Number(v)) && Number(v) > 0 && Number(v) < 65536,
    validatorMessage: 'Geçerli bir port numarası olmalı (1-65535)',
  },
];

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Zorunlu token kontrolü (en az birinin olması gerekli)
  const hasToken = !!(
    process.env.AUTH_TOKEN ||
    process.env.DASHBOARD_AUTH ||
    process.env.BACKOFFICE_AUTH
  );
  const hasLynonCredentials = !!(
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

  if (!hasToken && !hasLynonCredentials) {
    errors.push(
      'AUTH_TOKEN, DASHBOARD_AUTH veya BACKOFFICE_AUTH tanımlı değil. ' +
      'BetConstruct API istekleri çalışmayacak. .env dosyasına en az birini ekleyin.'
    );
  }

  // Tüm kuralları kontrol et
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 64) {
      errors.push('SESSION_SECRET production icin zorunlu ve en az 64 karakter olmali.');
    }
    if (!process.env.MASTER_USER || !process.env.MASTER_PASS) {
      errors.push('MASTER_USER ve MASTER_PASS production icin zorunlu.');
    }
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === 'true' || process.env.CORS_ORIGIN === '*') {
      errors.push('CORS_ORIGIN production icin net domain olmali; true veya * kullanmayin.');
    }
    if (['1', 'true', 'yes', 'on'].includes(String(process.env.PANEL_AUTH_DISABLED || '').toLowerCase())) {
      errors.push('PANEL_AUTH_DISABLED production ortaminda acik olamaz.');
    }
  }

  for (const rule of ENV_RULES) {
    const value = process.env[rule.key];

    if (rule.required && !value) {
      errors.push(`${rule.key} tanımlı değil — ${rule.description}`);
      continue;
    }

    if (value && rule.validator && !rule.validator(value)) {
      warnings.push(`${rule.key}: ${rule.validatorMessage} (mevcut: "${value.slice(0, 20)}...")`);
    }

    if (!value && !rule.required) {
      // Bazı opsiyonel değerler için uyarı
      if (rule.key === 'SESSION_SECRET') {
        warnings.push(`${rule.key} tanımlı değil — ${rule.description}. Varsayılan değer kullanılacak (GÜVENLİ DEĞİL).`);
      }
    }
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings };
}

/**
 * Uygulama başlangıcında çağrılır.
 * Hatalar varsa loglar ve production'da uygulamayı durdurur.
 */
export function enforceEnvironment(): void {
  const result = validateEnvironment();

  if (result.warnings.length > 0) {
    console.warn('[env-check] Uyarılar:');
    result.warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
  }

  if (result.errors.length > 0) {
    console.error('[env-check] Hatalar:');
    result.errors.forEach((e) => console.error(`  ✖ ${e}`));

    if (process.env.NODE_ENV === 'production') {
      console.error('[env-check] Production ortamında zorunlu değişkenler eksik. Uygulama durduruluyor.');
      process.exit(1);
    } else {
      console.warn('[env-check] Geliştirme ortamında devam ediliyor ancak bazı özellikler çalışmayabilir.');
    }
  } else {
    console.log('[env-check] Tüm ortam değişkenleri doğrulandı.');
  }
}
