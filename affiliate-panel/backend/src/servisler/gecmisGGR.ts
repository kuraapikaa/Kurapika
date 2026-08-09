import { and, eq, inArray } from 'drizzle-orm';
import { type BackofficeAdaptoru } from '../adaptorler/tur.js';
import { VARSAYILAN_BAGLANTI_ID } from '../depolar/eslesmeDeposu.js';
import { gunAnahtari, gunEkle, gunGecerliMi } from '../lib/gunler.js';
import { oyuncuEslesmeleri, oyuncuGunlukRapor } from '../lib/sema.js';
import { veritabani } from '../lib/veritabani.js';
import { olcumleriYaz } from './olcum.js';

/**
 * GEÇMİŞE DÖNÜK GGR DOLDURMA.
 *
 * `senkron.ts`'teki normal çekme (`gunuCek`), raporu Lynon'un BTag
 * alanına göre grupluyor ve BTag'siz satırları atlıyor. Panel Lynon'un
 * third-party affiliate kaydına hiç katılmadığı için ürettiği TÜM
 * trafik BTag'siz geliyor -- normal senkron bu yüzden hep sıfır satır
 * yazıyordu (bkz. PR #112).
 *
 * Bu servis tam tersini yapıyor: raporu OYUNCU bazında, BTag'e hiç
 * bakmadan okuyor (`oyuncuGunuCek`) ve hangi oyuncunun hangi ortağa ait
 * olduğunu Lynon'a değil panelin KENDİ `oyuncu_eslesmeleri` kaydına
 * soruyor. Atıf tamamen panelin elinde; Lynon'un raporu yalnızca
 * "o gün o oyuncu ne kadar yatırdı/çekti/oynadı" sorusuna cevap veren
 * bir veri kaynağı.
 *
 * ── Neden `oyuncu_gunluk`'a değil, `oyuncu_gunluk_rapor`'a ──
 *
 * `oyuncu_gunluk`, tanımı gereği webhook'un GÜN İÇİ akışı (`+=`);
 * geçmişin FİNALİZE rakamını oraya yazmak o ayrımı bozar (bkz.
 * `sema.ts`'teki `oyuncuGunluk` yorumu) -- bu yüzden oyuncu bazlı
 * ayrıntı AYRI bir tabloya (`oyuncu_gunluk_rapor`), her turda ÜZERİNE
 * YAZILARAK (idempotent) düşüyor. Ortak bazlı toplam ayrıca bellekte
 * hesaplanıp `olcumler`e `kaynak: 'itme'` ile yazılıyor -- aynı webhook
 * köprüsü (`ortakGunlukGeliriGuncelle`) gibi, ama kaynağı Lynon'un
 * GEÇMİŞ raporu. İkisi birlikte: ortak panelde günlük özet, oyuncu
 * panelinde (bkz. `oyuncuEslesme.ts` · `oyuncuFinansHaritasi`) kişi
 * bazlı döküm -- Lynon webhook'u hiç kurulmamış olsa bile.
 *
 * ── FTD neden yine `null` ──
 *
 * İlk yatırım defteri (`ilkYatirim.ts`) yalnızca normal senkron
 * (`gunuSenkronla`) yolundan besleniyor; bu yoldan da beslemek aynı
 * günü iki kez işleyip defteri bozabilir.
 *
 * ── Neden geriye dönük veri "üretmiyoruz" değil, "kurtarıyoruz" ──
 *
 * Lynon'un raporu zaten geçmişteki her günün oyuncu bazlı rakamını
 * tutuyor -- eksik olan atıf, veri değil. Bu servis var olan veriyi
 * panelin kendi eşleşme kaydıyla birleştirip görünür kılıyor. Panelin
 * hiç bilmediği (hiçbir eşleşmesi olmayan) bir oyuncu için rakam
 * UYDURULMUYOR; o oyuncu sessizce atlanıyor.
 */

export interface GecmisGGRSonucu {
  tarananGun: number;
  eslesenOyuncuGunu: number;
  yazilanOlcum: number;
  hatali: Array<{ gun: string; mesaj: string }>;
  uyari: string | null;
}

