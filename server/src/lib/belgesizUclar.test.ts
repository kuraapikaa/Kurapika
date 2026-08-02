import { beforeEach, describe, expect, it } from 'vitest';
import {
  gidenUcOzetleri,
  govdeYakalamaKapat,
  govdeYakalamaKur,
  kaydet,
  sablonla,
  temizle,
} from './apiTrafik.js';
import { belgelenmisMi, belgelenmisYollar } from './belgelenmisUclar.js';

/**
 * Belgesiz uc listesinin iki dogru olmasi gereken tarafi var:
 *   1. SABLONLAMA — yanlissa ya her oyuncu ayri uc gorunur (liste
 *      patlar) ya da farkli ucler birlesir (uc gizlenir).
 *   2. BELGELI/BELGESIZ AYRIMI — hata guvenli tarafta olmali:
 *      fazladan gostermek kabul, gizlemek degil.
 */

const kayit = (patch: Record<string, unknown> = {}) => ({
  yon: 'giden' as const,
  method: 'GET',
  url: 'https://backoffice.narcosbahis.com/api/x',
  durum: 200,
  sure: 10,
  istekBasliklari: {},
  yanitBasliklari: {},
  istekGovdesi: null,
  yanitGovdesi: null,
  hata: null,
  ...patch,
});

beforeEach(() => {
  temizle();
  govdeYakalamaKapat();
});

describe('şablonlama', () => {
  it('sayısal parçalar {id} olur', () => {
    expect(sablonla('/api/bonusenginev2/api/v1/CampaignAssignment/site/137/player/2496091'))
      .toBe('/api/bonusenginev2/api/v1/CampaignAssignment/site/{id}/player/{id}');
  });

  it('UUID parçalar {id} olur', () => {
    expect(sablonla('/api/x/3f2504e0-4f89-11d3-9a0c-0305e82c3301/y')).toBe('/api/x/{id}/y');
  });

  it('sürüm numaraları korunur — v1.0 sayısal değil', () => {
    expect(sablonla('/api/platform/api/v1.0/CorrectionHistory')).toBe('/api/platform/api/v1.0/CorrectionHistory');
  });

  it('içinde rakam geçen ad parçası korunur', () => {
    // Asiri sablonlama farkli uclari birlestirip gizlerdi.
    expect(sablonla('/api/bonusenginev2/api/v1/Block')).toBe('/api/bonusenginev2/api/v1/Block');
    expect(sablonla('/api/user123/profil')).toBe('/api/user123/profil');
  });

  it('köken korunur', () => {
    expect(sablonla('https://a.com/api/p/5')).toBe('https://a.com/api/p/{id}');
  });

  it('bozuk girdi çökmez', () => {
    expect(sablonla('')).toBe('');
    expect(sablonla(null as never)).toBe('');
  });
});

describe('giden uç özetleri', () => {
  it('farklı oyuncular TEK satırda gruplanır', () => {
    for (const id of [2496091, 2492369, 2490282]) {
      kaydet(kayit({ url: `https://b.com/api/v1/CampaignAssignment/site/137/player/${id}` }));
    }
    const ozetler = gidenUcOzetleri();
    expect(ozetler).toHaveLength(1);
    expect(ozetler[0].cagri).toBe(3);
    expect(ozetler[0].sablon).toContain('/player/{id}');
  });

  it('gelen trafik listeye girmez', () => {
    kaydet(kayit({ yon: 'gelen', url: '/api/admin/rules' }));
    expect(gidenUcOzetleri()).toHaveLength(0);
  });

  it('aynı yol farklı metotta ayrı satır', () => {
    kaydet(kayit({ method: 'GET', url: 'https://b.com/api/z' }));
    kaydet(kayit({ method: 'POST', url: 'https://b.com/api/z' }));
    expect(gidenUcOzetleri()).toHaveLength(2);
  });

  it('gövdesi OLAN kayıt son kayıt olarak tercih edilir', () => {
    // Belgelemek istedigimiz sey govde; en yeni kayit govdesizse
    // govdeli olan daha degerli.
    govdeYakalamaKur();
    const govdeli = kaydet(kayit({ url: 'https://b.com/api/w', yanitGovdesi: '{"a":1}' }));
    govdeYakalamaKapat();
    kaydet(kayit({ url: 'https://b.com/api/w' }));

    const ozet = gidenUcOzetleri()[0];
    expect(ozet.sonKayitId).toBe(govdeli.id);
    expect(ozet.govdeVar).toBe(true);
  });

  it('hiç gövde yoksa govdeVar false', () => {
    kaydet(kayit({ url: 'https://b.com/api/w' }));
    expect(gidenUcOzetleri()[0].govdeVar).toBe(false);
  });

  it('hata sayısı ve ortalama süre', () => {
    kaydet(kayit({ url: 'https://b.com/api/e', durum: 500, sure: 30 }));
    kaydet(kayit({ url: 'https://b.com/api/e', durum: 200, sure: 10 }));
    expect(gidenUcOzetleri()[0]).toMatchObject({ cagri: 2, hata: 1, ortalamaSure: 20 });
  });
});

describe('belgeli / belgesiz ayrımı', () => {
  it('dökümandaki uç belgeli sayılır', () => {
    expect(belgelenmisMi('/api/payment-operations/api/v1.0/BackOfficeTransactions')).toBe(true);
  });

  it('yer tutucu adı önemli değil — {siteId} ile {id} aynı', () => {
    expect(belgelenmisMi('/api/bonusenginev2/api/v1/CampaignAssignment/site/{id}/player/{id}')).toBe(true);
  });

  it('gerçek kimlikli URL de eşleşir', () => {
    expect(belgelenmisMi('/api/bonusenginev2/api/v1/CampaignAssignment/site/137/player/2496091')).toBe(true);
  });

  it('mutlak URL’de yol ayrıştırılır', () => {
    expect(belgelenmisMi('https://backoffice.narcosbahis.com/api/freespin/api/v1')).toBe(true);
  });

  it('sorgu dizesi eşleşmeyi bozmaz', () => {
    expect(belgelenmisMi('/api/platform/api/v1.0/CorrectionHistory/sites/137?page=1')).toBe(true);
  });

  it('dökümanda olmayan uç belgesiz', () => {
    expect(belgelenmisMi('/api/report/api/v1.0/dashboardData/sites/137/dashboard/TRY')).toBe(false);
    expect(belgelenmisMi('/api/platform/api/v1.0/BackofficeTransaction/financial-movement')).toBe(false);
  });

  it('boş girdi belgesiz sayılır — gizlemek yerine göster', () => {
    expect(belgelenmisMi('')).toBe(false);
    expect(belgelenmisMi(null as never)).toBe(false);
  });

  it('belgelenmiş yol listesi boş değil', () => {
    expect(belgelenmisYollar().length).toBeGreaterThan(10);
  });
});
