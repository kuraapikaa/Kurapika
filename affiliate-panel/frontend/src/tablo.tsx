import { useMemo, useState, type ReactNode } from 'react';
import { Alan, Buton } from './ui';

/**
 * FİLTRE PANELİ ve SIRALANABİLİR TABLO.
 *
 * Önceki tablolar ham listeydi: sıralama yok, filtre yok. Yirmi ortakta
 * çalışıyordu; iki yüz ortakta "en çok kazandıran kim" sorusu
 * cevapsız kalıyor ve kullanıcı veriyi dışa aktarıp Excel'de bakıyordu.
 *
 * ── Filtre neden "Uygula" düğmesiyle ──
 *
 * Her tuş vuruşunda filtrelemek küçük listede hoş, büyük listede her
 * harfte yeniden hesap demek. Ayrıca sunucu tarafına taşındığında
 * (kaçınılmaz) her harf bir istek olurdu. Düğme, o geçişi kırılma
 * olmadan yapmayı da mümkün kılıyor.
 */

export interface FiltreAlani {
  ad: string;
  etiket: string;
  tip?: string;
  secenekler?: Array<{ deger: string; etiket: string }>;
  ipucu?: string;
}

export function FiltrePaneli({
  alanlar, deger, uygulandi, sonGuncelleme,
}: {
  alanlar: FiltreAlani[];
  deger: Record<string, string>;
  uygulandi: (yeni: Record<string, string>) => void;
  sonGuncelleme?: string;
}) {
  const [taslak, setTaslak] = useState(deger);
  const aktifSayisi = Object.values(deger).filter((v) => String(v ?? '').trim()).length;

  return (
    <section className="rounded-xl border" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--kenar)' }}>
        <span className="text-sm font-medium">Filtreler</span>
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: aktifSayisi ? 'var(--vurgu-yumusak)' : 'var(--yuzey-2)',
            color: aktifSayisi ? 'var(--vurgu)' : 'var(--metin-2)',
          }}
        >
          Aktif: {aktifSayisi}
        </span>
        {sonGuncelleme && (
          <span className="ml-auto text-xs" style={{ color: 'var(--metin-2)' }}>
            Son güncelleme: {sonGuncelleme}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alanlar.map((a) => (
            <Alan
              key={a.ad}
              etiket={a.etiket}
              deger={taslak[a.ad] ?? ''}
              degisti={(v) => setTaslak({ ...taslak, [a.ad]: v })}
              tip={a.tip}
              secenekler={a.secenekler}
              ipucu={a.ipucu}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Buton
            onClick={() => {
              const bos = Object.fromEntries(alanlar.map((a) => [a.ad, '']));
              setTaslak(bos);
              uygulandi(bos);
            }}
          >
            Temizle
          </Buton>
          <Buton tur="birincil" onClick={() => uygulandi(taslak)}>Uygula</Buton>
        </div>
      </div>
    </section>
  );
}

export interface Sutun<T> {
  ad: string;
  etiket: string;
  /** Sıralama ve arama için ham değer. Yoksa sütun sıralanamaz. */
  deger?: (satir: T) => string | number;
  /** Hücre içeriği; verilmezse `deger` yazılır. */
  hucre?: (satir: T) => ReactNode;
  sagda?: boolean;
  genislik?: string;
}

type Yon = 'artan' | 'azalan';

/**
 * Sıralanabilir tablo.
 *
 * Sıralama İSTEMCİDE: veri zaten tamamı çekilmiş durumda ve sunucuya
 * gitmek, elde olan bir cevabı beklemek olurdu. Liste sayfalanmaya
 * başladığında bu değişmeli — o gün geldiğinde `siralama` durumu
 * sunucuya parametre olarak geçer, bileşenin arayüzü aynı kalır.
 */
export function VeriTablosu<T>({
  sutunlar, satirlar, anahtar, bosMesaj = 'Kayıt yok.', varsayilanSiralama,
}: {
  sutunlar: Array<Sutun<T>>;
  satirlar: T[];
  anahtar: (satir: T) => string;
  bosMesaj?: string;
  varsayilanSiralama?: { ad: string; yon: Yon };
}) {
  const [siralama, setSiralama] = useState<{ ad: string; yon: Yon } | null>(varsayilanSiralama ?? null);

  const sirali = useMemo(() => {
    if (!siralama) return satirlar;
    const sutun = sutunlar.find((s) => s.ad === siralama.ad);
    if (!sutun?.deger) return satirlar;

    return [...satirlar].sort((a, b) => {
      const x = sutun.deger!(a);
      const y = sutun.deger!(b);
      // Sayilar sayisal, metinler Turkce siralamayla: "İ" ve "ş" gibi
      // harfler varsayilan siralamada yanlis yere dusuyor.
      const fark = typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'tr');
      return siralama.yon === 'artan' ? fark : -fark;
    });
  }, [satirlar, siralama, sutunlar]);

  const tikla = (ad: string) => {
    setSiralama((onceki) => {
      if (onceki?.ad !== ad) return { ad, yon: 'azalan' };
      // Ucuncu tiklama siralamayi KALDIRIYOR; kullanici ozgun siraya
      // (genelde kayit sirasi) donebilmeli.
      return onceki.yon === 'azalan' ? { ad, yon: 'artan' } : null;
    });
  };

  if (satirlar.length === 0) {
    return <p className="py-8 text-center text-sm" style={{ color: 'var(--metin-2)' }}>{bosMesaj}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {sutunlar.map((s) => {
              const siraliMi = siralama?.ad === s.ad;
              return (
                <th
                  key={s.ad}
                  className="whitespace-nowrap border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ borderColor: 'var(--kenar)', color: 'var(--metin-2)', width: s.genislik }}
                >
                  {s.deger ? (
                    <button
                      type="button"
                      className={`flex items-center gap-1 ${s.sagda ? 'ml-auto' : ''}`}
                      style={{ color: siraliMi ? 'var(--vurgu)' : 'inherit' }}
                      onClick={() => tikla(s.ad)}
                    >
                      {s.etiket}
                      <span aria-hidden className="text-[10px]">
                        {siraliMi ? (siralama!.yon === 'artan' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : (
                    <span className={s.sagda ? 'block text-right' : ''}>{s.etiket}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sirali.map((satir) => (
            <tr key={anahtar(satir)} className="border-b last:border-0" style={{ borderColor: 'var(--kenar)' }}>
              {sutunlar.map((s) => (
                <td key={s.ad} className={`px-3 py-2 ${s.sagda ? 'text-right tabular-nums' : ''}`}>
                  {s.hucre ? s.hucre(satir) : String(s.deger?.(satir) ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Kopyalanabilir kimlik — görseldeki kısaltılmış ID kalıbı.
 *
 * Tam UUID sütunu 36 karakter kaplıyor ve okunmuyor; ama destek
 * konuşmasında tamamı gerekiyor. Kısaltıp kopyalatmak ikisini de
 * çözüyor.
 */
export function KisaKimlik({ deger }: { deger: string }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  if (!deger) return <span style={{ color: 'var(--metin-2)' }}>—</span>;

  const kisa = deger.length > 10 ? `${deger.slice(0, 3)}…${deger.slice(-3)}` : deger;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs"
      title={deger}
      onClick={() => {
        // `clipboard` HTTPS disinda reddediyor; sessiz kalmak
        // "kopyalandi" yanilgisi yaratirdi.
        navigator.clipboard.writeText(deger)
          .then(() => setKopyalandi(true))
          .catch(() => setKopyalandi(false));
      }}
    >
      <code>{kisa}</code>
      <span style={{ color: kopyalandi ? 'var(--olumlu)' : 'var(--metin-2)' }}>{kopyalandi ? '✓' : '⧉'}</span>
    </button>
  );
}
