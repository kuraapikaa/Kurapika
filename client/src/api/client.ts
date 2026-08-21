import type {
  ApiResponse,
  SummaryData,
  PartnerProfitData,
  TopSportItem,
  TopCasinoGameItem,
  SportbookOverviewData,
  BonusListResponse,
  FreeBetBonusResponse,
  GetClientsResponse,
  WithdrawalRequestsResponse,
  DepositsResponse,
  GetClientKpiResponse,
  GetClientNotesResponse,
  GetClientBonusesResponse,
  GetClientTransactionsResponse,
  GetClientProfileTransactionsResponse,
  GetDetailedReportResponse,
  GetBetReportResponse,
  GetBetSelectionsResponse,
  GetRegistrationStatsResponse,
  GetRegistrationStatsDetailsResponse,
  GetProviderReportResponse,
} from '../types/dashboard';
import type { PromosListResponse } from '../types/promos';

const API_BASE = '/api';

async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ApiError(res.ok ? 'Geçersiz yanıt (JSON değil).' : `Sunucu: ${res.status} ${res.statusText}`, res.status);
  }
}

/**
 * Sunucunun hata metnini bulur.
 *
 * `message` alani eksikti: oyun uclari (cark, kazi-kazan, gunluk gorev...)
 * hatayi `{ ok: false, message: "..." }` bicminde donuyor. Okunmadigi icin
 * "Gunluk cark hakkinizi kullandiniz" gibi aciklamalar dusuyor ve yerine
 * ham `res.statusText` ("Too Many Requests") geciyordu; arayuz de bunu
 * yakalayip "Oturumunuz suresi dolmus olabilir" diye gosteriyordu.
 */
function hataMesaji(json: Record<string, unknown>, res: Response): string {
  return (
    (json.ErrorDescription as string) ||
    (json.AlertMessage as string) ||
    (json.message as string) ||
    res.statusText
  );
}

/**
 * GEÇİCİ ÖNLEM — Cloudflare kimlik yanıtlarını önbelleğe alıyor.
 *
 * Sunucu doğru başlıkları gönderiyor:
 *   Cache-Control: no-store, no-cache, must-revalidate, private
 *   Vary: Cookie, Accept-Encoding
 *
 * Cloudflare bunları YOK SAYIYOR. Canlıda ölçüldü: aynı URL'ye farklı
 * çerezle atılan istek `cf-cache-status: HIT` alıyor, yani bir oyuncu
 * diğerinin yanıtını görüyor. Lobide "son giren oyuncunun oturumu
 * görünüyor" şikayeti bu.
 *
 * Cloudflare kenarında önbellek kuralı ezildiği için origin'den kapatmak
 * yetmiyor. Her isteği benzersiz URL yaparak önbelleği atlıyoruz: eşleşecek
 * bir anahtar olmayınca kenar her zaman origin'e gidiyor.
 *
 * Bu ÇÖZÜM DEĞİL, zarar azaltma. Kalıcı çözüm Cloudflare'de /api/* için
 * "Bypass cache" kuralı. O yapıldığında bu satır kaldırılmalı — aksi halde
 * gerçekten önbelleklenebilir uçlar da (ör. /api/games/config) boşuna
 * origin'e gidiyor.
 */
function onbellekKirici(): string {
  return `_cb=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const sorgu = new URLSearchParams(params);
  sorgu.set('_cb', onbellekKirici().slice(4));
  const url = `${API_BASE}${path}?${sorgu}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cache: 'no-store',
    credentials: 'include'
  });
  const json = await parseJsonResponse(res);
  if (!res.ok) {
    throw new ApiError(hataMesaji(json, res), res.status);
  }
  return json as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isUnauthorized(): boolean {
    return this.status === 401 || /unauthorized/i.test(this.message);
  }
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const json = await parseJsonResponse(res);
  if (!res.ok) {
    throw new ApiError(hataMesaji(json, res), res.status);
  }
  return json as T;
}



async function put<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const json = await parseJsonResponse(res);
  if (!res.ok) {
    throw new ApiError(hataMesaji(json, res), res.status);
  }
  return json as T;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const json = await parseJsonResponse(res);
  if (!res.ok) {
    throw new ApiError(hataMesaji(json, res), res.status);
  }
  return json as T;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

const q = (d: DateRange) => ({ startDate: d.startDate, endDate: d.endDate });

