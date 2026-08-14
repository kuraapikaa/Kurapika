import { describe, expect, it } from 'vitest';
import {
  ARALIK_UST_SINIRI,
  araligiGenislet,
  cerceveAtasiDirektifi,
  cerceveAtasiUyuyorMu,
  gomulebilirMi,
  listeyiAyristir,
  refererOrigini,
  sabitListeyiCoz,
} from './lib/cerceveAtaslari.js';

// NOT: bu dosya eskiden app.ts'teki ayristirma mantiginin KOPYASINI test
// ediyordu; kopya ile gercek kod ayrisirsa test yesil kalirken uretim
// bozulurdu. Artik gercek modul import ediliyor.

describe('FRAME_ANCESTORS ayrıştırma', () => {
  it('tanımsızsa boş liste — güvenli varsayılan', () => {
    expect(listeyiAyristir(undefined)).toEqual([]);
    expect(gomulebilirMi([], [])).toBe(false);
  });

  it('boş dizede de gömülemez', () => {
    expect(listeyiAyristir('   ')).toEqual([]);
  });

  it('boşluk ve virgülle ayrılmış listeyi okur', () => {
    expect(listeyiAyristir('https://a.com, https://b.com')).toEqual(['https://a.com', 'https://b.com']);
    expect(listeyiAyristir('  https://a.com \n https://b.com  ')).toEqual(['https://a.com', 'https://b.com']);
  });

  it('self her zaman ilk sırada', () => {
    expect(cerceveAtasiDirektifi({ sabitler: ['https://a.com'], kaliplar: [] })[0]).toBe("'self'");
  });
});

describe('dönen alan adı kalıpları', () => {
  const kaliplar = ['https://narcosbahis*.com', 'https://*.narcosbahis.vip'];

  it('etiket içi joker dönen numarayı yakalar', () => {
    expect(cerceveAtasiUyuyorMu('https://narcosbahis485.com', kaliplar)).toBe(true);
    expect(cerceveAtasiUyuyorMu('https://narcosbahis484.com', kaliplar)).toBe(true);
    expect(cerceveAtasiUyuyorMu('https://narcosbahis.com', kaliplar)).toBe(true);
  });

  it('joker NOKTA ile eşleşmez — alt alan adıyla kaçırılamaz', () => {
    expect(cerceveAtasiUyuyorMu('https://evil.narcosbahis485.com', kaliplar)).toBe(false);
  });

  it('sona ek alan adı ekleyerek kandırılamaz', () => {
    expect(cerceveAtasiUyuyorMu('https://narcosbahis485.com.evil.com', kaliplar)).toBe(false);
  });

  it('başa ek koyarak kandırılamaz', () => {
    expect(cerceveAtasiUyuyorMu('https://evilnarcosbahis485.com', kaliplar)).toBe(false);
  });

  it('şema birebir eşleşmeli', () => {
    expect(cerceveAtasiUyuyorMu('http://narcosbahis485.com', kaliplar)).toBe(false);
  });

  it('alt alan adı jokeri çalışır', () => {
    expect(cerceveAtasiUyuyorMu('https://panel.narcosbahis.vip', kaliplar)).toBe(true);
    expect(cerceveAtasiUyuyorMu('https://a.b.narcosbahis.vip', kaliplar)).toBe(true);
  });

  it('alt alan adı jokeri kök alanı KAPSAMAZ', () => {
    expect(cerceveAtasiUyuyorMu('https://narcosbahis.vip', kaliplar)).toBe(false);
  });

  it('yol/sorgu taşıyan değer origin değildir', () => {
    expect(cerceveAtasiUyuyorMu('https://narcosbahis485.com/panel', kaliplar)).toBe(false);
  });

  it('fazla geniş kalıplar reddedilir', () => {
    expect(cerceveAtasiUyuyorMu('https://her-yer.com', ['*'])).toBe(false);
    expect(cerceveAtasiUyuyorMu('https://her-yer.com', ['https://*'])).toBe(false);
    expect(cerceveAtasiUyuyorMu('https://her-yer.com', ['*.com'])).toBe(false);
  });
});

