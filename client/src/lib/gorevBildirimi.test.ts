import { beforeEach, describe, expect, it } from 'vitest';
import { yeniTamamlananlar } from './gorevBildirimi';

const GUN = '2026-07-30';

function gorev(id: string, completed: boolean, claimed = false) {
  return { id, title: `Görev ${id}`, completed, claimed, rewardLabel: '50 TL' };
}

beforeEach(() => localStorage.clear());

describe('görev bildirimi', () => {
  it('tamamlanan görevi bir kez duyurur', () => {
    const ilk = yeniTamamlananlar(GUN, [gorev('a', true)]);
    expect(ilk.map((g) => g.id)).toEqual(['a']);

    // Lobiye tekrar girildiğinde aynı bildirim çıkmamalı.
    expect(yeniTamamlananlar(GUN, [gorev('a', true)])).toEqual([]);
  });

  it('tamamlanmamış görev duyurulmaz', () => {
    expect(yeniTamamlananlar(GUN, [gorev('a', false)])).toEqual([]);
  });

  it('ödülü alınmış görev duyurulmaz — oyuncu zaten işlemi yapmış', () => {
    expect(yeniTamamlananlar(GUN, [gorev('a', true, true)])).toEqual([]);
  });

  it('sonradan tamamlanan ikinci görev ayrıca duyurulur', () => {
    yeniTamamlananlar(GUN, [gorev('a', true), gorev('b', false)]);
    const ikinci = yeniTamamlananlar(GUN, [gorev('a', true), gorev('b', true)]);
    expect(ikinci.map((g) => g.id)).toEqual(['b']);
  });

  it('ertesi gün aynı görev yeniden duyurulur', () => {
    yeniTamamlananlar(GUN, [gorev('a', true)]);
    expect(yeniTamamlananlar('2026-07-31', [gorev('a', true)]).map((g) => g.id)).toEqual(['a']);
  });

  it('gün değişince eski kayıt temizlenir — depo birikmez', () => {
    yeniTamamlananlar(GUN, [gorev('a', true)]);
    yeniTamamlananlar('2026-07-31', [gorev('a', true)]);
    const anahtarlar = Object.keys(localStorage).filter((k) => k.startsWith('narcos-gorev-bildirim:'));
    expect(anahtarlar).toEqual(['narcos-gorev-bildirim:2026-07-31']);
  });

  it('ödül etiketi taşınır', () => {
    expect(yeniTamamlananlar(GUN, [gorev('a', true)])[0].rewardLabel).toBe('50 TL');
  });

  it('bozuk girdi çökmez', () => {
    expect(yeniTamamlananlar(GUN, [{ completed: true } as any])).toEqual([]);
    expect(yeniTamamlananlar('', [gorev('a', true)])).toEqual([]);
    expect(yeniTamamlananlar(GUN, undefined as any)).toEqual([]);
  });
});
