/**
 * Anlik rapor Telegram botu — is akisi.
 *
 * Bes akis: kasa ozeti, basarili yatirim, cekim (onay/red ayri), manuel
 * bakiye duzeltmesi ve bonus verilisi. Karar ve bicimleme
 * `services/telegramRaporu` icinde ve testli; burada yalnizca "cek,
 * karsilastir, gonder, imleci yaz" var.
 *
 * ── Sessiz kalma kurallari ────────────────────────────────────────────
 *
 *   • Hicbir sohbet kimligi tanimli degilse bot HIC calismaz. Varsayilan
 *     bir sohbet uydurmak, kasa raporunu yanlis yere gondermek olur.
 *   • Ilk turda hicbir sey gonderilmez; yalnizca mevcut durum ogrenilir.
 *   • Bir akis hata verirse digerleri calismaya devam eder. Yatirim ucu
 *     dustugu icin cekim bildirimleri de susmamali.
 */
import { config } from '../config.js';
import { audit } from '../lib/auditLog.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { isTelegramConfigured, sendTelegramMessage } from '../services/telegramService.js';
import {
  istanbulDateKey,
  lynonClientBonusReport,
  lynonDashboardSummary,
  lynonDeposits,
  lynonManuelDuzeltmeler,
  lynonResolveWithdrawal,
  lynonWithdrawalRequests,
  lynonYontemBazindaKasa,
} from '../services/lynonBackofficeService.js';
import {
  bildirilecekYatirimMi,
  bonusMesaji,
  bosImlec,
  cekimMesaji,
  cekimOlayKimligi,
  islemDurumu,
  kasaMesaji,
  manuelDuzeltmeMesaji,
  ozetZamaniMi,
  tasanMesaji,
  yatirimMesaji,
  yeniOlaylar,
  type KasaOzeti,
  type RaporImleci,
} from '../services/telegramRaporu.js';
import { cekimBaglamMesaji } from '../services/cekimDegerlendirmesi.js';
import { cekimBaglamiTopla } from '../services/cekimBaglamServisi.js';
import { cekimButonlari, klavye, yetkiliKullanicilar } from '../services/telegramButonlari.js';

const NAMESPACE = 'telegram-rapor-imleci';

type AnyRecord = Record<string, any>;

export type TelegramRaporSonucu = {
  atlandi?: string;
  gonderilen: number;
  hata: number;
  ozetGonderildi: boolean;
};

/**
 * Bir akisin tanimi.
 *
 * `sohbet` her SATIR icin ayri secilebiliyor: cekim akisi tek kaynak ama
 * onaylanan ve reddedilen cekimler AYRI sohbetlere gidiyor.
 */
type Akis = {
  ad: string;
  etiket: string;
  satirlar: () => Promise<AnyRecord[]>;
  kimlik: (satir: AnyRecord) => string;
  mesaj: (satir: AnyRecord) => string;
  sohbet: (satir: AnyRecord) => string;
  /**
   * Zenginlestirilmis gonderim.
   *
   * Tanimliysa `mesaj`/`sohbet` yerine bu kullanilir. Cekim akisi bunu
   * kullaniyor: her satir icin oyuncu baglami cekiliyor, gerekirse
   * otomatik ret uygulaniyor ve mesaja butonlar ekleniyor. `null`
   * donmek "bu satiri gonderme" demektir.
   */
  olayIsle?: (satir: AnyRecord) => Promise<{ metin: string; klavye?: unknown; hedef: string } | null>;
};

/** Akisin sohbeti; tanimli degilse varsayilana duser. */
function sohbetSec(anahtar: keyof typeof config.telegram.raporChatIdleri): string {
  return config.telegram.raporChatIdleri[anahtar] || config.telegram.raporChatId;
}

/** Bugunun Turkiye gunu — akislar gun icini tarar. */
function bugun(): string {
  return istanbulDateKey(new Date());
}

/** Cekim akisinin o turdaki tam listesi; gunluk sayim icin paylasilir. */
let gunlukCekimler: AnyRecord[] = [];
/** Gunun basarili yatirim listesi; oyuncu basina gunluk sira/toplam icin. */
let gununYatirimlari: AnyRecord[] = [];
/** Gunun manuel duzeltme listesi; yapan yonetici basina gunluk sira/toplam icin. */
let gununDuzeltmeleri: AnyRecord[] = [];

