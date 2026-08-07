import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Kopru para hareketi tasiyor, dolayisiyla test edilen sey "cagri calisiyor mu"
 * degil: yetkisiz cagrinin Lynon'a HIC ulasmadigi, ve tutarin dogru birime
 * cevrildigi. Bir birim hatasi 20 TL yerine 2000 TL yukler.
 */

const lynonOyuncuKpiSorgula = vi.fn();
const lynonCreditPlayerMainAccount = vi.fn();
const lynonBonusDefinitions = vi.fn();
const lynonPaymentTransactions = vi.fn();
const lynonPlayerDetail = vi.fn();

vi.mock('../services/lynonBackofficeService.js', () => ({
  lynonOyuncuKpiSorgula: (...a: unknown[]) => lynonOyuncuKpiSorgula(...a),
  lynonCreditPlayerMainAccount: (...a: unknown[]) => lynonCreditPlayerMainAccount(...a),
  lynonBonusDefinitions: (...a: unknown[]) => lynonBonusDefinitions(...a),
  lynonPaymentTransactions: (...a: unknown[]) => lynonPaymentTransactions(...a),
  lynonPlayerDetail: (...a: unknown[]) => lynonPlayerDetail(...a),
  lynonErrorResponse: () => ({ status: 502, body: { error: 'lynon' } }),
}));

vi.mock('../lib/auditLog.js', () => ({ audit: vi.fn() }));

const ANAHTAR = 'test-crm-anahtari';

