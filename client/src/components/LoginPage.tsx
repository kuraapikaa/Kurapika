import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { cn } from '../lib/utils';

interface LoginPageProps {
  onLoginSuccess: () => void;
  tenantConfig?: { themeColor?: string; logoUrl?: string; adminTitle?: string } | null;
}

export function LoginPage({ onLoginSuccess, tenantConfig }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [provider, setProvider] = useState<'lynon' | 'betconstruct'>('lynon');
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Varsayilan aksan arka plan gorselinden turetildi: kilicin ve yuzdeki
   * kenar isigin altin tonu. Onceki degeri camgobegiydi (#22d3ee) ve
   * sicak/olive bir kareyle yan yana durunca ikisi de kirliyordu.
   */
  const accent = tenantConfig?.themeColor || '#d4a24c';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, provider }),
      });

      if (!response.ok) {
        const body = await response.text();
        let message = `Giriş başarısız (${response.status})`;
        try {
          const parsed = JSON.parse(body);
          message = parsed.message || message;
        } catch {
          if (body) message = body.slice(0, 120);
        }
        setError(message);
        setLoading(false);
        return;
      }

      setLoginSuccess(true);
      window.setTimeout(onLoginSuccess, 350);
    } catch {
      setError('Sistem bağlantısı kurulamadı.');
      setLoading(false);
    }
  };

  /**
   * Kullanıcı işletim sisteminde "hareketi azalt" demişse sonsuz
   * animasyonlar kapanır. Giriş ekranı kaçınılabilir bir sayfa değil;
   * sürekli oynayan bir öğe hareket duyarlılığı olan kişilerde baş
   * dönmesi yapabiliyor.
   */
  const sadeHareket = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <main className="login-shell">
      <motion.img
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        src="/assets/images/arwen-login.jpg"
        alt="Arwen Software Solutions"
        className="login-backdrop"
      />
      <div className="login-overlay" />
      <div className="login-grid" />

      <div className="login-stage">
        <AnimatePresence mode="wait">
          {!loginSuccess ? (
            <motion.section
              key="login"
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="login-panel w-full max-w-[460px]"
            >
              {/*
                ARWEN İŞARETİ.

                Giriş ekranında markayı taşıyan tek görsel öğe. Arka plan
                fotoğrafı zaten var ama o dekor; bu işaret kimliği
                söylüyor ve panelin "kimin" olduğunu ilk saniyede
                gösteriyor.

                Animasyon üç katman:
                  · giriş — aşağıdan yukarı, hafif büyüyerek (bir kez)
                  · nefes — sonsuz, çok yavaş yukarı-aşağı süzülme
                  · hâle  — arkada dönen yumuşak parıltı

                `prefers-reduced-motion` açık olan kullanıcıda sonsuz
                hareketler DURUYOR: sürekli oynayan bir öğe, hareket
                duyarlılığı olan kişilerde baş dönmesi yapabiliyor ve
                giriş ekranı kaçınılabilir bir sayfa değil.
              */}
              <motion.div
                className="arwen-mark-wrap mb-5 flex justify-center"
                initial={{ opacity: 0, y: 18, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <span className="arwen-mark-halo" aria-hidden="true" />
                <motion.img
                  src="/assets/brand/arwen-mark-gold.png"
                  alt="Arwen Software Solutions"
                  className="arwen-mark"
                  draggable={false}
                  animate={sadeHareket ? undefined : { y: [0, -7, 0] }}
                  transition={sadeHareket ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>

              <div className="login-brand-row mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/5 bg-white/[0.06]"
                    style={{ boxShadow: `0 0 36px ${accent}20` }}
                  >
                    {tenantConfig?.logoUrl ? (
                      <img src={tenantConfig.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
                    ) : (
                      <ShieldCheck size={22} style={{ color: accent }} />
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">
                      Control system
                    </p>
                    <p className="text-sm font-semibold text-white">{tenantConfig?.adminTitle || 'Arwen Software Solutions'}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" />
                  Online
                </span>
              </div>

              <div className="login-provider-card mb-5 rounded-xl p-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">Partner altyapı</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">Seçili bağlantı, oturum boyunca veri kaynağını belirler.</p>
                  </div>

                  <div className="login-partner-logo-frame" aria-hidden="true">
                    <img
                      src={provider === 'lynon' ? '/assets/partners/lynon.png' : '/assets/partners/betconstruct.png'}
                      alt={provider === 'lynon' ? 'LYNON partner' : 'BetConstruct partner'}
                      className={cn('login-partner-logo', provider === 'betconstruct' && 'login-partner-logo-betconstruct')}
                    />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-8" role="group" aria-label="Veri sağlayıcısı">
                  {(['lynon', 'betconstruct'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setProvider(option)}
                      className={cn(
                        'login-provider-option min-h-[44px] rounded-full border px-4 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors backdrop-blur-xl',
                        provider === option
                          ? option === 'lynon' ? 'border-amber-300/50 bg-amber-500 text-[#1a1206] shadow-[0_0_20px_rgba(212,162,76,0.38)]' : 'border-lime-300/40 bg-[#6b7a52] text-white shadow-[0_0_20px_rgba(122,140,104,0.32)]'
                          : 'border-white/5 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'
                      )}
                    >
                      {option === 'lynon' ? 'LYNON ile giriş' : 'BetConstruct'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="login-welcome mb-5">
                <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-white sm:text-[2.25rem]">Tekrar hoş geldiniz.</h1>
                <p className="mt-1.5 max-w-sm text-sm leading-5 text-slate-400">
                  Yönetim araçlarına ve canlı operasyon verilerine güvenli erişim sağlayın.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="login-form space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Kullanıcı adı
                  </span>
                  <span className="login-field">
                    <UserRound size={17} />
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Kullanıcı adınızı girin"
                      autoFocus
                      required
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Parola
                  </span>
                  <span className="login-field">
                    <LockKeyhole size={17} />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Parolanızı girin"
                      required
                    />
                  </span>
                </label>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-xs font-medium text-rose-300 backdrop-blur-xl"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  whileTap={{ scale: 0.985 }}
                  type="submit"
                  disabled={loading}
                  className={cn('login-submit', loading && 'cursor-wait opacity-75')}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Panele giriş yap</span>}
                  {!loading && <ArrowRight size={18} />}
                </motion.button>
              </form>

              <div className="login-security mt-4 flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck size={14} className="text-purple-300/80" />
                Oturumunuz şifreli bağlantı üzerinden korunur.
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="login-panel flex w-full max-w-[460px] flex-col items-center py-12 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/20 bg-[color:var(--panel-info,#64d2ff)]/10 text-cyan-300 backdrop-blur-xl">
                <CheckCircle2 size={30} />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-white">Erişim onaylandı</h2>
              <p className="mt-2 text-sm text-slate-400">Panel hazırlanıyor…</p>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

