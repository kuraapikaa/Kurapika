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
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BookOpen, Pencil, Plus, Send, Settings2, Trash2,
} from 'lucide-react';
import { dashboardApi, type YontemAyari } from '@/api/client';
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
} from '@/components/ui/pano';

type Satir = {
  anahtar: string; entegrasyon: string; yontem: string;
  yatirim: number; yatirimAdedi: number; cekim: number; cekimAdedi: number; net: number;
  manuelYatirim?: number; manuelCekim?: number;
  duzeltilmisYatirim?: number; duzeltilmisCekim?: number; duzeltilmisNet?: number;
};
type Kalem = {
  id: string; gun: string; tur: 'yatirim' | 'cekim';
  tutar: number; aciklama: string; ekleyen: string; eklendi: string;
  yontem?: string | null;
};

/** Bugünün Türkiye ayından bir önceki ay ("YYYY-MM"). */
function oncekiAy(): string {
  const bugun = new Date();
  const parcalar = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit',
  }).formatToParts(bugun);
  const yil = Number(parcalar.find((p) => p.type === 'year')?.value);
  const ay = Number(parcalar.find((p) => p.type === 'month')?.value);
  const oncekiAy = ay === 1 ? 12 : ay - 1;
  const oncekiYil = ay === 1 ? yil - 1 : yil;
  return `${oncekiYil}-${String(oncekiAy).padStart(2, '0')}`;
}

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
  const [yontem, setYontem] = useState('');

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
    mutationFn: () => dashboardApi.mutabakatKalemEkle({ gun, tur, tutar: Number(tutar), aciklama, yontem: yontem || undefined }),
    onSuccess: () => { setTutar(''); setAciklama(''); setYontem(''); tazele(); },
  });
  const sil = useMutation({
    mutationFn: (id: string) => dashboardApi.mutabakatKalemSil(id),
    onSuccess: tazele,
  });
  const gonder = useMutation({ mutationFn: () => dashboardApi.mutabakatGonder() });
  const kapanisGonder = useMutation({ mutationFn: () => dashboardApi.mutabakatGonder(oncekiAy()) });

  // ── Yöntem ayarları (komisyon + teslimat + takviye) ──────────────────
  const [duzenlenenAnahtar, setDuzenlenenAnahtar] = useState<string | null>(null);
  const [ayarAnahtar, setAyarAnahtar] = useState('');
  const [ayarYatirimYuzde, setAyarYatirimYuzde] = useState('');
  const [ayarYatirimSabit, setAyarYatirimSabit] = useState('');
  const [ayarCekimYuzde, setAyarCekimYuzde] = useState('');
  const [ayarCekimSabit, setAyarCekimSabit] = useState('');
  const [ayarTeslimat, setAyarTeslimat] = useState('');
  const [ayarTakviyeEsigi, setAyarTakviyeEsigi] = useState('');
  const [ayarTakviyeNotu, setAyarTakviyeNotu] = useState('');
  const [ayarNot, setAyarNot] = useState('');

  const { data: ayarYaniti, isLoading: ayarYukleniyor } = useQuery({
    queryKey: ['mutabakat-yontem-ayarlari'],
    queryFn: () => dashboardApi.mutabakatYontemAyarlari(),
    staleTime: 2 * 60 * 1000,
  });
  const ayarlar: YontemAyari[] = ayarYaniti?.oranlar ?? [];

  const ayarTazele = () => queryClient.invalidateQueries({ queryKey: ['mutabakat-yontem-ayarlari'] });

  const formuSifirla = () => {
    setDuzenlenenAnahtar(null);
    setAyarAnahtar(''); setAyarYatirimYuzde(''); setAyarYatirimSabit('');
    setAyarCekimYuzde(''); setAyarCekimSabit(''); setAyarTeslimat('');
    setAyarTakviyeEsigi(''); setAyarTakviyeNotu(''); setAyarNot('');
  };

  const formuDoldur = (ayar: YontemAyari) => {
    setDuzenlenenAnahtar(ayar.anahtar);
    setAyarAnahtar(ayar.anahtar);
    setAyarYatirimYuzde(String(ayar.yatirimYuzde));
    setAyarYatirimSabit(String(ayar.yatirimSabit));
    setAyarCekimYuzde(String(ayar.cekimYuzde));
    setAyarCekimSabit(String(ayar.cekimSabit));
    setAyarTeslimat(ayar.teslimatKurali ?? '');
    setAyarTakviyeEsigi(ayar.takviyeEsigi === null ? '' : String(ayar.takviyeEsigi));
    setAyarTakviyeNotu(ayar.takviyeNotu ?? '');
    setAyarNot(ayar.not ?? '');
  };

  const ayarKaydet = useMutation({
    mutationFn: () => dashboardApi.mutabakatYontemAyariKaydet({
      anahtar: ayarAnahtar.trim(),
      yatirimYuzde: Number(ayarYatirimYuzde) || 0,
      yatirimSabit: Number(ayarYatirimSabit) || 0,
      cekimYuzde: Number(ayarCekimYuzde) || 0,
      cekimSabit: Number(ayarCekimSabit) || 0,
      teslimatKurali: ayarTeslimat.trim() || undefined,
      takviyeEsigi: ayarTakviyeEsigi.trim() === '' ? undefined : Number(ayarTakviyeEsigi),
      takviyeNotu: ayarTakviyeNotu.trim() || undefined,
      not: ayarNot.trim() || undefined,
    }),
    onSuccess: () => { formuSifirla(); ayarTazele(); },
  });
  const ayarSil = useMutation({
    mutationFn: (anahtar: string) => dashboardApi.mutabakatYontemAyariSil(anahtar),
    onSuccess: (_veri, silinenAnahtar) => {
      if (duzenlenenAnahtar === silinenAnahtar) formuSifirla();
      ayarTazele();
    },
  });

  const ayarAnahtarGecerli = ayarAnahtar.trim().length > 0;

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
          <p className="mt-1 text-[11px] text-slate-200">
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
          <div className="mb-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => gonder.mutate()}
              disabled={gonder.isPending}
              className="flex h-9 items-center gap-1.5 rounded-2xl border border-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.05] disabled:opacity-40"
            >
              <Send size={13} /> {gonder.isPending ? 'Gönderiliyor…' : "Telegram'a gönder"}
            </button>
            <button
              type="button"
              onClick={() => kapanisGonder.mutate()}
              disabled={kapanisGonder.isPending}
              title={`${oncekiAy()} kapanış raporunu gönder`}
              className="flex h-9 items-center gap-1.5 rounded-2xl border border-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.05] disabled:opacity-40"
            >
              <BookOpen size={13} /> {kapanisGonder.isPending ? 'Gönderiliyor…' : `${oncekiAy()} kapanışı gönder`}
            </button>
          </div>
        </div>
        {gonder.isError && (
          <p className="px-4 pb-3 text-[11px] text-rose-300">{(gonder.error as Error).message}</p>
        )}
        {gonder.isSuccess && (
          <p className="px-4 pb-3 text-[11px] text-emerald-300">Mutabakat gönderildi.</p>
        )}
        {kapanisGonder.isError && (
          <p className="px-4 pb-3 text-[11px] text-rose-300">{(kapanisGonder.error as Error).message}</p>
        )}
        {kapanisGonder.isSuccess && (
          <p className="px-4 pb-3 text-[11px] text-emerald-300">Kapanış raporu gönderildi.</p>
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
            {satirlar.map((satir) => {
              const duzeltildi = Boolean(satir.manuelYatirim || satir.manuelCekim);
              return (
                <PanoSatir key={satir.anahtar}>
                  <PanoHucreYazi>
                    <span className="font-semibold text-white">{satir.entegrasyon}</span>
                    <span className="ml-1.5 text-[11px] text-slate-400">{satir.yontem}</span>
                  </PanoHucreYazi>
                  <PanoHucreYazi sag renk="text-emerald-300/80">
                    {sayiYaz(satir.yatirim, 'para')}
                    {satir.manuelYatirim ? (
                      <span className="ml-1 text-[10px] text-slate-400">
                        → {sayiYaz(satir.duzeltilmisYatirim ?? satir.yatirim, 'para')}
                      </span>
                    ) : null}
                  </PanoHucreYazi>
                  <PanoHucreYazi sag>{sayiYaz(satir.yatirimAdedi)}</PanoHucreYazi>
                  <PanoHucreYazi sag renk="text-rose-300/80">
                    {sayiYaz(satir.cekim, 'para')}
                    {satir.manuelCekim ? (
                      <span className="ml-1 text-[10px] text-slate-400">
                        → {sayiYaz(satir.duzeltilmisCekim ?? satir.cekim, 'para')}
                      </span>
                    ) : null}
                  </PanoHucreYazi>
                  <PanoHucreYazi sag>{sayiYaz(satir.cekimAdedi)}</PanoHucreYazi>
                  <PanoHucreYazi sag>
                    <span className={(duzeltildi ? satir.duzeltilmisNet ?? satir.net : satir.net) >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
                      {isaretliYaz(duzeltildi ? satir.duzeltilmisNet ?? satir.net : satir.net)}
                    </span>
                    {duzeltildi ? <span className="ml-1 text-[10px] text-slate-400">✏️ düzeltildi</span> : null}
                  </PanoHucreYazi>
                </PanoSatir>
              );
            })}
          </PanoTablo>
        )}
      </PanoKart>

      <PanoKart>
        <PanoBaslik
          baslik="Yöntem ayarları"
          ipucu="Ödeme yöntemi başına komisyon oranı, teslimat kuralı ve takviye eşiği. Yalnızca bilgi/hesap amaçlı — rapordaki ham rakamları değiştirmez."
          simge={<Settings2 size={15} />}
          vurgu="hacim"
        />

        <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-3 lg:grid-cols-5">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Yöntem</span>
            <input
              type="text"
              list="mutabakat-yontem-secenekleri"
              value={ayarAnahtar}
              onChange={(e) => setAyarAnahtar(e.target.value)}
              placeholder="HemenOde · Havale"
              disabled={duzenlenenAnahtar !== null}
              className="h-9 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
            />
            <datalist id="mutabakat-yontem-secenekleri">
              {satirlar.map((satir) => <option key={satir.anahtar} value={satir.anahtar} />)}
            </datalist>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Yatırım % / sabit</span>
            <div className="flex gap-1">
              <input
                type="number" min="0" max="100" step="0.01" value={ayarYatirimYuzde}
                onChange={(e) => setAyarYatirimYuzde(e.target.value)} placeholder="%"
                className="h-9 w-16 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
              />
              <input
                type="number" min="0" step="0.01" value={ayarYatirimSabit}
                onChange={(e) => setAyarYatirimSabit(e.target.value)} placeholder="TRY"
                className="h-9 w-16 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Çekim % / sabit</span>
            <div className="flex gap-1">
              <input
                type="number" min="0" max="100" step="0.01" value={ayarCekimYuzde}
                onChange={(e) => setAyarCekimYuzde(e.target.value)} placeholder="%"
                className="h-9 w-16 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
              />
              <input
                type="number" min="0" step="0.01" value={ayarCekimSabit}
                onChange={(e) => setAyarCekimSabit(e.target.value)} placeholder="TRY"
                className="h-9 w-16 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Teslimat kuralı</span>
            <input
              type="text" value={ayarTeslimat} onChange={(e) => setAyarTeslimat(e.target.value)}
              placeholder="Örn. Her Pazartesi elden teslim, T+2…"
              className="h-9 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Takviye eşiği</span>
            <input
              type="number" min="0" step="1" value={ayarTakviyeEsigi}
              onChange={(e) => setAyarTakviyeEsigi(e.target.value)} placeholder="TRY altına düşünce"
              className="h-9 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Takviye notu</span>
            <input
              type="text" value={ayarTakviyeNotu} onChange={(e) => setAyarTakviyeNotu(e.target.value)}
              placeholder="Kimden/nasıl takviye edilir"
              className="h-9 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Not</span>
            <input
              type="text" value={ayarNot} onChange={(e) => setAyarNot(e.target.value)}
              placeholder="Serbest not"
              className="h-9 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => ayarKaydet.mutate()}
              disabled={!ayarAnahtarGecerli || ayarKaydet.isPending}
              className="h-9 rounded-xl bg-[color:var(--panel-accent,#0a84ff)] px-3 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ayarKaydet.isPending ? 'Kaydediliyor…' : duzenlenenAnahtar ? 'Güncelle' : 'Ekle'}
            </button>
            {duzenlenenAnahtar && (
              <button
                type="button"
                onClick={formuSifirla}
                className="h-9 rounded-2xl border border-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.05]"
              >
                Vazgeç
              </button>
            )}
          </div>
        </div>
        {ayarKaydet.isError && <p className="px-4 pb-3 text-[11px] text-rose-300">{(ayarKaydet.error as Error).message}</p>}

        {ayarYukleniyor && <PanoYukleniyor satir={2} />}
        {!ayarYukleniyor && ayarlar.length === 0 && <PanoBos>Henüz hiçbir yöntem için ayar tanımlanmadı.</PanoBos>}
        {!ayarYukleniyor && ayarlar.length > 0 && (
          <PanoTablo
            minGenislik={760}
            basliklar={[
              { ad: 'Yöntem' }, { ad: 'Komisyon (Y/Ç)', sag: true }, { ad: 'Teslimat' },
              { ad: 'Takviye' }, { ad: '', sag: true },
            ]}
          >
            {ayarlar.map((ayar) => (
              <PanoSatir key={ayar.anahtar}>
                <PanoHucreYazi><span className="font-semibold text-white">{ayar.anahtar}</span></PanoHucreYazi>
                <PanoHucreYazi sag>
                  <span className="tabular-nums text-[11px]">
                    %{ayar.yatirimYuzde}{ayar.yatirimSabit ? ` +${sayiYaz(ayar.yatirimSabit, 'para')}` : ''}
                    {' / '}
                    %{ayar.cekimYuzde}{ayar.cekimSabit ? ` +${sayiYaz(ayar.cekimSabit, 'para')}` : ''}
                  </span>
                </PanoHucreYazi>
                <PanoHucreYazi><span className="text-[11px]">{ayar.teslimatKurali || '—'}</span></PanoHucreYazi>
                <PanoHucreYazi>
                  <span className="text-[11px]">
                    {ayar.takviyeEsigi === null ? '—' : `< ${sayiYaz(ayar.takviyeEsigi, 'para')}`}
                    {ayar.takviyeNotu ? ` · ${ayar.takviyeNotu}` : ''}
                  </span>
                </PanoHucreYazi>
                <PanoHucreYazi sag>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => formuDoldur(ayar)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-white"
                      title="Düzenle"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => ayarSil.mutate(ayar.anahtar)}
                      disabled={ayarSil.isPending}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                      title="Sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
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
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Gün</span>
            <input
              type="date"
              value={gun}
              onChange={(e) => setGun(e.target.value)}
              className="h-9 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Tür</span>
            <select
              value={tur}
              onChange={(e) => setTur(e.target.value as 'yatirim' | 'cekim')}
              className="h-9 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
            >
              <option value="yatirim">Yatırım</option>
              <option value="cekim">Çekim</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Yöntem</span>
            <select
              value={yontem}
              onChange={(e) => setYontem(e.target.value)}
              title="Belirli bir sağlayıcıya bağla; boş bırakılırsa genel kalem sayılır"
              className="h-9 min-w-[160px] rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
            >
              <option value="">Genel (yönteme özel değil)</option>
              {satirlar.map((satir) => (
                <option key={satir.anahtar} value={satir.anahtar}>{satir.anahtar}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Tutar</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={tutar}
              onChange={(e) => setTutar(e.target.value)}
              placeholder="0"
              className="h-9 w-28 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white focus:outline-none"
            />
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Açıklama</span>
            <input
              type="text"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Elden havale, iade…"
              className="h-9 rounded-2xl border border-white/5 bg-[#0c1119] px-2 text-xs text-white placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => ekle.mutate()}
            disabled={!tutarGecerli || ekle.isPending}
            className="h-9 rounded-xl bg-[color:var(--panel-accent,#0a84ff)] px-3 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ekle.isPending ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </div>
        {ekle.isError && <p className="px-4 pb-3 text-[11px] text-rose-300">{(ekle.error as Error).message}</p>}

        {kalemler.length === 0 ? (
          <PanoBos>Bu ayda elle eklenmiş kalem yok.</PanoBos>
        ) : (
          <PanoTablo
            minGenislik={720}
            basliklar={[{ ad: 'Gün' }, { ad: 'Tür' }, { ad: 'Yöntem' }, { ad: 'Tutar', sag: true }, { ad: 'Açıklama' }, { ad: 'Ekleyen' }, { ad: '', sag: true }]}
          >
            {kalemler.map((kalem) => (
              <PanoSatir key={kalem.id}>
                <PanoHucreYazi><span className="tabular-nums text-[11px]">{kalem.gun}</span></PanoHucreYazi>
                <PanoHucreYazi>
                  <span className={kalem.tur === 'yatirim' ? 'text-emerald-300' : 'text-rose-300'}>
                    {kalem.tur === 'yatirim' ? 'Yatırım' : 'Çekim'}
                  </span>
                </PanoHucreYazi>
                <PanoHucreYazi><span className="text-[11px] text-slate-400">{kalem.yontem || 'Genel'}</span></PanoHucreYazi>
                <PanoHucreYazi sag>{sayiYaz(kalem.tutar, 'para')}</PanoHucreYazi>
                <PanoHucreYazi><span className="text-[11px]">{kalem.aciklama || '—'}</span></PanoHucreYazi>
                <PanoHucreYazi><span className="text-[11px]">{kalem.ekleyen}</span></PanoHucreYazi>
                <PanoHucreYazi sag>
                  <button
                    type="button"
                    onClick={() => sil.mutate(kalem.id)}
                    disabled={sil.isPending}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
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
