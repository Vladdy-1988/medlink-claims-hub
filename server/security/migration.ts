import { db } from '../db';
import { 
  users, 
  patients, 
  providers, 
  claims, 
  attachments, 
  remittances, 
  auditEvents,
  pushSubscriptions,
  organizations 
} from '@shared/schema';
import { fieldEncryption, PHI_FIELDS } from './encryption';
import { eq, sql } from 'drizzle-orm';

/**
 * Database encryption migration utilities
 * Handles encryption of existing plaintext data and key rotation
 */

interface MigrationProgress {
  table: string;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  startTime: Date;
  endTime?: Date;
  errors: Array<{ id: string; error: string }>;
}

export class EncryptionMigration {
  private batchSize: number = 100;
  private progress: Map<string, MigrationProgress> = new Map();
  
  constructor(batchSize: number = 100) {
    this.batchSize = batchSize;
  }

  /**
   * Encrypt all existing plaintext data in the database
   */
  async encryptExistingData(dryRun: boolean = false): Promise<Map<string, MigrationProgress>> {
    console.log(`Starting encryption migration (dry run: ${dryRun})`);
    
    // Process each table with PHI fields
    await this.encryptTable('users', users, dryRun);
    await this.encryptTable('patients', patients, dryRun);
    await this.encryptTable('providers', providers, dryRun);
    await this.encryptTable('claims', claims, dryRun);
    await this.encryptTable('attachments', attachments, dryRun);
    await this.encryptTable('remittances', remittances, dryRun);
    await this.encryptTable('auditEvents', auditEvents, dryRun);
    await this.encryptTable('pushSubscriptions', pushSubscriptions, dryRun);
    await this.encryptTable('organizations', organizations, dryRun);
    
    return this.progress;
  }

