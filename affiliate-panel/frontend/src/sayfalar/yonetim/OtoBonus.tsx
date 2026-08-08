import { useEffect, useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Onay, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';
import type { OtoBonusDurumuYaniti } from '@sunucu/sozlesme.js';

/**
 * OTO FTD BONUSU — kural ve gönderim kayıtları.
 *
 * Kural tek: oyuncu ilk yatırımını yaptığında şu tutarda bonus gönder.
 * Bonusu platforma WhatsApp CRM işliyor; oradaki günlük tavan ve kayıt
 * düzeni aynen geçerli. Bu ekran kuralı yönetir ve her gönderimin ne
 * olduğunu gösterir — "bonus gitti mi" sorusu panelden cevaplanmalı,
 * CRM loglarından değil.
 */

const DURUM_ROZETI = {
  basarili: { metin: 'Gönderildi', renk: 'olumlu' },
  basarisiz: { metin: 'Başarısız', renk: 'olumsuz' },
  atlandi: { metin: 'Atlandı', renk: 'notr' },
} as const;

export function OtoBonus() {
  const { veri, yukleniyor, hata, yenile } = useVeri<OtoBonusDurumuYaniti>('/api/yonetim/oto-bonus');

  const [aktif, setAktif] = useState(false);
  // Tutar arayüzde TL, kayıtta kuruş: para her yerde minor unit ama
  // kimse forma "500000" yazarak 5.000 TL kastettiğini düşünmez.
  const [tutarTl, setTutarTl] = useState('');
  const [bonusKodu, setBonusKodu] = useState('');
  const [not, setNot] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kayitHatasi, setKayitHatasi] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  useEffect(() => {
    if (!veri) return;
    setAktif(veri.ayar.aktif);
    setTutarTl(veri.ayar.tutarKurus ? String(veri.ayar.tutarKurus / 100) : '');
    setBonusKodu(veri.ayar.bonusKodu ?? '');
    setNot(veri.ayar.not ?? '');
  }, [veri]);

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  const kaydet = async () => {
    setKaydediliyor(true);
    setKayitHatasi(null);
    setBilgi(null);
    try {
      const kurus = Math.round((Number(tutarTl.replace(',', '.')) || 0) * 100);
      await api.yaz('/api/yonetim/oto-bonus', { aktif, tutarKurus: kurus, bonusKodu, not });
      setBilgi('Kural kaydedildi.');
      yenile();
    } catch (h) {
      setKayitHatasi(h instanceof Error ? h.message : 'Kaydedilemedi.');
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <>
      {!veri?.yapilandirildi && (
        <p className="hata border px-3 py-2 text-sm" style={{ color: 'var(--uyari)', borderColor: 'var(--uyari)', background: 'var(--yuzey)' }}>
          CRM bağlantısı yapılandırılmamış: sunucuda <code>AFF_CRM_URL</code> ve{' '}
          <code>AFF_CRM_BONUS_ANAHTARI</code> tanımlanana kadar kural kaydedilse bile gönderim yapılmaz.
        </p>
      )}

      <Kart baslik="Kural" sag={<Buton tur="birincil" onClick={kaydet} devredisi={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}</Buton>}>
        <div className="space-y-4">
          <Onay etiket="İlk yatırımda otomatik bonus gönder" deger={aktif} degisti={setAktif} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Alan
              etiket="Bonus tutarı (₺)"
              deger={tutarTl}
              degisti={setTutarTl}
              tip="number"
              ipucu="Oyuncu başına bir kez, ilk yatırım tespit edildiğinde."
            />
            <Alan
              etiket="Bonus kodu"
              deger={bonusKodu}
              degisti={setBonusKodu}
              ipucu="Platformdaki tanım; boşsa serbest tutar olarak işlenir."
            />
            <Alan
              etiket="Not"
              deger={not}
              degisti={setNot}
              ipucu="CRM'deki bonus kaydında görünür."
            />
          </div>
          {kayitHatasi && <Hata mesaj={kayitHatasi} />}
          {bilgi && <p className="text-sm" style={{ color: 'var(--olumlu)' }}>{bilgi}</p>}
          <p className="text-xs" style={{ color: 'var(--metin-2)' }}>
            Gönderim CRM'in günlük bonus tavanına tabidir ve yalnızca taze tespitlerde çalışır —
            geri doldurma günlerindeki eski ilk yatırımlara bonus gitmez.
          </p>
        </div>
      </Kart>

      <Kart baslik="Gönderim kayıtları">
        {!veri || veri.kayitlar.length === 0 ? (
          <Bos mesaj="Henüz gönderim yok. Kural açıkken ilk yatırım tespit edildiğinde burada görünür." />
        ) : (
          <Tablo basliklar={['Oyuncu', 'Gün', 'Durum', 'Açıklama', 'Zaman']}>
            {veri.kayitlar.map((k) => (
              <Satir key={k.id}>
                <Hucre><code className="text-xs">{k.oyuncuId}</code></Hucre>
                <Hucre>{k.gun}</Hucre>
                <Hucre><Rozet metin={DURUM_ROZETI[k.durum].metin} renk={DURUM_ROZETI[k.durum].renk} /></Hucre>
                <Hucre>{k.mesaj ?? '—'}</Hucre>
                <Hucre>{gunBicimi(k.zaman)}</Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>
    </>
  );
}
