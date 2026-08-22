import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Clock, Loader2, TrendingUp, Trophy } from 'lucide-react';
import { gamesApi } from '@/api/client';
import { LobbyPageShell } from '@/components/player/LobbyPageShell';
import { useLobbyPageTheme } from '@/lib/lobbyTheme';
import { useOtomatikOturum } from '@/lib/useParentUsername';
import { cn } from '@/lib/utils';

/**
 * ÖZEL ORAN.
 *
 * Panelin belirli maçlara verdiği yükseltilmiş oranlar. Oyuncu bahsi
 * SİTEDE, sitenin kendi oranıyla alıyor; maç sonuçlandığında aradaki
 * fark bakiyesine yazılıyor.
 *
 * ── Neden "katıl" düğmesi var ─────────────────────────────────────────
 * Katılım bir bahis DEĞİL, "bu teklifi takip ediyorum" kaydı.
 * Sonuçlanmada yalnızca katılanların bahis geçmişi taranıyor -- tüm
 * oyuncuları taramak her teklif için binlerce sorgu demekti.
 *
 * Bu yüzden sayfa, katılmanın bahis yerine geçmediğini AÇIKÇA söylüyor.
 * Söylemeseydik oyuncu katılıp bahis almadan ödeme beklerdi.
 */

type Teklif = {
  id: string;
  matchName: string;
  marketName?: string;
  selectionName: string;
  specialOdd: number;
  maxStake: number;
  minStake: number;
  opensAt: string | null;
  closesAt: string | null;
  status: string;
  result: string | null;
  note: string;
  acik: boolean;
  katildim: boolean;
};

const para = (n: number) => new Intl.NumberFormat('tr-TR').format(n || 0);

const saat = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export function OzelOranSayfasi() {
  const { palette, rootStyle, backgroundStyle } = useLobbyPageTheme('scratch');
  const { username } = useOtomatikOturum();
  const [teklifler, setTeklifler] = useState<Teklif[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [katiliyor, setKatiliyor] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const sadeHareket = useReducedMotion() ?? false;

  const yukle = () => {
    gamesApi.ozelOranListesi()
      .then((c: any) => setTeklifler(c?.teklifler ?? []))
      .catch(() => setTeklifler([]))
      .finally(() => setYukleniyor(false));
  };

  useEffect(yukle, []);

  const katil = async (teklif: Teklif) => {
    setHata(null);
    setKatiliyor(teklif.id);
    try {
      const c: any = await gamesApi.ozelOranKatil(teklif.id);
      if (!c?.ok) setHata(c?.message || 'Katılım kaydedilemedi.');
      else setTeklifler((liste) => liste.map((t) => (t.id === teklif.id ? { ...t, katildim: true } : t)));
    } catch {
      setHata('Katılım kaydedilemedi.');
    } finally {
      setKatiliyor(null);
    }
  };

  const acikOlanlar = teklifler.filter((t) => t.acik);
  const gecmis = teklifler.filter((t) => !t.acik);

  return (
    <LobbyPageShell
      palette={palette}
      rootStyle={rootStyle}
      backgroundStyle={backgroundStyle}
      eyebrow="Ödül merkezi"
      title="Özel Oranlar"
      subtitle="Seçili maçlarda yükseltilmiş oran. Bahsini sitede al, farkı biz bakiyene yazalım."
    >
      {/*
        Katilimin bahis YERINE GECMEDIGI en ustte yaziyor. Soylenmeseydi
        oyuncu katilip bahis almadan odeme beklerdi.
      */}
      <div className="mb-4 rounded-3xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3">
        <p className="text-xs font-bold text-amber-200">Nasıl çalışır?</p>
        <ol className="mt-2 space-y-1 text-[11px] font-medium leading-relaxed text-amber-100/80">
          <li>1. Aşağıdaki tekliflerden birine <b>Katıl</b> de.</li>
          <li>2. Bahsi <b>sitede</b>, normal oranıyla al. Katılmak bahis yerine geçmez.</li>
          <li>3. Maç sonuçlanınca aradaki fark bakiyene <b>düzeltme</b> olarak yazılır.</li>
        </ol>
      </div>

      {!username && (
        <p className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold text-slate-300">
          Katılmak için önce lobide kullanıcı adınızı doğrulayın.
        </p>
      )}

      {hata && (
        <p className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-xs font-semibold text-rose-200">{hata}</p>
      )}

      {yukleniyor ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-amber-300" size={28} /></div>
      ) : teklifler.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 py-14 text-center">
          <TrendingUp className="mx-auto mb-3 text-slate-600" size={30} />
          <p className="text-sm font-bold text-slate-400">Şu anda özel oran yok.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {acikOlanlar.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[16px] font-black tracking-[-0.03em] text-white">Açık teklifler</h2>
              {acikOlanlar.map((t, i) => (
                <TeklifKarti
                  key={t.id} teklif={t} sira={i} sadeHareket={sadeHareket}
                  kilitli={!username} yukleniyor={katiliyor === t.id}
                  onKatil={() => katil(t)}
                />
              ))}
            </section>
          )}

          {gecmis.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[16px] font-black tracking-[-0.03em] text-slate-400">Sonuçlananlar</h2>
              {gecmis.map((t, i) => (
                <TeklifKarti
                  key={t.id} teklif={t} sira={i} sadeHareket={sadeHareket}
                  kilitli yukleniyor={false} onKatil={() => {}}
                />
              ))}
            </section>
          )}
        </div>
      )}
    </LobbyPageShell>
  );
}

