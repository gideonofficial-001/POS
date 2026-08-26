import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/button';

// The beforeinstallprompt event often fires before React mounts.
// We capture it on the window globally so the component can pick it up
// whenever it renders — even if it missed the original event.
declare global {
  interface Window {
    __deferredInstallPrompt?: Event;
  }
}

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Skip if already running as a standalone installed app
    const isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isInstalled) return;

    const dismissed = localStorage.getItem('install-prompt-dismissed');
    const tooRecent =
      dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000;
    if (tooRecent) return;

    // Pick up the event if it was captured globally before this component mounted
    if (window.__deferredInstallPrompt) {
      setDeferredPrompt(window.__deferredInstallPrompt);
      setShowPrompt(true);
      return;
    }

    // Otherwise listen for it arriving after mount
    const handler = (e: Event) => {
      e.preventDefault();
      window.__deferredInstallPrompt = e;
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const { outcome } = await (deferredPrompt as any).userChoice;
    if (outcome === 'accepted') {
      window.__deferredInstallPrompt = undefined;
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('install-prompt-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <div
        className="rounded-xl p-4 shadow-2xl"
        style={{
          background: '#1e293b',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(37, 99, 235, 0.15)' }}>
              <Download className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Install Njugush POS</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Add to home screen for quick access
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-500 hover:text-slate-300 transition-colors ml-2 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <Button
          onClick={handleInstall}
          className="w-full text-white"
          style={{ background: '#2563eb' }}
          size="sm"
        >
          <Download className="w-4 h-4 mr-2" />
          Install App
        </Button>
      </div>
    </div>
  );
}
