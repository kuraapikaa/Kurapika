import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const configDir = dirname(fileURLToPath(import.meta.url));
for (const envPath of [
  resolve(process.cwd(), '.env'),
  resolve(configDir, '..', '.env'),
  resolve(configDir, '..', '..', '.env'),
]) {
  if (existsSync(envPath)) dotenv.config({ path: envPath, override: true });
}

/**
 * Uygulama yapılandırması. Ortam değişkenleri ile override edilebilir.
 */
export const config = {
  port: Number(process.env.PORT) || 3750,
  nodeEnv: process.env.NODE_ENV || 'development',

  api: {
    /** Dashboard API base (https kullanın). Örn: https://dashboardapi.betconstruct.com */
    baseUrl: process.env.DASHBOARD_API_BASE || 'https://dashboardapi.betconstruct.com',
    /** Dashboard endpoint ön eki. 404 alırsanız farklı path deneyin (örn. api/tr/Report). */
    dashboardPathPrefix: process.env.DASHBOARD_API_PATH_PREFIX || 'api/tr/Dashboard',
    /** GetPartnerProfit/GetPartnerProfitDetails için path (404 alıyorsanız örn. api/tr/Report). */
    partnerProfitPathPrefix: process.env.DASHBOARD_PARTNER_PROFIT_PATH_PREFIX || undefined,
    /** GetPartnerProfit tam URL (404 alıyorsanız backoffice F12→Network’ten çalışan URL’i buraya yapıştırın). */
    partnerProfitUrl: process.env.DASHBOARD_PARTNER_PROFIT_URL || undefined,
    /** GetPartnerProfitDetails tam URL (isteğe bağlı). */
    partnerProfitDetailsUrl: process.env.DASHBOARD_PARTNER_PROFIT_DETAILS_URL || undefined,
    authToken: (process.env.DASHBOARD_AUTH || process.env.AUTH_TOKEN || '').trim(),
    /** Backoffice (GetClients, FreeBet, Withdrawal) için ayrı token. Yoksa api.authToken kullanılır. */
    backofficeAuthToken: (
      process.env.BACKOFFICE_AUTH ||
      process.env.DASHBOARD_AUTH ||
      process.env.AUTH_TOKEN ||
      ''
    ).trim(),
    timeoutMs: Number(process.env.API_TIMEOUT_MS) || 15000,
    maxDateRangeDays: Number(process.env.MAX_DATE_RANGE_DAYS) || 366,
  },
  /** Lynon / tacobahis backoffice gateway. Credentials are read only from env. */
  lynon: {
    enabled: !['0', 'false', 'no', 'off'].includes(String(process.env.LYNON_ENABLED ?? '').trim().toLowerCase()),
    backofficeBaseUrl: process.env.LYNON_BACKOFFICE_BASE_URL || 'https://backoffice.tacobahis.com',
    idBaseUrl: process.env.LYNON_ID_BASE_URL || 'https://id.tacobahis.com',
    returnUrl: process.env.LYNON_RETURN_URL || `${process.env.LYNON_BACKOFFICE_BASE_URL || 'https://backoffice.tacobahis.com'}/`,
    siteId: Number(process.env.LYNON_SITE_ID || process.env.SITE_ID) || 137,
    currency: process.env.LYNON_CURRENCY || process.env.DEFAULT_CURRENCY || 'TRY',
    username: (
      process.env.LYNON_PANEL_USERNAME ||
      process.env.BACKOFFICE_PANEL_USERNAME ||
      process.env.PANEL_USERNAME ||
      ''
    ).trim(),
    password: (
      process.env.LYNON_PANEL_PASSWORD ||
      process.env.BACKOFFICE_PANEL_PASSWORD ||
      process.env.PANEL_PASSWORD ||
      ''
    ).trim(),
    otpSecret: (
      process.env.LYNON_PANEL_OTP_SECRET ||
      process.env.BACKOFFICE_PANEL_OTP_SECRET ||
      process.env.PANEL_OTP_SECRET ||
      ''
    ).trim(),
    otpToken: (
      process.env.LYNON_PANEL_OTP_TOKEN ||
      process.env.BACKOFFICE_PANEL_OTP_TOKEN ||
      process.env.PANEL_OTP_TOKEN ||
      ''
    ).trim(),
    deviceFingerprint: (
      process.env.LYNON_DEVICE_FINGERPRINT ||
      process.env.BACKOFFICE_DEVICE_FINGERPRINT ||
      ''
    ).trim(),
    trustDevice: ['1', 'true', 'yes', 'on'].includes(String(process.env.LYNON_TRUST_DEVICE || '').trim().toLowerCase()),
    otpAlgorithm: (process.env.LYNON_OTP_ALGORITHM || 'SHA1').trim().toUpperCase(),
    otpDigits: Number(process.env.LYNON_OTP_DIGITS) || 6,
    otpPeriodSeconds: Number(process.env.LYNON_OTP_PERIOD_SECONDS) || 30,
    sessionTtlMs: Number(process.env.LYNON_SESSION_TTL_MS) || 1000 * 60 * 25,
    timeoutMs: Number(process.env.LYNON_API_TIMEOUT_MS) || Number(process.env.API_TIMEOUT_MS) || 15000,
  },
  sms: {
    token: process.env.SEMPICO_TOKEN || '',
    senderId: process.env.SEMPICO_SENDER_ID || 'SMS',
    apiUrl: 'https://api.sempico.solutions/send',
  },
  /** Telegram Bonusu: kanal/grup üyeliğini gerçek zamanlı doğrulamak için Bot API. */
  telegram: {
    botToken: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    botUsername: (process.env.TELEGRAM_BOT_USERNAME || '').trim(),
    webhookSecret: (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim(),
    /**
     * Anlık rapor botunun varsayılan sohbeti. BOŞSA VE akışın kendi
     * sohbeti de yoksa o akış susar — varsayılan bir sohbet kimliği
     * uydurmak, kasa raporunu yanlış yere göndermek demektir.
     */
    raporChatId: (process.env.TELEGRAM_RAPOR_CHAT_ID || '').trim(),
    /**
     * AKIŞ BAŞINA SOHBET.
     *
     * Yatırım, onaylanan çekim, reddedilen çekim ve kasa özeti farklı
     * ekipleri ilgilendiriyor; hepsini tek sohbete dökmek her birini
     * okunamaz yapıyordu. Tanımlanmayan akış `raporChatId`'ye düşer,
     * o da boşsa akış çalışmaz.
     */
    raporChatIdleri: {
      yatirim: (process.env.TELEGRAM_CHAT_YATIRIM || '').trim(),
      /**
       * TEK ÇEKİM GRUBU.
       *
       * Onay ve ret ayrı gruplara bölündüğünde karar veren kişi iki
       * pencere arasında gidip geliyordu: talep bir grupta, sonucu
       * başka grupta. Tanımlıysa çekimle ilgili HER ŞEY buraya gider —
       * talep, butonlar ve sonuç.
       *
       * Aşağıdaki ayrık kimlikler geriye dönük uyumluluk için duruyor;
       * yalnızca bu boşsa kullanılırlar.
       */
      cekim: (process.env.TELEGRAM_CHAT_CEKIM || '').trim(),
      cekimOnay: (process.env.TELEGRAM_CHAT_CEKIM_ONAY || '').trim(),
      cekimRed: (process.env.TELEGRAM_CHAT_CEKIM_RED || '').trim(),
      kasa: (process.env.TELEGRAM_CHAT_KASA || '').trim(),
      /**
       * Yöntem bazında GÜNLÜK kasa durumu (mutabakat değil, anlık).
       * Boşsa `kasa` sohbetine düşer — ayrı bir grup zorunlu değil.
       */
      kasaYontem: (process.env.TELEGRAM_CHAT_KASA_YONTEM || '').trim(),
      correction: (process.env.TELEGRAM_CHAT_CORRECTION || '').trim(),
      bonus: (process.env.TELEGRAM_CHAT_BONUS || '').trim(),
    },
    /** Kasa özetinin gönderilme sıklığı. 0 = özet kapalı, olaylar devam eder. */
    raporOzetAralikMs: Number(process.env.TELEGRAM_RAPOR_OZET_MS) || 20 * 60 * 1000,
    /** Aylık mutabakatın gönderileceği tek sohbet. Boşsa mutabakat gönderilmez. */
    mutabakatChatId: (process.env.TELEGRAM_CHAT_MUTABAKAT || '').trim(),
    /** Olay taraması sıklığı. */
    raporAralikMs: Number(process.env.TELEGRAM_RAPOR_ARALIK_MS) || 60_000,
    /** Anlık oyuncu bakiye özetinin gönderilme sıklığı (rapor 1843). */
    bakiyeOzetiAralikMs: Number(process.env.TELEGRAM_BAKIYE_OZET_MS) || 7.5 * 60 * 1000,
    /** Anlık oyuncu bakiye özetinin gönderileceği sohbet. Boşsa gönderilmez. */
    bakiyeOzetiChatId: (process.env.TELEGRAM_CHAT_BAKIYE || '').trim(),
  },
  /**
   * Hedef bakiye kilidi.
   *
   * 100 FS Telegram Katıl Bonusu alan oyuncunun bakiyesi eşiği geçtiğinde
   * bahis yetkisi kapanır. Çekim ve yatırım ASLA kapatılmaz.
   */
  hedefBakiye: {
    aktif: process.env.HEDEF_BAKIYE_KILIDI !== '0',
    /** 1 ise karar verilir, loglanır ama Lynon'a yazılmaz. */
    kuruCalisma: process.env.HEDEF_BAKIYE_KURU === '1',
    esik: Number(process.env.HEDEF_BAKIYE_ESIGI) || 2500,
    kisit: (process.env.HEDEF_BAKIYE_KISITI || 'casinoBet').trim(),
    kampanyaId: Number(process.env.TELEGRAM_FS_KAMPANYA_ID) || 1885,
    bonusId: Number(process.env.TELEGRAM_FS_BONUS_ID) || 1687,
    /** Kaç gün geriye bakılacağı; geçmişe dönük toplu kısıtlamayı engeller. */
    gunPenceresi: Number(process.env.HEDEF_BAKIYE_GUN) || 3,
    aralikMs: Number(process.env.HEDEF_BAKIYE_ARALIK_MS) || 60_000,
    /** Tek turda kaç oyuncunun bakiyesi okunur; uca yüklenmemek için. */
    turBasinaOyuncu: Number(process.env.HEDEF_BAKIYE_TUR_LIMITI) || 40,
  },
  /** Bonus listesi: POST rgs-webadminapi.betconstruct.com/api/Bonus/GetBonusDefinitions */
  bonusApi: {
    baseUrl: process.env.BONUS_API_BASE || 'https://rgs-webadminapi.betconstruct.com',
    path: process.env.BONUS_API_PATH || 'api/Bonus/GetBonusDefinitions',
  },
  /** FreeBet bonusları: POST backofficewebadmin.betconstruct.com/api/tr/Reference/GetFreeBetBonusesByFilter */
  freebetApi: {
    baseUrl: process.env.FREEBET_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.FREEBET_API_PATH || 'api/tr/Reference/GetFreeBetBonusesByFilter',
  },
  /** Bütün oyuncular: POST backofficewebadmin.betconstruct.com/api/tr/Client/GetClients */
  clientsApi: {
    baseUrl: process.env.CLIENTS_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.CLIENTS_API_PATH || 'api/tr/Client/GetClients',
  },
  /** Kayıt İstatistikleri: POST backofficewebadmin.betconstruct.com/api/tr/Client/GetClientRegistrationStatistics */
  registrationStatsApi: {
    baseUrl: process.env.REGISTRATION_STATS_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.REGISTRATION_STATS_API_PATH || 'api/tr/Client/GetClientRegistrationStatistics',
  },
  /** Kayıt İstatistikleri Detayı: POST backofficewebadmin.betconstruct.com/api/tr/Client/GetClientRegistrationStatisticsDetails */
  registrationStatsDetailsApi: {
    baseUrl: process.env.REGISTRATION_STATS_DETAILS_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.REGISTRATION_STATS_DETAILS_API_PATH || 'api/tr/Client/GetClientRegistrationStatisticsDetails',
  },
  /** Oyuncu KPI Listesi (Raporluk): POST backofficewebadmin.betconstruct.com/api/tr/Client/GetClientKpis */
  clientKpisApi: {
    baseUrl: process.env.CLIENT_KPIS_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.CLIENT_KPIS_API_PATH || 'api/tr/Client/GetClientKpis',
  },
  /** Para çekme talepleri: POST backofficewebadmin.betconstruct.com/api/tr/Client/GetClientWithdrawalRequestsWithTotals */
  withdrawalApi: {
    baseUrl: process.env.WITHDRAWAL_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.WITHDRAWAL_API_PATH || 'api/tr/Client/GetClientWithdrawalRequestsWithTotals',
  },
  /** Para yatırmalar: POST backofficewebadmin.betconstruct.com/api/tr/Financial/GetDepositsWithdrawalsWithPaging */
  depositsApi: {
    baseUrl: process.env.DEPOSITS_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.DEPOSITS_API_PATH || 'api/tr/Financial/GetDepositsWithdrawalsWithPaging',
  },
  /** Oyuncu KPI Bilgileri: GET backofficewebadmin.betconstruct.com/api/tr/Client/GetClientKpi?id=... */
  clientKpiApi: {
    baseUrl: process.env.CLIENT_KPI_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.CLIENT_KPI_API_PATH || 'api/tr/Client/GetClientKpi',
  },
  /** Oyuncu Notları: POST backofficewebadmin.betconstruct.com/api/tr/Client/GetClientNotes */
  clientNoteApi: {
    baseUrl: process.env.CLIENT_NOTE_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.CLIENT_NOTE_API_PATH || 'api/tr/Client/GetClientNotes',
  },
  /** Oyuncu Bonusları: POST backofficewebadmin.betconstruct.com/api/tr/Client/GetClientBonuses */
  clientBonusesApi: {
    baseUrl: process.env.CLIENT_BONUSES_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.CLIENT_BONUSES_API_PATH || 'api/tr/Client/GetClientBonuses',
  },
  /** Oyuncu İşlemleri (V1): POST backofficewebadmin.betconstruct.com/api/tr/Client/GetClientTransactionsV1 */
  clientProfileTransactionsApi: {
    baseUrl: process.env.CLIENT_PROFILE_TRANSACTIONS_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.CLIENT_PROFILE_TRANSACTIONS_API_PATH || 'api/tr/Client/GetClientTransactionsV1',
  },
  /** Oyuncu İşlemleri: POST backofficewebadmin.betconstruct.com/api/tr/Financial/GetDocumentsWithPaging */
  clientTransactionsApi: {
    baseUrl: process.env.CLIENT_TRANSACTIONS_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.CLIENT_TRANSACTIONS_API_PATH || 'api/tr/Financial/GetDocumentsWithPaging',
  },
  /** Detaylı Oyuncu Raporu: POST backofficewebadmin.betconstruct.com/api/tr/Report/GetClientTurnoverReportWithActiveBonus */
  detailedReportApi: {
    baseUrl: process.env.DETAILED_REPORT_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.DETAILED_REPORT_API_PATH || 'api/tr/Report/GetClientTurnoverReportWithActiveBonus',
  },
  /** Bahis Raporu: POST backofficewebadmin.betconstruct.com/api/tr/Report/GetBetReport */
  betReportApi: {
    baseUrl: process.env.BET_REPORT_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.BET_REPORT_API_PATH || 'api/tr/Report/GetBetReport',
  },
  /** Bahis seçimleri: POST backofficewebadmin.betconstruct.com/api/tr/Sport/GetBetSelections */
  betSelectionsApi: {
    baseUrl: process.env.BET_SELECTIONS_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.BET_SELECTIONS_API_PATH || 'api/tr/Sport/GetBetSelections',
  },
  /** Aynı IP'den bağlanan oyuncular: POST backofficewebadmin.betconstruct.com/api/tr/Client/GetClientsByIPAddress */
  clientsByIPApi: {
    baseUrl: process.env.CLIENTS_BY_IP_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.CLIENTS_BY_IP_API_PATH || 'api/tr/Client/GetClientsByIPAddress',
  },
  /** Oyuncu Turnover Raporu (Dashboard özet için): POST backofficewebadmin.betconstruct.com/api/tr/Report/GetClientTurnoversPaging */
  clientTurnoversApi: {
    baseUrl: process.env.CLIENT_TURNOVERS_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.CLIENT_TURNOVERS_API_PATH || 'api/tr/Report/GetClientTurnoversPaging',
  },
  /** Turnuva Raporu (Player Report): POST rgs-webadminapi.betconstruct.com/api/Reporting/getReportByPlayer */
  tournamentReportApi: {
    baseUrl: process.env.TOURNAMENT_REPORT_API_BASE || 'https://rgs-webadminapi.betconstruct.com',
    path: process.env.TOURNAMENT_REPORT_API_PATH || 'api/Reporting/getReportByPlayer',
  },
  /** Oyuncu Giriş Kayıtları: POST backofficewebadmin.betconstruct.com/api/tr/Client/GetLogins */
  loginsApi: {
    baseUrl: process.env.LOGINS_API_BASE || 'https://backofficewebadmin.betconstruct.com',
    path: process.env.LOGINS_API_PATH || 'api/tr/Client/GetLogins',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : true),
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 200,
  },
  /** Otomatik çekim kontrolü aralığı (ms). 0 = kapalı. Varsayılan: kapalı (0). */
  autoWithdrawIntervalMs: Number(process.env.AUTO_WITHDRAW_INTERVAL_MS) || 0,
  /** Promosyonlar (çekim checklist): harici CMS base URL ENV ile verilir. */
  promosApi: {
    baseUrl: process.env.PROMOS_API_BASE || '',
    path: process.env.PROMOS_API_PATH || 'promotions',
    query: process.env.PROMOS_API_QUERY || 'paginate=1&limit=100&use_webp=1&platform=0&category=all&with_meta=1&country=',
    timeoutMs: Number(process.env.PROMOS_API_TIMEOUT_MS) || 15000,
  },
} as const;

export type Config = typeof config;
