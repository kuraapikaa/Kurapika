import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  /** Short title (e.g. "Kayıt bulunamadı") */
  title: string;
  /** Optional longer description */
  description?: string;
  /** Optional icon (default: Inbox) */
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 px-4 text-center',
        className
      )}
      role="status"
      aria-label={title}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-700/30 text-slate-500">
        {icon ?? <Inbox size={28} />}
      </div>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description && <p className="text-xs text-slate-500 max-w-sm">{description}</p>}
    </div>
  );
}
