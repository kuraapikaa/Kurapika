/**
 * Oyun hakki: her YATIRIM bir kez oynatir.
 *
 * ── Onceki durum ──────────────────────────────────────────────────────
 * Cark yalnizca GUNLUK limitle sinirliydi ve minimum yatirim tutarina
 * bakiyordu — ama hangi yatirim oldugunu KAYDETMIYORDU. Oyuncu bir kez
 * yatirim yapip her gun yeniden cevirebiliyordu; gun degisince limit
 * sifirlaniyor, yatirim ise ayni kaliyordu.
 *
 * Kazi kazanda ise hicbir sinir YOKTU: ne gunluk hak, ne kayit, ne
 * kontrol. Uc dogrudan cagrilarak sinirsiz oynanabiliyordu.
 *
 * ── Yeni kural ────────────────────────────────────────────────────────
 * Bir yatirim = bir oyun hakki. Hak, yatirimin KIMLIGINE baglaniyor;
 * oyuncu tekrar oynamak icin yeni yatirim yapmak zorunda.
 *
 * Cark KODU ayri bir haktir ve bu kurala girmez: kod, yatirimdan bagimsiz
 * olarak operator tarafindan verilen tek kullanimlik bir giristir.
 */

export const OYUNLAR = ['cark', 'kazikazan'] as const;
export type Oyun = (typeof OYUNLAR)[number];

export type OyunKaydi = {
  username: string;
  /** Hakkin baglandigi yatirim kimligi. Eski kayitlarda olmayabilir. */
  depositId?: string | number | null;
  oyun?: string;
  status?: string;
};

/** Hak tuketmis sayilan durumlar. Basarisiz deneme hakki yakmaz. */
const TUKETEN_DURUMLAR = new Set(['pending', 'completed', 'granted', 'fulfillment_pending']);

function ad(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

function kimlik(value: unknown): string {
  return String(value ?? '').trim();
}

export type HakSonucu =
  | { uygun: true; depositId: string }
  | { uygun: false; neden: string };

/**
 * Bu yatirimla oynanabilir mi?
 *
 * depositId yoksa hak YOK: yatirimi olmayan oyuncu oynayamaz. Bu bilerek
 * katı — "kimlik bulunamadi" durumunda oynatmak, kimliksiz her istegin
 * sinirsiz oynamasi demek olurdu.
 */
export function yatirimHakki(
  kayitlar: OyunKaydi[],
  login: string,
  oyun: Oyun,
  depositId: unknown,
): HakSonucu {
  const id = kimlik(depositId);
  if (!id) {
    return { uygun: false, neden: 'Oynamak için önce yatırım yapmalısınız.' };
  }

  const oyuncu = ad(login);
  const kullanilmis = (kayitlar ?? []).some((kayit) => {
    if (!kayit) return false;
    if (ad(kayit.username) !== oyuncu) return false;
    // Eski kayitlarda `oyun` alani yok; cark kayitlari o zaman yalnizca
    // cark icin tutuluyordu. Alan yoksa cark sayilir.
    const kayitOyunu = kayit.oyun ? ad(kayit.oyun) : 'cark';
    if (kayitOyunu !== oyun) return false;
    if (kayit.status != null && !TUKETEN_DURUMLAR.has(ad(kayit.status))) return false;
    return kimlik(kayit.depositId) === id;
  });

  if (kullanilmis) {
    return { uygun: false, neden: 'Bu yatırım için hakkınızı kullandınız. Yeni yatırım yapın.' };
  }

  return { uygun: true, depositId: id };
}

/**
 * Bir oyuncunun bir oyunda kullandigi yatirim kimlikleri.
 *
 * Ekranda "hakkin var mi" gostermek icin; karar yatirimHakki'nda.
 */
export function kullanilmisYatirimlar(kayitlar: OyunKaydi[], login: string, oyun: Oyun): string[] {
  const oyuncu = ad(login);
  const sonuc = new Set<string>();
  for (const kayit of kayitlar ?? []) {
    if (!kayit || ad(kayit.username) !== oyuncu) continue;
    const kayitOyunu = kayit.oyun ? ad(kayit.oyun) : 'cark';
    if (kayitOyunu !== oyun) continue;
    if (kayit.status != null && !TUKETEN_DURUMLAR.has(ad(kayit.status))) continue;
    const id = kimlik(kayit.depositId);
    if (id) sonuc.add(id);
  }
  return [...sonuc];
}
