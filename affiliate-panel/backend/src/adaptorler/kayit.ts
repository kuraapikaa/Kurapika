import { createHash } from 'crypto';
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
 * Hangi kiracının hangi backoffice'e nasıl bağlandığı burada duruyor.
 * Sırlar (parola, TOTP secret, API anahtarı) ŞİFRELİ yazılıyor ve
 * panele asla düz dönmüyor.
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

const ALAN = 'backoffice-baglantisi';

export const ADAPTOR_TANIMLARI: AdaptorTanimi[] = [LYNON_TANIMI, GENEL_REST_TANIMI];

export function tanimBul(ad: string): AdaptorTanimi {
  const tanim = ADAPTOR_TANIMLARI.find((t) => t.ad === ad);
  if (!tanim) {
    throw new AdaptorHatasi(`Bilinmeyen adaptör: ${ad}. Seçenekler: ${ADAPTOR_TANIMLARI.map((t) => t.ad).join(', ')}`);
  }
  return tanim;
}

export interface Baglanti {
  adaptor: string;
  /** Sır alanları `v1.gcm.` önekiyle şifreli durur. */
  ayar: Record<string, string>;
  aktif: boolean;
  updatedAt: string;
}

type Depo = { version: 1; baglanti: Baglanti | null };
const cozDepo = (ham: unknown): Depo => {
  const baglanti = kayitOku(ham).baglanti;
  return { version: 1, baglanti: baglanti ? (baglanti as Baglanti) : null };
};

export async function baglantiyiOku(kiraci: string): Promise<Baglanti | null> {
  return (await oku<Depo>(kiraci, ALAN, cozDepo)).baglanti;
}

/**
 * Panele dönen görünüm: sırlar maskelenmiş.
 *
 * Maskeyi çağıranın sorumluluğuna bırakmak, bir rota unuttuğunda
 * parolayı JSON'da göndermek demek olurdu. Tek çıkış kapısı bu.
 */
export async function baglantiGorunumu(kiraci: string): Promise<
  { kurulu: false } | { kurulu: true; adaptor: string; etiket: string; aktif: boolean; updatedAt: string; ayar: Record<string, string> }
> {
  const baglanti = await baglantiyiOku(kiraci);
  if (!baglanti) return { kurulu: false };

  const tanim = ADAPTOR_TANIMLARI.find((t) => t.ad === baglanti.adaptor);
  const sirAlanlari = new Set((tanim?.alanlar ?? []).filter((a) => a.sir).map((a) => a.ad));
  const ayar: Record<string, string> = {};
  for (const [anahtar, deger] of Object.entries(baglanti.ayar)) {
    ayar[anahtar] = sirAlanlari.has(anahtar) ? maskele(coz(deger) ?? '····') : deger;
  }

  return {
    kurulu: true,
    adaptor: baglanti.adaptor,
    etiket: tanim?.etiket ?? baglanti.adaptor,
    aktif: baglanti.aktif,
    updatedAt: baglanti.updatedAt,
    ayar,
  };
}

/**
 * Bağlantıyı yazar.
 *
 * Sır alanı BOŞ gelirse mevcut değer korunuyor. Panel sırları maskeli
 * gösterdiği için, kullanıcı yalnızca site kimliğini değiştirmek
 * istediğinde maskeyi geri göndermek zorunda kalır ve parola "••••"
 * olarak kaydedilirdi.
 */
export async function baglantiyiYaz(
  kiraci: string,
  girdi: { adaptor?: string; ayar?: Record<string, unknown>; aktif?: boolean },
  simdi = new Date(),
): Promise<Baglanti> {
  const tanim = tanimBul(String(girdi.adaptor ?? '').trim());
  const gelen = girdi.ayar && typeof girdi.ayar === 'object' ? girdi.ayar : {};

  return degistir<Depo, Baglanti>(kiraci, ALAN, cozDepo, (depo) => {
    const oncekiAyar = depo.baglanti?.adaptor === tanim.ad ? depo.baglanti.ayar : {};
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

    const baglanti: Baglanti = {
      adaptor: tanim.ad,
      ayar,
      aktif: girdi.aktif !== false,
      updatedAt: simdi.toISOString(),
    };
    depo.baglanti = baglanti;
    return baglanti;
  });
}

export async function baglantiyiSil(kiraci: string): Promise<void> {
  await degistir<Depo, void>(kiraci, ALAN, cozDepo, (depo) => {
    depo.baglanti = null;
  });
  const onek = `${guvenliKiraciAnahtari(kiraci)}\t`;
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
 * Kiracının adaptörü. Bağlantı yoksa ya da pasifse `null`.
 *
 * `null` dönmek FIRLATMAKTAN iyi: bağlantı kurulmamış bir kiracıda
 * panelin geri kalanı (medya, ortaklar, izleme linkleri) çalışmaya
 * devam etmeli. Yalnızca senkron ve doğrulama bağlantıya muhtaç.
 */
export async function adaptorAl(kiraci: string): Promise<BackofficeAdaptoru | null> {
  const baglanti = await baglantiyiOku(kiraci);
  if (!baglanti || !baglanti.aktif) return null;

  const tanim = ADAPTOR_TANIMLARI.find((t) => t.ad === baglanti.adaptor);
  if (!tanim) return null;

  const cozulen = cozulmusAyar(tanim, baglanti.ayar);
  const parmakIzi = createHash('sha256')
    .update(JSON.stringify([tanim.ad, cozulen]))
    .digest('hex');

  const anahtar = `${guvenliKiraciAnahtari(kiraci)}\t${tanim.ad}`;
  const onbellek = ornekler.get(anahtar);
  if (onbellek && onbellek.parmakIzi === parmakIzi) return onbellek.adaptor;

  const adaptor = tanim.olustur(cozulen);
  ornekler.set(anahtar, { parmakIzi, adaptor });
  return adaptor;
}

/** Adaptör zorunlu olan yollar için. */
export async function adaptorZorunlu(kiraci: string): Promise<BackofficeAdaptoru> {
  const adaptor = await adaptorAl(kiraci);
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
