import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  BarChart3,
  ChevronLeft,
  Coins,
  Handshake,
  Image,
  Mail,
  MapPin,
  Network,
  PieChart,
  Radio,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Unlink,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  affiliateAdminApi,
  dashboardApi,
  type AffiliateHesap,
  type AffiliateHesapDurumu,
  type AffiliateKomisyonModeli,
  type AffiliateMetrik,
} from '../../api/client';
import { formatDateDisplay, formatNumber } from '../../lib/format';
import type { ClientItem } from '../../types/dashboard';
import { BugscrmSekmesi } from './BugscrmSekmesi';
import { OlcumSekmesi } from './affiliate/OlcumSekmesi';
import { MedyaSekmesi } from './affiliate/MedyaSekmesi';
import { KademeSekmesi } from './affiliate/KademeSekmesi';
import { PostbackSekmesi } from './affiliate/PostbackSekmesi';

/**
 * Affiliate merkezi.
 *
 * Once yalnizca ham toplamlari gosteriyordu (oyuncu, yatirim, GGR). "Hangi
 * ortak gercekten kazandiriyor" sorusunun cevabi o sayilarda degil,
 * aralarindaki oranlarda: oyuncu basi gelir, gelir payi, cekim orani. Bunlar
 * sunucuda turetiliyor (affiliateMetrics.ts) ve artik ekranda.
 *
 * Uc sekme: BTag performansi (tum trafik), Ortaklar (hesap yonetimi),
 * Komisyon (hakedis raporu).
 */

type Sekme = 'performans' | 'olcumler' | 'ortaklar' | 'komisyon' | 'medya' | 'kademeler' | 'postback' | 'bugscrm';

type Siralama = 'netPozisyon' | 'netRevenue' | 'totalPlayers' | 'oyuncuBasiGelir' | 'cekimOrani';

const SIRALAMA_ADI: Record<Siralama, string> = {
  netPozisyon: 'Net pozisyon',
  netRevenue: 'Net gelir',
  totalPlayers: 'Oyuncu sayısı',
  oyuncuBasiGelir: 'Oyuncu başına gelir',
  cekimOrani: 'Çekim oranı',
};

const MODEL_ADI: Record<AffiliateKomisyonModeli, string> = {
  revshare: 'Gelir paylaşımı',
  cpa: 'CPA',
  hibrit: 'Hibrit',
};

