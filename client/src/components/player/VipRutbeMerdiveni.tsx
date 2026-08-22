import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { SEVIYE_BASINA_XP, sadakatIlerlemesi } from '@/lib/sadakatIlerlemesi';
import { cn } from '@/lib/utils';

/**
 * VIP RÜTBE MERDİVENİ.
 *
 * Seviye aralıklarına karşılık gelen rütbeler ve her birinin gerektirdiği
 * XP. Oyuncunun KENDİ konumu işaretli.
 *
 * ── Neden gerçek veriyle ──────────────────────────────────────────────
 * Statik bir rütbe listesi göstermek kolaydı ama hiçbir şey söylemezdi:
 * oyuncu nerede olduğunu ve bir sonraki rütbeye ne kadar kaldığını
 * göremezdi. Panelde zaten XP sistemi var (seviye başına
 * {SEVIYE_BASINA_XP} XP); merdiven ondan besleniyor ve "Altın'a 3.200 XP
 * kaldı" diyebiliyor.
 *
 * ── XP eşikleri seviyeden TÜRETİLİYOR ─────────────────────────────────
 * Her rütbenin gerekli XP'si `başlangıçSeviyesi` üzerinden hesaplanıyor,
 * ayrıca girilmiyor. İkisi ayrı yazılsaydı biri değişip diğeri
 * değişmediğinde merdiven kendi içinde çelişirdi -- oyuncu 20. seviyede
 * olup "Altın için 16. seviye gerekli" yazarken rütbesi Gümüş görünürdü.
 */

export type Rutbe = {
  id: string;
  label: string;
  /** Bu rütbenin başladığı seviye. */
  minLevel: number;
  /** Rozet simgesi; özel logo yüklenmemişse gösterilir. */
  badge?: string;
  /** Panelden yüklenen özel logo. */
  logoUrl?: string;
  /** Kısa avantaj notu (eski tekil alan). */
  perk?: string;
  /** Panelden girilen avantaj listesi. */
  perks?: string[];
};

export const VARSAYILAN_RUTBELER: Rutbe[] = [
  { id: 'bronz', label: 'Bronz', minLevel: 1, badge: '🥉', perk: 'Hoş geldin paketi' },
  { id: 'gumus', label: 'Gümüş', minLevel: 6, badge: '🥈', perk: 'Haftalık cashback' },
  { id: 'altin', label: 'Altın', minLevel: 16, badge: '🥇', perk: 'Öncelikli destek' },
  { id: 'platin', label: 'Platin', minLevel: 26, badge: '💠', perk: 'Hızlandırılmış çekim' },
  { id: 'elmas', label: 'Elmas', minLevel: 36, badge: '💎', perk: 'Kişisel VIP asistanı' },
  { id: 'sampiyon', label: 'Şampiyon', minLevel: 46, badge: '🏆', perk: 'Özel etkinlik davetleri' },
  { id: 'efsane', label: 'Efsane', minLevel: 56, badge: '👑', perk: 'Limitsiz ayrıcalık' },
];

/** Rütbenin gerektirdiği XP — seviyeden türetiliyor, ayrıca girilmiyor. */
export function rutbeXp(rutbe: Rutbe): number {
  return Math.max(0, (Math.max(1, rutbe.minLevel) - 1) * SEVIYE_BASINA_XP);
}

const xpYaz = (n: number) => new Intl.NumberFormat('tr-TR').format(Math.max(0, Math.round(n)));

/**
 * Satırda gösterilecek kısa avantaj notu.
 *
 * Merdiven bir satırlık bir özet; avantajların tamamı yukarıdaki
 * seviye kartlarında zaten listeleniyor. Hepsini buraya da basmak
 * satırları taşırırdı.
 */
function avantajOzeti(rutbe: Rutbe): string {
  const liste = Array.isArray(rutbe.perks) ? rutbe.perks.filter(Boolean) : [];
  if (liste.length === 0) return String(rutbe.perk ?? '').trim();
  return liste.length === 1 ? liste[0] : `${liste[0]} +${liste.length - 1}`;
}

