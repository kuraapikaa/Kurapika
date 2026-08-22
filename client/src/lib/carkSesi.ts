import { tikZamanlari } from './carkZamanlama';

/**
 * Çark sesleri.
 *
 * Sesler DOSYADAN değil, Web Audio ile üretiliyor. Üç sebep:
 *   · indirilecek bir varlık yok -- lobi iframe içinde açılıyor, her ek
 *     istek ilk açılışı geciktiriyor
 *   · tık sesi çarkın yavaşlamasına göre yüzlerce kez, farklı perdelerde
 *     çalınıyor; tek bir kayıtla bu mümkün değil
 *   · ses seviyesi tarayıcı içinde tam denetlenebiliyor
 *
 * Mobil kuralı: `AudioContext` ancak bir kullanıcı hareketi içinde
 * başlatılabilir/sürdürülebilir. `hazirla()` çevir düğmesinin tıklama
 * işleyicisinden çağrılıyor; başka yerden çağrılırsa iOS bağlamı askıda
 * bırakır ve HİÇBİR ses çıkmaz -- üstelik hata da vermez.
 */

const TERCIH_ANAHTARI = 'cark-sesi';

type Bağlam = AudioContext & { __carkAna?: GainNode };

let baglam: Bağlam | null = null;

/** Ses açık mı? Varsayılan AÇIK; oyuncu kapatırsa tarayıcıda kalıcı. */
export function sesAcikMi(): boolean {
  try {
    return window.localStorage.getItem(TERCIH_ANAHTARI) !== 'kapali';
  } catch {
    // Gizli sekmede localStorage erişimi patlayabiliyor; ses bunun için
    // sessizce kapanmasın.
    return true;
  }
}

export function sesTercihiniYaz(acik: boolean): void {
  try {
    window.localStorage.setItem(TERCIH_ANAHTARI, acik ? 'acik' : 'kapali');
  } catch {
    /* tercih saklanamadıysa oturum boyunca geçerli kalır */
  }
}

/**
 * Ses bağlamını kullanıcı hareketi içinde hazırlar.
 * Ses kapalıysa ya da tarayıcı desteklemiyorsa `null` döner.
 */
export function hazirla(): Bağlam | null {
  if (!sesAcikMi()) return null;
  const Yapici: typeof AudioContext | undefined =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Yapici) return null;

  if (!baglam) {
    baglam = new Yapici() as Bağlam;
    const ana = baglam.createGain();
    ana.gain.value = 0.5;
    ana.connect(baglam.destination);
    baglam.__carkAna = ana;
  }
  // Sekme arka plana alınıp dönüldüğünde bağlam askıya alınmış olabilir.
  if (baglam.state === 'suspended') void baglam.resume();
  return baglam;
}

/** Açılmış bağlamı kapatır (ses kapatıldığında kaynağı bırakmak için). */
export function kapat(): void {
  if (!baglam) return;
  void baglam.close().catch(() => {});
  baglam = null;
}

function cikis(ctx: Bağlam): AudioNode {
  return ctx.__carkAna ?? ctx.destination;
}

/** Tek bir nota: yumuşak saldırı + üstel sönüm. */
function nota(
  ctx: Bağlam,
  ayar: { anda: number; frekans: number; sure: number; ses: number; tip?: OscillatorType },
) {
  const osc = ctx.createOscillator();
  const kazanc = ctx.createGain();
  osc.type = ayar.tip ?? 'triangle';
  osc.frequency.setValueAtTime(ayar.frekans, ayar.anda);

  // Doğrudan tam sesle başlamak "tık" gürültüsü (click) üretiyor.
  kazanc.gain.setValueAtTime(0.0001, ayar.anda);
  kazanc.gain.exponentialRampToValueAtTime(ayar.ses, ayar.anda + 0.008);
  kazanc.gain.exponentialRampToValueAtTime(0.0001, ayar.anda + ayar.sure);

  osc.connect(kazanc);
  kazanc.connect(cikis(ctx));
  osc.start(ayar.anda);
  osc.stop(ayar.anda + ayar.sure + 0.02);
}

/**
 * Gürültü tamponu. Bir kez üretilip bütün tıklarda paylaşılıyor;
 * her tık için yeniden üretmek 120 kez boşuna iş demekti.
 */
let gurultu: AudioBuffer | null = null;

function gurultuTamponu(ctx: Bağlam): AudioBuffer {
  if (gurultu && gurultu.sampleRate === ctx.sampleRate) return gurultu;
  const uzunluk = Math.floor(ctx.sampleRate * 0.12);
  const tampon = ctx.createBuffer(1, uzunluk, ctx.sampleRate);
  const veri = tampon.getChannelData(0);
  for (let i = 0; i < uzunluk; i += 1) veri[i] = Math.random() * 2 - 1;
  gurultu = tampon;
  return tampon;
}

