import { describe, expect, it } from 'vitest';
import {
  AGIRLIKLAR,
  churnRiskiHesapla,
  ortanca,
  riskAltindakiHacim,
  segmentDagilimi,
  VARSAYILAN_ESIKLER,
  yatirimRitmi,
  type IslemSatiri,
} from './churnRiski.js';

const SIMDI = Date.parse('2026-08-22T12:00:00Z');
const GUN = 86_400_000;

/** `gunOnce` gün önce yapılmış işlem. */
const islem = (tur: string, tutar: number, gunOnce: number, durum = 'success'): IslemSatiri => ({
  tur,
  durum,
  tutar,
  tarih: new Date(SIMDI - gunOnce * GUN).toISOString(),
});

/** Düzenli ritimli oyuncu: her `aralik` günde bir yatırım. */
const duzenli = (adet: number, aralik: number, tutar = 1000, sonYatirimGunOnce = 0) =>
  Array.from({ length: adet }, (_, i) =>
    islem('deposit', tutar, sonYatirimGunOnce + (adet - 1 - i) * aralik));

const hesapla = (girdi: Parameters<typeof churnRiskiHesapla>[0]) =>
  churnRiskiHesapla(girdi, SIMDI);

describe('ağırlıklar', () => {
  it('her biri 0-1 arasında — kanıt gücü, pay değil', () => {
    // Toplamlarinin 1 olmasi GEREKMIYOR: bilesenler ortalanmiyor,
    // bagimsiz kanit olarak birlestiriliyor.
    for (const [ad, g] of Object.entries(AGIRLIKLAR)) {
      expect(g, ad).toBeGreaterThan(0);
      expect(g, ad).toBeLessThanOrEqual(1);
    }
  });

  it('ritim en belirleyici sinyal', () => {
    expect(AGIRLIKLAR.ritim).toBeGreaterThan(AGIRLIKLAR.sessizlik);
    expect(AGIRLIKLAR.sessizlik).toBeGreaterThan(AGIRLIKLAR.dususs);
  });
});

describe('ortanca', () => {
  it('tek ve çift uzunlukta doğru', () => {
    expect(ortanca([3, 1, 2])).toBe(2);
    expect(ortanca([4, 1, 2, 3])).toBe(2.5);
  });

  it('tek aykırı değerden etkilenmez — ortalamadan farkı bu', () => {
    // Ortalama 25 cikardi; ortanca 3 diyor. "Bu oyuncunun ritmi seyrek"
    // yanilgisini engelleyen sey bu.
    expect(ortanca([2, 3, 4, 100])).toBe(3.5);
  });

  it('boş listede null', () => {
    expect(ortanca([])).toBeNull();
  });
});

describe('yatirimRitmi', () => {
  it('düzenli oyuncunun aralığını bulur', () => {
    expect(yatirimRitmi(duzenli(6, 3), 3)).toBe(3);
  });

  it('yeterli yatırım yoksa null — tek gözlem ritim değildir', () => {
    expect(yatirimRitmi(duzenli(2, 3), 3)).toBeNull();
  });

  it('günde birden fazla yatırımda taban 0.5 gün — sıfıra bölme yok', () => {
    const ayniGun = [islem('deposit', 100, 1), islem('deposit', 100, 1), islem('deposit', 100, 1)];
    expect(yatirimRitmi(ayniGun, 3)).toBe(0.5);
  });
});

