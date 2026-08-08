import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { altLinkBul } from '../servisler/altLink.js';
import { medyaBul, medyalariListele } from '../servisler/medya.js';
import { ortakAnahtarindanBul, onayliMi } from '../servisler/ortaklar.js';
import { postbackGonder } from '../servisler/postback.js';
import { tiklamaKaydet, TIKLAMA_CEREZI, yonlendirmeAdresi } from '../servisler/tiklama.js';

/**
 * TIKLAMA UCU — panelin tek AÇIK ucu.
 *
 * `/c/:ortakAnahtari` ve `/c/:ortakAnahtari/:medyaId`. Ortağın
 * paylaştığı adres bu; kimlik doğrulaması yok, olamaz da — tıklayan
 * kişi bir oyuncu.
 *
 * ── AÇIK YÖNLENDİRME ──
 *
 * Hedef adres YALNIZCA sunucudaki medya kaydından okunuyor. İstekten
 * bir `url` parametresi kabul etmek, bu alan adını oltalama bağlantısı
 * taşıyıcısına çevirirdi: bağlantı bize ait göründüğü için de en ikna
 * edicisinden.
 *
 * ── Neden 302, 301 değil ──
 *
 * 301 kalıcı ve tarayıcı önbelleğe alıyor; medyanın hedefi
 * değiştiğinde eski ziyaretçiler eski adrese gitmeye devam ederdi.
 * Ayrıca önbellekten gelen bir yönlendirme sunucuya hiç uğramaz ve
 * tıklama SAYILMAZ.
 */

export async function tiklamaRotalari(app: FastifyInstance): Promise<void> {
  const isle = async (
    kiraci: string,
    ortakAnahtari: string,
    medyaId: string | null,
    sorgu: Record<string, unknown>,
    istekBilgisi: { ip: string; userAgent: string | null; referrer: string | null },
    altLinkId: string | null = null,
  ) => {
    const ortak = await ortakAnahtarindanBul(kiraci, ortakAnahtari);
    // Bilinmeyen ya da onaysiz anahtar: tiklama KAYDEDILMIYOR ve
    // yonlendirme yapilmiyor. Onaysiz ortaga trafik akitmak, sonradan
    // "bu trafigin odemesini yapmiyoruz" demeyi imkansiz kilardi.
    if (!ortak || !onayliMi(ortak)) return null;

    const medya = medyaId
      ? await medyaBul(kiraci, medyaId)
      : (await medyalariListele(kiraci, ortakAnahtari)).find((m) => m.tur === 'landing' && m.aktif) ?? null;

    if (!medya || !medya.aktif) return null;
    if (medya.ortakAnahtarlari.length > 0 && !medya.ortakAnahtarlari.includes(ortakAnahtari)) return null;

    const tiklama = await tiklamaKaydet(kiraci, {
      ortakAnahtari,
      medyaId: medya.id,
      altLinkId,
      sorgu,
      ip: istekBilgisi.ip,
      userAgent: istekBilgisi.userAgent,
      referrer: istekBilgisi.referrer,
    });

    // Postback BEKLENMIYOR: ortagin sunucusu yavassa oyuncu o kadar
    // bekler ve tiklamanin yarisi kaybolur. Hata da yutuluyor; gonderim
    // zaten kendi kaydini tutuyor.
    void postbackGonder(kiraci, ortakAnahtari, 'tiklama', {
      clickid: tiklama.clickId,
      mid: medya.id,
      ...tiklama.alt,
    }).catch(() => undefined);

    return { tiklama, hedef: yonlendirmeAdresi(medya.hedefUrl, tiklama) };
  };

  type TiklamaIstegi = FastifyRequest<{ Params: { ortakAnahtari: string; medyaId?: string } }>;

  const tiklamaYanit = async (istek: TiklamaIstegi, yanit: FastifyReply) => {
    const sonuc = await isle(
      istek.kiraci,
      String(istek.params.ortakAnahtari ?? ''),
      istek.params.medyaId ? String(istek.params.medyaId) : null,
      (istek.query ?? {}) as Record<string, unknown>,
      {
        ip: istek.ip,
        userAgent: String(istek.headers['user-agent'] ?? '') || null,
        referrer: String(istek.headers.referer ?? '') || null,
      },
    );

    if (!sonuc) {
      // 404 metni SEBEP VERMIYOR: "ortak onaysiz" demek, disaridan
      // hangi anahtarlarin gecerli oldugunu sayilabilir kilardi.
      return yanit.status(404).send({ hata: 'Bağlantı bulunamadı.' });
    }

    yanit.setCookie(TIKLAMA_CEREZI, sonuc.tiklama.clickId, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return yanit.redirect(302, sonuc.hedef);
  };

  app.get<{ Params: { ortakAnahtari: string; medyaId?: string } }>('/c/:ortakAnahtari/:medyaId', tiklamaYanit);
  app.get<{ Params: { ortakAnahtari: string; medyaId?: string } }>('/c/:ortakAnahtari', tiklamaYanit);

  /**
   * ALT LİNK — ortağın kendi kaydettiği kısa bağlantı.
   *
   * Ortak, medya ve alt kanal parametrelerini burada YAZMIYOR; hepsi
   * kayıttan geliyor. Bu bilinçli: parametreleri adreste taşımak, hem
   * ortağın kanal isimlendirmesini dışarıya gösterir hem de linki
   * elle düzenleyen birinin trafiği başka bir kırılıma yazmasına izin
   * verirdi.
   *
   * Sorgu dizesi yine de okunuyor ama YALNIZCA kayıtta boş bırakılmış
   * alanlar için: ortak tek bir link üretip `?sub5=deneme` ile anlık
   * bir işaret ekleyebilsin. Kayıtlı değer her zaman kazanıyor.
   */
  app.get<{ Params: { kod: string } }>('/l/:kod', async (istek, yanit) => {
    const link = await altLinkBul(istek.kiraci, String(istek.params.kod ?? ''));
    if (!link || !link.aktif) {
      return yanit.status(404).send({ hata: 'Bağlantı bulunamadı.' });
    }

    const sonuc = await isle(
      istek.kiraci,
      link.ortakAnahtari,
      link.medyaId,
      { ...(istek.query as Record<string, unknown>), ...link.alt },
      {
        ip: istek.ip,
        userAgent: String(istek.headers['user-agent'] ?? '') || null,
        referrer: String(istek.headers.referer ?? '') || null,
      },
      link.id,
    );

    if (!sonuc) return yanit.status(404).send({ hata: 'Bağlantı bulunamadı.' });

    yanit.setCookie(TIKLAMA_CEREZI, sonuc.tiklama.clickId, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return yanit.redirect(302, sonuc.hedef);
  });
}
