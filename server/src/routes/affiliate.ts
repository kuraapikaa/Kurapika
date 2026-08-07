import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { compare } from 'bcryptjs';
import { hashPassword } from './auth.js';
import { audit } from '../lib/auditLog.js';
import { resolveTenantKeyForRequest } from '../lib/tenant.js';
import { affiliateMetrikleri, type AffiliateSatir } from '../services/affiliateMetrics.js';
import {
  AffiliateHesapHatasi,
  bTagAnahtari,
  hesapBulKimlikIcin,
  hesapEkle,
  hesapGuncelle,
  hesapSil,
  hesaplar,
  komisyonHesapla,
  sonGirisIsle,
  type AffiliateHesapGorunum,
} from '../services/affiliateAccountService.js';
import { lynonAffiliateSummary } from '../services/lynonBackofficeService.js';
import { affiliateEntegrasyonDurumu } from '../services/lynonAffiliateEntegrasyon.js';
import { ortakOzetleri, sonOlculenGun } from '../services/affiliateCrm/cekirdek.js';
import type { AffiliateUser } from '../types/betconstruct.js';
import {
  AffiliateOdemeHatasi,
  bekleyenToplam,
  odemeDurumGuncelle,
  odemeKaydet,
  odemeler,
  odenmisToplam,
  type OdemeDurumu,
} from '../services/affiliateOdemeService.js';

/**
 * Affiliate modulu: ortak portali girisi + admin hesap yonetimi.
 *
 * Portal oturumu panel oturumundan AYRI (session.affiliateUser). Ortak,
 * admin uclarina erisemez; authGuard yalnizca /api/affiliate-portal/*
 * yollarini bu oturuma aciyor.
 *
 * Ortak yalnizca KENDI BTag'ini gorur. Filtreleme istemcide degil burada
 * yapiliyor — istemci tarafi filtre, tum BTag'leri tele koymak demekti.
 */

/** Portal oturumu icin son 1 yil; ortak "bu yil ne kazandim" diye bakiyor. */
function varsayilanAralik(): { startDate: string; endDate: string } {
  const gun = (d: Date) => {
    const parcalar = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const al = (t: Intl.DateTimeFormatPartTypes) => parcalar.find((p) => p.type === t)?.value ?? '';
    return `${al('year')}-${al('month')}-${al('day')}`;
  };
  return {
    startDate: gun(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)),
    endDate: gun(new Date()),
  };
}

function hataYanit(reply: FastifyReply, err: unknown) {
  if (err instanceof AffiliateHesapHatasi || err instanceof AffiliateOdemeHatasi) {
    return reply.status(err.statusCode).send({ ok: false, message: err.message });
  }
  const mesaj = err instanceof Error ? err.message : 'Beklenmeyen hata.';
  return reply.status(500).send({ ok: false, message: mesaj });
}

function adminKullanici(request: FastifyRequest): { username: string; role: string } | undefined {
  const user = (request as any).session?.user;
  if (!user?.username) return undefined;
  return { username: String(user.username), role: String(user.role ?? 'operator') };
}

