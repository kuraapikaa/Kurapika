/**
 * Hedef bakiye kilidi isi.
 *
 * "100 Telegram Freespin ile bakiye 2500₺'yi gectigi an oyuncu bahis
 * yetkisi kapatilsin, cunku hedef bakiyeye ulasmis oluyor."
 *
 * Kararin kendisi `services/hedefBakiyeKilidi` icinde ve testli. Bu
 * dosya yalnizca sirali is akisi: kimi kontrol edecegiz, bakiyesi ne,
 * kisit zaten acik mi, degilse yaz ve denetime dus.
 *
 * ── Guvenlik cercevesi ────────────────────────────────────────────────
 *
 * Bu is GERCEK oyuncularin bahsini kapatiyor. Uc kisitla cerceveledim:
 *
 *   1. KAPSAM — yalnizca hedef kampanyanin bonusunu son birkac gunde
 *      almis oyuncular. Sitenin tamamina uygulanan bir kural degil.
 *   2. BEYAZ LISTE — `withdraw` ve `deposit` bu yoldan kapatilamaz.
 *      Hedefe ulasan oyuncunun parasini cekebilmesi gerekir.
 *   3. KURU CALISMA — `HEDEF_BAKIYE_KURU=1` ile karar verilir, loglanir,
 *      Lynon'a yazilmaz. Uretimde ilk gun bununla izlenebilir.
 *
 * Her yazma denetim kaydina duser; bir oyuncunun bahsi neden kapandi
 * sorusu kayitlardan cevaplanabilir olmali.
 */
import { config } from '../config.js';
import { audit } from '../lib/auditLog.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import {
  bonusOturumlariniTopla,
  lynonPlayerMainBalance,
  lynonPlayerRestrictions,
  lynonSetPlayerRestriction,
} from '../services/lynonBackofficeService.js';
import { hedefKarari, hedefNotu, kilitAdaylari, kisitliMi } from '../services/hedefBakiyeKilidi.js';

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
  });
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

      const kisitlar = await lynonPlayerRestrictions(playerId);
      const zatenKisitli = kisitliMi(kisitlar, ayar.kisit);
      const karar = hedefKarari({ bakiye, esik: ayar.esik, zatenKisitli });

      if (zatenKisitli) {
        // Kısıt zaten açık: kayda geç ki bir daha sorgulanmasın.
        kayit.kapatilanlar[String(playerId)] = new Date().toISOString();
        degisti = true;
        continue;
      }
      if (!karar.kapat) continue;

      const not = hedefNotu(ayar.esik, bakiye ?? 0);

      if (ayar.kuruCalisma) {
        audit('sistem', 'job', 'manual_adjustment', `player:${playerId}`,
          `KURU ÇALIŞMA — bahis yetkisi kapatılacaktı: ${karar.neden} | kısıt: ${ayar.kisit}`);
        continue;
      }

      await lynonSetPlayerRestriction({
        userId: playerId,
        restriction: ayar.kisit,
        isRestricted: true,
        note: not,
      });

      kayit.kapatilanlar[String(playerId)] = new Date().toISOString();
      degisti = true;
      sonuc.kapatilan += 1;

      audit('sistem', 'job', 'manual_adjustment', `player:${playerId}`,
        `Bahis yetkisi kapatıldı (${ayar.kisit}). ${karar.neden} Kaynak: 100 FS Telegram Katıl Bonusu (kampanya ${ayar.kampanyaId}).`);
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
