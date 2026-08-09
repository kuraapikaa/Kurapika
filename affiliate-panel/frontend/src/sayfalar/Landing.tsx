import { useState, type ReactNode } from 'react';
import { BasvuruFormu } from './Basvuru';
import { api } from '../api';
import { Logo, useMarka } from '../marka';
import { useTema } from '../lib/tema';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { FormHata, FormSaha } from '../components/form-saha';
// Maskotun tam karakter illustrasyonu (arka plani silinmis, WebP surumu).
import maskotKarakter from '../gorseller/maskot-karakter.webp';

/**
 * ORTAKLIK PROGRAMI LANDING SAYFASI.
 *
 * Bu, panele giriş kapısı değil; ortaklara PAYLAŞILAN adresin ilk
 * ekranı. Buraya gelen kişi henüz ortak değil ve programı hiç
 * bilmiyor — tek işi onu ikna etmek.
 *
 * ── Tasarım tezi: gece şehri terminali ──
 *
 * Güven sözü aynı: rakam bir kez yazılır, bir daha değişmez. Sahne
 * cyberpunk: kahraman bölümünde markanın maskotu avucundaki hologramı
 * ziyaretçiye uzatıyor; o elin hizasına DONDURULMUŞ hakediş pusulası
 * biniyor. Davet eden şehir, değişmeyen rakam — ikna eden karşıtlık bu.
 *
 * Kalan kararlar öncekiyle aynı: büyük rakamlar az metin, tek sütun
 * geniş nefes, sorulara açık cevap.
 */

type Gorunum = 'tanitim' | 'basvuru' | 'giris';

const KADEMELER = [
  { esik: '0 – 10.000 ₺', oran: '25', not: 'Başlangıç' },
  { esik: '10.000 – 50.000 ₺', oran: '35', not: 'Yaygın aralık' },
  { esik: '50.000 ₺ ve üzeri', oran: '45', not: 'En yüksek', one: true },
];

const ADIMLAR = [
  { baslik: 'Başvurun', metin: 'Trafiğinizi kısaca anlatın. Değerlendirme genelde aynı gün.' },
  { baslik: 'Linkinizi kurun', metin: 'Kampanya başına ayrı kısa link. Hangi kanalın çalıştığını tek tek görün.' },
  { baslik: 'Kazancınızı izleyin', metin: 'Tıklamadan oyuncuya, günlük güncellenen rakamlar.' },
  { baslik: 'Ödemenizi alın', metin: 'Ay kapanır, onaylanır, dondurulur. Söylenen rakam değişmez.' },
];

const OZELLIKLER = [
  { baslik: 'Kampanya başına link', metin: 'Instagram, Telegram, blog — her biri ayrı kırılım. Tek bir toplamla yetinmezsiniz.' },
  { baslik: 'Günlük rakam', metin: 'Ay sonunu beklemeden ne kazandığınızı görürsünüz.' },
  { baslik: 'Alt kanal etiketleri', metin: 'Kendi anlamlandırdığınız beş serbest alan; hangi içerik dönüştürdü, siz tanımlarsınız.' },
  { baslik: 'S2S postback', metin: 'Kendi izleme sisteminiz varsa dönüşümleri anlık olarak oraya iletiriz.' },
  { baslik: 'Alt ortak payı', metin: 'Getirdiğiniz ortakların kazancından pay alırsınız — kendi kazancınızdan kesilmeden.' },
  { baslik: 'Şeffaf hakediş', metin: 'Brütten nete her kalem yazılı: işletme payı, devir, asgari ödeme.' },
];

