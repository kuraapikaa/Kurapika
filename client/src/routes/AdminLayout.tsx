/**
 * ADMIN KABUGU: sol menu + ust bar + calisma alani.
 *
 * Layout rotasi oldugu icin sayfalar arasi gezinirken YENIDEN MONTE
 * EDILMEZ; menunun kaydirma konumu, daraltilmis hali ve arama kutusu
 * gezinme boyunca korunur. Eskiden ayni islevi `App.tsx` icindeki dev bir
 * kosullu blok goruyordu ve her sey tek bilesende ic ice duruyordu.
 *
 * Baslik, aciklama, tarih filtresi ve yetki bilgisi rotanin kendi
 * kaydindan (`routeMeta`) okunuyor.
 */
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { matchesTr } from '@/lib/turkishSearch';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/LoadingState';
import { DateRangeBar } from '@/components/DateRangeBar';
import { DateRangePresets } from '@/components/DateRangePresets';
import { NotificationCenter } from '@/components/NotificationCenter';
import { GlobalNotifications } from '@/components/GlobalNotifications';
import { useDateRange } from '@/context/DateRangeContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { buildNavGroups, findRouteMeta } from './routeMeta';
import { useOturum } from './RequireAuth';

const adminDateLabel = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(new Date());

// Menu ogesi hap. Aktif olan neon mor bir yuzeyle ayrilir.
const tabStyle = (isActive: boolean) =>
  `group relative flex min-h-10 items-center gap-3 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors duration-150 touch-manipulation ${
    isActive ? 'text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
  }`;

const ActiveTabIndicator = () => (
  <motion.div
    layoutId="activeTab"
    className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/30 to-purple-500/[0.06] shadow-[0_0_24px_rgba(168,85,247,0.25)]"
  />
);

/** Panonun bes sorgusunu tazeler. Pano acik olmasa da ust bardan cagrilir. */
function panoyuTazele(queryClient: ReturnType<typeof useQueryClient>) {
  for (const anahtar of ['summary', 'partner-profit', 'top-sports', 'top-casino', 'sportbook-overview']) {
    queryClient.invalidateQueries({ queryKey: [anahtar] });
  }
}

