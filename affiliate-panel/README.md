# Affiliate Paneli

Lynon'a ve diğer backoffice'lere **üçüncü taraf** olarak bağlanan,
BugsPanel'den **bağımsız** çalışan affiliate paneli. Kendi sunucusu,
kendi arayüzü, kendi veri deposu var; bu depoda ayrı bir uygulama
olarak duruyor.

```
affiliate-panel/
  backend/   Fastify + TypeScript
  frontend/  React + Vite + Tailwind
  docs/      Entegrasyon dokümanları
  Dockerfile İkisini tek imajda birleştirir
```

**Lynon'a bağlanacaksan:** [docs/lynon-entegrasyon.md](docs/lynon-entegrasyon.md)
— dört entegrasyon noktası (rapor çekme, izleme linkleri, kayıt
bildirimi, olay webhook'u), imza hesabı, kurulum sırası ve sorun
giderme tablosu.

## Mimarideki tek asıl karar: adaptör sınırı

Panelin hiçbir servisi, hiçbir ekranı ve hiçbir komisyon hesabı Lynon'un
alan adlarını bilmiyor. Dışarının şekli **tek bir yerde** içerinin
modeline çevriliyor: `src/adaptorler/tur.ts`.

Yeni bir backoffice eklemek, o arayüzü uygulayan bir dosya yazmaktan
ibaret — çekirdek, depo, komisyon ve arayüzün hiçbiri değişmiyor.

Karşı seçenek Lynon'un şemasını içeride kullanmaktı: kısa vadede daha az
kod, uzun vadede kilitlenme. Bir affiliate paneli tanımı gereği birden
çok markaya bakar; tek sağlayıcıya gömmek baştan yanlış olurdu.

Bugün iki adaptör var:

| Adaptör | Ne yapar | Sınırı |
|---|---|---|
| `lynon` | Panel kullanıcısıyla giriş yapıp raporları okur. Lynon third-party affiliate kaydı **gerekmez**. | Veri toplam düzeyinde geldiği için ilk yatırım (FTD) sayısı ölçülemez. |
| `genel-rest` | Tarih aralığı verilince JSON satır listesi dönen herhangi bir API. Alan adları panelden eşlenir, kod yazmak gerekmez. | Çok adımlı giriş, imzalı istek, sayfalama ve GraphQL desteklemiyor. |

## Ölçülemeyen veriyi uydurmuyoruz

`ftdSayisi` alanı `null` olabiliyor ve bu **"sıfır" ile aynı şey değil**:

- `0` → o gün gerçekten ilk yatırım olmadı
- `null` → bu bağlantı bu bilgiyi vermiyor

CPA planlarında ikinci durumda komisyon bileşeni sıfır yazılmıyor,
**hesaplanamadı** olarak işaretleniyor ve panelde sebebiyle gösteriliyor.
Sıfır yazmak ortağa "hiç ilk yatırım getirmedin" demek olurdu; bu bir
ödeme anlaşmazlığına dönüşür.

## Komisyon ve hakediş

Üç model: **gelir payı** (RevShare), **CPA**, **hibrit**.

Hesap sırası bilinçli — önce işletme payı düşülüyor, sonra devreden zarar
uygulanıyor, en sonda ortağın yüzdesi. Zararı yüzdeden sonra uygulamak,
geçen ayın zararını ortağın payından değil brütten silmek olurdu ve
zararın tamamı ortağa yüklenirdi.

İki devir **ayrı tutuluyor** ve karıştırmak sessiz bir hata üretir:

- **Devreden zarar** gelir tabanına giriyor ve yüzdeyle çarpılıyor
- **Devreden ödeme** (asgarinin altında kalan) zaten hesaplanmış bir
  ödeme; tekrar yüzdeye tabi tutulmamalı

Dönemler **dondurulabiliyor**: taslak her açılışta yeniden hesaplanıyor
(ölçümler gün içinde değişiyor), onaylandıktan sonra sabitleniyor. Devir
zinciri yalnızca onaylanmış dönemlerden okunuyor — aksi halde altı ay
önceki bir ölçüm düzeltmesi bütün geçmiş ödemeleri değiştirirdi.

## İki kapı

**Yönetici** ortakları, planları, medyayı, kademeleri ve hakedişi
yönetiyor. **Ortak** kendi portalinden kendi rakamlarını, izleme
linklerini ve hakedişini görüyor.

Portal uçlarının hiçbiri sorgudan ya da gövdeden ortak anahtarı kabul
etmiyor; hepsi oturumdaki anahtara kilitli. Kabul etseydi bir ortak,
başkasının anahtarını yazarak onun hakedişini okuyabilirdi.

Ortak durumu dört değerli. Başvurusu alınmış ama onaylanmamış bir ortak
giriş **yapabiliyor** (durumunu görsün) ama izleme linki
**üretemiyor** — üretebilseydi onaylanmadan trafik göndermeye başlar ve
o trafiğin hakedişini reddetmek imkânsız olurdu.

## Kurulum

```bash
cd affiliate-panel/backend && npm install
cd ../frontend && npm install
```

`backend/.env` dosyasını `backend/.env.example` üzerinden doldurun.
Yönetici parolasının özetini üretmek için:

```bash
npm --prefix affiliate-panel/backend run ozet -- "en az 10 karakterli parola"
```

Geliştirme (iki terminal):

```bash
npm --prefix affiliate-panel/backend run dev
```

```bash
npm --prefix affiliate-panel/frontend run dev
```

Arayüz `5175`, sunucu `4100`. Vite `/api` ve `/c` isteklerini sunucuya
vekilliyor.

## Railway'e dağıtım

Aynı projede **ayrı bir servis** olarak. Ayrı proje değil: Railway referans
değişkenleri (`${{Postgres.DATABASE_URL}}`) yalnızca proje içinde çözülüyor,
ayrı projede düz bağlantı dizesi yapıştırmak zorunda kalırsınız ve o değer
parola döndüğünde sessizce bayatlar.

Servis ayarlarında **tek** kritik alan var:

> **Root Directory = `affiliate-panel`**

Bu tek ayar iki şeyi birden doğru yapıyor: Railway `affiliate-panel/railway.json`
dosyasını buluyor, ve Docker build bağlamı `affiliate-panel/` oluyor —
`Dockerfile`'daki `COPY frontend/…` satırlarının varsaydığı bağlam bu.

Root Directory'yi boş bırakıp `dockerfilePath`'e `affiliate-panel/Dockerfile`
yazmak **çalışmaz**: o durumda build bağlamı depo kökü olur ve
`COPY frontend/package*.json` diye bir yol bulunamaz.

Veritabanı BugsPanel ile aynı Postgres örneğini paylaşabilir; tablolar `aff_`
önekli (`aff_belgeler`), `app_documents`/`audit_events` ile çakışmıyor. Bedeli:
tek bir Postgres kesintisi ikisini birden düşürür.

## Güvenlikte bilerek verilen kararlar

- **Sırlar şifreli.** `AFF_SECRET_KEY` yoksa bağlantı **kaydedilmiyor**.
  Sessizce düz metne düşmek en kötü seçenek: kurulum çalışıyor görünür,
  sır düz yazılır ve kimse fark etmez.
- **Postback SSRF'e kapalı.** Adresi ortak yazıyor, isteği bizim
  sunucumuz atıyor. Yalnızca https; alan adı çözümlenip dönen **her**
  IP kontrol ediliyor (tek bir iç IP yeter, bu klasik bir atlatma);
  yönlendirme izlenmiyor.
- **Tıklama ucu açık yönlendirmeye kapalı.** Hedef adres yalnızca
  sunucudaki medya kaydından okunuyor, istekten asla.
- **Kiracı oturumdan geliyor**, `x-kiraci` başlığı bunu ezemiyor.
  Ezebilseydi geçerli bir oturuma sahip biri başka kiracının verisine
  erişirdi.
- **Parola özeti hiçbir uçtan dönmüyor.** Bunu bir rota testi koruyor
  (`src/rotalar/yonetim.test.ts`) — servis doğru davranıp rotanın yanlış
  olduğu bir hata gerçekten yaşandı.

## Testler

```bash
npm --prefix affiliate-panel/backend test
```

98 test. Ağırlık, hatası **geriye dönük düzeltilemeyen** yerlerde:
komisyon hesabı, izleme linki kaçışı, SSRF kapısı, oturum imzası ve
deponun oku–değiştir–yaz kilidi.

## BugsPanel ile ilişkisi

Yok. Aynı depoda duruyorlar ama ortak kod, ortak veritabanı, ortak
oturum ve ortak dağıtım paylaşmıyorlar. `server/src/services/affiliateCrm/`
altındaki protokolden bağımsız servisler buraya taşındı; BugsPanel'deki
affiliate merkezi yerinde duruyor ve yenisi üretimde doğrulanana kadar
kaldırılmamalı.

Kasıtlı bir sapma: BugsPanel kiracıyı `AsyncLocalStorage` ile taşıyor,
çünkü orada anahtarı isteyen ~100 senkron çağrı noktası var. Burada öyle
bir miras yok — her servis `kiraci` parametresini açıkça alıyor ve
unutulan bir parametreyi derleyici yakalıyor.
