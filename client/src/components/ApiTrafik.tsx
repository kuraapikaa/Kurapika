/**
 * API Trafiği — panelin kendi Network sekmesi.
 *
 * Tarayıcının DevTools'undaki dört görünümün karşılığı:
 *   Headers  → istek/yanıt başlıkları + genel bilgiler
 *   Payload  → istek gövdesi ve sorgu dizesi
 *   Preview  → JSON yanıtın gezilebilir ağacı
 *   Response → ham yanıt gövdesi
 *
 * Gövdeler varsayılan olarak KAYDEDİLMEZ; canlı oyuncu verisi taşıyorlar.
 * Yakalama açıkça kurulur ve kendiliğinden süresi dolar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  ListTree,
  Radar,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { matchesAnyTr } from '../lib/turkishSearch';

type TrafikYonu = 'giden' | 'gelen';

interface TrafikKaydi {
  id: number;
  yon: TrafikYonu;
  method: string;
  url: string;
  sorgu: Record<string, string>;
  durum: number | null;
  sure: number;
  zaman: string;
  istekBasliklari: Record<string, string>;
  yanitBasliklari: Record<string, string>;
  istekGovdesi: string | null;
  yanitGovdesi: string | null;
  govdelerAtlandi: boolean;
  hata: string | null;
}

interface UcOzeti {
  yon: TrafikYonu;
  method: string;
  url: string;
  cagri: number;
  hata: number;
  ortalamaSure: number;
  sonCagri: string;
  sonDurum: number | null;
}

interface KatalogSatiri {
  method: string;
  url: string;
  cagri: number;
  sonDurum: number | null;
}

type Sekme = 'headers' | 'payload' | 'preview' | 'response';
type Gorunum = 'akis' | 'katalog';

const SEKME_ADI: Record<Sekme, string> = {
  headers: 'Headers',
  payload: 'Payload',
  preview: 'Preview',
  response: 'Response',
};

function durumRengi(durum: number | null, hata: string | null): string {
  if (hata) return 'text-rose-400';
  if (durum == null) return 'text-[color:var(--panel-muted,#8a919c)]';
  if (durum >= 500) return 'text-rose-400';
  if (durum >= 400) return 'text-amber-400';
  return 'text-emerald-400';
}

function metotRengi(method: string): string {
  switch (method) {
    case 'GET': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    case 'POST': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'PUT': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'DELETE': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    default: return 'bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] text-[color:var(--panel-muted,#8a919c)] border-[color:var(--panel-border,rgba(242,244,248,0.1))]';
  }
}

function saat(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString('tr-TR') : '—';
}

/** Uzun yolları baştan kısaltır; ayırt edici olan sondur. */
function kisalt(url: string, uzunluk = 64): string {
  return url.length <= uzunluk ? url : `…${url.slice(-uzunluk)}`;
}

// ─── Preview: JSON ağacı ─────────────────────────────────────────────────