const SORULAR = [
  {
    s: 'Ödeme ne zaman yapılıyor?',
    c: 'Dönem ay sonunda kapanır. Onaylandıktan sonra rakam dondurulur ve bir daha değişmez — size söylenen tutar kesindir.',
  },
  {
    s: 'Asgari ödeme tutarının altında kalırsam ne olur?',
    c: 'Bakiyeniz silinmez. Sonraki aya eklenir ve eşiği geçtiğinizde birlikte ödenir.',
  },
  {
    s: 'Zararlı bir ay olursa?',
    c: 'O ay ödeme almazsınız. Zarar, planınızda devir açıksa sonraki ayın gelir tabanından düşülür; kapalıysa sıfırlanır. Hangisinin geçerli olduğu panelinizde yazılıdır.',
  },
  {
    s: 'Hangi komisyon modelleri var?',
    c: 'Gelir payı (kazancın yüzdesi), CPA (ilk yatırım yapan oyuncu başına sabit tutar) ve ikisinin karışımı olan hibrit. Size uygulanan model panelinizde açıkça görünür.',
  },
  {
    s: 'Trafiğim küçük, başvurabilir miyim?',
    c: 'Evet. Hacim tek ölçüt değil; trafiğin niteliği ve kaynağı da değerlendiriliyor. Başvuru formunda rakam beyan etmek zorunda değilsiniz.',
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
    // Giris gorunumu ARACIN kapisi: sayfa o anda butunuyle `aqua`
    // kimligine gecer (baslik ve altbilgi dahil). Vitrin ile panel
    // arasindaki esik burasi — kapida kimlik degisir, iceride surer.
    <div className={`min-h-screen ${gorunum === 'giris' ? 'aqua' : ''}`}>
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          background: 'color-mix(in srgb, var(--zemin) 88%, transparent)',
          borderColor: 'var(--kenar)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <button type="button" className="flex items-center" onClick={() => git('tanitim')}>
            <Logo marka={marka} boyut="buyuk" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={temaDegistir}>{koyu ? 'Aydınlık' : 'Karanlık'}</Button>
            <Button variant="outline" onClick={() => git('giris')}>Giriş</Button>
            <Button onClick={() => git('basvuru')}>Başvur</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        {bilgi && (
          <p
            className="mt-6 border px-4 py-3 text-sm"
            style={{ color: 'var(--olumlu)', borderColor: 'var(--olumlu)', background: 'var(--yuzey)' }}
          >
            {bilgi}
          </p>
        )}

        {gorunum === 'tanitim' && <Tanitim git={git} />}

        {gorunum === 'basvuru' && (
          <section className="mx-auto max-w-3xl py-10">
            <h1 className="gosterim text-3xl font-extrabold tracking-tight">Ortaklık başvurusu</h1>
            <p className="mt-2 text-base" style={{ color: 'var(--metin-2)' }}>
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
          </section>
        )}

        {gorunum === 'giris' && <GirisKutusu girisYapildi={girisYapildi} />}
      </main>

      <footer className="border-t" style={{ borderColor: 'var(--kenar)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-6 font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--metin-2)' }}>
          <span>{marka.ad}</span>
          <span className="ml-auto">18+ · Sorumlu oyun</span>
        </div>
      </footer>
    </div>
  );
}