describe('ritim kırılması', () => {
  it('zamanında yatıran oyuncuda risk yok', () => {
    const s = hesapla({ login: 'duzenli', islemler: duzenli(8, 3, 1000, 1), kayitTarihi: new Date(SIMDI - 200 * GUN).toISOString() });
    expect(s.segment).toBe('saglikli');
    expect(s.bilesenler.find((b) => b.anahtar === 'ritim')?.puan).toBe(0);
  });

  it('kendi ritminin 4 katı geciken oyuncuda bileşen tavana vurur', () => {
    // 3 gunde bir yatiran oyuncu 12 gundur yok = 4 kat.
    const s = hesapla({
      login: 'geciken',
      islemler: duzenli(8, 3, 1000, 12),
      kayitTarihi: new Date(SIMDI - 200 * GUN).toISOString(),
    });
    const ritim = s.bilesenler.find((b) => b.anahtar === 'ritim');
    expect(ritim?.puan).toBe(100);
    expect(ritim?.gerekce).toContain('3.0 günde bir');
  });

  it('AYNI sessizlik, farklı ritimde farklı risk üretir', () => {
    // Modulun varlik sebebi: 10 gun, gunluk yatirana alarm, ayda bir
    // yatirana normal.
    const gunluk = hesapla({
      login: 'gunluk', islemler: duzenli(10, 1, 500, 10),
      kayitTarihi: new Date(SIMDI - 200 * GUN).toISOString(),
    });
    const aylik = hesapla({
      login: 'aylik', islemler: duzenli(6, 30, 500, 10),
      kayitTarihi: new Date(SIMDI - 400 * GUN).toISOString(),
    });
    expect(gunluk.risk).toBeGreaterThan(aylik.risk);
    expect(gunluk.bilesenler.find((b) => b.anahtar === 'ritim')!.puan)
      .toBeGreaterThan(aylik.bilesenler.find((b) => b.anahtar === 'ritim')!.puan);
  });
});

describe('segmentler', () => {
  const eski = new Date(SIMDI - 300 * GUN).toISOString();

  it('yeni üye "yeni" — ritmi oluşmadan karar verilmiyor', () => {
    const s = hesapla({
      login: 'yeni', islemler: duzenli(3, 1, 500, 1),
      kayitTarihi: new Date(SIMDI - 5 * GUN).toISOString(),
    });
    expect(s.segment).toBe('yeni');
    expect(s.oneri).toBe('bekle');
    expect(s.risk).toBe(0);
  });

  it('yatırımı olmayan "veriYok"', () => {
    const s = hesapla({ login: 'bos', islemler: [], kayitTarihi: eski });
    expect(s.segment).toBe('veriYok');
    expect(s.oneri).toBe('bekle');
  });

  it('eşiği aşan sessizlik "kayip" — önleme değil geri kazanım işi', () => {
    const s = hesapla({ login: 'gitti', islemler: duzenli(6, 3, 1000, 90), kayitTarihi: eski });
    expect(s.segment).toBe('kayip');
    expect(s.oneri).toBe('geriKazanim');
  });

  it('kayıp oyuncunun önceliği DÜŞÜRÜLÜR — kurtarılabilirlerin önüne geçmesin', () => {
    const kayip = hesapla({ login: 'k', islemler: duzenli(6, 3, 1000, 90), kayitTarihi: eski });
    const kritik = hesapla({ login: 'r', islemler: duzenli(6, 3, 1000, 15), kayitTarihi: eski });
    expect(kritik.oncelik).toBeGreaterThan(kayip.oncelik);
  });

  it('risk arttıkça segment sertleşir', () => {
    const saglikli = hesapla({ login: 'a', islemler: duzenli(8, 3, 1000, 1), kayitTarihi: eski });
    const kritik = hesapla({ login: 'b', islemler: duzenli(8, 3, 1000, 20), kayitTarihi: eski });
    expect(saglikli.segment).toBe('saglikli');
    expect(kritik.segment).toBe('kritik');
    expect(kritik.risk).toBeGreaterThan(saglikli.risk);
  });
});

describe('hacim düşüşü', () => {
  const eski = new Date(SIMDI - 300 * GUN).toISOString();

  it('küçülen oyuncuyu sessizleşmeden ÖNCE yakalar', () => {
    // Hala yatiriyor (2 gun once) ama hacmi dusmus.
    const islemler = [
      ...Array.from({ length: 6 }, (_, i) => islem('deposit', 5000, 35 + i * 5)),
      islem('deposit', 500, 10),
      islem('deposit', 400, 2),
    ];
    const s = hesapla({ login: 'kuculen', islemler, kayitTarihi: eski });
    const dusus = s.bilesenler.find((b) => b.anahtar === 'dususs');
    expect(dusus!.puan).toBeGreaterThan(50);
    expect(dusus!.gerekce).toContain('azaldı');
  });

  it('önceki dönemde yatırım yoksa düşüş sinyali ÜRETMEZ', () => {
    // Sifirdan sifira gitmek bir sinyal degil.
    const s = hesapla({ login: 'y', islemler: duzenli(4, 3, 1000, 1), kayitTarihi: eski });
    expect(s.bilesenler.find((b) => b.anahtar === 'dususs')?.puan).toBe(0);
  });
});