async function gunuDoldur(
  kiraci: string,
  baglantiId: string,
  gun: string,
  adaptor: BackofficeAdaptoru,
  simdi: Date,
): Promise<{ eslesen: number; yazilan: number }> {
  const vt = veritabani();
  if (!vt) return { eslesen: 0, yazilan: 0 };

  const satirlar = await adaptor.oyuncuGunuCek!(gun);

  // GECICI TANI: onceki turda bu satir SADECE satirlar.length > 0 ise
  // calisiyordu -- ikinci baglanti hicbir gun icin log basmadi, bu da onun
  // HER GUN 0 satir dondurdugu (rapor bos) mu yoksa hic cagrilmadigi mi
  // belirsiz birakiyordu. Artik HER turda basiyor. `railway logs` ile
  // okunacak, kok neden bulununca ayri bir PR'da kaldirilacak.
  {
    const kayitliOrnek = await vt
      .select({ lynonOyuncuId: oyuncuEslesmeleri.lynonOyuncuId })
      .from(oyuncuEslesmeleri)
      .where(and(eq(oyuncuEslesmeleri.kiraci, kiraci), eq(oyuncuEslesmeleri.baglantiId, baglantiId)))
      .limit(5);
    console.error('[gecmis-ggr-tani2] gun', {
      kiraci, baglantiId, gun,
      raporSatirSayisi: satirlar.length,
      raporOrnekIdler: satirlar.slice(0, 5).map((s) => s.oyuncuId),
      kayitliOrnekIdler: kayitliOrnek.map((e) => e.lynonOyuncuId),
    });
  }

  if (satirlar.length === 0) return { eslesen: 0, yazilan: 0 };

  const oyuncuIdler = [...new Set(satirlar.map((s) => s.oyuncuId))];
  const eslesmeler = await vt
    .select({
      lynonOyuncuId: oyuncuEslesmeleri.lynonOyuncuId,
      ortakId: oyuncuEslesmeleri.ortakId,
      ortakAnahtari: oyuncuEslesmeleri.ortakAnahtari,
    })
    .from(oyuncuEslesmeleri)
    .where(and(
      eq(oyuncuEslesmeleri.kiraci, kiraci),
      inArray(oyuncuEslesmeleri.lynonOyuncuId, oyuncuIdler),
      // Bu rapor TEK bir Lynon sitesinden geliyor; oyuncu kimlikleri
      // yalnizca o site icinde benzersiz. Baglanti filtresi olmadan
      // baska bir sitedeki ayni numarali ID'ye sahip FARKLI bir oyuncuyu
      // yanlislikla eslestirebilirdi (bkz. sema.ts).
      eq(oyuncuEslesmeleri.baglantiId, baglantiId),
    ));
  const eslesmeMap = new Map(eslesmeler.map((e) => [e.lynonOyuncuId, e]));

  const gruplar = new Map<string, {
    ortakAnahtari: string;
    oyuncular: Set<string>;
    aktifler: Set<string>;
    yatirim: number;
    cekim: number;
    bahis: number;
    kazanc: number;
  }>();

  let eslesen = 0;
  for (const satir of satirlar) {
    const eslesme = eslesmeMap.get(satir.oyuncuId);
    // Panelin hic bilmedigi oyuncu -- hangi ortaga yazilacagi bilinmiyor,
    // uydurmak yerine sessizce atlaniyor.
    if (!eslesme) continue;
    eslesen += 1;

    // Oyuncu bazli ayrinti -- rapor bu gun icin KESIN toplami veriyor,
    // ONCEKI yazimin UZERINE geciyor (webhook'un += biriktirmesinden
    // FARKLI, bkz. dosya basi ve sema.ts).
    await vt
      .insert(oyuncuGunlukRapor)
      .values({
        kiraci, baglantiId, gun, oyuncuId: satir.oyuncuId,
        yatirim: satir.yatirim, cekim: satir.cekim, bahis: satir.bahis, kazanc: satir.kazanc,
        guncellendi: simdi,
      })
      .onConflictDoUpdate({
        target: [oyuncuGunlukRapor.kiraci, oyuncuGunlukRapor.baglantiId, oyuncuGunlukRapor.gun, oyuncuGunlukRapor.oyuncuId],
        set: {
          yatirim: satir.yatirim, cekim: satir.cekim, bahis: satir.bahis, kazanc: satir.kazanc,
          guncellendi: simdi,
        },
      });

    const grup = gruplar.get(eslesme.ortakId) ?? {
      ortakAnahtari: eslesme.ortakAnahtari,
      oyuncular: new Set<string>(),
      aktifler: new Set<string>(),
      yatirim: 0,
      cekim: 0,
      bahis: 0,
      kazanc: 0,
    };
    grup.oyuncular.add(satir.oyuncuId);
    if (satir.yatirim || satir.cekim || satir.bahis || satir.kazanc) grup.aktifler.add(satir.oyuncuId);
    grup.yatirim += satir.yatirim;
    grup.cekim += satir.cekim;
    grup.bahis += satir.bahis;
    grup.kazanc += satir.kazanc;
    gruplar.set(eslesme.ortakId, grup);
  }

  if (gruplar.size === 0) return { eslesen, yazilan: 0 };

  const yazilacak = [...gruplar.values()].map((g) => ({
    gun,
    ortakAnahtari: g.ortakAnahtari,
    oyuncuSayisi: g.oyuncular.size,
    aktifOyuncuSayisi: g.aktifler.size,
    yatirim: g.yatirim,
    cekim: g.cekim,
    ggr: g.bahis - g.kazanc,
    ftdSayisi: null,
    kaynak: 'itme' as const,
  }));

  const yazilan = await olcumleriYaz(kiraci, yazilacak, simdi);
  return { eslesen, yazilan };
}