function Tanitim({ git }: { git: (g: Gorunum) => void }) {
  return (
    <>
      {/* Kahraman: solda iddia, sagda gece sehri. Izgara ve neon sis
          yalnizca bu bolumde — her bolume yayilsa desen gurultu olur. */}
      <section className="relative mt-10 lg:mt-16">
        <div aria-hidden className="izgara absolute -inset-x-10 -top-10 bottom-0 -z-10" />
        <div
          aria-hidden
          className="absolute -inset-x-10 -top-10 bottom-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 55% 45% at 18% 12%, color-mix(in srgb, var(--vurgu) 14%, transparent), transparent 70%),'
              + ' radial-gradient(ellipse 45% 40% at 88% 30%, color-mix(in srgb, var(--vurgu-2) 12%, transparent), transparent 70%)',
          }}
        />

        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--vurgu)' }}>
              <span aria-hidden>{'// '}</span>Ortaklık programı
            </p>
            <h1 className="gosterim isilti-metin mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl lg:text-[3.4rem]">
              Getirdiğiniz oyuncunun geliri, her ay payınıza yazılır.
            </h1>
            <p className="mt-5 max-w-xl text-lg" style={{ color: 'var(--metin-2)' }}>
              Kampanya başına ayrı link, günlük güncellenen rakamlar — ve onaylandığı gün
              dondurulan, bir daha değişmeyen hakediş.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => git('basvuru')}>Başvuruyu başlat</Button>
              <Button size="lg" variant="outline" onClick={() => git('giris')}>Hesabım var</Button>
            </div>

            <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              {[
                ['%45', 'en yüksek gelir payı'],
                ['Günlük', 'rakam güncellemesi'],
                ['5', 'alt kanal etiketi'],
                ['Aylık', 'ödeme dönemi'],
              ].map(([deger, etiket]) => (
                <div key={etiket}>
                  <dt className="font-mono text-xl font-semibold tabular-nums md:text-2xl">{deger}</dt>
                  <dd className="mt-1 text-xs" style={{ color: 'var(--metin-2)' }}>{etiket}</dd>
                </div>
              ))}
            </dl>
          </div>

          <HoloEkran />
        </div>
      </section>

      <Bolum etiket="Kazanç" baslik="Gelir payı kademeleri" aciklama="Aylık net geliriniz büyüdükçe oranınız artar.">
        {/* Oran tabelasi: uc ayri kart degil tek cetvel. Kademeler ayni
            olcegin basamaklari; yan yana kartlar onlari uc ayri urun gibi
            gosteriyordu. */}
        <Card className="overflow-hidden rounded-none">
          {KADEMELER.map((k) => (
            <div
              key={k.esik}
              className="grid grid-cols-[1fr_auto] items-center gap-4 border-b px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,11rem)_1fr_auto] sm:px-6"
              style={{
                borderColor: 'var(--kenar)',
                background: k.one ? 'var(--vurgu-yumusak)' : undefined,
                boxShadow: k.one ? 'inset 3px 0 0 var(--vurgu)' : undefined,
              }}
            >
              <Badge variant={k.one ? 'default' : 'secondary'} className="w-fit font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
                {k.not}
              </Badge>
              <span className="col-start-1 font-mono text-sm sm:col-start-2">{k.esik}</span>
              <span
                className="gosterim col-start-2 row-span-2 row-start-1 self-center text-4xl font-extrabold tabular-nums sm:col-start-3 sm:row-span-1 md:text-5xl"
                style={{ color: k.one ? 'var(--vurgu)' : undefined }}
              >
                %{k.oran}
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

      <Bolum etiket="Süreç" baslik="Nasıl çalışıyor">
        <ol className="grid gap-4 md:grid-cols-4">
          {ADIMLAR.map((a, i) => (
            <Card key={a.baslik} className="rounded-none p-5">
              <span
                className="flex h-7 w-7 items-center justify-center font-mono text-sm font-semibold"
                style={{ background: 'color-mix(in srgb, var(--vurgu) 14%, transparent)', color: 'var(--vurgu)' }}
              >
                {i + 1}
              </span>
              <h3 className="mt-3 font-medium">{a.baslik}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>{a.metin}</p>
            </Card>
          ))}
        </ol>
      </Bolum>

      <Bolum etiket="Panel" baslik="Elinizde ne olacak">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {OZELLIKLER.map((o) => (
            <Card key={o.baslik} className="rounded-none p-5">
              <h3 className="font-medium">{o.baslik}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>{o.metin}</p>
            </Card>
          ))}
        </div>
      </Bolum>

      {/* Native <details>: JS gerekmiyor, klavye ve ekran okuyucu desteği
          kendiliğinden doğru. Elle yazılmış bir akordeonun
          erişilebilirliğini bu kadar doğru yapmak fazladan iş — Shadcn'in
          Accordion'ı buraya zorla eklenmedi. */}
      <Bolum etiket="Sorular" baslik="Merak edilenler">
        <Card className="divide-y rounded-none">
          {SORULAR.map((q) => (
            <details key={q.s} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center gap-3 font-medium">
                {q.s}
                <span className="ml-auto text-sm transition-transform group-open:rotate-45" style={{ color: 'var(--metin-2)' }} aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>{q.c}</p>
            </details>
          ))}
        </Card>
      </Bolum>

      <section
        className="mt-16 border px-6 py-12 text-center md:px-12"
        style={{ background: 'var(--vurgu-yumusak)', borderColor: 'var(--vurgu)' }}
      >
        <h2 className="gosterim text-2xl font-extrabold tracking-tight md:text-3xl">Başlamak birkaç dakika.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--metin-2)' }}>
          Zorunlu alanlar dört tane. Gerisini sonra da doldurabilirsiniz.
        </p>
        <div className="mt-6 flex justify-center">
          <Button size="lg" onClick={() => git('basvuru')}>Başvuruyu başlat</Button>
        </div>
      </section>
    </>
  );
}

