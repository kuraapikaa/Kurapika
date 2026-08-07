import { create } from 'zustand';

/**
 * YÖNETİM PANELİ TEMASI.
 *
 * Yalnızca paneli etkiler. Oyuncuya bakan lobi (`narcos-theme`) BİLEREK
 * dışarıda: o bir marka yüzeyi (sıcak siyah + altın) ve açık bir varyantı
 * yok — tek anahtarla ikisini birden çevirmek markayı bozardı.
 *
 * Tercih `<html data-panel-theme>` üzerinden uygulanır; renkler
 * `index.css` içindeki `--panel-*` token'larından okunur, böylece 65
 * bileşene tek tek dokunmak gerekmiyor.
 *
 * Varsayılan işletim sisteminin tercihidir. Kullanıcı bir kez seçim
 * yaparsa o seçim kalıcıdır ve sistem tercihi artık dinlenmez — aksi
 * halde kullanıcının açık temaya geçmesi, işletim sistemi gece moduna
 * girdiğinde sessizce geri alınırdı.
 */

export type PanelTheme = 'light' | 'dark';

const STORAGE_KEY = 'panel_theme';

function sistemTercihi(): PanelTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function kayitliTercih(): PanelTheme | null {
  try {
    const deger = localStorage.getItem(STORAGE_KEY);
    return deger === 'light' || deger === 'dark' ? deger : null;
  } catch {
    return null;
  }
}

/**
 * AYRI KATMANDA ÇİZİLEN ÖĞELERİ YENİDEN HESAPLATIR.
 *
 * Tema kökteki `data-panel-theme` ile değişiyor ve panelin çoğu bunu
 * anında alıyor. Ama iki grup öğe almıyordu:
 *
 *   - `.premium-sidebar` — `position: fixed` + `backdrop-filter` ile
 *     kendi kompozit katmanını oluşturuyor.
 *   - Form kontrolleri (`input`, `select`, `textarea`) — tarayıcı
 *     tarafından ayrı çizilen öğeler.
 *
 * Tarayıcıda ölçüldüğünde durum netti: aynı anda panel gövdesindeki kart
 * başlığı DOĞRU renge geçerken sidebar bağlantısı ve form alanı ESKİ
 * temada kalıyordu. Yani sorun ölçümde değil, bu alt ağaçlara özel.
 * Kullanıcıya görünen hâli: temayı çevirince menü yazıları beyaz menü
 * üstünde açık gri kalıyor ve arama kutusu koyu zemin üstünde koyu yazı
 * oluyordu. Sayfayı yenileyince düzeliyordu, bu yüzden tutarsız
 * görünüyordu.
 *
 * DENENIP İŞE YARAMAYANLAR: reflow zorlamak, `backdrop-filter`ı kapatıp
 * açmak, kuralları tema kapsamında tekrar yazmak, öğeye boş bir özel
 * özellik yazmak. Yalnızca öğeyi kısa süreliğine yerleşimden çıkarmak
 * tazeliyor.
 *
 * Aynı senkron blokta geri alındığı için arada hiçbir kare boyanmıyor;
 * göze çarpan bir titreme olmuyor. Menünün kaydırma konumu korunuyor —
 * uzun menüde başa dönmek fark edilir bir gerileme olurdu.
 */
function tazeleAyrikKatmanlar(): void {
  const hedefler = document.querySelectorAll<HTMLElement>(
    '.premium-sidebar, .app-shell input, .app-shell select, .app-shell textarea',
  );
  const kaydirmalar = new Map<Element, number>();
  document.querySelectorAll('.premium-sidebar nav').forEach((el) => kaydirmalar.set(el, el.scrollTop));

  hedefler.forEach((el) => {
    const eski = el.style.display;
    el.style.display = 'none';
    void el.offsetHeight;
    el.style.display = eski;
  });

  kaydirmalar.forEach((ust, el) => { el.scrollTop = ust; });
}

export function uygulaPanelTheme(theme: PanelTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-panel-theme', theme);
  tazeleAyrikKatmanlar();
}

interface PanelThemeState {
  theme: PanelTheme;
  /** Kullanıcı açıkça seçim yaptı mı; sistem tercihini dinlemeyi bu belirler. */
  elleSecildi: boolean;
  setTheme: (theme: PanelTheme) => void;
  toggleTheme: () => void;
}

const baslangic = kayitliTercih();

export const usePanelTheme = create<PanelThemeState>((set) => ({
  theme: baslangic ?? sistemTercihi(),
  elleSecildi: baslangic !== null,
  setTheme: (theme) => {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* yoksay */ }
    uygulaPanelTheme(theme);
    set({ theme, elleSecildi: true });
  },
  toggleTheme: () => {
    const sonraki: PanelTheme = usePanelTheme.getState().theme === 'dark' ? 'light' : 'dark';
    usePanelTheme.getState().setTheme(sonraki);
  },
}));

/** Açılışta bir kez: kayıtlı/sistem temasını köke yazar ve sistemi dinler. */
export function panelThemeBaslat(): () => void {
  uygulaPanelTheme(usePanelTheme.getState().theme);

  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const sorgu = window.matchMedia('(prefers-color-scheme: light)');
  const dinleyici = (olay: MediaQueryListEvent) => {
    if (usePanelTheme.getState().elleSecildi) return;
    const theme: PanelTheme = olay.matches ? 'light' : 'dark';
    uygulaPanelTheme(theme);
    usePanelTheme.setState({ theme });
  };
  sorgu.addEventListener('change', dinleyici);
  return () => sorgu.removeEventListener('change', dinleyici);
}
