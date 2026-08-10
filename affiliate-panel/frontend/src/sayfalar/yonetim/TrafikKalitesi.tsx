import { useVeri } from '../../api';
import { OlcuKarti } from '../../grafik';
import { Bos, Hata, Kart, Rozet, Yukleniyor } from '../../ui';
import type { KaliteRaporGorunumu as Rapor } from '@sunucu/sozlesme.js';



const BANT_ETIKETI = {
  'veri-yok': 'Veri yok', dusuk: 'Düşük', orta: 'Orta', yuksek: 'Yüksek',
} as const;

const BANT_RENGI = {
  'veri-yok': 'notr', dusuk: 'olumlu', orta: 'uyari', yuksek: 'olumsuz',
} as const;

/**
 * TRAFİK KALİTESİ.
 *
 * Panel şimdiye kadar yalnızca hacim gösteriyordu; "bu trafik gerçek
 * mi" sorusu ancak ay sonunda, ödeme yapıldıktan sonra fark ediliyordu.
 *
 * ── Skor tek başına gösterilmiyor ──
 *
 * "78 risk" bir şey ifade etmiyor; "tıklamaların %80'i tek IP'den"
 * ifade ediyor. Her ortağın altında bileşenler açık duruyor. Skor
 * yalnızca sıralama için: yöneticinin sınırlı dikkatini nereye
 * ayıracağını söylüyor.
 */
export function TrafikKalitesi() {
  const { veri, yukleniyor, hata } = useVeri<{ raporlar: Rapor[] }>('/api/yonetim/trafik-kalitesi');

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  const raporlar = veri?.raporlar ?? [];
  const skorlu = raporlar.filter((r) => r.riskSkoru !== null);
  const yuksek = skorlu.filter((r) => r.bant === 'yuksek').length;
  const ortalama = skorlu.length
    ? Math.round(skorlu.reduce((t, r) => t + (r.riskSkoru ?? 0), 0) / skorlu.length)
    : null;

  // ONCELIKLI ve SAKIN ayrimi.
  //
  // Ekran ortak basina bir kart ciziyordu, GELIS SIRASINDA. Yirmi sekiz
  // ortakta en riskli olan sayfanin ortasinda bir yerde kaliyor ve
  // yoneticinin once bakmasi gereken kayit, once GORDUGU kayit olmuyordu.
  // Skorun tek isi dikkati yonlendirmek — o zaman sirayi da o belirlemeli.
  //
  // Skorsuzlar da USTTE (Infinity): olculemeyen bir ortak, temiz oldugu
  // BILINEN bir ortak degil. Dusuk riskliler en altta katlanmis —
  // tamamen gizlemek olmaz, bir ortagin temiz oldugunu GORMEK de bilgi.
  const siralama = (r: Rapor) => (r.riskSkoru === null ? Infinity : r.riskSkoru);
  const sirali = [...raporlar].sort((a, b) => siralama(b) - siralama(a));
  const oncelikli = sirali.filter((r) => r.bant !== 'dusuk');
  const sakin = sirali.filter((r) => r.bant === 'dusuk');

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OlcuKarti etiket="Değerlendirilen ortak" deger={String(skorlu.length)} alt={`${raporlar.length} ortaktan`} />
        <OlcuKarti etiket="Yüksek riskli" deger={String(yuksek)} alt={yuksek > 0 ? 'incelenmeli' : undefined} />
        <OlcuKarti etiket="Ortalama risk" deger={ortalama === null ? '—' : String(ortalama)} />
        <OlcuKarti
          etiket="Skorsuz"
          deger={String(raporlar.length - skorlu.length)}
          alt="veri yetersiz"
        />
      </div>

      <Kart>
        <p className="text-sm" style={{ color: 'var(--metin-2)' }}>
          Buradaki hiçbir sinyal tek başına sahtekârlık kanıtı değil. Tek IP’den gelen çok tıklama
          kurumsal bir ağ da olabilir, düşük dönüşüm kötü bir landing sayfası da.{' '}
          <strong>Skor kimin suçlu olduğunu değil, önce kime bakmanız gerektiğini söylüyor</strong> —
          ve hiçbir hesap bu skora bakılarak kendiliğinden kapatılmıyor.
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--metin-2)' }}>
          Liste risk skoruna göre sıralı: en üstte önce bakılması gerekenler. Skoru
          hesaplanamayanlar da üstte — ölçülemeyen bir ortak, temiz olduğu bilinen bir ortak
          değildir. Düşük riskliler en altta katlanmış duruyor.
        </p>
      </Kart>

      {raporlar.length === 0 ? (
        <Kart><Bos mesaj="Henüz ortak yok." /></Kart>
      ) : (
        oncelikli.map((r) => (
          <Kart
            key={r.ortakAnahtari}
            baslik={r.ortakAdi}
            sag={
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--metin-2)' }}>
                  {r.tiklama} tıklama · {r.oyuncu} oyuncu
                </span>
                <Rozet
                  metin={r.riskSkoru === null ? BANT_ETIKETI[r.bant] : `${BANT_ETIKETI[r.bant]} · ${r.riskSkoru}`}
                  renk={BANT_RENGI[r.bant]}
                />
              </div>
            }
          >
            {r.skorsuzlukSebebi && (
              <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>{r.skorsuzlukSebebi}</p>
            )}

            {r.sinyaller.length === 0 ? (
              <Bos mesaj="Ölçülebilir sinyal yok." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {r.sinyaller.map((s) => (
                  <div
                    key={s.ad}
                    className="rounded-xl border p-3"
                    style={{ background: 'var(--yuzey-2)', borderColor: 'var(--kenar)' }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--metin-2)' }}>
                        {s.ad}
                      </span>
                      <span className="text-lg font-semibold tabular-nums">{s.deger}</span>
                    </div>
                    {s.risk !== null && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--kenar)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(2, s.risk)}%`,
                            background: s.risk >= 65 ? 'var(--olumsuz)' : s.risk >= 35 ? 'var(--uyari)' : 'var(--olumlu)',
                          }}
                        />
                      </div>
                    )}
                    <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--metin-2)' }}>
                      {s.aciklama}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Kart>
        ))
      )}

      {/* SAKIN ORTAKLAR — katlanmis. Native <details>: JS gerekmiyor,
          klavye ve ekran okuyucu destegi kendiliginden dogru. */}
      {sakin.length > 0 && (
        <details className="hud border" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Düşük riskli {sakin.length} ortak</span>
              <span className="mt-0.5 block text-xs" style={{ color: 'var(--metin-2)' }}>
                Sinyalleri eşiğin altında. Görmek için tıklayın.
              </span>
            </span>
            <span aria-hidden className="ml-auto shrink-0 text-xl font-light" style={{ color: 'var(--vurgu)' }}>+</span>
          </summary>
          <div className="space-y-2.5 border-t p-4" style={{ borderColor: 'var(--kenar)' }}>
            {sakin.map((r) => (
              <div key={r.ortakAnahtari} className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 basis-48 truncate text-sm font-medium">{r.ortakAdi}</span>
                <span className="text-xs" style={{ color: 'var(--metin-2)' }}>
                  {r.tiklama} tıklama · {r.oyuncu} oyuncu
                </span>
                <Rozet
                  metin={r.riskSkoru === null ? BANT_ETIKETI[r.bant] : `${BANT_ETIKETI[r.bant]} · ${r.riskSkoru}`}
                  renk={BANT_RENGI[r.bant]}
                />
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
