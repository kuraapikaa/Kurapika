/**
 * Players Overview (rapor 1841) — oyuncu aktivitesinin tek kaynagi.
 *
 * Onceden her oyuncu icin DORT ayri Lynon cagrisi yapiliyordu
 * (findPlayerByLogin + paymentTransactions + casinoOperations + sportBets).
 * Gunluk gorev ekrani tek oyuncu icin buna katlaniyordu ama turnuva
 * siralamasi N oyuncu x 4 istek demekti; pratikte kurulamiyordu.
 *
 * 1841 ayni veriyi TEK istekte, site genelinde donuyor ve ustelik
 * pencereye gore filtrelenmis kolonlari da veriyor.
 *
 * ── FILTERED vs OMUR BOYU ──────────────────────────────────────────────
 * Rapor her metrigi iki kez donuyor:
 *   "TOTAL DEPOSITS AMOUNT"           -> hesabin acilisindan beri
 *   "TOTAL DEPOSITS AMOUNT FILTERED"  -> yalnizca istenen tarih araligi
 *
 * Gunluk gorev ve turnuva ARALIK degerini kullanmali. Omur boyu deger
 * kullanilirsa "bugun 500 TL yatir" gorevi, gecmiste yatirimi olan her
 * oyuncuda aninda tamamlanmis gorunur. Bu ayrim kodda tip seviyesinde
 * ayri tutuluyor: `donem` ve `omurBoyu`.
 */

import { lynonRequest } from '../lib/lynonAuth.js';
import { config } from '../config.js';

type AnyRecord = Record<string, unknown>;

/**
 * Rapor sayilari STRING geliyor: "202", "113.4", "0.4", "-4500.75".
 *
 * Bu uc DEGISMEZ (invariant) format kullaniyor: ondalik ayirici nokta,
 * binlik ayirici YOK. Cozumleme bunu birebir varsayiyor.
 *
 * Yerel-format tahmini kasitli olarak yapilmiyor. "12.500" gibi bir deger
 * hem 12,5 hem 12.500 okunabilir; tahmin eden bir cozumleyici parayi
 * 1000 kat sisirebilir. Beklenen kalibin disina cikan girdi 0 donuyor —
 * sessizce yanlis sayi uretmektense eksik gostermek dogru.
 */
const DEGISMEZ_SAYI = /^-?\d+(\.\d+)?$/;

