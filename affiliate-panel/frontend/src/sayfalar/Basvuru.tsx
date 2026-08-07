import { useState } from 'react';
import { api } from '../api';
import { Alan, Buton, Hata, Kart } from '../ui';

/**
 * ORTAK BAŞVURU FORMU.
 *
 * Zorunlu alanlar en aza indirildi: ad, e-posta, parola ve izleme
 * anahtarı. Geri kalan her şey opsiyonel.
 *
 * Sebep: başvuru formu bir kapı değil, bir bilgi toplama aracı. Yirmi
 * zorunlu alan koymak, doldurmaya üşenen ama iyi olabilecek bir ortağı
 * kapıda kaybetmek demek. Ama SORULMASI gerekiyor — bu yanıtlar boşsa
 * yönetici "bu trafiği kabul edeyim mi" sorusunu cevaplayamaz ve karar
 * tamamen sezgiye kalır.
 *
 * Beyan edilen rakamlar panelde "beyan" olarak etiketleniyor; gerçeği
 * ilk ay ölçümlerinden geliyor ve aradaki fark ortağın beyanının ne
 * kadar güvenilir olduğunu gösteren ilk sinyal.
 */

const YONTEMLER: Array<{ deger: string; etiket: string }> = [
  { deger: 'seo', etiket: 'SEO / organik' },
  { deger: 'ppc', etiket: 'Ücretli reklam (PPC)' },
  { deger: 'sosyal-medya', etiket: 'Sosyal medya' },
  { deger: 'telegram', etiket: 'Telegram' },
  { deger: 'yayin', etiket: 'Canlı yayın' },
  { deger: 'influencer', etiket: 'Influencer' },
  { deger: 'e-posta', etiket: 'E-posta' },
  { deger: 'forum', etiket: 'Forum / topluluk' },
  { deger: 'uygulama', etiket: 'Mobil uygulama' },
  { deger: 'diger', etiket: 'Diğer' },
];

const BOS = {
  ad: '', eposta: '', parola: '', ortakAnahtari: '', trafikKaynagi: '',
  odemeYontemi: '', odemeDetayi: '',
  kanallar: '', ulkeler: '', aylikOyuncu: '', aylikTrafik: '',
  mevcutProgramlar: '', tercihEdilenModel: '', aciklama: '',
};

