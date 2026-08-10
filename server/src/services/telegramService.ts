import { config } from '../config.js';

const TELEGRAM_API = 'https://api.telegram.org';

export function isTelegramConfigured(): boolean {
  return Boolean(config.telegram.botToken);
}

/**
 * Telegram HTML parse_mode icin metin kacisi.
 *
 * Butun raporlar `<b>` ile kalin basliklar kullaniyor; bu yuzden
 * gonderilen HER mesaj `parse_mode: 'HTML'` ile gidiyor. Rapor
 * icindeki DINAMIK deger (login, not, red nedeni, tutar metni vb.)
 * `&`/`<`/`>` icerirse Telegram bunu etiket sanip mesaji SESSIZCE
 * reddeder — bu yuzden her interpolasyon buradan gecmeli. Statik
 * baslik metinleri (`<b>...</b>` etiketinin kendisi) kacilmaz.
 */
export function escapeHtml(deger: unknown): string {
  return String(deger ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Bir satiri kalin isaretler. `gorselMesaj()` disinda kullanilmaz —
 * ureteceginiz `**...**` sarmalayicisi yalnizca O yardimcida `<b>`
 * etiketine cevrilir.
 */
export function kalinSatir(metin: string): string {
  return `**${metin}**`;
}

/**
 * Bir satirin SADECE BIR KISMINI kalin isaretler — `kalinSatir()`in
 * aksine cumlenin gerisi duz kalir (orn. "❓ Not: ..." satirinda
 * yalnizca "❓ Not:" kalin, aciklama degil).
 */
export function kalinIsaretle(metin: string): string {
  return `°°${metin}°°`;
}

/**
 * Satir ici sabit-genislik vurgusu — `<code>...</code>`. Kisa bir
 * degeri (tarih/saat gibi) bir emoji/etiketin yanina, tek basina bir
 * satir acmadan koymak icin.
 */
export function kodIsaretle(metin: string): string {
  return `˚˚${metin}˚˚`;
}

const ON_IZGARA_ISARETI = '¦¦PRE¦¦';

/**
 * Birden cok satiri TEK bir `<pre>` (sabit genislikli tablo) blogu
 * olarak sarar — Telegram, `<pre>` DISINDAKI ic ice bosluklari
 * gormezden geliyor, bu yuzden hizalanmis bir tablo yalnizca boyle
 * tek bir blok olarak gonderilirse hizali gorunuyor.
 */
export function onIzgaraBlogu(icSatirlar: string[]): string {
  return `${ON_IZGARA_ISARETI}${icSatirlar.join('\n')}${ON_IZGARA_ISARETI}`;
}

/**
 * Rapor mesajlarinin TEK giris noktasi: satir dizisini HTML-guvenli
 * metne cevirir.
 *
 * ── Neden boyle ──────────────────────────────────────────────────────
 * Her satir escapeHtml'den GECER — statik etiket/emoji metninde zaten
 * `&`/`<`/`>` yok, dinamik degerlerde (login, not, red nedeni) VARSA
 * Telegram mesaji parcalayamayip 400 donduruyor ve mesaj SESSIZCE hic
 * gitmiyor. Tek tek her interpolasyonu kacmak yerine butun satir
 * kaciliyor — unutma riski yok.
 *
 * Sarmalayici isaretler (`kalinSatir`, `kalinIsaretle`, `kodIsaretle`,
 * `onIzgaraBlogu`) hepsi rapor verisinde (login, tutar, tarih) pratikte
 * hic gecmeyecek nadir karakter dizileri kullaniyor — dinamik bir deger
 * yanlislikla bir isaretle CAKISMAZ. Kacış SONRA uygulaniyor; isaret
 * karakterleri escapeHtml'den etkilenmiyor, sira onemsiz.
 */
export function gorselMesaj(satirlar: Array<string | null | undefined>): string {
  return satirlar
    .filter((s): s is string => s !== null && s !== undefined)
    .map((satir) => {
      if (satir.startsWith(ON_IZGARA_ISARETI) && satir.endsWith(ON_IZGARA_ISARETI) && satir.length > ON_IZGARA_ISARETI.length * 2) {
        const ic = satir.slice(ON_IZGARA_ISARETI.length, -ON_IZGARA_ISARETI.length);
        return `<pre>${escapeHtml(ic)}</pre>`;
      }
      const tamSatirKalin = satir.match(/^\*\*(.*)\*\*$/);
      if (tamSatirKalin) return `<b>${escapeHtml(tamSatirKalin[1])}</b>`;
      return escapeHtml(satir)
        .replace(/°°(.*?)°°/g, '<b>$1</b>')
        .replace(/˚˚(.*?)˚˚/g, '<code>$1</code>');
    })
    .join('\n');
}

async function telegramApiCall(method: string, params: Record<string, unknown> = {}): Promise<any> {
  if (!config.telegram.botToken) throw new Error('TELEGRAM_BOT_TOKEN tanımlı değil.');
  const res = await fetch(`${TELEGRAM_API}/bot${config.telegram.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok !== true) {
    throw new Error(body?.description || `Telegram API hatası: ${method}`);
  }
  return body.result;
}

/**
 * Üyelik sorgusunun sonucu.
 *
 * "Sorgulayamadım" ile "üye değil" ayrı tutulur. Önceden her hata yutulup `null`
 * dönüyordu ve çağıran taraf bunu "üye değil" sayıyordu: bot kanalda yönetici
 * değilse, chatId yanlışsa ya da token bozuksa oyuncu kanala üye olsa bile
 * "kanala katılmanız gerekiyor" görüyor, log da düşmüyordu.
 */
export type ChatMemberSonucu =
  | { ok: true; status: string; isMember: boolean }
  | { ok: false; error: string };

/** Kullanıcının belirtilen kanal/gruptaki gerçek zamanlı üyelik durumunu sorgular. */
export async function getChatMember(chatId: string, telegramUserId: number | string): Promise<ChatMemberSonucu> {
  try {
    const result = await telegramApiCall('getChatMember', { chat_id: chatId, user_id: telegramUserId });
    const status = String(result?.status ?? '');
    return { ok: true, status, isMember: isActiveMemberStatus(status, result?.is_member) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Telegram üyelik sorgusu başarısız.' };
  }
}

/**
 * `restricted` durumundaki kullanıcı kanalda kısıtlanmıştır ama Telegram
 * `is_member: true` diyorsa hâlâ üyedir; bonusu hak eder.
 */
export function isActiveMemberStatus(status: string | null, isMemberFlag?: unknown): boolean {
  if (status == null) return false;
  if (['member', 'administrator', 'creator'].includes(status)) return true;
  return status === 'restricted' && isMemberFlag === true;
}

/**
 * Mesaj gonder.
 *
 * `secenek.klavye` satir ici buton eklemek icin; `secenek.zorunluYanit`
 * Telegram'in `force_reply` mekanizmasi (bot soru sorar, operator
 * yanitlar ve yanit `reply_to_message` ile geri gelir).
 *
 * Mesaj kimligi doner: bir cekim mesajinin butonlarini sonradan
 * kaldirmak icin gerekiyor.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  secenek: { klavye?: unknown; zorunluYanit?: boolean; html?: boolean } = {},
): Promise<{ messageId: number | null }> {
  const params: Record<string, unknown> = { chat_id: chatId, text };
  // `html` yalnizca `gorselMesaj()` ile INSA EDILMIS metinlerde acilir —
  // o yardimci butun dinamik degerleri onceden kaciyor. Diger cagrilar
  // (force_reply sorulari, kisa onay mesajlari) duz metin kalir; aksi
  // halde kacilmamis bir login/not degeri Telegram'a 400 donduturur ve
  // mesaj SESSIZCE hic gitmez.
  if (secenek.html) params.parse_mode = 'HTML';
  if (secenek.klavye) params.reply_markup = secenek.klavye;
  else if (secenek.zorunluYanit) params.reply_markup = { force_reply: true, selective: true };
  const sonuc = await telegramApiCall('sendMessage', params);
  return { messageId: Number(sonuc?.message_id) || null };
}

/**
 * Butonlari kaldir.
 *
 * Bir cekim cozumlendikten sonra butonlar durursa ikinci kez basilir ve
 * uctan hata doner; operator "calismiyor" saniyor. Sonuc mesaja
 * yazildiginda butonlar da silinir.
 */
export async function telegramButonlariKaldir(chatId: number | string, messageId: number): Promise<void> {
  await telegramApiCall('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
    .catch(() => undefined);
}

/** Butona basildiginda Telegram'in bekledigi onay; yoksa dugme "yukleniyor" kalir. */
export async function telegramCallbackYanitla(callbackQueryId: string, metin: string): Promise<void> {
  await telegramApiCall('answerCallbackQuery', { callback_query_id: callbackQueryId, text: metin.slice(0, 200) })
    .catch(() => undefined);
}

/** Mesaja yanit olarak gonder — hangi cekime ait oldugu sohbette kaybolmasin. */
export async function telegramYanitla(
  chatId: number | string,
  messageId: number,
  text: string,
  secenek: { html?: boolean } = {},
): Promise<void> {
  const params: Record<string, unknown> = { chat_id: chatId, text, reply_to_message_id: messageId };
  if (secenek.html) params.parse_mode = 'HTML';
  await telegramApiCall('sendMessage', params).catch(() => undefined);
}

/**
 * Webhook'u aciliste yeniden dogrula/kaydet.
 *
 * `TELEGRAM_WEBHOOK_URL` bossa DOKUNULMAZ. Doluysa `setWebhook`
 * `allowed_updates: ["message", "callback_query"]` ile YENIDEN
 * cagirilir — webhook'un DAHA ONCE elle (BotFather/curl) kurulup
 * `callback_query`'i hic istememis olma ihtimaline karsi. Bu durumda
 * cekim onay/ret butonlarina basmak Telegram tarafinda hicbir seye
 * varmaz: buton basimi gonderilmez, sunucuya asla dusmez, hata da
 * loglanmaz — sessizce hicbir sey olmaz. Aciliste kendini onaran bu
 * cagri olmadan bu durum yeniden, sessizce olusabilir.
 */
export async function ensureTelegramWebhook(): Promise<void> {
  const url = config.telegram.webhookUrl;
  if (!url) return;
  if (!config.telegram.botToken) return;

  await telegramApiCall('setWebhook', {
    url,
    secret_token: config.telegram.webhookSecret || undefined,
    allowed_updates: ['message', 'callback_query'],
    max_connections: 40,
  });
}
