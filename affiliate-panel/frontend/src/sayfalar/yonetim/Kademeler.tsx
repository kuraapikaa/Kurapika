import { useEffect, useState } from 'react';
import { api, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Satir, Tablo, Yukleniyor } from '../../ui';
import type { YonetimUclari } from '@sunucu/sozlesme.js';

type Durum = YonetimUclari['/kademeler'];

/**
 * ALT ORTAK KADEMELERİ.
 *
 * Bir ortak, getirdiği alt ortakların kazancından pay alır. Bu bir
 * pazarlama gideri: pay alt ortağın kazancından KESİLMEZ, üstüne eklenir.
 *
 * ── Bu sürümde değişen: SEVİYELER GÖRÜNÜR OLDU ──
 *
 * Yüzdeler tek bir metin alanındaydı ("5, 2") ve kaydedildikten sonra
 * hangi seviyenin ne aldığı hiçbir yerde okunmuyordu. Yönetici kendi
 * yazdığı diziyi tekrar zihninde çözmek zorundaydı.
 *
 * Artık alanın altında çözülmüş seviye kartları var — yazarken canlı
 * güncelleniyor. Toplam %100'ü geçerse uyarı hemen görünüyor; sunucu bunu
 * zaten reddediyor ama kaydet'e bastıktan sonra öğrenmek gereksiz bir tur.
 */
