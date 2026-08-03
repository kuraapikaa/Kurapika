/**
 * Kasanın iş günü.
 *
 * ── Bildirilen sorun ──────────────────────────────────────────────────
 *
 * "Dashboard hâlâ yanlış gösteriyor, bugün 11.000 yatırım ve 3.400 çekim
 * var." Lynon'un kendi yanıtı gerçekten 11.000/3.400 döndürüyordu; pano
 * ise BAŞKA BİR GÜNÜ soruyordu.
 *
 * Iki ayrı kaynak vardı:
 *
 *   1. `DateRangeContext` içindeki varsayılan aralık MODÜL YÜKLENİRKEN
 *      bir kez, TARAYICI yerel saatiyle hesaplanıyordu. Panel açık
 *      bırakılıp gece yarısı geçildiğinde "Bugün" rozeti yanıyor ama
 *      sorgu dünün tarihini taşımaya devam ediyordu. Operatör paneli
 *      günlerce açık tutuyor; bu, tarihi kilitleyen asıl hataydı.
 *
 *   2. Gün aritmetiği YEREL Date üzerinde yapılıp sonuç tekrar Istanbul
 *      dilimine çevriliyordu. Istanbul'un DOĞUSUNDAKİ bir tarayıcıda
 *      (UTC+4 ve sonrası) yerel gece yarısı hâlâ Istanbul'un bir önceki
 *      günü oluyor ve `toYMD(kasaGunu())` bir gün geri kayıyordu.
 *
 * ── Kural ─────────────────────────────────────────────────────────────
 *
 * Saat diliminden çıkış YALNIZCA bir yerde olur: `kasaGunKodu()`. Ondan
 * sonrası saf metin aritmetiğidir — "YYYY-MM-DD" üzerinde çalışır ve
 * tarayıcının saat diliminden tamamen bağımsızdır.
 *
 * Sunucu tarafı da aynı günü kullanıyor (`istanbulDateKey`, `gunBasi`,
 * `gunSonu`); iki taraf aynı takvimi konuşmazsa pano yine yalan söyler.
 */

/** Türkiye 2016'dan beri kalıcı UTC+3; yaz saati uygulaması yok. */
export const KASA_DILIMI = 'Europe/Istanbul';

/**
 * Verilen anın TÜRKİYE takvimindeki günü → "YYYY-MM-DD".
 *
 * Saat dilimi dönüşümünün yapıldığı TEK yer burasıdır. `en-CA` biçimi
 * zaten YYYY-MM-DD üretir, elle parçalamaya gerek yok.
 */
export function kasaGunKodu(an: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KASA_DILIMI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(an);
}

/** "YYYY-MM-DD" → UTC'ye sabitlenmiş Date. Aritmetik bunun üzerinde yapılır. */
function coz(ymd: string): Date {
  const [y, a, g] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, a - 1, g));
}

/** UTC'ye sabitlenmiş Date → "YYYY-MM-DD". Yerel saat hiç devreye girmez. */
function yaz(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Gün ekle / çıkar. Ay ve yıl taşmalarını Date halleder. */
export function gunEkle(ymd: string, gun: number): string {
  const d = coz(ymd);
  d.setUTCDate(d.getUTCDate() + gun);
  return yaz(d);
}

/** Haftanın pazartesisi. Pazar, ÖNCEKİ haftaya sayılır (TR takvimi). */
export function haftaBasi(ymd: string): string {
  const d = coz(ymd);
  const gun = d.getUTCDay(); // 0 = pazar
  return gunEkle(ymd, gun === 0 ? -6 : 1 - gun);
}

/** Ayın ilk günü. */
export function ayBasi(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** Ayın son günü. */
export function aySonu(ymd: string): string {
  const d = coz(ayBasi(ymd));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return yaz(d);
}

/** Bir önceki ayın ilk günü. */
export function oncekiAyBasi(ymd: string): string {
  const d = coz(ayBasi(ymd));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return yaz(d);
}
