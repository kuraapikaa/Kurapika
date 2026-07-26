const API_BASE = '/api';

export interface RuleSetResult {
  overallOk: boolean;
  items: Array<{ id: string; label: string; ok: boolean; reason?: string }>;
}

export interface WithdrawalCheckResponse {
  HasError: boolean;
  Data?: {
    account: Record<string, unknown>;
    checklists: Array<{
      promoId: number;
      promoTitle: string;
      overallOk: boolean;
      items: Array<{ id: string; label: string; ok: boolean; reason?: string }>;
    }>;
    withdrawalRulesCheck?: RuleSetResult;
    riskAnalysis?: RuleSetResult;
    wagerSummary?: RuleSetResult;
    bonusRules?: RuleSetResult;
  };
}

export interface AutoStatusResponse {
  HasError: boolean;
  Data?: {
    lastRunAt: string | null;
    payload: {
      message?: string;
      requestsCount?: number;
      uniqueClients?: number;
      checkedClients?: number;
      errors?: string[];
    } | null;
  };
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(res.ok ? 'Geçersiz yanıt (JSON değil).' : `Sunucu: ${res.status} ${res.statusText}`);
  }
}

/** Son otomatik çekim kontrolü çalışma bilgisi. */
export async function getWithdrawalAutoStatus(): Promise<AutoStatusResponse> {
  const res = await fetch(`${API_BASE}/admin/withdrawal/auto-status`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new Error((json.AlertMessage as string) || (json.ErrorDescription as string) || res.statusText);
  }
  return json as unknown as AutoStatusResponse;
}

/** Bonus uygulama kontrol raporu (CSV) indirir. Rapor otomatik oluşturulur ve dosya iner. */
export async function downloadBonusControlReport(): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/bonus-control-report`, { method: 'GET' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json?.AlertMessage ?? json?.ErrorDescription) || res.statusText);
  }
  const disposition = res.headers.get('Content-Disposition');
  const filename =
    disposition?.match(/filename="?([^";\n]+)"?/)?.[1]?.trim() ||
    `bonus-uygulama-kontrol-raporu-${new Date().toISOString().slice(0, 10)}.csv`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Check withdrawal eligibility. Pass either account (manual) or clientId (uses backoffice KPI, bonuses, client). requestIban optional. withdrawalDateLocal = çekim talebinin tarihi (analizin baz yatırımı için). */
export async function checkWithdrawal(
  payload: { account?: Record<string, unknown>; clientId?: number; force?: boolean; requestIban?: string; withdrawalDateLocal?: string | null }
): Promise<WithdrawalCheckResponse> {
  const res = await fetch(`${API_BASE}/admin/withdrawal/check`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new Error((json.AlertMessage as string) || (json.ErrorDescription as string) || res.statusText);
  }
  return json as unknown as WithdrawalCheckResponse;
}