export function Kademeler() {
  const { veri, yukleniyor, hata, yenile } = useVeri<Durum>('/api/yonetim/kademeler');
  const [yuzdeler, setYuzdeler] = useState('');
  const [alt, setAlt] = useState('');
  const [ust, setUst] = useState('');
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);

  useEffect(() => {
    if (veri) setYuzdeler(veri.kademeYuzdeleri.join(', '));
  }, [veri]);

  const calistir = async (is: () => Promise<unknown>) => {
    setIslemHatasi(null);
    try {
      await is();
      yenile();
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'İşlem başarısız.');
    }
  };

  if (yukleniyor) return <Yukleniyor />;

  // Metni SAYIYA cevirirken gecersizleri ayri tutuyoruz: "5, x, 2"
  // yazan biri sessizce iki seviyeli bir yapiya dusmesin.
  const parcalar = yuzdeler.split(',').map((s) => s.trim()).filter((s) => s !== '');
  const cozulen = parcalar.map((s) => Number(s));
  const gecersizVar = cozulen.some((n) => !Number.isFinite(n) || n < 0);
  const toplam = cozulen.filter((n) => Number.isFinite(n)).reduce((t, n) => t + n, 0);

  const baglar = veri?.baglar ?? [];
  // Ust ortak basina kac alt ortak: "kim getiriyor" sorusunun cevabi.
  const ustSayilari = new Map<string, number>();
  for (const b of baglar) ustSayilari.set(b.ustOrtakAnahtari, (ustSayilari.get(b.ustOrtakAnahtari) ?? 0) + 1);

  return (
    <>
      <Kart baslik="Kademe yüzdeleri">
        <p className="mb-4 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>
          Bir ortak, getirdiği alt ortakların kazancından pay alır. Pay alt ortağın kazancından{' '}
          <strong style={{ color: 'var(--metin)' }}>kesilmez</strong>, üstüne eklenir — bu bir
          pazarlama gideridir. Toplam %100’ü geçemez.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Alan
              etiket="Seviye yüzdeleri"
              deger={yuzdeler}
              degisti={setYuzdeler}
              ipucu="Virgülle ayrılmış. Örn. 5, 2 → 1. seviye %5, 2. seviye %2."
            />
          </div>
          <Buton
            tur="birincil"
            devredisi={gecersizVar || toplam > 100}
            onClick={() => calistir(() => api.yaz('/api/yonetim/kademeler/yuzdeler', {
              yuzdeler: cozulen.filter((n) => Number.isFinite(n)),
            }))}
          >
            Kaydet
          </Buton>
        </div>

        {/* COZULMUS SEVIYELER — yazarken canli. Kendi yazdigi diziyi
            zihninde cozmek zorunda kalan yonetici, bir basamak kaydirma
            hatasini ancak ilk odemede fark ediyordu. */}
        {parcalar.length > 0 && (
          <div className="mt-4">
            {gecersizVar ? (
              <p className="text-xs" style={{ color: 'var(--olumsuz)' }}>
                Bir değer sayı olarak okunamadı. Yalnızca virgülle ayrılmış pozitif sayılar yazın.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  {cozulen.map((y, i) => (
                    <div
                      key={`${i}-${y}`}
                      className="min-w-0 flex-1 basis-48 rounded-lg p-4"
                      style={{ background: 'var(--vurgu-yumusak)' }}
                    >
                      <p
                        className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em]"
                        style={{ color: 'var(--vurgu)' }}
                      >
                        {i + 1}. seviye
                      </p>
                      <p className="mt-2 whitespace-nowrap font-mono text-2xl font-semibold tabular-nums">%{y}</p>
                      <p className="mt-1.5 text-xs leading-snug" style={{ color: 'var(--metin-2)' }}>
                        {i === 0
                          ? 'Doğrudan getirdiği ortakların kazancından'
                          : `${i} kademe aşağıdaki ortakların kazancından`}
                      </p>
                    </div>
                  ))}
                </div>
                <p
                  className="mt-3 text-xs"
                  style={{ color: toplam > 100 ? 'var(--olumsuz)' : 'var(--metin-2)' }}
                >
                  Toplam ek maliyet: %{toplam}
                  {toplam > 100 && ' — %100’ü geçiyor, kaydedilemez.'}
                </p>
              </>
            )}
          </div>
        )}

        {parcalar.length === 0 && (
          <p className="mt-4 text-xs" style={{ color: 'var(--metin-2)' }}>
            Seviye tanımlı değil: tüm ortaklar düz seviyede, kimse alt ortak payı almıyor.
          </p>
        )}
      </Kart>

      <Kart baslik="Yeni bağ">
        <p className="mb-3 max-w-3xl text-sm" style={{ color: 'var(--metin-2)' }}>
          Alt ortağı bir üst ortağa bağlar. Bir alt ortak yalnızca{' '}
          <strong style={{ color: 'var(--metin)' }}>tek bir üste</strong> bağlanabilir.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Alan etiket="Alt ortak anahtarı" deger={alt} degisti={setAlt} ipucu="Kazancı getiren ortak" />
          </div>
          <div className="min-w-48 flex-1">
            <Alan etiket="Üst ortak anahtarı" deger={ust} degisti={setUst} ipucu="Pay alacak ortak" />
          </div>
          <Buton
            tur="birincil"
            devredisi={!alt.trim() || !ust.trim() || alt.trim() === ust.trim()}
            onClick={() => calistir(async () => {
              await api.gonder('/api/yonetim/kademeler/bag', { ortakAnahtari: alt, ustOrtakAnahtari: ust });
              setAlt('');
              setUst('');
            })}
          >
            Bağla
          </Buton>
        </div>
        {alt.trim() !== '' && alt.trim() === ust.trim() && (
          <p className="mt-2 text-xs" style={{ color: 'var(--olumsuz)' }}>
            Bir ortak kendisine bağlanamaz.
          </p>
        )}
      </Kart>

      {(islemHatasi || hata) && <Hata mesaj={islemHatasi ?? hata!} />}

      <Kart
        baslik="Bağlar"
        sag={
          baglar.length > 0 ? (
            <span className="text-xs" style={{ color: 'var(--metin-2)' }}>
              {baglar.length} bağ · {ustSayilari.size} üst ortak
            </span>
          ) : undefined
        }
      >
        {baglar.length === 0 ? (
          <Bos mesaj="Kademe bağı yok; tüm ortaklar düz seviyede." />
        ) : (
          <Tablo basliklar={['Alt ortak', 'Üst ortak', 'Üstün getirdiği', 'İşlem']}>
            {baglar.map((b) => (
              <Satir key={b.ortakAnahtari}>
                <Hucre><code className="text-xs">{b.ortakAnahtari}</code></Hucre>
                <Hucre><code className="text-xs">{b.ustOrtakAnahtari}</code></Hucre>
                <Hucre sagda>
                  <span className="text-xs tabular-nums" style={{ color: 'var(--metin-2)' }}>
                    {ustSayilari.get(b.ustOrtakAnahtari) ?? 1} ortak
                  </span>
                </Hucre>
                <Hucre>
                  <Buton
                    tur="tehlike"
                    onClick={() => {
                      // Bag kaldirmak GECMISI silmiyor ama bundan sonraki
                      // donemlerde ust ortak pay almiyor; sessizce yapmak
                      // bir odeme degisikligini gizlemek olurdu.
                      if (window.confirm(
                        `${b.ustOrtakAnahtari} artık ${b.ortakAnahtari} kazancından pay almayacak. `
                        + 'Kesinleşmiş dönemler etkilenmez. Kaldırılsın mı?',
                      )) {
                        calistir(() => api.sil(`/api/yonetim/kademeler/bag/${encodeURIComponent(b.ortakAnahtari)}`));
                      }
                    }}
                  >
                    Kaldır
                  </Buton>
                </Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>
    </>
  );
}
