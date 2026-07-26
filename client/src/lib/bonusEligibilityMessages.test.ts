import { describe, expect, it } from 'vitest';
import { friendlyBonusEligibilityMessage } from './bonusEligibilityMessages';

describe('friendlyBonusEligibilityMessage', () => {
  it('yeni üye kuralındaki işlem sayılarını oyuncudan gizler', () => {
    const result = friendlyBonusEligibilityMessage({
      id: 'only-new-users-no-deposit-withdraw',
      reason: 'Yatırım adedi: 7, yatırım toplam: 14, çekim: 7',
    });
    expect(result.message).toContain('yeni üyelerimiz');
    expect(result.message).not.toContain('7');
  });

  it('çevrim eksiğini kısa ve nazik biçimde gösterir', () => {
    const result = friendlyBonusEligibilityMessage({ id: 'principal-wager', reason: 'Eksik: 2 TRY daha bahis yapılmalı.' });
    expect(result.message).toBe('Bu bonus için 2 ₺ daha bahis yapmanız gerekiyor.');
    expect(result.message).not.toContain('Eksik');
  });

  it('bakiye kuralında RED ve hesap bakiyesini göstermez', () => {
    const result = friendlyBonusEligibilityMessage({ id: 'max-balance-to-claim', reason: 'RED: Bakiye çok yüksek (1602.5 TRY)' });
    expect(result.message).toContain('uygunluk sınırının üzerinde');
    expect(result.message).not.toContain('RED');
    expect(result.message).not.toContain('1602.5');
  });

  it('gelecekte eklenecek kurallar için güvenli genel metin döndürür', () => {
    const result = friendlyBonusEligibilityMessage({ id: 'future-rule', reason: 'HATA: teknik detay' });
    expect(result.message).not.toContain('HATA');
  });
});