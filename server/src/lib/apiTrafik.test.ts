import { beforeEach, describe, expect, it } from 'vitest';
import {
  basliklariTemizle,
  govdeYakalamaAcikMi,
  govdeYakalamaKapat,
  govdeYakalamaKur,
  govdeyiTemizle,
  kaydet,
  kaydiGetir,
  kayitlar,
  temizle,
  ucKatalogu,
  taramaPlani,
  ucKaydet,
  ucOzetleri,
  urlAyir,
  yakalamaDurumu,
  YAKALAMA_SURESI_MS,
} from './apiTrafik.js';

/**
 * Bu bir CANLI KUMAR PANELI. Trafik kaydi oyuncu kimligi, bakiye, odeme
 * bilgisi ve oturum cerezi gorebiliyor. Buradaki testlerin cogu
 * "calisiyor mu" degil "SIZDIRMIYOR mu" sorusunu soruyor.
 */

const temelKayit = {
  yon: 'giden' as const,
  method: 'POST',
  url: 'https://backoffice.narcosbahis.com/api/x',
  durum: 200,
  sure: 12,
  istekBasliklari: {},
  yanitBasliklari: {},
  istekGovdesi: '{"a":1}',
  yanitGovdesi: '{"b":2}',
  hata: null,
};

beforeEach(() => {
  temizle();
  govdeYakalamaKapat();
});

describe('başlık maskeleme', () => {
  it('oturum çerezi ve token maskelenir', () => {
    const b = basliklariTemizle({
      Cookie: 'sid=gizli-oturum',
      Authorization: 'Bearer aaa.bbb.ccc',
      authentication: 'bc-token-123',
      'X-Telegram-Bot-Api-Secret-Token': 'wh-secret',
      'Content-Type': 'application/json',
    });
    expect(b.cookie).toBe('***');
    expect(b.authorization).toBe('***');
    expect(b.authentication).toBe('***');
    expect(b['x-telegram-bot-api-secret-token']).toBe('***');
    expect(b['content-type']).toBe('application/json');
  });

  it('başlık adları küçük harfe indirgenir', () => {
    expect(basliklariTemizle({ 'X-Ray': 'v' })['x-ray']).toBe('v');
  });

  it('Headers nesnesi de okunur', () => {
    const h = new Headers({ cookie: 'sid=1', accept: 'application/json' });
    const b = basliklariTemizle(h);
    expect(b.cookie).toBe('***');
    expect(b.accept).toBe('application/json');
  });

  it('bozuk girdi çökmez', () => {
    expect(basliklariTemizle(null)).toEqual({});
    expect(basliklariTemizle('metin')).toEqual({});
  });
});

describe('gövde maskeleme', () => {
  it('parola ve token alanları maskelenir', () => {
    const c = govdeyiTemizle('{"username":"ayse","password":"1234","apiKey":"k"}');
    expect(c).toContain('"username": "ayse"');
    expect(c).toContain('"password": "***"');
    expect(c).toContain('"apiKey": "***"');
  });

  it('iç içe nesnelerde de maskeler', () => {
    const c = govdeyiTemizle({ data: { user: { sifre: 'x', ad: 'Ayşe' } } });
    expect(c).toContain('"sifre": "***"');
    expect(c).toContain('"ad": "Ayşe"');
  });

  it('dizi içindeki nesneleri maskeler', () => {
    const c = govdeyiTemizle([{ token: 'a' }, { token: 'b' }]);
    expect(c).not.toContain('"a"');
    expect(c).not.toContain('"b"');
  });

  it('JSON olmayan gövde olduğu gibi kalır', () => {
    expect(govdeyiTemizle('<html>hata</html>')).toBe('<html>hata</html>');
  });

  it('çok büyük gövde kırpılır', () => {
    const c = govdeyiTemizle('x'.repeat(100_000))!;
    expect(c.length).toBeLessThan(40_000);
    expect(c).toContain('kırpıldı');
  });

  it('boş ve null gövde null döner', () => {
    expect(govdeyiTemizle(null)).toBeNull();
    expect(govdeyiTemizle('')).toBeNull();
  });
});

