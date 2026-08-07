import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Radio, Send, ShieldAlert } from 'lucide-react';
import { affiliateAdminApi, type PostbackKaydi, type PostbackOlayi } from '../../../api/client';
import { formatDateDisplay } from '../../../lib/format';
import { Alan, BosDurum, BUTON_ANA, BUTON_SESSIZ, ETIKET, GIRDI, HataSatiri, KART, Rozet } from './ortakUi';

/**
 * S2S postback yönetimi.
 *
 * Ortağın izleme sistemine dönüşüm haberi gönderiyoruz. Adresi ortak
 * yazdığı ve isteği bizim sunucumuz attığı için SSRF kontrolü var;
 * engellenen gönderimler kayıtta ayrı bir durum olarak görünüyor ki
 * "neden gitmedi" sorusu cevaplanabilsin.
 */

const OLAY_ADI: Record<PostbackOlayi, string> = {
  kayit: 'Kayıt',
  'ilk-yatirim': 'İlk yatırım',
  yatirim: 'Yatırım',
  'onaylanan-komisyon': 'Onaylanan komisyon',
};

const DURUM_TONU = {
  basarili: 'basarili',
  basarisiz: 'hata',
  engellendi: 'bekliyor',
} as const;

const MAKROLAR = ['{clickid}', '{payout}', '{event}', '{btag}', '{playerid}', '{sub1}'];

