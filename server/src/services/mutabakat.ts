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

/** Manuel kalemi verilen aya suz. */
export function ayinManuelKalemleri(kalemler: ManuelKalem[] | null | undefined, ay: string): ManuelKalem[] {
  return (kalemler ?? []).filter((kalem) => String(kalem?.gun ?? '').startsWith(ay));
}

const TL = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

function para(deger: number): string {
  return `${TL.format(deger)} TRY`;
}

/** Telegram mutabakat mesaji. */
export function mutabakatMesaji(input: {
  ay: string;
  aralik: { startDate: string; endDate: string };
  satirlar: MutabakatSatiri[];
  toplam: MutabakatToplami;
  fark: { yatirimFarki: number; cekimFarki: number; tutarli: boolean };
  manuel: ManuelKalem[];
}): string {
  const { ay, aralik, satirlar, toplam, fark, manuel } = input;
  const parcalar: string[] = [
    `📒 AYLIK MUTABAKAT · ${ay}`,
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
