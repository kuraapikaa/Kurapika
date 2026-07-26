# PostgreSQL + Redis Veri Katmanı

Panel artık production ortamında PostgreSQL ve Redis kullanır.

## Sorumluluklar

- PostgreSQL `app_documents`: tenant ayarları, bonus kuralları, formlar, oyun/çark/tahmin/görev durumları, sadakat, turnuvalar ve promo override kayıtları.
- PostgreSQL `audit_events`: yönetim ve bonus işlem denetim kayıtları.
- Redis: Fastify session verileri ve Lynon API sonuç cache'i.
- Lynon/BetConstruct: oyuncu, finans, bahis ve platform bonusları için harici ana kaynak.

## İlk kurulum

1. Bir PostgreSQL ve bir Redis servisi oluşturun.
2. Hosting secret manager'a `DATABASE_URL`, `REDIS_URL` ve `.env.example` içindeki güvenlik değerlerini ekleyin.
3. Mevcut JSON verilerini bir kez içe aktarın:

```powershell
npm.cmd run migrate:storage --prefix server
```

Mevcut PostgreSQL belgelerinin üzerine yazmak için yalnızca kontrollü bakım sırasında:

```powershell
npm.cmd run migrate:storage --prefix server -- --force
```

## Çalışma davranışı

- Production'da PostgreSQL veya Redis eksikse sunucu başlamaz.
- Development'ta bağlantılar yoksa mevcut JSON ve memory-session fallback devam eder.
- PostgreSQL'de bulunmayan bir belge ilk okumada mevcut JSON dosyasından otomatik içe alınır.
- `JSON_MIRROR_WRITES=true` yalnızca geçiş/yedekleme döneminde kullanılmalıdır.
- `/api/health` yanıtında `persistence.database` ve `persistence.redis` durumları görünür.

## Railway

Railway projesine PostgreSQL ve Redis servislerini ekleyin. Uygulama servisine bu servislerin `DATABASE_URL` ve `REDIS_URL` değişkenlerini referanslayın. Deploy öncesinde `migrate:storage` komutunu bir defa çalıştırın; sonraki deploylarda şema uygulama başlangıcında idempotent olarak doğrulanır.