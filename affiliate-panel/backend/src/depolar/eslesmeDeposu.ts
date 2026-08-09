import { randomUUID } from 'crypto';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { degistir, diziOku, kayitOku, oku } from '../lib/depo.js';
import { bitisGunSonuAni, gunAnahtari } from '../lib/gunler.js';
import { eslesmeCakismalari, oyuncuEslesmeleri } from '../lib/sema.js';
import { veritabani } from '../lib/veritabani.js';
import type { AltParametre } from '../servisler/izleme.js';

/**
 * OYUNCU EŞLEŞME DEPOSU.
 *
 * Kritik davranış tek bir yerde: `ekleYokSayarak`. "İlk kayıt kazanır"
 * kuralı burada uygulanıyor ve iki uygulamada da AYNI sonucu vermek
 * zorunda -- fark, bir ortağın başkasının oyuncusunu kapması demek.
 */

export type EslesmeKaynagi = 'kayit' | 'elle';

export interface OyuncuEslesmesi {
  /** Hangi Lynon bağlantısından/sitesinden geldiği; bkz. `sema.ts`. */
  baglantiId: string;
  lynonOyuncuId: string;
  ortakId: string;
  /** Kayıt anındaki ref kodu. */
  ortakAnahtari: string;
  clickId: string | null;
  medyaId: string | null;
  /** Tıklamanın taşıdığı alt link; alt link bazlı yatırım/çekim raporunun dayanağı. */
  altLinkId: string | null;
  /** Backoffice kullanıcı adı; varsa. Opak ID yerine raporlarda okunur ad göstermek için. */
  kullaniciAdi: string | null;
  alt: Partial<Record<AltParametre, string>>;
  kaynak: EslesmeKaynagi;
  olusturuldu: string;
  /** Oyuncunun Lynon'daki gerçek kayıt anı; bilinmiyorsa `null` (bkz. `sema.ts`). */
  kayitTarihi: string | null;
}

export interface EslesmeCakismasi {
  id: string;
  lynonOyuncuId: string;
  denenenOrtakId: string;
  denenenOrtakAnahtari: string;
  mevcutOrtakId: string;
  zaman: string;
}

export interface EslesmeSorgusu {
  ortakId?: string;
  limit?: number;
}

export interface GunlukEslesmeSorgusu {
  ortakId?: string;
  start?: string;
  end?: string;
}

export interface GunlukSayi {
  gun: string;
  sayi: number;
}

export interface EslesmeDeposu {
  /**
   * Ekler. Oyuncunun eşleşmesi ZATEN VARSA hiçbir şey yazmaz ve mevcut
   * kaydı döndürür — üzerine yazmak yasak.
   */
  ekleYokSayarak(kiraci: string, eslesme: OyuncuEslesmesi): Promise<{ eklendi: boolean; kayitli: OyuncuEslesmesi }>;
  /**
   * Yazar; kayıt VARSA üzerine yazar. Yalnızca admin eylemlerinden
   * (toplu geçiş, elle düzeltme) çağrılır -- `ekleYokSayarak`'ın aksine
   * "ilk kayıt kazanır" kuralını BİLEREK atlıyor: admin burada ground
   * truth'u düzeltiyor, tahmin etmiyor. Önceki kaydı (varsa) döndürür ki
   * çağıran "neydi, ne oldu" diyebilsin.
   */
  zorlaAta(kiraci: string, eslesme: OyuncuEslesmesi): Promise<{ oncekiKayit: OyuncuEslesmesi | null }>;
  /**
   * `baglantiId` verilmezse `'varsayilan'`a düşer -- S2S kaydı/webhook
   * gibi siteyi hiç bilmeyen çağıranlar için, mevcut tek-bağlantı
   * davranışını birebir koruyor.
   */
  bul(kiraci: string, lynonOyuncuId: string, baglantiId?: string): Promise<OyuncuEslesmesi | null>;
  /**
   * Bir eşleşmenin `baglantiId`sini değiştirir; `lynonOyuncuId` aynı kalır.
   * Çoklu bağlantıya geçmeden ÖNCE `'varsayilan'`a yazılmış kayıtları
   * gerçek bağlantısına taşımak için (bkz. `oyuncuEslesme.ts` ·
   * `varsayilanEslesmeleriDagit`). Hedefte ZATEN bir kayıt varsa (örn.
   * admin aynı oyuncuyu ayrıca elle de atadıysa) hiçbir şey yapmaz ve
   * `false` döner — üzerine yazmak burada da yasak, kaynak kayıt
   * taşınmadan olduğu gibi kalır.
   */
  baglantiDegistir(kiraci: string, eskiBaglantiId: string, lynonOyuncuId: string, yeniBaglantiId: string): Promise<boolean>;
  listele(kiraci: string, sorgu: EslesmeSorgusu): Promise<OyuncuEslesmesi[]>;
  cakismaYaz(kiraci: string, cakisma: EslesmeCakismasi): Promise<void>;
  cakismalariListele(kiraci: string, limit: number): Promise<EslesmeCakismasi[]>;
  /**
   * Gün başına yeni kayıt (eşleşme) sayısı; müşteri yolculuğu
   * grafiğinin "kayıt" basamağı. `listele()`'nin sabit üst sınırı var
   * (bkz. `sinirla`) — yüksek hacimli bir kiracıda bunu bellekte
   * gruplamak, geriye dönük düzeltilemeyecek şekilde EKSİK bir grafik
   * çizerdi. Bu yüzden ayrı, sınırsız bir toplama.
   */
  gunlukSayilar(kiraci: string, sorgu: GunlukEslesmeSorgusu): Promise<GunlukSayi[]>;
}

