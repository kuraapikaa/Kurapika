# Gizli ve guvenli deploy rehberi

Bu paneli internete duz bir domain olarak acmak yerine private network arkasinda tutmak en guvenli yaklasimdir.

## En gizli onerilen mimari

1. Uygulamayi tek bir VPS veya private container ortaminda calistir.
2. Sunucuda public olarak sadece `443/tcp` veya hic panel portu acma.
3. Panel erisimini Cloudflare Zero Trust Tunnel, Tailscale Funnel kapali tailnet, WireGuard VPN veya benzeri bir private access katmani arkasina al.
4. Gercek backend portunu dis dunyaya acma; uygulama sadece `127.0.0.1` veya private network'te dinlesin.
5. DNS kaydinda origin IP gorunmesin. Cloudflare Tunnel kullaniliyorsa origin IP gizli kalir.
6. Hosting panelinde veya secret manager'da environment variable kullan; `.env` dosyasini sunucuya elle koyma ve repoya asla commit etme.
7. Panel icin ayrica uygulama login'i, Zero Trust login'i ve mumkunse IP/country allowlist kullan.

## Minimum production environment

Zorunlu:

- `NODE_ENV=production`
- `SESSION_SECRET`: 64+ karakter rastgele
- `MASTER_USER`
- `MASTER_PASS`
- `CORS_ORIGIN=https://gercek-panel-domaininiz`
- `AUTH_TOKEN` veya `DASHBOARD_AUTH` veya `BACKOFFICE_AUTH`
- `PANEL_AUTH_DISABLED=false`

Onerilen:

- `ENABLE_DOCS=false`
- `TOKEN_UPDATE_SECRET`: `/api/update-token` kullanilacaksa uzun rastgele secret
- `SESSION_TTL_MS=28800000`
- `RATE_LIMIT_MAX=90`

## Firewall

VPS kullaniliyorsa:

- SSH sadece kendi IP adresinden acik olsun.
- Uygulama portu public internete acilmasin.
- Reverse proxy/Tunnel disinda dogrudan backend portuna erisim olmasin.

## Secret yonetimi

- Tokenlari `.env`, JSON dosyasi veya kod icinde tutma.
- Render/Railway/Fly/Hetzner/Docker secret manager gibi platform degiskenleri kullan.
- Tokenlari loglama; token uzunlugu bile gereksiz parmak izi sayilir.
- Bir token kopyalandiysa veya paylasildiysa rotasyon yap.

## Deploy oncesi kontrol

- `.env` ve `server/.backoffice-auth.json` repoda yok.
- `PANEL_AUTH_DISABLED=false`.
- `CORS_ORIGIN` sadece panel domaini.
- `SESSION_SECRET` 64+ karakter.
- `ENABLE_DOCS=false`.
- Master sifre rastgele ve tekil.
- Panel domaini Zero Trust/VPN arkasinda.
