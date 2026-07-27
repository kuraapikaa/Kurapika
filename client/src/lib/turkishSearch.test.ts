import { describe, expect, it } from 'vitest';
import { normalizeTr, matchesTr, matchesAnyTr } from './turkishSearch';

/** Eski davranış: düz .toLowerCase() ile includes */
const eski = (h: unknown, t: string) => String(h ?? '').toLowerCase().includes(t.toLowerCase());

describe('Türkçe arama', () => {
  it('İ ile başlayan isimleri ASCII sorguyla bulur', () => {
    // Asıl hata: "İbrahim".toLowerCase() -> "i̇brahim" (U+0069 U+0307)
    expect(eski('İbrahim Yılmaz', 'ibrahim')).toBe(false); // hatalı eski davranış
    expect(matchesTr('İbrahim Yılmaz', 'ibrahim')).toBe(true);
    expect(matchesTr('İsmail Demir', 'ismail')).toBe(true);
  });

  it('aksan katlaması iki yönlü çalışır', () => {
    expect(eski('İlk Yatırım Bonusu', 'ilk yatirim')).toBe(false); // hatalı eski davranış
    expect(matchesTr('İlk Yatırım Bonusu', 'ilk yatirim')).toBe(true);
    // kullanıcı Türkçe karakterle yazarsa da bulmalı
    expect(matchesTr('Ilk Yatirim Bonusu', 'İlk Yatırım')).toBe(true);
  });

  it('ş/ğ/ü/ö/ç harflerini katlar', () => {
    expect(matchesTr('İş Birliği', 'is birligi')).toBe(true);
    expect(matchesTr('Ödeme Yöntemi', 'odeme yontemi')).toBe(true);
    expect(matchesTr('Çekim Talebi', 'cekim')).toBe(true);
    expect(matchesTr('Güncelleme', 'guncelleme')).toBe(true);
  });

  it('boş sorgu her şeyi eşler', () => {
    expect(matchesTr('herhangi', '')).toBe(true);
    expect(matchesTr('herhangi', '   ')).toBe(true);
  });

  it('eşleşmeyen sorguyu reddeder', () => {
    expect(matchesTr('İbrahim Yılmaz', 'mehmet')).toBe(false);
  });

  it('null/undefined güvenli', () => {
    expect(normalizeTr(null)).toBe('');
    expect(matchesTr(null, 'x')).toBe(false);
    expect(matchesAnyTr([null, undefined, 'İzmir'], 'izmir')).toBe(true);
  });

  it('birden çok alanda arar', () => {
    expect(matchesAnyTr(['ahmet', 'İstanbul', 42], 'istanbul')).toBe(true);
    expect(matchesAnyTr(['ahmet', 'İstanbul'], 'ankara')).toBe(false);
  });
});
