/**
 * Proxy Modülü — Barrel Re-Export
 *
 * Eski import yollarını korumak için tüm proxy fonksiyonlarını
 * tek noktadan re-export eder:
 *
 *   import { proxyDashboard, proxyClientsPost } from '../lib/proxy.js';
 *
 * Modüller:
 *   proxy/dashboard.ts  → Dashboard API proxy'leri
 *   proxy/backoffice.ts → Backoffice, Bonus, Client, Rapor proxy'leri
 *   httpClient.ts       → Retry + Circuit Breaker altyapısı
 */

// Dashboard API
export {
  proxyDashboard,
  proxyPostToUrl,
  proxyDashboardPost,
  proxyToPath,
} from './proxy/dashboard.js';

// Backoffice API
export {
  proxyBonusPost,
  proxyFreeBetPost,
  proxyClientsPost,
  proxyClientsByIP,
  proxyClientKpi,
  proxyClientNotes,
  proxyClientBonuses,
  proxyClientTransactions,
  fetchBackofficeClientTransactions,
  proxyWithdrawalPost,
  proxyDepositsPost,
  proxyRegistrationStats,
  proxyBetReportPost,
  proxyBetSelectionsPost,
  proxyDetailedReport,
  proxyClientTurnoversPaging,
  proxyTournamentReportPost,
  proxyChargeBonus,
  proxyManualAdjustment,
  proxyGetPartnerBonuses,
  proxySmsSend,
} from './proxy/backoffice.js';

// Shared sabitler — httpClient'tan
export {
  DASHBOARD_HEADERS,
  BACKOFFICE_HEADERS,
  UNAUTHORIZED_HINT,
  FORBIDDEN_HINT,
  backofficeHeaders,
  dashboardHeaders,
  getCircuitBreakerStatus,
} from './httpClient.js';
