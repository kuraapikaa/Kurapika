import { describe, expect, it } from 'vitest';
import { etkinTutar, odemeSatiriniNormalize, paraSayisi, yatirimMi } from './odemeTutari.js';

/**
 * PARA SIZINTISI REGRESYON TESTI.
 *
 * Bildirilen vaka: oyuncu 2499894'e 22.08.2026 02:04'te 13.650 TRY
 * kayip bonusu yazildi. Kok sebep: yatirim satirinin tutari `amount`
 * alanindan okunuyordu; canlida olculen deger `amount: 2000` iken
 * gercek yatirim `actualAmount: 500` idi. Taban dort kat sisince bonus
 * da dort kat cikti.
 */
describe('etkinTutar — yatırım', () => {
  it('yatırımda actualAmount önceliklidir', () => {
    expect(etkinTutar({ transactionType: 'deposit', amount: 2000, actualAmount: 500 })).toBe(500);
  });

  it('actualAmount yoksa amount kullanılır', () => {
    expect(etkinTutar({ transactionType: 'deposit', amount: 750 })).toBe(750);
  });

  it('actualAmount SIFIR ise sıfırdır — "yok" sayılmaz', () => {
    expect(etkinTutar({ transactionType: 'deposit', amount: 900, actualAmount: 0 })).toBe(0);
  });

  it('ikisi de yoksa receivedAmount', () => {
    expect(etkinTutar({ transactionType: 'deposit', receivedAmount: 120 })).toBe(120);
  });

  it('type alan adını da tanır', () => {
    expect(etkinTutar({ type: 'deposit', amount: 2000, actualAmount: 500 })).toBe(500);
  });
});

describe('etkinTutar — çekim ve diğerleri', () => {
  it('çekimde amount önceliklidir (sıra DEĞİŞMEDİ)', () => {
    // Cekim tarafinda ayni olcum yapilmadi; dogrulanmamis varsayimla
    // degistirmek bilineni duzeltirken bilinmeyeni bozardi.
    expect(etkinTutar({ transactionType: 'withdrawal', amount: 300, actualAmount: 100 })).toBe(300);
  });

  it('bilinmeyen türde de amount önceliklidir', () => {
    expect(etkinTutar({ transactionType: 'transfer', amount: 42, actualAmount: 7 })).toBe(42);
  });

  it('işaret KORUNUR — mutlak değere çevirmek çağıranın işi', () => {
    expect(etkinTutar({ transactionType: 'withdrawal', amount: -500 })).toBe(-500);
  });
});

describe('paraSayisi', () => {
  it('biçimlenmiş metinleri çözer', () => {
    expect(paraSayisi('1.234,56')).toBe(1234.56);
    expect(paraSayisi('1,234.56')).toBe(1234.56);
    expect(paraSayisi('1 000,25 ₺')).toBe(1000.25);
  });

  it('sayıyı olduğu gibi geçirir', () => {
    expect(paraSayisi(500)).toBe(500);
    expect(paraSayisi(0)).toBe(0);
    expect(paraSayisi(-12.5)).toBe(-12.5);
  });

  it('çözülemeyende yedek değer', () => {
    expect(paraSayisi('yok')).toBe(0);
    expect(paraSayisi(null)).toBe(0);
    expect(paraSayisi(undefined, 7)).toBe(7);
    expect(paraSayisi('', 7)).toBe(7);
  });
});

describe('odemeSatiriniNormalize', () => {
  it('yatırımda amount alanını gerçek tutara çevirir', () => {
    // `row.amount` on besten fazla yerde okunuyor; kaynakta duzeltmek
    // hepsini tek degisiklikle dogru yapiyor.
    const satir = odemeSatiriniNormalize({
      transactionType: 'deposit', amount: 2000, actualAmount: 500, userId: 7,
    });
    expect(satir.amount).toBe(500);
    expect(satir.userId).toBe(7);
  });

  it('ham değeri hamAmount altında saklar', () => {
    const satir = odemeSatiriniNormalize({ transactionType: 'deposit', amount: 2000, actualAmount: 500 });
    expect((satir as any).hamAmount).toBe(2000);
  });

  it('değişiklik gerekmiyorsa AYNI nesneyi döner', () => {
    // Gereksiz kopya uretmemek icin: bu fonksiyon her odeme satirinda
    // calisiyor.
    const girdi = { transactionType: 'withdrawal', amount: 300 };
    expect(odemeSatiriniNormalize(girdi)).toBe(girdi);
  });

  it('iki kez uygulanınca sonuç DEĞİŞMEZ', () => {
    const bir = odemeSatiriniNormalize({ transactionType: 'deposit', amount: 2000, actualAmount: 500 });
    const iki = odemeSatiriniNormalize(bir);
    expect(iki.amount).toBe(500);
  });

  it('biçimlenmiş metin tutarı sayıya çevrilir', () => {
    const satir = odemeSatiriniNormalize({ transactionType: 'deposit', amount: '2.000,00', actualAmount: '500,00' });
    expect(satir.amount).toBe(500);
  });

  it('nesne olmayan girdide çökmez', () => {
    expect(odemeSatiriniNormalize(null as never)).toBeNull();
  });
});

describe('yatirimMi', () => {
  it('büyük/küçük harf ve boşluğa dayanıklı', () => {
    expect(yatirimMi({ transactionType: ' Deposit ' })).toBe(true);
    expect(yatirimMi({ transactionType: 'WITHDRAWAL' })).toBe(false);
    expect(yatirimMi({})).toBe(false);
  });
});
