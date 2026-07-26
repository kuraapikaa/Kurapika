# Lynon Backoffice: tamamlanan Bonus Engine V2 uçları

Bu liste, sağlanan API notları ile Narcosbahis Backoffice içindeki Bonus Constructor mikro-frontendinin kullandığı gerçek uçların karşılaştırılmasıyla hazırlanmıştır. Kimlik doğrulama OIDC oturum çereziyle yapılır; erişim belirteçleri ve oturum çerezleri istemciye aktarılmaz.

## Kampanyalar

| İşlem | Yöntem | Uç |
| --- | --- | --- |
| Liste | GET | `/api/bonusenginev2/api/v1/Campaign/site/{siteId}?page={page}&countPerPage={count}` |
| Tek kampanya | GET | `/api/bonusenginev2/api/v1/Campaign/{campaignId}` |
| Oluştur | POST | `/api/bonusenginev2/api/v1/Campaign/site/{siteId}` |
| Güncelle | PUT | `/api/bonusenginev2/api/v1/Campaign/{campaignId}` |
| Klonla | PUT | `/api/bonusenginev2/api/v1/Campaign/clone/{campaignId}` |
| Durum güncelle | PUT | `/api/bonusenginev2/api/v1/Campaign/state/{campaignId}` |
| Arşivle | DELETE | `/api/bonusenginev2/api/v1/Campaign/{campaignId}` |
| Atanabilir kampanyalar | GET | `/api/bonusenginev2/api/v1/Campaign/site/{siteId}/assignable` |

Kampanya gövdesi; `systemName`, `nameTranslations`, `expirationToClaimInDays`, `configurationCurrency`, `supportedCurrencies`, `maxAssigneeCount`, `startDate`, `endDate` alanlarını kullanır.

## Bonus blokları ve atama

| İşlem | Yöntem | Uç |
| --- | --- | --- |
| Kampanya bonusları | GET | `/api/bonusenginev2/api/v1/Bonus/campaign/{campaignId}` |
| Bonus oluştur | POST | `/api/bonusenginev2/api/v1/Bonus/site/{siteId}/campaign/{campaignId}` |
| Bonus güncelle | PUT | `/api/bonusenginev2/api/v1/Bonus/site/{siteId}/{bonusId}` |
| Bonus sil | DELETE | `/api/bonusenginev2/api/v1/Bonus/site/{siteId}/{bonusId}` |
| Şablon | GET | `/api/bonusenginev2/api/v1/Template/{templateId}` |
| Blok kataloğu | GET | `/api/bonusenginev2/api/v1/Block` |
| Oyuncu kampanya ataması | POST | `/api/bonusenginev2/api/v1/CampaignAssignment/site/{siteId}/player/{playerId}` |

Oyuncu ataması `campaignId`, `assignmentReason` ve her bonusun blok parametrelerini içeren `bonusBlocksConfiguration` gövdesini kullanır. `filledBy: "assignment"` ve zorunlu parametresi bulunan şablonlar (ör. dinamik bonus tutarı ya da freespin oyun/spin adedi) açık değer olmadan otomatik atanmaz.

## API notlarında bulunmayan, Constructor’da kullanılan ek servisler

- `/api/cashbackengine/api/v1`
- `/api/bonusenginev2/api/v1/BonusSession`
- `/api/integration/api/v1`
- `/api/freespin/api/v1`
- `/api/bonusenginev2/api/v1/InstantBonusAssignment`
- `/api/wageringservice/api/v1/Session`
- `/api/integration/api/v1.0`
- `/api/bonusoffer/api/v1.0`
- `/api/cmsgateway/api/v1.0`

## Narcosbahis uygulama kuralı

Kampanyalar yalnızca geçerli bir Lynon şablonundan blok parametreleriyle oluşturulur. Yüzdelik/kayıp/freespin gibi sonucu oyuncu verisine göre hesaplanan kampanyalarda, tutar veya oyun seçimi arayüzden türetilmez. Bu sayede örneğin `%15` başlığının `15 TL` gibi yanlış bir bonus tutarına dönüşmesi engellenir.

## Oyuncu profil sekmeleri için doğrulanan uçlar

| Profil sekmesi | Yöntem | Uç | Uygulamadaki kullanım |
| --- | --- | --- | --- |
| Genel Bakış | GET | `/api/user/api/v1.0/userBackOffice/users/{userId}` | Kimlik, doğrulama, son IP ve son giriş |
| Genel Bakış / cüzdan | GET | `/api/platform/api/v1.0/BackofficeAccounts/{userId}` | Gerçek ve bonus hesap bakiyeleri |
| Notlar | GET | `/api/platform/api/v1.0/CorrectionHistory/sites/{siteId}?playerId={userId}` | Operatör bakiye düzeltme notları |
| Bonuslar | GET | `/api/bonusenginev2/api/v1/CampaignAssignment/site/{siteId}/player/{userId}` | Oyuncuya atanmış kampanyalar |
| Bonus oturumları | GET | `/api/bonusenginev2/api/v1/Report/bonusSessions/site/{siteId}?playerId={userId}` | Bonusun oturum/durum bilgisi |
| İşlemler | POST | `/api/payment-operations/api/v1.0/BackOfficeTransactions` | Yatırım ve çekim geçmişi |
| Spor Bahisleri | GET | `/api/sportOperation/api/v1.0/sportBetEvent/players/{userId}/site/{siteId}` | Oyuncuya özel spor bahisleri |
| Detaylı Rapor / Casino | GET | `/api/operation/api/v1.0/backOffices/players/{userId}/site/{siteId}` | Oyuncuya özel casino hareketleri |
| IP Adresleri | GET | `/api/playerDataHub/api/v1.0/playerLogin/{userId}` ve `?ip={ip}&siteId={siteId}` | Giriş geçmişi ve aynı IP'deki hesaplar |

### Ödeme işlemleri notu

Canlı Narcos/Lynon ortamında `BackOfficeTransactions` çağrısı gövdeyi `{"request": { ...filtreler }}` biçiminde bekliyor. Uygulama bunu kullanır; boş tutar filtreleri `null` olarak gönderilir. Oyuncu profili isteğinde Lynon beklenmedik biçimde oyuncu filtresi olmadan kayıt döndürürse, arayüz başka oyuncunun işlemlerini göstermemek için yanıtı `userId` ile ikinci kez filtreler.
