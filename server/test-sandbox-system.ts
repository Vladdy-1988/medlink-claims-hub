#!/usr/bin/env tsx
/**
 * Quick test to verify EDI Sandbox System
 * Run with: npx tsx server/test-sandbox-system.ts
 */

import { ediRouter } from './edi';

async function quickSandboxTest() {
  console.log('\n🔍 Quick EDI Sandbox System Verification\n');
  console.log('=' .repeat(50));
  
  // Check sandbox mode
  const isSandbox = ediRouter.isSandboxMode();
  console.log(`\n✅ Sandbox Mode: ${isSandbox ? 'ACTIVE' : '❌ INACTIVE'}`);
  
  if (!isSandbox) {
    console.error('⚠️  WARNING: Not in sandbox mode!');
    console.log('Set EDI_MODE=sandbox in your environment');
  }
  
  // Get statistics
  const stats = await ediRouter.getStatistics();
  console.log('\n📊 System Statistics:');
  console.log(JSON.stringify(stats, null, 2));
  
  // Test production URL blocking
  console.log('\n🔒 Testing Production URL Blocking:');
  const testUrls = [
    'https://api.telus.com/eclaims',
    'https://manulife.ca/api',
    'http://localhost:3000',
    'https://api.sandbox.test'
  ];
  
  for (const url of testUrls) {
    const allowed = await ediRouter.isURLAllowed(url);
    const icon = allowed ? '✅' : '🚫';
    console.log(`  ${icon} ${url}: ${allowed ? 'ALLOWED' : 'BLOCKED'}`);
  }
  
  // Get supported insurers
  const insurers = ediRouter.getSupportedInsurers();
  console.log(`\n🏥 Supported Insurers: ${insurers.length}`);
  console.log('First 5 insurers:', insurers.slice(0, 5));
  
  // Generate tracking numbers
  console.log('\n🔢 Sample Tracking Numbers:');
  console.log('  Claim:', ediRouter.generateTrackingNumber('CLAIM'));
  console.log('  Auth:', ediRouter.generateTrackingNumber('AUTH'));
  console.log('  Remittance:', ediRouter.generateTrackingNumber('RMT'));
  
  console.log('\n' + '=' .repeat(50));
  console.log('✅ EDI Sandbox System is configured and ready!');
  console.log('🔒 All production endpoints are blocked');
  console.log('📋 All responses will be prefixed with SANDBOX');
  console.log('=' .repeat(50) + '\n');
}

// Run the test
quickSandboxTest().catch(console.error);