import { useEffect, useRef, useCallback } from 'react';
import { Zap, ShieldAlert, CheckCircle2, AlertTriangle, X, Activity, Timer, ShieldCheck, ArrowRight, AlertCircle, Gift } from 'lucide-react';
import { formatNumber } from '../../lib/format';
import { cn } from '../../lib/utils';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface ChecklistItem {
  id: string;
  label: string;
  ok: boolean;
  reason?: string;
  severity?: RiskSeverity;
}

export interface PromoChecklist {
  promoId: number;
  promoTitle: string;
  overallOk: boolean;
  items: ChecklistItem[];
}

export interface RuleSetResult {
  overallOk: boolean;
  items: ChecklistItem[];
}

interface BonusItem {
  Id: number;
  Name: string;
  Description: string;
  Amount: number;
  WageredAmount: number;
  ToWagerAmount: number;
  RealAmount: number;
  WinAmount: number;
  PaidAmount: number;
  CreatedByUserName?: string;
  CreatedLocal: string;
  AcceptanceDateLocal: string | null;
  ResultDateLocal: string | null;
  ClientBonusExpirationDateLocal: string | null;
  StatusName?: string;
  [key: string]: any;
}

interface WithdrawalChecklistModalProps {
  account?: {
    ClientId?: number;
    id?: number;
    ClientLogin?: string;
    ClientName?: string;
    balance?: number;
    bonuses?: BonusItem[];
    lastDepositBonuses?: BonusItem[];
    notes?: Array<{ id: number; note: string; createdLocal: string }>;
    lastDeposit?: { amount: number; dateLocal: string };
    withdrawalTime?: string;
    totalBetAmountSinceLastDeposit?: number;
    /** Profil penceresinde çekim ödemesi yoksa true (ilk çekim). */
    isFirstWithdrawal?: boolean;
    profileTransactionsByType?: Record<string, { count: number; totalAmount: number }>;
    profileTransactions?: Array<{
      DocumentId: number;
      DocumentTypeId: number;
      DocumentTypeName: string;
      Amount: number;
      Game?: string;
      CreatedLocal?: string;
    }>;
  } | null;
  checklists?: PromoChecklist[] | null;
  withdrawalRulesCheck?: RuleSetResult | null;
  riskAnalysis?: RuleSetResult | null;
  wagerSummary?: RuleSetResult | null;
  bonusRules?: RuleSetResult | null;
  onClose?: () => void;
  /** true = sekme içinde pencere olarak aç (overlay yok); false = tam ekran modal */
  inline?: boolean;
}

