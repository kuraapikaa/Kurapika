import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  Coins,
  Handshake,
  LogOut,
  Percent,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { affiliatePortalApi } from '../../api/client';
import { formatNumber } from '../../lib/format';

/**
 * Affiliate ortak portali.
 *
 * Ortak yalnizca KENDI BTag'ini gorur; filtreleme sunucuda yapiliyor
 * (routes/affiliate.ts). Bu bilesen tum BTag listesine hicbir zaman
 * erisemez — istemci tarafi filtre, tum kanallarin verisini tele koymak
 * demekti.
 */

const MODEL_ADI: Record<string, string> = {
  revshare: 'Gelir Paylaşımı',
  cpa: 'Oyuncu Başına (CPA)',
  hibrit: 'Hibrit',
};

function tl(deger: number): string {
  return `${formatNumber(Math.round(deger))} ₺`;
}

function AffiliateGiris({ onBasarili }: { onBasarili: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hata, setHata] = useState('');

  const giris = useMutation({
    mutationFn: () => affiliatePortalApi.login({ email: email.trim(), password }),
    onSuccess: (sonuc) => {
      if (sonuc.ok) {
        setPassword('');
        onBasarili();
      } else {
        setHata(sonuc.message || 'Giriş yapılamadı.');
      }
    },
    onError: (err: Error) => setHata(err.message || 'Bağlantı hatası.'),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0b0f] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-2xl bg-amber-400/10 p-3 text-amber-300">
            <Handshake size={26} />
          </div>
          <h1 className="text-2xl font-semibold text-white">Ortak Paneli</h1>
          <p className="mt-2 text-sm text-white/50">
            Performansınızı ve hakedişinizi görüntülemek için giriş yapın.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setHata('');
            giris.mutate();
          }}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="space-y-2">
            <label htmlFor="affiliate-email" className="block text-[10px] font-semibold uppercase tracking-widest text-white/50">
              E-posta
            </label>
            <input
              id="affiliate-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none focus:border-amber-400/50"
              placeholder="ortak@example.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="affiliate-password" className="block text-[10px] font-semibold uppercase tracking-widest text-white/50">
              Parola
            </label>
            <input
              id="affiliate-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none focus:border-amber-400/50"
              placeholder="••••••••"
            />
          </div>

          {hata && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
              <AlertCircle size={14} /> {hata}
            </p>
          )}

          <button
            type="submit"
            disabled={giris.isPending || !email.trim() || !password}
            className="h-12 w-full rounded-xl bg-amber-400 text-sm font-bold text-black transition-opacity disabled:opacity-40"
          >
            {giris.isPending ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>

          <p className="pt-2 text-center text-xs text-white/40">
            Henüz ortak değil misiniz?{' '}
            <a href="/ortaklik" className="font-semibold text-amber-300 hover:underline">
              Başvuru yapın
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

function OzetPanosu({ onCikis }: { onCikis: () => void }) {
  const ozetQuery = useQuery({
    queryKey: ['affiliate-portal-ozet'],
    queryFn: () => affiliatePortalApi.ozet(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (ozetQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0f] text-sm text-white/50">
        Performans verileriniz hazırlanıyor...
      </div>
    );
  }

  if (ozetQuery.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0b0f] px-4 text-center">
        <AlertCircle className="text-rose-400" size={32} />
        <p className="text-sm text-rose-300">{(ozetQuery.error as Error).message}</p>
        <button type="button" onClick={onCikis} className="text-xs text-white/50 underline">
          Çıkış yap
        </button>
      </div>
    );
  }

  const veri = ozetQuery.data;
  if (!veri?.ok) return null;

  const { ortak, toplam, komisyon, satirlar, aralik } = veri;
  const satir = satirlar[0];

  const kartlar = [
    { etiket: 'Toplam oyuncu', deger: formatNumber(toplam.oyuncu), ikon: Users, renk: 'text-cyan-300' },
    { etiket: 'Aktif oyuncu', deger: formatNumber(toplam.aktifOyuncu), ikon: TrendingUp, renk: 'text-emerald-300' },
    { etiket: 'Toplam yatırım', deger: tl(toplam.yatirim), ikon: Wallet, renk: 'text-amber-300' },
    { etiket: 'Net gelir', deger: tl(toplam.netGelir), ikon: BarChart3, renk: 'text-blue-300' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0b0f] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-300/70">Ortak paneli</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">{ortak.ad}</h1>
            <p className="mt-1 text-xs text-white/50">
              BTag <span className="font-mono text-white/80">{ortak.bTag}</span> ·{' '}
              {aralik.startDate} – {aralik.endDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onCikis}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs text-white/60 hover:text-white"
          >
            <LogOut size={14} /> Çıkış
          </button>
        </header>

        {/* Hakedis en ustte: ortagin ilk baktigi sayi bu. */}
        <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 to-transparent p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/80">
                <Coins size={13} /> Dönem hakedişi
              </div>
              <div className="mt-2 text-4xl font-semibold tabular-nums text-white">{tl(komisyon.toplam)}</div>
              <p className="mt-2 text-xs text-white/50">{komisyon.aciklama}</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Komisyon modeli</div>
              <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Percent size={14} />
                {MODEL_ADI[ortak.komisyonModeli] ?? ortak.komisyonModeli}
              </div>
              <div className="mt-1 text-xs text-white/40">
                {ortak.komisyonModeli !== 'cpa' && `Gelir payı %${ortak.revsharePayi}`}
                {ortak.komisyonModeli === 'hibrit' && ' · '}
                {ortak.komisyonModeli !== 'revshare' && `CPA ${tl(ortak.cpaTutari)}`}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kartlar.map((kart) => (
            <div key={kart.etiket} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className={`mb-3 inline-flex rounded-lg bg-white/[0.04] p-2 ${kart.renk}`}>
                <kart.ikon size={16} />
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">{kart.etiket}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-white">{kart.deger}</div>
            </div>
          ))}
        </div>

        {satir ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-bold text-white">Dönem ayrıntısı</h2>
            </div>
            <dl className="divide-y divide-white/5 text-sm">
              {[
                ['Dönüşüm oranı', `%${formatNumber(Math.round(toplam.ortalamaDonusum))}`],
                ['Toplam çekim', tl(toplam.cekim)],
                ['Net pozisyon (yatırım − çekim)', tl(toplam.netPozisyon)],
                ['Aktif oyuncu başına gelir', tl(satir.oyuncuBasiGelir)],
                ['Aktif oyuncu başına yatırım', tl(satir.oyuncuBasiYatirim)],
              ].map(([etiket, deger]) => (
                <div key={etiket} className="flex items-center justify-between px-5 py-3.5">
                  <dt className="text-white/50">{etiket}</dt>
                  <dd className="font-semibold tabular-nums text-white">{deger}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-white/50">
            Bu dönem için BTag <span className="font-mono text-white/70">{ortak.bTag}</span> altında kayıtlı trafik
            bulunmuyor.
          </div>
        )}

        <p className="pb-4 text-center text-[11px] leading-relaxed text-white/30">
          Rakamlar Lynon raporlarından hesaplanır ve gün içinde güncellenir. Hakediş, dönem kapanışında ödeme
          ekibi tarafından teyit edilir.
        </p>
      </div>
    </div>
  );
}

export function AffiliatePortal() {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['affiliate-portal-me'],
    queryFn: () => affiliatePortalApi.me(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const cikis = useMutation({
    mutationFn: () => affiliatePortalApi.logout(),
    // Oturum kapaninca onbellekteki ortak verisi de gitmeli: aksi halde
    // ayni tarayicida giris yapan ikinci ortak oncekinin sayilarini gorur.
    onSettled: () => queryClient.clear(),
  });

  if (meQuery.isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0b0b0f] text-sm text-white/50">Yükleniyor...</div>;
  }

  if (!meQuery.data?.ok) {
    return <AffiliateGiris onBasarili={() => queryClient.invalidateQueries({ queryKey: ['affiliate-portal-me'] })} />;
  }

  return <OzetPanosu onCikis={() => cikis.mutate()} />;
}
