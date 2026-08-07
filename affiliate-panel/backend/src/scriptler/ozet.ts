import { parolaOzeti } from '../lib/sifre.js';

/**
 * Parola özeti üretir: `npm run ozet -- "parolam"`.
 *
 * Parola KOMUT SATIRI ARGÜMANI olarak alınıyor ve bu, kabuk geçmişine
 * düşmesi demek. Kabul edilebilir: bu betik kurulumda bir kez, kendi
 * makinede çalışıyor ve alternatifi (etkileşimli okuma) kurulum
 * betiklerinde ve konteyner içinde çalışmıyor. Yine de üretilen ÖZET
 * ortama yazılıyor, parolanın kendisi değil.
 */
const parola = process.argv[2];

if (!parola || parola.length < 10) {
  console.error('Kullanım: npm run ozet -- "en az 10 karakterli parola"');
  process.exit(1);
}

console.log(parolaOzeti(parola));
