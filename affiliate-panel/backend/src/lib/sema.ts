import { doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { AltParametre } from '../servisler/izleme.js';

/**
 * İLİŞKİSEL ŞEMA — yalnızca SINIRSIZ BÜYÜYEN iki depo için.
 *
 * Panelin geri kalanı `aff_belgeler` içinde JSON belgesi olarak duruyor
 * ve orada kalıyor. Ortaklar, planlar, medya, kademeler: hepsi düzinelerle
 * ölçülen, sınırlı listeler. Onları tabloya çevirmek her alan
 * değişikliğini bir migrasyona bağlardı ve karşılığında hiçbir şey
 * kazandırmazdı.
 *
 * Tıklamalar ve ölçümler farklı. İkisi de sınırsız büyüyor ve ikisi de
 * TARİH ARALIĞIYLA sorgulanıyor — belge modelinin en kötü olduğu yer:
 *
 *   - Her tıklama, o kiracının TÜM tıklama listesini okuyup geri
 *     yazıyordu. 50.000 kayıtta bu, tek bir tıklama için megabaytlarca
 *     okuma-yazma demek ve kilit yüzünden hepsi sıraya giriyordu.
 *   - Filtreleme belleğe alınmış listede yapılıyordu; veritabanı
 *     indeksinden hiç faydalanılmıyordu.
 *
 * ── Para alanları neden `double precision` ──
 *
 * Hesap zaten JavaScript sayılarıyla yapılıyor (`komisyon.ts`).
 * `numeric` saklamak sadakati artırırdı ama okurken metne dönüp geri
 * `Number()`'a girecekti; yani aynı kayan nokta aritmetiği, üstüne bir
 * dönüşüm katmanı. Para matematiği JS'ten çıktığı gün `numeric`'e
 * geçmek doğru adım olur — o zamana kadar mevcut davranışı birebir
 * korumak yanlış bir kesinlik izlenimi vermekten iyi.
 *
 * ── `gun` neden `text` ──
 *
 * `gun` bir AN değil, bir TAKVİM GÜNÜ ('2026-08-07'). `date` sütunu
 * sürücüden `Date` olarak dönüp saat dilimine göre bir gün kayabilir;
 * panelin her yerinde bu değer zaten metin olarak karşılaştırılıyor.
 * `zaman` ise gerçek bir an, orada `timestamptz` doğru tip.
 */

export const tiklamalar = pgTable(
  'aff_tiklamalar',
  {
    clickId: text('click_id').primaryKey(),
    kiraci: text('kiraci').notNull(),
    ortakAnahtari: text('ortak_anahtari').notNull(),
    medyaId: text('medya_id'),
    alt: jsonb('alt').$type<Partial<Record<AltParametre, string>>>().notNull().default({}),
    /** Kaba konum/bot ayıklaması için; kimlik olarak KULLANILMAZ. */
    ip: text('ip'),
    userAgent: text('user_agent'),
    referrer: text('referrer'),
    zaman: timestamp('zaman', { withTimezone: true }).notNull(),
  },
  (t) => [
    // Listeleme her zaman kiraciyla baslayip zamana gore tersten
    // siraliyor; indeks bu sirayi birebir karsiliyor.
    index('aff_tiklamalar_kiraci_zaman').on(t.kiraci, t.zaman.desc()),
    index('aff_tiklamalar_kiraci_ortak_zaman').on(t.kiraci, t.ortakAnahtari, t.zaman.desc()),
  ],
);

export const olcumler = pgTable(
  'aff_olcumler',
  {
    kiraci: text('kiraci').notNull(),
    gun: text('gun').notNull(),
    ortakAnahtari: text('ortak_anahtari').notNull(),
    oyuncuSayisi: integer('oyuncu_sayisi').notNull().default(0),
    aktifOyuncuSayisi: integer('aktif_oyuncu_sayisi').notNull().default(0),
    yatirim: doublePrecision('yatirim').notNull().default(0),
    cekim: doublePrecision('cekim').notNull().default(0),
    ggr: doublePrecision('ggr').notNull().default(0),
    /**
     * `null` ile `0` AYRI anlamlar taşıyor: biri "ölçülemedi", diğeri
     * "gerçekten sıfır". Sütun bu yüzden nullable ve varsayılansız.
     */
    ftdSayisi: integer('ftd_sayisi'),
    kaynak: text('kaynak').notNull(),
    yazildi: timestamp('yazildi', { withTimezone: true }).notNull(),
  },
  (t) => [
    // Gun basina ortak basina TEK satir; idempotent yazmanin dayanagi bu.
    primaryKey({ columns: [t.kiraci, t.gun, t.ortakAnahtari] }),
    index('aff_olcumler_kiraci_gun').on(t.kiraci, t.gun),
  ],
);
