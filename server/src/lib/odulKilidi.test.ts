import { describe, expect, it } from 'vitest';
import { kilitle, odulAnahtari } from './odulKilidi.js';

/**
 * Odul talebi kilidi.
 *
 * Bildirilen vaka: oyuncu 2490282 hesabinda cok sayida kampanya bonusu.
 * Odul uclari "kontrol et, sonra ver" seklinde calisiyordu ve iki es
 * zamanli istek kontrolu birlikte gecip ayni odulu iki kez veriyordu.
 *
 * Kayit sirasini duzeltmek (once rezerve et) pencereyi daralttI ama
 * kapatmadi — olculdu. Bu kilit yarisi tamamen kapatiyor.
 */

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('aynı anahtar sıraya girer', () => {
  it('eş zamanlı iki işlem çakışmaz', async () => {
    let aktif = 0;
    let enFazlaAktif = 0;
    const islem = async () => {
      aktif += 1;
      enFazlaAktif = Math.max(enFazlaAktif, aktif);
      await bekle(5);
      aktif -= 1;
    };
    await Promise.all([kilitle('a', islem), kilitle('a', islem), kilitle('a', islem)]);
    expect(enFazlaAktif).toBe(1);
  });

  it('kontrol-sonra-ver deseni tek ödül üretir', async () => {
    // Bildirilen hatanin birebir taklidi.
    let verilen = 0;
    let kayitVar = false;
    const talep = () => kilitle('odul:ayse:gorev:t1', async () => {
      if (kayitVar) return 'zaten';
      await bekle(3);            // grantReward gecikmesi
      verilen += 1;
      kayitVar = true;
      return 'verildi';
    });

    const sonuc = await Promise.all([talep(), talep(), talep()]);
    expect(verilen).toBe(1);
    expect(sonuc.filter((s) => s === 'verildi')).toHaveLength(1);
    expect(sonuc.filter((s) => s === 'zaten')).toHaveLength(2);
  });

  it('sıra korunur', async () => {
    const sira: number[] = [];
    await Promise.all([1, 2, 3].map((n) => kilitle('s', async () => {
      await bekle(4 - n);        // sonrakiler daha hizli; sira yine korunmali
      sira.push(n);
    })));
    expect(sira).toEqual([1, 2, 3]);
  });
});

describe('farklı anahtarlar engellemez', () => {
  it('paralel çalışır', async () => {
    let aktif = 0;
    let enFazla = 0;
    const islem = async () => {
      aktif += 1;
      enFazla = Math.max(enFazla, aktif);
      await bekle(5);
      aktif -= 1;
    };
    await Promise.all([kilitle('a', islem), kilitle('b', islem)]);
    expect(enFazla).toBe(2);
  });
});

describe('hata dayanıklılığı', () => {
  it('hata çağırana döner', async () => {
    await expect(kilitle('h', async () => { throw new Error('patladi'); })).rejects.toThrow('patladi');
  });

  it('hata sonrası anahtar KİLİTLİ KALMAZ', async () => {
    // Zincir kirilsaydi o oyuncu bir daha odul alamazdi.
    await kilitle('h2', async () => { throw new Error('ilk'); }).catch(() => undefined);
    await expect(kilitle('h2', async () => 'ikinci')).resolves.toBe('ikinci');
  });

  it('hata sırayı bozmaz', async () => {
    const sira: string[] = [];
    const p1 = kilitle('h3', async () => { sira.push('bir'); throw new Error('x'); }).catch(() => undefined);
    const p2 = kilitle('h3', async () => { sira.push('iki'); });
    await Promise.all([p1, p2]);
    expect(sira).toEqual(['bir', 'iki']);
  });
});

describe('anahtar üretimi', () => {
  it('oyuncu + tür + kimlik', () => {
    expect(odulAnahtari('Ayse', 'gorev', 't1')).toBe('odul:ayse:gorev:t1');
  });

  it('büyük/küçük harf ve boşluk duyarsız', () => {
    expect(odulAnahtari('  AYSE ', 'gorev', 1)).toBe(odulAnahtari('ayse', 'gorev', 1));
  });

  it('farklı oyuncu farklı anahtar', () => {
    expect(odulAnahtari('ayse', 'gorev', 't1')).not.toBe(odulAnahtari('mehmet', 'gorev', 't1'));
  });

  it('farklı ödül farklı anahtar', () => {
    expect(odulAnahtari('ayse', 'gorev', 't1')).not.toBe(odulAnahtari('ayse', 'gorev', 't2'));
    expect(odulAnahtari('ayse', 'gorev', 't1')).not.toBe(odulAnahtari('ayse', 'battlepass', 't1'));
  });
});
