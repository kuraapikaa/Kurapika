/**
 * Pano özeti.
 *
 * Lynon `dashboardData` 24 ölçü döndürüyor. Bu ekran onları üç katmanda
 * gösterir:
 *
 *   1. Günün akışı  — giren / çıkan / kalan, tek çubukta oransal.
 *   2. Dört ana ölçü — yatırım, çekim, GGR, kâr.
 *   3. Tam liste     — Finans / Oyun / Bonus / Oyuncu gruplarında.
 *
 * ── GGR ve kâr yan yana durur ─────────────────────────────────────────
 *
 * Aynı günde `GGR +33.123` ve `PROFIT -50.318` olabiliyor: GGR oyun
 * marjı, PROFIT bonus ve freespin maliyetlerini de içeriyor. Eskiden kod
 * `PROFIT ?? GGR` yazıyor, biri diğerinin yerine geçince işaret bile ters
 * dönüyordu. Artık ikisi de kendi kartında ve işaretiyle duruyor; çelişki
 * gizlenmiyor, görünür kılınıyor.
 */
import type { ApiResponse, SummaryData } from '../types/dashboard';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Percent, UserPlus, Users, Wallet } from 'lucide-react';
import { ErrorState } from './ui/ErrorState';
import {
  AkisSeridi,
  PanoBolum,
  PanoHucre,
  PanoKart,
  PanoOlcu,
  isaretliYaz,
  sayiYaz,
  type PanoVurgu,
} from './ui/pano';

