import { afterEach, describe, expect, it, vi } from 'vitest';
import { dagitikKilitle, kilitle, odulAnahtari } from './odulKilidi.js';

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

/**
 * `dagitikKilitle` — bkz. dosya başı: `kilitle()` yalnızca SÜREÇ İÇİ.
 * Bu testler ikinci bir SÜREÇ simülasyonu için `database.ts`'i taklit
 * ediyor (gerçek Postgres olmadan `claimGrant`/`releaseGrant`'in
 * dönüşüne göre davranışı doğrulamak için).
 */
vi.mock('./database.js', () => ({
  claimGrant: vi.fn(async () => true),
  releaseGrant: vi.fn(async () => undefined),
}));

describe('dagitikKilitle', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('talep alınırsa islem çalışır ve sonucu döner', async () => {
    const database = await import('./database.js');
    vi.mocked(database.claimGrant).mockResolvedValue(true);

    const sonuc = await dagitikKilitle('kiraci-1', 'anahtar-1', async () => 'verildi');

    expect(sonuc).toEqual({ calisti: true, sonuc: 'verildi' });
    expect(database.claimGrant).toHaveBeenCalledWith('kiraci-1', 'anahtar-1');
  });

  it('talep BAŞKA BİR SÜREÇTE alınmışsa islem HİÇ ÇALIŞMAZ', async () => {
    const database = await import('./database.js');
    vi.mocked(database.claimGrant).mockResolvedValue(false);
    const islem = vi.fn(async () => 'verildi');

    const sonuc = await dagitikKilitle('kiraci-1', 'anahtar-2', islem);

    expect(sonuc).toEqual({ calisti: false });
    expect(islem).not.toHaveBeenCalled();
  });

  it('islem bittiginde (basarili) talebi serbest birakir', async () => {
    const database = await import('./database.js');
    vi.mocked(database.claimGrant).mockResolvedValue(true);

    await dagitikKilitle('kiraci-1', 'anahtar-3', async () => 'ok');

    expect(database.releaseGrant).toHaveBeenCalledWith('kiraci-1', 'anahtar-3');
  });

  it('islem hata atsa bile talebi serbest birakir, hata cagirana doner', async () => {
    const database = await import('./database.js');
    vi.mocked(database.claimGrant).mockResolvedValue(true);

    await expect(dagitikKilitle('kiraci-1', 'anahtar-4', async () => {
      throw new Error('lynon patladi');
    })).rejects.toThrow('lynon patladi');

    expect(database.releaseGrant).toHaveBeenCalledWith('kiraci-1', 'anahtar-4');
  });

  it('ayni anahtarda es zamanli iki talepten yalnizca biri calisir (surec-ici sira + talep birlikte)', async () => {
    // Gercek Postgres'teki PRIMARY KEY yarisini taklit ediyoruz: ilk
    // cagiran true, digerleri false alir -- `kilitle()`'nin surec-ici
    // sirasi sayesinde bu ikisi asla es zamanli calismaz, biri digerinin
    // BITMESINI bekler, o yuzden taklit de sirali davranabilir.
    const database = await import('./database.js');
    let alindi = false;
    vi.mocked(database.claimGrant).mockImplementation(async () => {
      if (alindi) return false;
      alindi = true;
      return true;
    });

    let calisanSayisi = 0;
    const islem = async () => { calisanSayisi += 1; return 'verildi'; };

    const sonuclar = await Promise.all([
      dagitikKilitle('kiraci-1', 'anahtar-5', islem),
      dagitikKilitle('kiraci-1', 'anahtar-5', islem),
    ]);

    expect(calisanSayisi).toBe(1);
    expect(sonuclar.filter((s) => s.calisti)).toHaveLength(1);
  });

  it('veritabani hazir degilse (yerel gelistirme) islem her zaman calisir', async () => {
    const database = await import('./database.js');
    // Gercek `claimGrant`/`releaseGrant` DB hazir degilken sirasiyla
    // true/no-op doner (bkz. database.ts) -- burada ayni sozlesmeyi
    // taklit ediyoruz.
    vi.mocked(database.claimGrant).mockResolvedValue(true);

    const sonuc = await dagitikKilitle('kiraci-1', 'anahtar-6', async () => 'tek-surec');

    expect(sonuc).toEqual({ calisti: true, sonuc: 'tek-surec' });
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
