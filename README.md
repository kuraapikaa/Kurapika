# Bugs Panel

Operasyonlar için geliştirilen çok kiracılı backoffice ve oyuncu etkileşim paneli.

## Teknoloji

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, TanStack Query
- Backend: Fastify, TypeScript, PostgreSQL, isteğe bağlı Redis
- Entegrasyon: Lynon ve BetConstruct backoffice servisleri

## Hızlı başlangıç

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Ayrıntılı ortam değişkenleri, veritabanı, test ve production adımları için [KURULUM.md](KURULUM.md) dosyasını okuyun.

## Güvenlik

Kimlik bilgilerini, `.env` dosyalarını, backoffice oturumlarını, logları ve oyuncu verilerini repoya eklemeyin. Production dağıtımından önce [SECURE_DEPLOY.md](SECURE_DEPLOY.md) kontrol listesini uygulayın.

## Dokümantasyon

- [Kurulum](KURULUM.md)
- [Kalıcı veri](PERSISTENCE.md)
- [Railway dağıtımı](RAILWAY.md)
- [Güvenli dağıtım](SECURE_DEPLOY.md)
