/**
 * Telegram butonuyla cekim cozumleme.
 *
 * Bu dosya GERCEK PARA hareketini tetikliyor. Uc koruma var:
 *
 *   1. YETKI — yalnizca `TELEGRAM_YETKILI_KULLANICILAR` listesindeki
 *      Telegram kimlikleri. Liste bossa buton zaten eklenmiyor, ama
 *      eski bir mesajdaki butona basilabilecegi icin burada TEKRAR
 *      kontrol ediliyor. Istemciden gelen hicbir sey guvenilmez.
 *
 *   2. DENETIM — her cozumleme denetim kaydina duser: kim, hangi
 *      islemi, hangi yonde.
 *
 *   3. BUTONLARI KALDIRMA — cozumlenen mesajin butonlari silinir.
 *      Ikinci basisin uctan hata donmesi operatore "calismiyor"
 *      hissi verirdi.
 */
import { config } from '../config.js';
import { audit } from '../lib/auditLog.js';
import { lynonNotEkle, lynonResolveWithdrawal } from './lynonBackofficeService.js';
import {
  sendTelegramMessage,
  telegramButonlariKaldir,
  telegramCallbackYanitla,
  telegramYanitla,
} from './telegramService.js';
import {
  callbackCoz,
  notIstekMesaji,
  redNedeniIstekMesaji,
  yetkiliKullanicilar,
  yetkiliMi,
  type CekimEylemi,
} from './telegramButonlari.js';

type AnyRecord = Record<string, any>;

const EYLEM_ADI: Record<CekimEylemi, string> = {
  onay: 'onaylandı',
  onayNot: 'onaylandı',
  ret: 'reddedildi',
  retNot: 'reddedildi',
};

export type CallbackSonucu = {
  islendi: boolean;
  mesaj: string;
};

/**
 * Butona basildiginda.
 *
 * Telegram bu cagriyi 60 saniye icinde yanitlamamizi bekliyor; hata
 * durumunda bile `answerCallbackQuery` gonderiliyor, yoksa dugme
 * "yukleniyor" halinde kalir.
 */
export async function telegramCekimCallback(callback: AnyRecord): Promise<CallbackSonucu> {
  const callbackId = String(callback?.id ?? '');
  const veri = callbackCoz(callback?.data);
  if (!veri) return { islendi: false, mesaj: 'Tanınmayan buton.' };

  const chatId = callback?.message?.chat?.id;
  const messageId = Number(callback?.message?.message_id) || null;
  const kullaniciId = callback?.from?.id;
  const kullaniciAdi = String(callback?.from?.username ?? callback?.from?.id ?? 'bilinmeyen');

  // 1 · Yetki. Buton eski bir mesajda durabilir; her basista bakilir.
  if (!yetkiliMi(kullaniciId, yetkiliKullanicilar())) {
    if (callbackId) await telegramCallbackYanitla(callbackId, 'Bu işlem için yetkiniz yok.');
    return { islendi: false, mesaj: `Yetkisiz kullanıcı: ${kullaniciAdi}` };
  }

  const onayMi = veri.eylem === 'onay' || veri.eylem === 'onayNot';

  try {
    await lynonResolveWithdrawal({
      transactionId: veri.islemId,
      status: onayMi ? 'approved' : 'rejected',
    });
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : String(err);
    if (callbackId) await telegramCallbackYanitla(callbackId, `Hata: ${mesaj}`.slice(0, 190));
    if (chatId && messageId) await telegramYanitla(chatId, messageId, `⚠️ İşlem başarısız: ${mesaj}`);
    return { islendi: false, mesaj };
  }

  // 2 · Denetim.
  audit(kullaniciAdi, 'telegram', 'withdrawal_resolve', `islem:${veri.islemId}`,
    `Çekim ${EYLEM_ADI[veri.eylem]} (Telegram butonu). Oyuncu: ${veri.oyuncuId || 'bilinmiyor'}.`);

  // 3 · Butonlari kaldir ve sonucu mesaja yaz.
  if (chatId && messageId) {
    await telegramButonlariKaldir(chatId, messageId);
    await telegramYanitla(chatId, messageId,
      `${onayMi ? '✅' : '❌'} Çekim ${EYLEM_ADI[veri.eylem]} — ${kullaniciAdi}`);
  }
  if (callbackId) await telegramCallbackYanitla(callbackId, `Çekim ${EYLEM_ADI[veri.eylem]}.`);

  // "Onayla + Not" ise not sorulur; yanit webhook'ta yakalanir.
  if (veri.eylem === 'onayNot' && chatId && veri.oyuncuId) {
    await sendTelegramMessage(chatId, notIstekMesaji(veri.oyuncuId, ''), { zorunluYanit: true })
      .catch(() => undefined);
  }

  // "Red Nedeni Yaz" ise neden sorulur; yanit "çekim onay" grubuna gider.
  if (veri.eylem === 'retNot' && chatId) {
    await sendTelegramMessage(chatId, redNedeniIstekMesaji(veri.islemId, veri.oyuncuId, ''), { zorunluYanit: true })
      .catch(() => undefined);
  }

  return { islendi: true, mesaj: `Çekim ${veri.islemId} ${EYLEM_ADI[veri.eylem]}.` };
}