async function sunucu() {
  const { crmKopruRoutes } = await import('./crmKopru.js');
  const app = Fastify();
  await app.register(crmKopruRoutes, { prefix: '/api' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRM_BRIDGE_KEY = ANAHTAR;
});

afterEach(() => {
  delete process.env.CRM_BRIDGE_KEY;
});

describe('crm koprusu — yetki', () => {
  it('anahtarsiz cagriyi reddeder ve Lynon a hic gitmez', async () => {
    const app = await sunucu();
    const res = await app.inject({
      method: 'GET',
      url: '/api/crm/players/lookup?q=905551112233',
      headers: { 'x-tenant': 'narcos' },
    });
    expect(res.statusCode).toBe(401);
    expect(lynonOyuncuKpiSorgula).not.toHaveBeenCalled();
  });

  it('yanlis anahtari reddeder', async () => {
    const app = await sunucu();
    const res = await app.inject({
      method: 'GET',
      url: '/api/crm/players/lookup?q=x',
      headers: { 'x-crm-key': 'yanlis', 'x-tenant': 'narcos' },
    });
    expect(res.statusCode).toBe(401);
    expect(lynonOyuncuKpiSorgula).not.toHaveBeenCalled();
  });

  /** Kiraci olmadan Lynon oturumu yanlis siteye gidebilir. */
  it('X-Tenant yoksa reddeder', async () => {
    const app = await sunucu();
    const res = await app.inject({
      method: 'GET',
      url: '/api/crm/players/lookup?q=x',
      headers: { 'x-crm-key': ANAHTAR },
    });
    expect(res.statusCode).toBe(400);
    expect(lynonOyuncuKpiSorgula).not.toHaveBeenCalled();
  });
});

describe('crm koprusu — telefonla arama', () => {
  it('bulunamayan numarada hata degil bos sonuc doner', async () => {
    lynonOyuncuKpiSorgula.mockResolvedValue({ durum: 'bulunamadi' });
    const app = await sunucu();
    const res = await app.inject({
      method: 'GET',
      url: '/api/crm/players/lookup?q=905550000000',
      headers: { 'x-crm-key': ANAHTAR, 'x-tenant': 'narcos' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ account: null });
  });

  /** Yanlis oyuncuya bonus yuklemek geri alinmasi zor. */
  it('coklu eslesmede secim yapmaz, 409 doner', async () => {
    lynonOyuncuKpiSorgula.mockResolvedValue({
      durum: 'coklu',
      adaylar: [{ id: '1', login: 'a', telefon: null }],
    });
    const app = await sunucu();
    const res = await app.inject({
      method: 'GET',
      url: '/api/crm/players/lookup?q=555',
      headers: { 'x-crm-key': ANAHTAR, 'x-tenant': 'narcos' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().candidates).toHaveLength(1);
  });

  it('tutarlari kurusa cevirir', async () => {
    lynonOyuncuKpiSorgula.mockResolvedValue({
      durum: 'bulundu',
      ozet: {
        id: '42', login: 'oyuncu', telefon: '905551112233', eposta: null,
        kayitTarihi: '2026-01-01', telefonDogrulandi: true, epostaDogrulandi: null,
        kimlikDogrulandi: false, kategori: 'VIP', paraBirimi: 'TRY',
        gercekBakiye: 1234.56, bonusBakiye: 10, toplamBakiye: 1244.56,
        toplamYatirim: 5000, toplamCekim: 2500.5,
      },
    });
    const app = await sunucu();
    const res = await app.inject({
      method: 'GET',
      url: '/api/crm/players/lookup?q=905551112233',
      headers: { 'x-crm-key': ANAHTAR, 'x-tenant': 'narcos' },
    });

    const body = res.json();
    expect(body.account.userId).toBe('42');
    expect(body.kpi.balanceCents).toBe(124456);
    const bul = (k: string) => body.kpi.metrics.find((m: { key: string }) => m.key === k).value;
    expect(bul('totalDeposit')).toBe(500000);
    expect(bul('totalWithdraw')).toBe(250050);
  });
});

describe('crm koprusu — bonus yukleme', () => {
  const govde = {
    amountCents: 200000,
    idempotencyKey: 'grant_1',
    grantedBy: 'deniz@casino.local',
  };
  const basliklar = { 'x-crm-key': ANAHTAR, 'x-tenant': 'narcos' };

  /** Kurus -> ana birim. Bu carpani ters cevirmek 100 kat fazla yukler. */
  it('kurusu Lynon un bekledigi ana birime cevirir', async () => {
    lynonCreditPlayerMainAccount.mockResolvedValue({ Data: 'ref-1' });
    const app = await sunucu();
    const res = await app.inject({
      method: 'POST', url: '/api/crm/players/42/bonus', headers: basliklar, payload: govde,
    });
    expect(res.statusCode).toBe(200);
    expect(lynonCreditPlayerMainAccount).toHaveBeenCalledWith(
      expect.objectContaining({ playerId: '42', amount: 2000 }),
    );
  });

  it('negatif ve ondalikli tutari reddeder', async () => {
    const app = await sunucu();
    for (const amountCents of [-1, 0, 10.5]) {
      const res = await app.inject({
        method: 'POST', url: '/api/crm/players/42/bonus', headers: basliklar,
        payload: { ...govde, amountCents },
      });
      expect(res.statusCode).toBe(400);
    }
    expect(lynonCreditPlayerMainAccount).not.toHaveBeenCalled();
  });

  it('idempotencyKey zorunlu', async () => {
    const app = await sunucu();
    const res = await app.inject({
      method: 'POST', url: '/api/crm/players/42/bonus', headers: basliklar,
      payload: { amountCents: 1000 },
    });
    expect(res.statusCode).toBe(400);
    expect(lynonCreditPlayerMainAccount).not.toHaveBeenCalled();
  });

  /** Zaman asimi sonrasi tekrar deneme cift yukleme yapmamali. */
  it('ayni idempotencyKey ile ikinci istek Lynon a gitmez', async () => {
    lynonCreditPlayerMainAccount.mockResolvedValue({ Data: 'ref-1' });
    const app = await sunucu();

    const ilk = await app.inject({
      method: 'POST', url: '/api/crm/players/42/bonus', headers: basliklar, payload: govde,
    });
    const ikinci = await app.inject({
      method: 'POST', url: '/api/crm/players/42/bonus', headers: basliklar, payload: govde,
    });

    expect(ilk.json().reference).toBe(ikinci.json().reference);
    expect(lynonCreditPlayerMainAccount).toHaveBeenCalledTimes(1);
  });
});

describe('islem listesi', () => {
  it('yatirim ve cekimi ayirir, tutari kurusa cevirir, yeniden eskiye siralar', async () => {
    lynonPaymentTransactions.mockResolvedValue([
      { Id: 1, transactionType: 'deposit', Amount: 250.5, DocumentState: 'Approved', CreatedAt: '2026-08-01T10:00:00Z' },
      { Id: 2, transactionType: 'withdrawal', Amount: 100, DocumentState: 'Pending', CreatedAt: '2026-08-03T10:00:00Z' },
      { Id: 3, transactionType: 'deposit', Amount: 40, DocumentState: 'Approved', CreatedAt: '2026-08-05T10:00:00Z' },
    ]);

    const app = await sunucu();
    const res = await app.inject({
      method: 'GET',
      url: '/api/crm/players/77/transactions',
      headers: { 'x-crm-key': ANAHTAR, 'x-tenant': 'default' },
    });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Kurus cevrimi: 250.5 TL -> 25050. Bir birim hatasi burada yakalanir.
    expect(body.deposits.map((d: { amountCents: number }) => d.amountCents)).toEqual([4000, 25050]);
    expect(body.withdrawals).toHaveLength(1);
    expect(body.withdrawals[0].status).toBe('Pending');
    // ClientId ile oyuncuya ozel uca gidilmeli; site geneli arama degil.
    expect(lynonPaymentTransactions).toHaveBeenCalledWith({ ClientId: '77' });
  });

  it('anahtarsiz cagri Lynona hic ulasmaz', async () => {
    const app = await sunucu();
    const res = await app.inject({ method: 'GET', url: '/api/crm/players/77/transactions' });
    await app.close();

    expect(res.statusCode).toBe(401);
    expect(lynonPaymentTransactions).not.toHaveBeenCalled();
  });
});

describe('hesap yaniti', () => {
  it('telefonu dondurur — CRM kullanici adindan sohbet acmak icin buna muhtac', async () => {
    lynonOyuncuKpiSorgula.mockResolvedValue({
      durum: 'bulundu',
      ozet: {
        id: '2519618',
        login: 'snnads01',
        telefon: '05369824414',
        paraBirimi: 'TRY',
        kayitTarihi: null,
        metrics: [],
      },
    });

    const app = await sunucu();
    const res = await app.inject({
      method: 'GET',
      url: '/api/crm/players/lookup?q=snnads01',
      headers: { 'x-crm-key': ANAHTAR, 'x-tenant': 'default' },
    });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json().account.phone).toBe('05369824414');
  });
});

describe('oyuncu detayi', () => {
  const OZET = {
    durum: 'bulundu',
    ozet: { id: '2519660', login: 'yekda52', telefon: '5369824414', paraBirimi: 'TRY', kayitTarihi: null, metrics: [] },
  };

  it('adi, ulke kodlu numarayi ve kisitlari dondurur', async () => {
    lynonOyuncuKpiSorgula.mockResolvedValue(OZET);
    // Gercek yanit sekli: numara ulke kodundan AYRI tutuluyor.
    lynonPlayerDetail.mockResolvedValue({
      Data: {
        FirstName: 'Yekda ',
        LastName: 'Uzun ',
        Phone: '5369824414',
        phoneCode: '+90',
        Email: 'yekda5252@hotmail.com',
        CategoryName: 'Yeni Oyuncu',
        Status: 'active',
        IsIdentityVerified: true,
        restrictions: [
          { restriction: { id: 4, name: 'Withdraw' }, isRestricted: true },
          { restriction: { id: 8, name: 'Deposit' }, isRestricted: false },
        ],
      },
    });

    const app = await sunucu();
    const res = await app.inject({
      method: 'GET',
      url: '/api/crm/players/lookup?q=yekda52',
      headers: { 'x-crm-key': ANAHTAR, 'x-tenant': 'default' },
    });
    await app.close();

    const a = res.json().account;
    expect(a.firstName).toBe('Yekda');
    expect(a.fullName).toBe('Yekda Uzun');
    // Ulke kodu birlestirilmeli; yoksa WhatsApp'a adres olmaz.
    expect(a.phone).toBe('905369824414');
    expect(a.kycVerified).toBe(true);
    expect(a.restrictions.Withdraw).toBe(true);
    expect(a.restrictions.Deposit).toBe(false);
  });

  it('detay alinamazsa arama yine calisir', async () => {
    lynonOyuncuKpiSorgula.mockResolvedValue(OZET);
    lynonPlayerDetail.mockRejectedValue(new Error('detay ucu dustu'));

    const app = await sunucu();
    const res = await app.inject({
      method: 'GET',
      url: '/api/crm/players/lookup?q=yekda52',
      headers: { 'x-crm-key': ANAHTAR, 'x-tenant': 'default' },
    });
    await app.close();

    // Eksik profil, hic profil olmamasindan iyidir.
    expect(res.statusCode).toBe(200);
    expect(res.json().account.username).toBe('yekda52');
    expect(res.json().account.phone).toBe('5369824414');
  });
});
