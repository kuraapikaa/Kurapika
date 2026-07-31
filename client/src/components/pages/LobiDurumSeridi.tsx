import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ListChecks, Trophy } from 'lucide-react';
import { gamesApi } from '../../api/client';

/**
 * Lobide oyuncunun KENDI durumu: turnuva sirasi ve gunluk gorev ilerlemesi.
 *
 * Lobi turnuvayi ve gorevleri yalnizca birer bag olarak gosteriyordu;
 * oyuncu kacinci oldugunu ya da bugun ne kadar ilerledigini gormek icin
 * sayfalari tek tek acmak zorundaydi.
 *
 * Sira icin ayri bir uc kullaniliyor: siralama tablosu yalnizca ilk N
 * oyuncuyu donuyor, 200. siradaki oyuncu kendi sirasini oradan ogrenemezdi.
 */

type SiraVerisi = { sira: number | null; deger: number; katilimci: number; ustFark: number };

const tl = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} ₺`;

export function LobiDurumSeridi({ username }: { username: string }) {
  const [sira, setSira] = useState<SiraVerisi | null>(null);
  const [gorevler, setGorevler] = useState<any[] | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    if (!username) return;
    let iptal = false;

    const getir = async () => {
      const [siraSonuc, gorevSonuc] = await Promise.allSettled([
        gamesApi.tournamentMyRank('gunluk'),
        gamesApi.dailyTasksStatus(),
      ]);
      if (iptal) return;

      if (siraSonuc.status === 'fulfilled' && siraSonuc.value?.ok) {
        setSira(siraSonuc.value.data);
      }
      if (gorevSonuc.status === 'fulfilled' && gorevSonuc.value?.ok) {
        const liste = gorevSonuc.value.data?.tasks;
        setGorevler(Array.isArray(liste) ? liste : []);
      }
      setYukleniyor(false);
    };

    getir();
    // Gorev ilerlemesi oyuncu oynadikca degisiyor; lobide acik kalan
    // sekmenin bayatlamamasi icin periyodik tazeleme.
    const zamanlayici = setInterval(getir, 60_000);
    return () => {
      iptal = true;
      clearInterval(zamanlayici);
    };
  }, [username]);

  if (yukleniyor) return null;

  const tamamlanan = (gorevler ?? []).filter((g: any) => g.completed).length;
  const toplamGorev = (gorevler ?? []).length;
  const alinabilir = (gorevler ?? []).filter((g: any) => g.completed && !g.claimed).length;

  // Ikisi de yoksa serit hic cikmasin; bos kart lobide gurultu.
  if (!sira && toplamGorev === 0) return null;

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {sira && (
        <Link
          to="/turnuva/gunluk"
          className="group flex items-center gap-3.5 rounded-2xl border border-[rgba(243,236,221,0.08)] bg-[rgba(243,236,221,0.02)] p-4 transition-colors hover:border-[color:var(--lobby-gold,#e7c574)]/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--lobby-gold,#e7c574)]/10 text-[color:var(--lobby-gold,#e7c574)]">
            <Trophy size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--lobby-muted,#8f8674)]">
              Günlük turnuva
            </span>
            {sira.sira === null ? (
              <>
                <span className="mt-0.5 block text-[15px] font-black text-[color:var(--lobby-text,#f3ecdd)]">
                  Henüz sıralamada değilsin
                </span>
                <span className="block text-[11px] font-medium text-[color:var(--lobby-muted,#8f8674)]">
                  Bugün bahis yap, listeye gir
                </span>
              </>
            ) : (
              <>
                <span className="mt-0.5 block text-[15px] font-black tabular-nums text-[color:var(--lobby-text,#f3ecdd)]">
                  {sira.sira}. sıra
                  <span className="ml-1.5 text-[11px] font-bold text-[color:var(--lobby-muted,#8f8674)]">
                    / {sira.katilimci}
                  </span>
                </span>
                <span className="block text-[11px] font-medium tabular-nums text-[color:var(--lobby-muted,#8f8674)]">
                  {tl(sira.deger)} bahis
                  {sira.ustFark > 0 && ` · üst sıraya ${tl(sira.ustFark)}`}
                </span>
              </>
            )}
          </span>
          <ChevronRight size={16} className="shrink-0 text-[color:var(--lobby-muted,#8f8674)] transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {toplamGorev > 0 && (
        <Link
          to="/gorevler"
          className="group flex items-center gap-3.5 rounded-2xl border border-[rgba(243,236,221,0.08)] bg-[rgba(243,236,221,0.02)] p-4 transition-colors hover:border-[color:var(--lobby-gold,#e7c574)]/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--lobby-gold,#e7c574)]/10 text-[color:var(--lobby-gold,#e7c574)]">
            {alinabilir > 0 ? <CheckCircle2 size={19} /> : <ListChecks size={19} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--lobby-muted,#8f8674)]">
              Günlük görevler
            </span>
            <span className="mt-0.5 block text-[15px] font-black tabular-nums text-[color:var(--lobby-text,#f3ecdd)]">
              {tamamlanan} / {toplamGorev} tamamlandı
            </span>
            <span className="block text-[11px] font-medium text-[color:var(--lobby-muted,#8f8674)]">
              {alinabilir > 0 ? `${alinabilir} ödül seni bekliyor` : 'Ödül için görevleri bitir'}
            </span>
          </span>
          {/* Alinacak odul varsa dikkat cekmeli; yoksa sessiz kalmali. */}
          {alinabilir > 0 && (
            <span className="shrink-0 rounded-full bg-[color:var(--lobby-gold,#e7c574)] px-2 py-0.5 text-[10px] font-black tabular-nums text-[#0e0c09]">
              {alinabilir}
            </span>
          )}
          <ChevronRight size={16} className="shrink-0 text-[color:var(--lobby-muted,#8f8674)] transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {/* Ilerleme cubugu: iki kartin altinda tek satir. */}
      {toplamGorev > 0 && (
        <div className="sm:col-span-2">
          <div className="h-1 overflow-hidden rounded-full bg-[rgba(243,236,221,0.06)]">
            <div
              className="h-full rounded-full bg-[color:var(--lobby-gold,#e7c574)] transition-[width] duration-500"
              style={{ width: `${Math.min(100, (tamamlanan / toplamGorev) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
