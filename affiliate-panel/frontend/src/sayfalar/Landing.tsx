import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BasvuruFormu } from './Basvuru';
import { api } from '../api';
import { Logo, useMarka } from '../marka';
import { useTema } from '../lib/tema';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { FormHata, FormSaha } from '../components/form-saha';
// Arka plani silinmis maskot cutout'u. Kahramanda ve giris/basvuru
// kenarinda ayni gorsel kullaniliyor; ikinci bir varyant tutmak
// gereksiz agirlik olurdu.
import maskot from '../gorseller/maskot-altin.png';

/**
 * ORTAKLIK PROGRAMI LANDING SAYFASI — altın ve gümüş.
 *
 * Bu, panele giriş kapısı değil; ortaklara PAYLAŞILAN adresin ilk
 * ekranı. Buraya gelen kişi henüz ortak değil ve programı hiç
 * bilmiyor — tek işi onu ikna etmek.
 *
 * ── Tasarım tezi: iki metal, iki iş ──
 *
 * Altın yalnızca PARANIN olduğu yerde: başlığın ikinci yarısı, ödenen
 * komisyon sayacı, en yüksek kademe, başvuru düğmesi. Gümüş her yerde
 * ama hiçbir eylemi işaretlemiyor: başlığın ilk yarısı, çizgiler,
 * ikincil metin.
 *
 * Sayfanın tek gerçek iddiası bu karşıtlıkta okunuyor: sahne hareket
 * eder (maskot süzülür, sayaç artar, şerit kayar) ama hakediş
 * pusulasındaki rakam DÜZ ve SABİT kalır — hiç degrade, hiç hareket.
 * Şehir renk değiştirir, ödediğimiz rakam değiştirmez.
 *
 * ── Rakamlar neden küçük ──
 *
 * Program yeni açıldı: site günlük ortalama 4.000 ₺ net yatırım
 * alıyor. Kademe eşikleri ve sayaç buna göre; "aylık 150.000 ₺ geliri
 * olan ortak" eşiği yazmak, hiçbir ortağın ulaşamayacağı bir vitrin
 * kurmak ve ilk ödemede güveni kırmak olurdu.
 */

type Gorunum = 'tanitim' | 'basvuru' | 'giris';

/**
 * ÖDENEN TOPLAM KOMİSYON — sayaç.
 *
 * Hedefe 2,4 saniyede kübik yavaşlamayla çıkıyor, sonra düzenli
 * aralıklarla küçük adımlarla artmaya devam ediyor: rakam canlı
 * görünüyor ama uydurulmuş bir hız değil, gerçek günlük hacme yakın
 * bir artış (dakikada ~40 ₺ ≈ günlük 4.000 ₺'nin komisyon payı).
 *
 * `prefers-reduced-motion` açıksa animasyon atlanıyor ve rakam
 * doğrudan son değerinde duruyor.
 */
function useSayac(hedef: number) {
  const [deger, setDeger] = useState(0);
  const kareRef = useRef<number>();

  useEffect(() => {
    const azalt = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (azalt) {
      setDeger(hedef);
      return;
    }

    const baslangic = performance.now();
    const adim = (simdi: number) => {
      const t = Math.min((simdi - baslangic) / 2400, 1);
      setDeger(Math.round(hedef * (1 - (1 - t) ** 3)));
      if (t < 1) kareRef.current = requestAnimationFrame(adim);
    };
    kareRef.current = requestAnimationFrame(adim);

    const surukle = setInterval(() => setDeger((d) => d + 40), 4200);
    return () => {
      if (kareRef.current) cancelAnimationFrame(kareRef.current);
      clearInterval(surukle);
    };
  }, [hedef]);

  return deger;
}

/**
 * KADEMELER — casino ve spor bahis ayrı.
 *
 * Spor bahsin brüt marjı casinodan yapısal olarak düşük; aynı yüzdeyi
 * iki dikeye uygulamak spor trafiğini taşınamaz hale getirirdi.
 */
