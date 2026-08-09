import { and, eq, inArray, sql } from 'drizzle-orm';
import { olayKuyrugu, type KuyruktakiOlay } from '../depolar/olayKuyrugu.js';
import { VARSAYILAN_BAGLANTI_ID } from '../depolar/eslesmeDeposu.js';
import { oyuncuEslesmeleri, oyuncuGunluk } from '../lib/sema.js';
import { ortakGunlukGeliriGuncelle } from '../servisler/oyuncuEslesme.js';
import { veritabani } from '../lib/veritabani.js';

/**
 * WEBHOOK OLAY İŞÇİSİ.
 *
 * Kuyruktan olay alıp oyuncu bazlı günlük toplamlara katlıyor. Uçtan
 * ayrı çalışıyor: Lynon'un beklediği süre kuyruğa yazma süresi kadar,
 * hesabın ne kadar sürdüğü onu ilgilendirmiyor.
 *
 * ── Toplama neden `+=` ve neden idempotent DEĞİL ──
 *
 * Her olay bir AKIŞ: bir yatırım, bir bahis. Aynı olayı iki kez
 * eklemek rakamı şişirir. Tekrarı önleyen şey burada değil, kuyrukta:
 * imza benzersiz, aynı istek ikinci kez kuyruğa giremiyor. Bir olay
 * kuyruktan yalnızca bir kez sahipleniliyor (`FOR UPDATE SKIP LOCKED`).
 *
 * ── Gün neden UTC ──
 *
 * Olayın düştüğü gün, alındığı anın UTC tarihi. Yerel saate göre
 * bölmek, saat farkıyla birlikte gün sınırındaki olayları bir önceki ya
 * da sonraki güne kaydırırdı; backoffice raporu da UTC gün kullanıyor.
 *
 * ── Tur SONUNDA ortak gelirini güncelleme ──
 *
 * `oyuncu_gunluk`a yazmak tek başına yetmiyor: Özet ekranındaki
 * GGR/Yatırım/Çekim `olcumler` tablosundan okunuyor ve o tablo şimdiye
 * kadar yalnızca Lynon'un backoffice raporundan besleniyordu — panel
 * Lynon'un third-party affiliate kaydına katılmadığı için o rapor
 * panelin ürettiği trafiği hiç göremiyor (bkz. `oyuncuEslesme.ts` ·
 * `ortakGunlukGeliriGuncelle`). Bu yüzden her turun SONUNDA, o turda
 * dokunulan (gün, oyuncu) çiftleri kendi ortağına çözülüp `olcumler`e
 * `kaynak: 'itme'` ile yazılıyor. Her olayda değil tur sonunda: aynı
 * oyuncu bir turda beş kez bahis oynarsa beş kez yeniden hesaplamak
 * gereksiz.
 */

/** Bir turda alınacak olay sayısı. */
const TUR_BOYU = 50;

/** İşçinin boşta beklerken tur aralığı. */
export const TUR_ARALIGI_MS = Math.max(2000, Number(process.env.WEBHOOK_TUR_ARALIGI_MS) || 15_000);

const gunuBul = (isoZaman: string): string => new Date(isoZaman).toISOString().slice(0, 10);

/** Olay türünü hangi sütuna ekleyeceğimiz. */
const SUTUN: Record<KuyruktakiOlay['olayTuru'], 'yatirim' | 'cekim' | 'bahis' | 'kazanc'> = {
  deposit: 'yatirim',
  withdrawal: 'cekim',
  bet: 'bahis',
  win: 'kazanc',
};

async function olayiUygula(kiraci: string, olay: KuyruktakiOlay, simdi: Date): Promise<void> {
  const vt = veritabani();
  if (!vt) throw new Error('Veritabanı hazır değil.');

  const gun = gunuBul(olay.alindi);
  const sutun = SUTUN[olay.olayTuru];
  const tutar = Math.max(0, Number(olay.tutar) || 0);

  await vt
    .insert(oyuncuGunluk)
    .values({
      kiraci,
      gun,
      oyuncuId: olay.oyuncuId,
      yatirim: sutun === 'yatirim' ? tutar : 0,
      cekim: sutun === 'cekim' ? tutar : 0,
      bahis: sutun === 'bahis' ? tutar : 0,
      kazanc: sutun === 'kazanc' ? tutar : 0,
      olaySayisi: 1,
      guncellendi: simdi,
    })
    // Toplama VERITABANINDA: once okuyup sonra yazmak, ayni oyuncuya
    // ayni anda gelen iki olayda birini kaybederdi.
    .onConflictDoUpdate({
      target: [oyuncuGunluk.kiraci, oyuncuGunluk.gun, oyuncuGunluk.oyuncuId],
      set: {
        [sutun]: sql`${oyuncuGunluk[sutun]} + ${tutar}`,
        olaySayisi: sql`${oyuncuGunluk.olaySayisi} + 1`,
        guncellendi: simdi,
      },
    });
}

