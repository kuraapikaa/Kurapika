/**
 * Aylik mutabakat isi.
 *
 * Her gun Turkiye saatiyle 00:00'da, ayin basindan o ana kadarki
 * mutabakati TEK bir Telegram sohbetine gonderir. Hesaplama
 * `services/mutabakat` icinde ve testli.
 *
 * ── Gunde bir kez ─────────────────────────────────────────────────────
 *
 * Is dakikada bir uyanip saate bakiyor; 00:00 penceresine girildiginde
 * ve O GUN daha gonderilmemisse gonderiyor. Gonderilen gun kaydediliyor,
 * boylece surec yeniden baslasa da ayni gun ikinci kez gitmiyor.
 *
 * Neden cron degil: proje icinde zamanlayici yalnizca `intervalMs`
 * destekliyor ve ayni desen `nextDayBonusJob` icinde zaten kullaniliyor.
 */
import { config } from '../config.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { istanbulDateKey } from '../lib/istanbulGunu.js';
import { sendTelegramMessage } from '../services/telegramService.js';
import { lynonMutabakat } from '../services/lynonBackofficeService.js';

const NAMESPACE = 'mutabakat-durumu';

/** 00:00'i kacirmamak icin pencere; is dakikada bir uyaniyor. */
const PENCERE_DAKIKA = Number(process.env.MUTABAKAT_PENCERE_DK) || 10;

type MutabakatDurumu = { sonGonderilenGun: string | null };

export type MutabakatSonucu = {
  atlandi?: string;
  gonderildi: boolean;
  gun: string;
};

/** Turkiye saatine gore saat ve dakika. */
function istanbulSaati(now: Date): { saat: number; dakika: number } {
  const parcalar = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const al = (tur: string) => Number(parcalar.find((p) => p.type === tur)?.value ?? NaN);
  return { saat: al('hour'), dakika: al('minute') };
}

/** Gonderim penceresinde miyiz? (00:00 – 00:PENCERE) */
export function mutabakatZamaniMi(now: Date = new Date()): boolean {
  const { saat, dakika } = istanbulSaati(now);
  return saat === 0 && dakika < PENCERE_DAKIKA;
}

export async function runMutabakatJob(tenantKey = 'default', now = new Date()): Promise<MutabakatSonucu> {
  const gun = istanbulDateKey(now);
  const chatId = config.telegram.mutabakatChatId;

  if (!chatId) return { atlandi: 'TELEGRAM_CHAT_MUTABAKAT tanımlı değil.', gonderildi: false, gun };
  if (!mutabakatZamaniMi(now)) return { atlandi: 'Gönderim penceresi dışında.', gonderildi: false, gun };

  const durum = await readStoredDocument<MutabakatDurumu>({
    tenantKey,
    namespace: NAMESPACE,
    fallback: { sonGonderilenGun: null },
  });
  if (durum.sonGonderilenGun === gun) {
    return { atlandi: 'Bugün zaten gönderildi.', gonderildi: false, gun };
  }

  const yanit = await lynonMutabakat({ bugun: gun, tenantKey });
  await sendTelegramMessage(chatId, String(yanit?.Data?.Mesaj ?? ''));

  // Kayit GONDERIM BASARILI OLDUKTAN sonra; Telegram dusukse bir
  // sonraki turda tekrar denenir.
  await writeStoredDocument<MutabakatDurumu>({ tenantKey, namespace: NAMESPACE }, { sonGonderilenGun: gun });
  return { gonderildi: true, gun };
}

/** Panelden "şimdi gönder". Pencere ve gün kaydı kontrolü yapmaz. */
export async function mutabakatiSimdiGonder(tenantKey = 'default'): Promise<void> {
  const chatId = config.telegram.mutabakatChatId;
  if (!chatId) throw new Error('TELEGRAM_CHAT_MUTABAKAT tanımlı değil.');
  const yanit = await lynonMutabakat({ bugun: istanbulDateKey(new Date()), tenantKey });
  await sendTelegramMessage(chatId, String(yanit?.Data?.Mesaj ?? ''));
}