export async function affiliateRoutes(app: FastifyInstance): Promise<void> {
  // ─── Portal: kimlik dogrulama ──────────────────────────────────────────────

  app.post<{ Body: { email?: string; password?: string } }>(
    '/affiliate-portal/login',
    { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const email = String(request.body?.email ?? '').trim();
      const password = String(request.body?.password ?? '');
      const tenantKey = await resolveTenantKeyForRequest(request as any);

      // TEK HATA MESAJI: "e-posta yok" ile "parola yanlis" ayri mesaj
      // dondurseydi, saldirgan hangi e-postalarin kayitli oldugunu
      // tarayabilirdi.
      const reddet = () => reply.status(401).send({ ok: false, message: 'E-posta veya parola hatalı.' });

      if (!email || !password) {
        return reply.status(400).send({ ok: false, message: 'E-posta ve parola zorunludur.' });
      }

      const hesap = await hesapBulKimlikIcin(email, tenantKey);
      if (!hesap) return reddet();

      const dogru = await compare(password, hesap.passwordHash);
      if (!dogru) return reddet();

      if (hesap.durum !== 'aktif') {
        return reply.status(403).send({
          ok: false,
          message: hesap.durum === 'beklemede'
            ? 'Başvurunuz henüz onaylanmadı.'
            : 'Hesabınız askıya alınmış. Lütfen temsilcinizle görüşün.',
        });
      }

      const session = (request as any).session;
      // Oturum kimligini yenile: giris oncesi verilen kimlikle devam etmek
      // oturum sabitleme (session fixation) acigi birakir.
      if (typeof session?.regenerate === 'function') {
        await session.regenerate();
      }

      const portalUser: AffiliateUser = { id: hesap.id, bTag: hesap.bTag, email: hesap.email, ad: hesap.ad };
      (request as any).session.affiliateUser = portalUser;
      await (request as any).session.save();
      await sonGirisIsle(hesap.id, tenantKey);

      return reply.send({ ok: true, user: portalUser });
    },
  );

  app.get('/affiliate-portal/me', async (request, reply) => {
    const portalUser = (request as any).session?.affiliateUser as AffiliateUser | undefined;
    if (!portalUser?.id) return reply.send({ ok: false });
    return reply.send({ ok: true, user: portalUser });
  });

  app.post('/affiliate-portal/logout', async (request, reply) => {
    const session = (request as any).session;
    if (session) {
      session.affiliateUser = undefined;
      if (typeof session.destroy === 'function') await session.destroy();
    }
    return reply.send({ ok: true });
  });

  // ─── Portal: kendi performansi ─────────────────────────────────────────────

  app.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/affiliate-portal/ozet',
    async (request, reply) => {
      const portalUser = (request as any).session?.affiliateUser as AffiliateUser | undefined;
      if (!portalUser?.id) {
        return reply.status(401).send({ ok: false, message: 'Oturum süreniz dolmuş.' });
      }

      const tenantKey = await resolveTenantKeyForRequest(request as any);
      // Hesabi her istekte tazeliyoruz: oturum acikken askiya alinan ortak
      // veri gormeye devam etmemeli, komisyon orani da degismis olabilir.
      const guncel = (await hesaplar(tenantKey)).find((h) => h.id === portalUser.id);
      if (!guncel) return reply.status(404).send({ ok: false, message: 'Ortak hesabı bulunamadı.' });
      if (guncel.durum !== 'aktif') {
        return reply.status(403).send({ ok: false, message: 'Hesabınız aktif değil.' });
      }

      const varsayilan = varsayilanAralik();
      const startDate = String(request.query?.startDate ?? varsayilan.startDate);
      const endDate = String(request.query?.endDate ?? varsayilan.endDate);

      try {
        const ozet = await lynonAffiliateSummary(startDate, endDate);
        const tumSatirlar = (((ozet as any)?.Data?.Objects ?? []) as AffiliateSatir[]);
        // SUNUCU TARAFINDA filtrele: istemciye yalnizca kendi satiri gitmeli.
        const kendi = tumSatirlar.filter((s) => bTagAnahtari(String(s.bTag ?? '')) === bTagAnahtari(guncel.bTag));
        const { satirlar, toplam } = affiliateMetrikleri(kendi);

        const komisyon = komisyonHesapla(toplam.netGelir, toplam.aktifOyuncu, {
          komisyonModeli: guncel.komisyonModeli,
          revsharePayi: guncel.revsharePayi,
          cpaTutari: guncel.cpaTutari,
        });

        // Ortak "gecen ay ne aldim" diye sorunca cevap verebilelim.
        const kendiOdemeleri = await odemeler(tenantKey, guncel.id);

        return reply.send({
          ok: true,
          ortak: {
            ad: guncel.ad,
            bTag: guncel.bTag,
            komisyonModeli: guncel.komisyonModeli,
            revsharePayi: guncel.revsharePayi,
            cpaTutari: guncel.cpaTutari,
          },
          odemeler: kendiOdemeleri.map((o) => ({
            donem: o.donem,
            tutar: o.tutar,
            durum: o.durum,
            odenmeTarihi: o.odenmeTarihi ?? null,
          })),
          odemeOzeti: {
            odenmis: odenmisToplam(kendiOdemeleri),
            bekleyen: bekleyenToplam(kendiOdemeleri),
          },
          aralik: { startDate, endDate },
          satirlar,
          toplam,
          komisyon,
        });
      } catch (err) {
        return hataYanit(reply, err);
      }
    },
  );

  // ─── Admin: ortak hesaplari ────────────────────────────────────────────────

  /**
   * Lynon'un third-party affiliate katalogu ve bizim entegrasyonumuzun
   * hazırlık durumu.
   *
   * Lynon backoffice'i `/websites/{siteId}/third-party-integrations/
   * affiliates` ekranında sitenin bağlanabileceği harici affiliate
   * sistemlerini listeliyor. Panel bunu okuyup hangi tipin bizim
   * entegrasyonumuzla aynı şekle sahip olduğunu ve hangi alanların
   * hazır olduğunu gösteriyor.
   */
  app.get('/admin/affiliate/lynon-entegrasyon', async (request, reply) => {
    if (adminKullanici(request)?.role !== 'admin') {
      return reply.status(403).send({ ok: false, message: 'Yetkisiz' });
    }
    try {
      // Postback adresini panelin kendi genel adresinden üretiyoruz;
      // Lynon'a elle yazılan bir adres yanlış siteye gidebilirdi.
      const proto = String(request.headers['x-forwarded-proto'] ?? 'https').split(',')[0];
      const host = String(request.headers['x-forwarded-host'] ?? request.headers.host ?? '').split(',')[0];
      const durum = await affiliateEntegrasyonDurumu(`${proto}://${host}`);
      return reply.send({ ok: true, ...durum });
    } catch (err) {
      return hataYanit(reply, err);
    }
  });

  /**
   * Ortak başına dönem özeti — KENDİ kayıtlarımızdan.
   *
   * `/admin/affiliate/rapor` Lynon'a istek anında gidip o aralığın
   * özetini alıyor. Bu uç ise günlük olarak biriktirdiğimiz anlık
   * görüntülerden okuyor: eğilim serisi veriyor, Lynon'u her açılışta
   * yormuyor ve Lynon geçici olarak erişilemezken de çalışıyor.
   */
  app.get<{ Querystring: { start?: string; end?: string; ortak?: string } }>(
    '/admin/affiliate/olcumler',
    async (request, reply) => {
      const tenantKey = await resolveTenantKeyForRequest(request as any);
      const varsayilan = varsayilanAralik();
      const start = request.query.start || varsayilan.startDate;
      const end = request.query.end || varsayilan.endDate;
      try {
        const ozetler = await ortakOzetleri(tenantKey, { start, end, ortakAnahtari: request.query.ortak });
        return reply.send({
          ok: true,
          aralik: { start, end },
          ortaklar: ozetler,
          sonOlculenGun: await sonOlculenGun(tenantKey),
          toplam: {
            yatirim: ozetler.reduce((t, o) => t + o.yatirim, 0),
            cekim: ozetler.reduce((t, o) => t + o.cekim, 0),
            ggr: ozetler.reduce((t, o) => t + o.ggr, 0),
          },
        });
      } catch (err) {
        return hataYanit(reply, err);
      }
    },
  );

  app.get('/admin/affiliate/hesaplar', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      const liste = await hesaplar(tenantKey);
      return reply.send({ ok: true, hesaplar: liste });
    } catch (err) {
      return hataYanit(reply, err);
    }
  });

  app.post<{
    Body: {
      bTag?: string;
      ad?: string;
      email?: string;
      password?: string;
      komisyonModeli?: string;
      revsharePayi?: number;
      cpaTutari?: number;
      durum?: string;
      basvuruId?: string;
      not?: string;
    };
  }>('/admin/affiliate/hesaplar', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    const body = request.body ?? {};
    const parola = String(body.password ?? '').trim();
    if (parola.length < 8) {
      return reply.status(400).send({ ok: false, message: 'Parola en az 8 karakter olmalıdır.' });
    }

    try {
      const hesap = await hesapEkle(
        {
          bTag: String(body.bTag ?? ''),
          ad: String(body.ad ?? ''),
          email: String(body.email ?? ''),
          passwordHash: await hashPassword(parola),
          komisyonModeli: body.komisyonModeli as never,
          revsharePayi: body.revsharePayi,
          cpaTutari: body.cpaTutari,
          durum: body.durum as never,
          basvuruId: body.basvuruId,
          not: body.not,
        },
        tenantKey,
      );
      const admin = adminKullanici(request);
      if (admin) {
        audit(admin.username, admin.role, 'affiliate_hesap_create', hesap.bTag, `${hesap.ad} (${hesap.email})`);
      }
      return reply.send({ ok: true, hesap });
    } catch (err) {
      return hataYanit(reply, err);
    }
  });

  app.post<{
    Params: { id: string };
    Body: {
      ad?: string;
      bTag?: string;
      komisyonModeli?: string;
      revsharePayi?: number;
      cpaTutari?: number;
      durum?: string;
      not?: string;
      password?: string;
    };
  }>('/admin/affiliate/hesaplar/:id', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    const body = request.body ?? {};

    const parola = String(body.password ?? '').trim();
    if (parola && parola.length < 8) {
      return reply.status(400).send({ ok: false, message: 'Parola en az 8 karakter olmalıdır.' });
    }

    try {
      const hesap = await hesapGuncelle(
        request.params.id,
        {
          ad: body.ad,
          bTag: body.bTag,
          komisyonModeli: body.komisyonModeli as never,
          revsharePayi: body.revsharePayi,
          cpaTutari: body.cpaTutari,
          durum: body.durum as never,
          not: body.not,
          ...(parola ? { passwordHash: await hashPassword(parola) } : {}),
        },
        tenantKey,
      );
      const admin = adminKullanici(request);
      if (admin) {
        audit(
          admin.username,
          admin.role,
          'affiliate_hesap_update',
          hesap.bTag,
          parola ? `${hesap.ad} — parola sıfırlandı` : hesap.ad,
        );
      }
      return reply.send({ ok: true, hesap });
    } catch (err) {
      return hataYanit(reply, err);
    }
  });

  app.delete<{ Params: { id: string } }>('/admin/affiliate/hesaplar/:id', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      const silinecek = (await hesaplar(tenantKey)).find((h) => h.id === request.params.id);
      await hesapSil(request.params.id, tenantKey);
      const admin = adminKullanici(request);
      if (admin && silinecek) {
        audit(admin.username, admin.role, 'affiliate_hesap_delete', silinecek.bTag, silinecek.ad);
      }
      return reply.send({ ok: true });
    } catch (err) {
      return hataYanit(reply, err);
    }
  });

  // ─── Admin: odeme kayitlari ────────────────────────────────────────────────

  app.get<{ Querystring: { ortakId?: string } }>('/admin/affiliate/odemeler', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      const liste = await odemeler(tenantKey, request.query?.ortakId);
      return reply.send({
        ok: true,
        odemeler: liste,
        ozet: { odenmis: odenmisToplam(liste), bekleyen: bekleyenToplam(liste) },
      });
    } catch (err) {
      return hataYanit(reply, err);
    }
  });

  /**
   * Donem hakedisini odeme kaydina cevirir.
   *
   * Tutar ve dayanaklari (net gelir, aktif oyuncu, oran) kayda SABITLENIR:
   * rapor sonradan degisse bile odenen tutarin gerekcesi denetlenebilmeli.
   */
  app.post<{
    Body: {
      ortakId?: string;
      donem?: string;
      donemBaslangic?: string;
      donemBitis?: string;
      tutar?: number;
      netGelir?: number;
      aktifOyuncu?: number;
      not?: string;
    };
  }>('/admin/affiliate/odemeler', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    const body = request.body ?? {};
    const admin = adminKullanici(request);

    try {
      const ortak = (await hesaplar(tenantKey)).find((h) => h.id === body.ortakId);
      if (!ortak) return reply.status(404).send({ ok: false, message: 'Ortak bulunamadı.' });

      const kayit = await odemeKaydet(
        {
          ortakId: ortak.id,
          bTag: ortak.bTag,
          donem: String(body.donem ?? ''),
          donemBaslangic: String(body.donemBaslangic ?? ''),
          donemBitis: String(body.donemBitis ?? ''),
          tutar: Number(body.tutar),
          netGelir: Number(body.netGelir ?? 0),
          aktifOyuncu: Number(body.aktifOyuncu ?? 0),
          komisyonModeli: ortak.komisyonModeli,
          revsharePayi: ortak.revsharePayi,
          cpaTutari: ortak.cpaTutari,
          not: body.not,
          olusturan: admin?.username ?? 'system',
        },
        tenantKey,
      );

      if (admin) {
        audit(admin.username, admin.role, 'affiliate_odeme_create', ortak.bTag, `${kayit.donem} · ${kayit.tutar}`);
      }
      return reply.send({ ok: true, odeme: kayit });
    } catch (err) {
      return hataYanit(reply, err);
    }
  });

  app.post<{ Params: { id: string }; Body: { durum?: string } }>(
    '/admin/affiliate/odemeler/:id/durum',
    async (request, reply) => {
      const tenantKey = await resolveTenantKeyForRequest(request as any);
      const admin = adminKullanici(request);
      try {
        const kayit = await odemeDurumGuncelle(
          request.params.id,
          String(request.body?.durum ?? '') as OdemeDurumu,
          admin?.username ?? 'system',
          tenantKey,
        );
        if (admin) {
          audit(admin.username, admin.role, 'affiliate_odeme_update', kayit.bTag, `${kayit.donem} → ${kayit.durum}`);
        }
        return reply.send({ ok: true, odeme: kayit });
      } catch (err) {
        return hataYanit(reply, err);
      }
    },
  );

  // ─── Admin: komisyon raporu ────────────────────────────────────────────────

  /**
   * Her ortagin hakedisini tek istekte hesaplar.
   *
   * BTag'i olan ama hesabi olmayan trafik "baglanmamis" olarak ayri
   * donuyor: bunlar komisyon odenmeyen ama gelir ureten kanallar, gozden
   * kacmamali.
   */
  app.post<{ Body: { startDate?: string; endDate?: string } }>(
    '/admin/affiliate/komisyon-raporu',
    async (request, reply) => {
      const tenantKey = await resolveTenantKeyForRequest(request as any);
      const varsayilan = varsayilanAralik();
      const startDate = String(request.body?.startDate ?? varsayilan.startDate);
      const endDate = String(request.body?.endDate ?? varsayilan.endDate);

      try {
        const [ozet, ortaklar] = await Promise.all([
          lynonAffiliateSummary(startDate, endDate),
          hesaplar(tenantKey),
        ]);
        const satirlar = (((ozet as any)?.Data?.Objects ?? []) as AffiliateSatir[]);
        const { satirlar: zengin } = affiliateMetrikleri(satirlar);

        const bTagIndeksi = new Map(zengin.map((s) => [bTagAnahtari(String(s.bTag ?? '')), s]));
        const eslesenBTagler = new Set<string>();

        const raporSatirlari = ortaklar.map((ortak: AffiliateHesapGorunum) => {
          const anahtar = bTagAnahtari(ortak.bTag);
          const metrik = bTagIndeksi.get(anahtar);
          if (metrik) eslesenBTagler.add(anahtar);
          const netGelir = Number(metrik?.netRevenue ?? 0);
          const aktif = Number(metrik?.activePlayers ?? 0);
          return {
            ortak: {
              id: ortak.id,
              ad: ortak.ad,
              email: ortak.email,
              bTag: ortak.bTag,
              durum: ortak.durum,
              komisyonModeli: ortak.komisyonModeli,
              revsharePayi: ortak.revsharePayi,
              cpaTutari: ortak.cpaTutari,
            },
            metrik: metrik ?? null,
            komisyon: komisyonHesapla(netGelir, aktif, {
              komisyonModeli: ortak.komisyonModeli,
              revsharePayi: ortak.revsharePayi,
              cpaTutari: ortak.cpaTutari,
            }),
          };
        });

        const baglanmamis = zengin.filter((s) => !eslesenBTagler.has(bTagAnahtari(String(s.bTag ?? ''))));

        return reply.send({
          ok: true,
          aralik: { startDate, endDate },
          satirlar: raporSatirlari,
          baglanmamis,
          toplamKomisyon: raporSatirlari.reduce((t, s) => t + s.komisyon.toplam, 0),
        });
      } catch (err) {
        return hataYanit(reply, err);
      }
    },
  );
}
