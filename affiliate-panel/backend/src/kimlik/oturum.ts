import { createHmac, timingSafeEqual } from 'crypto';
import { parolaDogrula, parolaOzeti } from '../lib/sifre.js';
import { ortakGirisi, type Ortak } from '../servisler/ortaklar.js';

/**
 * OTURUM — imzalı çerez, sunucuda durum yok.
 *
 * Panelin iki kapısı var: YÖNETİCİ ve ORTAK. Aynı çerez biçimi, farklı
 * rol. Rol jetonun İÇİNDE ve imzalı; istemciden gelen bir "ben
 * yöneticiyim" iddiası hiçbir zaman dikkate alınmıyor.
 *
 * ── Neden sunucu tarafı oturum deposu yok ──
 *
 * Panel tek konteynerde de, çok kopyalı da çalışabilmeli. Paylaşılan
 * bir oturum deposu Redis bağımlılığı getirirdi; imzalı jeton bunu
 * gereksiz kılıyor. Bedeli: jeton süresi dolana kadar iptal edilemiyor.
 * Bu yüzden süre KISA (varsayılan 12 saat) ve ortak askıya alındığında
 * her istekte durumu yeniden okunuyor — jeton geçerli olsa bile askıya
 * alınmış ortak içeri giremiyor.
 */

const OTURUM_SURESI_MS = Math.max(15 * 60_000, Number(process.env.AFF_OTURUM_SURESI_MS) || 12 * 60 * 60_000);

export const OTURUM_CEREZI = 'aff_oturum';

export type Rol = 'yonetici' | 'ortak';

export interface OturumVerisi {
  rol: Rol;
  kiraci: string;
  /** Yalnızca ortak oturumunda dolu. */
  ortakId?: string;
  ortakAnahtari?: string;
  ad: string;
  /** Bitiş anı (ms). */
  bitis: number;
}

function imzaAnahtari(): Buffer {
  const ham = String(process.env.AFF_SESSION_SECRET || '').trim();
  if (ham.length < 16) {
    // Zayif ya da eksik bir imza anahtari, jetonun taklit edilebilmesi
    // demek: herkes kendini yonetici ilan edebilirdi. Acilista patlamali.
    throw new Error('AFF_SESSION_SECRET en az 16 karakter olmalı.');
  }
  return Buffer.from(ham, 'utf8');
}

const b64url = (tampon: Buffer): string =>
  tampon.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const b64urlCoz = (metin: string): Buffer =>
  Buffer.from(metin.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function jetonUret(veri: Omit<OturumVerisi, 'bitis'>, simdi = Date.now()): string {
  const govde = b64url(Buffer.from(JSON.stringify({ ...veri, bitis: simdi + OTURUM_SURESI_MS }), 'utf8'));
  const imza = b64url(createHmac('sha256', imzaAnahtari()).update(govde).digest());
  return `${govde}.${imza}`;
}

/** Geçersiz/süresi dolmuş jeton `null` döner; ayrım yapmıyoruz. */
export function jetonCoz(jeton: unknown, simdi = Date.now()): OturumVerisi | null {
  const metin = String(jeton ?? '');
  const nokta = metin.lastIndexOf('.');
  if (nokta <= 0) return null;

  const govde = metin.slice(0, nokta);
  const imza = b64urlCoz(metin.slice(nokta + 1));
  const beklenen = createHmac('sha256', imzaAnahtari()).update(govde).digest();
  // Sabit zamanli karsilastirma: imzayi bayt bayt tahmin etmeyi engeller.
  if (imza.length !== beklenen.length || !timingSafeEqual(imza, beklenen)) return null;

  try {
    const veri = JSON.parse(b64urlCoz(govde).toString('utf8')) as OturumVerisi;
    if (!veri || typeof veri.bitis !== 'number' || veri.bitis < simdi) return null;
    if (veri.rol !== 'yonetici' && veri.rol !== 'ortak') return null;
    return veri;
  } catch {
    return null;
  }
}

/**
 * YÖNETİCİ GİRİŞİ.
 *
 * Kimlik ortamdan geliyor. Parola tercihen `AFF_ADMIN_PAROLA_OZETI`
 * olarak (scrypt özeti) verilmeli; düz `AFF_ADMIN_PAROLA` yalnızca ilk
 * kurulumu kolaylaştırmak için destekleniyor ve açılışta uyarılıyor.
 */
export function yoneticiKimligiVarMi(): boolean {
  return Boolean(
    String(process.env.AFF_ADMIN_KULLANICI || '').trim() &&
    (String(process.env.AFF_ADMIN_PAROLA_OZETI || '').trim() || String(process.env.AFF_ADMIN_PAROLA || '').trim()),
  );
}

export function duzParolaKullaniliyorMu(): boolean {
  return !String(process.env.AFF_ADMIN_PAROLA_OZETI || '').trim() && Boolean(String(process.env.AFF_ADMIN_PAROLA || '').trim());
}

export class GirisHatasi extends Error {
  constructor(message: string, public statusCode = 401) {
    super(message);
    this.name = 'GirisHatasi';
  }
}

export function yoneticiGirisi(kullanici: string, parola: string): { ad: string } {
  if (!yoneticiKimligiVarMi()) {
    throw new GirisHatasi('Yönetici kimliği tanımlı değil (AFF_ADMIN_KULLANICI / AFF_ADMIN_PAROLA_OZETI).', 500);
  }

  const beklenenKullanici = String(process.env.AFF_ADMIN_KULLANICI).trim();
  const ozet = String(process.env.AFF_ADMIN_PAROLA_OZETI || '').trim();
  const duz = String(process.env.AFF_ADMIN_PAROLA || '');

  const kullaniciDogru = String(kullanici ?? '').trim() === beklenenKullanici;
  const parolaDogru = ozet
    ? parolaDogrula(String(parola ?? ''), ozet)
    : duz.length > 0 && String(parola ?? '') === duz;

  // Hangisinin yanlis oldugunu SOYLEMIYORUZ: kullanici adinin dogru
  // oldugunu onaylamak, saldirgana yarim bilgi vermek olur.
  if (!kullaniciDogru || !parolaDogru) throw new GirisHatasi('Kullanıcı adı ya da parola hatalı.');
  return { ad: beklenenKullanici };
}

export async function ortakOturumu(kiraci: string, eposta: string, parola: string): Promise<Ortak> {
  return ortakGirisi(kiraci, eposta, parola);
}

/** Kurulum yardımcısı: düz parolanın scrypt özetini üretir. */
export function ozetUret(parola: string): string {
  return parolaOzeti(parola);
}
