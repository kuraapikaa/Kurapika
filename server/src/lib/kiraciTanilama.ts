/**
 * KİRACI ÇÖZÜMLEMESİ NEDEN SESSİZCE ÇÖKÜYOR?
 *
 * ── Bildirilen vaka ───────────────────────────────────────────────────
 *
 * "Bonus kuralları tenant başına olacak."
 *
 * Kurallar ZATEN kiracı başına saklanıyor: `app_documents` içinde
 * `(tenant_key, 'bonus-rules')` anahtarıyla, ve her çağrı bir tenantKey
 * taşıyor. Sorun depolamada değil ÇÖZÜMLEMEDE:
 *
 *   `tenants` kaydı yoksa  ->  Host hiçbir kayda eşleşmez
 *                          ->  `resolveTenantKeyFromHost` YEDEĞE düşer
 *                          ->  bütün siteler `default`'a çöker
 *                          ->  hepsi aynı kuralları paylaşır
 *
 * Üretimde tam olarak bu oldu: veritabanı silindiğinde `tenants` kayıtları
 * gitti (depoda tohumu yok) ve yeniden girilmedi. `/api/tenant-info`
 * "Tenant not found" diyor ama kural okuma yolu hiçbir uyarı vermiyor —
 * sessizce doğru görünen yanlış cevabı veriyor.
 *
 * ── Bu modül ──────────────────────────────────────────────────────────
 *
 * Çöküşü GÖRÜNÜR kılar. Kural motoruna dokunmaz; yalnızca "bu istek
 * gerçek bir kiracıya mı çözüldü, yoksa yedeğe mi düştü" sorusunu
 * cevaplar. Sağlık ucu bunu yayınlar, böylece aynı arıza bir dahaki sefer
 * kullanıcı şikayetiyle değil izlemeyle yakalanır.
 */

export type KiraciTanilama = {
  /** Tanımlı site sayısı. 0 ise çok kiracılılık fiilen KAPALIDIR. */
  siteSayisi: number;
  /** Aktif (isActive !== false) site sayısı. */
  aktifSite: number;
  /** Yedek anahtar — hiçbir Host eşleşmediğinde kullanılan. */
  yedekAnahtar: string;
  /**
   * Uyarı metni; sorun yoksa null. Sağlık çıktısında görünür olması
   * yeterli — sessiz kalmasındansa gürültü yapması iyidir.
   */
  uyari: string | null;
};

export function kiraciTanilamasi(
  tenants: Array<{ id?: string; domain?: string; isActive?: boolean }> | null | undefined,
  yedekAnahtar: string,
): KiraciTanilama {
  const liste = Array.isArray(tenants) ? tenants : [];
  const aktif = liste.filter((t) => t?.id && t.isActive !== false);
  const alanAdiOlan = aktif.filter((t) => String(t?.domain ?? '').trim() !== '');

  let uyari: string | null = null;
  if (liste.length === 0) {
    uyari = `Tanımlı site YOK; her istek "${yedekAnahtar}" kiracısına düşüyor. `
      + 'Bonus kuralları, oyun ayarları ve kimlikler siteler arasında PAYLAŞILIYOR. '
      + 'Master panelinden siteleri yeniden ekleyin.';
  } else if (aktif.length === 0) {
    uyari = `${liste.length} site tanımlı ama hiçbiri aktif değil; her istek "${yedekAnahtar}" kiracısına düşüyor.`;
  } else if (alanAdiOlan.length === 0) {
    // Alan adı olmayan kayıt Host ile eşleşemez; oturumdan gelmedikçe
    // yine yedeğe düşülür.
    uyari = `${aktif.length} aktif sitenin hiçbirinde alan adı tanımlı değil; `
      + 'Host eşleşmesi çalışmaz ve istekler yedek kiracıya düşer.';
  }

  return {
    siteSayisi: liste.length,
    aktifSite: aktif.length,
    yedekAnahtar,
    uyari,
  };
}
