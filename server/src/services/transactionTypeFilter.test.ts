import { describe, expect, it } from 'vitest';
import { lynonTransactionTypeOptions } from './lynonBackofficeService.js';

/**
 * Tür filtresinin gidiş-dönüş sözleşmesi.
 *
 * Sunucu kanonik listeyi TransactionTypes olarak döner; istemci seçilen id'yi
 * DocumentTypeIds içinde geri gönderir; sunucu satırların TypeCode alanıyla
 * eşleştirir. Üçü aynı biçimde olmazsa filtre sessizce boş sonuç verir.
 *
 * Not: /islemler sayfası önceden eski numerik TRANSACTION_TYPES listesini
 * kullanıp TypeId gönderiyordu; sunucu TypeId'yi hiç okumadığı için tür
 * filtresi Lynon modunda tamamen etkisizdi.
 */
describe('işlem türü filtresi sözleşmesi', () => {
  const options = lynonTransactionTypeOptions();

  it('her seçeneğin id biçimi TypeCode üreticileriyle uyumlu', () => {
    for (const o of options) {
      expect(o.id, `geçersiz biçim: ${o.id}`).toMatch(/^(payment|financial)\.[A-Za-z]+$/);
      expect(o.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('ödeme kodları mapTransaction biçimiyle eşleşiyor', () => {
    // mapTransaction: `payment.${String(transactionType).toLowerCase()}`
    // Gerçek Lynon transactionType değerleri: 'deposit' | 'withdrawal'
    const ids = options.map((o) => o.id);
    for (const t of ['deposit', 'withdrawal']) {
      expect(ids).toContain(`payment.${t.toLowerCase()}`);
    }
  });

  it('finansal hareket kodları mapFinancialMovement biçimiyle eşleşiyor', () => {
    // mapFinancialMovement: `financial.${operationType}` (Lynon PascalCase döner)
    const ids = new Set(options.map((o) => o.id));
    // Backoffice operationType dropdown'undan doğrulanmış değerler
    for (const op of ['Bet', 'Win', 'Deposit', 'Withdrawal', 'BalanceCorrection', 'CashbackBonus', 'JackpotWin']) {
      expect(ids.has(`financial.${op}`), `eksik: financial.${op}`).toBe(true);
    }
  });

  it('id çakışması yok', () => {
    const ids = options.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
