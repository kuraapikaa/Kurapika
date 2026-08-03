/**
 * Oyuncu kategorilerini risk ve aktiviteye gore otomatik belirleme.
 *
 * ── Esikler zaten sitede yaziyor ──────────────────────────────────────
 *
 * `/api/user/api/v1.0/categories` yaniti seviyeleri ve esiklerini
 * ACIKLAMA alaninda tasiyor:
 *
 *   { id: 318, name: "El Patrón (Seviye 5)", description: "[500.000 TL ve üzeri]" }
 *
 * Yani seviye merdiveni panelde degil, Lynon'da tanimli. Esikleri koda
 * gomseydik iki yer birbirinden sessizce ayrilir; kampanya ekibi
 * Lynon'dan esigi degistirdiginde panel eski esikle calismaya devam
 * ederdi. Bu yuzden esikler ACIKLAMADAN OKUNUR.
 *
 * ── Deger + risk + aktivite ───────────────────────────────────────────
 *
 * Seviye merdiveni bir DEGER olcusu: toplam yatirim. Risk ve aktivite
 * merdiveni degistirmez, kararin UYGULANIP UYGULANMAYACAGINI belirler:
 *
 *   • Kritik riskli oyuncu terfi ETTIRILMEZ. VIP rozetini once verip
 *     sonra geri almak, en kotu musteri deneyimi.
 *   • Uzun suredir durgun oyuncu terfi edebilir (yatirimi gecmiste
 *     yapmis) ama oneri bunu soyler; CRM buna gore konusur.
 *   • Kategori ZATEN dogruysa oneri uretilmez — gurultu yok.
 *
 * ── Bu dosya yazmaz ───────────────────────────────────────────────────
 *
 * Yalnizca ONERI uretir. Lynon'un kategori YAZMA ucu belgelenmemis ve
 * gozlemlenmemis durumda; goremedigim bir uca korlemesine yazmak yerine
 * kararlar once panelde gorunur oluyor.
 */

export type LynonKategori = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  isDefault?: unknown;
};

export type Esik = {
  /** Alt sinir dahil. null = alt sinir yok. */
  min: number | null;
  /** Ust sinir dahil. null = ust sinir yok. */
  max: number | null;
  /** Aciklama net degildi; tek sayi vardi ve yon belirtilmemisti. */
  belirsiz: boolean;
};

export type Seviye = {
  id: number;
  ad: string;
  /** "(Seviye 5)" → 5. Yoksa null. */
  seviyeNo: number | null;
  esik: Esik | null;
  varsayilanMi: boolean;
};

function kucuk(deger: unknown): string {
  return String(deger ?? '').trim().toLocaleLowerCase('tr-TR');
}

/**
 * Turkce bicimli sayilari cozer: "500.000" → 500000, "1.250,75" → 1250.75.
 *
 * Nokta binlik ayraci, virgul ondalik. Ingilizce varsayimla cozmek
 * 500.000'i 500'e cevirirdi — bin kat hata.
 */
export function turkceSayi(metin: string): number | null {
  const temiz = metin.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  const sayi = Number(temiz);
  return Number.isFinite(sayi) ? sayi : null;
}

/**
 * Aciklamadan esik cikarir.
 *
 *   "[500.000 TL ve üzeri]"     → { min: 500000, max: null }
 *   "[100.000 TL - 499.999 TL]" → { min: 100000, max: 499999 }
 *   "[10.000 TL altı]"          → { min: null,   max: 10000 }
 *
 * Cozulemezse null — uydurulmus bir esikle oyuncu terfi ettirmektense
 * o kategoriyi merdivenden cikarmak dogru.
 */
