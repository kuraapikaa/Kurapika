/**
 * Telegram satir ici butonlari ve geri cagri (callback) cozumu.
 *
 * ── Neden ayri bir modul ──────────────────────────────────────────────
 *
 * Bu butonlar GERCEK PARA hareketini tetikliyor: cekim onaylamak ya da
 * reddetmek. Kodun buton ureten ve geri cagriyi cozen kismi ag
 * cagrilarindan ayri durmali ki tek basina test edilebilsin.
 *
 * ── Yetki ─────────────────────────────────────────────────────────────
 *
 * Telegram grubundaki HERKES butona basabilir. Para hareketi bir grup
 * uyeliginin arkasina birakilamaz; bu yuzden yetkili Telegram kullanici
 * kimlikleri acikca listelenir.
 *
 * Liste BOSSA buton HIC EKLENMEZ. "Liste bossa herkese izin ver"
 * varsayilani, yapilandirmayi unutan bir kurulumda cekimleri gruba acik
 * hale getirirdi.
 *
 * ── callback_data siniri ──────────────────────────────────────────────
 *
 * Telegram callback_data icin 64 BAYT siniri koyuyor. Bu yuzden bicim
 * kisa ve konumsal: `c|<eylem>|<islemId>|<oyuncuId>`.
 */

/** Butonlarin tetikleyebilecegi eylemler. */
export type CekimEylemi = 'onay' | 'ret' | 'onayNot';

const EYLEM_KODU: Record<CekimEylemi, string> = { onay: 'a', ret: 'r', onayNot: 'n' };
const KOD_EYLEM: Record<string, CekimEylemi> = { a: 'onay', r: 'ret', n: 'onayNot' };

/** Telegram'in callback_data icin izin verdigi azami bayt. */
export const AZAMI_CALLBACK_BAYT = 64;

export type CekimCallback = {
  eylem: CekimEylemi;
  islemId: string;
  oyuncuId: string;
};

export function callbackVerisi(eylem: CekimEylemi, islemId: unknown, oyuncuId: unknown): string {
  return `c|${EYLEM_KODU[eylem]}|${String(islemId ?? '')}|${String(oyuncuId ?? '')}`;
}

/** Geri cagri verisini coz. Bize ait degilse ya da bozuksa null. */
export function callbackCoz(veri: unknown): CekimCallback | null {
  const metin = String(veri ?? '');
  const parcalar = metin.split('|');
  if (parcalar.length !== 4 || parcalar[0] !== 'c') return null;
  const eylem = KOD_EYLEM[parcalar[1]];
  if (!eylem) return null;
  const islemId = parcalar[2].trim();
  if (!islemId) return null;
  return { eylem, islemId, oyuncuId: parcalar[3].trim() };
}

/** Yetkili Telegram kullanici kimlikleri. Bos kume = buton yok. */
export function yetkiliKullanicilar(
  ayar: string | undefined = process.env.TELEGRAM_YETKILI_KULLANICILAR,
): Set<string> {
  return new Set(
    String(ayar ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
  );
}

export function yetkiliMi(kullaniciId: unknown, yetkililer: Set<string>): boolean {
  if (yetkililer.size === 0) return false;
  return yetkililer.has(String(kullaniciId ?? ''));
}

export type TelegramButon = { text: string; callback_data: string };

/**
 * Cekim mesajinin butonlari.
 *
 * Yetkili listesi bossa BOS dizi doner ve mesaj butonsuz gider — para
 * hareketini yapilandirilmamis bir kuruluma acmaktansa dugmesiz bir
 * bildirim yollamak dogru.
 *
 * Zaten sonuclanmis (onaylanmis/reddedilmis) bir cekimde de buton
 * gosterilmez; ikinci kez cozumlemek uctan hata doner ve operatore
 * "calismiyor" hissi verir.
 */
export function cekimButonlari(input: {
  islemId: unknown;
  oyuncuId: unknown;
  sonuclanmis: boolean;
  yetkililer: Set<string>;
}): TelegramButon[][] {
  if (input.sonuclanmis || input.yetkililer.size === 0) return [];
  const satir: TelegramButon[] = [
    { text: '✅ Onayla', callback_data: callbackVerisi('onay', input.islemId, input.oyuncuId) },
    { text: '📝 Onayla + Not', callback_data: callbackVerisi('onayNot', input.islemId, input.oyuncuId) },
  ];
  const ikinci: TelegramButon[] = [
    { text: '❌ Reddet', callback_data: callbackVerisi('ret', input.islemId, input.oyuncuId) },
  ];
  return [satir, ikinci];
}

/** Butonlar `reply_markup` alanina bu bicimde girer. */
export function klavye(butonlar: TelegramButon[][]): { inline_keyboard: TelegramButon[][] } | undefined {
  return butonlar.length > 0 ? { inline_keyboard: butonlar } : undefined;
}

/**
 * Not isteme mesaji.
 *
 * Telegram'in `force_reply` mekanizmasi kullaniliyor: bot soruyu
 * soruyor, operator YANITLIYOR ve yanit `reply_to_message` ile geri
 * geliyor. Boylece hangi oyuncuya not yazildigi sohbette kaybolmuyor,
 * ayrica bot durumu kullanici basina saklamak zorunda kalmiyor.
 */
export const NOT_ISTEK_ONEKI = 'Not eklenecek oyuncu:';

export function notIstekMesaji(oyuncuId: unknown, login: unknown): string {
  const ad = String(login ?? '').trim();
  return `${NOT_ISTEK_ONEKI} ${ad ? `${ad} (${oyuncuId})` : String(oyuncuId ?? '')}\nBu mesajı yanıtlayarak notu yazın.`;
}

/**
 * Bot'un not istegi mesajindan oyuncu kimligini geri okur.
 *
 * Yanit `reply_to_message.text` ile geliyor; kimligi oradan cikarmak,
 * ayri bir durum tablosu tutmaktan basit ve yeniden baslatmaya dayanikli.
 */
export function notIstegindenOyuncu(metin: unknown): string | null {
  const s = String(metin ?? '');
  if (!s.startsWith(NOT_ISTEK_ONEKI)) return null;
  const eslesme = s.match(/\((\d+)\)|:\s*(\d+)\s*$/m);
  const kimlik = eslesme?.[1] ?? eslesme?.[2];
  return kimlik ? kimlik : null;
}
