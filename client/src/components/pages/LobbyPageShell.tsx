import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LobbyMobileNav } from './LobbyMobileNav';
import { hexToRgba, LOBBY_TOKENS, type LobbyPalette } from '../../lib/lobbyTheme';
import { cn } from '../../lib/utils';

type PublicPage = 'bonus' | 'wheel' | 'scratch' | 'tournament' | 'prediction' | 'missions' | 'call';

interface LobbyPageShellProps {
  active?: PublicPage;
  palette: LobbyPalette;
  rootStyle: React.CSSProperties;
  backgroundStyle: React.CSSProperties;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Başlığın sağında duran içerik (durum rozeti, sayaç, aksiyon vb.). */
  aside?: ReactNode;
  /** Başlık bloğunun hemen altındaki dar şerit (sekme, filtre vb.). */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Geniş içerik (tablo/ızgara) için sayfa genişliğini artırır. */
  wide?: boolean;
}

/**
 * Lobi alt sayfalarının ortak iskeleti: tema renkleri, arka plan katmanı,
 * kompakt başlık ve navigasyon. Sayfalar yalnızca kendi içeriklerini yazar,
 * böylece 7 sayfa tek bir görsel dilde kalır ve admin teması hepsine işler.
 */
export function LobbyPageShell({
  active,
  palette,
  rootStyle,
  backgroundStyle,
  eyebrow,
  title,
  subtitle,
  aside,
  toolbar,
  children,
  wide = false,
}: LobbyPageShellProps) {
  return (
    <div
      className="narcos-lobby relative min-h-screen overflow-x-hidden font-lobby"
      style={{ ...rootStyle, color: palette.textColor }}
    >
      {/* Izgara dokusu kaldırıldı: yeni tasarımda zemin düz, derinlik yalnızca
          tepedeki altın hâleden geliyor. İki katman birlikte kirli görünüyordu. */}
      <div className="pointer-events-none fixed inset-0" style={backgroundStyle} />

      <LobbyMobileNav active={active} />

      <main
        className={cn(
          'relative z-10 mx-auto flex w-full flex-col gap-3.5 px-3 py-3.5 sm:px-5 md:gap-4 md:px-7 md:py-5',
          wide ? 'max-w-[1400px]' : 'max-w-[1100px]'
        )}
      >
        {/* Başlık artık kutu içinde değil. Mockup'ta sayfa doğrudan tipografiyle
            açılıyor; çerçeveli "hero kartı" her sayfada tekrarlanınca içerikten
            önce gelen bir gürültü katmanına dönüşüyordu. */}
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="relative flex flex-wrap items-end justify-between gap-3 pt-1"
        >
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <span
                className="block text-[10px] font-extrabold uppercase leading-none"
                style={{ letterSpacing: LOBBY_TOKENS.tracking.label, color: palette.primaryColor }}
              >
                {eyebrow}
              </span>
            )}
            <h1
              className="mt-2 text-[22px] font-black leading-[1.08] tracking-[-0.03em] sm:text-[26px] md:text-[28px]"
              style={{ color: palette.textColor }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="mt-1.5 max-w-[62ch] text-[12px] font-medium leading-5 md:text-[13px]"
                style={{ color: palette.mutedTextColor }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </motion.header>

        {/* Başlığı içerikten ayıran saç teli çizgi — kutu yerine tek kural. */}
        <div className="h-px w-full" style={{ backgroundColor: LOBBY_TOKENS.border(0.09) }} />

        {toolbar && <div className="relative z-10">{toolbar}</div>}

        {children}
      </main>
    </div>
  );
}

/** Sayfa içi standart kart. Tüm alt sayfalarda aynı yüzey dili. */
export function LobbyCard({
  className,
  children,
  padded = true,
}: {
  className?: string;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section
      className={cn('border', padded && 'p-3.5 md:p-4', className)}
      style={{
        borderRadius: LOBBY_TOKENS.radius.card,
        borderColor: LOBBY_TOKENS.border(0.09),
        // Yüzey rengi zeminden yalnızca bir tık açık; ayrım kenarlıkla kuruluyor,
        // gölge ve blur ile değil. Mockup'ın düz, baskı gibi duran dili bu.
        backgroundColor: 'rgba(243, 236, 221, 0.022)',
      }}
    >
      {children}
    </section>
  );
}

/** Kart içi bölüm başlığı. */
export function LobbySectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="truncate text-[13px] font-extrabold tracking-[-0.015em] text-[color:var(--lobby-text,#f3ecdd)]">
        {title}
      </h2>
      {action && (
        <span
          className="shrink-0 text-[9px] font-extrabold uppercase text-[color:var(--lobby-muted,#8f8674)]"
          style={{ letterSpacing: LOBBY_TOKENS.tracking.tight }}
        >
          {action}
        </span>
      )}
    </div>
  );
}

/** Oyuncu doğrulama / giriş satırı — çark, kazı-kazan ve görevlerde ortak. */
export function LobbyIdentityBar({
  palette,
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  submitLabel,
  busy = false,
  icon,
  message,
}: {
  palette: LobbyPalette;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
  icon?: ReactNode;
  message?: ReactNode;
}) {
  return (
    <LobbyCard>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div
          className="flex min-w-0 flex-1 items-center gap-2.5 border px-3 py-2"
          style={{
            borderRadius: LOBBY_TOKENS.radius.control,
            borderColor: LOBBY_TOKENS.border(0.1),
            backgroundColor: 'rgba(0, 0, 0, 0.28)',
          }}
        >
          {icon && <span className="shrink-0" style={{ color: palette.mutedTextColor }}>{icon}</span>}
          <div className="min-w-0 flex-1">
            <span
              className="block text-[9px] font-extrabold uppercase leading-none"
              style={{ letterSpacing: LOBBY_TOKENS.tracking.label, color: palette.mutedTextColor }}
            >
              {label}
            </span>
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && onSubmit()}
              placeholder={placeholder}
              className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-extrabold leading-none outline-none focus:ring-0"
              style={{ color: palette.textColor }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !value.trim()}
          className="flex h-10 shrink-0 items-center justify-center gap-2 px-5 text-[11px] font-extrabold uppercase transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
          style={{
            borderRadius: LOBBY_TOKENS.radius.control,
            letterSpacing: LOBBY_TOKENS.tracking.label,
            // Altin dolgu uzerinde koyu metin: mockup'ta birincil aksiyonun imzasi.
            background: `linear-gradient(120deg, ${palette.primaryColor}, ${palette.secondaryColor})`,
            color: '#171204',
            boxShadow: `0 8px 22px ${hexToRgba(palette.primaryColor, 0.18)}`,
          }}
        >
          {submitLabel}
        </button>
      </div>
      {message && <div className="mt-2">{message}</div>}
    </LobbyCard>
  );
}
