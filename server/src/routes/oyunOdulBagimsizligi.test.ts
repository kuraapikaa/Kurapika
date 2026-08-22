import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * ÇARK VE KAZI KAZAN ÖDÜLLERİ BONUS KURALLARINDAN BAĞIMSIZDIR.
 *
 * Oyun ödülleri kural değerlendirmesinden HİÇ geçmiyor; kendi hak
 * sayaçları var (`yatirimHakki`: bir yatırım = bir oyun hakkı).
 * `checkSameDayUsage`, `perDayLimit`, `checkSingleInvestmentUsage` gibi
 * bonus kuralları bu ödüllere uygulanmıyor.
 *
 * Bu ayrım bugüne kadar yalnızca bir yorumda yazılıydı
 * (`promoEvaluator.ts`, "Cark bu kurala girmez") ve hiçbir test onu
 * korumuyordu. Biri iyi niyetle `games.ts` içine kural değerlendirmesi
 * eklerse çark ödülleri sessizce bonus limitlerine takılır: oyuncu
 * yatırım yapar, çarkı çevirir, kazanır ve ödülü "bu bonusu bugün
 * zaten aldınız" diye reddedilir. Ödül zaten çekilmiş olduğu için de
 * geri alınamaz.
 *
 * Test SINIRI koruyor: kural motoru oyun rotalarına sızmasın.
 */

const buDosya = fileURLToPath(import.meta.url);
const OYUN_ROTASI = path.join(path.dirname(buDosya), 'games.ts');

/** Kural değerlendirmesini getiren modüller. */
const KURAL_MOTORU = [
  'promoEvaluator',
  'withdrawalEngine',
  'rulesService',
  'bonusBlacklistService',
];

function importSatirlari(kaynak: string): string[] {
  return kaynak
    .split('\n')
    .filter((satir) => /^\s*import\s/.test(satir) || /\bfrom\s+['"]/.test(satir) || /\bimport\(/.test(satir));
}

describe('oyun ödülleri bonus kurallarından bağımsız', () => {
  const kaynak = fs.readFileSync(OYUN_ROTASI, 'utf-8');

  it('games.ts kural motorunu içeri almıyor', () => {
    const satirlar = importSatirlari(kaynak);
    const sizanlar = KURAL_MOTORU.filter((modul) =>
      satirlar.some((satir) => satir.includes(modul)),
    );
    expect(sizanlar).toEqual([]);
  });

  it('games.ts kural değerlendirmesini çağırmıyor', () => {
    // Dinamik import da dahil: `await import('../services/...')`.
    for (const cagri of ['evaluateForAccount', 'getRules(', 'kuralDegerlendir']) {
      expect(kaynak.includes(cagri)).toBe(false);
    }
  });

  it('oyun hakkı sayacı yerinde duruyor', () => {
    // Bağımsızlık "sınırsız" demek değil: her yatırım bir hak veriyor.
    // Bu çağrı kalkarsa oyuncu tek yatırımla sınırsız çevirebilirdi.
    expect(kaynak).toMatch(/yatirimHakki\s*\(/);
  });
});
