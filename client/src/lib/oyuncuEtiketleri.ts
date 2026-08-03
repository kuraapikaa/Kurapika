/**
 * Oyuncu profili etiketleri.
 *
 * ── Bildirilen sorun ──────────────────────────────────────────────────
 *
 * "Bugs Software AI Analiz Karnesi bütün profillerde alakasız filtreler
 * gösteriyor."
 *
 * Doğruydu. Eski liste dört ayrı yoldan gürültü üretiyordu:
 *
 *   1. YANLIŞ ÖLÇÜ. `hasNoBonus` ANLIK bonus bakiyesine bakıyordu.
 *      Bonusunu çevirip bitirmiş bir oyuncunun bakiyesi de sıfırdır;
 *      dolayısıyla "No Bonus User" neredeyse HERKESTE çıkıyordu.
 *
 *   2. TEK SİNYAL, DÖRT ETİKET. `isWinner` (oyuncu kârda) tek başına
 *      "Risk Review", "High Risk", "Negative" ve "Review" etiketlerinin
 *      hepsini tetikliyordu. Birbirinin kopyası dört rozet, tek bilgi.
 *
 *   3. EŞİKSİZ RİSK. Kârda olmak risk değildir; 40 lira önde olan
 *      oyuncu da "High Risk" görünüyordu.
 *
 *   4. VERİ YOKKEN ETİKET. Alan gelmediğinde `Number(undefined ?? 0)`
 *      sıfıra düşüyor, sıfır da eşiği geçiyordu. Ölçülmemiş şey
 *      ölçülmüş gibi rozetleniyordu.
 *
 * ── Kural ─────────────────────────────────────────────────────────────
 *
 * Bir SİNYAL en fazla bir ETİKET üretir. Etiketler ailelere ayrılmıştır
 * ve her aileden yalnızca en güçlüsü gösterilir. Bir ailenin ihtiyaç
 * duyduğu ölçü `null` ise o aile HİÇ etiket üretmez — sıfır sayılmaz.
 */

export type EtiketTonu = 'bilgi' | 'olumlu' | 'notr' | 'uyari' | 'tehlike';

/** Aynı aileden en fazla bir etiket gösterilir. */
export type EtiketAilesi = 'yasam' | 'deger' | 'risk' | 'desen' | 'kasa' | 'cekim' | 'bonus' | 'dogrulama';

export type Etiket = {
  id: string;
  etiket: string;
  /** Rozetin üstüne gelince görünen gerekçe — hangi ölçü, hangi eşik. */
  aciklama: string;
  ton: EtiketTonu;
  aile: EtiketAilesi;
  /** Yüksek olan önce gösterilir. */
  agirlik: number;
};

/**
 * Ölçüler.
 *
 * Her alan `null` olabilir ve `null` "bilinmiyor" demektir — sıfır
 * DEĞİL. Bu ayrım bu dosyanın tamamının varlık sebebi.
 */
export type OyuncuOlculeri = {
  yatirimTutari: number | null;
  yatirimAdedi: number | null;
  cekimTutari: number | null;
  /** Kasa açısından kâr/zarar. NEGATİF ise oyuncu öndedir. */
  netKarZarar: number | null;
  sporHacmi: number | null;
  casinoHacmi: number | null;
  kayitTarihi: string | null;
  /** Oyuncunun bugüne kadar ALDIĞI bonus adedi. Bilinmiyorsa null. */
  bonusAdedi: number | null;
  /** Aynı IP'de görülen hesap sayısı — oyuncunun kendisi dahil. */
  ayniIpHesapSayisi: number | null;
  /**
   * Telefon doğrulaması. ÜÇ DURUMLU: `null` "ölçülemedi" demek.
   * `=== true` ile daraltmak, alanı gelmeyen oyuncuyu "doğrulanmamış"
   * gösterip yanlış etiket üretirdi.
   */
  telefonDogrulandi?: boolean | null;
};

