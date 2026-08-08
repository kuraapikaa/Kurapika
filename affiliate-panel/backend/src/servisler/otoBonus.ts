import { randomUUID } from 'crypto';
import { degistir, diziOku, kayitOku, oku } from '../lib/depo.js';
import { gunAnahtari, gunEkle } from '../lib/gunler.js';

/**
 * OTO FTD BONUSU — WhatsApp CRM köprüsü.
 *
 * Senkron bir oyuncunun İLK yatırımını tespit ettiğinde (bkz.
 * `ilkYatirim.ts`), CRM'in sunucudan sunucuya bonus ucuna haber
 * veriliyor; bonusu platforma CRM işliyor. Panel platformu DOĞRUDAN
 * çağırmıyor: CRM'den geçmek, bonusu temsilcilerin gördüğü kayıt
 * defterine ve oradaki günlük tavana tabi tutuyor.
 *
 * ── Neden yalnızca taze günler ──
 *
 * FTD tespiti geri doldurma sırasında haftalar öncesi için de çalışır.
 * O oyunculara şimdi bonus tanımlamak "ilk yatırımına hoş geldin"
 * mesajını haftalar sonra atmak olurdu; bugün ve dün dışındaki günler
 * bu yüzden atlanıyor ve atlandığı kayda yazılıyor.
 *
 * ── Mükerrer koruması iki katlı ──
 *
 * FTD defteri bir oyuncuyu ömür boyu bir kez "yeni" sayar; bu ilk kat.
 * Buradaki `gonderilenler` listesi ikinci kat: defter sıfırlanırsa
 * (bkz. `ftdDefteriniSifirla`) herkes yeniden "yeni" görünür ama
 * bonus ikinci kez GİTMEZ. Başarısız gönderim listeye YAZILMAZ —
 * kayıtta görünür ve ileride yeniden denenebilir olarak kalır.
 */

const ALAN = 'oto-bonus';
const KAYIT_SINIRI = 200;
const ZAMAN_ASIMI_MS = 10_000;

export interface OtoBonusAyari {
  aktif: boolean;
  /** Kuruş; para her yerde olduğu gibi burada da minor unit. */
  tutarKurus: number;
  bonusKodu: string | null;
  not: string | null;
  updatedAt: string | null;
}

export interface OtoBonusKaydi {
  id: string;
  oyuncuId: string;
  gun: string;
  durum: 'basarili' | 'basarisiz' | 'atlandi';
  mesaj: string | null;
  zaman: string;
}

interface Depo {
  version: 1;
  ayar: OtoBonusAyari;
  /** Bonusu BAŞARIYLA gönderilen oyuncular; ikinci gönderimi keser. */
  gonderilenler: string[];
  kayitlar: OtoBonusKaydi[];
}

const cozDepo = (ham: unknown): Depo => {
  const k = kayitOku(ham);
  const a = kayitOku(k.ayar);
  return {
    version: 1,
    ayar: {
      aktif: a.aktif === true,
      tutarKurus: Number.isInteger(a.tutarKurus) && Number(a.tutarKurus) > 0 ? Number(a.tutarKurus) : 0,
      bonusKodu: typeof a.bonusKodu === 'string' && a.bonusKodu ? a.bonusKodu : null,
      not: typeof a.not === 'string' && a.not ? a.not : null,
      updatedAt: typeof a.updatedAt === 'string' ? a.updatedAt : null,
    },
    gonderilenler: diziOku<string>(k.gonderilenler),
    kayitlar: diziOku<OtoBonusKaydi>(k.kayitlar),
  };
};

export class OtoBonusHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'OtoBonusHatasi';
  }
}

/** CRM bağlantısı ortamda tanımlı mı; panel bunu açıkça gösteriyor. */
export function otoBonusYapilandirildiMi(): boolean {
  return Boolean(process.env.AFF_CRM_URL && process.env.AFF_CRM_BONUS_ANAHTARI);
}

export interface OtoBonusDurumuYaniti {
  ayar: OtoBonusAyari;
  kayitlar: OtoBonusKaydi[];
  yapilandirildi: boolean;
}

export async function otoBonusDurumu(kiraci: string): Promise<OtoBonusDurumuYaniti> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  return {
    ayar: depo.ayar,
    // En yeni kayit ustte; panelin ilk bakista gormek istedigi son gonderim.
    kayitlar: [...depo.kayitlar].reverse(),
    yapilandirildi: otoBonusYapilandirildiMi(),
  };
}

