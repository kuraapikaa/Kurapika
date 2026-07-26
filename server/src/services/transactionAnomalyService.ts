/**
 * İşlem verisi üzerinde anomali tespiti.
 * Örüntüler: günlük hacim (z-score), tek işlem tutarı, işlem sıklığı.
 */

export interface TransactionRecord {
  ClientId?: number;
  Amount?: number;
  CreatedLocal?: string | null;
  ClientLogin?: string | null;
  TypeName?: string | null;
}

export interface AnomalyItem {
  type: 'high_daily_volume' | 'high_single_amount' | 'high_frequency';
  clientId: number;
  clientLogin?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  value?: number;
  date?: string;
  detail?: string;
}

export interface AnomalyReport {
  anomalies: AnomalyItem[];
  summary: {
    totalProcessed: number;
    uniqueClients: number;
    anomalyCount: number;
    dateRange: { from: string; to: string };
  };
}

const HIGH_AMOUNT_THRESHOLD = 50_000;
const HIGH_DAILY_VOLUME_Z = 2; // std sapma katı
const MIN_DAYS_FOR_MEAN = 2;

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const sq = arr.map((x) => (x - m) ** 2);
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / (arr.length - 1)) || 0;
}

/**
 * İşlem listesini analiz eder; olağandışı hareketleri raporlar.
 */
export function analyzeTransactionAnomalies(
  transactions: TransactionRecord[],
  dateRange: { from: string; to: string }
): AnomalyReport {
  const anomalies: AnomalyItem[] = [];

  // Günlük hacim: ClientId + tarih -> |Amount| toplamı
  const byClientDay: Record<number, Record<string, number>> = {};
  for (const t of transactions) {
    const clientId = Number(t.ClientId);
    if (!clientId) continue;
    const dateStr = t.CreatedLocal ? String(t.CreatedLocal).slice(0, 10) : '';
    if (!dateStr) continue;
    const amount = Math.abs(Number(t.Amount) || 0);
    if (!byClientDay[clientId]) byClientDay[clientId] = {};
    byClientDay[clientId][dateStr] = (byClientDay[clientId][dateStr] || 0) + amount;
  }

  // Yüksek tek işlem tutarı
  for (const t of transactions) {
    const clientId = Number(t.ClientId);
    const amount = Math.abs(Number(t.Amount) || 0);
    if (amount >= HIGH_AMOUNT_THRESHOLD) {
      anomalies.push({
        type: 'high_single_amount',
        clientId,
        clientLogin: t.ClientLogin ? String(t.ClientLogin) : undefined,
        message: `Yüksek tek işlem tutarı: ${amount.toLocaleString('tr-TR')}`,
        severity: amount >= 100_000 ? 'high' : 'medium',
        value: amount,
        date: t.CreatedLocal ? String(t.CreatedLocal).slice(0, 10) : undefined,
      });
    }
  }

  // Günlük hacim anomali: client başına günlük hacimlerin ortalaması ve std; ort + 2*std üzeri günleri işaretle
  for (const [clientIdStr, days] of Object.entries(byClientDay)) {
    const clientId = Number(clientIdStr);
    const volumes = Object.values(days);
    if (volumes.length < MIN_DAYS_FOR_MEAN) continue;
    const m = mean(volumes);
    const s = std(volumes);
    if (s === 0) continue;
    const threshold = m + HIGH_DAILY_VOLUME_Z * s;
    const firstTx = transactions.find((t) => Number(t.ClientId) === clientId);
    for (const [dateStr, vol] of Object.entries(days)) {
      if (vol > threshold) {
        const z = s > 0 ? (vol - m) / s : 0;
        anomalies.push({
          type: 'high_daily_volume',
          clientId,
          clientLogin: firstTx?.ClientLogin ? String(firstTx.ClientLogin) : undefined,
          message: `Günlük işlem hacmi olağandışı: ${vol.toLocaleString('tr-TR')} (ortalama: ${Math.round(m).toLocaleString('tr-TR')})`,
          severity: z >= 3 ? 'high' : 'medium',
          value: vol,
          date: dateStr,
          detail: `z-score ≈ ${z.toFixed(1)}`,
        });
      }
    }
  }

  // Yüksek sıklık: aynı günde çok sayıda işlem (client + gün)
  const byClientDayCount: Record<number, Record<string, number>> = {};
  for (const t of transactions) {
    const clientId = Number(t.ClientId);
    if (!clientId) continue;
    const dateStr = t.CreatedLocal ? String(t.CreatedLocal).slice(0, 10) : '';
    if (!dateStr) continue;
    if (!byClientDayCount[clientId]) byClientDayCount[clientId] = {};
    byClientDayCount[clientId][dateStr] = (byClientDayCount[clientId][dateStr] || 0) + 1;
  }
  const HIGH_FREQ_THRESHOLD = 50;
  for (const [clientIdStr, days] of Object.entries(byClientDayCount)) {
    const clientId = Number(clientIdStr);
    const firstTx = transactions.find((t) => Number(t.ClientId) === clientId);
    for (const [dateStr, count] of Object.entries(days)) {
      if (count >= HIGH_FREQ_THRESHOLD) {
        anomalies.push({
          type: 'high_frequency',
          clientId,
          clientLogin: firstTx?.ClientLogin ? String(firstTx.ClientLogin) : undefined,
          message: `Aynı günde yüksek işlem sayısı: ${count} adet`,
          severity: count >= 100 ? 'high' : 'medium',
          value: count,
          date: dateStr,
        });
      }
    }
  }

  const uniqueClients = new Set(transactions.map((t) => t.ClientId).filter(Boolean)).size;
  return {
    anomalies,
    summary: {
      totalProcessed: transactions.length,
      uniqueClients,
      anomalyCount: anomalies.length,
      dateRange,
    },
  };
}
