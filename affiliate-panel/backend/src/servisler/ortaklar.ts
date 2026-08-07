import { randomUUID } from 'crypto';
import { degistir, diziOku, kayitOku, oku } from '../lib/depo.js';
import { parolaDogrula, parolaOzeti } from '../lib/sifre.js';

/**
 * ORTAK (AFFILIATE) HESAPLARI.
 *
 * Bu paneli bir rapor ekranından ayıran şey: ortağın KENDİSİ giriyor.
 * Kendi rakamlarını, kendi izleme linklerini, kendi medyalarını ve
 * kendi hakedişini görüyor. Yönetici tarafı ile ortak tarafı aynı
 * veriye bakıyor ama farklı kapılardan.
 *
 * ── Durum neden dört değerli ──
 *
 * Bir ortak "var / yok" değil. Başvurusu alınmış ama onaylanmamış bir
 * ortak giriş YAPABİLMELİ (başvurusunun durumunu görsün) ama izleme
 * linki ÜRETEMEMELİ — üretebilseydi onaylanmadan trafik göndermeye
 * başlar ve o trafiğin hakedişini reddetmek imkânsız olurdu.
 * Askıya alınmış bir ortak ise hiç giremez.
 */

const ALAN = 'ortaklar';

export type OrtakDurumu = 'bekliyor' | 'onaylandi' | 'askida' | 'reddedildi';
export const ORTAK_DURUMLARI: OrtakDurumu[] = ['bekliyor', 'onaylandi', 'askida', 'reddedildi'];

export interface Ortak {
  id: string;
  /**
   * Backoffice tarafındaki izleme anahtarı (Lynon'da BTag).
   *
   * Ölçümlerin ortağa bağlanmasının TEK yolu bu; değiştirmek geçmiş
   * ölçümleri ortaktan koparır. Bu yüzden bir kez atandıktan sonra
   * yalnızca yönetici değiştirebiliyor.
   */
  ortakAnahtari: string;
  ad: string;
  eposta: string;
  parolaOzeti: string | null;
  durum: OrtakDurumu;
  /** Uygulanacak komisyon planı; boşsa varsayılan plan geçerli. */
  planId: string | null;
  /** Web sitesi / trafik kaynağı; başvuruyu değerlendirmek için. */
  trafikKaynagi: string | null;
  odemeYontemi: string | null;
  odemeDetayi: string | null;
  not: string | null;
  createdAt: string;
  updatedAt: string;
}

type Depo = { version: 1; ortaklar: Ortak[] };
const cozDepo = (ham: unknown): Depo => ({ version: 1, ortaklar: diziOku<Ortak>(kayitOku(ham).ortaklar) });

export class OrtakHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'OrtakHatasi';
  }
}

const metin = (deger: unknown): string => (typeof deger === 'string' ? deger.trim() : '');
const epostaNormal = (deger: unknown): string => metin(deger).toLowerCase();

function epostaGecerliMi(deger: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(deger);
}

/**
 * İzleme anahtarını normalleştirir.
 *
 * Anahtar bir URL sorgu parametresi olarak taşınıyor; boşluk ve özel
 * karakter kodlama farklarında sessizce başka bir değere dönüşür ve
 * trafik hiçbir ortağa yazılmaz.
 */
export function ortakAnahtariNormalle(ham: unknown): string {
  return metin(ham).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48);
}

/** Ortak listesi ortak tarafına dönerken parola özeti çıkarılır. */
export type OrtakGorunumu = Omit<Ortak, 'parolaOzeti'> & { parolaKurulu: boolean };

export function gorunume(ortak: Ortak): OrtakGorunumu {
  const { parolaOzeti: ozet, ...kalan } = ortak;
  return { ...kalan, parolaKurulu: Boolean(ozet) };
}

export async function ortaklariListele(kiraci: string): Promise<OrtakGorunumu[]> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  return depo.ortaklar.map(gorunume);
}

