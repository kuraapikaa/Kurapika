import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Logo, useMarka, type MarkaBilgisi } from './marka';
import { buttonVariants } from './components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './components/ui/sheet';
import { cn } from './lib/utils';

/**
 * UYGULAMA KABUĞU — sol kenar çubuğu.
 *
 * Önceki düzen gezinmeyi üstte yatay bir şeride koyuyordu. Ekran
 * sayısı arttıkça (yönetimde on, portalde altı) şerit taşmaya başladı
 * ve hangi bölümde olduğunuz görünmez oldu.
 *
 * Kenar çubuğu bunu çözüyor: bölümler gruplu, alt sayfalar açılır ve
 * seçili olan her zaman görünür. Sektördeki affiliate platformlarının
 * ortak düzeni de bu — ortak paneli ilk kez açan biri nereye
 * bakacağını zaten biliyor.
 *
 * ── Mobilde ──
 *
 * Kenar çubuğu dar ekranda gizleniyor ve Shadcn'in `Sheet`ine
 * (Radix Dialog) taşınıyor: odak tuzağı, ESC ile kapama, doğru ARIA
 * öznitelikleri kendiliğinden geliyor — elle yazılmış bir kaplamanın
 * bunu doğru yapması ayrı bir iş olurdu.
 */

export interface MenuOgesi {
  yol: string;
  etiket: string;
  ikon: ReactNode;
  /** Alt sayfalar; varsa öge açılır bir grup olur. */
  altlar?: Array<{ yol: string; etiket: string }>;
  /** `end` yalnızca tam eşleşmede seçili sayar; kök yollar için gerekli. */
  tam?: boolean;
  /** Bu ögeden ÖNCE ince bir ayraç çizilir; genelde ayarlar/idari bölüm başlangıcı. */
  bolumOnce?: boolean;
}

export function Kabuk({
  menu, baslik, altBaslik, sagUst, children,
}: {
  menu: MenuOgesi[];
  baslik: string;
  altBaslik: string;
  sagUst: ReactNode;
  children: ReactNode;
}) {
  const [acik, setAcik] = useState(false);
  const konum = useLocation();
  const marka = useMarka();

  // Sayfa degisince mobil menu kapaniyor; acik kalmasi, dokundugunuz
  // sayfayi ortmesi demek olurdu.
  useEffect(() => setAcik(false), [konum.pathname]);

  return (
    // `aqua`: backoffice Apple kimliginde — kok degiskenleri ve sus
    // siniflarini index.css'teki kapsam eziyor. Vitrin (Landing) bu
    // sarmalayicinin disinda, cyberpunk kimliginde kaliyor.
    <div className="aqua flex min-h-screen bg-background text-foreground">
      {/* `ray`: macOS kenar cubugu gibi temayla acilip kararan sakin
          yuzey. Renkleri index.css'te kapsamli degiskenlerle geliyor;
          Shadcn token'lari da (bg-background, border-border...) ayni
          kapsamdan okuyor. */}
      <aside className="ray fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r lg:static lg:flex">
        <KenarCubuguIcerik menu={menu} marka={marka} baslik={baslik} altBaslik={altBaslik} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur-sm">
          <Sheet open={acik} onOpenChange={setAcik}>
            <SheetTrigger
              aria-label="Menü"
              className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'lg:hidden')}
            >
              <Menu className="h-4 w-4" />
            </SheetTrigger>
            <SheetContent side="left" className="ray flex w-60 flex-col gap-0 p-0">
              <SheetTitle className="sr-only">Gezinme menüsü</SheetTitle>
              <KenarCubuguIcerik menu={menu} marka={marka} baslik={baslik} altBaslik={altBaslik} />
            </SheetContent>
          </Sheet>
          <Kirintilar menu={menu} />
          <div className="ml-auto flex items-center gap-2">{sagUst}</div>
        </header>

        <main className="min-w-0 flex-1 space-y-4 p-4">{children}</main>
      </div>
    </div>
  );
}

/** Kenar çubuğunun içeriği — masaüstünde sabit `aside`, mobilde `Sheet` içinde aynen tekrar kullanılıyor. */
function KenarCubuguIcerik({
  menu, marka, baslik, altBaslik,
}: {
  menu: MenuOgesi[];
  marka: MarkaBilgisi;
  baslik: string;
  altBaslik: string;
}) {
  return (
    <>
      <div className="border-b px-4 py-4">
        <Logo marka={marka} />
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {baslik}{altBaslik ? ` · ${altBaslik}` : ''}
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {menu.map((oge) => (
          <div key={oge.yol}>
            {oge.bolumOnce && <BolumAyraci />}
            <MenuSatiri oge={oge} />
          </div>
        ))}
      </nav>
    </>
  );
}