export function BasvuruFormu({ tamamlandi }: { tamamlandi: () => void }) {
  const [form, setForm] = useState({ ...BOS });
  const [yontemler, setYontemler] = useState<string[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const yaz = (alan: keyof typeof BOS) => (deger: string) => setForm({ ...form, [alan]: deger });

  const gonder = async (event: React.FormEvent) => {
    event.preventDefault();
    setHata(null);
    setGonderiliyor(true);
    try {
      await api.gonder('/api/oturum/basvuru', {
        ad: form.ad,
        eposta: form.eposta,
        parola: form.parola,
        ortakAnahtari: form.ortakAnahtari,
        trafikKaynagi: form.trafikKaynagi,
        odemeYontemi: form.odemeYontemi,
        odemeDetayi: form.odemeDetayi,
        basvuru: {
          // Virgul ya da satir sonuyla ayrilmis; ortak hangisini
          // kullanirsa kullansin calissin.
          kanallar: form.kanallar.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
          promosyonYontemleri: yontemler,
          ulkeler: form.ulkeler,
          aylikOyuncu: form.aylikOyuncu,
          aylikTrafik: form.aylikTrafik,
          mevcutProgramlar: form.mevcutProgramlar,
          tercihEdilenModel: form.tercihEdilenModel,
          aciklama: form.aciklama,
        },
      });
      tamamlandi();
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'Başvuru gönderilemedi.');
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={gonder}>
      <Kart baslik="Hesap bilgileri">
        <div className="grid gap-3 md:grid-cols-2">
          <Alan etiket="Ad / Şirket *" deger={form.ad} degisti={yaz('ad')} />
          <Alan etiket="E-posta *" deger={form.eposta} degisti={yaz('eposta')} tip="email" />
          <Alan etiket="Parola *" deger={form.parola} degisti={yaz('parola')} tip="password" ipucu="En az 10 karakter." />
          <Alan
            etiket="İstediğiniz izleme anahtarı *"
            deger={form.ortakAnahtari}
            degisti={yaz('ortakAnahtari')}
            ipucu="Harf, rakam, nokta, alt çizgi, tire. Trafiğiniz bu anahtarla eşleşir."
          />
        </div>
      </Kart>

      <Kart baslik="Trafiğiniz">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Bu alanlar zorunlu değil ama başvurunuzun değerlendirilmesini hızlandırır.
          Rakamlar <strong>beyan</strong> olarak kaydedilir; kimse sizden kanıt istemiyor.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Alan
            etiket="Kanallarınız"
            deger={form.kanallar}
            degisti={yaz('kanallar')}
            cokSatir
            ipucu="Site, kanal ya da grup adresleri. Her satıra bir tane."
          />
          <div className="space-y-3">
            <Alan etiket="Trafiğin geldiği ülkeler" deger={form.ulkeler} degisti={yaz('ulkeler')} ipucu="örn. TR, AZ, DE" />
            <Alan etiket="Aylık oyuncu (tahmini)" deger={form.aylikOyuncu} degisti={yaz('aylikOyuncu')} tip="number" />
            <Alan etiket="Aylık ziyaretçi / tıklama (tahmini)" deger={form.aylikTrafik} degisti={yaz('aylikTrafik')} tip="number" />
          </div>
        </div>

        <div className="mt-3">
          <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--metin-2)' }}>
            Trafiği nasıl getiriyorsunuz?
          </span>
          <div className="flex flex-wrap gap-3">
            {YONTEMLER.map((y) => (
              <label key={y.deger} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={yontemler.includes(y.deger)}
                  onChange={(e) =>
                    setYontemler(e.target.checked
                      ? [...yontemler, y.deger]
                      : yontemler.filter((x) => x !== y.deger))}
                />
                <span>{y.etiket}</span>
              </label>
            ))}
          </div>
        </div>
      </Kart>

      <Kart baslik="İş bilgileri">
        <div className="grid gap-3 md:grid-cols-2">
          <Alan
            etiket="Şu an çalıştığınız programlar"
            deger={form.mevcutProgramlar}
            degisti={yaz('mevcutProgramlar')}
            ipucu="Referans niteliğinde; zorunlu değil."
          />
          <Alan
            etiket="Tercih ettiğiniz komisyon modeli"
            deger={form.tercihEdilenModel}
            degisti={yaz('tercihEdilenModel')}
            secenekler={[
              { deger: '', etiket: 'Farketmez' },
              { deger: 'gelir-payi', etiket: 'Gelir payı (RevShare)' },
              { deger: 'cpa', etiket: 'CPA (oyuncu başı)' },
              { deger: 'hibrit', etiket: 'Hibrit' },
            ]}
          />
          <Alan etiket="Ödeme yöntemi" deger={form.odemeYontemi} degisti={yaz('odemeYontemi')} ipucu="Havale, kripto…" />
          <Alan etiket="Ödeme detayı" deger={form.odemeDetayi} degisti={yaz('odemeDetayi')} />
        </div>
        <div className="mt-3">
          <Alan etiket="Eklemek istedikleriniz" deger={form.aciklama} degisti={yaz('aciklama')} cokSatir />
        </div>
      </Kart>

      {hata && <Hata mesaj={hata} />}

      <Buton tip="submit" tur="birincil" tam devredisi={gonderiliyor}>
        {gonderiliyor ? 'Gönderiliyor…' : 'Başvuruyu gönder'}
      </Buton>
    </form>
  );
}
