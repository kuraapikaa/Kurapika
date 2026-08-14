/**
 * GENEL GORUNUM (pano).
 *
 * Sorgulari artik kendisi sahipleniyor. Eskiden `App.tsx` bes sorguyu
 * tutup `enabled: activeTab === 'dashboard'` ile kapatiyordu; sayfa
 * ROTAYA baglandigi icin monte olmak zaten "aciksin" demek.
 */
import { Suspense, lazy, useState } from 'react';
import { SummaryCards } from '@/components/SummaryCards';
import { PartnerProfit } from '@/components/PartnerProfit';
import { TopSports } from '@/components/TopSports';
import { TopCasinoGames } from '@/components/TopCasinoGames';
import { SportbookOverview } from '@/components/SportbookOverview';
import { StatusBar } from '@/components/StatusBar';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDateRange } from '@/context/DateRangeContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// recharts ~200 kB; STATIK import edildiginde ana pakete giriyordu ve
// lobiye giren oyuncu bile indiriyordu. Yalnizca finans sekmesi acildiginda yuklensin.
const DashboardCharts = lazy(() => import('@/components/DashboardCharts').then(m => ({ default: m.DashboardCharts })));

type PanoAltSekmesi = 'all' | 'financial' | 'partner' | 'sportbook';

const ALT_SEKMELER = [
  { id: 'all' as const, label: 'TAM ANALİZ' },
  { id: 'financial' as const, label: 'FİNANSAL' },
  { id: 'partner' as const, label: 'PARTNER' },
  { id: 'sportbook' as const, label: 'SPOR ANALİZ' },
];

export function PanoSayfasi() {
  const { dateRange } = useDateRange();
  const [altSekme, setAltSekme] = useState<PanoAltSekmesi>('all');

  const [summary, partnerProfit, topSports, topCasino, sportbook] = useDashboardData(dateRange);

  const yukleniyor = [summary, partnerProfit, topSports, topCasino, sportbook].some((q) => q.isLoading);
  const hatalar = [summary, partnerProfit, topSports, topCasino, sportbook]
    .map((q) => q.error?.message ?? null)
    .filter(Boolean);
  const ilkHata = hatalar[0] ?? null;
  const hepsiGeldi = [summary, partnerProfit, topSports, topCasino, sportbook].every((q) => q.isFetched);

  return (
    <div className="space-y-3">
      {/* Alt sekmeler tamamen hap: hem sarmalayici hem secili gosterge. */}
      <div className="dashboard-mode-tabs relative inline-flex gap-1 rounded-full border border-white/5 bg-white/[0.02] p-1 backdrop-blur-xl">
        {ALT_SEKMELER.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setAltSekme(id)}
            className={cn(
              "relative h-8 rounded-full px-4 text-[9px] font-bold tracking-[0.08em] transition-colors duration-150",
              altSekme === id ? "text-white" : "text-slate-500 hover:text-slate-200"
            )}
          >
            {altSekme === id && (
              <motion.div
                layoutId="dashboardSubTab"
                className="absolute inset-0 rounded-full border border-purple-400/25 bg-purple-400/[0.14]"
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>
      {/*
        * Pano ritmi TEK: bölümler arası space-y-3, ızgara
        * içi gap-3. Önceden space-y-3 / gap-8 / space-y-8
        * karışıktı ve parçalar farklı ekranlardan
        * toplanmış gibi duruyordu.
        */}
      {(altSekme === 'all' || altSekme === 'financial') && (
        <div className="space-y-3">
          <SummaryCards data={summary.data} isLoading={summary.isLoading ?? false} error={summary.error ?? null} />
          <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-xl" />}>
            <DashboardCharts data={partnerProfit?.data?.Data} />
          </Suspense>
        </div>
      )}
      {(altSekme === 'all' || altSekme === 'partner') && (
        <div className="space-y-3">
          <PartnerProfit data={partnerProfit?.data} isLoading={partnerProfit?.isLoading ?? false} error={partnerProfit?.error ?? null} />
          <SportbookOverview data={sportbook?.data} isLoading={sportbook?.isLoading ?? false} error={sportbook?.error ?? null} />
        </div>
      )}
      {(altSekme === 'all' || altSekme === 'sportbook') && (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <TopSports data={topSports?.data} isLoading={topSports?.isLoading ?? false} error={topSports?.error ?? null} />
          <TopCasinoGames data={topCasino?.data} isLoading={topCasino?.isLoading ?? false} error={topCasino?.error ?? null} />
        </div>
      )}
      <StatusBar isLoading={yukleniyor} error={ilkHata} success={hepsiGeldi && hatalar.length === 0} />
    </div>
  );
}
