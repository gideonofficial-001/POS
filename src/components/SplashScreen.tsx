import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setFadeOut(true), 200);
          setTimeout(onComplete, 700);
          return 100;
        }
        return prev + 1.5;
      });
    }, 25);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ background: '#0f172a' }}
    >
      {/* Subtle background glow orbs — blue to match system primary */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full opacity-20 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)',
            width: '500px',
            height: '500px',
            top: '-10%',
            left: '-10%',
          }}
        />
        <div
          className="absolute rounded-full opacity-10 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
            width: '400px',
            height: '400px',
            bottom: '-5%',
            right: '-5%',
          }}
        />
        {/* Very subtle orange glow beneath the logo — brand accent only */}
        <div
          className="absolute rounded-full opacity-15 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, #f97316 0%, transparent 70%)',
            width: '200px',
            height: '200px',
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Card */}
      <div className="relative z-10 flex flex-col items-center justify-center px-10 py-10 rounded-2xl"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Logo icon */}
        <div className="relative mb-6">
          {/* Orange glow behind icon */}
          <div
            className="absolute inset-0 rounded-2xl blur-xl opacity-50"
            style={{
              background: 'radial-gradient(circle, #f97316 0%, transparent 70%)',
              transform: 'scale(1.4)',
            }}
          />
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg viewBox="0 0 64 64" className="w-full h-full">
              {/* Cylinder body */}
              <rect x="18" y="20" width="28" height="36" rx="4" fill="rgba(255,255,255,0.9)" />
              {/* Top rim */}
              <ellipse cx="32" cy="20" rx="14" ry="5" fill="rgba(255,255,255,0.7)" />
              {/* Bottom rim */}
              <ellipse cx="32" cy="56" rx="14" ry="5" fill="rgba(255,255,255,0.45)" />
              {/* Valve */}
              <rect x="28" y="12" width="8" height="8" rx="1" fill="rgba(255,255,255,0.8)" />
              <rect x="30" y="8" width="4" height="6" rx="1" fill="rgba(255,255,255,0.8)" />
              {/* Outer flame */}
              <path
                d="M32 8 Q26 2 28 -2 Q30 -6 32 -4 Q34 -6 36 -2 Q38 2 32 8Z"
                fill="#f97316"
                style={{ filter: 'drop-shadow(0 0 6px #f97316)' }}
              >
                <animate
                  attributeName="d"
                  values="M32 8 Q26 2 28 -2 Q30 -6 32 -4 Q34 -6 36 -2 Q38 2 32 8Z;M32 8 Q25 1 27 -3 Q29 -7 32 -5 Q35 -7 37 -3 Q39 1 32 8Z;M32 8 Q26 2 28 -2 Q30 -6 32 -4 Q34 -6 36 -2 Q38 2 32 8Z"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </path>
              {/* Inner flame */}
              <path
                d="M32 6 Q29 2 30 -1 Q31 -3 32 -2 Q33 -3 34 -1 Q35 2 32 6Z"
                fill="#fbbf24"
              >
                <animate
                  attributeName="d"
                  values="M32 6 Q29 2 30 -1 Q31 -3 32 -2 Q33 -3 34 -1 Q35 2 32 6Z;M32 6 Q28 1 29 -2 Q30 -4 32 -3 Q34 -4 35 -2 Q36 1 32 6Z;M32 6 Q29 2 30 -1 Q31 -3 32 -2 Q33 -3 34 -1 Q35 2 32 6Z"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
          </div>
        </div>

        {/* Brand text */}
        <h1 className="text-4xl font-black tracking-tight text-white mb-1">
          NJUGUSH
        </h1>
        <p className="text-xs font-medium tracking-[0.35em] uppercase"
          style={{ color: 'rgba(148, 163, 184, 0.8)' }}>
          Point of Sale
        </p>

        {/* Progress bar — system blue */}
        <div className="mt-8 w-52">
          <div className="h-[3px] rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-75 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                boxShadow: '0 0 8px rgba(37, 99, 235, 0.6)',
              }}
            />
          </div>
          <p className="text-center text-xs mt-3 font-medium"
            style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
            {progress < 100 ? `Loading ${Math.round(progress)}%` : 'Ready'}
          </p>
        </div>
      </div>

      {/* Bottom tagline */}
      <p className="absolute bottom-8 text-[10px] tracking-widest font-medium uppercase"
        style={{ color: 'rgba(148, 163, 184, 0.3)' }}>
        Developed by Sleek◉⁠‿⁠◉
      </p>
    </div>
  );
}
