import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Crown,
  Loader2,
  Search,
  ShieldOff,
  Check,
  MessageSquare,
  PhoneCall,
  TrendingDown,
  UserX,
} from 'lucide-react';
import { crmApi, type ChurnOyuncu, type ChurnSonucu } from '../api/client';
import { formatNumber, formatDateDisplay } from '../lib/format';
import { matchesTr } from '../lib/turkishSearch';
import { cn } from '../lib/utils';

/**
 * Kayıp riski (churn) ekranı.
 *
 * Skorlama SUNUCUDA (churnScoreService). Bu ekran önceden listeyi çekip her
 * oyuncu için ayrı KPI isteği atıyordu — 20 satır = 20 paralel istek, sayfa
 * değişince baştan. Artık tek çağrı listeyi, skoru ve özeti birlikte getiriyor.
 *
 * Skor kadar SEBEBİ de gösteriliyor: operatör bir oyuncuyu neden aradığını
 * bilmeden aramamalı. Skor tek başına "şuna güven" demek olurdu.
 */

const SEVIYE_STILI: Record<ChurnSonucu['seviye'], { etiket: string; renk: string; zemin: string }> = {
  kritik: { etiket: 'Kritik', renk: 'var(--panel-danger,#ff453a)', zemin: 'rgba(255,69,58,0.12)' },
  yuksek: { etiket: 'Yüksek', renk: 'var(--panel-warning,#ff9f0a)', zemin: 'rgba(255,159,10,0.12)' },
  orta: { etiket: 'Orta', renk: 'var(--panel-info,#64d2ff)', zemin: 'rgba(100,210,255,0.1)' },
  dusuk: { etiket: 'Düşük', renk: 'var(--panel-muted,#8a919c)', zemin: 'rgba(242,244,248,0.05)' },
};

const SEGMENT_ETIKET: Record<ChurnSonucu['segment'], string> = {
  vip: 'VIP',
  yuksek: 'Yüksek değer',
  orta: 'Orta',
  dusuk: 'Düşük',
  yeni: 'Yeni',
};

const SEGMENTLER = [
  { id: '', label: 'Tümü' },
  { id: 'vip', label: 'VIP' },
  { id: 'yuksek', label: 'Yüksek değer' },
  { id: 'orta', label: 'Orta' },
  { id: 'yeni', label: 'Yeni' },
];

const ESIKLER = [
  { id: '0', label: 'Hepsi' },
  { id: '25', label: 'Orta ve üstü' },
  { id: '50', label: 'Yüksek ve üstü' },
  { id: '75', label: 'Yalnızca kritik' },
];

