/**
 * ÖZEL ORAN.
 *
 * Panelden bir maça "özel oran" tanımlanıyor. Oyuncu bahsi SİTEDE,
 * sitenin kendi oranıyla alıyor. Maç sonuçlandığında panel aradaki
 * farkı bakiyeye düzeltme olarak yazıyor.
 *
 * ── Neden fark, tam kazanç değil ──────────────────────────────────────
 * Site zaten kendi oranından ödüyor. Özel oranın tamamını yazsaydık
 * oyuncu iki kez ödenirdi. Ödenen tutar:
 *
 *     ek ödeme = tutar × (özel oran − bahsin ALINDIĞI oran)
 *
 * ── Neden "alınan oran", kaydedilmiş bir taban değil ──────────────────
 * Teklif kaydedilirken site oranı 2.10 olabilir ama oyuncu bahsi
 * aldığında 2.05'e düşmüş olabilir. Kaydedilmiş tabanı kullansaydık
 * oyuncuya eksik öderdik ve sebebini kimse bulamazdı. Bahsin gerçekten
 * alındığı oran bahis geçmişinde duruyor; kaynak o.
 *
 * ── Kimler taranıyor ──────────────────────────────────────────────────
 * Oyuncu teklife "katıl" diyor; sonuçlanmada yalnızca KATILANLARIN
 * bahisleri taranıyor. Tüm oyuncuların geçmişini taramak, her teklif
 * için binlerce sorgu demekti.
 */

export type OzelOranTeklifi = {
  id: string;
  /** Maç adı — bahis geçmişindeki `MatchName` ile eşleşmeli. */
  matchName: string;
  /** Pazar (ör. "Maç Sonucu"). Boşsa pazar aranmaz. */
  marketName?: string;
  /** Seçim (ör. "Galatasaray"). */
  selectionName: string;
  /** Panelin vaat ettiği oran. */
  specialOdd: number;
  /** Ek ödemeye esas alınacak en yüksek bahis tutarı. */
  maxStake: number;
  /** Bu tutarın altındaki bahisler kapsam dışı. */
  minStake?: number;
  /** Bahsin alınabileceği pencere (ISO). */
  opensAt?: string | null;
  closesAt?: string | null;
  enabled?: boolean;
  /** 'acik' | 'kilitli' | 'sonuclandi' | 'iptal' */
  status?: string;
  /** Sonuç: 'kazandi' | 'kaybetti' | 'iade' */
  result?: string | null;
  note?: string;
};

/** Bahis geçmişinden gelen satır (mapSportBet çıktısı). */
export type BahisSatiri = {
  Id?: unknown;
  Amount?: unknown;
  Price?: unknown;
  StateName?: unknown;
  MatchName?: unknown;
  MarketName?: unknown;
  SelectionName?: unknown;
  CreatedLocal?: unknown;
  IsBonusBet?: unknown;
  [key: string]: unknown;
};

export type EslesmeSonucu =
  | { uygun: true; bahis: BahisSatiri; tutar: number; alinanOran: number; betId: string }
  | { uygun: false; kod: EslesmeHatasi; mesaj: string };

export type EslesmeHatasi =
  | 'bahisYok' | 'kazanmadi' | 'bonusBahis' | 'tutarDusuk' | 'pencereDisi';

const sayi = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const metin = (v: unknown): string => String(v ?? '').trim();

/**
 * Metin karşılaştırması — KELİME tabanlı, alt dizge değil.
 *
 * ── Neden alt dizge yetmiyor ──────────────────────────────────────────
 * Panelde "Galatasaray - Fenerbahçe" yazıyor, Lynon
 * "Galatasaray SK - Fenerbahçe SK" döndürüyor. Alt dizge arasaydık
 * hiçbir maç tutmazdı ve modül sessizce HİÇ KİMSEYE ödeme yapmazdı --
 * en kötü hata türü, çünkü çalışıyor gibi görünür.
 *
 * Aranan metnin ANLAMLI kelimelerinin hepsi bahis satırında geçiyorsa
 * eşleşme sayılıyor. "Galatasaray" ve "Fenerbahçe" ikisi de geçiyor →
 * eşleşir; "Beşiktaş - Trabzonspor" → eşleşmez.
 *
 * ── Neden 3 harften kısa kelimeler atılıyor ───────────────────────────
 * "SK", "FC", "AŞ" gibi ekler bir tarafta olup diğerinde olmuyor.
 * Sayılmasalardı eşleşme yönü önemli hale gelirdi: "Galatasaray SK"
 * aranırken "Galatasaray" bulunamazdı.
 */