/** Eşikler tek yerde; pazarlama değiştiğinde kod aranmaz. */
export const ESIKLER = {
  /** VIP kabul edilen toplam yatırım. */
  vipYatirim: 100_000,
  /** VIP adayı bandının alt sınırı. */
  vipAdayiYatirim: 25_000,
  /** Yeni oyuncu sayılan süre. */
  yeniOyuncuGun: 30,
  /** Oyun deseni yorumlanabilmesi için gereken en az hacim. */
  desenHacmi: 25_000,
  /** Bir kanalın "ağırlıklı" sayılması için gereken pay. */
  desenPayi: 0.7,
  /** Oyuncunun önde olmasının anlam kazandığı tutar. */
  onemliKazanc: 50_000,
  /** Çekim/yatırım karşılaştırmasının anlamlı olduğu taban. */
  cekimTabani: 5_000,
} as const;

function sayi(deger: number | null | undefined): number | null {
  if (deger === null || deger === undefined) return null;
  return Number.isFinite(deger) ? deger : null;
}

/** Kayıttan bu yana geçen gün. Tarih okunamıyorsa null. */
export function kayittanBeriGun(kayitTarihi: string | null, simdi: number = Date.now()): number | null {
  if (!kayitTarihi) return null;
  const t = Date.parse(kayitTarihi);
  if (!Number.isFinite(t)) return null;
  return Math.floor((simdi - t) / 86_400_000);
}

export type RiskSeviyesi = 'DÜŞÜK' | 'ORTA' | 'YÜKSEK' | 'KRİTİK';

/**
 * Risk seviyesi.
 *
 * Kârda olmak TEK BAŞINA risk değildir — oyuncuların bir kısmı her zaman
 * öndedir. Risk, çoklu hesap ile ÖNEMLİ bir kazancın birlikte
 * görülmesidir. Eski sürüm ikisini "veya" ile bağlayıp neredeyse her
 * profili "ORTA" yapıyordu.
 */
export function riskSeviyesi(o: OyuncuOlculeri): RiskSeviyesi {
  const hesap = sayi(o.ayniIpHesapSayisi);
  const kar = sayi(o.netKarZarar);
  const cokluHesap = hesap !== null && hesap > 1;
  const onemliKazanc = kar !== null && kar <= -ESIKLER.onemliKazanc;

  if (cokluHesap && onemliKazanc) return 'KRİTİK';
  if (cokluHesap && kar !== null && kar < 0) return 'YÜKSEK';
  if (cokluHesap || onemliKazanc) return 'ORTA';
  return 'DÜŞÜK';
}

/**
 * Gösterilecek etiketler.
 *
 * Aynı aileden yalnızca en yüksek ağırlıklı etiket kalır; sonuç
 * ağırlığa göre sıralanır.
 */
