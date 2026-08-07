import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { degistir, diziOku, kayitOku, oku } from '../lib/depo.js';
import { tiklamalar as tablo } from '../lib/sema.js';
import { veritabani } from '../lib/veritabani.js';
import type { AltParametre } from '../servisler/izleme.js';

/**
 * TIKLAMA DEPOSU — iki uygulama, tek arayüz.
 *
 * Panel Postgres'siz de ayağa kalkabildiği için depolama iki biçimde
 * yaşıyor. Servis hangisinin çalıştığını BİLMİYOR; arayüz ikisini de
 * aynı davranışa zorluyor ve testler veritabanı gerektirmeden belge
 * uygulamasıyla koşabiliyor.
 *
 * ── Neden ilişkisel tabloya taşındı ──
 *
 * Belge modelinde her tıklama, o kiracının TÜM tıklama listesini okuyup
 * geri yazıyordu. 50.000 kayıtta tek bir tıklama megabaytlarca
 * okuma-yazma demekti ve süreç içi kilit yüzünden hepsi sıraya
 * giriyordu — yani tıklama yükü arttıkça her tıklama YAVAŞLIYORDU.
 * Tabloda ekleme tek satır; filtreleme indeksten.
 */

export interface Tiklama {
  clickId: string;
  ortakAnahtari: string;
  medyaId: string | null;
  alt: Partial<Record<AltParametre, string>>;
  /** Kaba konum/bot ayıklaması için; kimlik olarak KULLANILMAZ. */
  ip: string | null;
  userAgent: string | null;
  referrer: string | null;
  zaman: string;
}

export interface TiklamaSorgusu {
  ortakAnahtari?: string;
  medyaId?: string;
  start?: string;
  end?: string;
  limit?: number;
}

export interface TiklamaOzeti {
  ortakAnahtari: string;
  toplam: number;
  /** Medya kimliğine göre kırılım; hangi kreatif çalışıyor. */
  medyaBazinda: Array<{ medyaId: string | null; sayi: number }>;
  /** Alt kanal kırılımı; ortağın kendi etiketlemesi. */
  altBazinda: Array<{ anahtar: string; deger: string; sayi: number }>;
}

export interface TiklamaDeposu {
  ekle(kiraci: string, tiklama: Tiklama): Promise<Tiklama>;
  listele(kiraci: string, sorgu: TiklamaSorgusu): Promise<Tiklama[]>;
  bul(kiraci: string, clickId: string): Promise<Tiklama | null>;
  ozetle(kiraci: string, sorgu: TiklamaSorgusu): Promise<TiklamaOzeti[]>;
}

const ALAN = 'tiklamalar';

/** Belge uygulamasında kayıt sınırsız büyümesin; en yeniler tutulur. */
const KAYIT_SINIRI = Math.max(1000, Number(process.env.TIKLAMA_KAYIT_SINIRI) || 50_000);

const sinirla = (limit: unknown): number => Math.min(1000, Math.max(1, Number(limit) || 200));

/**
 * Bitiş günü SONUNA kadar dahil.
 *
 * Kullanıcı gün seçiyor, an değil; `end=2026-08-07` o günün tamamını
 * kapsamalı. Ham tarih kullanılsaydı gün 00:00'da kesilir ve o günün
 * bütün tıklamaları rapordan düşerdi.
 */
function bitisAni(end: string): Date {
  const son = new Date(end);
  son.setUTCHours(23, 59, 59, 999);
  return son;
}

// ─────────────────────────── Postgres ───────────────────────────

function pgKosullar(kiraci: string, sorgu: TiklamaSorgusu) {
  const kosullar = [eq(tablo.kiraci, kiraci)];
  if (sorgu.ortakAnahtari) kosullar.push(eq(tablo.ortakAnahtari, sorgu.ortakAnahtari));
  if (sorgu.medyaId) kosullar.push(eq(tablo.medyaId, sorgu.medyaId));
  if (sorgu.start) kosullar.push(gte(tablo.zaman, new Date(sorgu.start)));
  if (sorgu.end) kosullar.push(lte(tablo.zaman, bitisAni(sorgu.end)));
  return and(...kosullar);
}

const satirdanTiklama = (s: typeof tablo.$inferSelect): Tiklama => ({
  clickId: s.clickId,
  ortakAnahtari: s.ortakAnahtari,
  medyaId: s.medyaId,
  alt: s.alt ?? {},
  ip: s.ip,
  userAgent: s.userAgent,
  referrer: s.referrer,
  zaman: s.zaman.toISOString(),
});

