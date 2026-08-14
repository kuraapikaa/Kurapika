import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Hand, Scissors, Square, Gamepad2, Trophy, Frown, Equal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';

type Choice = 'TAS' | 'KAGIT' | 'MAKAS';

export function TasKagitMakasSayfasi() {
  const [userChoice, setUserChoice] = useState<Choice | null>(null);
  const [compChoice, setCompChoice] = useState<Choice | null>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost' | 'draw'>('idle');
  const confettiRef = useRef<ConfettiRef>(null);

  const choices: { id: Choice, icon: any, color: string }[] = [
    { id: 'TAS', icon: Square, color: 'from-[rgba(243,236,221,0.28)] to-[rgba(243,236,221,0.14)]' },
    { id: 'KAGIT', icon: Hand, color: 'from-blue-400 to-blue-600' },
    { id: 'MAKAS', icon: Scissors, color: 'from-rose-400 to-rose-600' },
  ];

  const play = (choice: Choice) => {
    setGameState('playing');
    setUserChoice(choice);
    setCompChoice(null);

    setTimeout(() => {
      const userWins = Math.random() < 0.10;
      let randomComp: Choice;

      if (userWins) {
        // Force win
        if (choice === 'TAS') randomComp = 'MAKAS';
        else if (choice === 'KAGIT') randomComp = 'TAS';
        else randomComp = 'KAGIT';
        setGameState('won');
        void confettiRef.current?.fire({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } else {
        // Force loss (to maintain exactly 25% win rate)
        if (choice === 'TAS') randomComp = 'KAGIT';
        else if (choice === 'KAGIT') randomComp = 'MAKAS';
        else randomComp = 'TAS';
        setGameState('lost');
      }

      setCompChoice(randomComp);
    }, 1000);
  };

  return (
    <>
      <Confetti
        ref={confettiRef}
        manualstart
        className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
      />
      <div className="min-h-screen bg-[#0e0c09] text-[color:var(--lobby-text,#f3ecdd)] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex items-center justify-between mb-12">
        <Link to="/lobi" className="flex items-center gap-2 text-[color:var(--lobby-muted,#8f8674)] hover:text-[color:var(--lobby-text,#f3ecdd)] transition-colors font-bold">
          <ArrowLeft size={20} /> Lobiye Dön
        </Link>
        <div className="flex items-center gap-3 bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20">
          <Gamepad2 className="text-blue-400" />
          <span className="font-black">TAŞ - KAĞIT - MAKAS</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl gap-16">
        {/* Battle Arena */}
        <div className="grid grid-cols-2 gap-8 md:gap-24 w-full relative">
           <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
              <span className="text-8xl md:text-[12rem] font-black text-[color:var(--lobby-text,#f3ecdd)]/5 uppercase select-none">VS</span>
           </div>

           {/* User Side */}
           <div className="flex flex-col items-center gap-6 z-10">
              <span className="text-xs font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest">Senin Seçimin</span>
              <div className={`w-32 h-32 md:w-48 md:h-48 rounded-[2.5rem] flex items-center justify-center border-4 ${userChoice ? 'bg-[rgba(243,236,221,0.03)] border-[rgba(243,236,221,0.10)]' : 'bg-transparent border-dashed border-[rgba(243,236,221,0.09)]'}`}>
                 {userChoice && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><ChoiceIcon type={userChoice!} /></motion.div>}
              </div>
           </div>

           {/* Comp Side */}
           <div className="flex flex-col items-center gap-6 z-10">
              <span className="text-xs font-black text-[color:var(--lobby-muted,#8f8674)] uppercase tracking-widest">Bilgisayar</span>
              <div className={`w-32 h-32 md:w-48 md:h-48 rounded-[2.5rem] flex items-center justify-center border-4 ${compChoice ? 'bg-[rgba(243,236,221,0.03)] border-[rgba(243,236,221,0.10)]' : 'bg-transparent border-dashed border-[rgba(243,236,221,0.09)]'}`}>
                 {gameState === 'playing' ? (
                   <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                 ) : compChoice && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><ChoiceIcon type={compChoice!} /></motion.div>
                 )}
              </div>
           </div>
        </div>

        {/* Game Status */}
        <div className="h-20 flex items-center justify-center">
           <AnimatePresence mode="wait">
              {gameState !== 'idle' && gameState !== 'playing' && (
                <motion.div
                  key={gameState}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex flex-col items-center gap-2 ${
                    gameState === 'won' ? 'text-emerald-500' : gameState === 'lost' ? 'text-rose-500' : 'text-[color:var(--lobby-muted,#8f8674)]'
                  }`}
                >
                   <div className="flex items-center gap-3 text-3xl md:text-5xl font-black italic tracking-tighter">
                      {gameState === 'won' && <><Trophy size={48} /> KAZANDIN!</>}
                      {gameState === 'lost' && <><Frown size={48} /> KAYBETTİN!</>}
                      {gameState === 'draw' && <><Equal size={48} /> BERABERE!</>}
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>

        {/* Choice Buttons */}
        <div className="w-full max-w-3xl grid grid-cols-3 gap-4 md:gap-8">
           {choices.map((item) => (
             <button
               key={item.id}
               onClick={() => gameState !== 'playing' && play(item.id)}
               className={`group flex flex-col items-center gap-4 p-6 rounded-[2.5rem] bg-[rgba(243,236,221,0.03)] border border-[rgba(243,236,221,0.05)] transition-all hover:bg-[rgba(243,236,221,0.03)] hover:border-[rgba(243,236,221,0.10)] ${gameState === 'playing' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 shadow-xl'}`}
             >
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-[color:var(--lobby-text,#f3ecdd)] shadow-lg group-hover:shadow-2xl transition-all`}>
                   <item.icon size={32} />
                </div>
                <span className="text-[10px] font-black text-[color:var(--lobby-muted,#8f8674)] group-hover:text-[color:var(--lobby-text,#f3ecdd)] uppercase tracking-widest">{item.id}</span>
             </button>
           ))}
        </div>
      </div>
      </div>
    </>
  );
}

function ChoiceIcon({ type }: { type: Choice }) {
  if (type === 'TAS') return <Square size={64} className="text-[color:var(--lobby-muted,#8f8674)]" />;
  if (type === 'KAGIT') return <Hand size={64} className="text-blue-500" />;
  return <Scissors size={64} className="text-rose-500" />;
}
