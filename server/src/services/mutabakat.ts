/**
 * Aylik mutabakat.
 *
 * Kaynak rapor 1842 — odeme yontemi kirilimi:
 *
 *   { "Integration Name": "HemenOde", "Payment Name": "Havale",
 *     "Deposit Amount": 5310, "Deposit Count": 5,
 *     "Withdrawal Amount": 13166, "Withdrawal Count": 2 }
 *
 * ── Neden manuel giris gerekiyor ──────────────────────────────────────
 *
 * Rapor yalnizca ODEME SAGLAYICILARINDAN gecen parayi goruyor. Elden
 * yapilan yatirimlar, saglayici disi havaleler, iade ve dengeleme
 * kalemleri raporda YOK. Mutabakat bunlari iceremezse ay sonunda kasa
 * ile rapor tutmaz ve fark nereden geldigi bilinmez.
 *
 * Bu yuzden manuel kalemler AYRI tutulur ve toplamda ayri gosterilir:
 * "raporun soyledigi" ile "elle eklenen" birbirine karistirilmaz. Tek
 * bir toplam gostermek, farkin kaynagini gizlerdi.
 */

type AnyRecord = Record<string, any>;

export type MutabakatSatiri = {
  /** "HemenOde · Havale" */
  anahtar: string;
  entegrasyon: string;
  yontem: string;
  yatirim: number;
  yatirimAdedi: number;
  cekim: number;
  cekimAdedi: number;
  net: number;
  /**
   * Bu yonteme ETIKETLI manuel kalemlerin toplami — yalnizca
   * `satirlariManuelIleZenginlestir` ciktisinda dolu. Rapor satirini
   * hesaplayan `mutabakatSatirlari` bunu doldurmaz; rapor rakami elle
   * eklenenle KARISTIRILMAZ, ayri tutulur.
   */
  manuelYatirim?: number;
  manuelCekim?: number;
  /** Rapor + bu yontemin manuel kalemleri. */
  duzeltilmisYatirim?: number;
  duzeltilmisCekim?: number;
  duzeltilmisNet?: number;
};

export type ManuelKalem = {
  id: string;
  /** "YYYY-MM-DD" — Turkiye gunu. */
  gun: string;
  tur: 'yatirim' | 'cekim';
  tutar: number;
  aciklama: string;
  ekleyen: string;
  eklendi: string;
  /**
   * Bu kalemin ait oldugu odeme yontemi (`MutabakatSatiri.anahtar` ile
   * ayni bicimde, orn. "HemenOde · Havale"). BOSSA/NULL ise kalem genel
   * kabul edilir — belirli bir saglayiciya degil, kasanin geneline
   * (elden yatirim, dengeleme...) ait demektir ve hicbir satirin
   * duzeltilmis tutarina eklenmez, yalnizca GENEL TOPLAM'a girer.
   */
  yontem?: string | null;
};

