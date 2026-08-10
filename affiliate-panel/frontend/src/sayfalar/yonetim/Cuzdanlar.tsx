import { useState } from 'react';
import { api, paraBicimi, gunBicimi, useVeri } from '../../api';
import { OlcuKarti } from '../../grafik';
import { VeriTablosu, type Sutun } from '../../tablo';
import { Bos, Buton, Hata, Kart, Rozet, Yukleniyor } from '../../ui';
import type { YonetimUclari } from '@sunucu/sozlesme.js';

type Bakiye = YonetimUclari['/cuzdanlar']['bakiyeler'][number];
type Hareket = YonetimUclari['/cuzdanlar']['hareketler'][number];

const TUR_ETIKETI: Record<string, { ad: string; renk: 'olumlu' | 'olumsuz' | 'notr' }> = {
  hakedis: { ad: 'Hakediş', renk: 'olumlu' },
  odeme: { ad: 'Ödeme', renk: 'olumsuz' },
  duzeltme: { ad: 'Düzeltme', renk: 'notr' },
};

/**
 * ORTAK CÜZDANLARI.
 *
 * Bakiye bir sütun değil, hareketlerin toplamı — bu yüzden ekran hem
 * bakiyeyi hem de onu oluşturan defteri gösteriyor. "Neden bu rakam"
 * sorusunun cevabı aynı sayfada.
 */
