import { useState } from 'react';
import { api, useVeri } from '../../api';
import { Alan, Bos, Buton, Hata, Kart, Yukleniyor } from '../../ui';
import type { Medya } from '@sunucu/sozlesme.js';

interface Link {
  dogrudanLink: string;
  izlemeliLink: string | null;
}

const ALTLAR = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'] as const;

export function PortalMedya() {
  const { veri, yukleniyor, hata } = useVeri<{ medyalar: Medya[] }>('/api/portal/medya');
  const [alt, setAlt] = useState<Record<string, string>>({});
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

  return (
    <>
      <Kart baslik="Alt kanal etiketleri">
        <p className="mb-3 text-sm" style={{ color: 'var(--metin-2)' }}>
          Bu alanlar size ait; istediğiniz gibi anlamlandırın (kaynak, kampanya, kreatif). Tıklamada
          yakalanır ve raporlarınızda kırılım olarak görünür. Boş bırakabilirsiniz.
        </p>
        <div className="grid gap-3 md:grid-cols-5">
          {ALTLAR.map((a) => (
            <Alan key={a} etiket={a} deger={alt[a] ?? ''} degisti={(v) => setAlt({ ...alt, [a]: v })} />
          ))}
        </div>
      </Kart>

      {islemHatasi && <Hata mesaj={islemHatasi} />}

      {(veri?.medyalar ?? []).length === 0 ? (
        <Kart><Bos mesaj="Size açık medya yok. Yöneticinizle görüşün." /></Kart>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {veri!.medyalar.map((m) => (
            <Kart key={m.id} baslik={m.ad} sag={<span className="text-xs" style={{ color: 'var(--metin-2)' }}>{m.tur}{m.olcu ? ` · ${m.olcu}` : ''}</span>}>
              {m.varlikUrl && (
                <img
                  src={m.varlikUrl}
                  alt={m.ad}
                  className="mb-3 max-h-40 rounded-lg border object-contain"
                  style={{ borderColor: 'var(--kenar)' }}
                />
              )}
              <Buton onClick={() => linkUret(m.id)}>Link üret</Buton>

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
          ))}
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
