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
export type CekimEylemi = 'onay' | 'ret' | 'onayNot' | 'retNot';

const EYLEM_KODU: Record<CekimEylemi, string> = { onay: 'a', ret: 'r', onayNot: 'n', retNot: 'x' };
const KOD_EYLEM: Record<string, CekimEylemi> = { a: 'onay', r: 'ret', n: 'onayNot', x: 'retNot' };

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
    // İsteğe bağlı: reddedince neden sorulur, yanıt red sonucuyla aynı gruba
    // ayrıca gönderilir — onay/ret tek grupta birleştiğinde o grubu takip
    // eden ekip red gerekçesini görmeye devam etsin diye.
    { text: '📝 Red Nedeni Yaz', callback_data: callbackVerisi('retNot', input.islemId, input.oyuncuId) },
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

/**
 * Red nedeni isteme mesaji.
 *
 * Not istegiyle AYNI `force_reply` deseni, ama daha fazla alan tasiyor:
 * islem, oyuncu, ve (varsa) tutar/yontem — red nedeni raporunda bunlarin
 * hepsi gorunsun diye, oyuncuya geri sorgu atmadan.
 *
 * Alan ayraci `" | "` — "·" YONTEM DEGERININ ICINDE de geciyor (orn.
 * "Havale · HemenOde"), bu yuzden alanlari ayirmak icin kullanilamaz.
 */
export const RED_NEDENI_ONEKI = 'Red nedeni gerekiyor —';

export function redNedeniIstekMesaji(
  islemId: unknown,
  oyuncuId: unknown,
  login: unknown,
  ek?: { tutar?: string | null; yontem?: string | null },
): string {
  const ad = String(login ?? '').trim();
  const oyuncu = ad ? `${ad} (${oyuncuId})` : String(oyuncuId ?? '');
  const parcalar = [`işlem ${String(islemId ?? '')}`, `oyuncu ${oyuncu}`];
  if (ek?.tutar) parcalar.push(`tutar ${ek.tutar}`);
  if (ek?.yontem) parcalar.push(`yöntem ${ek.yontem}`);
  return `${RED_NEDENI_ONEKI} ${parcalar.join(' | ')}\nBu mesajı yanıtlayarak red nedenini yazın.`;
}

export type RedNedeniBilgisi = {
  islemId: string;
  oyuncuId: string;
  login: string | null;
  tutar: string | null;
  yontem: string | null;
};

/** Bot'un red nedeni istegi mesajindan islem/oyuncu/tutar/yontem bilgisini geri okur. */
export function redNedeniIstegindenBilgi(metin: unknown): RedNedeniBilgisi | null {
  const s = String(metin ?? '');
  if (!s.startsWith(RED_NEDENI_ONEKI)) return null;

  const ilkSatir = s.split('\n')[0].slice(RED_NEDENI_ONEKI.length).trim();
  let islemId: string | null = null;
  let oyuncuId = '';
  let login: string | null = null;
  let tutar: string | null = null;
  let yontem: string | null = null;

  for (const parca of ilkSatir.split(' | ').map((p) => p.trim())) {
    if (parca.startsWith('işlem ')) {
      islemId = parca.slice('işlem '.length).trim();
    } else if (parca.startsWith('oyuncu ')) {
      const oyuncuMetin = parca.slice('oyuncu '.length).trim();
      const eslesme = oyuncuMetin.match(/^(.*)\((\d+)\)\s*$/);
      if (eslesme) {
        login = eslesme[1].trim() || null;
        oyuncuId = eslesme[2];
      } else {
        oyuncuId = oyuncuMetin;
      }
    } else if (parca.startsWith('tutar ')) {
      tutar = parca.slice('tutar '.length).trim() || null;
    } else if (parca.startsWith('yöntem ')) {
      yontem = parca.slice('yöntem '.length).trim() || null;
    }
  }

  if (!islemId) return null;
  return { islemId, oyuncuId, login, tutar, yontem };
}

/**
 * Orijinal cekim mesajindan (talep ya da sonuc) oyuncu adi, tutar ve
 * yontem bilgisini geri okur.
 *
 * Buton basildiginda mesaj hala sohbette gorunur olarak duruyor —
 * `callback.message.text`. Iki farkli bicim olabiliyor:
 *   - Zengin talep (`cekimBaglamMesaji`): "👤 ad · id"
 *   - Sade sonuc (`cekimMesaji`, `oyuncuYaz` ile): "👤 ad (id)"
 * Ikisi de denenir; hicbiri eslesmezse null.
 */
export function cekimMesajindanBilgi(metin: unknown): { login: string | null; tutar: string | null; yontem: string | null } {
  const s = String(metin ?? '');
  const noktaliEslesme = s.match(/^👤 (.+?) · \d+\s*$/m);
  const parantezliEslesme = s.match(/^👤 (.+?) \(\d+\)\s*$/m);
  const login = (noktaliEslesme?.[1] ?? parantezliEslesme?.[1] ?? '').trim() || null;
  const tutarEslesme = s.match(/^💸 (.+)$/m);
  const yontemEslesme = s.match(/^🏦 (.+)$/m);
  return {
    login,
    tutar: tutarEslesme?.[1]?.trim() || null,
    yontem: yontemEslesme?.[1]?.trim() || null,
  };
}
