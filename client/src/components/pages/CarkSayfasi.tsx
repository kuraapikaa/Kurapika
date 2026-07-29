import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Loader2, Trophy, Gift, AlertCircle, Ticket } from 'lucide-react';
import { cn } from '../../lib/utils';
import { gamesApi, bonusPanelApi, ApiError } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { lobbyExtraText } from '../../lib/lobbyContent';
import { useLobbyPageTheme, hexToRgba } from '../../lib/lobbyTheme';
import { useOtomatikOturum } from '../../lib/useParentUsername';
import { fetchGamesConfigCached, readCachedGamesConfig } from '../../lib/lobbyConfigCache';
import { LobbyPageShell, LobbyCard, LobbySectionTitle, LobbyIdentityBar } from './LobbyPageShell';
import { WheelSvg } from '../admin/WheelManager';

export function CarkSayfasi() {
  const { content: pageContent, palette, rootStyle, backgroundStyle } = useLobbyPageTheme('wheel');
  const [username, setUsername] = useState('');
  const [playerChecked, setPlayerChecked] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [wheelCode, setWheelCode] = useState('');

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

  const { data: configRes } = useQuery({
    queryKey: ['games-config'],
    queryFn: fetchGamesConfigCached,
    staleTime: 0 // Her zaman en güncel ayarları çek
  });

  // Çark ilk karede doğru dilimlerle çizilsin; yanıt gelince üzerine yazılır.
  const config = configRes ?? readCachedGamesConfig();

  const wheelSlices = config?.data?.wheel || [
    { id: 1, label: 'Pas', color: 'bg-zinc-800', isLoss: true }
  ];
  const wheelAppearance = {
    rimColor: '#27272a',
    centerColor: '#27272a',
    pointerColor: '#ffffff',
    // Admin çark görünümü ayarlamadıysa lobi teması devreye girer.
    glowColor: palette.primaryColor,
    pageAccentColor: palette.accentColor,
    borderWidth: 8,
    centerSize: 52,
    labelSize: 11,
    glowStrength: 35,
    glossy: false,
    ...(configRes?.data?.wheelAppearance || {})
  };
  const [loadingUser, setLoadingUser] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [spinError, setSpinError] = useState('');

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
    setSpinError('');

    try {
      const res = await gamesApi.playWheel(wheelCode);
      if (!res.ok) {
         setSpinning(false);
         setSpinError(res.message || lobbyExtraText(pageContent, 'playError', 'Hata oluştu.'));
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
      // Sunucu sebebi zaten yazıyor ("Günlük çark hakkınızı kullandınız",
      // "Çark olasılıkları henüz etkinleştirilmemiş" ...). Her hatayı oturum
      // hatasına indirgemek oyuncuyu da bizi de yanlış yönlendiriyordu;
      // oturum metnini yalnızca gerçekten yetkisizken gösteriyoruz.
      const yetkisiz = err instanceof ApiError && err.status === 401;
      const sunucuMesaji = err instanceof ApiError ? err.message : '';
      setSpinError(
        yetkisiz || !sunucuMesaji
          ? lobbyExtraText(pageContent, 'sessionError', 'Döndürme sırasında bir hata oluştu. Oturumunuz süresi dolmuş olabilir.')
          : sunucuMesaji
      );
    }
  };

  const isLoss = result === 'Pas' || !!result?.toLowerCase().includes('boş');

  return (
    <LobbyPageShell
      active="wheel"
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
          <Trophy size={20} />
        </span>
      }
      toolbar={
        playerChecked ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-black text-white">
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
              {spinning ? pageContent.loadingText : lobbyExtraText(pageContent, 'readyBadge', 'Çevirmeye hazır')}
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
                  <p className="text-[11px] font-black text-zinc-400">{pageContent.formTitle}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-zinc-600">{pageContent.formDescription}</p>
                </div>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_320px] md:gap-3.5">
          {/* Panel ve lobi aynı SVG çarkını kullanır; uzun ödül adları otomatik satırlanır. */}
          <LobbyCard className="flex items-center justify-center">
            <div className="w-full max-w-[400px] px-1.5 py-2">
              <WheelSvg wheel={wheelSlices} appearance={wheelAppearance} size={420} rotation={rotation} spinning={spinning} />
            </div>
          </LobbyCard>

          <div className="flex min-w-0 flex-col gap-2.5">
            <AnimatePresence mode="wait">
              {result ? (
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
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/25',
                          isLoss && 'text-zinc-500'
                        )}
                        style={isLoss ? undefined : { color: palette.accentColor }}
                      >
                        <Trophy size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[13px] font-black tracking-[-0.02em] text-white">
                          {isLoss ? pageContent.emptyTitle : pageContent.successTitle}
                        </h2>
                        <p className="mt-0.5 truncate text-[11px] font-bold text-zinc-500" style={isLoss ? undefined : { color: palette.accentColor }}>
                          {isLoss ? pageContent.emptyDescription : result}
                        </p>
                      </div>
                    </div>

                    {chargeStatus && (
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
                            : chargeStatus.message || lobbyExtraText(pageContent, 'bonusFailedText', 'Otomatik ekleme başarısız.')}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => { setResult(null); }}
                      className="mt-2.5 flex h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-[11px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      {pageContent.successButton}
                    </button>
                  </LobbyCard>
                </motion.div>
              ) : (
                <motion.div
                  key="controls"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <LobbyCard>
                    <LobbySectionTitle title={lobbyExtraText(pageContent, 'controlsTitle', 'Çarkı Çevir')} />

                    <label
                      htmlFor="cark-code"
                      className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500"
                    >
                      <Ticket size={12} aria-hidden="true" />
                      {lobbyExtraText(pageContent, 'codeLabel', 'Çark kodu')}
                    </label>
                    <div className="relative">
                      <input
                        id="cark-code"
                        type="text"
                        placeholder={lobbyExtraText(pageContent, 'codePlaceholder', 'Varsa Çark Kodunuz')}
                        value={wheelCode}
                        onChange={e => setWheelCode(e.target.value.toUpperCase())}
                        className="h-10 w-full rounded-xl border border-white/[0.07] bg-black/30 px-3 pr-9 text-center text-[13px] font-black tracking-[0.14em] text-white outline-none transition placeholder:tracking-normal placeholder:text-zinc-700 focus:border-[color:var(--lobby-primary)]/60"
                      />
                      {wheelCode && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: palette.accentColor }}>
                          <Ticket size={14} />
                        </span>
                      )}
                    </div>

                    {spinError && (
                      <p className="mt-2 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-1.5 text-[11px] font-bold text-rose-200">
                        {spinError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={spin}
                      disabled={spinning}
                      aria-label={spinning ? lobbyExtraText(pageContent, 'spinningAria', 'Çark dönüyor') : lobbyExtraText(pageContent, 'spinAria', 'Çarkı çevir')}
                      className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[12px] font-black uppercase tracking-[0.16em] text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                      style={{
                        background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.secondaryColor})`,
                        boxShadow: `0 8px 22px ${hexToRgba(palette.primaryColor, 0.26)}`,
                      }}
                    >
                      {spinning ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : pageContent.primaryButton}
                    </button>

                    <p className="mt-2 text-[11px] font-medium leading-4 text-zinc-600">
                      {spinning ? pageContent.loadingText : pageContent.formDescription}
                    </p>
                  </LobbyCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </LobbyPageShell>
  );
}
