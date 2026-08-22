/**
 * KASA AÇMA — ödül havuzu ve çekiliş.
 *
 * Oyuncu bakiyesinden bir bedel düşülerek "kasa" açılıyor ve içinden
 * ağırlıklı bir ödül çıkıyor.
 *
 * ── Neden ayrı ve saf bir dosya ───────────────────────────────────────
 * Burada iki şey birden var: PARA (bedel düşülüyor, ödül yazılıyor) ve
 * ŞANS. İkisinin birleştiği yer, hataların en pahalı olduğu yerdir --
 * yanlış bir ağırlık hesabı doğrudan kasa zararıdır ve canlıda fark
 * edilmesi haftalar sürer. Bu yüzden çekiliş, Lynon'a hiç gitmeden
 * test edilebiliyor: rastgelelik dışarıdan veriliyor.
 *
 * ── Beklenen değer görünür ────────────────────────────────────────────
 * Her kasa için "bir açılışın ortalama maliyeti" hesaplanabiliyor
 * (`beklenenDeger`). Panelde bedelin yanında gösteriliyor: bir kasanın
 * zararına çalıştığı, ilk oyuncu binlerce kez açtıktan sonra değil,
 * kaydedilirken görülmeli.
 */

export type KasaOdulu = {
  id: string;
  /** Oyuncuya gösterilen ad. */
  label: string;
  /** Bakiyeye yazılacak tutar (₺). 0 ise "boş" ödüldür. */
  amount: number;
  /** Çekiliş ağırlığı. Yüzde DEĞİL — toplama göre normalize edilir. */
  weight: number;
  /** Görsel katman: 'normal' | 'nadir' | 'efsane' */
  rarity?: 'normal' | 'nadir' | 'efsane';
};

export type Kasa = {
  id: string;
  label: string;
  /** Açılış bedeli (₺). 0 ise bedelsiz. */
  price: number;
  enabled?: boolean;
  /** Günde kaç kez açılabilir. 0/boş = sınırsız. */
  dailyLimit?: number;
  /** Açılabilmesi için gereken en az son yatırım. */
  minDeposit?: number;
  rewards: KasaOdulu[];
  /** Kart görseli. */
  image?: string;
};

export type CekilisSonucu = {
  odul: KasaOdulu;
  /** Ödülün seçilme olasılığı (0–1). Denetim kaydına yazılıyor. */
  olasilik: number;
};

/** Geçerli ödüller: ağırlığı pozitif ve tutarı sayı olanlar. */
export function gecerliOduller(kasa: Kasa | null | undefined): KasaOdulu[] {
  return (kasa?.rewards ?? []).filter(
    (o) => o && Number.isFinite(Number(o.weight)) && Number(o.weight) > 0
      && Number.isFinite(Number(o.amount)) && Number(o.amount) >= 0,
  );
}

/**
 * Bir açılışın ortalama maliyeti.
 *
 * Σ(tutar × ağırlık) / Σ(ağırlık). Bedelden BÜYÜKSE kasa zararına
 * çalışıyordur; panel bunu kaydetmeden önce söylüyor.
 */
export function beklenenDeger(kasa: Kasa | null | undefined): number {
  const oduller = gecerliOduller(kasa);
  const toplamAgirlik = oduller.reduce((t, o) => t + Number(o.weight), 0);
  if (toplamAgirlik <= 0) return 0;
  const toplam = oduller.reduce((t, o) => t + Number(o.amount) * Number(o.weight), 0);
  return Math.round((toplam / toplamAgirlik) * 100) / 100;
}

/** Kasanın kâr marjı (%). Negatifse zararına çalışıyor. */
export function kasaMarji(kasa: Kasa | null | undefined): number | null {
  const bedel = Number(kasa?.price ?? 0);
  if (!(bedel > 0)) return null;
  return Math.round((1 - beklenenDeger(kasa) / bedel) * 1000) / 10;
}

/**
 * Ağırlıklı çekiliş.
 *
 * `rastgele` DIŞARIDAN veriliyor (0 ≤ r < 1): çekilişin doğruluğu
 * ancak belirlenimli olarak test edilebilir. `Math.random()` içeride
 * çağrılsaydı "en pahalı ödül bir kez bile çıkıyor mu" sorusu ancak
 * canlıda yanıtlanırdı.
 */