/**
 * HOLO SAHNE — imza kompozisyon: maskot avucundaki hologramı uzatıyor,
 * dondurulmuş pusula o elin hizasına biniyor. Görsel şeffaf cutout;
 * çerçeve yok, ızgaranın üstünde neon sisiyle duruyor. Alt kenar
 * maskeyle eriyor ki kesik bir fotoğraf değil sahnenin parçası gibi
 * otursun.
 */
function HoloEkran() {
  const altaEriyen = 'linear-gradient(to bottom, #000 88%, transparent)';
  return (
    <div className="relative lg:mb-16">
      <img
        src={maskotKarakter}
        alt="Avucunda hologram taşıyan, mor neonlu Bugs Affiliate maskotu"
        className="mx-auto block w-full max-w-md"
        style={{
          filter: 'drop-shadow(0 0 36px color-mix(in srgb, var(--vurgu) 28%, transparent))',
          maskImage: altaEriyen,
          WebkitMaskImage: altaEriyen,
        }}
      />

      <div className="relative z-10 mx-4 -mt-20 max-w-sm sm:mx-auto lg:absolute lg:-bottom-8 lg:-left-32 lg:mx-0 lg:mt-0 lg:w-72">
        <Pusula />
      </div>
    </div>
  );
}

/**
 * PUSULA — dondurulmuş hakediş belgesi, holo-terminal çıktısı.
 *
 * Rakamlar temsilî ama TUTARLI: 84.210 − %18 işletme payı (15.158)
 * − 3.400 devreden zarar = 65.652 taban; %45'i 29.543. Hesap sırası
 * ürünün gerçek sırası (önce işletme payı, sonra devir, en son yüzde).
 *
 * Satırlar sırayla yazılıyor, kilit en son vuruluyor; vurulduktan
 * sonra arada bir neon gibi seğiriyor. `prefers-reduced-motion`
 * durumunda belge bitmiş hâliyle durur.
 */
