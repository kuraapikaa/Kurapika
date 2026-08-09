import { useState } from 'react';
import { api } from '../api';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from '../components/ui/button';
import { FormHata, FormSaha } from '../components/form-saha';

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

// Radix `Select.Item` bos string deger kabul etmiyor; "farketmez" sentinel
// olarak tutulup gonderimde '' e ceviriliyor.
const MODEL_FARKETMEZ = 'farketmez';

const BOS = {
  ad: '', eposta: '', parola: '', ortakAnahtari: '', trafikKaynagi: '',
  odemeYontemi: '', odemeDetayi: '',
  kanallar: '', ulkeler: '', aylikOyuncu: '', aylikTrafik: '',
  mevcutProgramlar: '', tercihEdilenModel: MODEL_FARKETMEZ, aciklama: '',
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
          tercihEdilenModel: form.tercihEdilenModel === MODEL_FARKETMEZ ? '' : form.tercihEdilenModel,
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
      <FormBolumu no={1} baslik="Hesap bilgileri" aciklama="Giriş için gerekli dört alan.">
        <div className="grid gap-3 md:grid-cols-2">
          <FormSaha id="bv-ad" etiket="Ad / Şirket" zorunlu deger={form.ad} degisti={yaz('ad')} />
          <FormSaha id="bv-eposta" etiket="E-posta" zorunlu deger={form.eposta} degisti={yaz('eposta')} tip="email" />
          <FormSaha id="bv-parola" etiket="Parola" zorunlu deger={form.parola} degisti={yaz('parola')} tip="password" ipucu="En az 10 karakter." />
          <FormSaha
            id="bv-anahtar"
            etiket="İstediğiniz izleme anahtarı"
            zorunlu
            deger={form.ortakAnahtari}
            degisti={yaz('ortakAnahtari')}
            ipucu="Harf, rakam, nokta, alt çizgi, tire. Trafiğiniz bu anahtarla eşleşir."
          />
        </div>
      </FormBolumu>

      <FormBolumu
        no={2}
        baslik="Trafiğiniz"
        aciklama="Hiçbiri zorunlu değil ama değerlendirmeyi hızlandırır."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FormSaha
            id="bv-kanallar"
            etiket="Kanallarınız"
            deger={form.kanallar}
            degisti={yaz('kanallar')}
            cokSatir
            ipucu="Site, kanal ya da grup adresleri. Her satıra bir tane."
          />
          <div className="space-y-3">
            <FormSaha id="bv-ulke" etiket="Trafiğin geldiği ülkeler" deger={form.ulkeler} degisti={yaz('ulkeler')} ipucu="örn. TR, AZ, DE" />
            <FormSaha id="bv-oyuncu" etiket="Aylık oyuncu (tahmini)" deger={form.aylikOyuncu} degisti={yaz('aylikOyuncu')} tip="number" />
            <FormSaha id="bv-trafik" etiket="Aylık ziyaretçi / tıklama (tahmini)" deger={form.aylikTrafik} degisti={yaz('aylikTrafik')} tip="number" />
          </div>
        </div>

        <div className="mt-3">
          <span className="mb-2 block text-xs font-medium text-muted-foreground">
            Trafiği nasıl getiriyorsunuz?
          </span>
          <div className="flex flex-wrap gap-4">
            {YONTEMLER.map((y) => (
              <label key={y.deger} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={yontemler.includes(y.deger)}
                  onCheckedChange={(kontrol) =>
                    setYontemler(kontrol
                      ? [...yontemler, y.deger]
                      : yontemler.filter((x) => x !== y.deger))}
                />
                <span>{y.etiket}</span>
              </label>
            ))}
          </div>
        </div>
      </FormBolumu>

      <FormBolumu no={3} baslik="İş bilgileri" aciklama="Ödeme ve tercihleriniz.">
        <div className="grid gap-3 md:grid-cols-2">
          <FormSaha
            id="bv-mevcut"
            etiket="Şu an çalıştığınız programlar"
            deger={form.mevcutProgramlar}
            degisti={yaz('mevcutProgramlar')}
            ipucu="Referans niteliğinde; zorunlu değil."
          />
          <FormSaha
            id="bv-model"
            etiket="Tercih ettiğiniz komisyon modeli"
            deger={form.tercihEdilenModel}
            degisti={yaz('tercihEdilenModel')}
            secenekler={[
              { deger: MODEL_FARKETMEZ, etiket: 'Farketmez' },
              { deger: 'gelir-payi', etiket: 'Gelir payı (RevShare)' },
              { deger: 'cpa', etiket: 'CPA (oyuncu başı)' },
              { deger: 'hibrit', etiket: 'Hibrit' },
            ]}
          />
          <FormSaha id="bv-odeme-yontemi" etiket="Ödeme yöntemi" deger={form.odemeYontemi} degisti={yaz('odemeYontemi')} ipucu="Havale, kripto…" />
          <FormSaha id="bv-odeme-detay" etiket="Ödeme detayı" deger={form.odemeDetayi} degisti={yaz('odemeDetayi')} />
        </div>
        <div className="mt-3">
          <FormSaha id="bv-aciklama" etiket="Eklemek istedikleriniz" deger={form.aciklama} degisti={yaz('aciklama')} cokSatir />
        </div>
      </FormBolumu>

      {hata && <FormHata mesaj={hata} />}

      <Card>
        <CardContent className="pt-6">
          <Button type="submit" className="w-full" disabled={gonderiliyor}>
            {gonderiliyor ? 'Gönderiliyor…' : 'Başvuruyu gönder'}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Beyan ettiğiniz rakamlar için kimse sizden kanıt istemiyor. Onay sonrası
            e-postanızla giriş yaparsınız.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}

/**
 * Numaralı form bölümü.
 *
 * Uzun bir formu tek kutuda göstermek "doldurulacak çok şey var"
 * hissi veriyor ve terk oranını artırıyor. Numaralandırmak formu
 * sonlu ve ölçülebilir gösteriyor: üç bölüm, ilki dört alan.
 *
 * Adımlara BÖLMEDIM (sihirbaz yapmadım): opsiyonel alanları ayrı
 * ekranlara koymak, atlanabilir olduklarını gizler ve zorunlu gibi
 * hissettirir.
 */
function FormBolumu({
  no, baslik, aciklama, children,
}: {
  no: number;
  baslik: string;
  aciklama: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {no}
        </span>
        <div>
          <h2 className="font-medium">{baslik}</h2>
          <p className="text-sm text-muted-foreground">{aciklama}</p>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
