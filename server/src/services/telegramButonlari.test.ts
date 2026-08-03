import { describe, expect, it } from 'vitest';
import {
  AZAMI_CALLBACK_BAYT,
  callbackCoz,
  callbackVerisi,
  cekimButonlari,
  klavye,
  notIstegindenOyuncu,
  notIstekMesaji,
  yetkiliKullanicilar,
  yetkiliMi,
} from './telegramButonlari.js';

describe('callback verisi', () => {
  it('gidiş dönüş bozulmaz', () => {
    const veri = callbackVerisi('onay', 967829, 2503142);
    expect(callbackCoz(veri)).toEqual({ eylem: 'onay', islemId: '967829', oyuncuId: '2503142' });
  });

  it('üç eylemi de taşır', () => {
    for (const eylem of ['onay', 'ret', 'onayNot'] as const) {
      expect(callbackCoz(callbackVerisi(eylem, 1, 2))?.eylem).toBe(eylem);
    }
  });

  it('Telegram 64 bayt sınırını aşmaz', () => {
    // Gercekci en uzun kimliklerle.
    const veri = callbackVerisi('onayNot', 999999999999, 999999999999);
    expect(Buffer.byteLength(veri, 'utf8')).toBeLessThanOrEqual(AZAMI_CALLBACK_BAYT);
  });

  it('bize ait olmayan veriyi çözmez', () => {
    expect(callbackCoz('x|a|1|2')).toBeNull();
    expect(callbackCoz('')).toBeNull();
    expect(callbackCoz(null)).toBeNull();
    expect(callbackCoz('c|a|1')).toBeNull();
  });

  it('bilinmeyen eylem kodunu reddeder', () => {
    expect(callbackCoz('c|z|1|2')).toBeNull();
  });

  it('işlem kimliği boşsa reddeder', () => {
    // Kimliksiz bir onay istegi yanlis islemi cozumleyebilirdi.
    expect(callbackCoz('c|a||2')).toBeNull();
  });
});

describe('yetki', () => {
  it('liste boşsa hiç kimse yetkili değil', () => {
    // "Bos liste = herkese izin" varsayilani, yapilandirmayi unutan bir
    // kurulumda cekimleri gruba acardi.
    const bos = yetkiliKullanicilar('');
    expect(bos.size).toBe(0);
    expect(yetkiliMi('12345', bos)).toBe(false);
  });

  it('listedeki kullanıcı yetkili', () => {
    const liste = yetkiliKullanicilar('111, 222 ,333');
    expect(yetkiliMi(222, liste)).toBe(true);
    expect(yetkiliMi('444', liste)).toBe(false);
  });

  it('tanımsız değişken boş küme verir', () => {
    expect(yetkiliKullanicilar(undefined).size).toBe(0);
  });
});

describe('çekim butonları', () => {
  const yetkililer = yetkiliKullanicilar('111');

  it('yetkili varken üç buton üretir', () => {
    const butonlar = cekimButonlari({ islemId: 967829, oyuncuId: 2503142, sonuclanmis: false, yetkililer });
    expect(butonlar.flat().map((b) => b.text)).toEqual(['✅ Onayla', '📝 Onayla + Not', '❌ Reddet']);
  });

  it('yetkili listesi boşsa buton eklenmez', () => {
    const butonlar = cekimButonlari({
      islemId: 1, oyuncuId: 2, sonuclanmis: false, yetkililer: yetkiliKullanicilar(''),
    });
    expect(butonlar).toEqual([]);
    expect(klavye(butonlar)).toBeUndefined();
  });

  it('sonuçlanmış çekimde buton gösterilmez', () => {
    // Ikinci kez cozumlemek uctan hata doner, operatore "calismiyor" hissi verir.
    expect(cekimButonlari({ islemId: 1, oyuncuId: 2, sonuclanmis: true, yetkililer })).toEqual([]);
  });

  it('klavye reply_markup biçiminde döner', () => {
    const butonlar = cekimButonlari({ islemId: 1, oyuncuId: 2, sonuclanmis: false, yetkililer });
    expect(klavye(butonlar)).toEqual({ inline_keyboard: butonlar });
  });
});

describe('not isteme akışı', () => {
  it('mesajdan oyuncu kimliği geri okunur', () => {
    const mesaj = notIstekMesaji(2503142, 'larac');
    expect(notIstegindenOyuncu(mesaj)).toBe('2503142');
  });

  it('kullanıcı adı yoksa da kimlik okunur', () => {
    expect(notIstegindenOyuncu(notIstekMesaji(2503142, ''))).toBe('2503142');
  });

  it('bota ait olmayan mesajdan kimlik okunmaz', () => {
    expect(notIstegindenOyuncu('rastgele bir mesaj (2503142)')).toBeNull();
    expect(notIstegindenOyuncu('')).toBeNull();
    expect(notIstegindenOyuncu(null)).toBeNull();
  });
});
