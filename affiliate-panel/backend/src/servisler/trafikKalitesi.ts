import type { OrtakGunlukOlcum } from './olcum.js';
import type { Tiklama } from './tiklama.js';

/**
 * TRAFİK KALİTESİ VE RİSK SKORLAMA.
 *
 * Bir ortağın çok tıklama getirmesi iyi trafik getirdiği anlamına
 * gelmiyor. Panel şimdiye kadar yalnızca HACİM gösteriyordu; "bu
 * trafik gerçek mi" sorusu ancak ay sonunda, ödeme yapıldıktan sonra
 * ve elle fark ediliyordu.
 *
 * ── Skor bir HÜKÜM DEĞİL, bir sıralama ──
 *
 * Buradaki hiçbir sinyal tek başına sahtekârlık kanıtı değil. Tek bir
 * IP'den gelen çok tıklama kurumsal bir ağ da olabilir; düşük dönüşüm
 * kötü bir landing sayfası da. Skor, yöneticinin sınırlı dikkatini
 * hangi ortağa ayıracağını söylüyor — kimin suçlu olduğunu değil.
 *
 * Bu yüzden panel skoru TEK BAŞINA göstermiyor, bileşenlerini de
 * gösteriyor. "78 risk" bir şey ifade etmiyor; "tıklamaların %80'i tek
 * IP'den" ifade ediyor.
 *
 * ── Otomatik askıya alma YOK ──
 *
 * Skora bakıp hesabı kendiliğinden kapatmak, sezgisel bir ölçüte
 * dayanarak gerçek bir ortağın gelirini kesmek olurdu. Yüksek skor
 * yalnızca "incele" diyor.
 *
 * ── Az veride skor YOK ──
 *
 * On iki tıklamayla kalite hükmü vermek mümkün değil: tek bir tekrar
 * eden IP oranı %50'ye çıkarır. Eşiğin altında `null` dönüyor ve panel
 * "yeterli veri yok" yazıyor. Uydurulmuş bir skor, yokluğundan
 * kötüdür — çünkü ona göre karar verilir.
 */

/** Bu tıklama sayısının altında hiçbir oran anlamlı değil. */
export const ASGARI_TIKLAMA = 30;

export interface KaliteSinyali {
  ad: string;
  /** Panelde gösterilen okunabilir değer. */
  deger: string;
  /** 0–100; yüksek = riskli. `null` = bu sinyal ölçülemedi. */
  risk: number | null;
  /** Sinyalin ne anlama geldiği; skorun tek başına anlamı yok. */
  aciklama: string;
}

export interface KaliteRaporu {
  ortakAnahtari: string;
  tiklama: number;
  oyuncu: number;
  /** `null` = veri yetersiz. Uydurulmus bir skor yoklugundan kotudur. */
  riskSkoru: number | null;
  sinyaller: KaliteSinyali[];
  /** Skor hesaplanamadıysa sebebi. */
  skorsuzlukSebebi: string | null;
}

const yuzde = (bolum: number, payda: number): number => (payda > 0 ? (bolum / payda) * 100 : 0);
const bir = (n: number): number => Math.round(n * 10) / 10;

/**
 * Bir orandan risk üretir: `iyi` değerinde 0, `kotu` değerinde 100.
 *
 * Doğrusal ve aradaki değerler orantılı. Eşik tabanlı (ya 0 ya 100)
 * bir eşleme, sınırın bir birim altındaki ortağı temiz, üstündekini
 * suçlu gösterirdi.
 */
function riskEgrisi(deger: number, iyi: number, kotu: number): number {
  if (iyi === kotu) return 0;
  const oran = (deger - iyi) / (kotu - iyi);
  return Math.round(Math.max(0, Math.min(1, oran)) * 100);
}

