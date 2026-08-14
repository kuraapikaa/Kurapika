import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  ChevronLeft,
  Handshake,
  Mail,
  MapPin,
  PieChart,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { dashboardApi, type AffiliateMetrik } from '@/api/client';
import { formatDateDisplay, formatNumber } from '@/lib/format';
import type { ClientItem } from '@/types/dashboard';
import { BugscrmSekmesi } from '@/components/admin/BugscrmSekmesi';

/**
 * BTag performansi.
 *
 * Once yalnizca ham toplamlari gosteriyordu (oyuncu, yatirim, GGR). "Hangi
 * kanal gercekten kazandiriyor" sorusunun cevabi o sayilarda degil,
 * aralarindaki oranlarda: oyuncu basi gelir, gelir payi, cekim orani. Bunlar
 * sunucuda turetiliyor (affiliateMetrics.ts) ve artik ekranda.
 *
 * ── Burasi ARTIK ORTAK YONETIMI DEGIL ──
 *
 * Ortak hesaplari, komisyon planlari, medya, kademeler ve postback ayri bir
 * urune tasindi: Bugs Affiliate. Bu ekranlarin burada da durmasi iki ayri
 * affiliate arayuzu demekti ve panelde hangisinin guncel oldugu
 * anlasilmiyordu -- yenilikler yeni panele gidiyor, kullanici eskisine
 * bakip "hicbir sey degismemis" goruyordu.
 *
 * Geriye Lynon'un KENDI BTag raporu (tum trafik) ile BugsCRM entegrasyonu
 * kaldi; ikisi de ortak hesap sisteminden bagimsiz.
 */

type Sekme = 'performans' | 'bugscrm';

type Siralama = 'netPozisyon' | 'netRevenue' | 'totalPlayers' | 'oyuncuBasiGelir' | 'cekimOrani';

const SIRALAMA_ADI: Record<Siralama, string> = {
  netPozisyon: 'Net pozisyon',
  netRevenue: 'Net gelir',
  totalPlayers: 'Oyuncu sayısı',
  oyuncuBasiGelir: 'Oyuncu başına gelir',
  cekimOrani: 'Çekim oranı',
};

function istanbulDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

const tl = (n: number) => `${formatNumber(Math.round(n))} ₺`;
const yuzde = (n: number) => `%${formatNumber(Math.round(n * 10) / 10)}`;

const KART = 'rounded-2xl border border-white/5 bg-white/[0.02]';

// ─── Ana bileşen ─────────────────────────────────────────────────────────────