/**
 * Siteyi hiç bilmeyen çağıranların (S2S kaydı, webhook eşleştirmesi)
 * düştüğü bağlantı kimliği. Bir kiracının ilk (ve göç öncesi TEK)
 * bağlantısıyla birebir aynı (bkz. `adaptorler/kayit.ts`).
 */
export const VARSAYILAN_BAGLANTI_ID = 'varsayilan';

const ALAN = 'oyuncu-eslesmeleri';
const CAKISMA_ALANI = 'eslesme-cakismalari';
/** Çakışma kaydı sınırsız büyümesin; belge uygulamasında en yeniler tutulur. */
const CAKISMA_SINIRI = 2000;

const sinirla = (limit: unknown): number => Math.min(1000, Math.max(1, Number(limit) || 200));

// ─────────────────────────── Postgres ───────────────────────────

const satirdanEslesme = (s: typeof oyuncuEslesmeleri.$inferSelect): OyuncuEslesmesi => ({
  baglantiId: s.baglantiId,
  lynonOyuncuId: s.lynonOyuncuId,
  ortakId: s.ortakId,
  ortakAnahtari: s.ortakAnahtari,
  clickId: s.clickId,
  medyaId: s.medyaId,
  altLinkId: s.altLinkId,
  kullaniciAdi: s.kullaniciAdi,
  alt: s.alt ?? {},
  kaynak: s.kaynak as EslesmeKaynagi,
  olusturuldu: s.olusturuldu.toISOString(),
  kayitTarihi: s.kayitTarihi ? s.kayitTarihi.toISOString() : null,
});

const satirdanCakisma = (s: typeof eslesmeCakismalari.$inferSelect): EslesmeCakismasi => ({
  id: s.id,
  lynonOyuncuId: s.lynonOyuncuId,
  denenenOrtakId: s.denenenOrtakId,
  denenenOrtakAnahtari: s.denenenOrtakAnahtari,
  mevcutOrtakId: s.mevcutOrtakId,
  zaman: s.zaman.toISOString(),
});

