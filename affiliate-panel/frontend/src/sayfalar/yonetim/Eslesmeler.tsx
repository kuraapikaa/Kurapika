import { useMemo, useState } from 'react';
import { api, gunBicimi, useVeri } from '../../api';
import { OlcuKarti } from '../../grafik';
import { KisaKimlik, VeriTablosu, type Sutun } from '../../tablo';
import { Bos, Hata, Kart, Rozet, Yukleniyor } from '../../ui';
import type {
  CakismaGorunumu,
  EslesmeGorunumu,
  OrtakGorunumu,
  TopluAtamaSatiri,
  TopluAtamaSonucu,
  YonetimUclari,
} from '@sunucu/sozlesme.js';

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
  const ortaklarVeri = useVeri<YonetimUclari['/ortaklar']>('/api/yonetim/ortaklar');

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

      <TopluAtamaKarti ortaklar={ortaklarVeri.veri?.ortaklar ?? []} yenile={yenile} />

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

const KULLANICI_ADI_AYIRICI = /[\r\n,;]+/;

function satirSayisiHesapla(ham: string): number {
  return ham.split(KULLANICI_ADI_AYIRICI).map((s) => s.trim()).filter(Boolean).length;
}

const EAD_SONUC_RENGI: Record<TopluAtamaSatiri['durum'], 'olumlu' | 'notr' | 'olumsuz'> = {
  basarili: 'olumlu',
  bulunamadi: 'notr',
  hata: 'olumsuz',
};
const EAD_SONUC_ETIKETI: Record<TopluAtamaSatiri['durum'], string> = {
  basarili: 'Atandı',
  bulunamadi: 'Bulunamadı',
  hata: 'Hata',
};

/**
 * KULLANICI ADINDAN TOPLU AFFİLİATE GEÇİŞİ.
 *
 * Girdi kullanıcı adı listesi + hedef ortak. Zaten başka bir ortakta
 * olan bir oyuncu da BİLEREK taşınabiliyor — "geçiş" tam olarak bu:
 * admin ground truth'u düzeltiyor, "ilk kayıt kazanır" siperi burada
 * (S2S bildirimlerinin aksine) devre dışı.
 */