/** Seçili sayfanın adı; "Statistics / Partners" kalıbı. */
function Kirintilar({ menu }: { menu: MenuOgesi[] }) {
  const { pathname } = useLocation();

  for (const oge of menu) {
    const alt = oge.altlar?.find((a) => a.yol === pathname);
    if (alt) {
      return (
        <p className="truncate text-sm">
          <span className="text-muted-foreground">{oge.etiket} / </span>
          <span className="font-medium">{alt.etiket}</span>
        </p>
      );
    }
    if (oge.yol === pathname) return <p className="truncate text-sm font-medium">{oge.etiket}</p>;
  }
  return <p className="truncate text-sm font-medium">Panel</p>;
}

/**
 * Bölüm boşluğu — üçüncü grup öncesi (Ayarlar).
 *
 * Yeni bir metin etiketi eklemiyor ("büyük harf yok" kuralı zaten
 * dekoratif HUD başlıklarını reddediyor); bunun yerine tek, ince bir
 * çizgiyle üstü diğerlerinden ayırıyor.
 */
function BolumAyraci() {
  return <div className="my-2 border-t" />;
}

function Sevron({ acik }: { acik: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={cn('ml-auto shrink-0 opacity-60 transition-transform duration-150', acik && 'rotate-90')}
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/**
 * Seçili öge macOS kenar çubuğu gibi: yumuşak vurgu dolgusu, vurgu
 * renginde metin. Çizgi, ışıltı, büyük harf yok. Seçili OLMAYAN öge
 * fareyle üzerine gelince hafifçe belirginleşir.
 */
function satirSinifi(secili: boolean, altSeviye = false) {
  return cn(
    'truncate rounded-lg text-sm transition-colors duration-100',
    altSeviye ? 'block px-3 py-1.5' : 'flex items-center gap-2 px-3 py-2',
    secili ? 'bg-accent text-primary font-medium' : 'text-muted-foreground hover:bg-secondary',
  );
}

function MenuSatiri({ oge }: { oge: MenuOgesi }) {
  const { pathname } = useLocation();
  const icerdeMi = Boolean(oge.altlar?.some((a) => a.yol === pathname));
  const [acik, setAcik] = useState(icerdeMi);

  // Baska bir yoldan alt sayfaya gelindiginde grup KENDILIGINDEN aciliyor;
  // aksi halde secili sayfa kapali bir grubun icinde gorunmez kalirdi.
  useEffect(() => {
    if (icerdeMi) setAcik(true);
  }, [icerdeMi]);

  if (!oge.altlar?.length) {
    return (
      <NavLink to={oge.yol} end={oge.tam} className={({ isActive }) => satirSinifi(isActive)}>
        <span className="shrink-0 opacity-80">{oge.ikon}</span>
        <span className="truncate">{oge.etiket}</span>
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        className={cn(satirSinifi(icerdeMi), 'w-full')}
        onClick={() => setAcik(!acik)}
        aria-expanded={acik}
      >
        <span className="shrink-0 opacity-80">{oge.ikon}</span>
        <span className="truncate">{oge.etiket}</span>
        <Sevron acik={acik} />
      </button>
      {acik && (
        <div className="ml-4 space-y-0.5 border-l pl-2">
          {oge.altlar.map((a) => (
            <NavLink key={a.yol} to={a.yol} className={({ isActive }) => satirSinifi(isActive, true)}>
              {a.etiket}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── İkonlar ────────────────────────────────────────────────────────────
   Kütüphane yerine satır içi SVG: sekiz ikon için burada elle çizilmiş
   set zaten var ve dönüştürmenin görsel bir kazancı yok — lucide-react
   Shadcn bileşenlerinin kendi ihtiyacı için zaten pakette (bkz. `Menu`
   üstte), ama bu set onunla değiştirilmedi. */

const ikon = (d: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

export const IKON = {
  pano: ikon(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>),
  ortak: ikon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>),
  teklif: ikon(<><path d="M20.6 12.6 12 21.2l-8.6-8.6a4.4 4.4 0 0 1 6.2-6.2L12 7.8l2.4-2.4a4.4 4.4 0 0 1 6.2 6.2Z" /></>),
  medya: ikon(<><rect x="3" y="4" width="18" height="14" rx="2" /><path d="m8 12 2.5 2.5L16 9" /></>),
  istatistik: ikon(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  odeme: ikon(<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>),
  ayar: ikon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>),
  link: ikon(<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>),
  basvuru: ikon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M9 15h6" /></>),
};
