import { useState } from 'react';
import { api, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Kart, Yukleniyor } from '../../ui';
import { AKIS_IKONU, NasilCalisir } from '../../sihirbaz';
import type { Medya } from '@sunucu/sozlesme.js';

interface Link {
  dogrudanLink: string;
  izlemeliLink: string | null;
}

const ALTLAR = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'] as const;

/**
 * KREATİFLER — yöneticinin ortağa açtığı banner ve materyaller.
 *
 * ── Bu sürümde değişen: "NASIL ÇALIŞIR" ŞERİDİ ──
 *
 * Ekran teknik olarak eksiksizdi ama en temel soruyu hiç cevaplamıyordu:
 * bu görselleri ne yapacağım? Ortaklar banner'ı indirip kendi linkiyle
 * paylaşmaya çalışıyordu — oysa üretilen izlemeli link zaten kreatifin
 * kırılımını taşıyor. Üç kutu bunu ekranın başında söylüyor.
 *
 * Bir de boyut ipucu eklendi: "728×90" bir sayı, "blog başlığı" bir
 * yer. Ortağın hangi görseli nereye koyacağına karar vermesi için
 * ikincisi gerekiyor.
 */

/**
 * Standart reklam ölçülerinin nerede kullanıldığı.
 *
 * Ölçü listesi kapalı bir küme DEĞİL: tanımadığımız bir ölçü gelirse
 * ipucu gösterilmiyor, uydurulmuyor. Yanlış bir yer önermek, ortağın
 * banner'ı yanlış yere koyup düşük CTR alması demek.
 */
const OLCU_IPUCU: Record<string, string> = {
  '728x90': 'Blog başlığı, forum imzası',
  '728×90': 'Blog başlığı, forum imzası',
  '300x250': 'Yazı içi, kenar çubuğu',
  '300×250': 'Yazı içi, kenar çubuğu',
  '320x50': 'Mobil sayfa altı',
  '320×50': 'Mobil sayfa altı',
  '1080x1080': 'Instagram gönderisi',
  '1080×1080': 'Instagram gönderisi',
  '1080x1350': 'Instagram dikey gönderi',
  '1080×1350': 'Instagram dikey gönderi',
  '1080x1920': 'Hikâye, Reels, TikTok',
  '1080×1920': 'Hikâye, Reels, TikTok',
  '1200x628': 'Twitter/X ve Facebook paylaşımı',
  '1200×628': 'Twitter/X ve Facebook paylaşımı',
  '160x600': 'Kenar çubuğu (dikey)',
  '160×600': 'Kenar çubuğu (dikey)',
};

