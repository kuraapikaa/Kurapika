import { useEffect, useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { BosDurum, HataMesaji, Yukleniyor } from '../../components/durum';
import { FormSaha } from '../../components/form-saha';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { NumaraliAdim } from '../../sihirbaz';
import type { PostbackAyari as Ayar, PostbackKaydi as Kayit } from '@sunucu/sozlesme.js';

/**
 * ORTAK POSTBACK AYARI.
 *
 * ── Bu sürümde değişen: ÜÇ NUMARALI ADIM ──
 *
 * Önceki hâli teknik doğruydu ama ortağın diliyle konuşmuyordu: makro
 * listesi bir paragrafın içinde, olaylar `ilk-yatirim` gibi kod
 * anahtarlarıyla, "test" diye bir şey hiç yoktu. Postback zaten
 * ortakların en az anladığı ekran; kod anahtarı göstermek onu daha da
 * kapalı kılıyordu.
 *
 * Şimdi sıra okunuyor — adres, olaylar, test — ve her makronun yanında
 * Türkçe karşılığı var. Ekranın başında da en önemli cümle: bu ekran
 * ZORUNLU DEĞİL. Kendi tracker'ı olmayan ortak burayı atlayabilir;
 * bunu yazmamak, herkesi anlamadığı bir ayarı doldurmaya çalışmaya
 * itiyordu.
 */

/**
 * Olayların kod anahtarı ve ortağa görünen adı.
 *
 * Anahtarlar sunucunun beklediği değerler — DEĞİŞTİRİLEMEZ. Görünen ad
 * ise ortağın dilinde: `ilk-yatirim` bir kod, "İlk yatırım" bir olay.
 */
const OLAYLAR: Array<{ anahtar: string; ad: string; aciklama: string }> = [
  { anahtar: 'tiklama', ad: 'Tıklama', aciklama: 'Linkinize her tıklamada' },
  { anahtar: 'kayit', ad: 'Kayıt', aciklama: 'Oyuncu hesap açtığında' },
  { anahtar: 'ilk-yatirim', ad: 'İlk yatırım', aciklama: 'İlk parayı yatırdığında' },
  { anahtar: 'yatirim', ad: 'Her yatırım', aciklama: 'Sonraki yatırımlarda da' },
  { anahtar: 'onaylanan-komisyon', ad: 'Komisyon onayı', aciklama: 'Dönem kesinleştiğinde' },
];

/** Makroların Türkçe karşılığı; şablona yazılabilecek alanlar. */
const MAKROLAR: Array<{ makro: string; anlam: string }> = [
  { makro: '{clickid}', anlam: 'tıklama kimliği' },
  { makro: '{event}', anlam: 'olay adı' },
  { makro: '{payout}', anlam: 'tutar' },
  { makro: '{btag}', anlam: 'izleme etiketiniz' },
  { makro: '{sub1}', anlam: 'kendi etiketiniz' },
  { makro: '{sub2}', anlam: 'ikinci etiketiniz' },
  { makro: '{sub3}', anlam: 'üçüncü' },
  { makro: '{sub4}', anlam: 'dördüncü' },
  { makro: '{sub5}', anlam: 'beşinci' },
];

const BADGE_OLUMLU = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
const BADGE_OLUMSUZ = 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
const BADGE_UYARI = 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
const DURUM_SINIFI = { basarili: BADGE_OLUMLU, basarisiz: BADGE_OLUMSUZ, engellendi: BADGE_UYARI } as const;

const DURUM_ETIKETI = { basarili: 'Ulaştı', basarisiz: 'Ulaşmadı', engellendi: 'Engellendi' } as const;

export function PortalPostback() {
  const { veri, yukleniyor, hata, yenile } = useVeri<{ ayar: Ayar | null; kayitlar: Kayit[] }>('/api/portal/postback');
  const [sablon, setSablon] = useState('');
  const [secili, setSecili] = useState<string[]>([]);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);

  useEffect(() => {
    if (veri?.ayar) {
      setSablon(veri.ayar.sablon);
      setSecili(veri.ayar.olaylar);
    }
  }, [veri?.ayar]);

  const kaydet = async () => {
    setIslemHatasi(null);
    setKaydedildi(false);
    try {
      await api.yaz('/api/portal/postback', { sablon, olaylar: secili, aktif: true });
      setKaydedildi(true);
      yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'Kaydedilemedi.');
    }
  };

  if (yukleniyor) return <Yukleniyor satir={5} />;
  if (hata) return <HataMesaji mesaj={hata} />;

  // https disi bir adres sunucu tarafinda reddediliyor; ayni kurali
  // BURADA da soyluyoruz ki ortak kaydet'e basmadan gorsun.
  const httpsDegil = sablon.trim().length > 0 && !/^https:\/\//i.test(sablon.trim());

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Kendi izleme sisteminize bildirim gönderelim
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Bir oyuncu kaydolduğunda veya yatırım yaptığında sizin adresinize otomatik istek atarız.
            <strong className="text-foreground"> Kendi tracker'ınız yoksa bu sayfayı atlayabilirsiniz</strong> —
            panelinizdeki rakamlar zaten günlük güncellenir.
          </p>

          <div className="mt-6 space-y-7">
            <NumaraliAdim
              no={1}
              baslik="Adresinizi yazın"
              aciklama="https ile başlamalı. Süslü parantezli kısımları biz doldururuz."
            >
              <FormSaha
                id="ppb-sablon"
                etiket="Postback adresi"
                deger={sablon}
                degisti={setSablon}
                ipucu="https://tracker.ornek.com/pb?cid={clickid}&payout={payout}"
              />
              {httpsDegil && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Adres <code>https://</code> ile başlamıyor. Bu hâliyle kaydedilse de istek
                  gönderilmez — güvenlik gereği yalnızca https kabul ediliyor.
                </p>
              )}
            </NumaraliAdim>

            <NumaraliAdim
              no={2}
              baslik="Ne zaman haber verelim?"
              aciklama="Seçtiğiniz her olayda tek bir istek atarız."
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {OLAYLAR.map((o) => (
                  <label
                    key={o.anahtar}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm"
                    style={{
                      borderColor: secili.includes(o.anahtar) ? 'var(--vurgu)' : 'var(--kenar)',
                      background: secili.includes(o.anahtar) ? 'var(--vurgu-yumusak)' : 'var(--yuzey-2)',
                    }}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={secili.includes(o.anahtar)}
                      onCheckedChange={(c) => setSecili(c
                        ? [...secili, o.anahtar]
                        : secili.filter((x) => x !== o.anahtar))}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{o.ad}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{o.aciklama}</span>
                    </span>
                  </label>
                ))}
              </div>
            </NumaraliAdim>

            <NumaraliAdim
              no={3}
              baslik="Kaydedin"
              aciklama="Kayıttan sonra ilk gerçek dönüşümde istek gider; aşağıdaki geçmişte görünür."
            >
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={kaydet}>Kaydet</Button>
                {kaydedildi && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">Kaydedildi.</span>
                )}
              </div>
              {islemHatasi && <div className="mt-3"><HataMesaji mesaj={islemHatasi} /></div>}
            </NumaraliAdim>
          </div>

          {/* Makrolar adimlarin DISINDA: bir adim degil, basvurulacak bir
              liste. Adim olarak numaralamak "bunu da doldurmam gerekiyor"
              gibi okunurdu. */}
          <div className="mt-7 border-t pt-5">
            <p className="text-sm text-muted-foreground">
              Adresinize ekleyebileceğiniz alanlar — istediğinizi kullanın, kullanmadığınızı
              yazmanız gerekmez.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MAKROLAR.map((m) => (
                <span
                  key={m.makro}
                  className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5"
                  style={{ background: 'var(--yuzey-2)' }}
                >
                  <code className="text-xs" style={{ color: 'var(--vurgu)' }}>{m.makro}</code>
                  <span className="text-xs text-muted-foreground">{m.anlam}</span>
                </span>
              ))}
            </div>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            Güvenlik: isteği bizim sunucumuz atar, adresi siz yazarsınız. Yalnızca https kabul
            edilir; alan adı çözümlenip dönen <strong className="text-foreground">her IP</strong>{' '}
            kontrol edilir (tek bir iç IP yeter, bu klasik bir atlatma) ve yönlendirme izlenmez.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Gönderim geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          {(veri?.kayitlar ?? []).length === 0 ? (
            <BosDurum mesaj="Henüz gönderim yok." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Olay</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Açıklama</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veri!.kayitlar.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="text-xs">{gunBicimi(k.gonderildi)}</TableCell>
                    <TableCell>
                      {OLAYLAR.find((o) => o.anahtar === k.olay)?.ad ?? k.olay}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={DURUM_SINIFI[k.durum]}>
                        {DURUM_ETIKETI[k.durum] ?? k.durum}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {k.mesaj ?? (k.httpDurum ? `HTTP ${k.httpDurum}` : '—')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
