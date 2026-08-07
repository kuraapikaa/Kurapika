import path from 'path';
import { fileURLToPath } from 'url';
import { safeTenantKey } from '../../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../../lib/documentStore.js';

/**
 * AFFILIATE / CRM ÇEKİRDEĞİ — PROTOKOLDEN BAĞIMSIZ.
 *
 * Kendi affiliate ve CRM yazılımımızın veri modeli. Lynon'un ya da başka
 * bir sağlayıcının şemasını taklit ETMİYOR: dışarıdan gelen her şey
 * adaptörlerde bu modele çevrilir.
 *
 * Ayrım bilerek: Lynon'a bağlanmanın iki yolu var ve ikisi de bu modeli
 * beslemeli.
 *
 *   ÇEKME — Lynon'un kendi raporlarını periyodik okumak. Bugün çalışan
 *   yol; kayıt olmayı gerektirmiyor ama veri toplam düzeyinde geliyor.
 *
 *   İTME — Lynon'un third-party affiliate ekranına kaydolup olayları
 *   anlık almak. Olay düzeyinde veri verir ama Lynon'un desteklediği
 *   altı sabit tipten birinin protokolünü konuşmayı zorunlu kılar.
 *
 * Çekirdek ikisini de bilmediği için adaptör değiştiğinde panel, komisyon
 * hesabı ve CRM ekranlarının hiçbiri değişmiyor.
 *
 * ── Neden GÜNLÜK ANLIK GÖRÜNTÜ saklıyoruz ──
 *
 * Mevcut panel Lynon'dan istek anında bir tarih aralığı özeti çekiyor ve
 * hiçbir yere yazmıyor. Bu, "dün ne oldu" sorusuna cevap veriyor ama
 * "bu ortak son 30 günde büyüdü mü", "hangi hafta düştü", "bu oyuncu
 * kohortu nasıl davrandı" sorularına ASLA cevap veremiyor — çünkü geçmiş
 * hiçbir zaman kaydedilmiyor. Geriye dönük üretilemeyen tek şey budur:
 * bugün yazmazsak o gün sonsuza kadar kayıptır.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERI_DIZINI = path.join(__dirname, '..', '..', 'data', 'affiliate-crm');

/** Bir ortağın bir gündeki ölçümü. Kaynak ne olursa olsun aynı şekil. */
export interface OrtakGunlukOlcum {
  /** Türkiye iş günü (YYYY-MM-DD). */
  gun: string;
  /** Ortağı tanımlayan anahtar. Çekmede BTag, itmede tracking token. */
  ortakAnahtari: string;
  oyuncuSayisi: number;
  aktifOyuncuSayisi: number;
  yatirim: number;
  cekim: number;
  ggr: number;
  /** İlk yatırımını bu gün yapan oyuncu sayısı. Çekmede bilinmeyebilir. */
  ftdSayisi: number | null;
  /** Ölçümün hangi yoldan geldiği; karışık kaynakta ayırt edebilmek için. */
  kaynak: 'cekme' | 'itme';
  yazildi: string;
}

type Depo = {
  version: 1;
  /** Anahtar: `${gun}|${ortakAnahtari}` — gün başına tek satır. */
  olcumler: Record<string, OrtakGunlukOlcum>;
};

const bosDepo = (): Depo => ({ version: 1, olcumler: {} });

const olcumAnahtari = (gun: string, ortakAnahtari: string) => `${gun}|${ortakAnahtari}`;

function depoYolu(tenantKey: string): string {
  return path.join(VERI_DIZINI, `${safeTenantKey(tenantKey)}.json`);
}

async function depoOku(tenantKey: string): Promise<Depo> {
  const kayit = await readStoredDocument<Partial<Depo>>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'affiliate-crm',
    filePath: depoYolu(tenantKey),
    fallback: bosDepo,
  });
  return {
    version: 1,
    olcumler: kayit.olcumler && typeof kayit.olcumler === 'object' ? kayit.olcumler : {},
  };
}

async function depoYaz(tenantKey: string, depo: Depo): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'affiliate-crm', filePath: depoYolu(tenantKey) },
    depo,
  );
}

export type YazilacakOlcum = Omit<OrtakGunlukOlcum, 'yazildi'>;

/**
 * Ölçümleri yazar. Aynı (gün, ortak) için tekrar yazmak ÜZERİNE YAZAR.
 *
 * Idempotent olması şart: iş günde birden çok kez çalışabilir, gün
 * içinde çekilen bir ölçüm gün kapandıktan sonra güncellenmelidir.
 * Eklemeli olsaydı her tur rakamları şişirirdi.
 *
 * İTME ÇEKMEYİ EZMEZ. Olay düzeyinde gelen bir ölçüm, toplam düzeyde
 * çekilenden daha kesin; sonradan çalışan bir çekme turu onu geri
 * götürmemeli.
 */
