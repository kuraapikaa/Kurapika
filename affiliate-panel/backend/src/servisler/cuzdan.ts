import { randomUUID } from 'crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { cuzdanHareketleri } from '../lib/sema.js';
import { veritabani } from '../lib/veritabani.js';

/**
 * ORTAK CÜZDANI.
 *
 * Bakiye bir sütun değil, hareketlerin toplamı. "Neden bu rakam"
 * sorusunun cevabı defterde duruyor; tek bir sayı tutsaydık bir hata
 * olduğunda geriye doğru izleyemezdik.
 *
 * ── Cüzdana NE yazılıyor ──
 *
 * Yalnızca O DÖNEMDE KAZANILAN: gelir payı + CPA + kademe geliri.
 * `hakedis.toplam` KULLANILMIYOR, çünkü içinde önceki dönemden devreden
 * ödeme de var; onu da yazmak geçen ayın kazancını ikinci kez alacak
 * kaydetmek olurdu.
 *
 * Cüzdan zaten devrin kendisi: ödenmemiş kazanç bakiyede birikiyor.
 */

export type HareketTuru = 'hakedis' | 'odeme' | 'duzeltme';

export interface CuzdanHareketi {
  id: string;
  ortakId: string;
  tur: HareketTuru;
  /** Alacak pozitif, borç negatif. */
  tutar: number;
  donem: string | null;
  aciklama: string | null;
  kaynakAnahtari: string;
  olusturuldu: string;
}

export interface YeniHareket {
  ortakId: string;
  tur: HareketTuru;
  tutar: number;
  donem?: string | null;
  aciklama?: string | null;
  /**
   * Aynı olayın iki kez yazılmasını engelleyen kimlik.
   *
   * Örn. `hakedis:2026-08:ORT1:2026-08-10`. Benzersiz kısıt bunun
   * üzerinde; ikinci yazma veritabanı tarafından reddediliyor.
   */
  kaynakAnahtari: string;
}

const kurusa = (deger: number): number => Math.round(deger * 100) / 100;

const vtZorunlu = () => {
  const vt = veritabani();
  // Para defteri kalici depolama ister; JSON dosyasina yazip yeniden
  // baslatmada kaybetmek kabul edilebilir degil.
  if (!vt) throw new Error('Cüzdan için DATABASE_URL zorunlu.');
  return vt;
};

const satirdan = (s: typeof cuzdanHareketleri.$inferSelect): CuzdanHareketi => ({
  id: s.id,
  ortakId: s.ortakId,
  tur: s.tur as HareketTuru,
  tutar: s.tutar,
  donem: s.donem,
  aciklama: s.aciklama,
  kaynakAnahtari: s.kaynakAnahtari,
  olusturuldu: s.olusturuldu.toISOString(),
});

/**
 * Hareket ekler. Aynı `kaynakAnahtari` daha önce yazıldıysa HİÇBİR ŞEY
 * yapmaz ve `eklendi: false` döner.
 */
export async function hareketEkle(
  kiraci: string,
  hareket: YeniHareket,
  simdi = new Date(),
): Promise<{ eklendi: boolean }> {
  const tutar = kurusa(Number(hareket.tutar) || 0);
  const eklenen = await vtZorunlu()
    .insert(cuzdanHareketleri)
    .values({
      id: randomUUID(),
      kiraci,
      ortakId: hareket.ortakId,
      tur: hareket.tur,
      tutar,
      donem: hareket.donem ?? null,
      aciklama: hareket.aciklama ?? null,
      kaynakAnahtari: hareket.kaynakAnahtari,
      olusturuldu: simdi,
    })
    .onConflictDoNothing()
    .returning({ id: cuzdanHareketleri.id });
  return { eklendi: eklenen.length > 0 };
}

export async function bakiye(kiraci: string, ortakId: string): Promise<number> {
  const satirlar = await vtZorunlu()
    .select({ toplam: sql<number>`COALESCE(sum(${cuzdanHareketleri.tutar}), 0)::double precision` })
    .from(cuzdanHareketleri)
    .where(and(eq(cuzdanHareketleri.kiraci, kiraci), eq(cuzdanHareketleri.ortakId, ortakId)));
  return kurusa(Number(satirlar[0]?.toplam) || 0);
}

export interface OrtakBakiyesi {
  ortakId: string;
  bakiye: number;
  hareketSayisi: number;
  sonHareket: string | null;
}

export async function bakiyeler(kiraci: string): Promise<OrtakBakiyesi[]> {
  const satirlar = await vtZorunlu()
    .select({
      ortakId: cuzdanHareketleri.ortakId,
      toplam: sql<number>`COALESCE(sum(${cuzdanHareketleri.tutar}), 0)::double precision`,
      sayi: sql<number>`count(*)::int`,
      son: sql<Date>`max(${cuzdanHareketleri.olusturuldu})`,
    })
    .from(cuzdanHareketleri)
    .where(eq(cuzdanHareketleri.kiraci, kiraci))
    .groupBy(cuzdanHareketleri.ortakId);

  return satirlar
    .map((s) => ({
      ortakId: s.ortakId,
      bakiye: kurusa(Number(s.toplam) || 0),
      hareketSayisi: Number(s.sayi) || 0,
      sonHareket: s.son ? new Date(s.son).toISOString() : null,
    }))
    .sort((a, b) => b.bakiye - a.bakiye);
}

/** Bir ortağın bir dönemde şu ana kadar YAZILMIŞ hakediş toplamı. */
export async function donemdeYazilan(kiraci: string, ortakId: string, donem: string): Promise<number> {
  const satirlar = await vtZorunlu()
    .select({ toplam: sql<number>`COALESCE(sum(${cuzdanHareketleri.tutar}), 0)::double precision` })
    .from(cuzdanHareketleri)
    .where(and(
      eq(cuzdanHareketleri.kiraci, kiraci),
      eq(cuzdanHareketleri.ortakId, ortakId),
      eq(cuzdanHareketleri.donem, donem),
      eq(cuzdanHareketleri.tur, 'hakedis'),
    ));
  return kurusa(Number(satirlar[0]?.toplam) || 0);
}

export async function hareketleriListele(
  kiraci: string,
  { ortakId, limit = 200 }: { ortakId?: string; limit?: number } = {},
): Promise<CuzdanHareketi[]> {
  const kosullar = [eq(cuzdanHareketleri.kiraci, kiraci)];
  if (ortakId) kosullar.push(eq(cuzdanHareketleri.ortakId, ortakId));
  const satirlar = await vtZorunlu()
    .select()
    .from(cuzdanHareketleri)
    .where(and(...kosullar))
    .orderBy(desc(cuzdanHareketleri.olusturuldu), desc(cuzdanHareketleri.id))
    .limit(Math.min(1000, Math.max(1, Number(limit) || 200)));
  return satirlar.map(satirdan);
}
