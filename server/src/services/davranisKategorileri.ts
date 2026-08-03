/**
 * Davranis kategorileri.
 *
 * ── Istenen ───────────────────────────────────────────────────────────
 *
 * "Aktif üye, bonus avcısı, high risk, vip üye gibi kategoriler ekle."
 *
 * ── Cozulmesi gereken catisma ─────────────────────────────────────────
 *
 * Lynon'da oyuncu basina TEK kategori alani var. Sitede zaten bir DEGER
 * merdiveni tanimli (Sicario → El Patrón, toplam yatirima gore).
 * Davranis etiketleri de ayni tek slota yaziliyor; yani bir oyuncu ayni
 * anda hem "El Patrón (Seviye 5)" hem "High Risk" OLAMAZ.
 *
 * Bunu gormezden gelip dordunu de otomatik atamak, deger merdivenini
 * pratikte yok ederdi: "Aktif Üye" kurali neredeyse her canli oyuncuya
 * uyar ve herkesin seviyesini silerdi.
 *
 * ── Secilen politika ──────────────────────────────────────────────────
 *
 * Davranis etiketleri ISTISNA olarak kullanilir; merdivenin yerine
 * gecmez. Yalnizca operatorun BAKMASI GEREKEN durumlar merdiveni ezer:
 *
 *   1. High Risk     — ezer. Riskli oyuncunun ilk bakista gorunmesi,
 *                      seviyesinin gorunmesinden onemli.
 *   2. Bonus Avcısı  — ezer. Kampanya kararlarini dogrudan etkiliyor.
 *   3. VIP Üye       — VARSAYILAN OLARAK KAPALI. "El Patrón (Seviye 5)"
 *                      zaten ayni oyunculari isaret ediyor; ikisini
 *                      birden atamak slotu bosa harcar.
 *   4. Aktif Üye     — VARSAYILAN OLARAK KAPALI. Neredeyse her canli
 *                      oyuncuya uyar; atanirsa merdiven tamamen silinir.
 *
 * Dordu de OLUSTURULUR — operator elle atayabilsin, CRM filtreleyebilsin
 * diye. Otomatik atanan yalnizca ilk ikisidir; `OTOMATIK_DAVRANIS`
 * degiskeniyle liste degistirilebilir.
 *
 * ── Aciklama bicimi ───────────────────────────────────────────────────
 *
 * Aciklamalar KOSELI PARANTEZ + PARA BIRIMI icermez. `esikCoz` bant
 * tanimini tam olarak o bicimden tanidigi icin, davranis kategorileri
 * deger merdivenine sizmaz.
 */

export type DavranisKimligi = 'highRisk' | 'bonusAvcisi' | 'vip' | 'aktif';

export type DavranisTanimi = {
  kimlik: DavranisKimligi;
  name: string;
  description: string;
  color: string;
  textColor: string;
  isVisibleToPlayer: boolean;
  /** Yuksek olan once denenir. */
  oncelik: number;
  /** Varsayilan otomatik atama listesinde mi? */
  otomatikVarsayilan: boolean;
};

/**
 * Olusturulacak kategoriler.
 *
 * Govde alanlari dogrulanmis POST sozlesmesiyle birebir:
 * `{ name, description, siteId, color, textColor, isVisibleToPlayer }`.
 *
 * `isVisibleToPlayer` hepsinde FALSE. "High Risk" ya da "Bonus Avcısı"
 * etiketini oyuncuya gostermek, hem musteri iliskisini bozar hem de
 * tespit mantigini disari sizdirir.
 */
