import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Trophy, Loader2, Sparkles, RefreshCcw, Gift, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { gamesApi, bonusPanelApi } from '../../api/client';
import { LobbyMobileNav } from './LobbyMobileNav';
import { lobbyExtraText, renderLobbyTemplate, useLobbyPageContent } from '../../lib/lobbyContent';

export function KaziKazanSayfasi() {
  const { content: pageContent } = useLobbyPageContent('scratch');
  const [username, setUsername] = useState('');
  const [playerChecked, setPlayerChecked] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scratchedCount, setScratchedCount] = useState(0);
  const [grid, setGrid] = useState<{ id: number, symbol: string, revealed: boolean }[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [chargeStatus, setChargeStatus] = useState<any>(null);

  // Oturum kontrolü
  useEffect(() => {
    bonusPanelApi.me().then(res => {
      if (res.ok) {
        setUsername(res.login);
        setPlayerChecked(true);
      }
    });
  }, []);

  const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣'];

  const initGame = async () => {
    // Generate 9 random symbols. We will call the backend first to see if they win.
    // However, to avoid waiting on screen load after login, we do it now.
    setErrorMsg('');
    try {
      const res = await gamesApi.playScratch();
      if (!res.ok) {
        setErrorMsg(res.message || lobbyExtraText(pageContent, 'playError', 'Hata oluştu.'));
        setPlayerChecked(false);
        return;
      }
      
      const isWin = res.won;
      const reward = res.reward;
      setChargeStatus(res.chargeStatus);
      
      let finalSymbols: string[] = [];
      if (isWin) {
         // Guarantee 3 matches
         const winSymbol = symbols[Math.floor(Math.random() * symbols.length)];
         finalSymbols = Array(9).fill('');
         
         // Pick 3 random spots for the winning symbol
         let indices = [0,1,2,3,4,5,6,7,8];
         for(let i=0; i<3; i++) {
           const idx = Math.floor(Math.random() * indices.length);
           const pPos = indices.splice(idx, 1)[0];
           finalSymbols[pPos] = winSymbol;
         }
         
         // Fill rest randomly without making 3 matches of anything else
         for(let i=0; i<finalSymbols.length; i++){
           if(!finalSymbols[i]) finalSymbols[i] = symbols[Math.floor(Math.random() * symbols.length)];
         }
         
         setResult(`Kazandınız! ${reward?.label || ''}`);
      } else {
         // Guarantee loss (no 3 matches)
         finalSymbols = Array(9).fill('');
         for(let i=0; i<9; i++){
            // keep it simple, just rotate symbols or ensure no 3 match
            finalSymbols[i] = symbols[i % symbols.length];
         }
         // shuffle
         finalSymbols.sort(() => Math.random() - 0.5);
         setResult('Maalesef Kazanamadınız');
      }

      const newGrid = finalSymbols.map((sym, i) => ({
        id: i,
        symbol: sym,
        revealed: false
      }));
      setGrid(newGrid);
      setScratchedCount(0);
    } catch {
       setErrorMsg(lobbyExtraText(pageContent, 'startError', 'Oyun başlatılamadı.'));
       setPlayerChecked(false);
    }
  };

  useEffect(() => {
    if (playerChecked) {
      initGame();
    }
  }, [playerChecked]);

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

  const scratch = (index: number) => {
    if (scratchedCount >= 9) return; // all scratched
    const newGrid = [...grid];
    if (newGrid[index].revealed) return;
    
    newGrid[index].revealed = true;
    setGrid(newGrid);
    
    const newCount = scratchedCount + 1;
    setScratchedCount(newCount);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_50%_0%,#3f2504_0%,#100802_40%,#050505_72%)] pb-10 text-zinc-200 flex flex-col items-center">
      <LobbyMobileNav active="scratch" />

      <div className="w-full max-w-xl px-3 pt-6 mb-5 text-center sm:px-4 sm:pt-10 sm:mb-9">
         <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] mx-auto bg-[linear-gradient(145deg,#f7d769,#9a6207)] border border-[#ffe69a]/70 shadow-[0_12px_38px_rgba(212,175,55,.27)] flex items-center justify-center mb-4">
           <img 
             src="https://i.ibb.co/d4fMJ7wW/ticket-1.png" 
             alt={pageContent.title} 
             className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,.45)]" 
           />
         </div>
         <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-orange-300/80">{pageContent.eyebrow}</p>
         <h1 className="text-4xl sm:text-5xl font-black tracking-[-0.05em] text-white">{pageContent.title}</h1>
         <p className="text-sm sm:text-base text-zinc-500 font-medium mt-2">{pageContent.subtitle}</p>
      </div>

      {!playerChecked ? (
        <div className="w-full max-w-[calc(100%-1.5rem)] sm:max-w-md bg-zinc-900/50 border border-white/5 rounded-3xl p-4 sm:p-6 backdrop-blur-xl">
          <h2 className="mb-1 text-lg font-black text-white">{pageContent.formTitle}</h2>
          <p className="mb-4 text-xs font-medium leading-5 text-zinc-500">{pageContent.formDescription}</p>
          <label htmlFor="kazi-username" className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
             <User size={14} aria-hidden="true" /> {pageContent.usernameLabel}
          </label>
          <input
            id="kazi-username"
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
            className="w-full py-4 bg-[#d4af37] hover:bg-[#f4d36f] text-black font-black rounded-xl transition-all disabled:opacity-50"
          >
            {loadingUser ? <Loader2 className="animate-spin mx-auto" /> : pageContent.submitButton}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xl px-3 flex flex-col items-center">
           
           {/* Scratch Grid */}
           <div role="grid" aria-label={lobbyExtraText(pageContent, 'gridLabel', 'Kazı-kazan kartı')} className="grid grid-cols-3 gap-3 w-full max-w-[520px] aspect-square mb-5 sm:mb-8 p-3 sm:p-5 bg-[linear-gradient(145deg,#1d1205,#090807)] border border-[#d4af37]/30 rounded-[2rem] shadow-[0_22px_70px_rgba(0,0,0,.55)]">
             {grid.map((cell, i) => (
                <div
                  key={cell.id}
                  role="gridcell"
                  tabIndex={cell.revealed ? -1 : 0}
                  aria-label={cell.revealed
                    ? renderLobbyTemplate(lobbyExtraText(pageContent, 'revealedCellTemplate', 'Sembol: {symbol}'), { symbol: cell.symbol })
                    : renderLobbyTemplate(lobbyExtraText(pageContent, 'unrevealedCellTemplate', 'Kare {index}: kazınmadı'), { index: i + 1 })}
                  aria-pressed={cell.revealed}
                  onClick={() => scratch(i)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && scratch(i)}
                  className="relative w-full h-full rounded-[1.35rem] overflow-hidden cursor-pointer bg-black/50 border border-[#d4af37]/15 shadow-[inset_0_1px_rgba(255,255,255,.1)] flex items-center justify-center text-3xl sm:text-4xl select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                >
                   {/* Hidden symbol */}
                   <span className={cn("transition-opacity duration-500", cell.revealed ? "opacity-100" : "opacity-0")} aria-hidden={!cell.revealed}>
                      {cell.symbol}
                   </span>

                   {/* Cover layer */}
                   <div className={cn(
                     "absolute inset-0 bg-gradient-to-br from-[#f4d36f] to-[#9a701a] transition-opacity duration-500 flex items-center justify-center text-orange-200/50",
                     cell.revealed ? "opacity-0 pointer-events-none" : "opacity-100"
                   )} aria-hidden="true">
                     <Sparkles size={24} />
                   </div>
                </div>
             ))}
           </div>

           <AnimatePresence mode="wait">
             {scratchedCount === 9 && result && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9, y: 20 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 className="text-center w-full bg-zinc-900/80 border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-xl"
               >
                  <Trophy size={40} className={cn("mx-auto mb-3", result.includes('Maalesef') ? 'text-zinc-500' : 'text-[#f4d36f]')} />
                  <h2 className="text-2xl font-black text-white mb-2">{result.includes('Maalesef') ? pageContent.emptyTitle : pageContent.successTitle}</h2>
                  <p className="text-[#f4d36f] font-bold mb-4 text-sm">{result.replace('Kazandınız! ', '')}</p>
                  
                  {!result.includes('Maalesef') && chargeStatus && (
                    <div className={cn(
                      "mb-6 p-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold border",
                      chargeStatus.ok 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    )}>
                      {chargeStatus.ok ? (
                        <><Gift size={14} /> {pageContent.successDescription}</>
                      ) : (
                        <><AlertCircle size={14} /> {chargeStatus.message || lobbyExtraText(pageContent, 'bonusFailedText', 'Ekleme başarısız.')}</>
                      )}
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={initGame}
                    className="w-full py-3 bg-orange-500/20 text-[#f4d36f] hover:bg-orange-500/30 font-black rounded-xl transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/50"
                  >
                     <RefreshCcw size={16} aria-hidden="true" /> {pageContent.primaryButton}
                  </button>
               </motion.div>
             )}
           </AnimatePresence>

           {scratchedCount < 9 && (
              <p className="text-zinc-500 font-medium">{renderLobbyTemplate(lobbyExtraText(pageContent, 'progressTemplate', 'Bütün kareleri kazıyın ({count}/9)'), { count: scratchedCount })}</p>
           )}

        </div>
      )}
    </div>
  );
}
