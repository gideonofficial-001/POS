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
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4c1d95 50%, #7c2d12 75%, #c2410c 100%)',
      }}
    >
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, #f97316 0%, transparent 70%)',
            top: '10%',
            left: '20%',
            animation: 'float 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)',
            bottom: '15%',
            right: '15%',
            animation: 'float 10s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute w-[300px] h-[300px] rounded-full opacity-25 blur-[60px]"
          style={{
            background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)',
            top: '50%',
            left: '60%',
            animation: 'float 12s ease-in-out infinite 2s',
          }}
        />
      </div>

      {/* Glass Card */}
      <div className="relative z-10">
        <div
          className="relative flex flex-col items-center justify-center px-12 py-10 rounded-3xl"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Shimmer effect overlay */}
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 55%, transparent 60%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 3s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />

          {/* Logo */}
          <div className="relative mb-6">
            <div
              className="absolute inset-0 rounded-2xl opacity-40 blur-xl"
              style={{
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                transform: 'scale(1.2)',
              }}
            />
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-lg">
                {/* Cylinder body */}
                <rect x="18" y="20" width="28" height="36" rx="4" fill="rgba(255,255,255,0.9)" />
                {/* Cylinder top rim */}
                <ellipse cx="32" cy="20" rx="14" ry="5" fill="rgba(255,255,255,0.7)" />
                {/* Cylinder bottom rim */}
                <ellipse cx="32" cy="56" rx="14" ry="5" fill="rgba(255,255,255,0.5)" />
                {/* Valve */}
                <rect x="28" y="12" width="8" height="8" rx="1" fill="rgba(255,255,255,0.8)" />
                <rect x="30" y="8" width="4" height="6" rx="1" fill="rgba(255,255,255,0.8)" />
                {/* Flame */}
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

          {/* Brand Text */}
          <h1
            className="text-4xl font-black tracking-tight text-white mb-1"
            style={{ textShadow: '0 2px 20px rgba(249, 115, 22, 0.4)' }}
          >
            NJUGUSH
          </h1>
          <p className="text-sm font-medium tracking-[0.3em] text-white/60 uppercase">
            Point of Sale
          </p>

          {/* Progress bar */}
          <div className="mt-8 w-56">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100 ease-out"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #f97316, #fbbf24)',
                  boxShadow: '0 0 10px rgba(249, 115, 22, 0.5)',
                }}
              />
            </div>
            <p className="text-center text-xs text-white/40 mt-3 font-medium">
              {progress < 100 ? `Loading ${Math.round(progress)}%...` : 'Ready'}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom tagline */}
      <p className="absolute bottom-8 text-xs text-white/30 tracking-wider">
        DEVELOPED BY SLEEK(⁠✷⁠‿⁠✷⁠)
      </p>

      {/* Keyframe animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
