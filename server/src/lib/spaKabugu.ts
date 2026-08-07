/**
 * SPA KABUĞU HANGİ YOLLARA DÖNMELİ?
 *
 * Eskiden statik dosya olarak bulunamayan HER yola `index.html`
 * dönüyordu. Sızıntı değildi — dosyalar `client/dist` içinde yok ve
 * dönen şey her zaman kabuktu — ama sunucu `/.env`, `/.git/config`,
 * `/.npmrc`, `/.bash_history` gibi yollara **200** dönüyordu.
 *
 * Üretim logunda bunun sonucu görüldü: tarayıcılar bu yolları deniyor,
 * 200 alıyor ve "burada bir şey var" diye taramayı derinleştiriyor.
 * 404 dönmek bu döngüyü ilk adımda kesiyor.
 *
 * ── Neden uzantıya bakıyoruz ──
 *
 * Panel `HashRouter` kullanıyor: gerçek rotalar `/#/...` biçiminde ve
 * sunucuya hep `/` olarak geliyor. Yani teoride kabuk yalnızca kök
 * için gerekli. Ama bu üretimde çalışan bir panel ve bilmediğim bir
 * derin bağlantı olabilir; uzantısız yollara kabuk dönmeye devam
 * ediyoruz. Kesilen yalnızca tarayıcıların aradığı iki desen:
 *
 *   - nokta ile başlayan yollar (`/.env`, `/.git/config`)
 *   - uzantısı olup diskte bulunamayan dosyalar (`/x.json`, `/db.sql`)
 *
 * İkisi de bir uygulama rotası olamaz. Bu yüzden bu davranış değişikliği
 * mevcut hiçbir bağlantıyı kıramaz.
 */

/** Yolun son parçasında `ad.uzanti` kalıbı var mı? */
function uzantiliMi(sonParca: string): boolean {
  const nokta = sonParca.lastIndexOf('.');
  if (nokta <= 0 || nokta === sonParca.length - 1) return false;
  // Uzanti HARFLE BASLAMALI. Yalnizca "harf ya da rakam" demek, `/api-v1.2`
  // ve `/rapor.2026` gibi surum/yil iceren rotalari dosya sanmak olurdu ve
  // calisan bir baglanti 404 alirdi. Gercek uzantilar (json, sql, zip, env)
  // harfle basliyor; tarayicilarin aradigi da bunlar.
  return /^[a-zA-Z][a-zA-Z0-9]{0,7}$/.test(sonParca.slice(nokta + 1));
}

export function spaKabuguDonsunMu(pathname: string): boolean {
  const yol = String(pathname || '/').split('?')[0].split('#')[0];
  if (yol === '/' || yol === '') return true;

  const parcalar = yol.split('/').filter(Boolean);
  // Herhangi bir parca nokta ile basliyorsa gizli dosya araniyor demektir.
  if (parcalar.some((p) => p.startsWith('.'))) return false;

  const son = parcalar[parcalar.length - 1] ?? '';
  // Uzantili ve diske bulunamamis: gercek bir varlik istegi, rota degil.
  if (uzantiliMi(son)) return false;

  return true;
}
