import { config } from '../config.js';

const TELEGRAM_API = 'https://api.telegram.org';

export function isTelegramConfigured(): boolean {
  return Boolean(config.telegram.botToken);
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
  secenek: { klavye?: unknown; zorunluYanit?: boolean } = {},
): Promise<{ messageId: number | null }> {
  const params: Record<string, unknown> = { chat_id: chatId, text };
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
export async function telegramYanitla(chatId: number | string, messageId: number, text: string): Promise<void> {
  await telegramApiCall('sendMessage', { chat_id: chatId, text, reply_to_message_id: messageId })
    .catch(() => undefined);
}
