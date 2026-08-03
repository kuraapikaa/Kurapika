/**
 * Anlik rapor Telegram botu — is akisi.
 *
 * Bes akis: kasa ozeti, yatirim, cekim talebi, bakiye duzeltmesi
 * (correction) ve bonus verilisi. Karar ve bicimleme
 * `services/telegramRaporu` icinde ve testli; burada yalnizca "cek,
 * karsilastir, gonder, imleci yaz" var.
 *
 * ── Sessiz kalma kurallari ────────────────────────────────────────────
 *
 *   • `TELEGRAM_RAPOR_CHAT_ID` bos ise bot HIC calismaz. Varsayilan bir
 *     sohbet uydurmak, kasa raporunu yanlis yere gondermek olur.
 *   • Ilk turda hicbir sey gonderilmez; yalnizca mevcut durum ogrenilir.
 *   • Bir akis hata verirse digerleri calismaya devam eder. Yatirim ucu
 *     dustugu icin cekim bildirimleri de susmamali.
 */
import { config } from '../config.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { isTelegramConfigured, sendTelegramMessage } from '../services/telegramService.js';
import {
  istanbulDateKey,
  lynonClientBonusReport,
  lynonCorrectionHistory,
  lynonDashboardSummary,
  lynonDeposits,
  lynonWithdrawalRequests,
} from '../services/lynonBackofficeService.js';
import {
  bonusMesaji,
  bosImlec,
  cekimMesaji,
  correctionMesaji,
  kasaMesaji,
  ozetZamaniMi,
  tasanMesaji,
  yatirimMesaji,
  yeniOlaylar,
  type RaporImleci,
} from '../services/telegramRaporu.js';

const NAMESPACE = 'telegram-rapor-imleci';

type AnyRecord = Record<string, any>;

export type TelegramRaporSonucu = {
  atlandi?: string;
  gonderilen: number;
  hata: number;
  ozetGonderildi: boolean;
};

/** Bir akisin tanimi: adi, satirlari nereden gelir, kimligi ve mesaji nasil yazilir. */
type Akis = {
  ad: string;
  etiket: string;
  satirlar: () => Promise<AnyRecord[]>;
  kimlik: (satir: AnyRecord) => string;
  mesaj: (satir: AnyRecord) => string;
};

/** Bugunun Turkiye gunu — akislar gun icini tarar. */
function bugun(): string {
  return istanbulDateKey(new Date());
}

function akislar(): Akis[] {
  const gun = bugun();
  const aralik = { startDate: gun, endDate: gun };

  return [
    {
      ad: 'yatirim',
      etiket: 'Yatırım',
      satirlar: async () => {
        const yanit = await lynonDeposits({ ...aralik, MaxRows: 200 });
        return yanit?.Data?.Documents?.Objects ?? [];
      },
      kimlik: (satir) => String(satir.Id ?? satir.DocumentId ?? satir.ReferenceNo ?? ''),
      mesaj: yatirimMesaji,
    },
    {
      ad: 'cekim',
      etiket: 'Çekim',
      satirlar: async () => {
        const yanit = await lynonWithdrawalRequests({ ...aralik, MaxRows: 200 });
        return yanit?.Data?.ClientRequests ?? [];
      },
      kimlik: (satir) => String(satir.Id ?? satir.DocumentId ?? satir.ReferenceNo ?? ''),
      mesaj: cekimMesaji,
    },
    {
      ad: 'correction',
      etiket: 'Düzeltme',
      satirlar: async () => {
        const yanit = await lynonCorrectionHistory({ ...aralik, countPerPage: 200 });
        return yanit?.Data?.Objects ?? [];
      },
      kimlik: (satir) => String(satir.Id ?? satir.id ?? ''),
      mesaj: correctionMesaji,
    },
    {
      ad: 'bonus',
      etiket: 'Bonus',
      satirlar: async () => {
        const yanit = await lynonClientBonusReport(aralik);
        return yanit?.Data?.ClientBonusReportData?.Objects ?? [];
      },
      kimlik: (satir) => String(satir.BonusSessionId ?? satir.Id ?? ''),
      mesaj: bonusMesaji,
    },
  ];
}

