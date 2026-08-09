import { AdaptorHatasi, type BackofficeAdaptoru } from '../adaptorler/tur.js';
import { oyunculariIcinGelirleriGuncelle, oyuncuyuYenidenAta, type YenidenAtamaDurumu } from './oyuncuEslesme.js';

/**
 * KULLANICI ADINDAN TOPLU AFFİLİATE GEÇİŞİ.
 *
 * Girdi: kullanıcı adı listesi + hedef ortak. Her kullanıcı adı için:
 *
 *   1. Backoffice'te kullanıcı adından oyuncu kimliği bulunur.
 *   2. Bulunursa backoffice'in KENDİSİNE bağlanır (`oyuncuyuBagla`) —
 *      Lynon'un kendi BTag raporu da tutarlı kalsın.
 *   3. Panelin KENDİ eşleşme kaydı da güncellenir (`oyuncuyuYenidenAta`)
 *      — hakediş hesabının dayandığı taraf bu.
 *
 * Turun SONUNDA, başarıyla taşınan tüm oyuncuların daha önce webhook'tan
 * biriken günleri hedef ortağın özetine (`olcumler`) hemen yansıtılır
 * (`oyunculariIcinGelirleriGuncelle`) — aksi halde ortak, kendisine
 * devredilen bir oyuncunun geçmiş yatırım/çekim/GGR'sini bir sonraki
 * webhook olayına kadar hiç göremezdi.
 *
 * ── Sıra bilerek İÇ ÖNCE, DIŞ SONRA ──
 *
 * İç kayıt bizim tam kontrolümüzde ve dış bir bağımlılığı yok; her
 * zaman başarılı olur. Backoffice çağrısı ağa, oturuma, Lynon'un o an
 * ayakta olmasına bağlı — başarısız olabilir. Bu yüzden backoffice
 * hatası SATIRI DÜŞÜRMÜYOR: iç eşleşme zaten doğru, yalnızca Lynon'un
 * kendi raporunun senkron olmadığı ayrı bir alanda işaretleniyor. Staff
 * bunu görüp gerekirse elle düzeltebilir.
 *
 * ── Neden ekleme değil, GEÇERSİZ KILMA (`oyuncuyuYenidenAta`) ──
 *
 * Bu panelden, kimliği doğrulanmış bir admin eylemi. "İlk kayıt kazanır"
 * kuralı yalnızca doğrulanmamış S2S bildirimleri için bir siper; burada
 * admin ground truth'u düzeltiyor ("bu oyuncular aslında X ortağına
 * ait"). Zaten başka bir ortakta olan bir oyuncuyu bilerek taşıyabilmeli.
 *
 * ── Neden bir üst sınır var ──
 *
 * Her satır en az bir, çoğu zaman iki sıralı Lynon çağrısı yapıyor.
 * Büyük bir listeyi TEK istekte işlemek, tarayıcı ile sunucu arasındaki
 * bir ara katmanın (ör. Cloudflare) zaman aşımına takılıp isteği KOPARIR
 * — sunucu işlemeye devam etse bile sonuç görülemez. Sınır aşılırsa
 * istek en baştan reddediliyor; kısmi bir tur bırakmak, hangi satırların
 * gerçekten işlendiğini belirsiz kılardı.
 */

export const TOPLU_ATAMA_LIMITI = Math.max(1, Number(process.env.AFF_TOPLU_ATAMA_LIMIT) || 40);

export type SatirDurumu = 'basarili' | 'bulunamadi' | 'hata';

export interface TopluAtamaSatiri {
  kullaniciAdi: string;
  durum: SatirDurumu;
  oyuncuId?: string;
  eslesmeDurumu?: YenidenAtamaDurumu;
  /** Önceki sahip (varsa); yalnızca eslesmeDurumu 'tasindi' ise dolu. */
  oncekiOrtakId?: string | null;
  /** Backoffice ataması iç eşleşmeden AYRI başarı/hata taşır — bkz. dosya başı açıklaması. */
  backofficeBasarili?: boolean;
  backofficeMesaji?: string;
  hata?: string;
}

export interface TopluAtamaSonucu {
  ortakAnahtari: string;
  toplam: number;
  tekrarSayisi: number;
  basarili: number;
  bulunamadi: number;
  hatali: number;
  satirlar: TopluAtamaSatiri[];
}

/** Ham metinden benzersiz, boş olmayan kullanıcı adları çıkarır. Satır sonu, virgül ya da noktalı virgülle ayrılabilir. */
export function kullaniciAdlariniAyikla(ham: string): { adlar: string[]; tekrarSayisi: number } {
  const hepsi = String(ham ?? '')
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const gorulmus = new Set<string>();
  const adlar: string[] = [];
  for (const ad of hepsi) {
    const anahtar = ad.toLocaleLowerCase('tr-TR');
    if (gorulmus.has(anahtar)) continue;
    gorulmus.add(anahtar);
    adlar.push(ad);
  }
  return { adlar, tekrarSayisi: hepsi.length - adlar.length };
}

