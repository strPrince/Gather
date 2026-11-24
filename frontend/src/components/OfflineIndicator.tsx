'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, CloudOff, RefreshCw } from 'lucide-react';

type ConnectionStatus = 'online' | 'offline' | 'syncing';

export default function OfflineIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check initial status
    if (typeof window !== 'undefined') {
      setStatus(navigator.onLine ? 'online' : 'offline');
      setShowBanner(!navigator.onLine);
    }

    const handleOnline = () => {
      setStatus('syncing');
      setShowBanner(true);
      
      // Show syncing for 2 seconds, then switch to online
      setTimeout(() => {
        setStatus('online');
        setTimeout(() => setShowBanner(false), 3000); // Hide after 3 more seconds
      }, 2000);
    };

    const handleOffline = () => {
      setStatus('offline');
      setShowBanner(true);
    };

    // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SYNC_COMPLETE') {
        setStatus('online');
        setTimeout(() => setShowBanner(false), 3000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  if (!showBanner) return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'offline':
        return {
          icon: <WifiOff className="w-5 h-5" />,
          text: '🔴 You are offline - Changes will sync when you reconnect',
          className: 'offline-banner',
        };
      case 'syncing':
        return {
          icon: <RefreshCw className="w-5 h-5 animate-spin" />,
          text: '🔄 Syncing offline changes...',
          className: 'offline-banner syncing',
        };
      case 'online':
        return {
          icon: <Wifi className="w-5 h-5" />,
          text: '✅ Back online - All changes synced',
          className: 'offline-banner online',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={config.className}>
      <div className="flex items-center justify-center gap-2">
        {config.icon}
        <span>{config.text}</span>
      </div>
    </div>
  );
}
