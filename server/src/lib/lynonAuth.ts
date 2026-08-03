import { createHash, createHmac } from 'crypto';
import { config } from '../config.js';
import { LYNON_SL_TIMEZONE } from './istanbulGunu.js';

type JsonValue = unknown;

export class LynonAuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
    this.name = 'LynonAuthError';
  }
}

export class LynonHttpError extends Error {
  constructor(message: string, public status: number, public data: JsonValue) {
    super(message);
    this.name = 'LynonHttpError';
  }
}

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  hostOnly: boolean;
  secure: boolean;
}

class CookieJar {
  private readonly cookies = new Map<string, StoredCookie>();

  addFromResponse(headers: Headers, responseUrl: string): void {
    const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
    const headerValues = typeof getSetCookie === 'function'
      ? getSetCookie.call(headers)
      : splitSetCookieHeader(headers.get('set-cookie'));

    const parsedUrl = new URL(responseUrl);
    for (const header of headerValues) {
      const parts = header.split(';').map((part) => part.trim()).filter(Boolean);
      const pair = parts[0];
      if (!pair) continue;
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;

      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      let domain = parsedUrl.hostname.toLowerCase();
      let path = defaultCookiePath(parsedUrl.pathname);
      let hostOnly = true;
      let secure = false;
      let shouldDelete = false;

      for (const attr of parts.slice(1)) {
        const attrEq = attr.indexOf('=');
        const rawKey = attrEq >= 0 ? attr.slice(0, attrEq) : attr;
        const rawValue = attrEq >= 0 ? attr.slice(attrEq + 1) : '';
        const key = rawKey.trim().toLowerCase();
        const attrValue = rawValue.trim();
        if (key === 'domain' && attrValue) {
          domain = attrValue.replace(/^\./, '').toLowerCase();
          hostOnly = false;
        } else if (key === 'path' && attrValue.startsWith('/')) {
          path = attrValue;
        } else if (key === 'secure') {
          secure = true;
        } else if (key === 'max-age' && Number(attrValue) <= 0) {
          shouldDelete = true;
        } else if (key === 'expires') {
          const expiresAt = Date.parse(attrValue);
          if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) shouldDelete = true;
        }
      }

      const key = `${domain}\t${path}\t${name}`;
      if (shouldDelete) {
        this.cookies.delete(key);
      } else {
        this.cookies.set(key, { name, value, domain, path, hostOnly, secure });
      }
    }
  }

  header(requestUrl: string): string {
    const parsedUrl = new URL(requestUrl);
    const host = parsedUrl.hostname.toLowerCase();
    const path = parsedUrl.pathname || '/';
    return Array.from(this.cookies.values())
      .filter((cookie) => cookieMatches(cookie, host, path, parsedUrl.protocol === 'https:'))
      .sort((a, b) => b.path.length - a.path.length)
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }

  get size(): number {
    return this.cookies.size;
  }

  names(): string[] {
    return Array.from(new Set(Array.from(this.cookies.values()).map((cookie) => cookie.name))).sort();
  }

  scopes(): string[] {
    return Array.from(this.cookies.values())
      .map((cookie) => `${cookie.name}@${cookie.hostOnly ? '' : '.'}${cookie.domain}${cookie.path}`)
      .sort();
  }
}

interface LynonSession {
  jar: CookieJar;
  authenticatedAt: number;
  sessionToken?: string;
  redirectTrace?: Array<{ status: number; host: string; path: string; hasLocation: boolean; setCookie: boolean }>;
}

let activeSession: LynonSession | null = null;
let loginPromise: Promise<LynonSession> | null = null;

interface TotpOptions {
  algorithm: 'sha1' | 'sha256' | 'sha512';
  digits: number;
  periodSeconds: number;
}

interface ParsedTotpSecret {
  secret: string;
  options: TotpOptions;
}

function splitSetCookieHeader(header: string | null): string[] {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,=\s]+=)/g).map((part) => part.trim()).filter(Boolean);
}

function defaultCookiePath(pathname: string): string {
  if (!pathname || !pathname.startsWith('/')) return '/';
  const lastSlash = pathname.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return pathname.slice(0, lastSlash);
}

function domainMatches(cookie: StoredCookie, host: string): boolean {
  if (cookie.hostOnly) return host === cookie.domain;
  return host === cookie.domain || host.endsWith(`.${cookie.domain}`);
}