export function postgresEslesmeDeposu(): EslesmeDeposu {
  const vtZorunlu = () => {
    const vt = veritabani();
    if (!vt) throw new Error('Veritabanı hazır değil.');
    return vt;
  };

  const bul = async (
    kiraci: string, lynonOyuncuId: string, baglantiId: string = VARSAYILAN_BAGLANTI_ID,
  ): Promise<OyuncuEslesmesi | null> => {
    const satirlar = await vtZorunlu()
      .select()
      .from(oyuncuEslesmeleri)
      .where(and(
        eq(oyuncuEslesmeleri.kiraci, kiraci),
        eq(oyuncuEslesmeleri.baglantiId, baglantiId),
        eq(oyuncuEslesmeleri.lynonOyuncuId, lynonOyuncuId),
      ))
      .limit(1);
    return satirlar.length ? satirdanEslesme(satirlar[0]) : null;
  };

  return {
    async ekleYokSayarak(kiraci, eslesme) {
      /*
       * Kural veritabanı kısıtında: `(kiraci, lynon_oyuncu_id)` birincil
       * anahtar, ekleme de `DO NOTHING`. Iki istek ayni anda gelse bile
       * ikincisi hicbir sey yazamaz -- "once bak sonra yaz" desenindeki
       * yaris burada yok.
       */
      const eklenen = await vtZorunlu()
        .insert(oyuncuEslesmeleri)
        .values({
          kiraci,
          baglantiId: eslesme.baglantiId,
          lynonOyuncuId: eslesme.lynonOyuncuId,
          ortakId: eslesme.ortakId,
          ortakAnahtari: eslesme.ortakAnahtari,
          clickId: eslesme.clickId,
          medyaId: eslesme.medyaId,
          altLinkId: eslesme.altLinkId,
          kullaniciAdi: eslesme.kullaniciAdi,
          alt: eslesme.alt,
          kaynak: eslesme.kaynak,
          olusturuldu: new Date(eslesme.olusturuldu),
          kayitTarihi: eslesme.kayitTarihi ? new Date(eslesme.kayitTarihi) : null,
        })
        .onConflictDoNothing()
        .returning();

      if (eklenen.length) return { eklendi: true, kayitli: satirdanEslesme(eklenen[0]) };

      const mevcut = await bul(kiraci, eslesme.lynonOyuncuId, eslesme.baglantiId);
      // Kisit yuzunden buraya ancak kayit VARSA dusulur; yine de savunmali
      // davranmak, ilerideki bir sema degisikliginde sessiz null yerine
      // acik hata verilmesini sagliyor.
      if (!mevcut) throw new Error('Eşleşme yazılamadı ve mevcut kayıt da okunamadı.');
      return { eklendi: false, kayitli: mevcut };
    },

    async zorlaAta(kiraci, eslesme) {
      const oncekiKayit = await bul(kiraci, eslesme.lynonOyuncuId, eslesme.baglantiId);
      await vtZorunlu()
        .insert(oyuncuEslesmeleri)
        .values({
          kiraci,
          baglantiId: eslesme.baglantiId,
          lynonOyuncuId: eslesme.lynonOyuncuId,
          ortakId: eslesme.ortakId,
          ortakAnahtari: eslesme.ortakAnahtari,
          clickId: eslesme.clickId,
          medyaId: eslesme.medyaId,
          altLinkId: eslesme.altLinkId,
          kullaniciAdi: eslesme.kullaniciAdi,
          alt: eslesme.alt,
          kaynak: eslesme.kaynak,
          olusturuldu: new Date(eslesme.olusturuldu),
          kayitTarihi: eslesme.kayitTarihi ? new Date(eslesme.kayitTarihi) : null,
        })
        .onConflictDoUpdate({
          target: [oyuncuEslesmeleri.kiraci, oyuncuEslesmeleri.baglantiId, oyuncuEslesmeleri.lynonOyuncuId],
          set: {
            ortakId: eslesme.ortakId,
            ortakAnahtari: eslesme.ortakAnahtari,
            clickId: eslesme.clickId,
            medyaId: eslesme.medyaId,
            altLinkId: eslesme.altLinkId,
            kullaniciAdi: eslesme.kullaniciAdi,
            alt: eslesme.alt,
            kaynak: eslesme.kaynak,
            olusturuldu: new Date(eslesme.olusturuldu),
            kayitTarihi: eslesme.kayitTarihi ? new Date(eslesme.kayitTarihi) : null,
          },
        });
      return { oncekiKayit };
    },

    bul,

    async baglantiDegistir(kiraci, eskiBaglantiId, lynonOyuncuId, yeniBaglantiId) {
      const hedefte = await bul(kiraci, lynonOyuncuId, yeniBaglantiId);
      if (hedefte) return false;
      const guncellenen = await vtZorunlu()
        .update(oyuncuEslesmeleri)
        .set({ baglantiId: yeniBaglantiId })
        .where(and(
          eq(oyuncuEslesmeleri.kiraci, kiraci),
          eq(oyuncuEslesmeleri.baglantiId, eskiBaglantiId),
          eq(oyuncuEslesmeleri.lynonOyuncuId, lynonOyuncuId),
        ))
        .returning({ lynonOyuncuId: oyuncuEslesmeleri.lynonOyuncuId });
      return guncellenen.length > 0;
    },

    async listele(kiraci, sorgu) {
      const kosullar = [eq(oyuncuEslesmeleri.kiraci, kiraci)];
      if (sorgu.ortakId) kosullar.push(eq(oyuncuEslesmeleri.ortakId, sorgu.ortakId));
      const satirlar = await vtZorunlu()
        .select()
        .from(oyuncuEslesmeleri)
        .where(and(...kosullar))
        .orderBy(desc(oyuncuEslesmeleri.olusturuldu), desc(oyuncuEslesmeleri.lynonOyuncuId))
        .limit(sinirla(sorgu.limit));
      return satirlar.map(satirdanEslesme);
    },

    async cakismaYaz(kiraci, cakisma) {
      await vtZorunlu().insert(eslesmeCakismalari).values({
        id: cakisma.id,
        kiraci,
        lynonOyuncuId: cakisma.lynonOyuncuId,
        denenenOrtakId: cakisma.denenenOrtakId,
        denenenOrtakAnahtari: cakisma.denenenOrtakAnahtari,
        mevcutOrtakId: cakisma.mevcutOrtakId,
        zaman: new Date(cakisma.zaman),
      });
    },

    async cakismalariListele(kiraci, limit) {
      const satirlar = await vtZorunlu()
        .select()
        .from(eslesmeCakismalari)
        .where(eq(eslesmeCakismalari.kiraci, kiraci))
        .orderBy(desc(eslesmeCakismalari.zaman), desc(eslesmeCakismalari.id))
        .limit(sinirla(limit));
      return satirlar.map(satirdanCakisma);
    },

    /** Gün sınırı kiracının zaman diliminde; bkz. `tiklamaDeposu.gunlukSayilar`. */
    async gunlukSayilar(kiraci, sorgu) {
      const kosullar = [eq(oyuncuEslesmeleri.kiraci, kiraci)];
      if (sorgu.ortakId) kosullar.push(eq(oyuncuEslesmeleri.ortakId, sorgu.ortakId));
      if (sorgu.start) kosullar.push(gte(oyuncuEslesmeleri.olusturuldu, new Date(sorgu.start)));
      if (sorgu.end) kosullar.push(lte(oyuncuEslesmeleri.olusturuldu, bitisGunSonuAni(sorgu.end)));

      const dilim = String(process.env.AFF_ZAMAN_DILIMI || 'Europe/Istanbul');
      const satirlar = await vtZorunlu().execute<{ gun: string; sayi: number }>(sql`
        SELECT to_char((${oyuncuEslesmeleri.olusturuldu} AT TIME ZONE ${dilim}), 'YYYY-MM-DD') AS gun,
               count(*)::int AS sayi
        FROM ${oyuncuEslesmeleri}
        WHERE ${and(...kosullar)}
        GROUP BY 1
        ORDER BY 1
      `);
      return satirlar.rows.map((r) => ({ gun: r.gun, sayi: Number(r.sayi) }));
    },
  };
}

