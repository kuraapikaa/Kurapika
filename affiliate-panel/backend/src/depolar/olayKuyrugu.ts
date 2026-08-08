import { and, eq, sql } from 'drizzle-orm';
import { webhookOlaylari } from '../lib/sema.js';
import { veritabani } from '../lib/veritabani.js';

/**
 * WEBHOOK OLAY KUYRUĞU.
 *
 * Uç yalnızca doğrular ve buraya yazar; işleme ayrı yürüyor. Arayüz
 * bilerek dar: ekle / sahiplen / tamamla / hata. BullMQ'ya geçilmek
 * istenirse değişecek tek yer bu dosya.
 *
 * ── Neden şimdilik Postgres, Redis değil ──
 *
 * Panelde Redis yok; eklemek ayrı bir servis ve ayrı bir maliyet.
 * Postgres zaten var ve bir kuyruktan istenen iki şeyi de veriyor:
 * KALICILIK (süreç ölse de olay durur) ve ATOMİK SAHİPLENME
 * (`FOR UPDATE SKIP LOCKED`). Redis eklendiğinde bu arayüzün ardına
 * BullMQ uygulaması konabilir; çağıran taraf değişmez.
 */

export const OLAY_TURLERI = ['deposit', 'withdrawal', 'bet', 'win'] as const;
export type OlayTuru = (typeof OLAY_TURLERI)[number];

export const olayTuruMu = (deger: unknown): deger is OlayTuru =>
  typeof deger === 'string' && (OLAY_TURLERI as readonly string[]).includes(deger);

export interface YeniOlay {
  id: string;
  imza: string;
  olayTuru: OlayTuru;
  oyuncuId: string;
  tutar: number;
  govde: unknown;
  alindi: string;
}

export interface KuyruktakiOlay extends YeniOlay {
  durum: string;
  deneme: number;
}

export interface KuyrukOzeti {
  bekleyen: number;
  isleniyor: number;
  tamam: number;
  hatali: number;
}

export interface OlayKuyrugu {
  /** `eklendi: false` → aynı imza daha önce geldi; tekrar (replay). */
  ekle(kiraci: string, olay: YeniOlay): Promise<{ eklendi: boolean }>;
  /** Bekleyenleri ATOMİK olarak sahiplenir; başka işçi aynılarını almaz. */
  sahiplen(kiraci: string, adet: number): Promise<KuyruktakiOlay[]>;
  tamamla(kiraci: string, id: string, simdi: Date): Promise<void>;
  hataYaz(kiraci: string, id: string, mesaj: string, simdi: Date): Promise<void>;
  ozet(kiraci: string): Promise<KuyrukOzeti>;
}

/** Bir olayın kaç kez denenip pes edileceği. */
export const AZAMI_DENEME = 5;

const vtZorunlu = () => {
  const vt = veritabani();
  if (!vt) {
    // Kalici bir kuyruk kalici depolama ister. Veritabani yokken sessizce
    // bellege yazmak, konteyner yeniden baslayinca olaylari kaybetmek
    // demekti -- ustelik Lynon 200 aldigi icin tekrar gondermeden.
    throw new Error('Webhook kuyruğu için DATABASE_URL zorunlu.');
  }
  return vt;
};

export function postgresOlayKuyrugu(): OlayKuyrugu {
  return {
    async ekle(kiraci, olay) {
      const eklenen = await vtZorunlu()
        .insert(webhookOlaylari)
        .values({
          id: olay.id,
          kiraci,
          imza: olay.imza,
          olayTuru: olay.olayTuru,
          oyuncuId: olay.oyuncuId,
          tutar: olay.tutar,
          govde: olay.govde,
          durum: 'bekliyor',
          alindi: new Date(olay.alindi),
        })
        // Ayni imza ikinci kez gelirse sessizce yok sayiliyor: tekrar
        // gonderilen bir istek iki kez islenmemeli.
        .onConflictDoNothing()
        .returning({ id: webhookOlaylari.id });
      return { eklendi: eklenen.length > 0 };
    },

    async sahiplen(kiraci, adet) {
      /*
       * Tek deyimde sec+isaretle. Iki islem ayni satiri okuyup ikisi de
       * islerse olay iki kez uygulanir; `SKIP LOCKED` kilitli satirlari
       * atladigi icin her satiri yalnizca bir isci aliyor.
       */
      const sonuc = await vtZorunlu().execute<{
        id: string; imza: string; olay_turu: string; oyuncu_id: string;
        tutar: number; govde: unknown; durum: string; deneme: number; alindi: Date;
      }>(sql`
        UPDATE ${webhookOlaylari}
        SET durum = 'isleniyor', deneme = ${webhookOlaylari.deneme} + 1
        WHERE ${webhookOlaylari.id} IN (
          SELECT id FROM ${webhookOlaylari}
          WHERE ${webhookOlaylari.kiraci} = ${kiraci} AND ${webhookOlaylari.durum} = 'bekliyor'
          ORDER BY ${webhookOlaylari.alindi}
          LIMIT ${adet}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, imza, olay_turu, oyuncu_id, tutar, govde, durum, deneme, alindi
      `);

      return sonuc.rows.map((s) => ({
        id: s.id,
        imza: s.imza,
        olayTuru: s.olay_turu as OlayTuru,
        oyuncuId: s.oyuncu_id,
        tutar: Number(s.tutar),
        govde: s.govde,
        alindi: new Date(s.alindi).toISOString(),
        durum: s.durum,
        deneme: Number(s.deneme),
      }));
    },

    async tamamla(kiraci, id, simdi) {
      await vtZorunlu()
        .update(webhookOlaylari)
        .set({ durum: 'tamam', islendi: simdi, sonHata: null })
        .where(and(eq(webhookOlaylari.kiraci, kiraci), eq(webhookOlaylari.id, id)));
    },

    async hataYaz(kiraci, id, mesaj, simdi) {
      /*
       * Denemesi bitmemis olay `bekliyor`a donuyor ve tekrar alinacak;
       * bitmisse `hatali` olarak kaliyor. Sonsuza kadar denemek, bozuk
       * tek bir olayin kuyrugu surekli mesgul etmesi demekti.
       */
      await vtZorunlu()
        .update(webhookOlaylari)
        .set({
          durum: sql`CASE WHEN ${webhookOlaylari.deneme} >= ${AZAMI_DENEME} THEN 'hatali' ELSE 'bekliyor' END`,
          sonHata: mesaj.slice(0, 500),
          islendi: simdi,
        })
        .where(and(eq(webhookOlaylari.kiraci, kiraci), eq(webhookOlaylari.id, id)));
    },

    async ozet(kiraci) {
      const satirlar = await vtZorunlu()
        .select({ durum: webhookOlaylari.durum, sayi: sql<number>`count(*)::int` })
        .from(webhookOlaylari)
        .where(eq(webhookOlaylari.kiraci, kiraci))
        .groupBy(webhookOlaylari.durum);

      const ozet: KuyrukOzeti = { bekleyen: 0, isleniyor: 0, tamam: 0, hatali: 0 };
      for (const s of satirlar) {
        if (s.durum === 'bekliyor') ozet.bekleyen = s.sayi;
        else if (s.durum === 'isleniyor') ozet.isleniyor = s.sayi;
        else if (s.durum === 'tamam') ozet.tamam = s.sayi;
        else if (s.durum === 'hatali') ozet.hatali = s.sayi;
      }
      return ozet;
    },
  };
}

export const olayKuyrugu = (): OlayKuyrugu => postgresOlayKuyrugu();