export function kelimeler(metinDegeri: unknown): string[] {
  return metin(metinDegeri)
    .toLocaleLowerCase('tr-TR')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((k) => k.length >= 3);
}

export function metinEslesiyorMu(bahisteki: unknown, aranan: unknown): boolean {
  const aranankelimeler = kelimeler(aranan);
  // Aranan bos ya da yalnizca kisa eklerden olusuyorsa sart uygulanmaz
  // (pazar alani opsiyonel).
  if (aranankelimeler.length === 0) return true;
  const bahisKelimeleri = new Set(kelimeler(bahisteki));
  if (bahisKelimeleri.size === 0) return false;
  return aranankelimeler.every((k) => bahisKelimeleri.has(k));
}

/** Bahis kazandı mı? Lynon durum adları kurulumdan kuruluma değişiyor. */
export function kazandiMi(durum: unknown): boolean {
  const d = metin(durum).toLocaleLowerCase('tr-TR');
  return ['won', 'win', 'kazandı', 'kazandi', 'winner'].some((k) => d.includes(k));
}

/**
 * Oyuncunun bahisleri içinde teklife uyan KAZANMIŞ bahsi bulur.
 *
 * Birden fazla uyan bahis varsa EN BÜYÜĞÜ seçiliyor: oyuncu aynı maça
 * birkaç kupon yapmış olabilir ve hangisini kastettiğini soramayız;
 * lehe yorum, şikâyet üretmeyen yorumdur. Üst sınır zaten `maxStake`.
 */
export function uygunBahsiBul(
  bahisler: BahisSatiri[] | null | undefined,
  teklif: OzelOranTeklifi,
): EslesmeSonucu {
  const liste = Array.isArray(bahisler) ? bahisler : [];

  const maciTutanlar = liste.filter((b) =>
    metinEslesiyorMu(b.MatchName, teklif.matchName)
    && metinEslesiyorMu(b.SelectionName, teklif.selectionName)
    && (!teklif.marketName || metinEslesiyorMu(b.MarketName, teklif.marketName)));

  if (maciTutanlar.length === 0) {
    return { uygun: false, kod: 'bahisYok', mesaj: 'Bu maç ve seçim için bahis bulunamadı.' };
  }

  // Pencere: teklif acilmadan once ya da kapandiktan sonra alinan bahis
  // kapsam disi. Aksi halde oran duyurulmadan once alinmis bir bahis de
  // odullendirilirdi.
  const acilis = teklif.opensAt ? Date.parse(teklif.opensAt) : null;
  const kapanis = teklif.closesAt ? Date.parse(teklif.closesAt) : null;
  const pencerede = maciTutanlar.filter((b) => {
    const t = Date.parse(metin(b.CreatedLocal));
    if (!Number.isFinite(t)) return true; // Tarihi okunamayan bahsi elemiyoruz.
    if (acilis != null && Number.isFinite(acilis) && t < acilis) return false;
    if (kapanis != null && Number.isFinite(kapanis) && t > kapanis) return false;
    return true;
  });
  if (pencerede.length === 0) {
    return { uygun: false, kod: 'pencereDisi', mesaj: 'Bahis, özel oran penceresi dışında alınmış.' };
  }

  // Bonus parasiyla alinan bahis kapsam disi: bonusa ozel oran vermek,
  // kasadan iki kez odeme yapmak olurdu.
  const gercekPara = pencerede.filter((b) => b.IsBonusBet !== true);
  if (gercekPara.length === 0) {
    return { uygun: false, kod: 'bonusBahis', mesaj: 'Bahis bonus bakiyesiyle alınmış; özel oran geçerli değil.' };
  }

  const kazananlar = gercekPara.filter((b) => kazandiMi(b.StateName));
  if (kazananlar.length === 0) {
    return { uygun: false, kod: 'kazanmadi', mesaj: 'Bahis kazanmamış.' };
  }

  const enBuyuk = kazananlar.reduce((a, b) => (sayi(b.Amount) > sayi(a.Amount) ? b : a));
  const tutar = sayi(enBuyuk.Amount);
  const enAz = sayi(teklif.minStake);
  if (enAz > 0 && tutar < enAz) {
    return { uygun: false, kod: 'tutarDusuk', mesaj: `Bahis tutarı en az ${enAz} ₺ olmalı (bulunan: ${tutar} ₺).` };
  }

  return {
    uygun: true,
    bahis: enBuyuk,
    tutar,
    alinanOran: sayi(enBuyuk.Price),
    betId: metin(enBuyuk.Id) || `${teklif.id}-${tutar}`,
  };
}

