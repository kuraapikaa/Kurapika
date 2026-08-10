import { aktifBaglantilar, adaptorZorunlu } from '../adaptorler/kayit.js';
import { gecmisGGRDoldur } from '../servisler/gecmisGGR.js';

/**
 * GECE GGR/FİNANS TAZELEME İŞİ.
 *
 * "Geçmiş GGR'yi doldur" (`rotalar/yonetim.ts` · `/gecmis-ggr-doldur`)
 * bugüne kadar YALNIZCA admin panelden elle tetikleniyordu -- hiçbir
 * zamanlanmış iş bunu otomatik çalıştırmıyordu. Ortak portalındaki
 * "Oyuncularınız" tablosunun yatırım/çekim rakamları, çoklu-site
 * bağlantılarda TEK kaynağını buradan alıyor (bkz. `oyuncuFinansHaritasi`);
 * admin bu düğmeye basmayı unutursa (ya da hiç bilmiyorsa) rakamlar
 * kalıcı olarak donuk kalıyordu -- ortağın "yanlış ve güncel değil"
 * şikayetinin en olası kök nedeni buydu.
 *
 * ── Neden 3 gün geriye, 30 değil ──
 *
 * Bu iş HER GECE çalışıyor; bir önceki gecenin taradığı gün zaten
 * güncel. 3 günlük pencere yalnızca "bir gece atlandıysa" (deploy,
 * geçici Lynon kesintisi) telafi payı -- her tenant × her bağlantı için
 * her gece 30 gün taramak Lynon'a gereksiz yük bindirir. `gunuDoldur`
 * upsert olduğu için aynı günü tekrar taramak zararsız, sadece israf.
 *
 * ── Hatalar neden durdurmuyor ──
 *
 * Bir bağlantının oturumu düşmüş ya da rapor kimliği yanlış
 * yapılandırılmış olabilir (bkz. `gecmisGGR.ts` yorumu). Bu, DİĞER
 * bağlantıların ya da DİĞER kiracıların o geceki tazelemesini
 * engellememeli -- admin panelindeki manuel düğmenin aynı toleransı
 * (`yonetim.ts` · `/gecmis-ggr-doldur`) burada da geçerli.
 */

const GECE_GERI_GUN = 3;

export async function gecmisGGRTazele(
  kiraci: string,
  gunlukcu: { warn: (o: unknown, m: string) => void },
): Promise<void> {
  const baglantilar = await aktifBaglantilar(kiraci);
  for (const baglanti of baglantilar) {
    try {
      const adaptor = await adaptorZorunlu(kiraci, baglanti.id);
      if (!adaptor.oyuncuGunuCek) continue;
      const sonuc = await gecmisGGRDoldur(kiraci, adaptor, baglanti.id, { geriGun: GECE_GERI_GUN });
      if (sonuc.hatali.length > 0) {
        gunlukcu.warn(
          { kiraci, baglanti: baglanti.ad, hatali: sonuc.hatali.length, ornek: sonuc.hatali[0]?.mesaj },
          'Gece GGR tazeleme bazı günleri alamadı',
        );
      }
    } catch (hata) {
      gunlukcu.warn(
        { kiraci, baglanti: baglanti.ad, hata: hata instanceof Error ? hata.message : String(hata) },
        'Gece GGR tazeleme başarısız',
      );
    }
  }
}