/**
 * Cekim mesajinin gidecegi sohbet.
 *
 * TEK GRUP tercih edilir: onay ve ret ayri gruplara bolundugunde karar
 * veren kisi iki pencere arasinda gidip geliyor — talep bir grupta,
 * sonucu baskasinda. `TELEGRAM_CHAT_CEKIM` tanimliysa hepsi oraya.
 *
 * Ayrik kimlikler yalnizca birlesik olan bos oldugunda kullanilir;
 * mevcut kurulumlar bozulmasin diye.
 */
function cekimSohbeti(satir: AnyRecord): string {
  const birlesik = config.telegram.raporChatIdleri.cekim;
  if (birlesik) return birlesik;

  const durum = islemDurumu(satir);
  if (durum === 'onay') return sohbetSec('cekimOnay');
  if (durum === 'red') return sohbetSec('cekimRed');
  // Bekleyen talep: karar verilecek yer onay grubu.
  return sohbetSec('cekimOnay') || config.telegram.raporChatId;
}

/**
 * OTOMATIK CEKIM REDDI varsayilan olarak KAPALI.
 *
 * Istenen kural ("gunde 3 cekimi olan otomatik reddedilsin") uygulandi
 * ama varsayilan kapali, cunku bu satirlarla birlikte `resolve` ucunun
 * istek govdesi de DUZELTILDI — daha once yanit sekli gonderiliyordu,
 * yani bu yol uretimde hic dogru calismadi. Dogrulanmamis bir yazma
 * yolunu otomatik para reddine baglamak, yanlis reddedilen musteri
 * demek.
 *
 * Kapaliyken de kural GORUNUR: "bugunku 3. talep" mesajda yaziyor ve
 * operator tek dokunusla reddedebiliyor. `OTOMATIK_CEKIM_RED=1` ile
 * acilir.
 */
function otomatikRedAcikMi(): boolean {
  return process.env.OTOMATIK_CEKIM_RED === '1';
}

/**
 * Bir cekim olayini isle.
 *
 * Bekleyen talep: baglam toplanir, gerekirse otomatik reddedilir, aksi
 * halde butonlu zengin mesaj gider. Sonuclanmis talep (onay/red):
 * butonsuz sonuc mesaji ilgili gruba gider.
 */
async function cekimOlayiniIsle(
  satir: AnyRecord,
  liste: AnyRecord[],
): Promise<{ metin: string; klavye?: unknown; hedef: string } | null> {
  const durum = islemDurumu(satir);
  const hedef = cekimSohbeti(satir);
  if (!hedef) return null;

  // Sonuclanmis talep: yalnizca sonucu bildir, buton gosterme.
  if (durum === 'onay' || durum === 'red') {
    return { metin: cekimMesaji(satir), hedef };
  }

  let baglam;
  try {
    baglam = await cekimBaglamiTopla(satir, liste);
  } catch (err) {
    // Baglam alinamadiysa bildirim YINE gitmeli; sade mesaja duser.
    console.error('[telegram-rapor] çekim bağlamı:', err instanceof Error ? err.message : err);
    return { metin: cekimMesaji(satir), hedef };
  }

  const islemId = satir?.Id ?? satir?.DocumentId ?? satir?.ReferenceNo;

  if (baglam.otomatikRed.reddet && otomatikRedAcikMi()) {
    try {
      await lynonResolveWithdrawal({ transactionId: islemId, status: 'rejected' });
      audit('sistem', 'job', 'withdrawal_resolve', `islem:${islemId}`,
        `Çekim otomatik reddedildi. ${baglam.otomatikRed.neden} Oyuncu: ${baglam.playerId}.`);
      return {
        metin: cekimBaglamMesaji('⛔ ÇEKİM OTOMATİK REDDEDİLDİ', baglam),
        hedef: sohbetSec('cekimRed') || hedef,
      };
    } catch (err) {
      const mesaj = err instanceof Error ? err.message : String(err);
      // Otomatik ret basarisiz: talep ACIK kaldi, operator gormeli.
      return {
        metin: `${cekimBaglamMesaji('⚠️ OTOMATİK RET BAŞARISIZ — TALEP AÇIK', baglam)}\n\nHata: ${mesaj}`,
        klavye: klavye(cekimButonlari({
          islemId, oyuncuId: baglam.playerId, sonuclanmis: false, yetkililer: yetkiliKullanicilar(),
        })),
        hedef,
      };
    }
  }

  return {
    metin: cekimBaglamMesaji('🏧 ÇEKİM TALEBİ', baglam),
    klavye: klavye(cekimButonlari({
      islemId, oyuncuId: baglam.playerId, sonuclanmis: false, yetkililer: yetkiliKullanicilar(),
    })),
    hedef,
  };
}