function TeklifKarti({ teklif, sira, sadeHareket, kilitli, yukleniyor, onKatil }: {
  teklif: Teklif; sira: number; sadeHareket: boolean;
  kilitli: boolean; yukleniyor: boolean; onKatil: () => void;
}) {
  const kapali = !teklif.acik;

  return (
    <motion.article
      initial={sadeHareket ? false : { opacity: 0, y: 14 }}
      animate={sadeHareket ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(sira, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'overflow-hidden rounded-3xl border p-4',
        kapali ? 'border-white/[0.06] bg-white/[0.015] opacity-70' : 'border-amber-400/25 bg-amber-400/[0.05]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black tracking-[-0.02em] text-white">{teklif.matchName}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
            {teklif.marketName ? `${teklif.marketName} · ` : ''}{teklif.selectionName}
          </p>
        </div>

        {/* Oran, kartin en dikkat ceken ogesi: teklifin kendisi bu. */}
        <div className="shrink-0 text-right">
          <p className="text-2xl font-black leading-none tracking-[-0.04em] text-amber-300">
            {Number(teklif.specialOdd).toFixed(2)}
          </p>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-300/60">özel oran</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-500">
        <span>Üst sınır {para(teklif.maxStake)} ₺</span>
        {teklif.minStake > 0 && <span>Alt sınır {para(teklif.minStake)} ₺</span>}
        <span className="inline-flex items-center gap-1"><Clock size={11} /> {saat(teklif.closesAt)}</span>
      </div>

      {teklif.note && <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{teklif.note}</p>}

      <div className="mt-3">
        {kapali ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] px-3 py-1.5 text-[10px] font-bold text-slate-400">
            <Trophy size={12} />
            {teklif.status === 'sonuclandi' ? 'Sonuçlandı' : 'Kapandı'}
          </span>
        ) : teklif.katildim ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold text-emerald-300">
            <Check size={12} /> Katıldın — bahsini sitede al
          </span>
        ) : (
          <button
            onClick={onKatil}
            disabled={kilitli || yukleniyor}
            className="inline-flex h-9 items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 px-5 text-xs font-black text-[#171204] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {yukleniyor ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
            Katıl
          </button>
        )}
      </div>
    </motion.article>
  );
}
