import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Loader2, Trophy, Gift, AlertCircle, Ticket } from 'lucide-react';
import { cn } from '../../lib/utils';
import { gamesApi, bonusPanelApi } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { LobbyMobileNav } from './LobbyMobileNav';
import { lobbyExtraText, useLobbyPageContent } from '../../lib/lobbyContent';
import { WheelSvg } from '../admin/WheelManager';

export function CarkSayfasi() {
  const { content: pageContent } = useLobbyPageContent('wheel');
  const [username, setUsername] = useState('');
  const [playerChecked, setPlayerChecked] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [wheelCode, setWheelCode] = useState('');

  // Oturum kontrolü
  useEffect(() => {
    bonusPanelApi.me().then(res => {
      if (res.ok) {
        setUsername(res.login);
        setPlayerChecked(true);
      }
    });
  }, []);

  const { data: configRes } = useQuery({
    queryKey: ['games-config'],
    queryFn: () => gamesApi.config(),
    staleTime: 0 // Her zaman en güncel ayarları çek
  });

  const wheelSlices = configRes?.data?.wheel || [
    { id: 1, label: 'Pas', color: 'bg-zinc-800', isLoss: true }
  ];
  const wheelAppearance = {
    rimColor: '#27272a',
    centerColor: '#27272a',
    pointerColor: '#ffffff',
    glowColor: '#d4af37',
    pageAccentColor: '#d4af37',
    borderWidth: 8,
    centerSize: 52,
    labelSize: 11,
    glowStrength: 35,
    glossy: false,
    ...(configRes?.data?.wheelAppearance || {})
  };
  const [loadingUser, setLoadingUser] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCheck = async () => {
    if (!username.trim()) return;
    setLoadingUser(true);
    setErrorMsg('');
    try {
      const res = await bonusPanelApi.login(username.trim());
      if (res.ok) {
        setPlayerChecked(true);
      } else {
        setErrorMsg(lobbyExtraText(pageContent, 'userNotFoundError', 'Kullanıcı adı bulunamadı.'));
      }
    } catch {
      setErrorMsg(lobbyExtraText(pageContent, 'connectionError', 'Bağlantı hatası.'));
    } finally {
      setLoadingUser(false);
    }
  };

  const [chargeStatus, setChargeStatus] = useState<any>(null);

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    setChargeStatus(null);

    try {
      const res = await gamesApi.playWheel(wheelCode);
      if (!res.ok) {
         setSpinning(false);
         alert(res.message || lobbyExtraText(pageContent, 'playError', 'Hata oluştu.'));
         return;
      }
      
      const serverResultIndex = res.sliceIndex;
      const spins = 8; // Daha fazla dönüş daha iyi hissettirir
      const sliceAngle = 360 / wheelSlices.length;
      
      // Mevcut rotasyondan 0 noktasına tamamla + ekstra dönüşler + hedef dilime git
      const currentModRotation = rotation % 360;
      const toZero = 360 - currentModRotation;
      const targetOffset = (360 - (serverResultIndex * sliceAngle)) - (sliceAngle / 2);
      
      const additionalRotation = toZero + (spins * 360) + targetOffset;

      setRotation(prev => prev + additionalRotation);

      setTimeout(() => {
        setSpinning(false);
        setResult(res.result.label);
        setChargeStatus(res.chargeStatus);
      }, 5100);
    } catch (err) {
      setSpinning(false);
      alert(lobbyExtraText(pageContent, 'sessionError', 'Döndürme sırasında bir hata oluştu. Oturumunuz süresi dolmuş olabilir.'));
    }
  };

   return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_50%_0%,#3e2606_0%,#100902_38%,#050505_74%)] pb-10 text-zinc-200 flex flex-col items-center">
      <LobbyMobileNav active="wheel" />

      <div className="mb-4 w-full max-w-xl px-3 pt-4 text-center sm:mb-6 sm:pt-7">
         <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-[1.2rem] mx-auto bg-[linear-gradient(145deg,#f7d769,#9a6207)] border border-[#ffe69a]/70 shadow-[0_12px_38px_rgba(212,175,55,.27)] flex items-center justify-center mb-4">
           <img 
             src="https://i.ibb.co/0jKR3H02/lottery-1.png" 
             alt={pageContent.title} 
             className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,.45)]" 
           />
         </div>
         <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#f4d36f]/80">{pageContent.eyebrow}</p>
         <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.05em] text-white">{pageContent.title}</h1>
         <p className="text-sm sm:text-base text-zinc-500 font-medium mt-2">{pageContent.subtitle}</p>
      </div>

      {!playerChecked ? (
        <div className="w-full max-w-[calc(100%-1.5rem)] sm:max-w-md bg-zinc-900/50 border border-white/5 rounded-3xl p-4 sm:p-6 backdrop-blur-xl">
          <h2 className="mb-1 text-lg font-black text-white">{pageContent.formTitle}</h2>
          <p className="mb-4 text-xs font-medium leading-5 text-zinc-500">{pageContent.formDescription}</p>
          <label htmlFor="cark-username" className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
             <User size={14} aria-hidden="true" /> {pageContent.usernameLabel}
          </label>
          <input
            id="cark-username"
            type="text"
            placeholder={pageContent.usernamePlaceholder}
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
            autoComplete="username"
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 mb-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30 font-semibold"
          />
          {errorMsg && <div className="text-rose-400 text-xs font-bold mb-3">{errorMsg}</div>}
          <button 
            onClick={handleCheck}
            disabled={!username.trim() || loadingUser}
            className="w-full py-4 bg-[#d4af37] hover:bg-[#f4d36f] text-[#100b04] font-black rounded-xl transition-all disabled:opacity-50"
          >
            {loadingUser ? <Loader2 className="animate-spin mx-auto" /> : pageContent.submitButton}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-2xl px-3 flex flex-col items-center">
           
           {/* Panel ve lobi aynı SVG çarkını kullanır; uzun ödül adları otomatik satırlanır. */}
           <div className="relative mb-7 flex w-full max-w-[410px] flex-col items-center isolate sm:mb-10">
             <div className="w-[min(86vw,410px)] max-w-full">
               <WheelSvg wheel={wheelSlices} appearance={wheelAppearance} size={420} rotation={rotation} spinning={spinning} />
             </div>
             <div className="-mt-3 h-12 w-32 bg-gradient-to-b from-[#8f5b0a] via-[#382205] to-[#090704] [clip-path:polygon(27%_0,73%_0,88%_100%,12%_100%)] sm:h-14 sm:w-40" />
             <div className="-mt-1 h-3 w-44 rounded-sm border-t border-white/20 bg-gradient-to-b from-[#d4af37] via-[#7f5008] to-[#140c03] shadow-xl sm:w-52" />
           </div>
           <AnimatePresence mode="wait">
             {result ? (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9, y: 20 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 className="text-center w-full max-w-md bg-zinc-900/80 border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-xl"
               >
                  <Trophy size={40} className={cn("mx-auto mb-3", result === 'Pas' || result?.toLowerCase().includes('boş') ? 'text-zinc-500' : 'text-purple-400')} />
                  <h2 className="text-2xl font-black text-white mb-1">{result === 'Pas' || result?.toLowerCase().includes('boş') ? pageContent.emptyTitle : pageContent.successTitle}</h2>
                  <p className="text-purple-400 font-bold mb-4 text-lg">{result !== 'Pas' && !result?.toLowerCase().includes('boş') && result}</p>
                  
                  {chargeStatus && (
                    <div className={cn(
                      "mb-6 p-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold border",
                      chargeStatus.ok 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    )}>
                      {chargeStatus.ok ? (
                        <><Gift size={14} /> {pageContent.successDescription}</>
                      ) : (
                        <><AlertCircle size={14} /> {chargeStatus.message || lobbyExtraText(pageContent, 'bonusFailedText', 'Otomatik ekleme başarısız.')}</>
                      )}
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => { setResult(null); }}
                    className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-black rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                     {pageContent.successButton}
                  </button>
               </motion.div>
             ) : (
               <motion.div className="w-full max-w-sm space-y-3 sm:max-w-xs sm:space-y-4">
                 <div className="relative">
                    <input 
                      type="text"
                      placeholder={lobbyExtraText(pageContent, 'codePlaceholder', 'Varsa Çark Kodunuz')}
                      value={wheelCode}
                      onChange={e => setWheelCode(e.target.value.toUpperCase())}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30 font-bold text-center tracking-widest text-sm"
                    />
                    {wheelCode && (
                       <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <Ticket size={16} className="text-purple-500" />
                       </div>
                    )}
                 </div>
                 <button
                   type="button"
                   onClick={spin}
                   disabled={spinning}
                   aria-label={spinning ? lobbyExtraText(pageContent, 'spinningAria', 'Çark dönüyor') : lobbyExtraText(pageContent, 'spinAria', 'Çarkı çevir')}
                   className="w-full py-5 text-white font-black text-xl rounded-2xl transition-all disabled:opacity-50 disabled:grayscale hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                   style={{
                     background: `linear-gradient(90deg, ${wheelAppearance.pageAccentColor}, ${wheelAppearance.glowColor})`,
                     boxShadow: `0 0 30px ${wheelAppearance.glowColor}55`
                   }}
                 >
                    {spinning ? <Loader2 className="animate-spin mx-auto" aria-hidden="true" /> : pageContent.primaryButton}
                 </button>
               </motion.div>
             )}
           </AnimatePresence>

        </div>
      )}
    </div>
  );
}