/**
 * Bir tarih aralığını geriye doğru tarar ve eşleşen oyuncuların
 * rakamlarını `olcumler`e yazar. `gunuSenkronla`nın "eksik günleri
 * tamamla" mantığıyla aynı sınırlama deseni: tek bir günün hatası
 * turun tamamını durdurmaz, çok geniş aralık bir turda kesilir.
 *
 * Adaptör `topluAtamaYap` deseninde DIŞARIDAN veriliyor (çağıran
 * `adaptorZorunlu` ile çözüyor) -- test edilebilirlik için: gerçek bir
 * Lynon bağlantısı olmadan sahte adaptörle sınanabiliyor.
 *
 * `baglantiId`, adaptörün HANGİ bağlantıdan (`Baglanti.id`, bkz.
 * `adaptorler/kayit.ts`) çözüldüğünü söylüyor -- rapordaki oyuncu
 * kimlikleri yalnızca o bağlantının/site'ın içinde benzersiz. Birden
 * çok bağlantısı olan bir kiracıda, çağıran (bkz. `rotalar/yonetim.ts`)
 * bu fonksiyonu her AKTİF bağlantı için ayrı ayrı çağırır.
 */
export async function gecmisGGRDoldur(
  kiraci: string,
  adaptor: BackofficeAdaptoru,
  baglantiId: string = VARSAYILAN_BAGLANTI_ID,
  { bugun = gunAnahtari(), geriGun = 30, enFazlaGun = 60 }: { bugun?: string; geriGun?: number; enFazlaGun?: number } = {},
  simdi = new Date(),
): Promise<GecmisGGRSonucu> {
  if (!gunGecerliMi(bugun)) throw new Error(`Geçersiz gün: ${bugun}`);
  if (!adaptor.oyuncuGunuCek) {
    throw new Error('Bu backoffice bağlantısı geçmişe dönük oyuncu verisini desteklemiyor.');
  }

  const gunler: string[] = [];
  for (let g = gunEkle(bugun, -Math.max(0, geriGun - 1)); g <= bugun; g = gunEkle(g, 1)) gunler.push(g);
  const kesildi = gunler.length > enFazlaGun;
  const calisilacak = kesildi ? gunler.slice(0, enFazlaGun) : gunler;

  const sonuc: GecmisGGRSonucu = {
    tarananGun: 0,
    eslesenOyuncuGunu: 0,
    yazilanOlcum: 0,
    hatali: [],
    uyari: kesildi
      ? `${gunler.length} günlük aralık var; bu turda ilk ${enFazlaGun} gün tarandı. Kalanı için tekrar çalıştırın.`
      : null,
  };

  for (const gun of calisilacak) {
    try {
      const { eslesen, yazilan } = await gunuDoldur(kiraci, baglantiId, gun, adaptor, simdi);
      sonuc.eslesenOyuncuGunu += eslesen;
      sonuc.yazilanOlcum += yazilan;
      sonuc.tarananGun += 1;
    } catch (hata) {
      const mesaj = hata instanceof Error ? hata.message : String(hata);
      // GECICI TANI: [gecmis-ggr-tani2] hicbir gun icin Taco baglantisinda
      // basmadi -- demek ki oyuncuGunuCek HER gun burada firlatiyor, ama
      // gercek mesaj hic loglanmiyordu (yalnizca sonuc.hatali'ya yaziliyor,
      // UI'da sadece SAYISI gosteriliyor). `railway logs` ile okunacak, kok
      // neden bulununca kaldirilacak.
      console.error('[gecmis-ggr-tani3] hata', { kiraci, baglantiId, gun, mesaj });
      sonuc.hatali.push({ gun, mesaj });
    }
  }
  return sonuc;
}
