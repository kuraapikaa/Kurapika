import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingStateProps {
  /** Optional short label (e.g. "Yükleniyor") */
  label?: string;
  className?: string;
  /** Use compact spinner only, no label */
  compact?: boolean;
}

export function LoadingState({ label = 'Yükleniyor...', className, compact }: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-slate-400',
        compact ? 'py-6' : 'py-12',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Loader2 size={compact ? 24 : 32} className="animate-spin text-violet-400" />
      {!compact && <p className="text-sm font-medium">{label}</p>}
    </div>
  );
}