function RuleBlock({
  title,
  result,
  icon: Icon,
  colorClass,
}: {
  title: string;
  result: RuleSetResult;
  icon: any;
  colorClass: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${result.overallOk
        ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
        : 'border-amber-500/20 bg-amber-500/[0.03]'
        }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colorClass}`}>
            <Icon size={16} />
          </div>
          <h4 className="text-xs font-black uppercase tracking-wide text-white/90">{title}</h4>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${result.overallOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
          {result.overallOk ? 'OK' : 'KRİTİK'}
        </span>
      </div>
      <ul className="space-y-1.5">
        {result.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-xs">
            <span className={cn("mt-0.5 shrink-0", item.ok ? 'text-emerald-400' : 'text-amber-400')}>
              {item.ok ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
            </span>
            <div className="flex flex-col min-w-0">
              <span className={item.ok ? 'text-slate-300' : 'text-amber-200'}>{item.label}</span>
              {item.reason != null && item.reason !== '' && (
                <span className="text-slate-500 mt-0.5 leading-relaxed">— {item.reason}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RiskRuleBlock({ title, result }: { title: string; result: RuleSetResult }) {
  const failedBySeverity = { high: 0, medium: 0, low: 0 };
  result.items.forEach((i) => {
    if (!i.ok && i.severity) failedBySeverity[i.severity]++;
  });
  const hasHigh = failedBySeverity.high > 0;
  const hasMedium = failedBySeverity.medium > 0;
  const badge = result.overallOk ? 'GÜVENLİ' : hasHigh ? 'YÜKSEK RİSK' : hasMedium ? 'ORTA RİSK' : 'GÖZLEM';

  return (
    <div
      className={`rounded-xl border p-3 ${result.overallOk
        ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
        : hasHigh ? 'border-rose-500/30 bg-rose-500/[0.03]' : 'border-amber-500/20 bg-amber-500/[0.03]'
        }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-black uppercase tracking-wide text-white/90 flex items-center gap-2">
          <ShieldAlert size={16} className={hasHigh ? 'text-rose-400' : 'text-amber-400'} />
          {title}
        </h4>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${result.overallOk ? 'bg-emerald-500/20 text-emerald-400' : hasHigh ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
          {badge}
        </span>
      </div>
      <ul className="space-y-1.5">
        {result.items.map((item) => {
          const sev = item.severity ?? 'medium';
          const failColor = item.ok ? 'text-slate-300' : sev === 'high' ? 'text-rose-200' : 'text-amber-200';
          return (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              <span className={cn("mt-0.5 shrink-0", item.ok ? 'text-emerald-400' : sev === 'high' ? 'text-rose-400' : 'text-amber-400')}>
                {item.ok ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
              </span>
              <div className="flex flex-col min-w-0">
                <span className={failColor}>{item.label}</span>
                {item.reason && <span className="text-slate-500 mt-0.5 leading-relaxed">— {item.reason}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WithdrawalChecklistModal({
  account,
  checklists,
  withdrawalRulesCheck,
  riskAnalysis,
  wagerSummary,
  bonusRules,
  onClose,
  inline = false,
}: WithdrawalChecklistModalProps) {
  const modalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inline || !onClose) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [inline, onClose]);

  useEffect(() => {
    if (inline) return;
    const el = modalContainerRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, [inline]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalContainerRef.current) return;
    const focusables = Array.from(modalContainerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) return;
    const current = document.activeElement as HTMLElement | null;
    const idx = current ? focusables.indexOf(current) : -1;
    if (e.shiftKey) {
      if (idx <= 0) {
        e.preventDefault();
        focusables[focusables.length - 1].focus();
      }
    } else {
      if (idx === focusables.length - 1 || idx === -1) {
        e.preventDefault();
        focusables[0].focus();
      }
    }
  }, []);

  if (!account) return null;
  const highestWin = (() => {
    if (!account.profileTransactions) return null;

    // Helper to parse BC date formats
    const parseTime = (s: string | null | undefined): number => {
      if (!s) return 0;
      const d = new Date(s);
      // If native Date fails, try common BC format DD-MM-YY
      if (Number.isNaN(d.getTime())) {
        const match = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);
        if (match) {
          const [, day, month, year] = match;
          const y = year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);
          const timeMatch = s.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
          const h = timeMatch ? parseInt(timeMatch[1], 10) : 0;
          const m = timeMatch ? parseInt(timeMatch[2], 10) : 0;
          const sec = timeMatch && timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
          return new Date(y, parseInt(month, 10) - 1, parseInt(day, 10), h, m, sec).getTime();
        }
      }
      return d.getTime() || 0;
    };

    const startTime = account.lastDeposit ? parseTime(account.lastDeposit.dateLocal) : 0;
    const endTime = account.withdrawalTime ? parseTime(account.withdrawalTime) : Date.now();

    const wins = account.profileTransactions.filter(tx => {
      const isWin = String(tx.DocumentTypeName).trim() === 'Kazanç Artar' ||
        String(tx.DocumentTypeName).trim() === 'Win';
      if (!isWin) return false;

      const txTime = parseTime(tx.CreatedLocal);
      // Filter by range: [startTime, endTime]
      return txTime >= startTime && txTime <= endTime;
    });

    if (wins.length === 0) return null;
    return wins.reduce((max, curr) => (Math.abs(curr.Amount) > Math.abs(max.Amount) ? curr : max));
  })();

  const content = (
    <div
      className={`relative flex w-full max-w-[95vw] flex-col overflow-hidden bg-slate-900 border border-white/10 rounded-2xl shadow-2xl ${inline ? 'max-h-[85vh] animate-in fade-in duration-200' : 'max-h-[90vh] animate-in zoom-in-95 duration-300'
        }`}
      onClick={inline ? undefined : (e) => e.stopPropagation()}
      role={inline ? 'region' : 'dialog'}
      aria-modal={inline ? undefined : 'true'}
      aria-label={inline ? undefined : 'Detaylı analiz raporu'}
    >
      {/* Header: kompakt */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-white truncate">Otomatik Çekim Kontrolü</h3>
            <p className="text-xs text-slate-400">ID: <span className="tabular-nums text-blue-400">{account.id ?? account.ClientId ?? '—'}</span></p>
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Kapat">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
        {/* Özet: tek satır */}
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="flex-1 min-w-[140px] rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <span className="text-xs font-black text-slate-500 uppercase block mb-0.5">Oyuncu</span>
            <p className="text-base font-black text-white truncate">{account.ClientLogin || '—'}</p>
            <p className="text-xs text-slate-500 truncate">{account.ClientName || '—'}</p>
            {account.isFirstWithdrawal && <span className="mt-1.5 inline-block rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-400">İlk çekim</span>}
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 min-w-[100px]">
            <span className="text-xs font-black text-slate-500 uppercase block mb-0.5">Bakiye</span>
            <p className="text-lg font-black text-emerald-400 tabular-nums">{formatNumber(account.balance)} <span className="text-xs text-slate-500">TRY</span></p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 min-w-[160px]">
            <span className="text-xs font-black text-slate-500 uppercase block mb-0.5">Baz yatırım</span>
            {account.lastDeposit ? (
              <>
                <p className="text-lg font-black text-white tabular-nums">{formatNumber(account.lastDeposit.amount)} TRY</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(() => {
                    const raw = account.lastDeposit.dateLocal ?? '';
                    if (!raw) return '—';
                    const d = new Date(raw);
                    return !Number.isNaN(d.getTime()) ? d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : raw;
                  })()}
                </p>
              </>
            ) : <p className="text-base text-slate-500">—</p>}
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 min-w-[160px]">
            <span className="text-xs font-black text-slate-500 uppercase block mb-0.5">En yüksek kazanç (Round)</span>
            {highestWin ? (
              <>
                <p className="text-lg font-black text-emerald-400 tabular-nums">{formatNumber(highestWin.Amount)} TRY</p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                  {highestWin.Game || 'Casino / Slot'}
                </p>
              </>
            ) : <p className="text-base text-slate-500">—</p>}
          </div>
        </div>

        {account.notes && account.notes.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <h4 className="text-xs font-black uppercase tracking-wide text-amber-400/90 flex items-center gap-2 mb-2"><AlertCircle size={14} /> Üye notları</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
              {account.notes.map((note, i) => (
                <div key={note.id || i} className="p-2.5 rounded-lg bg-slate-900/50 border border-white/5">
                  <p className="text-sm text-slate-200 leading-snug">{note.note}</p>
                  <span className="text-xs text-slate-500">{note.createdLocal}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {account.lastDepositBonuses && account.lastDepositBonuses.length > 0 && (
          <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
            <h4 className="text-xs font-black uppercase tracking-wide text-cyan-400 flex items-center gap-2 mb-2"><Gift size={14} /> Kullanılan bonuslar ({account.lastDepositBonuses.length})</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {account.lastDepositBonuses.map((bonus, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm font-bold text-white truncate">{bonus.Name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {bonus.ClientBonusExpirationDateLocal && new Date(bonus.ClientBonusExpirationDateLocal).getTime() < Date.now() && bonus.ToWagerAmount > 0 && (
                        <span className="rounded bg-slate-600/30 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 border border-slate-500/30">Süresi dolmuş</span>
                      )}
                      {bonus.ToWagerAmount > 0 ? (
                        <span className="text-xs font-black text-amber-500 tabular-nums">{formatNumber(bonus.ToWagerAmount)} TRY kalan</span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400">Tamamlandı</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-500">
                    <span>Bonus: {formatNumber(bonus.Amount)}</span>
                    <span>Oynanan: {formatNumber(bonus.WageredAmount || 0)}</span>
                    <span className="text-emerald-400">Kazanç: {formatNumber(bonus.WinAmount || 0)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {bonus.CreatedLocal ? new Date(bonus.CreatedLocal).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    {bonus.ClientBonusExpirationDateLocal && (
                      <>
                        {' · Geçerlilik: '}
                        {new Date(bonus.ClientBonusExpirationDateLocal).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit' })}
                        {new Date(bonus.ClientBonusExpirationDateLocal).getTime() < Date.now() && bonus.ToWagerAmount > 0 && ' (süresi dolmuş)'}
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {account.profileTransactionsByType && (
          <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
            <h4 className="text-xs font-black uppercase tracking-wide text-slate-400 flex items-center gap-2 mb-2"><Activity size={14} /> Hacim (son 3 gün)</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(account.profileTransactionsByType).map(([name, data]) => (
                <span key={name} className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-xs">
                  <span className="text-slate-500 truncate max-w-[120px] inline-block align-bottom">{name}</span>
                  <span className="ml-1.5 font-black text-white tabular-nums">{data.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {wagerSummary && <RuleBlock title="Wager" result={wagerSummary} icon={Timer} colorClass="text-blue-400" />}
          {withdrawalRulesCheck && <RuleBlock title="Çekim kuralları" result={withdrawalRulesCheck} icon={ShieldCheck} colorClass="text-blue-400" />}
          {bonusRules && <RuleBlock title="Bonus kuralları" result={bonusRules} icon={Gift} colorClass="text-cyan-400" />}
        </div>

        {checklists && checklists.length > 0 && (() => {
          const activeBonusNames = (account.bonuses || []).filter(b => b.ToWagerAmount > 0).map(b => b.Name.toLowerCase());
          const activePromos = checklists.filter(promo =>
            activeBonusNames.some(name => promo.promoTitle.toLowerCase().includes(name) || name.includes(promo.promoTitle.toLowerCase()))
          );
          const otherPromos = checklists.filter(p => !activeBonusNames.some(name => p.promoTitle.toLowerCase().includes(name) || name.includes(p.promoTitle.toLowerCase()))).slice(0, 2);
          return (
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-500">Promosyon kontrolleri</h4>
              {activePromos.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Aktif bonus eşleşmesi yok.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activePromos.map(promo => (
                    <RuleBlock key={promo.promoId} title={promo.promoTitle} result={promo} icon={Zap} colorClass="text-amber-400" />
                  ))}
                  {otherPromos.map(promo => (
                    <RuleBlock key={promo.promoId} title={promo.promoTitle} result={promo} icon={Activity} colorClass="text-slate-400" />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {riskAnalysis && <RiskRuleBlock title="Sistem Güvenlik Kontrolü" result={riskAnalysis} />}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-950/80 border-t border-white/10">
        <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-bold uppercase text-slate-400 hover:bg-white/5 hover:text-white">
          Kapat
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-black uppercase text-white"
        >
          Ödeme emrini doğrula
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );

  return inline ? content : (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div ref={modalContainerRef} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {content}
      </div>
    </div>
  );
}
