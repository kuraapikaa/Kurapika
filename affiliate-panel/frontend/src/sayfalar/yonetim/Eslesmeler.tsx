import { useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { OlcuKarti } from '../../grafik';
import { KisaKimlik, VeriTablosu, type Sutun } from '../../tablo';
import { Bos, Hata, Kart, Rozet, Yukleniyor } from '../../ui';
import type { CakismaGorunumu, EslesmeGorunumu, YonetimUclari } from '@sunucu/sozlesme.js';

/**
 * OYUNCU ↔ ORTAK EŞLEŞMELERİ.
 *
 * Hakedişin dayanağı bu tablo: bir oyuncunun hangi ortağa ait olduğu
 * burada yazıyor. Yanlışsa para yanlış kişiye gider, eksikse ortak
 * getirdiği oyuncuyu kanıtlayamaz.
 *
 * Çakışmalar ayrı gösteriliyor çünkü tek tek masum, toplu hâlde
 * anlamlıdır: aynı ortaktan yığınla reddedilen talep, o ortağın
 * başkasının trafiğini kendine yazmaya çalıştığının en net işareti.
 */
export function Eslesmeler() {
  const [yeniAnahtar, setYeniAnahtar] = useState<string | null>(null);
  const [isliyor, setIsliyor] = useState(false);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);

  const { veri, yukleniyor, hata, yenile } = useVeri<YonetimUclari['/oyuncu-eslesmeleri']>(
    '/api/yonetim/oyuncu-eslesmeleri',
  );

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  const eslesmeler = veri?.eslesmeler ?? [];
  const cakismalar = veri?.cakismalar ?? [];
  const anahtar = veri?.anahtar;

  const anahtarUret = async () => {
    setIsliyor(true);
    setIslemHatasi(null);
    try {
      const yanit = await api.gonder<{ anahtar: string }>('/api/yonetim/s2s-anahtari', {});
      setYeniAnahtar(yanit.anahtar);
      yenile();
    } catch (h) {
      setIslemHatasi((h as Error).message);
    } finally {
      setIsliyor(false);
    }
  };

  const eslesmeSutunlari: Array<Sutun<EslesmeGorunumu>> = [
    {
      ad: 'oyuncu',
      etiket: 'Lynon oyuncu',
      deger: (e) => e.lynonOyuncuId,
      hucre: (e) => <code className="text-xs">{e.lynonOyuncuId}</code>,
    },
    { ad: 'ortak', etiket: 'Ortak', deger: (e) => e.ortakAdi ?? e.ortakAnahtari },
    {
      ad: 'ref',
      etiket: 'Ref kodu',
      deger: (e) => e.ortakAnahtari,
      hucre: (e) => <code className="text-xs">{e.ortakAnahtari}</code>,
    },
    {
      ad: 'kanal',
      etiket: 'Kanal',
      deger: (e) => e.medyaId ?? '',
      hucre: (e) => {
        const altlar = Object.entries(e.alt).filter(([, d]) => d);
        if (!e.medyaId && altlar.length === 0) {
          return <span className="text-xs" style={{ color: 'var(--metin-2)' }}>—</span>;
        }
        return (
          <span className="text-xs">
            {e.medyaId ? <KisaKimlik deger={e.medyaId} /> : null}
            {altlar.map(([k, d]) => ` ${k}=${d}`).join('')}
          </span>
        );
      },
    },
    {
      ad: 'tiklama',
      etiket: 'Tıklama',
      deger: (e) => (e.clickId ? 1 : 0),
      hucre: (e) => (e.clickId
        ? <Rozet metin="Bağlı" renk="olumlu" />
        // Tiklama kimligi olmadan geldi: ortak dogru ama hangi banner ya
        // da alt kanaldan geldigi bilinmiyor.
        : <Rozet metin="Yalnızca ref" renk="notr" />),
    },
    { ad: 'zaman', etiket: 'Kayıt', deger: (e) => e.olusturuldu, hucre: (e) => gunBicimi(e.olusturuldu) },
  ];

  const cakismaSutunlari: Array<Sutun<CakismaGorunumu>> = [
    {
      ad: 'oyuncu',
      etiket: 'Lynon oyuncu',
      deger: (c) => c.lynonOyuncuId,
      hucre: (c) => <code className="text-xs">{c.lynonOyuncuId}</code>,
    },
    { ad: 'talep', etiket: 'Talep eden', deger: (c) => c.denenenOrtakAdi ?? c.denenenOrtakAnahtari },
    { ad: 'sahip', etiket: 'Gerçek sahip', deger: (c) => c.mevcutOrtakAdi ?? c.mevcutOrtakId },
    { ad: 'zaman', etiket: 'Zaman', deger: (c) => c.zaman, hucre: (c) => gunBicimi(c.zaman) },
  ];

  // Ayni ortaktan gelen tekrarli talepler asil sinyal; tek tek bakmak
  // orunruyu gostermiyor.
  const talepEdenSayilari = new Map<string, number>();
  for (const c of cakismalar) {
    const ad = c.denenenOrtakAdi ?? c.denenenOrtakAnahtari;
    talepEdenSayilari.set(ad, (talepEdenSayilari.get(ad) ?? 0) + 1);
  }
  const enCokTalepEden = [...talepEdenSayilari.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OlcuKarti etiket="Eşleşen oyuncu" deger={String(eslesmeler.length)} />
        <OlcuKarti
          etiket="Tıklamaya bağlı"
          deger={String(eslesmeler.filter((e) => e.clickId).length)}
          alt="kanal kırılımı var"
        />
        <OlcuKarti
          etiket="Reddedilen talep"
          deger={String(cakismalar.length)}
          alt={enCokTalepEden ? `en çok: ${enCokTalepEden[0]}` : undefined}
        />
        <OlcuKarti
          etiket="S2S bağlantısı"
          deger={anahtar?.kuruluMu ? 'Kurulu' : 'Yok'}
          alt={anahtar?.sonKullanim ? `son: ${gunBicimi(anahtar.sonKullanim)}` : 'hiç kullanılmadı'}
        />
      </div>

      <Kart baslik="Kayıt bildirimi bağlantısı">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Oyuncu Lynon’a kaydolduğunda siteniz aşağıdaki uca bildirim gönderir ve eşleşme kurulur.
          İstek tarayıcıdan değil <strong>sunucudan</strong> gelmeli: bu uç “şu oyuncu şu ortağa
          ait” diyebiliyor, yani doğrudan paraya dokunuyor.
        </p>

        <pre
          className="overflow-x-auto rounded-lg p-3 text-xs"
          style={{ background: 'var(--yuzey-2)', color: 'var(--metin-1)' }}
        >{`POST /api/kayit/oyuncu
Authorization: Bearer <s2s-anahtari>
Content-Type: application/json

{ "lynonOyuncuId": "123456", "ref": "<clickid ya da ortak anahtari>" }`}</pre>

        <p className="mt-3 text-xs" style={{ color: 'var(--metin-2)' }}>
          <code>ref</code> olarak tıklama kimliği (<code>clickid</code>) göndermek daha iyi: hangi
          medya ve alt kanaldan gelindiği yalnızca onda var. Ortak anahtarı da kabul edilir.
          Aynı oyuncu için ikinci bir bildirim <strong>sahibi değiştirmez</strong>; yanıt
          <code> durum</code> alanında ne olduğunu söyler.
        </p>

        {islemHatasi && <p className="mt-3 text-sm" style={{ color: 'var(--olumsuz)' }}>{islemHatasi}</p>}

        {yeniAnahtar && (
          <div
            className="mt-3 rounded-lg p-3"
            style={{ background: 'var(--yuzey-2)', border: '1px solid var(--uyari)' }}
          >
            <p className="text-xs font-semibold" style={{ color: 'var(--uyari)' }}>
              Bu anahtar bir daha gösterilmeyecek — şimdi kopyalayın.
            </p>
            <code className="mt-2 block break-all text-xs">{yeniAnahtar}</code>
          </div>
        )}

        <button
          type="button"
          onClick={anahtarUret}
          disabled={isliyor}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ background: 'var(--vurgu)', color: 'var(--vurgu-uzeri)' }}
        >
          {anahtar?.kuruluMu ? 'Yeni anahtar üret (eskisi geçersiz olur)' : 'Anahtar üret'}
        </button>
      </Kart>

      <Kart baslik="Reddedilen talepler">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Bir ortak, başka bir ortağa ait oyuncuyu talep etti; ilk kayıt kuralı gereği reddedildi.
          Tek tek bakıldığında çoğu masum — oyuncu ikinci kez, başka bir linkten gelmiştir.
          Aynı ortaktan yığınla gelmesi ise başkasının trafiğini kendine yazma girişimidir.
        </p>
        {cakismalar.length === 0 ? (
          <Bos mesaj="Reddedilen talep yok." />
        ) : (
          <VeriTablosu
            satirlar={cakismalar}
            anahtar={(c) => c.id}
            sutunlar={cakismaSutunlari}
            varsayilanSiralama={{ ad: 'zaman', yon: 'azalan' }}
          />
        )}
      </Kart>

      <Kart baslik="Eşleşmeler">
        {eslesmeler.length === 0 ? (
          <Bos mesaj="Henüz eşleşme yok. Kayıt bildirimi geldiğinde oyuncular burada listelenir." />
        ) : (
          <VeriTablosu
            satirlar={eslesmeler}
            anahtar={(e) => e.lynonOyuncuId}
            sutunlar={eslesmeSutunlari}
            varsayilanSiralama={{ ad: 'zaman', yon: 'azalan' }}
          />
        )}
      </Kart>
    </>
  );
}