export function ChurnPrevention() {
  const [page, setPage] = useState(1);
  const [minSkor, setMinSkor] = useState(25);
  const [segment, setSegment] = useState('');
  const [arama, setArama] = useState('');
  const countPerPage = 50;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['crm-churn', page, minSkor, segment],
    queryFn: () => crmApi.churn({ page, countPerPage, minSkor, segment: segment || undefined }),
    staleTime: 2 * 60 * 1000,
  });

  const oyuncular = data?.Data?.players ?? [];
  const ozet = data?.Data?.ozet;

  // Arama yerel: sunucu sayfası zaten skora göre sıralı geliyor, istemcide
  // daraltmak sayfa değiştirmeden hızlı sonuç veriyor.
  const filtreli = useMemo(
    () => (arama.trim() ? oyuncular.filter((o) => matchesTr(o.login ?? '', arama)) : oyuncular),
    [oyuncular, arama],
  );

  return (
    <div className="animate-in space-y-4 pb-20">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">CRM</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Kayıp riski</h2>
          <p className="mt-1 text-[12px] text-slate-400">
            Skor sunucuda hesaplanır; her satırda riskin gerekçesi ve önerilen aksiyon görünür.
          </p>
        </div>
        {isFetching && <Loader2 size={16} className="animate-spin text-slate-400" />}
      </header>

      <OzetSerit ozet={ozet} />

      <div className="flex flex-wrap items-center gap-2">
        <SecimGrubu
          deger={String(minSkor)}
          secenekler={ESIKLER}
          onSec={(v) => { setMinSkor(Number(v)); setPage(1); }}
        />
        <SecimGrubu
          deger={segment}
          secenekler={SEGMENTLER}
          onSec={(v) => { setSegment(v); setPage(1); }}
        />
        <div className="relative ml-auto">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={arama}
            onChange={(event) => setArama(event.target.value)}
            placeholder="Kullanıcı adı ara"
            className="h-9 w-56 rounded-lg border border-white/5 bg-black/30 pl-9 pr-3 text-xs font-semibold text-white outline-none"
          />
        </div>
      </div>

      {error ? (
        <Durum ikon={<ShieldOff size={20} />} baslik="Liste alınamadı" alt={(error as Error).message} />
      ) : isLoading ? (
        <Durum ikon={<Loader2 size={20} className="animate-spin" />} baslik="Yükleniyor" alt="Oyuncular skorlanıyor." />
      ) : filtreli.length === 0 ? (
        <Durum ikon={<UserX size={20} />} baslik="Risk altında oyuncu yok" alt="Seçili eşik ve segmentte kayıt bulunamadı." />
      ) : (
        <div className="space-y-2">
          {filtreli.map((oyuncu) => <Satir key={oyuncu.id} oyuncu={oyuncu} />)}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-400">Sayfa {page}</span>
        <div className="flex gap-2">
          <Sayfalama yon="geri" pasif={page <= 1} onTikla={() => setPage((p) => Math.max(1, p - 1))} />
          <Sayfalama yon="ileri" pasif={oyuncular.length < countPerPage} onTikla={() => setPage((p) => p + 1)} />
        </div>
      </div>
    </div>
  );
}

function OzetSerit({ ozet }: { ozet?: { toplam: number; kritik: number; yuksek: number; riskAltindakiDeger: number } }) {
  const kartlar = [
    { etiket: 'Listedeki oyuncu', deger: formatNumber(ozet?.toplam ?? 0), Ikon: UserX, renk: 'var(--panel-muted,#8a919c)' },
    { etiket: 'Kritik', deger: formatNumber(ozet?.kritik ?? 0), Ikon: AlertTriangle, renk: 'var(--panel-danger,#ff453a)' },
    { etiket: 'Yüksek', deger: formatNumber(ozet?.yuksek ?? 0), Ikon: TrendingDown, renk: 'var(--panel-warning,#ff9f0a)' },
    { etiket: 'Risk altındaki net yatırım', deger: `${formatNumber(ozet?.riskAltindakiDeger ?? 0)} ₺`, Ikon: Crown, renk: 'var(--panel-success,#30d158)' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kartlar.map(({ etiket, deger, Ikon, renk }) => (
        <div key={etiket} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="mb-2 inline-flex rounded-lg p-2" style={{ backgroundColor: 'rgba(242,244,248,0.04)', color: renk }}>
            <Ikon size={16} />
          </div>
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{etiket}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-white">{deger}</div>
        </div>
      ))}
    </div>
  );
}

function Satir({ oyuncu }: { oyuncu: ChurnOyuncu }) {
  const stil = SEVIYE_STILI[oyuncu.churn.seviye];
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums"
          style={{ backgroundColor: stil.zemin, color: stil.renk }}
          title={`Risk skoru: ${oyuncu.churn.skor}/100`}
        >
          {oyuncu.churn.skor}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{oyuncu.login}</span>
            <Rozet metin={stil.etiket} renk={stil.renk} zemin={stil.zemin} />
            <Rozet metin={SEGMENT_ETIKET[oyuncu.churn.segment]} renk="var(--panel-muted,#8a919c)" zemin="rgba(242,244,248,0.05)" />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {oyuncu.churn.sessizGun == null ? 'Giriş kaydı yok' : `${oyuncu.churn.sessizGun} gündür sessiz`}
            {' · '}Net yatırım {formatNumber(oyuncu.churn.deger)} ₺
            {oyuncu.lastLoginDate ? ` · Son giriş ${formatDateDisplay(oyuncu.lastLoginDate)}` : ''}
          </p>
        </div>

        <Link
          to={`/oyuncular?q=${encodeURIComponent(oyuncu.login)}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[color:var(--panel-accent,#0a84ff)] px-4 text-[11px] font-semibold text-white"
        >
          Profili aç <ArrowRight size={13} />
        </Link>
      </div>

      {/* Skorun gerekçesi. Operatör neden aradığını bilmeli. */}
      {oyuncu.churn.sebepler.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
          {oyuncu.churn.sebepler.map((sebep) => (
            <span
              key={sebep.kod}
              className="rounded-md px-2 py-1 text-[10px] font-semibold text-slate-400"
              style={{ backgroundColor: 'rgba(242,244,248,0.04)' }}
            >
              {sebep.aciklama}
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-[11px] font-medium" style={{ color: stil.renk }}>{oyuncu.churn.oneri}</p>

      <TemasSatiri oyuncu={oyuncu} />
    </div>
  );
}

/**
 * Hizli temas kaydi.
 *
 * Churn listesi kimin aranacagini soyluyordu ama "arandi mi" bilgisi hicbir
 * yerde yoktu; ayni oyuncu iki temsilci tarafindan ayni gun aranabiliyordu.
 * Kayit listeden cikmadan alinabilsin diye buraya kondu — ayri ekrana
 * gitmek gereken bir adim, atlanan bir adim olurdu.
 */
function TemasSatiri({ oyuncu }: { oyuncu: ChurnOyuncu }) {
  const qc = useQueryClient();
  const [acik, setAcik] = useState(false);
  const [not, setNot] = useState('');
  const [tur, setTur] = useState('arama');
  const [sonuc, setSonuc] = useState('ulasildi');

  const kaydet = useMutation({
    mutationFn: () => crmApi.temasEkle({ login: oyuncu.login, tur, sonuc, not }),
    onSuccess: () => {
      setAcik(false);
      setNot('');
      qc.invalidateQueries({ queryKey: ['crm-churn'] });
    },
  });

  const sonTemas = oyuncu.sonTemas;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2.5">
      {sonTemas ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgba(48,209,88,0.1)] px-2 py-1 text-[10px] font-semibold text-[color:var(--panel-success,#30d158)]">
          <Check size={11} />
          Son temas {formatDateDisplay(sonTemas.createdAt)} · {sonTemas.tur}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgba(242,244,248,0.04)] px-2 py-1 text-[10px] font-semibold text-slate-500">
          <PhoneCall size={11} /> Hiç temas edilmemiş
        </span>
      )}

      {!acik ? (
        <button
          type="button"
          onClick={() => setAcik(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/5 px-3 py-1.5 text-[10px] font-semibold text-slate-400"
        >
          <MessageSquare size={11} /> Temas kaydet
        </button>
      ) : (
        <div className="flex w-full flex-wrap items-center gap-2">
          <select
            value={tur}
            onChange={(e) => setTur(e.target.value)}
            className="h-8 rounded-md border border-white/5 bg-black/30 px-2 text-[11px] text-white"
          >
            <option value="arama">Arama</option>
            <option value="sms">SMS</option>
            <option value="not">Not</option>
            <option value="bonus">Bonus</option>
            <option value="kampanya">Kampanya</option>
          </select>
          <select
            value={sonuc}
            onChange={(e) => setSonuc(e.target.value)}
            className="h-8 rounded-md border border-white/5 bg-black/30 px-2 text-[11px] text-white"
          >
            <option value="ulasildi">Ulaşıldı</option>
            <option value="ulasilamadi">Ulaşılamadı</option>
            <option value="geri-dondu">Geri döndü</option>
            <option value="ilgilenmiyor">İlgilenmiyor</option>
            <option value="bilinmiyor">Bilinmiyor</option>
          </select>
          <input
            value={not}
            onChange={(e) => setNot(e.target.value)}
            placeholder="Kısa not"
            className="h-8 min-w-0 flex-1 rounded-md border border-white/5 bg-black/30 px-2 text-[11px] text-white outline-none"
          />
          <button
            type="button"
            onClick={() => kaydet.mutate()}
            disabled={kaydet.isPending}
            className="h-8 rounded-md bg-[color:var(--panel-accent,#0a84ff)] px-3 text-[10px] font-semibold text-white disabled:opacity-50"
          >
            {kaydet.isPending ? 'Kaydediliyor' : 'Kaydet'}
          </button>
          <button
            type="button"
            onClick={() => setAcik(false)}
            className="h-8 rounded-md px-2 text-[10px] font-semibold text-slate-400"
          >
            Vazgeç
          </button>
        </div>
      )}
    </div>
  );
}

function Rozet({ metin, renk, zemin }: { metin: string; renk: string; zemin: string }) {
  return (
    <span className="rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: renk, backgroundColor: zemin }}>
      {metin}
    </span>
  );
}

function SecimGrubu({
  deger,
  secenekler,
  onSec,
}: {
  deger: string;
  secenekler: Array<{ id: string; label: string }>;
  onSec: (value: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-white/5 bg-black/20 p-1">
      {secenekler.map((secenek) => (
        <button
          key={secenek.id}
          type="button"
          onClick={() => onSec(secenek.id)}
          className={cn(
            'rounded-md px-3 py-1.5 text-[11px] font-semibold transition',
            deger === secenek.id
              ? 'bg-[color:var(--panel-accent,#0a84ff)] text-white'
              : 'text-slate-400 hover:text-white',
          )}
        >
          {secenek.label}
        </button>
      ))}
    </div>
  );
}

function Sayfalama({ yon, pasif, onTikla }: { yon: 'geri' | 'ileri'; pasif: boolean; onTikla: () => void }) {
  return (
    <button
      type="button"
      onClick={onTikla}
      disabled={pasif}
      aria-label={yon === 'geri' ? 'Önceki sayfa' : 'Sonraki sayfa'}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/5 text-slate-400 disabled:opacity-40"
    >
      {yon === 'geri' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  );
}

function Durum({ ikon, baslik, alt }: { ikon: ReactNode; baslik: string; alt: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-6 py-14 text-center">
      <span className="text-slate-400">{ikon}</span>
      <p className="text-sm font-semibold text-white">{baslik}</p>
      <p className="text-[12px] text-slate-400">{alt}</p>
    </div>
  );
}