export async function otoBonusAyarla(
  kiraci: string,
  girdi: { aktif?: unknown; tutarKurus?: unknown; bonusKodu?: unknown; not?: unknown },
  simdi = new Date(),
): Promise<OtoBonusAyari> {
  const aktif = girdi.aktif === true;
  const tutarKurus = Number(girdi.tutarKurus ?? 0);

  if (aktif && (!Number.isInteger(tutarKurus) || tutarKurus <= 0)) {
    throw new OtoBonusHatasi('Oto bonus açıkken tutar pozitif bir tam sayı (kuruş) olmalı.');
  }

  return degistir<Depo, OtoBonusAyari>(kiraci, ALAN, cozDepo, (depo) => {
    depo.ayar = {
      aktif,
      tutarKurus: Number.isInteger(tutarKurus) && tutarKurus > 0 ? tutarKurus : 0,
      bonusKodu: String(girdi.bonusKodu ?? '').trim() || null,
      not: String(girdi.not ?? '').trim() || null,
      updatedAt: simdi.toISOString(),
    };
    return depo.ayar;
  });
}

/** Tek oyuncu için CRM çağrısı; ağ hatasında BİR kez daha dener. */
async function crmyeGonder(
  oyuncuId: string,
  ayar: OtoBonusAyari,
  gun: string,
): Promise<{ basarili: boolean; mesaj: string | null }> {
  const url = `${String(process.env.AFF_CRM_URL).replace(/\/+$/, '')}/api/bonus/auto`;
  const govde = JSON.stringify({
    playerQuery: oyuncuId,
    amountCents: ayar.tutarKurus,
    bonusCode: ayar.bonusKodu,
    note: ayar.not ?? `Affiliate oto FTD bonusu · ${gun}`,
  });

  let sonHata: string | null = null;
  for (let deneme = 1; deneme <= 2; deneme += 1) {
    try {
      const yanit = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': String(process.env.AFF_CRM_BONUS_ANAHTARI),
        },
        body: govde,
        signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
      });
      if (yanit.ok) return { basarili: true, mesaj: null };

      const hata = (await yanit.json().catch(() => null)) as { error?: string } | null;
      // 4xx kalici bir cevap (oyuncu yok, telefon yok, tavan doldu);
      // tekrar denemek ayni cevabi almak olurdu.
      return { basarili: false, mesaj: hata?.error ?? `CRM ${yanit.status} döndü` };
    } catch (h) {
      sonHata = h instanceof Error ? h.message : String(h);
    }
  }
  return { basarili: false, mesaj: `CRM'e ulaşılamadı: ${sonHata}` };
}

export interface OtoBonusSonucu {
  gonderilen: number;
  basarisiz: number;
  atlanan: number;
}

/**
 * İlk yatırımı tespit edilen oyunculara bonus gönderir.
 *
 * ASLA fırlatmaz: senkronun içinden çağrılıyor ve bonus tarafındaki
 * hiçbir aksaklık ölçüm yazımını düşürmemeli. Sonuçlar kayda yazılır
 * ve panelde görünür.
 */
export async function ftdBonuslariniIsle(
  kiraci: string,
  gun: string,
  oyuncular: string[],
  simdi = new Date(),
): Promise<OtoBonusSonucu> {
  const sonuc: OtoBonusSonucu = { gonderilen: 0, basarisiz: 0, atlanan: 0 };
  if (oyuncular.length === 0) return sonuc;

  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  if (!depo.ayar.aktif || !otoBonusYapilandirildiMi()) {
    sonuc.atlanan = oyuncular.length;
    return sonuc;
  }

  const kayitlar: OtoBonusKaydi[] = [];
  const basarililar: string[] = [];
  const bugun = gunAnahtari(simdi);
  const tazeMi = gun >= gunEkle(bugun, -1);
  const gonderilmis = new Set(depo.gonderilenler);

  for (const oyuncu of [...new Set(oyuncular)]) {
    if (gonderilmis.has(oyuncu)) {
      sonuc.atlanan += 1;
      continue;
    }

    if (!tazeMi) {
      sonuc.atlanan += 1;
      kayitlar.push({
        id: randomUUID(),
        oyuncuId: oyuncu,
        gun,
        durum: 'atlandi',
        mesaj: 'Geri doldurma günü; taze olmayan ilk yatırıma bonus gönderilmez.',
        zaman: simdi.toISOString(),
      });
      continue;
    }

    const { basarili, mesaj } = await crmyeGonder(oyuncu, depo.ayar, gun);
    if (basarili) {
      sonuc.gonderilen += 1;
      basarililar.push(oyuncu);
    } else {
      sonuc.basarisiz += 1;
    }
    kayitlar.push({
      id: randomUUID(),
      oyuncuId: oyuncu,
      gun,
      durum: basarili ? 'basarili' : 'basarisiz',
      mesaj,
      zaman: simdi.toISOString(),
    });
  }

  if (kayitlar.length > 0 || basarililar.length > 0) {
    await degistir<Depo, void>(kiraci, ALAN, cozDepo, (d) => {
      for (const o of basarililar) {
        if (!d.gonderilenler.includes(o)) d.gonderilenler.push(o);
      }
      d.kayitlar.push(...kayitlar);
      if (d.kayitlar.length > KAYIT_SINIRI) {
        d.kayitlar = d.kayitlar.slice(-KAYIT_SINIRI);
      }
    });
  }

  return sonuc;
}
