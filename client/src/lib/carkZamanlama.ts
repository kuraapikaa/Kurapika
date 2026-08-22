/**
 * Çark tık seslerinin zamanlaması.
 *
 * Çark CSS ile `cubic-bezier(.12,.72,.12,1)` yumuşatmasıyla dönüyor:
 * hızlı başlayıp uzun uzun yavaşlıyor. Tıkları eşit aralıklarla çalmak
 * kolay ama yanlış olurdu -- ses, çarkın gördüğümüz hareketinden
 * kopar ve oyuncu ikisinin ayrı ayrı çalıştığını fark eder.
 *
 * Burada eğri sayısal olarak TERS çözülüyor: her dilim sınırının hangi
 * anda geçileceği bulunuyor. Tıklar böylece başta sık, sonda seyrek
 * geliyor -- gerçek bir çarkın sesi gibi.
 *
 * Saf fonksiyonlar: ses çalmadan test edilebilsinler diye ayrı duruyorlar.
 */

/** Çarkın CSS'teki yumuşatma eğrisi. Değiştirilirse ses de kayar. */
export const CARK_EGRISI: [number, number, number, number] = [0.12, 0.72, 0.12, 1];

/** Bir kübik bezier bileşeninin `t` parametresindeki değeri. */
function bezierDegeri(t: number, a1: number, a2: number): number {
  const ters = 1 - t;
  return 3 * ters * ters * t * a1 + 3 * ters * t * t * a2 + t * t * t;
}

/**
 * `cubic-bezier(x1,y1,x2,y2)` eğrisinde ilerlemeye karşılık gelen ZAMANI
 * verir (CSS'in her zamanki yönünün tersi).
 *
 * Eğri monoton olduğu için ikili arama yetiyor; Newton'a göre daha yavaş
 * ama sapmasız ve burada tüm hesap dönüş başına bir kez yapılıyor.
 */
export function ilerlemeIcinZaman(
  ilerleme: number,
  egri: [number, number, number, number] = CARK_EGRISI,
): number {
  const hedef = Math.min(1, Math.max(0, ilerleme));
  if (hedef === 0 || hedef === 1) return hedef;
  const [x1, y1, x2, y2] = egri;

  let alt = 0;
  let ust = 1;
  for (let adim = 0; adim < 40; adim += 1) {
    const t = (alt + ust) / 2;
    if (bezierDegeri(t, y1, y2) < hedef) alt = t;
    else ust = t;
  }
  return bezierDegeri((alt + ust) / 2, x1, x2);
}

/**
 * Dönüş boyunca ibrenin dilim sınırlarını geçtiği anlar (ms).
 *
 * `donusDerecesi` bu dönüşte katedilecek toplam açı, `sureMs` animasyon
 * süresi. Dönüş çok uzunsa (8 tur x 24 dilim = 192 tık) ses bulanık bir
 * uğultuya dönüştüğü için üst sınır uygulanıyor; kırpma SONDAN değil
 * BAŞTAN yapılıyor -- kulağın seyrekleşmeyi duyduğu yer dönüşün sonu.
 */
export function tikZamanlari(
  donusDerecesi: number,
  dilimSayisi: number,
  sureMs: number,
  enCokTik = 120,
): number[] {
  const derece = Math.abs(donusDerecesi);
  const dilim = Math.max(1, Math.floor(dilimSayisi));
  if (!Number.isFinite(derece) || derece <= 0 || !Number.isFinite(sureMs) || sureMs <= 0) return [];

  const dilimAcisi = 360 / dilim;
  const toplam = Math.floor(derece / dilimAcisi);
  const ilk = Math.max(1, toplam - enCokTik + 1);

  const zamanlar: number[] = [];
  for (let k = ilk; k <= toplam; k += 1) {
    zamanlar.push(ilerlemeIcinZaman((k * dilimAcisi) / derece) * sureMs);
  }
  return zamanlar;
}
