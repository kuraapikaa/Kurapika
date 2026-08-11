import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Flame } from "lucide-react"

import { cn } from "@/lib/utils"

// Types (inlined - only fields used by this component)
interface StreakResponse {
  length: number
  frequency: "daily" | "weekly" | "monthly"
}

// Variants
const streakBadgeVariants = cva(
  "inline-flex flex-col items-center justify-center rounded-3xl border border-[rgba(243,236,221,0.10)] bg-[rgba(243,236,221,0.05)] text-center text-[color:var(--lobby-text,#f3ecdd)] transition-colors",
  {
    variants: {
      size: {
        sm: "w-28 gap-1.5 p-3",
        default: "w-40 gap-2.5 p-5",
        lg: "w-52 gap-3 p-6",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

// Props
interface StreakBadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof streakBadgeVariants> {
  /** Streak length value */
  length?: number
  /** Streak frequency used for label rendering */
  frequency?: StreakResponse["frequency"]
  /** Optional subtitle shown below streak length */
  subtitle?: string
  /** Custom icon to replace flame */
  icon?: React.ReactNode
}

const StreakBadge = React.forwardRef<HTMLDivElement, StreakBadgeProps>(
  (
    { className, size, length, frequency = "daily", subtitle, icon, ...props },
    ref
  ) => {
    const streakLength = length ?? 0

    // Türkçede isimler çoğullanmaz ("3 gün", "3 gündür" değil) — İngilizce
    // sürümdeki tekil/çoğul ayrımı burada gereksiz.
    const pluralLabel = {
      daily: "gün",
      weekly: "hafta",
      monthly: "ay",
    }[frequency]

    const iconSize = {
      sm: "h-10 w-10",
      default: "h-16 w-16",
      lg: "h-20 w-20",
    }[size ?? "default"]

    const valueSize = {
      sm: "text-2xl",
      default: "text-5xl",
      lg: "text-6xl",
    }[size ?? "default"]

    const subtitleSize = {
      sm: "text-xs",
      default: "text-sm",
      lg: "text-base",
    }[size ?? "default"]

    const subtitleText = subtitle ?? "seri"
    const valueUnit = pluralLabel

    // Build accessible label
    const ariaLabel = `${streakLength} ${pluralLabel}lük seri`

    return (
      <div
        ref={ref}
        role="status"
        aria-label={ariaLabel}
        className={cn(streakBadgeVariants({ size }), className)}
        {...props}
      >
        {icon ?? (
          <Flame
            className={cn(iconSize, "text-amber-500 shrink-0")}
            aria-hidden="true"
          />
        )}
        <span
          className={cn("font-black tracking-tight", valueSize)}
          aria-hidden="true"
        >
          {streakLength}
          <span className="text-[color:var(--lobby-muted,#8f8674)] ml-2 font-bold">
            {valueUnit}
          </span>
        </span>
        <span
          className={cn("text-[color:var(--lobby-muted,#8f8674)] font-bold uppercase tracking-widest", subtitleSize)}
          aria-hidden="true"
        >
          {subtitleText}
        </span>
      </div>
    )
  }
)
StreakBadge.displayName = "StreakBadge"

export { StreakBadge, streakBadgeVariants }
export type { StreakBadgeProps, StreakResponse }
