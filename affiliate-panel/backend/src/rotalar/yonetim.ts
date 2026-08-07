import type { FastifyInstance } from 'fastify';
import {
  adaptorKatalogu,
  adaptorZorunlu,
  baglantiGorunumu,
  baglantiyiSil,
  baglantiyiYaz,
} from '../adaptorler/kayit.js';
import { yoneticiZorunlu } from '../kimlik/koruma.js';
import { gunAnahtari } from '../lib/gunler.js';
import {
  donemHesapla,
  donemleriListele,
  donemOdendi,
  donemOku,
  donemOnayla,
} from '../servisler/hakedis.js';
import {
  kademeBagiKaldir,
  kademeBagiKur,
  kademeDurumu,
  kademeYuzdeleriniAyarla,
} from '../servisler/kademeler.js';
import {
  planlariListele,
  planGuncelle,
  planOlustur,
  planSil,
} from '../servisler/komisyon.js';
import {
  medyalariListele,
  medyaGuncelle,
  medyaOlustur,
  medyaSil,
} from '../servisler/medya.js';
import { olcumleriOku, ortakOzetleri } from '../servisler/olcum.js';
import {
  gorunume,
  ortakGuncelle,
  ortakOlustur,
  ortaklariListele,
  ortakSil,
} from '../servisler/ortaklar.js';
import {
  postbackAyarla,
  postbackAyarlari,
  postbackAyariSil,
  postbackKayitlari,
} from '../servisler/postback.js';
import { eksikGunleriSenkronla, gunuSenkronla } from '../servisler/senkron.js';
import { tiklamalariListele, tiklamaOzeti } from '../servisler/tiklama.js';

/**
 * YÖNETİM ROTALARI.
 *
 * Hepsi yönetici oturumu istiyor. Kiracı anahtarı İSTEK GÖVDESİNDEN
 * DEĞİL, oturumdan geliyor (`istek.kiraci`, `app.ts`'te oturuma göre
 * çözülüyor) — gövdeden almak, bir yöneticinin başka bir kiracının
 * verisini düzenleyebilmesi demek olurdu.
 */

const sorguMetni = (deger: unknown): string | undefined => {
  const metin = String(deger ?? '').trim();
  return metin || undefined;
};

