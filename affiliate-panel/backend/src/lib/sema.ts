import { doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
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
    /**
     * Hangi alt linkten geldiği; ALT LİNK ÜZERİNDEN gelmediyse (düz
     * `/c/...` linki) `null`. Alt link sayfası önceden `medyaId`+`alt`
     * imzasıyla tahmin yürütüyordu — iki medyasız alt link aynı imzayı
     * taşıdığı için ayırt edilemiyordu. Bu sütun kesin eşleştirme sağlar.
     */
    altLinkId: text('alt_link_id'),
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
    index('aff_tiklamalar_kiraci_altlink').on(t.kiraci, t.altLinkId),
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
    /**
     * Ölçümün geldiği dikey: `casino` | `spor` | `bilinmiyor`.
     *
     * `bilinmiyor`, `casino` ile aynı şey DEĞİL — toplam düzeyinde
     * rapor veren bir bağlantı iki dikeyi ayırmıyor ve o veriyi
     * casino diye etiketlemek spor gelirini casino oranıyla ödemek
     * olurdu. Varsayılan bu yüzden `bilinmiyor`.
     */
    dikey: text('dikey').notNull().default('bilinmiyor'),
    kaynak: text('kaynak').notNull(),
    yazildi: timestamp('yazildi', { withTimezone: true }).notNull(),
  },
  (t) => [
    // Gun basina ortak basina DIKEY basina TEK satir; idempotent
    // yazmanin dayanagi bu. Ayni gun hem casino hem spor satiri
    // olabilir ve ikisi birbirini ezmemeli.
    primaryKey({ columns: [t.kiraci, t.gun, t.ortakAnahtari, t.dikey] }),
    index('aff_olcumler_kiraci_gun').on(t.kiraci, t.gun),
    index('aff_olcumler_kiraci_ortak_dikey').on(t.kiraci, t.ortakAnahtari, t.dikey),
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
    /**
     * Hangi Lynon/backoffice BAĞLANTISINDAN geldiği (bkz. `adaptorler/kayit.ts`
     * · `Baglanti.id`). `lynon_oyuncu_id` yalnızca TEK bir Lynon sitesi
     * içinde benzersiz — iki farklı site aynı numaralı kimliği FARKLI
     * gerçek oyunculara verebilir. Bu sütun olmadan ikinci bir bağlantıdan
     * toplu geçiş yapmak, ilk bağlantıdaki aynı ID'li oyuncunun kaydının
     * SESSİZCE üzerine yazabilirdi (bkz. `zorlaAta`).
     *
     * S2S kayıt bildirimi ve webhook siteyi HİÇ bilmiyor (tek paylaşılan
     * anahtar/sır, bağlantı başına değil) — bu yollardan gelen her satır
     * `'varsayilan'`a düşüyor; bu da ilk (ve bugüne kadar HER kiracının
     * tek) bağlantının sabit kimliğiyle birebir aynı (bkz. `kayit.ts`
     * belge göçü). Yalnızca toplu geçiş, admin'in seçtiği GERÇEK
     * bağlantı kimliğini yazıyor.
     */
    baglantiId: text('baglanti_id').notNull().default('varsayilan'),
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
    /** Tıklamanın taşıdığı alt link; alt link bazlı yatırım/çekim raporunun dayanağı. */
    altLinkId: text('alt_link_id'),
    /**
     * Oyuncunun backoffice kullanıcı adı; VARSA. S2S kayıt bildirimi
     * verirse ya da toplu geçişte (kullanıcı adından arama zaten kendi
     * elinde) doluyor. Raporlarda oyuncuyu opak `lynon_oyuncu_id` yerine
     * okunur bir adla göstermek için — ID'nin kendisi hiçbir yerde
     * kullanıcıya anlamlı gelmiyor.
     */
    kullaniciAdi: text('kullanici_adi'),
    alt: jsonb('alt').$type<Partial<Record<AltParametre, string>>>().notNull().default({}),
    kaynak: text('kaynak').notNull(),
    olusturuldu: timestamp('olusturuldu', { withTimezone: true }).notNull(),
    /**
     * Oyuncunun Lynon'daki GERÇEK kayıt anı; VARSA (bkz. `oyuncuAra`).
     * `olusturuldu` ile KARIŞTIRILMAMALI: o, bizim eşleşme kaydımızın
     * oluşturulma anı — toplu geçişte bu, admin'in geçişi yaptığı an,
     * oyuncunun siteye kaydolduğu an DEĞİL. Bilinmiyorsa `null`; o zaman
     * ekran `olusturuldu`'ya düşer.
     */
    kayitTarihi: timestamp('kayit_tarihi', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.kiraci, t.baglantiId, t.lynonOyuncuId] }),
    index('aff_eslesme_kiraci_ortak').on(t.kiraci, t.ortakId),
    index('aff_eslesme_kiraci_zaman').on(t.kiraci, t.olusturuldu.desc()),
    index('aff_eslesme_kiraci_altlink').on(t.kiraci, t.altLinkId),
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

