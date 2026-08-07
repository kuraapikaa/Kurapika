import { degistir, diziOku, kayitOku, oku } from '../lib/depo.js';

/**
 * ÇOK KADEMELİ ORTAK YAPISI (sub-affiliate).
 *
 * Bir ortak başka ortakları sisteme getirebiliyor ve getirdiklerinin
 * kazancından pay alıyor.
 *
 * ── Neden ortak kaydından AYRI ──
 *
 * Hiyerarşi, ortak kaydına bir `ustOrtak` alanı olarak eklenebilirdi.
 * Ama kademe kuralları (hangi seviyede kaç yüzde) ortaktan bağımsız
 * bir POLİTİKA; ikisini aynı kayda sıkıştırmak, yüzdeyi değiştirmek
 * için her ortak kaydını düzenlemeyi zorunlu kılardı.
 */

const ALAN = 'kademeler';

/** Varsayılan: 1. seviye üst ortak %5, 2. seviye %2. */
export const VARSAYILAN_KADEME_YUZDELERI = [5, 2];

export interface KademeBagi {
  /** Alt ortağın izleme anahtarı. */
  ortakAnahtari: string;
  /** Onu getiren üst ortağın izleme anahtarı. */
  ustOrtakAnahtari: string;
  createdAt: string;
}

type Depo = {
  version: 1;
  baglar: KademeBagi[];
  /** Seviye başına yüzde; dizinin uzunluğu kademe derinliğini belirler. */
  kademeYuzdeleri: number[];
};

export class KademeHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'KademeHatasi';
  }
}

function cozDepo(ham: unknown): Depo {
  const kayit = kayitOku(ham);
  const yuzdeler = diziOku<unknown>(kayit.kademeYuzdeleri)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 0);
  return {
    version: 1,
    baglar: diziOku<KademeBagi>(kayit.baglar),
    kademeYuzdeleri: yuzdeler.length ? yuzdeler : [...VARSAYILAN_KADEME_YUZDELERI],
  };
}

/**
 * Bir ortağın üst zinciri; en yakın üstten başlayarak.
 *
 * DÖNGÜYE KARŞI KORUMALI. Veri bozulsa bile (elle düzenleme, kısmi
 * geri yükleme) sonsuz döngüye girmiyor: görülen her düğüm
 * işaretleniyor. Bu fonksiyon komisyon dağıtımında çağrıldığı için bir
 * döngü, isteği süresiz kilitler ve tüm paneli düşürürdü.
 */
export function ustZincir(baglar: KademeBagi[], ortakAnahtari: string, enFazlaSeviye: number): string[] {
  const ustHaritasi = new Map(baglar.map((b) => [b.ortakAnahtari, b.ustOrtakAnahtari]));
  const zincir: string[] = [];
  const gorulen = new Set<string>([ortakAnahtari]);

  let mevcut = ortakAnahtari;
  while (zincir.length < enFazlaSeviye) {
    const ust = ustHaritasi.get(mevcut);
    if (!ust || gorulen.has(ust)) break;
    zincir.push(ust);
    gorulen.add(ust);
    mevcut = ust;
  }
  return zincir;
}

/** Bağ eklemek bir döngü yaratır mı? */
export function donguYaratirMi(baglar: KademeBagi[], ortakAnahtari: string, ustOrtakAnahtari: string): boolean {
  if (ortakAnahtari === ustOrtakAnahtari) return true;
  const ustHaritasi = new Map(baglar.map((b) => [b.ortakAnahtari, b.ustOrtakAnahtari]));
  const gorulen = new Set<string>();
  let mevcut: string | undefined = ustOrtakAnahtari;
  while (mevcut && !gorulen.has(mevcut)) {
    if (mevcut === ortakAnahtari) return true;
    gorulen.add(mevcut);
    mevcut = ustHaritasi.get(mevcut);
  }
  return false;
}

export async function kademeDurumu(kiraci: string): Promise<{ baglar: KademeBagi[]; kademeYuzdeleri: number[] }> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  return { baglar: depo.baglar, kademeYuzdeleri: depo.kademeYuzdeleri };
}

