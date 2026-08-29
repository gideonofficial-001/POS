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
      flameOuter: '#f97316',
      flameInner: '#fbbf24',
      text: 'text-white',
      subtext: 'text-white/60',
    },
    dark: {
      flameOuter: '#ea580c',
      flameInner: '#f59e0b',
      text: 'text-slate-900',
      subtext: 'text-slate-500',
    },
    color: {
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
          {/* Outer Lightning Bolt */}
          <polygon 
            points="38,4 16,34 32,34 24,60 50,24 34,24" 
            fill={c.flameOuter} 
            style={{ filter: 'drop-shadow(0 0 4px ' + c.flameOuter + ')' }} 
          />
          {/* Inner Highlight Lightning Bolt */}
          <polygon 
            points="35,8 20,32 32,32 26,52 44,26 32,26" 
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
