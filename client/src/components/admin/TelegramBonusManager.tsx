import { Send, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TelegramBonusConfig {
  enabled: boolean;
  channelUsername: string;
  chatId: string;
  bonusId: string | number | null;
  bonusLabel: string;
  amount: number;
  assignmentValues?: Record<string, unknown>;
}

interface TelegramBonusManagerProps {
  config: TelegramBonusConfig;
  bonusOptions: any[];
  onUpdate: (newConfig: TelegramBonusConfig) => void;
}

export function TelegramBonusManager({ config, bonusOptions, onUpdate }: TelegramBonusManagerProps) {
  const update = (patch: Partial<TelegramBonusConfig>) => onUpdate({ ...config, ...patch });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.05] bg-white/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/10 text-sky-400">
            <Send size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Telegram Bonusu</div>
            <p className="mt-0.5 text-xs font-medium text-slate-400">
              Oyuncu Telegram hesabını bağlar, kanala/gruba katılır; bot API üzerinden gerçek zamanlı üyelik kontrolü yapılıp bonus otomatik tanımlanır.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Aktif</span>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            onClick={() => update({ enabled: !config.enabled })}
            className={cn(
              'relative h-7 w-12 rounded-full transition',
              config.enabled ? 'bg-emerald-500' : 'bg-white/10'
            )}
          >
            <span
              className={cn(
                'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform',
                config.enabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-8 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 md:grid-cols-2 backdrop-blur-xl">
        <div className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Kanal/Grup Kullanıcı Adı</label>
          <input
            type="text"
            value={config.channelUsername}
            onChange={(e) => update({ channelUsername: e.target.value })}
            placeholder="@narcosbahis"
            className="h-11 w-full rounded-md border border-white/5 bg-black/30 px-3 text-sm font-bold text-white outline-none transition focus:border-sky-500/60"
          />
          <p className="text-[10px] font-medium text-slate-500">Yalnızca oyuncuya gösterilen etiket; doğrulama Chat ID üzerinden yapılır.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Chat ID</label>
          <input
            type="text"
            value={config.chatId}
            onChange={(e) => update({ chatId: e.target.value })}
            placeholder="-1001234567890"
            className="h-11 w-full rounded-md border border-white/5 bg-black/30 px-3 text-sm font-bold text-white outline-none transition focus:border-sky-500/60"
          />
          <p className="text-[10px] font-medium text-slate-500">Bot'un getChatMember ile üyelik kontrolü yapacağı kanal/grup kimliği.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Bonus</label>
          <select
            value={config.bonusId ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              const opt = bonusOptions.find((o) => o.id === val);
              update({ bonusId: val || null, bonusLabel: opt ? opt.value : config.bonusLabel });
            }}
            className="h-11 w-full rounded-md border border-white/5 bg-black/30 px-3 text-sm font-bold text-slate-200 outline-none transition focus:border-sky-500/60"
          >
            <option value="">Manuel</option>
            {bonusOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.display}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Tutar (TL)</label>
          <input
            type="number"
            min={0}
            value={config.amount}
            onChange={(e) => update({ amount: Number(e.target.value) })}
            className="h-11 w-full rounded-md border border-white/5 bg-black/30 px-3 text-sm font-bold text-white outline-none transition focus:border-sky-500/60"
          />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-3xl border border-sky-500/15 bg-sky-500/[0.04] p-8 text-xs font-medium text-sky-200/80 backdrop-blur-xl">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-sky-400" />
        <p>
          Bu özelliğin çalışması için sunucuda <code className="rounded bg-black/30 px-1 py-0.5">TELEGRAM_BOT_TOKEN</code> ve{' '}
          <code className="rounded bg-black/30 px-1 py-0.5">TELEGRAM_BOT_USERNAME</code> ortam değişkenleri tanımlanmalı ve botun webhook adresi{' '}
          <code className="rounded bg-black/30 px-1 py-0.5">/api/telegram/webhook</code> olarak Telegram'a kayıt edilmelidir. Oyuncu botu{' '}
          <code className="rounded bg-black/30 px-1 py-0.5">/start</code> ile başlatarak hesabını bağlar, ardından bonus panelinden "Doğrula" ile
          üyeliği gerçek zamanlı kontrol edilip bonus otomatik tanımlanır.
        </p>
      </div>
    </div>
  );
}
