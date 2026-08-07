import { lynonAffiliateSummary } from '../lynonBackofficeService.js';
import { olcumleriYaz, sonOlculenGun, type YazilacakOlcum } from './cekirdek.js';

/**
 * LYNON ÇEKME ADAPTÖRÜ.
 *
 * Lynon'un kendi oyuncu raporunu BTag bazında okuyup çekirdeğin
 * modeline çevirir. Lynon'un third-party affiliate ekranına kaydolmayı
 * GEREKTİRMEZ — mevcut panel oturumuyla çalışır.
 *
 * Sınırı açıkça biliniyor: bu yol toplam düzeyinde veri veriyor. Kayıt
 * anı, ilk yatırım anı ve tıklama→dönüşüm ilişkisi olay bazında gelmez;
 * bu yüzden `ftdSayisi` burada `null` yazılır. Sıfır yazmak "hiç ilk
 * yatırım olmadı" demek olurdu, oysa doğrusu "bu yoldan ölçülemiyor".
 * İtme adaptörü eklendiğinde o alan gerçek değerini alır ve çekirdek
 * itme ölçümünü çekmenin üzerine yazdırmaz.
 */

/** Lynon özetindeki tek satır; alan adları rapor sarmalayıcısından geliyor. */
interface OzetSatiri {
  bTag?: unknown;
  totalPlayers?: unknown;
  activePlayers?: unknown;
  totalDeposits?: unknown;
  totalWithdrawals?: unknown;
  netRevenue?: unknown;
}

const sayi = (deger: unknown): number => {
  const n = Number(deger);
  return Number.isFinite(n) ? n : 0;
};

/** `YYYY-MM-DD` doğrulaması; bozuk gün anahtarı deponun tamamını kirletir. */
function gunGecerliMi(gun: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(gun);
}

export function gunEkle(gun: string, fark: number): string {
  const [y, a, g] = gun.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 1, g + fark, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Lynon özetini çekirdek ölçümlerine çevirir. */
export function ozettenOlcumler(gun: string, satirlar: OzetSatiri[]): YazilacakOlcum[] {
  return satirlar
    .map((satir): YazilacakOlcum | null => {
      const ortakAnahtari = String(satir.bTag ?? '').trim();
      if (!ortakAnahtari) return null;
      return {
        gun,
        ortakAnahtari,
        oyuncuSayisi: sayi(satir.totalPlayers),
        aktifOyuncuSayisi: sayi(satir.activePlayers),
        yatirim: sayi(satir.totalDeposits),
        cekim: sayi(satir.totalWithdrawals),
        ggr: sayi(satir.netRevenue),
        ftdSayisi: null,
        kaynak: 'cekme' as const,
      };
    })
    .filter((o): o is YazilacakOlcum => o !== null);
}

/** Tek bir günü Lynon'dan çekip yazar. */
export async function gunuCek(tenantKey: string, gun: string, simdi = new Date()): Promise<number> {
  if (!gunGecerliMi(gun)) throw new Error(`Geçersiz gün: ${gun}`);
  const ozet = await lynonAffiliateSummary(gun, gun);
  const satirlar = Array.isArray((ozet?.Data as Record<string, unknown> | undefined)?.Objects)
    ? ((ozet.Data as Record<string, unknown>).Objects as OzetSatiri[])
    : [];
  return olcumleriYaz(tenantKey, ozettenOlcumler(gun, satirlar), simdi);
}

export interface CekmeSonucu {
  cekilenGun: number;
  yazilanOlcum: number;
  hatali: Array<{ gun: string; mesaj: string }>;
}

/**
 * Eksik günleri geriye doğru tamamlar.
 *
 * İlk çalıştırmada `geriGun` kadar geçmiş çekilir; sonraki turlarda
 * yalnızca son ölçülen günden bugüne kadarki boşluk. Bugün DAHİL
 * çekilir — gün kapanmadan da rakam görmek isteniyor ve idempotent yazma
 * sayesinde gün içinde defalarca güncellenebiliyor.
 *
 * Tek bir günün hatası diğerlerini durdurmaz: bir günün raporu Lynon
 * tarafında geçici olarak alınamıyorsa, o yüzden son otuz günün hiç
 * yazılmaması orantısız olurdu.
 */
export async function eksikGunleriCek(
  tenantKey: string,
  { bugun, geriGun = 30, enFazlaGun = 60 }: { bugun: string; geriGun?: number; enFazlaGun?: number },
  simdi = new Date(),
): Promise<CekmeSonucu> {
  if (!gunGecerliMi(bugun)) throw new Error(`Geçersiz gün: ${bugun}`);

  const son = await sonOlculenGun(tenantKey);
  const baslangic = son ? gunEkle(son, 0) : gunEkle(bugun, -Math.max(0, geriGun - 1));

  const gunler: string[] = [];
  for (let g = baslangic; g <= bugun && gunler.length < enFazlaGun; g = gunEkle(g, 1)) gunler.push(g);

  const sonuc: CekmeSonucu = { cekilenGun: 0, yazilanOlcum: 0, hatali: [] };
  for (const gun of gunler) {
    try {
      sonuc.yazilanOlcum += await gunuCek(tenantKey, gun, simdi);
      sonuc.cekilenGun += 1;
    } catch (hata) {
      sonuc.hatali.push({ gun, mesaj: hata instanceof Error ? hata.message : String(hata) });
    }
  }
  return sonuc;
}
