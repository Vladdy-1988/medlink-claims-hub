import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * IndexedDB integration for offline functionality
 * 
 * Stores draft claims, user data, and sync queue for background processing
 * when connection is restored.
 */

interface MedLinkClaimsDB extends DBSchema {
  claims: {
    key: string;
    value: {
      id: string;
      data: any;
      status: 'draft' | 'pending_sync' | 'synced';
      createdAt: Date;
      updatedAt: Date;
    };
  };
  preauths: {
    key: string;
    value: {
      id: string;
      data: any;
      status: 'draft' | 'pending_sync' | 'synced';
      createdAt: Date;
      updatedAt: Date;
    };
  };
  files: {
    key: string;
    value: {
      id: string;
      filename: string;
      blob: Blob;
      claimId?: string;
      preauthId?: string;
      status: 'pending_upload' | 'uploaded';
      createdAt: Date;
    };
  };
  syncQueue: {
    key: string;
    value: {
      id: string;
      type: 'claim' | 'preauth' | 'file';
      action: 'create' | 'update' | 'delete';
      data: any;
      createdAt: Date;
      retryCount: number;
      lastError?: string;
    };
  };
  userSettings: {
    key: string;
    value: {
      key: string;
      value: any;
      updatedAt: Date;
    };
  };
}

class IndexedDBManager {
  private db: IDBPDatabase<MedLinkClaimsDB> | null = null;
  private readonly dbName = 'MedLinkClaimsDB';
  private readonly version = 1;