export function PortalMedya() {
  const { veri, yukleniyor, hata } = useVeri<{ medyalar: Medya[] }>('/api/portal/medya');
  const [alt, setAlt] = useState<Record<string, string>>({});
  const [etiketlerAcik, setEtiketlerAcik] = useState(false);
  const [linkler, setLinkler] = useState<Record<string, Link>>({});
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);

  const linkUret = async (medyaId: string) => {
    setIslemHatasi(null);
    try {
      setLinkler({ ...linkler, [medyaId]: await api.gonder<Link>(`/api/portal/medya/${medyaId}/link`, alt) });
    } catch (h) {
      setIslemHatasi(h instanceof Error ? h.message : 'Link üretilemedi.');
    }
  };

  if (yukleniyor) return <Yukleniyor />;
  if (hata) return <Hata mesaj={hata} />;

  const medyalar = veri?.medyalar ?? [];

  return (
    <>
      <Kart baslik="Kreatifler nasıl çalışır?">
        <p className="mb-4 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--metin-2)' }}>
          Hazır banner ve görselleri kullanın — her biri için ürettiğiniz izlemeli link
          <strong style={{ color: 'var(--metin)' }}> sizin kırılımınızı taşır</strong>. Ayrıca link
          kurmanız gerekmez; görseli indirip kendi adresinizle paylaşmanız da gerekmez.
        </p>
        <NasilCalisir
          adimlar={[
            {
              ikon: AKIS_IKONU.sec,
              baslik: '1. Birini seçin',
              metin: 'Ölçü, paylaşacağınız yere göre — kartların üstünde yazılı.',
            },
            {
              ikon: AKIS_IKONU.kopyala,
              baslik: '2. Linki üretip kopyalayın',
              metin: 'İzlemeli link önerilen: tıklamanız burada sayılır.',
            },
            {
              ikon: AKIS_IKONU.say,
              baslik: '3. Paylaşın, biz sayarız',
              metin: 'Kreatif kırılımı panelinizde ayrı satır olarak görünür.',
            },
          ]}
        />
        <p className="mt-4 text-xs" style={{ color: 'var(--metin-2)' }}>
          Görselleri kendiniz düzenlemeyin; içindeki adres bozulursa tıklama size yazılmaz.
        </p>
      </Kart>

      {/* ETIKETLER — artik varsayilan olarak KAPALI.
          Ekranin en ustunde bes bos alan, ortagin ilk gordugu sey
          "doldurmam gereken bir form" oluyordu; oysa hicbiri zorunlu
          degil ve cogu ortak hic kullanmiyor. */}
      <details className="hud border" style={{ background: 'var(--yuzey)', borderColor: 'var(--kenar)' }}>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Alt kanal etiketi eklemek ister misiniz?</span>
            <span className="mt-0.5 block text-xs" style={{ color: 'var(--metin-2)' }}>
              İsteğe bağlı — üretilecek linklere yazılır, raporunuzda kırılım olarak görünür.
            </span>
          </span>
          <span aria-hidden className="ml-auto shrink-0 text-xl font-light" style={{ color: 'var(--vurgu)' }}>+</span>
        </summary>
        <div className="border-t px-4 pb-4 pt-4" style={{ borderColor: 'var(--kenar)' }}>
          <p className="mb-3 max-w-3xl text-sm" style={{ color: 'var(--metin-2)' }}>
            Bu alanlar size ait; istediğiniz gibi anlamlandırın (kanal, kampanya, gönderi).
            Tıklamada yakalanır. Aşağıdaki "Link üret" düğmesine bastığınızda buradaki değerler
            linke yazılır.
          </p>
          <div className="max-w-sm">
            <Alan
              etiket="Kanal etiketi (sub1)"
              deger={alt.sub1 ?? ''}
              degisti={(v) => setAlt({ ...alt, sub1: v })}
              ipucu="örn. instagram, telegram, blog"
            />
          </div>
          {!etiketlerAcik ? (
            <button
              type="button"
              className="mt-2 text-xs underline"
              style={{ color: 'var(--metin-2)' }}
              onClick={() => setEtiketlerAcik(true)}
            >
              + Diğer dört etiketi göster
            </button>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {ALTLAR.slice(1).map((a) => (
                <Alan key={a} etiket={a} deger={alt[a] ?? ''} degisti={(v) => setAlt({ ...alt, [a]: v })} />
              ))}
            </div>
          )}
        </div>
      </details>

      {islemHatasi && <Hata mesaj={islemHatasi} />}

      {medyalar.length === 0 ? (
        <Kart><Bos mesaj="Size açık kreatif yok. Yöneticinizle görüşün." /></Kart>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {medyalar.map((m) => {
            const ipucu = m.olcu ? OLCU_IPUCU[m.olcu] : undefined;
            return (
              <Kart
                key={m.id}
                baslik={m.ad}
                sag={
                  <span className="text-xs" style={{ color: 'var(--metin-2)' }}>
                    {m.tur}{m.olcu ? ` · ${m.olcu}` : ''}
                  </span>
                }
              >
                {ipucu && (
                  <p className="mb-3 text-xs" style={{ color: 'var(--vurgu)' }}>Nereye: {ipucu}</p>
                )}
                {m.varlikUrl && (
                  <img
                    src={m.varlikUrl}
                    alt={m.ad}
                    className="mb-3 max-h-40 rounded-lg border object-contain"
                    style={{ borderColor: 'var(--kenar)' }}
                  />
                )}
                <Buton onClick={() => linkUret(m.id)}>
                  {linkler[m.id] ? 'Linki yenile' : 'Link üret'}
                </Buton>

                {linkler[m.id] && (
                  <div className="mt-3 space-y-2">
                    <LinkKutusu
                      etiket="İzlemeli link (önerilen)"
                      deger={linkler[m.id].izlemeliLink}
                      aciklama="Tıklamalarınız burada sayılır; kreatif ve alt kanal kırılımı bu linkten gelir."
                    />
                    <LinkKutusu
                      etiket="Doğrudan link"
                      deger={linkler[m.id].dogrudanLink}
                      aciklama="Tıklama sayılmaz, yalnızca backoffice tarafındaki atıf çalışır."
                    />
                  </div>
                )}
              </Kart>
            );
          })}
        </div>
      )}
    </>
  );
}

function LinkKutusu({ etiket, deger, aciklama }: { etiket: string; deger: string | null; aciklama: string }) {
  const [kopyalandi, setKopyalandi] = useState(false);

  if (!deger) {
    return (
      <div className="text-xs" style={{ color: 'var(--metin-2)' }}>
        <strong>{etiket}:</strong> yapılandırılmamış (panel yöneticisi tıklama adresini tanımlamalı).
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--metin-2)' }}>{etiket}</span>
        <button
          type="button"
          className="text-xs underline"
          onClick={() => {
            // `clipboard` HTTPS disinda ya da izin verilmediginde
            // reddediyor; sessiz kalmak "kopyalandi" yanilgisi yaratirdi.
            navigator.clipboard.writeText(deger)
              .then(() => setKopyalandi(true))
              .catch(() => setKopyalandi(false));
          }}
        >
          {kopyalandi ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <code
        className="block break-all rounded-lg border px-2 py-1 text-xs"
        style={{ background: 'var(--yuzey-2)', borderColor: 'var(--kenar)' }}
      >
        {deger}
      </code>
      <p className="mt-1 text-xs" style={{ color: 'var(--metin-2)' }}>{aciklama}</p>
    </div>
  );
}
