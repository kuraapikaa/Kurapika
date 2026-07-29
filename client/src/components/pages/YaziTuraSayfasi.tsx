import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CircleDollarSign, RotateCcw, Trophy, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function YaziTuraSayfasi() {
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<'YAZI' | 'TURA' | null>(null);
  const [choice, setChoice] = useState<'YAZI' | 'TURA' | null>(null);
  const [gameState, setGameState] = useState<'idle' | 'won' | 'lost'>('idle');

  const flipCoin = () => {
    if (!choice || flipping) return;

    setFlipping(true);
    setResult(null);
    setGameState('idle');

    setTimeout(() => {
      const userWins = Math.random() < 0.10;
      const finalResult = userWins ? choice : (choice === 'YAZI' ? 'TURA' : 'YAZI');
      
      setResult(finalResult);
      setFlipping(false);
      
      if (userWins) {
        setGameState('won');
      } else {
        setGameState('lost');
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0e0c09] text-[color:var(--lobby-text,#f3ecdd)] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex items-center justify-between mb-8">
        <Link to="/lobi" className="flex items-center gap-2 text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)] transition-colors font-bold">
          <ArrowLeft size={20} /> Lobiye Dön
        </Link>
        <div className="flex items-center gap-3 bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20">
          <CircleDollarSign className="text-blue-400" />
          <span className="font-black">YAZI - TURA</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl gap-12">
        {/* Coin Animation */}
        <div className="relative w-48 h-48 md:w-64 md:h-64">
           <AnimatePresence mode="wait">
             <motion.div
               key={flipping ? 'flipping' : result || 'idle'}
               initial={{ rotateY: 0 }}
               animate={flipping ? { 
                 rotateY: [0, 180, 360, 540, 720, 900, 1080],
                 y: [0, -150, 0]
               } : { rotateY: 0 }}
               transition={flipping ? { duration: 2, ease: "easeInOut" } : { duration: 0.5 }}
               className="w-full h-full rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-8 border-amber-300/30 flex items-center justify-center shadow-[0_0_50px_rgba(251,191,36,0.3)] relative overflow-hidden"
             >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                <span className="text-5xl md:text-7xl font-black text-amber-900 select-none">
                  {flipping ? '?' : result || 'K'}
                </span>
             </motion.div>
           </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="w-full space-y-8 bg-[rgba(243,236,221,0.03)] p-8 rounded-[3rem] border border-[rgba(243,236,221,0.05)] backdrop-blur-xl">
          <div className="text-center">
             <h3 className="text-[color:var(--lobby-muted,#8f8674)] font-black uppercase tracking-widest text-sm mb-4">Seçimini Yap</h3>
             <div className="flex gap-4 justify-center">
                {['YAZI', 'TURA'].map((item) => (
                  <button
                    key={item}
                    onClick={() => !flipping && setChoice(item as any)}
                    className={`flex-1 py-4 rounded-xl font-black transition-all border ${
                      choice === item 
                        ? 'bg-blue-600 border-blue-400 text-[color:var(--lobby-text,#f3ecdd)] shadow-[0_0_20px_rgba(168,85,247,0.4)]' 
                        : 'bg-black/40 border-[rgba(243,236,221,0.05)] text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)] hover:border-[rgba(243,236,221,0.10)]'
                    }`}
                  >
                    {item}
                  </button>
                ))}
             </div>
          </div>

          <button
            onClick={flipCoin}
            disabled={!choice || flipping}
            className="w-full py-6 bg-gradient-to-r from-blue-600 to-blue-600 rounded-xl font-black text-xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
          >
            {flipping ? <RotateCcw className="animate-spin" /> : 'PARAYI AT!'}
          </button>

          {/* Result Banner */}
          <AnimatePresence>
            {gameState !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 rounded-xl flex items-center justify-center gap-4 border ${
                  gameState === 'won' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                }`}
              >
                {gameState === 'won' ? <Trophy /> : <AlertCircle />}
                <span className="text-xl font-black">
                  {gameState === 'won' ? 'KAZANDIN! TEBRİKLER!' : 'KAYBETTİN, TEKRAR DENE'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
