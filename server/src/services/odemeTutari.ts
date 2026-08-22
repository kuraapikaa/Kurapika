/**
 * BİR ÖDEME SATIRINDA GERÇEKTEN HAREKET EDEN PARA.
 *
 * ── Neden var ─────────────────────────────────────────────────────────
 * Canlıda ölçüldü: `halil4554` için Lynon tek yatırım satırı döndürüyor,
 * `amount: 2000` ve `actualAmount: 500`. Oyuncunun gerçek yatırımı 500.
 * Yani YATIRIMDA hesaba geçen tutar `amount` değil `actualAmount`.
 *
 * Bu ayrım kozmetik değil, PARA DAĞITIYOR:
 *
 *   kayıp bonusu tabanı = yatırım − çekim      (kayipTabaniService)
 *   yüzdeli bonuslar    = son yatırımın yüzdesi (depositBasis)
 *
 * İkisi de bu satırlardan besleniyor. `amount` dört kat büyük okununca
 * taban dört kat şişiyor ve bonus da öyle. Bildirilen vaka: oyuncu
 * 2499894'e 22.08.2026 02:04'te 13.650 ₺ kayıp bonusu yazılmış.
 *
 * ── Neden tek dosya ───────────────────────────────────────────────────
 * `row.amount` on beşten fazla yerde okunuyordu: işlem listesi, oyuncu
 * profili, gösterge panelleri, önceki gün toplamı, son yatırım, KPI
 * yedekleri ve kayıp tabanı. Her birini ayrı düzeltmek, birini atlamak
 * demekti -- ve atlanan yer sessizce yanlış para dağıtmaya devam
 * ederdi. Bunun yerine satırlar KAYNAKTA normalize ediliyor:
 * `lynonPaymentTransactions` döndürmeden önce `amount` alanını
 * gerçekten hareket eden tutara çeviriyor.
 *
 * Ham değer kaybolmuyor: `hamAmount` altında duruyor, teşhis için.
 */

/**
 * Metni sayıya çevirir — `lynonBackofficeService.numberFrom` ile AYNI
 * kural. Lynon bazı alanları biçimlenmiş metin olarak döndürüyor
 * ("1.234,56"); `Number()` bunu NaN yapar ve NaN sessizce 0'a düşer.
 *
 * Son görülen ayırıcı hangisiyse ONDALIK odur.
 */
export function paraSayisi(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === '') return fallback;
  let text = String(value).trim();
  if (!text) return fallback;
  text = text.replace(/[^\d,.-]/g, '');
  if (!text) return fallback;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma > dot) text = text.replace(/\./g, '').replace(',', '.');
  else text = text.replace(/,/g, '');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type OdemeSatiri = {
  transactionType?: unknown;
  type?: unknown;
  amount?: unknown;
  actualAmount?: unknown;
  receivedAmount?: unknown;
  [key: string]: unknown;
};

export function yatirimMi(satir: OdemeSatiri): boolean {
  return String(satir?.transactionType ?? satir?.type ?? '').trim().toLowerCase() === 'deposit';
}

/**
 * Satırda gerçekten hareket eden tutar.
 *
 * Yatırım: `actualAmount` önce. Çekimde sıra DEĞİŞMEDİ (`amount` önce)
 * -- çekim tarafında aynı ölçüm yapılmadı ve doğrulanmamış bir
 * varsayımla değiştirmek, bilineni düzeltirken bilinmeyeni bozmak olurdu.
 *
 * `??` kullanılıyor, "ilk sıfır olmayan" değil: 0 geçerli bir tutardır,
 * "yok" değil. İşaret korunur — mutlak değere çevirmek çağıranın işi;
 * bazı ekranlar çekimi eksi göstermek istiyor.
 */
export function etkinTutar(satir: OdemeSatiri): number {
  const ham = yatirimMi(satir)
    ? (satir?.actualAmount ?? satir?.amount ?? satir?.receivedAmount)
    : (satir?.amount ?? satir?.actualAmount ?? satir?.receivedAmount);
  return paraSayisi(ham);
}

/**
 * Satırı, `amount` alanı gerçekten hareket eden tutarı gösterecek
 * şekilde yeniden yazar.
 *
 * Böylece `row.amount` okuyan HER yer -- on beşten fazla çağrı -- tek
 * bir değişiklikle doğru sonucu görüyor. Orijinal değer `hamAmount`
 * altında saklanıyor; teşhis ekranı ikisini karşılaştırabilsin.
 *
 * Zaten normalize edilmiş bir satır tekrar geçse sonuç değişmez:
 * yatırımda `actualAmount` yine `actualAmount`tır.
 */
export function odemeSatiriniNormalize<T extends OdemeSatiri>(satir: T): T {
  if (!satir || typeof satir !== 'object') return satir;
  const etkin = etkinTutar(satir);
  const ham = satir.amount;
  if (paraSayisi(ham) === etkin) return satir;
  return { ...satir, amount: etkin, hamAmount: ham };
}
