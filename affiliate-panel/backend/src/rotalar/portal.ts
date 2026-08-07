import QRCode from 'qrcode';
import type { FastifyInstance } from 'fastify';
import { ortakZorunlu } from '../kimlik/koruma.js';
import {
  altLinkDurumDegistir,
  altLinkleriListele,
  altLinkOlustur,
  altLinkSil,
} from '../servisler/altLink.js';
import { gunAnahtari, gunEkle } from '../lib/gunler.js';
import { donemleriListele, ortakDonemi } from '../servisler/hakedis.js';
import { altOrtaklar } from '../servisler/kademeler.js';
import { altParametreleriTemizle } from '../servisler/izleme.js';
import { medyaIzlemeLinki, medyalariListele } from '../servisler/medya.js';
import { ortakOzetleri } from '../servisler/olcum.js';
import { ortakBul, onayZorunlu } from '../servisler/ortaklar.js';
import { postbackAyarla, postbackAyarlari, postbackKayitlari } from '../servisler/postback.js';
import { tiklamalariListele, tiklamaOzeti } from '../servisler/tiklama.js';

/**
 * ORTAK PORTALI.
 *
 * Her uç, oturumdaki ortak anahtarına KİLİTLİ. Hiçbir uç sorgudan ya
 * da gövdeden ortak anahtarı kabul etmiyor: kabul etseydi bir ortak,
 * başkasının anahtarını yazarak onun rakamlarını ve hakedişini
 * okuyabilirdi. Bu tür bir panelde en olası ve en ağır sızıntı budur.
 */

const tarihAraligi = (sorgu: Record<string, unknown>) => {
  const bitis = String(sorgu.end ?? '').trim() || gunAnahtari();
  const baslangic = String(sorgu.start ?? '').trim() || gunEkle(bitis, -29);
  return { start: baslangic, end: bitis };
};