export type EkOdeme = {
  /** Ek ödeme tutarı (₺). */
  tutar: number;
  /** Hesaba giren bahis tutarı (üst sınır uygulanmış). */
  esasTutar: number;
  alinanOran: number;
  ozelOran: number;
  /** Operatöre ve denetime yazılan açıklama. */
  aciklama: string;
};

/**
 * Ek ödemeyi hesaplar.
 *
 * `tutar = min(bahis, maxStake) × (özelOran − alınanOran)`
 *
 * Alınan oran özel orandan BÜYÜKSE ödeme YOK: site zaten daha iyisini
 * vermiş, üstüne para eklemek kasadan sebepsiz çıkış olurdu. Negatif
 * sonucu sıfıra kırpmak yerine açıkça sıfır dönüyoruz ki açıklamada da
 * görünsün.
 */
export function ekOdemeHesapla(
  teklif: OzelOranTeklifi,
  tutar: number,
  alinanOran: number,
): EkOdeme {
  const ust = sayi(teklif.maxStake);
  const esasTutar = ust > 0 ? Math.min(sayi(tutar), ust) : sayi(tutar);
  const ozelOran = sayi(teklif.specialOdd);
  const fark = ozelOran - sayi(alinanOran);

  if (!(fark > 0) || !(esasTutar > 0)) {
    return {
      tutar: 0,
      esasTutar,
      alinanOran: sayi(alinanOran),
      ozelOran,
      aciklama: fark > 0
        ? 'Esas tutar sıfır; ek ödeme yok.'
        : `Bahsin alındığı oran (${sayi(alinanOran)}) özel orandan (${ozelOran}) düşük değil; ek ödeme yok.`,
    };
  }

  const odenecek = Math.round(esasTutar * fark * 100) / 100;
  const kirpildi = ust > 0 && sayi(tutar) > ust;
  return {
    tutar: odenecek,
    esasTutar,
    alinanOran: sayi(alinanOran),
    ozelOran,
    aciklama: `${esasTutar} ₺ × (${ozelOran} − ${sayi(alinanOran)}) = ${odenecek} ₺`
      + (kirpildi ? ` (bahis ${sayi(tutar)} ₺, üst sınır ${ust} ₺)` : ''),
  };
}

export type KatilimSonucu = {
  login: string;
  uygun: boolean;
  kod?: EslesmeHatasi;
  mesaj: string;
  ekOdeme: number;
  esasTutar?: number;
  alinanOran?: number;
  betId?: string;
};

/**
 * Bir katılımcının sonucunu üretir — ödeme YAPMAZ, yalnızca hesaplar.
 *
 * Hesap ile ödemeyi ayırmak, sonuçlandırmadan önce "kuru gösterim"
 * yapılabilmesini sağlıyor: operatör kime ne ödeneceğini yazma
 * yapılmadan görüyor.
 */
export function katilimiDegerlendir(
  login: string,
  bahisler: BahisSatiri[] | null | undefined,
  teklif: OzelOranTeklifi,
): KatilimSonucu {
  const eslesme = uygunBahsiBul(bahisler, teklif);
  if (!eslesme.uygun) {
    return { login, uygun: false, kod: eslesme.kod, mesaj: eslesme.mesaj, ekOdeme: 0 };
  }
  const odeme = ekOdemeHesapla(teklif, eslesme.tutar, eslesme.alinanOran);
  return {
    login,
    uygun: odeme.tutar > 0,
    mesaj: odeme.aciklama,
    ekOdeme: odeme.tutar,
    esasTutar: odeme.esasTutar,
    alinanOran: odeme.alinanOran,
    betId: eslesme.betId,
  };
}

/** Teklif oyuncuya açık mı? */
export function teklifAcikMi(teklif: OzelOranTeklifi, simdiMs = Date.now()): boolean {
  if (teklif.enabled === false) return false;
  if (teklif.status && teklif.status !== 'acik') return false;
  const acilis = teklif.opensAt ? Date.parse(teklif.opensAt) : null;
  const kapanis = teklif.closesAt ? Date.parse(teklif.closesAt) : null;
  if (acilis != null && Number.isFinite(acilis) && simdiMs < acilis) return false;
  if (kapanis != null && Number.isFinite(kapanis) && simdiMs > kapanis) return false;
  return true;
}

/** Panelde gösterilecek toplam yükümlülük — en kötü durum. */
export function azamiYukumluluk(teklif: OzelOranTeklifi, katilimci: number): number {
  const fark = Math.max(0, sayi(teklif.specialOdd) - 1);
  return Math.round(sayi(teklif.maxStake) * fark * Math.max(0, katilimci) * 100) / 100;
}
