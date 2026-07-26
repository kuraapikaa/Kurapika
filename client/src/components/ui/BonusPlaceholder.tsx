import { cn } from '../../lib/utils';

const PLACEHOLDER_URL = 'https://i.ibb.co/mCXM66k4/gift-1.png';

export function BonusPlaceholder({
  size = 64,
  className,
  tone = 'purple',
}: {
  size?: number;
  className?: string;
  tone?: 'purple' | 'emerald' | 'cyan' | 'amber';
}) {
  const tones = {
    emerald: {
      icon: 'bg-gradient-to-br from-emerald-300 to-emerald-500',
    },
    cyan: {
      icon: 'bg-gradient-to-br from-cyan-300 to-sky-500',
    },
    amber: {
      icon: 'bg-gradient-to-br from-amber-300 to-orange-500',
    },
    purple: {
      icon: 'bg-gradient-to-br from-purple-300 to-fuchsia-500',
    },
  };

  const { icon } = tones[tone];

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        className
      )}
      style={{ width: size, height: size }}
    >
      <div className="relative z-10 grid place-items-center">
        {/* Main Icon with complex gradient mask */}
        <div
          className={cn('opacity-100', icon)}
          style={{
            width: Math.max(24, Math.round(size * 0.7)),
            height: Math.max(24, Math.round(size * 0.7)),
            WebkitMaskImage: `url(${PLACEHOLDER_URL})`,
            maskImage: `url(${PLACEHOLDER_URL})`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
          }}
        />
      </div>
    </div>
  );
}
