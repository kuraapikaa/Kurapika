# Lynon entegrasyonu

KuroAffiliate'in Lynon backoffice ile konuştuğu **dört** yer var. Hepsi
birbirinden bağımsız çalışır; hangisini kurarsan o kadarı çalışır.

| # | Yön | Ne | Zorunlu mu |
|---|---|---|---|
| A | Panel → Lynon | Günlük ölçüm çekme (rapor) | Hakediş için **evet** |
| B | Panel → Oyuncu | İzleme linki (`/c/...`) | Atıf için **evet** |
| C | Site → Panel | Oyuncu kayıt bildirimi | Oyuncu–ortak eşleşmesi için |
| D | Lynon → Panel | Olay webhook'u | Gün içi görünürlük için |

Akış:

```
ortak linki paylaşır
   │
   ├─ B ─► /c/ORT1/banner-id?sub1=facebook
   │        302 → site.com/kayit?btag=ORT1&mid=...&clickid=...
   │
   ├─ C ─► oyuncu kaydolur, site panele bildirir
   │        POST /api/kayit/oyuncu  { lynonOyuncuId, ref: clickid }
   │        └─ oyuncu artık bir ortağa bağlı (İLK KAYIT KAZANIR)
   │
   ├─ D ─► Lynon olay gönderir (deposit / bet / win / withdrawal)
   │        POST /api/webhooks/lynon  (HMAC imzalı)
   │        └─ oyuncu bazlı günlük toplamlar
   │
   └─ A ─► panel her gün Lynon raporunu çeker
            └─ ortak bazlı GGR → komisyon → hakediş
```

**A ile D neden ikisi birden var:** rapor (A) gün sonunda kesinleşen
**otoriter** kaynak; webhook (D) gün içi akış. İkisi ayrı tablolarda
tutuluyor, çünkü aynı yere yazsalardı gün içi rakam gün sonu raporuyla
çelişir ve hangisinin doğru olduğu belirsizleşirdi. Hakediş **A**'dan
hesaplanır.

---

## Adres ve kiracı

Tüm uçların kökü:

```
https://affiliate.narcosbahis.vip
```

Panel çok kiracılı. Kiracı sırayla şuradan çözülür: `AFF_SABIT_KIRACI`
ortam değişkeni → oturum → `x-kiraci` başlığı → alt alan adı.

> **Tek marka kurulumunda `AFF_SABIT_KIRACI` ayarlanmış olmalı.**
> Ayarlı değilse `affiliate.` ve `ortak.` adresleri **ayrı kiracı**
> sayılır ve veriler ayrışır. Bkz. PR #103.

Sunucudan sunucuya çağrılarda alan adı yerine `x-kiraci` başlığını da
kullanabilirsin.

---

## A — Backoffice bağlantısı (ölçüm çekme)

Panelden: **Backoffice bağlantısı** ekranı. Adaptör: `lynon`.

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `backofficeUrl` | evet | `https://backoffice.ornek.com` |
| `idUrl` | evet | Kimlik sunucusu, `https://id.ornek.com` |
| `siteId` | evet | `sl-id` başlığında gönderilen site kimliği |
| `kullanici` | evet | Panel kullanıcı adı |
| `parola` | evet | Panel parolası (şifreli saklanır) |
| `totpSecret` | hayır | Hesapta 2FA açıksa **zorunlu**. Base32 ya da `otpauth://` |
| `paraBirimi` | hayır | Varsayılan `TRY` |
| `raporId` | hayır | Oyuncu raporu kimliği, varsayılan `1841` |
| `odemeRaporId` | hayır | Ödeme/entegrasyon raporu, varsayılan `1842` |
| `slTimezone` | hayır | Türkiye için `-3` |

**Rapor kimlikleri siteye özeldir.** Backoffice > Raporlar adresinden
okunur; yanlış kimlik boş ölçüm demektir.

**`slTimezone` yanlışsa gün 3 saat kayar** — bir günün cirosu komşu güne
yazılır ve hakediş dönemleri tutmaz.

Adaptörün yetenekleri: `olcum-cekme`, `ortak-listesi`, `oyuncu-baglama`,
`odeme-yontemleri`.

### İlk yatırım (FTD) hakkında

Lynon toplam düzeyinde rapor verdiğinde ilk yatırım sayısı gelmez.
Panel bunu oyuncu bazlı satırlardan **türetir** ve türetemediğinde
`null` bırakır — sıfır yazmaz. Sıfır yazmak "hiç ilk yatırım getirmedi"
demek olurdu; CPA'lı planlarda bu doğrudan paraya dokunur.

Geçmişe dönük ilk senkronda defter boş olduğu için herkes "ilk kez
yatırım yapmış" görünür. Panel bu turu **kalibrasyon** sayar: deftere
yazar ama sayıyı raporlamaz.

