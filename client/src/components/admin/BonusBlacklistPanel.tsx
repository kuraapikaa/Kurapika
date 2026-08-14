import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Loader2, ShieldOff, Trash2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { adminApi } from '../../api/client';

/**
 * Oyuncuyu bonus taleplerinden men etme paneli.
 *
 * Hesap kilitlemekten farklı: oyuncu siteyi normal kullanmaya devam
 * eder, yalnızca bonus/çark/kazı-kazan taleplerinden dışlanır. Sunucu
 * tarafı kontrolü `/admin/bonus/check-player` içinde — bu panel yalnızca
 * listeyi yönetiyor.
 */
export function BonusBlacklistPanel() {
  const queryClient = useQueryClient();
  const [login, setLogin] = useState('');
  const [neden, setNeden] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bonus-blacklist'],
    queryFn: () => adminApi.bonusBlacklist(),
    staleTime: 30 * 1000,
  });

  const kayitlar = data?.Data ?? [];

  const ekleMutation = useMutation({
    mutationFn: () => adminApi.bonusBlacklistEkle(login.trim(), neden.trim() || undefined),
    onSuccess: () => {
      toast.success(`${login.trim()} bonus taleplerinden men edildi.`);
      setLogin('');
      setNeden('');
      queryClient.invalidateQueries({ queryKey: ['bonus-blacklist'] });
    },
    onError: () => toast.error('İşlem tamamlanamadı.'),
  });

  const cikarMutation = useMutation({
    mutationFn: (hedefLogin: string) => adminApi.bonusBlacklistCikar(hedefLogin),
    onSuccess: (_res, hedefLogin) => {
      toast.success(`${hedefLogin} men listesinden çıkarıldı.`);
      queryClient.invalidateQueries({ queryKey: ['bonus-blacklist'] });
    },
    onError: () => toast.error('İşlem tamamlanamadı.'),
  });

  return (
    <Card className="p-8 border-white/5 bg-white/[0.02] shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-rose-500 to-transparent opacity-20" />
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
          <ShieldOff size={18} />
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white">Bonus Men Listesi</h4>
          <p className="mt-0.5 text-[10px] font-medium text-slate-400">
            Men edilen oyuncu bonus/çark/kazı-kazan talep edemez.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (login.trim()) ekleMutation.mutate();
        }}
        className="mb-6 space-y-3"
      >
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Kullanıcı adı"
          className="h-10 w-full rounded-2xl border border-white/5 bg-black/20 px-3 text-xs font-bold text-white outline-none focus:border-rose-500/40"
        />
        <input
          type="text"
          value={neden}
          onChange={(e) => setNeden(e.target.value)}
          placeholder="Gerekçe (opsiyonel)"
          className="h-10 w-full rounded-2xl border border-white/5 bg-black/20 px-3 text-xs font-medium text-slate-200 outline-none focus:border-rose-500/40"
        />
        <Button
          type="submit"
          disabled={!login.trim() || ekleMutation.isPending}
          className="h-10 w-full justify-center gap-2 rounded-xl bg-rose-600 text-xs font-bold uppercase tracking-widest text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {ekleMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
          Men Et
        </Button>
      </form>

      <div className="space-y-2 border-t border-white/5 pt-4">
        {isLoading && <p className="text-[10px] font-medium text-slate-400">Yükleniyor…</p>}
        {!isLoading && kayitlar.length === 0 && (
          <p className="text-[10px] font-medium text-slate-400">Men edilmiş oyuncu yok.</p>
        )}
        {kayitlar.map((kayit) => (
          <div
            key={kayit.login}
            className="flex items-start justify-between gap-2 rounded-2xl border border-white/5 bg-black/20 p-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{kayit.login}</p>
              {kayit.neden && <p className="mt-0.5 text-[10px] text-slate-400">{kayit.neden}</p>}
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                {kayit.ekleyen} · {new Date(kayit.eklendi).toLocaleDateString('tr-TR')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => cikarMutation.mutate(kayit.login)}
              disabled={cikarMutation.isPending}
              className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-emerald-500/10 hover:text-emerald-400"
              aria-label={`${kayit.login} men listesinden çıkar`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