const DURUM_RENGI: Record<AffiliateHesapDurumu, string> = {
  aktif: 'text-emerald-300 bg-emerald-500/10',
  beklemede: 'text-amber-300 bg-amber-500/10',
  askida: 'text-rose-300 bg-rose-500/10',
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

const KART = 'rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))]';
const GIRDI = 'h-10 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-sm text-white outline-none focus:border-cyan-400/40';
const ETIKET = 'text-[10px] font-semibold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]';

// ─── Ortak ekleme formu ──────────────────────────────────────────────────────

function OrtakEkleFormu({ onKapat }: { onKapat: () => void }) {
  const queryClient = useQueryClient();
  const [ad, setAd] = useState('');
  const [bTag, setBTag] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [komisyonModeli, setKomisyonModeli] = useState<AffiliateKomisyonModeli>('revshare');
  const [revsharePayi, setRevsharePayi] = useState(25);
  const [cpaTutari, setCpaTutari] = useState(0);
  const [hata, setHata] = useState('');

  const ekle = useMutation({
    mutationFn: () =>
      affiliateAdminApi.hesapEkle({ ad, bTag, email, password, komisyonModeli, revsharePayi, cpaTutari }),
    onSuccess: (sonuc) => {
      if (sonuc.ok) {
        queryClient.invalidateQueries({ queryKey: ['affiliate-hesaplar'] });
        queryClient.invalidateQueries({ queryKey: ['affiliate-komisyon'] });
        onKapat();
      } else {
        setHata(sonuc.message || 'Ortak eklenemedi.');
      }
    },
    onError: (err: Error) => setHata(err.message),
  });

  const gecerli = ad.trim() && bTag.trim() && email.trim() && password.length >= 8;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setHata('');
        ekle.mutate();
      }}
      className={`${KART} space-y-4 p-5`}
    >
      <h3 className="text-sm font-bold text-white">Yeni ortak</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="ortak-ad" className={ETIKET}>Ortak adı</label>
          <input id="ortak-ad" value={ad} onChange={(e) => setAd(e.target.value)} className={GIRDI} placeholder="Kanal / kişi adı" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ortak-btag" className={ETIKET}>BTag</label>
          <input id="ortak-btag" value={bTag} onChange={(e) => setBTag(e.target.value)} className={GIRDI} placeholder="NARCOS01" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ortak-email" className={ETIKET}>E-posta (giriş)</label>
          <input id="ortak-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={GIRDI} placeholder="ortak@example.com" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ortak-parola" className={ETIKET}>Parola (en az 8 karakter)</label>
          <input id="ortak-parola" type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={GIRDI} placeholder="Ortağa iletilecek parola" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ortak-model" className={ETIKET}>Komisyon modeli</label>
          <select id="ortak-model" value={komisyonModeli} onChange={(e) => setKomisyonModeli(e.target.value as AffiliateKomisyonModeli)} className={GIRDI}>
            <option value="revshare">Gelir paylaşımı</option>
            <option value="cpa">CPA</option>
            <option value="hibrit">Hibrit</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="ortak-revshare" className={ETIKET}>Gelir payı %</label>
            <input id="ortak-revshare" type="number" value={revsharePayi} onChange={(e) => setRevsharePayi(Number(e.target.value))} disabled={komisyonModeli === 'cpa'} className={`${GIRDI} disabled:opacity-40`} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ortak-cpa" className={ETIKET}>CPA ₺</label>
            <input id="ortak-cpa" type="number" value={cpaTutari} onChange={(e) => setCpaTutari(Number(e.target.value))} disabled={komisyonModeli === 'revshare'} className={`${GIRDI} disabled:opacity-40`} />
          </div>
        </div>
      </div>

      {hata && <p role="alert" className="text-xs text-rose-400">{hata}</p>}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={!gecerli || ekle.isPending} className="h-10 rounded-xl bg-cyan-500 px-5 text-xs font-bold text-black disabled:opacity-40">
          {ekle.isPending ? 'Ekleniyor...' : 'Ortağı ekle'}
        </button>
        <button type="button" onClick={onKapat} className="h-10 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-5 text-xs font-bold text-[color:var(--panel-muted,#8a919c)]">
          Vazgeç
        </button>
        <p className="ml-auto text-[10px] text-[color:var(--panel-faint,#5c6470)]">
          Parola tek seferlik gösterilir; ortağa siz iletirsiniz.
        </p>
      </div>
    </form>
  );
}

// ─── Ortaklar sekmesi ────────────────────────────────────────────────────────

