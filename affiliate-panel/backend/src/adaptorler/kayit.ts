import { createHash, randomUUID } from 'crypto';
import { degistir, kayitOku, oku } from '../lib/depo.js';
import { guvenliKiraciAnahtari } from '../lib/kiraci.js';
import { coz, maskele, sifrele, sifrelemeHazirMi } from '../lib/sifre.js';
import { GENEL_REST_TANIMI } from './genelRest.js';
import { LYNON_TANIMI } from './lynon.js';
import {
  AdaptorHatasi,
  ayarlariDogrula,
  type AdaptorTanimi,
  type BackofficeAdaptoru,
} from './tur.js';

/**
 * ADAPTÖR KAYDI VE BAĞLANTI DEPOSU.
 *
 * Hangi kiracının hangi backoffice'(ler)e nasıl bağlandığı burada duruyor.
 * Sırlar (parola, TOTP secret, API anahtarı) ŞİFRELİ yazılıyor ve
 * panele asla düz dönmüyor.
 *
 * ── Neden TEK bağlantı değil, LİSTE ──
 *
 * Bir kiracı (marka) birden fazla Lynon SİTESİ işletebiliyor — her
 * sitenin kendi backoffice adresi, kendi site kimliği, kendi girişi
 * var. Ortaklar tek listede kalıyor (bkz. `servisler/ortaklar.ts`) ama
 * bir ortağın getirdiği oyuncular birden fazla siteye dağılabiliyor;
 * hakediş bu yüzden bağlantı bazında değil ORTAK bazında toplanıyor.
 *
 * ── Adaptör örneği neden önbellekleniyor ──
 *
 * Lynon adaptörü bir oturum (çerez kavanozu) taşıyor. Her istekte yeni
 * bir örnek üretmek, her istekte yeniden giriş yapmak demek olurdu:
 * yavaş, ve Lynon tarafında şüpheli görünecek kadar çok giriş.
 *
 * Önbellek anahtarı yapılandırmanın PARMAK İZİ. Kullanıcı parolayı
 * değiştirdiğinde parmak izi değişiyor ve eski oturum kendiliğinden
 * düşüyor — elle geçersiz kılmayı unutma ihtimali kalmıyor.
 */

const ALAN = 'backoffice-baglantilari';

export const ADAPTOR_TANIMLARI: AdaptorTanimi[] = [LYNON_TANIMI, GENEL_REST_TANIMI];

export function tanimBul(ad: string): AdaptorTanimi {
  const tanim = ADAPTOR_TANIMLARI.find((t) => t.ad === ad);
  if (!tanim) {
    throw new AdaptorHatasi(`Bilinmeyen adaptör: ${ad}. Seçenekler: ${ADAPTOR_TANIMLARI.map((t) => t.ad).join(', ')}`);
  }
  return tanim;
}

export interface Baglanti {
  id: string;
  /** Yönetici için okunur ad; örn. "Narcosbahis", "Tacobahis". Zorunlu değil, boşsa adaptör etiketi kullanılır. */
  ad: string;
  adaptor: string;
  /** Sır alanları `v1.gcm.` önekiyle şifreli durur. */
  ayar: Record<string, string>;
  aktif: boolean;
  olusturuldu: string;
  updatedAt: string;
}

interface Depo { version: 2; baglantilar: Baglanti[] }

/**
 * `cozDepo`, eski TEK bağlantı biçimini (`{version:1, baglanti: {...}}`)
 * de anlıyor ve tek elemanlı listeye çeviriyor.
 *
 * ── Neden burada, migrasyon script'inde değil ──
 *
 * Bu belge deposu (`aff_belgeler`) migrasyon şemasının dışında (bkz.
 * `lib/veritabani.ts`); JSON biçimindeki bir alanı SQL migrasyonuyla
 * değiştirmek gereksiz karmaşıklık. Okuma anında normalleştirmek,
 * var olan HER kiracının bağlantısını (üretimde çalışan gerçek bir
 * Lynon bağlantısı dahil) KAYIPSIZ, geriye dönük uyumlu taşıyor — yazma
 * olmadan yalnızca okuma bile doğru biçimi görür.
 */
function cozDepo(ham: unknown): Depo {
  const kayit = kayitOku(ham);
  if (Array.isArray(kayit.baglantilar)) {
    return { version: 2, baglantilar: kayit.baglantilar as Baglanti[] };
  }

  const eski = kayit.baglanti;
  if (eski && typeof eski === 'object' && !Array.isArray(eski)) {
    const b = eski as Record<string, unknown>;
    const zaman = String(b.updatedAt ?? new Date(0).toISOString());
    return {
      version: 2,
      baglantilar: [{
        // Sabit id: ayni eski belge iki kez okunsa/goculse bile ayni id
        // cikiyor -- rastgele olsaydi her okuma farkli bir baglanti
        // "gibi" gorunurdu.
        id: 'varsayilan',
        ad: 'Backoffice',
        adaptor: String(b.adaptor ?? ''),
        ayar: (b.ayar && typeof b.ayar === 'object' ? b.ayar : {}) as Record<string, string>,
        aktif: b.aktif !== false,
        olusturuldu: zaman,
        updatedAt: zaman,
      }],
    };
  }

  return { version: 2, baglantilar: [] };
}

