/**
 * Bonus kuralının iki yeni kapısı.
 *
 * `promoEvaluator` içindeki kontrollerin hepsi hesap anlık görüntüsüne
 * bağlı ve orada test edilmesi zor. Bu iki kapının KARARI saf: girdisi
 * birkaç sayı ve işlem satırı, çıktısı "uygun mu, değilse neden".
 * Kararın kendisi burada, hesabı okumak `promoEvaluator`da kalıyor.
 */

/** Çekim talebi ya da ödemesi sayılan işlem türleri. */
export const CEKIM_TURLERI = [
  'Çekim Talebi',
  'Withdrawal Request',
  'Çekim Talebi Ödemesi',
  'Çekim talebi Ödemesi',
  'Withdrawal Payment',
];

export type KapiSonucu = { ok: boolean; reason: string };

/**
 * İLK YATIRIMI KAYIPLA SONUÇLANAN OYUNCU.
 *
 * İki koşul birden: oyuncunun tek bir yatırımı olacak (yani bu onun ilk
 * yatırımı) VE o yatırımdan bu yana net kaybı olacak.
 *
 * İkisini AYRI kurallara bırakmak mümkündü (`isFirstDepositBonus` +
 * `lossBonus`) ama tek bir kapıya almanın sebebi var: operatör ikisinden
 * birini açmayı unuttuğunda ortaya sessizce BAŞKA bir kampanya çıkıyor --
 * yalnızca "ilk yatırım" açık kalırsa kazanan oyuncuya da iade veriliyor,
 * yalnızca "kayıp" açık kalırsa onuncu yatırımını kaybedene de. İkisi de
 * çalışan ama yanlış olan kampanyalar; hata mesajı vermezler.
 */
export function ilkYatirimKaybiKapisi(girdi: {
  /** Oyuncunun toplam yatırım adedi. */
  yatirimAdedi: number;
  /** Kural döneminde hesaplanmış net kayıp (TRY). */
  netKayip: number;
}): KapiSonucu {
  const adet = Math.max(0, Math.floor(Number(girdi?.yatirimAdedi) || 0));
  const kayip = Number(girdi?.netKayip) || 0;

  if (adet === 0) {
    return { ok: false, reason: 'RED: Henüz tamamlanmış bir yatırım yok.' };
  }
  if (adet > 1) {
    return { ok: false, reason: `RED: Bu kampanya yalnızca ilk yatırım için geçerli (yatırım adedi: ${adet}).` };
  }
  if (kayip <= 0) {
    return { ok: false, reason: 'RED: İlk yatırım kayıpla sonuçlanmamış.' };
  }
  return { ok: true, reason: `UYGUN: İlk yatırım kayıpla sonuçlandı (${kayip.toFixed(2)} TRY).` };
}

/**
 * GÜN İÇİNDE ÇEKİMİ OLANI REDDET.
 *
 * "Bekleyen çekim" kontrolünden (`checkPendingWithdrawal`) FARKLI:
 * o yalnızca hâlâ açık duran talebe bakıyor, bu ise bugün çekim talebi
 * açmış ya da çekimi ödenmiş oyuncuyu da kapsıyor. Ödenmiş bir çekim
 * "bekleyen" listesinden düştüğü için, sabah çekim alıp öğleden sonra
 * bonus isteyen oyuncu eski kontrolden geçiyordu.
 *
 * Gün sınırı İSTANBUL gününe göre; `gunAnahtari` dışarıdan veriliyor ve
 * çağıran taraf `istanbulDateKey` geçiyor. Sunucunun yerel saatine
 * bakmak, sunucu başka bir dilimde çalıştığında gece yarısı civarındaki
 * çekimleri yanlış güne yazardı -- bu depoda daha önce tam olarak bu
 * hata yaşanmış (bkz. `lib/istanbulGunu.ts`).
 */
export function bugunCekimKapisi(girdi: {
  islemler: Array<{ DocumentTypeName?: unknown; CreatedLocal?: unknown }>;
  /** İşlem tarihini ms'e çeviren çözümleyici (evaluator'ınkiyle aynı). */
  tariheCevir: (deger: unknown) => number;
  /** Bir anı "YYYY-MM-DD" gün anahtarına çeviren fonksiyon. */
  gunAnahtari: (an: Date) => string;
  /** Şimdi (test edilebilirlik için dışarıdan). */
  simdi: Date;
}): KapiSonucu & { adet: number } {
  const liste = Array.isArray(girdi?.islemler) ? girdi.islemler : [];
  const bugun = girdi.gunAnahtari(girdi.simdi);

  const bugunkuler = liste.filter((islem) => {
    const tur = String(islem?.DocumentTypeName ?? '').trim();
    if (!CEKIM_TURLERI.includes(tur)) return false;
    const zaman = girdi.tariheCevir(islem?.CreatedLocal);
    // Çözülemeyen tarih 0 dönüyor. Bunu "bugün" saymak her oyuncuyu
    // sebepsiz reddederdi; atlıyoruz.
    if (!Number.isFinite(zaman) || zaman <= 0) return false;
    return girdi.gunAnahtari(new Date(zaman)) === bugun;
  });

  const adet = bugunkuler.length;
  return adet === 0
    ? { ok: true, adet, reason: 'UYGUN: Bugün çekim işlemi yok.' }
    : { ok: false, adet, reason: `RED: Bugün ${adet} çekim işleminiz var.` };
}
