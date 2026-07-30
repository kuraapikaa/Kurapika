/**
 * Churn (kayıp risk) skorlaması.
 *
 * NEDEN SUNUCUDA: önceki ChurnPrevention ekranı skorlamayı tarayıcıda
 * yapıyordu — önce oyuncu listesi, sonra HER OYUNCU İÇİN ayrı KPI isteği
 * (useQueries). 20 satır = 20 paralel istek; yavaş, rate limit'e açık ve
 * sayfa değişince baştan. Skor artık tek yerde, saf bir fonksiyonda.
 *
 * NEDEN SAF FONKSİYON: skorun ne ürettiği para ve müşteri ilişkisi kararlarını
 * etkiliyor. Ağ ve tarihten arındırılmış olması testte kilitlenebilmesini
 * sağlıyor — eşikler sessizce kayarsa test düşer.
 *
 * "AI" iddiası yok: bu, ağırlıklandırılmış kural tabanlı bir skor. Kaynak
 * veriler zaten elimizde ve davranışı açıklanabilir olmalı — operatör bir
 * oyuncunun neden riskli sayıldığını görebilmeli.
 */

export type ChurnGirdisi = {
  /** Son giriş (ISO veya parse edilebilir tarih). Yoksa hiç giriş yok sayılır. */
  lastLoginDate?: string | null;
  /** Kayıt tarihi; yeni oyuncu ile eski oyuncunun sessizliği aynı şey değil. */
  registrationDate?: string | null;
  totalDeposits?: number | null;
  totalWithdrawals?: number | null;
  balance?: number | null;
  /** Hesap kilitliyse churn değil, operasyonel durum. */
  isLocked?: boolean | null;
};

export type ChurnSebebi = { kod: string; aciklama: string; agirlik: number };

export type ChurnSonucu = {
  skor: number;                        // 0-100, yüksek = risk yüksek
  seviye: 'dusuk' | 'orta' | 'yuksek' | 'kritik';
  sessizGun: number | null;
  deger: number;                       // net yatırım (deposit - withdrawal)
  segment: 'vip' | 'yuksek' | 'orta' | 'dusuk' | 'yeni';
  sebepler: ChurnSebebi[];
  oneri: string;
};

/** Değer segmenti eşikleri (TRY, net yatırım). Tek yerde dursun. */
export const DEGER_ESIKLERI = { vip: 50000, yuksek: 10000, orta: 1000 } as const;
/** Sessizlik gün eşikleri. */
export const SESSIZLIK_ESIKLERI = { ilk: 7, orta: 14, gec: 30, kayip: 60 } as const;

function gunFarki(tarih: string | null | undefined, simdi: number): number | null {
  if (!tarih) return null;
  const t = Date.parse(String(tarih));
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((simdi - t) / 86_400_000));
}

