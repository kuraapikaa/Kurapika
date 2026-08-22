import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Loader2, Lock, Package, Sparkles, X } from 'lucide-react';
import { gamesApi } from '@/api/client';
import { LobbyPageShell } from '@/components/player/LobbyPageShell';
import { useLobbyPageTheme } from '@/lib/lobbyTheme';
import { useOtomatikOturum } from '@/lib/useParentUsername';
import { cn } from '@/lib/utils';

/**
 * KASA AÇMA.
 *
 * Bedeli karşılığında ağırlıklı bir ödül veren kasalar. Vitrin, açılış
 * ve sonuç animasyonu burada; çekiliş sunucuda ve saf bir modülde
 * (`kasaAcma.ts`).
 *
 * ── Neden olasılıklar açıkta ──────────────────────────────────────────
 * Her kasanın içindeki ödüller ve YÜZDELERİ karta basılı. Gizlemek kasa
 * içeriğini tahmin oyununa çevirir ve "hiç çıkmıyor" şikâyeti geldiğinde
 * elde gösterilecek bir şey kalmaz. Açık olasılık hem güven veriyor hem
 * de tartışmayı bitiriyor.
 *
 * ── Animasyon neden sunucu yanıtından SONRA ───────────────────────────
 * Ödül sunucudan gelmeden animasyon başlamıyor. Önce çalıştırıp sonra
 * "asıl ödül bu" demek, oyuncuya bir sonuç gösterip başkasını yazmak
 * olurdu -- kaybedilen güven geri gelmiyor.
 */

type Odul = { label: string; amount: number; rarity: string; olasilik: number };

type Vitrin = {
  id: string;
  label: string;
  price: number;
  image?: string;
  dailyLimit: number;
  minDeposit: number;
  enBuyukOdul: number;
  odulSayisi: number;
  oduller: Odul[];
};

const para = (n: number) => new Intl.NumberFormat('tr-TR').format(n || 0);

const NADIRLIK: Record<string, { ad: string; sinif: string }> = {
  efsane: { ad: 'Efsane', sinif: 'text-amber-300 border-amber-400/30 bg-amber-400/10' },
  nadir: { ad: 'Nadir', sinif: 'text-violet-300 border-violet-400/30 bg-violet-400/10' },
  normal: { ad: '', sinif: 'text-slate-300 border-white/10 bg-white/[0.04]' },
};

