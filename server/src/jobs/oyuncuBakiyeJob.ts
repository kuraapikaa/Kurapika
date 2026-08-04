/**
 * Anlik oyuncu bakiye botu — is akisi.
 *
 * Her `TELEGRAM_BAKIYE_OZET_MS` (varsayilan 7.5 dakika) rapor 1843'ten
 * toplam gercek/bonus/toplam oyuncu bakiyesini cekip TEK bir Telegram
 * sohbetine atar. Karar ve bicimleme `services/oyuncuBakiyeRaporu`
 * icinde ve testli; burada yalnizca "zamani geldi mi, cek, gonder,
 * onceki ozeti sakla" var.
 *
 * Onceki ozet saklanir ki mesajda bir onceki gonderime gore trend oku
 * (▲/▼) gorunsun — 7.5 dakikada bir gelen ciplak bir sayi yerine "yon".
 */
import { config } from '../config.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { sendTelegramMessage } from '../services/telegramService.js';
import { ozetZamaniMi } from '../services/telegramRaporu.js';
import { lynonAnlikOyuncuBakiyesi } from '../services/lynonBackofficeService.js';
import { oyuncuBakiyeMesaji, type OyuncuBakiyeOzeti, type TopBakiyeliOyuncu } from '../services/oyuncuBakiyeRaporu.js';

const NAMESPACE = 'oyuncu-bakiye-durumu';

type Durum = {
  sonGonderim: string | null;
  sonOzet: OyuncuBakiyeOzeti | null;
};

export type OyuncuBakiyeSonucu = {
  atlandi?: string;
  gonderildi: boolean;
};

export async function runOyuncuBakiyeJob(tenantKey = 'default', now = new Date()): Promise<OyuncuBakiyeSonucu> {
  const chatId = config.telegram.bakiyeOzetiChatId;
  if (!chatId) return { atlandi: 'TELEGRAM_CHAT_BAKIYE tanımlı değil.', gonderildi: false };

  const durum = await readStoredDocument<Durum>({
    tenantKey,
    namespace: NAMESPACE,
    fallback: { sonGonderim: null, sonOzet: null },
  });

  if (!ozetZamaniMi(durum.sonGonderim, config.telegram.bakiyeOzetiAralikMs, now.getTime())) {
    return { atlandi: 'Gönderim aralığı henüz dolmadı.', gonderildi: false };
  }

  const yanit = await lynonAnlikOyuncuBakiyesi({});
  const ozet: OyuncuBakiyeOzeti = yanit?.Data?.Ozet;
  const topOyuncular: TopBakiyeliOyuncu[] | undefined = yanit?.Data?.TopOyuncular;
  await sendTelegramMessage(chatId, oyuncuBakiyeMesaji(ozet, durum.sonOzet, topOyuncular));

  // Kayit GONDERIM BASARILI OLDUKTAN sonra; Telegram dusukse bir
  // sonraki turda tekrar denenir ve trend onceki basarili gonderime gore kalir.
  await writeStoredDocument<Durum>(
    { tenantKey, namespace: NAMESPACE },
    { sonGonderim: now.toISOString(), sonOzet: ozet },
  );
  return { gonderildi: true };
}
