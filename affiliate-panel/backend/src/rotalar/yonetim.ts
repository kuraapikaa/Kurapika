import type { FastifyInstance } from 'fastify';
import {
  adaptorAl,
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
import { kaliteRaporu, riskBandi } from '../servisler/trafikKalitesi.js';
import { ftdDurumu } from '../servisler/ilkYatirim.js';
import {
  gorunume,
  ortakGuncelle,
  ortakParolasiSifirla,
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

  /**
   * Backoffice'in gercek odeme yontemleri.
   *
   * Ortagin odeme yontemini serbest metin yazmasi "Papara", "papara",
   * "PAPARA TR" gibi uc ayri deger uretiyor ve odeme gunu hangisinin
   * hangisi oldugu elle cozuluyordu. Liste backoffice'ten geldigi icin
   * bu belirsizlik kaynaginda bitiyor.
   */
  app.get('/odeme-yontemleri', async (istek, yanit) => {
    const adaptor = await adaptorAl(istek.kiraci);
    if (!adaptor?.odemeYontemleri) {
      // 501 DEGIL bos liste: baglanti yoksa da panel calismali, ortagin
      // odeme yontemi alani serbest metne dusuyor.
      return { yontemler: [], kaynak: 'yok' as const };
    }
    try {
      return { yontemler: await adaptor.odemeYontemleri(), kaynak: 'backoffice' as const };
    } catch (hata) {
      yanit.status(200);
      return {
        yontemler: [],
        kaynak: 'hata' as const,
        mesaj: hata instanceof Error ? hata.message : 'Ödeme yöntemleri okunamadı.',
      };
    }
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

  /**
   * TRAFIK KALITESI VE RISK SIRALAMASI.
   *
   * Panel simdiye kadar yalnizca HACIM gosteriyordu; "bu trafik gercek
   * mi" sorusu ancak ay sonunda, odeme yapildiktan sonra ve elle fark
   * ediliyordu.
   *
   * Skor bir HUKUM DEGIL, bir siralama: yoneticinin sinirli dikkatini
   * hangi ortaga ayiracagini soyluyor. Bu yuzden bilesenler de
   * donuyor -- "78 risk" bir sey ifade etmiyor, "tiklamalarin %80'i tek
   * IP'den" ifade ediyor.
   */
  app.get('/trafik-kalitesi', async (istek) => {
    const sorgu = (istek.query ?? {}) as Record<string, unknown>;
    const [ortaklar, tiklamalar, olcumler] = await Promise.all([
      ortaklariListele(istek.kiraci),
      tiklamalariListele(istek.kiraci, {
        start: sorguMetni(sorgu.start),
        end: sorguMetni(sorgu.end),
        limit: 1000,
      }),
      olcumleriOku(istek.kiraci, { start: sorguMetni(sorgu.start), end: sorguMetni(sorgu.end) }),
    ]);

    const raporlar = ortaklar.map((o) => {
      const rapor = kaliteRaporu(o.ortakAnahtari, tiklamalar, olcumler);
      return { ...rapor, ortakAdi: o.ad, durum: o.durum, bant: riskBandi(rapor.riskSkoru) };
    });

    return {
      // Skorlu olanlar once ve riskliden temize: yonetici en ustten
      // asagi bakip birakabilsin. Skorsuzlar sona -- onlar hakkinda
      // soylenecek bir sey yok, siralamada yer kaplamamalilar.
      raporlar: raporlar.sort((a, b) => {
        if (a.riskSkoru === null && b.riskSkoru === null) return 0;
        if (a.riskSkoru === null) return 1;
        if (b.riskSkoru === null) return -1;
        return b.riskSkoru - a.riskSkoru;
      }),
    };
  });

  /**
   * BTAG (IZLEME ANAHTARI) YONETIMI.
   *
   * Asil degeri SAHIPSIZ anahtar tespiti: backoffice'ten olcum geliyor
   * ama o anahtara sahip bir ortak kaydi yok. Bu, atfedilmemis gelir
   * demek -- ya ortak silindi, ya anahtar elle degistirildi, ya da
   * backoffice'te panelde olmayan bir BTag tanimlanmis.
   *
   * Sessizce durdugu surece kimse fark etmiyor: rakamlar ortak
   * ozetinde gorunmuyor, hakedis hesabina girmiyor ve kimseye
   * odenmiyor.
   */
  app.get('/btag', async (istek) => {
    const [ortaklar, olcumler, tiklamalar] = await Promise.all([
      ortaklariListele(istek.kiraci),
      olcumleriOku(istek.kiraci),
      tiklamalariListele(istek.kiraci, { limit: 1000 }),
    ]);

    const kayitli = new Map(ortaklar.map((o) => [o.ortakAnahtari, o]));
    const olcumAnahtarlari = new Set(olcumler.map((o) => o.ortakAnahtari));
    const tiklamaAnahtarlari = new Set(tiklamalar.map((t) => t.ortakAnahtari));

    const sahipsiz = [...olcumAnahtarlari]
      .filter((a) => !kayitli.has(a))
      .map((anahtar) => {
        const kendi = olcumler.filter((o) => o.ortakAnahtari === anahtar);
        return {
          anahtar,
          gunSayisi: kendi.length,
          ggr: Math.round(kendi.reduce((t, o) => t + o.ggr, 0)),
          yatirim: Math.round(kendi.reduce((t, o) => t + o.yatirim, 0)),
          sonGun: kendi.map((o) => o.gun).sort().pop() ?? null,
        };
      })
      .sort((a, b) => b.ggr - a.ggr);

    return {
      anahtarlar: ortaklar.map((o) => ({
        anahtar: o.ortakAnahtari,
        ortakAdi: o.ad,
        durum: o.durum,
        olcumVar: olcumAnahtarlari.has(o.ortakAnahtari),
        tiklamaVar: tiklamaAnahtarlari.has(o.ortakAnahtari),
      })),
      sahipsiz,
      // Olcumu hic gelmemis anahtar: ortak var ama trafik yok. Yeni
      // ortakta normal, eski ortakta "link paylasildi mi?" sorusu.
      olcumsuzSayisi: ortaklar.filter((o) => !olcumAnahtarlari.has(o.ortakAnahtari)).length,
    };
  });

  /** İlk yatırım ölçümünün durumu; kalibrasyon sürüyorsa panel söylesin. */
  app.get('/ftd-durumu', async (istek) => ftdDurumu(istek.kiraci));

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

  /**
   * Parola sifirlama.
   *
   * "Ortaklarin parolalarini listele" teknik olarak imkansiz: depoda
   * scrypt ozeti var ve ozet geri cevrilemiyor. Yapilabilecek tek sey
   * yeni bir parola uretip BIR KEZ gostermek.
   *
   * Uretilen parola yalnizca bu yanitta donuyor; hicbir listede,
   * hicbir kayitta bir daha gorunmuyor.
   */
  app.post<{ Params: { id: string } }>('/ortaklar/:id/parola-sifirla', async (istek) =>
    ortakParolasiSifirla(istek.kiraci, istek.params.id));

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
