/**
 * Istegin arkasindaki kimlik — tek kaynak.
 *
 * Bazi uclar hem panel operatoru hem oyuncu tarafindan cagriliyor
 * (authGuard'daki BONUS_PANEL_PATHS). Bu uclarda "kim soruyor" ve "kimin
 * adina soruyor" ayrimi yapilmadigi icin bir oyuncu oturumu BASKA bir
 * oyuncunun verisini isteyebiliyordu.
 *
 * Ornek: /admin/bonus/check-player `login` degerini istek GOVDESINDEN
 * aliyordu, oturumdan degil. Oyuncu oturumuyla herhangi bir kullanici adi
 * gonderilince o oyuncunun bakiyesi, yatirim gecmisi, dogrulama durumu,
 * son giris IP'si, operator notlari ve risk analizi donuyordu.
 */

export type IstekKimligi =
  /** Panel operatoru: tam erisim. */
  | { tur: 'panel'; kimlik: string; rol: string }
  /** Oyuncu (bonus paneli oturumu): YALNIZCA kendi verisi. */
  | { tur: 'oyuncu'; kimlik: string; login: string };

/**
 * Login karsilastirmasi: buyuk/kucuk harf, bosluk ve diakritik duyarsiz.
 *
 * TURKCE TUZAGI: "İ" harfi yerel-bagimsiz toLowerCase() ile "i" + U+0307
 * (birlesik nokta), tr-TR yereliyle ise duz "i" olur. Ayni kullanici adi
 * oturumdan ve istek govdesinden farkli normalize edilmis gelebiliyor.
 *
 * Bu bir ERISIM KONTROLU; normalizasyon uyusmazligi mesru oyuncuya 403
 * verir. NFD ile ayristirip birlesik isaretleri atiyor, kalan Turkce
 * harfleri ASCII karsiliklarina katliyoruz — iki yol da ayni sonuca ciksin.
 */
function loginNormalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function loginEsit(a: unknown, b: unknown): boolean {
  const x = loginNormalize(a);
  return x !== '' && x === loginNormalize(b);
}

/**
 * Oturumdan kimligi cozer.
 *
 * Panel oturumu ONCELIKLI: operator ayni tarayicida oyuncu oturumu da
 * acmis olabilir, bu durumda operator yetkisi gecerli olmali.
 */
export function istekKimligi(request: unknown): IstekKimligi | null {
  const session = (request as { session?: Record<string, unknown> })?.session;
  if (!session) return null;

  const user = session.user as { username?: unknown; role?: unknown } | undefined;
  if (user?.username) {
    return { tur: 'panel', kimlik: String(user.username), rol: String(user.role ?? 'operator') };
  }

  const oyuncu = session.bonusPanelUser as { login?: unknown } | undefined;
  if (oyuncu?.login) {
    const login = String(oyuncu.login);
    // Kimlik onekli: panel kullanicisi ile ayni ada sahip bir oyuncu,
    // operatorun izin anahtarini kullanamasin.
    return { tur: 'oyuncu', kimlik: `oyuncu:${login}`, login };
  }

  return null;
}

/**
 * Bir oyuncunun verisine erisim izni var mi?
 *
 * Panel operatoru her oyuncuyu gorebilir. Oyuncu oturumu yalnizca kendi
 * kaydini gorebilir.
 */
export function oyuncuVerisineErisebilir(kimlik: IstekKimligi | null, hedefLogin: unknown): boolean {
  if (!kimlik) return false;
  if (kimlik.tur === 'panel') return true;
  return loginEsit(kimlik.login, hedefLogin);
}
