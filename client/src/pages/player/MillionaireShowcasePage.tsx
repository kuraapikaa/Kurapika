import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Crown, ExternalLink, Film, Loader2, Play, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { gamesApi } from '@/api/client';
import { cn } from '@/lib/utils';
import { lobbyExtraText, useLobbyPageContent } from '@/lib/lobbyContent';

type MillionaireRecord = {
  id: string;
  title: string;
  amount: string;
  player: string;
  game: string;
  imageUrl?: string;
  posterUrl?: string;
  videoUrl?: string;
  featured?: boolean;
};

type MillionaireShowcaseConfig = {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  showTicker: boolean;
  showSocial: boolean;
  disclaimer: string;
  socialLinks: Array<{ id: string; label: string; url: string }>;
  records: MillionaireRecord[];
};

const DEFAULT_MILLIONAIRE_SHOWCASE: MillionaireShowcaseConfig = {
  isActive: true,
  eyebrow: 'Büyük Kazanç Vitrini',
  title: 'Büyük kazanç anları burada parlıyor',
  description: 'Öne çıkan kazanç kayıtlarını, video anlarını ve yüksek ödül hikayelerini tek ekranda keşfet.',
  ctaLabel: 'Kazancı izle',
  showTicker: true,
  showSocial: false,
  disclaimer: '18+ Sorumlu oyun. Görseller ve videolar yalnızca izinli içeriklerle kullanılmalıdır.',
  socialLinks: [],
  records: [
    { id: 'win-1', title: 'Gates of Olympus Super Scatter', amount: '₺1.210.512', player: 'A***', game: 'Gates of Olympus Super Scatter', imageUrl: '/assets/millionaires/gates-super-scatter.jpg', posterUrl: '/assets/millionaires/gates-super-scatter.jpg', videoUrl: 'https://www.ppreplaylink.net/uHS0jHVp4K', featured: false },
    { id: 'win-2', title: 'Big Bass Bonanza Keeping it Reel', amount: '₺1.441.075', player: 'M***', game: 'Big Bass Bonanza Keeping it Reel', imageUrl: '/assets/millionaires/big-bass-bonanza-keeping-it-reel.jpg', posterUrl: '/assets/millionaires/big-bass-bonanza-keeping-it-reel.jpg', videoUrl: 'https://www.ppreplaylink.net/WKReDGMLaU', featured: false },
    { id: 'win-3', title: 'Gates of Olympus 1000', amount: '₺750.000', player: 'D***', game: 'Gates of Olympus 1000', imageUrl: '/assets/millionaires/gates-olympus-1000.jpg', posterUrl: '/assets/millionaires/gates-olympus-1000.jpg', videoUrl: 'https://www.ppreplaylink.net/iIrVagzrdf', featured: false },
    { id: 'win-4', title: 'Big Bass Splash 1000', amount: '₺853.100', player: 'S***', game: 'Big Bass Splash 1000', imageUrl: '/assets/millionaires/big-bass-splash-1000.jpg', posterUrl: '/assets/millionaires/big-bass-splash-1000.jpg', videoUrl: 'https://www.ppreplaylink.net/i7RehODsPE', featured: false },
    { id: 'win-5', title: 'Gates of Olympus', amount: '₺2.000.000', player: 'K***', game: 'Gates of Olympus', imageUrl: '/assets/millionaires/gates-of-olympus.jpg', posterUrl: '/assets/millionaires/gates-of-olympus.jpg', videoUrl: 'https://www.ppreplaylink.net/NJLIpRw4zW', featured: false },
    { id: 'win-6', title: 'Gates of Olympus Super Scatter', amount: '₺714.000', player: 'B***', game: 'Gates of Olympus Super Scatter', imageUrl: '/assets/millionaires/gates-super-scatter.jpg', posterUrl: '/assets/millionaires/gates-super-scatter.jpg', videoUrl: 'https://www.ppreplaylink.net/QS1MfZnC7m', featured: false },
    { id: 'win-7', title: 'Starlight Princess 1000', amount: '₺2.400.000', player: 'E***', game: 'Starlight Princess 1000', imageUrl: '/assets/millionaires/starlight-princess-1000.png', posterUrl: '/assets/millionaires/starlight-princess-1000.png', videoUrl: 'https://www.ppreplaylink.net/JnpZlOPrAs', featured: false },
    { id: 'win-8', title: 'Fruit Party 2', amount: '₺1.240.680', player: 'C***', game: 'Fruit Party 2', imageUrl: '/assets/millionaires/fruit-party-2.jpg', posterUrl: '/assets/millionaires/fruit-party-2.jpg', videoUrl: 'https://www.ppreplaylink.net/gQh1zRCTJ9', featured: false },
    { id: 'win-9', title: '5 Lion Megaways 2', amount: '₺785.600', player: 'N***', game: '5 Lion Megaways 2', imageUrl: '/assets/millionaires/five-lion-megaways-2.jpg', posterUrl: '/assets/millionaires/five-lion-megaways-2.jpg', videoUrl: 'https://www.ppreplaylink.net/OW87vpJrGw', featured: false },
    { id: 'win-10', title: 'Sweet Bonanza 1000', amount: '₺1.041.540', player: 'R***', game: 'Sweet Bonanza 1000', imageUrl: '/assets/millionaires/sweet-bonanza-1000.jpg', posterUrl: '/assets/millionaires/sweet-bonanza-1000.jpg', videoUrl: 'https://www.ppreplaylink.net/uk1hsdQgHv', featured: false },
    { id: 'win-11', title: 'Gates of Olympus Super Scatter', amount: '₺1.010.880', player: 'T***', game: 'Gates of Olympus Super Scatter', imageUrl: '/assets/millionaires/gates-super-scatter.jpg', posterUrl: '/assets/millionaires/gates-super-scatter.jpg', videoUrl: 'https://www.ppreplaylink.net/iQhLCif2fg', featured: false },
    { id: 'win-12', title: 'Gates of Olympus 1000', amount: '₺920.000', player: 'Y***', game: 'Gates of Olympus 1000', imageUrl: '/assets/millionaires/gates-olympus-1000.jpg', posterUrl: '/assets/millionaires/gates-olympus-1000.jpg', videoUrl: 'https://www.ppreplaylink.net/ERReI97g6O', featured: false },
    { id: 'win-13', title: 'Gates of Olympus 1000', amount: '₺890.000', player: 'L***', game: 'Gates of Olympus 1000', imageUrl: '/assets/millionaires/gates-olympus-1000.jpg', posterUrl: '/assets/millionaires/gates-olympus-1000.jpg', videoUrl: 'https://www.ppreplaylink.net/FnVwxwwxP5', featured: false },
    { id: 'win-14', title: 'Gates of Olympus Dice', amount: '₺670.000', player: 'O***', game: 'Gates of Olympus Dice', imageUrl: '/assets/millionaires/gates-olympus-dice.png', posterUrl: '/assets/millionaires/gates-olympus-dice.png', videoUrl: 'https://www.ppreplaylink.net/eOFqvpmbEX', featured: false },
    { id: 'win-15', title: 'Gates of Olympus Super Scatter', amount: '₺1.650.000', player: 'P***', game: 'Gates of Olympus Super Scatter', imageUrl: '/assets/millionaires/gates-super-scatter.jpg', posterUrl: '/assets/millionaires/gates-super-scatter.jpg', videoUrl: 'https://www.ppreplaylink.net/JCbwwa0426', featured: false },
    { id: 'win-16', title: 'Sugar Rush 1000', amount: '₺4.059.260', player: 'Z***', game: 'Sugar Rush 1000', imageUrl: '/assets/millionaires/sugar-rush-1000.png', posterUrl: '/assets/millionaires/sugar-rush-1000.png', videoUrl: 'https://www.ppreplaylink.net/k9lhEUotSu', featured: true },
    { id: 'win-17', title: 'Gems Bonanza', amount: '₺612.500', player: 'G***', game: 'Gems Bonanza', imageUrl: '/assets/millionaires/gems-bonanza.png', posterUrl: '/assets/millionaires/gems-bonanza.png', videoUrl: 'https://www.ppreplaylink.net/UPq8prHGoF', featured: false },
  ],
};

