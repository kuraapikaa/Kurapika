import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { guvenliKiraciAnahtari } from './kiraci.js';
import { belgeOku, belgeYaz, veritabaniHazirMi } from './veritabani.js';

/**
 * BELGE DEPOSU.
 *
 * Her servis `(kiraci, alan)` çiftiyle tek bir JSON belgesi okuyup
 * yazıyor. Postgres varsa oraya, yoksa diske.
 *
 * ── Neden `degistir()` var ──
 *
 * Oku–değiştir–yaz döngüsünü çağırana bırakmak, eşzamanlı iki isteğin
 * birbirinin yazısını EZMESİNE yol açıyor: ikisi de aynı listeyi
 * okuyor, ikisi de kendi kaydını ekliyor, ikincinin yazısı birincininkini
 * siliyor. Tıklama kaydında bu her gün olurdu — kayıp tıklama geriye
 * dönük üretilemez.
 *
 * `degistir()` aynı anahtar için okuma ve yazmayı sıraya sokuyor.
 * Kilit SÜREÇ İÇİ: tek bir konteynerde doğru, yatay ölçeklemede
 * yetmez. O noktaya gelindiğinde çözüm veritabanı düzeyinde kilit
 * olmalı; süreç içi kilit o zaman da zarar vermez.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERI_DIZINI = process.env.AFF_VERI_DIZINI
  ? path.resolve(process.env.AFF_VERI_DIZINI)
  : path.join(__dirname, '..', '..', 'veri');

/** Alan adı da dosya adına dönüşüyor; aynı temizlik gerekli. */
function guvenliAlan(alan: string): string {
  const temiz = String(alan ?? '').replace(/[^a-zA-Z0-9_-]/g, '-');
  if (!temiz) throw new Error('Alan adı boş olamaz.');
  return temiz;
}

function dosyaYolu(kiraci: string, alan: string): string {
  return path.join(VERI_DIZINI, guvenliKiraciAnahtari(kiraci), `${guvenliAlan(alan)}.json`);
}

async function dosyadanOku<T>(yol: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(yol, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

async function dosyayaYaz(yol: string, veri: unknown): Promise<void> {
  await mkdir(path.dirname(yol), { recursive: true });
  // Once gecici dosyaya, sonra tasima: yazma sirasinda surec olurse
  // yarim JSON kalmaz, eski surum aynen durur.
  const gecici = `${yol}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(gecici, JSON.stringify(veri, null, 2), 'utf8');
  await rename(gecici, yol);
}

/**
 * Belgeyi okur ve `coz` ile normalleştirir.
 *
 * Varsayılan değer ile şema normalleştirmesi TEK fonksiyonda: iki ayrı
 * kavram olsaydı, kayıtlı ama eski şemadaki bir belge (alanı sonradan
 * eklenmiş bir liste) varsayılanı hiç görmeden geri döner ve ilk
 * `.filter` çağrısında patlardı. `coz` hem boş girdiyi hem de eksik
 * alanlı girdiyi karşılamak zorunda; bu yüzden unutulamıyor.
 */
export async function oku<T>(kiraci: string, alan: string, coz: (ham: unknown) => T): Promise<T> {
  const anahtar = guvenliKiraciAnahtari(kiraci);
  if (veritabaniHazirMi()) {
    return coz(await belgeOku<unknown>(anahtar, guvenliAlan(alan)));
  }
  return coz(await dosyadanOku<unknown>(dosyaYolu(anahtar, alan)));
}

export async function yaz<T>(kiraci: string, alan: string, veri: T): Promise<void> {
  const anahtar = guvenliKiraciAnahtari(kiraci);
  if (veritabaniHazirMi()) {
    await belgeYaz(anahtar, guvenliAlan(alan), veri);
    return;
  }
  await dosyayaYaz(dosyaYolu(anahtar, alan), veri);
}

const kilitler = new Map<string, Promise<unknown>>();

/**
 * Oku–değiştir–yaz, aynı anahtar için sıralı.
 *
 * `degistirici` belgeyi yerinde değiştirebilir ya da yenisini
 * döndürebilir; dönen değer `undefined` ise okunan belge yazılır.
 * Dönüş değeri çağırana geri veriliyor, böylece "eklenen kaydı da
 * döndür" ihtiyacı ikinci bir okuma gerektirmiyor.
 */
export async function degistir<T, S = void>(
  kiraci: string,
  alan: string,
  coz: (ham: unknown) => T,
  degistirici: (belge: T) => S | Promise<S>,
): Promise<S> {
  const anahtar = `${guvenliKiraciAnahtari(kiraci)}/${guvenliAlan(alan)}`;
  const onceki = kilitler.get(anahtar) ?? Promise.resolve();

  const calisma = onceki.then(async () => {
    const belge = await oku(kiraci, alan, coz);
    const sonuc = await degistirici(belge);
    await yaz(kiraci, alan, belge);
    return sonuc;
  });

  // Hata da olsa sirayi ilerlet; aksi halde bir hata butun anahtari
  // kalici olarak kilitlerdi.
  kilitler.set(anahtar, calisma.catch(() => undefined));
  try {
    return await calisma;
  } finally {
    if (kilitler.get(anahtar) === calisma) kilitler.delete(anahtar);
  }
}

export function veriDizini(): string {
  return VERI_DIZINI;
}

/** `coz` yazarken kullanılan iki küçük yardımcı. */
export const kayitOku = (ham: unknown): Record<string, unknown> =>
  ham && typeof ham === 'object' && !Array.isArray(ham) ? (ham as Record<string, unknown>) : {};

export const diziOku = <T>(ham: unknown): T[] => (Array.isArray(ham) ? (ham as T[]) : []);
