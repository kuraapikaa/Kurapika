import { degistir, kayitOku, oku } from '../lib/depo.js';
import { ayAnahtari, gunAnahtari, gunGecerliMi } from '../lib/gunler.js';
import { kademeDurumu, kademePaylariHesapla } from './kademeler.js';
import { hakedisHesapla, planBul, type Hakedis } from './komisyon.js';
import { olcumleriOku } from './olcum.js';
import { ortaklariListele } from './ortaklar.js';

/**
 * HAKEDİŞ DÖNEMLERİ — ödeme defteri.
 *
 * Komisyon hesabı tek başına yeterli değil; bir DEFTER gerekiyor.
 * Ödemenin hangi ay için, hangi rakam üzerinden, hangi planla
 * hesaplandığı ve kimin onayladığı kayıt altında olmalı. Ortakla
 * anlaşmazlık çıktığında elde tek şey bu.
 *
 * ── Neden dönem "dondurulabiliyor" ──
 *
 * Taslak dönem her açılışta yeniden hesaplanıyor: ölçümler gün içinde
 * güncelleniyor ve dünün rakamı bugün değişebilir. Ama ONAYLANDIKTAN
 * sonra dondurulup saklanıyor. Onaylanmış bir dönemi yeniden
 * hesaplamak, ortağa söylenen rakamla defterdeki rakamın sessizce
 * ayrışması demek olurdu.
 *
 * ── Devir zinciri ──
 *
 * Bir dönemin devri BİR ÖNCEKİ dönemin KAYITLI değerinden okunuyor,
 * yeniden hesaplanarak değil. Zinciri her seferinde baştan kurmak,
 * altı ay önceki bir ölçüm düzeltmesinin bütün geçmiş ödemeleri
 * değiştirmesi anlamına gelirdi.
 */

const ALAN = 'hakedis-donemleri';

export type DonemDurumu = 'taslak' | 'onaylandi' | 'odendi';

export interface OrtakHakedisi {
  ortakAnahtari: string;
  ortakAdi: string;
  planId: string | null;
  planAdi: string | null;
  hakedis: Hakedis;
  /** Alt ortaklarından gelen kademe payları; kazancının ÜSTÜNE eklenir. */
  kademeGeliri: number;
  /** Ödenecek toplam: hakediş + kademe geliri. */
  odenecekToplam: number;
}

export interface Donem {
  ay: string;
  durum: DonemDurumu;
  satirlar: OrtakHakedisi[];
  toplamOdenecek: number;
  hesaplandi: string;
  onaylandi: string | null;
  odendi: string | null;
  /** Hesaplanamayan bileşenler; panelde uyarı olarak gösterilir. */
  uyarilar: string[];
}

type Depo = { version: 1; donemler: Record<string, Donem> };
const cozDepo = (ham: unknown): Depo => ({
  version: 1,
  donemler: kayitOku(kayitOku(ham).donemler) as Record<string, Donem>,
});

export class HakedisHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'HakedisHatasi';
  }
}

const kurusa = (n: number): number => Math.round(n * 100) / 100;

function ayGecerliMi(ay: unknown): boolean {
  return typeof ay === 'string' && /^\d{4}-\d{2}$/.test(ay);
}

/** Bir önceki ay anahtarı; devir zincirini kurmak için. */
export function oncekiAy(ay: string): string {
  const [y, a] = ay.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 2, 1, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function donemOku(kiraci: string, ay: string): Promise<Donem | null> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  return depo.donemler[ay] ?? null;
}

export async function donemleriListele(kiraci: string): Promise<Array<Omit<Donem, 'satirlar'>>> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  return Object.values(depo.donemler)
    .map(({ satirlar: _satirlar, ...kalan }) => kalan)
    .sort((a, b) => b.ay.localeCompare(a.ay));
}

/**
 * Bir dönemi hesaplar.
 *
 * Onaylanmış/ödenmiş dönem YENİDEN HESAPLANMAZ, kayıtlı hâli döner.
 * `zorla` yalnızca yönetici bilerek istediğinde geçerli ve bu bir
 * düzeltme işlemi — panelde ayrı bir düğme, kaza eseri tıklanacak bir
 * yerde değil.
 */