export const dashboardApi = {
  summary: (d: DateRange) =>
    post<ApiResponse<SummaryData>>('/summary', q(d)),

  narcosKpi: (d: DateRange) =>
    post<ApiResponse<any>>('/narcos-kpi', { ...q(d), currency: 'TRY' }),

  partnerProfit: (d: DateRange) =>
    post<ApiResponse<PartnerProfitData>>('/partner-profit', q(d)),

  partnerProfitDetails: (d: DateRange) =>
    post<ApiResponse<any>>('/partner-profit-details', q(d)),

  affiliateSummary: (d: DateRange) =>
    post<ApiResponse<any>>('/affiliate-summary', q(d)),

  topSports: (d: DateRange) =>
    post<ApiResponse<TopSportItem[]>>('/top-sports', {
      ...q(d),
      topRecordsCount: '5',
      ordertype: 'true',
    }),

  topCasinoGames: (d: DateRange) =>
    post<ApiResponse<TopCasinoGameItem[]>>('/top-casino-games', {
      ...q(d),
      topRecordsCount: '5',
      ordertype: 'true',
    }),

  sportbookOverview: (d: DateRange) =>
    post<ApiResponse<SportbookOverviewData>>('/sportbook-overview', q(d)),

  deposits: (dateRange: DateRange) =>
    post<DepositsResponse>('/deposits', getDefaultDepositsRequestBody(dateRange)),

  bonuses: (body?: Record<string, unknown>) =>
    post<BonusListResponse>('/bonuses', body ?? getDefaultBonusRequestBody()),

  /** Aktif (StateType: 1) ve inaktif (StateType: 0) bonusları ayrı isteklerle çekip birleştirir. */
  freebetBonuses: (body?: Record<string, unknown>) =>
    post<FreeBetBonusResponse>('/freebet-bonuses', body ?? {}),

  bonusesAll: async (): Promise<BonusListResponse> => {
    const body = getDefaultBonusRequestBody();
    const [activeRes, inactiveRes] = await Promise.all([
      post<BonusListResponse>('/bonuses', { ...body, StateType: 1 }),
      post<BonusListResponse>('/bonuses', { ...body, StateType: 0 }),
    ]);
    const activeList = activeRes.Result ?? [];
    const inactiveList = inactiveRes.Result ?? [];
    const merged: any[] = [...activeList];
    const seen = new Set(merged.map(b => b.Id));
    inactiveList.forEach(b => {
      if (!seen.has(b.Id)) merged.push(b);
    });

    return {
      Result: merged,
      HasError: activeRes.HasError || inactiveRes.HasError,
      ErrorDescription: activeRes.ErrorDescription || inactiveRes.ErrorDescription,
      ErrorId: activeRes.ErrorId ?? inactiveRes.ErrorId ?? 0,
      Count: merged.length,
    };
  },

  /** Bütün oyuncular: POST GetClients (body ile sayfalama/filtre) */
  clients: (body?: Record<string, unknown>) =>
    post<GetClientsResponse>('/clients', { ...getDefaultClientsRequestBody(), ...body }),

  /** Aynı IP'yi kullanan oyuncular: POST GetClientsByIPAddress */
  clientsByIP: (params: { LoginIP: string; ClientId?: number; SkeepRows?: number; MaxRows?: number }) =>
    post<GetClientsResponse>('/clients-by-ip', {
      LoginIP: params.LoginIP,
      ClientId: params.ClientId,
      SkeepRows: params.SkeepRows ?? 0,
      MaxRows: params.MaxRows ?? 50,
    }),

  /** Para çekme talepleri: POST GetClientWithdrawalRequestsWithTotals (tarih aralığı ile) */
  withdrawalRequests: (dateRange: DateRange) =>
    post<WithdrawalRequestsResponse>('/withdrawal-requests', getDefaultWithdrawalRequestBody(dateRange)),

  /** Çekim talebini onayla/reddet: POST /admin/withdrawals/:transactionId/resolve */
  resolveWithdrawal: (transactionId: number | string, status: 'rejected' | 'approved', amount: number, actualAmount?: number) =>
    post<{ HasError: boolean; AlertMessage?: string }>(`/admin/withdrawals/${transactionId}/resolve`, { status, amount, actualAmount }),

  /** Oyuncu KPI Bilgileri: GET GetClientKpi?id=... */
  clientKpi: (clientId: number) =>
    get<GetClientKpiResponse>('/client-kpi', { id: String(clientId) }),

  /** Bonus kuralları listesi (promotions-data.json). Otomatik çekim ve Bonus Kuralları sayfası. */
  promosList: () => get<PromosListResponse>('/promos/list'),
  promosAutoList: (includeUnconfigured = false) => get<PromosListResponse>('/promos/auto', includeUnconfigured ? { includeUnconfigured: 'true' } : undefined),

  /** Oyuncu Notları: POST GetClientNotes */
  clientNotes: (clientId: number) =>
    post<GetClientNotesResponse>('/client-notes', { ClientId: clientId, Type: null, FromDateLocal: null, ToDateLocal: null }),

  /** Oyuncu Bonusları: POST GetClientBonuses. options.FromDateLocal / ToDateLocal "DD-MM-YY - HH:mm:ss" formatında. */
  clientBonuses: (clientId: number, options?: { FromDateLocal?: string | null; ToDateLocal?: string | null }) =>
    post<GetClientBonusesResponse>('/client-bonuses', {
      ClientId: clientId,
      BonusType: null,
      FromDateLocal: options?.FromDateLocal ?? null,
      ToDateLocal: options?.ToDateLocal ?? null,
    }),

  /** İşlem Hareketleri: POST GetDocumentsWithPaging */
  clientTransactions: (options: {
    ClientId?: string;
    ClientLogin?: string;
    ExternalId?: string;
    Id?: string;
    AmountFrom?: string;
    AmountTo?: string;
    CashDeskId?: number | null;
    CurrencyId?: string;
    TypeId?: string;
    /** Lynon tür kodları (ör. 'financial.Bet', 'payment.deposit'). Sunucu yalnızca bunu okur. */
    DocumentTypeIds?: string[];
    UserName?: string;
    PaymentSystemId?: number | null;
    IsTest?: boolean | null;
    SkeepRows?: number;
    MaxRows?: number;
    dateRange?: DateRange;
  } = {}) => {
    const fromDate = options.dateRange ? toLocalDateTime(options.dateRange.startDate, '00:00:00') : "";
    const toDate = options.dateRange ? toLocalDateTime(options.dateRange.endDate, '23:59:59') : "";

    return post<GetClientTransactionsResponse>('/client-transactions', {
      ClientId: options.ClientId ?? "",
      AmountFrom: options.AmountFrom ?? "",
      AmountTo: options.AmountTo ?? "",
      CashDeskId: options.CashDeskId ?? null,
      ClientLogin: options.ClientLogin ?? "",
      CurrencyId: options.CurrencyId ?? "",
      DefaultCurrencyId: "TRY",
      ExternalId: options.ExternalId ?? "",
      FromCreatedDateLocal: fromDate,
      ToCreatedDateLocal: toDate,
      Id: options.Id ?? "",
      IsTest: options.IsTest ?? null,
      MaxRows: options.MaxRows ?? 100,
      PaymentSystemId: options.PaymentSystemId ?? null,
      SkeepRows: options.SkeepRows ?? 0,
      TypeId: options.TypeId ?? "",
      DocumentTypeIds: options.DocumentTypeIds ?? [],
      UserName: options.UserName ?? "",
      OrderedItem: 1,
      IsOrderedDesc: true
    });
  },

  /** Oyuncu spor bahisleri geçmişi: POST /client-bet-history */
  clientBetHistory: (clientId: number, options?: { SkeepRows?: number; MaxRows?: number; StartDateLocal?: string; EndDateLocal?: string }) =>
    post<GetBetReportResponse>('/client-bet-history', {
      ToCurrencyId: "TRY",
      byPassTotals: false,
      isCalcTime: false,
      filterBet: {
        ClientId: String(clientId),
        State: null,
        SkeepRows: options?.SkeepRows ?? 0,
        MaxRows: options?.MaxRows ?? 50,
        IsLive: null,
        BetTypes: [],
        StartDateLocal: options?.StartDateLocal ?? null,
        EndDateLocal: options?.EndDateLocal ?? null,
        BetId: null,
        CalcEndDateLocal: null,
        CalcStartDateLocal: null,
        CurrencyId: "TRY",
        IsBonusBet: null,
        OrderedItem: 9, // Created Date
        IsOrderedDesc: true
      },
      filterBetSelection: {
        SportId: null,
        RegionId: null,
        CompetitionId: null,
        MatchId: null
      },
      matchFilter: {
        currentSport: null,
        currentRegion: null,
        currentCompetition: null,
        currentMatch: null
      }
    }),

  /** Canlı Radar: Tüm site genelindeki spor bahisleri geçmişi: POST /site-bet-history */
  siteBetHistory: (options?: { SkeepRows?: number; MaxRows?: number; State?: number | null }) =>
    post<GetBetReportResponse>('/site-bet-history', {
      ToCurrencyId: "TRY",
      byPassTotals: false,
      isCalcTime: false,
      filterBet: {
        State: options?.State ?? null,
        SkeepRows: options?.SkeepRows ?? 0,
        MaxRows: options?.MaxRows ?? 100,
        IsLive: null,
        BetTypes: [],
        StartDateLocal: null,
        EndDateLocal: null,
        BetId: null,
        CalcEndDateLocal: null,
        CalcStartDateLocal: null,
        CurrencyId: null,
        IsBonusBet: null,
        IsOrderedDesc: true,
        OrderedItem: 9 // Created Date
      },
      filterBetSelection: {
        SportId: null,
        RegionId: null,
        CompetitionId: null,
        MatchId: null
      },
      matchFilter: {
        currentSport: null,
        currentRegion: null,
        currentCompetition: null,
        currentMatch: null
      }
    }),

  /** Casino Geçmişi (Slot, Live Casino vb.): POST /client-casino-history */
  clientCasinoHistory: (clientId: number, options?: { SkeepRows?: number; MaxRows?: number; StartDateLocal?: string; EndDateLocal?: string }) =>
    post<any>('/client-casino-history', {
      ClientId: clientId,
      State: null,
      SkeepRows: options?.SkeepRows ?? 0,
      MaxRows: options?.MaxRows ?? 50,
      StartDateLocal: options?.StartDateLocal ?? null,
      EndDateLocal: options?.EndDateLocal ?? null,
      OrderedItem: 1,
      IsOrderedDesc: true
    }),

  /** Oynanan bahis seçimleri: POST /client-bet-selections-history */
  clientBetSelectionsHistory: (betId: number, clientId?: number) =>
    post<GetBetSelectionsResponse>('/client-bet-selections-history', {
      BetId: betId,
      ClientId: clientId,
      Type: 1
    }),

  /** İşlem anomali analizi: son 7 gün veya verilen tarih aralığı. */
  transactionAnomalies: (dateRange: DateRange) =>
    post<{
      HasError: boolean;
      anomalies: Array<{
        type: string;
        clientId: number;
        clientLogin?: string;
        message: string;
        severity: 'low' | 'medium' | 'high';
        value?: number;
        date?: string;
        detail?: string;
      }>;
      summary: { totalProcessed: number; uniqueClients: number; anomalyCount: number; dateRange: { from: string; to: string } } | null;
    }>('/analytics/transaction-anomalies', {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),

  /** Oyuncu Profilindeki İşlem Hareketleri: POST /client-profile-transactions (V1). Tür filtresi: DocumentTypeIds (GetClientTransactionsV1). */
  clientProfileTransactions: (options: {
    ClientId: number;
    CurrencyId?: string;
    StartTimeLocal?: string; // DD-MM-YY
    EndTimeLocal?: string;   // DD-MM-YY
    DocumentTypeIds?: Array<number | string>; // Lynon type code veya legacy document type ID. Boş = tümü.
    SkeepRows?: number;
    MaxRows?: number;
  }) => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    return post<GetClientProfileTransactionsResponse>('/client-profile-transactions', {
      ByPassTotals: false,
      ClientId: options.ClientId,
      CurrencyId: options.CurrencyId || "TRY",
      DocumentTypeIds: Array.isArray(options.DocumentTypeIds) && options.DocumentTypeIds.length > 0 ? options.DocumentTypeIds : [],
      EndTimeLocal: options.EndTimeLocal || formatDateToDDMMYY(today),
      GameId: null,
      MaxRows: options.MaxRows || 100,
      PaymentSystemId: null,
      SkeepRows: options.SkeepRows || 0,
      StartTimeLocal: options.StartTimeLocal || formatDateToDDMMYY(thirtyDaysAgo),
      OrderedItem: 1,
      IsOrderedDesc: true
    });
  },
  /** Bahis Raporu: POST /bet-report (GetBetReport). Sayfalama için SkeepRows/MaxRows kullanın. */
  betReport: (dateRange?: DateRange, options?: { SkeepRows?: number; MaxRows?: number }) =>
    post<GetBetReportResponse>('/bet-report', getDefaultBetReportRequestBody(dateRange, options)),

  /** Bahis seçimleri: POST /bet-selections (GetBetSelections) */
  betSelections: (betId: number) =>
    post<GetBetSelectionsResponse>('/bet-selections', { BetId: betId, Type: 1 }),

  /** Detaylı Oyuncu Raporu: POST /client-detailed-report */
  clientDetailedReport: (options: {
    ClientId: number;
    StartTimeLocal?: string; // DD-MM-YY
    EndTimeLocal?: string;   // DD-MM-YY
    CurrencyId?: string;
    IsTest?: boolean | null;
  }) => {
    const today = new Date();
    return post<GetDetailedReportResponse>('/client-detailed-report', {
      ClientId: options.ClientId,
      CurrencyId: options.CurrencyId || null,
      EndTimeLocal: options.EndTimeLocal || formatDateToDDMMYY(today),
      IsTest: options.IsTest ?? null,
      StartTimeLocal: options.StartTimeLocal || formatDateToDDMMYY(today)
    });
  },
  /** Kayıt İstatistikleri: POST /registration-stats */
  registrationStats: (dateRange: DateRange) => {
    const endDate = new Date(dateRange.endDate);
    endDate.setDate(endDate.getDate() + 1);
    return post<GetRegistrationStatsResponse>('/registration-stats', {
      MinCreatedLocal: formatDateToDDMMYY(new Date(dateRange.startDate)),
      MaxCreatedLocal: formatDateToDDMMYY(endDate),
      ClientId: ""
    });
  },
  /** Kayıt İstatistikleri Detayı: POST /registration-stats-details */
  registrationStatsDetails: (dateRange: DateRange) => {
    const endDate = new Date(dateRange.endDate);
    endDate.setDate(endDate.getDate() + 1);
    return post<GetRegistrationStatsDetailsResponse>('/registration-stats-details', {
      MinCreatedLocal: formatDateToDDMMYY(new Date(dateRange.startDate)),
      MaxCreatedLocal: formatDateToDDMMYY(endDate),
    });
  },

  /** Sağlayıcı Raporu (GGR/NGR): POST /provider-report */
  providerReport: (dateRange: DateRange) => {
    const endDate = new Date(dateRange.endDate);
    endDate.setDate(endDate.getDate() + 1);
    return post<GetProviderReportResponse>('/provider-report', {
      FromDate: formatDateToDDMMYY(new Date(dateRange.startDate)),
      ToDate: formatDateToDDMMYY(endDate),
      PlayerState: 2,
      IsBonusBet: null,
      Offset: 0,
      Take: 100,
      OrderDir: "OrderByDescending",
      OrderKey: "BetAmountByReportCurrency"
    });
  },

  /**
   * Otomatik oyuncu kategorileme önerileri: POST /lynon/oyuncu-kategorileme
   *
   * Eşikler panelde değil, sitenin kendi kategori açıklamalarında tanımlı;
   * sunucu onları okuyup öneri üretir.
   */
  kategoriOnerileri: (secenek?: { MaxRows?: number; enrichLimit?: number }) =>
    post<any>('/lynon/oyuncu-kategorileme', secenek ?? {}),

  kategoriUygula: (playerId: number, kategoriId: number) =>
    post<any>('/lynon/oyuncu-kategorileme/uygula', { playerId, kategoriId }),

  /**
   * Manuel bakiye düzeltmeleri: POST /lynon/manuel-duzeltmeler
   *
   * Panelin denetim kaydı yalnızca panelden yapılanları görüyor; bu uç
   * Lynon arayüzünden elle yapılan hareketleri de, yapan yöneticiyle
   * birlikte getiriyor.
   */
  manuelDuzeltmeler: (dateRange: DateRange) =>
    post<any>('/lynon/manuel-duzeltmeler', { startDate: dateRange.startDate, endDate: dateRange.endDate }),

  /**
   * Aylık mutabakat: ayın başından bugüne ödeme yöntemi kırılımı.
   *
   * Rapor yalnızca ödeme sağlayıcılarından geçen parayı görüyor; elden
   * yapılan kalemler ayrı eklenir ve toplamda ayrı gösterilir.
   */
  mutabakat: () => post<any>('/lynon/mutabakat', {}),

  /** Kapanmış bir ayın kesin toplamı. `ay` ("YYYY-MM") verilmezse bir önceki ay. */
  mutabakatKapanis: (ay?: string) => post<any>('/lynon/mutabakat/kapanis', ay ? { ay } : {}),

  mutabakatKalemEkle: (kalem: { gun: string; tur: 'yatirim' | 'cekim'; tutar: number; aciklama: string; yontem?: string }) =>
    post<any>('/lynon/mutabakat/kalem', kalem),

  mutabakatKalemSil: (id: string) => del<any>(`/lynon/mutabakat/kalem/${encodeURIComponent(id)}`),

  /** `ay` verilirse o ayın KAPANIŞ raporu Telegram'a gider; yoksa ayın başından bugüne özet. */
  mutabakatGonder: (ay?: string) => post<any>('/lynon/mutabakat/gonder', ay ? { ay } : {}),

  /** Ödeme yöntemi başına ayarlar: komisyon oranı, teslimat kuralı, takviye eşiği. */
  mutabakatYontemAyarlari: () => get<{ ok: boolean; oranlar: YontemAyari[] }>('/lynon/mutabakat/komisyon-oranlari'),

  mutabakatYontemAyariKaydet: (girdi: Partial<YontemAyari> & { anahtar: string }) =>
    put<{ ok: boolean; oran: YontemAyari }>('/lynon/mutabakat/komisyon-oranlari', girdi),

  mutabakatYontemAyariSil: (anahtar: string) =>
    del<{ ok: boolean }>(`/lynon/mutabakat/komisyon-oranlari/${encodeURIComponent(anahtar)}`),

  /** Davranış kategorilerini oluştur (High Risk, Bonus Avcısı, VIP Üye, Aktif Üye). */
  davranisKategorileriniOlustur: () =>
    post<any>('/lynon/oyuncu-kategorileme/kategorileri-olustur', {}),

  /**
   * Çarkın GERÇEK olasılık davranışı — henüz kaydedilmemiş dilimler için.
   *
   * Panelde girilen olasılıkla motorun uyguladığı olasılık ayrışabiliyor:
   * teslim edilemeyecek dilimler çekilişten atılıyor ve payları kalanlara
   * dağılıyor. Kural tek yerde (sunucuda) tutuluyor; kopyalanan bir
   * istemci sürümü çekiliş motorundan zamanla ayrışırdı.
   */
  carkAnalizi: (wheel: unknown[]) => post<any>('/admin/games/wheel/analiz', { wheel }),

  /** Bahis kısıtını aç/kapat: POST /lynon/oyuncu-kisitlari/:userId */
  oyuncuKisitiYaz: (userId: number | string, restriction: string, isRestricted: boolean, note?: string) =>
    post<any>(`/lynon/oyuncu-kisitlari/${userId}`, { restriction, isRestricted, note }),

  /** Hedef bakiye taramasını elle çalıştır. */
  hedefBakiyeTara: () => post<any>('/lynon/hedef-bakiye/tara', {}),

  /** Kasa özetini şimdi Telegram'a gönder. */
  telegramKasaOzeti: () => post<any>('/lynon/telegram-rapor/ozet', {}),

  /** Tüm Oyuncuların Bonus Raporu: POST /client-bonus-report */
  bonusReport: (dateRange: DateRange) =>
    post<any>('/client-bonus-report', {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      PartnerBonusStartDateLocal: toLocalDateTime(dateRange.startDate, '00:00:00'),
      PartnerBonusEndDateLocal: toLocalDateTime(dateRange.endDate, '23:59:59'),
      MaxRows: 15000,
      SkeepRows: 0,
      ByPassTotals: false,
      ClientBonusId: '',
      ClientId: null,
      PartnerBonusId: '',
      AcceptanceType: null,
      BonusType: null,
      ResultType: null,
      IsTest: null,
      ResultFromDateLocal: null,
      ResultToDateLocal: null,
      StartDateLocal: null,
      EndDateLocal: null,
      ToCurrencyId: 'TRY',
      SportsbookProfileId: null,
      Source: null,
    }),
  /** Oyuncu Turnover Raporu (Dashboard özet için): POST /client-turnover-paging */
  clientTurnoverPaging: (dateRange: DateRange, options?: { SkeepRows?: number; MaxRows?: number; ClientId?: string }) => {
    return post<any>('/client-turnover-paging', {
      ByPassTotals: false,
      ClientId: options?.ClientId ?? "",
      CurrencyId: null,
      EndTimeLocal: formatDateToDDMMYY(new Date(dateRange.endDate)),
      IsTest: false,
      LoyaltyLevelId: null,
      MaxRows: options?.MaxRows ?? 10,
      PromoCode: "",
      SkeepRows: options?.SkeepRows ?? 0,
      StartTimeLocal: formatDateToDDMMYY(new Date(dateRange.startDate)),
    });
  },

  partnerBonusList: (body?: any) => post<any>('/admin/bonus/partner-list', body),
};

