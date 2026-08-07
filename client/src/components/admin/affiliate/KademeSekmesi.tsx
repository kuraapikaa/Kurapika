import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CornerDownRight, Network, Plus, Trash2 } from 'lucide-react';
import { affiliateAdminApi, type KademeBagi } from '../../../api/client';
import { Alan, BosDurum, BUTON_ANA, ETIKET, GIRDI, HataSatiri, KART } from './ortakUi';

/**
 * Kademeli ortak yapısı.
 *
 * Bir ortak getirdiği ortakların kazancından pay alır. Pay alt ortaktan
 * KESİLMEZ, üstüne eklenir — bir pazarlama gideri. Ekranda bunu açıkça
 * yazıyoruz, çünkü tersi varsayılırsa yüzdeler yanlış ayarlanır.
 */

interface Dugum {
  bTag: string;
  altlar: Dugum[];
}

/** Bağ listesinden ağaç kurar; köksüz (üstü olmayan) ortaklar tepede. */
function agacKur(baglar: KademeBagi[]): Dugum[] {
  const altHaritasi = new Map<string, string[]>();
  const tumBTaglar = new Set<string>();
  for (const b of baglar) {
    tumBTaglar.add(b.bTag);
    tumBTaglar.add(b.ustBTag);
    altHaritasi.set(b.ustBTag, [...(altHaritasi.get(b.ustBTag) ?? []), b.bTag]);
  }
  const ustuOlanlar = new Set(baglar.map((b) => b.bTag));
  const kokler = [...tumBTaglar].filter((t) => !ustuOlanlar.has(t)).sort();

  // Derinlik sinirli: veri bozulup dongu olussa bile arayuz sonsuz
  // ozyinelemeye girip sekmeyi kilitlemesin.
  const kur = (bTag: string, derinlik: number, gorulen: Set<string>): Dugum => {
    if (derinlik > 10 || gorulen.has(bTag)) return { bTag, altlar: [] };
    const yeniGorulen = new Set(gorulen).add(bTag);
    return {
      bTag,
      altlar: (altHaritasi.get(bTag) ?? []).sort().map((alt) => kur(alt, derinlik + 1, yeniGorulen)),
    };
  };
  return kokler.map((k) => kur(k, 0, new Set()));
}

