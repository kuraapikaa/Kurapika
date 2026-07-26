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

/** Kullanıcının belirtilen kanal/gruptaki gerçek zamanlı üyelik durumunu döner (member/administrator/creator/left/kicked). */
export async function getChatMemberStatus(chatId: string, telegramUserId: number | string): Promise<string | null> {
  try {
    const result = await telegramApiCall('getChatMember', { chat_id: chatId, user_id: telegramUserId });
    return result?.status ?? null;
  } catch {
    return null;
  }
}

export function isActiveMemberStatus(status: string | null): boolean {
  return status != null && ['member', 'administrator', 'creator'].includes(status);
}

export async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  await telegramApiCall('sendMessage', { chat_id: chatId, text });
}
