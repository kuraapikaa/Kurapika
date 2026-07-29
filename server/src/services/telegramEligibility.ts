import { getChatMember, isTelegramConfigured } from './telegramService.js';
import { getLinkedTelegramUserId } from './telegramLinkService.js';

/**
 * Bonus uygunluğu için Telegram kanal üyeliği kontrolü.
 *
 * Neden canlı sorgu: amaç kanaldan çıkanın bonusu alamaması. Yalnızca "hesap
 * bağlı mı" bakmak yetmez — oyuncu bir kez bağlayıp kanaldan ayrılabilir.
 *
 * Fail-closed: sorgulanamayan her durum UYGUN DEĞİL sayılır, ancak sebep
 * ayrı tutulur ki operatör logdan "üye değil" ile "sorgulayamadım"ı ayırabilsin.
 */
export type TelegramUygunluk = {
  ok: boolean;
  reason: string;
};

export async function telegramUyeligiKontrolEt(input: {
  tenantKey: string;
  login: string;
  chatId?: string | null;
}): Promise<TelegramUygunluk> {
  const login = String(input.login ?? '').trim();
  if (!login) return { ok: false, reason: 'RED: Oyuncu kullanıcı adı okunamadı' };

  if (!isTelegramConfigured()) {
    return { ok: false, reason: 'RED: Telegram entegrasyonu yapılandırılmamış' };
  }
  const chatId = String(input.chatId ?? '').trim();
  if (!chatId) {
    return { ok: false, reason: 'RED: Telegram kanal kimliği tanımlı değil' };
  }

  const telegramUserId = await getLinkedTelegramUserId(input.tenantKey, login);
  if (!telegramUserId) {
    return { ok: false, reason: 'RED: Telegram hesabı bağlanmamış' };
  }

  const membership = await getChatMember(chatId, telegramUserId);
  if (!membership.ok) {
    return { ok: false, reason: `RED: Telegram üyeliği doğrulanamadı (${membership.error})` };
  }
  if (!membership.isMember) {
    return { ok: false, reason: `RED: Telegram kanalına üye değil (${membership.status})` };
  }
  return { ok: true, reason: 'UYGUN: Telegram kanalına üye' };
}