export function raporSayisi(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;

  // Para birimi eki ve bosluklar temizlenir; ayiricilar korunur.
  const text = String(value).trim().replace(/[^\d.,-]/g, '');
  if (!text) return 0;

  if (DEGISMEZ_SAYI.test(text)) {
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Beklenmeyen kalip: yalnizca tek bir ondalik virgul varsa (ve hic nokta
  // yoksa) belirsizlik olmadigi icin kabul edilir. Digerleri 0.
  if (/^-?\d+,\d+$/.test(text)) {
    const parsed = Number(text.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function metin(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

/** Pencereye gore filtrelenmis metrikler — gorev/turnuva bunlari kullanir. */
export type DonemMetrikleri = {
  yatirimTutari: number;
  yatirimAdedi: number;
  cekimTutari: number;
  cekimAdedi: number;
  bahisTutari: number;
  kazancTutari: number;
  ggr: number;
  bonusBahis: number;
  bonusKazanc: number;
  casinoBahis: number;
  casinoKazanc: number;
  casinoGgr: number;
  sporBahis: number;
  sporKazanc: number;
  sporGgr: number;
};

/** Hesap acilisindan beri toplamlar — segment/sadakat kademesi icin. */
export type OmurBoyuMetrikleri = DonemMetrikleri & {
  toplamBakiye: number;
  gercekBakiye: number;
  bonusBakiye: number;
};

export type OyuncuRaporSatiri = {
  playerId: string;
  login: string;
  adSoyad: string;
  kategori: string;
  email: string;
  emailDogrulandi: boolean;
  telefon: string;
  telefonDogrulandi: boolean;
  parabirimi: string;
  affiliateId: string;
  /** Istenen tarih araligindaki hareket. */
  donem: DonemMetrikleri;
  /** Hesabin tamami. */
  omurBoyu: OmurBoyuMetrikleri;
};

function donemMetrikleri(row: AnyRecord, ek: string): DonemMetrikleri {
  const al = (kolon: string) => raporSayisi(row[`${kolon}${ek}`]);
  return {
    yatirimTutari: al('TOTAL DEPOSITS AMOUNT'),
    yatirimAdedi: al('TOTAL DEPOSITS COUNT'),
    cekimTutari: al('TOTAL WITHDRAWALS AMOUNT'),
    cekimAdedi: al('TOTAL WITHDRAWALS COUNT'),
    bahisTutari: al('TOTAL BET AMOUNT'),
    kazancTutari: al('TOTAL WIN AMOUNT'),
    ggr: al('GGR'),
    bonusBahis: al('TOTAL BONUS BET'),
    bonusKazanc: al('TOTAL BONUS WIN'),
    casinoBahis: al('CASINO REAL BETS'),
    casinoKazanc: al('CASINO REAL WINS'),
    casinoGgr: al('CASINO GGR'),
    sporBahis: al('SPORT REAL BETS'),
    sporKazanc: al('SPORT REAL WINS'),
    sporGgr: al('SPORT GGR'),
  };
}

export function raporSatiriCozumle(row: AnyRecord): OyuncuRaporSatiri {
  return {
    playerId: metin(row['Player ID']),
    login: metin(row['User Name']),
    adSoyad: metin(row.FullName),
    kategori: metin(row.Category),
    email: metin(row.Email),
    emailDogrulandi: row['Is Mail Verified'] === true,
    telefon: metin(row.PhoneNumber),
    telefonDogrulandi: row['Is Phone Verified'] === true,
    parabirimi: metin(row.Currency) || config.lynon.currency,
    affiliateId: metin(row['Affiliate Id']),
    donem: donemMetrikleri(row, ' FILTERED'),
    omurBoyu: {
      ...donemMetrikleri(row, ''),
      toplamBakiye: raporSayisi(row['TOTAL BALANCE']),
      gercekBakiye: raporSayisi(row['REAL BALANCE']),
      bonusBakiye: raporSayisi(row['BONUS BALANCE']),
    },
  };
}

// ─── Cekim ───────────────────────────────────────────────────────────────────

const RAPOR_ID = 1841;
/**
 * Onbellek 60 sn.
 *
 * Gorev/turnuva ekranlari ayni pencereyi arka arkaya soruyor; rapor site
 * genelinde oldugu icin tek cevap hepsine yetiyor. Sure kisa tutuldu:
 * oyuncu yatirim yapip gorevin tamamlanmasini bekliyor.
 */
const ONBELLEK_MS = 60_000;
const onbellek = new Map<string, { expiresAt: number; value: Promise<OyuncuRaporSatiri[]> }>();

function isoAn(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) throw new Error('Geçersiz tarih.');
  return d.toISOString();
}

async function raporCek(startIso: string, endIso: string, currency: string): Promise<OyuncuRaporSatiri[]> {
  // NOT: lynonReportById gun sinirlarina yuvarliyor (T00:00 / T23:59).
  // Gunluk gorev "bugun 00:00 - simdi" gibi gun ICI pencere istiyor, bu
  // yuzden tam ISO an gonderiliyor.
  const data = await lynonRequest(`/api/report/api/v1.0/reportData/summarized/${RAPOR_ID}`, {
    query: { startDate: startIso, endDate: endIso, currency },
  });
  const reports = (data as AnyRecord)?.reports;
  const rows = Array.isArray(reports) ? reports : Array.isArray(data) ? data : [];
  return rows
    .filter((row): row is AnyRecord => row != null && typeof row === 'object')
    .map(raporSatiriCozumle);
}

/** Verilen pencerede site genelindeki tum oyuncu satirlari. */
export function oyuncuRaporu(
  from: Date | string,
  to: Date | string,
  currency = config.lynon.currency,
): Promise<OyuncuRaporSatiri[]> {
  const startIso = isoAn(from);
  const endIso = isoAn(to);
  const key = `${startIso}|${endIso}|${currency}`;
  const now = Date.now();
  const mevcut = onbellek.get(key);
  if (mevcut && mevcut.expiresAt > now) return mevcut.value;

  const value = raporCek(startIso, endIso, currency).catch((err) => {
    // Basarisiz cevabi onbellekte tutma: sonraki istek tekrar denesin.
    onbellek.delete(key);
    throw err;
  });
  onbellek.set(key, { value, expiresAt: now + ONBELLEK_MS });
  return value;
}

/** Test ve is akisi disi kullanim icin onbellegi bosaltir. */
export function onbellegiTemizle(): void {
  onbellek.clear();
}

/** Kullanici adi eslesmesi buyuk/kucuk harf ve bosluk duyarsiz. */
export function loginAnahtari(login: string): string {
  return String(login ?? '').trim().toLocaleLowerCase('tr-TR');
}

/** Tek oyuncunun satiri; bulunamazsa undefined. */
export async function oyuncuSatiri(
  login: string,
  from: Date | string,
  to: Date | string,
  currency = config.lynon.currency,
): Promise<OyuncuRaporSatiri | undefined> {
  const anahtar = loginAnahtari(login);
  if (!anahtar) return undefined;
  const satirlar = await oyuncuRaporu(from, to, currency);
  return satirlar.find((satir) => loginAnahtari(satir.login) === anahtar);
}

// ─── Turnuva siralamasi ──────────────────────────────────────────────────────

export const SIRALAMA_METRIKLERI = ['bahisTutari', 'yatirimTutari', 'ggr', 'casinoBahis', 'sporBahis'] as const;
export type SiralamaMetrigi = (typeof SIRALAMA_METRIKLERI)[number];

export type SiralamaSatiri = {
  sira: number;
  login: string;
  playerId: string;
  adSoyad: string;
  deger: number;
};

/**
 * Turnuva siralamasi — DONEM metriklerinden.
 *
 * Degeri 0 olanlar listeye girmez: turnuvaya katilmamis oyuncularla
 * doldurulmus bir tablo siralamayi anlamsizlastirir.
 *
 * Esitlikte login'e gore alfabetik: ayni sayida iki oyuncunun sirasi
 * istekten istege degismemeli.
 */
export function siralamaOlustur(
  satirlar: OyuncuRaporSatiri[],
  metrik: SiralamaMetrigi,
  limit = 100,
): SiralamaSatiri[] {
  return satirlar
    .map((satir) => ({ satir, deger: satir.donem[metrik] }))
    .filter((kayit) => kayit.deger > 0)
    .sort((a, b) => (b.deger - a.deger) || a.satir.login.localeCompare(b.satir.login, 'tr-TR'))
    .slice(0, Math.max(0, limit))
    .map((kayit, index) => ({
      sira: index + 1,
      login: kayit.satir.login,
      playerId: kayit.satir.playerId,
      adSoyad: kayit.satir.adSoyad,
      deger: kayit.deger,
    }));
}

// ─── Gunluk gorev / sadakat uyumluluk katmani ────────────────────────────────

/**
 * buildPlayerActivity'nin bekledigi sekil.
 *
 * Alan adlari bilerek korundu: cagiran taraf (gunluk gorev, battle pass,
 * sadakat) degismeden bu kaynaga gecebilsin.
 */
export type OyuncuAktivitesi = {
  ok: true;
  clientId: string;
  login: string;
  from: string;
  to: string;
  depositTotal: number;
  depositCount: number;
  wagerTotal: number;
  casinoWager: number;
  sportWager: number;
  bonusCount: number;
};

export async function oyuncuAktivitesi(
  login: string,
  from: Date,
  to: Date,
  currency = config.lynon.currency,
): Promise<OyuncuAktivitesi | { ok: false; status: number; message: string }> {
  const satir = await oyuncuSatiri(login, from, to, currency);
  if (!satir) {
    return { ok: false, status: 404, message: 'Kullanıcı bu dönemde raporda bulunamadı.' };
  }
  const d = satir.donem;
  return {
    ok: true,
    clientId: satir.playerId,
    login: satir.login,
    from: isoAn(from),
    to: isoAn(to),
    depositTotal: d.yatirimTutari,
    depositCount: d.yatirimAdedi,
    // Toplam bahis casino + spor; rapor ikisini ayri da veriyor.
    wagerTotal: d.bahisTutari,
    casinoWager: d.casinoBahis,
    sportWager: d.sporBahis,
    bonusCount: 0,
  };
}
