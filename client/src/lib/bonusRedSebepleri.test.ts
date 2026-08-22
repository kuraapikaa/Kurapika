import { describe, expect, it } from 'vitest';
import { GENEL_RED_METNI, redOzeti, redSebepleri } from './bonusRedSebepleri';

const yanit = (items: unknown[]) => ({ HasError: true, Data: { specificBonusCheck: { overallOk: false, items } } });

describe('redSebepleri', () => {
  it('yalnizca BASARISIZ maddeleri aliyor', () => {
    // Gecen kontrolleri de gostermek listeyi okunmaz yapar, oyuncu asil
    // engeli kacirirdi.
    const s = redSebepleri(yanit([
      { id: 'min-deposit', ok: true },
      { id: 'check-same-day-usage', ok: false, reason: 'RED: Bu bonus bugün zaten alındı' },
    ]));
    expect(s.map((x) => x.id)).toEqual(['check-same-day-usage']);
  });

  it('teknik gerekceyi oyuncu metnine ceviriyor', () => {
    const s = redSebepleri(yanit([{ id: 'check-no-withdrawal-today', ok: false, reason: 'RED: Bugün 2 çekim işleminiz var.' }]));
    expect(s[0].title).toBe('Bugün çekim yapıldı');
    expect(s[0].message).toMatch(/Yarın tekrar/);
  });

  it('gerekceye gore ayrisan kapilarda dogru metni seciyor', () => {
    const ilk = redSebepleri(yanit([{ id: 'first-deposit-loss-only', ok: false, reason: 'RED: Bu kampanya yalnızca ilk yatırım için geçerli (yatırım adedi: 3).' }]));
    expect(ilk[0].title).toBe('İlk yatırım kampanyası');

    const kayip = redSebepleri(yanit([{ id: 'first-deposit-loss-only', ok: false, reason: 'RED: İlk yatırım kayıpla sonuçlanmamış.' }]));
    expect(kayip[0].title).toBe('Kayıp koşulu');
  });

  it('ayni sebebi tekrar yazmiyor', () => {
    const s = redSebepleri(yanit([
      { id: 'per-day-limit', ok: false },
      { id: 'per-day-limit', ok: false },
    ]));
    expect(s).toHaveLength(1);
  });

  it('cok uzun listeyi kirpiyor', () => {
    const s = redSebepleri(yanit([
      { id: 'a', ok: false }, { id: 'b', ok: false }, { id: 'c', ok: false }, { id: 'd', ok: false },
    ]));
    expect(s).toHaveLength(3);
  });

  it('kimliksiz maddeyi atliyor', () => {
    expect(redSebepleri(yanit([{ ok: false, reason: 'RED' }]))).toEqual([]);
  });

  it('beklenmeyen yanit sekillerinde patlamiyor', () => {
    expect(redSebepleri(null)).toEqual([]);
    expect(redSebepleri({})).toEqual([]);
    expect(redSebepleri({ Data: {} })).toEqual([]);
    expect(redSebepleri({ Data: { specificBonusCheck: { items: 'dizi degil' } } })).toEqual([]);
  });

  it('sarmalayicisiz kontrol listesini de okuyor', () => {
    const s = redSebepleri({ specificBonusCheck: { items: [{ id: 'no-open-bets', ok: false }] } });
    expect(s[0].id).toBe('no-open-bets');
  });
});

describe('redOzeti', () => {
  it('tek sebepte dogrudan o sebebi gosteriyor', () => {
    const o = redOzeti(yanit([{ id: 'no-open-bets', ok: false }]));
    expect(o.baslik).toBe('Açık bahisler');
    expect(o.sebepler).toHaveLength(1);
  });

  it('coklu sebepte listeye yonlendiriyor', () => {
    const o = redOzeti(yanit([{ id: 'no-open-bets', ok: false }, { id: 'per-day-limit', ok: false }]));
    expect(o.metin).toMatch(/aşağıdaki koşullar/);
    expect(o.sebepler).toHaveLength(2);
  });

  it('sebep cikarilamazsa GENEL metne dusuyor', () => {
    // Sunucu bazen gercekten teknik bir hata donduruyor; o durumda
    // "kosulu tamamlayin" demek yanlis yonlendirme olurdu.
    const o = redOzeti({ HasError: true, AlertMessage: 'Ağ hatası' });
    expect(o.metin).toBe(GENEL_RED_METNI);
    expect(o.sebepler).toEqual([]);
  });
});
