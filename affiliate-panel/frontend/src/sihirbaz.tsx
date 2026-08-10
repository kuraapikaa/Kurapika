import type { ReactNode } from 'react';

/**
 * SİHİRBAZ PARÇALARI — adım göstergesi ve numaralı adım satırı.
 *
 * İki ekran bunu paylaşıyor: alt link kurma (üç adım) ve postback
 * ayarı (üç adım). Aynı görsel dili iki dosyaya kopyalamak, birinde
 * yapılan bir düzeltmenin diğerine geçmemesi demekti.
 *
 * ── Neden sihirbaz ──
 *
 * Alt link formu tek ekranda altı alan gösteriyordu: ad, hedef kartı,
 * beş etiket. Ortak için bunların üçü zorunlu değil ama hepsi aynı
 * anda görünüyor ve hangisinin gerekli olduğu okunmuyordu. Ölçülen
 * sonuç: ortaklar formu doldurmadan bırakıp destek soruyordu.
 *
 * Sihirbaz gerekliyi zorunludan ayırıyor: birinci adımda TEK alan
 * (isim), ikincisinde hedef, üçüncüsünde hazır link. Etiketler
 * sihirbazın dışında, kapalı bir panelde — isteyen açar.
 */

export interface Adim {
  no: number;
  etiket: string;
}

/**
 * ADIM GÖSTERGESİ — tamamlanan adımlar tıklanabilir, sonrakiler değil.
 *
 * İleri adıma atlamayı ENGELLEMİYOR ama teşvik de etmiyor: geri dönüp
 * bir şeyi düzeltmek sık, ileri atlamak ise ancak veriyi atlamakla
 * mümkün. Tamamlanan adım ✓ ile işaretli, o an bulunduğunuz adım altın
 * dolgulu ve dışında bir halka taşıyor.
 */
export function AdimGostergesi({
  adimlar, simdiki, git,
}: {
  adimlar: Adim[];
  simdiki: number;
  git: (no: number) => void;
}) {
  return (
    <div className="flex items-center gap-0">
      {adimlar.map((a, i) => {
        const bitti = a.no < simdiki;
        const aktif = a.no === simdiki;
        return (
          <div key={a.no} className="flex min-w-0 flex-1 items-center gap-0">
            <button
              type="button"
              // Ileriye tiklamak kapali: atlanan adimin verisi olmadan
              // ucuncu adimda gosterilecek bir link de yok.
              disabled={a.no > simdiki}
              onClick={() => git(a.no)}
              className="flex min-w-0 items-center gap-2.5 disabled:cursor-default"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-semibold"
                style={{
                  background: bitti
                    ? 'color-mix(in srgb, var(--olumlu) 18%, transparent)'
                    : aktif ? 'var(--tayf-degrade)' : 'var(--yuzey-2)',
                  color: bitti ? 'var(--olumlu)' : aktif ? 'var(--vurgu-metin)' : 'var(--metin-2)',
                  boxShadow: aktif ? '0 0 0 4px color-mix(in srgb, var(--vurgu) 14%, transparent)' : undefined,
                }}
              >
                {bitti ? '✓' : a.no}
              </span>
              <span
                className="truncate text-sm"
                style={{
                  color: aktif ? 'var(--metin)' : bitti ? 'var(--metin-2)' : 'var(--metin-2)',
                  fontWeight: aktif ? 600 : 500,
                }}
              >
                {a.etiket}
              </span>
            </button>
            {i < adimlar.length - 1 && (
              <span
                aria-hidden
                className="mx-3.5 h-0.5 min-w-4 flex-1 rounded"
                style={{
                  background: a.no < simdiki
                    ? 'color-mix(in srgb, var(--olumlu) 40%, transparent)'
                    : 'var(--kenar)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Adımın başlığı ve altındaki tek satır açıklama. */
export function AdimBasligi({ baslik, aciklama }: { baslik: string; aciklama?: ReactNode }) {
  return (
    <div>
      <p className="text-base font-semibold">{baslik}</p>
      {aciklama && (
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>
          {aciklama}
        </p>
      )}
    </div>
  );
}

/**
 * NUMARALI ADIM — sihirbaz olmayan, tek ekranda sıralı üç iş için.
 *
 * Postback ayarında kullanılıyor: orada adımlar arasında gezinmek
 * gerekmiyor (üçü de aynı formun parçası), ama SIRA anlamlı — önce
 * adres, sonra olaylar, en son test. Numara o sırayı okutuyor.
 */
export function NumaraliAdim({
  no, baslik, aciklama, children,
}: {
  no: number;
  baslik: string;
  aciklama?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-semibold"
        style={{ background: 'var(--tayf-degrade)', color: 'var(--vurgu-metin)' }}
      >
        {no}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{baslik}</p>
        {aciklama && <p className="mt-1 text-sm" style={{ color: 'var(--metin-2)' }}>{aciklama}</p>}
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

/**
 * NE İŞE YARAR ŞERİDİ — ekranın en üstünde üç ikonlu tek satır.
 *
 * Panelin en çok sorulan sorusu "bu ekran ne yapıyor" değil, "bu ŞEY
 * nasıl çalışıyor"du (alt link nedir, kreatifin içinde ne var,
 * postback kime gider). Üç kutu bunu ekranın başında cevaplıyor —
 * dokümana gitmek gerekmiyor.
 */
export function NasilCalisir({
  adimlar,
}: {
  adimlar: Array<{ ikon: ReactNode; baslik: string; metin: string }>;
}) {
  return (
    <div className="flex flex-wrap items-stretch gap-3">
      {adimlar.map((a) => (
        <div
          key={a.baslik}
          className="flex min-w-0 flex-1 basis-52 items-center gap-3.5 rounded-lg p-4"
          style={{ background: 'var(--yuzey-2)' }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--vurgu-yumusak)', color: 'var(--vurgu)' }}
          >
            {a.ikon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{a.baslik}</p>
            <p className="mt-0.5 text-xs leading-snug" style={{ color: 'var(--metin-2)' }}>{a.metin}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const ik = (d: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

/** `NasilCalisir` şeridinin ikonları; ekranlar arasında paylaşılıyor. */
export const AKIS_IKONU = {
  paylas: ik(<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>),
  oyuncu: ik(<><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  kazanc: ik(<><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 11h20" /></>),
  sec: ik(<><rect x="3" y="4" width="18" height="14" rx="2" /><path d="m8 11 2.5 2.5L16 8" /></>),
  kopyala: ik(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>),
  say: ik(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  adres: ik(<><path d="M4 6h16v12H4z" /><path d="m4 8 8 5 8-5" /></>),
  olay: ik(<><path d="M13 2 4 14h6l-1 8 9-12h-6Z" /></>),
  test: ik(<><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3" /></>),
};
