import { and, eq, gte, lte, max, sql } from 'drizzle-orm';
import { degistir, kayitOku, oku } from '../lib/depo.js';
import { olcumler as tablo } from '../lib/sema.js';
import { veritabani } from '../lib/veritabani.js';
import type { HamOlcum } from '../adaptorler/tur.js';

/**
 * ÖLÇÜM DEPOSU — iki uygulama, tek arayüz.
 *
 * Ölçümler gün × ortak olarak büyüyor ve panelin her ekranı bunları
 * TARİH ARALIĞIYLA sorguluyor. Belge modelinde bir aylık hakediş
 * hesabı bile tüm geçmişi belleğe alıp orada süzüyordu.
 */

export type OlcumKaynagi = 'cekme' | 'itme';

export interface OrtakGunlukOlcum extends Omit<HamOlcum, 'yatiranOyuncular'> {
  /** Ölçümün hangi yoldan geldiği; karışık kaynakta ayırt edebilmek için. */
  kaynak: OlcumKaynagi;
  yazildi: string;
}

/**
 * `yatiranOyuncular` bilerek DIŞARIDA.
 *
 * O liste yalnızca ilk yatırım defterini beslemek için var ve
 * `senkron.ts` ölçümü yazmadan önce onu zaten ayırıyor. Tipten de
 * çıkarmak, ileride biri onu geçirdiğinde sessizce kaybolmak yerine
 * derleme hatası vermesini sağlıyor.
 */
export type YazilacakOlcum = Omit<HamOlcum, 'yatiranOyuncular'> & { kaynak: OlcumKaynagi };

export interface OlcumSorgusu {
  start?: string;
  end?: string;
  ortakAnahtari?: string;
}

export interface OlcumDeposu {
  yaz(kiraci: string, olcumler: YazilacakOlcum[], simdi: Date): Promise<number>;
  listele(kiraci: string, sorgu: OlcumSorgusu): Promise<OrtakGunlukOlcum[]>;
  sonGun(kiraci: string): Promise<string | null>;
}

const ALAN = 'olcumler';
const olcumAnahtari = (gun: string, ortakAnahtari: string) => `${gun}|${ortakAnahtari}`;

/**
 * Aynı (gün, ortak) için gelen tekrarları teke indirir.
 *
 * Postgres tek bir INSERT içinde aynı satırı iki kez güncelleyemiyor;
 * ayıklanmazsa deyimin tamamı düşerdi. Ayıklama İTME KURALINI de
 * uyguluyor: parti içinde önce itme gelip sonra çekme gelirse, çekme
 * onu geçemez.
 */
function tekillestir(olcumler: YazilacakOlcum[]): YazilacakOlcum[] {
  const secilmis = new Map<string, YazilacakOlcum>();
  for (const olcum of olcumler) {
    const anahtar = olcumAnahtari(olcum.gun, olcum.ortakAnahtari);
    const mevcut = secilmis.get(anahtar);
    if (mevcut?.kaynak === 'itme' && olcum.kaynak === 'cekme') continue;
    secilmis.set(anahtar, olcum);
  }
  return [...secilmis.values()];
}

/**
 * Sıralama SQL'de değil burada.
 *
 * `ORDER BY` metin sütununda veritabanının derlemesine (collation)
 * bağlı; üretimdeki Postgres ile testteki kümede farklı sonuç
 * verebiliyor. Türkçe `localeCompare` ile burada sıralamak iki
 * uygulamayı da aynı sonuca zorluyor. Pahalı olan iş -- aralık
 * süzmesi -- zaten indeksle veritabanında yapıldı.
 */
function sirala(olcumler: OrtakGunlukOlcum[]): OrtakGunlukOlcum[] {
  return olcumler.sort((a, b) =>
    a.gun === b.gun ? a.ortakAnahtari.localeCompare(b.ortakAnahtari, 'tr') : a.gun.localeCompare(b.gun),
  );
}

// ─────────────────────────── Postgres ───────────────────────────

const satirdanOlcum = (s: typeof tablo.$inferSelect): OrtakGunlukOlcum => ({
  gun: s.gun,
  ortakAnahtari: s.ortakAnahtari,
  oyuncuSayisi: s.oyuncuSayisi,
  aktifOyuncuSayisi: s.aktifOyuncuSayisi,
  yatirim: s.yatirim,
  cekim: s.cekim,
  ggr: s.ggr,
  ftdSayisi: s.ftdSayisi,
  kaynak: s.kaynak as OlcumKaynagi,
  yazildi: s.yazildi.toISOString(),
});

