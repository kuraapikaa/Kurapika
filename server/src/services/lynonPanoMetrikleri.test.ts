import { describe, expect, it } from 'vitest';
import {
  metrikSayisi,
  netGelir,
  panoMetrikleri,
  taninmayanAlanlar,
} from './lynonPanoMetrikleri.js';

/**
 * PANO REGRESYON TESTI.
 *
 * Bildirilen vaka: "dashboard hâlâ yanlış gösteriyor" — tarih penceresi
 * duzeltildikten SONRA bile.
 *
 * Sorun eslemedeydi: yanitta olmayan alanlar baska metriklere geri
 * dusuyor, farkli metrikler ayni etiketle gosteriliyordu.
 *
 * Asagidaki `GERCEK` nesnesi 2 Agustos 2026 icin canli panodan alinan
 * yanitin birebir kendisi.
 */
const GERCEK = {
  'AVERAGE DAILY DEPOSITS': '16090 TRY',
  'AVERAGE DAILY PROFIT': '-52984.08 TRY',
  'FIRST DEPOSIT COUNT': 2,
  GGR: '14668.99 TRY',
  'PLAYERS REGISTERED': 122,
  PROFIT: '-52984.08 TRY',
  'TOTAL BET COUNT': 24387,
  'TOTAL BONUS BET': '105.2 TRY',
  'TOTAL BONUS WIN': '122.55 TRY',
  'TOTAL Bonus PayOut': '121.35 TRY',
  'TOTAL Cashback': '0 TRY',
  'TOTAL DEPOSITS AMOUNT': '16090 TRY',
  'TOTAL FREESPIN WIN': '20128 TRY',
  'TOTAL REAL BET AMOUNT': '401944 TRY',
  'TOTAL REAL WIN AMOUNT': '387257.66 TRY',
  'TOTAL REFUND AMOUNT': '0 TRY',
  'TOTAL WIN COUNT': 6879,
  'TOTAL WITHDRAWALS AMOUNT': '24190 TRY',
  'UNIQUE PLAYER BET': 87,
  'UNIQUE PLAYER DEPOSITS': 2,
  'UNIQUE PLAYER WIN': 82,
  'UNIQUE PLAYER WITHDRAWALS': 5,
  'USERS BONUS BALANCE': '0 TRY',
  'USERS REAL BALANCE': '44884.08 TRY',
};

const bul = (ham: any, anahtar: string) => panoMetrikleri(ham).find((m) => m.anahtar === anahtar)!;

describe('sayı çözümleme', () => {
  it('para birimi ekli metin çözülür', () => {
    expect(metrikSayisi('16090 TRY')).toBe(16090);
    expect(metrikSayisi('-52984.08 TRY')).toBe(-52984.08);
  });

  it('düz sayı olduğu gibi', () => {
    expect(metrikSayisi(24387)).toBe(24387);
    expect(metrikSayisi(0)).toBe(0);
  });

  it('sıfır SIFIR kalır — null değil', () => {
    // "0 TRY" gecerli bir olcum; veri yoklugu ile karistirilmamali.
    expect(metrikSayisi('0 TRY')).toBe(0);
  });

  it('yokluk null döner — 0 DEĞİL', () => {
    expect(metrikSayisi(undefined)).toBeNull();
    expect(metrikSayisi(null)).toBeNull();
    expect(metrikSayisi('')).toBeNull();
    expect(metrikSayisi('TRY')).toBeNull();
  });

  it('binlik ayracı temizlenir', () => {
    expect(metrikSayisi('1,234.5 TRY')).toBe(1234.5);
  });
});

