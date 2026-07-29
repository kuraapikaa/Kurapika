import { describe, expect, it } from 'vitest';
import { isActiveMemberStatus } from './telegramService.js';

/**
 * Üyelik durumu, bonusun verilip verilmeyeceğini belirliyor. "Sorgulayamadım"
 * durumu ayrı ele alınır (bkz. getChatMember); burada yalnızca Telegram'ın
 * döndürdüğü durum değerleri sınanıyor.
 */
describe('Telegram üyelik durumu', () => {
  it('kanaldaki normal üyeyi kabul eder', () => {
    expect(isActiveMemberStatus('member')).toBe(true);
  });

  it('yönetici ve kurucuyu kabul eder', () => {
    expect(isActiveMemberStatus('administrator')).toBe(true);
    expect(isActiveMemberStatus('creator')).toBe(true);
  });

  it('kanaldan ayrılanı ve atılanı reddeder', () => {
    expect(isActiveMemberStatus('left')).toBe(false);
    expect(isActiveMemberStatus('kicked')).toBe(false);
  });

  it('kısıtlı kullanıcı hâlâ üyeyse kabul edilir', () => {
    expect(isActiveMemberStatus('restricted', true)).toBe(true);
  });

  it('kısıtlı kullanıcı kanaldan çıkmışsa reddedilir', () => {
    expect(isActiveMemberStatus('restricted', false)).toBe(false);
    expect(isActiveMemberStatus('restricted')).toBe(false);
  });

  it('durum yoksa reddeder', () => {
    expect(isActiveMemberStatus(null)).toBe(false);
    expect(isActiveMemberStatus('')).toBe(false);
  });
});