export async function yonetimRotalari(app: FastifyInstance): Promise<void> {
  // Kanca YANITI DONDURUYOR: Fastify'da `async` bir kancada yanit
  // gonderip `undefined` donmek, istegin akmaya devam etmesine yol acar
  // ve butun yonetim uclari kimliksiz calisirdi.
  app.addHook('onRequest', async (istek, yanit) => {
    if (!yoneticiZorunlu(istek, yanit)) return yanit;
  });

  // ── Backoffice bağlantısı ──────────────────────────────────────────

  app.get('/adaptorler', async () => ({ adaptorler: adaptorKatalogu() }));

  app.get('/baglanti', async (istek) => baglantiGorunumu(istek.kiraci));

  app.put('/baglanti', async (istek) => {
    const govde = (istek.body ?? {}) as { adaptor?: string; ayar?: Record<string, unknown>; aktif?: boolean };
    await baglantiyiYaz(istek.kiraci, govde);
    return baglantiGorunumu(istek.kiraci);
  });

  app.delete('/baglanti', async (istek) => {
    await baglantiyiSil(istek.kiraci);
    return { silindi: true };
  });

  app.post('/baglanti/dogrula', async (istek) => {
    const adaptor = await adaptorZorunlu(istek.kiraci);
    return adaptor.dogrula();
  });

  app.get('/baglanti/ortaklar', async (istek, yanit) => {
    const adaptor = await adaptorZorunlu(istek.kiraci);
    if (!adaptor.ortaklariListele) {
      yanit.status(501);
      return { hata: 'Bu adaptör backoffice ortak listesini okuyamıyor.' };
    }
    return { ortaklar: await adaptor.ortaklariListele() };
  });

  app.post('/baglanti/oyuncu-bagla', async (istek, yanit) => {
    const adaptor = await adaptorZorunlu(istek.kiraci);
    if (!adaptor.oyuncuyuBagla) {
      yanit.status(501);
      return { hata: 'Bu adaptör oyuncu bağlamayı desteklemiyor.' };
    }
    const govde = (istek.body ?? {}) as { oyuncuId?: string; ortakAnahtari?: string; ek?: Record<string, string> };
    return adaptor.oyuncuyuBagla({
      oyuncuId: String(govde.oyuncuId ?? ''),
      ortakAnahtari: String(govde.ortakAnahtari ?? ''),
      ek: govde.ek,
    });
  });

  // ── Senkron ────────────────────────────────────────────────────────

  app.post('/senkron', async (istek) => {
    const govde = (istek.body ?? {}) as { gun?: string; geriGun?: number };
    if (govde.gun) {
      const yazilan = await gunuSenkronla(istek.kiraci, String(govde.gun));
      return { cekilenGun: 1, yazilanOlcum: yazilan, hatali: [], uyari: null };
    }
    return eksikGunleriSenkronla(istek.kiraci, { geriGun: Number(govde.geriGun) || 30 });
  });

  // ── Ölçümler ───────────────────────────────────────────────────────

  app.get('/ozet', async (istek) => {
    const sorgu = (istek.query ?? {}) as Record<string, unknown>;
    return {
      bugun: gunAnahtari(),
      ozetler: await ortakOzetleri(istek.kiraci, {
        start: sorguMetni(sorgu.start),
        end: sorguMetni(sorgu.end),
        ortakAnahtari: sorguMetni(sorgu.ortakAnahtari),
      }),
    };
  });

  app.get('/olcumler', async (istek) => {
    const sorgu = (istek.query ?? {}) as Record<string, unknown>;
    return {
      olcumler: await olcumleriOku(istek.kiraci, {
        start: sorguMetni(sorgu.start),
        end: sorguMetni(sorgu.end),
        ortakAnahtari: sorguMetni(sorgu.ortakAnahtari),
      }),
    };
  });

  // ── Ortaklar ───────────────────────────────────────────────────────

  app.get('/ortaklar', async (istek) => ({ ortaklar: await ortaklariListele(istek.kiraci) }));

  /**
   * Bekleyen başvurular.
   *
   * Ayrı bir uç: yönetici günde bir kez "yeni başvuru var mı" diye
   * bakıyor ve bunun için tüm ortak listesini çekip istemcide
   * filtrelemek, ortak sayısı büyüdükçe boşa taşınan veri demek.
   * En eski başvuru başta — sırada bekleyen en uzun süre bekleyendir.
   */
  app.get('/basvurular', async (istek) => {
    const ortaklar = await ortaklariListele(istek.kiraci);
    return {
      basvurular: ortaklar
        .filter((o) => o.durum === 'bekliyor')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  });

  // `gorunume` ZORUNLU: servis tam kaydı döndürüyor ve içinde parola
  // özeti var. Doğrudan göndermek, özeti ağdan dışarı çıkarmak olurdu —
  // listede maskelenip burada unutulması tam olarak bu tür bir hata.
  app.post('/ortaklar', async (istek, yanit) => {
    yanit.status(201);
    return gorunume(await ortakOlustur(istek.kiraci, (istek.body ?? {}) as Record<string, string>));
  });

  app.put<{ Params: { id: string } }>('/ortaklar/:id', async (istek) =>
    gorunume(await ortakGuncelle(istek.kiraci, istek.params.id, (istek.body ?? {}) as Record<string, string>)));

  app.delete<{ Params: { id: string } }>('/ortaklar/:id', async (istek) => {
    await ortakSil(istek.kiraci, istek.params.id);
    return { silindi: true };
  });

  // ── Komisyon planları ──────────────────────────────────────────────

  app.get('/planlar', async (istek) => ({ planlar: await planlariListele(istek.kiraci) }));

  app.post('/planlar', async (istek, yanit) => {
    yanit.status(201);
    return planOlustur(istek.kiraci, (istek.body ?? {}) as Record<string, unknown>);
  });

  app.put<{ Params: { id: string } }>('/planlar/:id', async (istek) =>
    planGuncelle(istek.kiraci, istek.params.id, (istek.body ?? {}) as Record<string, unknown>));

  app.delete<{ Params: { id: string } }>('/planlar/:id', async (istek) => {
    await planSil(istek.kiraci, istek.params.id);
    return { silindi: true };
  });

  // ── Medya ──────────────────────────────────────────────────────────

  app.get('/medya', async (istek) => ({ medyalar: await medyalariListele(istek.kiraci) }));

  app.post('/medya', async (istek, yanit) => {
    yanit.status(201);
    return medyaOlustur(istek.kiraci, (istek.body ?? {}) as Record<string, unknown>);
  });

  app.put<{ Params: { id: string } }>('/medya/:id', async (istek) =>
    medyaGuncelle(istek.kiraci, istek.params.id, (istek.body ?? {}) as Record<string, unknown>));

  app.delete<{ Params: { id: string } }>('/medya/:id', async (istek) => {
    await medyaSil(istek.kiraci, istek.params.id);
    return { silindi: true };
  });

  // ── Kademeler ──────────────────────────────────────────────────────

  app.get('/kademeler', async (istek) => kademeDurumu(istek.kiraci));

  app.post('/kademeler/bag', async (istek) => {
    const govde = (istek.body ?? {}) as { ortakAnahtari?: string; ustOrtakAnahtari?: string };
    return kademeBagiKur(istek.kiraci, String(govde.ortakAnahtari ?? ''), String(govde.ustOrtakAnahtari ?? ''));
  });

  app.delete<{ Params: { ortakAnahtari: string } }>('/kademeler/bag/:ortakAnahtari', async (istek) => {
    await kademeBagiKaldir(istek.kiraci, istek.params.ortakAnahtari);
    return { silindi: true };
  });

  app.put('/kademeler/yuzdeler', async (istek) => {
    const govde = (istek.body ?? {}) as { yuzdeler?: number[] };
    return { kademeYuzdeleri: await kademeYuzdeleriniAyarla(istek.kiraci, govde.yuzdeler ?? []) };
  });

  // ── Postback ───────────────────────────────────────────────────────

  app.get('/postback', async (istek) => ({
    ayarlar: await postbackAyarlari(istek.kiraci),
    kayitlar: await postbackKayitlari(istek.kiraci),
  }));

  app.put('/postback', async (istek) =>
    postbackAyarla(
      istek.kiraci,
      (istek.body ?? {}) as { ortakAnahtari?: string; sablon?: string; olaylar?: string[]; aktif?: boolean },
    ));

  app.delete<{ Params: { ortakAnahtari: string } }>('/postback/:ortakAnahtari', async (istek) => {
    await postbackAyariSil(istek.kiraci, istek.params.ortakAnahtari);
    return { silindi: true };
  });

  // ── Tıklamalar ─────────────────────────────────────────────────────

  app.get('/tiklamalar', async (istek) => {
    const sorgu = (istek.query ?? {}) as Record<string, unknown>;
    return {
      ozet: await tiklamaOzeti(istek.kiraci, {
        ortakAnahtari: sorguMetni(sorgu.ortakAnahtari),
        start: sorguMetni(sorgu.start),
        end: sorguMetni(sorgu.end),
      }),
      tiklamalar: await tiklamalariListele(istek.kiraci, {
        ortakAnahtari: sorguMetni(sorgu.ortakAnahtari),
        start: sorguMetni(sorgu.start),
        end: sorguMetni(sorgu.end),
        limit: Number(sorgu.limit) || 200,
      }),
    };
  });

  // ── Hakediş dönemleri ──────────────────────────────────────────────

  app.get('/donemler', async (istek) => ({ donemler: await donemleriListele(istek.kiraci) }));

  app.get<{ Params: { ay: string } }>('/donemler/:ay', async (istek, yanit) => {
    const donem = await donemOku(istek.kiraci, istek.params.ay);
    if (!donem) {
      yanit.status(404);
      return { hata: 'Dönem henüz hesaplanmadı.' };
    }
    return donem;
  });

  app.post<{ Params: { ay: string } }>('/donemler/:ay/hesapla', async (istek) => {
    const govde = (istek.body ?? {}) as { zorla?: boolean };
    return donemHesapla(istek.kiraci, istek.params.ay, { zorla: govde.zorla === true });
  });

  app.post<{ Params: { ay: string } }>('/donemler/:ay/onayla', async (istek) =>
    donemOnayla(istek.kiraci, istek.params.ay));

  app.post<{ Params: { ay: string } }>('/donemler/:ay/odendi', async (istek) =>
    donemOdendi(istek.kiraci, istek.params.ay));
}
