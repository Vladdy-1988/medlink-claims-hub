import { saveOfflineDraft, getOfflineDrafts, clearOfflineDraft } from './indexeddb';
import { apiRequest } from './queryClient';

interface QueuedOperation {
  id: string;
  type: 'claim' | 'attachment' | 'update';
  data: any;
  timestamp: number;
  retryCount?: number;
}

class OfflineManager {
  private syncQueue: QueuedOperation[] = [];
  private isOnline = navigator.onLine;
  private maxRetries = 3;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncQueuedOperations();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Load queued operations from storage on init
    this.loadQueueFromStorage();
  }

  // Check if the device is currently online
  isDeviceOnline(): boolean {
    return this.isOnline;
  }

  // Queue an operation for later sync when online
  async queueOperation(type: QueuedOperation['type'], data: any): Promise<string> {
    const operation: QueuedOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(operation);
    await this.saveQueueToStorage();

    // If online, try to sync immediately
    if (this.isOnline) {
      this.syncQueuedOperations();
    }

    return operation.id;
  }

  // Sync all queued operations
  async syncQueuedOperations(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    const operationsToSync = [...this.syncQueue];
    
    for (const operation of operationsToSync) {
      try {
        await this.syncOperation(operation);
        // Remove successful operation from queue
        this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
      } catch (error) {
        console.error('Failed to sync operation:', operation.id, error);
        
        // Increment retry count
        const queuedOp = this.syncQueue.find(op => op.id === operation.id);
        if (queuedOp) {
          queuedOp.retryCount = (queuedOp.retryCount || 0) + 1;
          
          // Remove if max retries exceeded
          if (queuedOp.retryCount >= this.maxRetries) {
            this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
            console.error('Max retries exceeded for operation:', operation.id);
          }
        }
      }
    }

    await this.saveQueueToStorage();
  }

  // Sync a single operation
  private async syncOperation(operation: QueuedOperation): Promise<void> {
    switch (operation.type) {
      case 'claim':
        await apiRequest('POST', '/api/claims', operation.data);
        break;
      case 'attachment':
        await apiRequest('POST', '/api/attachments', operation.data);
        break;
      case 'update':
        await apiRequest('PATCH', `/api/claims/${operation.data.id}`, operation.data.updates);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  // Get current queue status
  getQueueStatus(): { 
    pending: number; 
    operations: QueuedOperation[];
    isOnline: boolean;
  } {
    return {
      pending: this.syncQueue.length,
      operations: [...this.syncQueue],
      isOnline: this.isOnline,
    };
  }

  // Clear all queued operations
  async clearQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveQueueToStorage();
  }

  // Save queue to IndexedDB
  private async saveQueueToStorage(): Promise<void> {
    try {
      await saveOfflineDraft('sync_queue', {
        operations: this.syncQueue,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  // Load queue from IndexedDB
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const stored = await getOfflineDraft('sync_queue');
      if (stored && stored.operations) {
        this.syncQueue = stored.operations;
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  // Manually trigger sync
  async forcSync(): Promise<void> {
    if (this.isOnline) {
      await this.syncQueuedOperations();
    }
  }
}

// Create singleton instance
export const offlineManager = new OfflineManager();

// Hook for React components
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueStatus, setQueueStatus] = useState(offlineManager.getQueueStatus());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update queue status periodically
    const interval = setInterval(() => {
      setQueueStatus(offlineManager.getQueueStatus());
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline,
    queueStatus,
    queueOperation: offlineManager.queueOperation.bind(offlineManager),
    syncNow: offlineManager.forcSync.bind(offlineManager),
  };
}

// Utility to check if a form can be submitted
export function canSubmitForm(): boolean {
  return offlineManager.isDeviceOnline();
}

// Background sync registration for service worker
export function registerBackgroundSync(): void {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then(registration => {
      // Register for background sync
      return registration.sync.register('claims-sync');
    }).catch(error => {
      console.error('Background sync registration failed:', error);
    });
  }
}
