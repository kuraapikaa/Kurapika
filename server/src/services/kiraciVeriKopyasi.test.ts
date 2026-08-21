import { describe, expect, it, vi } from 'vitest';
import {
  kiraciVerisiniKopyala,
  KOPYALANACAK_ALANLAR,
  KOPYALANMAYAN_ALANLAR,
} from './kiraciVeriKopyasi.js';

/**
 * Senaryo: canlı sitenin bütün ayarları `default` altında duruyor çünkü
 * hiç site kaydı yoktu. Site Master panelinden eklendiği an domain
 * eşleşmeye başlıyor ve aynı istek artık yeni anahtarı okuyor -- panel
 * bomboş açılıyor. Bu modül o boşluğu kapatıyor.
 */

/** Bellek içi sahte belge deposu. */
function depoKur(baslangic: Record<string, Record<string, unknown>> = {}) {
  const veri: Record<string, Record<string, unknown>> = JSON.parse(JSON.stringify(baslangic));
  const oku = vi.fn(async (kiraci: string, ns: string) => veri[kiraci]?.[ns]);
  const yaz = vi.fn(async (kiraci: string, ns: string, payload: unknown) => {
    veri[kiraci] = veri[kiraci] || {};
    veri[kiraci][ns] = payload;
  });
  return { veri, oku, yaz };
}

describe('kiraciVerisiniKopyala', () => {
  it('kaynaktaki ayarları hedefe kopyalar', async () => {
    const { veri, oku, yaz } = depoKur({
      default: { rules: { PROMO_SPECS: { '2046': { enabled: true } } }, 'game-settings': { wheel: [1, 2] } },
    });

    const sonuc = await kiraciVerisiniKopyala(oku, yaz, { kaynak: 'default', hedef: 'narcos' });

    expect(veri.narcos.rules).toEqual({ PROMO_SPECS: { '2046': { enabled: true } } });
    expect(veri.narcos['game-settings']).toEqual({ wheel: [1, 2] });
    expect(sonuc.kopyalanan).toBe(2);
  });

  it('kaynak DEĞİŞMEDEN kalır — taşıma değil kopyalama', async () => {
    // Yeni site beklendigi gibi calismazsa siteyi pasiflestirmek eski
    // duzene donmek icin yeterli olmali.
    const { veri, oku, yaz } = depoKur({ default: { rules: { a: 1 } } });
    await kiraciVerisiniKopyala(oku, yaz, { kaynak: 'default', hedef: 'yeni' });
    expect(veri.default.rules).toEqual({ a: 1 });
  });

  it('hedefte kayıt varsa varsayılan olarak ÜZERİNE YAZMAZ', async () => {
    // Operatorun yeni sitede saatlerce yaptigi ayarin sessizce silinmesi,
    // kurtarmaya calistigimiz hatanin aynisi olurdu.
    const { veri, oku, yaz } = depoKur({
      default: { rules: { kaynak: true } },
      yeni: { rules: { elleGirilmis: true } },
    });

    const sonuc = await kiraciVerisiniKopyala(oku, yaz, { kaynak: 'default', hedef: 'yeni' });

    expect(veri.yeni.rules).toEqual({ elleGirilmis: true });
    expect(sonuc.satirlar.find((s) => s.namespace === 'rules')?.durum).toBe('hedefDolu');
    expect(sonuc.kopyalanan).toBe(0);
    expect(sonuc.atlanan).toBeGreaterThan(0);
  });

  it('uzerineYaz açıkça istenirse ezer', async () => {
    const { veri, oku, yaz } = depoKur({
      default: { rules: { kaynak: true } },
      yeni: { rules: { eski: true } },
    });
    await kiraciVerisiniKopyala(oku, yaz, { kaynak: 'default', hedef: 'yeni', uzerineYaz: true });
    expect(veri.yeni.rules).toEqual({ kaynak: true });
  });

  it('kuru gösterimde HİÇBİR ŞEY yazılmaz ama rapor üretilir', async () => {
    const { veri, oku, yaz } = depoKur({ default: { rules: { a: 1 }, 'lobby-design': { b: 2 } } });

    const sonuc = await kiraciVerisiniKopyala(oku, yaz, { kaynak: 'default', hedef: 'yeni', kuruGosterim: true });

    expect(yaz).not.toHaveBeenCalled();
    expect(veri.yeni).toBeUndefined();
    expect(sonuc.kopyalanan).toBe(2);
    expect(sonuc.kuruGosterim).toBe(true);
  });

  it('kaynakta olmayan alan "kaynakBos" olarak raporlanır', async () => {
    const { oku, yaz } = depoKur({ default: { rules: { a: 1 } } });
    const sonuc = await kiraciVerisiniKopyala(oku, yaz, { kaynak: 'default', hedef: 'yeni' });
    const bos = sonuc.satirlar.filter((s) => s.durum === 'kaynakBos');
    expect(bos.length).toBe(KOPYALANACAK_ALANLAR.length - 1);
  });

  it('tek alanın hatası kalanları DURDURMAZ', async () => {
    const { veri, oku, yaz } = depoKur({ default: { rules: { a: 1 }, 'game-settings': { b: 2 } } });
    yaz.mockImplementationOnce(async () => { throw new Error('disk dolu'); });

    const sonuc = await kiraciVerisiniKopyala(oku, yaz, { kaynak: 'default', hedef: 'yeni' });

    expect(sonuc.hatali).toBe(1);
    expect(sonuc.kopyalanan).toBe(1);
    expect(sonuc.satirlar.find((s) => s.durum === 'hata')?.mesaj).toBe('disk dolu');
    expect(veri.yeni['game-settings']).toEqual({ b: 2 });
  });

  it('aynı kiracıya kopyalamayı reddeder', async () => {
    const { oku, yaz } = depoKur();
    await expect(kiraciVerisiniKopyala(oku, yaz, { kaynak: 'default', hedef: 'default' }))
      .rejects.toThrow('aynı olamaz');
  });

  it('boş kaynak/hedef reddedilir', async () => {
    const { oku, yaz } = depoKur();
    await expect(kiraciVerisiniKopyala(oku, yaz, { kaynak: '', hedef: 'x' })).rejects.toThrow();
    await expect(kiraciVerisiniKopyala(oku, yaz, { kaynak: 'x', hedef: '  ' })).rejects.toThrow();
  });

  it('oyuncu verisi kopyalanacaklar listesinde DEĞİL', () => {
    // Form talepleri, nakit bonus defteri ve denetim kayitlari o SITENIN
    // oyuncularina ait; yeni siteye tasimak hic verilmemis bonuslari
    // oraya tasirdi ve mukerrer korumalari yanlis gecmise bakardi.
    const kopyalanan = new Set(KOPYALANACAK_ALANLAR.map((a) => a.namespace));
    for (const yasak of KOPYALANMAYAN_ALANLAR) {
      expect(kopyalanan.has(yasak)).toBe(false);
    }
  });

  it('null değer "kaynakBos" sayılır, kopyalanmaz', async () => {
    const { veri, oku, yaz } = depoKur({ default: { rules: null } });
    const sonuc = await kiraciVerisiniKopyala(oku, yaz, { kaynak: 'default', hedef: 'yeni' });
    expect(sonuc.kopyalanan).toBe(0);
    expect(veri.yeni).toBeUndefined();
  });
});
