#!/usr/bin/env tsx
/**
 * Anonymize staging database - replaces all PHI with synthetic data
 * SAFETY: Only runs in staging/test environments, never in production
 */

import { db } from '../db';
import { DataAnonymizer } from '../security/anonymizer';
import { 
  users, 
  patients, 
  providers, 
  claims, 
  organizations, 
  attachments,
  auditEvents,
  remittances,
  connectorTransactions,
  preAuths
} from '@shared/schema';
import { sql } from 'drizzle-orm';
import * as readline from 'readline';
import { promisify } from 'util';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = promisify(rl.question).bind(rl);

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class StagingAnonymizer {
  private anonymizer: DataAnonymizer;
  private dryRun: boolean = false;
  private stats = {
    users: 0,
    patients: 0,
    providers: 0,
    claims: 0,
    organizations: 0,
    attachments: 0,
    auditEvents: 0,
    remittances: 0,
    preAuths: 0,
    totalRecords: 0,
    startTime: Date.now(),
    errors: [] as string[]
  };

  constructor() {
    this.anonymizer = new DataAnonymizer('staging-anonymization');
  }

  /**
   * Print colored message to console
   */
  private log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  /**
   * Print progress update
   */
  private progress(table: string, current: number, total: number) {
    const percentage = Math.round((current / total) * 100);
    process.stdout.write(`\r${colors.cyan}[${table}] Progress: ${current}/${total} (${percentage}%)${colors.reset}`);
  }

  /**
   * Safety check - ensure we're not in production
   */
  private async safetyCheck(): Promise<boolean> {
    this.log('\n🔒 SAFETY CHECK', colors.yellow);
    this.log('=' .repeat(50));

    // Check environment
    const env = process.env.NODE_ENV;
    const dbUrl = process.env.DATABASE_URL || '';
    
    this.log(`Environment: ${env}`, colors.blue);
    this.log(`Database: ${dbUrl.substring(0, 30)}...`, colors.blue);

    // Verify not production
    if (!this.anonymizer.isSafeEnvironment()) {
      this.log('\n❌ ERROR: Cannot run anonymization in production environment!', colors.red);
      this.log('This script is only for staging/test environments.', colors.red);
      return false;
    }

    // Check for production keywords in database URL
    const dangerousKeywords = ['prod', 'production', 'live', 'master'];
    const lowerDbUrl = dbUrl.toLowerCase();
    
    for (const keyword of dangerousKeywords) {
      if (lowerDbUrl.includes(keyword)) {
        this.log(`\n❌ ERROR: Database URL contains '${keyword}'!`, colors.red);
        this.log('This appears to be a production database.', colors.red);
        return false;
      }
    }

    // Must contain staging or dev keywords
    const safeKeywords = ['staging', 'test', 'dev', 'localhost'];
    let isSafe = false;
    
    for (const keyword of safeKeywords) {
      if (lowerDbUrl.includes(keyword)) {
        isSafe = true;
        this.log(`✅ Database URL contains '${keyword}' - appears to be safe`, colors.green);
        break;
      }
    }

    if (!isSafe) {
      this.log('\n⚠️  WARNING: Database URL does not contain staging/test/dev keywords', colors.yellow);
    }

    return true;
  }

  /**
   * Get user confirmation
   */
  private async getConfirmation(): Promise<boolean> {
    this.log('\n' + '⚠️  WARNING '.repeat(5), colors.yellow);
    this.log('This will PERMANENTLY anonymize ALL data in the database!', colors.red);
    this.log('All PHI will be replaced with synthetic test data.', colors.red);
    this.log('This action CANNOT be undone!', colors.red);
    this.log('=' .repeat(50));

    const answer = await question(`\n${colors.yellow}Type 'ANONYMIZE STAGING' to confirm: ${colors.reset}`);
    
    if (answer !== 'ANONYMIZE STAGING') {
      this.log('\n❌ Confirmation not received. Aborting.', colors.red);
      return false;
    }

    const dryRunAnswer = await question(`\n${colors.cyan}Perform dry run first? (recommended) [y/n]: ${colors.reset}`);
    this.dryRun = dryRunAnswer.toLowerCase() === 'y';

    if (this.dryRun) {
      this.log('\n🔍 DRY RUN MODE - No data will be modified', colors.green);
    }

    return true;
  }

  /**
   * Create backup metadata
   */
  private async createBackupMetadata() {
    if (this.dryRun) return;

    const timestamp = new Date().toISOString();
    this.log(`\n📦 Creating backup metadata at ${timestamp}`, colors.blue);
    
    // Create audit event for anonymization
    await db.insert(auditEvents).values({
      orgId: (await db.select().from(organizations).limit(1))[0]?.id,
      type: 'data_anonymization',
      details: {
        timestamp,
        environment: process.env.NODE_ENV,
        stats: this.stats,
        message: 'Staging data anonymized for testing'
      },
      createdAt: new Date()
    });
  }

  /**
   * Anonymize users table
   */
  private async anonymizeUsers() {
    this.log('\n\n📋 Anonymizing Users...', colors.cyan);
    
    const allUsers = await db.select().from(users);
    let processed = 0;

    for (const user of allUsers) {
      processed++;
      this.progress('users', processed, allUsers.length);

      const updates = {
        firstName: this.anonymizer.anonymizeFirstName(user.firstName),
        lastName: this.anonymizer.anonymizeLastName(user.lastName),
        email: this.anonymizer.anonymizeEmail(user.email),
        profileImageUrl: user.profileImageUrl ? 'https://test.medlink.ca/avatar-placeholder.jpg' : null,
        mfaSecret: null, // Clear MFA for test environment
        mfaBackupCodes: null,
        mfaEnabled: false
      };

      if (!this.dryRun) {
        await db.update(users)
          .set(updates)
          .where(sql`${users.id} = ${user.id}`);
      }

      this.stats.users++;
    }

    this.log(`\n✅ Anonymized ${this.stats.users} users`, colors.green);
  }

  /**
   * Anonymize patients table
   */
  private async anonymizePatients() {
    this.log('\n📋 Anonymizing Patients...', colors.cyan);
    
    const allPatients = await db.select().from(patients);
    let processed = 0;

    for (const patient of allPatients) {
      processed++;
      this.progress('patients', processed, allPatients.length);

      const updates = {
        name: this.anonymizer.anonymizeName(patient.name),
        dob: patient.dob ? this.anonymizer.anonymizeDOB(patient.dob) : null,
        identifiers: this.anonymizer.anonymizeIdentifiers(patient.identifiers)
      };

      if (!this.dryRun) {
        await db.update(patients)
          .set(updates)
          .where(sql`${patients.id} = ${patient.id}`);
      }

      this.stats.patients++;
    }

    this.log(`\n✅ Anonymized ${this.stats.patients} patients`, colors.green);
  }

  /**
   * Anonymize providers table
   */
  private async anonymizeProviders() {
    this.log('\n📋 Anonymizing Providers...', colors.cyan);
    
    const allProviders = await db.select().from(providers);
    let processed = 0;

    for (const provider of allProviders) {
      processed++;
      this.progress('providers', processed, allProviders.length);

      const updates = {
        name: this.anonymizer.anonymizeName(provider.name),
        licenceNumber: this.anonymizer.anonymizeLicenseNumber(provider.licenceNumber)
      };

      if (!this.dryRun) {
        await db.update(providers)
          .set(updates)
          .where(sql`${providers.id} = ${provider.id}`);
      }

      this.stats.providers++;
    }

    this.log(`\n✅ Anonymized ${this.stats.providers} providers`, colors.green);
  }

  /**
   * Anonymize claims table
   */
  private async anonymizeClaims() {
    this.log('\n📋 Anonymizing Claims...', colors.cyan);
    
    const allClaims = await db.select().from(claims);
    let processed = 0;

    for (const claim of allClaims) {
      processed++;
      this.progress('claims', processed, allClaims.length);

      const updates = {
        claimNumber: this.anonymizer.anonymizeClaimNumber(claim.claimNumber),
        notes: this.anonymizer.anonymizeNotes(claim.notes),
        referenceNumber: claim.referenceNumber ? 
          this.anonymizer.anonymizeReferenceNumber(claim.referenceNumber) : null,
        externalId: claim.externalId ? 
          this.anonymizer.anonymizeReferenceNumber(claim.externalId) : null,
        portalReferenceNumber: claim.portalReferenceNumber ?
          this.anonymizer.anonymizeReferenceNumber(claim.portalReferenceNumber) : null
      };

      if (!this.dryRun) {
        await db.update(claims)
          .set(updates)
          .where(sql`${claims.id} = ${claim.id}`);
      }

      this.stats.claims++;
    }

    this.log(`\n✅ Anonymized ${this.stats.claims} claims`, colors.green);
  }

  /**
   * Anonymize preAuths table
   */
  private async anonymizePreAuths() {
    this.log('\n📋 Anonymizing Pre-Authorizations...', colors.cyan);
    
    const allPreAuths = await db.select().from(preAuths);
    let processed = 0;

    for (const preAuth of allPreAuths) {
      processed++;
      this.progress('preAuths', processed, allPreAuths.length);

      const updates = {
        authNumber: this.anonymizer.anonymizeReferenceNumber(preAuth.authNumber),
        notes: this.anonymizer.anonymizeNotes(preAuth.notes)
      };

      if (!this.dryRun) {
        await db.update(preAuths)
          .set(updates)
          .where(sql`${preAuths.id} = ${preAuth.id}`);
      }

      this.stats.preAuths++;
    }

    this.log(`\n✅ Anonymized ${this.stats.preAuths} pre-authorizations`, colors.green);
  }

  /**
   * Anonymize organizations table
   */
  private async anonymizeOrganizations() {
    this.log('\n📋 Anonymizing Organizations...', colors.cyan);
    
    const allOrgs = await db.select().from(organizations);
    let processed = 0;

    for (const org of allOrgs) {
      processed++;
      this.progress('organizations', processed, allOrgs.length);

      const updates = {
        name: `TEST-${org.name}`,
        privacyOfficerName: org.privacyOfficerName ? 
          this.anonymizer.anonymizeName(org.privacyOfficerName) : null,
        privacyOfficerEmail: org.privacyOfficerEmail ? 
          this.anonymizer.anonymizeEmail(org.privacyOfficerEmail) : null,
        privacyContactUrl: org.privacyContactUrl ?
          'https://test.medlink.ca/privacy' : null
      };

      if (!this.dryRun) {
        await db.update(organizations)
          .set(updates)
          .where(sql`${organizations.id} = ${org.id}`);
      }

      this.stats.organizations++;
    }

    this.log(`\n✅ Anonymized ${this.stats.organizations} organizations`, colors.green);
  }

  /**
   * Anonymize attachments table
   */
  private async anonymizeAttachments() {
    this.log('\n📋 Anonymizing Attachments...', colors.cyan);
    
    const allAttachments = await db.select().from(attachments);
    let processed = 0;

    for (const attachment of allAttachments) {
      processed++;
      this.progress('attachments', processed, allAttachments.length);

      const updates = {
        url: this.anonymizer.anonymizeUrl(attachment.url)
      };

      if (!this.dryRun) {
        await db.update(attachments)
          .set(updates)
          .where(sql`${attachments.id} = ${attachment.id}`);
      }

      this.stats.attachments++;
    }

    this.log(`\n✅ Anonymized ${this.stats.attachments} attachments`, colors.green);
  }

  /**
   * Anonymize audit events (clear sensitive details)
   */
  private async anonymizeAuditEvents() {
    this.log('\n📋 Anonymizing Audit Events...', colors.cyan);
    
    const allEvents = await db.select().from(auditEvents);
    let processed = 0;

    for (const event of allEvents) {
      processed++;
      this.progress('auditEvents', processed, allEvents.length);

      // Sanitize details object
      let sanitizedDetails = event.details;
      if (typeof sanitizedDetails === 'object' && sanitizedDetails !== null) {
        sanitizedDetails = {
          ...sanitizedDetails as any,
          anonymized: true,
          originalData: '[REDACTED]',
          userInfo: '[ANONYMIZED]'
        };
      }

      const updates = {
        details: sanitizedDetails,
        ip: '127.0.0.1',
        userAgent: 'TEST-BROWSER/1.0'
      };

      if (!this.dryRun) {
        await db.update(auditEvents)
          .set(updates)
          .where(sql`${auditEvents.id} = ${event.id}`);
      }

      this.stats.auditEvents++;
    }

    this.log(`\n✅ Anonymized ${this.stats.auditEvents} audit events`, colors.green);
  }

  /**
   * Print final statistics
   */
  private printStats() {
    const duration = (Date.now() - this.stats.startTime) / 1000;
    this.stats.totalRecords = 
      this.stats.users + 
      this.stats.patients + 
      this.stats.providers + 
      this.stats.claims + 
      this.stats.organizations + 
      this.stats.attachments + 
      this.stats.auditEvents +
      this.stats.remittances +
      this.stats.preAuths;

    this.log('\n\n' + '=' .repeat(50), colors.cyan);
    this.log('📊 ANONYMIZATION COMPLETE', colors.green);
    this.log('=' .repeat(50), colors.cyan);
    
    this.log('\nStatistics:', colors.yellow);
    this.log(`  • Users:          ${this.stats.users}`, colors.blue);
    this.log(`  • Patients:       ${this.stats.patients}`, colors.blue);
    this.log(`  • Providers:      ${this.stats.providers}`, colors.blue);
    this.log(`  • Claims:         ${this.stats.claims}`, colors.blue);
    this.log(`  • Pre-Auths:      ${this.stats.preAuths}`, colors.blue);
    this.log(`  • Organizations:  ${this.stats.organizations}`, colors.blue);
    this.log(`  • Attachments:    ${this.stats.attachments}`, colors.blue);
    this.log(`  • Audit Events:   ${this.stats.auditEvents}`, colors.blue);
    
    this.log(`\n  Total Records:    ${this.stats.totalRecords}`, colors.green);
    this.log(`  Duration:         ${duration.toFixed(2)} seconds`, colors.green);
    
    if (this.stats.errors.length > 0) {
      this.log('\n⚠️  Errors encountered:', colors.red);
      this.stats.errors.forEach(err => this.log(`  • ${err}`, colors.red));
    }

    if (this.dryRun) {
      this.log('\n🔍 DRY RUN COMPLETE - No data was modified', colors.yellow);
      this.log('Run without dry run to actually anonymize the data.', colors.yellow);
    } else {
      this.log('\n✅ All PHI has been anonymized with TEST data', colors.green);
      this.log('⚠️  This database now contains ONLY synthetic test data', colors.yellow);
    }
  }

  /**
   * Run the anonymization process
   */
  async run() {
    try {
      this.log('\n🚀 STAGING DATA ANONYMIZER', colors.magenta);
      this.log('=' .repeat(50));

      // Safety checks
      if (!await this.safetyCheck()) {
        process.exit(1);
      }

      // Get confirmation
      if (!await this.getConfirmation()) {
        process.exit(0);
      }

      // Create backup metadata
      await this.createBackupMetadata();

      // Anonymize each table
      await this.anonymizeUsers();
      await this.anonymizePatients();
      await this.anonymizeProviders();
      await this.anonymizeClaims();
      await this.anonymizePreAuths();
      await this.anonymizeOrganizations();
      await this.anonymizeAttachments();
      await this.anonymizeAuditEvents();

      // Print statistics
      this.printStats();

      rl.close();
      process.exit(0);

    } catch (error) {
      this.log(`\n❌ ERROR: ${error}`, colors.red);
      this.stats.errors.push(String(error));
      rl.close();
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const anonymizer = new StagingAnonymizer();
  anonymizer.run();
}

export default StagingAnonymizer;