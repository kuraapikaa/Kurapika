import fastifyStatic from '@fastify/static';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { uygulamaKur } from './app.js';
import { anahtarParmakIzi, sifrelemeHazirMi } from './lib/sifre.js';
import { veritabaniniBaslat } from './lib/veritabani.js';
import { duzParolaKullaniliyorMu, yoneticiKimligiVarMi } from './kimlik/oturum.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * AÇILIŞ DOĞRULAMASI.
 *
 * Eksik yapılandırma AÇILIŞTA patlıyor, ilk isteğe kadar beklemiyor.
 * "Ayakta ama hiçbir şey kaydedemiyor" durumundaki bir panel, hatasız
 * göründüğü için en geç fark edilen arıza türü.
 *
 * Ayrım net: oturum imzası ve yönetici kimliği OLMADAN panel hiç
 * çalışmaz — bunlar ölümcül. Şifreleme anahtarı eksikse panel açılıyor
 * ama backoffice bağlantısı kaydedilemiyor; bu bir uyarı, çünkü panelin
 * geri kalanı (ortaklar, medya, hakediş) o anahtar olmadan da doğru
 * çalışıyor.
 */
function ortamiDogrula(uyar: (mesaj: string) => void): void {
  const olumcul: string[] = [];

  if (String(process.env.AFF_SESSION_SECRET || '').trim().length < 16) {
    olumcul.push('AFF_SESSION_SECRET en az 16 karakter olmalı (oturum jetonları bununla imzalanıyor).');
  }
  if (!yoneticiKimligiVarMi()) {
    olumcul.push('AFF_ADMIN_KULLANICI ve AFF_ADMIN_PAROLA_OZETI (ya da AFF_ADMIN_PAROLA) tanımlanmalı.');
  }
  if (olumcul.length) {
    throw new Error(`Yapılandırma eksik:\n  - ${olumcul.join('\n  - ')}`);
  }

  if (!sifrelemeHazirMi()) {
    uyar('AFF_SECRET_KEY tanımlı değil. Backoffice bağlantısı KAYDEDİLEMEZ; sırlar düz metin olarak yazılmaz.');
  }
  if (duzParolaKullaniliyorMu()) {
    uyar('AFF_ADMIN_PAROLA düz metin. Üretimde AFF_ADMIN_PAROLA_OZETI kullanın (npm run ozet -- "parola").');
  }
  if (!String(process.env.AFF_TIKLAMA_TEMEL_URL || '').trim()) {
    uyar('AFF_TIKLAMA_TEMEL_URL boş; ortak portalinde izlemeli link üretilemeyecek.');
  }
}

async function baslat(): Promise<void> {
  const app = await uygulamaKur();
  ortamiDogrula((mesaj) => app.log.warn(mesaj));

  const veritabani = await veritabaniniBaslat();
  app.log.info(
    { veritabani: veritabani ? 'postgres' : 'dosya', sifreAnahtari: anahtarParmakIzi() ?? 'yok' },
    'Depo hazır',
  );
  if (!veritabani) {
    app.log.warn('DATABASE_URL yok; veriler diske yazılıyor. Kalıcı disk olmayan bir dağıtımda her yeniden başlatmada silinir.');
  }

  // Arayuz derlenmisse ayni sunucudan servis ediliyor. Ayri bir statik
  // barindirma da mumkun; bu yalnizca tek konteynerli dagitimi
  // kolaylastiriyor.
  const arayuzDizini = path.join(__dirname, '..', 'genel');
  if (existsSync(arayuzDizini)) {
    await app.register(fastifyStatic, { root: arayuzDizini });
    app.setNotFoundHandler((istek, yanit) => {
      /**
       * SPA kabuğu YALNIZCA kök adres için.
       *
       * Önceki hâli, statik dosya olarak bulunamayan HER yola
       * `index.html` dönüyordu. Sızıntı değildi (dosyalar zaten
       * `genel/` içinde yok) ama sunucu `/.env`, `/.git/config`,
       * `/.npmrc` gibi yollara da 200 dönüyordu — üretim logunda
       * tarayıcıların bunları denediği ve 200 aldığı görüldü. Tarayıcı
       * 200'ü "burada bir şey var" diye okuyup taramayı derinleştiriyor.
       *
       * Arayüz `HashRouter` kullanıyor: her rota `/#/...` biçiminde ve
       * sunucunun görmesi gereken tek yol `/`. Yani derin bağlantı için
       * yedek yola hiç gerek yok — bulunamayan her şey gerçekten 404.
       */
      if (istek.url === '/' || istek.url.startsWith('/?')) {
        return yanit.sendFile('index.html');
      }
      const apiYolu = istek.url.startsWith('/api') || istek.url.startsWith('/c/');
      return apiYolu
        ? yanit.status(404).send({ hata: 'Bulunamadı.' })
        : yanit.status(404).type('text/plain').send('Bulunamadı.');
    });
  }

  const port = Number(process.env.PORT) || 4100;
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Affiliate paneli ${port} portunda.`);
}

baslat().catch((hata) => {
  console.error(hata instanceof Error ? hata.message : hata);
  process.exit(1);
});
