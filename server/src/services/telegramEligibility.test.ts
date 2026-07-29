import { afterEach, describe, expect, it, vi } from 'vitest';
import { telegramUyeligiKontrolEt } from './telegramEligibility.js';
import * as telegramService from './telegramService.js';
import * as linkService from './telegramLinkService.js';

/**
 * Kural fail-closed: sorgulanamayan her durum UYGUN DEĞİL. Amaç kanaldan
 * ayrılanın bonusu alamaması, bu yüzden canlı üyelik sorgusu yapılır.
 */

function telegramKurulu(kurulu: boolean) {
  vi.spyOn(telegramService, 'isTelegramConfigured').mockReturnValue(kurulu);
}
function bagliKimlik(id: number | null) {
  vi.spyOn(linkService, 'getLinkedTelegramUserId').mockResolvedValue(id);
}

const girdi = { tenantKey: 'default', login: 'oyuncu', chatId: '-100123' };

afterEach(() => vi.restoreAllMocks());

describe('Telegram üyelik uygunluğu', () => {
  it('kanala üye oyuncuyu geçirir', async () => {
    telegramKurulu(true);
    bagliKimlik(555);
    vi.spyOn(telegramService, 'getChatMember').mockResolvedValue({ ok: true, status: 'member', isMember: true });

    const sonuc = await telegramUyeligiKontrolEt(girdi);
    expect(sonuc.ok).toBe(true);
  });

  it('kanaldan ayrılmış oyuncuyu reddeder — kuralın asıl amacı', async () => {
    telegramKurulu(true);
    bagliKimlik(555);
    vi.spyOn(telegramService, 'getChatMember').mockResolvedValue({ ok: true, status: 'left', isMember: false });

    const sonuc = await telegramUyeligiKontrolEt(girdi);
    expect(sonuc.ok).toBe(false);
    expect(sonuc.reason).toContain('üye değil');
  });

  it('hesabını bağlamamış oyuncuyu reddeder', async () => {
    telegramKurulu(true);
    bagliKimlik(null);

    const sonuc = await telegramUyeligiKontrolEt(girdi);
    expect(sonuc.ok).toBe(false);
    expect(sonuc.reason).toContain('bağlanmamış');
  });

  it('sorgu düşerse reddeder ama sebebi ayırır', async () => {
    telegramKurulu(true);
    bagliKimlik(555);
    vi.spyOn(telegramService, 'getChatMember').mockResolvedValue({ ok: false, error: 'CHAT_ADMIN_REQUIRED' });

    const sonuc = await telegramUyeligiKontrolEt(girdi);
    expect(sonuc.ok).toBe(false);
    expect(sonuc.reason).toContain('doğrulanamadı');
    expect(sonuc.reason).toContain('CHAT_ADMIN_REQUIRED');
  });

  it('Telegram yapılandırılmamışsa reddeder', async () => {
    telegramKurulu(false);
    const sonuc = await telegramUyeligiKontrolEt(girdi);
    expect(sonuc.ok).toBe(false);
    expect(sonuc.reason).toContain('yapılandırılmamış');
  });

  it('kanal kimliği tanımsızsa reddeder', async () => {
    telegramKurulu(true);
    const sonuc = await telegramUyeligiKontrolEt({ ...girdi, chatId: '' });
    expect(sonuc.ok).toBe(false);
    expect(sonuc.reason).toContain('kanal kimliği');
  });
});
