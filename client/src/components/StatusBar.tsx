import { cn } from '../lib/utils';

interface StatusBarProps {
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

export function StatusBar({ isLoading, error, success }: StatusBarProps) {
  const message = error ?? (isLoading ? 'Yükleniyor…' : success ? 'Tüm veriler yüklendi' : '');
  const isError = Boolean(error);

  return (
    <div
      className={cn(
        'mt-6 flex items-center gap-3 rounded-3xl border px-4 py-3 text-sm font-medium backdrop-blur-xl',
        isError
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      )}
    >
      <span
        className={cn(
          'h-2.5 w-2.5 shrink-0 rounded-full',
          isError ? 'bg-rose-400' : 'bg-emerald-400',
          isLoading && !isError && 'animate-pulse'
        )}
      />
      {message}
    </div>
  );
}