export function KasaSayfasi() {
  // Tema kancasi diger oyuncu sayfalariyla AYNI: lobi rengi
  // degistiginde kasa sayfasi da onunla degisiyor.
  const { palette, rootStyle, backgroundStyle } = useLobbyPageTheme('scratch');
  const { username } = useOtomatikOturum();
  const [kasalar, setKasalar] = useState<Vitrin[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [acilan, setAcilan] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<{ kasa: Vitrin; odul: Odul } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [detay, setDetay] = useState<Vitrin | null>(null);
  const sadeHareket = useReducedMotion() ?? false;

  useEffect(() => {
    let iptal = false;
    gamesApi.kasaListesi()
      .then((cevap: any) => { if (!iptal) setKasalar(cevap?.kasalar ?? []); })
      .catch(() => { if (!iptal) setKasalar([]); })
      .finally(() => { if (!iptal) setYukleniyor(false); });
    return () => { iptal = true; };
  }, []);

  const ac = async (kasa: Vitrin) => {
    if (acilan) return;
    setHata(null);
    setAcilan(kasa.id);
    try {
      const cevap: any = await gamesApi.kasaAc(kasa.id);
      if (!cevap?.ok) {
        setHata(cevap?.message || 'Kasa açılamadı.');
        return;
      }
      setSonuc({ kasa, odul: cevap.odul });
    } catch {
      setHata('Kasa açılamadı. Lütfen tekrar deneyin.');
    } finally {
      setAcilan(null);
    }
  };

  const toplamOdul = useMemo(
    () => kasalar.reduce((m, k) => Math.max(m, k.enBuyukOdul), 0),
    [kasalar],
  );

  return (
    <LobbyPageShell
      palette={palette}
      rootStyle={rootStyle}
      backgroundStyle={backgroundStyle}
      eyebrow="Ödül merkezi"
      title="Şans Kasaları"
      subtitle={
        toplamOdul > 0
          ? `Kasayı aç, içinden çıkanı bakiyene al. En büyük ödül ${para(toplamOdul)} ₺.`
          : 'Kasayı aç, içinden çıkanı doğrudan bakiyene al.'
      }
    >
      {!username && (
        <p className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-xs font-semibold text-amber-200">
          Kasa açmak için önce lobide kullanıcı adınızı doğrulayın.
        </p>
      )}

      {hata && (
        <p className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-xs font-semibold text-rose-200">
          {hata}
        </p>
      )}

      {yukleniyor ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-amber-300" size={28} /></div>
      ) : kasalar.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 py-14 text-center">
          <Package className="mx-auto mb-3 text-slate-600" size={30} />
          <p className="text-sm font-bold text-slate-400">Şu anda açık kasa yok.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 md:gap-4">
          {kasalar.map((kasa, i) => (
            <KasaKarti
              key={kasa.id}
              kasa={kasa}
              sira={i}
              sadeHareket={sadeHareket}
              acilistaMi={acilan === kasa.id}
              kilitli={!username || Boolean(acilan)}
              onAc={() => ac(kasa)}
              onDetay={() => setDetay(kasa)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {detay && <IcerikPenceresi kasa={detay} onKapat={() => setDetay(null)} />}
        {sonuc && (
          <SonucPenceresi
            kasa={sonuc.kasa}
            odul={sonuc.odul}
            sadeHareket={sadeHareket}
            onKapat={() => setSonuc(null)}
          />
        )}
      </AnimatePresence>
    </LobbyPageShell>
  );
}

function KasaKarti({ kasa, sira, sadeHareket, acilistaMi, kilitli, onAc, onDetay }: {
  kasa: Vitrin; sira: number; sadeHareket: boolean; acilistaMi: boolean;
  kilitli: boolean; onAc: () => void; onDetay: () => void;
}) {
  return (
    <motion.div
      initial={sadeHareket ? false : { opacity: 0, y: 16 }}
      animate={sadeHareket ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(sira, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.02]"
    >
      <button
        onClick={onDetay}
        className="relative block aspect-square w-full overflow-hidden bg-gradient-to-b from-amber-500/10 to-black/40"
        aria-label={`${kasa.label} içeriğini gör`}
      >
        {kasa.image ? (
          <img src={kasa.image} alt={kasa.label} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <Package size={44} className="text-amber-300/70" />
          </span>
        )}
        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-slate-300 backdrop-blur-sm">
          {kasa.odulSayisi} ödül · içeriği gör
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black tracking-[-0.02em] text-white">{kasa.label}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
            En büyük ödül {para(kasa.enBuyukOdul)} ₺
            {kasa.dailyLimit > 0 && ` · günde ${kasa.dailyLimit}`}
          </p>
        </div>

        <button
          onClick={onAc}
          disabled={kilitli || acilistaMi}
          className={cn(
            'inline-flex h-10 items-center justify-center gap-2 rounded-2xl text-xs font-black transition',
            'bg-gradient-to-r from-amber-500 to-yellow-400 text-[#171204]',
            'hover:brightness-110 active:scale-[0.98]',
            'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100',
          )}
        >
          {acilistaMi ? (
            <><Loader2 size={14} className="animate-spin" /> Açılıyor...</>
          ) : kasa.price > 0 ? (
            <>{para(kasa.price)} ₺ · Aç</>
          ) : (
            <><Sparkles size={14} /> Ücretsiz aç</>
          )}
        </button>
      </div>
    </motion.div>
  );
}

/** Kasa içeriği: ödüller ve olasılıkları. */
function IcerikPenceresi({ kasa, onKapat }: { kasa: Vitrin; onKapat: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
      onClick={onKapat}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#0d0b06] p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/80">Kasa içeriği</p>
            <h3 className="mt-0.5 text-lg font-black text-white">{kasa.label}</h3>
          </div>
          <button onClick={onKapat} className="rounded-full border border-white/10 p-1.5 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <ul className="space-y-1.5">
          {kasa.oduller.map((o, i) => {
            const n = NADIRLIK[o.rarity] ?? NADIRLIK.normal;
            return (
              <li key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                <span className="min-w-0 truncate text-xs font-bold text-slate-200">
                  {o.label}
                  {n.ad && <span className={cn('ml-2 rounded border px-1.5 py-0.5 text-[9px] font-bold', n.sinif)}>{n.ad}</span>}
                </span>
                <span className="shrink-0 text-xs font-black tabular-nums text-amber-300">%{o.olasilik}</span>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          Olasılıklar gerçek çekiliş ağırlıklarından hesaplanır ve her açılışta aynıdır.
        </p>
      </motion.div>
    </motion.div>
  );
}

/** Sonuç: ödül sunucudan geldikten SONRA gösteriliyor. */
function SonucPenceresi({ kasa, odul, sadeHareket, onKapat }: {
  kasa: Vitrin; odul: Odul; sadeHareket: boolean; onKapat: () => void;
}) {
  const kazandi = Number(odul.amount) > 0;
  const n = NADIRLIK[odul.rarity] ?? NADIRLIK.normal;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={sadeHareket ? { opacity: 0 } : { scale: 0.82, opacity: 0, rotateX: -12 }}
        animate={sadeHareket ? { opacity: 1 } : { scale: 1, opacity: 1, rotateX: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'w-full max-w-sm rounded-3xl border p-6 text-center',
          kazandi ? 'border-amber-400/40 bg-gradient-to-b from-amber-500/15 to-[#0d0b06]' : 'border-white/10 bg-[#0d0b06]',
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{kasa.label}</p>

        {kazandi ? (
          <>
            <motion.div
              initial={sadeHareket ? false : { scale: 0.6, opacity: 0 }}
              animate={sadeHareket ? undefined : { scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="my-4"
            >
              <p className="text-4xl font-black tracking-[-0.04em] text-amber-300">{para(odul.amount)} ₺</p>
              <p className="mt-1 text-sm font-bold text-white">{odul.label}</p>
              {n.ad && (
                <span className={cn('mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black', n.sinif)}>
                  {n.ad}
                </span>
              )}
            </motion.div>
            <p className="text-[11px] font-medium text-slate-400">Ödülünüz bakiyenize eklendi.</p>
          </>
        ) : (
          <div className="my-5">
            <Lock className="mx-auto mb-3 text-slate-600" size={34} />
            <p className="text-lg font-black text-slate-300">{odul.label}</p>
            <p className="mt-1 text-[11px] text-slate-500">Bu sefer olmadı. Bir sonraki kasada bol şans.</p>
          </div>
        )}

        <button
          onClick={onKapat}
          className="mt-4 h-11 w-full rounded-2xl bg-white/[0.06] text-xs font-black uppercase tracking-[0.15em] text-slate-200 transition hover:bg-white/[0.12]"
        >
          Kapat
        </button>
      </motion.div>
    </motion.div>
  );
}
