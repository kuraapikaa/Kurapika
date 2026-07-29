export interface BonusEligibilityItem {
  id: string;
  label?: string;
  reason?: string;
}

export interface FriendlyBonusEligibilityMessage {
  title: string;
  message: string;
}

function missingTryAmount(reason: string | undefined): string | null {
  const match = String(reason ?? '').match(/(?:Eksik:\s*)?([\d.,]+)\s*TRY/i);
  if (!match) return null;
  const normalized = match[1].includes(',') ? match[1].replace(/\\./g, '').replace(',', '.') : match[1];
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

/** Teknik uygunluk detaylarını oyuncuya yönelik kısa ve nazik metinlere dönüştürür. */
export function friendlyBonusEligibilityMessage(item: BonusEligibilityItem): FriendlyBonusEligibilityMessage {
  const amount = missingTryAmount(item.reason);
  const reason = String(item.reason ?? '').toLocaleLowerCase('tr-TR');

  switch (item.id) {
    case 'missing-rule':
      return { title: 'Bonus hazırlanıyor', message: 'Bu bonusun uygunluk bilgileri şu anda hazırlanıyor. Lütfen kısa süre sonra tekrar deneyin.' };
    case 'disabled-rule':
      return { title: 'Bonus şu anda kapalı', message: 'Bu kampanya şu anda taleplere açık değil. Açıldığında yeniden deneyebilirsiniz.' };
    case 'incomplete-lynon-data':
      return { title: 'Kontrol tamamlanamadı', message: 'Hesap bilgileriniz şu anda doğrulanamıyor. Lütfen kısa süre sonra tekrar deneyin.' };
    case 'min-deposit':
      return {
        title: 'Minimum yatırım koşulu',
        message: amount ? `Bu bonus için yatırım tutarınıza ${amount} ₺ daha eklemeniz gerekiyor.` : 'Bu bonus için gereken minimum yatırım tutarı henüz tamamlanmamış.',
      };
    case 'deposit-amount-range':
      return { title: 'Yatırım tutarı koşulu', message: 'Yatırım tutarınız bu kampanya için belirlenen aralıkta görünmüyor.' };
    case 'only-new-users-no-deposit-withdraw':
      return { title: 'Yeni üye kampanyası', message: 'Bu bonus yalnızca daha önce yatırım veya çekim işlemi bulunmayan yeni üyelerimiz için geçerlidir.' };
    case 'first-deposit-only':
      return { title: 'İlk yatırım kampanyası', message: 'Bu kampanya yalnızca ilk yatırımınız için geçerlidir.' };
    case 'per-day-limit':
      return { title: 'Günlük kullanım hakkı', message: 'Bu bonusu bugün kullandığınız için bir sonraki kullanım döneminde tekrar deneyebilirsiniz.' };
    case 'per-week-limit':
      return { title: 'Haftalık kullanım hakkı', message: 'Bu haftaki kullanım hakkınızı tamamladınız. Yeni haftada tekrar deneyebilirsiniz.' };
    case 'bonus-calculation':
      return { title: 'Yatırım tutarı koşulu', message: 'Yatırımınız henüz bu bonusun başlangıç tutarına ulaşmıyor.' };
    case 'previous-day-deposit':
      return { title: 'Önceki gün yatırım koşulu', message: 'Bu bonus için önceki gün tamamlanmış bir yatırımınız bulunması gerekiyor.' };
    case 'principal-wager':
      return {
        title: 'Çevrim henüz tamamlanmadı',
        message: amount ? `Bu bonus için ${amount} ₺ daha bahis yapmanız gerekiyor.` : 'Bu bonus için anapara çevriminizi tamamlamanız gerekiyor.',
      };
    case 'bonus-wagering':
      return {
        title: 'Bonus çevrimi devam ediyor',
        message: amount ? `Bonus çevriminizi tamamlamak için ${amount} ₺ daha oyun yapmanız gerekiyor.` : 'Mevcut bonus çevriminizi tamamladıktan sonra tekrar deneyebilirsiniz.',
      };
    case 'max-payout-check':
      return { title: 'Kazanç limiti', message: 'Mevcut bakiyeniz bu kampanyanın kazanç sınırının üzerinde görünüyor.' };
    case 'allowed-games-check':
      return { title: 'Oyun koşulu', message: 'Bu bonus için kampanyaya dahil oyunlardan birinde aktiviteniz bulunması gerekiyor.' };
    case 'check-pending-withdrawal':
      return { title: 'Bekleyen çekim talebi', message: 'Bonus talebinden önce bekleyen çekim işleminizin sonuçlanması gerekiyor.' };
    case 'check-last-tx-deposit':
      return { title: 'Son işlem koşulu', message: 'Bu bonus için son tamamlanan işleminizin yatırım olması gerekiyor.' };
    case 'check-single-investment':
      return { title: 'Yatırım kullanım durumu', message: 'Bu yatırımınız için daha önce bonus kullanılmış. Yeni bir yatırımın ardından tekrar deneyebilirsiniz.' };
    case 'check-same-day-usage':
      return { title: 'Günlük kullanım hakkı', message: 'Bu bonusu bugün kullandınız. Yarın tekrar deneyebilirsiniz.' };
    case 'max-kpi-limit':
      return { title: 'Hesap uygunluğu', message: 'Hesabınız bu kampanyanın mevcut uygunluk aralığında görünmüyor.' };
    case 'new-player-days':
    case 'new-player-deposits':
      return { title: 'Yeni oyuncu kampanyası', message: 'Bu kampanya yalnızca yeni oyuncularımız için geçerlidir.' };
    case 'min-balance-to-claim':
      return { title: 'Bakiye koşulu', message: 'Bu bonus için bakiyenizin kampanya alt sınırına ulaşması gerekiyor.' };
    case 'max-balance-to-claim':
    case 'balance-below':
      return { title: 'Bakiye koşulu', message: 'Mevcut bakiyeniz bu kampanya için belirlenen uygunluk sınırının üzerinde.' };
    case 'loss-bonus-net-loss':
      return { title: 'Kayıp bonusu koşulu', message: 'Bu bonus için hesabınızda uygun bir net kayıp oluşması gerekiyor.' };
    case 'request-within-hours':
      return reason.includes('bulunamad')
        ? { title: 'Yatırım koşulu', message: 'Bu bonus için tamamlanmış bir yatırımınız bulunması gerekiyor.' }
        : { title: 'Talep süresi', message: 'Bu bonusun talep süresi dolmuş. Yeni bir uygun yatırımın ardından tekrar deneyebilirsiniz.' };
    case 'requires-phone-verified':
      return { title: 'Telefon onayı gerekiyor', message: 'Bu bonustan yararlanmak için hesabınızdaki telefon numaranızı onaylamanız gerekiyor.' };
    case 'requires-telegram-member':
      return {
        title: 'Telegram kanal üyeliği',
        message: 'Bu bonus için Telegram hesabınızı bağlayıp kanala katılmanız gerekiyor.',
      };
    case 'requires-email-verified':
      return { title: 'E-posta onayı gerekiyor', message: 'Bu bonustan yararlanmak için hesabınızdaki e-posta adresinizi onaylamanız gerekiyor.' };
    case 'no-open-bets':
      return { title: 'Açık bahisler', message: 'Bonus talebinden önce açık bahislerinizin sonuçlanması gerekiyor.' };
    case 'active-days-check':
      return { title: 'Kampanya günü', message: 'Bu bonus bugün talebe açık değil. Kampanya günlerinde tekrar deneyebilirsiniz.' };
    case 'active-hours-check':
      return { title: 'Kampanya saati', message: 'Bu bonus şu anda talebe açık değil. Kampanya saatlerinde tekrar deneyebilirsiniz.' };
    default:
      return { title: 'Kampanya koşulu', message: 'Bu bonus için gerekli koşullardan biri henüz tamamlanmamış. Lütfen daha sonra tekrar deneyin.' };
  }
}