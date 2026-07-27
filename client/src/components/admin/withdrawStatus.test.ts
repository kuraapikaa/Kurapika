import { describe, expect, it } from 'vitest';
import { classifyWithdrawStatus } from './AutoWithdrawPanel';

/** Eski desen: /reddedildi|red|reject|cancel|iptal/i uygulanan düz .toLowerCase() üstünde */
function eskiSiniflandirma(s: string) {
  const v = String(s ?? '').toLowerCase();
  if (/ödendi|paid/i.test(v)) return 'paid';
  if (/reddedildi|red|reject|cancel|iptal/i.test(v)) return 'rejected';
  if (/izin verildi|bekliyor|onay|pending|allow/i.test(v)) return 'pending';
  return 'other';
}

describe('çekim durumu sınıflandırması', () => {
  it('Türkçe İ ile başlayan iptal durumlarını reddedilmiş sayar', () => {
    // Asıl hata: "İptal".toLowerCase() -> "i̇ptal" (U+0069 U+0307), /iptal/ eşleşmez
    expect(eskiSiniflandirma('İptal')).toBe('other');        // hatalı eski davranış
    expect(classifyWithdrawStatus('İptal')).toBe('rejected'); // düzeltilmiş
    expect(classifyWithdrawStatus('İptal Edildi')).toBe('rejected');
  });

  it('Lynon normalizeStatusName çıktılarını doğru sınıflandırır', () => {
    expect(classifyWithdrawStatus('Ödendi')).toBe('paid');
    expect(classifyWithdrawStatus('Reddedildi')).toBe('rejected');
    expect(classifyWithdrawStatus('Başarısız')).toBe('rejected');
    expect(classifyWithdrawStatus('Bekliyor')).toBe('pending');
    expect(classifyWithdrawStatus('Sağlayıcı Onayı Bekliyor')).toBe('pending');
    expect(classifyWithdrawStatus('Yeni')).toBe('pending');
    expect(classifyWithdrawStatus('Oluşturuldu')).toBe('pending');
  });

  it('çıplak "red" alt-dizi eşleşmesi artık yanlış pozitif üretmiyor', () => {
    expect(eskiSiniflandirma('Credited')).toBe('rejected');       // hatalı eski davranış
    expect(classifyWithdrawStatus('Credited')).not.toBe('rejected');
    expect(eskiSiniflandirma('Transferred')).toBe('rejected');    // hatalı eski davranış
    expect(classifyWithdrawStatus('Transferred')).not.toBe('rejected');
  });

  it('boş/bilinmeyen değerlerde other döner', () => {
    expect(classifyWithdrawStatus('')).toBe('other');
    expect(classifyWithdrawStatus(null)).toBe('other');
    expect(classifyWithdrawStatus(undefined)).toBe('other');
  });
});