export function VipRutbeMerdiveni({ rutbeler, xp, seviye, girisYapildi }: {
  rutbeler?: Rutbe[];
  xp?: number | null;
  seviye?: number | null;
  /** Oyuncu doğrulanmadıysa konum gösterilmez, merdiven yine de görünür. */
  girisYapildi: boolean;
}) {
  const sadeHareket = useReducedMotion() ?? false;
  const liste = useMemo(
    () => (Array.isArray(rutbeler) && rutbeler.length ? rutbeler : VARSAYILAN_RUTBELER)
      .slice()
      .sort((a, b) => a.minLevel - b.minLevel),
    [rutbeler],
  );

  const ilerleme = sadakatIlerlemesi(xp, seviye);
  const mevcutSeviye = girisYapildi ? ilerleme.seviye : 0;
  const mevcutXp = girisYapildi ? Math.max(0, Math.floor(Number(xp) || 0)) : 0;

  // Oyuncunun icinde bulundugu rutbe: seviyesini gecmeyen SON rutbe.
  const mevcutIndis = girisYapildi
    ? liste.reduce((m, r, i) => (mevcutSeviye >= r.minLevel ? i : m), -1)
    : -1;
  const sonraki = mevcutIndis >= 0 && mevcutIndis < liste.length - 1 ? liste[mevcutIndis + 1] : null;
  const sonrakiIcinKalan = sonraki ? Math.max(0, rutbeXp(sonraki) - mevcutXp) : 0;

  return (
    <section id="rutbeler" className="relative z-10 mx-auto max-w-[1100px] px-4 pb-16 md:px-10">
      <div className="mb-6 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--lobby-muted,#8f8674)]">
          Rütbe merdiveni
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[color:var(--lobby-text,#f3ecdd)] md:text-4xl">
          Nerede olduğunu gör
        </h2>
        {girisYapildi ? (
          <p className="mt-2 text-sm font-medium text-[color:var(--lobby-muted,#8f8674)]">
            {mevcutIndis >= 0 ? (
              <>
                <b className="text-[color:var(--lobby-text,#f3ecdd)]">{liste[mevcutIndis].label}</b> rütbesindesin
                {' · '}Seviye {mevcutSeviye} · {xpYaz(mevcutXp)} XP
                {sonraki && <> · <b className="text-amber-300">{liste[mevcutIndis + 1].label}</b>'e {xpYaz(sonrakiIcinKalan)} XP</>}
              </>
            ) : 'Henüz rütben yok; oynadıkça XP kazanırsın.'}
          </p>
        ) : (
          <p className="mt-2 text-sm font-medium text-[color:var(--lobby-muted,#8f8674)]">
            Kendi rütbeni görmek için lobide kullanıcı adını doğrula.
          </p>
        )}
      </div>

      <ol className="space-y-2">
        {liste.map((rutbe, i) => {
          const gerekli = rutbeXp(rutbe);
          const acildi = girisYapildi && mevcutSeviye >= rutbe.minLevel;
          const mevcut = i === mevcutIndis;
          const sonrakiSeviye = liste[i + 1]?.minLevel;

          return (
            <motion.li
              key={rutbe.id}
              initial={sadeHareket ? false : { opacity: 0, x: -12 }}
              animate={sadeHareket ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-3xl border px-4 py-3 transition',
                mevcut
                  ? 'border-amber-400/45 bg-amber-400/[0.09] shadow-[0_0_36px_rgba(251,191,36,0.14)]'
                  : acildi
                    ? 'border-[rgba(243,236,221,0.10)] bg-[rgba(243,236,221,0.03)]'
                    : 'border-[rgba(243,236,221,0.06)] bg-transparent',
              )}
            >
              {/*
                Özel logo varsa simgenin yerini alıyor. Logo bir data URI
                ve zaten küçültülmüş olarak geliyor; `object-contain`
                farklı en-boy oranlarını kırpmadan sığdırıyor.
              */}
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl text-lg',
                mevcut ? 'bg-amber-400/20' : 'bg-[rgba(243,236,221,0.04)]',
                !acildi && 'opacity-45')}>
                {rutbe.logoUrl
                  ? <img src={rutbe.logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                  : (rutbe.badge ?? '•')}
              </span>

              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-black tracking-[-0.02em]',
                  mevcut ? 'text-amber-200' : acildi ? 'text-[color:var(--lobby-text,#f3ecdd)]' : 'text-[color:var(--lobby-muted,#8f8674)]')}>
                  {rutbe.label}
                  {mevcut && <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-200">buradasın</span>}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--lobby-muted,#8f8674)]">
                  Seviye {rutbe.minLevel}{sonrakiSeviye ? `–${sonrakiSeviye - 1}` : '+'}
                  {avantajOzeti(rutbe) && ` · ${avantajOzeti(rutbe)}`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className={cn('text-xs font-black tabular-nums',
                  acildi ? 'text-emerald-300' : 'text-[color:var(--lobby-muted,#8f8674)]')}>
                  {gerekli === 0 ? 'Başlangıç' : `${xpYaz(gerekli)} XP`}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[color:var(--lobby-muted,#8f8674)]">
                  {acildi ? <><Check size={10} className="text-emerald-300" /> açık</> : <><Lock size={10} /> kilitli</>}
                </p>
              </div>

              {/*
                Yalnizca ICINDE bulunulan rutbede ilerleme cubugu var:
                her satira koymak, kilitli rutbelerde sifir dolu bir cubuk
                gostermek olurdu ve bu "ilerliyorum" izlenimi verirdi.
              */}
              {mevcut && sonraki && (
                <div className="w-full">
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(243,236,221,0.08)]">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-[width] duration-500"
                      style={{ width: `${Math.max(2, Math.min(100, Math.round((1 - sonrakiIcinKalan / Math.max(1, rutbeXp(sonraki) - gerekli)) * 100)))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-amber-300/80">
                    {liste[i + 1].label} için {xpYaz(sonrakiIcinKalan)} XP kaldı
                  </p>
                </div>
              )}
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
