import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import type { Awareness } from 'y-protocols/awareness';
import { syncQueue } from '../utils/syncQueue';
import { apiClient } from '../utils/api';

const MAX_RETRIES = 5;
const INITIAL_BACKOFF = 1000; // 1 second

export class SyncService {
  private isOnline: boolean = typeof window !== 'undefined' ? navigator.onLine : true;
  private syncInProgress: boolean = false;
  private listeners: Set<(online: boolean) => void> = new Set();
  private initialized: boolean = false;

  constructor() {
    // Only setup listeners in browser environment
    if (typeof window !== 'undefined') {
      this.setupNetworkListeners();
    }
  }

  private setupNetworkListeners() {
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener('online', () => {
      console.log('✓ Network: Online');
      this.isOnline = true;
      this.notifyListeners(true);
      this.processPendingOperations();
    });

    window.addEventListener('offline', () => {
      console.log('✗ Network: Offline');
      this.isOnline = false;
      this.notifyListeners(false);
    });
  }

  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  onNetworkChange(callback: (online: boolean) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(online: boolean) {
    this.listeners.forEach((callback) => callback(online));
  }

  async queueDocumentUpdate(docId: string, content: any) {
    await syncQueue.addOperation({
      type: 'document-update',
      docId,
      payload: { content },
    });
    console.log('📥 Queued document update for sync');
  }

  async queueVersionCreate(docId: string, content: any, changes: string, isOffline: boolean) {
    await syncQueue.addOperation({
      type: 'version-create',
      docId,
      payload: { content, changes, isOffline, deviceId: this.getDeviceId() },
    });
    console.log('📥 Queued version creation for sync');
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  async processPendingOperations() {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    console.log('🔄 Processing pending operations...');

    try {
      const operations = await syncQueue.getPendingOperations();
      
      if (operations.length === 0) {
        console.log('✓ No pending operations');
        this.syncInProgress = false;
        return;
      }

      console.log(`📤 Syncing ${operations.length} pending operations`);

      for (const op of operations) {
        try {
          await this.processOperation(op);
          await syncQueue.removeOperation(op.id);
          console.log(`✓ Synced operation: ${op.type}`);
        } catch (error: any) {
          console.error(`✗ Failed to sync operation ${op.id}:`, error);
          
          const newRetryCount = op.retryCount + 1;
          
          if (newRetryCount >= MAX_RETRIES) {
            console.error(`✗ Operation ${op.id} exceeded max retries, removing`);
            await syncQueue.removeOperation(op.id);
          } else {
            await syncQueue.updateOperation(op.id, {
              retryCount: newRetryCount,
              lastError: error.message || 'Unknown error',
            });
            
            // Exponential backoff
            const backoffTime = INITIAL_BACKOFF * Math.pow(2, newRetryCount);
            console.log(`⏳ Retry ${newRetryCount}/${MAX_RETRIES} in ${backoffTime}ms`);
            await new Promise((resolve) => setTimeout(resolve, backoffTime));
          }
        }
      }

      console.log('✓ Sync completed');
    } catch (error) {
      console.error('✗ Sync error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processOperation(op: any) {
    switch (op.type) {
      case 'document-update':
        await apiClient.updateDoc(op.docId, undefined, undefined, op.payload.content);
        break;

      case 'version-create':
        await this.createVersion(op.docId, op.payload);
        break;

      case 'comment-create':
        await apiClient.createComment(op.docId, op.payload.text, op.payload.range);
        break;

      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }

  private async createVersion(docId: string, payload: any) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/versions/${docId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to create version: ${response.statusText}`);
    }

    return response.json();
  }

  async syncYjsDocument(ydoc: Y.Doc, docId: string, awareness?: Awareness): Promise<{ 
    indexeddbProvider: IndexeddbPersistence;
    websocketProvider?: WebsocketProvider;
  }> {
    // Always set up IndexedDB persistence for local-first
    const indexeddbProvider = new IndexeddbPersistence(docId, ydoc);
    
    await new Promise((resolve) => {
      indexeddbProvider.once('synced', resolve);
    });
    
    console.log('✓ IndexedDB persistence initialized');

    let websocketProvider: WebsocketProvider | undefined;

    // Only connect to WebSocket if online
    if (this.isOnline) {
      try {
        const token = localStorage.getItem('token');
        websocketProvider = new WebsocketProvider(
          process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:3001',
          docId,
          ydoc,
          {
            // Browser WebSockets cannot set Authorization headers; the backend
            // validates this short-lived JWT query parameter before joining Yjs.
            params: token ? { token } : {},
            awareness,
          }
        );
        console.log('✓ WebSocket provider connected');
      } catch (error) {
        console.error('✗ WebSocket connection failed:', error);
      }
    }

    return { indexeddbProvider, websocketProvider };
  }

  disconnectWebsocket(websocketProvider?: WebsocketProvider) {
    if (websocketProvider) {
      websocketProvider.disconnect();
      websocketProvider.destroy();
      console.log('✓ WebSocket provider disconnected');
    }
  }
}

// Lazy singleton - only created in browser
let syncServiceInstance: SyncService | null = null;

export function getSyncService(): SyncService {
  if (typeof window === 'undefined') {
    // Return a dummy instance for SSR
    return new SyncService();
  }
  
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService();
  }
  return syncServiceInstance;
}

// Export singleton for convenience (will be undefined during SSR)
export const syncService = typeof window !== 'undefined' ? getSyncService() : null as any;