function JsonDugum({ ad, deger, derinlik }: { ad: string | null; deger: unknown; derinlik: number }) {
  // Ilk iki seviye acik gelsin; daha derini istege bagli.
  const [acik, setAcik] = useState(derinlik < 2);
  const nesne = deger !== null && typeof deger === 'object';

  if (!nesne) {
    const yazi =
      typeof deger === 'string' ? `"${deger}"` :
      deger === null ? 'null' : String(deger);
    const renk =
      typeof deger === 'string' ? 'text-emerald-300' :
      typeof deger === 'number' ? 'text-sky-300' :
      typeof deger === 'boolean' ? 'text-amber-300' :
      'text-[color:var(--panel-muted,#8a919c)]';
    return (
      <div className="flex gap-2 font-mono text-[11px] leading-5" style={{ paddingLeft: derinlik * 14 }}>
        {ad !== null && <span className="text-[color:var(--panel-muted,#8a919c)]">{ad}:</span>}
        <span className={renk}>{yazi}</span>
      </div>
    );
  }

  const girisler = Array.isArray(deger)
    ? deger.map((v, i) => [String(i), v] as const)
    : Object.entries(deger as Record<string, unknown>);
  const etiket = Array.isArray(deger) ? `Array(${girisler.length})` : `Object{${girisler.length}}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        className="flex items-center gap-1.5 font-mono text-[11px] leading-5 hover:text-white transition-colors"
        style={{ paddingLeft: derinlik * 14 }}
      >
        <ChevronRight size={11} className={`transition-transform ${acik ? 'rotate-90' : ''}`} />
        {ad !== null && <span className="text-[color:var(--panel-muted,#8a919c)]">{ad}:</span>}
        <span className="text-[color:var(--panel-faint,#5c6470)]">{etiket}</span>
      </button>
      {acik && girisler.map(([k, v]) => <JsonDugum key={k} ad={k} deger={v} derinlik={derinlik + 1} />)}
    </div>
  );
}

function Onizleme({ govde }: { govde: string | null }) {
  const cozulmus = useMemo(() => {
    if (!govde) return { ok: false as const };
    try {
      return { ok: true as const, deger: JSON.parse(govde) };
    } catch {
      return { ok: false as const };
    }
  }, [govde]);

  if (!govde) return <Bos>Gövde kaydedilmedi.</Bos>;
  if (!cozulmus.ok) {
    return (
      <>
        <p className="text-[11px] text-amber-400 mb-3">Yanıt JSON değil; ham içerik gösteriliyor.</p>
        <Kod>{govde}</Kod>
      </>
    );
  }
  return <div className="overflow-x-auto"><JsonDugum ad={null} deger={cozulmus.deger} derinlik={0} /></div>;
}

// ─── Küçük yapı taşları ──────────────────────────────────────────────────

function Bos({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[color:var(--panel-faint,#5c6470)] py-6 text-center">{children}</p>;
}

function Kod({ children }: { children: string }) {
  return (
    <pre className="text-[11px] font-mono leading-5 text-[color:var(--panel-muted,#8a919c)] whitespace-pre-wrap break-all max-h-[26rem] overflow-y-auto">
      {children}
    </pre>
  );
}

function BaslikTablosu({ baslik, satirlar }: { baslik: string; satirlar: Record<string, string> }) {
  const girisler = Object.entries(satirlar ?? {});
  return (
    <div className="space-y-2">
      <h5 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-muted,#8a919c)]">{baslik}</h5>
      {girisler.length === 0 ? (
        <p className="text-[11px] text-[color:var(--panel-faint,#5c6470)]">—</p>
      ) : (
        <div className="space-y-1">
          {girisler.map(([ad, deger]) => (
            <div key={ad} className="grid grid-cols-[minmax(0,14rem)_1fr] gap-3 font-mono text-[11px] leading-5">
              <span className="text-[color:var(--panel-faint,#5c6470)] break-all">{ad}</span>
              <span className={`break-all ${deger === '***' ? 'text-rose-400/70' : 'text-[color:var(--panel-muted,#8a919c)]'}`}>{deger}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Otomatik tarama ─────────────────────────────────────────────────────

interface TaramaSatiri {
  taranabilir: boolean;
  method: string;
  url: string;
  neden?: string;
}

interface TaramaSonucu {
  tamamlanan: number;
  toplam: number;
  basarili: number;
  hatali: number;
  suanki: string | null;
  bitti: boolean;
}

/**
 * Panelin bütün GET uçlarını sırayla çağırır.
 *
 * MUTASYON UÇLARI HİÇ ÇAĞRILMAZ. Bu panelde POST/PUT/DELETE uçları bonus
 * veriyor, bakiye düzeltiyor ve çekim sonuçlandırıyor; bir tarama onları
 * çağırırsa gerçek para hareketi yaratır. Sunucudaki plan yalnızca GET
 * döner, burada da ikinci kez süzülüyor — iki kapı birden.
 *
 * Çağrılar tarayıcıdan gittiği için hem gelen kayıt hem de sunucunun
 * tetiklediği giden Lynon istekleri kendiliğinden kaydedilir.
 */
function useTarama(onBitti: () => void) {
  const [durum, setDurum] = useState<TaramaSonucu | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const basla = useCallback(async () => {
    setCalisiyor(true);
    try {
      // 1. Yakalamayı aç — kullanıcının elle açması gerekmesin.
      const yak = await fetch('/api/admin/api-trafik/yakalama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ac: true }),
      });
      if (!yak.ok) throw new Error('Gövde yakalama açılamadı.');

      // 2. Planı al.
      const planRes = await fetch('/api/admin/api-trafik/tarama-plani');
      const planJson = await planRes.json();
      if (!planRes.ok || !planJson?.ok) throw new Error(planJson?.message || 'Tarama planı alınamadı.');

      const hedefler: TaramaSatiri[] = (planJson.data.satirlar as TaramaSatiri[]).filter(
        (s) => s.taranabilir && s.method === 'GET',
      );

      setDurum({ tamamlanan: 0, toplam: hedefler.length, basarili: 0, hatali: 0, suanki: null, bitti: false });

      let basarili = 0;
      let hatali = 0;

      // 3. Sırayla çağır. Paralel gitmiyoruz: bu uçların çoğu Lynon'a
      //    çıkıyor ve eşzamanlı yük dış servisi hız sınırına sokabilir.
      for (let i = 0; i < hedefler.length; i += 1) {
        const hedef = hedefler[i];
        setDurum((d) => (d ? { ...d, suanki: hedef.url } : d));
        try {
          const res = await fetch(hedef.url, { headers: { 'X-Api-Tarama': '1' } });
          if (res.ok) basarili += 1;
          else hatali += 1;
        } catch {
          hatali += 1;
        }
        setDurum((d) => (d ? { ...d, tamamlanan: i + 1, basarili, hatali } : d));
      }

      setDurum((d) => (d ? { ...d, suanki: null, bitti: true } : d));
      toast.success(`Tarama bitti — ${basarili} uç yanıtladı, ${hatali} uçta hata.`);
      onBitti();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tarama başarısız.');
      setDurum(null);
    } finally {
      setCalisiyor(false);
    }
  }, [onBitti]);

  return { durum, calisiyor, basla };
}

function TaramaKarti({ onBitti }: { onBitti: () => void }) {
  const { durum, calisiyor, basla } = useTarama(onBitti);
  const yuzde = durum && durum.toplam > 0 ? Math.round((durum.tamamlanan / durum.toplam) * 100) : 0;

  return (
    <div className="mt-4 p-4 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Radar size={16} className="text-blue-400 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-white">Paneli otomatik tara</p>
            <p className="text-[11px] text-[color:var(--panel-faint,#5c6470)] mt-0.5 max-w-2xl">
              Gövde yakalamayı açar ve panelin tüm okuma uçlarını sırayla çağırır; her uç için
              headers, payload, preview ve response dolar.{' '}
              <span className="text-amber-400/90">
                Veri değiştiren uçlar (bonus, bakiye, çekim) taranmaz.
              </span>
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={basla} disabled={calisiyor} className="h-9 px-4 text-xs shrink-0">
          {calisiyor ? 'Taranıyor…' : 'Taramayı başlat'}
        </Button>
      </div>

      {durum && (
        <div className="mt-4 space-y-2">
          <div className="h-1.5 rounded-full bg-[color:var(--panel-border,rgba(242,244,248,0.1))] overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${yuzde}%` }} />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[color:var(--panel-muted,#8a919c)] font-mono truncate max-w-[60%]">
              {durum.suanki ?? (durum.bitti ? 'Tamamlandı' : '…')}
            </span>
            <span className="text-[color:var(--panel-faint,#5c6470)]">
              {durum.tamamlanan}/{durum.toplam} · {durum.basarili} başarılı
              {durum.hatali > 0 && <span className="text-rose-400"> · {durum.hatali} hata</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────

export function ApiTrafik() {
  const queryClient = useQueryClient();
  const [gorunum, setGorunum] = useState<Gorunum>('akis');
  const [yon, setYon] = useState<TrafikYonu | 'hepsi'>('hepsi');
  const [arama, setArama] = useState('');
  const [yalnizHatali, setYalnizHatali] = useState(false);
  const [secili, setSecili] = useState<number | null>(null);
  const [sekme, setSekme] = useState<Sekme>('headers');
  const [otomatik, setOtomatik] = useState(true);
  const [kopyalandi, setKopyalandi] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['api-trafik', yon, yalnizHatali],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (yon !== 'hepsi') p.set('yon', yon);
      if (yalnizHatali) p.set('yalnizHatali', 'true');
      const res = await fetch(`/api/admin/api-trafik?${p}`);
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Trafik okunamadı');
      return json.data as {
        yakalama: { acik: boolean; kalanMs: number };
        azamiYakalamaMs: number;
        kayitlar: TrafikKaydi[];
        ozetler: UcOzeti[];
      };
    },
    refetchInterval: otomatik ? 4000 : false,
  });

  const { data: katalog } = useQuery({
    queryKey: ['api-trafik-katalog'],
    enabled: gorunum === 'katalog',
    queryFn: async () => {
      const res = await fetch('/api/admin/api-trafik/katalog');
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Katalog okunamadı');
      return json.data as {
        panelUclari: KatalogSatiri[];
        gidenUcler: UcOzeti[];
        toplam: { panel: number; giden: number };
      };
    },
  });

  const yakalamaMutation = useMutation({
    mutationFn: async (ac: boolean) => {
      const res = await fetch('/api/admin/api-trafik/yakalama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ac }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'İşlem başarısız');
      return json.data;
    },
    onSuccess: (d: any) => {
      toast.success(d?.acik ? 'Gövde yakalama açıldı — süresi dolunca kendiliğinden kapanır.' : 'Gövde yakalama kapatıldı.');
      queryClient.invalidateQueries({ queryKey: ['api-trafik'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const temizleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/api-trafik', { method: 'DELETE' });
      if (!res.ok) throw new Error('Temizlenemedi');
    },
    onSuccess: () => {
      setSecili(null);
      queryClient.invalidateQueries({ queryKey: ['api-trafik'] });
    },
  });

  const kayitlar = useMemo(() => {
    const hepsi = data?.kayitlar ?? [];
    const q = arama.trim();
    if (!q) return hepsi;
    return hepsi.filter((k) => matchesAnyTr([k.url, k.method, String(k.durum ?? '')], q));
  }, [data?.kayitlar, arama]);

  const seciliKayit = useMemo(
    () => kayitlar.find((k) => k.id === secili) ?? null,
    [kayitlar, secili],
  );

  // Secili kayit halkadan dustuyse secimi birak; bos detay paneli kalmasin.
  useEffect(() => {
    if (secili != null && !kayitlar.some((k) => k.id === secili)) setSecili(null);
  }, [kayitlar, secili]);

  const kopyala = useCallback((metin: string) => {
    navigator.clipboard.writeText(metin);
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 1400);
  }, []);

  const yakalamaAcik = data?.yakalama.acik ?? false;
  const kalanDk = Math.ceil((data?.yakalama.kalanMs ?? 0) / 60000);

  return (
    <div className="space-y-6">
      {/* Üst kontrol çubuğu */}
      <Card className="p-5">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex gap-1 p-1 rounded-xl bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
            {([['akis', 'Canlı Akış'], ['katalog', 'Uç Kataloğu']] as const).map(([id, ad]) => (
              <button
                key={id}
                onClick={() => setGorunum(id)}
                className={`px-4 h-9 rounded-lg text-xs font-semibold transition-all ${
                  gorunum === id ? 'bg-blue-500 text-white' : 'text-[color:var(--panel-muted,#8a919c)] hover:text-white'
                }`}
              >
                {ad}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--panel-faint,#5c6470)]" />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Uç, metot veya durum kodu ara…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] border border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-xs text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {gorunum === 'akis' && (
            <div className="flex flex-wrap items-center gap-2">
              {(['hepsi', 'gelen', 'giden'] as const).map((y) => (
                <button
                  key={y}
                  onClick={() => setYon(y)}
                  className={`px-3 h-9 rounded-lg text-xs font-semibold border transition-all ${
                    yon === y
                      ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                      : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[color:var(--panel-muted,#8a919c)] hover:text-white'
                  }`}
                >
                  {y === 'hepsi' ? 'Hepsi' : y === 'gelen' ? 'Gelen' : 'Giden'}
                </button>
              ))}
              <button
                onClick={() => setYalnizHatali((v) => !v)}
                className={`px-3 h-9 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                  yalnizHatali
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[color:var(--panel-muted,#8a919c)] hover:text-white'
                }`}
              >
                <AlertTriangle size={13} /> Hatalı
              </button>
              <Button variant="ghost" onClick={() => setOtomatik((v) => !v)} className="h-9 px-3 text-xs">
                <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
                {otomatik ? 'Canlı' : 'Duraklatıldı'}
              </Button>
              <Button variant="ghost" onClick={() => temizleMutation.mutate()} className="h-9 px-3 text-xs">
                <Trash2 size={13} /> Temizle
              </Button>
            </div>
          )}
        </div>

        {/*
          * Gövde yakalama anahtarı. Varsayılan kapalı olmasının sebebi
          * ürün tercihi değil: yanıt gövdeleri oyuncu kimliği, bakiye ve
          * ödeme bilgisi taşıyor.
          */}
        <div className={`mt-4 p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          yakalamaAcik ? 'bg-amber-500/5 border-amber-500/20' : 'bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] border-[color:var(--panel-border,rgba(242,244,248,0.1))]'
        }`}>
          <div className="flex items-start gap-3">
            {yakalamaAcik ? <Eye size={16} className="text-amber-400 mt-0.5" /> : <EyeOff size={16} className="text-[color:var(--panel-muted,#8a919c)] mt-0.5" />}
            <div>
              <p className={`text-xs font-semibold ${yakalamaAcik ? 'text-amber-300' : 'text-white'}`}>
                Gövde yakalama {yakalamaAcik ? `açık — ${kalanDk} dk kaldı` : 'kapalı'}
              </p>
              <p className="text-[11px] text-[color:var(--panel-faint,#5c6470)] mt-0.5 max-w-2xl">
                {yakalamaAcik
                  ? 'İstek ve yanıt gövdeleri kaydediliyor. Bu gövdeler oyuncu kimliği, bakiye ve ödeme bilgisi içerebilir; süre dolunca kayıt kendiliğinden durur.'
                  : 'Yalnızca metot, uç, durum ve süre kaydediliyor. Gövdeleri görmek için yakalamayı açın; parola, token ve çerezler her durumda maskelenir.'}
              </p>
            </div>
          </div>
          <Button
            variant={yakalamaAcik ? 'ghost' : 'primary'}
            onClick={() => yakalamaMutation.mutate(!yakalamaAcik)}
            className="h-9 px-4 text-xs shrink-0"
          >
            {yakalamaAcik ? 'Kapat' : 'Yakalamayı aç'}
          </Button>
        </div>

        {/*
          * Tarama, yakalama anahtarının hemen altında: sıra doğal olarak
          * "yakalamayı aç → panelde gez". Tarama ilk adımı da kendisi
          * yapıyor, operatörün elle açması gerekmiyor.
          */}
        <TaramaKarti
          onBitti={() => queryClient.invalidateQueries({ queryKey: ['api-trafik'] })}
        />
      </Card>

      {gorunum === 'katalog' ? (
        <KatalogGorunumu katalog={katalog} arama={arama} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,26rem)_1fr] gap-6">
          {/* İstek listesi */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] flex items-center justify-between">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-muted,#8a919c)]">
                İstekler
              </h4>
              <span className="text-[11px] text-[color:var(--panel-faint,#5c6470)]">{kayitlar.length}</span>
            </div>
            <div className="max-h-[38rem] overflow-y-auto divide-y divide-[color:var(--panel-border,rgba(242,244,248,0.06))]">
              {isLoading && <Bos>Yükleniyor…</Bos>}
              {!isLoading && kayitlar.length === 0 && <Bos>Henüz kayıt yok. Panelde gezinin, istekler burada belirir.</Bos>}
              {kayitlar.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setSecili(k.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    secili === k.id ? 'bg-blue-500/10' : 'hover:bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {k.yon === 'giden'
                      ? <ArrowUpRight size={12} className="text-violet-400 shrink-0" />
                      : <ArrowDownLeft size={12} className="text-sky-400 shrink-0" />}
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${metotRengi(k.method)}`}>{k.method}</span>
                    <span className={`text-[11px] font-bold ml-auto ${durumRengi(k.durum, k.hata)}`}>
                      {k.hata ? 'HATA' : k.durum ?? '—'}
                    </span>
                    <span className="text-[10px] text-[color:var(--panel-faint,#5c6470)]">{k.sure}ms</span>
                  </div>
                  <p className="text-[11px] font-mono text-[color:var(--panel-muted,#8a919c)] break-all leading-4">{kisalt(k.url)}</p>
                  <p className="text-[10px] text-[color:var(--panel-faint,#5c6470)] mt-0.5">{saat(k.zaman)}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Detay: dört sekme */}
          <Card className="p-0 overflow-hidden">
            {!seciliKayit ? (
              <div className="p-12 text-center">
                <ListTree size={28} className="mx-auto text-[color:var(--panel-faint,#5c6470)] mb-3" />
                <p className="text-xs text-[color:var(--panel-muted,#8a919c)]">İncelemek için soldan bir istek seçin.</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${metotRengi(seciliKayit.method)}`}>
                          {seciliKayit.method}
                        </span>
                        <span className={`text-xs font-bold ${durumRengi(seciliKayit.durum, seciliKayit.hata)}`}>
                          {seciliKayit.hata ? `HATA · ${seciliKayit.hata}` : seciliKayit.durum}
                        </span>
                        <span className="text-[11px] text-[color:var(--panel-faint,#5c6470)]">{seciliKayit.sure}ms</span>
                      </div>
                      <p className="text-[11px] font-mono text-white break-all">{seciliKayit.url}</p>
                    </div>
                    <Button variant="ghost" onClick={() => kopyala(seciliKayit.url)} className="h-8 px-3 text-[11px] shrink-0">
                      {kopyalandi ? <Check size={12} /> : <Copy size={12} />}
                    </Button>
                  </div>
                </div>

                <div className="flex border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-2">
                  {(Object.keys(SEKME_ADI) as Sekme[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSekme(s)}
                      className={`px-4 h-11 text-xs font-semibold transition-all border-b-2 ${
                        sekme === s
                          ? 'border-blue-500 text-white'
                          : 'border-transparent text-[color:var(--panel-muted,#8a919c)] hover:text-white'
                      }`}
                    >
                      {SEKME_ADI[s]}
                    </button>
                  ))}
                </div>

                <div className="p-5 space-y-6">
                  {seciliKayit.govdelerAtlandi && (sekme === 'payload' || sekme === 'preview' || sekme === 'response') && (
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-start gap-2">
                      <EyeOff size={14} className="text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-amber-300/90">
                        Bu istek kaydedilirken gövde yakalama kapalıydı. Yukarıdaki{' '}
                        <strong className="font-semibold">Taramayı başlat</strong> düğmesi yakalamayı
                        açıp tüm okuma uçlarını yeniden çağırır; elle tekrarlamanız gerekmez.
                      </p>
                    </div>
                  )}

                  {sekme === 'headers' && (
                    <>
                      <BaslikTablosu
                        baslik="Genel"
                        satirlar={{
                          'İstek URL': seciliKayit.url,
                          'İstek metodu': seciliKayit.method,
                          'Durum kodu': String(seciliKayit.durum ?? '—'),
                          Yön: seciliKayit.yon === 'giden' ? 'Giden (panel → dış servis)' : 'Gelen (tarayıcı → panel)',
                          Süre: `${seciliKayit.sure} ms`,
                          Zaman: new Date(seciliKayit.zaman).toLocaleString('tr-TR'),
                        }}
                      />
                      <BaslikTablosu baslik="Yanıt başlıkları" satirlar={seciliKayit.yanitBasliklari} />
                      <BaslikTablosu baslik="İstek başlıkları" satirlar={seciliKayit.istekBasliklari} />
                    </>
                  )}

                  {sekme === 'payload' && (
                    <>
                      {Object.keys(seciliKayit.sorgu).length > 0 && (
                        <BaslikTablosu baslik="Sorgu dizesi parametreleri" satirlar={seciliKayit.sorgu} />
                      )}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-muted,#8a919c)]">
                          İstek gövdesi
                        </h5>
                        {seciliKayit.istekGovdesi ? <Kod>{seciliKayit.istekGovdesi}</Kod> : <Bos>Gövde yok.</Bos>}
                      </div>
                    </>
                  )}

                  {sekme === 'preview' && <Onizleme govde={seciliKayit.yanitGovdesi} />}

                  {sekme === 'response' && (
                    seciliKayit.yanitGovdesi ? (
                      <>
                        <div className="flex justify-end">
                          <Button variant="ghost" onClick={() => kopyala(seciliKayit.yanitGovdesi!)} className="h-8 px-3 text-[11px]">
                            {kopyalandi ? <Check size={12} /> : <Copy size={12} />} Kopyala
                          </Button>
                        </div>
                        <Kod>{seciliKayit.yanitGovdesi}</Kod>
                      </>
                    ) : <Bos>Yanıt gövdesi kaydedilmedi.</Bos>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Uç kataloğu görünümü ────────────────────────────────────────────────

function KatalogGorunumu({
  katalog,
  arama,
}: {
  katalog?: { panelUclari: KatalogSatiri[]; gidenUcler: UcOzeti[]; toplam: { panel: number; giden: number } };
  arama: string;
}) {
  const q = arama.trim();
  const panel = (katalog?.panelUclari ?? []).filter((u) => !q || matchesAnyTr([u.url, u.method], q));
  const giden = (katalog?.gidenUcler ?? []).filter((u) => !q || matchesAnyTr([u.url, u.method], q));

  if (!katalog) return <Card className="p-8"><Bos>Katalog yükleniyor…</Bos></Card>;

  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
          <h4 className="text-xs font-semibold text-white">Panelin kendi uçları</h4>
          <p className="text-[11px] text-[color:var(--panel-faint,#5c6470)] mt-1">
            Sunucuda kayıtlı tüm rotalar ({katalog.toplam.panel} adet) — hiç çağrılmamış olanlar dahil.
          </p>
        </div>
        <div className="max-h-[26rem] overflow-y-auto divide-y divide-[color:var(--panel-border,rgba(242,244,248,0.06))]">
          {panel.map((u) => (
            <div key={`${u.method} ${u.url}`} className="px-5 py-2.5 flex items-center gap-3">
              <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold shrink-0 ${metotRengi(u.method)}`}>{u.method}</span>
              <span className="text-[11px] font-mono text-[color:var(--panel-muted,#8a919c)] break-all flex-1">{u.url}</span>
              <span className="text-[10px] text-[color:var(--panel-faint,#5c6470)] shrink-0">
                {u.cagri > 0 ? `${u.cagri} çağrı` : 'çağrılmadı'}
              </span>
            </div>
          ))}
          {panel.length === 0 && <Bos>Eşleşen uç yok.</Bos>}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
          <h4 className="text-xs font-semibold text-white">Dış servis uçları</h4>
          <p className="text-[11px] text-[color:var(--panel-faint,#5c6470)] mt-1">
            Panelin çağırdığı Lynon / BetConstruct / Telegram uçları ({katalog.toplam.giden} adet). Bu liste
            gözlemle oluşur; henüz çağrılmamış bir uç burada görünmez.
          </p>
        </div>
        <div className="max-h-[26rem] overflow-y-auto divide-y divide-[color:var(--panel-border,rgba(242,244,248,0.06))]">
          {giden.map((u) => (
            <div key={`${u.method} ${u.url}`} className="px-5 py-2.5 flex items-center gap-3">
              <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold shrink-0 ${metotRengi(u.method)}`}>{u.method}</span>
              <span className="text-[11px] font-mono text-[color:var(--panel-muted,#8a919c)] break-all flex-1">{u.url}</span>
              <span className="text-[10px] text-[color:var(--panel-faint,#5c6470)] shrink-0">{u.cagri} çağrı</span>
              <span className="text-[10px] text-[color:var(--panel-faint,#5c6470)] shrink-0 w-16 text-right">~{u.ortalamaSure}ms</span>
              {u.hata > 0 && <span className="text-[10px] text-rose-400 shrink-0">{u.hata} hata</span>}
            </div>
          ))}
          {giden.length === 0 && <Bos>Henüz dış servis çağrısı gözlenmedi.</Bos>}
        </div>
      </Card>
    </div>
  );
}
