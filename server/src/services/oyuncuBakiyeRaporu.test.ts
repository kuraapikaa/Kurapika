import { describe, expect, it } from 'vitest';
import { oyuncuBakiyeMesaji, oyuncuBakiyeOzetiCikar, topBakiyeliOyuncular } from './oyuncuBakiyeRaporu.js';

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

  it('temel alanları yazar, tarihi GG.AA.YYYY çevirir', () => {
    const mesaj = oyuncuBakiyeMesaji(ozet);
    expect(mesaj).toContain('ANLIK OYUNCU BAKİYESİ');
    expect(mesaj).toContain('04.08.2026 · 04:04');
    expect(mesaj).toContain('Aktif Oyuncu : 2');
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
    expect(mesaj).toContain('📈 +2.355');
  });

  it('önceki özete göre azalış okunu yazar', () => {
    const onceki = { ...ozet, gercekBakiye: 60000 };
    const mesaj = oyuncuBakiyeMesaji(ozet, onceki);
    expect(mesaj).toContain('📉 -7.645');
  });

  it('değişim yoksa nötr işaret yazar', () => {
    const onceki = { ...ozet };
    const mesaj = oyuncuBakiyeMesaji(ozet, onceki);
    expect(mesaj).toContain('▪️ 0');
  });

  it('önceki özet verilmezse trend oku eklenmez', () => {
    const mesaj = oyuncuBakiyeMesaji(ozet);
    expect(mesaj).not.toContain('📈');
    expect(mesaj).not.toContain('📉');
    expect(mesaj).not.toContain('▪️');
  });

  it('top oyuncular verilirse sabit genişlikli tabloda listeler', () => {
    const top = topBakiyeliOyuncular(GERCEK_YANIT, 10).map((o) => ({ ...o, toplamYatirim: 6000, toplamCekim: 1500 }));
    const mesaj = oyuncuBakiyeMesaji(ozet, undefined, top);
    expect(mesaj).toContain('EN YÜKSEK BAKİYELİ TOP 2 ÜYE');
    expect(mesaj).toContain('KULLANICI');
    expect(mesaj).toContain('BAKİYE (TRY)');
    expect(mesaj).toContain('YAT / ÇEK');
    expect(mesaj).toContain('larac');
    expect(mesaj).toContain('4.500,00');
    // 6000/1500 -> kısaltılmış "6K / 1.5K" gösterilir.
    expect(mesaj).toContain('6K / 1.5K');
  });

  it('top oyuncular verilmezse bölüm hiç yazılmaz', () => {
    expect(oyuncuBakiyeMesaji(ozet)).not.toContain('EN YÜKSEK BAKİYELİ');
  });

  it('kullanıcı adında "test" geçen hesapları ❓ ile işaretler', () => {
    const top = topBakiyeliOyuncular(GERCEK_YANIT, 10);
    const testli = top.map((o) => (o.ad === 'larac' ? { ...o, ad: 'larac_test' } : o));
    const mesaj = oyuncuBakiyeMesaji(ozet, undefined, testli);
    expect(mesaj).toContain('❓');
    expect(mesaj).toContain('Test/Demo hesapları listede işaretlenmiştir.');
  });

  it('test hesabı yoksa ❓ notu hiç yazılmaz', () => {
    const top = topBakiyeliOyuncular(GERCEK_YANIT, 10);
    const mesaj = oyuncuBakiyeMesaji(ozet, undefined, top);
    expect(mesaj).not.toContain('Test/Demo hesapları');
  });
});

describe('topBakiyeliOyuncular', () => {
  it('toplam bakiyeye göre büyükten küçüğe sıralar', () => {
    const top = topBakiyeliOyuncular(GERCEK_YANIT, 10);
    expect(top.map((o) => o.id)).toEqual(['2503142', '2489612']);
    expect(top[0]).toMatchObject({ ad: 'larac', toplamBakiye: 4500, toplamYatirim: null, toplamCekim: null });
  });

  it('azami sayıyı kırpar', () => {
    const cok = { reports: Array.from({ length: 15 }, (_, i) => ({ 'Player ID': String(i), Username: `p${i}`, 'Total Balance (TRY)': i })) };
    expect(topBakiyeliOyuncular(cok, 10)).toHaveLength(10);
  });

  it('kimliksiz satırı atlar', () => {
    const veri = { reports: [{ Username: 'kimliksiz', 'Total Balance (TRY)': 999 }] };
    expect(topBakiyeliOyuncular(veri, 10)).toEqual([]);
  });

  it('boş/eksik girişte boş liste döner', () => {
    expect(topBakiyeliOyuncular(null)).toEqual([]);
    expect(topBakiyeliOyuncular({})).toEqual([]);
  });
});
