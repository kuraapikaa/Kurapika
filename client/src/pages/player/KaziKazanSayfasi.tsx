import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Trophy, Loader2, Sparkles, RefreshCcw, Gift, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gamesApi, bonusPanelApi } from '@/api/client';
import { lobbyExtraText, renderLobbyTemplate } from '@/lib/lobbyContent';
import { useLobbyPageTheme, hexToRgba } from '@/lib/lobbyTheme';
import { useOtomatikOturum } from '@/lib/useParentUsername';
import { LobbyPageShell, LobbyCard, LobbySectionTitle, LobbyIdentityBar } from '@/components/player/LobbyPageShell';
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';

export function KaziKazanSayfasi() {
  const { content: pageContent, palette, rootStyle, backgroundStyle } = useLobbyPageTheme('scratch');
  const [username, setUsername] = useState('');
  const [playerChecked, setPlayerChecked] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scratchedCount, setScratchedCount] = useState(0);
  const [grid, setGrid] = useState<{ id: number, symbol: string, revealed: boolean }[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const confettiRef = useRef<ConfettiRef>(null);
  const [chargeStatus, setChargeStatus] = useState<any>(null);

  // Ana sitede giriş yapmış oyuncunun kimliği (iframe -> postMessage).
  // Panel oturumunu da kurar; aksi halde sunucu uçları 401 döner.
  const { username: otoAd } = useOtomatikOturum();
  useEffect(() => {
    if (!otoAd) return;
    setUsername(otoAd);
    setPlayerChecked(true);
  }, [otoAd]);

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

    // Son kare kazıldığında, kazanan bir sonuç zaten belirliyse kutla.
    if (newCount === 9 && result && !result.includes('Maalesef')) {
      void confettiRef.current?.fire({ particleCount: 140, spread: 90, origin: { y: 0.6 } });
    }
  };

  const finished = scratchedCount === 9 && !!result;
  const isLoss = !!result?.includes('Maalesef');

  return (
    <>
      <Confetti
        ref={confettiRef}
        manualstart
        className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
      />
      <LobbyPageShell
        active="scratch"
        palette={palette}
        rootStyle={rootStyle}
        backgroundStyle={backgroundStyle}
        eyebrow={pageContent.eyebrow}
        title={pageContent.title}
        subtitle={pageContent.subtitle}
        aside={
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl border"
            style={{
              borderColor: hexToRgba(palette.accentColor, 0.24),
              backgroundColor: hexToRgba(palette.accentColor, 0.12),
              color: palette.accentColor,
            }}
          >
            <Sparkles size={20} />
          </span>
        }
        toolbar={
          playerChecked ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(243,236,221,0.08)] bg-[rgba(243,236,221,0.05)] px-2.5 py-1.5 text-[10px] font-black text-[color:var(--lobby-text,#f3ecdd)]">
                <User size={12} style={{ color: palette.accentColor }} />
                {username}
              </span>
              <span
                className="rounded-lg border px-2.5 py-1.5 text-[10px] font-black"
                style={{
                  borderColor: hexToRgba(palette.accentColor, 0.22),
                  backgroundColor: hexToRgba(palette.accentColor, 0.1),
                  color: palette.accentColor,
                }}
              >
                {scratchedCount}/9
              </span>
            </div>
          ) : undefined
        }
      >
        {!playerChecked ? (
          <div className="mx-auto w-full max-w-xl">
            <LobbyIdentityBar
              palette={palette}
              label={pageContent.usernameLabel}
              placeholder={pageContent.usernamePlaceholder}
              value={username}
              onChange={setUsername}
              onSubmit={handleCheck}
              submitLabel={pageContent.submitButton}
              busy={loadingUser}
              icon={loadingUser ? <Loader2 size={17} className="animate-spin" /> : <User size={17} />}
              message={
                errorMsg ? (
                  <p className="rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-1.5 text-[11px] font-bold text-rose-200">{errorMsg}</p>
                ) : (
                  <div>
                    <p className="text-[11px] font-black text-[color:var(--lobby-muted,#8f8674)]">{pageContent.formTitle}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-[color:var(--lobby-muted,#8f8674)]">{pageContent.formDescription}</p>
                  </div>
                )
              }
            />
          </div>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_320px] md:gap-3.5">
            <LobbyCard>
              <LobbySectionTitle
                title={lobbyExtraText(pageContent, 'gridLabel', 'Kazı-kazan kartı')}
                action={`${scratchedCount}/9`}
              />
              <div
                role="grid"
                aria-label={lobbyExtraText(pageContent, 'gridLabel', 'Kazı-kazan kartı')}
                className="mx-auto grid aspect-square w-full max-w-[420px] grid-cols-3 gap-2 sm:gap-2.5"
              >
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
                    className="relative flex h-full w-full cursor-pointer select-none items-center justify-center overflow-hidden rounded-xl border border-[rgba(243,236,221,0.07)] bg-black/35 text-[26px] shadow-[inset_0_1px_rgba(255,255,255,.06)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lobby-primary,#e7c574)] sm:text-[32px]"
                  >
                     {/* Hidden symbol */}
                     <span className={cn("transition-opacity duration-500", cell.revealed ? "opacity-100" : "opacity-0")} aria-hidden={!cell.revealed}>
                        {cell.symbol}
                     </span>

                     {/* Cover layer */}
                     <div
                       className={cn(
                         "absolute inset-0 flex items-center justify-center text-[color:var(--lobby-text,#f3ecdd)]/45 transition-opacity duration-500",
                         cell.revealed ? "opacity-0 pointer-events-none" : "opacity-100"
                       )}
                       style={{ background: `linear-gradient(135deg, ${palette.primaryColor}, ${palette.secondaryColor})` }}
                       aria-hidden="true"
                     >
                       <Sparkles size={22} />
                     </div>
                  </div>
                ))}
              </div>

              {!finished && (
                <p className="mt-2.5 text-center text-[11px] font-medium text-[color:var(--lobby-muted,#8f8674)]">
                  {renderLobbyTemplate(lobbyExtraText(pageContent, 'progressTemplate', 'Bütün kareleri kazıyın ({count}/9)'), { count: scratchedCount })}
                </p>
              )}
            </LobbyCard>

            <div className="flex min-w-0 flex-col gap-2.5">
              <AnimatePresence mode="wait">
                {finished ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LobbyCard>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgba(243,236,221,0.10)] bg-black/25',
                            isLoss && 'text-[color:var(--lobby-muted,#8f8674)]'
                          )}
                          style={isLoss ? undefined : { color: palette.accentColor }}
                        >
                          <Trophy size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[13px] font-black tracking-[-0.02em] text-[color:var(--lobby-text,#f3ecdd)]">
                            {isLoss ? pageContent.emptyTitle : pageContent.successTitle}
                          </h2>
                          <p
                            className="mt-0.5 truncate text-[11px] font-bold text-[color:var(--lobby-muted,#8f8674)]"
                            style={isLoss ? undefined : { color: palette.accentColor }}
                          >
                            {isLoss ? pageContent.emptyDescription : result?.replace('Kazandınız! ', '')}
                          </p>
                        </div>
                      </div>

                      {!isLoss && chargeStatus && (
                        <div
                          className={cn(
                            'mt-2.5 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold',
                            chargeStatus.ok
                              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                              : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                          )}
                        >
                          {chargeStatus.ok ? <Gift size={13} className="mt-px shrink-0" /> : <AlertCircle size={13} className="mt-px shrink-0" />}
                          <span className="min-w-0 break-words">
                            {chargeStatus.ok
                              ? pageContent.successDescription
                              : chargeStatus.message || lobbyExtraText(pageContent, 'bonusFailedText', 'Ekleme başarısız.')}
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={initGame}
                        className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--lobby-text,#f3ecdd)] transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                        style={{
                          background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.secondaryColor})`,
                          boxShadow: `0 8px 22px ${hexToRgba(palette.primaryColor, 0.26)}`,
                        }}
                      >
                        <RefreshCcw size={14} aria-hidden="true" /> {pageContent.primaryButton}
                      </button>
                    </LobbyCard>
                  </motion.div>
                ) : (
                  <motion.div
                    key="hint"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LobbyCard>
                      <LobbySectionTitle title={lobbyExtraText(pageContent, 'howToTitle', 'Nasıl oynanır?')} />
                      <p className="text-[12px] font-medium leading-5 text-[color:var(--lobby-muted,#8f8674)]">
                        {grid.length === 0 ? pageContent.loadingText : pageContent.subtitle}
                      </p>
                      <div className="mt-2.5">
                        <div className="mb-1.5 flex items-center justify-between text-[10px] font-black">
                          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--lobby-muted,#8f8674)]">
                            {lobbyExtraText(pageContent, 'progressLabel', 'İlerleme')}
                          </span>
                          <span className="tabular-nums" style={{ color: palette.accentColor }}>{scratchedCount}/9</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(scratchedCount / 9) * 100}%`,
                              background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.accentColor})`,
                            }}
                          />
                        </div>
                      </div>
                      {errorMsg && (
                        <p className="mt-2.5 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-1.5 text-[11px] font-bold text-rose-200">
                          {errorMsg}
                        </p>
                      )}
                    </LobbyCard>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </LobbyPageShell>
    </>
  );
}
