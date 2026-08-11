/**
 * Hedef bakiye kilidi isi.
 *
 * "100 Telegram Freespin ile bakiye 2500₺'yi gectigi an oyuncunun TUM
 * (casino + spor) bahis yetkisi kapatilsin VE bakiyesi 1000₺'ye
 * sabitlensin — bonus istismarina karsi kazanc tavani."
 *
 * Ikinci kisim (bakiye sabitleme) 11.08.2026'da eklendi: ilk surum
 * yalnizca bahsi kapatiyordu, cekim/yatirima hic dokunmuyordu. Bakiyeyi
 * indirmek GERCEK PARAYI etkiliyor — bu yuzden asagidaki KAPSAM/KURU
 * CALISMA cercevesi ozellikle bu adim icin daha da onemli.
 *
 * Kararin kendisi `services/hedefBakiyeKilidi` icinde ve testli. Bu
 * dosya yalnizca sirali is akisi: kimi kontrol edecegiz, bakiyesi ne,
 * kisitlar zaten acik mi, degilse yaz, bakiye hedefin ustundeyse indir,
 * sonra denetime dus.
 *
 * ── Guvenlik cercevesi ────────────────────────────────────────────────
 *
 * Bu is GERCEK oyuncularin bahsini kapatiyor VE bakiyesini indiriyor.
 * Dort kisitla cerceveledim:
 *
 *   1. KAPSAM — yalnizca hedef kampanyanin bonusunu son birkac gunde
 *      almis VE omur boyu bonus gecmisinde BASKA HICBIR bonus/kampanya
 *      olmayan oyuncular (11.08.2026: "sadece Telegram Katıl Bonusu"
 *      sarti eklendi — baska kampanyalari da olan gercek katilimcilar
 *      bu akistan MUAF). Sitenin tamamina uygulanan bir kural degil.
 *   2. BEYAZ LISTE — `withdraw` ve `deposit` bu yoldan kapatilamaz.
 *      Hedefe ulasan oyuncunun parasini cekebilmesi gerekir. Sabitleme
 *      hedefi (varsayilan 1000₺) esikten (2500₺) DUSUK olmali — aksi
 *      halde bakiye asla esigin altina inmez, oyuncu her turda tekrar
 *      "hedefi asmis" sayilir.
 *   3. KURU CALISMA — `HEDEF_BAKIYE_KURU=1` ile karar verilir, loglanir,
 *      Lynon'a yazilmaz/bakiye dusurulmez. Bakiye indirme gibi GERI
 *      ALINAMAYAN bir adim eklerken ilk deploy bununla izlenmeli.
 *   4. TEK SEFERLIK — bir oyuncu bir kez "kapatilanlar"a yazildiktan
 *      sonra bir daha HIC kontrol edilmez (asagidaki filtre). Oyuncu
 *      yeniden para yatirip esigi tekrar gecerse bu is tekrar tetiklenmez;
 *      kapsam bilerek dar tutuluyor.
 *
 * Her yazma denetim kaydina duser; bir oyuncunun bahsi/bakiyesi neden
 * degisti sorusu kayitlardan cevaplanabilir olmali.
 */
import { config } from '../config.js';
import { audit } from '../lib/auditLog.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import {
  bonusOturumlariniTopla,
  lynonAdjustPlayerMainAccount,
  lynonPlayerMainBalance,
  lynonPlayerRestrictions,
  lynonSetPlayerRestriction,
} from '../services/lynonBackofficeService.js';
import {
  hedefBakiyeDuzeltmeNotu,
  hedefBakiyeDuzeltmeTutari,
  hedefKarari,
  hedefNotu,
  kilitAdaylari,
  kisitliMi,
  sadeceHedefBonusuVarMi,
} from '../services/hedefBakiyeKilidi.js';

const NAMESPACE = 'hedef-bakiye-kilidi';

type KilitKaydi = {
  /** playerId → ISO zaman. Ayni oyuncuya tekrar tekrar yazmamak icin. */
  kapatilanlar: Record<string, string>;
};

export type HedefBakiyeSonucu = {
  atlandi?: string;
  aday: number;
  kontrol: number;
  kapatilan: number;
  hata: number;
};

async function kayitOku(tenantKey: string): Promise<KilitKaydi> {
  return readStoredDocument<KilitKaydi>({
    tenantKey,
    namespace: NAMESPACE,
    fallback: { kapatilanlar: {} },
  });
}