/**
 * Adaptör DIŞARIDAN veriliyor, burada çözülmüyor.
 *
 * "Tenant için adaptörü bul" bir bağlanma (wiring) kaygısı, "verilen
 * adaptörle bu kullanıcı adlarını işle" ayrı bir iş kuralı. İkisini
 * ayırmak bu fonksiyonu sahte bir adaptörle DOĞRUDAN test edilebilir
 * kılıyor; gerçek bir Lynon bağlantısı kurmadan.
 */
export async function topluAtamaYap(
  kiraci: string,
  adaptor: BackofficeAdaptoru,
  /** Adaptörün hangi bağlantıdan (`Baglanti.id`) çözüldüğü; bkz. `sema.ts`. */
  baglantiId: string,
  hamKullaniciAdlari: string,
  ortakAnahtari: string,
  simdi = new Date(),
): Promise<TopluAtamaSonucu> {
  const temizOrtakAnahtari = String(ortakAnahtari ?? '').trim();
  if (!temizOrtakAnahtari) throw new AdaptorHatasi('ortakAnahtari zorunlu.');

  const { adlar, tekrarSayisi } = kullaniciAdlariniAyikla(hamKullaniciAdlari);
  if (!adlar.length) throw new AdaptorHatasi('En az bir kullanıcı adı girilmeli.');
  if (adlar.length > TOPLU_ATAMA_LIMITI) {
    throw new AdaptorHatasi(
      `Tek seferde en fazla ${TOPLU_ATAMA_LIMITI} kullanıcı adı işlenebilir; ${adlar.length} girildi. Listeyi bölüp tekrar deneyin.`,
    );
  }

  if (!adaptor.oyuncuAra) {
    throw new AdaptorHatasi('Bağlı backoffice kullanıcı adından arama desteklemiyor.', 409);
  }

  const satirlar: TopluAtamaSatiri[] = [];
  // Sirali: Lynon oturumu tek, paralel istek oturum durumunu bozabilir
  // ve rate limit'e takilma riski var.
  for (const kullaniciAdi of adlar) {
    try {
      const bulunan = await adaptor.oyuncuAra(kullaniciAdi);
      if (!bulunan) {
        satirlar.push({ kullaniciAdi, durum: 'bulunamadi' });
        continue;
      }

      const eslesme = await oyuncuyuYenidenAta(
        kiraci,
        {
          baglantiId,
          lynonOyuncuId: bulunan.oyuncuId,
          ortakAnahtari: temizOrtakAnahtari,
          // Zaten elde: kullanici adindan arandigi icin backoffice ayni
          // yanitta kullanici adini da dondurdu.
          kullaniciAdi: bulunan.kullaniciAdi,
          // Ayni yanitta kayit tarihi de varsa: gecis anini degil oyuncunun
          // Lynon'a GERCEKTEN kaydoldugu ani gosterelim (bkz. oyuncuAra).
          kayitTarihi: bulunan.kayitTarihi,
        },
        simdi,
      );

      const satir: TopluAtamaSatiri = {
        kullaniciAdi,
        durum: 'basarili',
        oyuncuId: bulunan.oyuncuId,
        eslesmeDurumu: eslesme.durum,
        oncekiOrtakId: eslesme.oncekiOrtakId,
      };

      if (adaptor.oyuncuyuBagla) {
        try {
          const backoffice = await adaptor.oyuncuyuBagla({ oyuncuId: bulunan.oyuncuId, ortakAnahtari: temizOrtakAnahtari });
          satir.backofficeBasarili = backoffice.basarili;
          satir.backofficeMesaji = backoffice.mesaj;
        } catch (hata) {
          satir.backofficeBasarili = false;
          satir.backofficeMesaji = (hata as Error).message;
        }
      }

      satirlar.push(satir);
    } catch (hata) {
      satirlar.push({ kullaniciAdi, durum: 'hata', hata: (hata as Error).message });
    }
  }

  // Basariyla tasinan oyuncularin ONCEDEN webhook'tan biriken gunleri
  // varsa, hedef ortagin ozetine HEMEN yansitiliyor -- aksi halde ortak,
  // kendisine devredilen oyuncunun gecmis verisini bir sonraki webhook
  // olayina kadar hic goremezdi (bkz. oyunculariIcinGelirleriGuncelle).
  const tasinanOyuncuIdler = satirlar
    .filter((s) => s.durum === 'basarili' && s.oyuncuId)
    .map((s) => s.oyuncuId!);
  await oyunculariIcinGelirleriGuncelle(kiraci, tasinanOyuncuIdler, simdi).catch(() => undefined);

  return {
    ortakAnahtari: temizOrtakAnahtari,
    toplam: satirlar.length,
    tekrarSayisi,
    basarili: satirlar.filter((s) => s.durum === 'basarili').length,
    bulunamadi: satirlar.filter((s) => s.durum === 'bulunamadi').length,
    hatali: satirlar.filter((s) => s.durum === 'hata').length,
    satirlar,
  };
}