function OrtaklarSekmesi() {
  const queryClient = useQueryClient();
  const [formAcik, setFormAcik] = useState(false);

  const hesaplarQuery = useQuery({
    queryKey: ['affiliate-hesaplar'],
    queryFn: () => affiliateAdminApi.hesaplar(),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const durumDegistir = useMutation({
    mutationFn: ({ id, durum }: { id: string; durum: AffiliateHesapDurumu }) =>
      affiliateAdminApi.hesapGuncelle(id, { durum }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['affiliate-hesaplar'] }),
  });

  const sil = useMutation({
    mutationFn: (id: string) => affiliateAdminApi.hesapSil(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-hesaplar'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-komisyon'] });
    },
  });

  const hesaplar = hesaplarQuery.data?.hesaplar ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--panel-muted,#8a919c)]">
          Ortak hesabı, BTag’i ortak paneline bağlar. Bir BTag yalnızca tek ortağa bağlanabilir.
        </p>
        {!formAcik && (
          <button type="button" onClick={() => setFormAcik(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-500 px-4 text-xs font-bold text-black">
            <Plus size={15} /> Ortak ekle
          </button>
        )}
      </div>

      {formAcik && <OrtakEkleFormu onKapat={() => setFormAcik(false)} />}

      <div className={`overflow-hidden ${KART}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 text-[10px] uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)]">
              <tr>
                <th className="px-5 py-4">Ortak</th>
                <th className="px-5 py-4">BTag</th>
                <th className="px-5 py-4">Komisyon</th>
                <th className="px-5 py-4">Son giriş</th>
                <th className="px-5 py-4 text-center">Durum</th>
                <th className="px-5 py-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {hesaplarQuery.isLoading ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">Ortaklar yükleniyor...</td></tr>
              ) : hesaplarQuery.error ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-rose-400"><AlertCircle className="mx-auto mb-2" size={24} />{(hesaplarQuery.error as Error).message}</td></tr>
              ) : hesaplar.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">Henüz ortak hesabı yok. Onayladığınız başvuru için “Ortak ekle” ile hesap oluşturun.</td></tr>
              ) : hesaplar.map((hesap: AffiliateHesap) => (
                <tr key={hesap.id} className="hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <div className="font-bold text-white">{hesap.ad}</div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-[color:var(--panel-faint,#5c6470)]"><Mail size={11} />{hesap.email}</div>
                  </td>
                  <td className="px-5 py-4 font-mono text-[color:var(--panel-text-dim,#c8cdd5)]">{hesap.bTag}</td>
                  <td className="px-5 py-4 text-[color:var(--panel-muted,#8a919c)]">
                    <div className="font-semibold text-[color:var(--panel-text-dim,#c8cdd5)]">{MODEL_ADI[hesap.komisyonModeli]}</div>
                    <div className="text-[10px]">
                      {hesap.komisyonModeli !== 'cpa' && `%${hesap.revsharePayi}`}
                      {hesap.komisyonModeli === 'hibrit' && ' · '}
                      {hesap.komisyonModeli !== 'revshare' && tl(hesap.cpaTutari)}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[color:var(--panel-muted,#8a919c)]">
                    {hesap.sonGiris ? formatDateDisplay(hesap.sonGiris) : 'Hiç giriş yapmadı'}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <select
                      value={hesap.durum}
                      onChange={(e) => durumDegistir.mutate({ id: hesap.id, durum: e.target.value as AffiliateHesapDurumu })}
                      className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider outline-none ${DURUM_RENGI[hesap.durum]}`}
                    >
                      <option value="aktif">Aktif</option>
                      <option value="beklemede">Beklemede</option>
                      <option value="askida">Askıda</option>
                    </select>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        // Silme geri alinamaz ve ortagin panel erisimini
                        // aninda kesiyor; onay istiyoruz.
                        if (window.confirm(`${hesap.ad} ortağı silinsin mi? Panel erişimi hemen kesilir.`)) {
                          sil.mutate(hesap.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/10"
                    >
                      <Trash2 size={12} /> Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Komisyon sekmesi ────────────────────────────────────────────────────────

function KomisyonSekmesi({ range }: { range: { startDate: string; endDate: string } }) {
  const raporQuery = useQuery({
    queryKey: ['affiliate-komisyon', range.startDate, range.endDate],
    queryFn: () => affiliateAdminApi.komisyonRaporu(range),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (raporQuery.isLoading) {
    return <div className={`${KART} p-14 text-center text-sm text-[color:var(--panel-muted,#8a919c)]`}>Komisyon raporu hesaplanıyor...</div>;
  }
  if (raporQuery.error) {
    return (
      <div className={`${KART} p-14 text-center text-sm text-rose-400`}>
        <AlertCircle className="mx-auto mb-2" size={24} />{(raporQuery.error as Error).message}
      </div>
    );
  }

  const rapor = raporQuery.data;
  if (!rapor?.ok) return null;

  return (
    <div className="space-y-4">
      <div className={`${KART} flex flex-wrap items-end justify-between gap-4 p-5`}>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/80">
            <Coins size={13} /> Dönem toplam hakedişi
          </div>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-white">{tl(rapor.toplamKomisyon)}</div>
        </div>
        <p className="text-[11px] text-[color:var(--panel-faint,#5c6470)]">
          {rapor.aralik.startDate} – {rapor.aralik.endDate}
        </p>
      </div>

      <div className={`overflow-hidden ${KART}`}>
        <div className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-5 py-4">
          <h3 className="text-sm font-bold text-white">Ortak hakedişleri</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 text-[10px] uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)]">
              <tr>
                <th className="px-5 py-4">Ortak / BTag</th>
                <th className="px-5 py-4 text-right">Aktif oyuncu</th>
                <th className="px-5 py-4 text-right">Net gelir</th>
                <th className="px-5 py-4">Hesap</th>
                <th className="px-5 py-4 text-right">Hakediş</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rapor.satirlar.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">Ortak hesabı tanımlı değil.</td></tr>
              ) : rapor.satirlar.map((satir) => (
                <tr key={satir.ortak.id} className="hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <div className="font-bold text-white">{satir.ortak.ad}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-[color:var(--panel-faint,#5c6470)]">{satir.ortak.bTag}</div>
                  </td>
                  <td className="px-5 py-4 text-right text-[color:var(--panel-text-dim,#c8cdd5)]">
                    {satir.metrik ? formatNumber(numberValue(satir.metrik.activePlayers)) : '—'}
                  </td>
                  <td className={`px-5 py-4 text-right font-semibold ${numberValue(satir.metrik?.netRevenue) >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                    {satir.metrik ? tl(numberValue(satir.metrik.netRevenue)) : '—'}
                  </td>
                  <td className="px-5 py-4 text-[10px] text-[color:var(--panel-muted,#8a919c)]">{satir.komisyon.aciklama}</td>
                  <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-amber-300">{tl(satir.komisyon.toplam)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ortagi olmayan BTag'ler: gelir uretiyor ama komisyon odenmiyor.
          Gozden kacmamalari icin ayri gosteriliyor. */}
      {rapor.baglanmamis.length > 0 && (
        <div className={`overflow-hidden ${KART}`}>
          <div className="flex items-center gap-2 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-5 py-4">
            <Unlink size={15} className="text-amber-300" />
            <h3 className="text-sm font-bold text-white">Ortağa bağlanmamış BTag’ler</h3>
            <span className="ml-auto text-[10px] text-[color:var(--panel-faint,#5c6470)]">{rapor.baglanmamis.length} kayıt</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <tbody className="divide-y divide-white/5">
                {rapor.baglanmamis.map((satir) => (
                  <tr key={satir.bTag} className="hover:bg-white/[0.03]">
                    <td className="px-5 py-3.5 font-mono text-[color:var(--panel-text-dim,#c8cdd5)]">{satir.bTag}</td>
                    <td className="px-5 py-3.5 text-right text-[color:var(--panel-muted,#8a919c)]">{formatNumber(numberValue(satir.activePlayers))} aktif</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-cyan-300">{tl(numberValue(satir.netRevenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

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
            <button type="button" onClick={() => setSelectedBTag(null)} className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/5 p-2 text-[color:var(--panel-muted,#8a919c)] hover:text-white" title="Geri dön">
              <ChevronLeft size={18} />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-white">{selectedBTag} oyuncuları</h2>
              <p className="text-xs text-[color:var(--panel-muted,#8a919c)]">BTag ayrıntısı istek üzerine, en fazla 100 kayıtla yüklenir.</p>
            </div>
          </div>
        </div>

        <div className={`overflow-hidden ${KART}`}>
          {selectedBTag === 'BTag Yok' ? (
            <div className="p-10 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">BTag değeri olmayan oyuncular için ayrıntılı arama yapılmaz.</div>
          ) : playersQuery.isLoading ? (
            <div className="p-10 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">Oyuncular yükleniyor...</div>
          ) : players.length === 0 ? (
            <div className="p-10 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">Bu BTag için oyuncu bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 text-[10px] uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)]">
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
                        <div className="mt-1 text-[10px] text-[color:var(--panel-faint,#5c6470)]">#{player.Id}</div>
                      </td>
                      <td className="px-5 py-4 text-[color:var(--panel-muted,#8a919c)]"><span className="flex items-center gap-1"><Mail size={12} />{player.Email || 'E-posta yok'}</span></td>
                      <td className="px-5 py-4 text-[color:var(--panel-muted,#8a919c)]"><span className="flex items-center gap-1"><MapPin size={12} />{player.City || '—'}</span></td>
                      <td className="px-5 py-4 text-right font-bold text-white">{formatNumber(numberValue(player.Balance))} {player.CurrencyId || 'TRY'}</td>
                      <td className="px-5 py-4 text-[color:var(--panel-muted,#8a919c)]">{formatDateDisplay(player.CreatedLocalDate)} / {formatDateDisplay(player.LastLoginLocalDate)}</td>
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
    { label: 'Net gelir (GGR)', value: tl(totalGgr), icon: TrendingUp, color: 'text-blue-300' },
    { label: 'Net pozisyon', value: tl(netPozisyon), icon: BarChart3, color: 'text-amber-300' },
    { label: 'Aktif oyuncu', value: formatNumber(activePlayers), icon: UserCheck, color: 'text-violet-300' },
  ];

  const sekmeler: Array<{ id: Sekme; ad: string; ikon: typeof BarChart3 }> = [
    { id: 'performans', ad: 'BTag performansı', ikon: BarChart3 },
    { id: 'ortaklar', ad: 'Ortaklar', ikon: Handshake },
    { id: 'komisyon', ad: 'Komisyon', ikon: Coins },
    { id: 'olcumler', ad: 'Eğilimler', ikon: Activity },
    { id: 'medya', ad: 'Medya', ikon: Image },
    { id: 'kademeler', ad: 'Kademeler', ikon: Network },
    { id: 'postback', ad: 'Postback', ikon: Radio },
    { id: 'bugscrm', ad: 'BugsCRM', ikon: Target },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">Affiliate merkezi</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Ortaklık yönetimi</h2>
          <p className="mt-1 text-sm text-[color:var(--panel-muted,#8a919c)]">
            Kanal performansı, ortak hesapları ve dönem hakedişleri.
          </p>
        </div>
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
                : 'border border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[color:var(--panel-muted,#8a919c)] hover:text-white'
            }`}
          >
            <s.ikon size={14} /> {s.ad}
          </button>
        ))}
      </div>

      {sekme === 'ortaklar' && <OrtaklarSekmesi />}
      {sekme === 'komisyon' && <KomisyonSekmesi range={range} />}
      {sekme === 'olcumler' && <OlcumSekmesi range={range} />}
      {sekme === 'medya' && <MedyaSekmesi />}
      {sekme === 'kademeler' && <KademeSekmesi />}
      {sekme === 'postback' && <PostbackSekmesi />}
      {sekme === 'bugscrm' && <BugscrmSekmesi />}

      {sekme === 'performans' && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {cards.map((card) => (
              <div key={card.label} className={`${KART} p-4`}>
                <div className={`mb-3 inline-flex rounded-lg bg-white/[0.04] p-2 ${card.color}`}><card.icon size={17} /></div>
                <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--panel-faint,#5c6470)]">{card.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-white">{card.value}</div>
              </div>
            ))}
          </div>

          <div className={`overflow-hidden ${KART}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-5 py-4">
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
                  className="h-9 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/30 px-3 text-xs text-white outline-none focus:border-cyan-400/40"
                >
                  {(Object.keys(SIRALAMA_ADI) as Siralama[]).map((k) => (
                    <option key={k} value={k}>{SIRALAMA_ADI[k]}</option>
                  ))}
                </select>
                <label className="relative block w-full sm:w-56">
                  <span className="sr-only">BTag ara</span>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--panel-faint,#5c6470)]" size={15} />
                  <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="BTag ara..." className="h-9 w-full rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-400/40" />
                </label>
                <span className="text-[10px] text-[color:var(--panel-faint,#5c6470)]">{filteredStats.length} kayıt</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-xs">
                <thead className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 text-[10px] uppercase tracking-wider text-[color:var(--panel-muted,#8a919c)]">
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
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">BTag raporu hazırlanıyor...</td></tr>
                  ) : summaryQuery.error ? (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-rose-400"><AlertCircle className="mx-auto mb-2" size={24} />{summaryQuery.error.message}</td></tr>
                  ) : filteredStats.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-[color:var(--panel-muted,#8a919c)]">BTag kaydı bulunamadı.</td></tr>
                  ) : filteredStats.map((item) => (
                    <tr key={item.bTag} onClick={() => setSelectedBTag(item.bTag)} className="cursor-pointer hover:bg-white/[0.03]">
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-bold text-white"><PieChart size={14} className="text-cyan-300" />{item.bTag}</span></td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">{formatNumber(numberValue(item.totalPlayers))}</span>
                        <span className="mx-1.5 text-[color:var(--panel-faint,#5c6470)]">/</span>
                        <span className="text-emerald-300">{formatNumber(numberValue(item.activePlayers))}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-emerald-300">{formatNumber(numberValue(item.totalDeposits))}</span>
                        <span className="mx-1.5 text-[color:var(--panel-faint,#5c6470)]">/</span>
                        <span className="text-rose-300">{formatNumber(numberValue(item.totalWithdrawals))}</span>
                      </td>
                      <td className={`px-5 py-4 text-right font-semibold ${item.netPozisyon >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>{tl(item.netPozisyon)}</td>
                      <td className="px-5 py-4 text-right text-[color:var(--panel-text-dim,#c8cdd5)]">{tl(item.oyuncuBasiGelir)}</td>
                      {/* Cekim orani 1'in ustundeyse bu kanal para kaybettiriyor. */}
                      <td className={`px-5 py-4 text-right font-semibold ${item.cekimOrani > 1 ? 'text-rose-300' : 'text-[color:var(--panel-muted,#8a919c)]'}`}>
                        {formatNumber(Math.round(item.cekimOrani * 100) / 100)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className={`font-semibold ${numberValue(item.netRevenue) >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>{tl(numberValue(item.netRevenue))}</div>
                        <div className="text-[10px] text-[color:var(--panel-faint,#5c6470)]">{yuzde(item.gelirPayi)}</div>
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
