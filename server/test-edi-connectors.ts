/**
 * EDI Connector Integration Test
 * Tests the complete flow: sample data creation → connector validation → job submission → status polling
 */

import type { IStorage } from './storage';
import { getConnector } from './connectors/base';
import { jobQueue } from './lib/jobs';

export async function testEDIConnectors(storage: IStorage) {
  console.log('\n🧪 Starting EDI Connector Integration Test...\n');

  try {
    // 1. Setup test organization and sample data
    console.log('1. Creating test organization and sample data...');
    
    const testOrg = await storage.createOrganization({
      name: 'Test Medical Clinic',
      province: 'ON'
    });

    const testProvider = await storage.createProvider({
      orgId: testOrg.id,
      name: 'Dr. Jane Smith',
      licenceNumber: 'MD123456',
      discipline: 'Family Medicine'
    });

    const testPatient = await storage.createPatient({
      orgId: testOrg.id,
      name: 'John Doe',
      dob: new Date('1980-05-15')
    });

    // Create test insurer (using seed data instead as createInsurer doesn't exist)
    const insurers = await storage.getInsurers();
    const testInsurer = insurers[0]; // Use first available insurer
    
    if (!testInsurer) {
      throw new Error('No insurers found in database. Run seed first.');
    }
    
    console.log(`   ✅ Using existing insurer: ${testInsurer.name}`);
    
    // Skip insurer creation since we're using existing data
    /*
    const testInsurer = await storage.createInsurer({
      name: 'Ontario Health Insurance Plan',
      code: 'OHIP',
      phone: '1-800-268-1153',
      address: 'Queens Park',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M7A 1R3'
    });
    */

    // 2. Setup connector configurations
    console.log('2. Setting up connector configurations...');
    
    await storage.upsertConnectorConfig({
      orgId: testOrg.id,
      name: 'cdanet',
      enabled: true,
      mode: 'sandbox',
      settings: {
        softwareId: 'MEDLINK_TEST',
        version: '1.0',
        providerId: testProvider.id,
        officeSequence: '01'
      }
    });

    await storage.upsertConnectorConfig({
      orgId: testOrg.id,
      name: 'eclaims',
      enabled: true,
      mode: 'sandbox',
      settings: {
        providerId: testProvider.id,
        licenseNumber: testProvider.licenceNumber,
        facilityId: 'CLINIC001'
      }
    });

    // 3. Create test claims
    console.log('3. Creating test claims...');
    
    const dentalClaim = await storage.createClaim({
      orgId: testOrg.id,
      patientId: testPatient.id,
      providerId: testProvider.id,
      insurerId: testInsurer.id,
      type: 'claim',
      status: 'draft',
      amount: '125.00',
      currency: 'CAD',
      codes: {
        procedure: '21211', // Dental examination
        tooth: '16',
        surface: 'MOD'
      },
      notes: 'Routine dental examination and filling',
      createdBy: 'test-system'
    });

    const medicalClaim = await storage.createClaim({
      orgId: testOrg.id,
      patientId: testPatient.id,
      providerId: testProvider.id,
      insurerId: testInsurer.id,
      type: 'claim',
      status: 'draft',
      amount: '85.00',
      currency: 'CAD',
      codes: {
        procedure: 'A001A', // Office visit
        diagnosis: {
          primary: 'Z00.00', // General health check
          secondary: ['M25.50'] // Joint pain
        }
      },
      notes: 'Annual physical examination',
      createdBy: 'test-system'
    });

    // 4. Test CDAnet Connector
    console.log('4. Testing CDAnet Connector...');
    
    const cdanetConnector = await getConnector('cdanet', testOrg.id);
    
    try {
      console.log('   → Validating dental claim...');
      await cdanetConnector.validate(dentalClaim);
      console.log('   ✅ CDAnet validation successful');
      
      console.log('   → Submitting dental claim via job queue...');
      const cdanetJobId = await jobQueue.enqueue({
        type: 'submit',
        claimId: dentalClaim.id,
        connector: 'cdanet'
      });
      console.log(`   ✅ CDAnet job enqueued: ${cdanetJobId}`);
      
      // Wait for job processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      const cdanetJob = await jobQueue.getStatus(cdanetJobId);
      console.log(`   📊 CDAnet job status: ${cdanetJob?.status}`);
      
    } catch (error) {
      console.error('   ❌ CDAnet test failed:', error instanceof Error ? error.message : String(error));
    }

    // 5. Test TELUS eClaims Connector
    console.log('5. Testing TELUS eClaims Connector...');
    
    const eClaimsConnector = await getConnector('eclaims', testOrg.id);
    
    try {
      console.log('   → Validating medical claim...');
      await eClaimsConnector.validate(medicalClaim);
      console.log('   ✅ eClaims validation successful');
      
      console.log('   → Submitting medical claim via job queue...');
      const eClaimsJobId = await jobQueue.enqueue({
        type: 'submit',
        claimId: medicalClaim.id,
        connector: 'eclaims'
      });
      console.log(`   ✅ eClaims job enqueued: ${eClaimsJobId}`);
      
      // Wait for job processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      const eClaimsJob = await jobQueue.getStatus(eClaimsJobId);
      console.log(`   📊 eClaims job status: ${eClaimsJob?.status}`);
      
    } catch (error) {
      console.error('   ❌ eClaims test failed:', error instanceof Error ? error.message : String(error));
    }

    // 6. Test connector events tracking
    console.log('6. Checking connector events...');
    
    const dentalEvents = await storage.getConnectorEvents(dentalClaim.id);
    const medicalEvents = await storage.getConnectorEvents(medicalClaim.id);
    
    console.log(`   📋 Dental claim events: ${dentalEvents.length}`);
    console.log(`   📋 Medical claim events: ${medicalEvents.length}`);

    // 7. Test job queue status
    console.log('7. Job queue summary...');
    const allJobs = await jobQueue.getAllJobs();
    const queuedJobs = allJobs.filter(j => j.status === 'queued').length;
    const runningJobs = allJobs.filter(j => j.status === 'running').length;
    const succeededJobs = allJobs.filter(j => j.status === 'succeeded').length;
    const failedJobs = allJobs.filter(j => j.status === 'failed').length;
    
    console.log(`   📊 Jobs - Queued: ${queuedJobs}, Running: ${runningJobs}, Succeeded: ${succeededJobs}, Failed: ${failedJobs}`);

    console.log('\n🎉 EDI Connector Integration Test Complete!\n');
    
    return {
      success: true,
      testOrg,
      testProvider,
      testPatient,
      dentalClaim,
      medicalClaim,
      jobsSummary: { queuedJobs, runningJobs, succeededJobs, failedJobs }
    };

  } catch (error) {
    console.error('\n❌ EDI Connector Test Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Export for use in other test scenarios
export default testEDIConnectors;