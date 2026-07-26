import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'border border-white/10 bg-gradient-to-br from-blue-500 to-teal-400 text-white shadow-[0_6px_20px_rgba(59,130,246,0.28)] hover:brightness-110',
        variant === 'secondary' && 'border border-white/[0.08] bg-white/[0.035] text-slate-300 hover:border-white/15 hover:bg-white/[0.06] hover:text-white',
        variant === 'ghost' && 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
        variant === 'danger' && 'bg-rose-600/90 text-white hover:bg-rose-500',
        size === 'sm' && 'h-8 px-3 text-[11px]',
        size === 'md' && 'h-9 px-3.5 text-xs',
        size === 'lg' && 'h-10 px-5 text-sm',
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button };