function normalizeMillionaireShowcase(config?: Partial<MillionaireShowcaseConfig>): MillionaireShowcaseConfig {
  return {
    ...DEFAULT_MILLIONAIRE_SHOWCASE,
    ...(config || {}),
    records: Array.isArray(config?.records) && config.records.length > 0
      ? config.records
      : DEFAULT_MILLIONAIRE_SHOWCASE.records,
    socialLinks: Array.isArray(config?.socialLinks) ? config.socialLinks : DEFAULT_MILLIONAIRE_SHOWCASE.socialLinks,
  };
}

function parseShowcaseAmount(amount: string) {
  return Number(String(amount || '').replace(/[^\d]/g, '')) || 0;
}

function formatShowcaseCurrency(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

function isDirectVideoUrl(url?: string) {
  return Boolean(url && /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url));
}

export function MillionaireShowcasePage() {
  const { content: pageContent } = useLobbyPageContent('millionaires');
  const [config, setConfig] = useState<MillionaireShowcaseConfig>(DEFAULT_MILLIONAIRE_SHOWCASE);
  const [activeVideo, setActiveVideo] = useState<MillionaireRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gamesApi.config()
      .then((res) => setConfig(normalizeMillionaireShowcase(res?.data?.millionaires)))
      .catch(() => setConfig(DEFAULT_MILLIONAIRE_SHOWCASE))
      .finally(() => setLoading(false));
  }, []);

  const records = config.records.filter((record) => record.title || record.amount);
  const featured = records.find((record) => record.featured) || records[0];
  const totalAmount = records.reduce((sum, record) => sum + parseShowcaseAmount(record.amount), 0);
  const highestAmount = Math.max(...records.map((record) => parseShowcaseAmount(record.amount)), 0);
  const socialLinks = config.socialLinks.filter((link) => link.url);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0e0c09] pb-20 font-lobby text-[color:var(--lobby-text,#f3ecdd)] selection:bg-amber-300/25">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(251,191,36,.18),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(20,184,166,.12),transparent_34%),linear-gradient(180deg,#05060a,#080911_55%,#05060a)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:54px_54px] opacity-45" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-3 py-4 sm:px-5 md:px-8 md:py-7">
        <header className="flex items-center justify-between gap-3">
          <Link to="/lobi" className="inline-flex h-11 items-center gap-2 rounded-xl border border-[rgba(243,236,221,0.10)] bg-[rgba(243,236,221,0.045)] px-4 text-xs font-black uppercase tracking-[0.12em] text-[color:var(--lobby-text,#f3ecdd)]">
            <ArrowLeft size={16} />
            {lobbyExtraText(pageContent, 'backButton', pageContent.secondaryButton)}
          </Link>
          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200/15 bg-[color:var(--lobby-primary,#e7c574)]/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
            <Crown size={14} />
            {pageContent.label}
          </div>
        </header>

        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="animate-spin text-amber-200" size={34} />
          </div>
        ) : !config.isActive || records.length === 0 || !featured ? (
 <section className="cam-panel flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
            <Crown className="mb-4 text-[color:var(--lobby-muted,#8f8674)]" size={42} />
            <h1 className="text-3xl font-black tracking-[-0.05em] text-[color:var(--lobby-text,#f3ecdd)]">{pageContent.emptyTitle}</h1>
            <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-[color:var(--lobby-muted,#8f8674)]">
              {pageContent.emptyDescription}
            </p>
          </section>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[2rem] border border-amber-200/15 bg-[#07080d]"
          >
            {config.showTicker && (
              <div className="border-b border-amber-200/10 bg-amber-300/[0.06] py-2">
                <div className="millionaire-marquee flex items-center gap-6 whitespace-nowrap px-5">
                  {[...records, ...records].map((record, index) => (
                    <div key={`${record.id}-${index}`} className="inline-flex items-center gap-2 text-xs font-black text-[color:var(--lobby-muted,#8f8674)]">
                      <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.75)]" />
                      <span className="text-[color:var(--lobby-text,#f3ecdd)]">{record.player || 'Oyuncu'}</span>
                      <span className="text-amber-200">{record.amount}</span>
                      <span className="rounded-md bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)]">{record.game || record.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_430px]">
              <div className="relative overflow-hidden bg-[linear-gradient(135deg,#15100a_0%,#090a10_48%,#05060a_100%)] p-5 sm:p-6 md:p-8">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
                <div className="relative z-10 max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-[color:var(--lobby-primary,#e7c574)]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-amber-100">
                    <Crown size={13} />
                    {config.eyebrow || pageContent.eyebrow}
                  </div>
                  <h1 className="mt-4 max-w-2xl text-3xl font-black sm:text-4xl leading-[0.95] tracking-[-0.06em] text-[color:var(--lobby-text,#f3ecdd)] md:text-6xl">
                    {config.title || pageContent.title}
                  </h1>
                  <p className="mt-5 max-w-2xl text-sm font-semibold leading-6 text-[color:var(--lobby-muted,#8f8674)] md:text-base md:leading-7">
                    {config.description || pageContent.subtitle}
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <ShowcaseStat label="Toplam vitrin" value={formatShowcaseCurrency(totalAmount)} />
                    <ShowcaseStat label="Kayıt" value={records.length} />
                    <ShowcaseStat label="En yüksek" value={formatShowcaseCurrency(highestAmount)} />
                  </div>

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                    {featured.videoUrl ? (
                      <button
                        type="button"
                        onClick={() => setActiveVideo(featured)}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[color:var(--lobby-primary,#e7c574)] px-5 text-xs font-black uppercase tracking-[0.14em] text-[#171204] shadow-[0_18px_45px_rgba(252,211,77,.16)] transition active:scale-[0.98]"
                      >
                        <Play size={16} className="fill-current" />
                        {config.ctaLabel || pageContent.primaryButton}
                      </button>
                    ) : (
                      <span className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[rgba(243,236,221,0.10)] bg-[rgba(243,236,221,0.045)] px-5 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--lobby-muted,#8f8674)]">
                        <Film size={16} />
                        Video URL bekleniyor
                      </span>
                    )}
                    <span className="text-xs font-semibold leading-5 text-[color:var(--lobby-muted,#8f8674)]">{config.disclaimer}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[rgba(243,236,221,0.10)] bg-black/25 p-4 lg:border-l lg:border-t-0 md:p-5">
 <div className="cam h-full p-3">
                  <ShowcaseVisual record={featured} large />
                  <div className="mt-4 rounded-xl border border-[rgba(243,236,221,0.10)] bg-black/30 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--lobby-muted,#8f8674)]">Rekor kayıt</p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black text-[color:var(--lobby-text,#f3ecdd)]">{featured.title}</h3>
                        <p className="mt-1 truncate text-xs font-bold text-[color:var(--lobby-muted,#8f8674)]">{featured.player} · {featured.game}</p>
                      </div>
                      <p className="shrink-0 text-2xl font-black tracking-[-0.04em] text-amber-100">{featured.amount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-[rgba(243,236,221,0.10)] bg-[#06070b] p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4 md:p-5">
              {records.map((record) => (
                <ShowcaseRecordCard
                  key={record.id}
                  record={record}
                  ctaLabel={config.ctaLabel}
                  onPlay={() => setActiveVideo(record)}
                />
              ))}
            </div>

            {(config.showSocial && socialLinks.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(243,236,221,0.10)] bg-black/20 px-4 py-3 md:px-5">
                {socialLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[rgba(243,236,221,0.10)] bg-[rgba(243,236,221,0.04)] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-text,#f3ecdd)]"
                  >
                    {link.label}
                    <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            )}
          </motion.section>
        )}
      </main>

      {activeVideo?.videoUrl && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-[rgba(243,236,221,0.10)] bg-[#080a10]">
            <div className="flex items-center justify-between gap-3 border-b border-[rgba(243,236,221,0.10)] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[color:var(--lobby-text,#f3ecdd)]">{activeVideo.title}</p>
                <p className="truncate text-xs font-bold text-[color:var(--lobby-muted,#8f8674)]">{activeVideo.player} · {activeVideo.amount}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                aria-label="Videoyu kapat"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(243,236,221,0.10)] bg-[rgba(243,236,221,0.04)] text-[color:var(--lobby-text,#f3ecdd)]"
              >
                <X size={18} />
              </button>
            </div>
            {isDirectVideoUrl(activeVideo.videoUrl) ? (
              <video
                src={activeVideo.videoUrl}
                poster={activeVideo.posterUrl || activeVideo.imageUrl}
                controls
                autoPlay
                className="aspect-video w-full bg-black object-contain"
              />
            ) : (
              <iframe
                src={activeVideo.videoUrl}
                title={activeVideo.title}
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
                className="aspect-video w-full bg-black"
              />
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes millionaire-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .millionaire-marquee {
          animation: millionaire-marquee 55s linear infinite;
        }
      `}</style>
    </div>
  );
}

function ShowcaseVisual({ record, large = false }: { record: MillionaireRecord; large?: boolean }) {
  const image = record.posterUrl || record.imageUrl;

  return (
    <div className={cn(
      'relative overflow-hidden rounded-[1.25rem] border border-[rgba(243,236,221,0.10)] bg-[#0b0d13]',
      large ? 'aspect-[4/5] md:aspect-[3/4]' : 'aspect-[4/5]'
    )}>
      {image ? (
        <img src={image} alt={record.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center justify-center bg-[linear-gradient(135deg,rgba(251,191,36,.18),rgba(20,184,166,.10)_46%,rgba(168,85,247,.12))] p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-amber-200/20 bg-black/35 text-amber-200">
            <Trophy size={32} />
          </div>
          <p className="mt-4 max-w-[14rem] text-sm font-black uppercase tracking-[0.08em] text-[color:var(--lobby-text,#f3ecdd)]">{record.title}</p>
        </div>
      )}
      {record.videoUrl && (
        <div className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--lobby-primary,#e7c574)] text-[#171204]">
          <Play size={16} className="fill-current" />
        </div>
      )}
    </div>
  );
}

function ShowcaseStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[rgba(243,236,221,0.10)] bg-black/25 p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--lobby-muted,#8f8674)]">{label}</p>
      <p className="mt-1 truncate text-xl font-black tracking-[-0.04em] text-[color:var(--lobby-text,#f3ecdd)] md:text-2xl">{value}</p>
    </div>
  );
}

function ShowcaseRecordCard({
  record,
  ctaLabel,
  onPlay
}: {
  record: MillionaireRecord;
  ctaLabel: string;
  onPlay: () => void;
}) {
  return (
 <div className="cam group overflow-hidden p-3">
      <ShowcaseVisual record={record} />
      <div className="mt-3 space-y-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-[color:var(--lobby-text,#f3ecdd)]">{record.title}</h3>
          <p className="mt-1 truncate text-[11px] font-bold text-[color:var(--lobby-muted,#8f8674)]">{record.player} · {record.game}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-xl font-black tracking-[-0.04em] text-amber-100">{record.amount}</p>
          {record.videoUrl ? (
            <button
              type="button"
              onClick={onPlay}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[color:var(--lobby-primary,#e7c574)] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#171204] transition active:scale-[0.98]"
            >
              <Play size={12} className="fill-current" />
              {ctaLabel}
            </button>
          ) : (
            <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(243,236,221,0.10)] bg-black/25 px-3 text-[10px] font-black uppercase tracking-[0.1em] text-[color:var(--lobby-muted,#8f8674)]">
              Video yok
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
