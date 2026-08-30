import { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

export function NetworkStatus() {
  const [status, setStatus] = useState<'online' | 'weak' | 'offline'>('online');

  useEffect(() => {
    const updateStatus = () => {
      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }
      
      const conn = (navigator as any).connection;
      if (conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.saveData)) {
        setStatus('weak');
      } else {
        setStatus('online');
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    if ((navigator as any).connection) {
      (navigator as any).connection.addEventListener('change', updateStatus);
    }
    
    updateStatus();

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if ((navigator as any).connection) {
        (navigator as any).connection.removeEventListener('change', updateStatus);
      }
    };
  }, []);

  const config = {
    online: { icon: Wifi, color: 'text-emerald-500', bg: 'bg-emerald-50', text: 'Connected' },
    weak: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', text: 'Weak Connection' },
    offline: { icon: WifiOff, color: 'text-red-500', bg: 'bg-red-50', text: 'Not Connected' }
  };

  const { icon: Icon, color, bg, text } = config[status];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex justify-center pointer-events-none">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm border ${bg} transition-all duration-300`}>
        <Icon className={`w-4 h-4 ${color}`} />
        <span className={`text-xs font-bold ${color}`}>{text}</span>
      </div>
    </div>
  );
}