function akislar(): Akis[] {
  const gun = bugun();
  const aralik = { startDate: gun, endDate: gun };

  return [
    {
      ad: 'yatirim',
      etiket: 'Yatırım',
      satirlar: async () => {
        const yanit = await lynonDeposits({ ...aralik, MaxRows: 200 });
        const hepsi: AnyRecord[] = yanit?.Data?.Documents?.Objects ?? [];
        /**
         * YALNIZCA BASARILI YATIRIMLAR.
         *
         * Uc bekleyen ve basarisiz yatirimlari da donduruyor. Bekleyen bir
         * yatirimi "YATIRIM" diye bildirmek, kasaya girmemis parayi girmis
         * gostermek olur; operator ona gore bonus verir.
         */
        const basarililar = hepsi.filter(bildirilecekYatirimMi);
        // Gunluk sira/toplam icin paylasilir; her satir icin tekrar istek atmamak adina.
        gununYatirimlari = basarililar;
        return basarililar;
      },
      kimlik: (satir) => String(satir.Id ?? satir.DocumentId ?? satir.ReferenceNo ?? ''),
      mesaj: (satir) => yatirimMesaji(satir, gununYatirimlari),
      sohbet: () => sohbetSec('yatirim'),
    },
    {
      ad: 'cekim',
      etiket: 'Çekim',
      satirlar: async () => {
        const yanit = await lynonWithdrawalRequests({ ...aralik, MaxRows: 300 });
        const liste: AnyRecord[] = yanit?.Data?.ClientRequests ?? [];
        // Gunluk sayim icin tam liste saklanir; her satir icin tekrar
        // istek atmamak adina.
        gunlukCekimler = liste;
        return liste;
      },
      /**
       * Kimlige DURUM da katiliyor: ayni cekimin "bekliyor" ve "onay"
       * halleri AYRI olay. Yalnizca kimlik kullanilsaydi talep bildirilir,
       * onayi hic bildirilmezdi.
       */
      kimlik: cekimOlayKimligi,
      mesaj: cekimMesaji,
      sohbet: (satir) => cekimSohbeti(satir),
      olayIsle: async (satir) => cekimOlayiniIsle(satir, gunlukCekimler),
    },
    {
      /**
       * MANUEL BAKIYE DUZELTMELERI.
       *
       * Kaynak `lynonCorrectionHistory` (finansal hareket ucu) yerine
       * `CorrectionHistory/sites/{siteId}`. Ikisi AYNI olaylari donuyor,
       * bu yuzden ikisi birden akmiyor — mukerrer bildirim olurdu.
       *
       * Yeni uc tercih ediliyor cunku `userName` alanini tasiyor:
       * duzeltmeyi YAPAN yonetici. Panelin kendi denetim kaydi yalnizca
       * PANELDEN yapilanlari goruyor; Lynon arayuzunden elle yapilan
       * bakiye eklemeleri oraya hic dusmuyordu. Kasadan para cikaran bu
       * ikinci yol artik anlik bildiriliyor ve gerekce notu yoksa
       * mesajda isaretleniyor.
       */
      ad: 'manuelDuzeltme',
      etiket: 'Manuel düzeltme',
      satirlar: async () => {
        const yanit = await lynonManuelDuzeltmeler(aralik);
        const satirlar: AnyRecord[] = yanit?.Data?.Satirlar ?? [];
        // Gunluk yapan-yonetici sira/toplami icin paylasilir.
        gununDuzeltmeleri = satirlar;
        return satirlar;
      },
      kimlik: (satir) => String(satir.Id ?? ''),
      mesaj: (satir) => manuelDuzeltmeMesaji(satir, gununDuzeltmeleri),
      sohbet: () => sohbetSec('correction'),
    },
    {
      ad: 'bonus',
      etiket: 'Bonus',
      satirlar: async () => {
        const yanit = await lynonClientBonusReport(aralik);
        return yanit?.Data?.ClientBonusReportData?.Objects ?? [];
      },
      kimlik: (satir) => String(satir.BonusSessionId ?? satir.Id ?? ''),
      mesaj: bonusMesaji,
      sohbet: () => sohbetSec('bonus'),
    },
  ];
}