---

## B — İzleme linkleri

Ortak panelden kendi linkini alır. Biçim:

```
https://affiliate.narcosbahis.vip/c/<ortakAnahtari>
https://affiliate.narcosbahis.vip/c/<ortakAnahtari>/<medyaId>
```

İsteğe bağlı alt kanal parametreleri: `sub1` … `sub5`.

Panel tıklamayı kaydeder ve **302** ile medyanın hedef adresine
yönlendirir. Hedef adrese şunlar eklenir:

| Parametre | Anlamı |
|---|---|
| `btag` | Ortak anahtarı — Lynon'un yakalayacağı izleme anahtarı |
| `mid` | Medya kimliği (varsa) |
| `sub1`…`sub5` | Ortağın kendi kanal etiketleri |
| `clickid` | Bu tıklamanın kimliği |

`clickid` **hedef adrese sorgu parametresi olarak** taşınır, çerezle
değil: oyuncu bizim alan adımızdan çıkıp kumar sitesine gidiyor ve
bizim çerezimiz orada okunamaz.

> Site tarafında yapılması gereken: `btag` ve `clickid` değerlerini
> kayıt formuna kadar taşımak (session ya da hidden field). `btag`
> Lynon'a gönderilir, `clickid` ise **C** adımında panele bildirilir.

Panel `btag`, `bTag`, `BTag` ve `ref` yazımlarının hepsini okur.

### Kısa alt linkler

Ortak, panelden kendine kısa kodlu alt linkler üretebilir:

```
https://affiliate.narcosbahis.vip/l/<kod>
```

Bunlar medyayı ve alt kanal etiketlerini kayıtlı taşır; davranış
`/c/...` ile aynıdır (tıklama kaydı, 302, `clickid`). Sorgu ile gelen
değerler, linkte kayıtlı olanlarla birleşir — kayıtlı olan kazanır.

**Onaysız ortak trafik akıtamaz:** bilinmeyen ya da onaylanmamış bir
anahtara gelen tıklama 404 alır ve kaydedilmez. Onaysız ortağa trafik
akıtmak, sonradan "bu trafiğin ödemesini yapmıyoruz" demeyi imkânsız
kılardı.

---

## C — Oyuncu kayıt bildirimi (site → panel)

> PR #101 ile geliyor.

Oyuncu Lynon'a kaydolduktan sonra site, oyuncu kimliğini panele
bildirir ve oyuncu–ortak eşleşmesi kurulur. **Hakedişin dayanağı bu
bağdır.**

```http
POST /api/kayit/oyuncu
Authorization: Bearer <s2s-anahtari>
Content-Type: application/json

{ "lynonOyuncuId": "123456", "ref": "<clickid ya da ortakAnahtari>" }
```

Anahtar: panelden **Oyuncu eşleşmeleri** ekranında üretilir ve **bir
kez** gösterilir (saklanmıyor, özeti tutuluyor).

`ref` olarak **`clickid` göndermek tercih edilir**: hangi medya ve alt
kanaldan gelindiği yalnızca onda var. Ortak anahtarı da kabul edilir
ama kanal kırılımı olmadan.

### Yanıt

Her zaman **200**; ne olduğu `durum` alanında:

| `durum` | Anlamı | Ne yapmalı |
|---|---|---|
| `olusturuldu` | Yeni eşleşme kuruldu | — |
| `zaten-ayni-ortak` | Aynı ortak tekrar bildirdi | Normal; yeniden deneme |
| `baska-ortaga-ait` | Oyuncu **başka** ortağa ait, reddedildi | Normal; ilk kayıt kazanır |

```json
{
  "durum": "olusturuldu",
  "eslesme": {
    "lynonOyuncuId": "123456",
    "ortakId": "…",
    "ortakAnahtari": "ORT1",
    "clickId": "…",
    "medyaId": "…",
    "olusturuldu": "2026-08-09T12:00:00.000Z"
  }
}
```

**İLK KAYIT KAZANIR.** Bir oyuncu zaten bir ortağa aitse sonradan gelen
bildirim onu **devralamaz**. Bu kural veritabanı kısıtında yaşıyor,
uygulama kodunda değil — yani iki bildirim aynı anda gelse bile
delinemez.

Hata kodları: `400` (eksik/geçersiz alan), `401` (anahtar yok/yanlış),
`403` (ortak onaylı değil), `404` (ref karşılığı ortak yok).

---

## D — Olay webhook'u (Lynon → panel)

> PR #102 ile geliyor.

```http
POST /api/webhooks/lynon
Content-Type: application/json
x-lynon-zaman: 1786310400
x-lynon-imza: sha256=<hmac-sha256-hex>

{ "eventType": "deposit", "playerId": "123456", "amount": 1000 }
```

