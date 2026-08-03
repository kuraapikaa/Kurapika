/**
 * Aylık mutabakat.
 *
 * Kaynak rapor 1842 — ödeme yöntemi kırılımı. Rapor YALNIZCA ödeme
 * sağlayıcılarından geçen parayı görüyor; elden yapılan havaleler, iade
 * ve dengeleme kalemleri raporda yok. Bu yüzden elle eklenen kalemler
 * AYRI bir blokta duruyor: "raporun söylediği" ile "elle eklenen"
 * birbirine karışmıyor. Tek toplam göstermek farkın kaynağını gizlerdi.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BookOpen, Plus, Send, Trash2 } from 'lucide-react';
import { dashboardApi } from '../api/client';
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
  anahtar: string; entegrasyon: string; yontem: string;
  yatirim: number; yatirimAdedi: number; cekim: number; cekimAdedi: number; net: number;
};
type Kalem = {
  id: string; gun: string; tur: 'yatirim' | 'cekim';
  tutar: number; aciklama: string; ekleyen: string; eklendi: string;
};

function bugunYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function Mutabakat() {
  const queryClient = useQueryClient();
  const [gun, setGun] = useState(bugunYmd);
  const [tur, setTur] = useState<'yatirim' | 'cekim'>('yatirim');
  const [tutar, setTutar] = useState('');
  const [aciklama, setAciklama] = useState('');

  const { data: yanit, isLoading, error } = useQuery({
    queryKey: ['mutabakat'],
    queryFn: () => dashboardApi.mutabakat(),
    staleTime: 2 * 60 * 1000,
  });

  const veri = yanit?.Data ?? {};
  const satirlar: Satir[] = veri.Satirlar ?? [];
  const toplam = veri.Toplam ?? {};
  const fark = veri.Fark ?? { tutarli: true };
  const kalemler: Kalem[] = veri.ManuelKalemler ?? [];

  const tazele = () => queryClient.invalidateQueries({ queryKey: ['mutabakat'] });

  const ekle = useMutation({
    mutationFn: () => dashboardApi.mutabakatKalemEkle({ gun, tur, tutar: Number(tutar), aciklama }),
    onSuccess: () => { setTutar(''); setAciklama(''); tazele(); },
  });
  const sil = useMutation({
    mutationFn: (id: string) => dashboardApi.mutabakatKalemSil(id),
    onSuccess: tazele,
  });
  const gonder = useMutation({ mutationFn: () => dashboardApi.mutabakatGonder() });

  const hataMesaji = (error as Error)?.message || (yanit?.HasError ? yanit?.AlertMessage : '');
  if (hataMesaji) {
    return (
      <PanoKart vurgu="cikis">
        <PanoBaslik baslik="Aylık mutabakat" vurgu="cikis" simge={<BookOpen size={15} />} />
        <PanoHata mesaj={hataMesaji} />
      </PanoKart>
    );
  }

  const tutarGecerli = Number(tutar) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(gun);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PanoOlcu
          etiket="Yatırım (rapor)"
          deger={sayiYaz(isLoading ? null : toplam.raporYatirim ?? null, 'para')}
          alt={veri.Ay ? `${veri.Ay} · sağlayıcılardan` : 'Sağlayıcılardan'}
          simge={<ArrowUpRight size={16} />}
          vurgu="giris"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Çekim (rapor)"
          deger={sayiYaz(isLoading ? null : toplam.raporCekim ?? null, 'para')}
          alt="Sağlayıcılardan"
          simge={<ArrowDownRight size={16} />}
          vurgu="cikis"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Elle Eklenen"
          deger={isLoading ? '—' : isaretliYaz(toplam.manuelNet ?? 0)}
          alt={`${toplam.manuelKalemAdedi ?? 0} kalem`}
          simge={<Plus size={16} />}
          vurgu="maliyet"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Genel Net"
          deger={isLoading || toplam.toplamNet == null ? '—' : isaretliYaz(toplam.toplamNet)}
          alt="Rapor + elle eklenen"
          simge={<BookOpen size={16} />}
          vurgu={(toplam.toplamNet ?? 0) >= 0 ? 'giris' : 'cikis'}
          veriYok={isLoading}
        />
      </div>

      {/*
        * Satır toplamı uçun özetiyle tutmuyorsa raporda görmediğimiz bir
        * kalem var demektir. Bunu yutmak mutabakatın amacını bozar.
        */}
      {!fark.tutarli && (
        <PanoKart vurgu="cikis" className="px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
            <AlertTriangle size={12} /> Satır toplamı uçun özetiyle tutmuyor
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--panel-text-dim,#c8cdd5)]">
            Yatırım farkı {sayiYaz(fark.yatirimFarki, 'para')} · Çekim farkı {sayiYaz(fark.cekimFarki, 'para')}.
            Raporda satır olarak görünmeyen bir kalem var.
          </p>
        </PanoKart>
      )}

      <PanoKart>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <PanoBaslik
            baslik="Ödeme yöntemi kırılımı"
            ipucu="Rapor 1842. Yalnızca ödeme sağlayıcılarından geçen para."
            simge={<BookOpen size={15} />}
            vurgu="hacim"
          />
          <button
            type="button"
            onClick={() => gonder.mutate()}
            disabled={gonder.isPending}
            className="mb-3.5 flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-3 text-xs font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] hover:bg-white/[0.05] disabled:opacity-40"
          >
            <Send size={13} /> {gonder.isPending ? 'Gönderiliyor…' : "Telegram'a gönder"}
          </button>
        </div>
        {gonder.isError && (
          <p className="px-4 pb-3 text-[11px] text-rose-300">{(gonder.error as Error).message}</p>
        )}
        {gonder.isSuccess && (
          <p className="px-4 pb-3 text-[11px] text-emerald-300">Mutabakat gönderildi.</p>
        )}

        {isLoading && <PanoYukleniyor satir={5} />}
        {!isLoading && satirlar.length === 0 && <PanoBos>Bu ayda sağlayıcı hareketi yok.</PanoBos>}
        {!isLoading && satirlar.length > 0 && (
          <PanoTablo
            minGenislik={720}
            basliklar={[
              { ad: 'Sağlayıcı · Yöntem' }, { ad: 'Yatırım', sag: true }, { ad: 'Adet', sag: true },
              { ad: 'Çekim', sag: true }, { ad: 'Adet', sag: true }, { ad: 'Net', sag: true },
            ]}
          >
            {satirlar.map((satir) => (
              <PanoSatir key={satir.anahtar}>
                <PanoHucreYazi>
                  <span className="font-semibold text-white">{satir.entegrasyon}</span>
                  <span className="ml-1.5 text-[11px] text-[color:var(--panel-muted,#8a919c)]">{satir.yontem}</span>
                </PanoHucreYazi>
                <PanoHucreYazi sag renk="text-emerald-300/80">{sayiYaz(satir.yatirim, 'para')}</PanoHucreYazi>
                <PanoHucreYazi sag>{sayiYaz(satir.yatirimAdedi)}</PanoHucreYazi>
                <PanoHucreYazi sag renk="text-rose-300/80">{sayiYaz(satir.cekim, 'para')}</PanoHucreYazi>
                <PanoHucreYazi sag>{sayiYaz(satir.cekimAdedi)}</PanoHucreYazi>
                <PanoHucreYazi sag>
                  <span className={satir.net >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
                    {isaretliYaz(satir.net)}
                  </span>
                </PanoHucreYazi>
              </PanoSatir>
            ))}
          </PanoTablo>
        )}
      </PanoKart>

      <PanoKart>
        <PanoBaslik
          baslik="Elle eklenen kalemler"
          ipucu="Elden havale, iade, dengeleme… Raporda görünmeyen ama kasaya giren/çıkan para."
          simge={<Plus size={15} />}
          vurgu="maliyet"
        />

        <div className="flex flex-wrap items-end gap-2 px-4 pb-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--panel-muted,#8a919c)]">Gün</span>
            <input
              type="date"
              value={gun}
              onChange={(e) => setGun(e.target.value)}
              className="h-9 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--panel-muted,#8a919c)]">Tür</span>
            <select
              value={tur}
              onChange={(e) => setTur(e.target.value as 'yatirim' | 'cekim')}
              className="h-9 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
            >
              <option value="yatirim">Yatırım</option>
              <option value="cekim">Çekim</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--panel-muted,#8a919c)]">Tutar</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={tutar}
              onChange={(e) => setTutar(e.target.value)}
              placeholder="0"
              className="h-9 w-28 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
            />
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--panel-muted,#8a919c)]">Açıklama</span>
            <input
              type="text"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Elden havale, iade…"
              className="h-9 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] px-2 text-xs text-white placeholder:text-[color:var(--panel-muted,#8a919c)] focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => ekle.mutate()}
            disabled={!tutarGecerli || ekle.isPending}
            className="h-9 rounded-lg bg-[color:var(--panel-accent,#0a84ff)] px-3 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ekle.isPending ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </div>
        {ekle.isError && <p className="px-4 pb-3 text-[11px] text-rose-300">{(ekle.error as Error).message}</p>}

        {kalemler.length === 0 ? (
          <PanoBos>Bu ayda elle eklenmiş kalem yok.</PanoBos>
        ) : (
          <PanoTablo
            minGenislik={640}
            basliklar={[{ ad: 'Gün' }, { ad: 'Tür' }, { ad: 'Tutar', sag: true }, { ad: 'Açıklama' }, { ad: 'Ekleyen' }, { ad: '', sag: true }]}
          >
            {kalemler.map((kalem) => (
              <PanoSatir key={kalem.id}>
                <PanoHucreYazi><span className="tabular-nums text-[11px]">{kalem.gun}</span></PanoHucreYazi>
                <PanoHucreYazi>
                  <span className={kalem.tur === 'yatirim' ? 'text-emerald-300' : 'text-rose-300'}>
                    {kalem.tur === 'yatirim' ? 'Yatırım' : 'Çekim'}
                  </span>
                </PanoHucreYazi>
                <PanoHucreYazi sag>{sayiYaz(kalem.tutar, 'para')}</PanoHucreYazi>
                <PanoHucreYazi><span className="text-[11px]">{kalem.aciklama || '—'}</span></PanoHucreYazi>
                <PanoHucreYazi><span className="text-[11px]">{kalem.ekleyen}</span></PanoHucreYazi>
                <PanoHucreYazi sag>
                  <button
                    type="button"
                    onClick={() => sil.mutate(kalem.id)}
                    disabled={sil.isPending}
                    className="rounded-md p-1.5 text-[color:var(--panel-muted,#8a919c)] hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                    title="Kalemi sil"
                  >
                    <Trash2 size={13} />
                  </button>
                </PanoHucreYazi>
              </PanoSatir>
            ))}
          </PanoTablo>
        )}
      </PanoKart>
    </div>
  );
}
