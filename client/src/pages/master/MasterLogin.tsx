import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, KeyRound, Loader2, Lock, ShieldAlert, User } from 'lucide-react';
import { masterApi } from '@/api/client';

export function MasterLogin({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await masterApi.login({ username, password });
      if (res.ok) {
        onLoginSuccess();
      } else {
        setError(res.message || 'Giriş başarısız.');
        setLoading(false);
      }
    } catch {
      setError('Bağlantı hatası.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#0b0a10] px-4 text-slate-200">
      <div className="pointer-events-none absolute inset-0">
        {/* Mesh gradyan: mor birincil, zumrut ikincil. */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_10%,rgba(168,85,247,.20),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(52,211,153,.10),transparent_34%),linear-gradient(180deg,#0b0a10,#08070d)]" />
        <div className="absolute left-1/2 top-0 h-px w-[70vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/[0.05] bg-white/[0.03] shadow-2xl shadow-black/50 backdrop-blur-xl md:grid-cols-[1fr_440px]"
      >
        <div className="mesh-mor hidden min-h-[560px] flex-col justify-between border-r border-white/5 p-8 md:flex">
          <div>
            <div className="grid h-14 w-14 grid-cols-2 place-items-center gap-1 rounded-3xl border border-purple-400/25 bg-purple-400/10 p-8 text-purple-300 backdrop-blur-xl">
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
              <span className="h-2.5 w-2.5 rounded bg-current" />
            </div>
            <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-purple-300/75">Master control</p>
            <h1 className="mt-2 max-w-md text-5xl font-semibold leading-[0.95] tracking-[-0.07em] text-white">Tenant yönetimi için güvenli giriş.</h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">Müşteri panelleri, domainler, erişim bilgileri ve marka ayarları tek merkezde.</p>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {['Oturum', 'Yetki', 'Kayıt'].map((item) => (
              <div key={item} className="rounded-3xl border border-white/[0.05] bg-white/[0.03] p-8 backdrop-blur-xl">
                <KeyRound className="mb-3 text-purple-300" size={18} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <div className="mb-8 text-center">
            <div className="neon-glow-indigo mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-purple-400/25 bg-purple-400/10 text-purple-300 backdrop-blur-xl">
              <ShieldAlert size={30} />
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">Master sistem</h2>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Süper yönetici girişi</p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Kullanıcı adı</span>
              <div className="relative">
                <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-full border border-white/5 bg-black/30 py-4 pl-12 pr-4 text-sm font-semibold text-white outline-none transition focus:border-purple-400/40"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Şifre</span>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-full border border-white/5 bg-black/30 py-4 pl-12 pr-4 text-sm font-semibold text-white outline-none transition focus:border-purple-400/40"
                  required
                />
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-3xl border border-rose-400/25 bg-rose-400/10 p-8 text-center text-sm font-bold text-rose-300 backdrop-blur-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="neon-glow-indigo mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-purple-500 py-4 text-sm font-semibold text-white transition hover:bg-purple-400 disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" /> : <>Sisteme gir <ArrowRight size={18} /></>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
