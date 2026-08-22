import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Çark durduğunda kazanan dilimi vurgulayan kutlama katmanı.
 *
 * Ödülün ADI burada YAZMIYOR: yanındaki sonuç kartı ("Tebrikler! —
 * 1.000 ₺ Nakit") zaten yazıyor. İki yerde aynı metni duyurmak hem
 * gereksiz hem de oyuncunun az önce izlediği çarkın üstünü kapatıyordu.
 * Burada eksik olan başka bir şeydi: HANGİ dilimde durduğu.
 *
 * Çarkın İÇİNDE değil ÜSTÜNDE duruyor. Çark kendi `transform`'uyla
 * dönüyor; vurguyu oraya koymak onu da döndürürdü. Kazanan dilim her
 * zaman ibrenin altında -- yani en üstte -- olduğu için vurgunun kazanan
 * indeksi bilmesine gerek yok.
 *
 * `pointer-events: none` -- katman görünürken oyuncu "Çevir"e yeniden
 * basabilmeli; kutlamanın oyunu kilitlemesi için bir sebep yok.
 */
export function CarkKazancAnimasyonu({
  gorunur,
  dilimSayisi,
  gobekOrani,
  vurgu,
}: {
  gorunur: boolean;
  dilimSayisi: number;
  /**
   * Göbeğin yarıçapı, çarkın yarıçapının oranı olarak (0..1).
   *
   * Sabit bir değer olamaz: göbek boyutu panelden ayarlanıyor ve büyük
   * bir göbekte vurgu kaması göbeğin üstüne binerdi.
   */
  gobekOrani: number;
  /** Lobi temasının vurgu rengi. */
  vurgu: string;
}) {
  /*
   * Hareket azaltma tercihi bir estetik ayarı değil: vestibüler
   * rahatsızlığı olanlarda genleşen büyük yüzeyler baş dönmesi yapıyor.
   * Kutlama yine görünüyor, sadece sabit duruyor.
   */
  const azalt = useReducedMotion();
  const dilim = Math.max(1, Math.floor(dilimSayisi));

  return (
    <AnimatePresence>
      {gorunur && (
        <motion.div
          key="kazanc"
          className="pointer-events-none absolute inset-0 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <svg viewBox="0 0 100 100" className="block h-full w-full overflow-visible" aria-hidden="true">
            <defs>
              <radialGradient id="cark-kazanc-parlama" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={vurgu} stopOpacity="0.42" />
                <stop offset="45%" stopColor={vurgu} stopOpacity="0.16" />
                <stop offset="72%" stopColor={vurgu} stopOpacity="0" />
              </radialGradient>
              <linearGradient id="cark-kazanc-dilim" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={vurgu} stopOpacity="0.05" />
                <stop offset="100%" stopColor={vurgu} stopOpacity="0.5" />
              </linearGradient>
            </defs>

            {/* Kazanan dilim: ibrenin altındaki, yani en üstteki dilim. */}
            <motion.path
              d={dilimYolu(dilim, gobekOrani)}
              fill="url(#cark-kazanc-dilim)"
              stroke={vurgu}
              strokeWidth="0.6"
              strokeLinejoin="round"
              initial={{ opacity: 0 }}
              animate={azalt ? { opacity: 0.9 } : { opacity: [0, 1, 0.55, 1, 0.7] }}
              transition={azalt ? { duration: 0.25 } : { duration: 1.6, times: [0, 0.15, 0.4, 0.65, 1] }}
            />

            {/* Merkezden dışa açılan parlama */}
            {!azalt && (
              <motion.circle
                cx="50" cy="50" r="50"
                fill="url(#cark-kazanc-parlama)"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: [0.3, 1.05, 0.92], opacity: [0, 1, 0.45] }}
                transition={{ duration: 0.9, times: [0, 0.45, 1], ease: 'easeOut' }}
                style={{ transformOrigin: '50% 50%' }}
              />
            )}

            {/* Genişleyip sönen halka: patlamanın kenarı */}
            {!azalt && (
              <motion.circle
                cx="50" cy="50" r="30"
                fill="none" stroke={vurgu} strokeWidth="1"
                initial={{ scale: 0.6, opacity: 0.85 }}
                animate={{ scale: 1.75, opacity: 0 }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
                style={{ transformOrigin: '50% 50%' }}
              />
            )}
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * En üstteki dilimin yolu (100x100 kutuda, merkez 50,50).
 * Göbeğin dışından başlayıp çarkın kenarına kadar gidiyor.
 */
function dilimYolu(dilimSayisi: number, gobekOrani: number): string {
  const merkez = 50;
  // 47.5 -> çarkın kendi kenarının (49.4) hemen içi.
  const dis = 47.5;
  const ic = Math.min(dis - 6, Math.max(8, (Number(gobekOrani) || 0.16) * 50 + 2));
  const aci = (Math.PI * 2) / dilimSayisi;
  const bas = -Math.PI / 2 - aci / 2;
  const son = -Math.PI / 2 + aci / 2;
  const nokta = (r: number, a: number) =>
    `${(merkez + r * Math.cos(a)).toFixed(3)} ${(merkez + r * Math.sin(a)).toFixed(3)}`;
  const genisYay = aci > Math.PI ? 1 : 0;
  return [
    `M ${nokta(ic, bas)}`,
    `L ${nokta(dis, bas)}`,
    `A ${dis} ${dis} 0 ${genisYay} 1 ${nokta(dis, son)}`,
    `L ${nokta(ic, son)}`,
    `A ${ic} ${ic} 0 ${genisYay} 0 ${nokta(ic, bas)}`,
    'Z',
  ].join(' ');
}