/** YYYY-MM-DD → "DD-MM-YY - HH:mm:ss" (API FromDateLocal / ToDateLocal formatı) */
function toLocalDateTime(ymd: string, time: string): string {
  const [y, m, d] = ymd.split('-');
  if (!d) return `${ymd} - ${time}`;
  const yy = y.length === 4 ? y.slice(-2) : y;
  return `${d}-${m}-${yy} - ${time}`;
}

function formatDateToDDMMYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return `${d}-${m}-${y}`;
}



function getDefaultWithdrawalRequestBody(dateRange: DateRange): Record<string, unknown> {
  return {
    ClientId: '',
    MinAmount: null,
    MaxAmount: null,
    ClientLogin: '',
    Email: '',
    Id: null,
    RegionId: null,
    BetShopId: '',
    ByAllowDate: false,
    ClientSportsbookProfileId: null,
    CurrencyId: null,
    FromDateLocal: toLocalDateTime(dateRange.startDate, '00:00:00'),
    ToDateLocal: toLocalDateTime(dateRange.endDate, '23:59:59'),
    IsTest: '',
    PartnerClientCategoryId: '',
    PaymentTypeIds: [],
    StateList: [],
    OrderedItem: 1,
    IsOrderedDesc: true,
  };
}

function getDefaultClientsRequestBody(): Record<string, unknown> {
  return {
    Id: '',
    FirstName: '',
    LastName: '',
    PersonalId: '',
    Email: '',
    Phone: '',
    ZipCode: null,
    AMLRisk: '',
    AffilateId: null,
    AffiliatePlayerType: null,
    BTag: null,
    BetShopGroupId: '',
    BirthDate: null,
    CashDeskId: null,
    CasinoProfileId: null,
    CasinoProfitnessFrom: null,
    CasinoProfitnessTo: null,
    City: '',
    ClientCategory: null,
    CurrencyId: null,
    DocumentNumber: '',
    ExternalId: '',
    Gender: null,
    IBAN: null,
    IsEmailSubscribed: null,
    IsOrderedDesc: true,
    IsSMSSubscribed: null,
    IsSelfExcluded: null,
    IsStartWithSearch: false,
    IsTest: null,
    IsVerified: null,
    Login: '',
    MaxBalance: null,
    MaxCreatedLocal: null,
    MaxCreatedLocalDisable: true,
    MaxFirstDepositDateLocal: null,
    MaxLastTimeLoginDateLocal: null,
    MaxLastWrongLoginDateLocal: null,
    MaxLoyaltyPointBalance: null,
    MaxRows: 20,
    MaxVerificationDateLocal: null,
    MaxWrongLoginAttempts: null,
    MiddleName: '',
    MinBalance: null,
    MinCreatedLocal: null,
    MinCreatedLocalDisable: true,
    MinFirstDepositDateLocal: null,
    MinLastTimeLoginDateLocal: null,
    MinLastWrongLoginDateLocal: null,
    MinLoyaltyPointBalance: null,
    MinVerificationDateLocal: null,
    MinWrongLoginAttempts: null,
    MobilePhone: '',
    NickName: '',
    OrderedItem: 1,
    OwnerId: null,
    PartnerClientCategoryId: null,
    RegionId: null,
    RegistrationSource: null,
    SelectedPepStatuses: '',
    SkeepRows: 0,
    SportProfitnessFrom: null,
    SportProfitnessTo: null,
    Status: null,
    Time: '',
    TimeZone: '',
    IsLocked: null,
  };
}

