import { describe, expect, it } from 'vitest';
import {
  DAVRANIS_ESIKLERI,
  DAVRANIS_KATEGORILERI,
  davranisKarari,
  eksikKategoriler,
  kategoriOlusturmaGovdesi,
  otomatikDavranislar,
  type DavranisOlculeri,
} from './davranisKategorileri.js';
import { esikCoz } from './oyuncuKategorileme.js';

const BOS: DavranisOlculeri = {
  netKarZarar: null,
  ayniIpHesapSayisi: null,
  toplamYatirim: null,
  bonusAdedi: null,
  durgunGun: null,
  onemliKazanc: 50_000,
};

const olcu = (yama: Partial<DavranisOlculeri>): DavranisOlculeri => ({ ...BOS, ...yama });

describe('kategori oluşturma gövdesi', () => {
  it('doğrulanmış POST sözleşmesiyle birebir', () => {
    const govde = kategoriOlusturmaGovdesi(DAVRANIS_KATEGORILERI[0], 137);
    expect(Object.keys(govde).sort()).toEqual(
      ['color', 'description', 'isVisibleToPlayer', 'name', 'siteId', 'textColor'].sort(),
    );
    expect(govde.siteId).toBe(137);
  });

  it('hiçbir etiket oyuncuya gösterilmez', () => {
    // "High Risk" rozetini oyuncuya gostermek tespit mantigini disari sizdirir.
    for (const tanim of DAVRANIS_KATEGORILERI) {
      expect(kategoriOlusturmaGovdesi(tanim, 137).isVisibleToPlayer).toBe(false);
    }
  });

  it('açıklamalar değer merdivenine sızmaz', () => {
    // esikCoz koseli parantez + para birimi ariyor; davranis
    // aciklamalarinin hicbiri bant olarak okunmamali.
    for (const tanim of DAVRANIS_KATEGORILERI) {
      expect(esikCoz(tanim.description), tanim.name).toBeNull();
    }
  });
});

describe('eksikKategoriler', () => {
  it('boş sitede hepsini eksik sayar', () => {
    expect(eksikKategoriler([])).toHaveLength(DAVRANIS_KATEGORILERI.length);
  });

  it('var olanı ikinci kez oluşturmaz', () => {
    const eksik = eksikKategoriler([{ name: 'High Risk' }, { name: 'Bonus Avcısı' }]);
    expect(eksik.map((t) => t.kimlik)).toEqual(['vip', 'aktif']);
  });

  it('büyük/küçük harf farkını kopya saymaz', () => {
    expect(eksikKategoriler([{ name: 'HIGH RISK' }]).map((t) => t.kimlik)).not.toContain('highRisk');
  });

  it('gerçek kategori listesiyle hepsi eksik', () => {
    const gercek = [
      { name: 'El Patrón (Seviye 5)' },
      { name: 'Baron (Seviye 4)' },
      { name: 'Jefe (Seviye 3)' },
      { name: 'Capo (Seviye 2)' },
      { name: 'Sicario (Seviye 1)' },
      { name: 'Yeni Oyuncu' },
    ];
    expect(eksikKategoriler(gercek)).toHaveLength(4);
  });
});

describe('davranisKarari', () => {
  it('ölçü yoksa etiket üretmez', () => {
    expect(davranisKarari(BOS)).toBeNull();
  });

  it('çoklu hesap + yüksek kazanç High Risk', () => {
    const karar = davranisKarari(olcu({ ayniIpHesapSayisi: 3, netKarZarar: -80_000 }));
    expect(karar?.kimlik).toBe('highRisk');
    expect(karar?.gerekce).toContain('3 hesap');
  });

  it('tek başına yüksek kazanç High Risk değildir', () => {
    expect(davranisKarari(olcu({ netKarZarar: -80_000 }))?.kimlik).not.toBe('highRisk');
  });

  it('çok bonus + az yatırım Bonus Avcısı', () => {
    const karar = davranisKarari(olcu({ bonusAdedi: 8, toplamYatirim: 2_000 }));
    expect(karar?.kimlik).toBe('bonusAvcisi');
    expect(karar?.gerekce).toContain('8 bonus');
  });

  it('bonus başına yatırım yüksekse avcı değildir', () => {
    expect(davranisKarari(olcu({ bonusAdedi: 6, toplamYatirim: 300_000 }))?.kimlik).not.toBe('bonusAvcisi');
  });

  it('bonus geçmişi bilinmiyorsa avcılık kararı verilmez', () => {
    // Veri gelmediginde herkesi "0 bonus" sayip avci ilan etmemeli.
    expect(davranisKarari(olcu({ bonusAdedi: null, toplamYatirim: 500 }))?.kimlik).not.toBe('bonusAvcisi');
  });

  it('eşiğin bir altındaki bonus adedi avcı yapmaz', () => {
    const altSinir = DAVRANIS_ESIKLERI.bonusAvcisiAdedi - 1;
    expect(davranisKarari(olcu({ bonusAdedi: altSinir, toplamYatirim: 500 }))?.kimlik).not.toBe('bonusAvcisi');
  });

  it('yüksek yatırımlı ve aktif oyuncu VIP', () => {
    const karar = davranisKarari(olcu({ toplamYatirim: 800_000, durgunGun: 3, bonusAdedi: 0 }));
    expect(karar?.kimlik).toBe('vip');
  });

  it('yüksek yatırımlı ama durgun oyuncu VIP değildir', () => {
    const karar = davranisKarari(olcu({ toplamYatirim: 800_000, durgunGun: 200, bonusAdedi: 0 }));
    expect(karar?.kimlik).not.toBe('vip');
  });

  it('son günlerde yatırım yapan Aktif Üye', () => {
    expect(davranisKarari(olcu({ durgunGun: 2 }))?.kimlik).toBe('aktif');
  });

  it('öncelik sırasına uyar — risk her şeyin önünde', () => {
    // Ayni oyuncu dort kurala da uyuyor; tek slot var, en acili kazanir.
    const hepsi = olcu({
      ayniIpHesapSayisi: 4, netKarZarar: -90_000,
      bonusAdedi: 9, toplamYatirim: 800_000, durgunGun: 1,
    });
    expect(davranisKarari(hepsi)?.kimlik).toBe('highRisk');
  });

  it('risk yoksa bonus avcılığı VIP\'in önüne geçer', () => {
    const karar = davranisKarari(olcu({ bonusAdedi: 9, toplamYatirim: 5_000, durgunGun: 1 }));
    expect(karar?.kimlik).toBe('bonusAvcisi');
  });
});

describe('otomatikDavranislar', () => {
  it('varsayılan yalnızca istisna etiketleri', () => {
    // "Aktif Üye" neredeyse herkese uyar; otomatik atansaydi deger
    // merdivenini tamamen silerdi.
    const varsayilan = otomatikDavranislar(undefined);
    expect([...varsayilan].sort()).toEqual(['bonusAvcisi', 'highRisk']);
  });

  it('liste ile değiştirilebilir', () => {
    expect([...otomatikDavranislar('highRisk,vip')].sort()).toEqual(['highRisk', 'vip']);
  });

  it('boş liste otomatik atamayı kapatır', () => {
    expect(otomatikDavranislar('').size).toBe(0);
  });

  it('bilinmeyen kimliği yok sayar', () => {
    expect([...otomatikDavranislar('highRisk,uydurma')]).toEqual(['highRisk']);
  });
});
