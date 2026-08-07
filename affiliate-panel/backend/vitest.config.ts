import { defineConfig } from 'vitest/config';

/**
 * Testler GERÇEK depoya yazmamalı.
 *
 * `AFF_VERI_DIZINI` modül yüklenirken bir kez okunuyor; testin içinde
 * değiştirmek geç kalır. Bu yüzden burada, süreç başlamadan
 * ayarlanıyor ve testler `.test-veri` altına yazıyor.
 *
 * Temizlik `globalSetup`'ta, test dosyalarında DEĞİL: dosyalar paralel
 * çalışıyor ve her birinin kendi `afterAll`'ında dizini silmesi,
 * birinin silerken diğerinin yazdığı bir yarış üretiyordu.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/temizle.ts'],
    env: {
      AFF_VERI_DIZINI: '.test-veri',
      AFF_SECRET_KEY: 'test-sifreleme-anahtari-yeterince-uzun',
      AFF_SESSION_SECRET: 'test-imza-anahtari-yeterince-uzun',
      AFF_ADMIN_KULLANICI: 'test-admin',
      AFF_ADMIN_PAROLA: 'test-parolasi-uzun',
      // Fastify gunlugu testlerde yalnizca gurultu; gercek hata zaten
      // basarisiz iddia olarak gorunuyor.
      LOG_LEVEL: 'silent',
    },
  },
});
