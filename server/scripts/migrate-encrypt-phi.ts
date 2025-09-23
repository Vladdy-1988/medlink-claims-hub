/**
 * Data Migration Script - Encrypt Existing Plaintext PHI
 * This script encrypts existing plaintext PHI data in the database
 * Run with: npx tsx server/scripts/migrate-encrypt-phi.ts
 */

import { db } from '../db';
import { patients, users, providers, claims, preAuths, appointments } from '@shared/schema';
import { encryptPHI, hashForSearch, verifyEncryption } from '../security/field-encryption';
import { eq, sql, isNull, or } from 'drizzle-orm';

// Set encryption key for migration
if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY environment variable is required');
  process.exit(1);
}

// Verify encryption is working
if (!verifyEncryption()) {
  console.error('❌ Encryption verification failed');
  process.exit(1);
}

console.log('🔐 Starting PHI data encryption migration...');

async function isAlreadyEncrypted(value: string | null): Promise<boolean> {
  if (!value) return true;
  // Check if value looks like base64 encrypted data
  return /^[A-Za-z0-9+/]+=*$/.test(value) && value.length > 64;
}

async function migrateUsers() {
  console.log('\n📋 Migrating users table...');
  
  try {
    // Get all users that may need encryption
    const allUsers = await db.select().from(users);
    let encryptedCount = 0;
    
    for (const user of allUsers) {
      let needsUpdate = false;
      const updates: any = {};
      
      // Check and encrypt email
      if (user.email && !(await isAlreadyEncrypted(user.email))) {
        updates.email = encryptPHI(user.email);
        updates.email_hash = hashForSearch(user.email);
        needsUpdate = true;
      }
      
      // Check and encrypt phone
      if (user.phone && !(await isAlreadyEncrypted(user.phone))) {
        updates.phone = encryptPHI(user.phone);
        updates.phone_hash = hashForSearch(user.phone);
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await db.update(users)
          .set(updates)
          .where(eq(users.id, user.id));
        encryptedCount++;
        console.log(`  ✅ Encrypted PHI for user ${user.id}`);
      }
    }
    
    console.log(`  📊 Encrypted ${encryptedCount}/${allUsers.length} user records`);
  } catch (error) {
    console.error('  ❌ Error migrating users:', error);
    throw error;
  }
}

async function migratePatients() {
  console.log('\n📋 Migrating patients table...');
  
  try {
    const allPatients = await db.select().from(patients);
    let encryptedCount = 0;
    
    for (const patient of allPatients) {
      let needsUpdate = false;
      const updates: any = {};
      
      // Check and encrypt name
      if (patient.name && !(await isAlreadyEncrypted(patient.name))) {
        updates.name = encryptPHI(patient.name);
        needsUpdate = true;
      }
      
      // Check and encrypt email
      if (patient.email && !(await isAlreadyEncrypted(patient.email))) {
        updates.email = encryptPHI(patient.email);
        updates.email_hash = hashForSearch(patient.email);
        needsUpdate = true;
      }
      
      // Check and encrypt phone
      if (patient.phone && !(await isAlreadyEncrypted(patient.phone))) {
        updates.phone = encryptPHI(patient.phone);
        updates.phone_hash = hashForSearch(patient.phone);
        needsUpdate = true;
      }
      
      // Check and encrypt address
      if (patient.address && !(await isAlreadyEncrypted(patient.address))) {
        updates.address = encryptPHI(patient.address);
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await db.update(patients)
          .set(updates)
          .where(eq(patients.id, patient.id));
        encryptedCount++;
        console.log(`  ✅ Encrypted PHI for patient ${patient.id}`);
      }
    }
    
    console.log(`  📊 Encrypted ${encryptedCount}/${allPatients.length} patient records`);
  } catch (error) {
    console.error('  ❌ Error migrating patients:', error);
    throw error;
  }
}

async function migrateProviders() {
  console.log('\n📋 Migrating providers table...');
  
  try {
    const allProviders = await db.select().from(providers);
    let encryptedCount = 0;
    
    for (const provider of allProviders) {
      let needsUpdate = false;
      const updates: any = {};
      
      // Check and encrypt email
      if (provider.email && !(await isAlreadyEncrypted(provider.email))) {
        updates.email = encryptPHI(provider.email);
        updates.email_hash = hashForSearch(provider.email);
        needsUpdate = true;
      }
      
      // Check and encrypt phone
      if (provider.phone && !(await isAlreadyEncrypted(provider.phone))) {
        updates.phone = encryptPHI(provider.phone);
        updates.phone_hash = hashForSearch(provider.phone);
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await db.update(providers)
          .set(updates)
          .where(eq(providers.id, provider.id));
        encryptedCount++;
        console.log(`  ✅ Encrypted PHI for provider ${provider.id}`);
      }
    }
    
    console.log(`  📊 Encrypted ${encryptedCount}/${allProviders.length} provider records`);
  } catch (error) {
    console.error('  ❌ Error migrating providers:', error);
    throw error;
  }
}

async function migrateClaims() {
  console.log('\n📋 Migrating claims table...');
  
  try {
    const allClaims = await db.select().from(claims);
    let encryptedCount = 0;
    
    for (const claim of allClaims) {
      if (claim.notes && !(await isAlreadyEncrypted(claim.notes))) {
        await db.update(claims)
          .set({
            notes: encryptPHI(claim.notes)
          })
          .where(eq(claims.id, claim.id));
        encryptedCount++;
        console.log(`  ✅ Encrypted notes for claim ${claim.id}`);
      }
    }
    
    console.log(`  📊 Encrypted ${encryptedCount}/${allClaims.length} claim records`);
  } catch (error) {
    console.error('  ❌ Error migrating claims:', error);
    throw error;
  }
}

async function migratePreAuths() {
  console.log('\n📋 Migrating preauths table...');
  
  try {
    const allPreAuths = await db.select().from(preAuths);
    let encryptedCount = 0;
    
    for (const preAuth of allPreAuths) {
      if (preAuth.notes && !(await isAlreadyEncrypted(preAuth.notes))) {
        await db.update(preAuths)
          .set({
            notes: encryptPHI(preAuth.notes)
          })
          .where(eq(preAuths.id, preAuth.id));
        encryptedCount++;
        console.log(`  ✅ Encrypted notes for preauth ${preAuth.id}`);
      }
    }
    
    console.log(`  📊 Encrypted ${encryptedCount}/${allPreAuths.length} preauth records`);
  } catch (error) {
    console.error('  ❌ Error migrating preauths:', error);
    throw error;
  }
}

// Main migration function
async function runMigration() {
  try {
    console.log('\n🚀 Starting PHI encryption migration...');
    console.log('   ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? '✅ Set' : '❌ Missing');
    
    // Test database connection
    await db.execute(sql`SELECT 1`);
    console.log('   Database connection: ✅ Connected\n');
    
    // Run migrations for each table
    await migrateUsers();
    await migratePatients();
    await migrateProviders();
    await migrateClaims();
    await migratePreAuths();
    
    console.log('\n✅ PHI encryption migration completed successfully!');
    console.log('   All plaintext PHI has been encrypted with field-level encryption');
    console.log('   Searchable hash fields have been populated for email and phone');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('   Please fix the error and run the migration again');
    process.exit(1);
  }
}

// Run the migration
runMigration();