export function Cuzdanlar() {
  const [isliyor, setIsliyor] = useState(false);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const { veri, yukleniyor, hata, yenile } = useVeri<YonetimUclari['/cuzdanlar']>('/api/yonetim/cuzdanlar');

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  const bakiyeler = veri?.bakiyeler ?? [];
  const hareketler = veri?.hareketler ?? [];
  const toplamBorc = bakiyeler.reduce((t, b) => t + Math.max(0, b.bakiye), 0);

  const tahakkukCalistir = async () => {
    setIsliyor(true);
    setIslemHatasi(null);
    try {
      await api.gonder('/api/yonetim/cuzdan/tahakkuk', {});
      yenile();
    } catch (h) {
      setIslemHatasi((h as Error).message);
    } finally {
      setIsliyor(false);
    }
  };

  const bakiyeSutunlari: Array<Sutun<Bakiye>> = [
    { ad: 'ortak', etiket: 'Ortak', deger: (b) => b.ortakAdi ?? b.ortakId },
    {
      ad: 'bakiye',
      etiket: 'Bakiye',
      deger: (b) => b.bakiye,
      hucre: (b) => (
        <span style={{ color: b.bakiye < 0 ? 'var(--olumsuz)' : undefined }}>{paraBicimi(b.bakiye)}</span>
      ),
      sagda: true,
    },
    { ad: 'hareket', etiket: 'Hareket', deger: (b) => b.hareketSayisi, sagda: true },
    { ad: 'son', etiket: 'Son hareket', deger: (b) => b.sonHareket ?? '', hucre: (b) => gunBicimi(b.sonHareket) },
  ];

  const hareketSutunlari: Array<Sutun<Hareket>> = [
    { ad: 'ortak', etiket: 'Ortak', deger: (h) => h.ortakAdi ?? h.ortakId },
    {
      ad: 'tur',
      etiket: 'Tür',
      deger: (h) => h.tur,
      hucre: (h) => {
        const e = TUR_ETIKETI[h.tur] ?? { ad: h.tur, renk: 'notr' as const };
        return <Rozet metin={e.ad} renk={e.renk} />;
      },
    },
    {
      ad: 'tutar',
      etiket: 'Tutar',
      deger: (h) => h.tutar,
      hucre: (h) => (
        <span style={{ color: h.tutar < 0 ? 'var(--olumsuz)' : 'var(--olumlu)' }}>
          {h.tutar > 0 ? '+' : ''}{paraBicimi(h.tutar)}
        </span>
      ),
      sagda: true,
    },
    { ad: 'donem', etiket: 'Dönem', deger: (h) => h.donem ?? '' },
    { ad: 'aciklama', etiket: 'Açıklama', deger: (h) => h.aciklama ?? '' },
    { ad: 'zaman', etiket: 'Zaman', deger: (h) => h.olusturuldu, hucre: (h) => gunBicimi(h.olusturuldu) },
  ];

  if (veri && !veri.veritabaniVarMi) {
    return (
      <Kart baslik="Cüzdanlar">
        <Bos mesaj="Cüzdan için veritabanı bağlantısı gerekli. DATABASE_URL tanımlı değil." />
      </Kart>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OlcuKarti etiket="Cüzdanı olan ortak" deger={String(bakiyeler.length)} />
        <OlcuKarti etiket="Toplam borç" deger={paraBicimi(toplamBorc)} alt="ödenmemiş hakediş" />
        {/* NEGATIF BAKIYE ayri bir kart: toplam borcun icinde gorunmuyor
            (orada Math.max(0, ...) ile disarida birakiliyor) ve gozden
            kaciyordu. Negatif bakiye "ortak bize borclu" demek degil,
            devreden zarar demek — takip edilmesi gereken bir durum. */}
        <OlcuKarti
          etiket="Negatif bakiye"
          deger={String(bakiyeler.filter((b) => b.bakiye < 0).length)}
          alt={bakiyeler.some((b) => b.bakiye < 0) ? 'devreden zarar' : undefined}
        />
        <OlcuKarti etiket="Son hareketler" deger={String(hareketler.length)} />
      </div>

      <Kart baslik="Nasıl işliyor">
        <p className="text-sm" style={{ color: 'var(--metin-2)' }}>
          Her gece yerel saatle 00:00'da dönem hakedişi yeniden hesaplanıyor ve cüzdana
          <strong> aradaki fark</strong> yazılıyor. Kademeli oranlar ve asgari ödeme dönem
          kavramları olduğu için her gün tek başına değil, ayın tamamı hesaplanıyor.
          Cüzdana yalnızca <em>o dönemde kazanılan</em> giriyor; ödenmemiş kazanç zaten
          bakiyede birikiyor.
        </p>
        {islemHatasi && <p className="mt-2 text-sm" style={{ color: 'var(--olumsuz)' }}>{islemHatasi}</p>}
        {/* Elle yazılmış düğme `var(--vurgu-uzeri)` kullanıyordu — palette
            böyle bir değişken YOK (doğrusu `--vurgu-metin`). Geçersiz değer
            sessizce yok sayılıp yazı rengi miras alıyor, yani altın dolgu
            üzerinde altın yazı riski vardı. Paylaşılan `Buton` zaten doğru
            değişkenleri ve pahlı (kesik) birincil biçimi taşıyor. */}
        <div className="mt-3">
          <Buton tur="birincil" devredisi={isliyor} onClick={tahakkukCalistir}>
            {isliyor ? 'Hesaplanıyor…' : 'Şimdi tahakkuk çalıştır'}
          </Buton>
        </div>
      </Kart>

      <Kart baslik="Bakiyeler">
        {bakiyeler.length === 0 ? (
          <Bos mesaj="Henüz cüzdan hareketi yok. İlk tahakkuk sonrası bakiyeler burada görünür." />
        ) : (
          <VeriTablosu
            satirlar={bakiyeler}
            anahtar={(b) => b.ortakId}
            sutunlar={bakiyeSutunlari}
            varsayilanSiralama={{ ad: 'bakiye', yon: 'azalan' }}
          />
        )}
      </Kart>

      <Kart baslik="Hareket defteri">
        {hareketler.length === 0 ? (
          <Bos mesaj="Hareket yok." />
        ) : (
          <VeriTablosu
            satirlar={hareketler}
            anahtar={(h) => h.id}
            sutunlar={hareketSutunlari}
            varsayilanSiralama={{ ad: 'zaman', yon: 'azalan' }}
          />
        )}
      </Kart>
    </>
  );
}
