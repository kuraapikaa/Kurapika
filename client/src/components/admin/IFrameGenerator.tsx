import { useState, useEffect } from 'react';
import {
  Code2, Copy, Monitor, Smartphone, ExternalLink, Check,
  RotateCcw, Settings2, Layout, Gamepad2, Ticket, Trophy,
  Globe, ChevronLeft, ChevronRight, RefreshCw, Phone, Handshake,
  Star, Swords, Scissors, Info, Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

type DeviceMode = 'desktop' | 'mobile';

interface EmbedConfig {
  type: string;
  width: string;
  height: string;
  borderRadius: string;
  border: boolean;
  shadow: boolean;
  scrolling: boolean;
}

const cssLength = (value: string, fallback: string, numericUnit = 'px') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return fallback;
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}${numericUnit}` : trimmed;
};

const boundedPx = (value: string, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const PAGES = [
  { id: 'lobi',          label: 'Oyun Lobisi',    path: '/lobi',              icon: Layout,   color: 'text-indigo-400', badge: 'Popüler' },
  { id: 'cark',          label: 'Şans Çarkı',     path: '/cark',              icon: RotateCcw, color: 'text-amber-400' },
  { id: 'kazi-kazan',    label: 'Kazı Kazan',     path: '/kazi-kazan',        icon: Ticket,   color: 'text-orange-400' },
  { id: 'yazi-tura',     label: 'Yazı Tura',      path: '/yazi-tura',         icon: Swords,   color: 'text-cyan-400' },
  { id: 'tas-kagit',     label: 'Taş Kağıt Makas',path: '/tas-kagit-makas',  icon: Scissors, color: 'text-pink-400' },
  { id: 'bonus-talep',   label: 'Bonus Talep',    path: '/bonus-talep',       icon: Gamepad2, color: 'text-emerald-400' },
  { id: 'turnuva',       label: 'Günlük Turnuva', path: '/turnuva/gunluk',    icon: Trophy,   color: 'text-purple-400' },
  { id: 'beni-ara',      label: 'Beni Ara',       path: '/beni-ara',          icon: Phone,    color: 'text-sky-400' },
  { id: 'ortaklik',      label: 'Ortaklık',       path: '/ortaklik',          icon: Handshake,color: 'text-rose-400' },
  { id: 'sadakat',       label: 'Sadakat',        path: '/sadakat',           icon: Star,     color: 'text-yellow-400' },
];

/* ── Phone Mockup ─────────────────────────────────────────────── */
function PhoneShell({ url, config }: { url: string; config: EmbedConfig }) {
  const [key, setKey] = useState(0);

  return (
    <div className="flex flex-col items-center gap-10 py-8">
      {/* Phone body */}
      <div className="relative select-none" style={{ width: 334, height: 686 }}>
        {/* Outer shell */}
        <div className="absolute inset-0" style={{
          borderRadius: 50,
          background: 'linear-gradient(160deg, #222236 0%, #10101e 60%, #0d0d1a 100%)',
          boxShadow: [
            '0 0 0 1px rgba(255,255,255,0.09)',
            'inset 0 0 0 1px rgba(255,255,255,0.04)',
            '0 60px 120px -20px rgba(0,0,0,0.9)',
            '0 0 80px rgba(100,100,255,0.05)',
          ].join(','),
        }} />

        {/* Highlight edge */}
        <div className="absolute inset-0 rounded-[50px] pointer-events-none" style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)',
        }} />

        {/* Side buttons */}
        <div className="absolute rounded-[2px]" style={{ left: -3, top: 92, width: 3, height: 22, background: '#0a0a16' }} />
        <div className="absolute rounded-[2px]" style={{ left: -3, top: 128, width: 3, height: 38, background: '#0a0a16' }} />
        <div className="absolute rounded-[2px]" style={{ left: -3, top: 176, width: 3, height: 38, background: '#0a0a16' }} />
        <div className="absolute rounded-[2px]" style={{ right: -3, top: 148, width: 3, height: 56, background: '#0a0a16' }} />

        {/* Screen */}
        <div className="absolute overflow-hidden" style={{ inset: 13, borderRadius: 38, background: '#000' }}>
          {/* Status bar */}
          <div className="relative flex items-center justify-between px-7 bg-black" style={{ height: 44 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>9:41</span>
            {/* Dynamic Island */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[7px] bg-black rounded-full"
              style={{ width: 118, height: 34, border: '1px solid rgba(255,255,255,0.07)' }} />
            {/* Right icons */}
            <div className="flex items-center gap-[5px]">
              {/* Signal */}
              <svg width="17" height="12" fill="none" viewBox="0 0 17 12">
                <rect x="0" y="6" width="3" height="6" rx="1" fill="white" />
                <rect x="4.5" y="4" width="3" height="8" rx="1" fill="white" />
                <rect x="9" y="2" width="3" height="10" rx="1" fill="white" />
                <rect x="13.5" y="0" width="3" height="12" rx="1" fill="white" fillOpacity="0.35" />
              </svg>
              {/* WiFi */}
              <svg width="16" height="12" fill="none" viewBox="0 0 20 14">
                <circle cx="10" cy="13" r="2" fill="white" />
                <path d="M4.5 8C6.4 6.1 13.6 6.1 15.5 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M1.5 5C4.3 2.2 15.7 2.2 18.5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.4" />
              </svg>
              {/* Battery */}
              <svg width="25" height="13" fill="none" viewBox="0 0 25 13">
                <rect x="0.5" y="0.5" width="21" height="12" rx="3.5" stroke="white" strokeOpacity="0.3" />
                <rect x="2" y="2" width="15" height="9" rx="2" fill="white" />
                <path d="M23 4.5v4c.9-.4 1.5-1.2 1.5-2s-.6-1.6-1.5-2z" fill="white" fillOpacity="0.4" />
              </svg>
            </div>
          </div>

          {/* Actual iframe */}
          <iframe
            key={key}
            src={url}
            className="w-full block"
            scrolling={config.scrolling ? 'yes' : 'no'}
            style={{
              height: 'calc(100% - 44px - 34px)',
              border: config.border ? '1px solid rgba(255,255,255,0.12)' : 'none',
              borderRadius: `${boundedPx(config.borderRadius, 16, 0, 40)}px`,
              boxShadow: config.shadow ? '0 18px 45px -18px rgba(0,0,0,0.85)' : 'none',
              overflow: config.scrolling ? 'auto' : 'hidden',
            }}
            title="Mobile Preview"
          />

          {/* Home indicator */}
          <div className="flex items-center justify-center bg-black" style={{ height: 34 }}>
            <div style={{ width: 130, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.22)' }} />
          </div>
        </div>
      </div>

      {/* Refresh */}
      <button
        type="button"
        aria-label="Önizlemeyi yenile"
        onClick={() => setKey(k => k + 1)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        <RefreshCw size={12} aria-hidden="true" /> Önizlemeyi Yenile
      </button>
    </div>
  );
}

/* ── Desktop Browser Mockup ───────────────────────────────────── */
function DesktopBrowser({ url, config }: { url: string; config: EmbedConfig }) {
  const [key, setKey] = useState(0);
  const viewH = boundedPx(config.height, 500, 200, 2000);
  const radius = boundedPx(config.borderRadius, 16, 0, 40);
  const previewWidth = cssLength(config.width, '100%');

  return (
    <div className="w-full overflow-hidden" style={{
      width: previewWidth,
      maxWidth: '100%',
      margin: '0 auto',
      borderRadius: `${radius}px`,
      border: config.border ? '1px solid rgba(255,255,255,0.09)' : 'none',
      boxShadow: config.shadow ? '0 30px 80px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)' : 'none',
    }}>
      {/* Browser chrome */}
      <div style={{ background: '#141422', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Tab row */}
        <div className="flex items-end px-3 pt-2.5 gap-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Active tab */}
          <div className="flex items-center gap-2 px-3.5 py-2 text-xs text-zinc-200 font-medium max-w-[200px] min-w-0 relative"
            style={{ background: '#0e0e1c', borderRadius: '8px 8px 0 0', border: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid #0e0e1c', marginBottom: -1 }}>
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: 'rgba(99,102,241,0.5)' }} />
            <span className="truncate">Gömülü İçerik</span>
            <span className="ml-1 text-zinc-600 hover:text-white cursor-pointer flex-shrink-0">×</span>
          </div>
          <div className="mb-0.5 ml-1 flex h-6 w-6 items-center justify-center rounded-full text-sm text-zinc-600 hover:text-zinc-400 cursor-pointer">+</div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-3 h-3 rounded-full cursor-pointer transition-brightness hover:brightness-125" style={{ background: '#ff5f57' }} />
            <div className="w-3 h-3 rounded-full cursor-pointer transition-brightness hover:brightness-125" style={{ background: '#febc2e' }} />
            <div className="w-3 h-3 rounded-full cursor-pointer transition-brightness hover:brightness-125" style={{ background: '#28c840' }} />
          </div>
          {/* Nav */}
          <div className="flex items-center text-zinc-600 flex-shrink-0">
            <button type="button" aria-label="Geri" className="p-1 hover:bg-white/5 rounded transition-colors"><ChevronLeft size={15} aria-hidden="true" /></button>
            <button type="button" aria-label="İleri" className="p-1 hover:bg-white/5 rounded transition-colors"><ChevronRight size={15} aria-hidden="true" /></button>
          </div>
          {/* Address bar */}
          <div className="flex flex-1 items-center gap-2 px-3 py-1.5 rounded-lg min-w-0"
            style={{ background: '#0a0a18', border: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Lock icon */}
            <svg width="11" height="13" fill="none" viewBox="0 0 11 13" className="flex-shrink-0">
              <rect x="0.5" y="5.5" width="10" height="7" rx="1.5" fill="none" stroke="#34d399" strokeWidth="1" />
              <path d="M2.5 5.5V4a3 3 0 0 1 6 0v1.5" stroke="#34d399" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] font-mono truncate flex-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{url}</span>
            <button type="button" aria-label="Yenile" onClick={() => setKey(k => k + 1)} className="flex-shrink-0 text-zinc-600 hover:text-white transition-colors">
              <RefreshCw size={11} aria-hidden="true" />
            </button>
          </div>
          {/* Open in new tab */}
          <a href={url} target="_blank" rel="noreferrer"
            className="flex-shrink-0 p-1.5 rounded-lg text-zinc-600 hover:text-white transition-colors hover:bg-white/5">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Viewport */}
      <div style={{ height: viewH, background: '#000', overflow: config.scrolling ? 'auto' : 'hidden' }}>
        <iframe
          key={key}
          src={url}
          className="w-full h-full border-none"
          scrolling={config.scrolling ? 'yes' : 'no'}
          style={{ display: 'block', overflow: config.scrolling ? 'auto' : 'hidden' }}
          title="Desktop Preview"
        />
      </div>
    </div>
  );
}

/* ── Toggle ───────────────────────────────────────────────────── */
function Toggle({ checked, onChange, accent = 'indigo' }: { checked: boolean; onChange: (v: boolean) => void; accent?: string }) {
  const bg = checked ? (accent === 'indigo' ? '#6366f1' : '#10b981') : 'rgba(255,255,255,0.08)';
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="relative flex-shrink-0 transition-colors"
      style={{ width: 38, height: 22, borderRadius: 11, background: bg }}
    >
      <span className="absolute top-[3px] rounded-full bg-white shadow transition-transform"
        style={{ left: checked ? 19 : 3, width: 16, height: 16 }} />
    </button>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
export function IFrameGenerator() {
  const [config, setConfig] = useState<EmbedConfig>({
    type: 'lobi', width: '100%', height: '700',
    borderRadius: '16', border: true, shadow: true, scrolling: false,
  });
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => { setBaseUrl(window.location.origin); }, []);

  const selectedPage = PAGES.find(p => p.id === config.type) || PAGES[0];
  const embedUrl = `${baseUrl}/#${selectedPage.path}`;
  const iframeWidth = cssLength(config.width, '100%');
  const iframeHeight = cssLength(config.height, '700px');
  const iframeHeightAttr = String(boundedPx(config.height, 700, 200, 2000));
  const iframeRadius = boundedPx(config.borderRadius, 16, 0, 40);

  const generatedCode = `<iframe
  src="${embedUrl}"
  width="${config.width}"
  height="${iframeHeightAttr}"
  style="
    width: ${iframeWidth};
    height: ${iframeHeight};
    max-width: 100%;
    display: block;
    border: ${config.border ? '1px solid rgba(255,255,255,0.1)' : 'none'};
    border-radius: ${iframeRadius}px;
    ${config.shadow ? 'box-shadow: 0 20px 40px rgba(0,0,0,0.4);' : ''}
    overflow: ${config.scrolling ? 'auto' : 'hidden'};
  "
  scrolling="${config.scrolling ? 'yes' : 'no'}"
  frameborder="0"
  allowfullscreen
></iframe>`;

  const handleCopy = (type: 'code' | 'url') => {
    navigator.clipboard.writeText(type === 'code' ? generatedCode : embedUrl);
    setCopied(type);
    toast.success(type === 'code' ? 'Embed kodu kopyalandı!' : 'URL kopyalandı!');
    setTimeout(() => setCopied(null), 2000);
  };

  const set = (patch: Partial<EmbedConfig>) => setConfig(c => ({ ...c, ...patch }));

  return (
    <div className="w-full space-y-6 p-4 md:p-6 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">iFrame Entegrasyon Merkezi</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Oyunları kendi platformunuza gömmek için hazır kod üreticisi</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border"
          style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
          <Info size={13} /> Gerçek zamanlı önizleme
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── Config Panel ── */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(18,18,30,0.7)' }}>
            <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
              <Settings2 size={17} className="text-indigo-400" />
              <h2 className="text-sm font-black text-white">Yapılandırma</h2>
            </div>

            <div className="p-5 space-y-6">
              {/* Page selector */}
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2.5">Gömülecek Sayfa</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {PAGES.map(page => {
                    const Icon = page.icon;
                    const active = config.type === page.id;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set({ type: page.id })}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50',
                          active
                            ? 'text-white'
                            : 'text-zinc-500 hover:text-zinc-300',
                        )}
                        style={active ? {
                          background: 'rgba(99,102,241,0.12)',
                          border: '1px solid rgba(99,102,241,0.25)',
                        } : {
                          background: 'rgba(0,0,0,0.15)',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <Icon size={15} className={active ? page.color : 'text-zinc-600'} aria-hidden="true" />
                        <span className="text-[13px] font-bold flex-1">{page.label}</span>
                        {page.badge && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                            {page.badge}
                          </span>
                        )}
                        {active && (
                          <Check size={13} className="text-indigo-400 flex-shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Size (only relevant for desktop) */}
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2.5">Boyutlar</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="iframe-width" className="text-[10px] text-zinc-600 mb-1 block">Genişlik</label>
                    <input
                      id="iframe-width"
                      type="text"
                      value={config.width}
                      onChange={e => set({ width: e.target.value })}
                      placeholder="100% veya 1200"
                      className="w-full text-sm font-mono text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="iframe-height" className="text-[10px] text-zinc-600 mb-1 block">Yükseklik (px)</label>
                    <input
                      id="iframe-height"
                      type="number"
                      value={config.height}
                      onChange={e => set({ height: e.target.value })}
                      min="200"
                      max="2000"
                      className="w-full text-sm font-mono text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Style */}
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2.5">Stil</p>
                <div className="space-y-2.5">
                  {/* Border radius */}
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <label htmlFor="iframe-radius" className="text-[13px] font-medium text-zinc-300 shrink-0">Köşe yumuşatma</label>
                    <div className="flex items-center gap-2">
                      <input
                        id="iframe-radius"
                        type="range" min="0" max="40"
                        value={config.borderRadius}
                        onChange={e => set({ borderRadius: e.target.value })}
                        aria-valuetext={`${config.borderRadius}px`}
                        className="w-16 sm:w-20 accent-indigo-500"
                      />
                      <span className="text-xs font-bold text-zinc-500 w-9 text-right" aria-hidden="true">{config.borderRadius}px</span>
                    </div>
                  </div>

                  {/* Toggles */}
                  {[
                    { key: 'border' as const, label: 'Kenarlık' },
                    { key: 'shadow' as const, label: 'Gölge' },
                    { key: 'scrolling' as const, label: 'Kaydırma çubuğu' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-[13px] font-medium text-zinc-300">{item.label}</span>
                      <Toggle checked={config[item.key]} onChange={v => set({ [item.key]: v })} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="lg:col-span-8 space-y-5">
          {/* Preview card */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(18,18,30,0.7)' }}>
            {/* Preview header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
              <div className="flex items-center gap-2.5">
                <ExternalLink size={16} className="text-sky-400" aria-hidden="true" />
                <h2 className="text-sm font-black text-white">Canlı Önizleme</h2>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" /> CANLI
                </span>
              </div>

              {/* Device toggle */}
              <div role="group" aria-label="Görünüm modu" className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  type="button"
                  aria-pressed={device === 'desktop'}
                  onClick={() => setDevice('desktop')}
                  className={cn('flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50', device === 'desktop' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400')}
                  style={device === 'desktop' ? { background: 'rgba(99,102,241,0.2)', boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.3)' } : {}}
                >
                  <Monitor size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">Masaüstü</span>
                </button>
                <button
                  type="button"
                  aria-pressed={device === 'mobile'}
                  onClick={() => setDevice('mobile')}
                  className={cn('flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50', device === 'mobile' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400')}
                  style={device === 'mobile' ? { background: 'rgba(99,102,241,0.2)', boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.3)' } : {}}
                >
                  <Smartphone size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">Mobil</span>
                </button>
              </div>
            </div>

            {/* Preview area */}
            <AnimatePresence mode="wait">
              {device === 'desktop' ? (
                <motion.div
                  key="desktop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="p-4 md:p-6"
                  style={{ background: 'linear-gradient(to bottom, #080d14, #060a11)' }}
                >
                  {/* Ambient blobs */}
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-b-2xl">
                    <div style={{ position: 'absolute', top: '5%', right: '10%', width: '30%', aspectRatio: '1', borderRadius: '50%', background: 'rgba(99,102,241,0.06)', filter: 'blur(80px)' }} />
                    <div style={{ position: 'absolute', bottom: '5%', left: '5%', width: '25%', aspectRatio: '1', borderRadius: '50%', background: 'rgba(16,185,129,0.05)', filter: 'blur(80px)' }} />
                  </div>
                  <div className="relative">
                    <DesktopBrowser url={embedUrl} config={config} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="mobile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="relative flex justify-center overflow-hidden"
                  style={{ background: 'linear-gradient(to bottom, #060a11, #040810)', minHeight: 820 }}
                >
                  {/* Ambient */}
                  <div className="pointer-events-none absolute inset-0">
                    <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 300, height: 300, borderRadius: '50%', background: 'rgba(99,102,241,0.07)', filter: 'blur(100px)' }} />
                  </div>
                  <div className="relative">
                    <PhoneShell url={embedUrl} config={config} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* URL bar at bottom */}
            <div className="flex items-center gap-2 px-4 sm:px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}>
              <Globe size={13} className="text-zinc-600 flex-shrink-0" aria-hidden="true" />
              <span className="flex-1 text-[11px] font-mono truncate text-zinc-500 min-w-0">{embedUrl}</span>
              <button
                type="button"
                aria-label={copied === 'url' ? 'URL kopyalandı' : 'URL kopyala'}
                onClick={() => handleCopy('url')}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: copied === 'url' ? '#34d399' : '#71717a' }}
              >
                {copied === 'url' ? <Check size={11} aria-hidden="true" /> : <Link2 size={11} aria-hidden="true" />}
                <span className="hidden sm:inline">{copied === 'url' ? 'Kopyalandı' : 'Kopyala'}</span>
              </button>
              <a href={embedUrl} target="_blank" rel="noreferrer"
                aria-label="Sayfayı yeni sekmede aç"
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <ExternalLink size={11} aria-hidden="true" />
                <span className="hidden sm:inline">Aç</span>
              </a>
            </div>
          </div>

          {/* Code panel */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(18,18,30,0.7)' }}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
              <div className="flex items-center gap-2.5">
                <Code2 size={16} className="text-emerald-400" />
                <h2 className="text-sm font-black text-white">Embed Kodu</h2>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>HTML</span>
              </div>
              <button
                onClick={() => handleCopy('code')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={copied === 'code'
                  ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#a1a1aa' }}
              >
                {copied === 'code' ? <Check size={14} /> : <Copy size={14} />}
                {copied === 'code' ? 'Kopyalandı!' : 'Kopyala'}
              </button>
            </div>

            <div className="p-5">
              {/* Fake syntax highlighting with background */}
              <div className="relative rounded-xl overflow-hidden" style={{ background: '#070a10', border: '1px solid rgba(255,255,255,0.05)' }}>
                {/* Line numbers */}
                <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col items-end pr-2 pt-4 gap-[1px] pointer-events-none select-none"
                  style={{ background: 'rgba(0,0,0,0.2)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  {generatedCode.split('\n').map((_, i) => (
                    <span key={i} className="text-[11px] font-mono leading-5 text-zinc-700">{i + 1}</span>
                  ))}
                </div>
                <textarea
                  readOnly
                  value={generatedCode}
                  className="w-full resize-none bg-transparent pl-14 pr-4 py-4 text-[12px] font-mono leading-5 focus:outline-none"
                  style={{ color: '#93c5fd', minHeight: 180 }}
                  rows={generatedCode.split('\n').length + 1}
                />
              </div>

              {/* Info note */}
              <div className="mt-4 flex gap-3 items-start px-4 py-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                <Info size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] leading-relaxed font-medium" style={{ color: 'rgba(253,230,138,0.6)' }}>
                  <span className="text-amber-400 font-black uppercase text-[10px] tracking-widest block mb-1">Önemli</span>
                  Kodu sitenizin herhangi bir HTML bölümüne yapıştırın. İçerik sitenizle tam uyumlu çalışacak şekilde optimize edilmiştir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
