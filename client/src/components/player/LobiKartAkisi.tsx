import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * LOBİ KART AKIŞI.
 *
 * Sekmeli yapının ("Hızlı Erişim / Turnuva / Destek") yerini alan tek
 * akışlı, görsel-öncelikli kart lobisi. Oyuncu ne yapabileceğini
 * sekmeleri gezmeden, tek kaydırmada görüyor.
 *
 * ── Neden iki ayrı görsel seti ────────────────────────────────────────
 * Teslim edilen tasarım mobilde 16:9 banner, masaüstünde 4:5 dikey kart
 * kullanıyor. Tek set kullanılsaydı biri mutlaka kırpılır ya da
 * esnetilirdi; kartların üstündeki yazılar (marka, başlık) kırpılmaya
 * hiç gelmiyor.
 *
 * Seçim `<picture>` + `media` ile YAPILIYOR, JavaScript'le değil:
 * tarayıcı yalnızca kullanacağı dosyayı indiriyor. `window.innerWidth`
 * ile seçseydik ilk render'da yanlış set inip sonra doğrusu da inerdi --
 * mobil veride iki kat yük.
 *
 * ── Görseller ─────────────────────────────────────────────────────────
 * Kaynak PNG'ler toplam 63 MB. Lobi telefonla ve çoğu zaman mobil
 * veriyle açılıyor; bunu her açılışta indirtmek sayfayı kullanılamaz
 * yapardı. WebP'ye çevrilip ekranda görünecek boyuta (2x retina)
 * indirildiler: 1,46 MB. Tasarım korunuyor, baytlar değil.
 *
 * Ölçüler set genelinde SABİT (mobil 800x450, dikey 720x900). Yeni
 * kartlar başka bir ölçüde üretilseydi eskilerin yanında farklı
 * netlikte görünürlerdi.
 */

/** Kart kimliği → görsel dosya adı. Adlar tasarım paketiyle birebir. */
const GORSEL_ADI: Record<string, string> = {
  bonus: 'bonus-talep',
  wheel: 'sans-carki',
  scratch: 'kazi-kazan',
  prediction: 'narcos-skor-tahmin',
  'daily-tasks': 'gunluk-gorevler',
  tournament: 'turnuva',
  loyalty: 'sadakat',
  millionaires: 'milyonerler',
  vip: 'vip',
  partner: 'is-birligi',
  'call-me': 'aranma-talep',
  kasa: 'patron-kasasi',
  'ozel-oran': 'ozel-oran',
};

/**
 * Öne çıkanlar sabit: tasarımda bu üçü seçildi. Yönetilebilir olması
 * istenirse `quickAccess` verisine `featured` alanı eklenmeli --
 * bugün öyle bir alan yok ve uydurmak, panelden değiştirilemeyen bir
 * ayar gibi görünüp yanıltırdı.
 */
const ONE_CIKANLAR = ['bonus', 'wheel', 'prediction'];

export type LobiKart = {
  id: string;
  label: string;
  to: string;
  enabled?: boolean;
};

export function gorselYolu(id: string, set: 'mobile' | 'standard'): string | null {
  const ad = GORSEL_ADI[id];
  return ad ? `/assets/lobby-cards/${set}/${ad}.webp` : null;
}

type KartProps = {
  kart: LobiKart;
  sira: number;
  oneCikan: boolean;
  sadeHareket: boolean;
  vurguRengi: string;
  kenarRengi: string;
};

