import type { Config } from '../config.js';

/** "DD-MM-YY - HH:mm:ss" for BetReport StartDateLocal/EndDateLocal */
function toLocalDateTime(ymd: string, time: string): string {
  const [y, m, d] = ymd.split('-');
  if (!d) return `${ymd} - ${time}`;
  const yy = y.length === 4 ? y.slice(-2) : y;
  return `${d}-${m}-${yy} - ${time}`;
}

const BACKOFFICE_HEADERS: Record<string, string> = {
  Accept: 'application/json; text/plain; */*',
  Origin: 'https://backofficewebadmin.betconstruct.com',
  Referer: 'https://backofficewebadmin.betconstruct.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Content-Type': 'application/json;charset=UTF-8',
};

function headers(authToken: string): Record<string, string> {
  return { ...BACKOFFICE_HEADERS, authentication: authToken.trim() };
}

const MAX_BETS_TO_CHECK = 20;
const SELECTIONS_DELAY_MS = 800;

interface BetReportBet {
  Id?: number;
  [key: string]: unknown;
}

interface BetSelectionItem {
  MatchId?: number;
  SelectionName?: string;
  DisplaySelectionName?: string;
  MarketId?: number;
  MarketName?: string;
  [key: string]: unknown;
}

/**
 * GetBetReport ile oyuncunun son 3 günlük bahislerini alır,
 * her bahis için GetBetSelections ile seçimleri çeker;
 * aynı maçta (MatchId) zıt seçim varsa true döner.
 */
export async function detectOppositeBetting(
  clientId: number,
  config: Config,
  authToken: string
): Promise<boolean> {
  if (!authToken) return false;
  const { body: betReportBody } = buildBetReportBody(clientId);
  const baseReport = config.betReportApi.baseUrl.replace(/\/$/, '');
  const pathReport = config.betReportApi.path.replace(/^\//, '');
  const urlReport = `${baseReport}/${pathReport}`;

  const resReport = await fetch(urlReport, {
    method: 'POST',
    headers: headers(authToken),
    body: JSON.stringify(betReportBody),
  });
  if (resReport.status === 403) {
    throw new Error('AĞ SORUNU: BetConstruct erişimi (403) reddetti. Çok fazla talep gönderildi.');
  }
  const dataReport = (await resReport.json()) as { HasError?: boolean; Data?: { BetData?: { Objects?: BetReportBet[] } } };
  if (resReport.ok === false || dataReport.HasError || !dataReport.Data?.BetData?.Objects) {
    return false;
  }

  const bets = dataReport.Data.BetData.Objects;
  const baseSel = config.betSelectionsApi.baseUrl.replace(/\/$/, '');
  const pathSel = config.betSelectionsApi.path.replace(/^\//, '');
  const urlSel = `${baseSel}/${pathSel}`;

  const byMatchId = new Map<number, { marketId: number; selectionKey: string }[]>();

  for (let i = 0; i < Math.min(bets.length, MAX_BETS_TO_CHECK); i++) {
    const betId = bets[i].Id;
    if (betId == null) continue;
    await new Promise((r) => setTimeout(r, SELECTIONS_DELAY_MS));
    const resSel = await fetch(urlSel, {
      method: 'POST',
      headers: headers(authToken),
      body: JSON.stringify({ BetId: betId, Type: 1 }),
    });
    if (resSel.status === 403) {
      throw new Error('AĞ SORUNU: Bahis detayları alınırken 403 (Erişim Engeli) alındı. Çok fazla istek hızı.');
    }
    const dataSel = (await resSel.json()) as { HasError?: boolean; Data?: BetSelectionItem[] };
    if (resSel.ok === false || dataSel.HasError || !Array.isArray(dataSel.Data)) continue;
    for (const sel of dataSel.Data) {
      const matchId = sel.MatchId;
      if (matchId == null) continue;
      const marketId = Number(sel.MarketId ?? 0);
      const name = String(sel.DisplaySelectionName ?? sel.SelectionName ?? '').trim();
      const selectionKey = `${marketId}:${name}`;
      if (!byMatchId.has(matchId)) byMatchId.set(matchId, []);
      const list = byMatchId.get(matchId)!;
      if (!list.some((x) => x.marketId === marketId && x.selectionKey === selectionKey)) {
        list.push({ marketId, selectionKey });
      }
    }
  }

  for (const [, list] of byMatchId) {
    const byMarket = new Map<number, string[]>();
    for (const { marketId, selectionKey } of list) {
      if (!byMarket.has(marketId)) byMarket.set(marketId, []);
      const arr = byMarket.get(marketId)!;
      if (!arr.includes(selectionKey)) arr.push(selectionKey);
    }
    for (const selections of byMarket.values()) {
      if (selections.length >= 2) return true;
    }
  }
  return false;
}

/** GetBetReport body (son 3 gün, client) - paylaşımlı. */
function buildBetReportBody(clientId: number): { startYmd: string; endYmd: string; body: Record<string, unknown> } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 3);
  const startYmd = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const endYmd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  const body = {
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
      ClientId: String(clientId),
      ClientLogin: null,
      ClientLoginIp: '',
      CurrencyId: null,
      EndDateLocal: toLocalDateTime(endYmd, '23:59:59'),
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
      StartDateLocal: toLocalDateTime(startYmd, '00:00:00'),
      State: null,
      MaxRows: MAX_BETS_TO_CHECK,
      SkeepRows: 0,
    },
    filterBetSelection: { SportId: null, RegionId: null, CompetitionId: null, MatchId: null },
    matchFilter: { currentSport: null, currentRegion: null, currentCompetition: null, currentMatch: null },
    IsOrderedDesc: true,
    OrderedItem: 9,
  };
  return { startYmd, endYmd, body };
}

/** Bahis kaydından oyun adı çıkar (ProductName, GameName, ProductTitle vb.). */
function gameNameFromBet(bet: BetReportBet): string | null {
  const name =
    (bet.ProductName as string) ??
    (bet.GameName as string) ??
    (bet.ProductTitle as string) ??
    (bet.GameTitle as string) ??
    (bet.Product as string) ??
    (bet.Game as string);
  if (name != null && String(name).trim() !== '') return String(name).trim();
  return null;
}

/**
 * GetBetReport ile oyuncunun son 3 günlük bahislerinden oyun/product adlarını toplar.
 * Casino/slot raporunda ProductName/GameName dönüyorsa doldurulur.
 */
export async function getPlayedGameNames(
  clientId: number,
  config: Config,
  authToken: string
): Promise<string[]> {
  if (!authToken) return [];
  const { body } = buildBetReportBody(clientId);
  const baseReport = config.betReportApi.baseUrl.replace(/\/$/, '');
  const pathReport = config.betReportApi.path.replace(/^\//, '');
  const urlReport = `${baseReport}/${pathReport}`;
  const res = await fetch(urlReport, {
    method: 'POST',
    headers: headers(authToken),
    body: JSON.stringify(body),
  });
  if (res.status === 403) {
    throw new Error('AĞ SORUNU: Oyun geçmişi raporu alınırken 403 (Erişim Engeli) alındı.');
  }
  const data = (await res.json()) as { HasError?: boolean; Data?: { BetData?: { Objects?: BetReportBet[] } } };
  if (!res.ok || data.HasError || !data.Data?.BetData?.Objects) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const bet of data.Data.BetData.Objects) {
    const n = gameNameFromBet(bet);
    if (n && !seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      names.push(n);
    }
  }
  return names;
}
