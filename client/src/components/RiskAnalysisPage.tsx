import { useState } from 'react';
import { Search, Shield, AlertTriangle, Loader2, User } from 'lucide-react';
import { dashboardApi } from '../api/client';
import { checkWithdrawal, type RuleSetResult } from '../api/admin';
import { formatNumber } from '../lib/format';
import { cn } from '../lib/utils';
import { getPlayerCategory, type PlayerCategory } from '../lib/playerCategories';
import { StatusBadge } from './ui/admin';

/**
 * Risk skoru — severity ağırlıklı.
 *
 * Önceden `başarısız / toplam` hesaplanıyordu ve riskAnalyzer'ın her maddeye
 * verdiği `severity` alanı yok sayılıyordu. Sonuç ters çalışıyordu: düşük
 * öncelikli 8 kontrolün (churn-risk, vip-high-roller gibi, ki bunlar
 * dolandırıcılık sinyali değil) başarısız olması skoru 25'e çıkarırken,
 * klasik aklama sinyali olan withdraw-without-deposit tek başına 3 veriyordu.
 * Skor >= 70'te "Money Launderer Candidate" etiketi basıldığı için bu fark
 * doğrudan yanlış sınıflandırmaya yol açıyordu.
 */
const SEVERITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

function computeRiskScore(riskAnalysis: RuleSetResult | undefined): number {
  const items = riskAnalysis?.items;
  if (!items?.length) return 0;

  let failedWeight = 0;
  let totalWeight = 0;
  for (const item of items) {
    const weight = SEVERITY_WEIGHT[String((item as any).severity ?? 'medium')] ?? 2;
    totalWeight += weight;
    if (!item.ok) failedWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.min(100, Math.round((failedWeight / totalWeight) * 100));
}

/** Skoru besleyen başarısız kontroller — en ağırdan hafife. */
function failedBySeverity(riskAnalysis: RuleSetResult | undefined) {
  const items = riskAnalysis?.items ?? [];
  const failed = items.filter((i) => !i.ok);
  const rank = (s: unknown) => SEVERITY_WEIGHT[String(s ?? 'medium')] ?? 2;
  return {
    high: failed.filter((i) => rank((i as any).severity) === 3).length,
    medium: failed.filter((i) => rank((i as any).severity) === 2).length,
    low: failed.filter((i) => rank((i as any).severity) === 1).length,
    total: failed.length,
    checked: items.length,
  };
}

function RiskScoreBadge({ score, breakdown }: { score: number; breakdown?: ReturnType<typeof failedBySeverity> }) {
  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const tone =
    level === 'high'
      ? 'border-rose-400/25 bg-rose-400/10 text-rose-300'
      : level === 'medium'
        ? 'border-amber-300/25 bg-[color:var(--panel-warning,#ff9f0a)]/10 text-amber-200'
        : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn('inline-flex items-center gap-2 rounded-lg border px-3 py-2', tone)}
        title="0 = düşük risk, 100 = yüksek risk. Severity ağırlıklı (yüksek 3, orta 2, düşük 1)."
      >
        <Shield size={18} />
        <span className="text-[22px] font-semibold leading-none tabular-nums">{score}</span>
      </span>

      {breakdown && breakdown.checked > 0 && (
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--panel-muted,#8a919c)]">
            {breakdown.total}/{breakdown.checked} kontrol başarısız
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {breakdown.high > 0 && <StatusBadge tone="danger">{breakdown.high} yüksek</StatusBadge>}
            {breakdown.medium > 0 && <StatusBadge tone="warning">{breakdown.medium} orta</StatusBadge>}
            {breakdown.low > 0 && <StatusBadge tone="neutral">{breakdown.low} düşük</StatusBadge>}
            {breakdown.total === 0 && <StatusBadge tone="success">Tüm kontroller temiz</StatusBadge>}
          </div>
        </div>
      )}
    </div>
  );
}

