# En Basit ve Anonim Deploy Seçenekleri

Proje: Node.js API + React frontend (Docker ile tek imaj).

---

## 1. En basit: Render (ücretsiz, tek e‑posta)

- **Anonimlik:** Geçici e‑posta (örn. [Guerrilla Mail](https://guerrillamail.com), [Temp-mail.org](https://temp-mail.org)) ile kayıt. Kredi kartı gerekmez.
- **Adımlar:**
  1. [render.com](https://render.com) → Sign Up (geçici e‑posta).
  2. Dashboard → **New** → **Web Service**.
  3. Repo bağla (GitHub/GitLab) veya **Docker** seçip `Dockerfile` yolunu göster.
  4. **Environment:** `PORT` = `3750` (veya Render’ın verdiği port); gerekirse `AUTH_TOKEN`, `ADMIN_USER`, `ADMIN_PASS` ekle.
  5. **Deploy**.
- **URL:** `https://<servis-adı>.onrender.com` (ücretsiz planda uykuya girer, ilk istekte ~30 sn açılır).

---

## 2. Zaten kullandığın: Railway

- **Anonimlik:** Farklı bir hesap istersen yine geçici e‑posta ile yeni hesap aç.
- **En basit:** Repo’yu Railway’e bağla, `railway.json` + `Dockerfile` var; otomatik build/deploy.
- **CLI ile (opsiyonel):**
  ```bash
  npm i -g @railway/cli
  railway login
  railway init
  railway up
  ```
- Ortam değişkenlerini Railway dashboard’dan ekle.

---

## 3. Daha anonim: VPS + kripto ödeme

- **Anonimlik:** Njalla, 1984.is gibi sağlayıcılar; ödeme Bitcoin/crypto. Kişisel bilgi minimum.
- **Basitlik:** Orta (SSH + Docker).
- **Örnek (VPS’te):**
  ```bash
  # VPS’e bağlan, projeyi kopyala veya git clone
  git clone <repo-url> app && cd app
  docker build -t app .
  docker run -d -p 3750:3750 --env-file .env app
  ```
- Nginx/Caddy ile HTTPS (örn. Let’s Encrypt) eklenebilir.

---

## 4. Sadece “tek komut” hissi (Railway CLI)

Hep aynı projede deploy için:

```bash
cd /path/to/D23AA
npx -y @railway/cli login
npx -y @railway/cli link   # veya ilk seferde: railway init
npx -y @railway/cli up
```

Bu, mevcut Dockerfile ile build alıp Railway’e gönderir. Anonimlik için Railway hesabını geçici e‑posta ile açabilirsin.

---

## Özet

| Yöntem        | Basitlik | Anonimlik      | Not                    |
|---------------|----------|----------------|------------------------|
| Render        | ⭐⭐⭐     | Geçici e‑posta | Ücretsiz, uyku modu   |
| Railway       | ⭐⭐⭐     | Geçici e‑posta | Zaten kullanıyorsun    |
| VPS + kripto  | ⭐⭐      | Yüksek         | Kendi sunucu, ödeme crypto |

**Pratik öneri:** Hesap açmak sorun değilse **Render** veya **Railway** + geçici e‑posta = en basit ve yeterince anonim. Tam anonimlik istiyorsan VPS + kripto ödeme tek gerçekçi seçenek.