export function oyuncuEtiketleri(o: OyuncuOlculeri, simdi: number = Date.now()): Etiket[] {
  const aday: Etiket[] = [];

  const yatirim = sayi(o.yatirimTutari);
  const yatirimAdedi = sayi(o.yatirimAdedi);
  const cekim = sayi(o.cekimTutari);
  const kar = sayi(o.netKarZarar);
  const spor = sayi(o.sporHacmi);
  const casino = sayi(o.casinoHacmi);
  const bonusAdedi = sayi(o.bonusAdedi);
  const hesapSayisi = sayi(o.ayniIpHesapSayisi);
  const gun = kayittanBeriGun(o.kayitTarihi, simdi);

  const oyuncuOnde = kar !== null && kar < 0;
  const kazanc = kar === null ? null : -kar;

  // ── Yaşam evresi
  if (gun !== null && gun <= ESIKLER.yeniOyuncuGun) {
    aday.push({
      id: 'yeni-oyuncu', etiket: 'Yeni oyuncu', aile: 'yasam', ton: 'bilgi', agirlik: 20,
      aciklama: `Kayıt ${gun} gün önce (eşik ${ESIKLER.yeniOyuncuGun} gün).`,
    });
  }
  // "Pasif" ancak ÜÇ ölçü de bilinip üçü de sıfırken söylenebilir.
  if (yatirimAdedi === 0 && spor === 0 && casino === 0) {
    aday.push({
      id: 'pasif', etiket: 'Pasif hesap', aile: 'yasam', ton: 'notr', agirlik: 25,
      aciklama: 'Hiç yatırım ve hiç bahis yok.',
    });
  }

  // ── Değer bandı
  if (yatirim !== null && yatirim >= ESIKLER.vipYatirim) {
    aday.push({
      id: 'vip', etiket: 'VIP', aile: 'deger', ton: 'olumlu', agirlik: 60,
      aciklama: `Toplam yatırım ${Math.round(yatirim).toLocaleString('tr-TR')} ₺ (eşik ${ESIKLER.vipYatirim.toLocaleString('tr-TR')} ₺).`,
    });
  } else if (yatirim !== null && yatirim >= ESIKLER.vipAdayiYatirim) {
    aday.push({
      id: 'vip-adayi', etiket: 'VIP adayı', aile: 'deger', ton: 'bilgi', agirlik: 40,
      aciklama: `Toplam yatırım ${Math.round(yatirim).toLocaleString('tr-TR')} ₺; VIP eşiği ${ESIKLER.vipYatirim.toLocaleString('tr-TR')} ₺.`,
    });
  }

  // ── Risk. Tek etiket; "kârda" tek başına risk sayılmaz.
  if (hesapSayisi !== null && hesapSayisi > 1) {
    const kritik = kazanc !== null && kazanc >= ESIKLER.onemliKazanc;
    aday.push({
      id: kritik ? 'coklu-hesap-kritik' : 'coklu-hesap',
      etiket: kritik ? 'Çoklu hesap + yüksek kazanç' : 'Çoklu hesap',
      aile: 'risk', ton: kritik ? 'tehlike' : 'uyari', agirlik: kritik ? 100 : 70,
      aciklama: kritik
        ? `Aynı IP'de ${hesapSayisi} hesap ve ${Math.round(kazanc!).toLocaleString('tr-TR')} ₺ kazanç.`
        : `Aynı IP'de ${hesapSayisi} hesap görüldü.`,
    });
  }

  // ── Oyun deseni. Hacim eşiğin altındaysa oran anlam taşımaz.
  if (spor !== null && casino !== null && oyuncuOnde && kazanc !== null && kazanc >= ESIKLER.onemliKazanc) {
    const toplam = spor + casino;
    if (toplam >= ESIKLER.desenHacmi) {
      if (spor / toplam >= ESIKLER.desenPayi) {
        aday.push({
          id: 'surebet-suphesi', etiket: 'Surebet şüphesi', aile: 'desen', ton: 'tehlike', agirlik: 90,
          aciklama: `Hacmin %${Math.round((spor / toplam) * 100)}'i spor ve ${Math.round(kazanc).toLocaleString('tr-TR')} ₺ kazanç.`,
        });
      } else if (casino / toplam >= ESIKLER.desenPayi) {
        aday.push({
          id: 'casino-kazanc-serisi', etiket: 'Casino kazanç serisi', aile: 'desen', ton: 'uyari', agirlik: 65,
          aciklama: `Hacmin %${Math.round((casino / toplam) * 100)}'i casino ve ${Math.round(kazanc).toLocaleString('tr-TR')} ₺ kazanç.`,
        });
      }
    }
  }

  // ── Kasa. Sadece tutar önemliyse.
  if (kazanc !== null && kazanc >= ESIKLER.onemliKazanc) {
    aday.push({
      id: 'kasa-zararda', etiket: 'Kasa zararda', aile: 'kasa', ton: 'uyari', agirlik: 50,
      aciklama: `Oyuncu ${Math.round(kazanc).toLocaleString('tr-TR')} ₺ önde (eşik ${ESIKLER.onemliKazanc.toLocaleString('tr-TR')} ₺).`,
    });
  }

  // ── Çekim baskısı. Yatırım tabanının altında oran gürültüdür.
  if (yatirim !== null && cekim !== null && yatirim >= ESIKLER.cekimTabani && cekim > yatirim) {
    aday.push({
      id: 'cekim-yatirimi-asti', etiket: 'Çekim > yatırım', aile: 'cekim', ton: 'uyari', agirlik: 45,
      aciklama: `Çekim ${Math.round(cekim).toLocaleString('tr-TR')} ₺, yatırım ${Math.round(yatirim).toLocaleString('tr-TR')} ₺.`,
    });
  }

  /**
   * Telefon doğrulanmamış.
   *
   * Çekim ve bonus kararlarında doğrudan işe yarayan bir sinyal; ayrı
   * bir aile çünkü değer bandıyla ya da riskle yarışmamalı. Ölçülemedi
   * ise etiket ÜRETİLMEZ.
   */
  if (o.telefonDogrulandi === false) {
    aday.push({
      id: 'telefon-dogrulanmamis', etiket: 'Telefon doğrulanmamış', aile: 'dogrulama',
      ton: 'uyari', agirlik: 55,
      aciklama: 'Profilde telefon numarası onaylanmamış.',
    });
  }

  // ── Bonus. GEÇMİŞE bakar; anlık bakiyeye değil. Adet bilinmiyorsa susar.
  if (bonusAdedi === 0 && yatirim !== null && yatirim > 0) {
    aday.push({
      id: 'bonus-almamis', etiket: 'Bonus almamış', aile: 'bonus', ton: 'bilgi', agirlik: 30,
      aciklama: 'Yatırım yapmış ama bugüne kadar hiç bonus almamış.',
    });
  }

  // Her aileden en güçlüsü.
  const enGuclu = new Map<EtiketAilesi, Etiket>();
  for (const etiket of aday) {
    const mevcut = enGuclu.get(etiket.aile);
    if (!mevcut || etiket.agirlik > mevcut.agirlik) enGuclu.set(etiket.aile, etiket);
  }

  return [...enGuclu.values()].sort((a, b) => b.agirlik - a.agirlik);
}

