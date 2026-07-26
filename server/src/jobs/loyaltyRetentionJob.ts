import { config } from '../config.js';
import { getLoyaltyService } from '../services/loyaltyService.js';
import { isLynonConfigured, lynonFindPlayerByLogin } from '../services/lynonBackofficeService.js';
import { sendSmsMessage } from '../lib/proxy/backoffice.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SMS_REMINDER_MESSAGE = 'Narcosbahis sadakat puanlarınız 1 gün sonra silinecek! Puanlarınızı korumak için hemen giriş yapın.';

function daysSince(isoDate: string): number {
  const then = Date.parse(isoDate);
  if (!Number.isFinite(then)) return 0;
  return Math.floor((Date.now() - then) / DAY_MS);
}

/**
 * Ard arda giriş yapılmayan (sadakat sayfası ziyaret edilmeyen) oyuncular için:
 * - 2. gün: SMS hatırlatması gönderilir (tek seferlik; yeni girişte sıfırlanır).
 * - 3. gün: Sadakat puanları silinir (tek seferlik; yeni girişte sıfırlanır).
 */
export async function runLoyaltyRetentionSweep(tenantKey: string = 'default'): Promise<{ reminded: number; reset: number; errors: number }> {
  const service = getLoyaltyService(tenantKey);
  const players = await service.listPlayers();
  let reminded = 0;
  let reset = 0;
  let errors = 0;

  for (const [username, player] of players) {
    if (!player.lastLoginDate) continue; // Eski kayıt: bir sonraki gerçek girişte alan doldurulacak.
    const inactiveDays = daysSince(player.lastLoginDate);

    if (inactiveDays >= 3 && player.points > 0 && !player.pointsResetAt) {
      await service.resetLoyaltyPoints(username);
      reset++;
      continue;
    }

    if (inactiveDays === 2 && !player.smsReminderSentAt) {
      try {
        if (isLynonConfigured()) {
          const lynonPlayer = await lynonFindPlayerByLogin(username);
          const phone = lynonPlayer?.Phone || lynonPlayer?.MobilePhone;
          if (phone && config.sms.token) {
            const result = await sendSmsMessage(phone, SMS_REMINDER_MESSAGE, config.sms);
            if (result.ok) reminded++;
          }
        }
        await service.sendLoyaltyReminderMark(username);
      } catch (err) {
        errors++;
        console.error(`[loyalty-retention] ${username} için SMS gönderilemedi:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return { reminded, reset, errors };
}
