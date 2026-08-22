import { describe, expect, it } from 'vitest';
import { bugunCekimKapisi, ilkYatirimKaybiKapisi } from './kuralKapilari.js';

describe('ilkYatirimKaybiKapisi', () => {
  it('tek yatirim + net kayip -> UYGUN', () => {
    const s = ilkYatirimKaybiKapisi({ yatirimAdedi: 1, netKayip: 500 });
    expect(s.ok).toBe(true);
    expect(s.reason).toMatch(/500\.00 TRY/);
  });

  it('ilk yatirim kazancla bitmisse RED', () => {
    // Yalnizca "ilk yatirim" kosulu acik kalsaydi bu oyuncuya da iade
    // verilirdi -- calisan ama yanlis bir kampanya.
    const s = ilkYatirimKaybiKapisi({ yatirimAdedi: 1, netKayip: 0 });
    expect(s.ok).toBe(false);
    expect(s.reason).toMatch(/kayıpla sonuçlanmamış/);
  });

  it('negatif net kayip (kazanc) RED', () => {
    expect(ilkYatirimKaybiKapisi({ yatirimAdedi: 1, netKayip: -250 }).ok).toBe(false);
  });

  it('ikinci yatirimda RED -- kayip olsa bile', () => {
    // Yalnizca "kayip" kosulu acik kalsaydi onuncu yatirimini kaybedene
    // de iade giderdi.
    const s = ilkYatirimKaybiKapisi({ yatirimAdedi: 2, netKayip: 900 });
    expect(s.ok).toBe(false);
    expect(s.reason).toMatch(/yalnızca ilk yatırım/i);
  });

  it('hic yatirim yoksa RED ve sebebi ayri', () => {
    const s = ilkYatirimKaybiKapisi({ yatirimAdedi: 0, netKayip: 100 });
    expect(s.ok).toBe(false);
    expect(s.reason).toMatch(/Henüz tamamlanmış bir yatırım yok/);
  });

  it('bozuk girdide RED, patlamiyor', () => {
    expect(ilkYatirimKaybiKapisi({ yatirimAdedi: Number.NaN, netKayip: Number.NaN }).ok).toBe(false);
  });
});

describe('bugunCekimKapisi', () => {
  const tariheCevir = (d: unknown) => (typeof d === 'number' ? d : Date.parse(String(d ?? '')));
  // Gercek cagriyla ayni: Istanbul gun anahtari.
  const gunAnahtari = (an: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(an);
  const SIMDI = new Date('2026-08-22T15:00:00');
  const bugun = (saat: string) => new Date(`2026-08-22T${saat}:00`).getTime();
  const dun = (saat: string) => new Date(`2026-08-21T${saat}:00`).getTime();

  it('bugun cekim yoksa UYGUN', () => {
    const s = bugunCekimKapisi({ islemler: [], tariheCevir, gunAnahtari, simdi: SIMDI });
    expect(s.ok).toBe(true);
    expect(s.adet).toBe(0);
  });

  it('bugun cekim TALEBI varsa RED', () => {
    const s = bugunCekimKapisi({
      islemler: [{ DocumentTypeName: 'Çekim Talebi', CreatedLocal: bugun('09:30') }],
      tariheCevir, gunAnahtari, simdi: SIMDI,
    });
    expect(s.ok).toBe(false);
    expect(s.adet).toBe(1);
  });

  it('bugun ODENMIS cekim de sayiliyor', () => {
    // "Bekleyen cekim" kontrolu odenmisi gormuyor; sabah cekim alip
    // ogleden sonra bonus isteyen oyuncu ondan geciyordu.
    const s = bugunCekimKapisi({
      islemler: [{ DocumentTypeName: 'Çekim Talebi Ödemesi', CreatedLocal: bugun('11:00') }],
      tariheCevir, gunAnahtari, simdi: SIMDI,
    });
    expect(s.ok).toBe(false);
  });

  it('DUNKU cekim engellemiyor', () => {
    const s = bugunCekimKapisi({
      islemler: [{ DocumentTypeName: 'Çekim Talebi', CreatedLocal: dun('23:59') }],
      tariheCevir, gunAnahtari, simdi: SIMDI,
    });
    expect(s.ok).toBe(true);
  });

  it('yatirim islemi cekim sayilmiyor', () => {
    const s = bugunCekimKapisi({
      islemler: [{ DocumentTypeName: 'Yatırım', CreatedLocal: bugun('10:00') }],
      tariheCevir, gunAnahtari, simdi: SIMDI,
    });
    expect(s.ok).toBe(true);
  });

  it('birden fazla cekimi sayiyor', () => {
    const s = bugunCekimKapisi({
      islemler: [
        { DocumentTypeName: 'Çekim Talebi', CreatedLocal: bugun('09:00') },
        { DocumentTypeName: 'Çekim Talebi Ödemesi', CreatedLocal: bugun('12:00') },
        { DocumentTypeName: 'Çekim Talebi', CreatedLocal: dun('12:00') },
      ],
      tariheCevir, gunAnahtari, simdi: SIMDI,
    });
    expect(s.adet).toBe(2);
    expect(s.reason).toMatch(/2 çekim/);
  });

  it('tarihi cozulemeyen satiri ATLIYOR', () => {
    // Cozulemeyen tarih 0 donuyor; bunu "bugun" saysak her oyuncu
    // sebepsiz reddedilirdi.
    const s = bugunCekimKapisi({
      islemler: [{ DocumentTypeName: 'Çekim Talebi', CreatedLocal: 'bozuk-tarih' }],
      tariheCevir, gunAnahtari, simdi: SIMDI,
    });
    expect(s.ok).toBe(true);
  });

  it('tur adindaki bosluklari kirpiyor', () => {
    const s = bugunCekimKapisi({
      islemler: [{ DocumentTypeName: '  Çekim Talebi  ', CreatedLocal: bugun('09:00') }],
      tariheCevir, gunAnahtari, simdi: SIMDI,
    });
    expect(s.ok).toBe(false);
  });

  it('islem listesi bozuksa UYGUN -- oyuncuyu sebepsiz engellemiyor', () => {
    const s = bugunCekimKapisi({ islemler: null as never, tariheCevir, gunAnahtari, simdi: SIMDI });
    expect(s.ok).toBe(true);
  });
});
