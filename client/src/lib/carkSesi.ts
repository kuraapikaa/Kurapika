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
    const anda = simdi + ms / 1000;
    // Sona doğru perde hafifçe düşüyor: çark ağırlaşıyormuş hissi.
    const oran = zamanlar.length > 1 ? i / (zamanlar.length - 1) : 1;
    nota(ctx, {
      anda,
      frekans: 1500 - 320 * oran,
      sure: 0.045,
      ses: 0.05,
      tip: 'square',
    });
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
