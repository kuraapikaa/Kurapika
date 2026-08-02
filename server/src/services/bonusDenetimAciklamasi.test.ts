import { describe, expect, it } from 'vitest';
import { bonusDenetimAciklamasi } from './bonusDenetimAciklamasi.js';

/**
 * DENETIM KAYDI REGRESYON TESTI.
 *
 * Onceden denetime su dusuyordu:
 *   "RuleId: kayip-bonusu, Amount: 2500"
 *
 * Bu kayittan bonusun adi, turu, tutarin nereden geldigi ve hangi
 * yatirima karsilik verildigi OKUNAMIYORDU. "2492369 neden bir sürü
 * %30 kayıp bonusu almış" sorusunu denetim kaydiyla cevaplamak mumkun
 * degildi.
 */

describe('nakit bonus açıklaması', () => {
  const temel = {
    tur: 'nakit',
    baslik: '%30 Kayıp Bonusu',
    kuralAnahtari: '30 kayıp bonusu',
    tutar: 2500,
    tutarKaynagi: 'kural' as const,
    yatirimId: '77001',
    yatirimTutari: 10000,
  };

  it('bonusun kendisini anlatır', () => {
    const a = bonusDenetimAciklamasi(temel);
    expect(a).toContain('Nakit (bakiye düzeltmesi)');
    expect(a).toContain('%30 Kayıp Bonusu (30 kayıp bonusu)');
    expect(a).toContain('2.500 TRY');
    expect(a).toContain('Yatırım: #77001');
  });

  it('tutarın kuraldan mı elle mi geldiği yazılır', () => {
    // Denetimin can alici bilgisi: elle girilen tutar operator karari.
    expect(bonusDenetimAciklamasi(temel)).toContain('kural hesapladı');
    expect(bonusDenetimAciklamasi({ ...temel, tutarKaynagi: 'elle' })).toContain('elle girildi');
  });

  it('başlık ve anahtar aynıysa tekrarlanmaz', () => {
    const a = bonusDenetimAciklamasi({ tur: 'nakit', baslik: 'x', kuralAnahtari: 'x' });
    expect(a).not.toContain('x (x)');
  });
});

describe('kampanya ataması', () => {
  it('kampanya kimliği yazılır', () => {
    const a = bonusDenetimAciklamasi({
      tur: 'kampanya', baslik: '100 FS', kuralAnahtari: '1885', kampanyaId: 1885, tutar: 100,
    });
    expect(a).toContain('Lynon kampanyası');
    expect(a).toContain('Kampanya #1885');
  });
});

describe('oyun ödülleri', () => {
  it('kaynak ayrı yazılır', () => {
    for (const kaynak of ['çark', 'kazı kazan', 'telegram', 'skor tahmin']) {
      expect(bonusDenetimAciklamasi({ tur: 'oyun', kaynak, baslik: 'X' })).toContain(`Kaynak: ${kaynak}`);
    }
  });

  it('başarısız deneme de kayda geçer', () => {
    // "Verilmedi" bilgisi "verildi" kadar denetim degeri tasiyor.
    const a = bonusDenetimAciklamasi({
      tur: 'oyun', kaynak: 'çark', baslik: 'X', sonuc: 'basarisiz', mesaj: 'Kampanya seçilmemiş',
    });
    expect(a).toContain('BAŞARISIZ: Kampanya seçilmemiş');
  });

  it('belirsiz sonuç ayrıca işaretlenir', () => {
    // Lynon cagrildi ama yanit hatali: atama gerceklesmis OLABILIR.
    const a = bonusDenetimAciklamasi({ tur: 'oyun', kaynak: 'telegram', sonuc: 'belirsiz', mesaj: 'timeout' });
    expect(a).toContain('SONUÇ BELİRSİZ: timeout');
  });

  it('başarılı sonuç gürültü eklemez', () => {
    const a = bonusDenetimAciklamasi({ tur: 'oyun', kaynak: 'çark', baslik: 'X', sonuc: 'basarili' });
    expect(a).not.toContain('BAŞARISIZ');
    expect(a).not.toContain('BELİRSİZ');
  });
});

describe('boş ve bozuk girdi', () => {
  it('boş alanlar atlanır', () => {
    const a = bonusDenetimAciklamasi({ tur: 'nakit', baslik: 'X' });
    expect(a).not.toContain('Yatırım');
    expect(a).not.toContain('Tutar');
    expect(a).not.toContain('Kampanya');
  });

  it('sıfır ve negatif tutar yazılmaz', () => {
    expect(bonusDenetimAciklamasi({ tur: 'nakit', tutar: 0 })).not.toContain('Tutar');
    expect(bonusDenetimAciklamasi({ tur: 'nakit', tutar: -5 })).not.toContain('Tutar');
  });

  it('tamamen boş girdi çökmez', () => {
    expect(bonusDenetimAciklamasi({})).toBe('');
  });

  it('500 karakteri aşmaz', () => {
    const a = bonusDenetimAciklamasi({ tur: 'nakit', baslik: 'b'.repeat(900), kuralAnahtari: 'k'.repeat(900) });
    expect(a.length).toBeLessThanOrEqual(500);
  });
});
