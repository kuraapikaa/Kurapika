import { useVeri } from '../../api';
import { OlcuKarti } from '../../grafik';
import { Bos, Hata, Kart, Rozet, Yukleniyor } from '../../ui';

interface Sinyal {
  ad: string;
  deger: string;
  risk: number | null;
  aciklama: string;
}

interface Rapor {
  ortakAnahtari: string;
  ortakAdi: string;
  durum: string;
  tiklama: number;
  oyuncu: number;
  riskSkoru: number | null;
  sinyaller: Sinyal[];
  skorsuzlukSebebi: string | null;
  bant: 'veri-yok' | 'dusuk' | 'orta' | 'yuksek';
}

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
      </Kart>

      {raporlar.length === 0 ? (
        <Kart><Bos mesaj="Henüz ortak yok." /></Kart>
      ) : (
        raporlar.map((r) => (
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
    </>
  );
}
