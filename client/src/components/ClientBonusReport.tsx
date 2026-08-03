/**
 * Tüm bonus raporu.
 *
 * Kaynak `Report By Bonus` özet raporundan BONUS OTURUMLARINA taşındı
 * (`bonusSessions/site/137`). Özet rapor bonus türüne göre toplam
 * döndürüyordu; ekranın "Oyuncu" sütunu boş kalıyordu ve "bu üye kaç kez
 * aynı bonusu aldı" sorusu rapordan cevaplanamıyordu.
 *
 * Ekran artık panonun tasarım dilini kullanıyor (`ui/pano`) ve üç şeyi
 * ayrı ayrı söylüyor: ne verildi, kime verildi, kime KAÇ KEZ verildi.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Gift, Search, Users } from 'lucide-react';
import { dashboardApi } from '../api/client';
import { useDateRange } from '../context/DateRangeContext';
import { matchesAnyTr } from '../lib/turkishSearch';
import {
  PanoBaslik,
  PanoBos,
  PanoHata,
  PanoHucreYazi,
  PanoKart,
  PanoOlcu,
  PanoSatir,
  PanoTablo,
  PanoYukleniyor,
  sayiYaz,
} from './ui/pano';

type BonusSatiri = {
  Id: number;
  ClientId: number;
  ClientLogin: string;
  ClientName: string;
  Name: string;
  TemplateName: string;
  Description: string;
  CampaignId: number | null;
  TotalPaidAmount: number;
  Durum: string;
  Kategori: string | null;
  CreatedLocal: string | null;
  ClientCurrency: string | null;
};

type OzetSatiri = { ad: string; adet: number; odenen: number; oyuncuSayisi: number };
type MukerrerSatiri = {
  clientId: number;
  clientLogin: string;
  bonusAdi: string;
  adet: number;
  sonVerilis: string | null;
};

const SAYFA_SECENEKLERI = [25, 50, 100, 250, 500];

/** "2026-08-03T02:00:16.248848Z" → "03.08.2026 05:00" (Türkiye saati). */
function tarihYaz(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(t));
}

