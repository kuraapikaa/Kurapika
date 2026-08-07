import { useState, type ReactNode } from 'react';
import { BasvuruFormu } from './Basvuru';
import { Alan, Buton, Hata, useTema } from '../ui';
import { api } from '../api';
import { Logo, useMarka } from '../marka';

/**
 * ORTAKLIK PROGRAMI LANDING SAYFASI.
 *
 * Bu, panele giriş kapısı değil; ortaklara PAYLAŞILAN adresin ilk
 * ekranı. Buraya gelen kişi henüz ortak değil ve programı hiç
 * bilmiyor — tek işi onu ikna etmek.
 *
 * ── Tasarımdaki üç karar ──
 *
 * BÜYÜK RAKAMLAR, AZ METİN. Önceki hâli paragraflardan oluşuyordu ve
 * hiçbir şey öne çıkmıyordu. Bir ortağın sorduğu tek soru "ne
 * kazanırım"; oranlar artık sayfanın en büyük ögesi.
 *
 * TEK SÜTUN, GENİŞ NEFES. Panel yoğun olmalı (veri ekranı), landing
 * ferah. Aynı yoğunlukta bir landing "form" gibi görünüyor ve
 * okunmadan kapatılıyor.
 *
 * SORULAR AÇIKÇA CEVAPLANIYOR. Ödemenin ne zaman, hangi eşikte ve
 * hangi kuralla yapıldığı gizlenmiyor. Affiliate dünyasında en büyük
 * güvensizlik kaynağı bu belirsizlik; peşinen cevaplamak hem dürüst
 * hem de dönüşümü artıran şey.
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
    <div className="min-h-screen">
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
            <Logo marka={marka} />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Buton onClick={temaDegistir}>{koyu ? 'Aydınlık' : 'Karanlık'}</Buton>
            <Buton onClick={() => git('giris')}>Giriş</Buton>
            <Buton tur="birincil" onClick={() => git('basvuru')}>Başvur</Buton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        {bilgi && (
          <p
            className="mt-6 rounded-xl border px-4 py-3 text-sm"
            style={{ color: 'var(--olumlu)', borderColor: 'var(--olumlu)', background: 'var(--yuzey)' }}
          >
            {bilgi}
          </p>
        )}

        {gorunum === 'tanitim' && <Tanitim git={git} />}

        {gorunum === 'basvuru' && (
          <section className="mx-auto max-w-3xl py-10">
            <h1 className="text-3xl font-semibold tracking-tight">Ortaklık başvurusu</h1>
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-6 text-xs" style={{ color: 'var(--metin-2)' }}>
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
      {/* Degrade YALNIZCA kahraman bolumunde. Her bolume koymak,
          hicbirinin one cikmamasi demek olurdu. */}
      <section className="relative mt-6 overflow-hidden rounded-3xl px-6 py-16 md:px-12 md:py-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 20% 0%, color-mix(in srgb, var(--vurgu) 26%, transparent), transparent 70%),'
              + ' radial-gradient(ellipse 60% 50% at 90% 20%, color-mix(in srgb, var(--vurgu) 14%, transparent), transparent 70%)',
          }}
        />
        <p className="text-sm font-medium uppercase tracking-widest" style={{ color: 'var(--vurgu)' }}>
          Ortaklık Programı
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
          Getirdiğiniz oyuncunun geliri,<br className="hidden md:block" /> her ay payınıza yazılır.
        </h1>
        <p className="mt-5 max-w-xl text-lg" style={{ color: 'var(--metin-2)' }}>
          Kampanya başına ayrı link, günlük güncellenen rakamlar ve hangi kanalın dönüştürdüğünü
          gösteren kırılım.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Buton tur="birincil" onClick={() => git('basvuru')}>Başvuruyu başlat</Buton>
          <Buton onClick={() => git('giris')}>Hesabım var</Buton>
        </div>

        <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {[
            ['%45', 'en yüksek gelir payı'],
            ['Günlük', 'rakam güncellemesi'],
            ['5', 'alt kanal etiketi'],
            ['Aylık', 'ödeme dönemi'],
          ].map(([deger, etiket]) => (
            <div key={etiket}>
              <dt className="text-2xl font-semibold tabular-nums md:text-3xl">{deger}</dt>
              <dd className="mt-1 text-xs" style={{ color: 'var(--metin-2)' }}>{etiket}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Bolum etiket="Kazanç" baslik="Gelir payı kademeleri" aciklama="Aylık net geliriniz büyüdükçe oranınız artar.">
        <div className="grid gap-4 md:grid-cols-3">
          {KADEMELER.map((k) => (
            <div
              key={k.esik}
              className="rounded-2xl border p-6"
              style={{
                background: k.one ? 'color-mix(in srgb, var(--vurgu) 8%, var(--yuzey))' : 'var(--yuzey)',
                borderColor: k.one ? 'var(--vurgu)' : 'var(--kenar)',
              }}
            >
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--metin-2)' }}>
                {k.not}
              </span>
              <p className="mt-3 text-5xl font-semibold tabular-nums" style={{ color: k.one ? 'var(--vurgu)' : 'inherit' }}>
                %{k.oran}
              </p>
              <p className="mt-3 text-sm" style={{ color: 'var(--metin-2)' }}>{k.esik}</p>
            </div>
          ))}
        </div>
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
            <li key={a.baslik} className="rounded-2xl border p-5" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                style={{ background: 'color-mix(in srgb, var(--vurgu) 14%, transparent)', color: 'var(--vurgu)' }}
              >
                {i + 1}
              </span>
              <h3 className="mt-3 font-medium">{a.baslik}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>{a.metin}</p>
            </li>
          ))}
        </ol>
      </Bolum>

      <Bolum etiket="Panel" baslik="Elinizde ne olacak">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {OZELLIKLER.map((o) => (
            <div key={o.baslik} className="rounded-2xl border p-5" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
              <h3 className="font-medium">{o.baslik}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>{o.metin}</p>
            </div>
          ))}
        </div>
      </Bolum>

      {/* Native <details>: JS gerekmiyor, klavye ve ekran okuyucu desteği
          kendiliğinden doğru. Elle yazılmış bir akordeonun
          erişilebilirliğini bu kadar doğru yapmak fazladan iş. */}
      <Bolum etiket="Sorular" baslik="Merak edilenler">
        <div className="divide-y rounded-2xl border" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
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
        </div>
      </Bolum>

      <section
        className="mt-16 rounded-3xl border px-6 py-12 text-center md:px-12"
        style={{ background: 'color-mix(in srgb, var(--vurgu) 10%, var(--yuzey))', borderColor: 'var(--vurgu)' }}
      >
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Başlamak birkaç dakika.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--metin-2)' }}>
          Zorunlu alanlar dört tane. Gerisini sonra da doldurabilirsiniz.
        </p>
        <div className="mt-6 flex justify-center">
          <Buton tur="birincil" onClick={() => git('basvuru')}>Başvuruyu başlat</Buton>
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
    <section className="mt-16">
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--vurgu)' }}>{etiket}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{baslik}</h2>
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

  return (
    <section className="mx-auto max-w-sm py-16">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        {yonetici ? 'Yönetici girişi' : 'Ortak girişi'}
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--metin-2)' }}>
        {yonetici ? 'Panel yönetimi için.' : 'Kazancınızı ve linklerinizi görmek için.'}
      </p>

      <form
        className="space-y-4 rounded-2xl border p-6"
        style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}
        onSubmit={gonder}
      >
        <Alan
          etiket={yonetici ? 'Kullanıcı adı' : 'E-posta'}
          deger={kullanici}
          degisti={setKullanici}
          tip={yonetici ? 'text' : 'email'}
        />
        <Alan etiket="Parola" deger={parola} degisti={setParola} tip="password" />
        {hata && <Hata mesaj={hata} />}
        <Buton tip="submit" tur="birincil" tam devredisi={gonderiliyor}>
          {gonderiliyor ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </Buton>
      </form>

      <button
        type="button"
        className="mt-4 w-full text-center text-xs underline"
        style={{ color: 'var(--metin-2)' }}
        onClick={() => { setYonetici(!yonetici); setHata(null); }}
      >
        {yonetici ? 'Ortak girişine dön' : 'Yönetici girişi'}
      </button>
    </section>
  );
}