export function postgresOlcumDeposu(): OlcumDeposu {
  const vtZorunlu = () => {
    const vt = veritabani();
    if (!vt) throw new Error('Veritabanı hazır değil.');
    return vt;
  };

  return {
    async yaz(kiraci, olcumler, simdi) {
      const yazilacak = tekillestir(olcumler);
      if (!yazilacak.length) return 0;

      const yazildi = simdi.toISOString();
      const yazilanlar = await vtZorunlu()
        .insert(tablo)
        .values(yazilacak.map((o) => ({
          kiraci,
          gun: o.gun,
          ortakAnahtari: o.ortakAnahtari,
          oyuncuSayisi: o.oyuncuSayisi,
          aktifOyuncuSayisi: o.aktifOyuncuSayisi,
          yatirim: o.yatirim,
          cekim: o.cekim,
          ggr: o.ggr,
          ftdSayisi: o.ftdSayisi,
          kaynak: o.kaynak,
          yazildi: new Date(yazildi),
        })))
        .onConflictDoUpdate({
          target: [tablo.kiraci, tablo.gun, tablo.ortakAnahtari],
          set: {
            oyuncuSayisi: sql`excluded.oyuncu_sayisi`,
            aktifOyuncuSayisi: sql`excluded.aktif_oyuncu_sayisi`,
            yatirim: sql`excluded.yatirim`,
            cekim: sql`excluded.cekim`,
            ggr: sql`excluded.ggr`,
            ftdSayisi: sql`excluded.ftd_sayisi`,
            kaynak: sql`excluded.kaynak`,
            yazildi: sql`excluded.yazildi`,
          },
          // İTME ÇEKMEYİ EZMEZ. Olay düzeyinde gelen ölçüm, toplam
          // düzeyde çekilenden daha kesin; sonradan çalışan bir çekme
          // turu onu geri götürmemeli.
          setWhere: sql`NOT (${tablo.kaynak} = 'itme' AND excluded.kaynak = 'cekme')`,
        })
        .returning({ gun: tablo.gun });

      return yazilanlar.length;
    },

    async listele(kiraci, sorgu) {
      const kosullar = [eq(tablo.kiraci, kiraci)];
      if (sorgu.start) kosullar.push(gte(tablo.gun, sorgu.start));
      if (sorgu.end) kosullar.push(lte(tablo.gun, sorgu.end));
      if (sorgu.ortakAnahtari) kosullar.push(eq(tablo.ortakAnahtari, sorgu.ortakAnahtari));

      const satirlar = await vtZorunlu().select().from(tablo).where(and(...kosullar));
      return sirala(satirlar.map(satirdanOlcum));
    },

    async sonGun(kiraci) {
      const satirlar = await vtZorunlu()
        .select({ gun: max(tablo.gun) })
        .from(tablo)
        .where(eq(tablo.kiraci, kiraci));
      return satirlar[0]?.gun ?? null;
    },
  };
}

// ────────────────────────── Belge (JSON) ──────────────────────────

type BelgeDepo = {
  version: 1;
  /** Anahtar: `${gun}|${ortakAnahtari}` — gün başına tek satır. */
  olcumler: Record<string, OrtakGunlukOlcum>;
};

const cozDepo = (ham: unknown): BelgeDepo => ({
  version: 1,
  olcumler: kayitOku(kayitOku(ham).olcumler) as Record<string, OrtakGunlukOlcum>,
});

export function belgeOlcumDeposu(): OlcumDeposu {
  return {
    async yaz(kiraci, olcumler, simdi) {
      const yazilacak = tekillestir(olcumler);
      if (!yazilacak.length) return 0;
      return degistir<BelgeDepo, number>(kiraci, ALAN, cozDepo, (depo) => {
        let yazilan = 0;
        for (const olcum of yazilacak) {
          const anahtar = olcumAnahtari(olcum.gun, olcum.ortakAnahtari);
          const mevcut = depo.olcumler[anahtar];
          if (mevcut?.kaynak === 'itme' && olcum.kaynak === 'cekme') continue;
          depo.olcumler[anahtar] = { ...olcum, yazildi: simdi.toISOString() };
          yazilan += 1;
        }
        return yazilan;
      });
    },

    async listele(kiraci, sorgu) {
      const depo = await oku<BelgeDepo>(kiraci, ALAN, cozDepo);
      return sirala(
        Object.values(depo.olcumler).filter((o) => {
          if (sorgu.start && o.gun < sorgu.start) return false;
          if (sorgu.end && o.gun > sorgu.end) return false;
          if (sorgu.ortakAnahtari && o.ortakAnahtari !== sorgu.ortakAnahtari) return false;
          return true;
        }),
      );
    },

    async sonGun(kiraci) {
      const depo = await oku<BelgeDepo>(kiraci, ALAN, cozDepo);
      const gunler = Object.values(depo.olcumler).map((o) => o.gun).sort();
      return gunler.length ? gunler[gunler.length - 1] : null;
    },
  };
}

/** Çalışan depolama biçimine göre uygulamayı seçer. */
export function olcumDeposu(): OlcumDeposu {
  return veritabani() ? postgresOlcumDeposu() : belgeOlcumDeposu();
}
