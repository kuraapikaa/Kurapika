import { useQuery } from '@tanstack/react-query';
import { Activity, Plug } from 'lucide-react';
import { affiliateAdminApi } from '../../../api/client';
import { formatNumber } from '../../../lib/format';
import { BosDurum, EgilimCizgisi, ETIKET, KART, Rozet } from './ortakUi';

/**
 * Ölçüm eğilimi.
 *
 * Kendi biriktirdiğimiz günlük anlık görüntülerden okuyor — Lynon'a
 * istek anında gitmiyor. Bu yüzden eğilim gösterebiliyor ve Lynon
 * geçici olarak erişilemezken de çalışıyor.
 */

const tl = (n: number) => `${formatNumber(Math.round(n))} ₺`;

export function OlcumSekmesi({ range }: { range?: { startDate: string; endDate: string } }) {
  const { data, isLoading } = useQuery({
    queryKey: ['affiliate-olcumler', range?.startDate, range?.endDate],
    queryFn: () => affiliateAdminApi.olcumler(range ? { start: range.startDate, end: range.endDate } : undefined),
  });

  const { data: entegrasyon } = useQuery({
    queryKey: ['affiliate-lynon-entegrasyon'],
    queryFn: () => affiliateAdminApi.lynonEntegrasyon(),
    // Katalog Lynon'a gidiyor; sekme her acildiginda yeniden cekmek
    // gereksiz yuk, bes dakika yeterince taze.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const ortaklar = data?.ortaklar ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Ortak eğilimleri</h3>
          <p className="mt-1 text-xs text-[color:var(--panel-muted,#8a919c)]">
            Günlük biriktirilen kayıtlardan; Lynon'a istek anında gidilmiyor.
          </p>
        </div>
        {data?.sonOlculenGun && (
          <div className="text-right">
            <p className={ETIKET}>Son ölçüm</p>
            <p className="text-sm font-bold text-white">{data.sonOlculenGun}</p>
          </div>
        )}
      </div>

      {entegrasyon?.ok && (
        <div className={`${KART} p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <Plug size={15} className="text-cyan-300" />
            <p className="text-xs font-bold text-white">Lynon entegrasyonu</p>
            <Rozet ton={entegrasyon.postbackHazir ? 'basarili' : 'bekliyor'}>
              {entegrasyon.postbackHazir ? 'Alım ucu açık' : 'Alım ucu kapalı'}
            </Rozet>
            {entegrasyon.onerilenTip && <Rozet ton="notr">Önerilen tip: {entegrasyon.onerilenTip}</Rozet>}
          </div>
          <p className="mt-2 text-[11px] text-[color:var(--panel-muted,#8a919c)]">
            Site {entegrasyon.siteId} ·{' '}
            <a href={entegrasyon.backofficeEkraniUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
              Backoffice entegrasyon ekranı
            </a>
          </p>
          {!entegrasyon.postbackHazir && (
            <p className="mt-1 text-[11px] text-amber-300">
              Paylaşılan sır tanımlı değil; adres Lynon'a verilse bile tek bir olay işlenmez.
            </p>
          )}
        </div>
      )}

      {isLoading && <p className="text-xs text-[color:var(--panel-muted,#8a919c)]">Yükleniyor...</p>}

      {!isLoading && ortaklar.length === 0 && (
        <BosDurum
          ikon={<Activity size={28} />}
          baslik="Henüz ölçüm yok"
          aciklama="Saatlik iş Lynon raporlarını okumaya başladığında günlük kayıtlar burada birikir. İlk tur 30 gün geriye gider."
        />
      )}

      {ortaklar.length > 0 && (
        <div className={`${KART} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="px-4 text-left">Ortak</th>
                  <th className="px-4 text-right">Oyuncu</th>
                  <th className="px-4 text-right">Aktif</th>
                  <th className="px-4 text-right">Yatırım</th>
                  <th className="px-4 text-right">Çekim</th>
                  <th className="px-4 text-right">GGR</th>
                  <th className="px-4 text-right">FTD</th>
                  <th className="px-4 text-left">Eğilim</th>
                </tr>
              </thead>
              <tbody>
                {ortaklar.map((o) => (
                  <tr key={o.ortakAnahtari}>
                    <td className="px-4 font-semibold text-white">
                      {o.ortakAnahtari}
                      <span className="ml-2 text-[10px] font-normal text-[color:var(--panel-faint,#5c6470)]">
                        {o.gunSayisi} gün
                      </span>
                    </td>
                    <td className="px-4 text-right">{formatNumber(o.oyuncuSayisi)}</td>
                    <td className="px-4 text-right">{formatNumber(o.aktifOyuncuSayisi)}</td>
                    <td className="px-4 text-right">{tl(o.yatirim)}</td>
                    <td className="px-4 text-right">{tl(o.cekim)}</td>
                    <td className="px-4 text-right font-bold text-white">{tl(o.ggr)}</td>
                    <td className="px-4 text-right">
                      {/* null = olculmedi. 0 yazmak "hic ilk yatirim olmadi"
                          demek olurdu; cekme yolu bunu olcemiyor. */}
                      {o.ftdSayisi === null
                        ? <span className="text-[color:var(--panel-faint,#5c6470)]" title="Çekme yolunda ölçülemiyor">—</span>
                        : formatNumber(o.ftdSayisi)}
                    </td>
                    <td className="px-4">
                      <EgilimCizgisi degerler={o.gunlukGgr.map((g) => g.ggr)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data?.toplam && (
            <div className="flex flex-wrap gap-6 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-4 py-3">
              <div><p className={ETIKET}>Toplam yatırım</p><p className="text-sm font-bold text-white">{tl(data.toplam.yatirim)}</p></div>
              <div><p className={ETIKET}>Toplam çekim</p><p className="text-sm font-bold text-white">{tl(data.toplam.cekim)}</p></div>
              <div><p className={ETIKET}>Toplam GGR</p><p className="text-sm font-bold text-white">{tl(data.toplam.ggr)}</p></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
