import type { FastifyInstance, FastifyRequest } from 'fastify';
import { hataDurumu } from '../app.js';
import { oyuncuyuEslestir, type EslesmeSonucu } from '../servisler/oyuncuEslesme.js';
import { anahtarGecerliMi } from '../servisler/s2sAnahtari.js';

/**
 * OYUNCU KAYIT BİLDİRİMİ (sunucudan sunucuya).
 *
 * Oyuncu ortağın linkinden gelip siteye kaydoluyor; site onu Lynon'a
 * kaydettiriyor ve Lynon oyuncu kimliğini döndürüyor. Site o kimliği
 * buraya bildiriyor ve eşleşme kuruluyor.
 *
 * ── Neden tarayıcıdan DEĞİL ──
 *
 * Bu uç "şu oyuncu şu ortağa ait" diyebiliyor; yani doğrudan paraya
 * dokunuyor. Tarayıcıdan çağrılabilseydi herkes kendi ortak kodunu
 * herhangi bir oyuncuya yazabilirdi. Çağrı sunucudan geliyor ve kiracıya
 * ait S2S anahtarıyla imzalanıyor.
 *
 * Yanıt HER ZAMAN 200: bildirim kabul edildi mi edilmedi mi bilgisi
 * gövdedeki `durum` alanında. Reddi HTTP hatasıyla bildirmek, sitenin
 * yeniden deneme mantığını tetikler ve aynı reddedilen istek sonsuza
 * kadar tekrarlanırdı. Gerçek hatalar (bozuk istek, bilinmeyen ortak)
 * yine HTTP hatası döner.
 */

interface KayitGovdesi {
  lynonOyuncuId?: unknown;
  ref?: unknown;
}

function anahtarOku(istek: FastifyRequest): string {
  const yetki = String(istek.headers.authorization ?? '').trim();
  if (yetki.toLowerCase().startsWith('bearer ')) return yetki.slice(7).trim();
  return String(istek.headers['x-aff-anahtar'] ?? '').trim();
}

const metin = (deger: unknown): string => (typeof deger === 'string' ? deger.trim() : '');

export async function kayitRotalari(app: FastifyInstance): Promise<void> {
  app.post('/oyuncu', {
    config: {
      // Kayit bildirimi seyrek; bu ucun yuksek hizda dovulmesi normal bir
      // kullanim degil, anahtar deneme girisimidir.
      rateLimit: { max: 120, timeWindow: '1 minute' },
    },
  }, async (istek, yanit) => {
    if (!(await anahtarGecerliMi(istek.kiraci, anahtarOku(istek)))) {
      // Sebep verilmiyor: "anahtar yok" ile "anahtar yanlis" ayrimi,
      // disaridan kiracinin kurulu olup olmadigini sayilabilir kilardi.
      return yanit.status(401).send({ hata: 'Yetkisiz.' });
    }

    const govde = (istek.body ?? {}) as KayitGovdesi;
    try {
      const sonuc: EslesmeSonucu = await oyuncuyuEslestir(istek.kiraci, {
        lynonOyuncuId: metin(govde.lynonOyuncuId),
        ref: metin(govde.ref),
      });

      return yanit.send({
        durum: sonuc.durum,
        eslesme: {
          lynonOyuncuId: sonuc.eslesme.lynonOyuncuId,
          ortakId: sonuc.eslesme.ortakId,
          ortakAnahtari: sonuc.eslesme.ortakAnahtari,
          clickId: sonuc.eslesme.clickId,
          medyaId: sonuc.eslesme.medyaId,
          olusturuldu: sonuc.eslesme.olusturuldu,
        },
      });
    } catch (hata) {
      const durum = hataDurumu(hata);
      return yanit.status(durum).send({ hata: (hata as Error).message });
    }
  });
}