export function postgresTiklamaDeposu(): TiklamaDeposu {
  const vtZorunlu = () => {
    const vt = veritabani();
    if (!vt) throw new Error('Veritabanı hazır değil.');
    return vt;
  };

  return {
    async ekle(kiraci, tiklama) {
      await vtZorunlu().insert(tablo).values({
        clickId: tiklama.clickId,
        kiraci,
        ortakAnahtari: tiklama.ortakAnahtari,
        medyaId: tiklama.medyaId,
        alt: tiklama.alt,
        ip: tiklama.ip,
        userAgent: tiklama.userAgent,
        referrer: tiklama.referrer,
        zaman: new Date(tiklama.zaman),
      });
      return tiklama;
    },

    async listele(kiraci, sorgu) {
      const satirlar = await vtZorunlu()
        .select()
        .from(tablo)
        .where(pgKosullar(kiraci, sorgu))
        // `clickId` ikincil sıra: aynı milisaniyedeki tıklamalar her
        // sorguda AYNI sırada dönsün, yoksa sayfalama kayar.
        .orderBy(desc(tablo.zaman), desc(tablo.clickId))
        .limit(sinirla(sorgu.limit));
      return satirlar.map(satirdanTiklama);
    },

    async bul(kiraci, clickId) {
      if (!clickId) return null;
      // `kiraci` koşulu ŞART: `clickId` tek başına birincil anahtar,
      // filtresiz sorgu başka kiracının tıklamasını döndürebilirdi.
      const satirlar = await vtZorunlu()
        .select()
        .from(tablo)
        .where(and(eq(tablo.kiraci, kiraci), eq(tablo.clickId, clickId)))
        .limit(1);
      return satirlar.length ? satirdanTiklama(satirlar[0]) : null;
    },

    async ozetle(kiraci, sorgu) {
      const vt = vtZorunlu();
      const kosul = pgKosullar(kiraci, sorgu);

      const medyaSatirlari = await vt
        .select({
          ortakAnahtari: tablo.ortakAnahtari,
          medyaId: tablo.medyaId,
          sayi: sql<number>`count(*)::int`,
        })
        .from(tablo)
        .where(kosul)
        .groupBy(tablo.ortakAnahtari, tablo.medyaId);

      // `alt` serbest anahtarlı bir jsonb; kırılım ancak satıra açılarak
      // alınabiliyor. Boş değerler sayılmıyor -- ortak parametreyi boş
      // gondermis demektir, kanal degil.
      // Tabloya takma ad VERILMIYOR: kosul drizzle tarafindan tam tablo
      // adiyla uretiliyor, takma ad koymak onu FROM'da bulunamaz hale
      // getiriyor.
      const altSatirlari = await vt.execute<{
        ortak_anahtari: string;
        anahtar: string;
        deger: string;
        sayi: number;
      }>(sql`
        SELECT ${tablo.ortakAnahtari} AS ortak_anahtari,
               a.key AS anahtar, a.value AS deger, count(*)::int AS sayi
        FROM ${tablo}, jsonb_each_text(${tablo.alt}) AS a(key, value)
        WHERE ${kosul} AND a.value <> ''
        GROUP BY ${tablo.ortakAnahtari}, a.key, a.value
      `);

      return birlestir(medyaSatirlari, altSatirlari.rows);
    },
  };
}

/**
 * Kırılımları ortak başına toplayıp sıralar.
 *
 * `toplam` medya kırılımından toplanıyor: her tıklamanın bir (boş da
 * olsa) medya değeri var, dolayısıyla o kırılım tam sayımı verir.
 * Alt kırılımından toplamak yanlış olurdu — bir tıklama birden çok alt
 * parametre taşıyabiliyor.
 */
function birlestir(
  medyaSatirlari: Array<{ ortakAnahtari: string; medyaId: string | null; sayi: number }>,
  altSatirlari: Array<{ ortak_anahtari: string; anahtar: string; deger: string; sayi: number }>,
): TiklamaOzeti[] {
  const ozetler = new Map<string, TiklamaOzeti>();
  const al = (ortakAnahtari: string): TiklamaOzeti => {
    const mevcut = ozetler.get(ortakAnahtari)
      ?? { ortakAnahtari, toplam: 0, medyaBazinda: [], altBazinda: [] };
    ozetler.set(ortakAnahtari, mevcut);
    return mevcut;
  };

  for (const satir of medyaSatirlari) {
    const ozet = al(satir.ortakAnahtari);
    ozet.toplam += satir.sayi;
    ozet.medyaBazinda.push({ medyaId: satir.medyaId || null, sayi: satir.sayi });
  }
  for (const satir of altSatirlari) {
    al(satir.ortak_anahtari).altBazinda.push({
      anahtar: satir.anahtar,
      deger: satir.deger,
      sayi: Number(satir.sayi),
    });
  }

  /**
   * Eşit sayıda olanlar için EŞİTLİK BOZUCU şart.
   *
   * Yalnızca `sayi`ya göre sıralamak, aynı sayıya sahip kalemleri
   * kaynağın döndürme sırasına bırakıyordu: `GROUP BY` hiçbir sıra
   * garantisi vermiyor, belge tarafında ise sıra ekleme sırasına
   * bağlıydı. Aynı veri her istekte farklı sırada görünebilirdi.
   */
  for (const ozet of ozetler.values()) {
    ozet.medyaBazinda.sort((a, b) => b.sayi - a.sayi || (a.medyaId ?? '').localeCompare(b.medyaId ?? ''));
    ozet.altBazinda.sort((a, b) =>
      b.sayi - a.sayi || a.anahtar.localeCompare(b.anahtar) || a.deger.localeCompare(b.deger));
  }
  return [...ozetler.values()]
    .sort((a, b) => b.toplam - a.toplam || a.ortakAnahtari.localeCompare(b.ortakAnahtari));
}

