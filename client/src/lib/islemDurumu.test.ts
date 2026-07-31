import { describe, expect, it } from 'vitest';
import { durumAyrintisi, islemDurumu } from './islemDurumu';

/**
 * GUVENLIK/PARA REGRESYON TESTI.
 *
 * Bildirilen hata: basarisiz islemler basarili gorunuyordu.
 *
 * Kok neden TransactionsList'te `tx.State === 10` idi. Lynon State'i STRING
 * ("rejected", "failed"); sayi karsilastirmasi hicbir zaman tutmuyor, her
 * kayit ayni rozeti aliyordu. DepositsList'te ise durum kolonu hic yoktu.
 *
 * Bu testler durumun ASLA yanlis tarafa dusmemesini kilitliyor.
 */

describe('Lynon string durumları', () => {
  it('success başarılı', () => {
    expect(islemDurumu({ status: 'success' })).toBe('basarili');
    expect(islemDurumu({ State: 'success' })).toBe('basarili');
  });

  it('rejected başarısız — bildirilen hata', () => {
    expect(islemDurumu({ status: 'rejected' })).toBe('basarisiz');
    expect(islemDurumu({ State: 'rejected' })).toBe('basarisiz');
  });

  it('failed başarısız', () => {
    expect(islemDurumu({ status: 'failed' })).toBe('basarisiz');
  });

  it('iptal ve void da başarısız — para geçmedi', () => {
    expect(islemDurumu({ status: 'cancelled' })).toBe('basarisiz');
    expect(islemDurumu({ status: 'canceled' })).toBe('basarisiz');
    expect(islemDurumu({ status: 'void' })).toBe('basarisiz');
    expect(islemDurumu({ status: 'expired' })).toBe('basarisiz');
  });

  it('bekleyen durumlar beklemede', () => {
    expect(islemDurumu({ status: 'new' })).toBe('beklemede');
    expect(islemDurumu({ status: 'created' })).toBe('beklemede');
    expect(islemDurumu({ status: 'pending' })).toBe('beklemede');
    expect(islemDurumu({ status: 'pendingProviderApproval' })).toBe('beklemede');
  });

  it('pendingProviderApproval BAŞARILI sayılmaz', () => {
    // "approval" ile "approved" karistirilirsa odenmemis cekim odenmis
    // gorunur. Bu ayrim kasitli.
    expect(islemDurumu({ status: 'pendingproviderapproval' })).not.toBe('basarili');
  });

  it('büyük/küçük harf duyarsız', () => {
    expect(islemDurumu({ status: 'REJECTED' })).toBe('basarisiz');
    expect(islemDurumu({ status: 'Success' })).toBe('basarili');
  });
});

describe('sunucunun Türkçeleştirdiği adlar', () => {
  it('StateName üzerinden çözülür', () => {
    expect(islemDurumu({ StateName: 'Reddedildi' })).toBe('basarisiz');
    expect(islemDurumu({ StateName: 'Başarısız' })).toBe('basarisiz');
    expect(islemDurumu({ StateName: 'Ödendi' })).toBe('basarili');
    expect(islemDurumu({ StateName: 'İşlendi' })).toBe('basarili');
    expect(islemDurumu({ StateName: 'Bekliyor' })).toBe('beklemede');
  });

  it('İptal Edildi başarısız', () => {
    expect(islemDurumu({ DocumentStateName: 'İptal Edildi' })).toBe('basarisiz');
  });
});

describe('eski BetConstruct sayısal durumu', () => {
  it('State 10 başarılı', () => {
    expect(islemDurumu({ State: 10 })).toBe('basarili');
    expect(islemDurumu({ DocumentState: 10 })).toBe('basarili');
  });

  it('başka sayı beklemede', () => {
    expect(islemDurumu({ State: 1 })).toBe('beklemede');
    expect(islemDurumu({ State: 0 })).toBe('beklemede');
  });

  it('tür adında "reddedilmiştir" geçen eski kayıt', () => {
    expect(islemDurumu({ TypeName: 'Çekim talebi reddedilmiştir', State: 10 })).toBe('basarisiz');
  });
});

describe('çelişkili alanlarda güvenli taraf', () => {
  it('bir alan rejected bir alan success ise BAŞARISIZ', () => {
    // Belirsizlikte parayi gecmis gostermektense gecmemis gostermek dogru.
    expect(islemDurumu({ status: 'rejected', StateName: 'Ödendi' })).toBe('basarisiz');
    expect(islemDurumu({ State: 10, status: 'failed' })).toBe('basarisiz');
  });
});

describe('bozuk girdi', () => {
  it('null ve boş beklemede, çökmez', () => {
    expect(islemDurumu(null)).toBe('beklemede');
    expect(islemDurumu(undefined)).toBe('beklemede');
    expect(islemDurumu({})).toBe('beklemede');
    expect(islemDurumu({ status: '' })).toBe('beklemede');
    expect(islemDurumu({ status: null })).toBe('beklemede');
  });

  it('tanınmayan durum başarılı sayılmaz', () => {
    expect(islemDurumu({ status: 'uydurma-durum' })).toBe('beklemede');
  });
});

describe('durum ayrıntısı', () => {
  it('sunucunun verdiği ayrıntılı ad korunur', () => {
    expect(durumAyrintisi({ StateName: 'Sağlayıcı Onayı Bekliyor' })).toBe('Sağlayıcı Onayı Bekliyor');
  });

  it('ad yoksa genel etikete düşer', () => {
    expect(durumAyrintisi({ status: 'rejected' })).toBe('Başarısız');
    expect(durumAyrintisi({})).toBe('Beklemede');
  });
});

describe('kullanıcının verdiği gerçek kayıt', () => {
  it('reddedilmiş çekim başarısız görünür', () => {
    const gercek = {
      status: 'rejected',
      State: 'rejected',
      StateName: 'Reddedildi',
      DocumentStateName: 'Reddedildi',
      TypeName: 'Çekim',
      Amount: 3000,
    };
    expect(islemDurumu(gercek)).toBe('basarisiz');
    expect(durumAyrintisi(gercek)).toBe('Reddedildi');
  });
});