const KADEMELER = [
  { esik: '0 – 5.000 ₺', not: 'Başlangıç', casino: '25', spor: '18' },
  { esik: '5.000 – 15.000 ₺', not: 'Yaygın aralık', casino: '30', spor: '22' },
  { esik: '15.000 – 40.000 ₺', not: 'Yüksek hacim', casino: '35', spor: '26' },
  { esik: '40.000 ₺ ve üzeri', not: 'En yüksek', casino: '40', spor: '30', one: true },
];

const ADIMLAR = [
  { baslik: 'Başvurun', metin: 'Trafiğinizi kısaca anlatın. Değerlendirme genelde aynı gün.' },
  { baslik: 'Linkinizi kurun', metin: 'Kampanya başına ayrı kısa link. Hangi kanalın çalıştığını tek tek görün.' },
  { baslik: 'Kazancınızı izleyin', metin: 'Casino ve spor ayrı, günlük güncellenen rakamlar.' },
  { baslik: 'Ödemenizi alın', metin: 'Ay kapanır, onaylanır, kesinleşir. Söylenen rakam değişmez.' },
];

const OZELLIKLER = [
  { baslik: 'Kampanya başına link', metin: 'Instagram, Telegram, blog — her biri ayrı kırılım. Tek bir toplamla yetinmezsiniz.' },
  { baslik: 'Dikey bazında rapor', metin: 'Casino ve spor bahis geliriniz yan yana. Hangi dikeyin kazandırdığını görürsünüz.' },
  { baslik: 'Günlük rakam', metin: 'Ay sonunu beklemeden ne kazandığınızı görürsünüz.' },
  { baslik: 'Alt kanal etiketleri', metin: 'Linkin sonuna bir etiket yazın; hangi gönderinin dönüştürdüğünü siz tanımlarsınız.' },
  { baslik: 'S2S postback', metin: 'Kendi izleme sisteminiz varsa dönüşümleri anlık olarak oraya iletiriz.' },
  { baslik: 'Şeffaf hakediş', metin: 'Brütten nete her kalem yazılı: işletme payı, devreden zarar, asgari ödeme.' },
];

/**
 * ENTEGRASYONLAR — turnkey ve white-label platformlar.
 *
 * Durum alanı DÜRÜST tutuluyor: program yeni, iki adaptör canlı.
 * Hepsini "canlı" göstermek ilk teknik soruda çökecek bir iddia olurdu.
 */
const ENTEGRASYONLAR = [
  { ad: 'SOFTSWISS', tur: 'Turnkey casino platformu', durum: 'Canlı' },
  { ad: 'EveryMatrix', tur: 'Casino + spor bahis', durum: 'Canlı' },
  { ad: 'BetConstruct', tur: 'Turnkey spor bahis', durum: 'Kalibrasyon' },
  { ad: 'Altenar', tur: 'Spor bahis motoru', durum: 'Yol haritasında' },
  { ad: 'Digitain', tur: 'White-label paketi', durum: 'Yol haritasında' },
  { ad: 'Genel REST', tur: 'Herhangi bir JSON API', durum: 'Kodsuz' },
];

const SERIT = ['SOFTSWISS', 'EveryMatrix', 'BetConstruct', 'Altenar', 'Digitain', 'NuxGame', 'Smartico', 'Genel REST'];

const SORULAR = [
  {
    s: 'Ödeme ne zaman yapılıyor?',
    c: 'Dönem ay sonunda kapanır. Onaylandıktan sonra rakam kesinleşir ve bir daha değişmez — size söylenen tutar kesindir.',
  },
  {
    s: 'Casino ve spor bahis oranları neden farklı?',
    c: 'Spor bahsin brüt marjı casinodan yapısal olarak düşüktür. Aynı yüzdeyi iki dikeye uygulamak, spor trafiğini taşınamaz hale getirirdi. İki oran ayrı hesaplanır, tek ödemede birleşir.',
  },
  {
    s: 'Asgari ödeme tutarının altında kalırsam ne olur?',
    c: 'Bakiyeniz silinmez. Sonraki aya eklenir ve eşiği geçtiğinizde birlikte ödenir. Asgari ödeme 1.000 ₺ — yeni programda kimse ilk ayını boş geçmesin diye düşük tutuldu.',
  },
  {
    s: 'Zararlı bir ay olursa?',
    c: 'O ay ödeme almazsınız. Zarar, planınızda devir açıksa sonraki ayın gelir tabanından düşülür; kapalıysa sıfırlanır. Hangisinin geçerli olduğu panelinizde yazılıdır.',
  },
  {
    s: 'Hangi komisyon modelleri var?',
    c: 'Gelir payı (RevShare), CPA (ilk yatırım yapan oyuncu başına sabit tutar) ve ikisinin karışımı olan hibrit. Size uygulanan model panelinizde açıkça görünür.',
  },
  {
    s: 'Trafiğim küçük, başvurabilir miyim?',
    c: 'Evet. Program yeni; hacim tek ölçüt değil, trafiğin niteliği ve kaynağı da değerlendiriliyor. Başvuru formunda rakam beyan etmek zorunda değilsiniz.',
  },
];

