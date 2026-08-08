import { randomUUID } from 'crypto';
import { tiklamaDeposu } from '../depolar/tiklamaDeposu.js';
import { altParametreleriTemizle } from './izleme.js';
import { izlemeLinki } from './izleme.js';

export { kaynakAdi } from './izleme.js';

/**
 * TIKLAMA KAYDI — izleme döngüsünün kapanan halkası.
 *
 * İzleme linki üretmek ve parametreleri çözmek tek başına yetmiyor;
 * tıklamayı KARŞILAYAN bir uç olmadan zincir kopuk kalıyor:
 * link → (boşluk) → dönüşüm. `clickId` burada doğuyor ve postback'in
 * `{clickid}` makrosu ancak bununla dolabiliyor.
 *
 * ── ATRİBÜSYONUN GERÇEK SINIRI ──
 *
 * Oyuncu tıkladıktan sonra BİZİM alan adımızdan ÇIKIP kumar sitesine
 * gidiyor. Bizim koyduğumuz çerez orada okunamaz. Bu yüzden `clickId`
 * hedef adrese sorgu parametresi olarak EKLENİYOR; taşınmasının tek
 * yolu bu. Çerez yine de bırakılıyor ama yalnızca iniş sayfası kendi
 * alan adımızdaysa işe yarar.
 *
 * Oyuncu–ortak eşleşmesinin asıl kaynağı backoffice'in izleme anahtarı
 * olmaya devam ediyor; `clickId` onun üstüne KANAL kırılımı ekliyor
 * (hangi banner, hangi alt kanal).
 *
 * Depolama `depolar/tiklamaDeposu.ts` içinde: Postgres varsa tablo,
 * yoksa JSON belgesi. Bu servis hangisi olduğunu bilmiyor.
 */

export type {
  AltLinkTiklamaSayisi, GunlukSayi, KaynakSayisi, Tiklama, TiklamaOzeti, TiklamaSorgusu,
} from '../depolar/tiklamaDeposu.js';
import type {
  AltLinkTiklamaSayisi, GunlukSayi, KaynakSayisi, Tiklama, TiklamaOzeti, TiklamaSorgusu,
} from '../depolar/tiklamaDeposu.js';

export const TIKLAMA_CEREZI = 'aff_click';

const metin = (deger: unknown): string => (typeof deger === 'string' ? deger.trim() : '');

export interface TiklamaGirdisi {
  ortakAnahtari: string;
  medyaId?: string | null;
  /** Alt linkten geldiyse o linkin kimliği. */
  altLinkId?: string | null;
  sorgu?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}

export async function tiklamaKaydet(
  kiraci: string,
  girdi: TiklamaGirdisi,
  simdi = new Date(),
): Promise<Tiklama> {
  const ortakAnahtari = metin(girdi.ortakAnahtari);
  if (!ortakAnahtari) throw new Error('ortakAnahtari zorunlu.');

  const tiklama: Tiklama = {
    clickId: randomUUID(),
    ortakAnahtari,
    medyaId: metin(girdi.medyaId) || null,
    altLinkId: metin(girdi.altLinkId) || null,
    alt: altParametreleriTemizle(girdi.sorgu),
    ip: metin(girdi.ip) || null,
    // Uzun bir user-agent kaydi sisirir; teshis icin bas kismi yeter.
    userAgent: metin(girdi.userAgent).slice(0, 200) || null,
    referrer: metin(girdi.referrer).slice(0, 300) || null,
    zaman: simdi.toISOString(),
  };

  return tiklamaDeposu().ekle(kiraci, tiklama);
}

/**
 * Tıklamanın yönlendirileceği adres.
 *
 * AÇIK YÖNLENDİRME KORUMASI: hedef adres YALNIZCA sunucuda kayıtlı
 * medyadan alınıyor, istekten ASLA. Kullanıcının verdiği bir adrese
 * yönlendirmek, bizim alan adımızı oltalama bağlantısı taşıyıcısına
 * çevirirdi — bağlantı bize ait göründüğü için de en ikna edicisinden.
 *
 * `clickId` hedefe ekleniyor: oyuncu bizim alan adımızdan çıktığı için
 * çerezle taşımak mümkün değil.
 */
export function yonlendirmeAdresi(hedefUrl: string, tiklama: Tiklama): string {
  const url = new URL(izlemeLinki(hedefUrl, {
    ortakAnahtari: tiklama.ortakAnahtari,
    ...(tiklama.medyaId ? { medyaId: tiklama.medyaId } : {}),
    alt: tiklama.alt,
  }));
  url.searchParams.set('clickid', tiklama.clickId);
  return url.toString();
}

export async function tiklamalariListele(kiraci: string, sorgu: TiklamaSorgusu = {}): Promise<Tiklama[]> {
  return tiklamaDeposu().listele(kiraci, sorgu);
}

export async function tiklamaBul(kiraci: string, clickId: string): Promise<Tiklama | null> {
  return tiklamaDeposu().bul(kiraci, clickId);
}

/**
 * Ortak başına tıklama özeti.
 *
 * Özet artık SÜZÜLEN TÜM tıklamalar üzerinden çıkıyor. Önceden önce en
 * yeni 1000 kayıt alınıp özet onlardan hesaplanıyordu; bir kiracı bu
 * sayıyı aşınca rakamlar sessizce EKSİK raporlanıyordu — üstelik
 * "toplam" yazdığı için yanlış olduğu da anlaşılmıyordu.
 */
export async function tiklamaOzeti(kiraci: string, sorgu: TiklamaSorgusu = {}): Promise<TiklamaOzeti[]> {
  return tiklamaDeposu().ozetle(kiraci, sorgu);
}

/** Gün başına toplam tıklama; müşteri yolculuğu grafiğinin girdisi. */
export async function tiklamaGunlukSayilar(kiraci: string, sorgu: TiklamaSorgusu = {}): Promise<GunlukSayi[]> {
  return tiklamaDeposu().gunlukSayilar(kiraci, sorgu);
}

/** Trafiğin nereden geldiği; çoktan aza sıralı kaynak kırılımı. */
export async function tiklamaKaynakOzeti(kiraci: string, sorgu: TiklamaSorgusu = {}): Promise<KaynakSayisi[]> {
  return tiklamaDeposu().kaynakOzeti(kiraci, sorgu);
}

/** Alt link başına kesin tıklama sayısı; bkz. `TiklamaDeposu.altLinkOzeti`. */
export async function altLinkTiklamaOzeti(
  kiraci: string,
  ortakAnahtari?: string,
): Promise<AltLinkTiklamaSayisi[]> {
  return tiklamaDeposu().altLinkOzeti(kiraci, ortakAnahtari);
}
