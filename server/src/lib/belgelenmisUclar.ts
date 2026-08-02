/**
 * `LynonApiDocs` ekraninda ELLE BELGELENMIS uc yollari.
 *
 * Amac tek: gozlenen giden trafigi bu listeyle karsilastirip
 * BELGESIZ uclari cikarmak. Liste dokumantasyonun kendisi degil,
 * dokumantasyonun KAPSAMI.
 *
 * ── Neden burada ──────────────────────────────────────────────────────
 *
 * Asil kaynak istemcideki `LYNON_ENDPOINTS_DATA`. Karsilastirmayi
 * sunucuda yapmak, "hangi ucler belgesiz" sorusunun cevabini tek bir
 * uctan alinabilir kilar; istemcinin binlerce kaydi indirip elemesi
 * gerekmez.
 *
 * Liste ile ekran birbirinden kayabilir. Bunu kabul ettim: alternatif
 * dokumantasyon metinlerini (baslik, aciklama, parametre tablolari)
 * sunucuya tasimakti ve orasi onlarin yeri degil. Kayma tek yonlu ve
 * zararsiz — belgelenmis bir uc buraya eklenmezse "belgesiz" gorunur,
 * yani hata guvenli tarafta: fazladan gosterir, gizlemez.
 */
import { sablonla } from './apiTrafik.js';

/**
 * Yollar `{...}` yer tutuculariyla yazili. Karsilastirma once
 * `sablonla` ile sayisal parcalari `{id}` yaptigi icin yer tutucu ADI
 * onemli degil; hepsi normalize ediliyor.
 */
const BELGELENMIS_YOLLAR = [
  '/api/bonusenginev2/api/v1/Campaign/site/{siteId}',
  '/api/bonusenginev2/api/v1/Campaign/{campaignId}',
  '/api/bonusenginev2/api/v1/Campaign/clone/{campaignId}',
  '/api/bonusenginev2/api/v1/Campaign/state/{campaignId}',
  '/api/bonusenginev2/api/v1/Campaign/site/{siteId}/assignable',
  '/api/bonusenginev2/api/v1/Bonus/campaign/{campaignId}',
  '/api/bonusenginev2/api/v1/Bonus/site/{siteId}/campaign/{campaignId}',
  '/api/bonusenginev2/api/v1/Block',
  '/api/bonusenginev2/api/v1/CampaignAssignment/site/{siteId}/player/{playerId}',
  '/api/cashbackengine/api/v1',
  '/api/freespin/api/v1',
  '/api/user/api/v1.0/userBackOffice/users/{userId}',
  '/api/platform/api/v1.0/BackofficeAccounts/{userId}',
  '/api/platform/api/v1.0/CorrectionHistory/sites/{siteId}',
  '/api/payment-operations/api/v1.0/BackOfficeTransactions',
  '/api/sportOperation/api/v1.0/sportBetEvent/players/{userId}/site/{siteId}',
  '/api/operation/api/v1.0/backOffices/players/{userId}/site/{siteId}',
  '/api/playerDataHub/api/v1.0/playerLogin/{userId}',
];

/** Yer tutucularin hepsini `{id}`'ye indirger; sorgu dizesini atar. */
function normalize(yol: string): string {
  const yolsuz = String(yol ?? '').split('?')[0];
  // Once bilinen yer tutucular, sonra kalan sayisal parcalar.
  return sablonla(yolsuz.replace(/\{[^}]+\}/g, '{id}')).toLowerCase();
}

const BELGELENMIS = new Set(BELGELENMIS_YOLLAR.map(normalize));

/**
 * Bu sablon belgelenmis mi?
 *
 * Tam URL verilebilir; koken (https://host) ve sorgu dizesi atilir.
 */
export function belgelenmisMi(url: string): boolean {
  const ham = String(url ?? '');
  let yol = ham;
  try {
    // Mutlak URL ise yalnizca yolu al.
    if (/^https?:\/\//i.test(ham)) yol = new URL(ham).pathname;
  } catch {
    // Ayristirilamayan URL oldugu gibi kullanilir.
  }
  return BELGELENMIS.has(normalize(yol));
}

export function belgelenmisYollar(): string[] {
  return [...BELGELENMIS_YOLLAR];
}
