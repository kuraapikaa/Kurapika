import { lynonRequest } from '../../lib/lynonAuth.js';
import { lynonCfg } from '../../lib/tenantRuntimeConfig.js';
import { audit } from '../../lib/auditLog.js';

/**
 * OYUNCUYU ORTAK (AFFILIATE) OLARAK KAYDETME.
 *
 * Gozlenen uc:
 *   PUT {backoffice}/api/affiliate/api/v1.0/affiliatePlayers/{siteId}/{playerId}/register
 *
 * Mevcut bir Lynon oyuncusunu, secilen third-party affiliate sisteminde
 * ortak olarak acar. `affiliateType` katalogdaki tiplerden biri olmali
 * (bkz. `lynonAffiliateEntegrasyon`).
 *
 * ── Yanit BOS DONUYOR ──
 *
 * Uc 200 ve `content-length: 0` donuyor; govdede ne bir kimlik ne de bir
 * dogrulama var. Yani "kaydedildi" ile "kabul edildi ama hicbir sey
 * yapilmadi" ayirt EDILEMIYOR. Bu yuzden her deneme kendi tarafimizda
 * denetime yaziliyor ve panel "gonderildi" der, "kuruldu" DEMEZ. Geri
 * okuma ucu gozlendiginde dogrulama eklenmeli.
 */

export class OrtakKaydiHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'OrtakKaydiHatasi';
  }
}

/**
 * Alanlar istege bagli TIPLENIYOR, zorunluluk calisma aninda
 * dogrulaniyor: girdi HTTP govdesinden geliyor ve orada her sey
 * eksik olabilir. Tipte zorunlu tutmak, cagiranin dogrulanmamis veriyi
 * `as` ile gecirmesine yol acardi.
 */
export interface OrtakKaydiGirdisi {
  /** Lynon oyuncu kimligi (ClientId). */
  playerId: string | number;
  email?: string;
  userName?: string;
  /** Katalogdaki tip; orn. `affnook`. */
  affiliateType?: string;
  /** ISO ulke kodu; orn. `TR`. */
  countryCode?: string;
  /** Ortagin affiliate sistemindeki dis kimligi. */
  playerExternalId?: string;
  /** Odeme cuzdan numarasi. */
  walletNumber?: string;
}

const metin = (deger: unknown): string => (typeof deger === 'string' ? deger.trim() : '');

function zorunlu(deger: unknown, alan: string): string {
  const v = metin(deger);
  if (!v) throw new OrtakKaydiHatasi(`${alan} zorunlu.`);
  return v;
}

/**
 * Kabul edilen tipleri cagiran veriyor.
 *
 * Tip listesini burada SABITLEMIYORUZ: Lynon katalogu degisebilir ve
 * gomulu bir liste, yeni bir tip eklendiginde sessizce reddetmeye yol
 * acardi. Liste verilmezse dogrulama atlanir ve karar Lynon'a birakilir.
 */
export async function ortakOlarakKaydet(
  tenantKey: string,
  girdi: OrtakKaydiGirdisi,
  { kabulEdilenTipler, aktor = 'sistem' }: { kabulEdilenTipler?: string[]; aktor?: string } = {},
): Promise<{ gonderildi: true; playerId: string; affiliateType: string }> {
  const playerId = zorunlu(String(girdi.playerId ?? ''), 'playerId');
  const email = zorunlu(girdi.email, 'email');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new OrtakKaydiHatasi('email gecerli degil.');
  const userName = zorunlu(girdi.userName, 'userName');
  const affiliateType = zorunlu(girdi.affiliateType, 'affiliateType');
  const countryCode = zorunlu(girdi.countryCode, 'countryCode').toUpperCase();

  if (kabulEdilenTipler && kabulEdilenTipler.length > 0 && !kabulEdilenTipler.includes(affiliateType)) {
    throw new OrtakKaydiHatasi(
      `affiliateType katalogda yok: ${affiliateType}. Gecerli tipler: ${kabulEdilenTipler.join(', ')}`,
    );
  }

  const siteId = lynonCfg(tenantKey).siteId;
  if (!Number.isInteger(siteId) || siteId <= 0) {
    throw new OrtakKaydiHatasi('Sitenin Lynon site kimligi tanimli degil.', 409);
  }

  const govde: Record<string, string> = { email, userName, affiliateType, countryCode };
  // Bos gonderilen istege bagli alanlar govdeye HIC konmuyor; bos string
  // gondermek, Lynon tarafinda var olan bir degeri silmek anlamina
  // gelebilir.
  const playerExternalId = metin(girdi.playerExternalId);
  const walletNumber = metin(girdi.walletNumber);
  if (playerExternalId) govde.playerExternalId = playerExternalId;
  if (walletNumber) govde.walletNumber = walletNumber;

  await lynonRequest(`api/affiliate/api/v1.0/affiliatePlayers/${siteId}/${encodeURIComponent(playerId)}/register`, {
    method: 'PUT',
    body: govde,
  });

  /**
   * DENETIM KAYDI ZORUNLU.
   *
   * Uc bos donduguu icin panelin elinde baska hicbir kanit yok. Kimin,
   * hangi oyuncuyu, hangi tiple ortak yaptigi yalnizca burada duruyor.
   */
  audit(aktor, 'admin', 'affiliate_player_register', String(playerId),
    `Ortak kaydi gonderildi: ${userName} <${email}> tip=${affiliateType} ulke=${countryCode} site=${siteId}`);

  return { gonderildi: true, playerId, affiliateType };
}