/**
 * Kasa ozetini olustur ve gonder; olusturulan ozeti dondurur.
 *
 * `onceki` verilirse mesajda bir onceki ozete gore trend oku gorunur.
 * Cagiran, donen ozeti bir sonraki turun "onceki"si olarak saklar.
 */
async function ozetGonder(chatId: string, onceki: KasaOzeti | null = null): Promise<KasaOzeti> {
  const gun = bugun();
  const yanit = await lynonDashboardSummary(gun, gun);
  const d = (yanit?.Data ?? {}) as AnyRecord;
  // Etiketli olcu listesinden oku; ana alanlarda karsiligi olmayanlar
  // yalnizca burada var.
  const metrikler: AnyRecord[] = Array.isArray(d.metrikler) ? d.metrikler : [];
  const m = (anahtar: string) => metrikler.find((x) => x.anahtar === anahtar)?.deger ?? null;

  const ozet: KasaOzeti = {
    gun,
    saat: new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit',
    }).format(new Date()),
    yatirim: d.Deposits ?? null,
    cekim: d.Withdrawals ?? null,
    ggr: d.GGR ?? null,
    kar: d.Profit ?? null,
    yeniKayit: d.PlayersRegistered ?? null,
    yatirimOyuncu: d.DepositClientCount ?? null,
    cekimOyuncu: d.WithdrawalClientCount ?? null,
    oyuncuBakiyesi: d.PlayersBalance ?? null,
    ilkYatirim: d.FirstDepositCount ?? null,
    yatirimAdedi: m('yatirimAdedi'),
    bahisAdedi: m('bahisAdedi'),
    bahisOyuncu: m('bahisOyuncu'),
    gercekBahis: m('gercekBahis'),
    gercekKazanc: m('gercekKazanc'),
    bonusBakiye: d.PlayersBonusBalance ?? null,
    freespinKazanc: m('freespinKazanc'),
    bonusOdeme: m('bonusOdeme'),
    cashback: m('cashback'),
  };

  // Onceki ozet FARKLI bir gunden kalmissa trend anlamsiz; gun basi
  // sifirlanir — "dun aksama gore" degil "bugun icinde" trend istenen.
  const karsilastirilacak = onceki && onceki.gun === gun ? onceki : null;
  await sendTelegramMessage(chatId, kasaMesaji(ozet, karsilastirilacak));
  return ozet;
}

