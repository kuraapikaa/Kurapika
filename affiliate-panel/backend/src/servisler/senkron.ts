import { adaptorZorunlu } from '../adaptorler/kayit.js';
import { gunAnahtari, gunEkle, gunGecerliMi } from '../lib/gunler.js';
import { olcumleriYaz, sonOlculenGun } from './olcum.js';

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
}

/** Tek bir günü çekip yazar. */
export async function gunuSenkronla(kiraci: string, gun: string, simdi = new Date()): Promise<number> {
  if (!gunGecerliMi(gun)) throw new Error(`Geçersiz gün: ${gun}`);
  const adaptor = await adaptorZorunlu(kiraci);
  const olcumler = await adaptor.gunuCek(gun);
  return olcumleriYaz(kiraci, olcumler.map((o) => ({ ...o, kaynak: 'cekme' as const })), simdi);
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
  { bugun = gunAnahtari(), geriGun = 30, enFazlaGun = 60 }: { bugun?: string; geriGun?: number; enFazlaGun?: number } = {},
  simdi = new Date(),
): Promise<SenkronSonucu> {
  if (!gunGecerliMi(bugun)) throw new Error(`Geçersiz gün: ${bugun}`);

  const son = await sonOlculenGun(kiraci);
  const baslangic = son && son <= bugun ? son : gunEkle(bugun, -Math.max(0, geriGun - 1));

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
  };

  for (const gun of calisilacak) {
    try {
      sonuc.yazilanOlcum += await gunuSenkronla(kiraci, gun, simdi);
      sonuc.cekilenGun += 1;
    } catch (hata) {
      sonuc.hatali.push({ gun, mesaj: hata instanceof Error ? hata.message : String(hata) });
    }
  }
  return sonuc;
}