export interface IslemeSonucu {
  alinan: number;
  tamam: number;
  hatali: number;
}

/**
 * Turda dokunulan (gün, oyuncu) çiftlerini kendi ortağına çözüp
 * `olcumler`e yazar. Eşleşmeyen oyuncular (henüz hiçbir ortağa
 * bağlanmamış) sessizce atlanır — parayı kimin getirdiği bilinmiyorsa
 * bir ortağa yazmak yanlış olurdu.
 */
async function ortakGelirleriniGuncelle(
  kiraci: string,
  dokunulanlar: Set<string>,
  simdi: Date,
): Promise<void> {
  const vt = veritabani();
  if (!vt || dokunulanlar.size === 0) return;

  const cozumlenmis = new Map<string, { gun: string; oyuncuId: string }>();
  for (const anahtar of dokunulanlar) {
    const ayrikGun = anahtar.indexOf('|');
    cozumlenmis.set(anahtar, { gun: anahtar.slice(0, ayrikGun), oyuncuId: anahtar.slice(ayrikGun + 1) });
  }
  const oyuncuIdler = [...new Set([...cozumlenmis.values()].map((d) => d.oyuncuId))];

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
      // Webhook siteyi bilmiyor (tek paylasilan sir, baglanti basina
      // degil) -- yalnizca 'varsayilan' baglantili oyunculara eslesebilir,
      // aksi halde baska bir sitedeki ayni numarali ID'yle cakisirdi.
      eq(oyuncuEslesmeleri.baglantiId, VARSAYILAN_BAGLANTI_ID),
    ));

  const oyuncudanOrtaga = new Map(eslesmeler.map((e) => [e.lynonOyuncuId, e]));

  // Ayni (gun, ortak) birden cok oyuncu uzerinden birden cok kez
  // tetiklenebilir; her biri zaten TUM ortagi yeniden hesapliyor, tekrar
  // yazmak yanlis degil ama gereksiz -- bu yuzden tekillestiriliyor.
  const gunOrtakCiftleri = new Map<string, { gun: string; ortakId: string; ortakAnahtari: string }>();
  for (const { gun, oyuncuId } of cozumlenmis.values()) {
    const eslesme = oyuncudanOrtaga.get(oyuncuId);
    if (!eslesme) continue;
    gunOrtakCiftleri.set(`${gun}|${eslesme.ortakId}`, { gun, ortakId: eslesme.ortakId, ortakAnahtari: eslesme.ortakAnahtari });
  }

  for (const { gun, ortakId, ortakAnahtari } of gunOrtakCiftleri.values()) {
    // Tek bir ortagin hesabindaki bir hata digerlerini durdurmamali.
    await ortakGunlukGeliriGuncelle(kiraci, gun, ortakId, ortakAnahtari, simdi).catch(() => undefined);
  }
}

/** Kuyruğu boşalana kadar işler. Testler bunu doğrudan çağırıyor. */
export async function olaylariIsle(kiraci: string, simdi = new Date()): Promise<IslemeSonucu> {
  const kuyruk = olayKuyrugu();
  const sonuc: IslemeSonucu = { alinan: 0, tamam: 0, hatali: 0 };
  const dokunulanlar = new Set<string>();

  for (;;) {
    const olaylar = await kuyruk.sahiplen(kiraci, TUR_BOYU);
    if (!olaylar.length) break;
    sonuc.alinan += olaylar.length;

    for (const olay of olaylar) {
      try {
        await olayiUygula(kiraci, olay, simdi);
        await kuyruk.tamamla(kiraci, olay.id, simdi);
        sonuc.tamam += 1;
        dokunulanlar.add(`${gunuBul(olay.alindi)}|${olay.oyuncuId}`);
      } catch (hata) {
        // Tek bir bozuk olay turun tamamini durdurmamali; hata kaydediliyor
        // ve olay denemesi bitene kadar tekrar alinacak.
        await kuyruk.hataYaz(kiraci, olay.id, (hata as Error).message, simdi);
        sonuc.hatali += 1;
      }
    }
  }

  await ortakGelirleriniGuncelle(kiraci, dokunulanlar, simdi);

  return sonuc;
}
