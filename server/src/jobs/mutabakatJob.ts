/**
 * Gunluk mutabakat isi.
 *
 * Her gun Turkiye saatiyle 00:00'da, BIR ONCEKI (az once kapanan) gunun
 * odeme yontemi kirilimini TEK bir Telegram sohbetine gonderir. Hesaplama
 * `services/mutabakat` icinde ve testli.
 *
 * Once "ay basindan bugune" birikimli gonderiyordu; "bugun ne oldu"
 * sorusu ancak dunku toplamdan cikararak cevaplanabiliyordu. Simdi
 * `lynonGunlukMutabakat` ile TEK gunun rakami gidiyor.
 *
 * AYIN ILK GUNU, ayni 00:00 penceresinde, bir ONCEKI ayin KAPANIS
 * raporu da AYRICA gonderilir — "dun ne oldu" (gunluk) ile "gecen ay
 * kapanista tam olarak ne oldu" (aylik, kesin) farkli sorulara cevap
 * verir; biri digerinin yerine gecmez.
 *
 * ── Gunde bir kez ─────────────────────────────────────────────────────
 *
 * Is dakikada bir uyanip saate bakiyor; 00:00 penceresine girildiginde
 * ve O GUN daha gonderilmemisse gonderiyor. Gonderilen gun kaydediliyor,
 * boylece surec yeniden baslasa da ayni gun ikinci kez gitmiyor. Kapanis
 * raporu icin ayrica hangi ayin GONDERILDIGI kaydedilir — surec ayin
 * ilk gunu birden fazla kez calissa da kapanis ikinci kez gitmiyor.
 *
 * Neden cron degil: proje icinde zamanlayici yalnizca `intervalMs`
 * destekliyor ve ayni desen `nextDayBonusJob` icinde zaten kullaniliyor.
 */
import { config } from '../config.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { istanbulDateKey, istanbulSaatDakika } from '../lib/istanbulGunu.js';
import { sendTelegramMessage } from '../services/telegramService.js';
import { lynonAylikKapanisMutabakati, lynonGunlukMutabakat, previousIstanbulDateKey } from '../services/lynonBackofficeService.js';
import { oncekiAyAnahtari } from '../services/mutabakat.js';

const NAMESPACE = 'mutabakat-durumu';

/** 00:00'i kacirmamak icin pencere; is dakikada bir uyaniyor. */
const PENCERE_DAKIKA = Number(process.env.MUTABAKAT_PENCERE_DK) || 10;

type MutabakatDurumu = {
  sonGonderilenGun: string | null;
  /** Kapanis raporu en son hangi ay ("YYYY-MM") icin gonderildi. */
  sonKapanisAyi: string | null;
};

export type MutabakatSonucu = {
  atlandi?: string;
  gonderildi: boolean;
  gun: string;
};

/** Gonderim penceresinde miyiz? (00:00 – 00:PENCERE) */
export function mutabakatZamaniMi(now: Date = new Date()): boolean {
  const { saat, dakika } = istanbulSaatDakika(now);
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
    fallback: { sonGonderilenGun: null, sonKapanisAyi: null },
  });

  let gonderildi = false;
  let degisti = false;

  if (durum.sonGonderilenGun !== gun) {
    // Pencere 00:00'da aciliyor — raporlanacak TAM gun az once kapanan
    // ONCEKI gun, `gun` (bugun) degil. `gun` yalnizca dedup/kayit
    // anahtari olarak kullanilir.
    const raporGunu = previousIstanbulDateKey(now);
    const yanit = await lynonGunlukMutabakat({ gun: raporGunu, tenantKey });
    await sendTelegramMessage(chatId, String(yanit?.Data?.Mesaj ?? ''), { html: true });
    // Kayit GONDERIM BASARILI OLDUKTAN sonra; Telegram dusukse bir
    // sonraki turda tekrar denenir.
    durum.sonGonderilenGun = gun;
    gonderildi = true;
    degisti = true;
  }

  // Ayin ilk gunu: bir onceki ayin KAPANIS raporu AYRICA gonderilir.
  // Gun kaydindan BAGIMSIZ kendi kaydini tutar — surec ayin ilk gunu
  // birden fazla kez calissa da kapanis ikinci kez gitmez.
  if (gun.endsWith('-01')) {
    const kapanisAyi = oncekiAyAnahtari(gun);
    if (durum.sonKapanisAyi !== kapanisAyi) {
      const kapanisYaniti = await lynonAylikKapanisMutabakati({ ay: kapanisAyi, tenantKey });
      await sendTelegramMessage(chatId, String(kapanisYaniti?.Data?.Mesaj ?? ''), { html: true });
      durum.sonKapanisAyi = kapanisAyi;
      gonderildi = true;
      degisti = true;
    }
  }

  if (degisti) await writeStoredDocument<MutabakatDurumu>({ tenantKey, namespace: NAMESPACE }, durum);
  return gonderildi ? { gonderildi: true, gun } : { atlandi: 'Bugün zaten gönderildi.', gonderildi: false, gun };
}

/**
 * Panelden "şimdi gönder". Pencere ve gün kaydı kontrolü yapmaz.
 *
 * `ay` verilirse O AYIN KAPANIŞ raporu gönderilir (kesin, tam ay);
 * verilmezse bugünün (elle tetiklendiği ana kadarki) günlük mutabakatı
 * gider.
 */
export async function mutabakatiSimdiGonder(tenantKey = 'default', ay?: string): Promise<void> {
  const chatId = config.telegram.mutabakatChatId;
  if (!chatId) throw new Error('TELEGRAM_CHAT_MUTABAKAT tanımlı değil.');
  const yanit = ay
    ? await lynonAylikKapanisMutabakati({ ay, tenantKey })
    : await lynonGunlukMutabakat({ gun: istanbulDateKey(new Date()), tenantKey });
  await sendTelegramMessage(chatId, String(yanit?.Data?.Mesaj ?? ''));
}
