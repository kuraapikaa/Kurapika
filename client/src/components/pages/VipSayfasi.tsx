import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Check, CheckCircle2, ChevronDown,
  Crown, Loader2, Send, Sparkles, Star,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formsApi, gamesApi } from '../../api/client';
import { cn } from '../../lib/utils';
import { lobbyExtraText, useLobbyPageContent } from '../../lib/lobbyContent';

const DEFAULT_TIERS = [
  { id: 'prestij', badge: '🏅', label: 'Prestij', sublabel: 'Başlangıç', minDeposit: '10.000 TL', popular: false, perks: ['7/24 Kişisel VIP Asistanı', 'Öncelikli müşteri desteği', 'Özel hoşgeldin bonusu', 'Haftalık cashback teklifi'] },
  { id: 'champion', badge: '🏆', label: 'Champion', sublabel: 'Popüler', minDeposit: '50.000 TL', popular: true, perks: ['Tüm Prestij avantajları', 'Özel etkinliklere davet', 'Extra promosyonlar', 'Hızlandırılmış çekim', 'Kişisel bonus danışmanı'] },
  { id: 'elite', badge: '💠', label: 'Elite', sublabel: 'Premium', minDeposit: '100.000 TL', popular: false, perks: ['Tüm Champion avantajları', 'VIP çekim limitleri', 'Doğum günü özel bonusu', 'Lüks etkinlik davetleri', 'Öncelikli VIP hattı'] },
  { id: 'master', badge: '👑', label: 'Master', sublabel: 'Ultimate', minDeposit: '250.000 TL', popular: false, perks: ['Tüm Elite avantajları', 'Limitsiz avantajlar', 'Özel günlerde hediyeler', 'Kişisel VIP koordinatörü', 'Sınırsız bonus fırsatı', 'Yıllık lüks sürpriz'] },
];

const DEFAULT_STATS = [
  { id: 's1', value: '15K+', label: 'VIP Üye', end: 15000 },
  { id: 's2', value: '7/24', label: 'Destek', end: null },
  { id: 's3', value: '%99', label: 'Memnuniyet', end: 99 },
  { id: 's4', value: '8M₺', label: 'Aylık Bonus', end: 8 },
];

const DEFAULT_FAQ = [
  { id: 'f1', q: 'VIP üyelik nasıl alınır?', a: 'Aşağıdaki formu doldurarak başvuru yapabilirsiniz. Ekibimiz en kısa sürede sizinle iletişime geçecektir.' },
  { id: 'f2', q: 'VIP seviyeleri nasıl belirlenir?', a: 'Yatırım miktarı, platform aktiviteniz ve sadakat puanlarınıza göre seviyeniz otomatik olarak güncellenir.' },
  { id: 'f3', q: 'VIP üyeliğin ücretli olup olmadığı?', a: 'VIP programımız tamamen ücretsizdir. Belirli aktivite eşiklerini geçtiğinizde otomatik olarak davet edilirsiniz.' },
  { id: 'f4', q: 'Hangi bonuslar VIP üyelere özel?', a: 'Cashback oranları, yükleme bonusları, freespin miktarları ve özel etkinlik ödülleri VIP seviyenize göre artış gösterir.' },
];

const TIER_STYLES = [
  { gradient: 'from-zinc-800/70 via-zinc-900/60 to-black', border: 'border-zinc-500/30', glow: '', badge_bg: 'bg-zinc-700/50 border-zinc-500/40', text: 'text-zinc-200', accent: 'text-zinc-400' },
  { gradient: 'from-amber-900/50 via-yellow-950/60 to-black', border: 'border-amber-400/50', glow: 'shadow-[0_0_60px_rgba(251,191,36,0.18),0_0_120px_rgba(251,191,36,0.08)] ring-1 ring-amber-400/20', badge_bg: 'bg-amber-500/20 border-amber-400/40', text: 'text-amber-100', accent: 'text-amber-400' },
  { gradient: 'from-sky-900/50 via-blue-950/60 to-black', border: 'border-sky-400/40', glow: '', badge_bg: 'bg-sky-500/20 border-sky-400/35', text: 'text-sky-100', accent: 'text-sky-400' },
  { gradient: 'from-blue-900/50 via-blue-950/60 to-black', border: 'border-blue-400/40', glow: '', badge_bg: 'bg-blue-500/20 border-blue-400/35', text: 'text-blue-100', accent: 'text-blue-400' },
];