function getDefaultBonusRequestBody(): Record<string, unknown> {
  return {
    BonusName: '',
    ExternalId: null,
    FromDate: null,
    Id: null,
    Limit: 1000,
    MaxRows: 1000,
    Offset: 0,
    Periods: [],
    ProductTypeId: null,
    SkeepRows: 0,
    StateType: 1,
    ToDate: null,
    TypeId: null,
  };
}

function getDefaultBetReportRequestBody(
  dateRange?: DateRange,
  options?: { SkeepRows?: number; MaxRows?: number }
): Record<string, unknown> {
  const startDateLocal = dateRange
    ? toLocalDateTime(dateRange.startDate, '00:00:00')
    : null;
  const endDateLocal = dateRange
    ? toLocalDateTime(dateRange.endDate, '23:59:59')
    : null;
  return {
    ToCurrencyId: 'TRY',
    byPassTotals: false,
    isCalcTime: false,
    filterBet: {
      AmountFrom: null,
      AmountTo: null,
      WinningAmountFrom: null,
      WinningAmountTo: null,
      BetTypes: [],
      BarCode: null,
      BetId: null,
      BetShopGroupId: null,
      BetshopId: null,
      BonusTypeId: '',
      CalcEndDateLocal: null,
      CalcStartDateLocal: null,
      CashDeskId: null,
      ClientBetShopGroupId: null,
      ClientCashdeskId: '',
      ClientExternalId: '',
      ClientId: '',
      ClientLogin: null,
      ClientLoginIp: '',
      CurrencyId: null,
      EndDateLocal: endDateLocal,
      ExternalId: null,
      InfoBetshopId: '',
      InfoCashDeskId: '',
      IsBonusBet: null,
      IsCashDeskPaid: null,
      IsClientWithBetShop: null,
      IsLive: null,
      IsOrderedDesc: true,
      IsRecalculated: null,
      IsSuperBet: null,
      IsTest: false,
      IsWithSelections: false,
      MaxSelectionCount: null,
      MinSelectionCount: null,
      Number: null,
      OrderedItem: 9,
      PriceFrom: null,
      PriceTo: null,
      Sources: [],
      SportsbookProfileId: '',
      StartDateLocal: startDateLocal,
      State: null,
      MaxRows: options?.MaxRows ?? 20,
      SkeepRows: options?.SkeepRows ?? 0,
    },
    filterBetSelection: {
      SportId: null,
      RegionId: null,
      CompetitionId: null,
      MatchId: null,
    },
    matchFilter: {
      currentSport: null,
      currentRegion: null,
      currentCompetition: null,
      currentMatch: null,
    },
    IsOrderedDesc: true,
    OrderedItem: 9,
  };
}

