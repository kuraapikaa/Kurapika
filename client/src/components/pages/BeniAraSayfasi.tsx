import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneCall, User, Phone, MessageSquare, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { formsApi } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { LobbyMobileNav } from './LobbyMobileNav';
import { lobbyExtraText, useLobbyPageContent } from '../../lib/lobbyContent';

export function BeniAraSayfasi() {
  const { content: pageContent } = useLobbyPageContent('call-me');
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070b14] text-zinc-200 flex flex-col">
      <LobbyMobileNav active="call" />

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-3 py-5 sm:px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#0e1420] shadow-2xl"
        >
          <div className="border-b border-white/5 bg-gradient-to-b from-sky-500/10 to-transparent p-5 text-center sm:p-8">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/10 sm:mb-4 sm:h-16 sm:w-16 sm:rounded-full">
              <PhoneCall size={26} className="text-sky-400" />
            </div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-sky-300/80">{pageContent.eyebrow}</p>
            <h1 className="text-2xl font-black text-white">{settings.callTitle || pageContent.title || 'Aranma Talebi'}</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-zinc-400">{settings.callDescription || pageContent.subtitle || 'Müşteri temsilcilerimizin sizi araması için form doldurun.'}</p>
          </div>

        <div className="p-4 sm:p-8">
           {settingsLoading ? (
             <div className="flex justify-center py-12"><Loader2 className="animate-spin text-zinc-500" /></div>
           ) : !settings.callActive ? (
             <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-2 text-rose-400">
                  <AlertCircle size={28} />
                </div>
                <h2 className="text-xl font-bold text-white">{pageContent.unavailableTitle}</h2>
                <p className="text-zinc-400 text-sm">{pageContent.unavailableDescription}</p>
             </div>
           ) : (
             <AnimatePresence mode="wait">
             {status === 'success' ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
                   <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={30} className="text-emerald-400" />
                   </div>
                   <h2 className="text-xl font-bold text-white mb-2">{pageContent.successTitle}</h2>
                   <p className="text-emerald-400 text-sm font-medium">{msg}</p>
                   <button onClick={() => setStatus('idle')} className="mt-6 px-6 py-2 bg-white/5 rounded-full text-sm font-bold hover:bg-white/10">{pageContent.successButton}</button>
                </motion.div>
             ) : (
                <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={submit} className="space-y-5">
                   <div>
                      <label htmlFor="beni-ara-username" className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">
                        <User size={14} aria-hidden="true" /> {pageContent.usernameLabel}
                      </label>
                      <input id="beni-ara-username" type="text" value={username} onChange={e=>setUsername(e.target.value)} required placeholder={pageContent.usernamePlaceholder} autoComplete="username" className="h-[52px] w-full rounded-xl border border-white/5 bg-[#0a0f18] px-4 py-4 font-bold text-white outline-none transition-all focus:ring-2 focus:ring-sky-500/30" />
                   </div>
                   <div>
                      <label htmlFor="beni-ara-phone" className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">
                        <Phone size={14} aria-hidden="true" /> {lobbyExtraText(pageContent, 'phoneLabel', 'TELEFON NUMARASI')}
                      </label>
                      <input id="beni-ara-phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required placeholder={lobbyExtraText(pageContent, 'phonePlaceholder', 'Örn: 05xx xxx xx xx')} autoComplete="tel" className="h-[52px] w-full rounded-xl border border-white/5 bg-[#0a0f18] px-4 py-4 font-bold text-white outline-none transition-all focus:ring-2 focus:ring-sky-500/30" />
                   </div>
                   <div>
                      <label htmlFor="beni-ara-reason" className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">
                        <MessageSquare size={14} aria-hidden="true" /> {lobbyExtraText(pageContent, 'reasonLabel', 'ARANMA SEBEBİ')}
                      </label>
                      <select id="beni-ara-reason" value={reason} onChange={e=>setReason(e.target.value)} className="h-[52px] w-full rounded-xl border border-white/5 bg-[#0a0f18] px-4 py-4 font-bold text-white outline-none transition-all focus:ring-2 focus:ring-sky-500/30">
                         {settings.callReasons.map((r: string, idx: number) => (
                           <option key={idx} value={r}>{r}</option>
                         ))}
                      </select>
                   </div>
                   {status === 'error' && <div className="text-rose-400 text-sm font-bold">{msg}</div>}
                   <button disabled={status==='loading'} className="flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-sky-500 font-black text-black transition-all hover:bg-sky-400 disabled:opacity-60">
                      {status === 'loading' ? <Loader2 className="animate-spin" /> : (settings.callButtonText || pageContent.primaryButton || 'Talep Gönder')}
                   </button>
                </motion.form>
              )}
             </AnimatePresence>
            )}
        </div>
        </motion.div>
      </main>
    </div>
  );
}