export async function portalRotalari(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (istek, yanit) => {
    if (!ortakZorunlu(istek, yanit)) return yanit;
  });

  app.get('/ben', async (istek, yanit) => {
    const oturum = istek.oturum!;
    const ortak = oturum.ortakId ? await ortakBul(istek.kiraci, oturum.ortakId) : null;
    if (!ortak) {
      // Jeton gecerli ama hesap silinmis: oturumu gecerli saymak, olmayan
      // bir ortagin portalda dolasmasi olurdu.
      yanit.status(401);
      return { hata: 'Hesap bulunamadı.' };
    }
    return {
      ad: ortak.ad,
      eposta: ortak.eposta,
      ortakAnahtari: ortak.ortakAnahtari,
      durum: ortak.durum,
      odemeYontemi: ortak.odemeYontemi,
      odemeDetayi: ortak.odemeDetayi,
    };
  });

  app.get('/ozet', async (istek) => {
    const oturum = istek.oturum!;
    const aralik = tarihAraligi((istek.query ?? {}) as Record<string, unknown>);
    const ozetler = await ortakOzetleri(istek.kiraci, { ...aralik, ortakAnahtari: oturum.ortakAnahtari });
    return {
      aralik,
      // Kaydi olmayan ortak icin bos ozet donuyoruz; `null` donmek
      // arayuzde "hata" ile "henuz trafik yok" ayrimini kaybettirirdi.
      ozet: ozetler[0] ?? {
        ortakAnahtari: oturum.ortakAnahtari,
        gunSayisi: 0,
        oyuncuSayisi: 0,
        aktifOyuncuSayisi: 0,
        yatirim: 0,
        cekim: 0,
        ggr: 0,
        ftdSayisi: null,
        gunlukGgr: [],
      },
      altOrtaklar: await altOrtaklar(istek.kiraci, oturum.ortakAnahtari!),
    };
  });

  app.get('/medya', async (istek) => ({
    medyalar: await medyalariListele(istek.kiraci, istek.oturum!.ortakAnahtari),
  }));

  /**
   * İzleme linki üretimi.
   *
   * Onay kontrolü BURADA: onaylanmamış ortak link alamaz. Medya
   * listesini görebiliyor olması yeterli değil — listeyi görmek
   * pazarlama, link almak taahhüt.
   */
  app.post<{ Params: { medyaId: string } }>('/medya/:medyaId/link', async (istek, yanit) => {
    const oturum = istek.oturum!;
    const ortak = oturum.ortakId ? await ortakBul(istek.kiraci, oturum.ortakId) : null;
    if (!ortak) {
      yanit.status(401);
      return { hata: 'Hesap bulunamadı.' };
    }
    onayZorunlu(ortak);

    const govde = (istek.body ?? {}) as Record<string, unknown>;
    const alt = altParametreleriTemizle(govde);
    const link = await medyaIzlemeLinki(istek.kiraci, istek.params.medyaId, ortak.ortakAnahtari, alt);

    const temelUrl = String(process.env.AFF_TIKLAMA_TEMEL_URL || '').trim().replace(/\/$/, '');
    let izlemeliLink: string | null = null;
    if (temelUrl) {
      const url = new URL(
        `${temelUrl}/c/${encodeURIComponent(ortak.ortakAnahtari)}/${encodeURIComponent(istek.params.medyaId)}`,
      );
      // Alt parametreler izlemeli linke de EKLENMELI. Tiklama ucu bunlari
      // sorgu dizesinden okuyor; eklemezsek ortak sub1 girse bile izlemeli
      // linki kullandiginda kanal kirilimi kaybolur ve kayip geriye donuk
      // uretilemez.
      for (const [anahtar, deger] of Object.entries(alt)) {
        if (deger) url.searchParams.set(anahtar, deger);
      }
      izlemeliLink = url.toString();
    }

    return {
      // Dogrudan link: tiklamayi BIZ saymayiz, yalnizca backoffice sayar.
      dogrudanLink: link,
      // Izlemeli link: tiklama ucumuzden gecer, kanal kirilimi burada olusur.
      izlemeliLink,
    };
  });

  /**
   * ALT LİNKLER — ortağın kendi kampanya bağlantıları.
   *
   * Ortak anahtarı hep oturumdan; gövdeden kabul etseydik bir ortak
   * başkasının adına link üretip trafiği ona yazdırabilirdi.
   */
  app.get('/alt-linkler', async (istek) => {
    const temel = String(process.env.AFF_TIKLAMA_TEMEL_URL || '').trim().replace(/\/$/, '');
    const [linkler, tiklamalar, medyalar] = await Promise.all([
      altLinkleriListele(istek.kiraci, istek.oturum!.ortakAnahtari),
      tiklamalariListele(istek.kiraci, { ortakAnahtari: istek.oturum!.ortakAnahtari, limit: 1000 }),
      medyalariListele(istek.kiraci, istek.oturum!.ortakAnahtari),
    ]);

    // Link basina tiklama. Kayitli alt parametreler tiklamada aynen
    // gorunuyor; eslesme bunun uzerinden kuruluyor. Yalnizca medyaId'ye
    // bakmak, ayni medyayi kullanan iki linki birbirine karistirirdi.
    const imza = (medyaId: string | null, alt: Record<string, string>) =>
      JSON.stringify([medyaId, Object.entries(alt).sort()]);
    const sayaclar = new Map<string, { toplam: number; sonTiklama: string | null }>();
    for (const t of tiklamalar) {
      const anahtar = imza(t.medyaId, t.alt as Record<string, string>);
      const mevcut = sayaclar.get(anahtar) ?? { toplam: 0, sonTiklama: null };
      mevcut.toplam += 1;
      if (!mevcut.sonTiklama || t.zaman > mevcut.sonTiklama) mevcut.sonTiklama = t.zaman;
      sayaclar.set(anahtar, mevcut);
    }

    const medyaAdi = new Map(medyalar.map((m) => [m.id, m.ad]));

    return {
      // Tam adres SUNUCUDA kuruluyor; arayüzün kökü kendi tahmin etmesi,
      // ortağın yanlış alan adıyla link paylaşmasına yol açardı.
      linkler: linkler.map((l) => {
        const sayac = sayaclar.get(imza(l.medyaId, l.alt as Record<string, string>));
        return {
          ...l,
          tamAdres: temel ? `${temel}/l/${l.kod}` : null,
          medyaAdi: medyaAdi.get(l.medyaId) ?? null,
          tiklama: sayac?.toplam ?? 0,
          sonTiklama: sayac?.sonTiklama ?? null,
        };
      }),
      temelHazir: Boolean(temel),
    };
  });

  app.post('/alt-linkler', async (istek, yanit) => {
    const oturum = istek.oturum!;
    const ortak = oturum.ortakId ? await ortakBul(istek.kiraci, oturum.ortakId) : null;
    if (!ortak) {
      yanit.status(401);
      return { hata: 'Hesap bulunamadı.' };
    }
    // Onaysiz ortak link uretemez; alt link de bir izleme linkidir.
    onayZorunlu(ortak);

    const govde = (istek.body ?? {}) as { ad?: string; medyaId?: string; alt?: Record<string, unknown> };
    // Medya erisimi BURADA da kontrol ediliyor: kisitli bir medyanin
    // kimligini bilen ortak, aksi halde ona kapali bir kreatif icin
    // link uretebilirdi.
    await medyaIzlemeLinki(istek.kiraci, String(govde.medyaId ?? ''), ortak.ortakAnahtari);

    yanit.status(201);
    return altLinkOlustur(istek.kiraci, ortak.ortakAnahtari, govde);
  });

  /**
   * Alt linkin QR kodu.
   *
   * SUNUCUDA uretiliyor. Ucuncu taraf bir QR servisine adres gondermek
   * daha az kod olurdu ama ortagin kampanya linkini baskasinin
   * sunucusuna sizdirmak ve o servisin calisma suresine bagimli olmak
   * demekti. Istemcide uretmek de mumkun ama paketi ~20 kB buyutuyor
   * ve QR yalnizca bir dugmeye basildiginda gerekiyor.
   *
   * SVG donuyor: her boyutta net, yazdirmaya uygun ve PNG'den kucuk.
   */
  app.get<{ Params: { id: string } }>('/alt-linkler/:id/qr', async (istek, yanit) => {
    const temel = String(process.env.AFF_TIKLAMA_TEMEL_URL || '').trim().replace(/\/$/, '');
    if (!temel) {
      yanit.status(409);
      return { hata: 'Tıklama adresi tanımlı değil; QR üretilemiyor.' };
    }

    const linkler = await altLinkleriListele(istek.kiraci, istek.oturum!.ortakAnahtari);
    // Sahiplik listeden geliyor: kimlikten dogrudan okumak, baskasinin
    // linkinin QR'ini uretmeye izin verirdi.
    const link = linkler.find((l) => l.id === istek.params.id);
    if (!link) {
      yanit.status(404);
      return { hata: 'Alt link bulunamadı.' };
    }

    const svg = await QRCode.toString(`${temel}/l/${link.kod}`, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    // Onbellek YOK: link kapatilabiliyor ve kapali bir linkin QR'ini
    // onbellekten servis etmek, calismayan bir kod dagitmak olurdu.
    yanit.header('Cache-Control', 'no-store');
    yanit.type('image/svg+xml');
    return svg;
  });

  app.put<{ Params: { id: string } }>('/alt-linkler/:id', async (istek) => {
    const govde = (istek.body ?? {}) as { aktif?: boolean };
    return altLinkDurumDegistir(istek.kiraci, istek.oturum!.ortakAnahtari!, istek.params.id, govde.aktif !== false);
  });

  app.delete<{ Params: { id: string } }>('/alt-linkler/:id', async (istek) => {
    await altLinkSil(istek.kiraci, istek.oturum!.ortakAnahtari!, istek.params.id);
    return { silindi: true };
  });

  app.get('/tiklamalar', async (istek) => {
    const oturum = istek.oturum!;
    const aralik = tarihAraligi((istek.query ?? {}) as Record<string, unknown>);
    return {
      ozet: (await tiklamaOzeti(istek.kiraci, { ...aralik, ortakAnahtari: oturum.ortakAnahtari }))[0] ?? null,
      tiklamalar: await tiklamalariListele(istek.kiraci, {
        ...aralik,
        ortakAnahtari: oturum.ortakAnahtari,
        limit: 200,
      }),
    };
  });

  app.get('/hakedis', async (istek) => {
    const oturum = istek.oturum!;
    const donemler = await donemleriListele(istek.kiraci);
    // Ortak YALNIZCA onaylanmis donemleri goruyor: taslak her acilista
    // degisiyor ve degisen bir rakami ortaga gostermek, her ay "gecen
    // hafta baska yaziyordu" tartismasi uretirdi.
    const gorunur = donemler.filter((d) => d.durum !== 'taslak');
    const satirlar = await Promise.all(
      gorunur.map(async (d) => ({
        ay: d.ay,
        durum: d.durum,
        satir: await ortakDonemi(istek.kiraci, oturum.ortakAnahtari!, d.ay),
      })),
    );
    return { donemler: satirlar.filter((s) => s.satir !== null) };
  });

  app.get('/postback', async (istek) => {
    const anahtar = istek.oturum!.ortakAnahtari!;
    return {
      ayar: (await postbackAyarlari(istek.kiraci)).find((a) => a.ortakAnahtari === anahtar) ?? null,
      kayitlar: (await postbackKayitlari(istek.kiraci, anahtar)).slice(0, 100),
    };
  });

  app.put('/postback', async (istek) => {
    const govde = (istek.body ?? {}) as { sablon?: string; olaylar?: string[]; aktif?: boolean };
    // `ortakAnahtari` govdeden DEGIL oturumdan; ortak baskasinin
    // postback'ini degistiremesin.
    return postbackAyarla(istek.kiraci, {
      ortakAnahtari: istek.oturum!.ortakAnahtari,
      sablon: govde.sablon,
      olaylar: govde.olaylar,
      aktif: govde.aktif,
    });
  });
}
