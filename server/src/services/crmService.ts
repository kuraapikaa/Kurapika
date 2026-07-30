import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

/**
 * CRM: oyuncu notlari ve temas gecmisi.
 *
 * Churn ekrani kimin aranacagini soyluyordu ama "arandi mi, ne konusuldu,
 * sonuc ne oldu" hicbir yerde tutulmuyordu. Ayni oyuncu iki temsilci
 * tarafindan ayni gun aranabiliyor, ya da hic aranmadan listede kalabiliyordu.
 *
 * Kayitlar tenant bazli tek dokumanda; oyuncu sayisi degil TEMAS sayisi
 * kadar buyuyor ve temas hacmi dusuk (gunde onlarca, binlerce degil).
 * Oyuncu basina ayri dokuman, liste ekranini N istege dondururdu.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CRM_DIR = path.join(__dirname, '..', 'data', 'crm');

/** Temas turleri. Serbest metin degil sabit liste: raporlanabilir olmali. */
export const TEMAS_TURLERI = ['arama', 'sms', 'not', 'bonus', 'kampanya'] as const;
export type TemasTuru = (typeof TEMAS_TURLERI)[number];

/** Temasin sonucu. "Bilinmiyor" kasitli: temsilci sonucu sonra girebilir. */
export const TEMAS_SONUCLARI = ['bilinmiyor', 'ulasildi', 'ulasilamadi', 'geri-dondu', 'ilgilenmiyor'] as const;
export type TemasSonucu = (typeof TEMAS_SONUCLARI)[number];

export type CrmTemas = {
  id: string;
  login: string;
  tur: TemasTuru;
  sonuc: TemasSonucu;
  not: string;
  /** Temasi yapan panel kullanicisi. */
  yapan: string;
  createdAt: string;
};

type CrmDokuman = { temaslar: CrmTemas[] };

export function ensureCrmDir(): void {
  fs.mkdirSync(CRM_DIR, { recursive: true });
}

function crmPath(tenantKey: string): string {
  return path.join(CRM_DIR, `${safeTenantKey(tenantKey)}.json`);
}

async function oku(tenantKey: string): Promise<CrmDokuman> {
  const data = await readStoredDocument<CrmDokuman>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'crm-temas',
    filePath: crmPath(tenantKey),
    fallback: () => ({ temaslar: [] }),
  });
  return { temaslar: Array.isArray(data?.temaslar) ? data.temaslar : [] };
}

async function yaz(tenantKey: string, dokuman: CrmDokuman): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'crm-temas', filePath: crmPath(tenantKey) },
    dokuman,
  );
}

function normalizeLogin(login: string): string {
  return String(login ?? '').trim().toLocaleLowerCase('tr-TR');
}

function gecerliTur(v: unknown): TemasTuru {
  return (TEMAS_TURLERI as readonly string[]).includes(String(v)) ? (v as TemasTuru) : 'not';
}

function gecerliSonuc(v: unknown): TemasSonucu {
  return (TEMAS_SONUCLARI as readonly string[]).includes(String(v)) ? (v as TemasSonucu) : 'bilinmiyor';
}

export async function temasEkle(
  tenantKey: string,
  girdi: { login: string; tur?: unknown; sonuc?: unknown; not?: unknown; yapan: string },
): Promise<CrmTemas> {
  const login = String(girdi.login ?? '').trim();
  if (!login) throw new Error('Oyuncu kullanıcı adı gerekli.');

  const dokuman = await oku(tenantKey);
  const temas: CrmTemas = {
    id: randomUUID(),
    login,
    tur: gecerliTur(girdi.tur),
    sonuc: gecerliSonuc(girdi.sonuc),
    // Not uzunlugu sinirli: dokuman tek parca saklaniyor, sinirsiz metin
    // zamanla okuma/yazmayi agirlastirirdi.
    not: String(girdi.not ?? '').trim().slice(0, 1000),
    yapan: String(girdi.yapan ?? 'bilinmiyor'),
    createdAt: new Date().toISOString(),
  };

  dokuman.temaslar.unshift(temas);
  await yaz(tenantKey, dokuman);
  return temas;
}

export async function oyuncuTemaslari(tenantKey: string, login: string, limit = 50): Promise<CrmTemas[]> {
  const hedef = normalizeLogin(login);
  const { temaslar } = await oku(tenantKey);
  return temaslar.filter((t) => normalizeLogin(t.login) === hedef).slice(0, Math.max(1, limit));
}

export async function sonTemaslar(tenantKey: string, limit = 100): Promise<CrmTemas[]> {
  const { temaslar } = await oku(tenantKey);
  return temaslar.slice(0, Math.max(1, limit));
}

/**
 * Bir grup oyuncunun SON temas tarihini dondurur.
 *
 * Churn listesi bunu satir basina kullaniyor: "bu oyuncu zaten dun arandi"
 * bilgisi olmadan ayni kisi tekrar tekrar aranir.
 */
export async function sonTemasHaritasi(
  tenantKey: string,
  loginler: string[],
): Promise<Record<string, { createdAt: string; tur: TemasTuru; sonuc: TemasSonucu }>> {
  const hedefler = new Set(loginler.map(normalizeLogin).filter(Boolean));
  if (hedefler.size === 0) return {};

  const { temaslar } = await oku(tenantKey);
  const harita: Record<string, { createdAt: string; tur: TemasTuru; sonuc: TemasSonucu }> = {};

  // temaslar zaten yeniden eskiye sirali (unshift); ilk gorulen en yenisi.
  for (const temas of temaslar) {
    const anahtar = normalizeLogin(temas.login);
    if (!hedefler.has(anahtar) || harita[anahtar]) continue;
    harita[anahtar] = { createdAt: temas.createdAt, tur: temas.tur, sonuc: temas.sonuc };
  }
  return harita;
}

/** Temas gecmisinin ozeti — CRM ekraninin ust seridi. */
export function temasOzeti(temaslar: CrmTemas[], simdi: number = Date.now()): {
  toplam: number;
  bugun: number;
  ulasilan: number;
  ulasilamayan: number;
  turDagilimi: Record<string, number>;
} {
  const gunBasi = new Date(simdi);
  gunBasi.setHours(0, 0, 0, 0);
  const gunBasiMs = gunBasi.getTime();

  const turDagilimi: Record<string, number> = {};
  let bugun = 0;
  let ulasilan = 0;
  let ulasilamayan = 0;

  for (const temas of temaslar) {
    turDagilimi[temas.tur] = (turDagilimi[temas.tur] ?? 0) + 1;
    const t = Date.parse(temas.createdAt);
    if (Number.isFinite(t) && t >= gunBasiMs) bugun += 1;
    if (temas.sonuc === 'ulasildi' || temas.sonuc === 'geri-dondu') ulasilan += 1;
    if (temas.sonuc === 'ulasilamadi') ulasilamayan += 1;
  }

  return { toplam: temaslar.length, bugun, ulasilan, ulasilamayan, turDagilimi };
}