function Kart({ kart, sira, oneCikan, sadeHareket, vurguRengi, kenarRengi }: KartProps) {
  const mobil = gorselYolu(kart.id, 'mobile');
  const dikey = gorselYolu(kart.id, 'standard');
  /**
   * Görseli olmayan kısayol ELENMIYOR, yedek döşemeyle çiziliyor.
   *
   * Önce eleniyordu ve sonucu şuydu: panelden yeni bir kısayol eklendiğinde
   * lobide hiç görünmüyor, sebebi de hiçbir yerde yazmıyordu. Tasarım
   * paketinde karşılığı olmayan her kısayol artık en azından adıyla
   * görünüyor.
   */
  const gorselVar = Boolean(mobil && dikey);

  return (
    <motion.div
      /*
       * `animate` kullaniliyor, `whileInView` DEGIL.
       *
       * Gorunume girince tetiklemek daha sik duruyordu ama bir riski
       * vardi: gozlemci herhangi bir sebeple tetiklenmezse kart
       * `opacity: 0` de KALIYOR -- yani oyuncu bos bir lobi goruyor.
       * Bir avuc kartlik kisa bir sayfada kazanc, o riski tasimaya
       * degmiyor. Kartlar yuklenince sirayla beliriyor.
       */
      initial={sadeHareket ? false : { opacity: 0, y: 18 }}
      animate={sadeHareket ? undefined : { opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
        // Sirali giris: kartlar ayni anda degil, ardi ardina beliriyor.
        // Gecikme 6 kartta duruyor -- yoksa listenin sonundaki kart
        // saniyelerce bekler ve "yuklenmiyor" gibi gorunurdu.
        delay: Math.min(sira, 6) * 0.05,
      }}
      className="min-w-0"
    >
      <Link
        to={kart.to}
        aria-label={kart.label}
        className={cn(
          'lobi-kart group relative block overflow-hidden border transition-[transform,border-color,box-shadow] duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          oneCikan ? 'rounded-[22px]' : 'rounded-[18px]',
          !sadeHareket && 'hover:-translate-y-1 active:scale-[0.98]',
        )}
        style={{
          borderColor: kenarRengi,
          backgroundColor: '#0d0b06',
          boxShadow: oneCikan ? '0 14px 34px rgba(0,0,0,0.5)' : '0 6px 18px rgba(0,0,0,0.32)',
          ['--tw-ring-color' as string]: vurguRengi,
        }}
      >
        {gorselVar ? (
          <picture>
            {/* Masaustunde dikey (4:5) set; tarayici yalnizca birini indirir. */}
            <source media="(min-width: 768px)" srcSet={dikey!} />
            <img
              src={mobil!}
              alt={kart.label}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="block h-auto w-full select-none"
            />
          </picture>
        ) : (
          <span
            className={cn(
              'flex w-full items-center justify-center px-3 text-center',
              oneCikan ? 'aspect-[16/9] md:aspect-[4/5]' : 'aspect-[4/5]',
            )}
            style={{ background: `linear-gradient(160deg, ${vurguRengi}22, #0d0b06 70%)` }}
          >
            <span className="text-sm font-black leading-tight tracking-[-0.02em] text-white/90">
              {kart.label}
            </span>
          </span>
        )}

        {/*
          Uzerine gelince yumusak bir altin parilti. Gorselin kendisine
          filtre uygulanmiyor -- kartlarin uzerinde yazi var ve parlaklik
          oynatmak onlari okunmaz hale getiriyordu.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: `radial-gradient(120% 80% at 50% 100%, ${vurguRengi}22, transparent 60%)` }}
        />
      </Link>
    </motion.div>
  );
}

function BolumBasligi({ baslik, sayi, renk, sonukRenk }: { baslik: string; sayi: number; renk: string; sonukRenk: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[16px] font-black tracking-[-0.03em]" style={{ color: renk }}>{baslik}</h2>
      <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: sonukRenk }}>
        {sayi} kart
      </span>
    </div>
  );
}

export function LobiKartAkisi({ kartlar, vurguRengi, metinRengi, sonukRenk }: {
  kartlar: LobiKart[];
  vurguRengi: string;
  metinRengi: string;
  sonukRenk: string;
}) {
  /**
   * İşletim sisteminde "hareketi azalt" seçiliyse giriş ve hover
   * hareketleri kapanır. Lobi kaçınılabilir bir sayfa değil ve on bir
   * kartın sırayla oynaması hareket duyarlılığı olan kişilerde rahatsız
   * edici olabiliyor.
   */
  const sadeHareket = useReducedMotion() ?? false;

  const acik = kartlar.filter((k) => k.enabled !== false);
  const oneCikan = ONE_CIKANLAR
    .map((id) => acik.find((k) => k.id === id))
    .filter(Boolean) as LobiKart[];
  const kisayollar = acik.filter((k) => !ONE_CIKANLAR.includes(k.id));

  const kenarOne = 'rgba(245,158,11,0.34)';
  const kenarKisa = 'rgba(243,236,221,0.08)';

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-5">
      {oneCikan.length > 0 && (
        <section className="flex min-w-0 flex-col gap-3">
          <BolumBasligi baslik="Öne çıkanlar" sayi={oneCikan.length} renk={metinRengi} sonukRenk={sonukRenk} />
          {/* Mobilde tek sutun (16:9 banner), masaustunde uc sutun (4:5). */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3 md:gap-4">
            {oneCikan.map((kart, i) => (
              <Kart
                key={kart.id}
                kart={kart}
                sira={i}
                oneCikan
                sadeHareket={sadeHareket}
                vurguRengi={vurguRengi}
                kenarRengi={kenarOne}
              />
            ))}
          </div>
        </section>
      )}

      {kisayollar.length > 0 && (
        <section className="flex min-w-0 flex-col gap-3">
          <BolumBasligi baslik="Tüm kısayollar" sayi={kisayollar.length} renk={metinRengi} sonukRenk={sonukRenk} />
          {/* Mobilde iki, masaustunde bes sutun. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
            {kisayollar.map((kart, i) => (
              <Kart
                key={kart.id}
                kart={kart}
                sira={i}
                oneCikan={false}
                sadeHareket={sadeHareket}
                vurguRengi={vurguRengi}
                kenarRengi={kenarKisa}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