export async function runTelegramRaporJob(tenantKey = 'default'): Promise<TelegramRaporSonucu> {
  const sonuc: TelegramRaporSonucu = { gonderilen: 0, hata: 0, ozetGonderildi: false };

  if (!isTelegramConfigured()) return { ...sonuc, atlandi: 'TELEGRAM_BOT_TOKEN tanımlı değil.' };

  /**
   * Her akisin kendi sohbeti olabiliyor; varsayilan bos olsa bile
   * akislarindan biri tanimliysa bot calisir. Hicbiri yoksa susar —
   * varsayilan bir sohbete kasa raporu gondermek en kotu turden hata.
   */
  const tanimliSohbet =
    config.telegram.raporChatId ||
    Object.values(config.telegram.raporChatIdleri).find(Boolean) ||
    '';
  if (!tanimliSohbet) {
    return { ...sonuc, atlandi: 'Hiçbir Telegram sohbet kimliği tanımlı değil.' };
  }

  const imlec = await readStoredDocument<RaporImleci>({
    tenantKey,
    namespace: NAMESPACE,
    fallback: bosImlec,
  });
  imlec.akislar ??= {};
  let degisti = false;

  for (const akis of akislar()) {
    try {
      const satirlar = await akis.satirlar();
      const { yeniler, tasan, imlec: yeniImlec } = yeniOlaylar(satirlar, imlec.akislar[akis.ad], akis.kimlik);

      // Imlec, GONDERIM BASARILI OLDUKTAN sonra yazilir; Telegram
      // dusukse kayitlar bir sonraki turda tekrar denenir.
      for (const satir of yeniler) {
        // Zenginlestirilmis akis (cekim) kendi mesajini, klavyesini ve
        // hedefini uretir; digerleri sade mesaj + satir basina sohbet.
        if (akis.olayIsle) {
          const hazir = await akis.olayIsle(satir);
          if (!hazir) continue;
          await sendTelegramMessage(hazir.hedef, hazir.metin, { klavye: hazir.klavye });
          sonuc.gonderilen += 1;
          continue;
        }
        // Sohbet SATIR BASINA seciliyor: onaylanan ve reddedilen cekimler
        // ayni akistan gelip farkli sohbetlere gidiyor.
        const hedef = akis.sohbet(satir);
        if (!hedef) continue;
        await sendTelegramMessage(hedef, akis.mesaj(satir));
        sonuc.gonderilen += 1;
      }
      if (tasan > 0) {
        const hedef = akis.sohbet(yeniler[0] ?? {}) || tanimliSohbet;
        await sendTelegramMessage(hedef, tasanMesaji(akis.etiket, tasan));
        sonuc.gonderilen += 1;
      }

      imlec.akislar[akis.ad] = yeniImlec;
      degisti = true;
    } catch (err) {
      sonuc.hata += 1;
      console.error(`[telegram-rapor] ${akis.ad}:`, err instanceof Error ? err.message : err);
    }
  }

  /**
   * Kasa periyodu — 20 dk/1 saat neyse.
   *
   * Onceki surumde bu bayrak yalnizca ANA kasa ozeti (`kasaSohbeti`)
   * GONDERILDIGINDE ilerliyordu. `TELEGRAM_CHAT_KASA` bossa (ki bu site
   * icin oyleydi) `imlec.sonOzet` HIC yazilmiyor, `ozetZamaniMi` de her
   * turda `true` donuyor — sonuc: asagidaki yontem bazinda kasa botu her
   * dakika (20 dakikada bir degil) mesaj atiyordu. Simdi periyot ANA
   * ozet gonderilsin gonderilmesin, pencere acildiginda ilerletiliyor;
   * o pencerede kimin gonderdigi ayrica belirleniyor.
   */
  const ozetZamaniGeldi = ozetZamaniMi(imlec.sonOzet, config.telegram.raporOzetAralikMs);
  if (ozetZamaniGeldi) {
    imlec.sonOzet = new Date().toISOString();
    degisti = true;

    const kasaSohbeti = sohbetSec('kasa');
    if (kasaSohbeti) {
      try {
        imlec.sonKasaOzeti = await ozetGonder(kasaSohbeti, imlec.sonKasaOzeti ?? null);
        sonuc.ozetGonderildi = true;
      } catch (err) {
        sonuc.hata += 1;
        console.error('[telegram-rapor] kasa özeti:', err instanceof Error ? err.message : err);
      }
    }

    // Yontem bazinda GUNLUK kasa — ayni pencerede, ayri hata
    // izolasyonuyla: biri dusse digeri gitmeye devam etsin. `sohbetSec`
    // kendi icinde raporChatId'ye dusuyor; burada onun yerine ozellikle
    // KASA sohbetine dusmek isteniyor, bu yuzden ham config degeri okunuyor.
    const kasaYontemSohbeti = config.telegram.raporChatIdleri.kasaYontem || kasaSohbeti;
    if (kasaYontemSohbeti) {
      try {
        const yanit = await lynonYontemBazindaKasa({});
        await sendTelegramMessage(kasaYontemSohbeti, String(yanit?.Data?.Mesaj ?? ''));
        sonuc.gonderilen += 1;
      } catch (err) {
        sonuc.hata += 1;
        console.error('[telegram-rapor] yöntem bazında kasa:', err instanceof Error ? err.message : err);
      }
    }
  }

  if (degisti) await writeStoredDocument<RaporImleci>({ tenantKey, namespace: NAMESPACE }, imlec);
  return sonuc;
}

/**
 * Ozeti elle gonder — panelden "simdi gonder" dugmesi icin.
 *
 * Imlece dokunmaz; periyodik ozetin takvimini bozmaz.
 */
export async function telegramKasaOzetiGonder(): Promise<void> {
  if (!isTelegramConfigured()) throw new Error('TELEGRAM_BOT_TOKEN tanımlı değil.');
  if (!config.telegram.raporChatId) throw new Error('TELEGRAM_RAPOR_CHAT_ID tanımlı değil.');
  await ozetGonder(config.telegram.raporChatId);
}
