import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DraftDB extends DBSchema {
  drafts: {
    key: string;
    value: {
      id: string;
      data: any;
      timestamp: number;
      type: string;
    };
  };
  queue: {
    key: string;
    value: {
      id: string;
      operation: string;
      data: any;
      timestamp: number;
      retryCount: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<DraftDB>>;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<DraftDB>('medlink-claims-db', 1, {
      upgrade(db) {
        // Create drafts store for offline drafts
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
        
        // Create queue store for background sync
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Draft management functions
export async function saveOfflineDraft(key: string, data: any): Promise<void> {
  try {
    const db = await getDB();
    const draft = {
      id: key,
      data,
      timestamp: Date.now(),
      type: 'draft',
    };
    
    await db.put('drafts', draft);
  } catch (error) {
    console.error('Failed to save offline draft:', error);
    throw error;
  }
}

export async function getOfflineDraft(key: string): Promise<any> {
  try {
    const db = await getDB();
    const draft = await db.get('drafts', key);
    return draft?.data;
  } catch (error) {
    console.error('Failed to get offline draft:', error);
    return null;
  }
}

export async function getOfflineDrafts(): Promise<Array<{ key: string; data: any; timestamp: number }>> {
  try {
    const db = await getDB();
    const drafts = await db.getAll('drafts');
    return drafts.map(draft => ({
      key: draft.id,
      data: draft.data,
      timestamp: draft.timestamp,
    }));
  } catch (error) {
    console.error('Failed to get offline drafts:', error);
    return [];
  }
}

export async function clearOfflineDraft(key: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('drafts', key);
  } catch (error) {
    console.error('Failed to clear offline draft:', error);
    throw error;
  }
}

export async function clearAllDrafts(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('drafts');
  } catch (error) {
    console.error('Failed to clear all drafts:', error);
    throw error;
  }
}

// Background sync queue functions
export async function addToSyncQueue(id: string, operation: string, data: any): Promise<void> {
  try {
    const db = await getDB();
    const queueItem = {
      id,
      operation,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    await db.put('queue', queueItem);
  } catch (error) {
    console.error('Failed to add to sync queue:', error);
    throw error;
  }
}

export async function getSyncQueue(): Promise<Array<{
  id: string;
  operation: string;
  data: any;
  timestamp: number;
  retryCount: number;
}>> {
  try {
    const db = await getDB();
    return await db.getAll('queue');
  } catch (error) {
    console.error('Failed to get sync queue:', error);
    return [];
  }
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('queue', id);
  } catch (error) {
    console.error('Failed to remove from sync queue:', error);
    throw error;
  }
}

export async function updateSyncQueueItem(id: string, updates: Partial<{
  operation: string;
  data: any;
  retryCount: number;
}>): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('queue', id);
    if (existing) {
      const updated = { ...existing, ...updates };
      await db.put('queue', updated);
    }
  } catch (error) {
    console.error('Failed to update sync queue item:', error);
    throw error;
  }
}

export async function clearSyncQueue(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('queue');
  } catch (error) {
    console.error('Failed to clear sync queue:', error);
    throw error;
  }
}

// Utility functions
export async function getDatabaseSize(): Promise<{ drafts: number; queue: number }> {
  try {
    const db = await getDB();
    const drafts = await db.getAll('drafts');
    const queue = await db.getAll('queue');
    
    return {
      drafts: drafts.length,
      queue: queue.length,
    };
  } catch (error) {
    console.error('Failed to get database size:', error);
    return { drafts: 0, queue: 0 };
  }
}

export async function cleanupOldDrafts(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const db = await getDB();
    const drafts = await db.getAll('drafts');
    const cutoff = Date.now() - maxAge;
    let deletedCount = 0;
    
    for (const draft of drafts) {
      if (draft.timestamp < cutoff) {
        await db.delete('drafts', draft.id);
        deletedCount++;
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old drafts:', error);
    return 0;
  }
}

// React hook for using IndexedDB
export function useIndexedDB() {
  const saveDraft = async (key: string, data: any) => {
    await saveOfflineDraft(key, data);
  };

  const getDraft = async (key: string) => {
    return await getOfflineDraft(key);
  };

  const clearDraft = async (key: string) => {
    await clearOfflineDraft(key);
  };

  const addToQueue = async (id: string, operation: string, data: any) => {
    await addToSyncQueue(id, operation, data);
  };

  const getQueue = async () => {
    return await getSyncQueue();
  };

  const removeFromQueue = async (id: string) => {
    await removeFromSyncQueue(id);
  };

  return {
    saveDraft,
    getDraft,
    clearDraft,
    addToQueue,
    getQueue,
    removeFromQueue,
  };
}