describe('sayısal aralık — CDN önbelleğine karşı', () => {
  it('şablonu somut adreslere açar', () => {
    expect(araligiGenislet('https://narcosbahis{484-487}.com')).toEqual([
      'https://narcosbahis484.com',
      'https://narcosbahis485.com',
      'https://narcosbahis486.com',
      'https://narcosbahis487.com',
    ]);
  });

  it('tek elemanlı aralık', () => {
    expect(araligiGenislet('https://a{5-5}.com')).toEqual(['https://a5.com']);
  });

  it('ters aralık yok sayılır', () => {
    expect(araligiGenislet('https://a{9-2}.com')).toEqual([]);
  });

  it('şablon değilse boş', () => {
    expect(araligiGenislet('https://duz.com')).toEqual([]);
    expect(araligiGenislet('sema-yok{1-2}.com')).toEqual([]);
  });

  it('devasa aralık reddedilir — başlık şişmesin', () => {
    expect(araligiGenislet(`https://a{1-${ARALIK_UST_SINIRI + 1}}.com`)).toEqual([]);
    expect(araligiGenislet(`https://a{1-${ARALIK_UST_SINIRI}}.com`)).toHaveLength(ARALIK_UST_SINIRI);
  });

  it('sabit liste ile aralık birleşir ve yinelenmez', () => {
    const liste = sabitListeyiCoz({
      adresler: 'https://narcosbahis485.com https://ortak.com',
      araliklar: 'https://narcosbahis{484-486}.com',
    });
    expect(liste).toEqual([
      'https://narcosbahis485.com',
      'https://ortak.com',
      'https://narcosbahis484.com',
      'https://narcosbahis486.com',
    ]);
  });

  it('aralık listesi her çağrıda AYNI — önbelleklenmesi güvenli', () => {
    const a = sabitListeyiCoz({ araliklar: 'https://n{1-3}.com' });
    const b = sabitListeyiCoz({ araliklar: 'https://n{1-3}.com' });
    expect(a).toEqual(b);
  });

  it('aralık tanımlıysa panel gömülebilir sayılır', () => {
    const liste = sabitListeyiCoz({ araliklar: 'https://n{1-3}.com' });
    expect(gomulebilirMi(liste, [])).toBe(true);
  });
});

describe('Referer okuma', () => {
  it('tam URL den origin çıkarır', () => {
    expect(refererOrigini('https://narcosbahis485.com/lobi?x=1')).toBe('https://narcosbahis485.com');
  });

  it('başlık yoksa null', () => {
    expect(refererOrigini(undefined)).toBeNull();
    expect(refererOrigini('')).toBeNull();
  });

  it('bozuk değer null', () => {
    expect(refererOrigini('kirik')).toBeNull();
  });

  it('http(s) disi şema reddedilir', () => {
    expect(refererOrigini('javascript:alert(1)')).toBeNull();
  });
});

describe('istek bazlı direktif üretimi', () => {
  const kaliplar = ['https://narcosbahis*.com'];

  it('kalıba uyan gömen origin eklenir', () => {
    const d = cerceveAtasiDirektifi({ sabitler: [], kaliplar, referer: 'https://narcosbahis485.com/' });
    expect(d).toEqual(["'self'", 'https://narcosbahis485.com']);
  });

  it('domain dönünce yeni adres kendiliğinden kabul edilir', () => {
    const d = cerceveAtasiDirektifi({ sabitler: [], kaliplar, referer: 'https://narcosbahis999.com/' });
    expect(d).toContain('https://narcosbahis999.com');
  });

  it('uymayan gömen eklenmez — kapalı tarafa düşer', () => {
    const d = cerceveAtasiDirektifi({ sabitler: [], kaliplar, referer: 'https://evil.com/' });
    expect(d).toEqual(["'self'"]);
  });

  it('Referer yoksa yalnızca self ve sabit liste', () => {
    const d = cerceveAtasiDirektifi({ sabitler: ['https://sabit.com'], kaliplar });
    expect(d).toEqual(["'self'", 'https://sabit.com']);
  });

  it('sabit listede zaten varsa yinelenmez', () => {
    const d = cerceveAtasiDirektifi({
      sabitler: ['https://narcosbahis485.com'],
      kaliplar,
      referer: 'https://narcosbahis485.com/',
    });
    expect(d).toEqual(["'self'", 'https://narcosbahis485.com']);
  });
});