/**
 * Tek bir mandal vuruşu.
 *
 * Önce kare dalgadan kısa bir bip çalıyordu; 8 saniyede yüz kez duyulan
 * saf kare dalga elektronik bir alarm gibi tiz ve yorucuydu. Gerçek bir
 * çarkta ses, ibrenin dilime çarpmasıdır: geniş bantlı, çok kısa, tok.
 *
 * Burada onun karşılığı iki katman:
 *   · dar bantlı gürültü patlaması -> vuruşun "tık"ı
 *   · alçak, hızla sönen bir sinüs -> vuruşun gövdesi, ağırlık hissi
 */
function mandalVurusu(ctx: Bağlam, anda: number, renk: number, ses: number) {
  const kaynak = ctx.createBufferSource();
  kaynak.buffer = gurultuTamponu(ctx);

  const suzgec = ctx.createBiquadFilter();
  suzgec.type = 'bandpass';
  suzgec.frequency.setValueAtTime(renk, anda);
  suzgec.Q.value = 7;

  const kazanc = ctx.createGain();
  kazanc.gain.setValueAtTime(0.0001, anda);
  kazanc.gain.exponentialRampToValueAtTime(ses, anda + 0.002);
  kazanc.gain.exponentialRampToValueAtTime(0.0001, anda + 0.038);

  kaynak.connect(suzgec);
  suzgec.connect(kazanc);
  kazanc.connect(cikis(ctx));
  kaynak.start(anda);
  kaynak.stop(anda + 0.06);

  // Gövde: tek başına duyulmuyor, gürültünün altına ağırlık koyuyor.
  const govde = ctx.createOscillator();
  const govdeKazanc = ctx.createGain();
  govde.type = 'sine';
  govde.frequency.setValueAtTime(renk / 9, anda);
  govdeKazanc.gain.setValueAtTime(0.0001, anda);
  govdeKazanc.gain.exponentialRampToValueAtTime(ses * 0.7, anda + 0.003);
  govdeKazanc.gain.exponentialRampToValueAtTime(0.0001, anda + 0.05);
  govde.connect(govdeKazanc);
  govdeKazanc.connect(cikis(ctx));
  govde.start(anda);
  govde.stop(anda + 0.07);
}

/**
 * Dönüş boyunca ibrenin dilimlere çarpma sesi.
 *
 * Tıklar `AudioContext` saatine göre önceden programlanıyor,
 * `setTimeout` ile değil: yüzlerce zamanlayıcı hem sapmalı hem de
 * sekme arka plandayken kısılıyor, ses çarkla kayıyordu.
 */
export function donusTiklari(
  ctx: Bağlam | null,
  ayar: { donusDerecesi: number; dilimSayisi: number; sureMs: number },
): void {
  if (!ctx) return;
  const simdi = ctx.currentTime;
  const zamanlar = tikZamanlari(ayar.donusDerecesi, ayar.dilimSayisi, ayar.sureMs);

  zamanlar.forEach((ms, i) => {
    const oran = zamanlar.length > 1 ? i / (zamanlar.length - 1) : 1;
    /*
     * Hızlıyken vuruşlar parlak ve kısık, yavaşlarken tokllaşıp
     * belirginleşiyor: saniyede yirmi vuruş aynı sesle çalınsa uğultuya
     * dönüşür, sondaki tek tek vuruşlar ise duyulmak ister.
     */
    mandalVurusu(ctx, simdi + ms / 1000, 2400 - 1100 * oran, 0.05 + 0.09 * oran);
  });
}

/** Kazanma: yükselen bir arpej + üstüne parlak bir vuruş. */
export function kazanmaSesi(ctx: Bağlam | null): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  // Do–Mi–Sol–Do (majör arpej): kısa, kutlayıcı, yormayan.
  [523.25, 659.25, 783.99, 1046.5].forEach((frekans, i) => {
    nota(ctx, { anda: t0 + i * 0.085, frekans, sure: 0.34, ses: 0.16 });
  });
  nota(ctx, { anda: t0 + 0.34, frekans: 1567.98, sure: 0.6, ses: 0.1, tip: 'sine' });
}

/** Kayıp: iki nota, alçalan ve kısa. Cezalandırıcı değil, sadece bitiş. */
export function kayipSesi(ctx: Bağlam | null): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  nota(ctx, { anda: t0, frekans: 392, sure: 0.22, ses: 0.09 });
  nota(ctx, { anda: t0 + 0.13, frekans: 311.13, sure: 0.34, ses: 0.09 });
}