function Pusula() {
  const kalemler: Array<{ ad: string; deger: string; vurgulu?: boolean }> = [
    { ad: 'Brüt oyuncu geliri', deger: '84.210 ₺' },
    { ad: 'İşletme payı (%18)', deger: '−15.158 ₺' },
    { ad: 'Devreden zarar', deger: '−3.400 ₺' },
    { ad: 'Gelir tabanı', deger: '65.652 ₺' },
    { ad: 'Ortak payı (%45)', deger: '29.543 ₺', vurgulu: true },
  ];

  return (
    <figure>
      <div
        className="relative rotate-[-1.2deg] border font-mono shadow-[0_28px_56px_-28px_rgba(0,0,10,0.6)]"
        style={{
          background: 'color-mix(in srgb, var(--yuzey) 82%, transparent)',
          borderColor: 'color-mix(in srgb, var(--vurgu) 35%, var(--kenar))',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          className="flex items-baseline justify-between border-b px-5 py-3 text-[11px] uppercase tracking-[0.14em]"
          style={{ borderColor: 'var(--kenar)', color: 'var(--metin-2)' }}
        >
          <span>Hakediş pusulası</span>
          <span>Mart 2026</span>
        </div>

        <div className="px-5 py-4">
          {kalemler.map((k, i) => (
            <div
              key={k.ad}
              className="pusula-satir flex items-baseline gap-2 py-1.5 text-[13px]"
              style={{ animationDelay: `${200 + i * 110}ms` }}
            >
              <span style={{ color: k.vurgulu ? 'var(--metin)' : 'var(--metin-2)' }}>{k.ad}</span>
              <span aria-hidden className="flex-1 border-b border-dotted" style={{ borderColor: 'var(--kenar)' }} />
              <span className="tabular-nums" style={{ fontWeight: k.vurgulu ? 600 : 400 }}>{k.deger}</span>
            </div>
          ))}

          <div
            className="pusula-satir mt-3 flex items-baseline gap-2 border-t pt-3"
            style={{ borderColor: 'var(--kenar)', animationDelay: '820ms' }}
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.14em]">Ödenecek</span>
            <span aria-hidden className="flex-1" />
            <span className="text-xl font-semibold tabular-nums" style={{ color: 'var(--vurgu)' }}>29.543 ₺</span>
          </div>

          <p className="pusula-satir mt-3 text-[11px]" style={{ color: 'var(--metin-2)', animationDelay: '940ms' }}>
            Onaylandı · 01.04.2026 · Bir daha değişmez.
          </p>
        </div>

        <span
          className="damga absolute -right-3 -top-3 border-2 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]"
          style={{
            color: 'var(--vurgu)',
            borderColor: 'var(--vurgu)',
            background: 'color-mix(in srgb, var(--vurgu) 10%, var(--yuzey))',
            boxShadow: 'var(--isilti)',
            animationDelay: '1150ms',
          }}
        >
          Donduruldu
        </span>
      </div>
      <figcaption className="mt-3 text-center font-mono text-[11px]" style={{ color: 'var(--metin-2)' }}>
        Örnek dönem — rakamlar temsilîdir, hesap sırası gerçektir.
      </figcaption>
    </figure>
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
    <section className="mt-16">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--vurgu)' }}>
        <span aria-hidden>{'// '}</span>{etiket}
      </p>
      <h2 className="gosterim mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">{baslik}</h2>
      {aciklama && <p className="mt-2 text-sm" style={{ color: 'var(--metin-2)' }}>{aciklama}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * Giriş kutusu — ortak ve yönetici ayrı uçlara gidiyor.
 *
 * Tek uçta birleştirip rolü sunucunun tahmin etmesi, aynı e-postanın
 * iki tarafta da bulunması durumunda hangi rolün kazandığını belirsiz
 * bırakırdı.
 *
 * Rol seçimi gizli bir alt link değil, iki parçalı anahtar: yönetici
 * girişini aramak zorunda kalmak bir güvenlik önlemi değil, sadece
 * sürtünmeydi.
 */
function GirisKutusu({ girisYapildi }: { girisYapildi: () => void }) {
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
    <section className="mx-auto max-w-sm py-16">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Giriş</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {yonetici ? 'Panel yönetimi için.' : 'Kazancınızı ve linklerinizi görmek için.'}
      </p>

      <Tabs value={yonetici ? 'yonetici' : 'ortak'} onValueChange={rolSec} className="mb-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ortak">Ortak</TabsTrigger>
          <TabsTrigger value="yonetici">Yönetici</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-6">
          <form className="space-y-4" onSubmit={gonder}>
            <FormSaha
              id="giris-kullanici"
              etiket={yonetici ? 'Kullanıcı adı' : 'E-posta'}
              deger={kullanici}
              degisti={setKullanici}
              tip={yonetici ? 'text' : 'email'}
            />
            <FormSaha id="giris-parola" etiket="Parola" deger={parola} degisti={setParola} tip="password" />
            {hata && <FormHata mesaj={hata} />}
            <Button type="submit" className="w-full" disabled={gonderiliyor}>
              {gonderiliyor ? 'Giriş yapılıyor…' : 'Giriş yap'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