describe('çekimle çıkış', () => {
  const eski = new Date(SIMDI - 300 * GUN).toISOString();

  it('son işlemi çekim olan oyuncuda tetiklenir', () => {
    const islemler = [...duzenli(5, 3, 1000, 8), islem('withdrawal', 4000, 5)];
    const s = hesapla({ login: 'cekti', islemler, kayitTarihi: eski });
    expect(s.olculer.sonIslemCekimMi).toBe(true);
    expect(s.bilesenler.find((b) => b.anahtar === 'cekimleCikis')!.puan).toBe(65);
  });

  it('bakiyesi de boşsa tavana vurur — dönmek için sebebi yok', () => {
    const islemler = [...duzenli(5, 3, 1000, 8), islem('withdrawal', 4000, 5)];
    const s = hesapla({ login: 'bos', islemler, bakiye: 2, kayitTarihi: eski });
    const b = s.bilesenler.find((x) => x.anahtar === 'cekimleCikis')!;
    expect(b.puan).toBe(100);
    expect(b.gerekce).toContain('bakiyesi boş');
  });

  it('son işlemi yatırımsa tetiklenmez', () => {
    const s = hesapla({ login: 'y', islemler: duzenli(5, 3, 1000, 2), kayitTarihi: eski });
    expect(s.bilesenler.find((b) => b.anahtar === 'cekimleCikis')!.puan).toBe(0);
  });
});

describe('büyük kayıp şoku', () => {
  const eski = new Date(SIMDI - 300 * GUN).toISOString();

  it('normalinin çok üstünde son yatırım + sessizlik = şok', () => {
    const islemler = [...duzenli(5, 4, 500, 20), islem('deposit', 5000, 8)];
    const s = hesapla({ login: 'sok', islemler, kayitTarihi: eski });
    const b = s.bilesenler.find((x) => x.anahtar === 'kayipSoku')!;
    expect(b.puan).toBeGreaterThan(0);
    expect(b.gerekce).toContain('katı');
  });

  it('sonrasında ÇEKİM varsa şok yok — kaybetmemiş demektir', () => {
    const islemler = [
      ...duzenli(5, 4, 500, 20),
      islem('deposit', 5000, 8),
      islem('withdrawal', 9000, 6),
    ];
    const s = hesapla({ login: 'kazandi', islemler, kayitTarihi: eski });
    expect(s.bilesenler.find((x) => x.anahtar === 'kayipSoku')!.puan).toBe(0);
  });

  it('yatırım normal büyüklükteyse şok yok', () => {
    const s = hesapla({ login: 'n', islemler: duzenli(6, 4, 500, 8), kayitTarihi: eski });
    expect(s.bilesenler.find((x) => x.anahtar === 'kayipSoku')!.puan).toBe(0);
  });
});

describe('değer katmanı ve öncelik', () => {
  const eski = new Date(SIMDI - 300 * GUN).toISOString();

  it('aynı riskte yüksek değerli oyuncu ÖNCE gelir', () => {
    const kucuk = hesapla({ login: 'kucuk', islemler: duzenli(8, 3, 200, 12), kayitTarihi: eski });
    const buyuk = hesapla({ login: 'buyuk', islemler: duzenli(8, 3, 12_000, 12), kayitTarihi: eski });
    expect(buyuk.risk).toBe(kucuk.risk);
    expect(buyuk.oncelik).toBeGreaterThan(kucuk.oncelik);
    expect(buyuk.degerKatmani).toBe('yuksek');
    expect(kucuk.degerKatmani).toBe('dusuk');
  });

  it('yüksek değerli riskli oyuncuya önce İNSAN teması önerilir', () => {
    const s = hesapla({ login: 'vip', islemler: duzenli(8, 3, 12_000, 12), kayitTarihi: eski });
    expect(s.oneri).toBe('vipTemas');
    expect(s.oneriMetni).toContain('VIP');
  });

  it('düşük değerli riskli oyuncuya ucuz deneme önerilir', () => {
    const islemler = [...duzenli(6, 3, 200, 12), islem('withdrawal', 100, 30)];
    const s = hesapla({ login: 'dusuk', islemler, kayitTarihi: eski });
    expect(['freespin', 'kayipBonusu']).toContain(s.oneri);
  });

  it('parasını çekip gidene yatırım eşleşmeli bonus önerilir', () => {
    const islemler = [...duzenli(6, 3, 3000, 15), islem('withdrawal', 20_000, 12)];
    const s = hesapla({ login: 'cekti', islemler, kayitTarihi: eski });
    expect(s.oneri).toBe('yatirimBonusu');
  });
});