export async function baglantilariListele(kiraci: string): Promise<Baglanti[]> {
  return (await oku<Depo>(kiraci, ALAN, cozDepo)).baglantilar;
}

export async function baglantiyiOku(kiraci: string, id: string): Promise<Baglanti | null> {
  const liste = await baglantilariListele(kiraci);
  return liste.find((b) => b.id === id) ?? null;
}

/** Aktif olan tüm bağlantılar; senkron/geçmiş doldurma gibi "hepsini tara" işleri için. */
export async function aktifBaglantilar(kiraci: string): Promise<Baglanti[]> {
  return (await baglantilariListele(kiraci)).filter((b) => b.aktif);
}

/**
 * İlk aktif bağlantının kimliği.
 *
 * GEÇİŞ DÖNEMİ YARDIMCISI: toplu atama gibi bazı yollar henüz "hangi
 * bağlantı" seçimini arayüzden almıyor. Tek bağlantılı kiracılarda
 * (bugünkü HER kiracı) bu, eski tek-bağlantı davranışıyla birebir
 * aynı sonucu verir -- ikinci bir bağlantı eklenene kadar hiçbir şey
 * değişmez.
 */
export async function varsayilanBaglantiId(kiraci: string): Promise<string | null> {
  const aktifler = await aktifBaglantilar(kiraci);
  return aktifler[0]?.id ?? null;
}

export interface BaglantiGorunumu {
  id: string;
  ad: string;
  adaptor: string;
  etiket: string;
  aktif: boolean;
  updatedAt: string;
  ayar: Record<string, string>;
}

/**
 * Panele dönen görünüm: sırlar maskelenmiş.
 *
 * Maskeyi çağıranın sorumluluğuna bırakmak, bir rota unuttuğunda
 * parolayı JSON'da göndermek demek olurdu. Tek çıkış kapısı bu.
 */
export async function baglantilarGorunumu(kiraci: string): Promise<BaglantiGorunumu[]> {
  const liste = await baglantilariListele(kiraci);
  return liste.map((b) => {
    const tanim = ADAPTOR_TANIMLARI.find((t) => t.ad === b.adaptor);
    const sirAlanlari = new Set((tanim?.alanlar ?? []).filter((a) => a.sir).map((a) => a.ad));
    const ayar: Record<string, string> = {};
    for (const [anahtar, deger] of Object.entries(b.ayar)) {
      ayar[anahtar] = sirAlanlari.has(anahtar) ? maskele(coz(deger) ?? '····') : deger;
    }
    return {
      id: b.id,
      ad: b.ad,
      adaptor: b.adaptor,
      etiket: tanim?.etiket ?? b.adaptor,
      aktif: b.aktif,
      updatedAt: b.updatedAt,
      ayar,
    };
  });
}

/**
 * Bağlantıyı yazar. `id` verilmezse YENİ bağlantı oluşturur.
 *
 * Sır alanı BOŞ gelirse mevcut değer korunuyor. Panel sırları maskeli
 * gösterdiği için, kullanıcı yalnızca site kimliğini değiştirmek
 * istediğinde maskeyi geri göndermek zorunda kalır ve parola "••••"
 * olarak kaydedilirdi.
 */
