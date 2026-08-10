import { useState } from 'react';
import { paraBicimi, useVeri } from '../../api';
import { Bos, Hata, Hucre, Kart, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';
import { DIKEY_ETIKETI, DIKEY_RENGI, type Dikey } from '../../dikey-gorunum';

/**
 * Dikey başına hakediş satırı.
 *
 * `servisler/dikey.ts` üretiyor ve backend göçünden SONRA geliyor;
 * bu yüzden opsiyonel. Yoksa ekran tek akışlı pusulayı çiziyor.
 */
interface DikeySatiri {
  dikey: Dikey;
  brutGelir: number;
  yonetimGideri: number;
  netGelir: number;
  hesapTabani: number;
  gelirPayi: number;
  gelirPayiYuzdesi: number;
  cpaPayi: number;
  cpaHesaplanamadiSebebi: string | null;
  toplam: number;
}

interface Satirveri {
  planAdi: string | null;
  kademeGeliri: number;
  odenecekToplam: number;
  hakedis: {
    brutGelir: number;
    netGelir: number;
    hesapTabani: number;
    gelirPayi: number;
    cpaPayi: number;
    cpaHesaplanamadiSebebi: string | null;
    toplam: number;
    odenecek: number;
    sonrakiDevredenZarar: number;
    sonrakiDevredenOdeme: number;
    /** Dikey kırılımı; backend göçünden sonra dolu. */
    satirlar?: DikeySatiri[];
  };
}

interface Donem {
  ay: string;
  durum: 'onaylandi' | 'odendi';
  satir: Satirveri;
}

/**
 * ORTAK HAKEDİŞİ.
 *
 * ── Bu sürümde değişen: AÇILIR PUSULA ──
 *
 * Tablo doğru rakamları gösteriyordu ama "neden bu kadar" sorusunu
 * cevaplayamıyordu: brütten nete giden yol görünmüyordu. Ortağın en sık
 * sorduğu şey tam olarak bu ara adımlar — işletme payı ne kadardı,
 * devreden zarar düştü mü, hangi oran uygulandı.
 *
 * Satıra tıklayınca kalem kalem pusula açılıyor. Dikey kırılımı varsa
 * casino ve spor AYRI KOLON: iki dikey ayrı oranlarla ödendiği için
 * tek kolonda toplamak, farklı oranları tek bir yüzde gibi gösterirdi.
 *
 * ── Neden hâlâ yalnızca onaylı dönemler ──
 *
 * Taslak dönem gün içinde değişiyor. Ortağa değişebilen bir rakam
 * göstermek, sonra düştüğünde güveni kırıyor; bu kural korundu.
 */
export function PortalHakedis() {
  const { veri, yukleniyor, hata } = useVeri<{ donemler: Donem[] }>('/api/portal/hakedis');
  const [acik, setAcik] = useState<string | null>(null);

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  const donemler = veri?.donemler ?? [];

  return (
    <>
      <Kart baslik="Hakediş dönemleri">
        <p className="mb-3 max-w-3xl text-sm" style={{ color: 'var(--metin-2)' }}>
          Yalnızca <strong style={{ color: 'var(--metin)' }}>onaylanmış</strong> dönemler görünür.
          Ay kapanmadan hesaplanan taslak rakamlar gün içinde değişebildiği için burada
          gösterilmiyor. Onaylanan dönem <strong style={{ color: 'var(--metin)' }}>kesinleşir</strong> ve
          bir daha değişmez. Kalem kalem dökümü için satıra tıklayın.
        </p>

        {donemler.length === 0 ? (
          <Bos mesaj="Onaylanmış dönem yok." />
        ) : (
          <Tablo basliklar={['Ay', 'Durum', 'Plan', 'Net gelir', 'Gelir payı', 'CPA', 'Kademe', 'Ödenecek', '']}>
            {donemler.map((d) => {
              const secili = acik === d.ay;
              return (
                <Satir key={d.ay}>
                  <Hucre>{d.ay}</Hucre>
                  <Hucre>
                    <Rozet metin={d.durum === 'odendi' ? 'Ödendi' : 'Kesinleşti'} renk="olumlu" />
                  </Hucre>
                  <Hucre><span className="text-xs">{d.satir.planAdi ?? '—'}</span></Hucre>
                  <Hucre sagda>{paraBicimi(d.satir.hakedis.netGelir)}</Hucre>
                  <Hucre sagda>{paraBicimi(d.satir.hakedis.gelirPayi)}</Hucre>
                  <Hucre sagda>
                    {d.satir.hakedis.cpaHesaplanamadiSebebi
                      ? <span title={d.satir.hakedis.cpaHesaplanamadiSebebi} style={{ color: 'var(--metin-2)' }}>—</span>
                      : paraBicimi(d.satir.hakedis.cpaPayi)}
                  </Hucre>
                  <Hucre sagda>{paraBicimi(d.satir.kademeGeliri)}</Hucre>
                  <Hucre sagda><strong>{paraBicimi(d.satir.odenecekToplam)}</strong></Hucre>
                  <Hucre>
                    <button
                      type="button"
                      className="whitespace-nowrap text-xs underline"
                      style={{ color: 'var(--vurgu)' }}
                      onClick={() => setAcik(secili ? null : d.ay)}
                    >
                      {secili ? 'Kapat' : 'Döküm'}
                    </button>
                  </Hucre>
                </Satir>
              );
            })}
          </Tablo>
        )}
      </Kart>

      {acik && (() => {
        const d = donemler.find((x) => x.ay === acik);
        if (!d) return null;
        return <Pusula donem={d} kapat={() => setAcik(null)} />;
      })()}

      {donemler.some((d) => d.satir.hakedis.sonrakiDevredenOdeme > 0 || d.satir.hakedis.sonrakiDevredenZarar < 0) && (
        <Kart baslik="Devreden bakiye">
          <Tablo basliklar={['Ay', 'Devreden ödeme', 'Devreden zarar']}>
            {donemler
              .filter((d) => d.satir.hakedis.sonrakiDevredenOdeme > 0 || d.satir.hakedis.sonrakiDevredenZarar < 0)
              .map((d) => (
                <Satir key={d.ay}>
                  <Hucre>{d.ay}</Hucre>
                  <Hucre sagda>{paraBicimi(d.satir.hakedis.sonrakiDevredenOdeme)}</Hucre>
                  <Hucre sagda>{paraBicimi(d.satir.hakedis.sonrakiDevredenZarar)}</Hucre>
                </Satir>
              ))}
          </Tablo>
          <p className="mt-2 max-w-3xl text-xs" style={{ color: 'var(--metin-2)' }}>
            Asgari ödemenin altında kalan tutar silinmez, sonraki döneme eklenir. Negatif net gelir
            varsa (büyük kazanan oyuncu) sonraki dönemin gelir tabanından düşülür.
          </p>
        </Kart>
      )}
    </>
  );
}

/**
 * PUSULA — bir dönemin kalem kalem dökümü.
 *
 * Hesap SIRASI ekranda da korunuyor: brüt → işletme payı → devreden
 * zarar → taban → oran → komisyon. Sıra, tutarların neden o kadar
 * olduğunun tek açıklaması; kalemleri büyüklüğe göre sıralamak
 * matematiği görünmez kılardı.
 */
function Pusula({ donem, kapat }: { donem: Donem; kapat: () => void }) {
  const h = donem.satir.hakedis;
  const satirlar = h.satirlar ?? [];
  // `bilinmiyor` kirilim olarak GOSTERILMIYOR ama tek kaynak oysa
  // gizlemek butun dokumu bosaltirdi — o durumda tek kolon olarak kalir.
  const dikeyler = satirlar.filter((s) => s.dikey !== 'bilinmiyor');
  const kolonlu = dikeyler.length > 0;

  const kalemler: Array<{ etiket: string; al: (s: DikeySatiri) => number | string; toplam: number | string; guclu?: boolean }> = [
    { etiket: 'Brüt oyuncu geliri', al: (s) => s.brutGelir, toplam: h.brutGelir },
    { etiket: 'İşletme payı', al: (s) => -s.yonetimGideri, toplam: h.netGelir - h.brutGelir },
    { etiket: 'Net gelir', al: (s) => s.netGelir, toplam: h.netGelir, guclu: true },
    { etiket: 'Devreden zarar', al: (s) => s.hesapTabani - s.netGelir, toplam: h.hesapTabani - h.netGelir },
    { etiket: 'Gelir tabanı', al: (s) => s.hesapTabani, toplam: h.hesapTabani, guclu: true },
    { etiket: 'Uygulanan oran', al: (s) => `%${s.gelirPayiYuzdesi}`, toplam: '—' },
    { etiket: 'Gelir payı komisyonu', al: (s) => s.gelirPayi, toplam: h.gelirPayi, guclu: true },
    {
      etiket: 'CPA (ilk yatırım)',
      // Olculemeyen CPA icin SIFIR degil tire: "hic ilk yatirim yok" ile
      // "biz olcemiyoruz" ayri seyler, ikincisini birincisi gibi yazmak
      // dogrudan bir odeme anlasmazligi uretir.
      al: (s) => (s.cpaHesaplanamadiSebebi ? '—' : s.cpaPayi),
      toplam: h.cpaHesaplanamadiSebebi ? '—' : h.cpaPayi,
    },
  ];

  const bicim = (v: number | string) => (typeof v === 'string' ? v : paraBicimi(v));

  return (
    <Kart
      baslik={`Döküm · ${donem.ay}`}
      sag={
        <button type="button" className="text-xs underline" style={{ color: 'var(--metin-2)' }} onClick={kapat}>
          Kapat
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ color: 'var(--metin-2)' }}>
              <th className="border-b px-2 py-2 text-xs font-medium" style={{ borderColor: 'var(--kenar)' }}>Kalem</th>
              {kolonlu && dikeyler.map((s) => (
                <th
                  key={s.dikey}
                  className="whitespace-nowrap border-b px-2 py-2 text-right text-xs font-medium"
                  style={{ borderColor: 'var(--kenar)' }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-sm" style={{ background: DIKEY_RENGI[s.dikey] }} />
                    {DIKEY_ETIKETI[s.dikey]}
                  </span>
                </th>
              ))}
              <th
                className="whitespace-nowrap border-b px-2 py-2 text-right text-xs font-medium"
                style={{ borderColor: 'var(--kenar)' }}
              >
                Toplam
              </th>
            </tr>
          </thead>
          <tbody>
            {kalemler.map((k) => (
              <tr key={k.etiket} className="border-b last:border-0" style={{ borderColor: 'var(--kenar)' }}>
                <td className="px-2 py-2" style={{ color: k.guclu ? 'var(--metin)' : 'var(--metin-2)' }}>
                  {k.guclu ? <strong>{k.etiket}</strong> : k.etiket}
                </td>
                {kolonlu && dikeyler.map((s) => (
                  <td key={s.dikey} className="px-2 py-2 text-right tabular-nums">
                    {bicim(k.al(s))}
                  </td>
                ))}
                <td className="px-2 py-2 text-right tabular-nums">
                  {k.guclu ? <strong>{bicim(k.toplam)}</strong> : bicim(k.toplam)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-2 pt-3" style={{ color: 'var(--metin)' }}><strong>Ödenecek</strong></td>
              {kolonlu && dikeyler.map((s) => (
                <td key={s.dikey} className="px-2 pt-3 text-right tabular-nums" style={{ color: 'var(--metin-2)' }}>
                  {paraBicimi(s.toplam)}
                </td>
              ))}
              <td className="px-2 pt-3 text-right tabular-nums">
                <strong style={{ color: 'var(--vurgu)' }}>{paraBicimi(donem.satir.odenecekToplam)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {h.cpaHesaplanamadiSebebi && (
        <p className="mt-3 text-xs" style={{ color: 'var(--uyari)' }}>{h.cpaHesaplanamadiSebebi}</p>
      )}

      {!kolonlu && (
        <p className="mt-3 text-xs" style={{ color: 'var(--metin-2)' }}>
          Bu dönemin geliri casino/spor olarak ayrışmamış; tek kolon olarak gösteriliyor. Ayrışma,
          bağlantı dikey bilgisi vermeye başladığı dönemden itibaren burada görünür.
        </p>
      )}

      <p className="mt-3 max-w-3xl text-xs" style={{ color: 'var(--metin-2)' }}>
        Hesap sırası sabittir: brütten önce işletme payı düşülür, sonra varsa devreden zarar
        uygulanır, en son payınız hesaplanır. Kademe atlamışsanız "uygulanan oran" o dönemde
        ulaştığınız kademenin oranıdır.
      </p>
    </Kart>
  );
}
