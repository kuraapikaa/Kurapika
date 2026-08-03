/**
 * Otomatik oyuncu kategorileme.
 *
 * Seviye eşikleri panelde değil, sitenin kendi kategori açıklamalarında
 * yazıyor ("El Patrón (Seviye 5)" → "[500.000 TL ve üzeri]"). Sunucu bu
 * açıklamaları okuyup her oyuncunun toplam yatırımına göre hedef
 * seviyesini hesaplıyor; risk ve durgunluk kararın UYGULANIP
 * uygulanmayacağını belirliyor.
 *
 * Kritik riskli oyuncular `bekletme` ile işaretlenir ve "tümünü uygula"
 * onlara dokunmaz — çoklu hesap incelemesi bitmeden VIP rozeti verip
 * sonra geri almak, verilmemesinden kötüdür.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Layers, RefreshCw, ShieldAlert } from 'lucide-react';
import { dashboardApi } from '../api/client';
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

type Oneri = {
  playerId: number;
  login: string;
  mevcutKategoriId: number | null;
  hedefKategoriId: number;
  hedefKategoriAdi: string;
  toplamYatirim: number | null;
  risk: 'DÜŞÜK' | 'ORTA' | 'KRİTİK';
  durgunGun: number | null;
  gerekce: string;
  bekletme: string | null;
};

type Seviye = {
  id: number;
  ad: string;
  seviyeNo: number | null;
  esik: { min: number | null; max: number | null; belirsiz: boolean } | null;
  varsayilanMi: boolean;
};

const RISK_SINIFI: Record<Oneri['risk'], string> = {
  'DÜŞÜK': 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300',
  'ORTA': 'border-amber-400/25 bg-amber-400/[0.08] text-amber-300',
  'KRİTİK': 'border-rose-400/35 bg-rose-400/[0.12] text-rose-300',
};

/**
 * Eşik metni.
 *
 * Varsayılan kategorinin eşiği YOKTUR ve bu bir hata değil — hiçbir
 * banda girmeyenlerin yeri orası. "Eşik okunamadı" yazmak varsayılan
 * kategoriyi bozukmuş gibi gösterirdi.
 */
function esikYaz(seviye: Seviye): string {
  const esik = seviye.esik;
  if (!esik) return seviye.varsayilanMi ? 'varsayılan (bant dışı)' : 'eşik okunamadı';
  const bicim = (n: number) => n.toLocaleString('tr-TR');
  if (esik.min !== null && esik.max !== null) return `${bicim(esik.min)} – ${bicim(esik.max)} ₺`;
  if (esik.min !== null) return `${bicim(esik.min)} ₺ ve üzeri`;
  if (esik.max !== null) return `${bicim(esik.max)} ₺ altı`;
  return 'eşik okunamadı';
}