export const DAVRANIS_KATEGORILERI: DavranisTanimi[] = [
  {
    kimlik: 'highRisk',
    name: 'High Risk',
    description: 'Davranış etiketi — çoklu hesap ve yüksek kazanç birlikte görüldü, manuel inceleme bekliyor.',
    color: '#EF4444',
    textColor: '#FFFFFF',
    isVisibleToPlayer: false,
    oncelik: 100,
    otomatikVarsayilan: true,
  },
  {
    kimlik: 'bonusAvcisi',
    name: 'Bonus Avcısı',
    description: 'Davranış etiketi — yatırımına oranla çok sayıda bonus almış oyuncu.',
    color: '#F59E0B',
    textColor: '#000000',
    isVisibleToPlayer: false,
    oncelik: 80,
    otomatikVarsayilan: true,
  },
  {
    kimlik: 'vip',
    name: 'VIP Üye',
    description: 'Davranış etiketi — yüksek yatırımlı ve hâlâ aktif oyuncu. El Patrón seviyesiyle örtüşür.',
    color: '#8B5CF6',
    textColor: '#FFFFFF',
    isVisibleToPlayer: false,
    oncelik: 60,
    otomatikVarsayilan: false,
  },
  {
    kimlik: 'aktif',
    name: 'Aktif Üye',
    description: 'Davranış etiketi — son günlerde yatırım yapmış oyuncu.',
    color: '#10B981',
    textColor: '#FFFFFF',
    isVisibleToPlayer: false,
    oncelik: 40,
    otomatikVarsayilan: false,
  },
];

export const DAVRANIS_ESIKLERI = {
  /** Bonus avcisi sayilmak icin gereken en az bonus adedi. */
  bonusAvcisiAdedi: 5,
  /** Bu tutarin altinda yatirimla o kadar bonus almak avciliktir. */
  bonusAvcisiYatirim: 10_000,
  /** Bonus basina dusen yatirim bu tutarin altindaysa yine avci. */
  bonusBasinaYatirim: 1_000,
  /** VIP sayilmak icin toplam yatirim. */
  vipYatirim: 500_000,
  /** VIP'in "hâlâ aktif" sayilmasi icin son yatirim penceresi (gun). */
  vipAktiflikGun: 30,
  /** Aktif uye penceresi (gun). */
  aktifGun: 7,
} as const;

/**
 * Ad karsilastirmasi — buyuk/kucuk harf, aksan ve bosluk farkini yutar.
 *
 * ── Turkce I tuzagi, tersinden ────────────────────────────────────────
 *
 * Burada `toLocaleLowerCase('tr-TR')` KULLANILAMAZ. Kategori adlarinin
 * bir kismi Ingilizce ("High Risk") ve Turkce kucultme `I` harfini
 * NOKTASIZ `ı`ya cevirir:
 *
 *   'HIGH RISK'.toLocaleLowerCase('tr-TR')  →  'hıgh rısk'
 *   'High Risk'.toLocaleLowerCase('tr-TR')  →  'high risk'
 *
 * Ikisi eslesmez; sonuc "High Risk" kategorisinin sitede zaten var
 * oldugu halde bir kez daha olusturulmasi olurdu. Testi yazarken bu
 * cikti.
 *
 * Cozum: once LOCALE-BAGIMSIZ kucultme, sonra NFD ile aksanlari ayirip
 * atmak. `ı` NFD ile cozulmedigi icin elle esleniyor.
 */