describe('URL ayrıştırma', () => {
  it('yol ve sorgu ayrılır', () => {
    const { yol, sorgu } = urlAyir('https://a.com/api/x?page=1&countPerPage=30');
    expect(yol).toBe('https://a.com/api/x');
    expect(sorgu).toEqual({ page: '1', countPerPage: '30' });
  });

  it('sorgudaki token maskelenir', () => {
    // Kimlik bilgisi sorgu dizesine konmamali ama konursa kayda girmesin.
    expect(urlAyir('https://a.com/x?access_token=gizli').sorgu.access_token).toBe('***');
  });

  it('göreli yol çalışır', () => {
    expect(urlAyir('/api/admin/rules?x=1').yol).toBe('/api/admin/rules');
  });

  it('bozuk URL çökmez', () => {
    expect(() => urlAyir('::::')).not.toThrow();
    expect(urlAyir('::::').yol).toContain('::::');
  });

  it('Türkçe yol yüzde kodlu kalmaz', () => {
    // new URL(...).pathname ASCII disini kodluyor; kodlu hali okunmaz ve
    // Turkce arama hicbir zaman eslesmez.
    expect(urlAyir('/api/İşlemler').yol).toBe('/api/İşlemler');
  });
});

describe('gövde yakalama — varsayılan KAPALI', () => {
  it('kapalıyken gövdeler kaydedilmez', () => {
    const k = kaydet(temelKayit);
    expect(k.istekGovdesi).toBeNull();
    expect(k.yanitGovdesi).toBeNull();
    expect(k.govdelerAtlandi).toBe(true);
    // Metaveri yine de tutulur.
    expect(k.method).toBe('POST');
    expect(k.durum).toBe(200);
  });

  it('açıkken gövdeler kaydedilir', () => {
    govdeYakalamaKur();
    const k = kaydet(temelKayit);
    expect(k.istekGovdesi).toBe('{"a":1}');
    expect(k.govdelerAtlandi).toBe(false);
  });

  it('süresi dolunca kendiliğinden kapanır', () => {
    const t0 = Date.now();
    govdeYakalamaKur(1000, t0);
    expect(govdeYakalamaAcikMi(t0 + 500)).toBe(true);
    expect(govdeYakalamaAcikMi(t0 + 1500)).toBe(false);
  });

  it('azami süreden uzun istenemez', () => {
    const t0 = Date.now();
    const bitis = govdeYakalamaKur(999 * 60 * 60 * 1000, t0);
    expect(bitis - t0).toBeLessThanOrEqual(YAKALAMA_SURESI_MS);
  });

  it('elle kapatılabilir', () => {
    govdeYakalamaKur();
    govdeYakalamaKapat();
    expect(yakalamaDurumu().acik).toBe(false);
  });
});

describe('halka tampon', () => {
  it('en yeni kayıt başta döner', () => {
    kaydet({ ...temelKayit, url: '/bir' });
    kaydet({ ...temelKayit, url: '/iki' });
    expect(kayitlar()[0].url).toBe('/iki');
  });

  it('300 kaydı aşınca eskiler düşer', () => {
    for (let i = 0; i < 350; i += 1) kaydet({ ...temelKayit, url: `/u${i}` });
    const hepsi = kayitlar();
    expect(hepsi).toHaveLength(300);
    expect(hepsi.at(-1)!.url).toBe('/u50');
  });

  it('kimlikle tek kayıt getirilir', () => {
    const k = kaydet(temelKayit);
    expect(kaydiGetir(k.id)?.id).toBe(k.id);
    expect(kaydiGetir(999999)).toBeUndefined();
  });
});

describe('filtreleme', () => {
  beforeEach(() => {
    kaydet({ ...temelKayit, yon: 'gelen', url: '/api/admin/rules', durum: 200 });
    kaydet({ ...temelKayit, yon: 'giden', url: 'https://x/api/bonus', durum: 500 });
    kaydet({ ...temelKayit, yon: 'giden', url: 'https://x/api/player', durum: 200, hata: 'timeout' });
  });

  it('yöne göre', () => {
    expect(kayitlar({ yon: 'gelen' })).toHaveLength(1);
    expect(kayitlar({ yon: 'giden' })).toHaveLength(2);
  });

  it('yalnızca hatalı: 4xx/5xx ve ağ hatası', () => {
    expect(kayitlar({ yalnizHatali: true })).toHaveLength(2);
  });

  it('metin araması', () => {
    expect(kayitlar({ arama: 'bonus' })).toHaveLength(1);
  });

  it('arama Türkçe büyük/küçük harf duyarsız', () => {
    kaydet({ ...temelKayit, url: '/api/İşlemler' });
    expect(kayitlar({ arama: 'işlemler' })).toHaveLength(1);
  });
});

