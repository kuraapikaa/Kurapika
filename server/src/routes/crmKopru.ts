import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { audit } from '../lib/auditLog.js';
import { runWithTenant } from '../lib/tenantContext.js';
import {
  lynonBonusDefinitions,
  lynonCreditPlayerMainAccount,
  lynonErrorResponse,
  lynonOyuncuKpiSorgula,
  lynonPaymentTransactions,
  lynonPlayerDetail,
} from '../services/lynonBackofficeService.js';

/**
 * WhatsApp CRM koprusu.
 *
 * CRM ayri bir serviste calisiyor ve Lynon'a dogrudan baglanmiyor: Lynon
 * oturumu, TOTP'si ve site yapilandirmasi burada, KIRACI BASINA cozuluyor
 * (`lynonAuth.ts`). Istemciyi CRM'e kopyalamak kimlik bilgisi deposunu ve
 * oturum yenileme mantigini ikinci bir yerde bakim gerektirirdi.
 *
 * Bu dosya YENI Lynon mantigi icermiyor — yalnizca mevcut servis
 * fonksiyonlarini servisler-arasi kimlikle HTTP'ye aciyor.
 */

/** Yalniz makine cagricilar. Ajan oturumu degil, paylasimli bir sir. */
function kimlikDogrula(request: FastifyRequest, reply: FastifyReply): string | null {
  const beklenen = String(process.env.CRM_BRIDGE_KEY ?? '').trim();
  if (!beklenen) {
    reply.code(503).send({ error: 'CRM koprusu yapilandirilmamis (CRM_BRIDGE_KEY yok)' });
    return null;
  }

  const gelen = String(request.headers['x-crm-key'] ?? '');
  // Sabit sureli karsilastirma sart degil: anahtar tek seferde dogru ya da
  // yanlis, ve kaba kuvvet denemesi zaten oran sinirina takilir. Yine de
  // uzunluk farkinda erken cikmiyoruz.
  if (gelen.length !== beklenen.length || gelen !== beklenen) {
    reply.code(401).send({ error: 'Gecersiz CRM anahtari' });
    return null;
  }

  const tenant = String(request.headers['x-tenant'] ?? '').trim();
  if (!tenant) {
    reply.code(400).send({ error: 'X-Tenant basligi zorunlu' });
    return null;
  }
  return tenant;
}

/**
 * Oyuncu detayindan CRM'in ihtiyaci olan alanlari cikarir.
 *
 * Arama sonucu (`lynonOyuncuKpiSorgula`) yalnizca ozet donuyor: ad yok,
 * numaranin ulke kodu yok, kisitlar yok. Detay ucu
 * (`/userBackOffice/users/:id`) hepsini veriyor ve temsilcinin sohbette
 * ihtiyaci olan sey tam olarak bunlar — kisiye adiyla hitap etmek ve
 * "cekimim neden yatmiyor" sorusuna bakabilmek.
 */
function detaydanHesap(d: Record<string, unknown>) {
  const ad = String(d.FirstName ?? '').trim();
  const soyad = String(d.LastName ?? '').trim();

  // Numara ulke kodundan AYRI tutuluyor: phoneNumber "5369824414",
  // phoneCode "+90". Ikisini birlestirmeden WhatsApp'a adres olmaz.
  const kod = String(d.phoneCode ?? '').replace(/\D/g, '');
  const yerel = String(d.Phone ?? d.phoneNumber ?? '').replace(/\D/g, '');
  const telefon = yerel ? (kod && !yerel.startsWith(kod) ? `${kod}${yerel}` : yerel) : null;

  // Kisitlar CRM'de "cekim durumu" olarak gosteriliyor: kapali bir cekim
  // yetkisi, temsilcinin oyuncuya soyleyebilecegi ilk sey.
  const kisitlar: Record<string, boolean> = {};
  for (const k of Array.isArray(d.restrictions) ? d.restrictions : []) {
    const satir = k as { restriction?: { name?: string }; isRestricted?: boolean };
    const ad2 = satir.restriction?.name;
    if (ad2) kisitlar[ad2] = satir.isRestricted === true;
  }

  return {
    firstName: ad || null,
    lastName: soyad || null,
    fullName: [ad, soyad].filter(Boolean).join(' ') || null,
    phone: telefon,
    email: (d.Email as string) ?? null,
    category: (d.CategoryName as string) ?? null,
    status: (d.Status as string) ?? null,
    kycVerified: d.IsIdentityVerified === true,
    restrictions: kisitlar,
  };
}