/**
 * Not istegine gelen yanit.
 *
 * Operator botun "Not eklenecek oyuncu: …" mesajini yanitladiginda
 * cagrilir. Oyuncu kimligi yanitlanan mesajin METNINDEN okunur; ayri
 * bir durum tablosu tutmak yerine bu, yeniden baslatmaya dayanikli.
 */
export async function telegramNotYaniti(input: {
  oyuncuId: string;
  metin: string;
  chatId: number | string;
  messageId: number | null;
  kullaniciId: unknown;
  kullaniciAdi: string;
}): Promise<CallbackSonucu> {
  if (!yetkiliMi(input.kullaniciId, yetkiliKullanicilar())) {
    return { islendi: false, mesaj: 'Yetkisiz kullanıcı.' };
  }
  const metin = String(input.metin ?? '').trim();
  if (!metin) return { islendi: false, mesaj: 'Not metni boş.' };

  try {
    // Tip verilmiyor: servis "Manual" tipini ADINDAN buluyor, kimlik
    // koda gomulmuyor.
    await lynonNotEkle({ playerId: input.oyuncuId, text: metin });
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : String(err);
    if (input.messageId) await telegramYanitla(input.chatId, input.messageId, `⚠️ Not eklenemedi: ${mesaj}`);
    return { islendi: false, mesaj };
  }

  audit(input.kullaniciAdi, 'telegram', 'crm_temas', `player:${input.oyuncuId}`,
    `Telegram üzerinden profil notu eklendi: ${metin.slice(0, 200)}`);

  if (input.messageId) {
    await telegramYanitla(input.chatId, input.messageId, `📝 Not eklendi — ${input.kullaniciAdi}`);
  }
  return { islendi: true, mesaj: 'Not eklendi.' };
}

/**
 * Red nedeni istegine gelen yanit.
 *
 * Not yanitindan farkli: profile YAZILMAZ, "çekim onay" (`TELEGRAM_CHAT_CEKIM_ONAY`)
 * grubuna AYRI bir mesaj olarak gonderilir. Onay/ret tek grupta
 * birlestiginde o grubu izleyen ekip red gerekcesini gormeye devam etsin
 * diye var; sohbet tanimli degilse acikca soylenir, sessizce yutulmaz.
 */
export async function telegramRedNedeniYaniti(input: {
  islemId: string;
  oyuncuId: string;
  metin: string;
  chatId: number | string;
  messageId: number | null;
  kullaniciId: unknown;
  kullaniciAdi: string;
}): Promise<CallbackSonucu> {
  if (!yetkiliMi(input.kullaniciId, yetkiliKullanicilar())) {
    return { islendi: false, mesaj: 'Yetkisiz kullanıcı.' };
  }
  const metin = String(input.metin ?? '').trim();
  if (!metin) return { islendi: false, mesaj: 'Red nedeni boş.' };

  const hedef = config.telegram.raporChatIdleri.cekimOnay;
  if (!hedef) {
    if (input.messageId) {
      await telegramYanitla(input.chatId, input.messageId,
        '⚠️ TELEGRAM_CHAT_CEKIM_ONAY tanımlı değil, red nedeni gönderilemedi.');
    }
    return { islendi: false, mesaj: 'TELEGRAM_CHAT_CEKIM_ONAY tanımlı değil.' };
  }

  await sendTelegramMessage(hedef, [
    '🚫 ÇEKİM RED NEDENİ',
    `İşlem: ${input.islemId}`,
    input.oyuncuId ? `Oyuncu: ${input.oyuncuId}` : null,
    `Neden: ${metin}`,
    `Yazan: ${input.kullaniciAdi}`,
  ].filter(Boolean).join('\n')).catch(() => undefined);

  audit(input.kullaniciAdi, 'telegram', 'withdrawal_resolve', `islem:${input.islemId}`,
    `Çekim red nedeni Telegram'da paylaşıldı: ${metin.slice(0, 200)}`);

  if (input.messageId) {
    await telegramYanitla(input.chatId, input.messageId, `📨 Red nedeni gönderildi — ${input.kullaniciAdi}`);
  }
  return { islendi: true, mesaj: 'Red nedeni gönderildi.' };
}