interface SummaryCardsProps {
  data: ApiResponse<SummaryData> | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

export interface PanoMetrigi {
  anahtar: string;
  etiket: string;
  deger: number | null;
  birim: 'para' | 'adet' | 'oyuncu';
  grup: 'finans' | 'oyun' | 'bonus' | 'oyuncu';
  veriYok: boolean;
  aciklama?: string;
  /** Değerin geldiği Lynon alan adı — "pano yanlış" şikâyetini izlenebilir kılar. */
  alan?: string;
  /** Uçtan gelen ham değer ("11000 TRY" gibi). */
  hamDeger?: string | null;
}

const GRUP_ADI: Record<PanoMetrigi['grup'], string> = {
  finans: 'Finans',
  oyun: 'Oyun',
  bonus: 'Bonus',
  oyuncu: 'Oyuncu',
};

/** Grup vurgusu anlamı taşır: para girişi, hacim, maliyet, oyuncu. */
const GRUP_VURGU: Record<PanoMetrigi['grup'], PanoVurgu> = {
  finans: 'giris',
  oyun: 'hacim',
  bonus: 'maliyet',
  oyuncu: 'oyuncu',
};

export function SummaryCards({ data, isLoading, error, onRetry }: SummaryCardsProps) {
  if (error) {
    return <ErrorState message={error.message} onRetry={onRetry} className="rounded-xl" />;
  }

  if (isLoading || !data?.Data) {
    return (
      <div className="space-y-3">
        <div className="h-[104px] animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.025]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[116px] animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.025]" />
          ))}
        </div>
      </div>
    );
  }

  const d = data.Data;
  const metrikler: PanoMetrigi[] = Array.isArray(d.metrikler) ? d.metrikler : [];

  // Sunucu yanıtta olmayan alanı null gönderiyor. `?? 0` yazmak eski
  // hatayı geri getirirdi: "veri yok" ile "değer sıfır" aynı görünürdü.
  const net = d.NetGelir ?? null;

  // Marj gerçek veriden hesaplanır. Önceki dönem alanı yanıtta yok, bu
  // yüzden dönemsel değişim yüzdesi gösterilmiyor — uydurulmuş bir trend
  // rakamı finansal panelde gerçek sanılır.
  const yatirim = d.Deposits ?? 0;
  const marj = net != null && yatirim > 0 ? (net / yatirim) * 100 : null;

  const bul = (anahtar: string) => metrikler.find((m) => m.anahtar === anahtar)?.deger ?? null;
  const gruplar = (['finans', 'oyun', 'bonus', 'oyuncu'] as const).filter((g) =>
    metrikler.some((m) => m.grup === g),
  );

  const anaOlculer = [
    {
      etiket: 'Toplam Yatırım',
      deger: sayiYaz(d.Deposits, 'para'),
      alt: `${sayiYaz(d.DepositClientCount)} oyuncu · ${sayiYaz(d.FirstDepositCount)} ilk yatırım`,
      simge: <Wallet size={16} />,
      vurgu: 'giris' as PanoVurgu,
      veriYok: d.Deposits == null,
    },
    {
      etiket: 'Toplam Çekim',
      deger: sayiYaz(d.Withdrawals, 'para'),
      alt: `${sayiYaz(d.WithdrawalClientCount)} oyuncu`,
      simge: <ArrowUpRight size={16} />,
      vurgu: 'cikis' as PanoVurgu,
      veriYok: d.Withdrawals == null,
    },
    {
      etiket: 'GGR',
      deger: isaretliYaz(d.GGR),
      alt: 'Gerçek bahis eksi gerçek kazanç',
      simge: <Percent size={16} />,
      vurgu: ((d.GGR ?? 0) >= 0 ? 'giris' : 'cikis') as PanoVurgu,
      veriYok: d.GGR == null,
    },
    {
      etiket: 'Kâr',
      deger: isaretliYaz(d.Profit),
      alt: 'Bonus ve freespin maliyeti dahil',
      simge: (d.Profit ?? 0) >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />,
      vurgu: ((d.Profit ?? 0) >= 0 ? 'giris' : 'cikis') as PanoVurgu,
      veriYok: d.Profit == null,
    },
  ];

  return (
    <div className="space-y-3">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <AkisSeridi yatirim={d.Deposits} cekim={d.Withdrawals} />
      </motion.div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {anaOlculer.map((olcu, i) => (
          <motion.div
            key={olcu.etiket}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 + i * 0.04, duration: 0.25 }}
          >
            <PanoOlcu {...olcu} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { etiket: 'Net Gelir', deger: net == null ? '—' : isaretliYaz(net), alt: marj != null ? `Marj %${marj.toFixed(1)}` : 'Marj hesaplanamıyor', simge: <Wallet size={15} />, vurgu: ((net ?? 0) >= 0 ? 'giris' : 'cikis') as PanoVurgu, veriYok: net == null },
          { etiket: 'Bahis Yapan Oyuncu', deger: sayiYaz(d.PlayersLoggedIn), alt: `${sayiYaz(bul('bahisAdedi'))} bahis`, simge: <Users size={15} />, vurgu: 'hacim' as PanoVurgu, veriYok: d.PlayersLoggedIn == null },
          { etiket: 'Yeni Kayıt', deger: sayiYaz(d.PlayersRegistered), alt: `${sayiYaz(d.PlayersBonusBalance, 'para')} bonus bakiyesi`, simge: <UserPlus size={15} />, vurgu: 'oyuncu' as PanoVurgu, veriYok: d.PlayersRegistered == null },
        ].map((olcu, i) => (
          <motion.div
            key={olcu.etiket}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.04, duration: 0.25 }}
          >
            <PanoOlcu {...olcu} />
          </motion.div>
        ))}
      </div>

      {/*
        * Lynon'un döndürdüğü 24 ölçünün tamamı. Önceden 7'si
        * gösteriliyordu; kalanı hiç görünmüyordu.
        */}
      {gruplar.map((grup) => (
        <PanoKart key={grup} className="p-4">
          <PanoBolum baslik={GRUP_ADI[grup]} vurgu={GRUP_VURGU[grup]} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
            {metrikler
              .filter((m) => m.grup === grup)
              .map((m) => (
                <PanoHucre
                  key={m.anahtar}
                  etiket={m.etiket}
                  deger={sayiYaz(m.deger, m.birim)}
                  /*
                   * IZLENEBILIRLIK.
                   *
                   * "Pano yanlış gösteriyor" şikâyeti, hangi sayının
                   * nereden geldiği görünmediği sürece adreslenemiyor.
                   * Her ölçü artık Lynon alan adını ve ham değerini
                   * taşıyor; üzerine gelince eşleme hatası ile ucun
                   * kendi verisi bir bakışta ayrılıyor.
                   */
                  aciklama={[m.aciklama, m.alan ? `Lynon alanı: ${m.alan} = ${m.hamDeger ?? '(yanıtta yok)'}` : null]
                    .filter(Boolean)
                    .join('\n')}
                  veriYok={m.veriYok}
                />
              ))}
          </div>
        </PanoKart>
      ))}

      {(d.PlayersBalance != null || d.Aralik || (d.taninmayanAlanlar?.length ?? 0) > 0) && (
        <PanoKart className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-[11px] text-[color:var(--panel-muted,#8a919c)]">
            Oyuncu gerçek bakiyesi{' '}
            <span className="font-semibold tabular-nums text-white">{sayiYaz(d.PlayersBalance, 'para')}</span>
          </p>
          {/*
            * SORULAN PENCERE.
            *
            * "Pano yanlış gösteriyor" şikâyetinin bir kısmı rakam değil
            * TARİH hatasıydı: pano dünü soruyor, operatör bugünü
            * bekliyordu. Sorulan aralığı yazmak bunu tartışılır olmaktan
            * çıkarır.
            */}
          {d.Aralik && (
            <p className="text-[11px] text-[color:var(--panel-muted,#8a919c)]">
              Sorulan aralık{' '}
              <span className="font-semibold tabular-nums text-white">
                {d.Aralik.startDate === d.Aralik.endDate
                  ? d.Aralik.startDate
                  : `${d.Aralik.startDate} → ${d.Aralik.endDate}`}
              </span>{' '}
              <span className="opacity-60">(Türkiye saati)</span>
            </p>
          )}
          {(d.taninmayanAlanlar?.length ?? 0) > 0 && (
            <p className="text-[11px] text-amber-400/90">
              Lynon {d.taninmayanAlanlar!.length} yeni ölçü döndürdü: {d.taninmayanAlanlar!.join(', ')}
            </p>
          )}
        </PanoKart>
      )}
    </div>
  );
}