export function esikCoz(description: unknown): Esik | null {
  const metin = kucuk(description);
  if (!metin) return null;

  const sayilar = (metin.match(/\d[\d.]*(?:,\d+)?/g) ?? [])
    .map(turkceSayi)
    .filter((n): n is number => n !== null);
  if (sayilar.length === 0) return null;

  const ustuAcik = /üzeri|üstü|ve\s*yukarı|yukarısı|\+/.test(metin);
  const altiAcik = /altı|altında|aşağı|kadar|maksimum|en\s*fazla/.test(metin);

  if (sayilar.length >= 2) {
    const [a, b] = sayilar;
    return { min: Math.min(a, b), max: Math.max(a, b), belirsiz: false };
  }
  if (ustuAcik) return { min: sayilar[0], max: null, belirsiz: false };
  if (altiAcik) return { min: null, max: sayilar[0], belirsiz: false };
  // Tek sayi, yon belli degil: alt sinir varsay ama belirsiz isaretle.
  return { min: sayilar[0], max: null, belirsiz: true };
}

/** "El Patrón (Seviye 5)" → 5. */
export function seviyeNoCoz(name: unknown): number | null {
  const eslesme = kucuk(name).match(/(?:seviye|level|lvl)\s*[:.]?\s*(\d+)/);
  if (!eslesme) return null;
  const no = Number(eslesme[1]);
  return Number.isFinite(no) ? no : null;
}

/**
 * Kategori listesini kullanilabilir bir merdivene cevirir.
 *
 * Esigi cozulemeyen kategoriler listede KALIR ama `esik: null` ile;
 * boylece "bu kategori neden hic atanmiyor" sorusu cevaplanabilir.
 * Siralama alt sinira gore, yuksekten alcaga.
 */
export function seviyeMerdiveni(kategoriler: LynonKategori[] | null | undefined): Seviye[] {
  return (kategoriler ?? [])
    .map((kategori) => {
      const id = Number(kategori?.id);
      if (!Number.isFinite(id)) return null;
      return {
        id,
        ad: String(kategori?.name ?? '').trim(),
        seviyeNo: seviyeNoCoz(kategori?.name),
        esik: esikCoz(kategori?.description),
        varsayilanMi: kategori?.isDefault === true,
      } satisfies Seviye;
    })
    .filter((s): s is Seviye => s !== null)
    .sort((a, b) => (b.esik?.min ?? -1) - (a.esik?.min ?? -1));
}

export type OyuncuProfili = {
  playerId: number;
  login: string;
  /** Toplam yatirim — seviye merdiveninin olcusu. */
  toplamYatirim: number | null;
  /** Kasa acisindan kar/zarar. NEGATIF ise oyuncu onde. */
  netKarZarar: number | null;
  /** Son yatirim tarihi (ISO). Aktivite olcusu. */
  sonYatirim: string | null;
  /** Ayni IP'de gorulen hesap sayisi — oyuncunun kendisi dahil. */
  ayniIpHesapSayisi: number | null;
  mevcutKategoriId: number | null;
};

export const KATEGORI_ESIKLERI = {
  /** Oyuncunun onde olmasinin risk sayildigi tutar. */
  onemliKazanc: 50_000,
  /** Bu kadar gun yatirim yoksa "durgun". */
  durgunGun: 30,
} as const;

export type RiskSeviyesi = 'DÜŞÜK' | 'ORTA' | 'KRİTİK';

export function kategoriRiski(profil: OyuncuProfili): RiskSeviyesi {
  const hesap = profil.ayniIpHesapSayisi;
  const kar = profil.netKarZarar;
  const cokluHesap = hesap !== null && hesap > 1;
  const onemliKazanc = kar !== null && kar <= -KATEGORI_ESIKLERI.onemliKazanc;

  if (cokluHesap && onemliKazanc) return 'KRİTİK';
  if (cokluHesap || onemliKazanc) return 'ORTA';
  return 'DÜŞÜK';
}

/** Son yatirimdan bu yana gecen gun. Tarih yoksa null. */
export function durgunlukGunu(sonYatirim: string | null, simdi = Date.now()): number | null {
  if (!sonYatirim) return null;
  const t = Date.parse(sonYatirim);
  if (!Number.isFinite(t)) return null;
  return Math.floor((simdi - t) / 86_400_000);
}