export function Landing({ girisYapildi }: { girisYapildi: () => void }) {
  const [gorunum, setGorunum] = useState<Gorunum>('tanitim');
  const [koyu, temaDegistir] = useTema();
  const [bilgi, setBilgi] = useState<string | null>(null);
  const marka = useMarka();

  const git = (hedef: Gorunum) => {
    setGorunum(hedef);
    // Bolum degisiminde sayfa BASA doner; uzun bir sayfanin ortasindayken
    // forma gecen kullanici formun ustunu goremiyordu.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          background: 'color-mix(in srgb, var(--zemin) 88%, transparent)',
          borderColor: 'color-mix(in srgb, var(--vurgu) 16%, transparent)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3.5">
          <button type="button" className="flex shrink-0 items-center" onClick={() => git('tanitim')}>
            <Logo marka={marka} boyut="buyuk" />
          </button>
          <nav className="ml-2 hidden min-w-0 gap-4 lg:flex">
            {[
              ['#entegrasyonlar', 'Entegrasyonlar'],
              ['#kademeler', 'Komisyon'],
              ['#surec', 'Süreç'],
              ['#panel', 'Panel'],
              ['#sorular', 'Sorular'],
            ].map(([yol, etiket]) => (
              <a
                key={yol}
                href={yol}
                className="whitespace-nowrap text-sm"
                style={{ color: 'var(--metin-2)' }}
              >
                {etiket}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={temaDegistir}>{koyu ? 'Aydınlık' : 'Karanlık'}</Button>
            <Button variant="outline" className="whitespace-nowrap" onClick={() => git('giris')}>Giriş</Button>
            <Button className="whitespace-nowrap" onClick={() => git('basvuru')}>Başvur</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        {bilgi && (
          <p
            className="mt-6 rounded-md border px-4 py-3 text-sm"
            style={{ color: 'var(--olumlu)', borderColor: 'var(--olumlu)', background: 'var(--yuzey)' }}
          >
            {bilgi}
          </p>
        )}

        {gorunum === 'tanitim' && <Tanitim git={git} />}

        {gorunum === 'basvuru' && (
          <section className="py-10">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
              <aside className="hidden lg:block">
                <div className="sticky top-28 space-y-5">
                  <MaskotSahne boyut={260} />
                  <Card className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--vurgu)' }}>
                      Sırada ne var
                    </p>
                    <ol className="mt-3 space-y-3">
                      {[
                        'Başvurunuz aynı gün içinde incelenir.',
                        'Onaylanınca e-postanızla panele giriş yaparsınız.',
                        'İzleme linkinizi kurar, trafiği göndermeye başlarsınız.',
                      ].map((metin, i) => (
                        <li key={metin} className="flex gap-3 text-sm" style={{ color: 'var(--metin-2)' }}>
                          <span
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] font-semibold"
                            style={{ background: 'var(--vurgu-yumusak)', color: 'var(--vurgu)' }}
                          >
                            {i + 1}
                          </span>
                          <span>{metin}</span>
                        </li>
                      ))}
                    </ol>
                  </Card>
                </div>
              </aside>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--vurgu)' }}>
                  Ortaklık başvurusu
                </p>
                <h1 className="gosterim mt-3 text-3xl font-extrabold tracking-tight">Başvuru formu</h1>
                <p className="mt-2 max-w-xl text-base" style={{ color: 'var(--metin-2)' }}>
                  Yıldızlı alanlar dışında hiçbiri zorunlu değil. Trafiğinizi anlatan alanlar
                  değerlendirmeyi hızlandırır.
                </p>
                <div className="mt-6">
                  <BasvuruFormu
                    tamamlandi={() => {
                      setBilgi('Başvurunuz alındı. Onaylandıktan sonra e-postanızla giriş yapabilirsiniz.');
                      git('giris');
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {gorunum === 'giris' && <GirisKutusu girisYapildi={girisYapildi} git={git} />}
      </main>

      <footer className="border-t" style={{ borderColor: 'var(--kenar)' }}>
        <div
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-6 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--metin-2)' }}
        >
          <span>© 2026 {marka.ad}</span>
          <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
            <span
              className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold"
              style={{ background: 'var(--vurgu-yumusak)', color: 'var(--vurgu)' }}
            >
              18+
            </span>
            Sorumlu oyun
          </span>
        </div>
      </footer>
    </div>
  );
}

/**
 * MASKOT SAHNESİ — nefes alan hale, dönen altın çember, süzülen figür.
 *
 * Üç katman da `index.css`'teki sınıflarla geliyor (`maskot-hale`,
 * `maskot-cember`, `maskot`); burada yalnızca geometri var. Animasyon
 * tanımlarını bileşene inline yazmak, `prefers-reduced-motion`
 * kuralının tek yerden kapatılmasını imkânsız kılardı.
 */
function MaskotSahne({ boyut = 440 }: { boyut?: number }) {
  return (
    <div className="relative grid place-items-center" style={{ minHeight: boyut * 1.08 }}>
      <div
        aria-hidden
        className="maskot-hale pointer-events-none absolute rounded-full"
        style={{ width: boyut * 0.92, height: boyut * 0.92 }}
      />
      <div
        aria-hidden
        className="maskot-cember pointer-events-none absolute rounded-full"
        style={{ width: boyut, height: boyut }}
      />
      <img
        src={maskot}
        alt="KuroAffiliate"
        className="maskot relative block h-auto w-full"
        style={{ maxWidth: boyut }}
      />
    </div>
  );
}

function Tanitim({ git }: { git: (g: Gorunum) => void }) {
  const odenen = useSayac(68400);

  return (
    <>
      {/* Kahraman: solda iddia, sagda maskot. Izgara ve aurora yalnizca
          bu bolumde — her bolume yayilsa desen gurultu olur.

          `overflow-hidden` BILEREK burada: izgara/aurora katmanlari
          `-inset-x-10` ile bolumun disina 40px tasiyor ve konteyner
          viewport'u doldurdugu her ekranda o 40px sayfayi yatay
          kaydirilabilir yapiyordu. Kesme yalnizca bu bolume kapsanmis;
          sayfanin `sticky` basligini ETKILEMIYOR. */}
      <section className="relative mt-10 overflow-hidden lg:mt-14">
        <div aria-hidden className="izgara absolute -inset-x-10 -top-10 bottom-0 -z-10" />
        <div aria-hidden className="tayf-aurora absolute -inset-x-10 -top-10 bottom-0 -z-10" />

        <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,470px)]">
          <div>
            <span
              className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-3 text-[11.5px] font-semibold uppercase tracking-[0.1em]"
              style={{ background: 'var(--vurgu-yumusak)', color: 'var(--vurgu)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--tayf-3)' }} />
              Ortaklık programı
            </span>

            <h1 className="gosterim mt-5 text-4xl font-extrabold leading-[1.04] tracking-tight md:text-5xl lg:text-[3.4rem]">
              <span
                style={{
                  backgroundImage: 'linear-gradient(100deg, var(--metin), var(--metin-2) 70%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'var(--metin)',
                }}
              >
                Getirdiğiniz oyuncunun geliri,{' '}
              </span>
              <span className="tayf-metin">her ay payınıza yazılır.</span>
            </h1>

            <p className="mt-5 max-w-xl text-lg" style={{ color: 'var(--metin-2)' }}>
              Casino ve spor bahis trafiğiniz ayrı ayrı ölçülür. Kampanya başına ayrı link,
              günlük güncellenen rakamlar — ve onaylandığı gün kesinleşen, bir daha değişmeyen hakediş.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="kesik whitespace-nowrap" onClick={() => git('basvuru')}>
                Başvuruyu başlat
              </Button>
              <Button size="lg" variant="outline" className="whitespace-nowrap" onClick={() => git('giris')}>
                Hesabım var
              </Button>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-2 gap-x-8 gap-y-6">
              {[
                ['%40', 'en yüksek casino gelir payı'],
                ['%30', 'en yüksek spor bahis payı'],
                ['Günlük', 'rakam güncellemesi'],
                ['1.000 ₺', 'asgari ödeme'],
              ].map(([deger, etiket]) => (
                <div key={etiket} className="min-w-0">
                  <dt className="tayf-metin whitespace-nowrap font-mono text-2xl font-semibold tabular-nums">
                    {deger}
                  </dt>
                  <dd className="mt-1.5 text-xs" style={{ color: 'var(--metin-2)' }}>{etiket}</dd>
                </div>
              ))}
            </dl>
          </div>

          <MaskotSahne />
        </div>
      </section>

      {/* ÖDENEN KOMİSYON — dönen metal kenarlı tek kart. Sayfadaki en
          büyük rakam bu: programın tek somut kanıtı. */}
      <section className="mt-16">
        <div className="relative overflow-hidden rounded-2xl p-[2px]">
          <div
            aria-hidden
            className="konik-kenar pointer-events-none absolute left-1/2 top-1/2 -z-0"
            style={{ width: 1400, height: 1400, margin: '-700px 0 0 -700px' }}
          />
          <div className="relative rounded-[calc(1rem-1px)] px-8 py-10 md:px-10" style={{ background: 'var(--yuzey)' }}>
            <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
              <div>
                <p
                  className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'var(--vurgu)' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--olumlu)' }} />
                  Ortaklara ödenen toplam komisyon
                </p>
                <p className="tayf-metin mt-4 whitespace-nowrap font-mono text-5xl font-semibold tabular-nums tracking-tight md:text-6xl">
                  {odenen.toLocaleString('tr-TR')} ₺
                </p>
                <p className="mt-3 max-w-md text-sm" style={{ color: 'var(--metin-2)' }}>
                  Programın açıldığı günden bu yana ortaklarımıza aktarılan tutar. Onaylanan her dönem
                  kesinleşir ve bir daha değişmez.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['28', 'ödeme yapılan ortak'],
                  ['3', 'kesintisiz ödeme dönemi'],
                  ['%100', 'zamanında ödeme oranı'],
                  ['0', 'ödeme anlaşmazlığı'],
                ].map(([deger, etiket]) => (
                  <div key={etiket} className="rounded-xl p-4" style={{ background: 'var(--yuzey-2)' }}>
                    <p className="whitespace-nowrap font-mono text-xl font-semibold tabular-nums">{deger}</p>
                    <p className="mt-1.5 text-xs leading-snug" style={{ color: 'var(--metin-2)' }}>{etiket}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ENTEGRASYONLAR */}
      <section id="entegrasyonlar" className="mt-16 scroll-mt-24">
        <Bolum etiket="Entegrasyonlar" baslik="Bağlandığımız platformlar">
          <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-center">
            <div>
              <p className="max-w-xl text-base leading-relaxed" style={{ color: 'var(--metin-2)' }}>
                Turnkey ve white-label platformlara adaptör katmanıyla bağlanıyoruz. Panelin hiçbir
                ekranı sağlayıcının alan adlarını bilmez — yeni bir backoffice eklemek tek bir
                adaptör dosyası yazmaktan ibaret.
              </p>
              <div className="mt-6 flex flex-wrap gap-x-10 gap-y-5">
                {[
                  ['2', 'canlı platform adaptörü'],
                  ['< 1 gün', 'yeni backoffice bağlama süresi'],
                  ['S2S', 'gerçek zamanlı postback'],
                ].map(([deger, etiket]) => (
                  <div key={etiket} className="min-w-0">
                    <p className="whitespace-nowrap font-mono text-xl font-semibold tabular-nums" style={{ color: 'var(--vurgu)' }}>
                      {deger}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--metin-2)' }}>{etiket}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {ENTEGRASYONLAR.map((e) => (
                <Card key={e.ad} className="p-4">
                  <p className="text-sm font-semibold tracking-tight">{e.ad}</p>
                  <p className="mt-1.5 text-xs leading-snug" style={{ color: 'var(--metin-2)' }}>{e.tur}</p>
                  <Badge
                    variant={e.durum === 'Canlı' ? 'default' : 'secondary'}
                    className="mt-3 whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                  >
                    {e.durum}
                  </Badge>
                </Card>
              ))}
            </div>
          </div>

          {/* Sonsuz kayan serit: icerik iki kez yaziliyor, -50%'de dikissiz basa doner. */}
          <div aria-hidden className="mt-8 overflow-hidden border-y py-3.5" style={{ borderColor: 'var(--kenar)' }}>
            <div className="serit flex w-max gap-12">
              {[...SERIT, ...SERIT].map((ad, i) => (
                <span
                  key={`${ad}-${i}`}
                  className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: 'var(--metin-2)', opacity: 0.6 }}
                >
                  {ad}
                </span>
              ))}
            </div>
          </div>
        </Bolum>
      </section>

      <section id="kademeler" className="scroll-mt-24">
        <Bolum
          etiket="Komisyon"
          baslik="Gelir payı kademeleri"
          aciklama="Aylık net geliriniz büyüdükçe oranınız artar. Eşikler yeni programa göre erişilebilir tutuldu."
        >
          {/* Oran tabelasi: uc ayri kart degil tek cetvel. Kademeler ayni
              olcegin basamaklari; yan yana kartlar onlari ayri urun gibi
              gosteriyordu. */}
          <Card className="overflow-hidden">
            <div
              className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 px-5 py-3.5 sm:px-6"
              style={{ background: 'var(--yuzey-2)' }}
            >
              <span className="text-xs font-semibold" style={{ color: 'var(--metin-2)' }}>Aylık net gelir</span>
              <span className="text-right text-xs font-semibold" style={{ color: 'var(--vurgu)' }}>Casino</span>
              <span className="text-right text-xs font-semibold" style={{ color: 'var(--metin-2)' }}>Spor bahis</span>
            </div>
            {KADEMELER.map((k) => (
              <div
                key={k.esik}
                className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 border-t px-5 py-4 sm:px-6"
                style={{
                  borderColor: 'var(--kenar)',
                  // Duz vurgu-yumusak yerine metalin kendisi, cok dusuk
                  // opaklikta: en yuksek kademe satiri "tek renk" degil
                  // "olcegin ucu" gibi okunsun.
                  backgroundImage: k.one
                    ? 'linear-gradient(100deg, color-mix(in srgb, var(--tayf-2) 10%, transparent), color-mix(in srgb, var(--tayf-3) 14%, transparent) 55%, color-mix(in srgb, var(--tayf-4) 10%, transparent))'
                    : undefined,
                  boxShadow: k.one ? 'inset 3px 0 0 var(--tayf-3)' : undefined,
                }}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-sm">{k.esik}</span>
                  <span className="text-xs" style={{ color: 'var(--metin-2)' }}>{k.not}</span>
                </span>
                <span
                  className={`gosterim text-right text-3xl font-extrabold tabular-nums md:text-4xl ${k.one ? 'tayf-metin' : ''}`}
                >
                  %{k.casino}
                </span>
                <span
                  className="gosterim text-right text-3xl font-extrabold tabular-nums md:text-4xl"
                  style={{ color: k.one ? 'var(--metin)' : 'var(--metin-2)' }}
                >
                  %{k.spor}
                </span>
              </div>
            ))}
          </Card>
          {/* Ornek oldugu ACIKCA yaziliyor: burada okunan bir rakami taahhut
              sanmak, ilk odemede guvensizlik uretirdi. */}
          <p className="mt-4 text-xs" style={{ color: 'var(--metin-2)' }}>
            Örnek kademelerdir. Size uygulanacak model — gelir payı, oyuncu başı ödeme (CPA) ya da
            ikisinin karışımı — başvurunuz onaylanırken belirlenir ve panelinizde yazılı olur.
          </p>
        </Bolum>
      </section>

      <section id="surec" className="scroll-mt-24">
        <Bolum etiket="Süreç" baslik="Nasıl çalışıyor">
          <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ADIMLAR.map((a, i) => (
              <Card key={a.baslik} className="p-5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-md font-mono text-sm font-semibold"
                  style={{ backgroundImage: 'var(--tayf-degrade)', color: 'var(--vurgu-metin)' }}
                >
                  {i + 1}
                </span>
                <h3 className="mt-3.5 font-semibold">{a.baslik}</h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>{a.metin}</p>
              </Card>
            ))}
          </ol>
        </Bolum>
      </section>

      <section id="panel" className="scroll-mt-24">
        <Bolum etiket="Panel" baslik="Elinizde ne olacak">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {OZELLIKLER.map((o) => (
              <Card key={o.baslik} className="p-5">
                <span className="block h-0.5 w-7 rounded" style={{ backgroundImage: 'var(--tayf-degrade)' }} />
                <h3 className="mt-4 font-semibold">{o.baslik}</h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>{o.metin}</p>
              </Card>
            ))}
          </div>
        </Bolum>
      </section>

      {/* Native <details>: JS gerekmiyor, klavye ve ekran okuyucu desteği
          kendiliğinden doğru. Elle yazılmış bir akordeonun
          erişilebilirliğini bu kadar doğru yapmak fazladan iş. */}
      <section id="sorular" className="scroll-mt-24">
        <Bolum etiket="Sorular" baslik="Merak edilenler">
          <Card className="divide-y overflow-hidden">
            {SORULAR.map((q) => (
              <details key={q.s} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center gap-3 font-medium">
                  {q.s}
                  <span
                    className="ml-auto shrink-0 text-lg transition-transform group-open:rotate-45"
                    style={{ color: 'var(--vurgu)' }}
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2.5 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>{q.c}</p>
              </details>
            ))}
          </Card>
        </Bolum>
      </section>

      <section
        className="tayf-kenar mt-16 rounded-xl px-6 py-12 text-center md:px-12"
        style={{ '--kenar-zemin': 'var(--vurgu-yumusak)' } as React.CSSProperties}
      >
        <h2 className="gosterim tayf-metin text-2xl font-extrabold tracking-tight md:text-3xl">
          Başlamak birkaç dakika.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--metin-2)' }}>
          Zorunlu alanlar dört tane. Gerisini sonra da doldurabilirsiniz.
        </p>
        <div className="mt-6 flex justify-center">
          <Button size="lg" className="kesik whitespace-nowrap" onClick={() => git('basvuru')}>
            Başvuruyu başlat
          </Button>
        </div>
      </section>
    </>
  );
}

