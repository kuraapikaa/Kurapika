import { describe, expect, it } from 'vitest';
import { temasOzeti, TEMAS_TURLERI, TEMAS_SONUCLARI, type CrmTemas } from './crmService.js';

/**
 * Ozet CRM ekraninin ust seridini besliyor: gunluk temas hacmi ve ulasma
 * orani buradan okunuyor. Yanlis sayim ekibin performansini yanlis gosterir.
 */

const SIMDI = Date.parse('2026-07-30T15:00:00.000Z');

function temas(over: Partial<CrmTemas> = {}): CrmTemas {
  return {
    id: Math.random().toString(36).slice(2),
    login: 'oyuncu1',
    tur: 'arama',
    sonuc: 'bilinmiyor',
    not: '',
    yapan: 'temsilci',
    createdAt: new Date(SIMDI - 3600_000).toISOString(),
    ...over,
  };
}

describe('CRM temas özeti', () => {
  it('boş listede sıfırlar', () => {
    const o = temasOzeti([], SIMDI);
    expect(o).toMatchObject({ toplam: 0, bugun: 0, ulasilan: 0, ulasilamayan: 0 });
  });

  it('bugünkü temaslar ayrı sayılır', () => {
    const o = temasOzeti([
      temas(),                                                              // bugün
      temas({ createdAt: new Date(SIMDI - 3 * 86_400_000).toISOString() }), // 3 gün önce
    ], SIMDI);
    expect(o.toplam).toBe(2);
    expect(o.bugun).toBe(1);
  });

  it('geri dönen müşteri de ulaşılan sayılır', () => {
    const o = temasOzeti([
      temas({ sonuc: 'ulasildi' }),
      temas({ sonuc: 'geri-dondu' }),
      temas({ sonuc: 'ulasilamadi' }),
      temas({ sonuc: 'bilinmiyor' }),
    ], SIMDI);
    expect(o.ulasilan).toBe(2);
    expect(o.ulasilamayan).toBe(1);
  });

  it('tür dağılımı sayılır', () => {
    const o = temasOzeti([temas({ tur: 'arama' }), temas({ tur: 'arama' }), temas({ tur: 'sms' })], SIMDI);
    expect(o.turDagilimi).toEqual({ arama: 2, sms: 1 });
  });

  it('bozuk tarih bugün sayılmaz ama toplamı düşürmez', () => {
    const o = temasOzeti([temas({ createdAt: 'abc' })], SIMDI);
    expect(o.toplam).toBe(1);
    expect(o.bugun).toBe(0);
  });
});

describe('CRM sabitleri', () => {
  it('tür ve sonuç listeleri sabit — rapor kırılımı bunlara dayanıyor', () => {
    expect(TEMAS_TURLERI).toEqual(['arama', 'sms', 'not', 'bonus', 'kampanya']);
    expect(TEMAS_SONUCLARI).toEqual(['bilinmiyor', 'ulasildi', 'ulasilamadi', 'geri-dondu', 'ilgilenmiyor']);
  });
});
