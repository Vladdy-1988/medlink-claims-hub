import { idbManager, addToSyncQueue } from './indexeddb';
import { useState, useEffect } from 'react';

/**
 * Offline functionality and background sync management
 * 
 * Handles offline mode detection, data synchronization,
 * and service worker communication for PWA features.
 */

export class OfflineManager {
  private static instance: OfflineManager;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private eventListeners: Set<(isOnline: boolean) => void> = new Set();

  private constructor() {
    this.setupEventListeners();
  }

  public static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Service worker message handling
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
    }
  }

  private handleOnline(): void {
    console.log('[Offline] Connection restored');
    this.isOnline = true;
    this.notifyListeners(true);
    
    // Start background sync when connection is restored
    this.startBackgroundSync();
  }

  private handleOffline(): void {
    console.log('[Offline] Connection lost');
    this.isOnline = false;
    this.notifyListeners(false);
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data;
    
    switch (type) {
      case 'BACKGROUND_SYNC':
        console.log('[Offline] Background sync triggered by service worker');
        this.syncOfflineData();
        break;
      case 'CACHE_UPDATED':
        console.log('[Offline] App cache updated');
        break;
    }
  }

  private notifyListeners(isOnline: boolean): void {
    this.eventListeners.forEach(listener => listener(isOnline));
  }

  public addOnlineListener(callback: (isOnline: boolean) => void): () => void {
    this.eventListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public getIsSyncing(): boolean {
    return this.syncInProgress;
  }

  // Save data for offline use
  public async saveForOffline(
    type: 'claim' | 'preauth',
    data: any,
    action: 'create' | 'update' = 'create'
  ): Promise<string> {
    if (type === 'claim') {
      const id = await idbManager.saveDraftClaim(data);
      
      // Add to sync queue if we're offline
      if (!this.isOnline) {
        await addToSyncQueue('claim', action, { ...data, id });
      }
      
      return id;
    } else {
      const id = await idbManager.saveDraftPreAuth(data);
      
      if (!this.isOnline) {
        await addToSyncQueue('preauth', action, { ...data, id });
      }
      
      return id;
    }
  }

  // Save file for offline upload
  public async saveFileForOffline(
    file: File,
    claimId?: string,
    preauthId?: string
  ): Promise<string> {
    const blob = new Blob([file], { type: file.type });
    const id = await idbManager.saveFileForUpload(file.name, blob, claimId, preauthId);
    
    // Add to sync queue if offline
    if (!this.isOnline) {
      await addToSyncQueue('file', 'create', {
        id,
        filename: file.name,
        claimId,
        preauthId,
      });
    }
    
    return id;
  }

  // Start background sync process
  public async startBackgroundSync(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    console.log('[Offline] Starting background sync...');
    this.syncInProgress = true;

    try {
      await this.syncOfflineData();
    } catch (error) {
      console.error('[Offline] Background sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync offline data with server
  private async syncOfflineData(): Promise<void> {
    if (!this.isOnline) {
      console.log('[Offline] Cannot sync - offline');
      return;
    }

    try {
      // Get all items in sync queue
      const syncQueue = await idbManager.getSyncQueue();
      
      console.log(`[Offline] Syncing ${syncQueue.length} items...`);

      for (const item of syncQueue) {
        try {
          await this.syncItem(item);
          await idbManager.removeSyncItem(item.id);
          console.log(`[Offline] Synced item: ${item.type} ${item.action}`);
        } catch (error) {
          console.error(`[Offline] Failed to sync item ${item.id}:`, error);
          
          // Update retry count
          const retryCount = (item.retryCount || 0) + 1;
          const maxRetries = 3;
          
          if (retryCount >= maxRetries) {
            console.error(`[Offline] Max retries reached for item ${item.id}, removing from queue`);
            await idbManager.removeSyncItem(item.id);
          } else {
            await idbManager.updateSyncItem(item.id, {
              retryCount,
              lastError: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Sync draft claims that haven't been added to queue
      await this.syncDraftClaims();
      
      // Sync draft pre-auths
      await this.syncDraftPreAuths();
      
      // Sync pending files
      await this.syncPendingFiles();

    } catch (error) {
      console.error('[Offline] Sync process failed:', error);
      throw error;
    }
  }

  private async syncItem(item: any): Promise<void> {
    const { type, action, data } = item;
    
    switch (type) {
      case 'claim':
        await this.syncClaimItem(action, data);
        break;
      case 'preauth':
        await this.syncPreAuthItem(action, data);
        break;
      case 'file':
        await this.syncFileItem(action, data);
        break;
      default:
        throw new Error(`Unknown sync item type: ${type}`);
    }
  }

  private async syncClaimItem(action: string, data: any): Promise<void> {
    const url = action === 'create' ? '/api/claims' : `/api/claims/${data.id}`;
    const method = action === 'create' ? 'POST' : action === 'update' ? 'PUT' : 'DELETE';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: action !== 'delete' ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Update local storage status
    if (action === 'create' || action === 'update') {
      await idbManager.updateClaimStatus(data.id, 'synced');
    } else {
      await idbManager.deleteClaim(data.id);
    }
  }

  private async syncPreAuthItem(action: string, data: any): Promise<void> {
    const url = action === 'create' ? '/api/preauths' : `/api/preauths/${data.id}`;
    const method = action === 'create' ? 'POST' : action === 'update' ? 'PUT' : 'DELETE';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: action !== 'delete' ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async syncFileItem(action: string, data: any): Promise<void> {
    if (action === 'create') {
      // Get file blob from IndexedDB
      const db = (idbManager as any).ensureDB();
      const file = await db.get('files', data.id);
      if (!file) {
        throw new Error(`File not found: ${data.id}`);
      }

      // Upload file
      const formData = new FormData();
      formData.append('file', file.blob, file.filename);
      if (data.claimId) formData.append('claimId', data.claimId);
      if (data.preauthId) formData.append('preauthId', data.preauthId);

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Update file status
      await idbManager.updateFileStatus(data.id, 'uploaded');
    }
  }

  private async syncDraftClaims(): Promise<void> {
    const pendingClaims = await idbManager.getPendingSyncClaims();
    
    for (const claim of pendingClaims) {
      try {
        await this.syncClaimItem('create', claim.data);
      } catch (error) {
        console.error(`[Offline] Failed to sync draft claim ${claim.id}:`, error);
      }
    }
  }

  private async syncDraftPreAuths(): Promise<void> {
    // Similar implementation for pre-auths
    // Implementation would be similar to syncDraftClaims
  }

  private async syncPendingFiles(): Promise<void> {
    const pendingFiles = await idbManager.getPendingFiles();
    
    for (const file of pendingFiles) {
      try {
        await this.syncFileItem('create', {
          id: file.id,
          filename: file.filename,
          claimId: file.claimId,
          preauthId: file.preauthId,
        });
      } catch (error) {
        console.error(`[Offline] Failed to sync file ${file.id}:`, error);
      }
    }
  }

  // Get offline storage statistics
  public async getOfflineStats(): Promise<{
    totalItems: number;
    draftClaims: number;
    draftPreAuths: number;
    pendingFiles: number;
    syncQueueSize: number;
  }> {
    const stats = await idbManager.getStorageInfo();
    const syncQueue = await idbManager.getSyncQueue();
    
    return {
      totalItems: stats.claims + stats.preauths + stats.files,
      draftClaims: stats.claims,
      draftPreAuths: stats.preauths,
      pendingFiles: stats.files,
      syncQueueSize: syncQueue.length,
    };
  }

  // Clean up old offline data
  public async cleanupOfflineData(olderThanDays: number = 30): Promise<void> {
    await idbManager.cleanupOldData(olderThanDays);
  }
}

// Export singleton instance
export const offlineManager = OfflineManager.getInstance();

// Convenience hooks for React components
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(offlineManager.getIsOnline());
  const [isSyncing, setIsSyncing] = useState(offlineManager.getIsSyncing());

  useEffect(() => {
    const unsubscribe = offlineManager.addOnlineListener(setIsOnline);
    
    // Poll sync status
    const syncInterval = setInterval(() => {
      setIsSyncing(offlineManager.getIsSyncing());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(syncInterval);
    };
  }, []);

  return { isOnline, isSyncing };
}