/** Lynon KPI ozetini CRM'in bekledigi sekle cevirir. */
function kpiyeCevir(ozet: {
  paraBirimi: string;
  toplamBakiye: number | null;
  gercekBakiye: number | null;
  bonusBakiye: number | null;
  toplamYatirim: number | null;
  toplamCekim: number | null;
  kategori: string | null;
  kayitTarihi: string | null;
  telefonDogrulandi: boolean | null;
  kimlikDogrulandi: boolean | null;
}) {
  // Lynon tutarlari ana birimde donuyor; CRM her yerde minor unit kullaniyor.
  const kurus = (v: number | null) => (v == null ? null : Math.round(v * 100));

  return {
    balanceCents: kurus(ozet.toplamBakiye ?? ozet.gercekBakiye),
    currency: ozet.paraBirimi,
    fetchedAt: new Date().toISOString(),
    metrics: [
      { key: 'realBalance', label: 'Gercek bakiye', value: kurus(ozet.gercekBakiye) },
      { key: 'bonusBalance', label: 'Bonus bakiye', value: kurus(ozet.bonusBakiye) },
      { key: 'totalDeposit', label: 'Toplam yatirim', value: kurus(ozet.toplamYatirim) },
      { key: 'totalWithdraw', label: 'Toplam cekim', value: kurus(ozet.toplamCekim) },
      { key: 'category', label: 'Kategori', value: ozet.kategori },
      { key: 'registeredAt', label: 'Kayit', value: ozet.kayitTarihi },
      { key: 'phoneVerified', label: 'Telefon dogrulandi', value: ozet.telefonDogrulandi },
      { key: 'identityVerified', label: 'Kimlik dogrulandi', value: ozet.kimlikDogrulandi },
    ],
  };
}