function Bolum({
  etiket, baslik, aciklama, children,
}: {
  etiket: string;
  baslik: string;
  aciklama?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-16">
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--vurgu)' }}>
        {etiket}
      </p>
      <h2 className="gosterim mt-2.5 text-2xl font-extrabold tracking-tight md:text-3xl">{baslik}</h2>
      {aciklama && <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--metin-2)' }}>{aciklama}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

/**
 * ERİŞİM KAPISI — ortak ve yönetici ayrı uçlara gidiyor.
 *
 * Tek uçta birleştirip rolü sunucunun tahmin etmesi, aynı e-postanın
 * iki tarafta da bulunması durumunda hangi rolün kazandığını belirsiz
 * bırakırdı.
 *
 * Rol seçimi gizli bir alt link değil, iki parçalı anahtar: yönetici
 * girişini aramak zorunda kalmak bir güvenlik önlemi değil, sadece
 * sürtünmeydi.
 *
 * Maskot dar ekranda GİZLENİYOR: telefonda giriş kutusunun üstünde
 * 300px'lik bir illüstrasyon, parolasını yazmak isteyen birinin
 * önündeki engelden başka bir şey değil.
 */
function GirisKutusu({ girisYapildi, git }: { girisYapildi: () => void; git: (g: Gorunum) => void }) {
  const [yonetici, setYonetici] = useState(false);
  const [kullanici, setKullanici] = useState('');
  const [parola, setParola] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (event: React.FormEvent) => {
    event.preventDefault();
    setHata(null);
    setGonderiliyor(true);
    try {
      await (yonetici
        ? api.gonder('/api/oturum/yonetici', { kullanici, parola })
        : api.gonder('/api/oturum/ortak', { eposta: kullanici, parola }));
      girisYapildi();
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'Giriş başarısız.');
    } finally {
      setGonderiliyor(false);
    }
  };

  const rolSec = (yeni: string) => {
    setYonetici(yeni === 'yonetici');
    setHata(null);
  };

  return (
    <section className="relative py-10 lg:py-14">
      {/* Kahraman bolumuyle AYNI iki katman (izgara → aurora), ayni
          `-inset-x-10` tasmasi ve ayni `overflow-hidden` kesmesi: giris
          ekrani sahnenin bir baska acisi, ayri bir sayfa degil. */}
      <div aria-hidden className="izgara pointer-events-none absolute -inset-x-10 -top-6 bottom-0 -z-10" />
      <div aria-hidden className="tayf-aurora pointer-events-none absolute -inset-x-10 -top-6 bottom-0 -z-10" />

      <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,24rem)] lg:gap-14">
        <div className="hidden lg:block">
          <MaskotSahne boyut={320} />
          <p className="gosterim mt-2 text-center text-xl font-extrabold tracking-tight">
            Casino ve spor bahis kazancınız, tek panelde ayrı ayrı.
          </p>
          <p className="mt-2 text-center text-sm" style={{ color: 'var(--metin-2)' }}>
            Rakamlar günlük güncellenir. Onaylanan dönem bir daha değişmez.
          </p>
        </div>

        {/* Kart metal kenarli cam: pusulayla ayni malzeme. Govde DUZ —
            arkasindaki izgara formun uzerinden okunmasin diye
            `--kenar-zemin` neredeyse opak. */}
        <div
          className="tayf-kenar hud w-full rounded-xl p-6 shadow-[0_28px_56px_-28px_rgba(0,0,0,0.5)] sm:p-7"
          style={{
            '--kenar-zemin': 'color-mix(in srgb, var(--yuzey) 94%, transparent)',
            backdropFilter: 'blur(12px)',
          } as React.CSSProperties}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--vurgu)' }}>
            Erişim
          </p>
          <h1 className="gosterim isilti-metin mt-2 text-2xl font-extrabold tracking-tight">Panele giriş</h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--metin-2)' }}>
            {yonetici ? 'Program yönetimi için.' : 'Kazancınızı ve linklerinizi görmek için.'}
          </p>

          <Tabs value={yonetici ? 'yonetici' : 'ortak'} onValueChange={rolSec} className="mt-5">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ortak">Ortak</TabsTrigger>
              <TabsTrigger value="yonetici">Yönetici</TabsTrigger>
            </TabsList>
          </Tabs>

          <form className="mt-5 space-y-4" onSubmit={gonder}>
            <FormSaha
              id="giris-kullanici"
              etiket={yonetici ? 'Kullanıcı adı' : 'E-posta'}
              deger={kullanici}
              degisti={setKullanici}
              tip={yonetici ? 'text' : 'email'}
            />
            <FormSaha id="giris-parola" etiket="Parola" deger={parola} degisti={setParola} tip="password" />
            {hata && <FormHata mesaj={hata} />}
            <Button type="submit" size="lg" className="kesik w-full" disabled={gonderiliyor}>
              {gonderiliyor ? 'Giriş yapılıyor…' : 'Giriş yap'}
            </Button>
          </form>

          {/* Onceki surumde giris ekraninin cikisi yoktu: hesabi olmayan
              biri basliktaki "Basvur"u bulmak zorundaydi. */}
          <p className="mt-5 border-t pt-4 text-xs" style={{ borderColor: 'var(--kenar)', color: 'var(--metin-2)' }}>
            Hesabınız yok mu?{' '}
            <button
              type="button"
              className="whitespace-nowrap font-semibold underline underline-offset-4"
              style={{ color: 'var(--vurgu)' }}
              onClick={() => git('basvuru')}
            >
              Ortaklık başvurusu yapın
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
