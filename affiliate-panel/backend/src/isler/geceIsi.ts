import { ayAnahtari, gunAnahtari, gunEkle } from '../lib/gunler.js';
import { donemHesapla } from '../servisler/hakedis.js';
import { ortaklariListele } from '../servisler/ortaklar.js';
import { donemdeYazilan, hareketEkle } from '../servisler/cuzdan.js';

/**
 * GECE HAKEDİŞ İŞİ.
 *
 * Her gece dönem hakedişini yeniden hesaplayıp ortakların cüzdanına
 * ARADAKİ FARKI yazıyor.
 *
 * ── Neden "günün kazancı" değil de FARK ──
 *
 * Kademeli oranlar, asgari ödeme ve zarar devri DÖNEM kavramları:
 * "%30'a hangi ciroda çıkıldığı" ayın tamamına bakılarak bulunuyor.
 * Her günü tek başına hesaplayıp toplamak, ayın ortasında kademe
 * atlayan bir ortağa yanlış oran uygulardı.
 *
 * Bu yüzden her gece ayın tamamı yeniden hesaplanıyor ve cüzdana
 * yalnızca "bugüne kadar yazılmış olanla arasındaki fark" ekleniyor.
 * Fark negatif de olabilir (geç gelen bir düzeltme ayın toplamını
 * düşürürse); defter bunu da taşıyor.
 *
 * ── Cüzdana NE yazılıyor ──
 *
 * `gelirPayi + cpaPayi + kademeGeliri` — yani O DÖNEMDE KAZANILAN.
 * `hakedis.toplam` DEĞİL: onun içinde önceki dönemden devreden ödeme
 * de var ve onu yazmak geçen ayın kazancını ikinci kez alacak
 * kaydetmek olurdu. Ödenmemiş kazanç zaten cüzdan bakiyesinde duruyor.
 *
 * ── Aynı gece iki kez çalışırsa ──
 *
 * `kaynakAnahtari` benzersiz; ikinci yazma veritabanı tarafından
 * reddediliyor. İki konteyner aynı anda çalışsa bile ortak iki kez
 * alacaklandırılmıyor.
 */

/**
 * Ayın ilk günlerinde bir önceki ay da yeniden hesaplanıyor.
 *
 * Backoffice ölçümleri gecikmeli gelebiliyor; ay kapandıktan sonra
 * düşen bir kayıt, bir daha hiç bakılmayan bir aya yazılırsa cüzdana
 * hiç yansımazdı.
 */
export const GERIYE_BAKIS_GUNU = 5;

export interface GeceSonucu {
  kiraci: string;
  gun: string;
  aylar: string[];
  yazilanHareket: number;
  toplamFark: number;
}

const kurusa = (deger: number): number => Math.round(deger * 100) / 100;

/** İşlenecek aylar: dünün ayı, ayın başındaysak bir öncekiyle birlikte. */
export function islenecekAylar(dun: string): string[] {
  const aylar = [ayAnahtari(dun)];
  const gunSayisi = Number(dun.slice(8, 10));
  if (gunSayisi <= GERIYE_BAKIS_GUNU) {
    const oncekiAy = ayAnahtari(gunEkle(`${dun.slice(0, 8)}01`, -1));
    if (!aylar.includes(oncekiAy)) aylar.push(oncekiAy);
  }
  return aylar;
}

export async function geceHakedisiIsle(kiraci: string, simdi = new Date()): Promise<GeceSonucu> {
  const dun = gunEkle(gunAnahtari(simdi), -1);
  const aylar = islenecekAylar(dun);

  const ortaklar = await ortaklariListele(kiraci);
  const kimlikler = new Map(ortaklar.map((o) => [o.ortakAnahtari, o.id]));

  let yazilanHareket = 0;
  let toplamFark = 0;

  for (const ay of aylar) {
    const donem = await donemHesapla(kiraci, ay, {}, simdi);

    for (const satir of donem.satirlar) {
      const ortakId = kimlikler.get(satir.ortakAnahtari);
      // Ortak silinmisse cuzdana yazacak bir kimlik yok. Sessizce
      // atlamak yerine bu durum donem uyarilarinda zaten gorunuyor.
      if (!ortakId) continue;

      const donemKazanci = kurusa(
        satir.hakedis.gelirPayi + satir.hakedis.cpaPayi + satir.kademeGeliri,
      );
      const yazilan = await donemdeYazilan(kiraci, ortakId, ay);
      const fark = kurusa(donemKazanci - yazilan);

      // Kurus altindaki farklar yazilmiyor: her gece sifira yakin bir
      // hareket uretmek defteri okunamaz hale getirirdi.
      if (Math.abs(fark) < 0.01) continue;

      const { eklendi } = await hareketEkle(kiraci, {
        ortakId,
        tur: 'hakedis',
        tutar: fark,
        donem: ay,
        aciklama: `${ay} dönemi hakediş tahakkuku (${dun} gecesi)`,
        kaynakAnahtari: `hakedis:${ay}:${satir.ortakAnahtari}:${dun}`,
      }, simdi);

      if (eklendi) {
        yazilanHareket += 1;
        toplamFark = kurusa(toplamFark + fark);
      }
    }
  }

  return { kiraci, gun: dun, aylar, yazilanHareket, toplamFark };
}
