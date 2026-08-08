import { useState, type ReactNode } from 'react';
import { api, gunBicimi, paraBicimi, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Hucre, Kart, Olcu, Rozet, Satir, Tablo, Yukleniyor } from '../../ui';
import type { AltLinkGorunumu as AltLink, Medya, MedyaTuru } from '@sunucu/sozlesme.js';

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
 */
export function PortalAltLinkler() {
  const liste = useVeri<{ linkler: AltLink[]; temelHazir: boolean }>('/api/portal/alt-linkler');
  const medyalar = useVeri<{ medyalar: Medya[] }>('/api/portal/medya');
  const [form, setForm] = useState({ ad: '', medyaId: '' });
  const [alt, setAlt] = useState<Record<string, string>>({});
  const [etiketlerAcik, setEtiketlerAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kopyalanan, setKopyalanan] = useState<string | null>(null);
  const [qr, setQr] = useState<{ id: string; ad: string; adres: string } | null>(null);

  const calistir = async (is: () => Promise<unknown>) => {
    setHata(null);
    try {
      await is();
      liste.yenile();
    } catch (h) {
      setHata(h instanceof Error ? h.message : 'İşlem başarısız.');
    }
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

  if (liste.yukleniyor) return <Yukleniyor />;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Olcu etiket="Link" deger={String(linkSayisi)} alt={`${aktifSayisi} aktif`} />
        <Olcu etiket="Toplam tıklama" deger={String(toplamTiklama)} />
        <Olcu
          etiket="En çok tıklanan"
          deger={enIyi ? String(enIyi.tiklama) : '—'}
          alt={enIyi?.ad}
        />
        <Olcu
          etiket="Hiç tıklanmayan"
          deger={String(tiklanmayan)}
          alt={tiklanmayan > 0 ? 'paylaşıldı mı?' : undefined}
        />
        <Olcu etiket="Toplam yatırım" deger={paraBicimi(toplamYatirim)} />
        <Olcu etiket="Toplam çekim" deger={paraBicimi(toplamCekim)} />
      </div>

      <Kart baslik="Yeni alt link">
        <p className="mb-4 text-sm" style={{ color: 'var(--metin-2)' }}>
          Kampanya başına bir link kurun, isim verin. Kısa adres alırsınız; parametreler adreste
          <strong> görünmez</strong>, kayıttan gelir. Böylece kanal isimlendirmeniz dışarıya sızmaz
          ve linki elle düzenleyen biri trafiği başka bir kırılıma yazamaz.
        </p>

        <div className="max-w-sm">
          <Alan etiket="Link adı" deger={form.ad} degisti={(v) => setForm({ ...form, ad: v })} ipucu="örn. Instagram bio — Ekim" />
        </div>

        <div className="mt-4">
          <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--metin-2)' }}>Nereye gitsin?</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
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
        </div>

        <div className="mt-4">
          <Alan
            etiket="Kanal etiketi (opsiyonel)"
            deger={alt.sub1 ?? ''}
            degisti={(v) => setAlt({ ...alt, sub1: v })}
            ipucu="örn. instagram, tiktok, hikaye — aynı hedefe giden birden çok linki birbirinden ayırt eder."
          />
          {!etiketlerAcik ? (
            <button
              type="button"
              className="mt-2 text-xs underline"
              style={{ color: 'var(--metin-2)' }}
              onClick={() => setEtiketlerAcik(true)}
            >
              + Daha fazla etiket ekle
            </button>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ALTLAR.slice(1).map((a) => (
                <Alan key={a} etiket={a} deger={alt[a] ?? ''} degisti={(v) => setAlt({ ...alt, [a]: v })} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <Buton
            tur="birincil"
            onClick={() => calistir(async () => {
              await api.gonder('/api/portal/alt-linkler', { ...form, alt });
              setForm({ ad: '', medyaId: '' });
              setAlt({});
              setEtiketlerAcik(false);
            })}
          >
            Oluştur
          </Buton>
        </div>
      </Kart>

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

      <Kart baslik="Alt linkleriniz">
        {(liste.veri?.linkler ?? []).length === 0 ? (
          <Bos mesaj="Henüz alt link yok." />
        ) : (
          <Tablo basliklar={['Ad', 'Adres', 'Kreatif', 'Alt kanallar', 'Tıklama', 'Yatırım', 'Çekim', 'Durum', 'İşlem']}>
            {liste.veri!.linkler.map((l) => (
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
                <Hucre sagda>
                  <span className="tabular-nums">{paraBicimi(l.yatirim)}</span>
                </Hucre>
                <Hucre sagda>
                  <span className="tabular-nums">{paraBicimi(l.cekim)}</span>
                </Hucre>
                <Hucre><Rozet metin={l.aktif ? 'Aktif' : 'Kapalı'} renk={l.aktif ? 'olumlu' : 'notr'} /></Hucre>
                <Hucre>
                  <div className="flex gap-1">
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