export async function runHedefBakiyeJob(tenantKey = 'default'): Promise<HedefBakiyeSonucu> {
  const ayar = config.hedefBakiye;
  const sonuc: HedefBakiyeSonucu = { aday: 0, kontrol: 0, kapatilan: 0, hata: 0 };

  if (!ayar.aktif) return { ...sonuc, atlandi: 'Hedef bakiye kilidi kapalı (HEDEF_BAKIYE_KILIDI=0).' };

  const { oturumlar } = await bonusOturumlariniTopla();
  const adaylar = kilitAdaylari(oturumlar, {
    campaignId: ayar.kampanyaId,
    bonusId: ayar.bonusId,
    gunPenceresi: ayar.gunPenceresi,
  }).filter((playerId) =>
    // SAFLIK FILTRESI: oyuncunun omur boyu bonus gecmisinde bu hedef
    // bonus/kampanya DISINDA baska hicbir sey yoksa devam et. Baska
    // kampanyalari da olan (gercek katilim gecmisi olan) bir oyuncu
    // bu akistan MUAF — yalnizca "sadece bedava bonus icin gelmis"
    // hesaplar hedefleniyor.
    sadeceHedefBonusuVarMi(oturumlar, playerId, { campaignId: ayar.kampanyaId, bonusId: ayar.bonusId }),
  );
  sonuc.aday = adaylar.length;
  if (adaylar.length === 0) return sonuc;

  const kayit = await kayitOku(tenantKey);
  // Daha önce kapatılmış oyuncu tekrar sorgulanmaz; uca boşuna yük olmaz.
  const sira = adaylar
    .filter((playerId) => !kayit.kapatilanlar[String(playerId)])
    .slice(0, Math.max(1, ayar.turBasinaOyuncu));

  let degisti = false;

  for (const playerId of sira) {
    sonuc.kontrol += 1;
    try {
      /**
       * ONCE BAKIYE, SONRA KISIT.
       *
       * Ilk surum ikisini `Promise.all` ile birlikte okuyordu. Adaylarin
       * ezici cogunlugu esigin ALTINDA; onlar icin kisit yanitina hic
       * bakilmiyordu ama istek yine de atiliyordu. Her turda aday sayisi
       * kadar bosa istek demekti — dakikada bir calisan bir iste bu,
       * gunde on binlerce cagri ve dogrudan Railway faturasi.
       *
       * Kisit yalnizca bakiye esigi GECTIGINDE okunur.
       */
      const bakiye = await lynonPlayerMainBalance(playerId);
      if (!hedefKarari({ bakiye, esik: ayar.esik, zatenKisitli: false }).kapat) continue;

      const mevcutKisitlar = await lynonPlayerRestrictions(playerId);
      const eksikKisitlar = ayar.kisitlar.filter((k) => !kisitliMi(mevcutKisitlar, k));
      // "zatenKisitli" artik TEK bir kisit degil, TUMU + bakiyenin de
      // zaten hedefte olmasi anlamina geliyor — biri eksikse (orn. eski
      // surumden yalnizca casinoBet kapatilmis oyuncu) is devam etmeli.
      const tamamlandi = eksikKisitlar.length === 0 && (bakiye ?? Infinity) <= ayar.sabitlemeDegeri;
      const karar = hedefKarari({ bakiye, esik: ayar.esik, zatenKisitli: tamamlandi });

      if (tamamlandi) {
        // Kısıtlar açık VE bakiye zaten hedefte: kayda geç ki bir daha sorgulanmasın.
        kayit.kapatilanlar[String(playerId)] = new Date().toISOString();
        degisti = true;
        continue;
      }
      if (!karar.kapat) continue;

      const not = hedefNotu(ayar.esik, bakiye ?? 0);
      const duzeltmeTutari = hedefBakiyeDuzeltmeTutari(bakiye ?? 0, ayar.sabitlemeDegeri);

      if (ayar.kuruCalisma) {
        audit('sistem', 'job', 'manual_adjustment', `player:${playerId}`,
          `KURU ÇALIŞMA — ${karar.neden} | eksik kısıt: ${eksikKisitlar.join(', ') || 'yok'} | bakiye düzeltmesi: ${duzeltmeTutari} TRY`);
        continue;
      }

      for (const kisit of eksikKisitlar) {
        await lynonSetPlayerRestriction({
          userId: playerId,
          restriction: kisit,
          isRestricted: true,
          note: not,
        });
      }

      if (duzeltmeTutari > 0) {
        await lynonAdjustPlayerMainAccount({
          playerId,
          amount: duzeltmeTutari,
          note: hedefBakiyeDuzeltmeNotu(ayar.sabitlemeDegeri, bakiye ?? 0),
          correctionType: 'debiting',
        });
      }

      kayit.kapatilanlar[String(playerId)] = new Date().toISOString();
      degisti = true;
      sonuc.kapatilan += 1;

      audit('sistem', 'job', 'manual_adjustment', `player:${playerId}`,
        `Bahis yetkisi kapatıldı (${eksikKisitlar.join(', ') || 'zaten kapalıydı'}), bakiye ${ayar.sabitlemeDegeri} TRY'ye sabitlendi (${duzeltmeTutari} TRY düşüldü). ${karar.neden} Kaynak: 100 FS Telegram Katıl Bonusu (kampanya ${ayar.kampanyaId}).`);
    } catch (err) {
      sonuc.hata += 1;
      console.error(`[hedef-bakiye] ${playerId}:`, err instanceof Error ? err.message : err);
    }
  }

  if (degisti) {
    await writeStoredDocument<KilitKaydi>({ tenantKey, namespace: NAMESPACE }, kayit);
  }
  return sonuc;
}
