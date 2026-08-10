import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import type { YonetimUclari } from '../sozlesme.js';
import {
  adaptorAl,
  adaptorKatalogu,
  adaptorZorunlu,
  aktifBaglantilar,
  baglantilarGorunumu,
  baglantiyiSil,
  baglantiyiYaz,
  varsayilanBaglantiId,
} from '../adaptorler/kayit.js';
import { AdaptorHatasi } from '../adaptorler/tur.js';
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
import { otoBonusAyarla, otoBonusDurumu } from '../servisler/otoBonus.js';
import {
  cakismalariListele, eslesmeleriListele, oyuncuSayilariOrtakAnahtariyla, varsayilanEslesmeleriDagit,
} from '../servisler/oyuncuEslesme.js';
import { topluAtamaYap, TOPLU_ATAMA_LIMITI } from '../servisler/topluAtama.js';
import {
  postbackAyarla,
  postbackAyarlari,
  postbackAyariSil,
  postbackKayitlari,
} from '../servisler/postback.js';
import { anahtarDurumu, anahtarSil, anahtarUret } from '../servisler/s2sAnahtari.js';
import { eksikGunleriSenkronla, gunuSenkronla } from '../servisler/senkron.js';
import { gecmisGGRDoldur } from '../servisler/gecmisGGR.js';
import { sirDurumu, sirUret, sirriSil, sirriYaz } from '../servisler/webhookSirri.js';
import { siteAdresiDurumu, siteAdresiYaz } from '../servisler/siteAdresi.js';
import { olayKuyrugu } from '../depolar/olayKuyrugu.js';
import { bakiyeler, hareketEkle, hareketleriListele } from '../servisler/cuzdan.js';
import { geceHakedisiIsle } from '../isler/geceIsi.js';
import { veritabani } from '../lib/veritabani.js';
import { tiklamalariListele, tiklamaOzeti } from '../servisler/tiklama.js';
import { musteriYolculugu } from '../servisler/yolculuk.js';

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

  // ── Backoffice bağlantıları ──────────────────────────────────────────

  app.get('/adaptorler', async (): Promise<YonetimUclari['/adaptorler']> => ({ adaptorler: adaptorKatalogu() }));

  /**
   * ÇOKLU BAĞLANTI.
   *
   * Bir kiracı (marka) birden fazla Lynon SİTESİ işletebiliyor -- her
   * sitenin kendi backoffice adresi, kendi girişi var. Ortaklar TEK
   * listede kalıyor; bir ortağın getirdiği oyuncular birden fazla
   * bağlantıya dağılabiliyor, hakediş ortak bazında toplanıyor (bkz.
   * `adaptorler/kayit.ts` dosya başı açıklaması).
   *
   * Oyuncu kimlikleri yalnızca TEK bir Lynon sitesi içinde benzersiz;
   * bu yüzden `oyuncu_eslesmeleri`/`oyuncu_gunluk_rapor` artık bir
   * `baglantiId` sütunu taşıyor (bkz. `sema.ts`) ve toplu atama +
   * geçmiş GGR doldurma bunu KULLANIYOR:
   *
   *   - Toplu atama, isteğin gövdesindeki `baglantiId` ile HANGİ siteden
   *     arama yapılacağını admin'den açıkça alıyor (bkz. aşağıdaki uç).
   *   - Geçmiş GGR doldurma artık TEK bağlantı değil, TÜM aktif
   *     bağlantıları sırayla tarıyor (`aktifBaglantilar`) -- toplu
   *     atamayla ikinci bir siteden transfer edilen bir oyuncunun
   *     finansal verisi de bu sayede çekilebiliyor.
   *
   * `/senkron` (Lynon'un KENDİ third-party affiliate/BTag raporu) hâlâ
   * yalnızca İLK aktif bağlantıyı kullanıyor -- bu panelin ürettiği
   * trafik zaten BTag taşımadığı için o rapor pratikte hep boş dönüyor
   * (bkz. `gecmisGGR.ts` dosya başı), ikinci bir bağlantıya genişletmenin
   * bugün somut bir faydası yok.
   */
  app.get('/baglantilar', async (istek): Promise<YonetimUclari['/baglantilar']> => ({
    baglantilar: await baglantilarGorunumu(istek.kiraci),
  }));

  app.post('/baglantilar', async (istek): Promise<YonetimUclari['/baglantilar']> => {
    const govde = (istek.body ?? {}) as { ad?: string; adaptor?: string; ayar?: Record<string, unknown>; aktif?: boolean };
    await baglantiyiYaz(istek.kiraci, null, govde);
    return { baglantilar: await baglantilarGorunumu(istek.kiraci) };
  });

  app.put<{ Params: { id: string } }>('/baglantilar/:id', async (istek): Promise<YonetimUclari['/baglantilar']> => {
    const govde = (istek.body ?? {}) as { ad?: string; adaptor?: string; ayar?: Record<string, unknown>; aktif?: boolean };
    await baglantiyiYaz(istek.kiraci, istek.params.id, govde);
    return { baglantilar: await baglantilarGorunumu(istek.kiraci) };
  });

  app.delete<{ Params: { id: string } }>('/baglantilar/:id', async (istek) => {
    await baglantiyiSil(istek.kiraci, istek.params.id);
    return { silindi: true };
  });

  app.post<{ Params: { id: string } }>('/baglantilar/:id/dogrula', async (istek) => {
    const adaptor = await adaptorZorunlu(istek.kiraci, istek.params.id);
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
  app.get('/odeme-yontemleri', async (istek, yanit): Promise<YonetimUclari['/odeme-yontemleri']> => {
    const baglantiId = await varsayilanBaglantiId(istek.kiraci);
    const adaptor = baglantiId ? await adaptorAl(istek.kiraci, baglantiId) : null;
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

  app.get<{ Params: { id: string } }>('/baglantilar/:id/ortaklar', async (istek, yanit) => {
    const adaptor = await adaptorZorunlu(istek.kiraci, istek.params.id);
    if (!adaptor.ortaklariListele) {
      yanit.status(501);
      return { hata: 'Bu adaptör backoffice ortak listesini okuyamıyor.' };
    }
    return { ortaklar: await adaptor.ortaklariListele() };
  });

  app.post<{ Params: { id: string } }>('/baglantilar/:id/oyuncu-bagla', async (istek, yanit) => {
    const adaptor = await adaptorZorunlu(istek.kiraci, istek.params.id);
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

  /** Birden çok bağlantı varken hangisinin kullanılacağını çözer; hiçbiri kurulu değilse açıklayıcı hata. */
  async function calisilacakAdaptor(kiraci: string) {
    const id = await varsayilanBaglantiId(kiraci);
    if (!id) throw new AdaptorHatasi('Backoffice bağlantısı kurulu değil ya da pasif.', 409);
    return adaptorZorunlu(kiraci, id);
  }

  // ── Senkron ────────────────────────────────────────────────────────

  app.post('/senkron', async (istek) => {
    const govde = (istek.body ?? {}) as { gun?: string; geriGun?: number };
    const adaptor = await calisilacakAdaptor(istek.kiraci);
    if (govde.gun) {
      const yazilan = await gunuSenkronla(istek.kiraci, adaptor, String(govde.gun));
      return { cekilenGun: 1, yazilanOlcum: yazilan, hatali: [], uyari: null };
    }
    return eksikGunleriSenkronla(istek.kiraci, adaptor, { geriGun: Number(govde.geriGun) || 30 });
  });

  /**
   * Normal senkron BTag'siz satırları atlıyor -- panelin trafiği hiç
   * BTag taşımadığı için hep sıfır satır yazıyordu. Bu uç aynı raporu
   * OYUNCU bazında okuyup atfı panelin kendi eşleşme kaydından yapıyor
   * (bkz. `servisler/gecmisGGR.ts`).
   *
   * TÜM aktif bağlantılar sırayla taranıyor (tek değil): toplu atamayla
   * ikinci bir siteden transfer edilen bir oyuncunun rakamı da yalnızca
   * O sitenin raporundan gelebilir -- tek bağlantıda kalsaydı böyle bir
   * oyuncu kalıcı olarak 0 gösterirdi. Bağlantılardan biri geçici olarak
   * çökse bile (oturum/ağ hatası) diğerleri taranmaya devam ediyor.
   */
  app.post('/gecmis-ggr-doldur', async (istek) => {
    const govde = (istek.body ?? {}) as { geriGun?: number };
    const baglantilar = await aktifBaglantilar(istek.kiraci);
    if (baglantilar.length === 0) {
      throw new AdaptorHatasi('Backoffice bağlantısı kurulu değil ya da pasif.', 409);
    }

    const sonuc = {
      tarananGun: 0, eslesenOyuncuGunu: 0, yazilanOlcum: 0,
      hatali: [] as Array<{ gun: string; mesaj: string }>,
      uyari: null as string | null,
    };
    const uyarilar: string[] = [];
    for (const baglanti of baglantilar) {
      try {
        const adaptor = await adaptorZorunlu(istek.kiraci, baglanti.id);
        const parca = await gecmisGGRDoldur(istek.kiraci, adaptor, baglanti.id, { geriGun: Number(govde.geriGun) || 30 });
        sonuc.tarananGun += parca.tarananGun;
        sonuc.eslesenOyuncuGunu += parca.eslesenOyuncuGunu;
        sonuc.yazilanOlcum += parca.yazilanOlcum;
        sonuc.hatali.push(...parca.hatali);
        if (parca.uyari) uyarilar.push(`${baglanti.ad}: ${parca.uyari}`);
        // Gunluk hatalar sonuc.hatali'ya yaziliyor ama UI'da yalnizca
        // SAYISI gorunuyor -- bir baglanti HER gun ayni sebeple basarisiz
        // olduysa (orn. yanlis rapor kimligi) admin bunu Railway loglarina
        // bakmadan gorebilsin diye ornek mesaji da uyariya ekliyoruz.
        if (parca.hatali.length > 0) {
          uyarilar.push(`${baglanti.ad}: ${parca.hatali.length} gün alınamadı (${parca.hatali[0].mesaj})`);
        }
      } catch (hata) {
        // Bir baglantinin hatasi digerlerinin taranmasini engellememeli.
        uyarilar.push(`${baglanti.ad}: ${hata instanceof Error ? hata.message : 'bilinmeyen hata'}`);
      }
    }
    sonuc.uyari = uyarilar.length > 0 ? uyarilar.join(' · ') : null;
    return sonuc;
  });

  // ── Ölçümler ───────────────────────────────────────────────────────

  app.get('/ozet', async (istek): Promise<YonetimUclari['/ozet']> => {
    const sorgu = (istek.query ?? {}) as Record<string, unknown>;
    const ozetler = await ortakOzetleri(istek.kiraci, {
      start: sorguMetni(sorgu.start),
      end: sorguMetni(sorgu.end),
      ortakAnahtari: sorguMetni(sorgu.ortakAnahtari),
    });
    // `ozetle()`'in `oyuncuSayisi`'si (tek günün STOK zirvesi) burada
    // gösterilecek dogru rakam degil -- ortak paneliyle (bkz. PortalOzet
    // fix'i) aynı kümülatif kaynakla değiştiriyoruz ki iki panel farklı
    // sayı söylemesin.
    const gercekSayilar = await oyuncuSayilariOrtakAnahtariyla(istek.kiraci);
    return {
      bugun: gunAnahtari(),
      ozetler: ozetler.map((o) => ({
        ...o,
        oyuncuSayisi: gercekSayilar.get(o.ortakAnahtari) ?? o.oyuncuSayisi,
      })),
    };
  });

  app.get('/olcumler', async (istek): Promise<YonetimUclari['/olcumler']> => {
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
  app.get('/trafik-kalitesi', async (istek): Promise<YonetimUclari['/trafik-kalitesi']> => {
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
  app.get('/btag', async (istek): Promise<YonetimUclari['/btag']> => {
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

  // ── Cüzdanlar ──────────────────────────────────────────────────────

  app.get('/cuzdanlar', async (istek): Promise<YonetimUclari['/cuzdanlar']> => {
    if (!veritabani()) return { bakiyeler: [], hareketler: [], veritabaniVarMi: false };
    const [liste, hareketler, ortaklar] = await Promise.all([
      bakiyeler(istek.kiraci),
      hareketleriListele(istek.kiraci, { limit: 200 }),
      ortaklariListele(istek.kiraci),
    ]);
    const adlar = new Map(ortaklar.map((o) => [o.id, o.ad]));
    return {
      bakiyeler: liste.map((b) => ({ ...b, ortakAdi: adlar.get(b.ortakId) ?? null })),
      hareketler: hareketler.map((h) => ({ ...h, ortakAdi: adlar.get(h.ortakId) ?? null })),
      veritabaniVarMi: true,
    };
  });

  /**
   * Ortağa yapılan ödemeyi deftere yazar (bakiyeden düşer).
   *
   * Tutar POZİTİF geliyor, deftere NEGATİF yazılıyor: kullanıcı "5000
   * ödedim" der, defter "bakiye 5000 azaldı" tutar.
   */
  app.post('/cuzdan/odeme', async (istek, yanit) => {
    const govde = (istek.body ?? {}) as { ortakId?: unknown; tutar?: unknown; aciklama?: unknown };
    const ortakId = String(govde.ortakId ?? '').trim();
    const tutar = Number(govde.tutar);
    if (!ortakId) return yanit.status(400).send({ hata: 'ortakId zorunlu.' });
    if (!Number.isFinite(tutar) || tutar <= 0) {
      return yanit.status(400).send({ hata: 'tutar sıfırdan büyük olmalı.' });
    }

    await hareketEkle(istek.kiraci, {
      ortakId,
      tur: 'odeme',
      tutar: -Math.abs(tutar),
      aciklama: String(govde.aciklama ?? '').trim() || 'Ödeme',
      // Her odeme ayri bir olay; tekrar korumasi yok cunku ayni tutarda
      // iki gercek odeme yapilabilir.
      kaynakAnahtari: `odeme:${randomUUID()}`,
    });
    return yanit.status(201).send({ durum: 'yazildi' });
  });

  /** Gece işini elle tetikler; beklemeden dönmüyor ki sonuç görülebilsin. */
  app.post('/cuzdan/tahakkuk', async (istek, yanit) => {
    if (!veritabani()) return yanit.status(503).send({ hata: 'Cüzdan için veritabanı gerekli.' });
    return yanit.send(await geceHakedisiIsle(istek.kiraci));
  });

  // ── Lynon webhook ──────────────────────────────────────────────────

  app.get('/webhook-durumu', async (istek): Promise<YonetimUclari['/webhook-durumu']> => ({
    sir: await sirDurumu(istek.kiraci),
    // Kuyruk tabloda; veritabani yoksa webhook zaten kabul edilmiyor.
    kuyruk: veritabani()
      ? await olayKuyrugu().ozet(istek.kiraci)
      : { bekleyen: 0, isleniyor: 0, tamam: 0, hatali: 0 },
    veritabaniVarMi: Boolean(veritabani()),
  }));

  /**
   * Sırrı kurar. Gövdede `sir` varsa Lynon'un verdiği değer kaydedilir;
   * yoksa üretilip BİR KEZ döndürülür.
   */
  app.post('/webhook-sirri', async (istek, yanit) => {
    const govde = (istek.body ?? {}) as { sir?: unknown };
    const verilen = typeof govde.sir === 'string' ? govde.sir.trim() : '';
    if (verilen) {
      await sirriYaz(istek.kiraci, verilen);
      return yanit.status(201).send({ uretildi: false });
    }
    const sir = await sirUret(istek.kiraci);
    return yanit.status(201).send({ uretildi: true, sir, uyari: 'Bu değer bir daha gösterilmeyecek.' });
  });

  app.delete('/webhook-sirri', async (istek, yanit) => {
    await sirriSil(istek.kiraci);
    return yanit.status(204).send();
  });

  /** İlk yatırım ölçümünün durumu; kalibrasyon sürüyorsa panel söylesin. */
  app.get('/ftd-durumu', async (istek): Promise<YonetimUclari['/ftd-durumu']> => ftdDurumu(istek.kiraci));

  // ── Oyuncu eşleşmeleri ─────────────────────────────────────────────

  app.get('/oyuncu-eslesmeleri', async (istek): Promise<YonetimUclari['/oyuncu-eslesmeleri']> => {
    const [eslesmeler, cakismalar, ortaklar, anahtar, baglantilar] = await Promise.all([
      eslesmeleriListele(istek.kiraci, { limit: 500 }),
      cakismalariListele(istek.kiraci, 200),
      ortaklariListele(istek.kiraci),
      anahtarDurumu(istek.kiraci),
      baglantilarGorunumu(istek.kiraci),
    ]);

    const adlar = new Map(ortaklar.map((o) => [o.id, o.ad]));
    // Birden fazla baglanti varsa admin hangi eslesmenin hangi Lynon
    // sitesinden geldigini gormeli -- tek baglantili kiracida hep tek
    // deger cikar, ekranda gereksiz gurultu yaratmaz (bkz. Eslesmeler.tsx).
    const baglantiAdlari = new Map(baglantilar.map((b) => [b.id, b.ad]));
    return {
      eslesmeler: eslesmeler.map((e) => ({
        ...e,
        ortakAdi: adlar.get(e.ortakId) ?? null,
        baglantiAdi: baglantiAdlari.get(e.baglantiId) ?? e.baglantiId,
      })),
      cakismalar: cakismalar.map((c) => ({
        ...c,
        denenenOrtakAdi: adlar.get(c.denenenOrtakId) ?? null,
        mevcutOrtakAdi: adlar.get(c.mevcutOrtakId) ?? null,
      })),
      anahtar,
    };
  });

  /**
   * KULLANICI ADINDAN TOPLU AFFİLİATE GEÇİŞİ.
   *
   * Girdi doğrudan büyük olabilir (yapıştırılmış liste); alan doğrulaması
   * ve satır bazlı sonuç `topluAtamaYap` içinde. Burada yalnızca adaptörü
   * çözüp iş kuralına devrediyoruz.
   *
   * `baglantiId` gövdeden geliyor: admin HANGİ Lynon sitesinden arama
   * yapılacağını seçiyor (bkz. `Eslesmeler.tsx`'teki site seçici).
   * Boş/eksikse ilk aktif bağlantıya düşer -- tek bağlantılı (bugüne
   * kadarki HER) kiracıda davranış birebir aynı kalır.
   */
  app.post('/oyuncu-eslesmeleri/toplu-atama', async (istek) => {
    const govde = (istek.body ?? {}) as { kullaniciAdlari?: unknown; ortakAnahtari?: unknown; baglantiId?: unknown };
    const baglantiId = String(govde.baglantiId ?? '').trim() || await varsayilanBaglantiId(istek.kiraci);
    if (!baglantiId) throw new AdaptorHatasi('Backoffice bağlantısı kurulu değil ya da pasif.', 409);
    const adaptor = await adaptorZorunlu(istek.kiraci, baglantiId);
    return topluAtamaYap(
      istek.kiraci,
      adaptor,
      baglantiId,
      String(govde.kullaniciAdlari ?? ''),
      String(govde.ortakAnahtari ?? ''),
    );
  });

  app.get('/oyuncu-eslesmeleri/toplu-atama-siniri', async (): Promise<YonetimUclari['/oyuncu-eslesmeleri/toplu-atama-siniri']> => ({
    limit: TOPLU_ATAMA_LIMITI,
  }));

  /**
   * ÇOKLU BAĞLANTI GÖÇÜ.
   *
   * Çoklu bağlantıya geçmeden önce yazılmış eşleşmeler `'varsayilan'`
   * taşıyor; o kimlik artık hiçbir aktif bağlantıyla eşleşmiyorsa bu
   * oyuncular geçmiş GGR taramasında sonsuza dek atlanır (bkz.
   * `oyuncuEslesme.ts` · `varsayilanEslesmeleriDagit`). Bu uç, her
   * orphan kaydı aktif bağlantıların KENDİ backoffice'inde arayarak
   * doğrulayıp doğru bağlantıya taşır -- tahmin etmez, bulamadığını
   * ya da birden fazla yerde bulduğunu olduğu gibi bırakır.
   */
  app.post('/oyuncu-eslesmeleri/varsayilan-dagit', async (istek): Promise<YonetimUclari['/oyuncu-eslesmeleri/varsayilan-dagit']> => {
    const baglantilar = await aktifBaglantilar(istek.kiraci);
    if (baglantilar.length === 0) {
      throw new AdaptorHatasi('Backoffice bağlantısı kurulu değil ya da pasif.', 409);
    }
    return varsayilanEslesmeleriDagit(
      istek.kiraci,
      baglantilar.map((b) => ({ id: b.id, ad: b.ad })),
      (baglantiId) => adaptorZorunlu(istek.kiraci, baglantiId),
    );
  });

  /**
   * S2S anahtarı üretir. Düz metin YALNIZCA burada, bir kez dönüyor;
   * saklanmadığı için ikinci kez gösterilemez.
   */
  app.post('/s2s-anahtari', async (istek, yanit) => {
    const anahtar = await anahtarUret(istek.kiraci);
    return yanit.status(201).send({ anahtar, uyari: 'Bu anahtar bir daha gösterilmeyecek.' });
  });

  app.delete('/s2s-anahtari', async (istek, yanit) => {
    await anahtarSil(istek.kiraci);
    return yanit.status(204).send();
  });

  // ── Ortaklar ───────────────────────────────────────────────────────

  app.get('/ortaklar', async (istek): Promise<YonetimUclari['/ortaklar']> => ({ ortaklar: await ortaklariListele(istek.kiraci) }));

  /**
   * Bekleyen başvurular.
   *
   * Ayrı bir uç: yönetici günde bir kez "yeni başvuru var mı" diye
   * bakıyor ve bunun için tüm ortak listesini çekip istemcide
   * filtrelemek, ortak sayısı büyüdükçe boşa taşınan veri demek.
   * En eski başvuru başta — sırada bekleyen en uzun süre bekleyendir.
   */
  app.get('/basvurular', async (istek): Promise<YonetimUclari['/basvurular']> => {
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

  app.get('/planlar', async (istek): Promise<YonetimUclari['/planlar']> => ({ planlar: await planlariListele(istek.kiraci) }));

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

  // ── Site adresi ────────────────────────────────────────────────────

  /**
   * Sitenin güncel (erişim engeli sonrası değişebilen) adresi.
   *
   * Medyasız alt linkler (bkz. `tiklamaUcu.ts`) buraya yönlendirir; her
   * medya kaydında ayrı ayrı güncellenmesi gereken bir alan olsaydı biri
   * unutulduğunda o kanal sessizce ölü bir adrese düşerdi.
   */
  app.get('/site-adresi', async (istek): Promise<YonetimUclari['/site-adresi']> => siteAdresiDurumu(istek.kiraci));

  app.put('/site-adresi', async (istek) => {
    const govde = (istek.body ?? {}) as { adres?: string };
    return siteAdresiYaz(istek.kiraci, String(govde.adres ?? ''));
  });

  // ── Medya ──────────────────────────────────────────────────────────

  app.get('/medya', async (istek): Promise<YonetimUclari['/medya']> => ({ medyalar: await medyalariListele(istek.kiraci) }));

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

  app.get('/kademeler', async (istek): Promise<YonetimUclari['/kademeler']> => kademeDurumu(istek.kiraci));

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

  app.get('/postback', async (istek): Promise<YonetimUclari['/postback']> => ({
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

  // ── Oto bonus (WhatsApp CRM) ───────────────────────────────────────

  app.get('/oto-bonus', async (istek): Promise<YonetimUclari['/oto-bonus']> =>
    otoBonusDurumu(istek.kiraci));

  app.put('/oto-bonus', async (istek): Promise<YonetimUclari['/oto-bonus']> => {
    await otoBonusAyarla(
      istek.kiraci,
      (istek.body ?? {}) as { aktif?: unknown; tutarKurus?: unknown; bonusKodu?: unknown; not?: unknown },
    );
    return otoBonusDurumu(istek.kiraci);
  });

  // ── Tıklamalar ─────────────────────────────────────────────────────

  app.get('/tiklamalar', async (istek): Promise<YonetimUclari['/tiklamalar']> => {
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

  /**
   * MÜŞTERİ YOLCULUĞU — tıklamadan ilk yatırıma huni.
   *
   * `ortakAnahtari` boşsa TÜM ortaklar birlikte. Bu uç, tek bir ortağın
   * portaldan gördüğü uçla (`/api/portal/yolculuk`) aynı servisi
   * çağırıyor; fark yalnızca filtrenin nereden geldiği.
   */
  app.get('/yolculuk', async (istek): Promise<YonetimUclari['/yolculuk']> => {
    const sorgu = (istek.query ?? {}) as Record<string, unknown>;
    return musteriYolculugu(istek.kiraci, {
      start: sorguMetni(sorgu.start),
      end: sorguMetni(sorgu.end),
      ortakAnahtari: sorguMetni(sorgu.ortakAnahtari),
    });
  });

  // ── Hakediş dönemleri ──────────────────────────────────────────────

  app.get('/donemler', async (istek): Promise<YonetimUclari['/donemler']> => ({ donemler: await donemleriListele(istek.kiraci) }));

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
