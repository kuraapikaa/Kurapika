import { describe, expect, it } from 'vitest';
import { promoBul } from './promosDeposu.js';

/**
 * `/api/promos/list` uretimde surekli 404 veriyordu: okudugu dosya
 * konteyner diskinde duruyor, Railway'de volume tanimli olmadigi icin
 * HER DEPLOY'DA siliniyordu. Icerik belge deposuna tasindi.
 *
 * Bu test, tasima sirasinda elle yazilmis eslesme mantiginin yerine
 * gecen `promoBul`u kilitliyor — eski kod uc ayri kosulu satir icinde
 * yaziyordu ve `p.title` yoksa patliyordu.
 */
const PROMOLAR = [
  { id: 101, title: 'Kayıp Bonusu' },
  { id: 102, title: 'İlk Yatırım' },
  { id: 103 },                       // basliksiz kayit — eski kod burada patlardi
];

describe('promoBul', () => {
  it('id ile bulur', () => {
    expect(promoBul(PROMOLAR, 101)?.title).toBe('Kayıp Bonusu');
    expect(promoBul(PROMOLAR, '101')?.title).toBe('Kayıp Bonusu');
  });

  it('baslikla bulur, buyuk/kucuk harf farketmez', () => {
    expect(promoBul(PROMOLAR, null, 'kayıp bonusu')?.id).toBe(101);
    expect(promoBul(PROMOLAR, null, 'KAYIP BONUSU')?.id).toBe(101);
  });

  it('kayitli baslik aranan metnin ICINDE gecerse de bulur', () => {
    // Platform kampanya adina ek ibare koyabiliyor.
    expect(promoBul(PROMOLAR, null, 'Haftalık İlk Yatırım kampanyası')?.id).toBe(102);
  });

  it('basliksiz kayitta patlamaz', () => {
    expect(() => promoBul(PROMOLAR, null, 'herhangi bir sey')).not.toThrow();
  });

  it('eslesme yoksa null', () => {
    expect(promoBul(PROMOLAR, 999)).toBeNull();
    expect(promoBul(PROMOLAR, null, 'olmayan bonus')).toBeNull();
  });

  it('bos/bozuk liste tolere edilir', () => {
    expect(promoBul([], 101)).toBeNull();
    expect(promoBul(null as never, 101)).toBeNull();
  });

  it('id de ad da yoksa null — her seyi eslestirmez', () => {
    expect(promoBul(PROMOLAR)).toBeNull();
  });
});