export async function olcumleriYaz(tenantKey: string, olcumler: YazilacakOlcum[], simdi = new Date()): Promise<number> {
  if (!olcumler.length) return 0;
  const depo = await depoOku(tenantKey);
  let yazilan = 0;

  for (const olcum of olcumler) {
    const anahtar = olcumAnahtari(olcum.gun, olcum.ortakAnahtari);
    const mevcut = depo.olcumler[anahtar];
    if (mevcut?.kaynak === 'itme' && olcum.kaynak === 'cekme') continue;
    depo.olcumler[anahtar] = { ...olcum, yazildi: simdi.toISOString() };
    yazilan += 1;
  }

  await depoYaz(tenantKey, depo);
  return yazilan;
}

export interface OlcumSorgusu {
  start?: string;
  end?: string;
  ortakAnahtari?: string;
}

export async function olcumleriOku(tenantKey: string, sorgu: OlcumSorgusu = {}): Promise<OrtakGunlukOlcum[]> {
  const depo = await depoOku(tenantKey);
  return Object.values(depo.olcumler)
    .filter((o) => {
      if (sorgu.start && o.gun < sorgu.start) return false;
      if (sorgu.end && o.gun > sorgu.end) return false;
      if (sorgu.ortakAnahtari && o.ortakAnahtari !== sorgu.ortakAnahtari) return false;
      return true;
    })
    .sort((a, b) => (a.gun === b.gun ? a.ortakAnahtari.localeCompare(b.ortakAnahtari) : a.gun.localeCompare(b.gun)));
}

export interface OrtakOzeti {
  ortakAnahtari: string;
  gunSayisi: number;
  oyuncuSayisi: number;
  aktifOyuncuSayisi: number;
  yatirim: number;
  cekim: number;
  ggr: number;
  ftdSayisi: number | null;
  /** Dönem içindeki günlük GGR serisi; panelde eğilim çizmek için. */
  gunlukGgr: Array<{ gun: string; ggr: number }>;
}

/**
 * Ortak başına dönem özeti.
 *
 * Oyuncu sayıları TOPLANMAZ, en yüksek gün alınır. Günlük ölçümlerdeki
 * oyuncu sayısı bir stok değeri (o gün kaç oyuncu vardı), akış değeri
 * değil; 30 günü toplamak aynı oyuncuyu 30 kez saymak olurdu. Para
 * alanları ise akış olduğu için toplanır.
 */
export async function ortakOzetleri(tenantKey: string, sorgu: OlcumSorgusu = {}): Promise<OrtakOzeti[]> {
  const olcumler = await olcumleriOku(tenantKey, sorgu);
  const gruplar = new Map<string, OrtakOzeti>();

  for (const o of olcumler) {
    const mevcut = gruplar.get(o.ortakAnahtari) ?? {
      ortakAnahtari: o.ortakAnahtari,
      gunSayisi: 0,
      oyuncuSayisi: 0,
      aktifOyuncuSayisi: 0,
      yatirim: 0,
      cekim: 0,
      ggr: 0,
      ftdSayisi: null,
      gunlukGgr: [],
    };

    mevcut.gunSayisi += 1;
    mevcut.oyuncuSayisi = Math.max(mevcut.oyuncuSayisi, o.oyuncuSayisi);
    mevcut.aktifOyuncuSayisi = Math.max(mevcut.aktifOyuncuSayisi, o.aktifOyuncuSayisi);
    mevcut.yatirim += o.yatirim;
    mevcut.cekim += o.cekim;
    mevcut.ggr += o.ggr;
    // FTD bir akis degeri ve yalnizca itme yolunda biliniyor. Hicbir gun
    // bilinmiyorsa `null` kalir -- 0 yazmak "hic ilk yatirim olmadi"
    // demek olurdu, oysa dogrusu "olculmedi".
    if (o.ftdSayisi !== null) mevcut.ftdSayisi = (mevcut.ftdSayisi ?? 0) + o.ftdSayisi;
    mevcut.gunlukGgr.push({ gun: o.gun, ggr: o.ggr });

    gruplar.set(o.ortakAnahtari, mevcut);
  }

  return [...gruplar.values()].sort((a, b) => b.ggr - a.ggr);
}

/** Kaydı olan en son gün; işin nereden devam edeceğini belirler. */
export async function sonOlculenGun(tenantKey: string): Promise<string | null> {
  const depo = await depoOku(tenantKey);
  const gunler = Object.values(depo.olcumler).map((o) => o.gun).sort();
  return gunler.length ? gunler[gunler.length - 1] : null;
}