  async init(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await openDB<MedLinkClaimsDB>(this.dbName, this.version, {
        upgrade(db) {
          // Claims store
          if (!db.objectStoreNames.contains('claims')) {
            const claimsStore = db.createObjectStore('claims', { keyPath: 'id' });
            // @ts-expect-error - IDB type inference issue with createIndex
            claimsStore.createIndex('status', 'status');
            // @ts-expect-error - IDB type inference issue with createIndex
            claimsStore.createIndex('createdAt', 'createdAt');
          }

          // Pre-authorizations store
          if (!db.objectStoreNames.contains('preauths')) {
            const preauthsStore = db.createObjectStore('preauths', { keyPath: 'id' });
            // @ts-expect-error - IDB type inference issue with createIndex
            preauthsStore.createIndex('status', 'status');
            // @ts-expect-error - IDB type inference issue with createIndex
            preauthsStore.createIndex('createdAt', 'createdAt');
          }

          // Files store
          if (!db.objectStoreNames.contains('files')) {
            const filesStore = db.createObjectStore('files', { keyPath: 'id' });
            // @ts-expect-error - IDB type inference issue with createIndex
            filesStore.createIndex('claimId', 'claimId');
            // @ts-expect-error - IDB type inference issue with createIndex
            filesStore.createIndex('preauthId', 'preauthId');
            // @ts-expect-error - IDB type inference issue with createIndex
            filesStore.createIndex('status', 'status');
          }

          // Sync queue store
          if (!db.objectStoreNames.contains('syncQueue')) {
            const syncQueueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
            // @ts-expect-error - IDB type inference issue with createIndex
            syncQueueStore.createIndex('type', 'type');
            // @ts-expect-error - IDB type inference issue with createIndex
            syncQueueStore.createIndex('createdAt', 'createdAt');
          }

          // User settings store
          if (!db.objectStoreNames.contains('userSettings')) {
            db.createObjectStore('userSettings', { keyPath: 'key' });
          }
        },
      });

      console.log('[IndexedDB] Database initialized successfully');
    } catch (error) {
      console.error('[IndexedDB] Failed to initialize database:', error);
      throw error;
    }
  }

  private ensureDB(): IDBPDatabase<MedLinkClaimsDB> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  // Claims operations
  async saveDraftClaim(claimData: any): Promise<string> {
    const db = this.ensureDB();
    const id = claimData.id || `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const claim = {
      id,
      data: claimData,
      status: 'draft' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.put('claims', claim);
    console.log('[IndexedDB] Draft claim saved:', id);
    return id;
  }

  async getDraftClaims(): Promise<any[]> {
    const db = this.ensureDB();
    const claims = await db.getAllFromIndex('claims', 'status', 'draft');
    return claims.map(claim => claim.data);
  }

  async getPendingSyncClaims(): Promise<any[]> {
    const db = this.ensureDB();
    const claims = await db.getAllFromIndex('claims', 'status', 'pending_sync');
    return claims;
  }

  async updateClaimStatus(id: string, status: 'draft' | 'pending_sync' | 'synced'): Promise<void> {
    const db = this.ensureDB();
    const claim = await db.get('claims', id);
    if (claim) {
      claim.status = status;
      claim.updatedAt = new Date();
      await db.put('claims', claim);
    }
  }

  async deleteClaim(id: string): Promise<void> {
    const db = this.ensureDB();
    await db.delete('claims', id);
  }

  // Pre-authorization operations
  async saveDraftPreAuth(preauthData: any): Promise<string> {
    const db = this.ensureDB();
    const id = preauthData.id || `preauth_draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const preauth = {
      id,
      data: preauthData,
      status: 'draft' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.put('preauths', preauth);
    console.log('[IndexedDB] Draft pre-auth saved:', id);
    return id;
  }

  async getDraftPreAuths(): Promise<any[]> {
    const db = this.ensureDB();
    // @ts-expect-error - IDB type inference issue with getAllFromIndex
    const preauths = await db.getAllFromIndex('preauths', 'status', 'draft');
    return preauths.map(preauth => preauth.data);
  }

  // File operations
  async saveFileForUpload(
    filename: string, 
    blob: Blob, 
    claimId?: string, 
    preauthId?: string
  ): Promise<string> {
    const db = this.ensureDB();
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const file = {
      id,
      filename,
      blob,
      claimId,
      preauthId,
      status: 'pending_upload' as const,
      createdAt: new Date(),
    };

    await db.put('files', file);
    console.log('[IndexedDB] File saved for upload:', filename);
    return id;
  }

  async getPendingFiles(): Promise<any[]> {
    const db = this.ensureDB();
    // @ts-expect-error - IDB type inference issue with getAllFromIndex
    return await db.getAllFromIndex('files', 'status', 'pending_upload');
  }

  async updateFileStatus(id: string, status: 'pending_upload' | 'uploaded'): Promise<void> {
    const db = this.ensureDB();
    const file = await db.get('files', id);
    if (file) {
      file.status = status;
      await db.put('files', file);
    }
  }

  async deleteFile(id: string): Promise<void> {
    const db = this.ensureDB();
    await db.delete('files', id);
  }

  // Sync queue operations
  async addToSyncQueue(
    type: 'claim' | 'preauth' | 'file',
    action: 'create' | 'update' | 'delete',
    data: any
  ): Promise<string> {
    const db = this.ensureDB();
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const syncItem = {
      id,
      type,
      action,
      data,
      createdAt: new Date(),
      retryCount: 0,
    };

    await db.put('syncQueue', syncItem);
    console.log('[IndexedDB] Added to sync queue:', { type, action, id });
    return id;
  }

  async getSyncQueue(): Promise<any[]> {
    const db = this.ensureDB();
    return await db.getAll('syncQueue');
  }

  async updateSyncItem(id: string, updates: Partial<any>): Promise<void> {
    const db = this.ensureDB();
    const item = await db.get('syncQueue', id);
    if (item) {
      Object.assign(item, updates);
      await db.put('syncQueue', item);
    }
  }

  async removeSyncItem(id: string): Promise<void> {
    const db = this.ensureDB();
    await db.delete('syncQueue', id);
  }

  // User settings operations
  async saveSetting(key: string, value: any): Promise<void> {
    const db = this.ensureDB();
    const setting = {
      key,
      value,
      updatedAt: new Date(),
    };
    await db.put('userSettings', setting);
  }

  async getSetting(key: string): Promise<any> {
    const db = this.ensureDB();
    const setting = await db.get('userSettings', key);
    return setting?.value;
  }

  async getAllSettings(): Promise<Record<string, any>> {
    const db = this.ensureDB();
    const settings = await db.getAll('userSettings');
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);
  }

  // Cleanup operations
  async cleanupOldData(olderThanDays = 30): Promise<void> {
    const db = this.ensureDB();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Clean up old synced claims
    // @ts-expect-error - IDB type inference issue with getAllFromIndex
    const syncedClaims = await db.getAllFromIndex('claims', 'status', 'synced');
    for (const claim of syncedClaims) {
      if (claim.updatedAt < cutoffDate) {
        await db.delete('claims', claim.id);
      }
    }

    // Clean up old synced preauths
    // @ts-expect-error - IDB type inference issue with getAllFromIndex
    const syncedPreauths = await db.getAllFromIndex('preauths', 'status', 'synced');
    for (const preauth of syncedPreauths) {
      if (preauth.updatedAt < cutoffDate) {
        await db.delete('preauths', preauth.id);
      }
    }

    // Clean up uploaded files
    // @ts-expect-error - IDB type inference issue with getAllFromIndex
    const uploadedFiles = await db.getAllFromIndex('files', 'status', 'uploaded');
    for (const file of uploadedFiles) {
      if (file.createdAt < cutoffDate) {
        await db.delete('files', file.id);
      }
    }

    console.log('[IndexedDB] Cleanup completed');
  }

  // Database info
  async getStorageInfo(): Promise<{
    claims: number;
    preauths: number;
    files: number;
    syncQueue: number;
    settings: number;
  }> {
    const db = this.ensureDB();
    
    const [claims, preauths, files, syncQueue, settings] = await Promise.all([
      db.count('claims'),
      db.count('preauths'),
      db.count('files'),
      db.count('syncQueue'),
      db.count('userSettings'),
    ]);

    return { claims, preauths, files, syncQueue, settings };
  }

  // Close database connection
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[IndexedDB] Database connection closed');
    }
  }
}

// Singleton instance
export const idbManager = new IndexedDBManager();

// Auto-initialize when module is imported
if (typeof window !== 'undefined') {
  idbManager.init().catch(error => {
    console.error('[IndexedDB] Auto-initialization failed:', error);
  });
}

// Convenience functions
export const saveDraftClaim = (claimData: any) => idbManager.saveDraftClaim(claimData);
export const getDraftClaims = () => idbManager.getDraftClaims();
export const saveDraftPreAuth = (preauthData: any) => idbManager.saveDraftPreAuth(preauthData);
export const getDraftPreAuths = () => idbManager.getDraftPreAuths();
export const saveFileForUpload = (filename: string, blob: Blob, claimId?: string, preauthId?: string) => 
  idbManager.saveFileForUpload(filename, blob, claimId, preauthId);
export const getPendingFiles = () => idbManager.getPendingFiles();
export const addToSyncQueue = (type: 'claim' | 'preauth' | 'file', action: 'create' | 'update' | 'delete', data: any) =>
  idbManager.addToSyncQueue(type, action, data);
export const getSyncQueue = () => idbManager.getSyncQueue();

// Additional convenience functions for backwards compatibility
export const saveOfflineDraft = (key: string, data: any) => idbManager.saveSetting(key, data);
export const getOfflineDraft = (key: string) => idbManager.getSetting(key);
export const clearOfflineDraft = (key: string) => idbManager.saveSetting(key, null);