describe('bildirilen hatalar — gerçek yanıtla', () => {
  it('GGR ve PROFIT AYRI metrikler', () => {
    // Onceden `PROFIT ?? GGR` idi; biri digerinin yerine konunca
    // ekranda -52.984 yerine +14.668 (ya da tersi) cikiyordu.
    expect(bul(GERCEK, 'ggr').deger).toBe(14668.99);
    expect(bul(GERCEK, 'kar').deger).toBe(-52984.08);
  });

  it('yatırım yapan oyuncu, yatırım ADEDİ diye gösterilmez', () => {
    // Eski kod TOTAL DEPOSITS COUNT yoksa UNIQUE PLAYER DEPOSITS'e
    // dusuyor, ekranda "2 işlem · 2 oyuncu" yaziyordu.
    const oyuncu = bul(GERCEK, 'yatirimOyuncu');
    expect(oyuncu.deger).toBe(2);
    expect(oyuncu.birim).toBe('oyuncu');
    // Yatirim ADEDI diye bir metrik yok; uydurulmuyor.
    expect(panoMetrikleri(GERCEK).some((m) => m.anahtar === 'yatirimAdedi')).toBe(false);
  });

  it('yanıtta olmayan alan veriYok işaretlenir', () => {
    // PLAYERS LOGGED IN / LOGIN COUNT bu yanitta HIC yok; eski pano
    // ikisini de 0 gosteriyordu.
    const eksik = panoMetrikleri({ GGR: '5 TRY' }).find((m) => m.anahtar === 'yatirim')!;
    expect(eksik.deger).toBeNull();
    expect(eksik.veriYok).toBe(true);
  });

  it('değeri sıfır olan alan veriYok DEĞİLDİR', () => {
    const cashback = bul(GERCEK, 'cashback');
    expect(cashback.deger).toBe(0);
    expect(cashback.veriYok).toBe(false);
  });

  it('eksik metrik listeden düşürülmez — sessizce normalleşmesin', () => {
    const metrikler = panoMetrikleri({});
    expect(metrikler.length).toBeGreaterThan(20);
    expect(metrikler.every((m) => m.veriYok)).toBe(true);
  });
});

describe('gerçek yanıttaki tüm alanlar', () => {
  it('freespin kazancı artık görünür', () => {
    // 20.128 TRY dogrudan bonus maliyeti; eski panoda hic yoktu.
    expect(bul(GERCEK, 'freespinKazanc').deger).toBe(20128);
  });

  it('bahis adedi ve kazanan bahis', () => {
    expect(bul(GERCEK, 'bahisAdedi').deger).toBe(24387);
    expect(bul(GERCEK, 'kazancAdedi').deger).toBe(6879);
  });

  it('gerçek bahis eksi gerçek kazanç ≈ GGR', () => {
    const fark = bul(GERCEK, 'gercekBahis').deger! - bul(GERCEK, 'gercekKazanc').deger!;
    expect(Math.abs(fark - bul(GERCEK, 'ggr').deger!)).toBeLessThan(20);
  });

  it('gerçek yanıtta tanınmayan alan kalmaz', () => {
    expect(taninmayanAlanlar(GERCEK)).toEqual([]);
  });

  it('Lynon yeni alan eklerse yakalanır', () => {
    expect(taninmayanAlanlar({ ...GERCEK, 'NEW METRIC': '1' })).toEqual(['NEW METRIC']);
  });

  it('her metrik bir gruba ait', () => {
    const gruplar = new Set(panoMetrikleri(GERCEK).map((m) => m.grup));
    expect([...gruplar].sort()).toEqual(['bonus', 'finans', 'oyun', 'oyuncu']);
  });
});

describe('net gelir', () => {
  it('yatırım eksi çekim', () => {
    expect(netGelir(panoMetrikleri(GERCEK))).toBe(16090 - 24190);
  });

  it('ikisi de yoksa null — sıfır değil', () => {
    expect(netGelir(panoMetrikleri({}))).toBeNull();
  });

  it('biri varsa diğeri sıfır sayılır', () => {
    expect(netGelir(panoMetrikleri({ 'TOTAL DEPOSITS AMOUNT': '100 TRY' }))).toBe(100);
  });
});

describe('izlenebilirlik', () => {
  it('her ölçü kendi Lynon alan adını taşır', () => {
    // "Pano yanlış gösteriyor" sikayeti, hangi sayinin nereden geldigi
    // gorunmedigi surece adreslenemiyor.
    expect(bul(GERCEK, 'yatirim').alan).toBe('TOTAL DEPOSITS AMOUNT');
    expect(bul(GERCEK, 'kar').alan).toBe('PROFIT');
  });

  it('ham değeri olduğu gibi taşır', () => {
    const yatirim = bul({ 'TOTAL DEPOSITS AMOUNT': '11000 TRY' }, 'yatirim');
    expect(yatirim.hamDeger).toBe('11000 TRY');
    expect(yatirim.deger).toBe(11000);
  });

  it('yanıtta olmayan alanın ham değeri null', () => {
    // "(yanıtta yok)" ile "boş metin geldi" ayri seyler.
    expect(bul({}, 'yatirim').hamDeger).toBeNull();
  });
});

describe('bozuk girdi', () => {
  it('null ve undefined çökmez', () => {
    expect(panoMetrikleri(null)).toHaveLength(panoMetrikleri({}).length);
    expect(panoMetrikleri(undefined)).toHaveLength(panoMetrikleri({}).length);
    expect(taninmayanAlanlar(null)).toEqual([]);
  });

  it('çözülemeyen değer veriYok sayılır', () => {
    expect(bul({ GGR: 'çöp' }, 'ggr').veriYok).toBe(true);
  });
});
