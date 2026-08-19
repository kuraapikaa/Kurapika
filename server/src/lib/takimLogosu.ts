/**
 * TAKIM ADINDAN LOGO — WIKIMEDIA.
 *
 * ── Neden bir modul ───────────────────────────────────────────────────
 *
 * Skor tahmin ekraninda maclar elle giriliyor ve her mac icin ayri ayri
 * logo URL'i yapistirmak gerekiyordu; girilmedigi icin ekranda cogu maçta
 * logo yoktu. Takim ADINDAN otomatik cozulmesi istendi.
 *
 * ── Neden hotlink DEGIL ───────────────────────────────────────────────
 *
 * Wikimedia dogrudan baglanmayi (hotlinking) onermiyor ve User-Agent
 * istiyor. Ayrica commons dosya adi ile takim adi bire bir tutmuyor
 * ("Galatasaray" -> "Galatasaray_Sports_Club_Logo.png"). Bu yuzden:
 *
 *   1. Ad NORMALIZE edilir (Turkce buyuk/kucuk, "FC/SK/AS" ekleri, tire).
 *   2. Once ELLE tanimli eslesme tablosuna bakilir — en sik kullanilan
 *      takimlar icin ag istegi hic yapilmaz, yanlis eslesme riski sifir.
 *   3. Kalanlar Wikimedia arama API'sinden cozulur ve SUNUCUDA onbellege
 *      alinir; oyuncu tarayicisi Wikimedia'ya hic gitmez.
 *
 * ── Lisans notu ───────────────────────────────────────────────────────
 *
 * Kulup armalari cogunlukla serbest lisansli DEGIL. Bu modul teknik
 * cozumu saglar; hangi gorselin kullanilabilecegi isletmecinin karari.
 */

/** Wikimedia dosya adindan dogrudan gorsel adresi (thumb, genislik px). */
export function commonsGorselUrl(dosyaAdi: string, genislik = 160): string {
  const temiz = String(dosyaAdi ?? '').trim().replace(/^File:/i, '').replace(/ /g, '_');
  if (!temiz) return '';
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(temiz)}?width=${genislik}`;
}

/**
 * Takim adini eslesme anahtarina cevirir.
 *
 * Turkce kucultme SART: `toLowerCase()` "I" harfini "i" yapar ve
 * "Istanbul" ile "İstanbul" ayrisir. Kulup ekleri (FC, SK, AS, Spor
 * Kulubu) atilir; operator "Galatasaray SK" ya da "Galatasaray" yazsa da
 * ayni anahtara dusmeli.
 */
export function takimAnahtari(ad: unknown): string {
  return String(ad ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c] ?? c))
    .replace(/\b(fc|sc|sk|as|ac|cf|fk|spor kulubu|spor kulübü|futbol kulubu|jk)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Elle tanimli eslesmeler.
 *
 * Arama API'si "Besiktas" icin stadyum, arma ve tarihi logo gibi onlarca
 * sonuc dondurebiliyor; en cok kullanilan takimlarda tahmine birakmiyoruz.
 */
export const BILINEN_LOGOLAR: Record<string, string> = {
  galatasaray: 'Galatasaray_Sports_Club_Logo.png',
  fenerbahce: 'Fenerbah%C3%A7e_SK.png',
  besiktas: 'Be%C5%9Fikta%C5%9F_JK_logo.svg',
  trabzonspor: 'Trabzonspor_logo.svg',
  basaksehir: 'Istanbul_Basaksehir_FK.svg',
  'istanbul-basaksehir': 'Istanbul_Basaksehir_FK.svg',
  samsunspor: 'Samsunspor_logo.svg',
  konyaspor: 'Konyaspor_logo.svg',
  alanyaspor: 'Alanyaspor_logo.svg',
  rizespor: 'Caykur_Rizespor_logo.svg',
  gaziantep: 'Gaziantep_F.K._logo.svg',
  kasimpasa: 'Kas%C4%B1mpa%C5%9Fa_S.K._logo.svg',
  antalyaspor: 'Antalyaspor_logo.svg',
  goztepe: 'G%C3%B6ztepe_S.K._Logo.svg',
  eyupspor: 'Ey%C3%BCpspor_logo.png',
  kayserispor: 'Kayserispor_logo.svg',
  sivasspor: 'Sivasspor_logo.png',
  bodrumspor: 'Bodrum_FK_logo.png',
};

/** Bilinen tablodan logo; yoksa null. Ag istegi YAPMAZ. */
export function bilinenLogo(ad: unknown, genislik = 160): string | null {
  const dosya = BILINEN_LOGOLAR[takimAnahtari(ad)];
  return dosya ? commonsGorselUrl(dosya, genislik) : null;
}

/**
 * Wikimedia arama sonucundan en makul dosyayi secer.
 *
 * Sonuclar "logo"/"crest" gecen ve raster/vektor olan dosyalarla
 * sinirlanir; stadyum fotograflari ve formalar elenir. Hicbir aday
 * kalmazsa null — yanlis gorsel gostermektense logosuz birakmak iyidir.
 */
export function enUygunDosya(basliklar: unknown): string | null {
  if (!Array.isArray(basliklar)) return null;
  const adaylar = basliklar
    .map((t) => String(t ?? '').replace(/^File:/i, '').trim())
    .filter((t) => /\.(svg|png)$/i.test(t))
    .filter((t) => /(logo|crest|arma|badge)/i.test(t));
  if (adaylar.length === 0) return null;
  // Vektor tercih edilir: her olcekte net.
  return adaylar.find((t) => /\.svg$/i.test(t)) ?? adaylar[0];
}