export async function kademeBagiKur(
  kiraci: string,
  ortakAnahtari: string,
  ustOrtakAnahtari: string,
  simdi = new Date(),
): Promise<KademeBagi> {
  const alt = String(ortakAnahtari ?? '').trim();
  const ust = String(ustOrtakAnahtari ?? '').trim();
  if (!alt || !ust) throw new KademeHatasi('ortakAnahtari ve ustOrtakAnahtari zorunlu.');

  return degistir<Depo, KademeBagi>(kiraci, ALAN, cozDepo, (depo) => {
    if (donguYaratirMi(depo.baglar, alt, ust)) {
      throw new KademeHatasi('Bu bağ bir döngü yaratır; ortak kendi üstünün üstü olamaz.', 409);
    }
    const mevcut = depo.baglar.find((b) => b.ortakAnahtari === alt);
    if (mevcut) {
      mevcut.ustOrtakAnahtari = ust;
      return mevcut;
    }
    const bag: KademeBagi = { ortakAnahtari: alt, ustOrtakAnahtari: ust, createdAt: simdi.toISOString() };
    depo.baglar.push(bag);
    return bag;
  });
}

export async function kademeBagiKaldir(kiraci: string, ortakAnahtari: string): Promise<void> {
  await degistir<Depo, void>(kiraci, ALAN, cozDepo, (depo) => {
    depo.baglar = depo.baglar.filter((b) => b.ortakAnahtari !== ortakAnahtari);
  });
}

export async function kademeYuzdeleriniAyarla(kiraci: string, yuzdeler: number[]): Promise<number[]> {
  const temiz = (Array.isArray(yuzdeler) ? yuzdeler : []).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  if (!temiz.length) throw new KademeHatasi('En az bir seviye yüzdesi gerekli.');
  // Ust kademelerin toplami alt ortagin kendi kazancini gecemez; gecerse
  // her donusum zarar yazar ve bu ancak ay sonunda fark edilir.
  if (temiz.reduce((t, n) => t + n, 0) >= 100) {
    throw new KademeHatasi('Kademe yüzdelerinin toplamı %100 veya üzeri olamaz.');
  }

  return degistir<Depo, number[]>(kiraci, ALAN, cozDepo, (depo) => {
    depo.kademeYuzdeleri = temiz;
    return temiz;
  });
}

export interface KademePayi {
  ustOrtakAnahtari: string;
  /** 1 = doğrudan üst ortak. */
  seviye: number;
  yuzde: number;
  tutar: number;
}

/**
 * Bir ortağın kazancından üst kademelere düşen payları hesaplar.
 *
 * Pay alt ortağın kazancından KESİLMEZ, üstüne eklenir — bu bir
 * pazarlama gideri, alt ortağın gelirinden yapılan bir kesinti değil.
 * Tersi olsaydı alt ortak, kendisini kimin getirdiğine bağlı olarak
 * farklı kazanırdı ve bunu ona açıklamak mümkün olmazdı.
 */
export function kademePaylariHesapla(
  baglar: KademeBagi[],
  kademeYuzdeleri: number[],
  ortakAnahtari: string,
  ortakKazanci: number,
): KademePayi[] {
  if (!Number.isFinite(ortakKazanci) || ortakKazanci <= 0) return [];
  return ustZincir(baglar, ortakAnahtari, kademeYuzdeleri.length)
    .map((ustOrtakAnahtari, indeks) => {
      const yuzde = kademeYuzdeleri[indeks] ?? 0;
      return {
        ustOrtakAnahtari,
        seviye: indeks + 1,
        yuzde,
        // Kurusa yuvarlama: kayan nokta artiklari odeme kayitlarinda
        // 0.30000000000000004 gibi degerler birakiyordu.
        tutar: Math.round(ortakKazanci * (yuzde / 100) * 100) / 100,
      };
    })
    .filter((p) => p.tutar > 0);
}

/** Bir ortağın doğrudan alt ortakları. */
export async function altOrtaklar(kiraci: string, ustOrtakAnahtari: string): Promise<string[]> {
  const { baglar } = await kademeDurumu(kiraci);
  return baglar.filter((b) => b.ustOrtakAnahtari === ustOrtakAnahtari).map((b) => b.ortakAnahtari);
}
