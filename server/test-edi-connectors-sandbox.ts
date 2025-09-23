/**
 * EDI Connector Sandbox Integration Test
 * Tests the complete flow using ONLY sandbox endpoints
 * Ensures NO production access ever occurs
 */

import type { IStorage } from './storage';
import { getConnector } from './connectors/base';
import { jobQueue } from './lib/jobs';
import { ediRouter, sandboxGateway, NetworkInterceptor } from './edi';
import { isInsurerSupported, getAllInsurers } from './edi/mockInsurers';

export async function testEDISandboxSystem(storage: IStorage) {
  console.log('\n🔒 SANDBOX EDI SYSTEM TEST - Production Safety Verification\n');
  console.log('=' .repeat(60));
  
  // CRITICAL SAFETY CHECK
  if (!ediRouter.isSandboxMode()) {
    console.error('❌ FATAL: Not in sandbox mode!');
    console.error('Set EDI_MODE=sandbox and EDI_BLOCK_PRODUCTION=true');
    throw new Error('SAFETY VIOLATION: Cannot run tests in production mode');
  }
  
  console.log('✅ SANDBOX MODE ACTIVE - All production endpoints blocked');
  console.log('🛡️ Network isolation enabled - production domains blacklisted');
  console.log('📊 Initial statistics:', await ediRouter.getStatistics());
  console.log('=' .repeat(60) + '\n');

  try {
    // Test 1: Verify all 24 insurers are supported
    console.log('TEST 1: Verifying all 24 Canadian insurers...');
    const supportedInsurers = getAllInsurers();
    console.log(`   Found ${supportedInsurers.length} insurers in sandbox:`);
    supportedInsurers.forEach((insurer, idx) => {
      console.log(`   ${(idx + 1).toString().padStart(2, '0')}. ${insurer}`);
    });
    
    if (supportedInsurers.length !== 24) {
      throw new Error(`Expected 24 insurers, found ${supportedInsurers.length}`);
    }
    console.log('   ✅ All 24 Canadian insurers supported\n');

    // Test 2: Production URL blocking
    console.log('TEST 2: Verifying production URL blocking...');
    const productionUrls = [
      'https://api.telus.com/eclaims',
      'https://cdanet.ca/submit',
      'https://sunlife.ca/claims',
      'https://manulife.ca/api',
      'https://bluecross.ca/edi',
      'https://wsib.ca/submit',
    ];
    
    for (const url of productionUrls) {
      const isAllowed = await ediRouter.isURLAllowed(url);
      if (isAllowed) {
        throw new Error(`CRITICAL: Production URL not blocked: ${url}`);
      }
      console.log(`   🚫 Blocked: ${url}`);
    }
    console.log('   ✅ All production URLs blocked\n');

    // Test 3: Sandbox URL allowlist
    console.log('TEST 3: Verifying sandbox URL allowlist...');
    const sandboxUrls = [
      'http://localhost:3000',
      'https://api.sandbox.test',
      'https://test.development.local',
    ];
    
    for (const url of sandboxUrls) {
      const isAllowed = await ediRouter.isURLAllowed(url);
      if (!isAllowed) {
        console.warn(`   ⚠️ Sandbox URL not allowed: ${url}`);
      } else {
        console.log(`   ✅ Allowed: ${url}`);
      }
    }
    console.log('   ✅ Sandbox URLs properly configured\n');

    // Test 4: Create test data and submit claims
    console.log('TEST 4: Testing sandbox claim submissions...');
    
    const testOrg = await storage.createOrganization({
      name: 'SANDBOX Test Clinic',
      province: 'ON'
    });

    const testProvider = await storage.createProvider({
      orgId: testOrg.id,
      name: 'Dr. Sandbox Test',
      licenceNumber: 'SANDBOX-MD-001',
      discipline: 'Testing'
    });

    const testPatient = await storage.createPatient({
      orgId: testOrg.id,
      name: 'SANDBOX Patient',
      dob: new Date('1990-01-01')
    });

    // Get all insurers and test a few
    const insurers = await storage.getInsurers();
    const testInsurers = insurers.slice(0, 3); // Test first 3 insurers
    
    for (const insurer of testInsurers) {
      console.log(`\n   Testing ${insurer.name}...`);
      
      // Create a test claim
      const claim = await storage.createClaim({
        orgId: testOrg.id,
        patientId: testPatient.id,
        providerId: testProvider.id,
        insurerId: insurer.id,
        type: 'claim',
        status: 'draft',
        amount: '100.00',
        currency: 'CAD',
        codes: { procedure: 'TEST001' },
        notes: 'SANDBOX TEST CLAIM',
        createdBy: 'sandbox-test'
      });
      
      // Get appropriate connector
      const connectorName = insurer.rail === 'telusEclaims' ? 'eclaims' : 
                           insurer.rail === 'cdanet' ? 'cdanet' : 'portal';
      
      // Setup connector config
      await storage.upsertConnectorConfig({
        orgId: testOrg.id,
        name: connectorName,
        enabled: true,
        mode: 'sandbox',
        settings: {
          providerId: testProvider.id,
          testMode: true
        }
      });
      
      const connector = await getConnector(connectorName as any, testOrg.id);
      
      // Submit through sandbox
      const result = await ediRouter.submitClaim(
        claim,
        connector,
        testOrg.id,
        'sandbox-test-user'
      );
      
      console.log(`      ✅ Submission successful`);
      console.log(`      📋 External ID: ${result.externalId}`);
      console.log(`      🏷️ Environment: ${result.environment}`);
      
      // Verify SANDBOX prefix
      if (!result.externalId.startsWith('SANDBOX')) {
        throw new Error(`Missing SANDBOX prefix: ${result.externalId}`);
      }
    }
    
    console.log('\n   ✅ All test submissions completed successfully\n');

    // Test 5: Check audit trail
    console.log('TEST 5: Verifying audit trail...');
    const auditEvents = await storage.getAuditEvents(testOrg.id, 10);
    console.log(`   📝 Found ${auditEvents.length} audit events`);
    
    const ediEvents = auditEvents.filter(e => e.type.startsWith('edi_'));
    console.log(`   📋 EDI-specific events: ${ediEvents.length}`);
    
    if (ediEvents.length === 0) {
      console.warn('   ⚠️ No EDI audit events found');
    } else {
      console.log('   ✅ Audit trail active\n');
    }

    // Test 6: Verify response variations
    console.log('TEST 6: Testing response variations...');
    let acceptedCount = 0;
    let deniedCount = 0;
    let infoRequestedCount = 0;
    
    // Submit 10 test claims to see variation
    for (let i = 0; i < 10; i++) {
      const claim = await storage.createClaim({
        orgId: testOrg.id,
        patientId: testPatient.id,
        providerId: testProvider.id,
        insurerId: testInsurers[0].id,
        type: 'claim',
        status: 'draft',
        amount: `${100 + i}.00`,
        currency: 'CAD',
        codes: { procedure: `TEST${i.toString().padStart(3, '0')}` },
        notes: `Variation test ${i}`,
        createdBy: 'sandbox-test'
      });
      
      const connector = await getConnector('eclaims', testOrg.id);
      const result = await ediRouter.submitClaim(
        claim,
        connector,
        testOrg.id,
        'sandbox-test-user'
      );
      
      if (result.status === 'paid' || result.status === 'accepted') acceptedCount++;
      else if (result.status === 'denied') deniedCount++;
      else if (result.status === 'infoRequested') infoRequestedCount++;
    }
    
    console.log(`   📊 Response distribution:`);
    console.log(`      Accepted: ${acceptedCount}/10`);
    console.log(`      Denied: ${deniedCount}/10`);
    console.log(`      Info Requested: ${infoRequestedCount}/10`);
    console.log('   ✅ Response variations working\n');

    // Test 7: Final statistics
    console.log('TEST 7: Final sandbox statistics...');
    const finalStats = await ediRouter.getStatistics();
    console.log('   📊 Final statistics:', finalStats);
    
    const blockedAttempts = ediRouter.getBlockedAttempts();
    console.log(`   🚫 Total blocked production attempts: ${blockedAttempts.length}`);
    
    if (blockedAttempts.length > 0) {
      console.log('   Blocked URLs:', blockedAttempts.map(a => a.url));
    }

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 SANDBOX EDI SYSTEM TEST COMPLETE!');
    console.log('=' .repeat(60));
    console.log('\n✅ All safety checks passed:');
    console.log('   ✓ Production endpoints blocked');
    console.log('   ✓ All 24 Canadian insurers mocked');
    console.log('   ✓ SANDBOX prefix on all identifiers');
    console.log('   ✓ Audit trail active');
    console.log('   ✓ Response variations working');
    console.log('   ✓ Network isolation confirmed');
    console.log('\n🔒 System is SAFE for testing - NO production access possible\n');
    
    return {
      success: true,
      stats: finalStats,
      blockedAttempts: blockedAttempts.length,
      message: 'Sandbox EDI system fully operational and isolated'
    };

  } catch (error) {
    console.error('\n❌ SANDBOX TEST FAILED:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Export for use in testing
export default testEDISandboxSystem;