'use client';
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);
  return online;
}

export function OfflineBanner({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return <div className="offbar" role="status"><WifiOff size={14} /> {children}</div>;
}
