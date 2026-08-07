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

/**
 * OYUNCU ↔ ORTAK EŞLEŞMESİ.
 *
 * Oyuncu referans linkiyle geldi, siteye Lynon üzerinden kaydoldu ve
 * Lynon bize oyuncu kimliğini bildirdi. Bu tablo o kimliği getiren
 * ortağa bağlıyor; hakedişin dayanağı bu bağ.
 *
 * ── BİRİNCİL ANAHTAR KURALIN KENDİSİ ──
 *
 * "Aynı oyuncu zaten başka bir ortağa aitse üzerine yazma" kuralı
 * uygulama katmanında değil, `(kiraci, lynon_oyuncu_id)` birincil
 * anahtarında yaşıyor. Ekleme `ON CONFLICT DO NOTHING` ile yapılıyor;
 * ilk kayıt kazanıyor.
 *
 * Neden kodda "önce bak, yoksa yaz" DEĞİL: iki kayıt aynı anda gelirse
 * ikisi de "yok" görür ve ikisi de yazar. Süreç içi bir kilit tek
 * konteynerde bunu çözer ama yatay ölçeklemede çözmez. Veritabanı
 * kısıtı her iki durumda da doğru — ve yanlışlıkla atlanamaz.
 */
export const oyuncuEslesmeleri = pgTable(
  'aff_oyuncu_eslesmeleri',
  {
    kiraci: text('kiraci').notNull(),
    /** Lynon'un döndürdüğü oyuncu kimliği. */
    lynonOyuncuId: text('lynon_oyuncu_id').notNull(),
    /** Ortağın kalıcı kimliği; hakediş buna bağlanıyor. */
    ortakId: text('ortak_id').notNull(),
    /**
     * Kayıt anındaki ref kodu.
     *
     * Ortağın GÜNCEL anahtarının kopyası değil, o an kullanılan kodun
     * kaydı: anahtar sonradan değişse bile hangi kodla gelindiği
     * tartışmasız kalmalı. Hakediş `ortakId` üzerinden yürüyor.
     */
    ortakAnahtari: text('ortak_anahtari').notNull(),
    /** Hangi tıklamadan geldiği; kanal kırılımını buna borçluyuz. */
    clickId: text('click_id'),
    medyaId: text('medya_id'),
    alt: jsonb('alt').$type<Partial<Record<AltParametre, string>>>().notNull().default({}),
    kaynak: text('kaynak').notNull(),
    olusturuldu: timestamp('olusturuldu', { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.kiraci, t.lynonOyuncuId] }),
    index('aff_eslesme_kiraci_ortak').on(t.kiraci, t.ortakId),
    index('aff_eslesme_kiraci_zaman').on(t.kiraci, t.olusturuldu.desc()),
  ],
);

/**
 * REDDEDİLEN EŞLEŞME DENEMELERİ.
 *
 * Bir ortak, başka bir ortağa ait oyuncuyu talep ettiğinde istek sessizce
 * yutulmuyor. Çoğu zaman masum (oyuncu ikinci kez, başka bir linkten
 * geliyor) ama aynı ortaktan yığınla çakışma gelmesi ortağın başkasının
 * trafiğini kendine yazmaya çalıştığının en net işareti.
 *
 * Sayı değil SATIR tutuluyor: "kim, kimin oyuncusunu, ne zaman" sorusu
 * bir sayaçtan cevaplanamaz.
 */
export const eslesmeCakismalari = pgTable(
  'aff_eslesme_cakismalari',
  {
    id: text('id').primaryKey(),
    kiraci: text('kiraci').notNull(),
    lynonOyuncuId: text('lynon_oyuncu_id').notNull(),
    /** Oyuncuyu talep eden ortak. */
    denenenOrtakId: text('denenen_ortak_id').notNull(),
    denenenOrtakAnahtari: text('denenen_ortak_anahtari').notNull(),
    /** Oyuncunun gerçekte ait olduğu ortak. */
    mevcutOrtakId: text('mevcut_ortak_id').notNull(),
    zaman: timestamp('zaman', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('aff_cakisma_kiraci_zaman').on(t.kiraci, t.zaman.desc()),
    index('aff_cakisma_kiraci_denenen').on(t.kiraci, t.denenenOrtakId),
  ],
);