export type Persona = {
  ad: string;
  aciklama: string;
};

/**
 * Oyuncu personası.
 *
 * Eski sürümde `DepositCount === 0 && DepositAmount === 0` "Yeni/Pasif"
 * demekti; alanlar gelmediğinde `undefined === 0` yanlış çıkıp sıradaki
 * dala düşüyor, oradan da eşiksiz "VIP Balina" gelebiliyordu. Burada
 * ölçü yoksa persona da "bilinmiyor" olur.
 */
export function oyuncuPersonasi(o: OyuncuOlculeri): Persona {
  const yatirim = sayi(o.yatirimTutari);
  const yatirimAdedi = sayi(o.yatirimAdedi);
  const kar = sayi(o.netKarZarar);
  const spor = sayi(o.sporHacmi) ?? 0;
  const kazanc = kar === null ? null : -kar;

  if (yatirim === null && yatirimAdedi === null) {
    return { ad: 'Profil çıkarılamadı', aciklama: 'Yatırım verisi gelmedi.' };
  }
  if (yatirimAdedi === 0 && (yatirim ?? 0) === 0) {
    return { ad: 'Yeni / pasif kayıt', aciklama: 'Hiç yatırım yok.' };
  }
  if (yatirim !== null && yatirim >= ESIKLER.vipYatirim) {
    return { ad: 'VIP', aciklama: `Toplam yatırım ${Math.round(yatirim).toLocaleString('tr-TR')} ₺.` };
  }
  if (kazanc !== null && kazanc >= ESIKLER.onemliKazanc && spor > 0) {
    return { ad: 'Profesyonel bahisçi şüphesi', aciklama: `Spor ağırlıklı ve ${Math.round(kazanc).toLocaleString('tr-TR')} ₺ önde.` };
  }
  if (yatirimAdedi !== null && yatirimAdedi > 20 && yatirim !== null && yatirim < 5_000) {
    return { ad: 'Mikro oyuncu', aciklama: `${yatirimAdedi} yatırım, toplam ${Math.round(yatirim).toLocaleString('tr-TR')} ₺.` };
  }
  return { ad: 'Standart oyuncu', aciklama: 'Eşiklerin hiçbirini geçmiyor.' };
}

/** Tercih edilen oyun kategorisi. Hacim yoksa "bilinmiyor". */
export function tercihEdilenKategori(o: OyuncuOlculeri): string | null {
  const spor = sayi(o.sporHacmi);
  const casino = sayi(o.casinoHacmi);
  if (spor === null || casino === null) return null;
  const toplam = spor + casino;
  if (toplam <= 0) return null;
  const casinoPayi = casino / toplam;
  if (casinoPayi > 0.6) return 'Canlı casino & slot';
  if (casinoPayi < 0.4) return 'Spor bahisleri';
  return 'Karma (spor & casino)';
}
