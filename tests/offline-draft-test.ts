// Offline Draft Sync Test
// This test simulates offline claim draft creation and sync

import { openDB } from 'idb';

interface DraftClaim {
  id: string;
  patientId: string;
  providerId: string;
  insurerId: string;
  amount: string;
  description: string;
  codes: string[];
  status: 'draft';
  createdAt: string;
  type: 'claim' | 'preauth';
}

async function initTestDB() {
  return openDB('medlink-test', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('drafts')) {
        const store = db.createObjectStore('drafts', { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('createdAt', 'createdAt');
      }
    },
  });
}

async function saveDraftOffline(draft: DraftClaim) {
  const db = await initTestDB();
  const tx = db.transaction('drafts', 'readwrite');
  await tx.objectStore('drafts').put(draft);
  await tx.done;
  console.log('✓ Draft saved to IndexedDB while offline:', draft.id);
}

async function syncDraftOnline(draft: DraftClaim) {
  try {
    // Simulate API call to sync draft
    const response = await fetch('http://localhost:5000/api/claims', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(draft),
    });

    if (response.ok) {
      const savedClaim = await response.json();
      console.log('✓ Draft synced to server successfully:', savedClaim.id);
      
      // Remove from IndexedDB after successful sync
      const db = await initTestDB();
      const tx = db.transaction('drafts', 'readwrite');
      await tx.objectStore('drafts').delete(draft.id);
      await tx.done;
      console.log('✓ Draft removed from IndexedDB after sync');
      
      return savedClaim;
    } else {
      console.log('✗ Failed to sync draft to server:', response.status);
      return null;
    }
  } catch (error) {
    console.log('✗ Network error during sync:', error);
    return null;
  }
}

async function verifyClaimExists(claimId: string) {
  try {
    const response = await fetch(`http://localhost:5000/api/claims/${claimId}`);
    if (response.ok) {
      const claim = await response.json();
      console.log('✓ Claim verified on server:', claim.id);
      return true;
    }
    return false;
  } catch (error) {
    console.log('✗ Error verifying claim:', error);
    return false;
  }
}

async function runOfflineDraftTest() {
  console.log('🧪 Starting Offline Draft Test...\n');
  
  // 1. Create a test draft claim
  const testDraft: DraftClaim = {
    id: `test-draft-${Date.now()}`,
    patientId: 'patient-1',
    providerId: 'provider-1', 
    insurerId: 'insurer-1',
    amount: '125.50',
    description: 'Test offline draft claim',
    codes: ['T001', 'T002'],
    status: 'draft',
    createdAt: new Date().toISOString(),
    type: 'claim'
  };

  // 2. Simulate offline: save draft to IndexedDB
  console.log('📱 Simulating offline mode...');
  await saveDraftOffline(testDraft);

  // 3. Simulate going online: sync draft to server
  console.log('\n🌐 Simulating online mode...');
  const syncedClaim = await syncDraftOnline(testDraft);

  if (syncedClaim) {
    // 4. Verify claim exists on server
    console.log('\n🔍 Verifying claim on server...');
    const exists = await verifyClaimExists(syncedClaim.id);
    
    if (exists) {
      console.log('\n✅ Offline draft test PASSED');
      console.log('   - Draft saved offline successfully');
      console.log('   - Draft synced to server successfully');
      console.log('   - Claim verified on server');
    } else {
      console.log('\n❌ Offline draft test FAILED: Claim not found on server');
    }
  } else {
    console.log('\n❌ Offline draft test FAILED: Could not sync draft');
  }
  
  console.log('\n🏁 Offline draft test completed\n');
}

// Export for use in test runner
export { runOfflineDraftTest };

// Run if called directly
if (require.main === module) {
  runOfflineDraftTest().catch(console.error);
}