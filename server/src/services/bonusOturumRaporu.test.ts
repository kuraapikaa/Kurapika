import { describe, expect, it } from 'vitest';
import {
  bonusOturumSatiri,
  bonusOzeti,
  mukerrerVerilisler,
  oturumDurumu,
  tarihAraligindakiOturumlar,
  type BonusOturumu,
  type OyuncuAdlari,
} from './bonusOturumRaporu.js';

/** Kullanicinin yapistirdigi gercek yanit satiri. */
const GERCEK: BonusOturumu = {
  playerId: 2501238,
  campaignId: 1885,
  templateName: 'Wheel FS in Real Balance',
  bonusId: 1687,
  bonusName: '100 FS Telegram Katıl Bonusu',
  campaignAssignmentId: 242915,
  instantBonusAssignmentId: 0,
  bonusSessionId: 185473,
  claimedCurrency: 'TRY',
  payout: 0,
  assignedDate: '2026-08-03T02:00:16.248848Z',
  claimedDate: '2026-08-03T02:00:27.724815Z',
  status: 1,
  assignmentReason:
    'Narcosbahis oyun ödülü: 100 FS - Telegram Katıl Bonusu | Kaynak: telegram | Talep: zlfkr79 | Tutar: 100 TRY | 03.08.2026 05:00',
  categoryId: 308,
  categoryName: 'Yeni Oyuncu',
};

const adlar: OyuncuAdlari = new Map([['2501238', { login: 'zlfkr79', adSoyad: 'Z. Fikri' }]]);

describe('bonusOturumSatiri', () => {
  it('gerçek yanıtı ekran satırına çevirir', () => {
    const satir = bonusOturumSatiri(GERCEK, adlar);
    expect(satir.ClientId).toBe(2501238);
    expect(satir.ClientLogin).toBe('zlfkr79');
    expect(satir.Name).toBe('100 FS Telegram Katıl Bonusu');
    expect(satir.TemplateName).toBe('Wheel FS in Real Balance');
    expect(satir.CampaignId).toBe(1885);
    expect(satir.BonusSessionId).toBe(185473);
    expect(satir.Kategori).toBe('Yeni Oyuncu');
  });

  it('panelin yazdığı atama notunu taşır', () => {
    expect(bonusOturumSatiri(GERCEK, adlar).Description).toContain('Kaynak: telegram');
  });

  it('eşleşme yoksa kullanıcı adı uydurmaz', () => {
    const satir = bonusOturumSatiri(GERCEK, new Map());
    expect(satir.ClientLogin).toBe('');
    // Kimlik ada terfi ettirilmez; ekran kimliği zaten ayrı sütunda gösterir.
    expect(satir.ClientName).toBe('');
    expect(satir.ClientId).toBe(2501238);
  });

  it('ödeme ile verilen tutarı karıştırmaz', () => {
    // payout = 0: bonus verilmiş ama henüz ödeme çıkmamış.
    const satir = bonusOturumSatiri(GERCEK, adlar);
    expect(satir.TotalPaidAmount).toBe(0);
    expect(satir.Amount).toBeNull();
  });

  it('bonus adı yoksa şablon adına düşer', () => {
    const satir = bonusOturumSatiri({ ...GERCEK, bonusName: '' }, adlar);
    expect(satir.Name).toBe('Wheel FS in Real Balance');
  });
});

describe('oturumDurumu', () => {
  it('bilinen kodları çevirir', () => {
    expect(oturumDurumu(0)).toBe('Atandı');
    expect(oturumDurumu(1)).toBe('Talep edildi');
  });

  it('bilinmeyen kodu tahmin etmez', () => {
    expect(oturumDurumu(7)).toBe('Durum 7');
  });

  it('metin durum olduğu gibi kalır', () => {
    expect(oturumDurumu('completed')).toBe('completed');
  });

  it('boş durum "Bilinmiyor"', () => {
    expect(oturumDurumu(null)).toBe('Bilinmiyor');
    expect(oturumDurumu('')).toBe('Bilinmiyor');
  });
});

describe('tarih aralığı Türkiye gününe göre', () => {
  const oturumlar: BonusOturumu[] = [
    { ...GERCEK, bonusSessionId: 1, assignedDate: '2026-08-02T20:59:00Z' }, // TR 23:59, 2 Ağustos
    { ...GERCEK, bonusSessionId: 2, assignedDate: '2026-08-02T21:01:00Z' }, // TR 00:01, 3 Ağustos
    { ...GERCEK, bonusSessionId: 3, assignedDate: '2026-08-03T20:00:00Z' }, // TR 23:00, 3 Ağustos
  ];

  it('gece yarısını Türkiye saatiyle keser', () => {
    const gun = tarihAraligindakiOturumlar(oturumlar, { startDate: '2026-08-03', endDate: '2026-08-03' });
    expect(gun.map((o: BonusOturumu) => o.bonusSessionId)).toEqual([2, 3]);
  });

  it('aralık verilmezse hepsi kalır', () => {
    expect(tarihAraligindakiOturumlar(oturumlar, {})).toHaveLength(3);
  });

  it('çözülemeyen tarih dışarıda kalır', () => {
    const bozuk = [{ ...GERCEK, assignedDate: 'yok' }];
    expect(tarihAraligindakiOturumlar(bozuk, { startDate: '2026-08-03', endDate: '2026-08-03' })).toHaveLength(0);
  });
});

describe('özet ve mükerrer tespiti', () => {
  const satirlar = [
    bonusOturumSatiri({ ...GERCEK, bonusSessionId: 1, payout: 100 }, adlar),
    bonusOturumSatiri({ ...GERCEK, bonusSessionId: 2, payout: 50 }, adlar),
    bonusOturumSatiri({ ...GERCEK, bonusSessionId: 3, playerId: 999, bonusName: '%30 Kayıp Bonusu', payout: 20 }, adlar),
  ];

  it('bonus adına göre toplar', () => {
    const ozet = bonusOzeti(satirlar);
    expect(ozet[0]).toEqual({ ad: '100 FS Telegram Katıl Bonusu', adet: 2, odenen: 150, oyuncuSayisi: 1 });
  });

  it('aynı oyuncuya aynı bonusun tekrarını yakalar', () => {
    const mukerrer = mukerrerVerilisler(satirlar);
    expect(mukerrer).toHaveLength(1);
    expect(mukerrer[0]).toMatchObject({
      clientId: 2501238,
      clientLogin: 'zlfkr79',
      bonusAdi: '100 FS Telegram Katıl Bonusu',
      adet: 2,
    });
  });

  it('tek verilişi mükerrer saymaz', () => {
    expect(mukerrerVerilisler([satirlar[2]])).toHaveLength(0);
  });

  it('boş girdi çökmez', () => {
    expect(bonusOzeti([])).toEqual([]);
    expect(mukerrerVerilisler([])).toEqual([]);
  });
});