function pathMatches(cookiePath: string, requestPath: string): boolean {
  if (requestPath === cookiePath) return true;
  if (!requestPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith('/') || requestPath.charAt(cookiePath.length) === '/';
}

function cookieMatches(cookie: StoredCookie, host: string, path: string, isHttps: boolean): boolean {
  if (cookie.secure && !isHttps) return false;
  return domainMatches(cookie, host) && pathMatches(cookie.path, path);
}

function parseMaybeJson(text: string): JsonValue {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return trimmed;
  }
}

function asRecord(value: JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function originOf(url: string): string {
  return new URL(url).origin;
}

/**
 * SITE VE SAAT DILIMI BASLIKLARI.
 *
 * Lynon backoffice arayuzu her istekte `sl-id` ve `sl-timezone`
 * gonderiyor; panel ikisini de HIC gondermiyordu.
 *
 * `sl-timezone` eksikligi olculebilir bir hataya yol aciyordu: Lynon,
 * tarih-only parametreleri (`startDate=2026-08-03`) baslik yokken UTC
 * sayiyor ve pencere Turkiye saatiyle 03:00'te basliyor. Ayni gun icin
 * Lynon arayuzu 12.010 TL yatirim / 3.400 TL cekim gosterirken panel
 * 1.010 TL / 0 TL donduruyordu — fark tam olarak 00:00-03:00 arasindaki
 * islemlerdi.
 *
 * Deger `LYNON_SL_TIMEZONE` icinde tek kaynaktan geliyor; isaret kurali
 * orada anlatiliyor. `LYNON_TIMEZONE_OFFSET` ile ezilebilir (baska bir
 * dilimde calisan bir site icin).
 */
export function siteHeaders(): Record<string, string> {
  const ofset = process.env.LYNON_TIMEZONE_OFFSET?.trim();
  const dilim = ofset && ofset !== '' && Number.isFinite(Number(ofset))
    ? Number(ofset)
    : LYNON_SL_TIMEZONE;
  return {
    'sl-id': String(config.lynon.siteId),
    'sl-timezone': String(dilim),
  };
}

function commonHeaders(baseUrl: string): Record<string, string> {
  const origin = originOf(baseUrl);
  return {
    Accept: 'application/json, text/plain, */*',
    Origin: origin,
    Referer: `${origin}/`,
    ...siteHeaders(),
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  };
}

function resolveLocation(location: string, baseUrl: string): string {
  try {
    return new URL(location, baseUrl).toString();
  } catch {
    return location;
  }
}

async function discoverReturnUrl(jar: CookieJar): Promise<string> {
  const explicit = String(process.env.LYNON_RETURN_URL || '').trim();
  if (explicit) return explicit;

  let currentUrl = config.lynon.backofficeBaseUrl;
  for (let i = 0; i < 8; i++) {
    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        ...commonHeaders(currentUrl),
        Cookie: jar.header(currentUrl),
      },
    });
    jar.addFromResponse(response.headers, currentUrl);
    const location = response.headers.get('location');
    if (!location) break;
    const nextUrl = resolveLocation(location, currentUrl);
    const parsed = new URL(nextUrl);
    const returnUrl = parsed.searchParams.get('ReturnUrl');
    if (returnUrl) return returnUrl;
    currentUrl = nextUrl;
  }

  return config.lynon.returnUrl;
}