export async function ortakBul(kiraci: string, id: string): Promise<Ortak | null> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  return depo.ortaklar.find((o) => o.id === id) ?? null;
}

export async function ortakAnahtarindanBul(kiraci: string, ortakAnahtari: string): Promise<Ortak | null> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  return depo.ortaklar.find((o) => o.ortakAnahtari === ortakAnahtari) ?? null;
}

export interface OrtakGirdisi {
  ortakAnahtari?: string;
  ad?: string;
  eposta?: string;
  parola?: string;
  durum?: string;
  planId?: string | null;
  trafikKaynagi?: string;
  odemeYontemi?: string;
  odemeDetayi?: string;
  not?: string;
}

export async function ortakOlustur(kiraci: string, girdi: OrtakGirdisi, simdi = new Date()): Promise<Ortak> {
  const ad = metin(girdi.ad);
  if (!ad) throw new OrtakHatasi('ad zorunlu.');
  const eposta = epostaNormal(girdi.eposta);
  if (!epostaGecerliMi(eposta)) throw new OrtakHatasi('Geçerli bir e-posta gerekli.');
  const ortakAnahtari = ortakAnahtariNormalle(girdi.ortakAnahtari);
  if (!ortakAnahtari) throw new OrtakHatasi('ortakAnahtari zorunlu (harf, rakam, . _ -).');

  const parola = String(girdi.parola ?? '');
  if (parola && parola.length < 10) {
    // Ortak panelinde gercek para var; kisa parola kabul etmek, bir
    // ortagin hakedisini baskasina yonlendirilebilir hale getirir.
    throw new OrtakHatasi('Parola en az 10 karakter olmalı.');
  }

  return degistir<Depo, Ortak>(kiraci, ALAN, cozDepo, (depo) => {
    if (depo.ortaklar.some((o) => o.ortakAnahtari === ortakAnahtari)) {
      throw new OrtakHatasi('Bu izleme anahtarı zaten kullanılıyor.', 409);
    }
    if (depo.ortaklar.some((o) => o.eposta === eposta)) {
      throw new OrtakHatasi('Bu e-posta zaten kayıtlı.', 409);
    }

    const ortak: Ortak = {
      id: randomUUID(),
      ortakAnahtari,
      ad,
      eposta,
      parolaOzeti: parola ? parolaOzeti(parola) : null,
      durum: (ORTAK_DURUMLARI as string[]).includes(String(girdi.durum))
        ? (girdi.durum as OrtakDurumu)
        : 'bekliyor',
      planId: metin(girdi.planId) || null,
      trafikKaynagi: metin(girdi.trafikKaynagi) || null,
      odemeYontemi: metin(girdi.odemeYontemi) || null,
      odemeDetayi: metin(girdi.odemeDetayi) || null,
      not: metin(girdi.not) || null,
      createdAt: simdi.toISOString(),
      updatedAt: simdi.toISOString(),
    };
    depo.ortaklar.push(ortak);
    return ortak;
  });
}

