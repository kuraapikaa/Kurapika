import { describe, expect, it } from 'vitest';
import { oyuncuBakiyeMesaji, oyuncuBakiyeOzetiCikar } from './oyuncuBakiyeRaporu.js';

/** Kullanıcının yapıştırdığı gerçek rapor 1843 yanıtının kısaltılmış hali. */
const GERCEK_YANIT = {
  reports: [
    {
      'Player ID': '2489612', 'Full Name': 'Nur Tufan Boyu', Username: 'ntfnby', Currency: 'TRY',
      'Total Real Balance': 0, 'Total Bonus Balance': 0, 'Total Balance': 0,
      'Last Deposit Date': '', 'Last Withdrawal Date': '',
      'Total Real Balance (TRY)': 0, 'Total Bonus Balance (TRY)': 0, 'Total Balance (TRY)': 0,
    },
    {
      'Player ID': '2503142', 'Full Name': 'Test Oyuncu', Username: 'larac', Currency: 'TRY',
      'Total Real Balance (TRY)': 4200, 'Total Bonus Balance (TRY)': 300, 'Total Balance (TRY)': 4500,
    },
  ],
  reportsSummary: {
    'Total Real Balance (TRY)': 52354.58,
    'Total Bonus Balance (TRY)': 0,
    'Total Balance (TRY)': 52354.58,
  },
};

describe('oyuncuBakiyeOzetiCikar', () => {
  it('reportsSummary varsa oradan okur', () => {
    const ozet = oyuncuBakiyeOzetiCikar(GERCEK_YANIT, '2026-08-04', '04:04');
    expect(ozet).toEqual({
      gun: '2026-08-04', saat: '04:04', oyuncuSayisi: 2,
      gercekBakiye: 52354.58, bonusBakiye: 0, toplamBakiye: 52354.58,
    });
  });

  it('reportsSummary yoksa satırlardan toplar', () => {
    const ozet = oyuncuBakiyeOzetiCikar({ reports: GERCEK_YANIT.reports }, '2026-08-04');
    expect(ozet.gercekBakiye).toBe(4200);
    expect(ozet.bonusBakiye).toBe(300);
    expect(ozet.toplamBakiye).toBe(4500);
    expect(ozet.oyuncuSayisi).toBe(2);
  });

  it('ne özet ne satır varsa hiçbir alanı sıfır göstermez', () => {
    const ozet = oyuncuBakiyeOzetiCikar({}, '2026-08-04');
    expect(ozet).toEqual({
      gun: '2026-08-04', saat: null, oyuncuSayisi: null,
      gercekBakiye: null, bonusBakiye: null, toplamBakiye: null,
    });
  });

  it('boş girdi çökmez', () => {
    expect(oyuncuBakiyeOzetiCikar(null, '2026-08-04').oyuncuSayisi).toBeNull();
    expect(oyuncuBakiyeOzetiCikar(undefined, '2026-08-04').oyuncuSayisi).toBeNull();
  });

  it('satır yokken de özet üzerinden oyuncu sayısını uydurmaz', () => {
    const ozet = oyuncuBakiyeOzetiCikar({ reportsSummary: GERCEK_YANIT.reportsSummary }, '2026-08-04');
    expect(ozet.oyuncuSayisi).toBeNull();
    expect(ozet.gercekBakiye).toBe(52354.58);
  });
});

describe('oyuncuBakiyeMesaji', () => {
  const ozet = oyuncuBakiyeOzetiCikar(GERCEK_YANIT, '2026-08-04', '04:04');

  it('temel alanları yazar', () => {
    const mesaj = oyuncuBakiyeMesaji(ozet);
    expect(mesaj).toContain('ANLIK OYUNCU BAKİYESİ · 2026-08-04 · 04:04');
    expect(mesaj).toContain('Oyuncu: 2');
    expect(mesaj).toContain('52.354,58 TRY');
  });

  it('ölçülemeyen alanı sıfır göstermez', () => {
    const bos = oyuncuBakiyeOzetiCikar({}, '2026-08-04');
    const mesaj = oyuncuBakiyeMesaji(bos);
    expect(mesaj).not.toContain('0 TRY');
    expect(mesaj).toContain('—');
  });

  it('önceki özete göre artış okunu yazar', () => {
    const onceki = { ...ozet, gercekBakiye: 50000 };
    const mesaj = oyuncuBakiyeMesaji(ozet, onceki);
    expect(mesaj).toContain('▲2.354,58');
  });

  it('önceki özet verilmezse trend oku eklenmez', () => {
    const mesaj = oyuncuBakiyeMesaji(ozet);
    expect(mesaj).not.toContain('▲');
    expect(mesaj).not.toContain('▼');
  });
});
