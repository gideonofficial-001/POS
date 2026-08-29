import { cn } from '../lib/utils';
import { Logo } from '@/components/Logo'
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
    <div className={cn('flex items-center gap-3', className)}
     {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3 overflow-hidden">
          <Logo size="sm" variant="color" showText={!collapsed} />
        </div>
        {/* Mobile close */}
        <button onClick={() => setMobileOpen(false)} className="lg:hidden p-2 hover:bg-muted rounded-lg shrink-0">
          <X className="w-5 h-5" />
        </button>
        {/* Desktop collapse */}
        <button onClick={toggleCollapsed} className="hidden lg:flex p-1.5 hover:bg-muted rounded-lg transition-colors shrink-0">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
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
