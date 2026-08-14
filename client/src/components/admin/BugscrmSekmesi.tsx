import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  MousePointerClick,
  ShieldCheck,
  UserPlus,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import { bugscrmAdminApi, type BugscrmKaydi } from '../../api/client';
import { formatNumber } from '../../lib/format';

/**
 * BugsCRM — kendi tıklama/dönüşüm izleme entegrasyonumuz.
 *
 * Lynon'un BTag sistemiyle KARIŞTIRILMAZ: BTag Lynon'un kendi tarafında
 * yakalanır, biz onu yalnızca rapordan okuruz. BugsCRM tamamen ayrı bir
 * sistem — kendi clickId'siyle çalışır, dönüşümü bize postback (S2S) ile
 * bildirir. Bu panel yalnızca bağlantı durumunu gösterir ve gelen
 * kayıtları listeler; ApiKey gibi sırlar yalnızca sunucu ortam
 * değişkenlerinden okunur, burada hiç görünmez.
 */

const OLAY_ETIKETI: Record<BugscrmKaydi['olayTuru'], { ad: string; ikon: typeof MousePointerClick; renk: string }> = {
  tiklama: { ad: 'Tıklama', ikon: MousePointerClick, renk: 'text-sky-300 bg-sky-500/10' },
  kayit: { ad: 'Kayıt', ikon: UserPlus, renk: 'text-violet-300 bg-violet-500/10' },
  yatirim: { ad: 'Yatırım', ikon: Wallet, renk: 'text-emerald-300 bg-emerald-500/10' },
  ozel: { ad: 'Özel olay', ikon: Activity, renk: 'text-amber-300 bg-amber-500/10' },
};

function saatYaz(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(t));
}

