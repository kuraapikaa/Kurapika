import { describe, expect, it } from 'vitest';

/**
 * games.ts icindeki haftalik gorev siniri mantiginin birebir kopyasi.
 *
 * games.ts route dosyasi hicbir yardimci fonksiyonu disari acmiyor (bu
 * dosyadaki diger testler de -- ornek: sanalNakitBonus.test.ts -- ayni
 * "birebir kopya" kuralini izliyor); bu test o kuralla tutarli.
 *
 * ── Neden bu test var ─────────────────────────────────────────────────
 * "Gunluk giris odulunu haftada 3 kez'e sinirla" talebinin karsiligi.
 * `target: 1` gorevin AYNI GUN icinde tekrarini zaten engelliyordu ama
 * haftanin FARKLI gunlerinde kac kez alinabilecegine dair hicbir sinir
 * yoktu -- oyuncu haftanin 7 gununde de odulu alabiliyordu.
 */

const TURKEY_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

function turkeyDateParts(value = new Date()) {
  const local = new Date(value.getTime() + TURKEY_UTC_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate(), weekday: local.getUTCDay() };
}

function turkeyDateAt(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute, second, ms) - TURKEY_UTC_OFFSET_MS);
}

function toDateKey(date = new Date()) {
  const { year, month, day } = turkeyDateParts(date);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function turkeyPeriodWindow(period: 'weekly' | 'monthly', now = new Date()) {
  const parts = turkeyDateParts(now);
  if (period === 'monthly') {
    const from = turkeyDateAt(parts.year, parts.month, 1);
    const to = turkeyDateAt(parts.year, parts.month + 1, 1);
    return { from, to, key: `${parts.year}-${String(parts.month + 1).padStart(2, '0')}` };
  }
  const mondayOffset = (parts.weekday + 6) % 7;
  const from = turkeyDateAt(parts.year, parts.month, parts.day - mondayOffset);
  const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { from, to, key: toDateKey(from) };
}

/** claim ucundaki haftalik sinir kontrolunun birebir kopyasi. */
function haftalikKullanimAsildiMi(
  claims: Array<{ username: string; taskId: string; dateKey: string }>,
  username: string,
  taskId: string,
  perWeekLimit: number,
  now: Date,
): { asildi: boolean; sayim: number } {
  const week = turkeyPeriodWindow('weekly', now);
  const weekStartKey = toDateKey(week.from);
  const weekEndKeyExclusive = toDateKey(week.to);
  const sayim = claims.filter((c) =>
    c.username === username && c.taskId === taskId && c.dateKey >= weekStartKey && c.dateKey < weekEndKeyExclusive,
  ).length;
  return { asildi: sayim >= perWeekLimit, sayim };
}

const claim = (dateKey: string, taskId = 'daily-login', username = 'oyuncu1') => ({ username, taskId, dateKey });

describe('gunluk gorev haftalik siniri', () => {
  it('sinirin altindaysa engellenmez', () => {
    const claims = [claim('2026-08-03'), claim('2026-08-04')];
    const sonuc = haftalikKullanimAsildiMi(claims, 'oyuncu1', 'daily-login', 3, new Date('2026-08-05T10:00:00+03:00'));
    expect(sonuc).toEqual({ asildi: false, sayim: 2 });
  });

  it('ucuncu talepte sinira ulasilir, dorduncu engellenir', () => {
    const claims = [claim('2026-08-03'), claim('2026-08-04'), claim('2026-08-05')];
    const sonuc = haftalikKullanimAsildiMi(claims, 'oyuncu1', 'daily-login', 3, new Date('2026-08-06T10:00:00+03:00'));
    expect(sonuc).toEqual({ asildi: true, sayim: 3 });
  });

  /**
   * HAFTA PAZARTESI BASLAR. Onceki haftanin pazar gunku kullanimi bu
   * haftaya SAYILMAMALI -- aksi halde sinir gercekte oldugundan sıkı
   * uygulanir ve oyuncu hak ettigi kadar odul alamaz.
   */
  it('onceki haftanin kullanimi bu haftaya sayilmaz', () => {
    // 2026-08-03 Pazartesi. 2026-08-02 Pazar -> onceki hafta.
    const claims = [claim('2026-08-02'), claim('2026-08-03')];
    const sonuc = haftalikKullanimAsildiMi(claims, 'oyuncu1', 'daily-login', 3, new Date('2026-08-04T10:00:00+03:00'));
    expect(sonuc).toEqual({ asildi: false, sayim: 1 });
  });

  it('sonraki haftanin kullanimi bu haftaya sayilmaz', () => {
    const claims = [claim('2026-08-10')]; // bir sonraki Pazartesi
    const sonuc = haftalikKullanimAsildiMi(claims, 'oyuncu1', 'daily-login', 3, new Date('2026-08-06T10:00:00+03:00'));
    expect(sonuc).toEqual({ asildi: false, sayim: 0 });
  });

  it('haftanin son gunu (pazar) dogru sayilir', () => {
    // 2026-08-09 Pazar, ayni haftanin (03-09 Agustos) son gunu.
    const claims = [claim('2026-08-03'), claim('2026-08-09')];
    const sonuc = haftalikKullanimAsildiMi(claims, 'oyuncu1', 'daily-login', 3, new Date('2026-08-09T23:00:00+03:00'));
    expect(sonuc).toEqual({ asildi: false, sayim: 2 });
  });

  it('farkli gorev sayilmaz', () => {
    const claims = [claim('2026-08-03', 'daily-deposit'), claim('2026-08-04', 'daily-deposit')];
    const sonuc = haftalikKullanimAsildiMi(claims, 'oyuncu1', 'daily-login', 3, new Date('2026-08-05T10:00:00+03:00'));
    expect(sonuc).toEqual({ asildi: false, sayim: 0 });
  });

  it('farkli oyuncu sayilmaz', () => {
    const claims = [claim('2026-08-03', 'daily-login', 'oyuncu2'), claim('2026-08-04', 'daily-login', 'oyuncu2')];
    const sonuc = haftalikKullanimAsildiMi(claims, 'oyuncu1', 'daily-login', 3, new Date('2026-08-05T10:00:00+03:00'));
    expect(sonuc).toEqual({ asildi: false, sayim: 0 });
  });

  it('gun ortasi UTC gece yarisini yanlis haftaya atmaz', () => {
    // UTC 2026-08-02T23:30 = Turkiye 2026-08-03T02:30 (Pazartesi).
    // Turkiye gunune gore hesaplanmali, UTC takvim gunune gore degil.
    const now = new Date('2026-08-02T23:30:00Z');
    const claims = [claim('2026-08-03')];
    const sonuc = haftalikKullanimAsildiMi(claims, 'oyuncu1', 'daily-login', 3, now);
    expect(sonuc).toEqual({ asildi: false, sayim: 1 });
  });
});