export function kaliteRaporu(
  ortakAnahtari: string,
  tiklamalar: Tiklama[],
  olcumler: OrtakGunlukOlcum[],
): KaliteRaporu {
  const kendiTiklamalari = tiklamalar.filter((t) => t.ortakAnahtari === ortakAnahtari);
  const kendiOlcumleri = olcumler.filter((o) => o.ortakAnahtari === ortakAnahtari);

  const tiklama = kendiTiklamalari.length;
  // Oyuncu sayisi STOK degeri; gunleri toplamak ayni oyuncuyu defalarca
  // saymak olurdu (bkz. olcum.ts).
  const oyuncu = Math.max(0, ...kendiOlcumleri.map((o) => o.oyuncuSayisi), 0);
  const aktif = Math.max(0, ...kendiOlcumleri.map((o) => o.aktifOyuncuSayisi), 0);
  const ggr = kendiOlcumleri.reduce((t, o) => t + o.ggr, 0);

  const sinyaller: KaliteSinyali[] = [];

  // ── Tekil IP orani ────────────────────────────────────────────────
  const ipSayaci = new Map<string, number>();
  for (const t of kendiTiklamalari) {
    if (!t.ip) continue;
    ipSayaci.set(t.ip, (ipSayaci.get(t.ip) ?? 0) + 1);
  }
  const ipliTiklama = [...ipSayaci.values()].reduce((a, b) => a + b, 0);
  if (ipliTiklama >= ASGARI_TIKLAMA) {
    const tekilOran = yuzde(ipSayaci.size, ipliTiklama);
    sinyaller.push({
      ad: 'Tekil IP oranı',
      deger: `%${bir(tekilOran)}`,
      // Gercek trafikte cogu ziyaretci farkli IP'den gelir. Cok dusuk
      // oran, ayni makinenin tekrar tekrar tiklamasi demek.
      risk: riskEgrisi(tekilOran, 70, 15),
      aciklama: 'Gerçek trafikte ziyaretçilerin çoğu farklı adreslerden gelir. Düşük oran, aynı makinenin tekrar tıkladığına işaret.',
    });

    const enYogunIp = Math.max(...ipSayaci.values());
    const yogunlasma = yuzde(enYogunIp, ipliTiklama);
    sinyaller.push({
      ad: 'En yoğun tek adres',
      deger: `%${bir(yogunlasma)}`,
      risk: riskEgrisi(yogunlasma, 10, 60),
      // Kurumsal ag ya da mobil operator NAT'i da bunu yukseltir; bu
      // yuzden tek basina kanit degil.
      aciklama: 'Tıklamaların tek bir adresten gelen payı. Kurumsal ağ ya da operatör NAT’i de bunu yükseltebilir.',
    });
  }

  // ── Tarayıcı çeşitliliği ──────────────────────────────────────────
  const uaSayaci = new Set(kendiTiklamalari.map((t) => t.userAgent ?? '').filter(Boolean));
  if (tiklama >= ASGARI_TIKLAMA) {
    const cesitlilik = yuzde(uaSayaci.size, tiklama);
    sinyaller.push({
      ad: 'Tarayıcı çeşitliliği',
      deger: `%${bir(cesitlilik)}`,
      risk: riskEgrisi(cesitlilik, 25, 3),
      aciklama: 'Farklı tarayıcı/cihaz imzası oranı. Tek imzadan gelen yüksek hacim otomasyona işaret.',
    });
  }

  // ── Dönüşüm ───────────────────────────────────────────────────────
  if (tiklama >= ASGARI_TIKLAMA) {
    const donusum = yuzde(oyuncu, tiklama);
    sinyaller.push({
      ad: 'Tıklama → oyuncu',
      deger: `%${bir(donusum)}`,
      // Cok DUSUK donusum kalitesiz trafik. Cok YUKSEK de supheli:
      // gercek trafikte tiklayanlarin cogu kaydolmaz. Iki uc da riskli
      // ama sebepleri farkli; egri yalnizca dusuk ucu cezalandiriyor
      // cunku yuksek ucun mesru aciklamasi cok (yeniden hedefleme,
      // sadik kitle).
      risk: riskEgrisi(donusum, 5, 0.3),
      aciklama: 'Tıklayanların kaçı oyuncuya dönüştü. Çok düşük oran, ilgisiz ya da otomatik trafik anlamına gelir.',
    });
  }

  // ── Oyuncu kalitesi ───────────────────────────────────────────────
  if (oyuncu > 0) {
    const aktiflik = yuzde(aktif, oyuncu);
    sinyaller.push({
      ad: 'Aktif oyuncu oranı',
      deger: `%${bir(aktiflik)}`,
      risk: riskEgrisi(aktiflik, 60, 10),
      aciklama: 'Kaydolan oyuncuların kaçı gerçekten oynadı. Düşük oran, teşvikle kaydolup hiç oynamayan kitleye işaret.',
    });

    sinyaller.push({
      ad: 'Oyuncu başına GGR',
      deger: new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(ggr / oyuncu),
      // Negatif GGR (oyuncu kazandi) risk degil, sansin dogal sonucu.
      // Sifira yakin ve pozitif olmayan degerler ise "kaydoldu, hic
      // para birakmadi" demek.
      risk: ggr / oyuncu <= 0 ? 60 : riskEgrisi(ggr / oyuncu, 500, 20),
      aciklama: 'Getirilen oyuncu başına brüt gelir. Düşük değer, hacimli ama değersiz trafik demek.',
    });
  }

  const olculebilir = sinyaller.filter((s) => s.risk !== null);
  const yeterliMi = tiklama >= ASGARI_TIKLAMA && olculebilir.length >= 3;

  return {
    ortakAnahtari,
    tiklama,
    oyuncu,
    riskSkoru: yeterliMi
      ? Math.round(olculebilir.reduce((t, s) => t + (s.risk ?? 0), 0) / olculebilir.length)
      : null,
    sinyaller,
    skorsuzlukSebebi: yeterliMi
      ? null
      : tiklama < ASGARI_TIKLAMA
        ? `Skor için en az ${ASGARI_TIKLAMA} tıklama gerekiyor (şu an ${tiklama}).`
        : 'Ölçülebilir sinyal sayısı yetersiz.',
  };
}

/** Risk bandı; panelde renk ve sıralama için. */
export function riskBandi(skor: number | null): 'veri-yok' | 'dusuk' | 'orta' | 'yuksek' {
  if (skor === null) return 'veri-yok';
  if (skor < 35) return 'dusuk';
  if (skor < 65) return 'orta';
  return 'yuksek';
}