export async function donemHesapla(
  kiraci: string,
  ay: string,
  { zorla = false }: { zorla?: boolean } = {},
  simdi = new Date(),
): Promise<Donem> {
  if (!ayGecerliMi(ay)) throw new HakedisHatasi('ay YYYY-MM biçiminde olmalı.');

  const mevcut = await donemOku(kiraci, ay);
  if (mevcut && mevcut.durum !== 'taslak' && !zorla) return mevcut;

  const [ortaklar, olcumler, kademe, gecmis] = await Promise.all([
    ortaklariListele(kiraci),
    olcumleriOku(kiraci, { start: `${ay}-01`, end: `${ay}-31` }),
    kademeDurumu(kiraci),
    donemOku(kiraci, oncekiAy(ay)),
  ]);

  // Onceki donemin devri YALNIZCA onaylanmis/odenmis donemden okunuyor.
  // Taslak bir onceki donem her acilista degisebilir; ona zincirlemek,
  // bu ayin rakamini gecen ayin taslagi her degistiginde oynatirdi.
  const devirler = new Map<string, { zarar: number; odeme: number }>();
  if (gecmis && gecmis.durum !== 'taslak') {
    for (const satir of gecmis.satirlar) {
      devirler.set(satir.ortakAnahtari, {
        zarar: satir.hakedis.sonrakiDevredenZarar,
        odeme: satir.hakedis.sonrakiDevredenOdeme,
      });
    }
  }

  const olcumToplami = new Map<string, { ggr: number; ftd: number | null }>();
  for (const olcum of olcumler) {
    const mevcutToplam = olcumToplami.get(olcum.ortakAnahtari) ?? { ggr: 0, ftd: null };
    mevcutToplam.ggr += olcum.ggr;
    if (olcum.ftdSayisi !== null) mevcutToplam.ftd = (mevcutToplam.ftd ?? 0) + olcum.ftdSayisi;
    olcumToplami.set(olcum.ortakAnahtari, mevcutToplam);
  }

  const uyarilar = new Set<string>();
  const satirlar: OrtakHakedisi[] = [];

  for (const ortak of ortaklar) {
    // Onaylanmamis ortagin hakedisi hesaplanmaz: onaylanmadan gonderdigi
    // trafigin odemesi zaten kabul edilmiyor.
    if (ortak.durum !== 'onaylandi') continue;

    const plan = await planBul(kiraci, ortak.planId);
    if (!plan) {
      uyarilar.add('Tanımlı komisyon planı yok; hiçbir hakediş hesaplanamadı.');
      continue;
    }

    const toplam = olcumToplami.get(ortak.ortakAnahtari) ?? { ggr: 0, ftd: null };
    const devir = devirler.get(ortak.ortakAnahtari) ?? { zarar: 0, odeme: 0 };
    const hakedis = hakedisHesapla(plan, {
      ggr: toplam.ggr,
      ftdSayisi: toplam.ftd,
      devredenZarar: devir.zarar,
      devredenOdeme: devir.odeme,
    });
    if (hakedis.cpaHesaplanamadiSebebi) uyarilar.add(hakedis.cpaHesaplanamadiSebebi);

    satirlar.push({
      ortakAnahtari: ortak.ortakAnahtari,
      ortakAdi: ortak.ad,
      planId: plan.id,
      planAdi: plan.ad,
      hakedis,
      kademeGeliri: 0,
      odenecekToplam: hakedis.odenecek,
    });
  }

  // Kademe paylari, ortaklarin KENDI kazanci hesaplandiktan SONRA
  // dagitiliyor: ust ortagin payi alt ortagin kazancina bagli ve o
  // kazanc bu noktada kesinlesmis oluyor.
  const satirHaritasi = new Map(satirlar.map((s) => [s.ortakAnahtari, s]));
  for (const satir of satirlar) {
    for (const pay of kademePaylariHesapla(
      kademe.baglar,
      kademe.kademeYuzdeleri,
      satir.ortakAnahtari,
      satir.hakedis.toplam,
    )) {
      const ust = satirHaritasi.get(pay.ustOrtakAnahtari);
      // Ust ortak bu donemde hesaplanmadiysa (onayli degil, silinmis) payi
      // DUSUYOR ve bu bir uyari; sessizce yok saymak, odenmesi gereken bir
      // tutarin kaybolmasi olurdu.
      if (!ust) {
        uyarilar.add(`${pay.ustOrtakAnahtari} bu dönemde hesaplanmadığı için kademe payı atlandı.`);
        continue;
      }
      ust.kademeGeliri = kurusa(ust.kademeGeliri + pay.tutar);
      ust.odenecekToplam = kurusa(ust.odenecekToplam + pay.tutar);
    }
  }

  const donem: Donem = {
    ay,
    durum: 'taslak',
    satirlar: satirlar.sort((a, b) => b.odenecekToplam - a.odenecekToplam),
    toplamOdenecek: kurusa(satirlar.reduce((t, s) => t + s.odenecekToplam, 0)),
    hesaplandi: simdi.toISOString(),
    onaylandi: mevcut?.onaylandi ?? null,
    odendi: mevcut?.odendi ?? null,
    uyarilar: [...uyarilar],
  };

  return degistir<Depo, Donem>(kiraci, ALAN, cozDepo, (depo) => {
    depo.donemler[ay] = donem;
    return donem;
  });
}