// ────────────────────────── Belge (JSON) ──────────────────────────

type BelgeDepo = { version: 1; tiklamalar: Tiklama[] };
const cozDepo = (ham: unknown): BelgeDepo => ({
  version: 1,
  tiklamalar: diziOku<Tiklama>(kayitOku(ham).tiklamalar),
});

function belgeSuz(tiklamalar: Tiklama[], sorgu: TiklamaSorgusu): Tiklama[] {
  const baslangic = sorgu.start ? new Date(sorgu.start).toISOString() : null;
  const bitis = sorgu.end ? bitisAni(sorgu.end).toISOString() : null;
  return tiklamalar.filter((t) => {
    if (sorgu.ortakAnahtari && t.ortakAnahtari !== sorgu.ortakAnahtari) return false;
    if (sorgu.medyaId && t.medyaId !== sorgu.medyaId) return false;
    if (baslangic && t.zaman < baslangic) return false;
    if (bitis && t.zaman > bitis) return false;
    return true;
  });
}

export function belgeTiklamaDeposu(): TiklamaDeposu {
  return {
    async ekle(kiraci, tiklama) {
      return degistir<BelgeDepo, Tiklama>(kiraci, ALAN, cozDepo, (depo) => {
        depo.tiklamalar.push(tiklama);
        if (depo.tiklamalar.length > KAYIT_SINIRI) {
          depo.tiklamalar = depo.tiklamalar.slice(-KAYIT_SINIRI);
        }
        return tiklama;
      });
    },

    async listele(kiraci, sorgu) {
      const depo = await oku<BelgeDepo>(kiraci, ALAN, cozDepo);
      return belgeSuz(depo.tiklamalar, sorgu).slice(-sinirla(sorgu.limit)).reverse();
    },

    async bul(kiraci, clickId) {
      if (!clickId) return null;
      const depo = await oku<BelgeDepo>(kiraci, ALAN, cozDepo);
      return depo.tiklamalar.find((t) => t.clickId === clickId) ?? null;
    },

    async ozetle(kiraci, sorgu) {
      const depo = await oku<BelgeDepo>(kiraci, ALAN, cozDepo);
      const medya = new Map<string, number>();
      const alt = new Map<string, number>();

      for (const t of belgeSuz(depo.tiklamalar, sorgu)) {
        const medyaAnahtari = JSON.stringify([t.ortakAnahtari, t.medyaId ?? '']);
        medya.set(medyaAnahtari, (medya.get(medyaAnahtari) ?? 0) + 1);
        for (const [anahtar, deger] of Object.entries(t.alt)) {
          if (!deger) continue;
          // Anahtar JSON: ayrac karakteri kullanmak, degerin icinde o
          // karakter gectiginde geri okumayi bozardi.
          const bilesik = JSON.stringify([t.ortakAnahtari, anahtar, deger]);
          alt.set(bilesik, (alt.get(bilesik) ?? 0) + 1);
        }
      }

      return birlestir(
        [...medya.entries()].map(([bilesik, sayi]) => {
          const [ortakAnahtari, medyaId] = JSON.parse(bilesik) as [string, string];
          return { ortakAnahtari, medyaId: medyaId || null, sayi };
        }),
        [...alt.entries()].map(([bilesik, sayi]) => {
          const [ortak_anahtari, anahtar, deger] = JSON.parse(bilesik) as [string, string, string];
          return { ortak_anahtari, anahtar, deger, sayi };
        }),
      );
    },
  };
}

/** Çalışan depolama biçimine göre uygulamayı seçer. */
export function tiklamaDeposu(): TiklamaDeposu {
  return veritabani() ? postgresTiklamaDeposu() : belgeTiklamaDeposu();
}