function getDefaultDepositsRequestBody(dateRange: DateRange): Record<string, unknown> {
  return {
    FromTransactionDateLocal: "",
    ToTransactionDateLocal: "",
    FromCreatedDateLocal: toLocalDateTime(dateRange.startDate, '00:00:00'),
    ToCreatedDateLocal: toLocalDateTime(dateRange.endDate, '23:59:59'),
    AmountFrom: "",
    AmountTo: "",
    ByPassTotals: false,
    CashDeskId: "",
    ClientId: "",
    CurrencyId: "",
    DefaultCurrencyId: "TRY",
    ExternalId: "",
    Id: "",
    IsOrderedDesc: true,
    IsTest: "false",
    MaxRows: 20,
    OrderedItem: 1,
    PaymentSystemId: null,
    RegionId: null,
    SkeepRows: 0,
    TypeId: null
  };
}

export interface AuditEntry {
  at: string;
  user: string;
  role: string;
  action: string;
  resource?: string;
  detail?: string;
}

export type ChurnSebebi = { kod: string; aciklama: string; agirlik: number };
export type ChurnSonucu = {
  skor: number;
  seviye: 'dusuk' | 'orta' | 'yuksek' | 'kritik';
  sessizGun: number | null;
  deger: number;
  segment: 'vip' | 'yuksek' | 'orta' | 'dusuk' | 'yeni';
  sebepler: ChurnSebebi[];
  oneri: string;
};
export type ChurnOyuncu = {
  id: number;
  login: string;
  kategori: string | null;
  balance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  lastLoginDate: string | null;
  sonTemas: { createdAt: string; tur: string; sonuc: string } | null;
  churn: ChurnSonucu;
};

export type CrmTemas = {
  id: string; login: string; tur: string; sonuc: string;
  not: string; yapan: string; createdAt: string;
};

export const crmApi = {
  temasGecmisi: (login: string) =>
    get<{ HasError: boolean; Data: { temaslar: CrmTemas[] } }>(`/admin/crm/temas/${encodeURIComponent(login)}`),
  temasEkle: (body: { login: string; tur?: string; sonuc?: string; not?: string }) =>
    post<{ HasError: boolean; Data: { temas: CrmTemas } }>('/admin/crm/temas', body),
  gunluk: () =>
    get<{ HasError: boolean; Data: { temaslar: CrmTemas[]; ozet: { toplam: number; bugun: number; ulasilan: number; ulasilamayan: number; turDagilimi: Record<string, number> } } }>('/admin/crm/gunluk'),
  /**
   * Skorlanmis oyuncu listesi. Tek istek: sunucu hem listeyi hem skoru hem
   * ozeti donuyor. Onceki ekran her oyuncu icin ayri KPI cagirıyordu.
   */
  churn: (body: { page?: number; countPerPage?: number; minSkor?: number; segment?: string; query?: string }) =>
    post<{ HasError: boolean; Data: { players: ChurnOyuncu[]; ozet: { toplam: number; kritik: number; yuksek: number; riskAltindakiDeger: number }; page: number; countPerPage: number } }>(
      '/admin/crm/churn',
      body,
    ),
};