async function completeBackofficeRedirect(returnUrl: string, jar: CookieJar): Promise<LynonSession['redirectTrace']> {
  const trace: NonNullable<LynonSession['redirectTrace']> = [];
  if (!returnUrl) return trace;

  let currentUrl = returnUrl.startsWith('http')
    ? returnUrl
    : `${config.lynon.idBaseUrl.replace(/\/$/, '')}/${returnUrl.replace(/^\//, '')}`;
  let method: 'GET' | 'POST' = 'GET';
  let formBody: URLSearchParams | null = null;
  let formSubmitFromUrl: string | null = null;

  for (let i = 0; i < 8; i++) {
    const response = await fetch(currentUrl, {
      method,
      redirect: 'manual',
      headers: {
        ...commonHeaders(currentUrl),
        ...(method === 'POST' && formSubmitFromUrl
          ? { Origin: originOf(formSubmitFromUrl), Referer: formSubmitFromUrl }
          : {}),
        ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        Cookie: jar.header(currentUrl),
      },
      body: method === 'POST' && formBody ? formBody.toString() : undefined,
    });
    const parsed = new URL(currentUrl);
    trace.push({
      status: response.status,
      host: parsed.host,
      path: parsed.pathname,
      hasLocation: Boolean(response.headers.get('location')),
      setCookie: Boolean(response.headers.get('set-cookie')),
    });
    jar.addFromResponse(response.headers, currentUrl);

    const location = response.headers.get('location');
    if (location && response.status >= 300 && response.status < 400) {
      currentUrl = resolveLocation(location, currentUrl);
      method = 'GET';
      formBody = null;
      formSubmitFromUrl = null;
      continue;
    }

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('text/html')) {
      const html = await response.text();
      const form = extractHtmlForm(html, currentUrl);
      if (form) {
        formSubmitFromUrl = currentUrl;
        currentUrl = form.action;
        method = form.method;
        formBody = form.body;
        continue;
      }
    }

    return trace;
  }
  return trace;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getHtmlAttribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? decodeHtmlAttribute(match[1]) : '';
}

function extractHtmlForm(html: string, baseUrl: string): { action: string; method: 'GET' | 'POST'; body: URLSearchParams } | null {
  const formMatch = html.match(/<form\b[^>]*>[\s\S]*?<\/form>/i);
  if (!formMatch) return null;

  const formHtml = formMatch[0];
  const formOpen = formHtml.match(/<form\b[^>]*>/i)?.[0] ?? '';
  const actionRaw = getHtmlAttribute(formOpen, 'action') || baseUrl;
  const methodRaw = getHtmlAttribute(formOpen, 'method').toUpperCase();
  const method: 'GET' | 'POST' = methodRaw === 'GET' ? 'GET' : 'POST';
  const body = new URLSearchParams();

  for (const input of formHtml.matchAll(/<input\b[^>]*>/gi)) {
    const tag = input[0];
    const name = getHtmlAttribute(tag, 'name');
    if (!name) continue;
    body.append(name, getHtmlAttribute(tag, 'value'));
  }

  return {
    action: resolveLocation(actionRaw, baseUrl),
    method,
    body,
  };
}

function stableDeviceFingerprint(): string {
  if (config.lynon.deviceFingerprint) return config.lynon.deviceFingerprint.slice(0, 32);
  const seed = `${config.lynon.username || 'panel'}:${config.lynon.siteId}:${config.lynon.backofficeBaseUrl}`;
  return createHash('md5').update(seed).digest('hex');
}

function normalizeTotpAlgorithm(value: string | undefined): TotpOptions['algorithm'] {
  const normalized = String(value || '').trim().toLowerCase().replace('-', '');
  if (normalized === 'sha256') return 'sha256';
  if (normalized === 'sha512') return 'sha512';
  return 'sha1';
}

function parseTotpSecret(secret: string): ParsedTotpSecret {
  const trimmed = secret.trim();
  const fallback: TotpOptions = {
    algorithm: normalizeTotpAlgorithm(config.lynon.otpAlgorithm),
    digits: Math.max(4, Math.min(10, Number(config.lynon.otpDigits) || 6)),
    periodSeconds: Math.max(10, Number(config.lynon.otpPeriodSeconds) || 30),
  };

  if (!trimmed.toLowerCase().startsWith('otpauth://')) {
    return { secret: trimmed, options: fallback };
  }

  try {
    const url = new URL(trimmed);
    return {
      secret: url.searchParams.get('secret') ?? trimmed,
      options: {
        algorithm: normalizeTotpAlgorithm(url.searchParams.get('algorithm') ?? config.lynon.otpAlgorithm),
        digits: Math.max(4, Math.min(10, Number(url.searchParams.get('digits') ?? config.lynon.otpDigits) || 6)),
        periodSeconds: Math.max(10, Number(url.searchParams.get('period') ?? config.lynon.otpPeriodSeconds) || 30),
      },
    };
  } catch {
    return { secret: trimmed, options: fallback };
  }
}

