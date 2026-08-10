import { useState, type ReactNode } from 'react';
import { api, gunBicimi, paraBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Olcu, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';
import { AdimBasligi, AdimGostergesi, AKIS_IKONU, NasilCalisir } from '../../sihirbaz';
import type { AltLinkGorunumu as AltLink, PortalOyuncusu, Medya, MedyaTuru } from '@sunucu/sozlesme.js';

const ALTLAR = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'] as const;

/**
 * HEDEF İKONLARI — nav ikonlarından (`kabuk.tsx`) BİLEREK ayrı.
 *
 * Orada rota simgesi, burada içerik TÜRÜ simgesi; ikisi aynı görsel
 * dilde ama farklı anlam taşıyor, tek bir sette karıştırmak ikisinin
 * de okunurluğunu düşürür.
 */
const hedefIkon = (d: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const HEDEF_IKONLARI: Record<MedyaTuru | 'medyasiz', ReactNode> = {
  medyasiz: hedefIkon(<><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>),
  landing: hedefIkon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><circle cx="6.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="9" cy="6.5" r=".5" fill="currentColor" /></>),
  banner: hedefIkon(<><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 15-5-4-9 8" /></>),
  video: hedefIkon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3Z" /></>),
  metin: hedefIkon(<><path d="M4 6h16M4 12h16M4 18h10" /></>),
};

const TUR_ETIKETI: Record<MedyaTuru, string> = {
  landing: 'Landing sayfası', banner: 'Banner', video: 'Video', metin: 'Metin linki',
};

/** Adım 1'de tek dokunuşla isim dolduran öneriler. */
const AD_ONERILERI = ['Telegram grubum', 'Instagram profilim', 'YouTube kanalım', 'Blog yazım'];

/** Etiket kurucusunun "neyi ayırt etmek istiyorsunuz" seçenekleri. */
const ETIKET_AMACI = [
  { anahtar: 'sub1', etiket: 'Paylaştığım kanal', ornek: 'telegram' },
  { anahtar: 'sub2', etiket: 'Tek bir gönderi', ornek: 'reels-14mart' },
  { anahtar: 'sub3', etiket: 'Kampanya / ay', ornek: 'mart-kupon' },
  { anahtar: 'sub4', etiket: 'Kullandığım banner', ornek: 'banner-728' },
  { anahtar: 'sub5', etiket: 'Kendi notum', ornek: 'deneme-2' },
];

/**
 * HEDEF SEÇİCİ — dönüşen liste yerine görsel kartlar.
 *
 * Bir kutu içinden metin okuyup "landing (banner)" gibi bir şey seçmek,
 * ortağın az önce yüklediği kreatifi tekrar tanımasını gerektiriyordu.
 * Kart; banner'da GERÇEK görseli, diğerlerinde tür ikonunu gösteriyor —
 * tanımak, okumaktan hızlı.
 */
function HedefKarti({
  secili, ikon, baslik, altBaslik, onClick,
}: {
  secili: boolean;
  ikon: ReactNode;
  baslik: string;
  altBaslik: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border p-2.5 text-left transition-opacity"
      style={{
        borderColor: secili ? 'var(--vurgu)' : 'var(--kenar)',
        background: secili ? 'var(--vurgu-yumusak)' : 'var(--yuzey-2)',
        borderWidth: secili ? 2 : 1,
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md"
        style={{ background: 'var(--yuzey)', color: secili ? 'var(--vurgu)' : 'var(--metin-2)' }}
      >
        {ikon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{baslik}</span>
        <span className="block truncate text-xs" style={{ color: 'var(--metin-2)' }}>{altBaslik}</span>
      </span>
    </button>
  );
}

/**
 * ALT LİNKLER — ortağın kendi kampanya bağlantıları.
 *
 * Her seferinde parametreleri elle yazmak yerine bir kez kurulup isim
 * verilen kısa adresler. Aynı link her defasında aynı kırılıma yazıyor;
 * elle yazılan bir harf farkı trafiği ayrı bir kanal olarak sayardı ve
 * bu geriye dönük düzeltilemez.
 *
 * ── Bu sürümde değişen: FORM ARTIK SİHİRBAZ ──
 *
 * Önceki hâli tek ekranda altı alan gösteriyordu (ad, hedef kartı, beş
 * etiket). Üçü zorunlu değil ama hepsi aynı anda görünüyordu ve
 * hangisinin gerekli olduğu okunmuyordu; ortaklar formu doldurmadan
 * bırakıp "nasıl link alıyorum" diye soruyordu.
 *
 * Üç adım gerekliyi zorunludan ayırıyor: (1) isim, (2) hedef, (3) hazır
 * link. Etiketler sihirbazın DIŞINDA, kapalı bir panelde — isteyen
 * açar, açmayan hiç görmez. Ayrıca ekranın en üstünde "alt link nedir"
 * şeridi var: en sık sorulan soru artık dokümanda değil ekranda.
 */
export function PortalAltLinkler() {
  const liste = useVeri<{ linkler: AltLink[]; temelHazir: boolean }>('/api/portal/alt-linkler');
  const medyalar = useVeri<{ medyalar: Medya[] }>('/api/portal/medya');
  const [adim, setAdim] = useState(1);
  const [form, setForm] = useState({ ad: '', medyaId: '' });
  const [alt, setAlt] = useState<Record<string, string>>({});
  const [etiketlerAcik, setEtiketlerAcik] = useState(false);
  const [etiketAmaci, setEtiketAmaci] = useState('sub1');
  const [hata, setHata] = useState<string | null>(null);
  const [kopyalanan, setKopyalanan] = useState<string | null>(null);
  const [sonKurulan, setSonKurulan] = useState<AltLink | null>(null);
  const [qr, setQr] = useState<{ id: string; ad: string; adres: string } | null>(null);
  const [oyuncular, setOyuncular] = useState<{
    id: string; ad: string; yukleniyor: boolean; liste: PortalOyuncusu[];
  } | null>(null);

  const oyunculariGetir = async (link: AltLink) => {
    if (oyuncular?.id === link.id) {
      setOyuncular(null);
      return;
    }
    setOyuncular({ id: link.id, ad: link.ad, yukleniyor: true, liste: [] });
    try {
      const sonuc = await api.al<{ oyuncular: PortalOyuncusu[] }>(`/api/portal/alt-linkler/${link.id}/oyuncular`);
      setOyuncular({ id: link.id, ad: link.ad, yukleniyor: false, liste: sonuc.oyuncular });
    } catch {
      setOyuncular({ id: link.id, ad: link.ad, yukleniyor: false, liste: [] });
    }
  };

  const calistir = async (is: () => Promise<unknown>) => {
    setHata(null);
    try {
      await is();
      liste.yenile();
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'İşlem başarısız.');
    }
  };

  /** Adım 3'e geçiş: linki kurar, dönen kaydı özet için saklar. */
  const linkiKur = async () => {
    setHata(null);
    try {
      // Uc iki bicimden birini donuyor: kaydin kendisi ya da { link }.
      // Ikisini de kabul ediyoruz; sunucu tarafi degisirse ekran sessizce
      // bos bir ozet gostermesin. Hicbiri gelmezse null kaliyor ve ozet
      // kisa kod ile ciziliyor — YANLIS bir adres gostermek, ortagin
      // paylastigi linkin yanlis olmasi demek.
      const sonuc = await api.gonder<AltLink | { link: AltLink }>('/api/portal/alt-linkler', { ...form, alt });
      const kayit = sonuc && typeof sonuc === 'object' && 'link' in sonuc
        ? (sonuc as { link: AltLink }).link
        : (sonuc as AltLink | null);
      setSonKurulan(kayit && 'id' in kayit ? kayit : null);
      setAdim(3);
      liste.yenile();
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'Link oluşturulamadı.');
    }
  };

  const sihirbaziSifirla = () => {
    setForm({ ad: '', medyaId: '' });
    setAlt({});
    setEtiketlerAcik(false);
    setSonKurulan(null);
    setAdim(1);
  };

  const linkler = liste.veri?.linkler ?? [];
  const linkSayisi = linkler.length;
  const aktifSayisi = linkler.filter((l) => l.aktif).length;
  const toplamTiklama = linkler.reduce((t, l) => t + l.tiklama, 0);
  const toplamYatirim = linkler.reduce((t, l) => t + l.yatirim, 0);
  const toplamCekim = linkler.reduce((t, l) => t + l.cekim, 0);
  // Hic tiklanmayan link, "paylastim mi?" sorusunun cevabi. Ortagin
  // kendi hatasini gormesinin en hizli yolu bu sayi.
  const tiklanmayan = linkler.filter((l) => l.tiklama === 0).length;
  const enIyi = linkler.reduce<AltLink | null>((e, l) => (!e || l.tiklama > e.tiklama ? l : e), null);

  const seciliMedya = (medyalar.veri?.medyalar ?? []).find((m) => m.id === form.medyaId);
  const hedefAdi = seciliMedya ? seciliMedya.ad : 'Aktif landing sayfanız';

  // Etiket kurucusunun canli ornegi. Ornek link YOKSA (henuz link
  // kurulmamis) ilk linkin adresi yerine yer tutucu gosteriliyor —
  // uydurma bir adres kopyalanip paylasilabilirdi.
  const ornekAdres = linkler.find((l) => l.tamAdres)?.tamAdres ?? null;
  const amac = ETIKET_AMACI.find((e) => e.anahtar === etiketAmaci)!;

  if (liste.yukleniyor) return <Yukleniyor />;

  return (
    <>
      <Kart baslik="Alt link nedir?">
        <p className="mb-4 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>
          Size ait, kısa bir web adresi. Paylaştığınız her yer için ayrı bir tane alırsanız,
          <strong style={{ color: 'var(--metin)' }}> hangi paylaşımınızın kazandırdığını</strong> tek
          tek görürsünüz. Parametreler adreste <strong style={{ color: 'var(--metin)' }}>görünmez</strong>,
          kayıttan gelir — kanal isimlendirmeniz dışarıya sızmaz ve linki elle düzenleyen biri
          trafiği başka bir kırılıma yazamaz.
        </p>
        <NasilCalisir
          adimlar={[
            { ikon: AKIS_IKONU.paylas, baslik: '1. Linki paylaşırsınız', metin: 'Telegram, Instagram, blog — nereye isterseniz.' },
            { ikon: AKIS_IKONU.oyuncu, baslik: '2. Oyuncu tıklar, kaydolur', metin: 'Sistem onu otomatik olarak size bağlar.' },
            { ikon: AKIS_IKONU.kazanc, baslik: '3. Kazancınız yazılır', metin: 'Getirdiği gelirin payı her ay hesabınıza geçer.' },
          ]}
        />
      </Kart>

      <Kart baslik="Yeni alt link">
        <div className="mb-5">
          <AdimGostergesi
            adimlar={[
              { no: 1, etiket: 'İsim verin' },
              { no: 2, etiket: 'Hedef seçin' },
              { no: 3, etiket: 'Linkiniz hazır' },
            ]}
            simdiki={adim}
            git={setAdim}
          />
        </div>

        {adim === 1 && (
          <div>
            <AdimBasligi
              baslik="Bu linki nerede paylaşacaksınız?"
              aciklama="Sadece sizin göreceğiniz bir isim. Oyuncular bunu görmez."
            />
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-80">
                <Alan
                  etiket="Link adı"
                  deger={form.ad}
                  degisti={(v) => setForm({ ...form, ad: v })}
                  ipucu="örn. Instagram bio — Ekim"
                />
              </div>
              <Buton tur="birincil" devredisi={!form.ad.trim()} onClick={() => setAdim(2)}>
                Devam →
              </Buton>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--metin-2)' }}>Hazır isimler:</span>
              {AD_ONERILERI.map((o) => (
                <Buton key={o} onClick={() => { setForm({ ...form, ad: o }); setAdim(2); }}>{o}</Buton>
              ))}
            </div>
          </div>
        )}

        {adim === 2 && (
          <div>
            <AdimBasligi
              baslik="Oyuncu tıklayınca hangi sayfa açılsın?"
              aciklama={
                <>
                  Bu bir <strong style={{ color: 'var(--metin)' }}>iniş sayfası</strong> seçimi.
                  Telegram'da bugünün kuponunu paylaştıysanız, tıklayan kişiyi genel ana sayfaya
                  değil doğrudan o içeriğe düşürmek mantıklı — aradığını ilk ekranda bulur.
                  Komisyonunuz değişmez; sadece <strong style={{ color: 'var(--metin)' }}>kaç
                  kişinin kayıt olduğu</strong> değişir. Emin değilseniz "Medyasız" bırakın.
                </>
              }
            />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <HedefKarti
                secili={form.medyaId === ''}
                ikon={HEDEF_IKONLARI.medyasiz}
                baslik="Medyasız"
                altBaslik="Aktif landing sayfanız"
                onClick={() => setForm({ ...form, medyaId: '' })}
              />
              {(medyalar.veri?.medyalar ?? []).map((m) => (
                <HedefKarti
                  key={m.id}
                  secili={form.medyaId === m.id}
                  ikon={
                    m.tur === 'banner' && m.varlikUrl ? (
                      <img src={m.varlikUrl} alt="" className="h-full w-full object-cover" />
                    ) : HEDEF_IKONLARI[m.tur]
                  }
                  baslik={m.ad}
                  altBaslik={TUR_ETIKETI[m.tur]}
                  onClick={() => setForm({ ...form, medyaId: m.id })}
                />
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Buton tur="birincil" onClick={linkiKur}>Linkimi oluştur</Buton>
              <Buton onClick={() => setAdim(1)}>← Geri</Buton>
            </div>
          </div>
        )}

        {adim === 3 && (
          <div>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold"
                style={{ background: 'color-mix(in srgb, var(--olumlu) 16%, transparent)', color: 'var(--olumlu)' }}
              >
                ✓
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold">Linkiniz hazır ve şu an çalışıyor</p>
                <p className="mt-0.5 truncate text-sm" style={{ color: 'var(--metin-2)' }}>
                  {form.ad || 'Yeni link'} · {hedefAdi}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg p-5" style={{ background: 'var(--vurgu-yumusak)' }}>
              {sonKurulan?.tamAdres ? (
                <div className="flex flex-wrap items-center gap-3">
                  <code className="min-w-0 flex-1 break-all font-mono text-base" style={{ color: 'var(--vurgu)' }}>
                    {sonKurulan.tamAdres}
                  </code>
                  <Buton
                    tur="birincil"
                    onClick={() => {
                      navigator.clipboard.writeText(sonKurulan.tamAdres!)
                        .then(() => setKopyalanan(sonKurulan.id))
                        .catch(() => setKopyalanan(null));
                    }}
                  >
                    {kopyalanan === sonKurulan.id ? 'Kopyalandı' : 'Kopyala'}
                  </Buton>
                </div>
              ) : (
                // Tam adres yoksa (yonetici tiklama adresini tanimlamamis)
                // kisa kodu gosteriyoruz ve NEDEN eksik oldugunu yaziyoruz;
                // bos bir kutu ortagi destege yonlendirirdi.
                <div>
                  <code className="break-all font-mono text-sm">{sonKurulan ? `/l/${sonKurulan.kod}` : '—'}</code>
                  <p className="mt-2 text-xs" style={{ color: 'var(--uyari)' }}>
                    Paylaşılabilir tam adres henüz oluşturulamıyor: panel yöneticisi tıklama
                    adresini tanımlamamış. Link kurulu ve çalışıyor.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {sonKurulan?.tamAdres && (
                <Buton onClick={() => setQr({ id: sonKurulan.id, ad: sonKurulan.ad, adres: sonKurulan.tamAdres! })}>
                  QR kod al
                </Buton>
              )}
              <Buton onClick={sihirbaziSifirla}>+ Bir link daha oluştur</Buton>
            </div>
          </div>
        )}
      </Kart>

      {/* ETIKETLER — sihirbazin DISINDA, kapali. Zorunlu olmayan bir
          ayari sihirbazin icine koymak, ucuncu bir adim gibi okunur ve
          kimsenin ihtiyac duymadigi bir karari herkese sorardi.

          Native <details>: JS gerekmiyor, klavye ve ekran okuyucu
          destegi kendiliginden dogru. */}
      <details className="hud border" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--yuzey-2)', color: 'var(--metin-2)' }}
          >
            {AKIS_IKONU.say}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Aynı linki birden çok yerde mi paylaşıyorsunuz?</span>
            <span className="mt-0.5 block text-xs" style={{ color: 'var(--metin-2)' }}>
              İsteğe bağlı — her paylaşıma etiket verip ayrı ayrı ölçün. Açmak için tıklayın.
            </span>
          </span>
          <span aria-hidden className="ml-auto shrink-0 text-xl font-light" style={{ color: 'var(--vurgu)' }}>+</span>
        </summary>

        <div className="border-t px-4 pb-4 pt-4" style={{ borderColor: 'var(--kenar)' }}>
          <p className="max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>
            Linkinizin sonuna <code className="text-xs" style={{ color: 'var(--vurgu)' }}>?sub1=degeriniz</code>
            {' '}yazmanız yeterli. Yazdığınız değer raporunuzda aynen görünür — hangi gönderinin
            kazandırdığını böylece görürsünüz.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Alan
              etiket="Neyi ayırt etmek istiyorsunuz?"
              deger={etiketAmaci}
              degisti={setEtiketAmaci}
              secenekler={ETIKET_AMACI.map((e) => ({ deger: e.anahtar, etiket: e.etiket }))}
            />
            <Alan
              etiket="Bu paylaşımın adı ne?"
              deger={alt[etiketAmaci] ?? ''}
              degisti={(v) => setAlt({ ...alt, [etiketAmaci]: v })}
              ipucu={`örn. ${amac.ornek}`}
            />
          </div>

          <div className="mt-4 rounded-lg p-4" style={{ background: 'var(--yuzey-2)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--metin-2)' }}>Paylaşacağınız link</p>
            <code className="mt-2 block break-all font-mono text-sm">
              {ornekAdres ?? 'Önce bir link oluşturun'}
              {ornekAdres && (
                <span style={{ color: 'var(--vurgu)' }}>
                  ?{etiketAmaci}={(alt[etiketAmaci] || amac.ornek).trim().replace(/\s+/g, '-')}
                </span>
              )}
            </code>
            <p className="mt-2 text-xs" style={{ color: 'var(--metin-2)' }}>
              Raporunuzda <strong style={{ color: 'var(--metin)' }}>{etiketAmaci}</strong> sütununda
              {' '}<strong style={{ color: 'var(--metin)' }}>{alt[etiketAmaci] || amac.ornek}</strong> olarak görünecek.
            </p>
          </div>

          {!etiketlerAcik ? (
            <button
              type="button"
              className="mt-3 text-xs underline"
              style={{ color: 'var(--metin-2)' }}
              onClick={() => setEtiketlerAcik(true)}
            >
              + Beş etiketin hepsini göster
            </button>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {ALTLAR.map((a) => (
                <Alan key={a} etiket={a} deger={alt[a] ?? ''} degisti={(v) => setAlt({ ...alt, [a]: v })} />
              ))}
            </div>
          )}

          <p className="mt-3 text-xs" style={{ color: 'var(--metin-2)' }}>
            Etiketler yeni link kurarken uygulanır — yukarıdaki sihirbazı çalıştırdığınızda buradaki
            değerler linke yazılır.
          </p>
        </div>
      </details>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Olcu etiket="Link" deger={String(linkSayisi)} alt={`${aktifSayisi} aktif`} />
        <Olcu etiket="Toplam tıklama" deger={String(toplamTiklama)} />
        <Olcu etiket="En çok tıklanan" deger={enIyi ? String(enIyi.tiklama) : '—'} alt={enIyi?.ad} />
        <Olcu
          etiket="Hiç tıklanmayan"
          deger={String(tiklanmayan)}
          alt={tiklanmayan > 0 ? 'paylaşıldı mı?' : undefined}
        />
        <Olcu etiket="Toplam yatırım" deger={paraBicimi(toplamYatirim)} />
        <Olcu etiket="Toplam çekim" deger={paraBicimi(toplamCekim)} />
      </div>

      {(hata || liste.hata) && <Hata mesaj={hata ?? liste.hata!} />}

      {liste.veri && !liste.veri.temelHazir && (
        <Kart>
          <p className="text-sm" style={{ color: 'var(--uyari)' }}>
            Panel yöneticisi tıklama adresini tanımlamamış; linkler üretiliyor ama paylaşılabilir
            tam adres oluşturulamıyor.
          </p>
        </Kart>
      )}

      {qr && (
        <Kart baslik={`QR · ${qr.ad}`} sag={<Buton onClick={() => setQr(null)}>Kapat</Buton>}>
          <div className="flex flex-wrap items-center gap-4">
            <img
              src={`/api/portal/alt-linkler/${qr.id}/qr`}
              alt={`${qr.ad} QR kodu`}
              width={220}
              height={220}
              className="rounded-lg border"
              style={{ borderColor: 'var(--kenar)', background: '#fff' }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm" style={{ color: 'var(--metin-2)' }}>
                Basılı materyal, hikâye ve fiziksel mekân için. Kod bu sunucuda üretiliyor —
                linkiniz üçüncü bir servise gönderilmiyor. Ayrı bir sayaç değildir: okutulan her
                QR bu linkin tıklaması olarak sayılır.
              </p>
              <code className="mt-2 block break-all text-xs">{qr.adres}</code>
            </div>
          </div>
        </Kart>
      )}

      {oyuncular && (
        <Kart baslik={`Oyuncular · ${oyuncular.ad}`} sag={<Buton onClick={() => setOyuncular(null)}>Kapat</Buton>}>
          {oyuncular.yukleniyor ? (
            <Yukleniyor />
          ) : oyuncular.liste.length === 0 ? (
            <Bos mesaj="Bu linkten henüz kayıt olan yok." />
          ) : (() => {
            // Site adi yalnizca birden fazla marka icin trafik
            // getiriyorsaniz anlamli -- tek siteli ortakta gereksiz gurultu.
            const cokluSite = new Set(oyuncular.liste.map((o) => o.baglantiAdi)).size > 1;
            return (
              <Tablo basliklar={['Kullanıcı', 'Kayıt', 'Yatırım', 'Çekim']}>
                {oyuncular.liste.map((o) => (
                  <Satir key={o.lynonOyuncuId}>
                    <Hucre>
                      <span className="font-medium">{o.kullaniciAdi ?? o.lynonOyuncuId}</span>
                      {!o.kullaniciAdi && (
                        <span className="ml-1 text-xs" style={{ color: 'var(--metin-2)' }}>(kullanıcı adı bilinmiyor)</span>
                      )}
                      {cokluSite && (
                        <span className="ml-1 text-xs" style={{ color: 'var(--metin-2)' }}>· {o.baglantiAdi}</span>
                      )}
                    </Hucre>
                    <Hucre><span className="text-xs">{gunBicimi(o.kayitTarihi ?? o.olusturuldu)}</span></Hucre>
                    <Hucre sagda><span className="tabular-nums">{paraBicimi(o.yatirim)}</span></Hucre>
                    <Hucre sagda><span className="tabular-nums">{paraBicimi(o.cekim)}</span></Hucre>
                  </Satir>
                ))}
              </Tablo>
            );
          })()}
        </Kart>
      )}

      <Kart baslik="Alt linkleriniz">
        {linkler.length === 0 ? (
          <Bos mesaj="Henüz alt link yok." />
        ) : (
          <Tablo basliklar={['Ad', 'Adres', 'Alt kanallar', 'Kreatif', 'Tıklama', 'Yatırım', 'Çekim', 'Durum', 'İşlem']}>
            {linkler.map((l) => (
              <Satir key={l.id}>
                <Hucre><span className="font-medium">{l.ad}</span></Hucre>
                <Hucre>
                  {l.tamAdres ? (
                    <div className="flex items-center gap-2">
                      <code className="break-all text-xs">{l.tamAdres}</code>
                      <button
                        type="button"
                        className="shrink-0 text-xs underline"
                        onClick={() => {
                          // `clipboard` HTTPS disinda reddediyor; sessiz
                          // kalmak "kopyalandi" yanilgisi yaratirdi.
                          navigator.clipboard.writeText(l.tamAdres!)
                            .then(() => setKopyalanan(l.id))
                            .catch(() => setKopyalanan(null));
                        }}
                      >
                        {kopyalanan === l.id ? 'Kopyalandı' : 'Kopyala'}
                      </button>
                    </div>
                  ) : (
                    <code className="text-xs">/l/{l.kod}</code>
                  )}
                </Hucre>
                <Hucre>
                  <span className="text-xs">
                    {Object.entries(l.alt).map(([a, d]) => `${a}=${d}`).join(' · ') || '—'}
                  </span>
                </Hucre>
                <Hucre><span className="text-xs">{l.medyaAdi ?? '—'}</span></Hucre>
                <Hucre sagda>
                  <div className="font-medium tabular-nums">{l.tiklama}</div>
                  <div className="text-xs" style={{ color: 'var(--metin-2)' }}>
                    {l.sonTiklama ? gunBicimi(l.sonTiklama) : 'henüz yok'}
                  </div>
                </Hucre>
                <Hucre sagda><span className="tabular-nums">{paraBicimi(l.yatirim)}</span></Hucre>
                <Hucre sagda><span className="tabular-nums">{paraBicimi(l.cekim)}</span></Hucre>
                <Hucre><Rozet metin={l.aktif ? 'Aktif' : 'Kapalı'} renk={l.aktif ? 'olumlu' : 'notr'} /></Hucre>
                <Hucre>
                  <div className="flex gap-1">
                    <Buton onClick={() => oyunculariGetir(l)}>
                      {oyuncular?.id === l.id ? 'Kapat' : 'Oyuncular'}
                    </Buton>
                    {l.tamAdres && (
                      <Buton onClick={() => setQr(qr?.id === l.id ? null : { id: l.id, ad: l.ad, adres: l.tamAdres! })}>
                        QR
                      </Buton>
                    )}
                    <Buton onClick={() => calistir(() => api.yaz(`/api/portal/alt-linkler/${l.id}`, { aktif: !l.aktif }))}>
                      {l.aktif ? 'Kapat' : 'Aç'}
                    </Buton>
                    <Buton
                      tur="tehlike"
                      onClick={() => {
                        // Silinen linkin gecmis tiklamalari kalir ama link
                        // olu baglantiya doner; paylasilmis bir adresi
                        // sessizce kirmamak icin onay soruluyor.
                        if (window.confirm(`"${l.ad}" silinsin mi? Paylaştığınız adres çalışmayı durdurur.`)) {
                          calistir(() => api.sil(`/api/portal/alt-linkler/${l.id}`));
                        }
                      }}
                    >
                      Sil
                    </Buton>
                  </div>
                </Hucre>
              </Satir>
            ))}
          </Tablo>
        )}
      </Kart>
    </>
  );
}
