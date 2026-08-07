import { useState } from 'react';
import { BasvuruFormu } from './Basvuru';
import { Alan, Buton, Hata, useTema } from '../ui';
import { api } from '../api';

/**
 * ORTAKLIK PROGRAMI LANDING SAYFASI.
 *
 * Giriş yapmamış ziyaretçinin gördüğü ilk ekran. Önceden burada çıplak
 * bir giriş kutusu vardı: paneli zaten bilen için yeterli, ama bu adres
 * ortaklara PAYLAŞILAN adres — ilk kez gelen biri programın ne teklif
 * ettiğini göremeden kapıyla karşılaşıyordu.
 *
 * Üç bölüm: teklif, nasıl çalıştığı, başvuru. Giriş formu tek bir
 * düğmenin arkasında; asıl amaç yeni ortak kazanmak, mevcut ortağın
 * girişi ikincil (o zaten yer imine almış oluyor).
 */

type Gorunum = 'tanitim' | 'basvuru' | 'giris';

const KADEME_ORNEGI = [
  { esik: '0 – 10.000', oran: '%25' },
  { esik: '10.000 – 50.000', oran: '%35' },
  { esik: '50.000+', oran: '%45' },
];

const ADIMLAR = [
  { baslik: 'Başvurun', metin: 'Trafiğinizi anlatın. Onay genelde aynı gün içinde.' },
  { baslik: 'Linkinizi alın', metin: 'Kampanya başına kısa link üretin; hangi kanalın çalıştığını ayrı ayrı görün.' },
  { baslik: 'Kazanın', metin: 'Gelir payı ya da oyuncu başı ödeme. Rakamlar panelde günlük.' },
];

export function Landing({ girisYapildi }: { girisYapildi: () => void }) {
  const [gorunum, setGorunum] = useState<Gorunum>('tanitim');
  const [koyu, temaDegistir] = useTema();
  const [bilgi, setBilgi] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 border-b backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--zemin) 85%, transparent)', borderColor: 'var(--kenar)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button type="button" className="text-base font-semibold" onClick={() => setGorunum('tanitim')}>
            Ortaklık Programı
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Buton onClick={temaDegistir}>{koyu ? 'Aydınlık' : 'Karanlık'}</Buton>
            <Buton onClick={() => setGorunum('giris')}>Giriş</Buton>
            <Buton tur="birincil" onClick={() => setGorunum('basvuru')}>Başvur</Buton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        {bilgi && (
          <p
            className="rounded-xl border px-4 py-3 text-sm"
            style={{ color: 'var(--olumlu)', borderColor: 'var(--olumlu)' }}
          >
            {bilgi}
          </p>
        )}

        {gorunum === 'tanitim' && (
          <>
            <section className="space-y-4">
              <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
                Getirdiğiniz oyuncunun geliri,<br />her ay payınıza yazılıyor.
              </h1>
              <p className="max-w-2xl text-base" style={{ color: 'var(--metin-2)' }}>
                Kampanya başına ayrı link, günlük güncellenen rakamlar ve hangi kanalın
                dönüştürdüğünü gösteren kırılım. Ne kazandığınızı ay sonunu beklemeden görürsünüz.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Buton tur="birincil" onClick={() => setGorunum('basvuru')}>Başvuruyu başlat</Buton>
                <Buton onClick={() => setGorunum('giris')}>Hesabım var</Buton>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--metin-2)' }}>
                Gelir payı kademeleri
              </h2>
              <div className="grid gap-3 md:grid-cols-3">
                {KADEME_ORNEGI.map((k) => (
                  <div key={k.esik} className="rounded-xl border p-4" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
                    <p className="text-2xl font-semibold">{k.oran}</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--metin-2)' }}>Aylık net gelir {k.esik}</p>
                  </div>
                ))}
              </div>
              {/* Ornek oldugu ACIKCA yaziliyor: kesin oran sozlesmeye bagli ve
                  burada okunan bir rakami taahhut sanmak, ilk odemede
                  guvensizlik uretirdi. */}
              <p className="mt-2 text-xs" style={{ color: 'var(--metin-2)' }}>
                Örnek kademelerdir. Size uygulanacak plan (gelir payı, oyuncu başı ödeme ya da
                ikisinin karışımı) başvurunuz onaylanırken belirlenir ve panelinizde yazılı olur.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--metin-2)' }}>
                Nasıl çalışıyor
              </h2>
              <ol className="grid gap-3 md:grid-cols-3">
                {ADIMLAR.map((a, i) => (
                  <li key={a.baslik} className="rounded-xl border p-4" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold"
                      style={{ background: 'var(--vurgu)', color: 'var(--vurgu-metin)' }}
                    >
                      {i + 1}
                    </span>
                    <h3 className="mt-2 font-medium">{a.baslik}</h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--metin-2)' }}>{a.metin}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border p-5" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
              <h2 className="font-medium">Ödemeler</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--metin-2)' }}>
                Dönem ay sonunda kapanır, onaylandıktan sonra rakam <strong>dondurulur</strong> —
                size söylenen tutar sonradan değişmez. Asgari ödeme tutarının altında kalan bakiye
                silinmez, sonraki aya eklenir.
              </p>
            </section>
          </>
        )}

        {gorunum === 'basvuru' && (
          <section className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold">Ortaklık başvurusu</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--metin-2)' }}>
                Yıldızlı alanlar dışında hiçbiri zorunlu değil. Trafiğinizi anlatan alanlar
                başvurunuzun değerlendirilmesini hızlandırır.
              </p>
            </div>
            <BasvuruFormu
              tamamlandi={() => {
                setBilgi('Başvurunuz alındı. Onaylandıktan sonra e-postanızla giriş yapabilirsiniz.');
                setGorunum('giris');
              }}
            />
          </section>
        )}

        {gorunum === 'giris' && <GirisKutusu girisYapildi={girisYapildi} />}
      </main>
    </div>
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
    <section className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-semibold">{yonetici ? 'Yönetici girişi' : 'Ortak girişi'}</h1>
      <form
        className="space-y-3 rounded-xl border p-5"
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
        <Buton tip="submit" tur="birincil" tam devredisi={gonderiliyor}>Giriş yap</Buton>
      </form>

      <button
        type="button"
        className="mt-3 w-full text-center text-xs underline"
        style={{ color: 'var(--metin-2)' }}
        onClick={() => { setYonetici(!yonetici); setHata(null); }}
      >
        {yonetici ? 'Ortak girişine dön' : 'Yönetici girişi'}
      </button>
    </section>
  );
}
