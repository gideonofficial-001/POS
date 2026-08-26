import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'color';
  showText?: boolean;
}

const sizeMap = {
  sm: { icon: 24, text: 'text-lg' },
  md: { icon: 32, text: 'text-xl' },
  lg: { icon: 48, text: 'text-2xl' },
  xl: { icon: 64, text: 'text-3xl' },
};

export function Logo({ className, size = 'md', variant = 'color', showText = true }: LogoProps) {
  const { icon: iconSize, text: textSize } = sizeMap[size];

  const colors = {
    light: {
      cylinder: 'rgba(255,255,255,0.9)',
      cylinderRim: 'rgba(255,255,255,0.7)',
      cylinderBottom: 'rgba(255,255,255,0.5)',
      valve: 'rgba(255,255,255,0.8)',
      flameOuter: '#f97316',
      flameInner: '#fbbf24',
      text: 'text-white',
      subtext: 'text-white/60',
    },
    dark: {
      cylinder: '#1e293b',
      cylinderRim: '#334155',
      cylinderBottom: '#475569',
      valve: '#1e293b',
      flameOuter: '#ea580c',
      flameInner: '#f59e0b',
      text: 'text-slate-900',
      subtext: 'text-slate-500',
    },
    color: {
      cylinder: '#f8fafc',
      cylinderRim: '#e2e8f0',
      cylinderBottom: '#cbd5e1',
      valve: '#f1f5f9',
      flameOuter: '#f97316',
      flameInner: '#fbbf24',
      text: 'text-slate-900',
      subtext: 'text-slate-500',
    },
  };

  const c = colors[variant];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Icon */}
      <div className="relative flex-shrink-0">
        {variant === 'color' && (
          <div
            className="absolute inset-0 rounded-xl opacity-20 blur-md"
            style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              transform: 'scale(1.3)',
            }}
          />
        )}
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 64 64"
          className="relative"
          style={{ filter: variant === 'light' ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none' }}
        >
          {/* Cylinder body */}
          <rect x="18" y="20" width="28" height="36" rx="4" fill={c.cylinder} />
          {/* Top rim */}
          <ellipse cx="32" cy="20" rx="14" ry="5" fill={c.cylinderRim} />
          {/* Bottom rim */}
          <ellipse cx="32" cy="56" rx="14" ry="5" fill={c.cylinderBottom} />
          {/* Valve stem */}
          <rect x="28" y="12" width="8" height="8" rx="1" fill={c.valve} />
          <rect x="30" y="8" width="4" height="6" rx="1" fill={c.valve} />
          {/* Outer flame */}
          <path
            d="M32 8 Q26 2 28 -2 Q30 -6 32 -4 Q34 -6 36 -2 Q38 2 32 8Z"
            fill={c.flameOuter}
            style={{ filter: 'drop-shadow(0 0 4px ' + c.flameOuter + ')' }}
          />
          {/* Inner flame */}
          <path
            d="M32 6 Q29 2 30 -1 Q31 -3 32 -2 Q33 -3 34 -1 Q35 2 32 6Z"
            fill={c.flameInner}
          />
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={cn('font-black tracking-tight leading-none', textSize, c.text)}>
            NJUGUSH
          </span>
          <span className={cn('text-[10px] font-medium tracking-[0.25em] uppercase', c.subtext)}>
            Point of Sale
          </span>
        </div>
      )}
    </div>
  );
}