async function ozetGonder(chatId: string): Promise<void> {
  const gun = bugun();
  const yanit = await lynonDashboardSummary(gun, gun);
  const d = (yanit?.Data ?? {}) as AnyRecord;
  await sendTelegramMessage(chatId, kasaMesaji({
    gun,
    yatirim: d.Deposits ?? null,
    cekim: d.Withdrawals ?? null,
    ggr: d.GGR ?? null,
    kar: d.Profit ?? null,
    yeniKayit: d.PlayersRegistered ?? null,
    yatirimOyuncu: d.DepositClientCount ?? null,
    cekimOyuncu: d.WithdrawalClientCount ?? null,
    oyuncuBakiyesi: d.PlayersBalance ?? null,
  }));
}

export async function runTelegramRaporJob(tenantKey = 'default'): Promise<TelegramRaporSonucu> {
  const sonuc: TelegramRaporSonucu = { gonderilen: 0, hata: 0, ozetGonderildi: false };
  const chatId = config.telegram.raporChatId;

  if (!isTelegramConfigured()) return { ...sonuc, atlandi: 'TELEGRAM_BOT_TOKEN tanımlı değil.' };
  if (!chatId) return { ...sonuc, atlandi: 'TELEGRAM_RAPOR_CHAT_ID tanımlı değil.' };

  const imlec = await readStoredDocument<RaporImleci>({
    tenantKey,
    namespace: NAMESPACE,
    fallback: bosImlec,
  });
  imlec.akislar ??= {};
  let degisti = false;

  for (const akis of akislar()) {
    try {
      const satirlar = await akis.satirlar();
      const { yeniler, tasan, imlec: yeniImlec } = yeniOlaylar(satirlar, imlec.akislar[akis.ad], akis.kimlik);

      // Imlec, GONDERIM BASARILI OLDUKTAN sonra yazilir; Telegram
      // dusukse kayitlar bir sonraki turda tekrar denenir.
      for (const satir of yeniler) {
        await sendTelegramMessage(chatId, akis.mesaj(satir));
        sonuc.gonderilen += 1;
      }
      if (tasan > 0) {
        await sendTelegramMessage(chatId, tasanMesaji(akis.etiket, tasan));
        sonuc.gonderilen += 1;
      }

      imlec.akislar[akis.ad] = yeniImlec;
      degisti = true;
    } catch (err) {
      sonuc.hata += 1;
      console.error(`[telegram-rapor] ${akis.ad}:`, err instanceof Error ? err.message : err);
    }
  }

  if (ozetZamaniMi(imlec.sonOzet, config.telegram.raporOzetAralikMs)) {
    try {
      await ozetGonder(chatId);
      imlec.sonOzet = new Date().toISOString();
      sonuc.ozetGonderildi = true;
      degisti = true;
    } catch (err) {
      sonuc.hata += 1;
      console.error('[telegram-rapor] kasa özeti:', err instanceof Error ? err.message : err);
    }
  }

  if (degisti) await writeStoredDocument<RaporImleci>({ tenantKey, namespace: NAMESPACE }, imlec);
  return sonuc;
}

/**
 * Ozeti elle gonder — panelden "simdi gonder" dugmesi icin.
 *
 * Imlece dokunmaz; periyodik ozetin takvimini bozmaz.
 */
export async function telegramKasaOzetiGonder(): Promise<void> {
  if (!isTelegramConfigured()) throw new Error('TELEGRAM_BOT_TOKEN tanımlı değil.');
  if (!config.telegram.raporChatId) throw new Error('TELEGRAM_RAPOR_CHAT_ID tanımlı değil.');
  await ozetGonder(config.telegram.raporChatId);
}