export async function baglantiyiYaz(
  kiraci: string,
  id: string | null,
  girdi: { ad?: string; adaptor?: string; ayar?: Record<string, unknown>; aktif?: boolean },
  simdi = new Date(),
): Promise<Baglanti> {
  const tanim = tanimBul(String(girdi.adaptor ?? '').trim());
  const gelen = girdi.ayar && typeof girdi.ayar === 'object' ? girdi.ayar : {};

  return degistir<Depo, Baglanti>(kiraci, ALAN, cozDepo, (depo) => {
    const mevcutIndeks = id ? depo.baglantilar.findIndex((b) => b.id === id) : -1;
    if (id && mevcutIndeks === -1) {
      throw new AdaptorHatasi('Bağlantı bulunamadı.', 404);
    }
    const oncekiAyar = mevcutIndeks >= 0 && depo.baglantilar[mevcutIndeks].adaptor === tanim.ad
      ? depo.baglantilar[mevcutIndeks].ayar
      : {};
    const ayar: Record<string, string> = {};

    for (const alan of tanim.alanlar) {
      const ham = String((gelen as Record<string, unknown>)[alan.ad] ?? '').trim();
      if (!alan.sir) {
        ayar[alan.ad] = ham || String(alan.varsayilan ?? '');
        continue;
      }
      if (ham) {
        if (!sifrelemeHazirMi()) {
          throw new AdaptorHatasi(
            'AFF_SECRET_KEY tanımlı değil. Sırlar düz metin olarak saklanmayacağı için bağlantı kaydedilemiyor.',
            500,
          );
        }
        ayar[alan.ad] = sifrele(ham);
      } else if (oncekiAyar[alan.ad]) {
        ayar[alan.ad] = oncekiAyar[alan.ad];
      }
    }

    // Sirlar cozulmus haliyle dogrulaniyor: sifreli metin her zaman dolu
    // gorunur ve "zorunlu alan bos" kontrolu anlamsizlasirdi.
    ayarlariDogrula(tanim, cozulmusAyar(tanim, ayar));

    const ad = String(girdi.ad ?? '').trim() || tanim.etiket;
    const baglanti: Baglanti = mevcutIndeks >= 0
      ? { ...depo.baglantilar[mevcutIndeks], ad, adaptor: tanim.ad, ayar, aktif: girdi.aktif !== false, updatedAt: simdi.toISOString() }
      : { id: randomUUID(), ad, adaptor: tanim.ad, ayar, aktif: girdi.aktif !== false, olusturuldu: simdi.toISOString(), updatedAt: simdi.toISOString() };

    if (mevcutIndeks >= 0) depo.baglantilar[mevcutIndeks] = baglanti;
    else depo.baglantilar.push(baglanti);

    return baglanti;
  });
}

export async function baglantiyiSil(kiraci: string, id: string): Promise<void> {
  await degistir<Depo, void>(kiraci, ALAN, cozDepo, (depo) => {
    depo.baglantilar = depo.baglantilar.filter((b) => b.id !== id);
  });
  const onek = `${guvenliKiraciAnahtari(kiraci)}\t${id}\t`;
  for (const anahtar of [...ornekler.keys()]) {
    if (anahtar.startsWith(onek)) ornekler.delete(anahtar);
  }
}

function cozulmusAyar(tanim: AdaptorTanimi, ayar: Record<string, string>): Record<string, string> {
  const sirAlanlari = new Set(tanim.alanlar.filter((a) => a.sir).map((a) => a.ad));
  const cikti: Record<string, string> = {};
  for (const [anahtar, deger] of Object.entries(ayar)) {
    cikti[anahtar] = sirAlanlari.has(anahtar) ? (coz(deger) ?? '') : deger;
  }
  return cikti;
}

const ornekler = new Map<string, { parmakIzi: string; adaptor: BackofficeAdaptoru }>();

/**
 * Kiracının belirli bir bağlantısının adaptörü. Bağlantı yoksa ya da
 * pasifse `null`.
 *
 * `null` dönmek FIRLATMAKTAN iyi: bağlantı kurulmamış bir kiracıda
 * panelin geri kalanı (medya, ortaklar, izleme linkleri) çalışmaya
 * devam etmeli. Yalnızca senkron ve doğrulama bağlantıya muhtaç.
 */
export async function adaptorAl(kiraci: string, id: string): Promise<BackofficeAdaptoru | null> {
  const baglanti = await baglantiyiOku(kiraci, id);
  if (!baglanti || !baglanti.aktif) return null;

  const tanim = ADAPTOR_TANIMLARI.find((t) => t.ad === baglanti.adaptor);
  if (!tanim) return null;

  const cozulen = cozulmusAyar(tanim, baglanti.ayar);
  const parmakIzi = createHash('sha256')
    .update(JSON.stringify([tanim.ad, cozulen]))
    .digest('hex');

  const anahtar = `${guvenliKiraciAnahtari(kiraci)}\t${id}\t${tanim.ad}`;
  const onbellek = ornekler.get(anahtar);
  if (onbellek && onbellek.parmakIzi === parmakIzi) return onbellek.adaptor;

  const adaptor = tanim.olustur(cozulen);
  ornekler.set(anahtar, { parmakIzi, adaptor });
  return adaptor;
}

/** Adaptör zorunlu olan yollar için. */
export async function adaptorZorunlu(kiraci: string, id: string): Promise<BackofficeAdaptoru> {
  const adaptor = await adaptorAl(kiraci, id);
  if (!adaptor) throw new AdaptorHatasi('Backoffice bağlantısı kurulu değil ya da pasif.', 409);
  return adaptor;
}

/** Panelde bağlantı formunu çizmek için; sır DEĞERİ içermez. */
export function adaptorKatalogu() {
  return ADAPTOR_TANIMLARI.map((t) => ({
    ad: t.ad,
    etiket: t.etiket,
    aciklama: t.aciklama,
    yetenekler: t.yetenekler,
    alanlar: t.alanlar,
  }));
}