export async function ortakGuncelle(
  kiraci: string,
  id: string,
  girdi: OrtakGirdisi,
  simdi = new Date(),
): Promise<Ortak> {
  return degistir<Depo, Ortak>(kiraci, ALAN, cozDepo, (depo) => {
    const ortak = depo.ortaklar.find((o) => o.id === id);
    if (!ortak) throw new OrtakHatasi('Ortak bulunamadı.', 404);

    if (girdi.ortakAnahtari !== undefined) {
      const yeni = ortakAnahtariNormalle(girdi.ortakAnahtari);
      if (!yeni) throw new OrtakHatasi('ortakAnahtari boş olamaz.');
      if (yeni !== ortak.ortakAnahtari && depo.ortaklar.some((o) => o.ortakAnahtari === yeni)) {
        throw new OrtakHatasi('Bu izleme anahtarı zaten kullanılıyor.', 409);
      }
      ortak.ortakAnahtari = yeni;
    }
    if (girdi.ad !== undefined) {
      const ad = metin(girdi.ad);
      if (!ad) throw new OrtakHatasi('ad boş olamaz.');
      ortak.ad = ad;
    }
    if (girdi.eposta !== undefined) {
      const eposta = epostaNormal(girdi.eposta);
      if (!epostaGecerliMi(eposta)) throw new OrtakHatasi('Geçerli bir e-posta gerekli.');
      if (eposta !== ortak.eposta && depo.ortaklar.some((o) => o.eposta === eposta)) {
        throw new OrtakHatasi('Bu e-posta zaten kayıtlı.', 409);
      }
      ortak.eposta = eposta;
    }
    if (girdi.parola) {
      if (girdi.parola.length < 10) throw new OrtakHatasi('Parola en az 10 karakter olmalı.');
      ortak.parolaOzeti = parolaOzeti(girdi.parola);
    }
    if (girdi.durum !== undefined) {
      if (!(ORTAK_DURUMLARI as string[]).includes(String(girdi.durum))) {
        throw new OrtakHatasi(`durum şunlardan biri olmalı: ${ORTAK_DURUMLARI.join(', ')}`);
      }
      ortak.durum = girdi.durum as OrtakDurumu;
    }
    if (girdi.planId !== undefined) ortak.planId = metin(girdi.planId) || null;
    if (girdi.trafikKaynagi !== undefined) ortak.trafikKaynagi = metin(girdi.trafikKaynagi) || null;
    if (girdi.odemeYontemi !== undefined) ortak.odemeYontemi = metin(girdi.odemeYontemi) || null;
    if (girdi.odemeDetayi !== undefined) ortak.odemeDetayi = metin(girdi.odemeDetayi) || null;
    if (girdi.not !== undefined) ortak.not = metin(girdi.not) || null;

    ortak.updatedAt = simdi.toISOString();
    return ortak;
  });
}

export async function ortakSil(kiraci: string, id: string): Promise<void> {
  await degistir<Depo, void>(kiraci, ALAN, cozDepo, (depo) => {
    const once = depo.ortaklar.length;
    depo.ortaklar = depo.ortaklar.filter((o) => o.id !== id);
    if (depo.ortaklar.length === once) throw new OrtakHatasi('Ortak bulunamadı.', 404);
  });
}

/**
 * Ortak girişi.
 *
 * Parolası olmayan, askıya alınmış ya da reddedilmiş hesap giremez.
 * "Bekliyor" GİREBİLİR: başvurusunun durumunu görmesi gerekiyor ve
 * onu kapıda tutmak, her durum sorusunu destek talebine çevirirdi.
 *
 * Hata mesajı her başarısız durumda AYNI: "e-posta kayıtlı ama parola
 * yanlış" ile "e-posta kayıtlı değil" arasındaki fark, hangi
 * e-postaların sistemde olduğunu dışarıya sayar.
 */
export async function ortakGirisi(kiraci: string, eposta: string, parola: string): Promise<Ortak> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  const ortak = depo.ortaklar.find((o) => o.eposta === epostaNormal(eposta));
  const gecersiz = new OrtakHatasi('E-posta ya da parola hatalı.', 401);

  if (!ortak || !ortak.parolaOzeti) throw gecersiz;
  if (!parolaDogrula(String(parola ?? ''), ortak.parolaOzeti)) throw gecersiz;
  if (ortak.durum === 'askida' || ortak.durum === 'reddedildi') {
    throw new OrtakHatasi('Hesabınız şu anda erişime kapalı. Lütfen yöneticinizle görüşün.', 403);
  }
  return ortak;
}

/** Onaylanmamış ortak izleme linki üretemez, medya alamaz. */
export function onayliMi(ortak: Ortak): boolean {
  return ortak.durum === 'onaylandi';
}

export function onayZorunlu(ortak: Ortak): void {
  if (!onayliMi(ortak)) {
    throw new OrtakHatasi('Hesabınız henüz onaylanmadı; izleme linki üretilemez.', 403);
  }
}