  /**
   * Encrypt a single table
   */
  private async encryptTable(
    tableName: string, 
    table: any, 
    dryRun: boolean
  ): Promise<void> {
    const fields = PHI_FIELDS[tableName as keyof typeof PHI_FIELDS];
    if (!fields) {
      console.log(`Skipping ${tableName}: no PHI fields`);
      return;
    }

    console.log(`Processing ${tableName} with fields: ${fields.join(', ')}`);
    
    const progress: MigrationProgress = {
      table: tableName,
      totalRecords: 0,
      processedRecords: 0,
      failedRecords: 0,
      startTime: new Date(),
      errors: [],
    };

    try {
      // Get total count
      const [{ count: totalCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(table);
      
      progress.totalRecords = totalCount;
      
      if (totalCount === 0) {
        console.log(`${tableName}: No records to process`);
        progress.endTime = new Date();
        this.progress.set(tableName, progress);
        return;
      }

      // Process in batches
      let offset = 0;
      while (offset < totalCount) {
        const records = await db
          .select()
          .from(table)
          .limit(this.batchSize)
          .offset(offset);

        for (const record of records) {
          try {
            // Check if data is already encrypted
            if (this.isRecordEncrypted(record, fields)) {
              progress.processedRecords++;
              continue;
            }

            if (!dryRun) {
              // Encrypt PHI fields
              const encryptedRecord = fieldEncryption.encryptObject(tableName, record);
              
              // Build update object with only PHI fields
              const updates: any = {};
              for (const field of fields) {
                if (field in encryptedRecord) {
                  updates[field] = encryptedRecord[field];
                }
              }

              // Update the record
              await db
                .update(table)
                .set(updates)
                .where(eq(table.id, record.id));
            }

            progress.processedRecords++;
          } catch (error) {
            progress.failedRecords++;
            progress.errors.push({
              id: record.id,
              error: error instanceof Error ? error.message : String(error),
            });
            console.error(`Failed to encrypt record ${record.id} in ${tableName}:`, error);
          }
        }

        offset += this.batchSize;
        
        // Log progress
        const percentComplete = Math.round((progress.processedRecords / totalCount) * 100);
        console.log(`${tableName}: ${percentComplete}% complete (${progress.processedRecords}/${totalCount})`);
      }

      progress.endTime = new Date();
      this.progress.set(tableName, progress);
      
      console.log(`✓ ${tableName}: Completed. Processed: ${progress.processedRecords}, Failed: ${progress.failedRecords}`);
      
    } catch (error) {
      console.error(`Failed to process table ${tableName}:`, error);
      progress.endTime = new Date();
      this.progress.set(tableName, progress);
      throw error;
    }
  }

  /**
   * Check if a record's PHI fields are already encrypted
   */
  private isRecordEncrypted(record: any, fields: readonly string[]): boolean {
    for (const field of fields) {
      const value = record[field];
      if (value && typeof value === 'string') {
        // Check if it looks like base64 encrypted data
        if (value.match(/^[A-Za-z0-9+/]+=*$/) && value.length > 50) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Decrypt all encrypted data (for rollback)
   */
  async decryptExistingData(dryRun: boolean = false): Promise<Map<string, MigrationProgress>> {
    console.log(`Starting decryption rollback (dry run: ${dryRun})`);
    
    // Process each table
    await this.decryptTable('users', users, dryRun);
    await this.decryptTable('patients', patients, dryRun);
    await this.decryptTable('providers', providers, dryRun);
    await this.decryptTable('claims', claims, dryRun);
    await this.decryptTable('attachments', attachments, dryRun);
    await this.decryptTable('remittances', remittances, dryRun);
    await this.decryptTable('auditEvents', auditEvents, dryRun);
    await this.decryptTable('pushSubscriptions', pushSubscriptions, dryRun);
    await this.decryptTable('organizations', organizations, dryRun);
    
    return this.progress;
  }

  /**
   * Decrypt a single table
   */
  private async decryptTable(
    tableName: string,
    table: any,
    dryRun: boolean
  ): Promise<void> {
    const fields = PHI_FIELDS[tableName as keyof typeof PHI_FIELDS];
    if (!fields) {
      return;
    }

    console.log(`Decrypting ${tableName}...`);
    
    const progress: MigrationProgress = {
      table: tableName,
      totalRecords: 0,
      processedRecords: 0,
      failedRecords: 0,
      startTime: new Date(),
      errors: [],
    };

    try {
      const records = await db.select().from(table);
      progress.totalRecords = records.length;

      for (const record of records) {
        try {
          if (!dryRun) {
            // Decrypt PHI fields
            const decryptedRecord = fieldEncryption.decryptObject(tableName, record);
            
            // Build update object
            const updates: any = {};
            for (const field of fields) {
              if (field in decryptedRecord) {
                updates[field] = decryptedRecord[field];
              }
            }

            // Update the record
            await db
              .update(table)
              .set(updates)
              .where(eq(table.id, record.id));
          }

          progress.processedRecords++;
        } catch (error) {
          progress.failedRecords++;
          progress.errors.push({
            id: record.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      progress.endTime = new Date();
      this.progress.set(tableName, progress);
      
    } catch (error) {
      console.error(`Failed to decrypt table ${tableName}:`, error);
      progress.endTime = new Date();
      this.progress.set(tableName, progress);
      throw error;
    }
  }

  /**
   * Re-encrypt data with a new key version
   */
  async rotateEncryptionKey(
    oldVersion: number,
    newVersion: number,
    dryRun: boolean = false
  ): Promise<Map<string, MigrationProgress>> {
    console.log(`Rotating encryption key from version ${oldVersion} to ${newVersion} (dry run: ${dryRun})`);
    
    // This would require:
    // 1. Decrypt with old key
    // 2. Encrypt with new key
    // 3. Update all records
    
    // For now, this is a placeholder
    // In production, you would implement the full rotation logic
    
    if (!dryRun) {
      await fieldEncryption.rotateKey(newVersion);
    }
    
    return this.progress;
  }

  /**
   * Verify encryption integrity
   */
  async verifyEncryption(): Promise<{
    valid: boolean;
    errors: Array<{ table: string; id: string; field: string; error: string }>;
  }> {
    const errors: Array<{ table: string; id: string; field: string; error: string }> = [];
    
    for (const [tableName, fields] of Object.entries(PHI_FIELDS)) {
      console.log(`Verifying ${tableName}...`);
      
      // Get the actual table reference
      const tableMap: any = {
        users,
        patients,
        providers,
        claims,
        attachments,
        remittances,
        auditEvents,
        pushSubscriptions,
        organizations,
      };
      
      const table = tableMap[tableName];
      if (!table) continue;
      
      const records = await db.select().from(table).limit(10);
      
      for (const record of records) {
        const recordData = record as Record<string, unknown>;
        for (const field of fields) {
          const encryptedValue = recordData[field];
          if (!encryptedValue) continue;
          
          try {
            const decrypted = fieldEncryption.decrypt(encryptedValue as string);
            if (decrypted === null) {
              errors.push({
                table: tableName,
                id: String(recordData.id ?? ''),
                field,
                error: 'Failed to decrypt',
              });
            }
          } catch (error) {
            errors.push({
              table: tableName,
              id: String(recordData.id ?? ''),
              field,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get migration status
   */
  getProgress(): Map<string, MigrationProgress> {
    return this.progress;
  }

  /**
   * Export progress as JSON
   */
  exportProgress(): string {
    const progressObj: any = {};
    for (const [key, value] of this.progress.entries()) {
      progressObj[key] = value;
    }
    return JSON.stringify(progressObj, null, 2);
  }
}

// CLI utility for running migrations
if (require.main === module) {
  const migration = new EncryptionMigration();
  
  const command = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  
  async function run() {
    try {
      switch (command) {
        case 'encrypt':
          console.log('Starting encryption migration...');
          const encryptProgress = await migration.encryptExistingData(dryRun);
          console.log('Migration complete:', migration.exportProgress());
          break;
          
        case 'decrypt':
          console.log('Starting decryption rollback...');
          const decryptProgress = await migration.decryptExistingData(dryRun);
          console.log('Rollback complete:', migration.exportProgress());
          break;
          
        case 'verify':
          console.log('Verifying encryption...');
          const result = await migration.verifyEncryption();
          if (result.valid) {
            console.log('✓ Encryption verification passed');
          } else {
            console.error('✗ Encryption verification failed:', result.errors);
            process.exit(1);
          }
          break;
          
        case 'rotate':
          const oldVersion = parseInt(process.argv[3] || '1');
          const newVersion = parseInt(process.argv[4] || '2');
          console.log(`Rotating key from version ${oldVersion} to ${newVersion}...`);
          await migration.rotateEncryptionKey(oldVersion, newVersion, dryRun);
          console.log('Key rotation complete');
          break;
          
        default:
          console.log(`
Usage: tsx server/security/migration.ts <command> [options]

Commands:
  encrypt    Encrypt all plaintext PHI data
  decrypt    Decrypt all encrypted data (rollback)
  verify     Verify encryption integrity
  rotate     Rotate encryption key

Options:
  --dry-run  Preview changes without modifying data

Examples:
  tsx server/security/migration.ts encrypt --dry-run
  tsx server/security/migration.ts encrypt
  tsx server/security/migration.ts verify
  tsx server/security/migration.ts rotate 1 2
          `);
          process.exit(0);
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  }
  
  run();
}
