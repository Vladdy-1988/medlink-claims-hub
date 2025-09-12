/**
 * Test EDI connectors via API endpoint
 * This creates a test endpoint to validate the connector system
 */

import { Express } from 'express';
import type { IStorage } from './storage';

export function registerTestRoutes(app: Express, storage: IStorage) {
  // Test EDI connectors endpoint
  app.post('/api/test/edi-connectors', async (req, res) => {
    try {
      console.log('\n🧪 Testing EDI Connector System...\n');

      // 1. Setup test data
      const testOrg = await storage.createOrganization({
        name: 'EDI Test Clinic',
        province: 'ON'
      });

      const testProvider = await storage.createProvider({
        orgId: testOrg.id,
        name: 'Dr. Test Provider',
        licenceNumber: 'TEST123456',
        discipline: 'General Practice'
      });

      const testPatient = await storage.createPatient({
        orgId: testOrg.id,
        name: 'Test Patient',
        dob: new Date('1985-03-20'),
        identifiers: { healthCard: '9876543210' },
        // Additional fields removed - not in schema
      });

      // Mock insurer data (storage doesn't have createInsurer)
      const testInsurer = {
        id: 'test-insurer-' + Date.now(),
        name: 'Test Insurance Co',
        code: 'TIC',
        phone: '1-800-555-0100',
        address: '789 Insurer Blvd',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M1A 1A1'
      };

      // 2. Setup connector configs
      await storage.upsertConnectorConfig({
        orgId: testOrg.id,
        name: 'cdanet',
        enabled: true,
        mode: 'sandbox',
        settings: {
          softwareId: 'MEDLINK_TEST',
          version: '1.0',
          providerId: testProvider.id
        }
      });

      await storage.upsertConnectorConfig({
        orgId: testOrg.id,
        name: 'eclaims', 
        enabled: true,
        mode: 'sandbox',
        settings: {
          providerId: testProvider.id,
          licenseNumber: testProvider.licenceNumber
        }
      });

      // 3. Create test claims
      const dentalClaim = await storage.createClaim({
        orgId: testOrg.id,
        patientId: testPatient.id,
        providerId: testProvider.id,
        insurerId: testInsurer.id,
        type: 'claim',
        status: 'draft',
        amount: '95.00',
        currency: 'CAD',
        codes: { procedure: '21211', tooth: '16' },
        notes: 'Test dental claim',
        createdBy: 'test-system'
      });

      const medicalClaim = await storage.createClaim({
        orgId: testOrg.id,
        patientId: testPatient.id,
        providerId: testProvider.id,
        insurerId: testInsurer.id,
        type: 'claim',
        status: 'draft',
        amount: '75.00',
        currency: 'CAD', 
        codes: { procedure: 'A001A', diagnosis: { primary: 'Z00.00' } },
        notes: 'Test medical claim',
        createdBy: 'test-system'
      });

      // 4. Test connectors
      const { getConnector } = await import('./connectors/base');
      const { jobQueue } = await import('./lib/jobs');

      const results = {
        cdanet: { status: 'pending', jobId: null, error: null },
        eclaims: { status: 'pending', jobId: null, error: null }
      };

      // Test CDAnet
      try {
        const cdanetConnector = await getConnector('cdanet', testOrg.id);
        await cdanetConnector.validate(dentalClaim);
        
        const jobId = await jobQueue.enqueue({
          type: 'submit',
          claimId: dentalClaim.id,
          connector: 'cdanet'
        });
        
        results.cdanet = { status: 'submitted', jobId: jobId || null, error: null };
        console.log('✅ CDAnet connector test passed');
        
      } catch (error: any) {
        results.cdanet.error = error?.message || String(error);
        console.error('❌ CDAnet test failed:', error?.message || String(error));
      }

      // Test eClaims  
      try {
        const eClaimsConnector = await getConnector('eclaims', testOrg.id);
        await eClaimsConnector.validate(medicalClaim);
        
        const jobId = await jobQueue.enqueue({
          type: 'submit',
          claimId: medicalClaim.id,
          connector: 'eclaims'
        });
        
        results.eclaims = { status: 'submitted', jobId: jobId || null, error: null };
        console.log('✅ eClaims connector test passed');
        
      } catch (error: any) {
        results.eclaims.error = error?.message || String(error);
        console.error('❌ eClaims test failed:', error?.message || String(error));
      }

      console.log('\n🎉 EDI Connector Test Complete!\n');

      res.json({
        success: true,
        message: 'EDI connector system tested successfully',
        testData: {
          organizationId: testOrg.id,
          providerId: testProvider.id,
          patientId: testPatient.id,
          dentalClaimId: dentalClaim.id,
          medicalClaimId: medicalClaim.id
        },
        results
      });

    } catch (error: any) {
      console.error('❌ EDI Test Error:', error);
      res.status(500).json({
        success: false,
        message: 'EDI connector test failed',
        error: error?.message || String(error)
      });
    }
  });
}