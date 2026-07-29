import { describe, expect, it } from 'vitest';
import { dogrulamaAlanlariniBirlestir } from './lynonBackofficeService.js';

/**
 * Oyuncu listesi ucu doğrulama alanlarını hiç döndürmez; bu alanlar yalnızca
 * detay ucunda vardır. Liste satırıyla yetinildiğinde telefonu onaylı üyede bile
 * "RED: Telefon numarası onaylı değil" çıkıyordu.
 */
describe('doğrulama alanlarını detaydan bindirme', () => {
  it('listede olmayan telefon onayını detaydan alır', () => {
    const liste = { Id: 5, Login: 'oyuncu', Balance: 250 };
    const detay = { IsPhoneVerified: true, IsEmailVerified: true, IsIdentityVerified: false, IsVerified: true };

    const sonuc = dogrulamaAlanlariniBirlestir(liste, detay);

    expect(sonuc.IsPhoneVerified).toBe(true);
    expect(sonuc.IsEmailVerified).toBe(true);
  });

  it('listeden gelen diğer alanlara dokunmaz', () => {
    const liste = { Id: 5, Login: 'oyuncu', Balance: 250, TotalDeposit: 900 };
    const sonuc = dogrulamaAlanlariniBirlestir(liste, { IsPhoneVerified: true });

    expect(sonuc.Login).toBe('oyuncu');
    expect(sonuc.Balance).toBe(250);
    expect(sonuc.TotalDeposit).toBe(900);
  });

  it('detay onaysız diyorsa liste satırındaki değer ezilir — detay yetkilidir', () => {
    const liste = { Id: 5, IsPhoneVerified: true };
    const sonuc = dogrulamaAlanlariniBirlestir(liste, { IsPhoneVerified: false });

    expect(sonuc.IsPhoneVerified).toBe(false);
  });

  it('detayda boş olan nullable alanlar listedeki bilgiyi silmez', () => {
    const liste = { Id: 5, LastLoginIp: '88.1.2.3', VerificationStatus: 'verified' };
    const sonuc = dogrulamaAlanlariniBirlestir(liste, { LastLoginIp: null, VerificationStatus: null });

    expect(sonuc.LastLoginIp).toBe('88.1.2.3');
    expect(sonuc.VerificationStatus).toBe('verified');
  });

  it('detayda dolu olan son giriş IP bilgisi bindirilir — Aynı IP kontrolü buna bakar', () => {
    const liste = { Id: 5, LastLoginIp: null };
    const sonuc = dogrulamaAlanlariniBirlestir(liste, { LastLoginIp: '88.1.2.3' });

    expect(sonuc.LastLoginIp).toBe('88.1.2.3');
  });
});