function DugumSatiri({ dugum, derinlik, onKaldir }: { dugum: Dugum; derinlik: number; onKaldir: (bTag: string) => void }) {
  return (
    <>
      <div
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
        style={{ paddingLeft: `${derinlik * 20 + 8}px` }}
      >
        {derinlik > 0 && <CornerDownRight size={13} className="shrink-0 text-[color:var(--panel-faint,#5c6470)]" />}
        <span className="text-sm font-semibold text-white">{dugum.bTag}</span>
        {derinlik > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">seviye {derinlik}</span>
        )}
        {derinlik > 0 && (
          <button
            type="button"
            onClick={() => onKaldir(dugum.bTag)}
            className="ml-auto rounded p-1 text-[color:var(--panel-faint,#5c6470)] transition hover:text-rose-300"
            aria-label={`${dugum.bTag} bağını kaldır`}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {dugum.altlar.map((alt) => (
        <DugumSatiri key={alt.bTag} dugum={alt} derinlik={derinlik + 1} onKaldir={onKaldir} />
      ))}
    </>
  );
}

export function KademeSekmesi() {
  const queryClient = useQueryClient();
  const [bTag, setBTag] = useState('');
  const [ustBTag, setUstBTag] = useState('');
  const [yuzdeMetni, setYuzdeMetni] = useState('');
  const [hata, setHata] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['affiliate-kademeler'],
    queryFn: () => affiliateAdminApi.kademeler(),
  });

  const yenile = () => queryClient.invalidateQueries({ queryKey: ['affiliate-kademeler'] });
  const baglar = data?.baglar ?? [];
  const yuzdeler = data?.kademeYuzdeleri ?? [];
  const agac = useMemo(() => agacKur(baglar), [baglar]);

  const bagKur = useMutation({
    mutationFn: () => affiliateAdminApi.kademeBagiKur({ bTag: bTag.trim(), ustBTag: ustBTag.trim() }),
    onSuccess: (cevap) => {
      if (!cevap.ok) { setHata(cevap.message || 'Bağ kurulamadı.'); return; }
      setBTag(''); setUstBTag(''); setHata('');
      yenile();
    },
    onError: (e: Error) => setHata(e.message),
  });

  const bagKaldir = useMutation({
    mutationFn: (alt: string) => affiliateAdminApi.kademeBagiKaldir(alt),
    onSuccess: yenile,
  });

  const yuzdeKaydet = useMutation({
    mutationFn: () =>
      affiliateAdminApi.kademeYuzdeleri(
        yuzdeMetni.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)),
      ),
    onSuccess: (cevap) => {
      if (!cevap.ok) { setHata(cevap.message || 'Yüzdeler kaydedilemedi.'); return; }
      setYuzdeMetni(''); setHata('');
      yenile();
    },
    onError: (e: Error) => setHata(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">Kademeli ortak yapısı</h3>
        <p className="mt-1 text-xs text-[color:var(--panel-muted,#8a919c)]">
          Bir ortak, getirdiği ortakların kazancından pay alır. Bu pay alt ortaktan <strong className="text-white">kesilmez</strong>,
          üstüne eklenir — bir pazarlama gideridir.
        </p>
      </div>

      <div className={`${KART} space-y-3 p-4`}>
        <p className={ETIKET}>Seviye yüzdeleri</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Alan etiket="Yüzdeler" ipucu={`Virgülle ayrılmış. Şu an: ${yuzdeler.length ? yuzdeler.map((y) => `%${y}`).join(' → ') : 'tanımsız'}`}>
              <input
                className={GIRDI}
                value={yuzdeMetni}
                onChange={(e) => setYuzdeMetni(e.target.value)}
                placeholder={yuzdeler.join(', ') || '5, 2'}
              />
            </Alan>
          </div>
          <button type="button" onClick={() => yuzdeKaydet.mutate()} disabled={yuzdeKaydet.isPending || !yuzdeMetni.trim()} className={BUTON_ANA}>
            {yuzdeKaydet.isPending ? 'Kaydediliyor...' : 'Yüzdeleri kaydet'}
          </button>
        </div>
        <p className="text-[11px] text-[color:var(--panel-muted,#8a919c)]">
          Dizinin uzunluğu kademe derinliğini belirler. Toplam %100'ü geçemez — geçerse her dönüşüm zarar yazar.
        </p>
      </div>

      <div className={`${KART} space-y-3 p-4`}>
        <p className={ETIKET}>Yeni bağ</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Alan etiket="Alt ortak BTag">
              <input className={GIRDI} value={bTag} onChange={(e) => setBTag(e.target.value)} />
            </Alan>
          </div>
          <div className="min-w-[180px] flex-1">
            <Alan etiket="Üst ortak BTag" ipucu="Onu sisteme getiren ortak.">
              <input className={GIRDI} value={ustBTag} onChange={(e) => setUstBTag(e.target.value)} />
            </Alan>
          </div>
          <button type="button" onClick={() => bagKur.mutate()} disabled={bagKur.isPending || !bTag.trim() || !ustBTag.trim()} className={BUTON_ANA}>
            <Plus size={14} /> {bagKur.isPending ? 'Kuruluyor...' : 'Bağla'}
          </button>
        </div>
        <HataSatiri mesaj={hata} />
      </div>

      {isLoading && <p className="text-xs text-[color:var(--panel-muted,#8a919c)]">Yükleniyor...</p>}

      {!isLoading && agac.length === 0 && (
        <BosDurum
          ikon={<Network size={28} />}
          baslik="Henüz kademe bağı yok"
          aciklama="Bir ortağı başka bir ortağın altına bağlayın; üst ortak alt ortağın kazancından pay almaya başlar."
        />
      )}

      {agac.length > 0 && (
        <div className={`${KART} p-3`}>
          <p className={`${ETIKET} mb-2 px-2`}>Ortak ağacı</p>
          {agac.map((k) => (
            <DugumSatiri key={k.bTag} dugum={k} derinlik={0} onKaldir={(alt) => bagKaldir.mutate(alt)} />
          ))}
        </div>
      )}
    </div>
  );
}
