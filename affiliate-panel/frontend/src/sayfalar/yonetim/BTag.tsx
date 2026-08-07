import { paraBicimi, useVeri } from '../../api';
import { OlcuKarti } from '../../grafik';
import { KisaKimlik, VeriTablosu, type Sutun } from '../../tablo';
import { Bos, Hata, Kart, Rozet, Yukleniyor } from '../../ui';
import type { BtagAnahtari as Anahtar, SahipsizAnahtar as Sahipsiz } from '@sunucu/sozlesme.js';



/**
 * BTAG (İZLEME ANAHTARI) YÖNETİMİ.
 *
 * Asıl değeri sahipsiz anahtar tespiti: backoffice'ten ölçüm geliyor
 * ama o anahtara sahip bir ortak kaydı yok. Bu, atfedilmemiş gelir
 * demek — ya ortak silindi, ya anahtar elle değiştirildi, ya da
 * backoffice'te panelde olmayan bir BTag tanımlanmış.
 *
 * Sessizce durduğu sürece kimse fark etmiyor: rakamlar ortak özetinde
 * görünmüyor, hakediş hesabına girmiyor ve kimseye ödenmiyor. Bu ekran
 * onları en yüksek gelirden başlayarak listeliyor.
 */
export function BTag() {
  const { veri, yukleniyor, hata } = useVeri<{
    anahtarlar: Anahtar[];
    sahipsiz: Sahipsiz[];
    olcumsuzSayisi: number;
  }>('/api/yonetim/btag');

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  const anahtarlar = veri?.anahtarlar ?? [];
  const sahipsiz = veri?.sahipsiz ?? [];
  const sahipsizGgr = sahipsiz.reduce((t, s) => t + s.ggr, 0);

  const anahtarSutunlari: Array<Sutun<Anahtar>> = [
    { ad: 'anahtar', etiket: 'Anahtar', deger: (a) => a.anahtar, hucre: (a) => <KisaKimlik deger={a.anahtar} /> },
    { ad: 'ortak', etiket: 'Ortak', deger: (a) => a.ortakAdi },
    {
      ad: 'durum',
      etiket: 'Durum',
      deger: (a) => a.durum,
      hucre: (a) => <Rozet metin={a.durum} renk={a.durum === 'onaylandi' ? 'olumlu' : 'notr'} />,
    },
    {
      ad: 'trafik',
      etiket: 'Trafik',
      deger: (a) => (a.olcumVar ? 2 : a.tiklamaVar ? 1 : 0),
      hucre: (a) => (
        a.olcumVar
          ? <Rozet metin="Ölçüm var" renk="olumlu" />
          : a.tiklamaVar
            ? <Rozet metin="Yalnızca tıklama" renk="uyari" />
            : <span className="text-xs" style={{ color: 'var(--metin-2)' }}>Yok</span>
      ),
    },
  ];

  const sahipsizSutunlari: Array<Sutun<Sahipsiz>> = [
    { ad: 'anahtar', etiket: 'Anahtar', deger: (s) => s.anahtar, hucre: (s) => <code className="text-xs">{s.anahtar}</code> },
    { ad: 'ggr', etiket: 'GGR', deger: (s) => s.ggr, hucre: (s) => paraBicimi(s.ggr), sagda: true },
    { ad: 'yatirim', etiket: 'Yatırım', deger: (s) => s.yatirim, hucre: (s) => paraBicimi(s.yatirim), sagda: true },
    { ad: 'gun', etiket: 'Gün', deger: (s) => s.gunSayisi, sagda: true },
    { ad: 'sonGun', etiket: 'Son ölçüm', deger: (s) => s.sonGun ?? '' },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OlcuKarti etiket="Kayıtlı anahtar" deger={String(anahtarlar.length)} />
        <OlcuKarti
          etiket="Trafiği olan"
          deger={String(anahtarlar.filter((a) => a.olcumVar).length)}
        />
        <OlcuKarti
          etiket="Sahipsiz anahtar"
          deger={String(sahipsiz.length)}
          alt={sahipsiz.length > 0 ? 'atfedilmemiş gelir' : undefined}
        />
        <OlcuKarti etiket="Trafiği olmayan ortak" deger={String(veri?.olcumsuzSayisi ?? 0)} />
      </div>

      <Kart baslik="Sahipsiz anahtarlar">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Backoffice’ten ölçüm geliyor ama bu anahtara sahip bir ortak kaydı yok. Bu gelir hiçbir
          ortağın özetinde görünmüyor, hakediş hesabına girmiyor ve kimseye ödenmiyor.
          {sahipsiz.length > 0 && (
            <>
              {' '}Toplam <strong>{paraBicimi(sahipsizGgr)}</strong> GGR atfedilmemiş durumda.
            </>
          )}
        </p>

        {sahipsiz.length === 0 ? (
          <Bos mesaj="Sahipsiz anahtar yok — gelen her ölçüm bir ortağa bağlı." />
        ) : (
          <>
            <VeriTablosu
              satirlar={sahipsiz}
              anahtar={(s) => s.anahtar}
              sutunlar={sahipsizSutunlari}
              varsayilanSiralama={{ ad: 'ggr', yon: 'azalan' }}
            />
            <p className="mt-3 text-xs" style={{ color: 'var(--metin-2)' }}>
              Çözmek için: bu anahtarla bir ortak oluşturun ya da mevcut bir ortağın izleme
              anahtarını buna eşitleyin. Anahtarı değiştirmek geçmiş ölçümleri de o ortağa bağlar.
            </p>
          </>
        )}
      </Kart>

      <Kart baslik="Kayıtlı anahtarlar">
        <VeriTablosu
          satirlar={anahtarlar}
          anahtar={(a) => a.anahtar}
          sutunlar={anahtarSutunlari}
          bosMesaj="Kayıtlı ortak yok."
          varsayilanSiralama={{ ad: 'trafik', yon: 'azalan' }}
        />
      </Kart>
    </>
  );
}
