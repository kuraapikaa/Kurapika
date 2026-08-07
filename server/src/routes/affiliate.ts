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
import { affiliateEntegrasyonDurumu, lynonAffiliateSaglayicilari } from '../services/lynonAffiliateEntegrasyon.js';
import { ortakOlarakKaydet, OrtakKaydiHatasi } from '../services/affiliateCrm/lynonOrtakKaydi.js';
import { ortakOzetleri, sonOlculenGun } from '../services/affiliateCrm/cekirdek.js';
import {
  medyalariListele, medyaOlustur, medyaGuncelle, medyaSil, MedyaHatasi, type MedyaGirdisi,
} from '../services/affiliateCrm/medya.js';
import {
  kademeDurumu, kademeBagiKur, kademeBagiKaldir, kademeYuzdeleriniAyarla, kademePaylariHesapla, KademeHatasi,
} from '../services/affiliateCrm/kademeler.js';
import {
  postbackAyarla, postbackAyarlari, postbackKayitlari, postbackGonder, PostbackHatasi, POSTBACK_OLAYLARI,
} from '../services/affiliateCrm/postback.js';
import {
  tiklamaKaydet, tiklamalariListele, tiklamaOzeti, yonlendirmeAdresi, TIKLAMA_CEREZI,
} from '../services/affiliateCrm/tiklama.js';
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
  if (err instanceof OrtakKaydiHatasi || err instanceof MedyaHatasi
      || err instanceof KademeHatasi || err instanceof PostbackHatasi) {
    return reply.status(err.statusCode).send({ ok: false, message: err.message });
  }
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

  /**
   * Mevcut bir Lynon oyuncusunu ortak (affiliate) olarak kaydeder.
   *
   * `affiliateType` canlı katalogla doğrulanıyor: liste gömülü olsaydı
   * Lynon yeni bir tip eklediğinde panel onu sessizce reddederdi.
   */
  app.put<{
    Params: { playerId: string };
    Body: {
      email?: string;
      userName?: string;
      affiliateType?: string;
      countryCode?: string;
      playerExternalId?: string;
      walletNumber?: string;
    };
  }>('/admin/affiliate/ortak-kaydi/:playerId', async (request, reply) => {
    const kullanici = adminKullanici(request);
    if (kullanici?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });

    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      const katalog = await lynonAffiliateSaglayicilari().catch(() => []);
      const sonuc = await ortakOlarakKaydet(
        tenantKey,
        { playerId: request.params.playerId, ...request.body },
        { kabulEdilenTipler: katalog.map((s) => s.type), aktor: kullanici.username },
      );
      // "gonderildi", "kuruldu" DEGIL: uc bos donuyor, dogrulayamiyoruz.
      return reply.send({
        ok: true,
        ...sonuc,
        uyari: 'Lynon bu uçta boş yanıt döndürüyor; kaydın oluştuğu panel tarafından doğrulanamaz.',
      });
    } catch (err) {
      return hataYanit(reply, err);
    }
  });

  /**
   * TIKLAMA UCU — genel, oturum yok.
   *
   * Ortağın banner'ındaki bağlantı buraya geliyor; tıklama kaydediliyor
   * ve oyuncu hedef siteye yönlendiriliyor.
   *
   * AÇIK YÖNLENDİRME KORUMASI: hedef adres YALNIZCA sunucuda kayıtlı
   * medyadan okunuyor, istekten ASLA. Adresi istekten almak, kendi alan
   * adımızı oltalama bağlantısı taşıyıcısına çevirirdi — bağlantı bize
   * ait göründüğü için de en ikna edicisinden.
   *
   * Medya bulunamazsa yönlendirme YAPILMIYOR: bilinmeyen bir kimlikle
   * gelen isteği bir yere göndermek, korumayı anlamsız kılardı.
   */
  app.get<{ Params: { medyaId: string }; Querystring: Record<string, string> }>(
    '/t/:medyaId',
    { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const tenantKey = await resolveTenantKeyForRequest(request as any);
      const bTag = String(request.query.btag ?? request.query.bTag ?? '').trim();
      if (!bTag) return reply.status(400).send({ ok: false, message: 'btag zorunlu.' });

      try {
        const medyalar = await medyalariListele(tenantKey, bTag);
        const medya = medyalar.find((m) => m.id === request.params.medyaId);
        if (!medya) return reply.status(404).send({ ok: false, message: 'Medya bulunamadı veya bu ortağa açık değil.' });

        const tiklama = await tiklamaKaydet(tenantKey, {
          bTag,
          medyaId: medya.id,
          sorgu: request.query,
          ip: (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? request.ip,
          userAgent: request.headers['user-agent'] as string | undefined,
          referrer: request.headers.referer as string | undefined,
        });

        // Çerez yalnızca iniş sayfası kendi alan adımızdaysa işe yarar;
        // asıl taşıyıcı hedef adrese eklenen `clickid`.
        reply.setCookie(TIKLAMA_CEREZI, tiklama.clickId, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60,
        });
        return reply.redirect(yonlendirmeAdresi(medya.hedefUrl, tiklama), 302);
      } catch (err) {
        return hataYanit(reply, err);
      }
    },
  );

  app.get<{ Querystring: { bTag?: string; medyaId?: string; start?: string; end?: string } }>(
    '/admin/affiliate/tiklamalar',
    async (request, reply) => {
      const tenantKey = await resolveTenantKeyForRequest(request as any);
      try {
        return reply.send({
          ok: true,
          tiklamalar: await tiklamalariListele(tenantKey, request.query),
          ozet: await tiklamaOzeti(tenantKey, request.query),
        });
      } catch (err) { return hataYanit(reply, err); }
    },
  );

  // ─── Medya yönetimi ────────────────────────────────────────────────────────

  app.get('/admin/affiliate/medya', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      return reply.send({ ok: true, medyalar: await medyalariListele(tenantKey) });
    } catch (err) { return hataYanit(reply, err); }
  });

  app.post<{ Body: MedyaGirdisi }>('/admin/affiliate/medya', async (request, reply) => {
    if (adminKullanici(request)?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      return reply.send({ ok: true, medya: await medyaOlustur(tenantKey, request.body ?? {}) });
    } catch (err) { return hataYanit(reply, err); }
  });

  app.put<{ Params: { id: string }; Body: MedyaGirdisi }>('/admin/affiliate/medya/:id', async (request, reply) => {
    if (adminKullanici(request)?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      return reply.send({ ok: true, medya: await medyaGuncelle(tenantKey, request.params.id, request.body ?? {}) });
    } catch (err) { return hataYanit(reply, err); }
  });

  app.delete<{ Params: { id: string } }>('/admin/affiliate/medya/:id', async (request, reply) => {
    if (adminKullanici(request)?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      await medyaSil(tenantKey, request.params.id);
      return reply.send({ ok: true });
    } catch (err) { return hataYanit(reply, err); }
  });

  // ─── Kademeli ortak yapısı ─────────────────────────────────────────────────

  app.get('/admin/affiliate/kademeler', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      return reply.send({ ok: true, ...(await kademeDurumu(tenantKey)) });
    } catch (err) { return hataYanit(reply, err); }
  });

  app.post<{ Body: { bTag?: string; ustBTag?: string } }>('/admin/affiliate/kademeler', async (request, reply) => {
    if (adminKullanici(request)?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      const bag = await kademeBagiKur(tenantKey, request.body?.bTag ?? '', request.body?.ustBTag ?? '');
      return reply.send({ ok: true, bag });
    } catch (err) { return hataYanit(reply, err); }
  });

  app.delete<{ Params: { bTag: string } }>('/admin/affiliate/kademeler/:bTag', async (request, reply) => {
    if (adminKullanici(request)?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      await kademeBagiKaldir(tenantKey, request.params.bTag);
      return reply.send({ ok: true });
    } catch (err) { return hataYanit(reply, err); }
  });

  app.put<{ Body: { yuzdeler?: number[] } }>('/admin/affiliate/kademeler/yuzdeler', async (request, reply) => {
    if (adminKullanici(request)?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      return reply.send({ ok: true, kademeYuzdeleri: await kademeYuzdeleriniAyarla(tenantKey, request.body?.yuzdeler ?? []) });
    } catch (err) { return hataYanit(reply, err); }
  });

  // ─── S2S postback ──────────────────────────────────────────────────────────

  app.get('/admin/affiliate/postback', async (request, reply) => {
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      return reply.send({
        ok: true,
        ayarlar: await postbackAyarlari(tenantKey),
        kayitlar: (await postbackKayitlari(tenantKey)).slice(0, 200),
        olaylar: POSTBACK_OLAYLARI,
      });
    } catch (err) { return hataYanit(reply, err); }
  });

  app.put<{ Body: { bTag?: string; sablon?: string; olaylar?: string[]; aktif?: boolean } }>(
    '/admin/affiliate/postback',
    async (request, reply) => {
      if (adminKullanici(request)?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });
      const tenantKey = await resolveTenantKeyForRequest(request as any);
      try {
        return reply.send({ ok: true, ayar: await postbackAyarla(tenantKey, request.body ?? {}) });
      } catch (err) { return hataYanit(reply, err); }
    },
  );

  /**
   * Gerçek bir gönderim yaparak şablonu sınar.
   *
   * Örnek değerlerle çalışıyor ve SSRF kontrolünden aynı yoldan geçiyor;
   * ortak "kaydettim ama çalışıyor mu" sorusunu ay sonunu beklemeden
   * cevaplayabilsin.
   */
  app.post<{ Body: { bTag?: string } }>('/admin/affiliate/postback/dene', async (request, reply) => {
    if (adminKullanici(request)?.role !== 'admin') return reply.status(403).send({ ok: false, message: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request as any);
    try {
      const kayit = await postbackGonder(tenantKey, String(request.body?.bTag ?? ''), 'kayit', {
        clickid: 'deneme-tiklama',
        payout: 0,
        playerid: 'deneme',
      });
      if (!kayit) return reply.send({ ok: false, message: 'Bu ortak için aktif bir postback ayarı yok.' });
      return reply.send({ ok: kayit.durum === 'basarili', kayit });
    } catch (err) { return hataYanit(reply, err); }
  });

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

        /**
         * POSTBACK TETİKLEYİCİSİ.
         *
         * `onaylanan-komisyon` şu an gerçekten tetiklenebilen TEK olay.
         * `kayit`, `ilk-yatirim` ve `yatirim` oyuncu bazında olay
         * gerektiriyor; çekme yolu toplam düzeyinde veri verdiği için
         * onları buradan üretmek uydurma olurdu — bir günün toplamını
         * tek bir "yatırım" olayı gibi göndermek ortağın izleme
         * sisteminde yanlış dönüşüm sayısı yaratırdı. O üçü itme
         * adaptörüyle gelecek.
         *
         * Gönderim ödeme kaydını ETKİLEMİYOR: ortağın sunucusu kapalı
         * diye durum güncellemesinin geri alınması orantısız olurdu.
         */
        if (kayit.durum === 'odendi') {
          void postbackGonder(tenantKey, kayit.bTag, 'onaylanan-komisyon', {
            payout: kayit.tutar,
            donem: kayit.donem,
            odemeid: kayit.id,
          }).catch((hata) => {
            request.log.warn({ err: hata }, '[affiliate] komisyon postback gönderilemedi');
          });
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

        /**
         * KADEME PAYLARI.
         *
         * Hesap hazırdı ama hiçbir yerden çağrılmıyordu: kademe ağacı
         * kuruluyor, yüzde ayarlanıyor ama ödeme raporunda görünmüyordu.
         *
         * Pay alt ortağın komisyonundan KESİLMİYOR, üst ortağa ayrıca
         * yazılıyor — bir pazarlama gideri. Bu yüzden `toplamKomisyon`
         * hem doğrudan komisyonları hem kademe paylarını içeriyor;
         * ikisini ayrı da döndürüyoruz ki rapor hangi paranın nereden
         * geldiğini gösterebilsin.
         */
        const { baglar, kademeYuzdeleri } = await kademeDurumu(tenantKey);
        const kademeSatirlari = raporSatirlari.flatMap((satir) =>
          kademePaylariHesapla(baglar, kademeYuzdeleri, satir.ortak.bTag, satir.komisyon.toplam)
            .map((pay) => ({ ...pay, kaynakBTag: satir.ortak.bTag, kaynakAd: satir.ortak.ad })),
        );
        const toplamKademePayi = kademeSatirlari.reduce((t, p) => t + p.tutar, 0);
        const toplamDogrudan = raporSatirlari.reduce((t, s) => t + s.komisyon.toplam, 0);

        return reply.send({
          ok: true,
          aralik: { startDate, endDate },
          satirlar: raporSatirlari,
          baglanmamis,
          kademeSatirlari,
          toplamDogrudan,
          toplamKademePayi,
          toplamKomisyon: toplamDogrudan + toplamKademePayi,
        });
      } catch (err) {
        return hataYanit(reply, err);
      }
    },
  );
}
