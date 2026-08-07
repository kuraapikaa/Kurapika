import { istanbulDateKey } from '../lib/istanbulGunu.js';
import { isLynonConfigured } from '../lib/lynonAuth.js';
import { eksikGunleriCek, type CekmeSonucu } from '../services/affiliateCrm/lynonCekme.js';

/**
 * Affiliate/CRM gunluk anlik goruntu isi.
 *
 * Panel bugune kadar Lynon'dan istek aninda ozet cekip HICBIR YERE
 * yazmiyordu. "Dun ne oldu" sorusu cevaplaniyordu ama "bu ortak son 30
 * gunde buyudu mu" sorusu asla cevaplanamiyordu -- gecmis hicbir zaman
 * kaydedilmiyordu. Geriye donuk uretilemeyen tek sey bu: bugun
 * yazmazsak o gun sonsuza kadar kayip.
 *
 * Saatte bir calisir. Gun ici tekrar cekmek zararsiz cunku yazma
 * idempotent; gun kapanmadan once de rakam gorulebiliyor.
 */
export async function runAffiliateCrmJob(tenantKey: string, simdi = new Date()): Promise<CekmeSonucu | null> {
  if (!isLynonConfigured()) return null;
  return eksikGunleriCek(tenantKey, { bugun: istanbulDateKey(simdi) }, simdi);
}
