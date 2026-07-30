import { describe, expect, it } from 'vitest';
import { affiliateMetrikleri, affiliateSirala } from './affiliateMetrics.js';

/**
 * Bu sayilar odeme ve is ortakligi kararlarini etkiliyor. Sifira bolme veya
 * negatif gelir gibi kenar durumlar sessizce NaN/Infinity uretirse ekranda
 * anlamsiz deger cikar ve yanlis affiliate'e odeme yapilir.
 */

const ORNEK = [
  { bTag: 'A', totalPlayers: 100, activePlayers: 50, totalDeposits: 100000, totalWithdrawals: 40000, netRevenue: 60000 },
  { bTag: 'B', totalPlayers: 20, activePlayers: 10, totalDeposits: 30000, totalWithdrawals: 28000, netRevenue: 2000 },
  { bTag: 'C', totalPlayers: 10, activePlayers: 0, totalDeposits: 0, totalWithdrawals: 0, netRevenue: 0 },
];

describe('affiliate metrikleri', () => {
  it('net pozisyon yatırım eksi çekim', () => {
    const { satirlar } = affiliateMetrikleri(ORNEK);
    expect(satirlar[0].netPozisyon).toBe(60000);
    expect(satirlar[1].netPozisyon).toBe(2000);
  });

  it('oyuncu başı gelir aktif oyuncuya bölünür', () => {
    const { satirlar } = affiliateMetrikleri(ORNEK);
    expect(satirlar[0].oyuncuBasiGelir).toBe(1200);   // 60000 / 50
    expect(satirlar[1].oyuncuBasiGelir).toBe(200);    // 2000 / 10
  });

  it('aktif oyuncusu olmayan BTag sıfıra bölünmez', () => {
    const { satirlar } = affiliateMetrikleri(ORNEK);
    expect(satirlar[2].oyuncuBasiGelir).toBe(0);
    expect(satirlar[2].oyuncuBasiYatirim).toBe(0);
    expect(satirlar[2].cekimOrani).toBe(0);
    expect(Number.isFinite(satirlar[2].gelirPayi)).toBe(true);
  });

  it('çekim oranı 1 üstündeyse kanal para kaybettiriyor', () => {
    const { satirlar } = affiliateMetrikleri([
      { bTag: 'Z', totalPlayers: 5, activePlayers: 5, totalDeposits: 1000, totalWithdrawals: 1500, netRevenue: -500 },
    ]);
    expect(satirlar[0].cekimOrani).toBe(1.5);
    expect(satirlar[0].netPozisyon).toBe(-500);
  });

  it('negatif gelir varken pay hesabı patlamaz', () => {
    // Toplam net gelir sıfıra yakınken mutlak taban kullanılmazsa yüzde uçuyordu.
    const { satirlar } = affiliateMetrikleri([
      { bTag: 'A', totalPlayers: 1, activePlayers: 1, totalDeposits: 100, totalWithdrawals: 0, netRevenue: 5000 },
      { bTag: 'B', totalPlayers: 1, activePlayers: 1, totalDeposits: 100, totalWithdrawals: 0, netRevenue: -5000 },
    ]);
    satirlar.forEach((s) => {
      expect(Number.isFinite(s.gelirPayi)).toBe(true);
      expect(Math.abs(s.gelirPayi)).toBeLessThanOrEqual(100);
    });
  });

  it('toplam dönüşüm BTag ortalaması değil, aktif/toplam oranı', () => {
    const { toplam } = affiliateMetrikleri(ORNEK);
    // (50+10+0) / (100+20+10) = 60/130
    expect(toplam.ortalamaDonusum).toBeCloseTo((60 / 130) * 100, 5);
  });

  it('toplamlar doğru', () => {
    const { toplam } = affiliateMetrikleri(ORNEK);
    expect(toplam).toMatchObject({
      bTagSayisi: 3, oyuncu: 130, aktifOyuncu: 60,
      yatirim: 130000, cekim: 68000, netGelir: 62000, netPozisyon: 62000,
    });
  });

  it('boş liste çökmez', () => {
    const { satirlar, toplam } = affiliateMetrikleri([]);
    expect(satirlar).toEqual([]);
    expect(toplam.ortalamaDonusum).toBe(0);
    expect(toplam.bTagSayisi).toBe(0);
  });

  it('eksik alanlar sıfır sayılır', () => {
    const { satirlar } = affiliateMetrikleri([{ bTag: 'X' }]);
    expect(satirlar[0].netPozisyon).toBe(0);
    expect(Number.isFinite(satirlar[0].oyuncuBasiGelir)).toBe(true);
  });
});

describe('affiliate sıralama', () => {
  it('net pozisyona göre büyükten küçüğe', () => {
    const { satirlar } = affiliateMetrikleri(ORNEK);
    expect(affiliateSirala(satirlar, 'netPozisyon').map((s) => s.bTag)).toEqual(['A', 'B', 'C']);
  });

  it('oyuncu başı gelir küçük ama kârlı BTag\'i öne çıkarır', () => {
    const { satirlar } = affiliateMetrikleri([
      { bTag: 'Buyuk', totalPlayers: 1000, activePlayers: 500, totalDeposits: 500000, totalWithdrawals: 400000, netRevenue: 100000 },
      { bTag: 'Kucuk', totalPlayers: 10, activePlayers: 5, totalDeposits: 60000, totalWithdrawals: 10000, netRevenue: 50000 },
    ]);
    // Buyuk: 200/oyuncu, Kucuk: 10000/oyuncu
    expect(affiliateSirala(satirlar, 'oyuncuBasiGelir')[0].bTag).toBe('Kucuk');
  });

  it('sıralama girdiyi değiştirmez', () => {
    const { satirlar } = affiliateMetrikleri(ORNEK);
    const once = satirlar.map((s) => s.bTag);
    affiliateSirala(satirlar, 'netPozisyon');
    expect(satirlar.map((s) => s.bTag)).toEqual(once);
  });
});
