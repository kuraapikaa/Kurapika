import { defineConfig } from 'drizzle-kit';

/**
 * Yalnızca migrasyon ÜRETMEK için; çalışma anında kullanılmıyor.
 *
 * Şema değiştiğinde: `npm run sema:uret`. Üretilen SQL depoya girer ve
 * açılışta `migrate()` tarafından uygulanır. `push` bilinçli olarak
 * kullanılmıyor — üretim veritabanına şema uygulamak, gözden geçirilmiş
 * ve depoda duran bir dosyadan olmalı.
 */
export default defineConfig({
  schema: './src/lib/sema.ts',
  out: './drizzle',
  dialect: 'postgresql',
});