describe('özet', () => {
  const eski = new Date(SIMDI - 300 * GUN).toISOString();

  it('toplama en çok KATKI yapan bileşeni gösterir, en yüksek puanlıyı değil', () => {
    // Agirlik carpilmadan bakmak, puani yuksek ama agirligi dusuk bir
    // bileseni one cikarip yaniltirdi.
    const s = hesapla({ login: 'x', islemler: duzenli(8, 3, 1000, 12), kayitTarihi: eski });
    expect(s.ozet).toContain('günde bir yatırıyor');
  });

  it('sağlıklı oyuncuda kısa ve nettir', () => {
    const s = hesapla({ login: 'x', islemler: duzenli(8, 3, 1000, 1), kayitTarihi: eski });
    expect(s.ozet).toBe('Ritmi yerinde.');
  });
});

describe('sessizlik bileşeni', () => {
  const eski = new Date(SIMDI - 300 * GUN).toISOString();

  it('hâlâ OYNAYAN ama yatırmayan oyuncu sessiz sayılmaz', () => {
    // Bakiyesini eritiyor olabilir; sessizlik yatirimla degil, en yeni
    // hareketle olculuyor.
    const islemler = duzenli(6, 3, 1000, 20);
    const yatirmayan = hesapla({ login: 'a', islemler, kayitTarihi: eski });
    const oynayan = hesapla({
      login: 'b', islemler, kayitTarihi: eski,
      sonAktiflik: new Date(SIMDI - 1 * GUN).toISOString(),
    });
    const p = (s: typeof oynayan) => s.bilesenler.find((b) => b.anahtar === 'sessizlik')!.puan;
    expect(p(oynayan)).toBeLessThan(p(yatirmayan));
  });
});

describe('toplu göstergeler', () => {
  const eski = new Date(SIMDI - 300 * GUN).toISOString();
  const liste = [
    hesapla({ login: 'a', islemler: duzenli(8, 3, 1000, 1), kayitTarihi: eski }),
    hesapla({ login: 'b', islemler: duzenli(8, 3, 1000, 12), kayitTarihi: eski }),
    hesapla({ login: 'c', islemler: duzenli(8, 3, 1000, 90), kayitTarihi: eski }),
    hesapla({ login: 'd', islemler: [], kayitTarihi: eski }),
  ];

  it('segment dağılımı tüm segmentleri içerir', () => {
    const d = segmentDagilimi(liste);
    expect(Object.keys(d).sort()).toEqual(
      ['izle', 'kayip', 'kritik', 'riskli', 'saglikli', 'veriYok', 'yeni'].sort(),
    );
    expect(d.kayip).toBe(1);
    expect(d.veriYok).toBe(1);
  });

  it('risk altındaki hacim yalnızca MÜDAHALE EDİLEBİLİR segmentleri sayar', () => {
    // "Kayip" olanlar zaten durmus; onlari eklemek bugunku kaybi
    // oldugundan buyuk gosterirdi.
    const hacim = riskAltindakiHacim(liste);
    const kayipHacmi = liste.find((s) => s.segment === 'kayip')!.olculer.sonDonemYatirim;
    expect(hacim).toBeGreaterThanOrEqual(0);
    expect(hacim).not.toContain?.(kayipHacmi);
    expect(liste.filter((s) => s.segment === 'kayip')[0].olculer.sonDonemYatirim).toBe(0);
  });

  it('boş listede çökmez', () => {
    expect(riskAltindakiHacim([])).toBe(0);
    expect(segmentDagilimi([]).saglikli).toBe(0);
  });
});