export function OyuncuKategorileme() {
  const queryClient = useQueryClient();
  const [arama, setArama] = useState('');
  const [uygulanan, setUygulanan] = useState<Record<number, 'ok' | string>>({});

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['oyuncu-kategorileme'],
    queryFn: () => dashboardApi.kategoriOnerileri({ MaxRows: 500 }),
    staleTime: 5 * 60 * 1000,
  });

  const veri = data?.Data ?? {};
  const oneriler: Oneri[] = veri.Oneriler ?? [];
  const merdiven: Seviye[] = veri.Merdiven ?? [];
  const esiksiz: string[] = veri.EsiksizKategoriler ?? [];
  const bosluklar: Array<{ min: number; max: number | null }> = veri.Bosluklar ?? [];
  const varsayilan: Seviye | null = veri.VarsayilanKategori ?? null;
  const eksikDavranis: string[] = veri.EksikDavranisKategorileri ?? [];
  const davranisTanimlari: Array<{ kimlik: string; ad: string; aciklama: string; renk: string; otomatik: boolean }> =
    veri.DavranisTanimlari ?? [];
  const bonusOlculdu: boolean = veri.BonusOlculdu !== false;

  const suzulmus = useMemo(
    () => oneriler.filter((o) => matchesAnyTr([String(o.playerId), o.login, o.hedefKategoriAdi], arama)),
    [oneriler, arama],
  );

  const kategorileriOlustur = useMutation({
    mutationFn: () => dashboardApi.davranisKategorileriniOlustur(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oyuncu-kategorileme'] }),
  });

  const uygula = useMutation({
    mutationFn: (oneri: Oneri) => dashboardApi.kategoriUygula(oneri.playerId, oneri.hedefKategoriId),
    onSuccess: (_sonuc, oneri) => setUygulanan((s) => ({ ...s, [oneri.playerId]: 'ok' })),
    onError: (err: Error, oneri) => setUygulanan((s) => ({ ...s, [oneri.playerId]: err.message })),
  });

  /**
   * Toplu uygulama BEKLETİLENLERİ ATLAR.
   *
   * Sıralı çalışır: yüzlerce eşzamanlı yazma isteği hem uca yüklenir hem
   * de bir hatayı diğerlerinin arasında kaybeder.
   */
  const [topluCalisiyor, setTopluCalisiyor] = useState(false);
  const uygulanabilir = suzulmus.filter((o) => !o.bekletme && uygulanan[o.playerId] !== 'ok');

  const topluUygula = async () => {
    setTopluCalisiyor(true);
    try {
      for (const oneri of uygulanabilir) {
        try {
          await dashboardApi.kategoriUygula(oneri.playerId, oneri.hedefKategoriId);
          setUygulanan((s) => ({ ...s, [oneri.playerId]: 'ok' }));
        } catch (err) {
          setUygulanan((s) => ({ ...s, [oneri.playerId]: (err as Error).message }));
        }
      }
    } finally {
      setTopluCalisiyor(false);
      queryClient.invalidateQueries({ queryKey: ['oyuncu-kategorileme'] });
    }
  };

  if (error) {
    return (
      <PanoKart vurgu="cikis">
        <PanoBaslik baslik="Otomatik kategorileme" vurgu="cikis" simge={<Layers size={15} />} />
        <PanoHata mesaj={(error as Error).message} />
      </PanoKart>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PanoOlcu
          etiket="Öneri"
          deger={sayiYaz(isLoading ? null : oneriler.length)}
          alt="Kategorisi değişmesi gereken oyuncu"
          simge={<Layers size={16} />}
          vurgu="oyuncu"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Otomatik Uygulanabilir"
          deger={sayiYaz(isLoading ? null : veri.Uygulanabilir ?? null)}
          alt="Bekletme sebebi olmayanlar"
          simge={<Check size={16} />}
          vurgu="giris"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Bekletilen"
          deger={sayiYaz(isLoading ? null : oneriler.filter((o) => o.bekletme).length)}
          alt="Manuel inceleme gerekiyor"
          simge={<ShieldAlert size={16} />}
          vurgu="cikis"
          veriYok={isLoading}
        />
        <PanoOlcu
          etiket="Taranan Oyuncu"
          deger={sayiYaz(isLoading ? null : veri.TarananOyuncu ?? null, 'oyuncu')}
          alt={`${veri.RiskOlculen ?? 0} oyuncuda çoklu hesap ölçüldü`}
          simge={<RefreshCw size={16} />}
          vurgu="hacim"
          veriYok={isLoading}
        />
      </div>

      {/*
        * MERDİVEN BOŞLUĞU.
        *
        * Sitede gerçek bir boşluk var: bantlar 10.000 TL'den başlıyor,
        * 0 – 9.999 arası hiçbir seviyeye girmiyor. Varsayılan kategori
        * ("Yeni Oyuncu") bunu kapatıyor ama boşluğun kendisi görünmeli —
        * bilerek mi bırakıldı, yoksa bir bant tanımlanmayı mı unutuldu?
        */}
      {(bosluklar.length > 0 || esiksiz.length > 0) && (
        <PanoKart className="space-y-1.5 px-4 py-3">
          {bosluklar.map((bosluk) => (
            <p key={`${bosluk.min}-${bosluk.max}`} className="text-[11px] text-amber-400/90">
              {bosluk.min.toLocaleString('tr-TR')} –{' '}
              {bosluk.max === null ? '∞' : bosluk.max.toLocaleString('tr-TR')} ₺ arası hiçbir seviye bandına
              girmiyor.{' '}
              {varsayilan
                ? `Bu oyuncular varsayılan kategoriye ("${varsayilan.ad}") yönlendiriliyor.`
                : 'Varsayılan kategori de tanımlı değil; bu oyuncular için öneri üretilemiyor.'}
            </p>
          ))}
          {esiksiz.length > 0 && (
            <p className="text-[11px] text-[color:var(--panel-muted,#8a919c)]">
              Eşiği okunamayan kategoriler bant olarak kullanılmaz: {esiksiz.join(', ')}. Bant olmasını
              istiyorsanız Lynon'daki açıklamayı "[100.000 TL - 249.999 TL]" biçimine getirin.
            </p>
          )}
        </PanoKart>
      )}

      {/*
        * DAVRANIŞ KATEGORİLERİ.
        *
        * Lynon'da oyuncu başına TEK kategori alanı var; davranış
        * etiketleri değer merdiveniyle aynı slotu paylaşıyor. Bu yüzden
        * hepsi otomatik atanmaz: "Aktif Üye" neredeyse her canlı
        * oyuncuya uyar ve atanırsa merdiveni tamamen siler. Dördü de
        * oluşturulur (elle atama ve CRM filtresi için), otomatik atanan
        * yalnızca istisna etiketleridir.
        */}
      {davranisTanimlari.length > 0 && (
        <PanoKart>
          <PanoBaslik
            baslik="Davranış etiketleri"
            ipucu="Lynon'da oyuncu başına tek kategori var; bu etiketler değer merdiveniyle aynı alanı paylaşır."
            simge={<ShieldAlert size={15} />}
            vurgu="maliyet"
          />
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
            {davranisTanimlari.map((tanim) => (
              <span
                key={tanim.kimlik}
                title={`${tanim.aciklama}\n${tanim.otomatik ? 'Otomatik atanır.' : 'Yalnızca elle atanır.'}`}
                className="flex cursor-help items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                style={{ borderColor: `${tanim.renk}55`, backgroundColor: `${tanim.renk}18`, color: tanim.renk }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tanim.renk }} />
                {tanim.ad}
                <span className="opacity-60">{tanim.otomatik ? 'otomatik' : 'elle'}</span>
                {eksikDavranis.includes(tanim.ad) && <span className="text-rose-300">· yok</span>}
              </span>
            ))}
          </div>
          {eksikDavranis.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
              <p className="text-[11px] text-amber-400/90">
                {eksikDavranis.length} kategori sitede yok: {eksikDavranis.join(', ')}. Oluşturulmadan bu
                etiketler hiçbir oyuncuya atanamaz.
              </p>
              <button
                type="button"
                onClick={() => kategorileriOlustur.mutate()}
                disabled={kategorileriOlustur.isPending}
                className="h-9 shrink-0 rounded-lg bg-[color:var(--panel-accent,#0a84ff)] px-3 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
              >
                {kategorileriOlustur.isPending ? 'Oluşturuluyor…' : 'Eksik kategorileri oluştur'}
              </button>
            </div>
          )}
          {kategorileriOlustur.isError && (
            <p className="px-4 pb-3 text-[11px] text-rose-300">
              {(kategorileriOlustur.error as Error).message}
            </p>
          )}
          {!bonusOlculdu && (
            <p className="px-4 pb-3 text-[11px] text-amber-400/90">
              Bonus geçmişi okunamadı; "Bonus Avcısı" kuralı bu turda hiç çalışmadı.
            </p>
          )}
        </PanoKart>
      )}

      {merdiven.length > 0 && (
        <PanoKart>
          <PanoBaslik
            baslik="Seviye merdiveni"
            ipucu="Eşikler Lynon'daki kategori açıklamalarından okunur; panelde sabit değildir."
            simge={<Layers size={15} />}
            vurgu="oyuncu"
          />
          <PanoTablo basliklar={[{ ad: 'Kategori' }, { ad: 'Seviye', sag: true }, { ad: 'Eşik', sag: true }]}>
            {merdiven.map((seviye) => (
              <PanoSatir key={seviye.id}>
                <PanoHucreYazi>
                  <span className="font-semibold text-white">{seviye.ad}</span>
                </PanoHucreYazi>
                <PanoHucreYazi sag>{seviye.seviyeNo ?? '—'}</PanoHucreYazi>
                <PanoHucreYazi sag renk={seviye.esik || seviye.varsayilanMi ? undefined : 'text-amber-300'}>
                  {esikYaz(seviye)}
                </PanoHucreYazi>
              </PanoSatir>
            ))}
          </PanoTablo>
        </PanoKart>
      )}

      <PanoKart>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <PanoBaslik baslik="Kategori önerileri" simge={<Layers size={15} />} vurgu="oyuncu" />
          <div className="flex items-center gap-2 pb-3.5">
            <input
              type="text"
              placeholder="Oyuncu veya kategori…"
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              className="h-9 w-full rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] px-3 text-xs text-white placeholder:text-[color:var(--panel-muted,#8a919c)] focus:border-[color:var(--panel-accent,#0a84ff)] focus:outline-none sm:w-56"
            />
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-3 text-xs font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] hover:bg-white/[0.05] disabled:opacity-50"
            >
              Yenile
            </button>
            <button
              type="button"
              onClick={topluUygula}
              disabled={topluCalisiyor || uygulanabilir.length === 0}
              className="h-9 rounded-lg bg-[color:var(--panel-accent,#0a84ff)] px-3 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {topluCalisiyor ? 'Uygulanıyor…' : `Uygulanabilir ${uygulanabilir.length} öneriyi uygula`}
            </button>
          </div>
        </div>

        {isLoading && <PanoYukleniyor satir={8} />}
        {!isLoading && suzulmus.length === 0 && (
          <PanoBos>Kategorisi değişmesi gereken oyuncu yok.</PanoBos>
        )}

        {!isLoading && suzulmus.length > 0 && (
          <PanoTablo
            minGenislik={900}
            basliklar={[
              { ad: 'Oyuncu' },
              { ad: 'Yatırım', sag: true },
              { ad: 'Hedef kategori' },
              { ad: 'Risk' },
              { ad: 'Gerekçe' },
              { ad: '', sag: true },
            ]}
          >
            {suzulmus.map((oneri) => {
              const durum = uygulanan[oneri.playerId];
              return (
                <PanoSatir key={oneri.playerId}>
                  <PanoHucreYazi>
                    <span className="flex flex-col">
                      <span className="font-semibold text-white">{oneri.login || '(ad yok)'}</span>
                      <span className="text-[10px] text-[color:var(--panel-muted,#8a919c)]">{oneri.playerId}</span>
                    </span>
                  </PanoHucreYazi>
                  <PanoHucreYazi sag>{sayiYaz(oneri.toplamYatirim, 'para')}</PanoHucreYazi>
                  <PanoHucreYazi>
                    <span className="font-semibold text-violet-300">{oneri.hedefKategoriAdi}</span>
                    {oneri.mevcutKategoriId !== null && (
                      <span className="ml-2 text-[10px] text-[color:var(--panel-muted,#8a919c)]">
                        şu an #{oneri.mevcutKategoriId}
                      </span>
                    )}
                  </PanoHucreYazi>
                  <PanoHucreYazi>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${RISK_SINIFI[oneri.risk]}`}>
                      {oneri.risk}
                    </span>
                  </PanoHucreYazi>
                  <PanoHucreYazi>
                    <span className="flex flex-col">
                      <span className="text-[11px]">{oneri.gerekce}</span>
                      {oneri.bekletme && (
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-rose-300">
                          <AlertTriangle size={11} /> {oneri.bekletme}
                        </span>
                      )}
                    </span>
                  </PanoHucreYazi>
                  <PanoHucreYazi sag>
                    {durum === 'ok' ? (
                      <span className="text-[11px] font-semibold text-emerald-300">Uygulandı</span>
                    ) : (
                      <span className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => uygula.mutate(oneri)}
                          disabled={uygula.isPending}
                          className="rounded-md border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          Uygula
                        </button>
                        {durum && durum !== 'ok' && (
                          <span className="max-w-[180px] text-right text-[10px] text-rose-300">{durum}</span>
                        )}
                      </span>
                    )}
                  </PanoHucreYazi>
                </PanoSatir>
              );
            })}
          </PanoTablo>
        )}
      </PanoKart>
    </div>
  );
}
