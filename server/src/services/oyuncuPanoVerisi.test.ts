import { describe, expect, it } from 'vitest';
import {
  bonusKaynakliKazanc,
  oyuncuGgr,
  oyuncuPanosu,
  panoSayisi,
  yatirimsizBakiyeMi,
} from './oyuncuPanoVerisi.js';

/** Kullanicinin yapistirdigi gercek oyuncu pano yaniti. */
const GERCEK = {
  'a.SiteId': 137,
  'Player ID': '2503578',
  Currency: 'TRY',
  'TOTAL BALANCE': '9.52 TRY',
  'REAL BALANCE': '9.52 TRY',
  'BONUS BALANCE': '0 TRY',
  'LAST DEPOSIT AMOUNT': '0 TRY',
  'LAST DEPOSIT DATE': null,
  'LAST WITHDRAWAL AMOUNT': '0 TRY',
  'LAST WITHDRAWAL DATE': null,
  'TOTAL DEPOSITS AMOUNT': '0 TRY',
  'TOTAL DEPOSITS COUNT': 0,
  'TOTAL WITHDRAWALS AMOUNT': '0 TRY',
  'TOTAL WITHDRAWALS COUNT': 0,
  'TOTAL BET AMOUNT': '98.8 TRY',
  'TOTAL WIN AMOUNT': '61.24 TRY',
  GGR: '37.56 TRY',
  'TOTAL BONUS BET': '0 TRY',
  'TOTAL BONUS WIN': '0 TRY',
  'CASINO REAL BETS': '98.8 TRY',
  'CASINO REAL WINS': '61.24 TRY',
  'CASINO BONUS BETS': '0 TRY',
  'CASINO BONUS WINS': '0 TRY',
  'CASINO GGR': '37.56 TRY',
  'SPORT REAL BETS': '0 TRY',
  'SPORT REAL WINS': '0 TRY',
  'SPORT BONUS BETS': '0 TRY',
  'SPORT BONUS WINS': '0 TRY',
  'SPORT GGR': '0 TRY',
  'FREE SPIN WIN': '47.4 TRY',
  'BONUS PAYOUT': '0 TRY',
  'CASHBACK BONUS': '0 TRY',
};

describe('panoSayisi', () => {
  it('birim ekli metni çözer', () => {
    expect(panoSayisi('9.52 TRY')).toBe(9.52);
    expect(panoSayisi('0 TRY')).toBe(0);
    expect(panoSayisi(0)).toBe(0);
  });

  it('ölçülmemiş alanı sıfır saymaz', () => {
    // "0" gercek bir olcum, null olcum yoklugu; ikisi ayri.
    expect(panoSayisi(null)).toBeNull();
    expect(panoSayisi(undefined)).toBeNull();
    expect(panoSayisi('')).toBeNull();
    expect(panoSayisi('yok')).toBeNull();
  });
});

describe('oyuncuPanosu', () => {
  const pano = oyuncuPanosu(GERCEK);

  it('gerçek yanıtı bire bir eşler', () => {
    expect(pano.playerId).toBe('2503578');
    expect(pano.gercekBakiye).toBe(9.52);
    expect(pano.toplamYatirim).toBe(0);
    expect(pano.yatirimAdedi).toBe(0);
    expect(pano.toplamBahis).toBe(98.8);
    expect(pano.ggr).toBe(37.56);
    expect(pano.freespinKazanc).toBe(47.4);
  });

  it('casino ve spor ayrımını korur', () => {
    // lynonPlayerKpi bunlari topluyordu; cekim degerlendirmesinde ayrim lazim.
    expect(pano.casinoBahis).toBe(98.8);
    expect(pano.casinoGgr).toBe(37.56);
    expect(pano.sporBahis).toBe(0);
    expect(pano.sporGgr).toBe(0);
  });

  it('null tarihleri null bırakır', () => {
    expect(pano.sonYatirimTarihi).toBeNull();
    expect(pano.sonCekimTarihi).toBeNull();
  });

  it('boş yanıtta her şey null', () => {
    const bos = oyuncuPanosu({});
    expect(bos.gercekBakiye).toBeNull();
    expect(bos.toplamYatirim).toBeNull();
    expect(bos.ggr).toBeNull();
  });

  it('null girdi çökmez', () => {
    expect(oyuncuPanosu(null).playerId).toBe('');
  });
});

describe('yatirimsizBakiyeMi', () => {
  it('gerçek oyuncuyu yakalar: sıfır yatırım, bakiye var', () => {
    // Cekim talebinde bakilmasi gereken ilk sey.
    expect(yatirimsizBakiyeMi(oyuncuPanosu(GERCEK))).toBe(true);
  });

  it('yatırım yapmış oyuncuda çalışmaz', () => {
    expect(yatirimsizBakiyeMi(oyuncuPanosu({ ...GERCEK, 'TOTAL DEPOSITS AMOUNT': '500 TRY' }))).toBe(false);
  });

  it('bakiyesi sıfırsa şüphe üretmez', () => {
    expect(yatirimsizBakiyeMi(oyuncuPanosu({
      ...GERCEK, 'TOTAL BALANCE': '0 TRY', 'REAL BALANCE': '0 TRY',
    }))).toBe(false);
  });

  it('yatırım ölçülemediyse şüphe üretmez', () => {
    // Olcum yoklugunu suphe olarak raporlamak yanlis alarm uretir.
    const eksik = { ...GERCEK } as Record<string, unknown>;
    delete eksik['TOTAL DEPOSITS AMOUNT'];
    expect(yatirimsizBakiyeMi(oyuncuPanosu(eksik))).toBe(false);
  });
});

describe('türetilen ölçüler', () => {
  it('GGR alandan okunur', () => {
    expect(oyuncuGgr(oyuncuPanosu(GERCEK))).toBe(37.56);
  });

  it('GGR yoksa bahis eksi kazançtan hesaplanır', () => {
    const eksik = { ...GERCEK } as Record<string, unknown>;
    delete eksik.GGR;
    expect(oyuncuGgr(oyuncuPanosu(eksik))).toBeCloseTo(98.8 - 61.24, 5);
  });

  it('bahis de kazanç da yoksa GGR uydurulmaz', () => {
    expect(oyuncuGgr(oyuncuPanosu({}))).toBeNull();
  });

  it('bonus kaynaklı kazancı toplar', () => {
    expect(bonusKaynakliKazanc(oyuncuPanosu(GERCEK))).toBe(47.4);
  });

  it('bonus kalemlerinin hiçbiri bilinmiyorsa null', () => {
    // Bilinmeyeni sifir sayip "bonus kazanci yok" demek avciligi gizler.
    expect(bonusKaynakliKazanc(oyuncuPanosu({}))).toBeNull();
  });
});