function base32Decode(secret: string): { bytes: Buffer; options: TotpOptions } {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const parsed = parseTotpSecret(secret);
  const normalized = parsed.secret.replace(/[\s-]/g, '').replace(/=+$/g, '').toUpperCase();
  const invalid = Array.from(new Set(normalized.split('').filter((char) => !alphabet.includes(char))));
  if (invalid.length > 0) {
    throw new LynonAuthError(
      'LYNON_PANEL_OTP_SECRET geçerli bir Base32 TOTP secret değil. Authenticator kurulum secretını (A-Z, 2-7) yazın veya anlık 6 haneli kodu LYNON_PANEL_OTP_TOKEN alanına koyun.',
      500
    );
  }

  let bits = '';
  const bytes: number[] = [];

  for (const char of normalized) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, '0');
    while (bits.length >= 8) {
      bytes.push(parseInt(bits.slice(0, 8), 2));
      bits = bits.slice(8);
    }
  }

  if (bytes.length === 0) {
    throw new LynonAuthError('LYNON_PANEL_OTP_SECRET / LYNON_PANEL_OTP_TOKEN geçerli bir TOTP secret değil.', 500);
  }

  return { bytes: Buffer.from(bytes), options: parsed.options };
}

function hotp(secret: Buffer, counter: number, options: TotpOptions): string {
  const buf = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  buf.writeUInt32BE(high, 0);
  buf.writeUInt32BE(low, 4);

  const digest = createHmac(options.algorithm, secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) % (10 ** options.digits);

  return String(code).padStart(options.digits, '0');
}

function currentOtp(nowMs = Date.now()): string {
  const token = config.lynon.otpToken.trim();
  if (/^\d{6}$/.test(token)) return token;
  const value = config.lynon.otpSecret.trim();
  if (/^\d{6}$/.test(value)) return value;
  const { bytes, options } = base32Decode(value);
  return hotp(bytes, Math.floor(nowMs / 1000 / options.periodSeconds), options);
}