export const adminApi = {
  audit: (limit?: number) => get<{ data: AuditEntry[] }>('/audit', limit != null ? { limit: String(limit) } : undefined),
  staffUsers: () => get<any>('/admin/staff-users'),
  createStaffUser: (body: any) => post<any>('/admin/staff-users', body),
  updateStaffUser: (id: string, body: any) => fetch(`${API_BASE}/admin/staff-users/${id}`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  }).then(async (res) => {
    const json = await parseJsonResponse(res);
    if (!res.ok) throw new ApiError(String(json.message || json.AlertMessage || res.statusText), res.status);
    return json;
  }),
  deleteStaffUser: (id: string) => fetch(`${API_BASE}/admin/staff-users/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  }).then(async (res) => {
    const json = await parseJsonResponse(res);
    if (!res.ok) throw new ApiError(String(json.message || json.AlertMessage || res.statusText), res.status);
    return json;
  }),

  checkPlayer: (login: string, options?: { bonusId?: number; bonusName?: string }) => post<{
    HasError: boolean;
    AlertMessage?: string;
    Data: {
      account: any;
      withdrawalRulesCheck: any;
      riskAnalysis: any;
      bonusRules: any;
      specificBonusCheck?: any;
    };
  }>('/admin/bonus/check-player', { login, ...options }),

  liveAlerts: () => get<any>('/admin/live-alerts'),
  intelligenceClusters: () => get<any>('/admin/intelligence/clusters'),
  playerScorecard: (clientId: number) => get<any>(`/admin/intelligence/scorecard/${clientId}`),
  playerScorecardByLogin: (login: string) => get<any>(`/admin/intelligence/scorecard-by-login/${login}`),
  businessInsights: (range: DateRange) => post<any>('/admin/intelligence/business-insights', range as any),

  manualAdjustment: (body: { ClientId: number; Amount: number; Info?: string; DocTypeInt?: number; CorrectionType: 'crediting' | 'debiting' }) =>
    post<any>('/admin/manual-adjustment', body),

  /**
   * Toplu yatırım/çekim özeti. Yatırım ve çekim AYRI tarih aralığı
   * kullanabilir; boş bırakılan sınır uygulanmaz.
   */
  topluIslemOzeti: (body: {
    kullanicilar: string;
    yatirimBaslangic?: string;
    yatirimBitis?: string;
    cekimBaslangic?: string;
    cekimBitis?: string;
  }) => post<any>('/admin/toplu-islem-ozeti', body),

  chargeBonus: (body: { ClientId: number; BonusId: number; Amount?: number; AssignmentValues?: Record<string, unknown> }) =>
    post<any>('/admin/bonus/charge', body),

  bonusBlacklist: () => get<{ HasError: boolean; Data: Array<{ login: string; neden: string | null; ekleyen: string; eklendi: string }> }>('/admin/bonus/blacklist'),
  bonusBlacklistEkle: (login: string, neden?: string) =>
    post<any>('/admin/bonus/blacklist', { login, neden }),
  bonusBlacklistCikar: (login: string) =>
    del<any>(`/admin/bonus/blacklist/${encodeURIComponent(login)}`),
};

/** Bonus Panel (ayrı giriş) - oyuncu bonus talep sayfası oturumu */
export const bonusPanelApi = {
  async me(): Promise<{ ok: true; login: string } | { ok: false }> {
    const res = await fetch(`${API_BASE}/bonus-panel/me`, { credentials: 'include' });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return data as { ok: true; login: string };
  },
  async login(username: string): Promise<{ ok: true; login: string } | { ok: false; message?: string }> {
    const res = await fetch(`${API_BASE}/bonus-panel/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: (data as any).message };
    return data as { ok: true; login: string };
  },
  async logout(): Promise<void> {
    await fetch(`${API_BASE}/bonus-panel/logout`, { method: 'POST', credentials: 'include' });
  },
};

export const gamesApi = {
  config: () => get<any>('/games/config'),
  saveConfig: (body: any) => post<any>('/admin/games/config', body),
  wheelClaims: (kayiplarDahil = false) =>
    get<any>(`/admin/games/wheel/claims${kayiplarDahil ? '?kayiplar=dahil' : ''}`),
  updateWheelClaim: (claimId: string, status: 'fulfilled' | 'cancelled', note?: string) =>
    post<any>(`/admin/games/wheel/claims/${encodeURIComponent(claimId)}/fulfillment`, { status, note }),
  playWheel: (code?: string) => post<any>('/games/wheel/play', { code }),
  validateWheelCode: (code: string) => post<any>('/games/wheel/validate-code', { code }),
  playScratch: () => post<any>('/games/scratch/play', {}),
  predictionLeague: () => get<any>('/games/prediction-league'),
  predictionEntries: () => get<any>('/admin/games/prediction-league/entries'),
  submitPrediction: (body: { matchId: string; homeScore: number; awayScore: number }) =>
    post<any>('/games/prediction-league/predict', body),
  dailyTasksStatus: () => get<any>('/games/daily-tasks/status'),
  /** Oyuncunun kendi turnuva sirasi; siralama tablosu yalnizca ilk N'i doner. */
  tournamentMyRank: (period: 'gunluk' | 'haftalik' | 'aylik' = 'gunluk') =>
    get<any>('/games/tournament/my-rank', { period }),
  /**
   * Oyuncuya acik turnuva siralamasi.
   *
   * /tournament/leaderboard dashboard altinda ve authGuard'in arkasinda;
   * oyuncunun panel oturumu olmadigi icin oradan 401 doniyordu.
   */
  tournamentLeaderboard: (period: 'gunluk' | 'haftalik' | 'aylik' = 'gunluk', limit = 20) =>
    get<any>('/games/tournament/leaderboard', { period, limit: String(limit) }),
  tournamentPublicSettings: () => get<any>('/games/tournament/settings'),
  claimDailyTask: (taskId: string) => post<any>('/games/daily-tasks/claim', { taskId }),
  battlePassStatus: () => get<any>('/games/battle-pass/status'),
  claimBattlePassReward: (body: { level: number; track?: 'free' | 'premium' }) =>
    post<any>('/games/battle-pass/claim', body),
  teamLogo: (name: string) => get<any>(`/admin/games/team-logo?name=${encodeURIComponent(name)}`),
  telegramBonusStatus: () => get<any>('/games/telegram-bonus/status'),
  verifyTelegramBonus: () => post<any>('/games/telegram-bonus/verify', {}),
};

export type AffiliateKomisyonModeli = 'revshare' | 'cpa' | 'hibrit';
export type AffiliateHesapDurumu = 'aktif' | 'beklemede' | 'askida';

export interface AffiliateHesap {
  id: string;
  bTag: string;
  ad: string;
  email: string;
  komisyonModeli: AffiliateKomisyonModeli;
  revsharePayi: number;
  cpaTutari: number;
  durum: AffiliateHesapDurumu;
  basvuruId?: string;
  not?: string;
  createdAt: string;
  sonGiris?: string;
}