/** Dönemi dondurur; bundan sonra yeniden hesaplanmaz. */
export async function donemOnayla(kiraci: string, ay: string, simdi = new Date()): Promise<Donem> {
  return degistir<Depo, Donem>(kiraci, ALAN, cozDepo, (depo) => {
    const donem = depo.donemler[ay];
    if (!donem) throw new HakedisHatasi('Dönem bulunamadı; önce hesaplayın.', 404);
    if (donem.durum === 'odendi') throw new HakedisHatasi('Ödenmiş dönem yeniden onaylanamaz.', 409);
    donem.durum = 'onaylandi';
    donem.onaylandi = simdi.toISOString();
    return donem;
  });
}

export async function donemOdendi(kiraci: string, ay: string, simdi = new Date()): Promise<Donem> {
  return degistir<Depo, Donem>(kiraci, ALAN, cozDepo, (depo) => {
    const donem = depo.donemler[ay];
    if (!donem) throw new HakedisHatasi('Dönem bulunamadı.', 404);
    if (donem.durum === 'taslak') {
      // Onaysiz odeme, defterde onay adiminin hic olmamasi demek olurdu.
      throw new HakedisHatasi('Önce dönemi onaylayın.', 409);
    }
    donem.durum = 'odendi';
    donem.odendi = simdi.toISOString();
    return donem;
  });
}

/** Bir ortağın kendi portalinde göreceği hakediş satırı. */
export async function ortakDonemi(kiraci: string, ortakAnahtari: string, ay: string): Promise<OrtakHakedisi | null> {
  const donem = await donemOku(kiraci, ay);
  return donem?.satirlar.find((s) => s.ortakAnahtari === ortakAnahtari) ?? null;
}

/**
 * KADEME EKRANI İÇİN TAHMİNİ KAZANÇ — Kademeler.tsx'teki "Bağlar"
 * tablosuna, bu bağdan üst ortağa şu an ne kadar düşeceğinin kaba bir
 * tahminini vermek için.
 *
 * `donemHesapla`'DAN BİLEREK AYRI: burası HİÇBİR ŞEY YAZMIYOR (salt
 * okunur), devir zincirini TAŞIMIYOR (bu ayın devredeni geçen ayın
 * KAPANMIŞ dönemine bakmayı gerektirir — ekranın amacı "kabaca ne
 * kadar" sorusuna cevap vermek, kuruşu kuruşuna dönem defteri değil).
 * Gerçek ödeme hâlâ yalnızca `donemHesapla` → onayla akışından geçer.
 */
export async function kademeTahminleri(kiraci: string, simdi = new Date()): Promise<Map<string, number>> {
  const ay = ayAnahtari(gunAnahtari(simdi));
  const kademe = await kademeDurumu(kiraci);
  // Yalnizca bir bagin ALT tarafinda gecen ortaklarin kazancini
  // hesapla: bagsiz ortaklarin tahmini hicbir ust ortaga akmiyor.
  const altAnahtarlari = new Set(kademe.baglar.map((b) => b.ortakAnahtari));
  if (altAnahtarlari.size === 0) return new Map();

  const [ortaklar, olcumler] = await Promise.all([
    ortaklariListele(kiraci),
    olcumleriOku(kiraci, { start: `${ay}-01`, end: `${ay}-31` }),
  ]);

  const olcumToplami = new Map<string, { ggr: number; ftd: number | null }>();
  for (const olcum of olcumler) {
    const mevcutToplam = olcumToplami.get(olcum.ortakAnahtari) ?? { ggr: 0, ftd: null };
    mevcutToplam.ggr += olcum.ggr;
    if (olcum.ftdSayisi !== null) mevcutToplam.ftd = (mevcutToplam.ftd ?? 0) + olcum.ftdSayisi;
    olcumToplami.set(olcum.ortakAnahtari, mevcutToplam);
  }

  const kazanclar = new Map<string, number>();
  for (const ortak of ortaklar) {
    if (ortak.durum !== 'onaylandi' || !altAnahtarlari.has(ortak.ortakAnahtari)) continue;
    const plan = await planBul(kiraci, ortak.planId);
    if (!plan) continue;
    const toplam = olcumToplami.get(ortak.ortakAnahtari) ?? { ggr: 0, ftd: null };
    const hakedis = hakedisHesapla(plan, { ggr: toplam.ggr, ftdSayisi: toplam.ftd, devredenZarar: 0, devredenOdeme: 0 });
    kazanclar.set(ortak.ortakAnahtari, hakedis.toplam);
  }

  const tahminler = new Map<string, number>();
  for (const [ortakAnahtari, kazanc] of kazanclar) {
    for (const pay of kademePaylariHesapla(kademe.baglar, kademe.kademeYuzdeleri, ortakAnahtari, kazanc)) {
      tahminler.set(pay.ustOrtakAnahtari, kurusa((tahminler.get(pay.ustOrtakAnahtari) ?? 0) + pay.tutar));
    }
  }
  return tahminler;
}

/** Gün anahtarından dönem anahtarı; rotalarda tek yerden çevrilsin diye. */
export function gunundenAy(gun: string): string {
  if (!gunGecerliMi(gun)) throw new HakedisHatasi('Geçersiz gün.');
  return ayAnahtari(gun);
}