function sayi(deger: unknown): number {
  if (deger === null || deger === undefined || deger === '') return 0;
  const n = Number(String(deger).replace(/[^\d.,+-]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function metin(deger: unknown): string {
  return String(deger ?? '').trim();
}

/**
 * Rapor satirlarini mutabakat satirlarina cevirir.
 *
 * Ayni entegrasyon+yontem ikilisi birden fazla satirda gelirse
 * TOPLANIR; ucun ayni ikiliyi para birimi bazinda bolerek dondurmesi
 * mumkun ve iki satiri ayri gostermek toplami dogru ama listeyi
 * yaniltici yapardi.
 */
export function mutabakatSatirlari(raporSatirlari: AnyRecord[] | null | undefined): MutabakatSatiri[] {
  const kova = new Map<string, MutabakatSatiri>();

  for (const satir of raporSatirlari ?? []) {
    const entegrasyon = metin(satir?.['Integration Name'] ?? satir?.IntegrationName) || 'Bilinmiyor';
    const yontem = metin(satir?.['Payment Name'] ?? satir?.PaymentName) || 'Bilinmiyor';
    const anahtar = `${entegrasyon} · ${yontem}`;

    const yatirim = sayi(satir?.['Deposit Amount (TRY)'] ?? satir?.['Deposit Amount']);
    const cekim = sayi(satir?.['Withdrawal Amount (TRY)'] ?? satir?.['Withdrawal Amount']);

    const mevcut = kova.get(anahtar) ?? {
      anahtar, entegrasyon, yontem,
      yatirim: 0, yatirimAdedi: 0, cekim: 0, cekimAdedi: 0, net: 0,
    };
    mevcut.yatirim += yatirim;
    mevcut.yatirimAdedi += sayi(satir?.['Deposit Count']);
    mevcut.cekim += cekim;
    mevcut.cekimAdedi += sayi(satir?.['Withdrawal Count']);
    mevcut.net = mevcut.yatirim - mevcut.cekim;
    kova.set(anahtar, mevcut);
  }

  return [...kova.values()].sort((a, b) => b.yatirim - a.yatirim);
}

/**
 * Yonteme etiketli manuel kalemleri ilgili satira isler.
 *
 * Rapor rakami (yatirim/cekim) DEGISTIRILMEZ — yalnizca yanina
 * `manuelYatirim`/`manuelCekim` ve toplamlarini tasiyan `duzeltilmisX`
 * eklenir. Boylece "saglayicinin soyledigi" ile "elle duzeltilen" ayni
 * satirda ama HALA ayirt edilebilir kalir.
 *
 * Yontemi bos/null olan kalemler HICBIR satira islenmez — GENEL bir
 * duzeltmedir, belirli bir saglayiciyi degil kasanin genelini duzeltir.
 */
export function satirlariManuelIleZenginlestir(
  satirlar: MutabakatSatiri[] | null | undefined,
  manuel: ManuelKalem[] | null | undefined,
): MutabakatSatiri[] {
  const kalemler = manuel ?? [];
  return (satirlar ?? []).map((satir) => {
    const kendiKalemleri = kalemler.filter((k) => metin(k.yontem) === satir.anahtar);
    const manuelYatirim = kendiKalemleri.filter((k) => k.tur === 'yatirim').reduce((t, k) => t + sayi(k.tutar), 0);
    const manuelCekim = kendiKalemleri.filter((k) => k.tur === 'cekim').reduce((t, k) => t + sayi(k.tutar), 0);
    const duzeltilmisYatirim = satir.yatirim + manuelYatirim;
    const duzeltilmisCekim = satir.cekim + manuelCekim;
    return {
      ...satir,
      manuelYatirim,
      manuelCekim,
      duzeltilmisYatirim,
      duzeltilmisCekim,
      duzeltilmisNet: duzeltilmisYatirim - duzeltilmisCekim,
    };
  });
}

export type MutabakatToplami = {
  /** Rapordan gelen. */
  raporYatirim: number;
  raporCekim: number;
  raporNet: number;
  /** Elle eklenen. */
  manuelYatirim: number;
  manuelCekim: number;
  manuelNet: number;
  /** Ikisinin toplami. */
  toplamYatirim: number;
  toplamCekim: number;
  toplamNet: number;
  manuelKalemAdedi: number;
};

/**
 * Toplamlar.
 *
 * `reportsSummary` varsa rapor toplami ORADAN alinir; satirlari
 * toplamak yerine ucun kendi ozetine guvenmek, ucun sayfaladigi ya da
 * satirda gostermedigi bir kalem varsa farki ortaya cikarir.
 * Ozet yoksa satirlardan hesaplanir.
 */
export function mutabakatToplami(
  satirlar: MutabakatSatiri[] | null | undefined,
  ozet: AnyRecord | null | undefined,
  manuel: ManuelKalem[] | null | undefined,
): MutabakatToplami {
  const liste = satirlar ?? [];
  const ozetYatirim = ozet?.['Deposit Amount (TRY)'] ?? ozet?.['Deposit Amount'];
  const ozetCekim = ozet?.['Withdrawal Amount (TRY)'] ?? ozet?.['Withdrawal Amount'];

  const raporYatirim = ozetYatirim !== undefined && ozetYatirim !== null
    ? sayi(ozetYatirim)
    : liste.reduce((t, s) => t + s.yatirim, 0);
  const raporCekim = ozetCekim !== undefined && ozetCekim !== null
    ? sayi(ozetCekim)
    : liste.reduce((t, s) => t + s.cekim, 0);

  const kalemler = manuel ?? [];
  const manuelYatirim = kalemler.filter((k) => k.tur === 'yatirim').reduce((t, k) => t + sayi(k.tutar), 0);
  const manuelCekim = kalemler.filter((k) => k.tur === 'cekim').reduce((t, k) => t + sayi(k.tutar), 0);

  return {
    raporYatirim,
    raporCekim,
    raporNet: raporYatirim - raporCekim,
    manuelYatirim,
    manuelCekim,
    manuelNet: manuelYatirim - manuelCekim,
    toplamYatirim: raporYatirim + manuelYatirim,
    toplamCekim: raporCekim + manuelCekim,
    toplamNet: raporYatirim + manuelYatirim - (raporCekim + manuelCekim),
    manuelKalemAdedi: kalemler.length,
  };
}

/**
 * Satirlarin toplami ile ucun ozeti tutuyor mu?
 *
 * Tutmuyorsa rapor icinde gormedigimiz bir kalem var demektir. Bunu
 * sessizce yutmak mutabakatin amacini bozar.
 */
export function ozetFarki(satirlar: MutabakatSatiri[], ozet: AnyRecord | null | undefined): {
  yatirimFarki: number;
  cekimFarki: number;
  tutarli: boolean;
} {
  const ozetYatirim = ozet?.['Deposit Amount (TRY)'] ?? ozet?.['Deposit Amount'];
  const ozetCekim = ozet?.['Withdrawal Amount (TRY)'] ?? ozet?.['Withdrawal Amount'];
  if (ozetYatirim === undefined || ozetCekim === undefined) {
    return { yatirimFarki: 0, cekimFarki: 0, tutarli: true };
  }
  const yatirimFarki = sayi(ozetYatirim) - satirlar.reduce((t, s) => t + s.yatirim, 0);
  const cekimFarki = sayi(ozetCekim) - satirlar.reduce((t, s) => t + s.cekim, 0);
  // Kurus farklarini gurultu saymamak icin 1 kurus tolerans.
  const tutarli = Math.abs(yatirimFarki) < 0.01 && Math.abs(cekimFarki) < 0.01;
  return { yatirimFarki, cekimFarki, tutarli };
}

/** Ayin ilk gunu ve bugun — Turkiye gununden. */
export function ayAraligi(bugun: string): { startDate: string; endDate: string; ay: string } {
  const ay = bugun.slice(0, 7);
  return { startDate: `${ay}-01`, endDate: bugun, ay };
}

/** Verilen gunun bir onceki ayinin anahtari ("YYYY-MM"). */
export function oncekiAyAnahtari(bugun: string): string {
  const yil = Number(bugun.slice(0, 4));
  const ay = Number(bugun.slice(5, 7));
  const oncekiAy = ay === 1 ? 12 : ay - 1;
  const oncekiYil = ay === 1 ? yil - 1 : yil;
  return `${oncekiYil}-${String(oncekiAy).padStart(2, '0')}`;
}

/** Verilen ayin ("YYYY-MM") ilk ve son gunu — AY KAPANDIYSA tam aralik. */
export function ayinTamAraligi(ay: string): { startDate: string; endDate: string; ay: string } {
  const yil = Number(ay.slice(0, 4));
  const ayNo = Number(ay.slice(5, 7));
  // Bir sonraki ayin 0. gunu = bu ayin son gunu.
  const sonGun = new Date(Date.UTC(yil, ayNo, 0)).getUTCDate();
  return { startDate: `${ay}-01`, endDate: `${ay}-${String(sonGun).padStart(2, '0')}`, ay };
}

/** Manuel kalemi verilen aya suz. */
export function ayinManuelKalemleri(kalemler: ManuelKalem[] | null | undefined, ay: string): ManuelKalem[] {
  return (kalemler ?? []).filter((kalem) => String(kalem?.gun ?? '').startsWith(ay));
}

const TL = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

function para(deger: number): string {
  return `${TL.format(deger)} TRY`;
}

/**
 * Telegram mutabakat mesaji.
 *
 * `kapanis: true` verilirse baslik "AY KAPANIŞI" olur — ay icinde her
 * gun 00:00'da giden "ayin basindan bugune" mesajindan AYIRT EDILMESI
 * gerekir; biri devam eden bir ayin ara durumu, digeri kapanmis bir
 * ayin kesin toplami.
 *
 * `satirlar` `satirlariManuelIleZenginlestir` ciktisiysa (manuelYatirim/
 * manuelCekim dolu), o yonteme etiketli duzeltme satirin altina ayrica
 * yazilir — rapor rakami degismez, yaninda gorunur.
 */
export function mutabakatMesaji(input: {
  ay: string;
  aralik: { startDate: string; endDate: string };
  satirlar: MutabakatSatiri[];
  toplam: MutabakatToplami;
  fark: { yatirimFarki: number; cekimFarki: number; tutarli: boolean };
  manuel: ManuelKalem[];
  kapanis?: boolean;
}): string {
  const { ay, aralik, satirlar, toplam, fark, manuel, kapanis } = input;
  const parcalar: string[] = [
    kapanis ? `📕 AY KAPANIŞI · ${ay}` : `📒 AYLIK MUTABAKAT · ${ay}`,
    `${aralik.startDate} → ${aralik.endDate}`,
    '',
    'ÖDEME YÖNTEMİ KIRILIMI',
  ];

  if (satirlar.length === 0) {
    parcalar.push('  (bu ayda sağlayıcı hareketi yok)');
  } else {
    for (const satir of satirlar) {
      parcalar.push(
        `  ${satir.anahtar}`,
        `    Yatırım: ${para(satir.yatirim)} (${satir.yatirimAdedi})`,
        `    Çekim:   ${para(satir.cekim)} (${satir.cekimAdedi})`,
      );
      // Bu yonteme etiketli manuel duzeltme varsa hemen altina yazilir.
      if (satir.manuelYatirim || satir.manuelCekim) {
        parcalar.push(
          `    ✏️ Elle düzeltme: yatırım ${para(satir.manuelYatirim ?? 0)} · çekim ${para(satir.manuelCekim ?? 0)}` +
          ` → düzeltilmiş net ${para(satir.duzeltilmisNet ?? satir.net)}`,
        );
      }
    }
  }

  parcalar.push(
    '',
    'RAPOR TOPLAMI',
    `  Yatırım: ${para(toplam.raporYatirim)}`,
    `  Çekim:   ${para(toplam.raporCekim)}`,
    `  Net:     ${para(toplam.raporNet)}`,
  );

  if (toplam.manuelKalemAdedi > 0) {
    parcalar.push(
      '',
      `ELLE EKLENEN (${toplam.manuelKalemAdedi} kalem)`,
      `  Yatırım: ${para(toplam.manuelYatirim)}`,
      `  Çekim:   ${para(toplam.manuelCekim)}`,
    );
    for (const kalem of manuel.slice(0, 10)) {
      parcalar.push(`  • ${kalem.gun} ${kalem.tur === 'yatirim' ? '+' : '−'}${para(kalem.tutar)} — ${kalem.aciklama || 'açıklama yok'}`);
    }
    if (manuel.length > 10) parcalar.push(`  • … ${manuel.length - 10} kalem daha`);
  }

  parcalar.push(
    '',
    'GENEL TOPLAM',
    `  Yatırım: ${para(toplam.toplamYatirim)}`,
    `  Çekim:   ${para(toplam.toplamCekim)}`,
    `  Net:     ${para(toplam.toplamNet)}`,
  );

  // Satir toplami ile ucun ozeti tutmuyorsa bunu SOYLE.
  if (!fark.tutarli) {
    parcalar.push(
      '',
      '⚠️ Satır toplamı uçun özetiyle tutmuyor:',
      `  Yatırım farkı: ${para(fark.yatirimFarki)}`,
      `  Çekim farkı:   ${para(fark.cekimFarki)}`,
    );
  }

  return parcalar.join('\n');
}

/**
 * Yontem bazinda GUNLUK kasa mesaji.
 *
 * `mutabakatMesaji`dan farkli: bu AY ozeti degil, o GUNUN saglayici
 * kirilimi — periyodik olarak (kasa ozetiyle ayni ritimde) atilir ve
 * "hangi yontemden ne kadar para girdi/cikti, su an" sorusunu cevaplar.
 * Manuel kalem, fark kontrolu yok — o mutabakatin isi.
 */
export function yontemKasaMesaji(gun: string, satirlar: MutabakatSatiri[], saat?: string | null): string {
  const parcalar: string[] = [
    `🏦 YÖNTEM BAZINDA KASA · ${gun}${saat ? ` · ${saat}` : ''}`,
  ];

  if (satirlar.length === 0) {
    parcalar.push('', '(bugün sağlayıcı hareketi yok)');
    return parcalar.join('\n');
  }

  let toplamYatirim = 0;
  let toplamCekim = 0;
  for (const satir of satirlar) {
    toplamYatirim += satir.yatirim;
    toplamCekim += satir.cekim;
    parcalar.push(
      '',
      `  ${satir.anahtar}`,
      `    ⬇️ Yatırım: ${para(satir.yatirim)} (${satir.yatirimAdedi})`,
      `    ⬆️ Çekim:   ${para(satir.cekim)} (${satir.cekimAdedi})`,
      `    ⚖️ Net:     ${para(satir.net)}`,
    );
  }

  parcalar.push(
    '',
    '━━━━━━━━━━━━━━━━━━',
    `  TOPLAM Yatırım: ${para(toplamYatirim)}`,
    `  TOPLAM Çekim:   ${para(toplamCekim)}`,
    `  TOPLAM Net:     ${para(toplamYatirim - toplamCekim)}`,
  );

  return parcalar.join('\n');
}
