import { randomBytes, randomUUID } from 'crypto';
import { degistir, diziOku, kayitOku, oku } from '../lib/depo.js';
import { altParametreleriTemizle, type AltParametre } from './izleme.js';

/**
 * ALT LİNKLER — ortağın kendi kampanya bağlantıları.
 *
 * Ortak şimdiye kadar her seferinde medyayı seçip alt parametreleri
 * elle yazıp uzun bir link kopyalıyordu. Aynı kampanyayı ikinci kez
 * paylaşacağında ya linki bir yere not etmiş olması ya da parametreleri
 * birebir aynı yazması gerekiyordu — bir harf farkı, trafiğin ayrı bir
 * kanal olarak sayılması demek ve bu geriye dönük düzeltilemiyor.
 *
 * Alt link bunu kaydediyor: ortak bir kez kuruyor, isim veriyor, kısa
 * bir adres alıyor. Aynı link her defasında aynı kırılıma yazıyor.
 *
 * ── Neden kısa kod ──
 *
 * `/l/a7f3k2` biçimi, uzun sorgu dizeli bir adresin taşıyamayacağı
 * yerlerde çalışıyor: Instagram biyografisi, QR kod, sözlü paylaşım.
 * Ayrıca parametreler adreste görünmediği için ortağın kanal
 * isimlendirmesi dışarıya sızmıyor — rakip bir ortak `sub1=instagram`
 * yazan bir linkten stratejiyi okuyabilirdi.
 *
 * ── Sınır: alt link ALT ORTAK DEĞİLDİR ──
 *
 * Bu, kademeli ortak yapısıyla (`kademeler.ts`) karıştırılmamalı.
 * Alt link aynı ortağın kendi trafiğini bölmesi; alt ortak ise başka
 * bir hesap. İkisi birbirinin yerine geçmiyor.
 */

const ALAN = 'alt-linkler';

/** Ortak başına sınır: sınırsız kayıt hem depoyu hem paneli boğar. */
const ORTAK_BASINA_SINIR = Math.max(10, Number(process.env.ALT_LINK_SINIRI) || 200);

export interface AltLink {
  id: string;
  /** Adreste görünen kısa kod. */
  kod: string;
  ortakAnahtari: string;
  medyaId: string;
  /** Ortağın verdiği isim; panelde bunu görüyor. */
  ad: string;
  alt: Partial<Record<AltParametre, string>>;
  aktif: boolean;
  createdAt: string;
}

type Depo = { version: 1; linkler: AltLink[] };
const cozDepo = (ham: unknown): Depo => ({ version: 1, linkler: diziOku<AltLink>(kayitOku(ham).linkler) });

export class AltLinkHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'AltLinkHatasi';
  }
}

/**
 * Kısa kod üretir.
 *
 * Karıştırılan karakterler (0/O, 1/l/I) alfabede YOK: kod sözlü ya da
 * elle aktarılabilmeli ve "linkin çalışmıyor" desteğinin en sık sebebi
 * yanlış okunan bir karakter olur.
 */
const ALFABE = 'abcdefghjkmnpqrstuvwxyz23456789';

export function kodUret(uzunluk = 7): string {
  const baytlar = randomBytes(uzunluk);
  let kod = '';
  for (const b of baytlar) kod += ALFABE[b % ALFABE.length];
  return kod;
}

const metin = (deger: unknown): string => (typeof deger === 'string' ? deger.trim() : '');

export async function altLinkleriListele(kiraci: string, ortakAnahtari?: string): Promise<AltLink[]> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  const linkler = ortakAnahtari
    ? depo.linkler.filter((l) => l.ortakAnahtari === ortakAnahtari)
    : depo.linkler;
  return [...linkler].reverse();
}

export async function altLinkBul(kiraci: string, kod: string): Promise<AltLink | null> {
  if (!kod) return null;
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  return depo.linkler.find((l) => l.kod === kod) ?? null;
}

export interface AltLinkGirdisi {
  ad?: string;
  medyaId?: string;
  alt?: Record<string, unknown>;
}

export async function altLinkOlustur(
  kiraci: string,
  ortakAnahtari: string,
  girdi: AltLinkGirdisi,
  simdi = new Date(),
): Promise<AltLink> {
  const ad = metin(girdi.ad);
  if (!ad) throw new AltLinkHatasi('ad zorunlu.');
  const medyaId = metin(girdi.medyaId);
  if (!medyaId) throw new AltLinkHatasi('medyaId zorunlu.');

  return degistir<Depo, AltLink>(kiraci, ALAN, cozDepo, (depo) => {
    const kendi = depo.linkler.filter((l) => l.ortakAnahtari === ortakAnahtari);
    if (kendi.length >= ORTAK_BASINA_SINIR) {
      throw new AltLinkHatasi(`En fazla ${ORTAK_BASINA_SINIR} alt link oluşturabilirsiniz.`, 409);
    }
    if (kendi.some((l) => l.ad.toLowerCase() === ad.toLowerCase())) {
      // Ayni isimde iki link, ortagin raporunda hangisinin hangisi
      // oldugunu ayirt edilemez kilar.
      throw new AltLinkHatasi('Bu isimde bir alt linkiniz zaten var.', 409);
    }

    // Kod TUM kiracida benzersiz olmali; tiklama ucu yalnizca koda
    // bakiyor ve ayni kod iki ortakta olsaydi trafik yanlis hesaba yazardi.
    let kod = kodUret();
    for (let deneme = 0; depo.linkler.some((l) => l.kod === kod); deneme += 1) {
      if (deneme > 20) throw new AltLinkHatasi('Kod üretilemedi, tekrar deneyin.', 500);
      kod = kodUret();
    }

    const link: AltLink = {
      id: randomUUID(),
      kod,
      ortakAnahtari,
      medyaId,
      ad,
      alt: altParametreleriTemizle(girdi.alt),
      aktif: true,
      createdAt: simdi.toISOString(),
    };
    depo.linkler.push(link);
    return link;
  });
}

export async function altLinkDurumDegistir(
  kiraci: string,
  ortakAnahtari: string,
  id: string,
  aktif: boolean,
): Promise<AltLink> {
  return degistir<Depo, AltLink>(kiraci, ALAN, cozDepo, (depo) => {
    const link = depo.linkler.find((l) => l.id === id);
    // Sahiplik kontrolu: baskasinin linkini kapatmak, rakibin
    // kampanyasini durdurmak olurdu.
    if (!link || link.ortakAnahtari !== ortakAnahtari) {
      throw new AltLinkHatasi('Alt link bulunamadı.', 404);
    }
    link.aktif = aktif;
    return link;
  });
}

export async function altLinkSil(kiraci: string, ortakAnahtari: string, id: string): Promise<void> {
  await degistir<Depo, void>(kiraci, ALAN, cozDepo, (depo) => {
    const link = depo.linkler.find((l) => l.id === id);
    if (!link || link.ortakAnahtari !== ortakAnahtari) {
      throw new AltLinkHatasi('Alt link bulunamadı.', 404);
    }
    depo.linkler = depo.linkler.filter((l) => l.id !== id);
  });
}
