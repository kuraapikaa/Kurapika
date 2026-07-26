import type { Config } from '../config.js';
import { humanDelay } from '../lib/humanDelay.js';

/** "DD-MM-YY - HH:mm:ss" (backoffice FromDateLocal / ToDateLocal) */
function toLocalDateTime(ymd: string, time: string): string {
  const [y, m, d] = ymd.split('-');
  if (!d) return `${ymd} - ${time}`;
  const yy = y.length === 4 ? y.slice(-2) : y;
  return `${d}-${m}-${yy} - ${time}`;
}

function todayYMD(): { startDate: string; endDate: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const ymd = `${y}-${m}-${day}`;
  return { startDate: ymd, endDate: ymd };
}

export interface WithdrawalRequestItem {
  Id: number;
  ClientId: number;
  ClientLogin?: string;
  ClientName?: string;
  /** Çekim talebinin tarihi (otomatik çekim analizinde baz alınır). */
  RequestTimeLocal?: string | null;
  RequestTime?: string | null;
  [key: string]: unknown;
}

/** Bugünkü çekim taleplerini backoffice API'den çeker. */
export async function fetchWithdrawalRequestsToday(
  config: Config,
  authToken: string
): Promise<WithdrawalRequestItem[]> {
  if (!authToken) return [];
  await humanDelay();
  const { startDate, endDate } = todayYMD();
  const body = {
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
    FromDateLocal: toLocalDateTime(startDate, '00:00:00'),
    ToDateLocal: toLocalDateTime(endDate, '23:59:59'),
    IsTest: '',
    PartnerClientCategoryId: '',
    PaymentTypeIds: [],
    StateList: [],
    OrderedItem: 1,
    IsOrderedDesc: true,
  };
  const base = config.withdrawalApi.baseUrl.replace(/\/$/, '');
  const url = `${base}/${config.withdrawalApi.path.replace(/^\//, '')}`;
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
    authentication: authToken.trim(),
  };
  const controller = new AbortController();
  const timeoutMs = 30000;
  setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, {
    method: 'POST',
    signal: controller.signal,
    headers,
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { HasError?: boolean; Data?: { ClientRequests?: WithdrawalRequestItem[] } };
  if (!response.ok || data.HasError) return [];
  const list = data.Data?.ClientRequests;
  return Array.isArray(list) ? list : [];
}