async function postJson(url: string, body: Record<string, unknown>, jar: CookieJar): Promise<{ status: number; ok: boolean; data: JsonValue; responseDateMs?: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.lynon.timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        ...commonHeaders(url),
        'Content-Type': 'application/json',
        Cookie: jar.header(url),
      },
      body: JSON.stringify(body),
      redirect: 'manual',
    });
    jar.addFromResponse(response.headers, url);
    const data = parseMaybeJson(await response.text());
    const responseDate = response.headers.get('date');
    const responseDateMs = responseDate ? Date.parse(responseDate) : NaN;
    return {
      status: response.status,
      ok: response.ok,
      data,
      responseDateMs: Number.isFinite(responseDateMs) ? responseDateMs : undefined,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function assertConfigured(): void {
  if (!isLynonConfigured()) {
    throw new LynonAuthError('Lynon panel bilgileri eksik. LYNON_PANEL_USERNAME, LYNON_PANEL_PASSWORD ve LYNON_PANEL_OTP_SECRET/LYNON_PANEL_OTP_TOKEN girilmeli.', 401);
  }
}

async function login(): Promise<LynonSession> {
  assertConfigured();

  const jar = new CookieJar();
  const credentialsUrl = `${config.lynon.idBaseUrl.replace(/\/$/, '')}/api/v1/twofa/credentials`;
  const returnUrl = await discoverReturnUrl(jar);
  const credentials = await postJson(credentialsUrl, {
    username: config.lynon.username,
    password: config.lynon.password,
    returnurl: returnUrl,
    deviceFingerprint: stableDeviceFingerprint(),
  }, jar);

  let challengeToken = String(asRecord(credentials.data).token ?? '').trim();
  let sessionToken: string | undefined;

  if (credentials.ok && jar.size > 0) {
    const redirectTrace = await completeBackofficeRedirect(returnUrl, jar);
    activeSession = { jar, authenticatedAt: Date.now(), redirectTrace };
    return activeSession;
  }

  if (credentials.ok && typeof credentials.data === 'string') {
    sessionToken = credentials.data;
  }

  if (!credentials.ok && credentials.status !== 451) {
    const message = String(asRecord(credentials.data).message || asRecord(credentials.data).error || `Lynon login ${credentials.status}`);
    throw new LynonAuthError(message, credentials.status);
  }

  if (!challengeToken && credentials.status === 451) {
    throw new LynonAuthError('Lynon 2FA challenge token dönmedi.', credentials.status);
  }

  if (challengeToken) {
    const otpUrl = `${config.lynon.idBaseUrl.replace(/\/$/, '')}/api/v1/twofa/otp`;
    const otp = await postJson(otpUrl, {
      token: challengeToken,
      otp: currentOtp(credentials.responseDateMs ?? Date.now()),
      trustDevice: config.lynon.trustDevice,
    }, jar);

    if (!otp.ok) {
      const message = String(asRecord(otp.data).message || asRecord(otp.data).error || `Lynon OTP ${otp.status}`);
      throw new LynonAuthError(message, otp.status);
    }

    if (typeof otp.data === 'string') sessionToken = otp.data;
    const tokenFromObject = String(asRecord(otp.data).token ?? '').trim();
    if (tokenFromObject) sessionToken = tokenFromObject;
    const redirectTrace = await completeBackofficeRedirect(returnUrl, jar);
    activeSession = { jar, sessionToken, authenticatedAt: Date.now(), redirectTrace };
    return activeSession;
  }

  activeSession = { jar, sessionToken, authenticatedAt: Date.now() };
  return activeSession;
}

export function isLynonConfigured(): boolean {
  return Boolean(config.lynon.enabled && config.lynon.username && config.lynon.password && (config.lynon.otpSecret || config.lynon.otpToken));
}

export function clearLynonSession(): void {
  activeSession = null;
  loginPromise = null;
}

export function getLynonAuthStatus(): Record<string, unknown> {
  return {
    configured: isLynonConfigured(),
    baseUrl: config.lynon.backofficeBaseUrl,
    siteId: config.lynon.siteId,
    currency: config.lynon.currency,
    otpMode: config.lynon.otpToken ? 'token' : config.lynon.otpSecret ? 'secret' : 'missing',
    authenticated: Boolean(activeSession),
    authenticatedAt: activeSession ? new Date(activeSession.authenticatedAt).toISOString() : null,
    cookieCount: activeSession?.jar.size ?? 0,
    cookieNames: activeSession?.jar.names() ?? [],
    cookieScopes: activeSession?.jar.scopes() ?? [],
    redirectTrace: activeSession?.redirectTrace ?? [],
  };
}

export async function ensureLynonSession(): Promise<LynonSession> {
  const ttl = Math.max(config.lynon.sessionTtlMs, 60_000);
  if (activeSession && Date.now() - activeSession.authenticatedAt < ttl) {
    return activeSession;
  }
  if (!loginPromise) {
    loginPromise = login().finally(() => {
      loginPromise = null;
    });
  }
  return loginPromise;
}

export interface LynonRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  retryAuth?: boolean;
}

function buildUrl(path: string, query?: LynonRequestOptions['query']): string {
  const url = path.startsWith('http')
    ? new URL(path)
    : new URL(`${config.lynon.backofficeBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function lynonRequest<T = JsonValue>(path: string, options: LynonRequestOptions = {}): Promise<T> {
  const session = await ensureLynonSession();
  const method = options.method ?? (options.body ? 'POST' : 'GET');
  const url = buildUrl(path, options.query);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.lynon.timeoutMs);

  try {
    const headers: Record<string, string> = {
      ...commonHeaders(config.lynon.backofficeBaseUrl),
      ...options.headers,
      Cookie: session.jar.header(url),
    };
    if (method === 'POST' || method === 'PUT') headers['Content-Type'] = 'application/json';
    if (session.sessionToken && !headers.Authorization && process.env.LYNON_SEND_BEARER === 'true') {
      headers.Authorization = `Bearer ${session.sessionToken}`;
    }

    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers,
      redirect: 'manual',
      body: method === 'POST' || method === 'PUT' ? JSON.stringify(options.body ?? {}) : undefined,
    });
    session.jar.addFromResponse(response.headers, url);
    const data = parseMaybeJson(await response.text());

    if ((response.status === 401 || response.status === 403 || (response.status >= 300 && response.status < 400)) && options.retryAuth !== false) {
      clearLynonSession();
      return lynonRequest<T>(path, { ...options, retryAuth: false });
    }

    if (!response.ok) {
      const record = asRecord(data);
      const message = String(record.message || record.error || record.AlertMessage || `Lynon API ${response.status}`);
      throw new LynonHttpError(message, response.status, data);
    }

    return data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