function TopluAtamaKarti({ ortaklar, yenile }: { ortaklar: OrtakGorunumu[]; yenile: () => void }) {
  const [hedefOrtak, setHedefOrtak] = useState('');
  const [kullaniciAdlari, setKullaniciAdlari] = useState('');
  const [isliyor, setIsliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<TopluAtamaSonucu | null>(null);

  const sinirVeri = useVeri<YonetimUclari['/oyuncu-eslesmeleri/toplu-atama-siniri']>(
    '/api/yonetim/oyuncu-eslesmeleri/toplu-atama-siniri',
  );
  const limit = sinirVeri.veri?.limit ?? null;

  const onayliOrtaklar = useMemo(() => ortaklar.filter((o) => o.durum === 'onaylandi'), [ortaklar]);
  const ortakAdi = useMemo(() => new Map(ortaklar.map((o) => [o.id, o.ad])), [ortaklar]);
  const satirSayisi = useMemo(() => satirSayisiHesapla(kullaniciAdlari), [kullaniciAdlari]);
  const sinirAsildi = limit != null && satirSayisi > limit;

  const gonderilebilir = Boolean(hedefOrtak) && satirSayisi > 0 && !sinirAsildi && !isliyor;

  const gonder = async () => {
    setIsliyor(true);
    setHata(null);
    setSonuc(null);
    try {
      const yanit = await api.gonder<TopluAtamaSonucu>('/api/yonetim/oyuncu-eslesmeleri/toplu-atama', {
        kullaniciAdlari,
        ortakAnahtari: hedefOrtak,
      });
      setSonuc(yanit);
      yenile();
    } catch (h) {
      setHata((h as Error).message);
    } finally {
      setIsliyor(false);
    }
  };

  const sonucSutunlari: Array<Sutun<TopluAtamaSatiri>> = [
    { ad: 'kullanici', etiket: 'Kullanıcı adı', deger: (s) => s.kullaniciAdi },
    {
      ad: 'durum',
      etiket: 'Durum',
      deger: (s) => s.durum,
      hucre: (s) => <Rozet metin={EAD_SONUC_ETIKETI[s.durum]} renk={EAD_SONUC_RENGI[s.durum]} />,
    },
    {
      ad: 'detay',
      etiket: 'Detay',
      deger: (s) => s.eslesmeDurumu ?? s.hata ?? '',
      hucre: (s) => {
        if (s.durum === 'hata') return <span className="text-xs" style={{ color: 'var(--olumsuz)' }}>{s.hata}</span>;
        if (s.durum === 'bulunamadi') {
          return <span className="text-xs" style={{ color: 'var(--metin-2)' }}>Kullanıcı adı backoffice'te yok</span>;
        }
        if (s.eslesmeDurumu === 'tasindi') {
          const onceki = s.oncekiOrtakId ? (ortakAdi.get(s.oncekiOrtakId) ?? s.oncekiOrtakId) : '—';
          return <span className="text-xs">Taşındı — önceki: {onceki}</span>;
        }
        if (s.eslesmeDurumu === 'zaten-bu-ortakta') {
          return <span className="text-xs" style={{ color: 'var(--metin-2)' }}>Zaten bu ortakta</span>;
        }
        return <span className="text-xs">Yeni eşleşme</span>;
      },
    },
    {
      ad: 'backoffice',
      etiket: 'Backoffice',
      deger: (s) => (s.backofficeBasarili === undefined ? '' : s.backofficeBasarili ? 1 : 0),
      hucre: (s) => {
        if (s.durum !== 'basarili') return <span className="text-xs" style={{ color: 'var(--metin-2)' }}>—</span>;
        if (s.backofficeBasarili === undefined) return <span className="text-xs" style={{ color: 'var(--metin-2)' }}>—</span>;
        return s.backofficeBasarili
          ? <Rozet metin="Senkron" renk="olumlu" />
          : <span title={s.backofficeMesaji}><Rozet metin="Senkron değil" renk="uyari" /></span>;
      },
    },
  ];

  return (
    <Kart baslik="Kullanıcı adından toplu affiliate geçişi">
      <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
        Destek üzerinden ya da izleme linki olmadan kaydolmuş oyuncuları toplu hâlde bir ortağa
        bağlar. <strong>Zaten başka bir ortakta olan bir oyuncu da taşınır</strong> — bu, S2S
        bildirimindeki "ilk kayıt kazanır" korumasından bilerek farklı: burada ground truth'u
        siz düzeltiyorsunuz.
      </p>

      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <div>
          <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--metin-2)' }}>
            Hedef ortak
          </label>
          <select
            value={hedefOrtak}
            onChange={(e) => setHedefOrtak(e.target.value)}
            className="h-10 w-full rounded-lg px-3 text-sm"
            style={{ background: 'var(--yuzey-2)', border: '1px solid var(--kenar)', color: 'var(--metin-1)' }}
          >
            <option value="">Seçin…</option>
            {onayliOrtaklar.map((o) => (
              <option key={o.id} value={o.ortakAnahtari}>{o.ad} ({o.ortakAnahtari})</option>
            ))}
          </select>
          {onayliOrtaklar.length === 0 && (
            <p className="mt-1 text-xs" style={{ color: 'var(--uyari)' }}>Onaylı ortak yok.</p>
          )}

          <p className="mt-3 text-xs" style={{ color: 'var(--metin-2)' }}>
            {satirSayisi} kullanıcı adı
            {limit != null && ` / en fazla ${limit}`}
          </p>
          {sinirAsildi && (
            <p className="mt-1 text-xs" style={{ color: 'var(--olumsuz)' }}>
              Sınır aşıldı — listeyi bölüp ayrı ayrı gönderin.
            </p>
          )}
        </div>

        <textarea
          value={kullaniciAdlari}
          onChange={(e) => setKullaniciAdlari(e.target.value)}
          placeholder={'kullanici1\nkullanici2\nkullanici3'}
          rows={6}
          className="w-full rounded-lg px-3 py-2 font-mono text-xs"
          style={{ background: 'var(--yuzey-2)', border: '1px solid var(--kenar)', color: 'var(--metin-1)' }}
        />
      </div>

      {hata && <p className="mt-3 text-sm" style={{ color: 'var(--olumsuz)' }}>{hata}</p>}

      <button
        type="button"
        onClick={gonder}
        disabled={!gonderilebilir}
        className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ background: 'var(--vurgu)', color: 'var(--vurgu-uzeri)' }}
      >
        {isliyor ? 'İşleniyor…' : 'Toplu ata'}
      </button>

      {sonuc && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <Rozet metin={`${sonuc.basarili} atandı`} renk="olumlu" />
            {sonuc.bulunamadi > 0 && <Rozet metin={`${sonuc.bulunamadi} bulunamadı`} renk="notr" />}
            {sonuc.hatali > 0 && <Rozet metin={`${sonuc.hatali} hata`} renk="olumsuz" />}
            {sonuc.tekrarSayisi > 0 && (
              <span style={{ color: 'var(--metin-2)' }}>({sonuc.tekrarSayisi} tekrar eden ad atlandı)</span>
            )}
          </div>
          <VeriTablosu
            satirlar={sonuc.satirlar}
            anahtar={(s) => s.kullaniciAdi}
            sutunlar={sonucSutunlari}
          />
        </div>
      )}
    </Kart>
  );
}
