import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind class names birleştirme — çakışan sınıflar son geçenle override edilir.
 * Radix / shadcn tarzı bileşenlerde kullanım için standart.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function resolveTeamLogoUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
}
