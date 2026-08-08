import { useState } from 'react';
import { useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Kart, Yukleniyor } from '../../ui';
import { CubukListesi, Huni, OlcuKarti, ZamanSerisi } from '../../grafik';
import type { MusteriYolculuguSonucu as Sonuc } from '@sunucu/sozlesme.js';

/**
 * MÜŞTERİ YOLCULUĞU — tıklamadan ilk yatırıma huni.
 *
 * Panelde şimdiye kadar tıklama (İstatistik) ve ölçüm (Panel) ayrı
 * ekranlardaydı; "kaç tıklamadan kaç kayıt, kaç kayıttan kaç ilk
 * yatırım çıktı" sorusunun tek bir cevabı yoktu. Bu ekran üçünü aynı
 * tarih aralığında yan yana koyuyor.
 *
 * Üç ayrı zaman serisi kasıtlı: tıklama sayısı genelde kayıttan onlarca
 * kat, kayıt da ilk yatırımdan kat kat büyük. Tek eksende üst üste
 * çizilseler küçük seri düz bir çizgiye sıkışıp görünmez olurdu — üç
 * ayrı, kendi ölçeğine sahip grafik burada YANLIŞLIKLA çoğaltılmış bir
 * bileşen değil, doğru okumanın tek yolu.
 */
export function MusteriYolculugu() {
  const [taslak, setTaslak] = useState({ start: '', end: '', ortakAnahtari: '' });
  const [filtre, setFiltre] = useState({ start: '', end: '', ortakAnahtari: '' });

  const sorgu = new URLSearchParams();
  if (filtre.start) sorgu.set('start', filtre.start);
  if (filtre.end) sorgu.set('end', filtre.end);
  if (filtre.ortakAnahtari) sorgu.set('ortakAnahtari', filtre.ortakAnahtari);
  const yol = `/api/yonetim/yolculuk${sorgu.toString() ? `?${sorgu}` : ''}`;

  const { veri, yukleniyor, hata } = useVeri<Sonuc>(yol);

  return (
    <>
      <Kart
        baslik="Aralık"
        sag={<Buton tur="birincil" onClick={() => setFiltre(taslak)}>Uygula</Buton>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Alan etiket="Başlangıç" tip="date" deger={taslak.start} degisti={(v) => setTaslak((t) => ({ ...t, start: v }))} />
          <Alan etiket="Bitiş" tip="date" deger={taslak.end} degisti={(v) => setTaslak((t) => ({ ...t, end: v }))} />
          <Alan
            etiket="Ortak anahtarı"
            deger={taslak.ortakAnahtari}
            degisti={(v) => setTaslak((t) => ({ ...t, ortakAnahtari: v }))}
            ipucu="Boş bırakılırsa tüm ortaklar birlikte."
          />
        </div>
      </Kart>

      {yukleniyor ? (
        <Yukleniyor />
      ) : hata ? (
        <Hata mesaj={hata} />
      ) : !veri || (veri.toplam.tiklama === 0 && veri.toplam.kayit === 0) ? (
        <Kart><Bos mesaj="Bu aralıkta tıklama ya da kayıt yok." /></Kart>
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
            <OlcuKarti etiket="Aktif oyuncu" deger={String(veri.toplam.aktifOyuncu)} />
          </div>

          <Kart baslik="Huni">
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

          <Kart baslik="Trafik nereden geliyor">
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
