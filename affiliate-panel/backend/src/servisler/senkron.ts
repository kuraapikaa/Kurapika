import type { BackofficeAdaptoru } from '../adaptorler/tur.js';
import { gunAnahtari, gunEkle, gunGecerliMi } from '../lib/gunler.js';
import { ftdDurumu, ftdIsle } from './ilkYatirim.js';
import { olcumleriYaz, sonOlculenGun } from './olcum.js';
import { ftdBonuslariniIsle } from './otoBonus.js';

/**
 * ÇEKME SENKRONU.
 *
 * Adaptörden gün gün ölçüm çekip çekirdeğe yazıyor. Hangi backoffice
 * olduğunu BİLMİYOR — tek gördüğü `BackofficeAdaptoru`.
 *
 * ── Neden gün gün ──
 *
 * Tek bir "son 30 gün" isteği daha az çağrı olurdu ama tek bir toplam
 * döndürürdü; günlük kırılım kaybolurdu ve "hangi gün düştü" sorusu
 * cevapsız kalırdı. Ölçümün değeri günlük olmasında.
 */

export interface SenkronSonucu {
  cekilenGun: number;
  yazilanOlcum: number;
  hatali: Array<{ gun: string; mesaj: string }>;
  /** Sınıra takıldıysa dolu; sessiz kesme panelde "tamam" gibi görünürdü. */
  uyari: string | null;
  /** İlk yatırım ölçümünün durumu; panelde açıkça gösteriliyor. */
  ftd: { olculuyorMu: boolean; olcumBaslangici: string | null; defterdekiOyuncu: number };
}

/**
 * Tek bir günü çekip yazar.
 *
 * `kalibrasyonMu`, ilk yatırım defteri henüz dolmadan çekilen günler
 * için: o günlerin oyuncuları deftere yazılıyor ama FTD `null`
 * dönüyor. Defter boşken herkes "ilk kez yatırım yapıyor" görünür ve
 * o rakam gerçek gibi durur — en tehlikelisi bu.
 */
export async function gunuSenkronla(
  kiraci: string,
  adaptor: BackofficeAdaptoru,
  gun: string,
  { kalibrasyonMu = false }: { kalibrasyonMu?: boolean } = {},
  simdi = new Date(),
): Promise<number> {
  if (!gunGecerliMi(gun)) throw new Error(`Geçersiz gün: ${gun}`);
  const olcumler = await adaptor.gunuCek(gun);

  const zenginlestirilmis = [];
  // Ilk yatirimi bu turda tespit edilenler; oto bonusa gidecekler.
  // Kume, ayni oyuncunun iki ortagin satirinda gorunmesini tekillestirir.
  const yeniFtdliler = new Set<string>();
  for (const olcum of olcumler) {
    const { yatiranOyuncular, ...temel } = olcum;
    // Adaptor FTD'yi kendi biliyorsa ona dokunmuyoruz; bilmiyorsa ve
    // yatiran oyuncu listesi verdiyse defterden turetiliyor.
    let ftd = temel.ftdSayisi;
    if (ftd === null && yatiranOyuncular) {
      const sonuc = await ftdIsle(kiraci, gun, yatiranOyuncular, { kalibrasyonMu });
      ftd = sonuc.ftdSayisi;
      for (const oyuncu of sonuc.yeniOyuncular) yeniFtdliler.add(oyuncu);
    }
    zenginlestirilmis.push({ ...temel, ftdSayisi: ftd, kaynak: 'cekme' as const });
  }

  const yazilan = await olcumleriYaz(kiraci, zenginlestirilmis, simdi);

  // Oto bonus OLCUMDEN SONRA ve firlatmadan: bonus tarafindaki hicbir
  // aksaklik gunun olcumunu dusurmemeli. Servis kendi icinde aktiflik,
  // yapilandirma ve tazelik kontrolu yapiyor.
  if (yeniFtdliler.size > 0) {
    await ftdBonuslariniIsle(kiraci, gun, [...yeniFtdliler], simdi);
  }

  return yazilan;
}

/**
 * Eksik günleri geriye doğru tamamlar.
 *
 * İlk çalıştırmada `geriGun` kadar geçmiş çekilir; sonraki turlarda
 * yalnızca son ölçülen günden bugüne kadarki boşluk. Bugün DAHİL
 * çekilir — gün kapanmadan da rakam görmek isteniyor ve idempotent
 * yazma sayesinde gün içinde defalarca güncellenebiliyor.
 *
 * Tek bir günün hatası diğerlerini DURDURMAZ: bir günün raporu geçici
 * olarak alınamıyorsa, o yüzden son otuz günün hiç yazılmaması
 * orantısız olurdu.
 */
export async function eksikGunleriSenkronla(
  kiraci: string,
  adaptor: BackofficeAdaptoru,
  { bugun = gunAnahtari(), geriGun = 30, enFazlaGun = 60 }: { bugun?: string; geriGun?: number; enFazlaGun?: number } = {},
  simdi = new Date(),
): Promise<SenkronSonucu> {
  if (!gunGecerliMi(bugun)) throw new Error(`Geçersiz gün: ${bugun}`);

  const son = await sonOlculenGun(kiraci);
  const baslangic = son && son <= bugun ? son : gunEkle(bugun, -Math.max(0, geriGun - 1));

  // Defter bos ya da yarim doluysa BU TURUN TAMAMI kalibrasyon: gunler
  // deftere yaziliyor, FTD yazilmiyor. Sonraki turlar olcum turu.
  const ftd = await ftdDurumu(kiraci);
  const kalibrasyonTuru = !ftd.olculuyorMu;

  const gunler: string[] = [];
  for (let g = baslangic; g <= bugun; g = gunEkle(g, 1)) gunler.push(g);

  const kesildi = gunler.length > enFazlaGun;
  const calisilacak = kesildi ? gunler.slice(0, enFazlaGun) : gunler;

  const sonuc: SenkronSonucu = {
    cekilenGun: 0,
    yazilanOlcum: 0,
    hatali: [],
    uyari: kesildi
      ? `${gunler.length} günlük boşluk var; bu turda ilk ${enFazlaGun} gün çekildi. Kalanı için senkronu tekrar çalıştırın.`
      : null,
    ftd,
  };

  for (const gun of calisilacak) {
    try {
      // Son gun HARIC hepsi kalibrasyon: defterin dolmasi icin gecmis
      // gerekiyor, ama son gunde olcume gecmezsek FTD hic baslamaz.
      const sonGunMu = gun === calisilacak[calisilacak.length - 1];
      sonuc.yazilanOlcum += await gunuSenkronla(
        kiraci,
        adaptor,
        gun,
        { kalibrasyonMu: kalibrasyonTuru && !sonGunMu },
        simdi,
      );
      sonuc.cekilenGun += 1;
    } catch (hata) {
      sonuc.hatali.push({ gun, mesaj: hata instanceof Error ? hata.message : String(hata) });
    }
  }
  sonuc.ftd = await ftdDurumu(kiraci);
  return sonuc;
}
