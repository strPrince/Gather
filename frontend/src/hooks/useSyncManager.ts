import { useEffect } from 'react';
import { getSyncService } from '../services/syncService';

export function useSyncManager() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Listen for messages from service worker
    const messageHandler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PROCESS_SYNC_QUEUE') {
        console.log('📬 Received sync request from service worker');
        getSyncService().processPendingOperations();
      }
    };

    navigator.serviceWorker.addEventListener('message', messageHandler);

    // Trigger sync when coming online
    const onlineHandler = () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'REGISTER_SYNC'
        });
      }
    };

    window.addEventListener('online', onlineHandler);

    return () => {
      navigator.serviceWorker.removeEventListener('message', messageHandler);
      window.removeEventListener('online', onlineHandler);
    };
  }, []);
}