export function ClientBonusReport() {
  const { dateRange } = useDateRange();
  const [arama, setArama] = useState('');
  const [sayfa, setSayfa] = useState(1);
  const [sayfaBoyu, setSayfaBoyu] = useState(50);

  const { data: yanit, isLoading, error } = useQuery({
    queryKey: ['client-bonus-report', dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardApi.bonusReport(dateRange),
  });

  const veri = yanit?.Data ?? {};
  const satirlar: BonusSatiri[] = veri?.ClientBonusReportData?.Objects ?? [];
  const ozet: OzetSatiri[] = veri?.BonusOzeti ?? [];
  const mukerrer: MukerrerSatiri[] = veri?.MukerrerVerilisler ?? [];
  const adsizOyuncu: number = veri?.AdsizOyuncu ?? 0;
  const kirpildi: boolean = Boolean(veri?.Kirpildi);
  const veriEksik: boolean = Boolean(veri?.VeriEksik);
  const kapsananEnEskiGun: string | null = veri?.KapsananEnEskiGun ?? null;

  const suzulmus = useMemo(
    () =>
      satirlar.filter((satir) =>
        matchesAnyTr(
          [String(satir.ClientId), satir.ClientLogin, satir.ClientName, satir.Name, satir.TemplateName],
          arama,
        ),
      ),
    [satirlar, arama],
  );

  const toplamOdenen = suzulmus.reduce((t, s) => t + (s.TotalPaidAmount || 0), 0);
  const tekilOyuncu = new Set(suzulmus.map((s) => s.ClientId)).size;
  const sonSayfa = Math.max(1, Math.ceil(suzulmus.length / sayfaBoyu));
  const gorunen = suzulmus.slice((sayfa - 1) * sayfaBoyu, sayfa * sayfaBoyu);

  const hataMesaji = (error as Error)?.message || (yanit?.HasError ? yanit?.AlertMessage : '');

  if (hataMesaji) {
    return (
      <PanoKart vurgu="cikis">
        <PanoBaslik baslik="Tüm bonus raporu" vurgu="cikis" simge={<Gift size={15} />} />
        <PanoHata mesaj={hataMesaji} />
      </PanoKart>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PanoOlcu
          etiket="Verilen Bonus"
          deger={sayiYaz(isLoading ? null : suzulmus.length)}
          alt={`${dateRange.startDate}${dateRange.endDate !== dateRange.startDate ? ` → ${dateRange.endDate}` : ''}`}
          simge={<Gift size={16} />}
          vurgu="maliyet"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Bonus Alan Oyuncu"
          deger={sayiYaz(isLoading ? null : tekilOyuncu, 'oyuncu')}
          alt={adsizOyuncu > 0 ? `${adsizOyuncu} kaydın kullanıcı adı eşleşmedi` : 'Tümünün adı eşleşti'}
          simge={<Users size={16} />}
          vurgu="oyuncu"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Ödenen Tutar"
          deger={sayiYaz(isLoading ? null : toplamOdenen, 'para')}
          alt="Oturumlardan çıkan gerçek ödeme"
          simge={<BarChart3 size={16} />}
          vurgu="cikis"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Mükerrer Veriliş"
          deger={sayiYaz(isLoading ? null : mukerrer.length)}
          alt="Aynı oyuncu, aynı bonus, birden çok kez"
          simge={<AlertTriangle size={16} />}
          vurgu={mukerrer.length > 0 ? 'cikis' : 'notr'}
          veriYok={isLoading}
        />
      </div>

      {/*
        * KAPSAM UYARISI.
        *
        * Uç tarih filtresi kabul etmiyor; oturumlar çekilip sunucuda
        * süzülüyor ve sayfa tavanı var. Seçilen aralık kapsamın dışına
        * taşarsa rapor BOŞ görünür — "o gün bonus verilmemiş" ile
        * "o günün verisi elimizde yok" aynı görünürdü. Artık ayrı.
        */}
      {veriEksik && (
        <PanoKart vurgu="cikis" className="px-4 py-3">
          <p className="text-[11px] font-semibold text-rose-300">Bu aralığın tamamı elimizde yok</p>
          <p className="mt-1 text-[11px] text-[color:var(--panel-text-dim,#c8cdd5)]">
            Lynon bonus oturumları uçtan tarih filtresiyle çekilemiyor; en fazla{' '}
            {(veri?.ToplamOturum ?? 0).toLocaleString('tr-TR')} kayıt okunabiliyor ve bu kayıtların en eskisi{' '}
            <span className="font-semibold text-white">{kapsananEnEskiGun}</span>. Seçtiğiniz aralık bundan
            öncesine uzanıyor, o günler bu raporda görünmüyor. Daha dar bir aralık seçin.
          </p>
        </PanoKart>
      )}
      {kirpildi && !veriEksik && (
        <PanoKart className="px-4 py-3">
          <p className="text-[11px] text-amber-400/90">
            Sayfa tavanına ulaşıldı. Seçilen aralık kapsam içinde ({kapsananEnEskiGun} ve sonrası), ama daha
            eski günler için rapor eksik kalır.
          </p>
        </PanoKart>
      )}

      {/*
        * MÜKERRER VERİLİŞLER.
        *
        * "Bu üye nasıl bir sürü telegram bonusu almış?" sorusu üç kez
        * şikâyet olarak geldi. Panel bunu saymadığı sürece ancak şikâyet
        * gelince fark ediliyordu; artık raporun başında duruyor.
        */}
      {mukerrer.length > 0 && (
        <PanoKart vurgu="cikis">
          <PanoBaslik
            baslik="Aynı bonusu birden çok kez alanlar"
            ipucu="Bir yatırım = aynı bonustan bir kez kuralının dışında kalan verilişler."
            simge={<AlertTriangle size={15} />}
            vurgu="cikis"
          />
          <PanoTablo
            basliklar={[{ ad: 'Oyuncu' }, { ad: 'Bonus' }, { ad: 'Adet', sag: true }, { ad: 'Son veriliş', sag: true }]}
          >
            {mukerrer.slice(0, 20).map((satir) => (
              <PanoSatir key={`${satir.clientId}-${satir.bonusAdi}`}>
                <PanoHucreYazi>
                  <span className="font-semibold text-white">{satir.clientLogin || '—'}</span>
                  <span className="ml-2 text-[11px] text-[color:var(--panel-muted,#8a919c)]">{satir.clientId}</span>
                </PanoHucreYazi>
                <PanoHucreYazi>{satir.bonusAdi}</PanoHucreYazi>
                <PanoHucreYazi sag>
                  <span className="font-semibold text-rose-300">{satir.adet}</span>
                </PanoHucreYazi>
                <PanoHucreYazi sag>{tarihYaz(satir.sonVerilis)}</PanoHucreYazi>
              </PanoSatir>
            ))}
          </PanoTablo>
        </PanoKart>
      )}

      {ozet.length > 0 && (
        <PanoKart>
          <PanoBaslik baslik="Bonus bazında" simge={<BarChart3 size={15} />} vurgu="maliyet" />
          <PanoTablo
            basliklar={[{ ad: 'Bonus' }, { ad: 'Veriliş', sag: true }, { ad: 'Oyuncu', sag: true }, { ad: 'Ödenen', sag: true }]}
          >
            {ozet.slice(0, 15).map((satir) => (
              <PanoSatir key={satir.ad}>
                <PanoHucreYazi>
                  <span className="font-semibold text-white">{satir.ad}</span>
                </PanoHucreYazi>
                <PanoHucreYazi sag>{sayiYaz(satir.adet)}</PanoHucreYazi>
                <PanoHucreYazi sag>{sayiYaz(satir.oyuncuSayisi, 'oyuncu')}</PanoHucreYazi>
                <PanoHucreYazi sag renk="text-rose-300/80">{sayiYaz(satir.odenen, 'para')}</PanoHucreYazi>
              </PanoSatir>
            ))}
          </PanoTablo>
        </PanoKart>
      )}

      <PanoKart>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <PanoBaslik baslik="Tüm verilen bonuslar" simge={<Gift size={15} />} vurgu="maliyet" />
          <div className="relative pb-3.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--panel-muted,#8a919c)]" size={15} />
            <input
              type="text"
              placeholder="Oyuncu, kullanıcı adı veya bonus…"
              value={arama}
              onChange={(e) => {
                setArama(e.target.value);
                setSayfa(1);
              }}
              className="h-9 w-full rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] pl-9 pr-3 text-xs text-white placeholder:text-[color:var(--panel-muted,#8a919c)] focus:border-[color:var(--panel-accent,#0a84ff)] focus:outline-none sm:w-72"
            />
          </div>
        </div>

        {isLoading && <PanoYukleniyor satir={8} />}
        {!isLoading && suzulmus.length === 0 && (
          <PanoBos>Bu aralıkta bonus verilişi yok.</PanoBos>
        )}

        {!isLoading && suzulmus.length > 0 && (
          <PanoTablo
            minGenislik={860}
            basliklar={[
              { ad: 'Oyuncu' },
              { ad: 'Bonus' },
              { ad: 'Ödenen', sag: true },
              { ad: 'Durum' },
              { ad: 'Veriliş' },
            ]}
          >
            {gorunen.map((satir) => (
              <PanoSatir key={satir.Id}>
                <PanoHucreYazi>
                  <span className="flex flex-col">
                    {/* Ad eşleşmediyse boş bırakılır; kimlik ada terfi ettirilmez. */}
                    <span className="font-semibold text-white">{satir.ClientLogin || '(ad eşleşmedi)'}</span>
                    <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">{satir.ClientId}</span>
                  </span>
                </PanoHucreYazi>
                <PanoHucreYazi>
                  <span className="flex flex-col">
                    <span className="font-semibold text-amber-300">{satir.Name}</span>
                    <span
                      className="max-w-[420px] truncate text-[10px] text-[color:var(--panel-muted,#8a919c)]"
                      title={satir.Description}
                    >
                      {satir.Description || satir.TemplateName || '—'}
                    </span>
                  </span>
                </PanoHucreYazi>
                <PanoHucreYazi sag renk="text-rose-300/80">{sayiYaz(satir.TotalPaidAmount, 'para')}</PanoHucreYazi>
                <PanoHucreYazi>
                  <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-dim,#c8cdd5)]">
                    {satir.Durum}
                  </span>
                  {satir.Kategori && (
                    <span className="ml-1.5 text-[10px] text-[color:var(--panel-muted,#8a919c)]">{satir.Kategori}</span>
                  )}
                </PanoHucreYazi>
                <PanoHucreYazi>
                  <span className="tabular-nums text-[11px]">{tarihYaz(satir.CreatedLocal)}</span>
                </PanoHucreYazi>
              </PanoSatir>
            ))}
          </PanoTablo>
        )}

        {!isLoading && suzulmus.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] text-[color:var(--panel-muted,#8a919c)]">
              <select
                value={sayfaBoyu}
                onChange={(e) => {
                  setSayfaBoyu(Number(e.target.value));
                  setSayfa(1);
                }}
                className="rounded-md border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] px-2 py-1 text-white focus:outline-none"
              >
                {SAYFA_SECENEKLERI.map((n) => (
                  <option key={n} value={n}>{n} kayıt</option>
                ))}
              </select>
              <span>Toplam {suzulmus.length} kayıt</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setSayfa((p) => Math.max(1, p - 1))}
                disabled={sayfa === 1}
                className="rounded-md px-2.5 py-1 text-[color:var(--panel-muted,#8a919c)] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Önceki
              </button>
              <span className="tabular-nums text-[color:var(--panel-text-dim,#c8cdd5)]">
                {sayfa} / {sonSayfa}
              </span>
              <button
                type="button"
                onClick={() => setSayfa((p) => Math.min(sonSayfa, p + 1))}
                disabled={sayfa >= sonSayfa}
                className="rounded-md px-2.5 py-1 text-[color:var(--panel-muted,#8a919c)] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </PanoKart>
    </div>
  );
}