export async function crmKopruRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Telefon numarasi (ya da kullanici adi / id) ile oyuncu arar.
   *
   * `lynonOyuncuKpiSorgula` zaten Id/Login/Email/Phone/MobilePhone alanlarinin
   * hepsinde ariyor, dolayisiyla burada ayri bir telefon eslesmesi yok.
   */
  app.get<{ Querystring: { q?: string } }>('/crm/players/lookup', async (request, reply) => {
    const tenant = kimlikDogrula(request, reply);
    if (!tenant) return;

    const sorgu = String(request.query.q ?? '').trim();
    if (!sorgu) return reply.code(400).send({ error: 'q parametresi zorunlu' });

    try {
      const sonuc = await runWithTenant(tenant, () => lynonOyuncuKpiSorgula(sorgu));

      if (sonuc.durum === 'bulunamadi') return reply.send({ account: null });

      // Birden fazla eslesmede tahmin etmiyoruz: yanlis oyuncuya bonus
      // yuklemek geri alinmasi zor bir hata.
      if (sonuc.durum === 'coklu') {
        return reply.code(409).send({
          error: 'Birden fazla oyuncu eslesti, daha belirgin bir deger girin',
          candidates: sonuc.adaylar,
        });
      }

      const o = sonuc.ozet;

      // Detay ucu ad, ulke kodlu numara ve kisitlari veriyor; arama sonucu
      // vermiyor. Basarisiz olursa aramanin kendisi calismaya devam etmeli —
      // eksik profil, hic profil olmamasindan iyidir.
      let detay: ReturnType<typeof detaydanHesap> | null = null;
      try {
        const r = await runWithTenant(tenant, () => lynonPlayerDetail(o.id));
        detay = detaydanHesap((r?.Data ?? {}) as Record<string, unknown>);
      } catch {
        detay = null;
      }

      return reply.send({
        account: {
          userId: o.id,
          username: o.login,
          // CRM kullanici adindan WhatsApp sohbeti aciyor; numarayi baska
          // yerden ogrenemiyor. Temsilciye gosterilmiyor, sunucu tarafinda
          // adres olarak kullaniliyor.
          phone: detay?.phone ?? o.telefon,
          firstName: detay?.firstName ?? null,
          lastName: detay?.lastName ?? null,
          fullName: detay?.fullName ?? null,
          email: detay?.email ?? o.eposta ?? null,
          category: detay?.category ?? null,
          status: detay?.status ?? null,
          kycVerified: detay?.kycVerified ?? o.kimlikDogrulandi ?? false,
          restrictions: detay?.restrictions ?? {},
          currency: o.paraBirimi,
          registeredAt: o.kayitTarihi,
        },
        kpi: kpiyeCevir(o),
      });
    } catch (error) {
      const { status, body } = lynonErrorResponse(error);
      return reply.code(status).send(body);
    }
  });

  /** Oyuncu KPI'si. Arama ile ayni cagriyi kullanir, id ile. */
  app.get<{ Params: { userId: string } }>(
    '/crm/players/:userId/kpi',
    async (request, reply) => {
      const tenant = kimlikDogrula(request, reply);
      if (!tenant) return;

      try {
        const sonuc = await runWithTenant(tenant, () =>
          lynonOyuncuKpiSorgula(request.params.userId),
        );
        if (sonuc.durum !== 'bulundu') {
          return reply.code(404).send({ error: 'Oyuncu bulunamadi' });
        }
        return reply.send(kpiyeCevir(sonuc.ozet));
      } catch (error) {
        const { status, body } = lynonErrorResponse(error);
        return reply.code(status).send(body);
      }
    },
  );

  /**
   * Oyuncunun son islemleri: yatirimlar ve cekim talepleri, durumlariyla.
   *
   * KPI ucu yalnizca TOPLAM yatirim/cekim veriyor. Temsilcinin sohbette
   * ihtiyaci olan ise "cekimi neden yatmadi" ve "en son ne zaman yatirdi" —
   * ikisinin de cevabi tekil islemlerde, toplamda degil.
   *
   * Site geneli arama yerine oyuncuya ozel uca gidiyor: yogun bir sitede
   * belirli bir oyuncunun kayitlari ilk sayfada olmayabiliyor ve sonuc
   * sessizce bos donuyordu (bkz. lynonPaymentTransactions).
   */
  app.get<{ Params: { userId: string }; Querystring: { limit?: string } }>(
    '/crm/players/:userId/transactions',
    async (request, reply) => {
      const tenant = kimlikDogrula(request, reply);
      if (!tenant) return;

      const limit = Math.min(Math.max(Number(request.query.limit ?? 10) || 10, 1), 50);

      try {
        const rows = await runWithTenant(tenant, () =>
          lynonPaymentTransactions({ ClientId: request.params.userId }),
        );

        const cevir = (row: Record<string, unknown>) => ({
          id: String(row.Id ?? row.DocumentId ?? ''),
          // Lynon ana birimde donuyor; CRM her yerde minor unit kullaniyor.
          amountCents: Math.round(Number(row.Amount ?? row.amount ?? 0) * 100),
          currency: String(row.CurrencyId ?? row.currency ?? '') || null,
          status: String(row.DocumentState ?? row.status ?? '') || null,
          method: String(row.PaymentSystemName ?? row.paymentSystemName ?? '') || null,
          createdAt: (row.CreatedAt ?? row.createdAt ?? row.DocumentDate ?? null) as string | null,
        });

        const tur = (row: Record<string, unknown>) =>
          String(row.transactionType ?? row.type ?? '').trim().toLowerCase();

        const liste = Array.isArray(rows) ? rows : [];
        const yatirimlar = liste.filter((r) => tur(r) === 'deposit').map(cevir);
        const cekimler = liste.filter((r) => tur(r) === 'withdrawal').map(cevir);

        // En yeni once: temsilcinin bakacagi sey son islem.
        const yeniOnce = (a: { createdAt: string | null }, b: { createdAt: string | null }) =>
          Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '') || 0;

        return reply.send({
          deposits: yatirimlar.sort(yeniOnce).slice(0, limit),
          withdrawals: cekimler.sort(yeniOnce).slice(0, limit),
          fetchedAt: new Date().toISOString(),
        });
      } catch (error) {
        const { status, body } = lynonErrorResponse(error);
        return reply.code(status).send(body);
      }
    },
  );

  app.get('/crm/bonus-definitions', async (request, reply) => {
    const tenant = kimlikDogrula(request, reply);
    if (!tenant) return;

    try {
      const res = await runWithTenant(tenant, () => lynonBonusDefinitions());
      const kayitlar = Array.isArray(res?.Data) ? res.Data : (res?.Data?.Objects ?? []);
      return reply.send({
        definitions: (Array.isArray(kayitlar) ? kayitlar : []).map((b: Record<string, unknown>) => ({
          code: String(b.Id ?? b.id ?? ''),
          name: String(b.Name ?? b.name ?? ''),
          amountCents: null,
          currency: null,
        })),
      });
    } catch (error) {
      const { status, body } = lynonErrorResponse(error);
      return reply.code(status).send(body);
    }
  });

  /**
   * Oyuncu ana hesabina bakiye yukler.
   *
   * `idempotencyKey` CRM'in kendi kayit id'si. Zaman asimi sonrasi tekrar
   * denemenin cift yukleme yapmamasi icin ayni anahtarla gelen ikinci istek
   * yeni bir Lynon cagrisi yapmadan ilk sonucu doner.
   */
  const islenmisYuklemeler = new Map<string, { reference: string; at: number }>();
  const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

  app.post<{
    Params: { userId: string };
    Body: {
      amountCents?: number;
      currency?: string;
      note?: string | null;
      idempotencyKey?: string;
      grantedBy?: string;
    };
  }>('/crm/players/:userId/bonus', async (request, reply) => {
    const tenant = kimlikDogrula(request, reply);
    if (!tenant) return;

    const { amountCents, note, idempotencyKey, grantedBy } = request.body ?? {};

    if (!Number.isInteger(amountCents) || (amountCents as number) <= 0) {
      return reply.code(400).send({ error: 'amountCents pozitif tam sayi olmali' });
    }
    if (!idempotencyKey) {
      return reply.code(400).send({ error: 'idempotencyKey zorunlu' });
    }

    // Eskiyen kayitlari at, sonra tekrar kontrolu yap.
    const simdi = Date.now();
    for (const [k, v] of islenmisYuklemeler) {
      if (simdi - v.at > IDEMPOTENCY_TTL_MS) islenmisYuklemeler.delete(k);
    }
    const oncekiSonuc = islenmisYuklemeler.get(idempotencyKey);
    if (oncekiSonuc) return reply.send({ reference: oncekiSonuc.reference });

    try {
      const res = await runWithTenant(tenant, () =>
        lynonCreditPlayerMainAccount({
          playerId: request.params.userId,
          // Lynon ana birimde tutar bekliyor, CRM kurus gonderiyor.
          amount: (amountCents as number) / 100,
          note: note ?? `CRM bonus — ${grantedBy ?? 'bilinmeyen ajan'}`,
        }),
      );

      const reference = String(
        (res as Record<string, unknown>)?.Data ??
          (res as Record<string, unknown>)?.DocumentId ??
          idempotencyKey,
      );
      islenmisYuklemeler.set(idempotencyKey, { reference, at: simdi });

      // Para hareketi — kim, kime, ne kadar, hangi kiraci.
      audit(
        grantedBy ?? 'crm',
        'crm',
        'crm_bonus_credit',
        `player:${request.params.userId}`,
        JSON.stringify({ tenant, amountCents, reference }),
      );

      return reply.send({ reference });
    } catch (error) {
      audit(
        grantedBy ?? 'crm',
        'crm',
        'crm_bonus_credit_failed',
        `player:${request.params.userId}`,
        JSON.stringify({ tenant, amountCents }),
      );
      const { status, body } = lynonErrorResponse(error);
      return reply.code(status).send(body);
    }
  });
}