export function odulCek(kasa: Kasa, rastgele: number): CekilisSonucu | null {
  const oduller = gecerliOduller(kasa);
  if (oduller.length === 0) return null;

  const toplam = oduller.reduce((t, o) => t + Number(o.weight), 0);
  // Sinir disi bir `rastgele` degeri son odule dusmeli, hicbir sey
  // dondurmemeli degil: bos donmek, bedeli alinmis bir acilisi odulsuz
  // birakirdi.
  const hedef = Math.max(0, Math.min(0.999999, rastgele)) * toplam;

  let birikim = 0;
  for (const odul of oduller) {
    birikim += Number(odul.weight);
    if (hedef < birikim) {
      return { odul, olasilik: Math.round((Number(odul.weight) / toplam) * 10000) / 10000 };
    }
  }
  const son = oduller[oduller.length - 1];
  return { odul: son, olasilik: Math.round((Number(son.weight) / toplam) * 10000) / 10000 };
}

export type AcilisEngeli =
  | { uygun: true }
  | { uygun: false; kod: 'kapali' | 'odulYok' | 'bakiyeYetersiz' | 'gunlukLimit' | 'yatirimYetersiz'; mesaj: string };

/**
 * Açılış ön kontrolü.
 *
 * Bakiye kontrolü BURADA yapılıyor ama tek başına yeterli değil: gerçek
 * düşüm Lynon'da ve arada oyuncu başka yerde harcayabilir. Bu yüzden
 * çağıran taraf düşümün SONUCUNA da bakmak zorunda. Buradaki kontrol,
 * kesin olmayan ama ucuz bir ön eleme -- yetersiz bakiyeyle Lynon'a
 * gidip hata almak yerine oyuncuya anlaşılır bir mesaj veriyor.
 */
export function acilisiDogrula(input: {
  kasa: Kasa | null | undefined;
  bakiye: number | null | undefined;
  bugunAcilis: number;
  sonYatirim?: number | null;
}): AcilisEngeli {
  const { kasa } = input;
  if (!kasa || kasa.enabled === false) {
    return { uygun: false, kod: 'kapali', mesaj: 'Bu kasa şu anda kapalı.' };
  }
  if (gecerliOduller(kasa).length === 0) {
    return { uygun: false, kod: 'odulYok', mesaj: 'Bu kasada tanımlı ödül yok.' };
  }

  const limit = Number(kasa.dailyLimit ?? 0);
  if (limit > 0 && input.bugunAcilis >= limit) {
    return {
      uygun: false,
      kod: 'gunlukLimit',
      mesaj: `Bu kasa için günlük açılış hakkınız doldu (${limit}).`,
    };
  }

  const enAzYatirim = Number(kasa.minDeposit ?? 0);
  if (enAzYatirim > 0 && Number(input.sonYatirim ?? 0) < enAzYatirim) {
    return {
      uygun: false,
      kod: 'yatirimYetersiz',
      mesaj: `Bu kasa için son yatırımınız en az ${enAzYatirim} ₺ olmalı.`,
    };
  }

  const bedel = Number(kasa.price ?? 0);
  if (bedel > 0 && Number(input.bakiye ?? 0) < bedel) {
    return {
      uygun: false,
      kod: 'bakiyeYetersiz',
      mesaj: `Bakiyeniz yetersiz. Bu kasa ${bedel} ₺, bakiyeniz ${Number(input.bakiye ?? 0).toFixed(2)} ₺.`,
    };
  }

  return { uygun: true };
}

/** Panelde gösterilecek özet — sır sayılan ağırlıklar dışarı verilmez. */
export function kasaVitrini(kasa: Kasa): {
  id: string; label: string; price: number; image?: string;
  dailyLimit: number; minDeposit: number;
  enBuyukOdul: number; odulSayisi: number;
  oduller: Array<{ label: string; amount: number; rarity: string; olasilik: number }>;
} {
  const oduller = gecerliOduller(kasa);
  const toplam = oduller.reduce((t, o) => t + Number(o.weight), 0) || 1;
  return {
    id: kasa.id,
    label: kasa.label,
    price: Number(kasa.price ?? 0),
    image: kasa.image,
    dailyLimit: Number(kasa.dailyLimit ?? 0),
    minDeposit: Number(kasa.minDeposit ?? 0),
    enBuyukOdul: oduller.reduce((m, o) => Math.max(m, Number(o.amount)), 0),
    odulSayisi: oduller.length,
    /**
     * Olasılıklar oyuncuya AÇIK gösteriliyor. Gizlemek, kasa içeriğini
     * tahmin oyununa çevirir ve şikâyet geldiğinde elde gösterilecek bir
     * şey kalmaz. Ham ağırlık yerine normalize olasılık veriliyor --
     * ağırlıklar iç ayardır, olasılık oyuncunun hakkıdır.
     */
    oduller: oduller
      .map((o) => ({
        label: o.label,
        amount: Number(o.amount),
        rarity: o.rarity ?? 'normal',
        olasilik: Math.round((Number(o.weight) / toplam) * 10000) / 100,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}
