import { describe, expect, it } from 'vitest';

/**
 * dashboard.ts'teki turnuva tarih cozumlemesinin birebir kopyasi.
 *
 * Istemci (TournamentLeaderboardPage) "DD-MM-YY" gonderiyor; bu bicim eski
 * backoffice ucu icin secilmisti. Rapor 1841 ISO an istiyor. Yanlis cevrilen
 * bir tarih bos ya da yanlis donemin siralamasini gosterir — sessiz hata.
 */

function turnuvaTarihi(value: unknown, gunSonu: boolean): Date | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const ddmmyy = /^(\d{2})-(\d{2})-(\d{2})$/.exec(text);
  if (ddmmyy) {
    const [, dd, mm, yy] = ddmmyy;
    const saat = gunSonu ? '23:59:59.999' : '00:00:00.000';
    const parsed = new Date(`20${yy}-${mm}-${dd}T${saat}+03:00`);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function turnuvaAraligi(body: Record<string, unknown>): { from: Date; to: Date } {
  const to = turnuvaTarihi(body.ToDate, true) ?? new Date();
  const from = turnuvaTarihi(body.FromDate, false) ?? new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return from <= to ? { from, to } : { from: to, to: from };
}

function turnuvaMetrigi(orderKey: unknown): string {
  const key = String(orderKey ?? '').trim().toLowerCase();
  if (key === 'depositamount') return 'yatirimTutari';
  if (key === 'profit' || key === 'ggr') return 'ggr';
  if (key === 'casinobetamount') return 'casinoBahis';
  if (key === 'sportbetamount') return 'sporBahis';
  return 'bahisTutari';
}

describe('turnuva tarih çözümleme', () => {
  it('DD-MM-YY gün başlangıcı Türkiye saatiyle', () => {
    // 31-07-26 00:00 +03:00 => 30 Temmuz 21:00 UTC
    expect(turnuvaTarihi('31-07-26', false)?.toISOString()).toBe('2026-07-30T21:00:00.000Z');
  });

  it('DD-MM-YY gün sonu 23:59:59.999 Türkiye saatiyle', () => {
    expect(turnuvaTarihi('31-07-26', true)?.toISOString()).toBe('2026-07-31T20:59:59.999Z');
  });

  it('ISO tarih doğrudan kabul edilir', () => {
    expect(turnuvaTarihi('2026-07-31T05:59:35Z', false)?.toISOString()).toBe('2026-07-31T05:59:35.000Z');
  });

  it('boş ve bozuk girdi null', () => {
    expect(turnuvaTarihi('', false)).toBeNull();
    expect(turnuvaTarihi(null, false)).toBeNull();
    expect(turnuvaTarihi('abc', false)).toBeNull();
    expect(turnuvaTarihi('99-99-99', false)).toBeNull();
  });
});

describe('turnuva aralığı', () => {
  it('iki tarih de verilmişse aynen kullanılır', () => {
    const { from, to } = turnuvaAraligi({ FromDate: '01-07-26', ToDate: '31-07-26' });
    expect(from.toISOString()).toBe('2026-06-30T21:00:00.000Z');
    expect(to.toISOString()).toBe('2026-07-31T20:59:59.999Z');
  });

  it('FromDate yoksa son 24 saat', () => {
    const { from, to } = turnuvaAraligi({ ToDate: '31-07-26' });
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('hiçbiri yoksa son 24 saat, çökmez', () => {
    const { from, to } = turnuvaAraligi({});
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(Number.isFinite(from.getTime())).toBe(true);
  });

  it('ters aralık düzeltilir — rapor boş dönerdi', () => {
    const { from, to } = turnuvaAraligi({ FromDate: '31-07-26', ToDate: '01-07-26' });
    expect(from.getTime()).toBeLessThan(to.getTime());
  });

  it('günlük turnuva penceresi bir günü tam kapsar', () => {
    const { from, to } = turnuvaAraligi({ FromDate: '31-07-26', ToDate: '31-07-26' });
    const saat = (to.getTime() - from.getTime()) / 3_600_000;
    expect(saat).toBeCloseTo(24, 1);
  });
});

describe('sıralama metriği eşlemesi', () => {
  it('varsayılan bahis tutarı', () => {
    expect(turnuvaMetrigi(undefined)).toBe('bahisTutari');
    expect(turnuvaMetrigi('BetAmount')).toBe('bahisTutari');
  });

  it('bilinen anahtarlar eşlenir, büyük/küçük harf duyarsız', () => {
    expect(turnuvaMetrigi('DepositAmount')).toBe('yatirimTutari');
    expect(turnuvaMetrigi('ggr')).toBe('ggr');
    expect(turnuvaMetrigi('CasinoBetAmount')).toBe('casinoBahis');
    expect(turnuvaMetrigi('SPORTBETAMOUNT')).toBe('sporBahis');
  });

  it('bilinmeyen anahtar varsayılana düşer', () => {
    expect(turnuvaMetrigi('UydurmaAlan')).toBe('bahisTutari');
  });
});