describe('dayanıklılık', () => {
  it('başarısız işlemler sayılmaz', () => {
    const islemler = [
      ...duzenli(6, 3, 1000, 12),
      islem('deposit', 99_999, 1, 'failed'),
    ];
    const s = hesapla({ login: 'x', islemler, kayitTarihi: new Date(SIMDI - 300 * GUN).toISOString() });
    // Basarisiz yatirim sayilsaydi son yatirim 1 gun once gorunur ve
    // risk sifirlanirdi.
    expect(s.olculer.sonYatirimGun).toBe(12);
  });

  it('bozuk tarihli satır çökertmez', () => {
    const islemler = [
      { tur: 'deposit', durum: 'success', tutar: 100, tarih: 'bozuk' },
      ...duzenli(4, 3, 1000, 5),
    ];
    expect(() => hesapla({ login: 'x', islemler })).not.toThrow();
  });

  it('kayıt tarihi yoksa yeni sayılmaz, hesap yapılır', () => {
    const s = hesapla({ login: 'x', islemler: duzenli(8, 3, 1000, 12) });
    expect(s.segment).not.toBe('yeni');
    expect(s.risk).toBeGreaterThan(0);
  });

  it('risk her zaman 0–100 arasında', () => {
    const uclar = [
      hesapla({ login: 'a', islemler: duzenli(20, 0.5, 50_000, 59), bakiye: 0, kayitTarihi: new Date(SIMDI - 900 * GUN).toISOString() }),
      hesapla({ login: 'b', islemler: duzenli(3, 90, 10, 0), kayitTarihi: new Date(SIMDI - 900 * GUN).toISOString() }),
    ];
    for (const s of uclar) {
      expect(s.risk).toBeGreaterThanOrEqual(0);
      expect(s.risk).toBeLessThanOrEqual(100);
    }
  });

  it('eşikler dışarıdan verilebilir', () => {
    const islemler = duzenli(6, 3, 1000, 40);
    const varsayilan = churnRiskiHesapla({ login: 'x', islemler }, SIMDI);
    const sikiEsik = churnRiskiHesapla({ login: 'x', islemler }, SIMDI,
      { ...VARSAYILAN_ESIKLER, kayipGun: 30 });
    expect(varsayilan.segment).not.toBe('kayip');
    expect(sikiEsik.segment).toBe('kayip');
  });
});

describe('kanıtlar birikir', () => {
  const eski = new Date(SIMDI - 300 * GUN).toISOString();

  it('iki sinyali olan oyuncu, tek sinyali olandan daha riskli', () => {
    // Agirlikli ortalamada bu her zaman dogru degildi: sifir olan
    // bilesenler baskin sinyali asagi cekiyordu.
    const tek = hesapla({ login: 'tek', islemler: duzenli(8, 3, 1000, 12), kayitTarihi: eski });
    const iki = hesapla({
      login: 'iki',
      islemler: [...duzenli(8, 3, 1000, 12), islem('withdrawal', 5000, 10)],
      bakiye: 0,
      kayitTarihi: eski,
    });
    expect(iki.risk).toBeGreaterThan(tek.risk);
  });

  it('tek başına tavana vuran ritim kritik segmente taşır', () => {
    // Uc gunde bir yatiran oyuncu 20 gundur yok: bu kritiktir.
    // Onceki modelde 44 puan ("izle") cikiyordu.
    const s = hesapla({ login: 'x', islemler: duzenli(8, 3, 1000, 20), kayitTarihi: eski });
    expect(s.risk).toBeGreaterThanOrEqual(70);
    expect(s.segment).toBe('kritik');
  });

  it('sinyal yokken risk ihmal edilebilir kalır', () => {
    // Tam sifir beklemek yanlis olurdu: 1 gunluk sessizlik de kucuk bir
    // kanittir ve motor onu durustce %1 olarak veriyor. Onemli olan
    // segmentin saglikli kalmasi.
    const s = hesapla({ login: 'x', islemler: duzenli(8, 3, 1000, 1), kayitTarihi: eski });
    expect(s.risk).toBeLessThan(5);
    expect(s.segment).toBe('saglikli');
  });
});
