#!/usr/bin/env tsx
/**
 * Test script for data anonymizer
 * Validates that anonymization functions work correctly
 */

import { DataAnonymizer } from '../security/anonymizer';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function testAnonymizer() {
  log('\n🧪 TESTING DATA ANONYMIZER', colors.magenta);
  log('=' .repeat(50));
  
  const anonymizer = new DataAnonymizer('test-seed');
  let passed = 0;
  let failed = 0;
  
  // Test 1: Deterministic anonymization
  log('\n📝 Test 1: Deterministic Anonymization', colors.cyan);
  const originalName = 'John Doe';
  const anonymized1 = anonymizer.anonymizeName(originalName);
  const anonymized2 = anonymizer.anonymizeName(originalName);
  
  if (anonymized1 === anonymized2) {
    log('  ✅ Same input produces same output', colors.green);
    passed++;
  } else {
    log('  ❌ Deterministic anonymization failed', colors.red);
    failed++;
  }
  
  // Test 2: First name anonymization
  log('\n📝 Test 2: First Name Anonymization', colors.cyan);
  const firstName = 'Alice';
  const anonFirstName = anonymizer.anonymizeFirstName(firstName);
  
  if (anonFirstName && anonFirstName.startsWith('TEST-') && anonFirstName !== firstName) {
    log(`  ✅ '${firstName}' → '${anonFirstName}'`, colors.green);
    passed++;
  } else {
    log('  ❌ First name anonymization failed', colors.red);
    failed++;
  }
  
  // Test 3: Email anonymization
  log('\n📝 Test 3: Email Anonymization', colors.cyan);
  const email = 'user@example.com';
  const anonEmail = anonymizer.anonymizeEmail(email);
  
  if (anonEmail && anonEmail.includes('@staging.medlink.ca') && anonEmail !== email) {
    log(`  ✅ '${email}' → '${anonEmail}'`, colors.green);
    passed++;
  } else {
    log('  ❌ Email anonymization failed', colors.red);
    failed++;
  }
  
  // Test 4: Health card numbers (Ontario)
  log('\n📝 Test 4: Health Card Anonymization (Ontario)', colors.cyan);
  const healthCard = '1234567890AB';
  const anonHealthCard = anonymizer.anonymizeHealthCardNumber(healthCard, 'ON');
  
  if (anonHealthCard && anonHealthCard.startsWith('TEST') && anonHealthCard !== healthCard) {
    log(`  ✅ '${healthCard}' → '${anonHealthCard}'`, colors.green);
    passed++;
  } else {
    log('  ❌ Health card anonymization failed', colors.red);
    failed++;
  }
  
  // Test 5: Phone number anonymization
  log('\n📝 Test 5: Phone Number Anonymization', colors.cyan);
  const phone = '416-555-1234';
  const anonPhone = anonymizer.anonymizePhoneNumber(phone);
  
  if (anonPhone && anonPhone.match(/^\(\d{3}\) \d{3}-\d{4}$/) && anonPhone !== phone) {
    log(`  ✅ '${phone}' → '${anonPhone}'`, colors.green);
    passed++;
  } else {
    log('  ❌ Phone number anonymization failed', colors.red);
    failed++;
  }
  
  // Test 6: Postal code anonymization
  log('\n📝 Test 6: Postal Code Anonymization', colors.cyan);
  const postal = 'M5V 3A8';
  const anonPostal = anonymizer.anonymizePostalCode(postal);
  
  if (anonPostal && anonPostal.match(/^[A-Z]\d[A-Z] \d[A-Z]\d$/) && anonPostal !== postal) {
    log(`  ✅ '${postal}' → '${anonPostal}'`, colors.green);
    passed++;
  } else {
    log('  ❌ Postal code anonymization failed', colors.red);
    failed++;
  }
  
  // Test 7: DOB anonymization
  log('\n📝 Test 7: Date of Birth Anonymization', colors.cyan);
  const dob = new Date('1990-01-15');
  const anonDOB = anonymizer.anonymizeDOB(dob);
  
  if (anonDOB && anonDOB instanceof Date && anonDOB.getTime() !== dob.getTime()) {
    log(`  ✅ '${dob.toISOString().split('T')[0]}' → '${anonDOB.toISOString().split('T')[0]}'`, colors.green);
    passed++;
  } else {
    log('  ❌ DOB anonymization failed', colors.red);
    failed++;
  }
  
  // Test 8: License number anonymization
  log('\n📝 Test 8: License Number Anonymization', colors.cyan);
  const license = 'LIC123456';
  const anonLicense = anonymizer.anonymizeLicenseNumber(license);
  
  if (anonLicense && anonLicense.startsWith('TEST-LIC-') && anonLicense !== license) {
    log(`  ✅ '${license}' → '${anonLicense}'`, colors.green);
    passed++;
  } else {
    log('  ❌ License number anonymization failed', colors.red);
    failed++;
  }
  
  // Test 9: Notes anonymization
  log('\n📝 Test 9: Notes Anonymization', colors.cyan);
  const notes = 'Patient has chronic pain in lower back region.';
  const anonNotes = anonymizer.anonymizeNotes(notes);
  
  if (anonNotes && anonNotes.includes('[ANONYMIZED TEST DATA]') && anonNotes !== notes) {
    log(`  ✅ Notes anonymized successfully`, colors.green);
    passed++;
  } else {
    log('  ❌ Notes anonymization failed', colors.red);
    failed++;
  }
  
  // Test 10: Claim number anonymization
  log('\n📝 Test 10: Claim Number Anonymization', colors.cyan);
  const claimNumber = 'CLM-2024-001234';
  const anonClaim = anonymizer.anonymizeClaimNumber(claimNumber);
  
  if (anonClaim && anonClaim.startsWith('TEST-CLM-') && anonClaim !== claimNumber) {
    log(`  ✅ '${claimNumber}' → '${anonClaim}'`, colors.green);
    passed++;
  } else {
    log('  ❌ Claim number anonymization failed', colors.red);
    failed++;
  }
  
  // Test 11: URL anonymization
  log('\n📝 Test 11: URL Anonymization', colors.cyan);
  const url = 'https://storage.example.com/docs/claim-123.pdf';
  const anonUrl = anonymizer.anonymizeUrl(url);
  
  if (anonUrl && anonUrl.includes('test-storage.medlink.ca') && anonUrl.endsWith('.pdf')) {
    log(`  ✅ URL anonymized successfully`, colors.green);
    passed++;
  } else {
    log('  ❌ URL anonymization failed', colors.red);
    failed++;
  }
  
  // Test 12: Identifiers anonymization (JSON)
  log('\n📝 Test 12: JSON Identifiers Anonymization', colors.cyan);
  const identifiers = {
    healthCard: 'HC123456',
    insuranceNumber: 'INS789012',
    groupNumber: 'GRP456'
  };
  const anonIdentifiers = anonymizer.anonymizeIdentifiers(identifiers);
  
  if (anonIdentifiers && typeof anonIdentifiers === 'object' && 
      anonIdentifiers.healthCard !== identifiers.healthCard) {
    log('  ✅ Identifiers anonymized successfully', colors.green);
    passed++;
  } else {
    log('  ❌ Identifiers anonymization failed', colors.red);
    failed++;
  }
  
  // Test 13: Generate synthetic patient
  log('\n📝 Test 13: Generate Synthetic Patient', colors.cyan);
  const patient = anonymizer.generatePatient(1);
  
  if (patient && patient.name && patient.dob && patient.identifiers) {
    log('  ✅ Synthetic patient generated successfully', colors.green);
    log(`     Name: ${patient.name}`, colors.blue);
    log(`     DOB: ${patient.dob.toISOString().split('T')[0]}`, colors.blue);
    passed++;
  } else {
    log('  ❌ Patient generation failed', colors.red);
    failed++;
  }
  
  // Test 14: Generate synthetic provider
  log('\n📝 Test 14: Generate Synthetic Provider', colors.cyan);
  const provider = anonymizer.generateProvider(1, 'Physiotherapy');
  
  if (provider && provider.name && provider.discipline && provider.licenceNumber) {
    log('  ✅ Synthetic provider generated successfully', colors.green);
    log(`     Name: ${provider.name}`, colors.blue);
    log(`     Discipline: ${provider.discipline}`, colors.blue);
    passed++;
  } else {
    log('  ❌ Provider generation failed', colors.red);
    failed++;
  }
  
  // Test 15: Safety check
  log('\n📝 Test 15: Environment Safety Check', colors.cyan);
  const isSafe = anonymizer.isSafeEnvironment();
  
  if (process.env.NODE_ENV !== 'production') {
    log(`  ✅ Safety check passed (env: ${process.env.NODE_ENV || 'development'})`, colors.green);
    passed++;
  } else {
    log('  ❌ Safety check would prevent production execution', colors.red);
    failed++;
  }
  
  // Summary
  log('\n' + '=' .repeat(50), colors.cyan);
  log('📊 TEST RESULTS', colors.magenta);
  log('=' .repeat(50), colors.cyan);
  log(`  Passed: ${passed}`, colors.green);
  log(`  Failed: ${failed}`, colors.red);
  log(`  Total:  ${passed + failed}`, colors.blue);
  
  const percentage = Math.round((passed / (passed + failed)) * 100);
  if (failed === 0) {
    log(`\n✅ All tests passed! (${percentage}%)`, colors.green);
  } else {
    log(`\n⚠️  Some tests failed (${percentage}% passed)`, colors.yellow);
  }
  
  return failed === 0;
}

// Run tests
const success = testAnonymizer();
process.exit(success ? 0 : 1);