/**
 * ORTAK CÜZDANI — hareket defteri.
 *
 * Bakiye bir SÜTUN değil, hareketlerin toplamı. Sütun tutmak, bakiyenin
 * "neden bu rakam" sorusuna cevap veremeyen bir sayıya dönmesi demekti;
 * bir hata olduğunda geriye doğru izlenemezdi. Para söz konusuysa defter
 * şart.
 *
 * ── `kaynak_anahtari` neden BENZERSİZ ──
 *
 * Gece işi her gece çalışıyor ve iki konteynerde aynı anda çalışabilir.
 * Anahtar, "şu ay şu ortak için şu günkü hakediş" gibi bir kimlik
 * taşıyor; benzersiz kısıt aynı hakedişin iki kez alacak yazılmasını
 * VERİTABANI düzeyinde engelliyor.
 */
export const cuzdanHareketleri = pgTable(
  'aff_cuzdan_hareketleri',
  {
    id: text('id').primaryKey(),
    kiraci: text('kiraci').notNull(),
    ortakId: text('ortak_id').notNull(),
    /** `hakedis` (alacak) | `odeme` (borç) | `duzeltme` (elle). */
    tur: text('tur').notNull(),
    /** Alacak pozitif, borç negatif. */
    tutar: doublePrecision('tutar').notNull(),
    /** Hangi döneme ait: `YYYY-MM`. */
    donem: text('donem'),
    aciklama: text('aciklama'),
    kaynakAnahtari: text('kaynak_anahtari').notNull(),
    olusturuldu: timestamp('olusturuldu', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('aff_cuzdan_kiraci_kaynak').on(t.kiraci, t.kaynakAnahtari),
    index('aff_cuzdan_kiraci_ortak').on(t.kiraci, t.ortakId),
  ],
);

/**
 * WEBHOOK OLAY KUYRUĞU.
 *
 * Lynon olayı gönderiyor; uç imzayı doğrulayıp olayı BURAYA yazıyor ve
 * hemen 200 dönüyor. İşleme ayrı yürüyor.
 *
 * ── Neden bellekte değil, tabloda ──
 *
 * Bellekteki bir kuyruk, konteyner yeniden başladığında sessizce
 * boşalır: Lynon 200 aldığı için tekrar göndermez ve olay sonsuza kadar
 * kaybolur. Yatırım ve bahis kayıtları geriye dönük üretilemez.
 *
 * ── `imza` neden BENZERSİZ ──
 *
 * Tekrar saldırısına (replay) karşı ikinci hat. Zaman damgası imzalı
 * metnin içinde olduğu için aynı imza yalnızca aynı isteğe ait olabilir.
 */
export const webhookOlaylari = pgTable(
  'aff_webhook_olaylari',
  {
    id: text('id').primaryKey(),
    kiraci: text('kiraci').notNull(),
    imza: text('imza').notNull(),
    olayTuru: text('olay_turu').notNull(),
    oyuncuId: text('oyuncu_id').notNull(),
    /** Tutar olaya göre anlam değiştiriyor: yatırım, çekim, bahis, kazanç. */
    tutar: doublePrecision('tutar').notNull().default(0),
    /** Ham gövde; ileride yeni bir alan gerektiğinde kaynağa dönebilmek için. */
    govde: jsonb('govde').notNull(),
    durum: text('durum').notNull(),
    deneme: integer('deneme').notNull().default(0),
    sonHata: text('son_hata'),
    alindi: timestamp('alindi', { withTimezone: true }).notNull(),
    islendi: timestamp('islendi', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('aff_webhook_kiraci_imza').on(t.kiraci, t.imza),
    index('aff_webhook_kiraci_durum_alindi').on(t.kiraci, t.durum, t.alindi),
  ],
);

/**
 * OYUNCU BAZLI GÜNLÜK TOPLAMLAR.
 *
 * Webhook olayları buraya katlanıyor. Ortak bazlı `olcumler` tablosundan
 * AYRI bilerek: o, backoffice raporundan geliyor ve gün sonunda
 * kesinleşiyor. Aynı tabloya yazsalardı gün içi olaylar gün sonu
 * raporuyla çelişir ve hangisinin doğru olduğu belirsizleşirdi.
 *
 * ── Bilerek `baglantiId` YOK ──
 *
 * Webhook, TEK paylaşılan bir sırla tüm kiracıya bağlı — hangi Lynon
 * bağlantısından/sitesinden geldiğini hiç bilmiyor (bkz.
 * `webhookSirri.ts`). Bu yüzden her satır örtük biçimde tenant'ın
 * `'varsayilan'` (birincil/tek kurulan) sitesine ait sayılıyor; okuma
 * tarafı (`oyuncuFinansHaritasi`) bunu yalnızca `baglantiId: 'varsayilan'`
 * eşleşmeler için dikkate alıyor. İkinci bir siteden webhook almak
 * istenirse önce bağlantı başına ayrı bir webhook sırrı/ucu gerekir —
 * bu ayrı bir iş.
 */
export const oyuncuGunluk = pgTable(
  'aff_oyuncu_gunluk',
  {
    kiraci: text('kiraci').notNull(),
    gun: text('gun').notNull(),
    oyuncuId: text('oyuncu_id').notNull(),
    yatirim: doublePrecision('yatirim').notNull().default(0),
    cekim: doublePrecision('cekim').notNull().default(0),
    bahis: doublePrecision('bahis').notNull().default(0),
    kazanc: doublePrecision('kazanc').notNull().default(0),
    olaySayisi: integer('olay_sayisi').notNull().default(0),
    guncellendi: timestamp('guncellendi', { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.kiraci, t.gun, t.oyuncuId] }),
    index('aff_oyuncu_gunluk_kiraci_gun').on(t.kiraci, t.gun),
  ],
);

/**
 * OYUNCU BAZLI GÜNLÜK TOPLAMLAR — RAPOR KAYNAKLI.
 *
 * `oyuncuGunluk`'tan BİLEREK ayrı: o webhook'un gün-içi AKIŞI (`+=` ile
 * katlanıyor), bu ise Lynon'un backoffice RAPORUNUN (`oyuncuGunuCek`,
 * bkz. `gecmisGGR.ts`) o gün için verdiği KESİN toplam — her yazma bir
 * önceki değerin üzerine YAZAR (`SET`), üstüne eklemez. İkisini aynı
 * tabloda tutup `+=` ile birleştirseydik, rapor yeniden çalıştırıldığında
 * (idempotent olması gereken bir işlem) rakam katlanarak şişerdi.
 *
 * Aynı (gün, oyuncu) için iki kaynak da veri biriktirebilir (webhook
 * kurulduğunda + rapor da çalıştırılırsa); okuma tarafı (bkz.
 * `oyuncuEslesme.ts` · `oyuncuFinansHaritasi`) ikisini TOPLAMAZ, daha
 * büyük olanı esas alır — aynı olayı iki kaynaktan da saymamak için.
 */
export const oyuncuGunlukRapor = pgTable(
  'aff_oyuncu_gunluk_rapor',
  {
    kiraci: text('kiraci').notNull(),
    /**
     * Hangi bağlantının raporundan geldiği (bkz. `oyuncuEslesmeleri.baglantiId`
     * aynı gerekçe). `gecmisGGRDoldur` artık TÜM aktif bağlantıları
     * gezdiği için, iki farklı sitenin raporu aynı günde aynı numaralı
     * oyuncu için ayrı satır yazabilmeli -- aksi halde ikinci sitenin
     * raporu birincinin rakamını sessizce ezerdi.
     */
    baglantiId: text('baglanti_id').notNull().default('varsayilan'),
    gun: text('gun').notNull(),
    oyuncuId: text('oyuncu_id').notNull(),
    yatirim: doublePrecision('yatirim').notNull().default(0),
    cekim: doublePrecision('cekim').notNull().default(0),
    bahis: doublePrecision('bahis').notNull().default(0),
    kazanc: doublePrecision('kazanc').notNull().default(0),
    guncellendi: timestamp('guncellendi', { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.kiraci, t.baglantiId, t.gun, t.oyuncuId] }),
    index('aff_oyuncu_gunluk_rapor_kiraci_gun').on(t.kiraci, t.gun),
  ],
);
