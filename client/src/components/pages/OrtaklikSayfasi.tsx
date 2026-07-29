import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Handshake, User, Link as LinkIcon, Users, MessageSquare, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { formsApi } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { LobbyMobileNav } from './LobbyMobileNav';
import { lobbyExtraText, useLobbyPageContent } from '../../lib/lobbyContent';

export function OrtaklikSayfasi() {
  const { content: pageContent } = useLobbyPageContent('partner');
  const [type, setType] = useState('Telegram Grubu');
  const [contact, setContact] = useState('');
  const [channelUrl, setChannelUrl] = useState('');
  const [audienceSize, setAudienceSize] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['forms-settings'],
    queryFn: () => formsApi.getSettings()
  });

  const settings = settingsData?.data || {
    partnershipTypes: [],
    partnershipActive: true,
    partnershipTitle: 'Ortaklık Başvurusu',
    partnershipDescription: 'Telegram grubu sahipleri, yayıncılar ve partnerler için ortaklık formu.',
    partnershipSuccessMessage: 'Ortaklık talebiniz başarıyla alınmıştır. Ekibimiz sizinle iletişime geçecektir.',
    partnershipButtonText: 'Başvuru Gönder',
  };

  useEffect(() => {
    if (settings.partnershipTypes.length > 0 && !type) {
      setType(settings.partnershipTypes[0]);
    }
  }, [settings.partnershipTypes]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim() || !channelUrl.trim()) return;
    
    setStatus('loading');
    try {
       const res = await formsApi.submitPartnershipRequest({ type, contact, channelUrl, audienceSize, message });
       if (res.ok) {
          setStatus('success');
          setMsg(settings.partnershipSuccessMessage || pageContent.successDescription || res.message);
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
    <div className="narcos-lobby min-h-screen overflow-x-hidden bg-[#0e0c09] font-lobby text-[color:var(--lobby-text,#f3ecdd)] flex flex-col">
      <LobbyMobileNav />

      <main className="relative mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-3 py-5 sm:px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="my-2 w-full overflow-hidden rounded-[1.8rem] border border-[rgba(243,236,221,0.10)] bg-[#0e1420] shadow-2xl sm:my-8"
        >
          <div className="border-b border-[rgba(243,236,221,0.05)] bg-gradient-to-b from-blue-500/10 to-transparent p-5 text-center sm:p-8">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 sm:mb-4 sm:h-16 sm:w-16 sm:rounded-full">
              <Handshake size={28} className="text-blue-400" />
            </div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300/80">{pageContent.eyebrow}</p>
            <h1 className="text-2xl font-black text-[color:var(--lobby-text,#f3ecdd)]">{settings.partnershipTitle || pageContent.title || 'Ortaklık Başvurusu'}</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--lobby-muted,#8f8674)]">{settings.partnershipDescription || pageContent.subtitle || 'Telegram grubu sahipleri, yayıncılar ve partnerler için ortaklık formu.'}</p>
          </div>

        <div className="p-4 sm:p-8">
           {settingsLoading ? (
             <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[color:var(--lobby-muted,#8f8674)]" /></div>
           ) : !settings.partnershipActive ? (
             <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-2 text-rose-400">
                  <AlertCircle size={28} />
                </div>
                <h2 className="text-xl font-bold text-[color:var(--lobby-text,#f3ecdd)]">{pageContent.unavailableTitle}</h2>
                <p className="text-[color:var(--lobby-muted,#8f8674)] text-sm">{pageContent.unavailableDescription}</p>
             </div>
           ) : (
             <AnimatePresence mode="wait">
             {status === 'success' ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
                   <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={30} className="text-emerald-400" />
                   </div>
                   <h2 className="text-xl font-bold text-[color:var(--lobby-text,#f3ecdd)] mb-2">{pageContent.successTitle}</h2>
                   <p className="text-emerald-400 text-sm font-medium">{msg}</p>
                   <button onClick={() => setStatus('idle')} className="mt-6 px-6 py-2 bg-[rgba(243,236,221,0.05)] rounded-full text-sm font-bold hover:bg-[rgba(243,236,221,0.10)]">{pageContent.successButton}</button>
                </motion.div>
             ) : (
                <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={submit} className="space-y-4">
                   <div>
                      <label htmlFor="ortaklik-type" className="flex items-center gap-2 text-xs font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest mb-2">
                        {pageContent.usernameLabel}
                      </label>
                      <select id="ortaklik-type" value={type} onChange={e=>setType(e.target.value)} className="h-[52px] w-full rounded-xl border border-[rgba(243,236,221,0.05)] bg-[#0a0f18] px-4 font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none transition-all focus:ring-2 focus:ring-blue-500/30">
                         {settings.partnershipTypes.map((t: string, idx: number) => (
                           <option key={idx} value={t}>{t}</option>
                         ))}
                      </select>
                   </div>
                   <div>
                      <label htmlFor="ortaklik-channel" className="flex items-center gap-2 text-xs font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest mb-2">
                        <LinkIcon size={14} aria-hidden="true" /> {lobbyExtraText(pageContent, 'channelLabel', 'KANAL/SAYFA LİNKİ')}
                      </label>
                      <input id="ortaklik-channel" type="url" value={channelUrl} onChange={e=>setChannelUrl(e.target.value)} required placeholder={lobbyExtraText(pageContent, 'channelPlaceholder', 'https://...')} className="h-[52px] w-full rounded-xl border border-[rgba(243,236,221,0.05)] bg-[#0a0f18] px-4 font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none transition-all focus:ring-2 focus:ring-blue-500/30" />
                   </div>
                   <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                     <div>
                        <label htmlFor="ortaklik-audience" className="flex items-center gap-2 text-xs font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest mb-2">
                          <Users size={14} aria-hidden="true" /> {lobbyExtraText(pageContent, 'audienceLabel', 'KİTLE SAYISI')}
                        </label>
                        <input id="ortaklik-audience" type="text" value={audienceSize} onChange={e=>setAudienceSize(e.target.value)} placeholder={lobbyExtraText(pageContent, 'audiencePlaceholder', 'Örn: 50K')} className="h-[52px] w-full rounded-xl border border-[rgba(243,236,221,0.05)] bg-[#0a0f18] px-4 font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none transition-all focus:ring-2 focus:ring-blue-500/30" />
                     </div>
                     <div>
                        <label htmlFor="ortaklik-contact" className="flex items-center gap-2 text-xs font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest mb-2">
                          <User size={14} aria-hidden="true" /> {lobbyExtraText(pageContent, 'contactLabel', 'İLETİŞİM')}
                        </label>
                        <input id="ortaklik-contact" type="text" value={contact} onChange={e=>setContact(e.target.value)} required placeholder={lobbyExtraText(pageContent, 'contactPlaceholder', '@KullaniciAdi')} className="h-[52px] w-full rounded-xl border border-[rgba(243,236,221,0.05)] bg-[#0a0f18] px-4 font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none transition-all focus:ring-2 focus:ring-blue-500/30" />
                     </div>
                   </div>
                   <div>
                      <label htmlFor="ortaklik-message" className="flex items-center gap-2 text-xs font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest mb-2">
                        <MessageSquare size={14} aria-hidden="true" /> {lobbyExtraText(pageContent, 'messageLabel', 'EK MESAJ')}
                      </label>
                      <textarea id="ortaklik-message" value={message} onChange={e=>setMessage(e.target.value)} rows={3} placeholder={lobbyExtraText(pageContent, 'messagePlaceholder', 'Belirtmek istediğiniz detaylar...')} className="w-full resize-none rounded-xl border border-[rgba(243,236,221,0.05)] bg-[#0a0f18] px-4 py-4 font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none transition-all focus:ring-2 focus:ring-blue-500/30" />
                   </div>
                   {status === 'error' && <div className="text-rose-400 text-sm font-bold">{msg}</div>}
                   <button disabled={status==='loading'} className="flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-blue-500 font-black text-[color:var(--lobby-text,#f3ecdd)] transition-all hover:bg-blue-400 disabled:opacity-60">
                      {status === 'loading' ? <Loader2 className="animate-spin" /> : (settings.partnershipButtonText || pageContent.primaryButton || 'Başvuru Gönder')}
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