export interface AffiliateMetrik {
  bTag: string;
  totalPlayers?: number | null;
  activePlayers?: number | null;
  totalDeposits?: number | null;
  totalWithdrawals?: number | null;
  netRevenue?: number | null;
  conversionRate?: number | null;
  netPozisyon: number;
  oyuncuBasiGelir: number;
  oyuncuBasiYatirim: number;
  gelirPayi: number;
  cekimOrani: number;
}

export interface AffiliateKomisyon {
  revshare: number;
  cpa: number;
  toplam: number;
  aciklama: string;
}

export interface AffiliateToplam {
  bTagSayisi: number;
  oyuncu: number;
  aktifOyuncu: number;
  yatirim: number;
  cekim: number;
  netGelir: number;
  netPozisyon: number;
  ortalamaDonusum: number;
}

/** Ödeme yöntemi başına mutabakat ayarı: komisyon + teslimat + takviye. */
export interface YontemAyari {
  /** `Mutabakat.Satirlar[].anahtar` ile aynı biçim: "HemenOde · Havale". */
  anahtar: string;
  yatirimYuzde: number;
  yatirimSabit: number;
  cekimYuzde: number;
  cekimSabit: number;
  teslimatKurali: string | null;
  takviyeEsigi: number | null;
  takviyeNotu: string | null;
  not: string | null;
  updatedAt: string;
}

export type AffiliateOdemeDurumu = 'bekliyor' | 'odendi' | 'iptal';

export interface AffiliateOdemeSatiri {
  donem: string;
  tutar: number;
  durum: AffiliateOdemeDurumu;
  odenmeTarihi: string | null;
}

/** Ortak portali — panel oturumundan ayri kimlik. */
export const affiliatePortalApi = {
  login: (body: { email: string; password: string }) =>
    post<{ ok: boolean; user?: { id: string; bTag: string; email: string; ad: string }; message?: string }>(
      '/affiliate-portal/login',
      body,
    ),
  me: () =>
    get<{ ok: boolean; user?: { id: string; bTag: string; email: string; ad: string } }>('/affiliate-portal/me'),
  logout: () => post<{ ok: boolean }>('/affiliate-portal/logout', {}),
  ozet: (params?: { startDate?: string; endDate?: string }) =>
    get<{
      ok: boolean;
      ortak: { ad: string; bTag: string; komisyonModeli: AffiliateKomisyonModeli; revsharePayi: number; cpaTutari: number };
      aralik: DateRange;
      satirlar: AffiliateMetrik[];
      toplam: AffiliateToplam;
      komisyon: AffiliateKomisyon;
      odemeler?: AffiliateOdemeSatiri[];
      odemeOzeti?: { odenmis: number; bekleyen: number };
      message?: string;
    }>('/affiliate-portal/ozet', params as Record<string, string> | undefined),
};

/** Admin: ortak hesaplari ve komisyon raporu. */
export const affiliateAdminApi = {
  hesaplar: () => get<{ ok: boolean; hesaplar: AffiliateHesap[] }>('/admin/affiliate/hesaplar'),
  hesapEkle: (body: {
    bTag: string;
    ad: string;
    email: string;
    password: string;
    komisyonModeli?: AffiliateKomisyonModeli;
    revsharePayi?: number;
    cpaTutari?: number;
    durum?: AffiliateHesapDurumu;
    basvuruId?: string;
    not?: string;
  }) => post<{ ok: boolean; hesap?: AffiliateHesap; message?: string }>('/admin/affiliate/hesaplar', body),
  hesapGuncelle: (
    id: string,
    body: {
      ad?: string;
      bTag?: string;
      komisyonModeli?: AffiliateKomisyonModeli;
      revsharePayi?: number;
      cpaTutari?: number;
      durum?: AffiliateHesapDurumu;
      not?: string;
      password?: string;
    },
  ) => post<{ ok: boolean; hesap?: AffiliateHesap; message?: string }>(`/admin/affiliate/hesaplar/${id}`, body),
  hesapSil: (id: string) => del<{ ok: boolean; message?: string }>(`/admin/affiliate/hesaplar/${id}`),
  komisyonRaporu: (body: { startDate?: string; endDate?: string }) =>
    post<{
      ok: boolean;
      aralik: DateRange;
      satirlar: Array<{
        ortak: Pick<AffiliateHesap, 'id' | 'ad' | 'email' | 'bTag' | 'durum' | 'komisyonModeli' | 'revsharePayi' | 'cpaTutari'>;
        metrik: AffiliateMetrik | null;
        komisyon: AffiliateKomisyon;
      }>;
      baglanmamis: AffiliateMetrik[];
      toplamKomisyon: number;
      message?: string;
    }>('/admin/affiliate/komisyon-raporu', body),

  // ─── Ölçümler (kendi kayıtlarımızdan, eğilim serisiyle) ────────────────────
  olcumler: (params?: { start?: string; end?: string; ortak?: string }) =>
    get<{
      ok: boolean;
      aralik: { start: string; end: string };
      ortaklar: OrtakOzeti[];
      sonOlculenGun: string | null;
      toplam: { yatirim: number; cekim: number; ggr: number };
    }>('/admin/affiliate/olcumler', params as Record<string, string> | undefined),

  // ─── Medya ────────────────────────────────────────────────────────────────
  medyalar: () => get<{ ok: boolean; medyalar: Medya[] }>('/admin/affiliate/medya'),
  medyaEkle: (body: MedyaGirdisi) => post<{ ok: boolean; medya?: Medya; message?: string }>('/admin/affiliate/medya', body),
  medyaGuncelle: (id: string, body: MedyaGirdisi) =>
    put<{ ok: boolean; medya?: Medya; message?: string }>(`/admin/affiliate/medya/${id}`, body),
  medyaSil: (id: string) => del<{ ok: boolean; message?: string }>(`/admin/affiliate/medya/${id}`),

  // ─── Kademeler ────────────────────────────────────────────────────────────
  kademeler: () => get<{ ok: boolean; baglar: KademeBagi[]; kademeYuzdeleri: number[] }>('/admin/affiliate/kademeler'),
  kademeBagiKur: (body: { bTag: string; ustBTag: string }) =>
    post<{ ok: boolean; bag?: KademeBagi; message?: string }>('/admin/affiliate/kademeler', body),
  kademeBagiKaldir: (bTag: string) =>
    del<{ ok: boolean; message?: string }>(`/admin/affiliate/kademeler/${encodeURIComponent(bTag)}`),
  kademeYuzdeleri: (yuzdeler: number[]) =>
    put<{ ok: boolean; kademeYuzdeleri?: number[]; message?: string }>('/admin/affiliate/kademeler/yuzdeler', { yuzdeler }),

  // ─── S2S postback ─────────────────────────────────────────────────────────
  postback: () =>
    get<{ ok: boolean; ayarlar: PostbackAyari[]; kayitlar: PostbackKaydi[]; olaylar: PostbackOlayi[] }>(
      '/admin/affiliate/postback',
    ),
  postbackAyarla: (body: { bTag: string; sablon: string; olaylar: string[]; aktif?: boolean }) =>
    put<{ ok: boolean; ayar?: PostbackAyari; message?: string }>('/admin/affiliate/postback', body),
  postbackDene: (bTag: string) =>
    post<{ ok: boolean; kayit?: PostbackKaydi; message?: string }>('/admin/affiliate/postback/dene', { bTag }),

  // ─── Lynon entegrasyon katalogu ───────────────────────────────────────────
  lynonEntegrasyon: () =>
    get<{
      ok: boolean;
      siteId: number;
      backofficeEkraniUrl: string;
      onerilenTip: string | null;
      postbackUcumuz: string;
      postbackHazir: boolean;
      saglayicilar: Array<{
        saglayici: { id: number; type: string; name: string; description: string; iconUrl?: string; configKeys: string[] };
        bizimkiyleEslesiyor: boolean;
        hazirAnahtarlar: string[];
        eksikAnahtarlar: string[];
      }>;
    }>('/admin/affiliate/lynon-entegrasyon'),
};