function KapasiteKarti({
  ikon: Ikon,
  baslik,
  aciklama,
  durum,
}: {
  ikon: typeof Zap;
  baslik: string;
  aciklama: string;
  durum?: { ok: boolean; etiket: string };
}) {
  return (
    <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300">
          <Ikon size={18} />
        </span>
        {durum && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
              durum.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
            }`}
          >
            {durum.ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
            {durum.etiket}
          </span>
        )}
      </div>
      <h4 className="mt-3 text-sm font-bold text-white">{baslik}</h4>
      <p className="mt-1 text-xs font-medium leading-relaxed text-slate-400">{aciklama}</p>
    </div>
  );
}

export function BugscrmSekmesi() {
  const queryClient = useQueryClient();
  const [testSonucu, setTestSonucu] = useState<{ ok: boolean; mesaj?: string } | null>(null);
  const [testEdiliyor, setTestEdiliyor] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);

  const { data: durumRes, isLoading: durumYukleniyor } = useQuery({
    queryKey: ['bugscrm-durum'],
    queryFn: () => bugscrmAdminApi.durum(),
    staleTime: 30 * 1000,
  });
  const durum = durumRes?.Data;

  const { data: kayitlarRes, isLoading: kayitlarYukleniyor } = useQuery({
    queryKey: ['bugscrm-kayitlar'],
    queryFn: () => bugscrmAdminApi.kayitlar(50),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
  const kayitlar = kayitlarRes?.Data ?? [];

  const postbackUrl = `${window.location.origin}/api/bugscrm/postback`;

  const testEt = async () => {
    setTestEdiliyor(true);
    setTestSonucu(null);
    try {
      const res = await bugscrmAdminApi.testBaglanti();
      setTestSonucu({ ok: res.Data?.ok === true, mesaj: res.Data?.mesaj ?? res.AlertMessage });
    } catch {
      setTestSonucu({ ok: false, mesaj: 'Test sırasında bağlantı hatası oluştu.' });
    } finally {
      setTestEdiliyor(false);
      queryClient.invalidateQueries({ queryKey: ['bugscrm-durum'] });
    }
  };

  const postbackUrlKopyala = () => {
    navigator.clipboard?.writeText(postbackUrl).then(() => {
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 2000);
    }).catch(() => undefined);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-xl">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">BugsCRM Entegrasyonu</p>
        <h3 className="mt-1 text-lg font-semibold text-white">Tıklama ve dönüşüm izleme</h3>
        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-400">
          BugsCRM, Lynon'un BTag sisteminden bağımsız kendi tıklama/dönüşüm kaydını tutar ve bize yalnızca postback
          (sunucudan sunucuya) ile bildirir. Kimlik bilgileri (ApiKey, ProductId, EndpointUrl) yalnızca sunucu ortam
          değişkenlerinden okunur; burada değiştirilemez, yalnızca durumu görüntülenir.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <KapasiteKarti
          ikon={ShieldCheck}
          baslik="Bağlantı Durumu"
          aciklama={
            durumYukleniyor
              ? 'Kontrol ediliyor…'
              : durum?.yapilandirildi
                ? `${durum.endpointUrl ?? '—'} · Ürün ${durum.productId ?? '—'}`
                : 'ApiKey/ProductId/EndpointUrl ortam değişkenleri tanımlı değil.'
          }
          durum={durumYukleniyor ? undefined : { ok: Boolean(durum?.yapilandirildi), etiket: durum?.yapilandirildi ? 'Yapılandırıldı' : 'Eksik' }}
        />
        <KapasiteKarti
          ikon={Link2}
          baslik="Postback Alıcısı"
          aciklama="BugsCRM panelinde bu URL'yi postback/webhook adresi olarak tanımlayın; paylaşılan sır header'da doğrulanır."
          durum={durumYukleniyor ? undefined : { ok: Boolean(durum?.webhookSecretTanimli), etiket: durum?.webhookSecretTanimli ? 'Sır tanımlı' : 'Sır eksik' }}
        />
        <KapasiteKarti
          ikon={Activity}
          baslik="Son Aktivite"
          aciklama={
            kayitlarYukleniyor
              ? 'Yükleniyor…'
              : kayitlar.length > 0
                ? `Son kayıt: ${saatYaz(kayitlar[0].alindi)}`
                : 'Henüz postback alınmadı.'
          }
        />
      </div>

      <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Postback URL</p>
            <code className="mt-1 block truncate text-xs font-semibold text-white">{postbackUrl}</code>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={postbackUrlKopyala}
              className="inline-flex h-9 items-center gap-1.5 rounded-3xl border border-white/[0.05] px-3 text-[11px] font-bold text-slate-400 transition hover:text-white backdrop-blur-xl"
            >
              <Copy size={13} /> {kopyalandi ? 'Kopyalandı' : 'Kopyala'}
            </button>
            <button
              type="button"
              onClick={testEt}
              disabled={testEdiliyor}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-cyan-500/15 px-3 text-[11px] font-bold text-cyan-300 transition hover:bg-cyan-500/25 disabled:opacity-50"
            >
              {testEdiliyor ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              Bağlantıyı Test Et
            </button>
          </div>
        </div>
        {testSonucu && (
          <p className={`mt-3 text-[11px] font-semibold ${testSonucu.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
            {testSonucu.ok ? 'Bağlantı doğrulandı.' : (testSonucu.mesaj || 'Bağlantı doğrulanamadı.')}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/[0.05] backdrop-blur-xl">
        <div className="border-b border-white/5 bg-black/20 px-4 py-3">
          <h4 className="text-sm font-semibold text-white">Son Tıklama / Dönüşüm Kayıtları</h4>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">En yeni 50 postback.</p>
        </div>
        {kayitlarYukleniyor ? (
          <div className="flex items-center justify-center gap-2 p-8 text-xs font-semibold text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Yükleniyor…
          </div>
        ) : kayitlar.length === 0 ? (
          <p className="p-8 text-center text-xs font-medium text-slate-400">Henüz kayıt yok.</p>
        ) : (
          <div className="divide-y divide-[color:var(--panel-border,rgba(242,244,248,0.1))]">
            {kayitlar.map((kayit) => {
              const etiket = OLAY_ETIKETI[kayit.olayTuru] ?? OLAY_ETIKETI.ozel;
              const Ikon = etiket.ikon;
              return (
                <div key={`${kayit.clickId}-${kayit.olayTuru}`} className="flex items-center gap-3 px-4 py-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${etiket.renk}`}>
                    <Ikon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {etiket.ad}
                      {kayit.playerLogin ? ` · ${kayit.playerLogin}` : ''}
                    </p>
                    <p className="truncate text-[10px] font-medium text-slate-400">
                      clickId: {kayit.clickId}
                      {kayit.subId ? ` · subId: ${kayit.subId}` : ''}
                    </p>
                  </div>
                  {kayit.tutar != null && (
                    <span className="shrink-0 text-xs font-bold text-emerald-300">
                      {formatNumber(kayit.tutar)} {kayit.paraBirimi ?? ''}
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] font-semibold text-slate-500">{saatYaz(kayit.alindi)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
