import { randomUUID } from 'crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { olayKuyrugu, olayTuruMu } from '../depolar/olayKuyrugu.js';
import { olaylariIsle } from '../isler/olayIsleyici.js';
import { IMZA_BASLIGI, imzayiDogrula } from '../servisler/webhookImza.js';
import { sirriOku } from '../servisler/webhookSirri.js';

/**
 * LYNON WEBHOOK UCU.
 *
 * ── Sıra önemli: ÖNCE İMZA, SONRA AYRIŞTIRMA ──
 *
 * Gövde, imza doğrulanana kadar JSON'a çevrilmiyor. Doğrulanmamış
 * girdiyi ayrıştırmak, saldırgana kimlik doğrulamasından ÖNCE çalışan
 * bir kod yolu verir. Ayrıca imza ham metin üzerinden hesaplandığı için
 * çözüp yeniden dizmek imzayı zaten bozardı.
 *
 * ── "Hemen 200 dön" ne demek, ne demek DEĞİL ──
 *
 * İşleme asenkron: olay kuyruğa yazılıp yanıt dönüyor, GGR hesabı ve
 * toplamlar ayrı yürüyor. Ama YAZMA beklenmeden 200 dönmüyor — o
 * durumda süreç yazmadan ölse Lynon 200 aldığı için tekrar göndermez ve
 * olay sessizce kaybolurdu. Kuyruğa yazma tek satırlık bir ekleme;
 * pahalı olan iş sonrasında.
 *
 * İşçiye haber veriliyor ama BEKLENMİYOR (`void`): gecikmeyi işleme
 * süresine bağlamamak için.
 */

interface HamGovdeliIstek extends FastifyRequest {
  hamGovde?: string;
}

interface OlayGovdesi {
  eventType?: unknown;
  playerId?: unknown;
  amount?: unknown;
}

const sayi = (deger: unknown): number => {
  const n = typeof deger === 'string' ? Number(deger) : deger;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};

export async function webhookRotalari(app: FastifyInstance): Promise<void> {
  /*
   * Ham govdeyi saklayan ayristirici. Fastify eklentileri kapsulli
   * oldugu icin bu yalnizca BU eklentinin rotalarini etkiliyor; panelin
   * geri kalani standart JSON ayristirmasiyla calismaya devam ediyor.
   */
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (istek, govde, bitti) => {
    (istek as HamGovdeliIstek).hamGovde = typeof govde === 'string' ? govde : '';
    // Govde BURADA ayristirilmiyor: imza once dogrulanacak.
    bitti(null, undefined);
  });

  app.post('/lynon', {
    config: {
      // Gecerli bir Lynon akisi bu hizi asmaz; asan trafik ya yanlis
      // yapilandirma ya da imza deneme girisimidir.
      rateLimit: { max: 600, timeWindow: '1 minute' },
    },
  }, async (istek, yanit) => {
    const hamGovde = (istek as HamGovdeliIstek).hamGovde ?? '';
    const sir = await sirriOku(istek.kiraci);

    const dogrulama = imzayiDogrula(sir, istek.headers as Record<string, unknown>, hamGovde);
    if (!dogrulama.gecerli) {
      // Sebep ISTEMCIYE verilmiyor: "imza tutmadi" ile "zaman disi"
      // ayrimi, saldirgana neyi duzeltmesi gerektigini soylerdi.
      // Gunluge yaziliyor, cunku yanlis yapilandirmayi ancak buradan
      // teshis edebiliyoruz.
      istek.log.warn({ sebep: dogrulama.sebep, kiraci: istek.kiraci }, 'Webhook imzası reddedildi');
      return yanit.status(401).send({ hata: 'Yetkisiz.' });
    }

    let govde: OlayGovdesi;
    try {
      govde = JSON.parse(hamGovde) as OlayGovdesi;
    } catch {
      return yanit.status(400).send({ hata: 'Gövde geçerli JSON değil.' });
    }

    const olayTuru = govde.eventType;
    if (!olayTuruMu(olayTuru)) {
      // Bilinmeyen tur KUYRUGA ALINMIYOR: isci onu asla isleyemez ve
      // kuyrukta kalici bir hata satiri olarak birikirdi.
      return yanit.status(400).send({ hata: 'eventType geçersiz.' });
    }

    const oyuncuId = String(govde.playerId ?? '').trim();
    if (!oyuncuId) return yanit.status(400).send({ hata: 'playerId zorunlu.' });

    const imza = String(istek.headers[IMZA_BASLIGI] ?? '');
    const { eklendi } = await olayKuyrugu().ekle(istek.kiraci, {
      id: randomUUID(),
      imza,
      olayTuru,
      oyuncuId,
      tutar: sayi(govde.amount),
      govde,
      alindi: new Date().toISOString(),
    });

    // Isciye haber ver ama BEKLEME. Hata da yutuluyor: olay kuyrukta
    // duruyor ve bir sonraki turda yeniden alinacak.
    if (eklendi) void olaylariIsle(istek.kiraci).catch(() => undefined);

    return yanit.status(200).send({
      durum: 'alindi',
      // Tekrar gonderilen istek de 200 aliyor -- Lynon acisindan islem
      // basarili, bizim acimizdan yeni bir olay yok.
      yeni: eklendi,
    });
  });
}