export function RiskAnalysisPage() {
  const [search, setSearch] = useState('');
  const [submitSearch, setSubmitSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    clientId: number;
    login: string;
    account: Record<string, unknown>;
    riskAnalysis?: RuleSetResult;
    withdrawalRulesCheck?: RuleSetResult;
    wagerSummary?: RuleSetResult;
    bonusRules?: RuleSetResult;
    category: PlayerCategory;
  } | null>(null);

  const handleSearch = async () => {
    const q = search.trim();
    if (!q) {
      setError('Kullanıcı adı girin.');
      return;
    }
    setError(null);
    setReport(null);
    setSubmitSearch(q);
    setLoading(true);
    try {
      let clientsRes = await dashboardApi.clients({ Login: q, MaxRows: 1, SkeepRows: 0 });
      let clients = (clientsRes as any)?.Data?.Objects ?? [];

      // Eğer kullanıcı Login üzerinden bulunamazsa ve girilen değer bir sayı ise, bir de Id olarak aramayı deneyelim
      if (clients.length === 0 && /^\d+$/.test(q)) {
        clientsRes = await dashboardApi.clients({ Id: q, MaxRows: 1, SkeepRows: 0 });
        clients = (clientsRes as any)?.Data?.Objects ?? [];
      }

      const client = clients[0];
      if (!client?.Id) {
        setError('Bu kullanıcı adıyla veya ID ile oyuncu bulunamadı.');
        setLoading(false);
        return;
      }
      const checkRes = await checkWithdrawal({ clientId: client.Id });
      if (checkRes.HasError || !checkRes.Data) {
        setError(checkRes.HasError ? 'Kontrol yapılamadı.' : 'Veri alınamadı.');
        setLoading(false);
        return;
      }
      const data = checkRes.Data;
      const account = (data.account ?? {}) as Record<string, unknown>;
      const riskScore = computeRiskScore(data.riskAnalysis);
      const category = getPlayerCategory({
        account,
        riskScore,
        riskAnalysis: data.riskAnalysis,
      });
      setReport({
        clientId: client.Id,
        login: client.Login ?? q,
        account,
        riskAnalysis: data.riskAnalysis,
        withdrawalRulesCheck: data.withdrawalRulesCheck,
        wagerSummary: data.wagerSummary,
        bonusRules: data.bonusRules,
        category,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const totalDeposits = Number(report?.account?.totalDeposits ?? 0) || 0;
  const byType = (report?.account?.profileTransactionsByType as Record<string, { count: number; totalAmount: number }>) ?? {};
  const depositSum = (byType['Para Yatırma']?.totalAmount ?? 0) + (byType['Deposit']?.totalAmount ?? 0);
  const withdrawalSum =
    (byType['Çekim Talebi Ödemesi']?.totalAmount ?? 0) + (byType['Çekim talebi Ödemesi']?.totalAmount ?? 0);
  const netDeposit = totalDeposits || depositSum;
  const depositWithdrawRatio = netDeposit > 0 && withdrawalSum > 0 ? (withdrawalSum / netDeposit) * 100 : null;

  const riskScore = report ? computeRiskScore(report.riskAnalysis) : 0;
  let execReport = null;

  if (report) {
    const failedItems = report.riskAnalysis?.items.filter(i => !i.ok) || [];

    // Yüksek / Düşük risk etiketleme
    let label = report.category.label;
    if (riskScore >= 70) label = "Bonus Hunter / Money Launderer Candidate";
    else if (riskScore >= 40) label = "Professional Arber Şüphelisi";
    else if (label.includes('VIP')) label = "High-Value VIP";
    else if (label.includes('Bonus')) label = "Potansiyel Bonus Abuser";
    else label = "Standart Oyuncu";

    const mathEvidences: string[] = [];
    const behavioralAnomalies: string[] = [];

    // Mevcut analizlerden kanıtları ayır
    const flags = (report.account.flags ?? []) as string[];
    if (flags.length > 0) behavioralAnomalies.push(`Şüpheli hesap bayrakları: ${flags.join(',')}`);

    failedItems.forEach(item => {
      const isMath = item.id.includes('roi') || item.id.includes('ratio');
      if (isMath) mathEvidences.push(item.reason || item.label);
      else behavioralAnomalies.push(item.reason || item.label);
    });

    if (depositWithdrawRatio && depositWithdrawRatio > 100) {
      mathEvidences.push(`Kazanma endeksi: Toplam çekim, yatırıma göre %${depositWithdrawRatio.toFixed(1)} daha yüksek düzeyde.`);
    }

    if (mathEvidences.length === 0) mathEvidences.push("Matematiksel olarak olağan dışı bir sapma veya çevrim verimsizliği (Advantage Play) tespit edilmedi.");
    if (behavioralAnomalies.length === 0) behavioralAnomalies.push("Gecikmeli tur (delayed rounds) veya olağandışı davranışsal strateji kaydı görünmüyor.");

    // Karar ve Aksiyon
    let accountStatus = "Açık Kalsın";
    let limitApp = "Mevcut limitler korunabilir.";
    let bonusAccess = "Aktif ve gelecek bonuslara erişimi açık bırakılabilir.";

    if (riskScore >= 70) {
      accountStatus = "İzlemeye Alın / Kısıtlansın";
      limitApp = "Sportsbook limitini %5'e çek, canlı bahis gecikmesini (delay) 10 saniyeye çıkar. Düşük likiditeli marketler (ITF, alt ligler) kapatılsın.";
      bonusAccess = "Tüm aktif ve gelecek bonuslardan derhal men edilsin.";
    } else if (riskScore >= 40) {
      accountStatus = "İzlemeye Alın";
      limitApp = "Limitlerde manuel onay sürecine geçilebilir, RTP'si çok yüksek slot oyunlarına erişimi kısıtlanabilir.";
      bonusAccess = "Bonus kullanımı devam etse de çevrim şartı sonrası \"Stratejik Geçişleri\" manuel olarak incelenmeli.";
    }

    // Analist notu
    let analystNote = "";
    if (riskScore >= 70) {
      analystNote = "Bu hesapta yüksek oranda yapısal suiistimal paterni tespit edildi (Örn: Yüksek Wagering Efficiency veya AML şüphesi). CLV (Closing Line Value) oranları yakından takip edilmeli, Digital Fingerprint (Cihaz/Tarayıcı ID ve IP lokasyonu) üzerinden bağlantılı hesap (Multi-Acc) taraması yapılmalıdır.";
    } else if (riskScore >= 40) {
      analystNote = "Hesapta finansal veya davranışsal uyarıcı sinyaller mevcut. Yatırım hızı ile oyun hızı (Velocity Analysis) dikkatli incelenmeli. Hesabın şüpheli 'tilt' reaksiyonlarına girip girmediği gözlemlenmeli.";
    } else {
      analystNote = "Hesap şu an için temiz. Tipik bir 'Eğlence Oyuncusu' profili çizmektedir. Şike şüphesi barındıran alt lig bahislerine giriş ya da olağandışı ödeme yöntemi değişiklikleri (Payment Method Consistency) gözlemlenmemiştir.";
    }

    execReport = { label, mathEvidences, behavioralAnomalies, accountStatus, limitApp, bonusAccess, analystNote };
  }

  return (
    <div className="animate-in space-y-6">
      <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-gradient-to-br from-slate-900/90 to-slate-900/70 p-6">
        <h2 className="flex items-center gap-3 text-xl font-semibold text-white">
          <Shield size={28} className="text-blue-400" />
          Risk Analizi
        </h2>
        <p className="mt-1 text-sm text-[color:var(--panel-muted,#8a919c)]">
          Oyuncu kullanıcı adı ile arama yapın; geçmiş işlemler, yatırma/çekim oranı ve risk skoru hesaplanır.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--panel-muted,#8a919c)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Kullanıcı adı (Login)"
              className="w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            Ara
          </button>
        </div>
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-300">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] py-16">
          <Loader2 size={48} className="animate-spin text-blue-400" />
          <p className="text-[color:var(--panel-muted,#8a919c)]">Analiz yapılıyor...</p>
        </div>
      )}

      {report && !loading && execReport && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Analiz Edilen Oyuncu</p>
              <p className="text-xl font-bold text-white mt-1">{report.login} <span className="text-[color:var(--panel-muted,#8a919c)] font-mono text-base ml-2">#{report.clientId}</span></p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest text-right">Net Yatırım</p>
                <p className="text-lg font-mono font-bold text-emerald-400 text-right">{formatNumber(netDeposit)} TRY</p>
              </div>
              {depositWithdrawRatio != null && (
                <div>
                  <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest text-right">Ç/Y Oranı</p>
                  <p className="text-lg font-mono font-bold text-[color:var(--panel-text-dim,#c8cdd5)] text-right">%{(depositWithdrawRatio).toFixed(1)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-1 bg-gradient-to-br from-blue-500/10 to-transparent">
            {/* 1. RİSK SKORU & SINIFLANDIRMA */}
            <div className="p-6">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] pb-2">
                1. Risk Skoru & Sınıflandırma
              </h3>
              <div className="flex items-center gap-6 mt-4">
                <div>
                  <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase mb-1">Skor:</p>
                  <RiskScoreBadge score={riskScore} breakdown={failedBySeverity(report.riskAnalysis)} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase mb-1">Etiket:</p>
                  <span className={`inline-flex items-center rounded-xl px-4 py-3 text-lg font-bold border ${riskScore >= 70 ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : riskScore >= 40 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                    {execReport.label}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. KRİTİK İNCELEME */}
            <div className="p-6 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] pb-2">
                2. Kritik İnceleme (Deep Dive)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="rounded-xl bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] p-4 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                  <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase mb-3">Matematiksel Kanıtlar:</p>
                  <ul className="space-y-2 text-sm">
                    {execReport.mathEvidences.map((item, idx) => (
                      <li key={idx} className="flex gap-2 text-[color:var(--panel-text-dim,#c8cdd5)] items-start">
                        <span className="text-blue-500 mt-0.5">•</span> <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] p-4 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                  <p className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase mb-3">Davranışsal Anomaliler:</p>
                  <ul className="space-y-2 text-sm">
                    {execReport.behavioralAnomalies.map((item, idx) => (
                      <li key={idx} className="flex gap-2 text-[color:var(--panel-text-dim,#c8cdd5)] items-start">
                        <span className="text-blue-500 mt-0.5">•</span> <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* 3. KARAR VE AKSİYON */}
            <div className="p-6 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] pb-2">
                3. Karar Ve Aksiyon (Executive Summary)
              </h3>
              <div className="space-y-4 mt-4 text-sm bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] p-5 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <span className="font-bold text-[color:var(--panel-muted,#8a919c)] uppercase text-[10px] w-32 shrink-0 pt-0.5">Hesap Durumu:</span>
                  <span className="text-white font-medium">{execReport.accountStatus}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <span className="font-bold text-[color:var(--panel-muted,#8a919c)] uppercase text-[10px] w-32 shrink-0 pt-0.5">Limit Uygulaması:</span>
                  <span className="text-white font-medium">{execReport.limitApp}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <span className="font-bold text-[color:var(--panel-muted,#8a919c)] uppercase text-[10px] w-32 shrink-0 pt-0.5">Bonus Erişimi:</span>
                  <span className="text-white font-medium">{execReport.bonusAccess}</span>
                </div>
              </div>
            </div>

            {/* 4. ANALİST NOTU */}
            <div className="p-6 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-blue-950/10 rounded-b-xl">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] pb-2">
                4. Analist Notu
              </h3>
              <div className="mt-4 p-5 rounded-xl border border-blue-500/20 bg-blue-900/10 relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl opacity-80" />
                <p className="text-[color:var(--panel-text-dim,#c8cdd5)] text-sm italic leading-relaxed pl-2">
                  {execReport.analystNote}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!report && !loading && submitSearch && !error && (
        <p className="text-center text-[color:var(--panel-muted,#8a919c)]">Sonuç bulunamadı veya veri yüklenemedi.</p>
      )}
    </div>
  );
}
