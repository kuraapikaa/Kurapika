import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ErrorStateProps {
  /** Error message to show */
  message: string;
  /** Optional retry callback (shows "Tekrar dene" button) */
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-500/20 bg-rose-500/5 py-10 px-6 text-center',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
        <AlertCircle size={24} />
      </div>
      <p className="text-sm font-medium text-rose-200">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <RefreshCw size={16} />
          Tekrar dene
        </button>
      )}
    </div>
  );
}
