import type { ApiResponse, SummaryData } from '../types/dashboard';
import { formatNumber } from '../lib/format';
import { cn } from '../lib/utils';
import { ErrorState } from './ui/ErrorState';
import { AdminCard } from './ui/admin';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Gift, LogIn, UserPlus, Users, Wallet } from 'lucide-react';

interface SummaryCardsProps {
  data: ApiResponse<SummaryData> | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

type Accent = 'neutral' | 'emerald' | 'sky';

export interface PanoMetrigi {
  anahtar: string;
  etiket: string;
  deger: number | null;
  birim: 'para' | 'adet' | 'oyuncu';
  grup: 'finans' | 'oyun' | 'bonus' | 'oyuncu';
  veriYok: boolean;
  aciklama?: string;
}

/**
 * "Veri yok" ile "değer sıfır" AYRI gösterilir.
 *
 * Panonun yanlış görünmesinin sebeplerinden biri buydu: yanıtta hiç
 * olmayan alanlar 0 olarak çiziliyor, operatör de o günün gerçekten
 * sıfır olduğunu sanıyordu.
 */
function sayi(deger: number | null | undefined): string {
  return deger == null ? '—' : formatNumber(deger);
}

const GRUP_ADI: Record<PanoMetrigi['grup'], string> = {
  finans: 'Finans',
  oyun: 'Oyun',
  bonus: 'Bonus',
  oyuncu: 'Oyuncu',
};

function metrikDegeri(m: PanoMetrigi): string {
  if (m.deger == null) return '—';
  if (m.birim === 'para') return `${formatNumber(m.deger)} ₺`;
  return formatNumber(m.deger);
}

/** Lynon panosunun döndürdüğü tüm ölçüler, gruplanmış. */
function LynonMetrikleri({ metrikler }: { metrikler: PanoMetrigi[] }) {
  if (metrikler.length === 0) return null;
  const gruplar = (['finans', 'oyun', 'bonus', 'oyuncu'] as const).filter((g) =>
    metrikler.some((m) => m.grup === g),
  );

  return (
    <div className="space-y-3">
      {gruplar.map((grup) => (
        <AdminCard key={grup} className="p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-muted,#8a919c)]">
            {GRUP_ADI[grup]}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
            {metrikler.filter((m) => m.grup === grup).map((m) => (
              <div key={m.anahtar} title={m.aciklama}>
                <p className="text-[10px] font-medium text-[color:var(--panel-faint,#5c6470)] leading-tight">
                  {m.etiket}
                  {m.aciklama && <span className="ml-1 text-[color:var(--panel-muted,#8a919c)]">ⓘ</span>}
                </p>
                <p
                  className={cn(
                    'mt-1 text-[15px] font-semibold leading-none tabular-nums tracking-[-0.02em]',
                    m.veriYok ? 'text-[color:var(--panel-faint,#5c6470)]' : 'text-white',
                  )}
                >
                  {metrikDegeri(m)}
                </p>
              </div>
            ))}
          </div>
        </AdminCard>
      ))}
    </div>
  );
}

const ACCENT_CHIP: Record<Accent, string> = {
  neutral: 'border-white/[0.08] bg-white/[0.04] text-[color:var(--panel-text-dim,#c8cdd5)]',
  emerald: 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300',
  sky: 'border-sky-400/20 bg-[color:var(--panel-accent,#0a84ff)]/[0.08] text-sky-300',
};

function MetricCard({
  label,
  value,
  meta,
  icon,
  accent = 'neutral',
  delay = 0,
}: {
  label: string;
  value: string;
  meta?: string;
  icon: React.ReactNode;
  accent?: Accent;
  delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <AdminCard className="flex min-h-[112px] flex-col justify-between p-4 transition-colors hover:border-white/[0.12]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--panel-muted,#8a919c)]">{label}</p>
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', ACCENT_CHIP[accent])}>
            {icon}
          </span>
        </div>
        <div className="mt-4">
          <p className="text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">{value}</p>
          {meta && <p className="mt-2 text-[11px] font-medium text-[color:var(--panel-muted,#8a919c)]">{meta}</p>}
        </div>
      </AdminCard>
    </motion.div>
  );
}

export function SummaryCards({ data, isLoading, error, onRetry }: SummaryCardsProps) {
  if (error) {
    return <ErrorState message={error.message} onRetry={onRetry} className="rounded-xl" />;
  }

  if (isLoading || !data?.Data) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[112px] animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.025]" />
        ))}
      </div>
    );
  }

  const d = data.Data;
  // Sunucu artik olmayan alani null gonderiyor (0 degil). `??` ile 0'a
  // cevirmek eski hatayi geri getirirdi: "veri yok" ile "deger sifir"
  // ayni gorunurdu.
  const net = d.NetGelir ?? null;
  const metrikler: PanoMetrigi[] = Array.isArray(d.metrikler) ? d.metrikler : [];

  // Marj gerçek veriden hesaplanır. Önceki dönem alanı API yanıtında yok, bu
  // yüzden dönemsel değişim yüzdesi gösterilmiyor — uydurulmuş bir trend
  // rakamı finansal panelde gerçek sanılacağı için kaldırıldı.
  const yatirim = d.Deposits ?? 0;
  const marginPct = net != null && yatirim > 0 ? (net / yatirim) * 100 : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Toplam Yatırım"
          value={d.Deposits == null ? '—' : `${formatNumber(d.Deposits)} ₺`}
          meta={`${sayi(d.DepositClientCount)} oyuncu · ${sayi(d.FirstDepositCount)} ilk yatırım`}
          icon={<Wallet size={16} />}
          accent="emerald"
        />
        <MetricCard
          label="Toplam Çekim"
          value={d.Withdrawals == null ? '—' : `${formatNumber(d.Withdrawals)} ₺`}
          meta={`${sayi(d.WithdrawalClientCount)} oyuncu`}
          icon={<ArrowUpRight size={16} />}
          accent="sky"
          delay={0.04}
        />
        <MetricCard
          label="Net Gelir (NGR)"
          value={net == null ? '—' : `${formatNumber(net)} ₺`}
          meta={marginPct != null ? `Marj %${marginPct.toFixed(1)}` : 'Marj hesaplanamıyor'}
          icon={(net ?? 0) >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          accent={(net ?? 0) >= 0 ? 'emerald' : 'neutral'}
          delay={0.08}
        />
        {/*
          * Onceden "Aktif Oyuncu" = PLAYERS LOGGED IN idi; o alan yanitta
          * HIC yok, kart surekli 0 gosteriyordu. Lynon'un gercekten
          * dondugu olcu bahis yapan tekil oyuncu sayisi.
          */}
        <MetricCard
          label="Bahis Yapan Oyuncu"
          value={sayi(d.PlayersLoggedIn)}
          meta={`${sayi(metrikler.find((m) => m.anahtar === 'bahisAdedi')?.deger)} bahis`}
          icon={<Users size={16} />}
          delay={0.12}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          // "Günlük Girişler" (LOGIN COUNT) yanitta yok; yerine GGR.
          { label: 'GGR', value: d.GGR, icon: <LogIn size={15} />, accent: 'neutral' as Accent },
          { label: 'Yeni Kayıtlar', value: d.PlayersRegistered, icon: <UserPlus size={15} />, accent: 'sky' as Accent },
          { label: 'Bonus Bakiyesi', value: d.PlayersBonusBalance, icon: <Gift size={15} />, accent: 'emerald' as Accent },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 + i * 0.04 }}
          >
            <AdminCard className="flex items-center gap-3 p-3.5 transition-colors hover:border-white/[0.12]">
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', ACCENT_CHIP[item.accent])}>
                {item.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--panel-muted,#8a919c)]">{item.label}</p>
                <p className="mt-1 text-[17px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white">
                  {sayi(item.value)}
                </p>
              </div>
            </AdminCard>
          </motion.div>
        ))}
      </div>

      {/*
        * Lynon panosu 24 olcu donuyor; onceden bunlarin 7'si
        * gosteriliyordu ve bir kismi yanlis alandan geliyordu. Tamami
        * gruplu olarak burada.
        */}
      <LynonMetrikleri metrikler={metrikler} />
    </div>
  );
}
