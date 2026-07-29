import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, MessageSquare, CheckCircle2, Loader2, AlertCircle, PhoneCall } from 'lucide-react';
import { formsApi } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { lobbyExtraText } from '../../lib/lobbyContent';
import { useLobbyPageTheme, hexToRgba } from '../../lib/lobbyTheme';
import { LobbyPageShell, LobbyCard } from './LobbyPageShell';

export function BeniAraSayfasi() {
  const { content: pageContent, palette, rootStyle, backgroundStyle } = useLobbyPageTheme('call-me');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['forms-settings'],
    queryFn: () => formsApi.getSettings()
  });

  const settings = settingsData?.data || {
    callReasons: [],
    callActive: true,
    callTitle: 'Beni Ara',
    callDescription: 'Müşteri temsilcilerimizin sizi araması için form doldurun.',
    callSuccessMessage: 'Talebiniz alınmıştır. Sizi en kısa sürede arayacağız.',
    callButtonText: 'Talep Gönder',
  };

  useEffect(() => {
    if (settings.callReasons.length > 0 && !reason) {
      setReason(settings.callReasons[0]);
    }
  }, [settings.callReasons]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !phone.trim()) return;

    setStatus('loading');
    try {
      const res = await formsApi.submitCallRequest({ username, phone, reason });
      if (res.ok) {
        setStatus('success');
        setMsg(settings.callSuccessMessage || pageContent.successDescription || res.message);
      } else {
        setStatus('error');
        setMsg(res.message || lobbyExtraText(pageContent, 'submitError', 'Bir hata oluştu.'));
      }
    } catch {
      setStatus('error');
      setMsg(lobbyExtraText(pageContent, 'connectionError', 'Bağlantı hatası.'));
    }
  };

  const fieldCls = 'h-11 w-full rounded-xl border border-[rgba(243,236,221,0.07)] bg-black/30 px-3 text-[13px] font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none transition placeholder:text-[color:var(--lobby-muted,#8f8674)] focus:border-[color:var(--lobby-primary,#e7c574)]/60';

  return (
    <LobbyPageShell
      active="call"
      palette={palette}
      rootStyle={rootStyle}
      backgroundStyle={backgroundStyle}
      eyebrow={pageContent.eyebrow}
      title={settings.callTitle || pageContent.title || 'Aranma Talebi'}
      subtitle={settings.callDescription || pageContent.subtitle}
      aside={
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl border"
          style={{
            borderColor: hexToRgba(palette.accentColor, 0.24),
            backgroundColor: hexToRgba(palette.accentColor, 0.12),
            color: palette.accentColor,
          }}
        >
          <PhoneCall size={20} />
        </span>
      }
    >
      <LobbyCard className="mx-auto w-full max-w-xl">
        {settingsLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-[color:var(--lobby-muted,#8f8674)]" size={22} />
          </div>
        ) : !settings.callActive ? (
          <div className="space-y-2 py-8 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-300">
              <AlertCircle size={20} />
            </span>
            <h2 className="text-sm font-black text-[color:var(--lobby-text,#f3ecdd)]">{pageContent.unavailableTitle}</h2>
            <p className="text-[12px] font-medium text-[color:var(--lobby-muted,#8f8674)]">{pageContent.unavailableDescription}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 py-6 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <CheckCircle2 size={20} />
                </span>
                <h2 className="text-sm font-black text-[color:var(--lobby-text,#f3ecdd)]">{pageContent.successTitle}</h2>
                <p className="text-[12px] font-semibold text-emerald-300">{msg}</p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="mt-2 rounded-xl border border-[rgba(243,236,221,0.10)] bg-[rgba(243,236,221,0.05)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-text,#f3ecdd)] transition hover:bg-[rgba(243,236,221,0.10)] hover:text-[color:var(--lobby-text,#f3ecdd)]"
                >
                  {pageContent.successButton}
                </button>
              </motion.div>
            ) : (
              <motion.form key="form" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="beni-ara-username" className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--lobby-muted,#8f8674)]">
                      <User size={12} aria-hidden="true" /> {pageContent.usernameLabel}
                    </label>
                    <input
                      id="beni-ara-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder={pageContent.usernamePlaceholder}
                      autoComplete="username"
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="beni-ara-phone" className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--lobby-muted,#8f8674)]">
                      <Phone size={12} aria-hidden="true" /> {lobbyExtraText(pageContent, 'phoneLabel', 'Telefon numarası')}
                    </label>
                    <input
                      id="beni-ara-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder={lobbyExtraText(pageContent, 'phonePlaceholder', 'Örn: 05xx xxx xx xx')}
                      autoComplete="tel"
                      className={fieldCls}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="beni-ara-reason" className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--lobby-muted,#8f8674)]">
                    <MessageSquare size={12} aria-hidden="true" /> {lobbyExtraText(pageContent, 'reasonLabel', 'Aranma sebebi')}
                  </label>
                  <select
                    id="beni-ara-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={fieldCls}
                  >
                    {settings.callReasons.map((r: string, idx: number) => (
                      <option key={idx} value={r} className="bg-slate-900">{r}</option>
                    ))}
                  </select>
                </div>

                {status === 'error' && (
                  <p className="rounded-xl border border-rose-400/15 bg-rose-400/10 px-3 py-2 text-[11px] font-bold text-rose-200">{msg}</p>
                )}

                <button
                  disabled={status === 'loading'}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--lobby-text,#f3ecdd)] transition active:scale-[0.99] disabled:opacity-60"
                  style={{
                    background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.secondaryColor})`,
                    boxShadow: `0 8px 22px ${hexToRgba(palette.primaryColor, 0.26)}`,
                  }}
                >
                  {status === 'loading'
                    ? <Loader2 className="animate-spin" size={15} />
                    : (settings.callButtonText || pageContent.primaryButton || 'Talep Gönder')}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        )}
      </LobbyCard>
    </LobbyPageShell>
  );
}
