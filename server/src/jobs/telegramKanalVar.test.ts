import { describe, expect, it } from 'vitest';
import { gonderilecekKanalVarMi, tanimliKanallar } from './telegramKanalVar.js';

/**
 * Bildirilen vaka: "TELEGRAM_RAPOR_CHAT_ID ne alaka, zaten bot tokenini
 * verdim ve her grubun farkli chat id'si var."
 *
 * Operator bonus/yatirim/correction kanallarini DOGRU tanimlamisti ama
 * rapor botu hic kaydolmuyordu: kosul yalnizca `raporChatId`'ye bakiyordu.
 * O ise bir YEDEK — her akis kendi kanalina gidiyor.
 */
describe('gonderilecekKanalVarMi', () => {
  it('yedek yokken bile TEK bir kanal yeterli — bildirilen vaka', () => {
    expect(gonderilecekKanalVarMi({
      raporChatId: '',
      raporChatIdleri: { bonus: '-100123', yatirim: '-100456', correction: '-100789' },
    })).toBe(true);
  });

  it('yalnizca yedek tanimliysa da calisir', () => {
    expect(gonderilecekKanalVarMi({ raporChatId: '-100999', raporChatIdleri: {} })).toBe(true);
  });

  it('hicbiri yoksa calismaz — kasa raporunu yanlis yere gondermektense sessiz kal', () => {
    expect(gonderilecekKanalVarMi({ raporChatId: '', raporChatIdleri: {} })).toBe(false);
    expect(gonderilecekKanalVarMi(undefined)).toBe(false);
    expect(gonderilecekKanalVarMi(null)).toBe(false);
  });

  it('BOS DIZGE tanimsiz sayilir — Railway"de "var ama bos" sik gorulur', () => {
    expect(gonderilecekKanalVarMi({
      raporChatId: '   ',
      raporChatIdleri: { bonus: '', yatirim: '  ' },
    })).toBe(false);
  });

  it('bos ve dolu karisikken dolu olan kazanir', () => {
    expect(gonderilecekKanalVarMi({
      raporChatId: '',
      raporChatIdleri: { bonus: '', cekim: '-100111' },
    })).toBe(true);
  });
});

describe('tanimliKanallar', () => {
  it('yalnizca DOLU kanallari, sirali listeler', () => {
    expect(tanimliKanallar({
      raporChatId: '',
      raporChatIdleri: { yatirim: '-1', bonus: '-2', cekim: '' },
    })).toEqual(['bonus', 'yatirim']);
  });

  it('yedek varsa listeye girer', () => {
    expect(tanimliKanallar({ raporChatId: '-9', raporChatIdleri: { bonus: '-1' } }))
      .toEqual(['bonus', 'varsayilan']);
  });

  it('hicbiri yoksa bos liste', () => {
    expect(tanimliKanallar({ raporChatId: '', raporChatIdleri: {} })).toEqual([]);
  });
});