/** Yatirim tutarina uyan seviye. Hicbiri uymazsa null. */
export function seviyeBul(merdiven: Seviye[], toplamYatirim: number | null): Seviye | null {
  if (toplamYatirim === null || !Number.isFinite(toplamYatirim)) return null;
  return (
    merdiven.find((seviye) => {
      const esik = seviye.esik;
      if (!esik) return false;
      if (esik.min !== null && toplamYatirim < esik.min) return false;
      if (esik.max !== null && toplamYatirim > esik.max) return false;
      return true;
    }) ?? null
  );
}

/** Varsayilan kategori — hicbir banda girmeyen oyuncularin yeri. */
export function varsayilanSeviye(merdiven: Seviye[]): Seviye | null {
  return merdiven.find((seviye) => seviye.varsayilanMi) ?? null;
}

/**
 * Hedef seviye.
 *
 * ── Merdivende gercek bir bosluk var ──────────────────────────────────
 *
 * Sitenin bantlari 10.000 TL'den basliyor:
 *
 *   Sicario (1)   10.000 – 49.999
 *   Capo (2)      50.000 – 99.999
 *   Jefe (3)     100.000 – 249.999
 *   Baron (4)    250.000 – 499.999
 *   El Patrón (5) 500.000 ve uzeri
 *
 * 0 – 9.999 TL arasi HICBIR banda girmiyor. Yalnizca bantlara baksaydik
 * bu oyuncular icin hic oneri uretilmez, yanlis kategoride kalirlardi.
 * Bosluk "Yeni Oyuncu" (varsayilan kategori) ile kapatiliyor — zaten
 * anlami da bu.
 */
export function hedefSeviye(merdiven: Seviye[], toplamYatirim: number | null): Seviye | null {
  if (toplamYatirim === null || !Number.isFinite(toplamYatirim)) return null;
  return seviyeBul(merdiven, toplamYatirim) ?? varsayilanSeviye(merdiven);
}

/**
 * Merdivendeki kapsanmayan araliklar.
 *
 * Varsayilan kategori bosluklari yakalar ama boslugun VARLIGI yine de
 * gorunur olmali: kampanya ekibi 10.000 TL'lik esigi bilerek mi
 * biraktı, yoksa Seviye 0 bandini tanimlamayi mi unuttu?
 */
export function merdivenBosluklari(merdiven: Seviye[]): Array<{ min: number; max: number | null }> {
  const bantlar = merdiven
    .filter((seviye) => seviye.esik)
    .map((seviye) => ({ min: seviye.esik!.min ?? 0, max: seviye.esik!.max }))
    .sort((a, b) => a.min - b.min);

  const bosluklar: Array<{ min: number; max: number | null }> = [];
  let imlec = 0;

  for (const bant of bantlar) {
    if (bant.min > imlec) bosluklar.push({ min: imlec, max: bant.min - 1 });
    if (bant.max === null) return bosluklar; // ust sinirsiz bant: gerisi kapali
    imlec = Math.max(imlec, bant.max + 1);
  }
  if (bantlar.length > 0) bosluklar.push({ min: imlec, max: null });
  return bosluklar;
}

export type KategoriOnerisi = {
  playerId: number;
  login: string;
  mevcutKategoriId: number | null;
  hedefKategoriId: number;
  hedefKategoriAdi: string;
  toplamYatirim: number | null;
  risk: RiskSeviyesi;
  durgunGun: number | null;
  gerekce: string;
  /** Dolu ise oneri OTOMATIK uygulanmaz; operator karar verir. */
  bekletme: string | null;
};

/**
 * Bir oyuncu icin kategori onerisi.
 *
 * Oneri YOKSA null doner: kategori zaten dogruysa, yatirim
 * olculemiyorsa ya da hicbir seviye uymuyorsa.
 */
