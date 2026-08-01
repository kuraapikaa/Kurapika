/**
 * Telegram bonusu: hesap basina BIR kez.
 *
 * ── Uc ayri delik vardi ───────────────────────────────────────────────
 *
 * 1) KULLANICI ADI TAM ESITLIKLE karsilastiriliyordu:
 *
 *      claims.some((c) => c.username === login && c.ok === true)
 *
 *    `login` yalnizca trim'lenmis halde saklaniyor ve bonus paneli girisi
 *    oyuncunun YAZDIGI adi kabul ediyor. "Ayse", "ayse", "AYSE" ayri
 *    kayitlar uretiyor; oyuncu farkli yazimla tekrar tekrar bonus
 *    alabiliyordu.
 *
 * 2) Yalnizca `ok === true` ENGELLIYORDU. Lynon atamayi yapip yanit
 *    hatayla donerse kayit `ok: false` kaliyor, oyuncu tekrar deniyor ve
 *    GERCEKTEN ikinci bir bonus daha aliyordu.
 *
 * 3) `telegramUserId` kayda yaziliyor ama HIC kontrol edilmiyordu. Ayni
 *    Telegram hesabi farkli oyuncu adlariyla sinirsiz bonus alabiliyordu.
 */

/** Kayit durumu. Eski kayitlarda yalnizca `ok` var. */
export type TelegramKaydi = {
  username?: unknown;
  telegramUserId?: unknown;
  ok?: unknown;
  /** 'pending' | 'granted' | 'failed' | 'belirsiz' — yeni kayitlarda. */
  durum?: unknown;
};

/**
 * Karsilastirma icin sadelestirme: kucuk harf, bosluksuz, diakritiksiz.
 *
 * Ayni Turkce tuzagi burada da gecerli: "İ" yerel-bagimsiz toLowerCase()
 * ile "i" + U+0307 oluyor. Bu bir HAK kontrolu; normalizasyon
 * uyusmazligi ayni oyuncuya ikinci bonus verir.
 */
function sadelestir(value: unknown): string {
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

/**
 * Hakki TUKETEN durumlar.
 *
 * `belirsiz` de tuketir: Lynon cagrisi yapildi ama sonuc dogrulanamadi.
 * Bonus verilmis olabilir; ikinci kez vermektense operatorun bakmasi
 * dogru taraf.
 *
 * `failed` tuketmez: cagri hic yapilmadan dusen deneme (kampanya secili
 * degil, oyuncu bulunamadi) oyuncunun hakkini yakmamali.
 */
const TUKETEN = new Set(['pending', 'granted', 'belirsiz']);

export type HakDurumu = { alinmis: true; neden: string } | { alinmis: false };

/**
 * Bu oyuncu ya da bu Telegram hesabi bonusu daha once aldi mi?
 *
 * Iki anahtar da kontrol edilir: kullanici adi VE Telegram kimligi. Biri
 * bile eslesirse hak tukenmis sayilir.
 */
export function telegramBonusuAlinmis(
  kayitlar: TelegramKaydi[],
  login: string,
  telegramUserId: unknown,
): HakDurumu {
  const oyuncu = sadelestir(login);
  const tgId = String(telegramUserId ?? '').trim();

  for (const kayit of kayitlar ?? []) {
    if (!kayit) continue;

    // Eski kayitlarda durum yok; `ok === true` tuketmis demektir.
    const durum = kayit.durum != null ? sadelestir(kayit.durum) : (kayit.ok === true ? 'granted' : 'failed');
    if (!TUKETEN.has(durum)) continue;

    if (oyuncu && sadelestir(kayit.username) === oyuncu) {
      return { alinmis: true, neden: 'Telegram bonusunu zaten aldınız.' };
    }
    if (tgId && String(kayit.telegramUserId ?? '').trim() === tgId) {
      return {
        alinmis: true,
        neden: 'Bu Telegram hesabıyla bonus zaten alınmış.',
      };
    }
  }

  return { alinmis: false };
}

/**
 * Atama sonucundan kayit durumunu belirler.
 *
 * chargeBonusToPlayer, Lynon cagrisini YAPTIYSA yanitina `lynon: true`
 * koyuyor. Cagri yapilip basarisiz donduyse atama gerceklesmis olabilir;
 * o kayit `belirsiz` olur ve hakki tuketir. Cagri hic yapilmadan dusen
 * deneme `failed` olur ve hakki tuketmez.
 */
export function atamaDurumu(grant: { ok?: unknown; lynon?: unknown } | null | undefined): string {
  if (grant?.ok === true) return 'granted';
  if (grant?.lynon === true) return 'belirsiz';
  return 'failed';
}
