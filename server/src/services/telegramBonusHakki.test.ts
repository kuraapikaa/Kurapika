import { describe, expect, it } from 'vitest';
import { atamaDurumu, telegramBonusuAlinmis, type TelegramKaydi } from './telegramBonusHakki.js';

/**
 * ACIL PARA SIZINTISI REGRESYON TESTI.
 *
 * Bildirilen vaka: uye 2493559 cok sayida Telegram bonusu almis.
 *
 * Uc delik birden vardi:
 *   1. `c.username === login` tam esitlik — "Ayse"/"ayse" ayri sayiliyordu
 *   2. Yalnizca `ok === true` engelliyordu — Lynon atadi ama yanit
 *      hatayla dondu ise kayit ok:false kaliyor, oyuncu tekrar aliyordu
 *   3. `telegramUserId` kayda yaziliyor ama HIC kontrol edilmiyordu
 */

const k = (patch: Partial<TelegramKaydi> = {}): TelegramKaydi =>
  ({ username: 'ayse', telegramUserId: '111', ok: true, ...patch });

describe('1) kullanıcı adı normalizasyonu', () => {
  it('farklı BÜYÜK/küçük yazım ikinci bonus vermez — bildirilen açık', () => {
    const sonuc = telegramBonusuAlinmis([k({ username: 'Ayse' })], 'ayse', '999');
    expect(sonuc.alinmis).toBe(true);
  });

  it('tamamı büyük harf de engellenir', () => {
    expect(telegramBonusuAlinmis([k({ username: 'AYSE' })], 'ayse', '999').alinmis).toBe(true);
  });

  it('baştaki/sondaki boşluk engellemeyi bozmaz', () => {
    expect(telegramBonusuAlinmis([k({ username: '  ayse  ' })], 'ayse', '999').alinmis).toBe(true);
  });

  it('Türkçe İ tuzağı: "İsmail" ile "ismail" aynı sayılır', () => {
    expect(telegramBonusuAlinmis([k({ username: 'İsmail' })], 'ismail', '999').alinmis).toBe(true);
  });

  it('gerçekten farklı oyuncu engellenmez', () => {
    expect(telegramBonusuAlinmis([k({ username: 'ayse' })], 'mehmet', '999').alinmis).toBe(false);
  });
});

describe('2) belirsiz atama hakkı tüketir', () => {
  it('Lynon çağrıldı ama başarısız döndü → tekrar VERİLMEZ', () => {
    // Atama gerceklesmis olabilir; ikinci kez vermektense operator baksin.
    const sonuc = telegramBonusuAlinmis([k({ ok: false, durum: 'belirsiz' })], 'ayse', '111');
    expect(sonuc.alinmis).toBe(true);
  });

  it('rezerve edilmiş (pending) kayıt da tüketir', () => {
    expect(telegramBonusuAlinmis([k({ ok: false, durum: 'pending' })], 'ayse', '111').alinmis).toBe(true);
  });

  it('çağrı hiç yapılmadan düşen deneme hakkı YAKMAZ', () => {
    // Kampanya secili degil / oyuncu bulunamadi gibi durumlar.
    expect(telegramBonusuAlinmis([k({ ok: false, durum: 'failed' })], 'ayse', '111').alinmis).toBe(false);
  });
});

describe('3) Telegram kimliği de anahtar', () => {
  it('aynı Telegram hesabı BAŞKA kullanıcı adıyla ikinci bonus alamaz', () => {
    const sonuc = telegramBonusuAlinmis([k({ username: 'ayse', telegramUserId: '111' })], 'mehmet', '111');
    expect(sonuc.alinmis).toBe(true);
    expect((sonuc as any).neden).toContain('Telegram hesabıyla');
  });

  it('farklı Telegram hesabı + farklı kullanıcı adı geçer', () => {
    expect(telegramBonusuAlinmis([k({ username: 'ayse', telegramUserId: '111' })], 'mehmet', '222').alinmis).toBe(false);
  });

  it('Telegram kimliği yoksa yalnızca kullanıcı adına bakılır', () => {
    expect(telegramBonusuAlinmis([k({ telegramUserId: null })], 'ayse', '111').alinmis).toBe(true);
    expect(telegramBonusuAlinmis([k({ username: 'ayse' })], 'mehmet', null).alinmis).toBe(false);
  });
});

describe('eski kayıtlarla uyum', () => {
  it('durum alanı olmayan ok:true kaydı tüketir', () => {
    const eski = { username: 'ayse', telegramUserId: '111', ok: true };
    expect(telegramBonusuAlinmis([eski], 'ayse', '111').alinmis).toBe(true);
  });

  it('durum alanı olmayan ok:false kaydı tüketmez', () => {
    const eski = { username: 'ayse', telegramUserId: '111', ok: false };
    expect(telegramBonusuAlinmis([eski], 'ayse', '111').alinmis).toBe(false);
  });
});

describe('bozuk girdi', () => {
  it('boş liste ve null kayıt çökmez', () => {
    expect(telegramBonusuAlinmis([], 'ayse', '1').alinmis).toBe(false);
    expect(telegramBonusuAlinmis([null as never, k()], 'ayse', '111').alinmis).toBe(true);
    expect(telegramBonusuAlinmis(undefined as never, 'ayse', '1').alinmis).toBe(false);
  });

  it('boş kullanıcı adı yanlışlıkla eşleşmez', () => {
    expect(telegramBonusuAlinmis([k({ username: '' })], '', '999').alinmis).toBe(false);
  });
});

describe('atama durumu çözümleme', () => {
  it('başarılı atama granted', () => {
    expect(atamaDurumu({ ok: true, lynon: true })).toBe('granted');
  });

  it('Lynon çağrıldı ve başarısız → belirsiz', () => {
    expect(atamaDurumu({ ok: false, lynon: true })).toBe('belirsiz');
  });

  it('Lynon hiç çağrılmadı → failed', () => {
    expect(atamaDurumu({ ok: false })).toBe('failed');
    expect(atamaDurumu(null)).toBe('failed');
    expect(atamaDurumu(undefined)).toBe('failed');
  });
});