function sayi(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function segmentBul(deger: number, hesapYasi: number | null): ChurnSonucu['segment'] {
  if (hesapYasi != null && hesapYasi <= 14 && deger < DEGER_ESIKLERI.orta) return 'yeni';
  if (deger >= DEGER_ESIKLERI.vip) return 'vip';
  if (deger >= DEGER_ESIKLERI.yuksek) return 'yuksek';
  if (deger >= DEGER_ESIKLERI.orta) return 'orta';
  return 'dusuk';
}

function seviyeBul(skor: number): ChurnSonucu['seviye'] {
  if (skor >= 75) return 'kritik';
  if (skor >= 50) return 'yuksek';
  if (skor >= 25) return 'orta';
  return 'dusuk';
}

function oneriUret(sonuc: Omit<ChurnSonucu, 'oneri'>): string {
  if (sonuc.seviye === 'dusuk') return 'Aksiyon gerekmiyor; normal iletişim akışında kalsın.';
  if (sonuc.segment === 'vip') return 'VIP temsilcisi bizzat arasın; standart kampanya yerine kişiye özel teklif.';
  if (sonuc.seviye === 'kritik') return 'Geri kazanım kampanyası: kayıp bonusu veya freespin ile temas kurun.';
  if (sonuc.segment === 'yeni') return 'Onboarding hatırlatması gönderin; ilk deneyim tamamlanmamış olabilir.';
  return 'Hatırlatma mesajı ve güncel kampanya bildirimi gönderin.';
}

export function churnSkoru(girdi: ChurnGirdisi, simdi: number = Date.now()): ChurnSonucu {
  const sessizGun = gunFarki(girdi.lastLoginDate, simdi);
  const hesapYasi = gunFarki(girdi.registrationDate, simdi);
  const deger = sayi(girdi.totalDeposits) - sayi(girdi.totalWithdrawals);
  const segment = segmentBul(deger, hesapYasi);
  const sebepler: ChurnSebebi[] = [];

  // Kilitli hesap churn değil; operasyon kararı. Skorlamadan çıkarıyoruz ki
  // geri kazanım listeleri kilitli hesaplarla dolmasın.
  if (girdi.isLocked === true) {
    const temel = { skor: 0, seviye: 'dusuk' as const, sessizGun, deger, segment, sebepler: [
      { kod: 'kilitli', aciklama: 'Hesap kilitli — churn değil, operasyonel durum', agirlik: 0 },
    ] };
    return { ...temel, oneri: 'Hesap kilitli; geri kazanım listesine alınmamalı.' };
  }

  // 1) Sessizlik — ana etken.
  if (sessizGun == null) {
    sebepler.push({ kod: 'giris-yok', aciklama: 'Hiç giriş kaydı yok', agirlik: 35 });
  } else if (sessizGun >= SESSIZLIK_ESIKLERI.kayip) {
    sebepler.push({ kod: 'sessizlik-60', aciklama: `${sessizGun} gündür giriş yok`, agirlik: 55 });
  } else if (sessizGun >= SESSIZLIK_ESIKLERI.gec) {
    sebepler.push({ kod: 'sessizlik-30', aciklama: `${sessizGun} gündür giriş yok`, agirlik: 40 });
  } else if (sessizGun >= SESSIZLIK_ESIKLERI.orta) {
    sebepler.push({ kod: 'sessizlik-14', aciklama: `${sessizGun} gündür giriş yok`, agirlik: 25 });
  } else if (sessizGun >= SESSIZLIK_ESIKLERI.ilk) {
    sebepler.push({ kod: 'sessizlik-7', aciklama: `${sessizGun} gündür giriş yok`, agirlik: 12 });
  }

  // 2) Değerli oyuncunun sessizliği daha maliyetli — aynı gün sayısı daha
  //    yüksek risk demek, çünkü kaybedilen gelir büyük.
  if (sessizGun != null && sessizGun >= SESSIZLIK_ESIKLERI.ilk) {
    if (segment === 'vip') sebepler.push({ kod: 'vip-sessiz', aciklama: 'VIP segmentte sessizlik', agirlik: 25 });
    else if (segment === 'yuksek') sebepler.push({ kod: 'yuksek-sessiz', aciklama: 'Yüksek değerli oyuncuda sessizlik', agirlik: 15 });
  }

  // 3) Bakiyesini boşaltıp gitmiş: ayrılma niyetinin en güçlü sinyali.
  if (sayi(girdi.balance) <= 0 && sayi(girdi.totalWithdrawals) > 0) {
    sebepler.push({ kod: 'bakiye-bos', aciklama: 'Bakiye sıfır ve çekim yapılmış', agirlik: 15 });
  }

  // 4) Net çıkış: çektiği yatırdığından fazla. Kâr etmiş oyuncunun dönmeme
  //    olasılığı daha yüksek.
  if (deger < 0) {
    sebepler.push({ kod: 'net-cikis', aciklama: 'Çekim toplamı yatırımı aşıyor', agirlik: 10 });
  }

  // 5) Yeni oyuncu erken sessizleşmiş: onboarding tamamlanmamış.
  if (hesapYasi != null && hesapYasi <= 30 && sessizGun != null && sessizGun >= SESSIZLIK_ESIKLERI.ilk) {
    sebepler.push({ kod: 'onboarding', aciklama: 'Yeni hesap erken sessizleşti', agirlik: 12 });
  }

  const skor = Math.max(0, Math.min(100, sebepler.reduce((t, s) => t + s.agirlik, 0)));
  const temel = { skor, seviye: seviyeBul(skor), sessizGun, deger, segment, sebepler };
  return { ...temel, oneri: oneriUret(temel) };
}

/** Liste skorlaması: en riskli ve en değerli önce. */
export function churnListesi<T extends ChurnGirdisi>(
  oyuncular: T[],
  simdi: number = Date.now(),
): Array<T & { churn: ChurnSonucu }> {
  return (oyuncular ?? [])
    .map((o) => ({ ...o, churn: churnSkoru(o, simdi) }))
    .sort((a, b) => b.churn.skor - a.churn.skor || b.churn.deger - a.churn.deger);
}
