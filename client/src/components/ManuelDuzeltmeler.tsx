/**
 * Manuel bakiye düzeltmeleri raporu.
 *
 * Panelin kendi denetim kaydı yalnızca PANELDEN yapılan işlemleri
 * görüyor. Lynon arayüzünden elle yapılan bakiye eklemeleri oraya hiç
 * düşmüyordu — kasadan para çıkaran ikinci bir yol vardı ve panelde
 * görünmüyordu. Bu ekran `CorrectionHistory` ucundan o boşluğu kapatıyor;
 * ucun taşıdığı `userName` alanı sayesinde her hareketin sorumlusu belli.
 *
 * İki şey ayrı tutuluyor:
 *   • Hesap türü — `PlayerAccount` ile `PlayerUnusedBalance` aynı kalem
 *     değil; tek bir toplam ikisini birbirine karıştırır.
 *   • Gerekçe notu — manuel para hareketinin nedeni denetlenebilir
 *     olmalı; notsuz işlemler ayrıca sayılıyor.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Scale, Search, UserCog } from 'lucide-react';
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
  isaretliYaz,
  sayiYaz,
} from './ui/pano';

type Satir = {
  Id: number;
  ClientId: number;
  ClientLogin: string;
  Hesap: string;
  Yon: 'giris' | 'cikis' | 'bilinmiyor';
  Tutar: number;
  NetTutar: number;
  ParaBirimi: string;
  Yapan: string;
  Not: string;
  NotAnlamli: boolean;
  Kategori: string | null;
  CreatedLocal: string | null;
};

type YapanOzeti = { yapan: string; adet: number; giris: number; cikis: number; net: number; notsuz: number };
type HesapOzeti = { hesap: string; adet: number; giris: number; cikis: number; net: number };

const SAYFA_SECENEKLERI = [25, 50, 100, 250];

function tarihYaz(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(t));
}

export function ManuelDuzeltmeler() {
  const { dateRange } = useDateRange();
  const [arama, setArama] = useState('');
  const [yalnizNotsuz, setYalnizNotsuz] = useState(false);
  const [sayfa, setSayfa] = useState(1);
  const [sayfaBoyu, setSayfaBoyu] = useState(50);

  const { data: yanit, isLoading, error } = useQuery({
    queryKey: ['manuel-duzeltmeler', dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardApi.manuelDuzeltmeler(dateRange),
  });

  const veri = yanit?.Data ?? {};
  const satirlar: Satir[] = veri.Satirlar ?? [];
  const toplam = veri.Toplam ?? {};
  const yapanOzeti: YapanOzeti[] = veri.YapanOzeti ?? [];
  const hesapOzeti: HesapOzeti[] = veri.HesapOzeti ?? [];
  const veriEksik: boolean = Boolean(veri.VeriEksik);
  const kapsananEnEskiGun: string | null = veri.KapsananEnEskiGun ?? null;

  const suzulmus = useMemo(
    () =>
      satirlar
        .filter((s) => (yalnizNotsuz ? !s.NotAnlamli : true))
        .filter((s) => matchesAnyTr([String(s.ClientId), s.ClientLogin, s.Yapan, s.Hesap, s.Not], arama)),
    [satirlar, arama, yalnizNotsuz],
  );

  const sonSayfa = Math.max(1, Math.ceil(suzulmus.length / sayfaBoyu));
  const gorunen = suzulmus.slice((sayfa - 1) * sayfaBoyu, sayfa * sayfaBoyu);
  const hataMesaji = (error as Error)?.message || (yanit?.HasError ? yanit?.AlertMessage : '');

  if (hataMesaji) {
    return (
      <PanoKart vurgu="cikis">
        <PanoBaslik baslik="Manuel düzeltmeler" vurgu="cikis" simge={<Scale size={15} />} />
        <PanoHata mesaj={hataMesaji} />
      </PanoKart>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PanoOlcu
          etiket="Eklenen Bakiye"
          deger={sayiYaz(isLoading ? null : toplam.giris ?? null, 'para')}
          alt={`${sayiYaz(toplam.adet ?? null)} işlem · ${sayiYaz(toplam.oyuncuSayisi ?? null, 'oyuncu')}`}
          simge={<ArrowUpRight size={16} />}
          vurgu="cikis"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Çıkarılan Bakiye"
          deger={sayiYaz(isLoading ? null : toplam.cikis ?? null, 'para')}
          alt="Elle yapılan debiting düzeltmeleri"
          simge={<ArrowDownRight size={16} />}
          vurgu="giris"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Net"
          deger={isLoading || toplam.net == null ? '—' : isaretliYaz(toplam.net)}
          alt="Kasadan çıkan net tutar"
          simge={<Scale size={16} />}
          vurgu={(toplam.net ?? 0) > 0 ? 'cikis' : 'notr'}
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Gerekçesiz İşlem"
          deger={sayiYaz(isLoading ? null : toplam.notsuz ?? null)}
          alt="Not alanı boş ya da anlamsız"
          simge={<AlertTriangle size={16} />}
          vurgu={(toplam.notsuz ?? 0) > 0 ? 'maliyet' : 'notr'}
          veriYok={isLoading}
        />
      </div>

      {veriEksik && (
        <PanoKart vurgu="cikis" className="px-4 py-3">
          <p className="text-[11px] font-semibold text-rose-300">Bu aralığın tamamı elimizde yok</p>
          <p className="mt-1 text-[11px] text-[color:var(--panel-text-dim,#c8cdd5)]">
            Uç tarih filtresi kabul etmiyor; okunabilen en eski kayıt{' '}
            <span className="font-semibold text-white">{kapsananEnEskiGun}</span>. Daha dar bir aralık seçin.
          </p>
        </PanoKart>
      )}

      {(toplam.yonuBilinmeyen ?? 0) > 0 && (
        <PanoKart className="px-4 py-3">
          <p className="text-[11px] text-amber-400/90">
            {toplam.yonuBilinmeyen} kaydın yönü (crediting/debiting) okunamadı; bu kayıtlar toplamlara
            katılmadı.
          </p>
        </PanoKart>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/*
          * YÖNETİCİ BAZINDA.
          *
          * "Bu ay kim ne kadar elle bakiye ekledi" sorusunun tek satırlık
          * cevabı. Gerekçesiz işlem sayısı ayrı sütunda.
          */}
        <PanoKart>
          <PanoBaslik baslik="Yöneticiye göre" simge={<UserCog size={15} />} vurgu="oyuncu" />
          {isLoading && <PanoYukleniyor satir={4} />}
          {!isLoading && yapanOzeti.length === 0 && <PanoBos>Bu aralıkta manuel düzeltme yok.</PanoBos>}
          {!isLoading && yapanOzeti.length > 0 && (
            <PanoTablo
              minGenislik={460}
              basliklar={[
                { ad: 'Yönetici' }, { ad: 'İşlem', sag: true }, { ad: 'Eklenen', sag: true },
                { ad: 'Çıkarılan', sag: true }, { ad: 'Gerekçesiz', sag: true },
              ]}
            >
              {yapanOzeti.map((o) => (
                <PanoSatir key={o.yapan}>
                  <PanoHucreYazi>
                    <span className="font-semibold text-white">{o.yapan}</span>
                  </PanoHucreYazi>
                  <PanoHucreYazi sag>{sayiYaz(o.adet)}</PanoHucreYazi>
                  <PanoHucreYazi sag renk="text-rose-300/80">{sayiYaz(o.giris, 'para')}</PanoHucreYazi>
                  <PanoHucreYazi sag renk="text-emerald-300/80">{sayiYaz(o.cikis, 'para')}</PanoHucreYazi>
                  <PanoHucreYazi sag>
                    <span className={o.notsuz > 0 ? 'font-semibold text-amber-300' : undefined}>
                      {sayiYaz(o.notsuz)}
                    </span>
                  </PanoHucreYazi>
                </PanoSatir>
              ))}
            </PanoTablo>
          )}
        </PanoKart>

        <PanoKart>
          <PanoBaslik
            baslik="Hesaba göre"
            ipucu="PlayerAccount ile PlayerUnusedBalance aynı kalem değil; ayrı tutulur."
            simge={<Scale size={15} />}
            vurgu="hacim"
          />
          {isLoading && <PanoYukleniyor satir={4} />}
          {!isLoading && hesapOzeti.length === 0 && <PanoBos>Kayıt yok.</PanoBos>}
          {!isLoading && hesapOzeti.length > 0 && (
            <PanoTablo
              minGenislik={420}
              basliklar={[{ ad: 'Hesap' }, { ad: 'İşlem', sag: true }, { ad: 'Eklenen', sag: true }, { ad: 'Çıkarılan', sag: true }]}
            >
              {hesapOzeti.map((o) => (
                <PanoSatir key={o.hesap}>
                  <PanoHucreYazi>
                    <span className="font-semibold text-white">{o.hesap}</span>
                  </PanoHucreYazi>
                  <PanoHucreYazi sag>{sayiYaz(o.adet)}</PanoHucreYazi>
                  <PanoHucreYazi sag renk="text-rose-300/80">{sayiYaz(o.giris, 'para')}</PanoHucreYazi>
                  <PanoHucreYazi sag renk="text-emerald-300/80">{sayiYaz(o.cikis, 'para')}</PanoHucreYazi>
                </PanoSatir>
              ))}
            </PanoTablo>
          )}
        </PanoKart>
      </div>

      <PanoKart>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <PanoBaslik baslik="Tüm manuel düzeltmeler" simge={<Scale size={15} />} vurgu="maliyet" />
          <div className="flex items-center gap-2 pb-3.5">
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[color:var(--panel-text-dim,#c8cdd5)]">
              <input
                type="checkbox"
                checked={yalnizNotsuz}
                onChange={(e) => { setYalnizNotsuz(e.target.checked); setSayfa(1); }}
                className="h-3.5 w-3.5 accent-[color:var(--panel-accent,#0a84ff)]"
              />
              Yalnız gerekçesiz
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--panel-muted,#8a919c)]" size={15} />
              <input
                type="text"
                placeholder="Oyuncu, yönetici, hesap, not…"
                value={arama}
                onChange={(e) => { setArama(e.target.value); setSayfa(1); }}
                className="h-9 w-full rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] pl-9 pr-3 text-xs text-white placeholder:text-[color:var(--panel-muted,#8a919c)] focus:border-[color:var(--panel-accent,#0a84ff)] focus:outline-none sm:w-64"
              />
            </div>
          </div>
        </div>

        {isLoading && <PanoYukleniyor satir={8} />}
        {!isLoading && suzulmus.length === 0 && <PanoBos>Bu aralıkta manuel düzeltme yok.</PanoBos>}

        {!isLoading && suzulmus.length > 0 && (
          <PanoTablo
            minGenislik={940}
            basliklar={[
              { ad: 'Oyuncu' }, { ad: 'Hesap' }, { ad: 'Tutar', sag: true },
              { ad: 'Yapan' }, { ad: 'Gerekçe' }, { ad: 'Tarih' },
            ]}
          >
            {gorunen.map((satir) => (
              <PanoSatir key={satir.Id}>
                <PanoHucreYazi>
                  <span className="flex flex-col">
                    <span className="font-semibold text-white">{satir.ClientLogin || '(ad eşleşmedi)'}</span>
                    <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">{satir.ClientId}</span>
                  </span>
                </PanoHucreYazi>
                <PanoHucreYazi>
                  <span className="text-[11px]">{satir.Hesap}</span>
                  {satir.Kategori && (
                    <span className="ml-1.5 text-[10px] text-[color:var(--panel-muted,#8a919c)]">{satir.Kategori}</span>
                  )}
                </PanoHucreYazi>
                <PanoHucreYazi sag>
                  <span
                    className={
                      satir.Yon === 'giris' ? 'font-semibold text-rose-300'
                      : satir.Yon === 'cikis' ? 'font-semibold text-emerald-300'
                      : 'font-semibold text-amber-300'
                    }
                  >
                    {satir.Yon === 'giris' ? '+' : satir.Yon === 'cikis' ? '−' : '?'}
                    {sayiYaz(satir.Tutar, 'para')}
                  </span>
                </PanoHucreYazi>
                <PanoHucreYazi>
                  <span className="text-[11px] font-semibold text-violet-300">{satir.Yapan}</span>
                </PanoHucreYazi>
                <PanoHucreYazi>
                  {satir.NotAnlamli ? (
                    <span className="text-[11px]">{satir.Not}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-300">
                      <AlertTriangle size={11} /> gerekçe yok
                    </span>
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
                onChange={(e) => { setSayfaBoyu(Number(e.target.value)); setSayfa(1); }}
                className="rounded-md border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] px-2 py-1 text-white focus:outline-none"
              >
                {SAYFA_SECENEKLERI.map((n) => <option key={n} value={n}>{n} kayıt</option>)}
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
              <span className="tabular-nums text-[color:var(--panel-text-dim,#c8cdd5)]">{sayfa} / {sonSayfa}</span>
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