// ────────────────────────── Belge (JSON) ──────────────────────────

type EslesmeBelgesi = { version: 1; eslesmeler: OyuncuEslesmesi[] };
type CakismaBelgesi = { version: 1; cakismalar: EslesmeCakismasi[] };

const cozEslesme = (ham: unknown): EslesmeBelgesi => ({
  version: 1,
  eslesmeler: diziOku<OyuncuEslesmesi>(kayitOku(ham).eslesmeler),
});
const cozCakisma = (ham: unknown): CakismaBelgesi => ({
  version: 1,
  cakismalar: diziOku<EslesmeCakismasi>(kayitOku(ham).cakismalar),
});

export function belgeEslesmeDeposu(): EslesmeDeposu {
  return {
    /*
     * `degistir()` ayni anahtar icin okuma-yazmayi siraya soktugu icin
     * kural TEK KONTEYNERDE dogru calisiyor. Yatay olceklemede iki surec
     * ayni anda "yok" gorup ikisi de yazabilir; Postgres uygulamasinda
     * boyle bir acik yok. Panel veritabanisiz calisabilsin diye bu
     * uygulama duruyor, uretimde kullanilan o degil.
     */
    async ekleYokSayarak(kiraci, eslesme) {
      return degistir<EslesmeBelgesi, { eklendi: boolean; kayitli: OyuncuEslesmesi }>(
        kiraci, ALAN, cozEslesme, (belge) => {
          const mevcut = belge.eslesmeler.find(
            (e) => e.lynonOyuncuId === eslesme.lynonOyuncuId && e.baglantiId === eslesme.baglantiId,
          );
          if (mevcut) return { eklendi: false, kayitli: mevcut };
          belge.eslesmeler.push(eslesme);
          return { eklendi: true, kayitli: eslesme };
        },
      );
    },

    async zorlaAta(kiraci, eslesme) {
      return degistir<EslesmeBelgesi, { oncekiKayit: OyuncuEslesmesi | null }>(
        kiraci, ALAN, cozEslesme, (belge) => {
          const index = belge.eslesmeler.findIndex(
            (e) => e.lynonOyuncuId === eslesme.lynonOyuncuId && e.baglantiId === eslesme.baglantiId,
          );
          const oncekiKayit = index >= 0 ? belge.eslesmeler[index] : null;
          if (index >= 0) belge.eslesmeler[index] = eslesme;
          else belge.eslesmeler.push(eslesme);
          return { oncekiKayit };
        },
      );
    },

    async bul(kiraci, lynonOyuncuId, baglantiId = VARSAYILAN_BAGLANTI_ID) {
      const belge = await oku<EslesmeBelgesi>(kiraci, ALAN, cozEslesme);
      return belge.eslesmeler.find((e) => e.lynonOyuncuId === lynonOyuncuId && e.baglantiId === baglantiId) ?? null;
    },

    async baglantiDegistir(kiraci, eskiBaglantiId, lynonOyuncuId, yeniBaglantiId) {
      return degistir<EslesmeBelgesi, boolean>(kiraci, ALAN, cozEslesme, (belge) => {
        const hedefVarMi = belge.eslesmeler.some(
          (e) => e.lynonOyuncuId === lynonOyuncuId && e.baglantiId === yeniBaglantiId,
        );
        if (hedefVarMi) return false;
        const index = belge.eslesmeler.findIndex(
          (e) => e.lynonOyuncuId === lynonOyuncuId && e.baglantiId === eskiBaglantiId,
        );
        if (index < 0) return false;
        belge.eslesmeler[index] = { ...belge.eslesmeler[index], baglantiId: yeniBaglantiId };
        return true;
      });
    },

    async listele(kiraci, sorgu) {
      const belge = await oku<EslesmeBelgesi>(kiraci, ALAN, cozEslesme);
      return belge.eslesmeler
        .filter((e) => !sorgu.ortakId || e.ortakId === sorgu.ortakId)
        .sort((a, b) => (b.olusturuldu.localeCompare(a.olusturuldu) || b.lynonOyuncuId.localeCompare(a.lynonOyuncuId)))
        .slice(0, sinirla(sorgu.limit));
    },

    async cakismaYaz(kiraci, cakisma) {
      await degistir<CakismaBelgesi, void>(kiraci, CAKISMA_ALANI, cozCakisma, (belge) => {
        belge.cakismalar.push(cakisma);
        if (belge.cakismalar.length > CAKISMA_SINIRI) {
          belge.cakismalar = belge.cakismalar.slice(-CAKISMA_SINIRI);
        }
      });
    },

    async cakismalariListele(kiraci, limit) {
      const belge = await oku<CakismaBelgesi>(kiraci, CAKISMA_ALANI, cozCakisma);
      return [...belge.cakismalar]
        .sort((a, b) => (b.zaman.localeCompare(a.zaman) || b.id.localeCompare(a.id)))
        .slice(0, sinirla(limit));
    },

    async gunlukSayilar(kiraci, sorgu) {
      const belge = await oku<EslesmeBelgesi>(kiraci, ALAN, cozEslesme);
      const baslangic = sorgu.start ? new Date(sorgu.start).toISOString() : null;
      const bitis = sorgu.end ? bitisGunSonuAni(sorgu.end).toISOString() : null;

      const gunler = new Map<string, number>();
      for (const e of belge.eslesmeler) {
        if (sorgu.ortakId && e.ortakId !== sorgu.ortakId) continue;
        if (baslangic && e.olusturuldu < baslangic) continue;
        if (bitis && e.olusturuldu > bitis) continue;
        const gun = gunAnahtari(new Date(e.olusturuldu));
        gunler.set(gun, (gunler.get(gun) ?? 0) + 1);
      }
      return [...gunler.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([gun, sayi]) => ({ gun, sayi }));
    },
  };
}

/** Çalışan depolama biçimine göre uygulamayı seçer. */
export function eslesmeDeposu(): EslesmeDeposu {
  return veritabani() ? postgresEslesmeDeposu() : belgeEslesmeDeposu();
}

export const yeniCakismaId = (): string => randomUUID();