export function AffiliatePanel() {
  const navigate = useNavigate();
  const [sekme, setSekme] = useState<Sekme>('performans');
  const [searchTerm, setSearchTerm] = useState('');
  const [siralama, setSiralama] = useState<Siralama>('netPozisyon');
  const [selectedBTag, setSelectedBTag] = useState<string | null>(null);

  const range = useMemo(() => ({
    startDate: istanbulDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)),
    endDate: istanbulDate(new Date()),
  }), []);

  const summaryQuery = useQuery({
    queryKey: ['affiliate-summary', range.startDate, range.endDate],
    queryFn: () => dashboardApi.affiliateSummary(range),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const summary = summaryQuery.data?.Data as any;

  // Sunucu turetilmis alanlari (netPozisyon, gelirPayi, ...) zaten dolduruyor;
  // burada yalnizca ham alanlari normalize ediyoruz.
  const bTagStats = useMemo<AffiliateMetrik[]>(() => {
    const rows = Array.isArray(summary?.Objects) ? summary.Objects : [];
    return rows.map((item: any) => ({
      ...item,
      bTag: String(item.bTag ?? item.BTag ?? 'BTag Yok'),
      totalPlayers: numberValue(item.totalPlayers ?? item.PlayersCount),
      activePlayers: numberValue(item.activePlayers ?? item.ActivePlayersCount),
      totalDeposits: numberValue(item.totalDeposits ?? item.TotalDepositAmount),
      totalWithdrawals: numberValue(item.totalWithdrawals ?? item.TotalWithdrawAmount),
      netRevenue: numberValue(item.netRevenue ?? item.GGR),
      conversionRate: numberValue(item.conversionRate),
      netPozisyon: numberValue(item.netPozisyon),
      oyuncuBasiGelir: numberValue(item.oyuncuBasiGelir),
      oyuncuBasiYatirim: numberValue(item.oyuncuBasiYatirim),
      gelirPayi: numberValue(item.gelirPayi),
      cekimOrani: numberValue(item.cekimOrani),
    }));
  }, [summary]);

  const filteredStats = useMemo(() => {
    const arama = searchTerm.toLocaleLowerCase('tr-TR');
    const suzulmus = bTagStats.filter((item) => item.bTag.toLocaleLowerCase('tr-TR').includes(arama));
    const deger = (s: AffiliateMetrik) =>
      siralama === 'netRevenue' ? numberValue(s.netRevenue)
      : siralama === 'totalPlayers' ? numberValue(s.totalPlayers)
      : numberValue((s as unknown as Record<string, unknown>)[siralama]);
    return [...suzulmus].sort((a, b) => deger(b) - deger(a));
  }, [bTagStats, searchTerm, siralama]);

  const playersQuery = useQuery({
    queryKey: ['affiliate-btag-players', selectedBTag],
    queryFn: () => dashboardApi.clients({ BTag: selectedBTag, MaxRows: 100, SkeepRows: 0 }),
    enabled: Boolean(selectedBTag && selectedBTag !== 'BTag Yok'),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const players = playersQuery.data?.Data?.Objects ?? [];

  const toplam = summary?.Toplam;
  const totalPlayers = numberValue(toplam?.oyuncu ?? summary?.TotalPlayers);
  const activePlayers = numberValue(toplam?.aktifOyuncu);
  const totalGgr = numberValue(toplam?.netGelir);
  const netPozisyon = numberValue(toplam?.netPozisyon);

  if (selectedBTag) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSelectedBTag(null)} className="rounded-2xl border border-white/5 bg-white/5 p-2 text-slate-400 hover:text-white" title="Geri dön">
              <ChevronLeft size={18} />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-white">{selectedBTag} oyuncuları</h2>
              <p className="text-xs text-slate-400">BTag ayrıntısı istek üzerine, en fazla 100 kayıtla yüklenir.</p>
            </div>
          </div>
        </div>

        <div className={`overflow-hidden ${KART}`}>
          {selectedBTag === 'BTag Yok' ? (
            <div className="p-10 text-center text-sm text-slate-400">BTag değeri olmayan oyuncular için ayrıntılı arama yapılmaz.</div>
          ) : playersQuery.isLoading ? (
            <div className="p-10 text-center text-sm text-slate-400">Oyuncular yükleniyor...</div>
          ) : players.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">Bu BTag için oyuncu bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="border-b border-white/5 bg-black/20 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Oyuncu</th>
                    <th className="px-5 py-4">İletişim</th>
                    <th className="px-5 py-4">Konum</th>
                    <th className="px-5 py-4 text-right">Bakiye</th>
                    <th className="px-5 py-4">Kayıt / Son giriş</th>
                    <th className="px-5 py-4 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {players.map((player: ClientItem) => (
                    <tr key={player.Id} className="hover:bg-white/[0.03]">
                      <td className="px-5 py-4">
                        <button type="button" onClick={() => navigate(`/player-profile/${player.Id}/${encodeURIComponent(player.Login)}`)} className="font-bold text-white hover:text-cyan-300">
                          {player.Login}
                        </button>
                        <div className="mt-1 text-[10px] text-slate-500">#{player.Id}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-400"><span className="flex items-center gap-1"><Mail size={12} />{player.Email || 'E-posta yok'}</span></td>
                      <td className="px-5 py-4 text-slate-400"><span className="flex items-center gap-1"><MapPin size={12} />{player.City || '—'}</span></td>
                      <td className="px-5 py-4 text-right font-bold text-white">{formatNumber(numberValue(player.Balance))} {player.CurrencyId || 'TRY'}</td>
                      <td className="px-5 py-4 text-slate-400">{formatDateDisplay(player.CreatedLocalDate)} / {formatDateDisplay(player.LastLoginLocalDate)}</td>
                      <td className="px-5 py-4 text-center">
                        {player.IsLocked ? <span className="inline-flex items-center gap-1 text-rose-400"><ShieldAlert size={13} /> Kilitli</span> : <span className="inline-flex items-center gap-1 text-emerald-400"><ShieldCheck size={13} /> Aktif</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Toplam affiliate', value: formatNumber(bTagStats.length), icon: Users, color: 'text-cyan-300' },
    { label: 'Toplam oyuncu', value: formatNumber(totalPlayers), icon: Target, color: 'text-emerald-300' },
    { label: 'Net gelir (GGR)', value: tl(totalGgr), icon: TrendingUp, color: 'text-purple-300' },
    { label: 'Net pozisyon', value: tl(netPozisyon), icon: BarChart3, color: 'text-amber-300' },
    { label: 'Aktif oyuncu', value: formatNumber(activePlayers), icon: UserCheck, color: 'text-violet-300' },
  ];

  const sekmeler: Array<{ id: Sekme; ad: string; ikon: typeof BarChart3 }> = [
    { id: 'performans', ad: 'BTag performansı', ikon: BarChart3 },
    { id: 'bugscrm', ad: 'BugsCRM', ikon: Target },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">Kanal performansı</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">BTag performansı</h2>
          <p className="mt-1 text-sm text-slate-400">
            Lynon'un BTag raporundan tüm trafik. Ortak hesapları ve hakediş Bugs Affiliate'te.
          </p>
        </div>

        <a
          href="/affiliate-paneli"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-500/25"
        >
          <Handshake size={14} /> Bugs Affiliate panelini aç
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {sekmeler.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSekme(s.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              sekme === s.id
                ? 'bg-cyan-500/15 text-cyan-300'
                : 'border border-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <s.ikon size={14} /> {s.ad}
          </button>
        ))}
      </div>

      {sekme === 'bugscrm' && <BugscrmSekmesi />}

      {sekme === 'performans' && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {cards.map((card) => (
              <div key={card.label} className={`${KART} p-4`}>
                <div className={`mb-3 inline-flex rounded-xl bg-white/[0.04] p-2 ${card.color}`}><card.icon size={17} /></div>
                <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{card.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-white">{card.value}</div>
              </div>
            ))}
          </div>

          <div className={`overflow-hidden ${KART}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={17} className="text-cyan-300" />
                <h3 className="text-sm font-bold text-white">BTag kârlılık listesi</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="affiliate-siralama" className="sr-only">Sıralama</label>
                <select
                  id="affiliate-siralama"
                  value={siralama}
                  onChange={(e) => setSiralama(e.target.value as Siralama)}
                  className="h-9 rounded-2xl border border-white/5 bg-black/30 px-3 text-xs text-white outline-none focus:border-cyan-400/40"
                >
                  {(Object.keys(SIRALAMA_ADI) as Siralama[]).map((k) => (
                    <option key={k} value={k}>{SIRALAMA_ADI[k]}</option>
                  ))}
                </select>
                <label className="relative block w-full sm:w-56">
                  <span className="sr-only">BTag ara</span>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="BTag ara..." className="h-9 w-full rounded-2xl border border-white/5 bg-white/[0.02] pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-400/40" />
                </label>
                <span className="text-[10px] text-slate-500">{filteredStats.length} kayıt</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-xs">
                <thead className="border-b border-white/5 bg-black/20 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-4">BTag / Kaynak</th>
                    <th className="px-5 py-4 text-right">Oyuncu / Aktif</th>
                    <th className="px-5 py-4 text-right">Yatırım / Çekim</th>
                    <th className="px-5 py-4 text-right">Net pozisyon</th>
                    <th className="px-5 py-4 text-right">Oyuncu başı gelir</th>
                    <th className="px-5 py-4 text-right">Çekim oranı</th>
                    <th className="px-5 py-4 text-right">GGR / Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summaryQuery.isLoading ? (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-400">BTag raporu hazırlanıyor...</td></tr>
                  ) : summaryQuery.error ? (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-rose-400"><AlertCircle className="mx-auto mb-2" size={24} />{summaryQuery.error.message}</td></tr>
                  ) : filteredStats.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-400">BTag kaydı bulunamadı.</td></tr>
                  ) : filteredStats.map((item) => (
                    <tr key={item.bTag} onClick={() => setSelectedBTag(item.bTag)} className="cursor-pointer hover:bg-white/[0.03]">
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-bold text-white"><PieChart size={14} className="text-cyan-300" />{item.bTag}</span></td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-slate-200">{formatNumber(numberValue(item.totalPlayers))}</span>
                        <span className="mx-1.5 text-slate-500">/</span>
                        <span className="text-emerald-300">{formatNumber(numberValue(item.activePlayers))}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-emerald-300">{formatNumber(numberValue(item.totalDeposits))}</span>
                        <span className="mx-1.5 text-slate-500">/</span>
                        <span className="text-rose-300">{formatNumber(numberValue(item.totalWithdrawals))}</span>
                      </td>
                      <td className={`px-5 py-4 text-right font-semibold ${item.netPozisyon >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>{tl(item.netPozisyon)}</td>
                      <td className="px-5 py-4 text-right text-slate-200">{tl(item.oyuncuBasiGelir)}</td>
                      {/* Cekim orani 1'in ustundeyse bu kanal para kaybettiriyor. */}
                      <td className={`px-5 py-4 text-right font-semibold ${item.cekimOrani > 1 ? 'text-rose-300' : 'text-slate-400'}`}>
                        {formatNumber(Math.round(item.cekimOrani * 100) / 100)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className={`font-semibold ${numberValue(item.netRevenue) >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>{tl(numberValue(item.netRevenue))}</div>
                        <div className="text-[10px] text-slate-500">{yuzde(item.gelirPayi)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
