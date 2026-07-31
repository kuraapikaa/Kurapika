/**
 * Odeme islemi durumu — tek kaynak.
 *
 * Uc ekran ayni soruyu ayri ayri cevapliyordu ve ikisi yanlisti:
 *
 *   TransactionsList  `tx.State === 10`  → Lynon State'i STRING ("rejected",
 *                     "failed"); sayi karsilastirmasi hicbir zaman tutmuyor,
 *                     reddedilen islem "ISLEMDE" gorunuyordu.
 *   DepositsList      durum kolonu HIC YOKTU → reddedilen yatirim, listede
 *                     tamamlanmis yatirimla ayni sekilde goruntuleniyordu.
 *   PlayerProfile     dogru calisiyordu; mantik buradan alindi.
 *
 * Eski BetConstruct sayisal durumlari (State === 10 = onayli) hala
 * gelebiliyor: sunucu Lynon'a ulasamazsa eski uca dusuyor. Ikisi de
 * destekleniyor.
 */

export type IslemDurumu = 'basarili' | 'basarisiz' | 'beklemede';

/** Islemin tamamlandigini gosteren Lynon durumlari. */
const BASARILI = /^(success|successful|processed|paid|approved|completed|done)$/;

/**
 * Paranin gecmedigi durumlar.
 *
 * "void" ve "cancelled" de buraya giriyor: operator icin onemli olan
 * paranin gecip gecmedigi, iptalin kim tarafindan yapildigi degil.
 */
const BASARISIZ = /^(failed|fail|rejected|declined|cancelled|canceled|void|expired|error)$/;

/** Eski BetConstruct sayisal durum kodu: 10 = onaylandi. */
const ESKI_ONAYLI_KOD = 10;

type IslemSatiri = {
  State?: unknown;
  DocumentState?: unknown;
  StateName?: unknown;
  DocumentStateName?: unknown;
  status?: unknown;
  TypeName?: unknown;
  DocumentTypeName?: unknown;
};

/**
 * Karsilastirma icin metni sadelestirir: kucuk harf + diakritik yok.
 *
 * TURKCE TUZAGI: JS'in yerel-bagimsiz toLowerCase()'i "İ" harfini "i" + U+0307
 * (birlesik nokta) olarak cozuyor. Sunucu durum adlarini Turkce donduruyor
 * ("İşlendi", "İptal Edildi"), dolayisiyla duz bir /islendi/ ya da /iptal/
 * karsilastirmasi TUTMUYOR — "İşlendi" durumu basarili sayilmiyordu.
 *
 * NFD ile ayristirip birlesik isaretleri atiyoruz, ardindan kalan Turkce
 * harfleri ASCII karsiliklarina katliyoruz.
 */
function metin(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

/**
 * Islemin durumunu belirler.
 *
 * Sira onemli: once BASARISIZ bakilir. "rejected" bir islem hicbir kosulda
 * basarili sayilmamali — belirsizlikte parayi gecmis gostermektense
 * gecmemis gostermek dogru taraf.
 */
export function islemDurumu(row: IslemSatiri | null | undefined): IslemDurumu {
  if (!row) return 'beklemede';

  const ham = [row.status, row.State, row.DocumentState, row.StateName, row.DocumentStateName]
    .map(metin)
    .filter(Boolean);

  // Turkce tur adinda "reddedilmis" gecen eski kayitlar.
  const tur = `${metin(row.TypeName)} ${metin(row.DocumentTypeName)}`;
  if (tur.includes('reddedil')) return 'basarisiz';

  if (ham.some((deger) => BASARISIZ.test(deger))) return 'basarisiz';
  // Turkcelestirilmis ad da gelebilir (StateName: "Reddedildi" / "Başarısız").
  if (ham.some((deger) => /reddedil|basarisiz|iptal/.test(deger))) return 'basarisiz';

  if (ham.some((deger) => BASARILI.test(deger))) return 'basarili';
  if (ham.some((deger) => /odendi|islendi|basarili/.test(deger))) return 'basarili';

  // Eski sayisal kod.
  if (Number(row.State) === ESKI_ONAYLI_KOD || Number(row.DocumentState) === ESKI_ONAYLI_KOD) return 'basarili';

  return 'beklemede';
}

export const DURUM_ETIKETI: Record<IslemDurumu, string> = {
  basarili: 'Başarılı',
  basarisiz: 'Başarısız',
  beklemede: 'Beklemede',
};

/** Rozet icin sinif ucusu: metin, arka plan, halka. */
export const DURUM_SINIFI: Record<IslemDurumu, string> = {
  basarili: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
  basarisiz: 'text-rose-400 bg-rose-500/10 ring-rose-500/20',
  beklemede: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
};

export const DURUM_NOKTASI: Record<IslemDurumu, string> = {
  basarili: 'bg-emerald-500',
  basarisiz: 'bg-rose-500',
  beklemede: 'bg-amber-500',
};

/**
 * Sunucunun Turkcelestirdigi ayrintili ad; yoksa genel etiket.
 *
 * "Sağlayıcı Onayı Bekliyor" ile "Bekliyor" arasindaki fark operator icin
 * anlamli, rozette kaybolmasin.
 */
export function durumAyrintisi(row: IslemSatiri | null | undefined): string {
  const ad = String(row?.StateName ?? row?.DocumentStateName ?? '').trim();
  if (ad) return ad;
  return DURUM_ETIKETI[islemDurumu(row)];
}