export function adAnahtari(ad: unknown): string {
  return String(ad ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ');
}

/**
 * Sitede eksik olan davranis kategorileri.
 *
 * Ada gore karsilastirir; ayni adi ikinci kez olusturmaz. Bu fonksiyon
 * olmadan "kategorileri oluştur" dugmesi her basista kopya uretirdi.
 */
export function eksikKategoriler(
  mevcut: Array<{ name?: unknown }> | null | undefined,
  tanimlar: DavranisTanimi[] = DAVRANIS_KATEGORILERI,
): DavranisTanimi[] {
  const varOlan = new Set((mevcut ?? []).map((k) => adAnahtari(k?.name)).filter(Boolean));
  return tanimlar.filter((tanim) => !varOlan.has(adAnahtari(tanim.name)));
}

/** POST govdesi — dogrulanmis sozlesme. */
export function kategoriOlusturmaGovdesi(tanim: DavranisTanimi, siteId: number | string): Record<string, unknown> {
  return {
    name: tanim.name,
    description: tanim.description,
    siteId: Number(siteId),
    color: tanim.color,
    textColor: tanim.textColor,
    isVisibleToPlayer: tanim.isVisibleToPlayer,
  };
}

export type DavranisOlculeri = {
  /** Kasa acisindan kar/zarar. NEGATIF ise oyuncu onde. */
  netKarZarar: number | null;
  ayniIpHesapSayisi: number | null;
  toplamYatirim: number | null;
  /** Oyuncunun bugune kadar aldigi bonus adedi. Bilinmiyorsa null. */
  bonusAdedi: number | null;
  /** Son yatirimdan bu yana gecen gun. Bilinmiyorsa null. */
  durgunGun: number | null;
  /** Coklu hesap + onemli kazanc esigi. */
  onemliKazanc: number;
};

export type DavranisKarari = {
  kimlik: DavranisKimligi;
  ad: string;
  gerekce: string;
};

/**
 * Oyuncuya uyan davranis etiketi.
 *
 * En yuksek oncelikli TEK etiket doner; Lynon'da tek slot var, ikinciyi
 * hesaplamanin anlami yok. Olcu eksikse o kural HIC calismaz — sifir
 * sayilmaz.
 */
export function davranisKarari(olcu: DavranisOlculeri): DavranisKarari | null {
  const kazanc = olcu.netKarZarar === null ? null : -olcu.netKarZarar;
  const cokluHesap = olcu.ayniIpHesapSayisi !== null && olcu.ayniIpHesapSayisi > 1;

  // 1 · High Risk
  if (cokluHesap && kazanc !== null && kazanc >= olcu.onemliKazanc) {
    return {
      kimlik: 'highRisk',
      ad: 'High Risk',
      gerekce: `Aynı IP'de ${olcu.ayniIpHesapSayisi} hesap ve ${Math.round(kazanc).toLocaleString('tr-TR')} ₺ kazanç.`,
    };
  }

  // 2 · Bonus Avcısı — bonus gecmisi bilinmiyorsa hic karar verilmez.
  if (olcu.bonusAdedi !== null && olcu.toplamYatirim !== null) {
    const { bonusAvcisiAdedi, bonusAvcisiYatirim, bonusBasinaYatirim } = DAVRANIS_ESIKLERI;
    const cokBonus = olcu.bonusAdedi >= bonusAvcisiAdedi;
    const azYatirim = olcu.toplamYatirim < bonusAvcisiYatirim;
    const ucuzBonus =
      olcu.bonusAdedi >= 3 && olcu.toplamYatirim / olcu.bonusAdedi < bonusBasinaYatirim;
    if (cokBonus && (azYatirim || ucuzBonus)) {
      return {
        kimlik: 'bonusAvcisi',
        ad: 'Bonus Avcısı',
        gerekce: `${olcu.bonusAdedi} bonus, toplam yatırım ${Math.round(olcu.toplamYatirim).toLocaleString('tr-TR')} ₺.`,
      };
    }
  }

  // 3 · VIP Üye
  if (
    olcu.toplamYatirim !== null &&
    olcu.toplamYatirim >= DAVRANIS_ESIKLERI.vipYatirim &&
    olcu.durgunGun !== null &&
    olcu.durgunGun <= DAVRANIS_ESIKLERI.vipAktiflikGun
  ) {
    return {
      kimlik: 'vip',
      ad: 'VIP Üye',
      gerekce: `${Math.round(olcu.toplamYatirim).toLocaleString('tr-TR')} ₺ yatırım, ${olcu.durgunGun} gün önce aktif.`,
    };
  }

  // 4 · Aktif Üye
  if (olcu.durgunGun !== null && olcu.durgunGun <= DAVRANIS_ESIKLERI.aktifGun) {
    return {
      kimlik: 'aktif',
      ad: 'Aktif Üye',
      gerekce: `${olcu.durgunGun} gün önce yatırım yapmış.`,
    };
  }

  return null;
}

/**
 * Otomatik atanacak davranis etiketleri.
 *
 * `OTOMATIK_DAVRANIS=highRisk,bonusAvcisi,vip` gibi virgullu liste ile
 * degistirilebilir; `OTOMATIK_DAVRANIS=` (bos) hepsini kapatir ve
 * davranis etiketleri yalnizca elle atanir.
 */
export function otomatikDavranislar(ayar: string | undefined = process.env.OTOMATIK_DAVRANIS): Set<DavranisKimligi> {
  if (ayar === undefined) {
    return new Set(DAVRANIS_KATEGORILERI.filter((t) => t.otomatikVarsayilan).map((t) => t.kimlik));
  }
  const istenen = ayar.split(',').map((p) => p.trim()).filter(Boolean);
  const gecerli = new Set(DAVRANIS_KATEGORILERI.map((t) => t.kimlik as string));
  return new Set(istenen.filter((p): p is DavranisKimligi => gecerli.has(p)));
}