describe('uç özetleri', () => {
  it('aynı uç gruplanır, ortalama süre hesaplanır', () => {
    kaydet({ ...temelKayit, url: 'https://x/api/a', sure: 10 });
    kaydet({ ...temelKayit, url: 'https://x/api/a', sure: 30 });
    kaydet({ ...temelKayit, url: 'https://x/api/b', sure: 5 });

    const ozetler = ucOzetleri();
    const a = ozetler.find((o) => o.url === 'https://x/api/a')!;
    expect(a.cagri).toBe(2);
    expect(a.ortalamaSure).toBe(20);
    expect(ozetler[0].cagri).toBe(2); // en cok cagrilan basta
  });

  it('sorgu dizesi ayrıldığı için aynı uç tek satır olur', () => {
    kaydet({ ...temelKayit, url: 'https://x/api/a?page=1' });
    kaydet({ ...temelKayit, url: 'https://x/api/a?page=2' });
    expect(ucOzetleri().filter((o) => o.url === 'https://x/api/a')).toHaveLength(1);
  });

  it('hata sayısı ayrı tutulur', () => {
    kaydet({ ...temelKayit, url: 'https://x/api/c', durum: 500 });
    kaydet({ ...temelKayit, url: 'https://x/api/c', durum: 200 });
    const c = ucOzetleri().find((o) => o.url === 'https://x/api/c')!;
    expect(c).toMatchObject({ cagri: 2, hata: 1 });
  });
});

describe('uç kataloğu', () => {
  it('çağrılmamış uçlar da listelenir', () => {
    ucKaydet('GET', '/api/hic-cagrilmadi');
    expect(ucKatalogu().some((u) => u.url === '/api/hic-cagrilmadi')).toBe(true);
  });

  it('çok metotlu rota her metot için ayrı satır', () => {
    ucKaydet(['GET', 'POST'], '/api/coklu');
    const satirlar = ucKatalogu().filter((u) => u.url === '/api/coklu');
    expect(satirlar.map((s) => s.method).sort()).toEqual(['GET', 'POST']);
  });

  it('aynı rota iki kez eklenmez', () => {
    ucKaydet('GET', '/api/tekrar');
    ucKaydet('get', '/api/tekrar');
    expect(ucKatalogu().filter((u) => u.url === '/api/tekrar')).toHaveLength(1);
  });
});

describe('tarama planı — para güvenliği', () => {
  /**
   * Bu panelde POST/PUT/DELETE uclari bonus veriyor, bakiye duzeltiyor
   * ve cekim sonuclandiriyor. Tarama onlari cagirirsa GERCEK PARA
   * HAREKETI olur. Bu testler o kapinin kapali kaldigini dogruluyor.
   */
  it('mutasyon metotları taranabilir DEĞİL', () => {
    ucKaydet('POST', '/api/admin/bonus/charge');
    ucKaydet('DELETE', '/api/admin/kayit');
    ucKaydet('PUT', '/api/admin/guncelle');

    const plan = taramaPlani();
    for (const yol of ['/api/admin/bonus/charge', '/api/admin/kayit', '/api/admin/guncelle']) {
      const satir = plan.find((s) => s.url === yol)!;
      expect(satir.taranabilir).toBe(false);
      expect((satir as any).neden).toContain('Veri değiştirebilir');
    }
  });

  it('GET uçları taranabilir', () => {
    ucKaydet('GET', '/api/admin/rules');
    expect(taramaPlani().find((s) => s.url === '/api/admin/rules')?.taranabilir).toBe(true);
  });

  it('yol parametreli uç değer olmadan taranmaz', () => {
    ucKaydet('GET', '/api/player/:id');
    const satir = taramaPlani().find((s) => s.url === '/api/player/:id')!;
    expect(satir.taranabilir).toBe(false);
    expect((satir as any).neden).toContain('parametre');
  });

  it('joker yollu uç taranmaz', () => {
    ucKaydet('GET', '/api/dosya/*');
    expect(taramaPlani().find((s) => s.url === '/api/dosya/*')?.taranabilir).toBe(false);
  });

  it('trafik ekranının kendi uçları taranmaz — kendini besleyen döngü olurdu', () => {
    ucKaydet('GET', '/api/admin/api-trafik');
    ucKaydet('GET', '/api/admin/api-trafik/katalog');
    const plan = taramaPlani();
    expect(plan.find((s) => s.url === '/api/admin/api-trafik')?.taranabilir).toBe(false);
    expect(plan.find((s) => s.url === '/api/admin/api-trafik/katalog')?.taranabilir).toBe(false);
  });

  it('atlananlar listeden düşürülmez — neden görünür kalmalı', () => {
    ucKaydet('POST', '/api/atlanan-uc');
    expect(taramaPlani().some((s) => s.url === '/api/atlanan-uc')).toBe(true);
  });
});