export function AdminLayout() {
  const location = useLocation();
  const pathname = location.pathname || '/';
  const meta = findRouteMeta(pathname);
  const panodayiz = meta?.id === 'dashboard';

  const { kullanici, siteAdi, kiraciAnahtari, cikisYap } = useOturum();
  /*
   * Kimlik cozulemezse MARKA ADINA DUSULMUYOR.
   *
   * Once oyle yapiliyordu ve sonucu su oldu: rozet her kiracida
   * "Arwen Software Solutions" yazip hangi sitede olundugunu
   * soylemiyordu -- rozetin tek isi buyken. Sunucu artik son care olarak
   * kiraci anahtarini bile donduruyor; buraya bos deger gelmesi ancak
   * kiraci kaydi hic okunamazsa mumkun ve o zaman dogru cevap "bilmiyorum".
   */
  const gosterilenSite = siteAdi || 'Site belirlenemedi';

  /*
   * Verilerin gerçekten okunduğu kiracı anahtarı ipucuda yazıyor.
   *
   * Site adı ile anahtar ayrışabiliyor: env yöneticisiyle girildiğinde
   * oturumda `tenantId` olmadığı için anahtar `default` çözülüyor ve ad
   * host'tan geliyor. "Hangi kiracının verisini görüyorum" sorusunun
   * kesin cevabı anahtar; rozetin üstüne gelince görünüyor.
   */
  const rozetIpucu = kiraciAnahtari
    ? `${gosterilenSite} · kiracı: ${kiraciAnahtari}`
    : gosterilenSite;
  const kullaniciAdi = String(kullanici?.name || kullanici?.username || '').trim();
  /**
   * Rozet harfleri site adindan tureiyor; sabit "AS" degil.
   * Tek kelimelik adlarda ("Tacobahis") ilk IKI harf aliniyor -- tek
   * harf rozette bosluk gibi duruyordu.
   */
  const rozetHarfleri = (() => {
    const kelimeler = gosterilenSite.split(/\s+/).filter(Boolean);
    if (kelimeler.length === 0) return '?';
    const ham = kelimeler.length === 1
      ? kelimeler[0].slice(0, 2)
      : kelimeler.slice(0, 2).map((kelime: string) => kelime[0]).join('');
    return ham.toLocaleUpperCase('tr-TR') || '?';
  })();
  const { dateRange, setDateRange } = useDateRange();
  const queryClient = useQueryClient();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 28 menü öğesi 6 grupta; sabit 224px her ekranda yer kaplıyordu ve daraltma
  // yoktu. Rail modu tercihi oturumlar arası korunur.
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem('admin_nav_collapsed') === '1'; } catch { return false; }
  });
  const [navQuery, setNavQuery] = useState('');

  /**
   * Panonun sorgularini YALNIZCA ONBELLEKTEN okur (`enabled: false`).
   * "Son guncelleme" damgasi her sekmede gorunuyor ama veriyi pano sayfasi
   * cekiyor; buradan ikinci bir istek cikmamali.
   */
  const panoSorgulari = useDashboardData(dateRange, { enabled: false });
  const panoYukleniyor = panoSorgulari.some((q) => q.isLoading);
  const panoGuncellemeAni = Math.max(0, ...panoSorgulari.map((q) => Number(q.dataUpdatedAt || 0)));
  const panoGuncellemeSaati = panoGuncellemeAni > 0
    ? new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(panoGuncellemeAni))
    : '—';

  const handleRefreshDashboard = useCallback(() => panoyuTazele(queryClient), [queryClient]);

  const sidebarNavRef = useRef<HTMLDivElement>(null);
  const handleSidebarKeyDown = useCallback((e: React.KeyboardEvent) => {
    const container = sidebarNavRef.current;
    if (!container) return;
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));
    if (links.length === 0) return;
    const current = document.activeElement as HTMLAnchorElement | null;
    const idx = current && links.includes(current) ? links.indexOf(current) : -1;
    if (e.key === 'ArrowDown' && idx < links.length - 1) {
      e.preventDefault();
      links[idx + 1].focus();
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      links[idx - 1].focus();
    }
  }, []);

  const visibleNavGroups = useMemo(() => buildNavGroups(kullanici), [kullanici]);

  // Hızlı menü araması. 28 öğe taramayı yavaşlatıyordu; Türkçe karakterler
  // için locale-aware karşılaştırma (İ/ı sorunu için toLocaleLowerCase).
  const filteredNavGroups = useMemo(() => {
    const q = navQuery.trim();
    if (!q) return visibleNavGroups;
    return visibleNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => matchesTr(item.nav.label, q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [visibleNavGroups, navQuery]);

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('admin_nav_collapsed', next ? '1' : '0'); } catch { /* yoksay */ }
      if (next) setNavQuery('');
      return next;
    });
  }, []);

  const hasDateFilters = !!meta?.dateFilters;

  return (
    <motion.div
      key="main-app"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="app-shell"
    >
      <div className="app-backdrop" />

      {/* Mobil sidebar overlay */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden"
        style={{ opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none' }}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        // 29 menu ogesi 7 grupta; 200px'te uzun etiketler kirpiliyordu
        // ("Lynon API Dökümanı", "iFrame entegrasyonu"). 260px hepsini
        // tek satirda tutuyor.
        style={{ ['--nav-w' as any]: navCollapsed ? '80px' : '288px' }}
        className={cn(
          "premium-sidebar fixed left-0 top-0 z-50 flex h-full w-[288px] flex-col transition-[transform,width] duration-200 ease-out md:w-[var(--nav-w)] md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="sidebar-brand relative flex shrink-0 flex-col items-center gap-2.5 px-5 py-5">
          {/*
            CONTROL SUITE ISARETI.

            Gorsel KENDI cercevesini tasiyor: yuvarlak kosesi, kenar
            cizgisi ve parlamasi ilustrasyonun parcasi. Onceden bir de
            yuvarlak kapsul icine konuyordu ve iki cerceve ust uste
            biniyordu -- isaret "bir kutunun icine sikistirilmis" gibi
            duruyordu. Kapsul kaldirildi, gorsel oldugu gibi duruyor.

            Duzen de dikey: isaret ustte, ad altta. Yatay dizilimde
            13px'lik ad dar kolonda kirpiliyordu.
          */}
          <img
            src="/assets/brand/arwen-mark-azure.png"
            alt="Arwen Software Solutions"
            className={cn(
              'suite-mark shrink-0 select-none transition-[width,height] duration-200',
              navCollapsed ? 'md:h-10 md:w-10' : 'h-14 w-14',
            )}
            draggable={false}
          />
          <span className={cn('min-w-0 text-center leading-tight', navCollapsed && 'md:hidden')}>
            <strong className="block truncate text-[13px] font-bold tracking-[-0.02em] text-white">Arwen Software Solutions</strong>
            <small className="mt-0.5 block truncate text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-600">Control Suite</small>
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden absolute right-3 top-3 flex items-center justify-center w-7 h-7 rounded-full text-zinc-500 hover:text-white transition-colors"
            aria-label="Menüyü kapat"
          >
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={toggleNavCollapsed}
            aria-expanded={!navCollapsed}
            aria-label={navCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            title={navCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            className="absolute right-3 top-3 hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            {navCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        {!navCollapsed && (
          <div className="shrink-0 px-3 pt-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder="Menüde ara"
                aria-label="Menüde ara"
                className="h-10 w-full rounded-full border border-white/[0.05] bg-white/[0.02] pl-9 pr-3 text-[12px] font-medium text-white outline-none transition placeholder:text-slate-600 focus:border-blue-300/40"
              />
            </div>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4" aria-label="Menü">
          <div ref={sidebarNavRef} className="space-y-4" onKeyDown={handleSidebarKeyDown} role="menu">
            {filteredNavGroups.length === 0 && (
              <p className="px-2 py-4 text-center text-[11px] text-slate-600">Eşleşen menü yok.</p>
            )}
            {filteredNavGroups.map((group) => (
              <section key={group.label} className="sidebar-nav-group">
                {/*
                  * Daraltilmis modda grup adi gizleniyordu ve 29 oge
                  * tek bir simge yiginina donuyordu. Artik yerine ince
                  * bir ayirici geliyor; gruplar dar modda da okunuyor.
                  */}
                <p className={cn("sidebar-section-label flex items-center gap-2", navCollapsed && "md:hidden")}>
                  <span>{group.label}</span>
                  <span className="h-px flex-1 bg-white/[0.05]" />
                  <span className="tabular-nums text-[9px] font-semibold text-slate-700">{group.items.length}</span>
                </p>
                {navCollapsed && <span className="mx-auto mb-2 hidden h-px w-6 bg-white/[0.07] md:block" />}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.nav.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.nav.end}
                        title={navCollapsed ? item.nav.label : undefined}
                        className={({ isActive }) => cn(tabStyle(isActive), navCollapsed && 'md:justify-center md:px-0')}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <ActiveTabIndicator />}
                            <span className="sidebar-link-icon relative z-10">
                              <Icon size={15} strokeWidth={1.85} />
                            </span>
                            <span className={cn('relative z-10 min-w-0 flex-1 truncate text-[12.5px]', navCollapsed && 'md:hidden')}>{item.nav.label}</span>
                            {isActive && <span className={cn('relative z-10 h-1.5 w-1.5 rounded-full bg-purple-300 shadow-[0_0_8px_rgba(216,180,254,0.9)]', navCollapsed && 'md:hidden')} />}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

        </nav>
        <div className="sidebar-foot border-t p-2">
          {/*
            * Burada bir TEMA ANAHTARI vardi. Panel tek temaya
            * (Premium Dark Glassmorphism) indirildigi icin kaldirildi;
            * yariya kalmis bir acik tema birakmaktansa anahtar da gitti.
            */}
          <button
            onClick={cikisYap}
            title={navCollapsed ? 'Güvenli çıkış' : undefined}
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-full px-3 text-[11px] font-semibold text-slate-500 transition hover:bg-rose-400/[0.08] hover:text-rose-300',
              navCollapsed && 'md:justify-center md:px-0'
            )}
          >
            <LogOut size={18} />
            <span className={cn(navCollapsed && 'md:hidden')}>Güvenli çıkış</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className={cn(
        "relative z-10 flex min-w-0 flex-1 flex-col pl-0 transition-[padding] duration-200 ease-out",
        navCollapsed ? "md:pl-[80px]" : "md:pl-[288px]"
      )}>
        <header className="app-header relative z-40 w-full flex-shrink-0 px-3 md:px-4">
          <div className="mx-auto flex h-[76px] max-w-[1900px] items-center justify-between gap-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.035] text-slate-400 transition hover:text-white md:hidden"
                aria-label="Menüyü aç"
              >
                <Menu size={22} />
              </button>
              <div className="mr-2 min-w-[168px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/65">{meta?.eyebrow}</p>
                <h1 className="truncate text-lg font-bold tracking-[-0.025em] text-white">{meta?.title}</h1>
              </div>
              {hasDateFilters && (
                <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-visible xl:flex">
                  <DateRangePresets />
                  <DateRangeBar range={dateRange} onRangeChange={setDateRange} onRefresh={panodayiz ? handleRefreshDashboard : undefined} isLoading={panodayiz ? panoYukleniyor : false} />
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className={cn("hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs font-semibold text-slate-300 lg:flex", hasDateFilters && "xl:hidden")}>
                <CalendarDays size={16} className="text-slate-500" />
                {adminDateLabel}
              </div>
              <button
                type="button"
                onClick={handleRefreshDashboard}
                className={cn("neon-glow-indigo hidden items-center gap-2 rounded-full bg-purple-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-purple-400 lg:flex", hasDateFilters && "xl:hidden")}
              >
                <RefreshCw size={16} />
                Verileri yenile
              </button>
              <NotificationCenter />
              {/*
                HESAP ROZETI. Ust satirda oturumun YONETTIGI sitenin adi
                var; sabit marka adi degil. Panel cok kiracili ve ayni
                kurulumdan farkli siteler yonetiliyor -- her birinde ayni
                ismi gostermek, operatörün hangi sitede oldugunu
                rozetten anlamasini imkansiz kiliyordu.

                Alt satirda "TR · Partner" yaziyordu; o da sabitti ve
                hicbir seye karsilik gelmiyordu. Yerine giris yapan
                kullanicinin adi kondu -- gercek veri.
              */}
              <div title={rozetIpucu} className="hidden h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 lg:flex">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-400 text-[9px] font-black text-white">
                  {rozetHarfleri}
                </div>
                <div className="leading-tight">
                  <p className="max-w-[180px] truncate text-[11px] font-bold tracking-[-0.01em] text-white">{gosterilenSite}</p>
                  {kullaniciAdi && (
                    <p className="max-w-[180px] truncate text-[8px] font-medium uppercase tracking-[0.12em] text-slate-600">{kullaniciAdi}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="app-content">
          <section className="tab-intro workspace-context-bar">
            <div className="flex min-w-0 items-start gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/65">{meta?.eyebrow}</p>
                <h2 className="sr-only">{meta?.title}</h2>
                <p className="max-w-5xl truncate text-xs leading-5 text-slate-500">{meta?.description}</p>
              </div>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="tab-intro-status">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Canlı çalışma alanı · son güncelleme {panoGuncellemeSaati}
              </div>
            </div>
          </section>

          {hasDateFilters && (
            <div className="tab-filter-dock mb-5 flex flex-wrap items-center gap-3 xl:hidden">
              <DateRangePresets />
              <DateRangeBar range={dateRange} onRangeChange={setDateRange} onRefresh={panodayiz ? handleRefreshDashboard : undefined} isLoading={panodayiz ? panoYukleniyor : false} />
            </div>
          )}
          {/*
            * SUSPENSE, ANIMATEPRESENCE'IN ICINDE OLMALI.
            *
            * Tersi kuruluydu ve bazi sayfalar yalnizca sayfa yenilenince
            * geliyordu. Sebep: bir rotanin lazy chunk'i ILK kez yuklenirken
            * `<Outlet/>` askiya aliniyor; Suspense siniri yukarida oldugu
            * icin butun AnimatePresence agaci sokuluyordu. Ayni anda
            * `mode="wait"` eski cocugu cikis animasyonunda tutuyordu; ikisi
            * cakisinca yeni cocuk hic commit edilmiyor ve calisma alani bos
            * kaliyordu. Yenileme taze mount oldugu icin duzeltiyordu.
            *
            * Iki degisiklik:
            *  1. Suspense her rotanin KENDI sinirina indi — askiya alinma
            *     artik yalnizca o rotanin icerigini etkiliyor, kabuk ve
            *     animasyon agaci ayakta kaliyor.
            *  2. `mode="wait"` kaldirildi. Yeni cocuk eskisinin cikisini
            *     beklemeden mount ediliyor; 0.2sn'lik solmada gorsel fark
            *     yok ama bu hata sinifi tamamen ortadan kalkiyor.
            */}
          {/*
            * ANIMATEPRESENCE KALDIRILDI — sayfalarin gorunmemesinin sebebi.
            *
            * Belirti: gezindikten sonra sayfa ekranda yok, ama DOM'da TAM
            * duruyor (kullanicinin panelinden olculdu: 114 KB HTML, 3503px
            * yukseklik). Icerik `opacity: 0`da takili kaliyordu; yenileme
            * taze mount oldugu icin duzeltiyordu.
            *
            * Sebep: `<Outlet/>` lazy chunk yuklerken askiya aliniyor ve
            * AnimatePresence'in giris/cikis muhasebesi bozuluyor. Yeni
            * cocuga "animasyonu baslat" hic denmiyor, `initial` degerinde
            * (opacity 0) kaliyor. `mode="wait"` ile takiliyor; `mode`suz
            * denendiginde ise cikan cocuklar hic kaldirilmadi (olculdu:
            * 9 olu kopya birikti) ve sorun surdu.
            *
            * Cozum: presence muhasebesini tamamen birak. Anahtar degisimi
            * zaten yeniden mount ediyor, dolayisiyla `initial -> animate`
            * her rotada calisiyor. Kaybedilen tek sey eski sayfanin solarak
            * cikmasi; yenisi zaten solarak geldigi icin fark edilmiyor.
            */}
          {/*
            * SAYFA GECISI CSS ILE — JS ANIMASYONUYLA DEGIL.
            *
            * Burada `motion.div` + `initial={{opacity:0}}` vardi ve sayfalar
            * "yenilemeden gorunmuyor" diye bildirildi. Kullanicinin
            * panelinden olculen sey belirleyici: icerik DOM'da TAM duruyordu
            * (114 KB HTML, 3503px yukseklik) ama ekranda yoktu. Yani icerik
            * mount oluyor, yalnizca GORUNUR hale gelmiyordu.
            *
            * Asil kusur bu bagimlilik: gorunurluk bir JS animasyonunun
            * calismasina bagliydi. Animasyon herhangi bir sebeple
            * ilerlemezse (sekme arka planda, rAF durmus, azaltilmis hareket
            * tercihi, framer-motion hatasi) icerik `initial` degerinde,
            * yani opacity 0'da kalir ve sayfa bos gorunur.
            *
            * Artik gecisi `index.css`'teki `workspace-enter` keyframe'i
            * yapiyor. `forwards` olmadigi icin animasyon HIC calismasa bile
            * eleman dogal opacity'sinde (1) durur — yani en kotu ihtimalde
            * animasyon kaybedilir, icerik degil.
            *
            * `key={pathname}` duruyor: rota degisince yeniden mount edilip
            * animasyon bastan oynasin diye.
            */}
          <div className="tab-workspace" data-tab={meta?.id}>
            <div key={pathname} className={meta?.icerikSinifi}>
              <Suspense fallback={<div className="flex flex-1 items-center justify-center py-20"><LoadingState label="Yükleniyor..." /></div>}>
                <Outlet />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
      <GlobalNotifications />
    </motion.div>
  );
}