`eventType`: `deposit` | `withdrawal` | `bet` | `win`.
`amount` sayı ya da sayıya çevrilebilir metin olabilir.

### İmza

```
imzalanan_metin = "<x-lynon-zaman>" + "." + <ham gövde>
imza            = HMAC_SHA256(paylaşılan_sır, imzalanan_metin)  → hex
```

Üç kural:

1. **Ham gövde imzalanır.** JSON'u çözüp yeniden dizmek anahtar
   sırasını ve boşlukları değiştirir; imza tutmaz.
2. **Zaman damgası imzalı metnin içindedir.** Yalnızca gövde
   imzalansaydı, bir kez yakalanan geçerli istek sonsuza kadar tekrar
   gönderilebilirdi.
3. **Pencere 5 dakika.** Daha eski ya da 5 dakikadan ileri tarihli
   istekler reddedilir (saat kayması iki yönlü).

`sha256=` öneki isteğe bağlı; öneksiz hex de kabul edilir.

Paylaşılan sır panelden yönetilir. Lynon size bir sır veriyorsa onu
kaydedersiniz; vermiyorsa panel üretir ve **bir kez** gösterir. Sır
şifreli saklanır (AES-256-GCM) çünkü HMAC hesaplamak için asıl değere
ihtiyaç var.

### Yanıt

| Kod | Anlamı |
|---|---|
| `200` | Alındı. `{"durum":"alindi","yeni":true\|false}` |
| `400` | Gövde geçersiz JSON, `eventType` bilinmiyor ya da `playerId` boş |
| `401` | İmza doğrulanamadı (sebep verilmez) |

`yeni: false` → aynı imzalı istek daha önce alınmış. **Tekrar gönderim
güvenlidir**, olay iki kez işlenmez.

Uç **hemen** yanıt verir (ölçülen ortalama ~3,5 ms): olay kalıcı
kuyruğa yazılır, işleme ayrı yürür. Kuyruğa yazma beklenir — aksi hâlde
süreç yazmadan ölse Lynon 200 aldığı için tekrar göndermez ve olay
kaybolurdu.

### İmza örneği

**Node.js**

```js
import { createHmac } from 'crypto';

const govde = JSON.stringify({ eventType: 'deposit', playerId: '123456', amount: 1000 });
const zaman = Math.floor(Date.now() / 1000);
const imza = createHmac('sha256', SIR).update(`${zaman}.${govde}`).digest('hex');

await fetch('https://affiliate.narcosbahis.vip/api/webhooks/lynon', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-lynon-zaman': String(zaman),
    'x-lynon-imza': `sha256=${imza}`,
  },
  body: govde, // İMZALANAN metnin AYNISI gönderilmeli
});
```

> `body` olarak imzaladığın **aynı** metni gönder. Nesneyi tekrar
> `JSON.stringify`'dan geçirmek imzayı bozabilir.

**PHP**

```php
$govde = json_encode(['eventType' => 'deposit', 'playerId' => '123456', 'amount' => 1000]);
$zaman = time();
$imza  = hash_hmac('sha256', $zaman . '.' . $govde, $SIR);
```

---

## Kurulum sırası

1. **Backoffice bağlantısı** (A) — panelden gir, "Bağlantıyı sına".
2. **Ortakları oluştur ve onayla.** Onaysız ortak link üretemez, trafik
   akıtamaz, oyuncu eşleşemez.
3. **Medya ekle** — izleme linkleri medyanın hedef adresini kullanır.
4. **S2S anahtarı üret** (C) ve siteye ver.
5. **Webhook sırrını kur** (D) ve Lynon'a ver.
6. Bir uçtan uca deneme yap: link → tıklama → kayıt bildirimi → olay.

## Sorun giderme

| Belirti | Muhtemel sebep |
|---|---|
| Tıklama 404 | Ortak onaysız, medya pasif ya da medya o ortağa kapalı |
| Webhook 401 | Sır yanlış, saatler kaymış (>5 dk) ya da gövde yeniden dizilmiş |
| Kayıt 404 | `ref` bilinmiyor — `clickid` süresi geçmiş ya da ortak anahtarı yanlış |
| Ölçüm boş | `raporId` yanlış ya da `slTimezone` kaymış |
| Ortak portalde hesap bulunamıyor | `AFF_SABIT_KIRACI` ayarlı değil (PR #103) |
| İlk yatırım `null` | Backoffice toplam düzeyinde raporluyor ya da kalibrasyon turu |

Panelde **İzleme anahtarları** ekranı "sahipsiz anahtar" listesi
gösterir: backoffice'ten ölçüm geliyor ama o anahtara sahip bir ortak
kaydı yok. Bu, hiçbir ortağa atfedilmeyen ve kimseye ödenmeyen gelirdir.