export function PostbackSekmesi() {
  const queryClient = useQueryClient();
  const [bTag, setBTag] = useState('');
  const [sablon, setSablon] = useState('');
  const [olaylar, setOlaylar] = useState<PostbackOlayi[]>(['kayit', 'ilk-yatirim']);
  const [hata, setHata] = useState('');
  const [deneSonucu, setDeneSonucu] = useState<PostbackKaydi | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['affiliate-postback'],
    queryFn: () => affiliateAdminApi.postback(),
  });

  const yenile = () => queryClient.invalidateQueries({ queryKey: ['affiliate-postback'] });

  const kaydet = useMutation({
    mutationFn: () => affiliateAdminApi.postbackAyarla({ bTag: bTag.trim(), sablon: sablon.trim(), olaylar }),
    onSuccess: (cevap) => {
      if (!cevap.ok) { setHata(cevap.message || 'Kaydedilemedi.'); return; }
      setHata(''); setSablon('');
      yenile();
    },
    onError: (e: Error) => setHata(e.message),
  });

  const dene = useMutation({
    mutationFn: (hedefBTag: string) => affiliateAdminApi.postbackDene(hedefBTag),
    onSuccess: (cevap) => {
      setDeneSonucu(cevap.kayit ?? null);
      if (!cevap.kayit) setHata(cevap.message || 'Deneme yapılamadı.');
      yenile();
    },
    onError: (e: Error) => setHata(e.message),
  });

  const ayarlar = data?.ayarlar ?? [];
  const kayitlar = data?.kayitlar ?? [];

  const olayDegistir = (olay: PostbackOlayi) => {
    setOlaylar((mevcut) => (mevcut.includes(olay) ? mevcut.filter((o) => o !== olay) : [...mevcut, olay]));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">S2S postback</h3>
        <p className="mt-1 text-xs text-[color:var(--panel-muted,#8a919c)]">
          Dönüşüm olduğunda ortağın izleme sistemine sunucudan sunucuya haber verilir.
        </p>
      </div>

      <div className={`${KART} space-y-3 p-4`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Alan etiket="Ortak BTag">
            <input className={GIRDI} value={bTag} onChange={(e) => setBTag(e.target.value)} />
          </Alan>
          <Alan etiket="Postback şablonu" ipucu="Yalnızca https. Makrolar gönderim anında değerle değişir.">
            <input
              className={GIRDI}
              value={sablon}
              onChange={(e) => setSablon(e.target.value)}
              placeholder="https://tracker.ornek.com/pb?cid={clickid}&payout={payout}"
            />
          </Alan>
        </div>

        <div>
          <p className={ETIKET}>Kullanılabilir makrolar</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {MAKROLAR.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSablon((s) => s + m)}
                className="rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-cyan-300 transition hover:bg-white/10"
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={ETIKET}>Hangi olaylarda gönderilsin</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(Object.keys(OLAY_ADI) as PostbackOlayi[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => olayDegistir(o)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                  olaylar.includes(o)
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'border border-[color:var(--panel-border,rgba(242,244,248,0.1))] text-[color:var(--panel-muted,#8a919c)]'
                }`}
              >
                {OLAY_ADI[o]}
              </button>
            ))}
          </div>
        </div>

        <HataSatiri mesaj={hata} />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dene.mutate(bTag.trim())}
            disabled={dene.isPending || !bTag.trim()}
            className={BUTON_SESSIZ}
          >
            <Send size={14} /> {dene.isPending ? 'Deneniyor...' : 'Gerçek gönderim dene'}
          </button>
          <button
            type="button"
            onClick={() => kaydet.mutate()}
            disabled={kaydet.isPending || !bTag.trim() || !sablon.trim() || olaylar.length === 0}
            className={BUTON_ANA}
          >
            {kaydet.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>

        {deneSonucu && (
          <div
            className={`rounded-lg border p-3 text-xs ${
              deneSonucu.durum === 'basarili'
                ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-300'
                : 'border-rose-300/25 bg-rose-300/[0.08] text-rose-300'
            }`}
          >
            <p className="font-bold">
              {deneSonucu.durum === 'basarili' ? 'Gönderildi' : deneSonucu.durum === 'engellendi' ? 'Engellendi' : 'Başarısız'}
              {deneSonucu.httpDurum ? ` · HTTP ${deneSonucu.httpDurum}` : ''}
            </p>
            {deneSonucu.mesaj && <p className="mt-1 font-medium opacity-90">{deneSonucu.mesaj}</p>}
          </div>
        )}
      </div>

      {ayarlar.length > 0 && (
        <div className={`${KART} p-4`}>
          <p className={`${ETIKET} mb-2`}>Tanımlı postback'ler</p>
          <div className="space-y-2">
            {ayarlar.map((a) => (
              <div key={a.bTag} className="rounded-lg bg-white/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">{a.bTag}</span>
                  <Rozet ton={a.aktif ? 'basarili' : 'notr'}>{a.aktif ? 'Aktif' : 'Pasif'}</Rozet>
                  {a.olaylar.map((o) => <Rozet key={o} ton="notr">{OLAY_ADI[o]}</Rozet>)}
                </div>
                <p className="mt-1.5 break-all font-mono text-[11px] text-[color:var(--panel-muted,#8a919c)]">{a.sablon}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && <p className="text-xs text-[color:var(--panel-muted,#8a919c)]">Yükleniyor...</p>}

      {!isLoading && kayitlar.length === 0 && ayarlar.length === 0 && (
        <BosDurum
          ikon={<Radio size={28} />}
          baslik="Henüz postback tanımlı değil"
          aciklama="Ortağın izleme sistemine dönüşüm haberi göndermek için bir şablon tanımlayın."
        />
      )}

      {kayitlar.length > 0 && (
        <div className={`${KART} overflow-hidden`}>
          <p className={`${ETIKET} p-4 pb-2`}>Gönderim kayıtları</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="px-4 text-left">Zaman</th>
                  <th className="px-4 text-left">Ortak</th>
                  <th className="px-4 text-left">Olay</th>
                  <th className="px-4 text-left">Durum</th>
                  <th className="px-4 text-left">Ayrıntı</th>
                </tr>
              </thead>
              <tbody>
                {kayitlar.slice(0, 100).map((k) => (
                  <tr key={k.id}>
                    <td className="whitespace-nowrap px-4">{formatDateDisplay(k.gonderildi)}</td>
                    <td className="px-4 font-semibold text-white">{k.bTag}</td>
                    <td className="px-4">{OLAY_ADI[k.olay]}</td>
                    <td className="px-4">
                      <Rozet ton={DURUM_TONU[k.durum]}>
                        {k.durum === 'basarili' ? 'Başarılı' : k.durum === 'engellendi' ? 'Engellendi' : 'Başarısız'}
                      </Rozet>
                    </td>
                    <td className="max-w-[280px] truncate px-4 text-[color:var(--panel-muted,#8a919c)]" title={k.mesaj ?? k.url}>
                      {k.durum === 'engellendi' && <ShieldAlert size={12} className="mr-1 inline text-amber-300" />}
                      {k.mesaj ?? `HTTP ${k.httpDurum ?? '-'}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
