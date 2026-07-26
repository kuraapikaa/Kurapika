import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LobbyMobileNav } from './LobbyMobileNav';
import { hexToRgba, type LobbyPalette } from '../../lib/lobbyTheme';
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
      className="narcos-lobby relative min-h-screen overflow-x-hidden font-sans text-zinc-100"
      style={rootStyle}
    >
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0" style={backgroundStyle} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px)] bg-[size:44px_44px] opacity-50 md:bg-[size:72px_72px]" />
      </div>

      <LobbyMobileNav active={active} />

      <main
        className={cn(
          'relative z-10 mx-auto flex w-full flex-col gap-3.5 px-3 py-3.5 sm:px-5 md:gap-4 md:px-7 md:py-5',
          wide ? 'max-w-[1400px]' : 'max-w-[1100px]'
        )}
      >
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="relative overflow-hidden rounded-2xl border p-4 shadow-[0_12px_38px_rgba(0,0,0,.28)] md:p-5"
          style={{
            borderColor: hexToRgba(palette.primaryColor, 0.18),
            background: `linear-gradient(120deg, ${hexToRgba(palette.primaryColor, 0.2)}, ${hexToRgba(palette.surfaceColor, 0.9)} 55%, ${hexToRgba(palette.backgroundColor, 0.97)})`,
          }}
        >
          <div
            className="absolute -right-14 -top-16 h-40 w-40 rounded-full blur-[70px]"
            style={{ backgroundColor: hexToRgba(palette.accentColor, 0.2) }}
          />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <span
                  className="inline-flex w-max items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em]"
                  style={{
                    borderColor: hexToRgba(palette.accentColor, 0.22),
                    backgroundColor: hexToRgba(palette.accentColor, 0.12),
                    color: palette.accentColor,
                  }}
                >
                  {eyebrow}
                </span>
              )}
              <h1 className="mt-2 text-xl font-black leading-tight tracking-[-0.035em] text-white sm:text-2xl md:text-[26px]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 max-w-[65ch] text-[12px] font-medium leading-5 text-zinc-400 md:text-[13px]">
                  {subtitle}
                </p>
              )}
            </div>
            {aside && <div className="shrink-0">{aside}</div>}
          </div>
          {toolbar && <div className="relative z-10 mt-3.5">{toolbar}</div>}
        </motion.header>

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
      className={cn(
        'rounded-2xl border border-white/[0.075] bg-white/[0.032] shadow-[0_10px_32px_rgba(0,0,0,.2)] backdrop-blur-2xl',
        padded && 'p-3.5 md:p-4',
        className
      )}
    >
      {children}
    </section>
  );
}

/** Kart içi bölüm başlığı. */
export function LobbySectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 className="truncate text-[13px] font-black tracking-[-0.02em] text-white">{title}</h2>
      {action && <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">{action}</span>}
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
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2">
          {icon && <span className="shrink-0 text-zinc-500">{icon}</span>}
          <div className="min-w-0 flex-1">
            <span className="block text-[9px] font-black uppercase leading-none tracking-[0.16em] text-zinc-500">
              {label}
            </span>
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && onSubmit()}
              placeholder={placeholder}
              className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-black leading-none text-white outline-none placeholder:text-zinc-700 focus:ring-0"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !value.trim()}
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
          style={{
            background: `linear-gradient(90deg, ${palette.primaryColor}, ${palette.secondaryColor})`,
            boxShadow: `0 8px 22px ${hexToRgba(palette.primaryColor, 0.26)}`,
          }}
        >
          {submitLabel}
        </button>
      </div>
      {message && <div className="mt-2">{message}</div>}
    </LobbyCard>
  );
}