function useCountUp(target: number | null, duration = 1800) {
  const [count, setCount] = useState(0);
  const ref = useRef(false);
  useEffect(() => {
    if (target === null || ref.current) return;
    ref.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return count;
}

function StatCard({ value, label, end }: { value: string; label: string; end: number | null }) {
  const count = useCountUp(end);
  const display = end === null ? value
    : value.includes('M₺') ? `${count}M₺`
    : value.includes('%') ? `%${count}`
    : value.includes('+') ? `${count.toLocaleString('tr-TR')}+`
    : String(count);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-5 text-center backdrop-blur-sm"
    >
      <span className="text-3xl font-black tracking-[-0.05em] text-white md:text-4xl">{display}</span>
      <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">{label}</span>
    </motion.div>
  );
}

export function VipSayfasi() {
  const { content: pageContent } = useLobbyPageContent('vip');
  const [cfg, setCfg] = useState<any>({});
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ username: '', name: '', email: '', phone: '' });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  useEffect(() => {
    gamesApi.config().then((res: any) => {
      if (res?.data?.vip) setCfg(res.data.vip);
    }).catch(() => {});
  }, []);

  const tiers = (cfg.tiers || DEFAULT_TIERS).map((tier: any, index: number) => ({
    ...DEFAULT_TIERS[index],
    ...tier,
  }));
  const stats = (cfg.stats || DEFAULT_STATS).map((s: any, i: number) => ({ ...DEFAULT_STATS[i], ...s }));
  const faq = cfg.faq || DEFAULT_FAQ;
  const title = cfg.title || pageContent.title || 'Ayrıcalıklı deneyim,\nözel avantajlar';
  const description = cfg.description || pageContent.subtitle || 'Sadık oyuncularımıza özel 4 kademeli VIP programıyla kazancını ve deneyimini üst seviyeye taşı.';
  const eyebrow = cfg.eyebrow || pageContent.eyebrow || 'VIP Üyelik Programı';
  const formTitle = cfg.formTitle || pageContent.formTitle || 'VIP başvurusu';
  const formButtonText = cfg.formButtonText || pageContent.submitButton || 'Başvur';
  const formSuccessMessage = cfg.formSuccessMessage || pageContent.successDescription || 'VIP başvurunuz alındı! Ekibimiz en kısa sürede sizinle iletişime geçecek.';
  const showStats = cfg.showStats !== false;
  const showFaq = cfg.showFaq !== false;
  const formActive = cfg.formActive !== false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || submitting) return;
    setSubmitting(true);
    try { await formsApi.submitVipRequest(form); } catch { /* */ }
    setSent(true);
    setSubmitting(false);
  };

  const handleSelectTier = (id: string) => {
    setSelectedTier(id);
    document.getElementById('vip-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#030408] font-sans text-zinc-100 selection:bg-amber-300/20">

      {/* ── Background ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(168,85,247,0.22),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_10%_60%,rgba(251,191,36,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_35%_at_90%_80%,rgba(99,102,241,0.10),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.012)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between px-4 py-5 md:px-10">
        <Link to="/lobi" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black uppercase tracking-[0.12em] text-zinc-400 backdrop-blur transition hover:text-white">
          <ArrowLeft size={15} />
          Lobi
        </Link>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200 backdrop-blur">
          <Crown size={14} className="text-amber-300" />
          {pageContent.label}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto max-w-[1100px] px-4 pb-16 pt-8 text-center md:px-10 md:pt-14 md:pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/[0.09] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.12)]">
            <Crown size={13} className="text-amber-300" />
            {eyebrow}
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="mx-auto mt-6 max-w-3xl whitespace-pre-line text-5xl font-black leading-[0.92] tracking-[-0.06em] text-white md:text-7xl lg:text-8xl"
        >
          {title.replace('\\n', '\n')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="mx-auto mt-6 max-w-xl text-base font-medium leading-7 text-zinc-500 md:text-lg"
        >
          {description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.26 }}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <a
            href="#vip-form"
            onClick={(e) => { e.preventDefault(); document.getElementById('vip-form')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="inline-flex h-14 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-sm font-black uppercase tracking-[0.14em] text-black shadow-[0_18px_45px_rgba(251,191,36,0.28)] transition hover:from-amber-300 hover:to-amber-400 active:scale-[0.98]"
          >
            <Sparkles size={18} />
            {pageContent.primaryButton}
          </a>
          <a
            href="#tiers"
            onClick={(e) => { e.preventDefault(); document.getElementById('tiers')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="inline-flex h-14 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-7 text-sm font-black uppercase tracking-[0.1em] text-white backdrop-blur transition hover:bg-white/[0.09] active:scale-[0.98]"
          >
            {lobbyExtraText(pageContent, 'tiersButton', 'Seviyeleri gör')}
          </a>
        </motion.div>
      </section>

      {/* ── Stats ── */}
      {showStats && (
        <section className="relative z-10 mx-auto max-w-[1100px] px-4 pb-20 md:px-10">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {stats.map((stat: any) => (
              <StatCard key={stat.id || stat.label} value={stat.value} label={stat.label} end={stat.end ?? null} />
            ))}
          </div>
        </section>
      )}

      {/* ── Tier Cards ── */}
      <section id="tiers" className="relative z-10 mx-auto max-w-[1100px] px-4 pb-24 md:px-10">
        <div className="mb-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">Seviyeler</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white md:text-4xl">{lobbyExtraText(pageContent, 'tiersTitle', 'Kademenizi seçin')}</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-5">
          {tiers.map((tier: any, i: number) => {
            const style = TIER_STYLES[i % TIER_STYLES.length];
            return (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className={cn(
                  'relative flex flex-col overflow-hidden rounded-[2rem] border bg-gradient-to-b p-6 transition-transform duration-300 hover:-translate-y-1 md:p-7',
                  style.gradient, style.border, style.glow,
                  tier.popular && 'scale-[1.02] xl:scale-[1.04]'
                )}
              >
                {tier.popular && (
                  <div className="absolute right-0 top-0">
                    <div className="rounded-bl-2xl rounded-tr-2xl bg-amber-400 px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-black shadow-[0_4px_20px_rgba(251,191,36,0.4)]">
                      <Star size={10} className="inline mr-1 fill-current" />
                      Popüler
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-3xl', style.badge_bg)}>
                    {tier.badge}
                  </div>
                  <div>
                    <p className={cn('text-lg font-black tracking-[-0.04em]', style.text)}>{tier.label}</p>
                    <p className={cn('text-[10px] font-black uppercase tracking-[0.16em] opacity-60', style.text)}>{tier.sublabel}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Minimum yatırım</p>
                  <p className={cn('mt-1 text-sm font-black', style.accent)}>{tier.minDeposit || 'Belirtilmedi'}</p>
                </div>

                <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <ul className="flex-1 space-y-2.5">
                  {(tier.perks || []).map((perk: string) => (
                    <li key={perk} className="flex items-start gap-2.5 text-[13px] font-medium leading-5 text-zinc-300">
                      <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full', style.badge_bg)}>
                        <Check size={10} className={style.accent} />
                      </span>
                      {perk}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleSelectTier(tier.id)}
                  className={cn(
                    'mt-6 flex h-11 w-full items-center justify-center rounded-2xl text-xs font-black uppercase tracking-[0.12em] transition active:scale-[0.97]',
                    tier.popular
                      ? 'bg-amber-400 text-black shadow-[0_8px_28px_rgba(251,191,36,0.3)] hover:bg-amber-300'
                      : 'border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12]'
                  )}
                >
                  {lobbyExtraText(pageContent, 'tierApplyButton', 'Bu seviyeye başvur')}
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── FAQ ── */}
      {showFaq && faq.length > 0 && (
        <section className="relative z-10 mx-auto max-w-[760px] px-4 pb-24 md:px-10">
          <div className="mb-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">Sorular</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white md:text-4xl">{lobbyExtraText(pageContent, 'faqTitle', 'Sık sorulan sorular')}</h2>
          </div>
          <div className="space-y-2">
            {faq.map((item: any, i: number) => (
              <motion.div
                key={item.id || i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="overflow-hidden rounded-[1.5rem] border border-white/[0.07] bg-white/[0.03] backdrop-blur"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-black text-white md:text-base">{item.q}</span>
                  <ChevronDown size={18} className={cn('shrink-0 text-zinc-600 transition-transform duration-200', openFaq === i && 'rotate-180 text-amber-300')} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="border-t border-white/[0.05] px-5 py-4 text-sm leading-7 text-zinc-500">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ── Application Form ── */}
      {formActive && (
        <section id="vip-form" className="relative z-10 mx-auto max-w-[640px] px-4 pb-28 md:px-10">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-blue-400/20 bg-gradient-to-b from-blue-950/60 to-black/80 p-7 shadow-[0_0_80px_rgba(168,85,247,0.14)] backdrop-blur-xl md:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(168,85,247,0.15),transparent)]" />

            <div className="relative">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/20 text-3xl shadow-[0_0_30px_rgba(168,85,247,0.25)]">
                  👑
                </div>
                <h2 className="text-2xl font-black tracking-[-0.04em] text-white md:text-3xl">{formTitle}</h2>
                <p className="mt-2 text-sm font-medium text-zinc-500">{pageContent.formDescription}</p>
                {selectedTier && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-200">
                    {tiers.find((t: any) => t.id === selectedTier)?.badge} {tiers.find((t: any) => t.id === selectedTier)?.label} seviyesi seçildi
                  </div>
                )}
              </div>

              {sent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-8 text-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 shadow-[0_0_40px_rgba(52,211,153,0.2)]">
                    <CheckCircle2 size={40} className="text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-black text-white">{pageContent.successTitle}</h3>
                  <p className="max-w-sm text-sm leading-6 text-zinc-500">{formSuccessMessage}</p>
                  <Link to="/lobi" className="mt-2 inline-flex h-11 items-center gap-2 rounded-2xl bg-white/[0.07] px-5 text-xs font-black uppercase tracking-wider text-zinc-300 hover:bg-white/[0.12]">
                    <ArrowLeft size={14} /> {pageContent.successButton}
                  </Link>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { key: 'username', placeholder: pageContent.usernamePlaceholder, type: 'text', required: true },
                      { key: 'name', placeholder: lobbyExtraText(pageContent, 'namePlaceholder', 'Ad Soyad'), type: 'text', required: false },
                      { key: 'email', placeholder: lobbyExtraText(pageContent, 'emailPlaceholder', 'E-posta'), type: 'email', required: false },
                      { key: 'phone', placeholder: lobbyExtraText(pageContent, 'phonePlaceholder', 'Telefon'), type: 'tel', required: false },
                    ].map(({ key, placeholder, type, required }) => (
                      <input
                        key={key}
                        type={type}
                        placeholder={placeholder}
                        value={(form as any)[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        required={required}
                        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-3.5 text-sm font-bold text-white outline-none placeholder:text-zinc-700 transition focus:border-blue-400/50 focus:bg-white/[0.07]"
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !form.username.trim()}
                    className="relative mt-1 flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-teal-600 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_40px_rgba(168,85,247,0.3)] transition hover:from-blue-500 hover:to-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? <Loader2 size={18} className="animate-spin" />
                      : <><Send size={16} /> {formButtonText}</>
                    }
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
