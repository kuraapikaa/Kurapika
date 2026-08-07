import { lynonRequest } from '../lib/lynonAuth.js';
import { config } from '../config.js';
import { lynonCfg } from '../lib/tenantRuntimeConfig.js';

/**
 * LYNON THIRD-PARTY AFFILIATE ENTEGRASYONLARI.
 *
 * Lynon backoffice'inde `/websites/{siteId}/third-party-integrations/
 * affiliates` ekranı, sitenin bağlanabileceği harici affiliate
 * sistemlerinin katalogunu gösteriyor. Bu modül o katalogu okur.
 *
 * Buradaki bilgi, panelin kendi affiliate/CRM modülünü Lynon'a HARİCİ BİR
 * SAĞLAYICI olarak kaydettirmek için gerekli: hangi tip seçilecek ve o
 * tipin hangi yapılandırma anahtarlarını istediği.
 *
 * ÖNEMLİ EŞLEŞME: `affnook` tipinin istediği anahtarlar
 * (`ApiKey`, `ProductId`, `EndpointUrl`) bu depodaki BugsCRM
 * yapılandırmasıyla (`BUGSCRM_API_KEY`, `BUGSCRM_PRODUCT_ID`,
 * `BUGSCRM_ENDPOINT_URL`) BİREBİR aynı. Yani BugsCRM zaten Affnook
 * şeklinde tasarlanmış ve `/api/bugscrm/postback` ucu alıcı tarafı
 * uyguluyor. Kendi sistemimizi Lynon'a bağlamanın yolu bu tip.
 */

/** Gözlenen uç: GET {backoffice}/api/partner/api/v1.0/affiliates */
const KATALOG_YOLU = 'api/partner/api/v1.0/affiliates';

export interface LynonAffiliateSaglayici {
  id: number;
  type: string;
  name: string;
  description: string;
  iconUrl?: string;
  /** Sağlayıcının istediği yapılandırma alanları. Boş liste = alan istemiyor. */
  configKeys: string[];
}

export interface SaglayiciEslesmesi {
  saglayici: LynonAffiliateSaglayici;
  /** Panelin kendi entegrasyonu bu sağlayıcıyla aynı şekle sahip mi? */
  bizimkiyleEslesiyor: boolean;
  /** Eşleşiyorsa, elimizde hangi anahtarlar dolu? */
  hazirAnahtarlar: string[];
  eksikAnahtarlar: string[];
}

/** Panelin kendi affiliate entegrasyonunun (BugsCRM) sağladığı alanlar. */
function bizimAnahtarDegerlerimiz(): Record<string, string> {
  return {
    ApiKey: config.bugscrm.apiKey,
    ProductId: config.bugscrm.productId,
    EndpointUrl: config.bugscrm.endpointUrl,
  };
}

function normalize(satir: Record<string, unknown>): LynonAffiliateSaglayici {
  return {
    id: Number(satir.id ?? 0),
    type: String(satir.type ?? ''),
    name: String(satir.name ?? ''),
    description: String(satir.description ?? ''),
    iconUrl: satir.iconUrl ? String(satir.iconUrl) : undefined,
    configKeys: Array.isArray(satir.configKeys) ? satir.configKeys.map(String) : [],
  };
}

/**
 * Sağlayıcı ile bizim entegrasyonumuz aynı şekilde mi?
 *
 * Ada göre değil ANAHTAR KÜMESİNE göre karar veriliyor. Lynon tarafında
 * sağlayıcı adı değişebilir; entegrasyonu belirleyen şey hangi alanları
 * istediği. Bizim tarafta karşılığı olmayan bir anahtar varsa eşleşme
 * yok — eksik alanla kaydolmak, Lynon'un bize hiç postback göndermemesi
 * demek olurdu.
 */
function eslesmeHesapla(saglayici: LynonAffiliateSaglayici): SaglayiciEslesmesi {
  const bizim = bizimAnahtarDegerlerimiz();
  const bizimAnahtarlar = Object.keys(bizim);
  const eslesiyor =
    saglayici.configKeys.length > 0 &&
    saglayici.configKeys.length === bizimAnahtarlar.length &&
    saglayici.configKeys.every((k) => bizimAnahtarlar.includes(k));

  const hazir = saglayici.configKeys.filter((k) => (bizim[k] ?? '').trim() !== '');
  return {
    saglayici,
    bizimkiyleEslesiyor: eslesiyor,
    hazirAnahtarlar: hazir,
    eksikAnahtarlar: saglayici.configKeys.filter((k) => !hazir.includes(k)),
  };
}

export interface AffiliateEntegrasyonDurumu {
  siteId: number;
  /** Lynon backoffice'indeki ekranın adresi; panelden doğrudan açılabilsin. */
  backofficeEkraniUrl: string;
  saglayicilar: SaglayiciEslesmesi[];
  /** Bizim entegrasyonumuzla eşleşen sağlayıcı (varsa). */
  onerilenTip: string | null;
  /** Kendi postback ucumuz; Lynon tarafına `EndpointUrl` olarak girilir. */
  postbackUcumuz: string;
  postbackHazir: boolean;
}

export async function lynonAffiliateSaglayicilari(): Promise<LynonAffiliateSaglayici[]> {
  const cevap = await lynonRequest<unknown>(KATALOG_YOLU, { method: 'GET' });
  const satirlar = Array.isArray(cevap)
    ? cevap
    : Array.isArray((cevap as Record<string, unknown>)?.Result)
      ? (cevap as Record<string, unknown>).Result as unknown[]
      : [];
  return satirlar
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .map(normalize)
    .filter((s) => s.type !== '');
}

export async function affiliateEntegrasyonDurumu(kamuTabanUrl: string): Promise<AffiliateEntegrasyonDurumu> {
  const cfg = lynonCfg();
  const saglayicilar = (await lynonAffiliateSaglayicilari()).map(eslesmeHesapla);
  const eslesen = saglayicilar.find((s) => s.bizimkiyleEslesiyor) ?? null;

  return {
    siteId: cfg.siteId,
    backofficeEkraniUrl: `${cfg.backofficeBaseUrl.replace(/\/$/, '')}/websites/${cfg.siteId}/third-party-integrations/affiliates`,
    saglayicilar,
    onerilenTip: eslesen?.saglayici.type ?? null,
    postbackUcumuz: `${kamuTabanUrl.replace(/\/$/, '')}/api/bugscrm/postback`,
    // Postback ucu paylaşılan sır olmadan KAPALI çalışıyor; Lynon'a
    // adresi vermeden önce bunun açık olduğundan emin olunmalı.
    postbackHazir: Boolean(config.bugscrm.webhookSecret),
  };
}