export type OrtakOzeti = {
  ortakAnahtari: string;
  gunSayisi: number;
  oyuncuSayisi: number;
  aktifOyuncuSayisi: number;
  yatirim: number;
  cekim: number;
  ggr: number;
  /** Yalnızca itme yolunda ölçülüyor; null = ölçülmedi (0 değil). */
  ftdSayisi: number | null;
  gunlukGgr: Array<{ gun: string; ggr: number }>;
};

export type MedyaTuru = 'banner' | 'metin' | 'video' | 'landing';

export type Medya = {
  id: string;
  ad: string;
  tur: MedyaTuru;
  varlikUrl: string | null;
  hedefUrl: string;
  olcu: string | null;
  aktif: boolean;
  ortakBTaglari: string[];
  not: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MedyaGirdisi = {
  ad?: string;
  tur?: string;
  varlikUrl?: string;
  hedefUrl?: string;
  olcu?: string;
  aktif?: boolean;
  ortakBTaglari?: string[];
  not?: string;
};

export type KademeBagi = { bTag: string; ustBTag: string; createdAt: string };

export type PostbackOlayi = 'kayit' | 'ilk-yatirim' | 'yatirim' | 'onaylanan-komisyon';

export type PostbackAyari = {
  bTag: string;
  sablon: string;
  olaylar: PostbackOlayi[];
  aktif: boolean;
  updatedAt: string;
};

export type PostbackKaydi = {
  id: string;
  bTag: string;
  olay: PostbackOlayi;
  url: string;
  durum: 'basarili' | 'basarisiz' | 'engellendi';
  httpDurum: number | null;
  deneme: number;
  mesaj: string | null;
  gonderildi: string;
};

export type BugscrmDurum = {
  etkin: boolean;
  yapilandirildi: boolean;
  endpointUrl: string | null;
  productId: string | null;
  apiKeyTanimli: boolean;
  webhookSecretTanimli: boolean;
};

export type BugscrmKaydi = {
  clickId: string;
  subId: string | null;
  olayTuru: 'tiklama' | 'kayit' | 'yatirim' | 'ozel';
  playerLogin: string | null;
  tutar: number | null;
  paraBirimi: string | null;
  alindi: string;
};

export const bugscrmAdminApi = {
  durum: () => get<{ HasError: boolean; Data: BugscrmDurum }>('/admin/bugscrm/durum'),
  testBaglanti: () =>
    post<{ HasError: boolean; AlertMessage?: string; Data: { ok: boolean; durum: string; mesaj?: string } }>(
      '/admin/bugscrm/test-baglanti',
      {},
    ),
  kayitlar: (limit = 100) => get<{ HasError: boolean; Data: BugscrmKaydi[] }>(`/admin/bugscrm/kayitlar?limit=${limit}`),
};

export const formsApi = {
  submitCallRequest: (body: any) => post<any>('/forms/call', body),
  submitPartnershipRequest: (body: any) => post<any>('/forms/partnership', body),
  submitVipRequest: (body: { username: string; name?: string; email?: string; phone?: string }) =>
    post<any>('/forms/vip', body),
  getAdminForms: () => get<any>('/admin/forms'),
  updateFormStatus: (body: { collection: string; id: string; status?: string; note?: string }) =>
     post<any>('/admin/forms/update', body),
  deleteForm: (body: { collection: string; id: string }) =>
     post<any>('/admin/forms/delete', body),
  updateVipStatus: (body: { id: string; status?: string; note?: string }) =>
    post<any>('/admin/forms/vip/update', body),
  deleteVipForm: (body: { id: string }) =>
    post<any>('/admin/forms/vip/delete', body),
  getSettings: () => get<any>('/forms/settings'),
  updateSettings: (body: any) => post<any>('/admin/forms/settings', body),
};
export const masterApi = {
  login: (body: any) => post<any>('/master/login', body),
  logout: () => post<any>('/master/logout', {}),
  check: () => get<any>('/master/check'),
  getTenants: () => get<any>('/master/tenants'),
  createTenant: (body: any) => post<any>('/master/tenants', body),
  updateTenant: (id: string, body: any) => fetch(`${API_BASE}/master/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
  }).then(r => r.json()),

  /** Alt sitenin kendi Lynon/backoffice bağlantısı. Sırlar maskeli döner. */
  getConnection: (id: string) => get<any>(`/master/tenants/${id}/connection`),
  updateConnection: (id: string, body: any) => fetch(`${API_BASE}/master/tenants/${id}/connection`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
  }).then(r => r.json()),
  testConnection: (id: string) => post<any>(`/master/tenants/${id}/connection/test`, {}),
  /**
   * Sitenin ANLIK TOTP kodu. Sırrın kendisi dönmez, ondan türetilen
   * 30 saniyelik kod döner — kaydedilen sırrın doğru olup olmadığı
   * ancak böyle sınanabiliyor.
   */
  getTenantOtp: (id: string) => get<any>(`/master/tenants/${id}/otp`),
  /** Çok kiracılı çözümleme durumu: site sayısı, yedek kiracı, çakışmalar. */
  getDurum: () => get<any>('/master/durum'),
  getJobs: () => get<any>('/master/jobs'),
};

export const tournamentApi = {
  leaderboard: (body: {
    FromDate: string;
    ToDate: string;
    Take?: number;
    Offset?: number;
    PlayerState?: number;
    OrderKey?: string;
    OrderDir?: string;
    CurrencyId?: string;
  }) => post<any>('/tournament/leaderboard', {
    PlayerState: 2,
    Offset: 0,
    Take: 20,
    OrderDir: "OrderByDescending",
    OrderKey: "BetAmount", // Default to BetAmount for 'en çok bahis alanlar'
    CurrencyId: "TRY",
    ...body
  }),
  getSettings: () => get<any>('/admin/tournaments/settings'),
  saveSettings: (settings: any) => post<any>('/admin/tournaments/settings', settings),
};

export const loyaltyApi = {
  status: () => get<any>('/loyalty/status'),
  missions: () => get<any>('/loyalty/missions'),
  claimMission: (missionId: string) => post<any>('/loyalty/missions/claim', { missionId }),
  marketList: () => get<any>('/loyalty/market'),
  buyItem: (itemId: string) => post<any>('/loyalty/market/buy', { itemId }),
};