export function kategoriOnerisi(
  profil: OyuncuProfili,
  merdiven: Seviye[],
  simdi = Date.now(),
): KategoriOnerisi | null {
  const hedef = hedefSeviye(merdiven, profil.toplamYatirim);
  if (!hedef) return null;
  if (profil.mevcutKategoriId !== null && profil.mevcutKategoriId === hedef.id) return null;

  const risk = kategoriRiski(profil);
  const durgunGun = durgunlukGunu(profil.sonYatirim, simdi);
  const yatirim = profil.toplamYatirim ?? 0;

  const mevcut = merdiven.find((seviye) => seviye.id === profil.mevcutKategoriId) ?? null;
  // Varsayilan kategorinin seviye numarasi yok; merdivenin sifirinci basamagi sayilir.
  const mevcutNo = mevcut ? mevcut.seviyeNo ?? 0 : null;
  const hedefNo = hedef.seviyeNo ?? 0;
  const dususMu = mevcutNo !== null && hedefNo < mevcutNo;

  const gerekceler = [`Toplam yatırım ${Math.round(yatirim).toLocaleString('tr-TR')} ₺ → ${hedef.ad}`];
  if (durgunGun !== null && durgunGun > KATEGORI_ESIKLERI.durgunGun) {
    gerekceler.push(`${durgunGun} gündür yatırım yok`);
  }
  if (hedef.esik?.belirsiz) {
    gerekceler.push('Kategori açıklamasındaki eşik tek yönlü okundu');
  }
  if (!hedef.esik && hedef.varsayilanMi) {
    gerekceler.push('Hiçbir eşik bandına girmiyor, varsayılan kategoriye düşüyor');
  }

  /**
   * BEKLETME — otomatik uygulanmamasi gereken durumlar.
   *
   * Kritik riskli oyuncuyu terfi ettirmek, sonra da inceleme sonucu
   * geri almak gerekirse musteriye once verilip alinan bir rozet olur.
   */
  let bekletme: string | null = null;
  if (risk === 'KRİTİK') {
    bekletme = 'Kritik risk: çoklu hesap ve yüksek kazanç birlikte görüldü, manuel inceleme gerekiyor.';
  } else if (dususMu) {
    /**
     * SEVIYE DUSURME OTOMATIK YAPILMAZ.
     *
     * Yatirim toplami birikimli; kendiliginden azalmaz. Oyuncu
     * bandinin ALTINDA gorunuyorsa iki ihtimal var: kategorisi ELLE
     * atanmis (VIP jesti, kampanya kararı) ya da yatirim toplami eksik
     * okunmus. Ikisinde de dogru davranis, El Patrón'u sessizce Yeni
     * Oyuncu'ya dusurmek degil, operatore sormaktir.
     */
    bekletme = `Seviye düşürme: ${mevcut?.ad ?? `#${profil.mevcutKategoriId}`} → ${hedef.ad}. Kategori elle atanmış olabilir, onay gerekiyor.`;
  } else if (hedef.esik?.belirsiz) {
    bekletme = 'Kategori açıklamasındaki eşik belirsiz; sınır elle doğrulanmalı.';
  }

  return {
    playerId: profil.playerId,
    login: profil.login,
    mevcutKategoriId: profil.mevcutKategoriId,
    hedefKategoriId: hedef.id,
    hedefKategoriAdi: hedef.ad,
    toplamYatirim: profil.toplamYatirim,
    risk,
    durgunGun,
    gerekce: gerekceler.join(' · '),
    bekletme,
  };
}

/** Toplu oneri. Onerisi olmayan oyuncular listede yer almaz. */
export function kategoriOnerileri(
  profiller: OyuncuProfili[] | null | undefined,
  merdiven: Seviye[],
  simdi = Date.now(),
): KategoriOnerisi[] {
  return (profiller ?? [])
    .map((profil) => kategoriOnerisi(profil, merdiven, simdi))
    .filter((oneri): oneri is KategoriOnerisi => oneri !== null)
    .sort((a, b) => (b.toplamYatirim ?? 0) - (a.toplamYatirim ?? 0));
}

/**
 * Kategori yazma govdesi adaylari.
 *
 * `restrictions` ucunda oldugu gibi yazma sozlesmesi belgelenmemis.
 * Denenen sekiller burada acikca duruyor; is akisi ilki reddedilirse
 * digerini deniyor.
 */
export function kategoriGovdeleri(playerId: number, kategoriId: number): Array<Record<string, unknown>> {
  return [
    { categoryId: kategoriId },
    { userId: playerId, categoryId: kategoriId },
    { playerIds: [playerId], categoryId: kategoriId },
  ];
}
