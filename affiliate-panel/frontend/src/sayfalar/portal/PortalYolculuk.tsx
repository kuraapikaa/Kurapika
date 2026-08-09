import { useState } from 'react';
import { useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Kart, Yukleniyor } from '../../ui';
import { CubukListesi, Huni, OlcuKarti, ZamanSerisi } from '../../grafik';
import type { MusteriYolculuguSonucu as Sonuc } from '@sunucu/sozlesme.js';

/**
 * YOLCULUĞUNUZ — kendi trafiğinizin tıklamadan ilk yatırıma hunisi.
 *
 * Ortak anahtarı YOK burada: uç zaten yalnızca oturumdaki ortağın
 * verisini döndürüyor (bkz. `rotalar/portal.ts`), bu yüzden bir filtre
 * alanı eklemek yalnızca kafa karıştırırdı — seçilecek başka bir şey
 * olmadığı hâlde varmış gibi görünürdü.
 */
export function PortalYolculuk() {
  const [taslak, setTaslak] = useState({ start: '', end: '' });
  const [filtre, setFiltre] = useState({ start: '', end: '' });

  const sorgu = new URLSearchParams();
  if (filtre.start) sorgu.set('start', filtre.start);
  if (filtre.end) sorgu.set('end', filtre.end);
  const yol = `/api/portal/yolculuk${sorgu.toString() ? `?${sorgu}` : ''}`;

  const { veri, yukleniyor, hata } = useVeri<Sonuc>(yol);

  return (
    <>
      <Kart
        baslik="Tarih aralığı"
        sag={<Buton tur="birincil" onClick={() => setFiltre(taslak)}>Uygula</Buton>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Alan etiket="Başlangıç" tip="date" deger={taslak.start} degisti={(v) => setTaslak((t) => ({ ...t, start: v }))} />
          <Alan etiket="Bitiş" tip="date" deger={taslak.end} degisti={(v) => setTaslak((t) => ({ ...t, end: v }))} />
        </div>
      </Kart>

      {yukleniyor ? (
        <Yukleniyor />
      ) : hata ? (
        <Hata mesaj={hata} />
      ) : !veri || (veri.toplam.tiklama === 0 && veri.toplam.kayit === 0) ? (
        <Kart><Bos mesaj="Bu aralıkta tıklama ya da kayıt yok. İlk tıklamadan sonra burası dolmaya başlar." /></Kart>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <OlcuKarti etiket="Tıklama" deger={String(veri.toplam.tiklama)} alt={`${veri.aralik.start} – ${veri.aralik.end}`} />
            <OlcuKarti
              etiket="Kayıt"
              deger={String(veri.toplam.kayit)}
              alt={veri.donusum.tiklamaKayit === null ? 'dönüşüm hesaplanamıyor' : `%${veri.donusum.tiklamaKayit} dönüşüm`}
            />
            <OlcuKarti
              etiket="İlk yatırım"
              deger={veri.toplam.ilkYatirim === null ? '—' : String(veri.toplam.ilkYatirim)}
              alt={
                veri.toplam.ilkYatirim === null
                  ? 'bu dönemde ölçülemiyor'
                  : veri.donusum.kayitIlkYatirim === null ? undefined : `%${veri.donusum.kayitIlkYatirim} dönüşüm`
              }
            />
            <OlcuKarti etiket="Aktif oyuncu" deger={String(veri.toplam.aktifOyuncu)} alt="bu aralıkta işlem yapan" />
          </div>

          <Kart baslik="Dönüşüm hunisi">
            <p className="mb-4 text-sm" style={{ color: 'var(--metin-2)' }}>
              Her satır bir önceki aşamanın ne kadarının ilerlediğini gösterir: kaç tıklamanız
              kayda, kaç kaydınız ilk yatırıma dönüştü.
            </p>
            <Huni
              asamalar={[
                { etiket: 'Tıklama', deger: veri.toplam.tiklama },
                { etiket: 'Kayıt', deger: veri.toplam.kayit },
                { etiket: 'İlk yatırım', deger: veri.toplam.ilkYatirim },
              ]}
            />
          </Kart>

          <div className="grid gap-3 lg:grid-cols-3">
            <Kart baslik="Günlük tıklama">
              <ZamanSerisi
                noktalar={veri.gunluk.map((g) => ({ etiket: g.gun.slice(5), deger: g.tiklama }))}
                bosMesaj="Ölçüm yok."
              />
            </Kart>
            <Kart baslik="Günlük kayıt">
              <ZamanSerisi
                noktalar={veri.gunluk.map((g) => ({ etiket: g.gun.slice(5), deger: g.kayit }))}
                bosMesaj="Ölçüm yok."
              />
            </Kart>
            <Kart baslik="Günlük ilk yatırım">
              {veri.gunluk.every((g) => g.ilkYatirim === null) ? (
                <Bos mesaj="Bu aralıkta ölçülemiyor." />
              ) : (
                <ZamanSerisi
                  noktalar={veri.gunluk.map((g) => ({ etiket: g.gun.slice(5), deger: g.ilkYatirim ?? 0 }))}
                  bosMesaj="Ölçüm yok."
                />
              )}
            </Kart>
          </div>

          <Kart baslik="Trafiğiniz nereden geliyor">
            {veri.kaynaklar.length === 0 ? (
              <Bos mesaj="Bu aralıkta tıklama yok." />
            ) : (
              <CubukListesi
                satirlar={veri.kaynaklar.map((k) => ({
                  etiket: k.kaynak,
                  deger: k.tiklama,
                  alt: `%${k.yuzde}`,
                }))}
                birim="tıklama"
              />
            )}
          </Kart>
        </>
      )}
    </>
  );
}
