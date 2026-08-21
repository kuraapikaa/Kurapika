/**
 * BİR KİRACININ AYARLARINI BAŞKA BİR KİRACIYA KOPYALAMA.
 *
 * ── Neden gerekli ─────────────────────────────────────────────────────
 * Çok kiracılı çözümlemede istek, domain eşleşmesiyle bir siteye
 * bağlanıyor; eşleşme yoksa `default` kiracısına düşüyor. Bugün canlı
 * sitenin bütün ayarları (bonus kuralları, oyun ayarları, kampanya
 * görselleri, lobi tasarımı) `default` altında duruyor çünkü hiç site
 * kaydı yoktu.
 *
 * O siteyi Master panelinden EKLEDİĞİNİZ an domain eşleşmeye başlıyor ve
 * aynı istek artık `default` yerine yeni sitenin anahtarını okuyor.
 * Hiçbir şey silinmiyor — ama panel bomboş açılıyor, çünkü veri hâlâ
 * `default` altında. Dışarıdan bakınca "ayarlar uçtu" gibi görünüyor ve
 * bu, veritabanının silindiği kazayla birebir aynı hissi veriyor.
 *
 * Bu modül o boşluğu kapatıyor: veriyi eski anahtardan yenisine
 * kopyalar.
 *
 * ── Neden taşımak değil, KOPYALAMAK ───────────────────────────────────
 * Kaynak olduğu gibi kalır. Yeni site beklendiği gibi çalışmazsa siteyi
 * pasifleştirmek eski düzene dönmek için yeterli olur; geri alınacak bir
 * silme işlemi olmaz.
 *
 * ── Neden varsayılan olarak ÜZERİNE YAZMAZ ────────────────────────────
 * Hedefte zaten bir kayıt varsa atlanır. Bir operatörün yeni sitede
 * saatlerce ayar yapıp sonra "veriyi kopyala"ya basması ve emeğinin
 * sessizce silinmesi, kurtarmaya çalıştığımız hatanın aynısı olurdu.
 * Üzerine yazmak AÇIKÇA istenmeli.
 */

/** Kopyalanacak ayar alanları. Sıra, rapordaki sırayı belirler. */
export const KOPYALANACAK_ALANLAR: ReadonlyArray<{ namespace: string; ad: string }> = [
  { namespace: 'rules', ad: 'Bonus kuralları' },
  { namespace: 'promo-overrides', ad: 'Kampanya görünümleri' },
  { namespace: 'promotions-data', ad: 'Kampanya verisi' },
  { namespace: 'game-settings', ad: 'Oyun ayarları' },
  { namespace: 'lobby-design', ad: 'Lobi tasarımı' },
  { namespace: 'forms-settings', ad: 'Form ayarları' },
  { namespace: 'tournaments', ad: 'Turnuvalar' },
  { namespace: 'player-loyalty', ad: 'Sadakat sistemi' },
  { namespace: 'wheel-codes', ad: 'Çark kodları' },
  { namespace: 'vip-settings', ad: 'VIP ayarları' },
  { namespace: 'telegram-bonus', ad: 'Telegram bonusu' },
];

/**
 * OYUNCU VERİSİ KOPYALANMAZ.
 *
 * Form talepleri, bonus geçmişi ve denetim kayıtları o SİTENİN
 * oyuncularına ait. Yeni siteye kopyalamak, hiç var olmamış talepleri ve
 * hiç verilmemiş bonusları oraya taşırdı; mükerrer bonus korumaları da
 * yanlış geçmişe bakmaya başlardı.
 */
export const KOPYALANMAYAN_ALANLAR: ReadonlyArray<string> = [
  'forms-data',
  'nakit-bonus-defteri',
  'audit',
];

export type KopyaSatiri = {
  namespace: string;
  ad: string;
  /** 'kopyalandi' | 'kaynakBos' | 'hedefDolu' | 'hata' */
  durum: 'kopyalandi' | 'kaynakBos' | 'hedefDolu' | 'hata';
  mesaj?: string;
};

export type KopyaSonucu = {
  satirlar: KopyaSatiri[];
  kopyalanan: number;
  atlanan: number;
  hatali: number;
  /** Yalnızca sayım yapıldı, yazma YAPILMADI. */
  kuruGosterim: boolean;
};

export type BelgeOkuyucu = (tenantKey: string, namespace: string) => Promise<unknown>;
export type BelgeYazici = (tenantKey: string, namespace: string, payload: unknown) => Promise<void>;

export type KopyaSecenekleri = {
  kaynak: string;
  hedef: string;
  /** true ise hiçbir şey yazılmaz; ne olacağı raporlanır. */
  kuruGosterim?: boolean;
  /** true ise hedefteki mevcut kayıt EZİLİR. */
  uzerineYaz?: boolean;
};

export async function kiraciVerisiniKopyala(
  oku: BelgeOkuyucu,
  yaz: BelgeYazici,
  secenekler: KopyaSecenekleri,
): Promise<KopyaSonucu> {
  const kaynak = String(secenekler.kaynak ?? '').trim();
  const hedef = String(secenekler.hedef ?? '').trim();

  if (!kaynak || !hedef) throw new Error('Kaynak ve hedef kiracı gerekli.');
  // Kendi uzerine kopyalamak islevsiz ama zararsiz gorunur; yine de
  // engelleniyor cunku her zaman bir yanlis anlamanin belirtisi.
  if (kaynak === hedef) throw new Error('Kaynak ve hedef aynı olamaz.');

  const satirlar: KopyaSatiri[] = [];

  for (const alan of KOPYALANACAK_ALANLAR) {
    try {
      const kaynakVeri = await oku(kaynak, alan.namespace);
      if (kaynakVeri === undefined || kaynakVeri === null) {
        satirlar.push({ ...alan, durum: 'kaynakBos' });
        continue;
      }

      if (!secenekler.uzerineYaz) {
        const hedefVeri = await oku(hedef, alan.namespace);
        if (hedefVeri !== undefined && hedefVeri !== null) {
          satirlar.push({ ...alan, durum: 'hedefDolu' });
          continue;
        }
      }

      if (!secenekler.kuruGosterim) await yaz(hedef, alan.namespace, kaynakVeri);
      satirlar.push({ ...alan, durum: 'kopyalandi' });
    } catch (hata) {
      // TEK bir alanın hatası kalanları durdurmamalı; hangi alanın
      // kopyalanamadığı görünür kalsın.
      satirlar.push({
        ...alan,
        durum: 'hata',
        mesaj: hata instanceof Error ? hata.message : 'Kopyalanamadı',
      });
    }
  }

  return {
    satirlar,
    kopyalanan: satirlar.filter((s) => s.durum === 'kopyalandi').length,
    atlanan: satirlar.filter((s) => s.durum === 'kaynakBos' || s.durum === 'hedefDolu').length,
    hatali: satirlar.filter((s) => s.durum === 'hata').length,
    kuruGosterim: Boolean(secenekler.kuruGosterim),
  };
}
