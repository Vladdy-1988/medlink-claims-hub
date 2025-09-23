#!/usr/bin/env tsx
/**
 * Generate synthetic test data for development and testing
 * Creates realistic but completely fake data for all tables
 */

import { db } from '../db';
import { DataAnonymizer } from '../security/anonymizer';
import { faker } from '@faker-js/faker';
import { 
  users, 
  organizations,
  patients, 
  providers, 
  insurers,
  claims, 
  attachments,
  auditEvents,
  appointments,
  remittances,
  preAuths,
  connectorConfigs,
  connectorTransactions,
  pushSubscriptions
} from '@shared/schema';
import { sql } from 'drizzle-orm';
import * as readline from 'readline';
import { promisify } from 'util';

// Set up faker with Canadian locale
faker.locale = 'en_CA';

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

interface GenerationConfig {
  organizations: number;
  usersPerOrg: number;
  patientsPerOrg: number;
  providersPerOrg: number;
  claimsPerPatient: number;
  attachmentsPerClaim: number;
  preAuthsPerOrg: number;
  auditEventsPerOrg: number;
}

class TestDataGenerator {
  private anonymizer: DataAnonymizer;
  private config: GenerationConfig;
  private createdIds = {
    organizations: [] as string[],
    users: [] as string[],
    patients: [] as string[],
    providers: [] as string[],
    insurers: [] as string[],
    claims: [] as string[],
    appointments: [] as string[]
  };
  private stats = {
    organizations: 0,
    users: 0,
    patients: 0,
    providers: 0,
    insurers: 0,
    claims: 0,
    attachments: 0,
    appointments: 0,
    remittances: 0,
    preAuths: 0,
    auditEvents: 0,
    connectorConfigs: 0,
    connectorTransactions: 0,
    pushSubscriptions: 0,
    startTime: Date.now(),
    errors: [] as string[]
  };

  constructor(config?: Partial<GenerationConfig>) {
    this.anonymizer = new DataAnonymizer('test-data-generator');
    this.config = {
      organizations: 2,
      usersPerOrg: 5,
      patientsPerOrg: 20,
      providersPerOrg: 10,
      claimsPerPatient: 3,
      attachmentsPerClaim: 2,
      preAuthsPerOrg: 5,
      auditEventsPerOrg: 50,
      ...config
    };
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
  private progress(message: string) {
    process.stdout.write(`\r${colors.cyan}${message}${colors.reset}`);
  }

  /**
   * Safety check - ensure we're not in production
   */
  private async safetyCheck(): Promise<boolean> {
    this.log('\n🔒 SAFETY CHECK', colors.yellow);
    this.log('=' .repeat(50));

    const env = process.env.NODE_ENV;
    const dbUrl = process.env.DATABASE_URL || '';
    
    this.log(`Environment: ${env}`, colors.blue);
    this.log(`Database: ${dbUrl.substring(0, 30)}...`, colors.blue);

    if (!this.anonymizer.isSafeEnvironment()) {
      this.log('\n❌ ERROR: Cannot generate test data in production!', colors.red);
      return false;
    }

    this.log('✅ Safe environment detected', colors.green);
    return true;
  }

  /**
   * Get user confirmation
   */
  private async getConfirmation(): Promise<boolean> {
    this.log('\n' + '=' .repeat(50));
    this.log('📊 TEST DATA GENERATION PLAN', colors.cyan);
    this.log('=' .repeat(50));
    
    this.log('\nThis will generate:', colors.yellow);
    this.log(`  • ${this.config.organizations} Organizations`, colors.blue);
    this.log(`  • ${this.config.organizations * this.config.usersPerOrg} Users`, colors.blue);
    this.log(`  • ${this.config.organizations * this.config.patientsPerOrg} Patients`, colors.blue);
    this.log(`  • ${this.config.organizations * this.config.providersPerOrg} Providers`, colors.blue);
    
    const totalClaims = this.config.organizations * this.config.patientsPerOrg * this.config.claimsPerPatient;
    this.log(`  • ~${totalClaims} Claims`, colors.blue);
    this.log(`  • ~${totalClaims * this.config.attachmentsPerClaim} Attachments`, colors.blue);
    
    this.log('\n⚠️  WARNING: This will ADD synthetic data to the database', colors.yellow);
    this.log('Consider clearing existing data first if needed.', colors.yellow);

    const answer = await question(`\n${colors.cyan}Continue? [y/n]: ${colors.reset}`);
    return answer.toLowerCase() === 'y';
  }

  /**
   * Generate organizations
   */
  private async generateOrganizations() {
    this.log('\n\n🏢 Generating Organizations...', colors.cyan);
    
    const provinces = ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE'];
    
    for (let i = 0; i < this.config.organizations; i++) {
      this.progress(`Creating organization ${i + 1}/${this.config.organizations}`);
      
      const orgName = `TEST-${faker.company.name()}`;
      const province = provinces[i % provinces.length];
      
      const [org] = await db.insert(organizations).values({
        name: orgName,
        externalId: `TEST-EXT-ORG-${i + 1}`,
        province,
        preferredLanguage: province === 'QC' ? 'fr-CA' : 'en-CA',
        privacyOfficerName: `TEST-${faker.person.fullName()}`,
        privacyOfficerEmail: `test.privacy.${i}@staging.medlink.ca`,
        dataRetentionDays: 2555, // ~7 years
        privacyContactUrl: 'https://test.medlink.ca/privacy',
        minimizeLogging: true,
        createdAt: faker.date.past({ years: 2 })
      }).returning();
      
      this.createdIds.organizations.push(org.id);
      this.stats.organizations++;
    }
    
    this.log(`\n✅ Generated ${this.stats.organizations} organizations`, colors.green);
  }

  /**
   * Generate users
   */
  private async generateUsers() {
    this.log('\n👥 Generating Users...', colors.cyan);
    
    const roles = ['provider', 'billing', 'admin'];
    
    for (const orgId of this.createdIds.organizations) {
      for (let i = 0; i < this.config.usersPerOrg; i++) {
        this.progress(`Creating user ${this.stats.users + 1}/${this.config.organizations * this.config.usersPerOrg}`);
        
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const role = i === 0 ? 'admin' : roles[i % roles.length];
        
        const [user] = await db.insert(users).values({
          email: `test.${firstName.toLowerCase()}.${lastName.toLowerCase()}.${this.stats.users}@staging.medlink.ca`,
          firstName: `TEST-${firstName}`,
          lastName: lastName,
          profileImageUrl: faker.image.avatar(),
          role,
          orgId,
          notificationsEnabled: faker.datatype.boolean(),
          preferredLanguage: faker.helpers.arrayElement(['en-CA', 'fr-CA']),
          mfaEnabled: false,
          createdAt: faker.date.past({ years: 1 })
        }).returning();
        
        this.createdIds.users.push(user.id);
        this.stats.users++;
      }
    }
    
    this.log(`\n✅ Generated ${this.stats.users} users`, colors.green);
  }

  /**
   * Generate insurers
   */
  private async generateInsurers() {
    this.log('\n🏦 Generating Insurers...', colors.cyan);
    
    const insurerList = [
      { name: 'TEST-Sun Life', rail: 'telusEclaims' },
      { name: 'TEST-Manulife', rail: 'telusEclaims' },
      { name: 'TEST-Great West Life', rail: 'cdanet' },
      { name: 'TEST-WSIB Ontario', rail: 'portal' },
      { name: 'TEST-CNESST Quebec', rail: 'portal' },
      { name: 'TEST-Blue Cross', rail: 'cdanet' },
      { name: 'TEST-Green Shield', rail: 'telusEclaims' },
      { name: 'TEST-Desjardins', rail: 'cdanet' },
      { name: 'TEST-Industrial Alliance', rail: 'telusEclaims' },
      { name: 'TEST-Canada Life', rail: 'cdanet' }
    ];
    
    for (const insurerData of insurerList) {
      this.progress(`Creating insurer ${this.stats.insurers + 1}/${insurerList.length}`);
      
      const [insurer] = await db.insert(insurers).values({
        name: insurerData.name,
        rail: insurerData.rail as any,
        createdAt: faker.date.past({ years: 3 })
      }).returning();
      
      this.createdIds.insurers.push(insurer.id);
      this.stats.insurers++;
    }
    
    this.log(`\n✅ Generated ${this.stats.insurers} insurers`, colors.green);
  }

  /**
   * Generate patients
   */
  private async generatePatients() {
    this.log('\n🏥 Generating Patients...', colors.cyan);
    
    for (const orgId of this.createdIds.organizations) {
      for (let i = 0; i < this.config.patientsPerOrg; i++) {
        this.progress(`Creating patient ${this.stats.patients + 1}/${this.config.organizations * this.config.patientsPerOrg}`);
        
        const patientData = this.anonymizer.generatePatient(this.stats.patients);
        
        const [patient] = await db.insert(patients).values({
          orgId,
          name: patientData.name,
          dob: patientData.dob,
          identifiers: patientData.identifiers,
          createdAt: faker.date.past({ years: 2 })
        }).returning();
        
        this.createdIds.patients.push(patient.id);
        this.stats.patients++;
      }
    }
    
    this.log(`\n✅ Generated ${this.stats.patients} patients`, colors.green);
  }

  /**
   * Generate providers
   */
  private async generateProviders() {
    this.log('\n👨‍⚕️ Generating Providers...', colors.cyan);
    
    const disciplines = [
      'Physiotherapy',
      'Chiropractic',
      'Massage Therapy',
      'Occupational Therapy',
      'Psychology',
      'Speech Therapy',
      'Naturopathy',
      'Acupuncture',
      'Podiatry',
      'Dietetics'
    ];
    
    for (const orgId of this.createdIds.organizations) {
      for (let i = 0; i < this.config.providersPerOrg; i++) {
        this.progress(`Creating provider ${this.stats.providers + 1}/${this.config.organizations * this.config.providersPerOrg}`);
        
        const providerData = this.anonymizer.generateProvider(this.stats.providers, disciplines[i % disciplines.length]);
        
        const [provider] = await db.insert(providers).values({
          orgId,
          name: providerData.name,
          discipline: providerData.discipline,
          licenceNumber: providerData.licenceNumber,
          createdAt: faker.date.past({ years: 3 })
        }).returning();
        
        this.createdIds.providers.push(provider.id);
        this.stats.providers++;
      }
    }
    
    this.log(`\n✅ Generated ${this.stats.providers} providers`, colors.green);
  }

  /**
   * Generate appointments
   */
  private async generateAppointments() {
    this.log('\n📅 Generating Appointments...', colors.cyan);
    
    const totalAppointments = this.config.organizations * this.config.patientsPerOrg * 2;
    
    for (let i = 0; i < totalAppointments; i++) {
      this.progress(`Creating appointment ${i + 1}/${totalAppointments}`);
      
      const orgIdx = i % this.config.organizations;
      const patientIdx = i % this.createdIds.patients.length;
      const providerIdx = i % this.createdIds.providers.length;
      
      const [appointment] = await db.insert(appointments).values({
        orgId: this.createdIds.organizations[orgIdx],
        patientId: this.createdIds.patients[patientIdx],
        providerId: this.createdIds.providers[providerIdx],
        scheduledAt: faker.date.between({ 
          from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }),
        createdAt: faker.date.past({ years: 1 })
      }).returning();
      
      this.createdIds.appointments.push(appointment.id);
      this.stats.appointments++;
    }
    
    this.log(`\n✅ Generated ${this.stats.appointments} appointments`, colors.green);
  }

  /**
   * Generate claims and attachments
   */
  private async generateClaims() {
    this.log('\n📋 Generating Claims...', colors.cyan);
    
    const statuses = ['draft', 'submitted', 'pending', 'paid', 'denied', 'infoRequested'];
    const types = ['claim', 'preauth'];
    const procedureCodes = ['97110', '97112', '97116', '97124', '97140', '97530', '97535'];
    const diagnosisCodes = ['M25.561', 'M54.5', 'M79.3', 'S83.401A', 'M62.81', 'M25.511'];
    
    let claimIndex = 0;
    
    for (const patientId of this.createdIds.patients) {
      for (let i = 0; i < this.config.claimsPerPatient; i++) {
        claimIndex++;
        this.progress(`Creating claim ${claimIndex}/${this.createdIds.patients.length * this.config.claimsPerPatient}`);
        
        const orgIdx = Math.floor((claimIndex - 1) / (this.config.patientsPerOrg * this.config.claimsPerPatient)) % this.config.organizations;
        const providerIdx = claimIndex % this.createdIds.providers.length;
        const insurerIdx = claimIndex % this.createdIds.insurers.length;
        const userIdx = claimIndex % this.createdIds.users.length;
        const appointmentIdx = claimIndex % this.createdIds.appointments.length;
        
        const status = statuses[claimIndex % statuses.length];
        const claimType = types[claimIndex % 2];
        
        const [claim] = await db.insert(claims).values({
          orgId: this.createdIds.organizations[orgIdx],
          patientId,
          providerId: this.createdIds.providers[providerIdx],
          insurerId: this.createdIds.insurers[insurerIdx],
          appointmentId: faker.datatype.boolean(0.7) ? this.createdIds.appointments[appointmentIdx] : null,
          claimNumber: `TEST-CLM-${String(claimIndex).padStart(8, '0')}`,
          type: claimType as any,
          status: status as any,
          amount: faker.number.float({ min: 50, max: 500, multipleOf: 0.01 }).toString(),
          currency: 'CAD',
          codes: {
            procedure: faker.helpers.arrayElement(procedureCodes),
            diagnosis: faker.helpers.arrayElement(diagnosisCodes),
            units: faker.number.int({ min: 1, max: 10 })
          },
          notes: `[TEST DATA] ${faker.lorem.sentences(2)}`,
          referenceNumber: status !== 'draft' ? `TEST-REF-${String(claimIndex).padStart(8, '0')}` : null,
          externalId: status === 'paid' ? `TEST-EXT-${String(claimIndex).padStart(8, '0')}` : null,
          portalReferenceNumber: claimType === 'claim' && status === 'submitted' ? 
            `TEST-PORTAL-${String(claimIndex).padStart(8, '0')}` : null,
          portalSubmissionDate: status === 'submitted' ? faker.date.recent({ days: 30 }) : null,
          createdBy: this.createdIds.users[userIdx],
          createdAt: faker.date.past({ years: 1 }),
          updatedAt: faker.date.recent({ days: 7 })
        }).returning();
        
        this.createdIds.claims.push(claim.id);
        this.stats.claims++;
        
        // Generate attachments for this claim
        const attachmentCount = faker.number.int({ min: 0, max: this.config.attachmentsPerClaim });
        for (let j = 0; j < attachmentCount; j++) {
          const mimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
          const kinds = ['photo', 'pdf', 'note'];
          
          await db.insert(attachments).values({
            claimId: claim.id,
            url: `https://test-storage.medlink.ca/attachments/test-${claim.id}-${j}.${kinds[j % 3]}`,
            mime: mimeTypes[j % 3],
            kind: kinds[j % 3],
            checksum: faker.string.alphanumeric(32),
            createdAt: faker.date.recent({ days: 30 })
          });
          
          this.stats.attachments++;
        }
      }
    }
    
    this.log(`\n✅ Generated ${this.stats.claims} claims`, colors.green);
    this.log(`✅ Generated ${this.stats.attachments} attachments`, colors.green);
  }

  /**
   * Generate pre-authorizations
   */
  private async generatePreAuths() {
    this.log('\n📝 Generating Pre-Authorizations...', colors.cyan);
    
    const statuses = ['draft', 'submitted', 'pending', 'paid', 'denied'];
    
    let preAuthIndex = 0;
    
    for (const orgId of this.createdIds.organizations) {
      for (let i = 0; i < this.config.preAuthsPerOrg; i++) {
        preAuthIndex++;
        this.progress(`Creating pre-auth ${preAuthIndex}/${this.config.organizations * this.config.preAuthsPerOrg}`);
        
        const patientIdx = preAuthIndex % this.createdIds.patients.length;
        const providerIdx = preAuthIndex % this.createdIds.providers.length;
        const insurerIdx = preAuthIndex % this.createdIds.insurers.length;
        const userIdx = preAuthIndex % this.createdIds.users.length;
        
        const status = statuses[preAuthIndex % statuses.length];
        const requestedAmount = faker.number.float({ min: 500, max: 5000, multipleOf: 0.01 });
        
        await db.insert(preAuths).values({
          orgId,
          authNumber: `TEST-AUTH-${String(preAuthIndex).padStart(8, '0')}`,
          patientId: this.createdIds.patients[patientIdx],
          providerId: this.createdIds.providers[providerIdx],
          insurerId: this.createdIds.insurers[insurerIdx],
          status: status as any,
          requestedAmount: requestedAmount.toString(),
          approvedAmount: status === 'paid' ? 
            faker.number.float({ min: requestedAmount * 0.5, max: requestedAmount, multipleOf: 0.01 }).toString() : 
            null,
          expiryDate: faker.date.future({ years: 1 }),
          notes: `[TEST DATA] ${faker.lorem.sentence()}`,
          createdBy: this.createdIds.users[userIdx],
          createdAt: faker.date.past({ years: 1 }),
          updatedAt: faker.date.recent({ days: 7 })
        });
        
        this.stats.preAuths++;
      }
    }
    
    this.log(`\n✅ Generated ${this.stats.preAuths} pre-authorizations`, colors.green);
  }

  /**
   * Generate remittances
   */
  private async generateRemittances() {
    this.log('\n💰 Generating Remittances...', colors.cyan);
    
    // Generate remittances for paid claims
    const paidClaims = await db.select()
      .from(claims)
      .where(sql`${claims.status} = 'paid'`)
      .limit(50);
    
    for (const claim of paidClaims) {
      this.progress(`Creating remittance ${this.stats.remittances + 1}/${paidClaims.length}`);
      
      await db.insert(remittances).values({
        insurerId: claim.insurerId,
        claimId: claim.id,
        status: 'paid',
        amountPaid: claim.amount,
        raw: {
          test: true,
          paymentDate: faker.date.recent({ days: 14 }).toISOString(),
          referenceNumber: `TEST-REM-${faker.string.alphanumeric(10).toUpperCase()}`,
          paymentMethod: faker.helpers.arrayElement(['EFT', 'Cheque', 'Direct Deposit'])
        },
        createdAt: faker.date.recent({ days: 7 })
      });
      
      this.stats.remittances++;
    }
    
    this.log(`\n✅ Generated ${this.stats.remittances} remittances`, colors.green);
  }

  /**
   * Generate audit events
   */
  private async generateAuditEvents() {
    this.log('\n📊 Generating Audit Events...', colors.cyan);
    
    const eventTypes = [
      'user_login',
      'user_logout',
      'claim_created',
      'claim_submitted',
      'claim_updated',
      'claim_deleted',
      'patient_created',
      'patient_updated',
      'provider_created',
      'provider_updated',
      'attachment_uploaded',
      'report_generated',
      'settings_changed',
      'mfa_enabled',
      'mfa_disabled',
      'password_changed',
      'api_access',
      'data_export',
      'data_import'
    ];
    
    let eventIndex = 0;
    
    for (const orgId of this.createdIds.organizations) {
      for (let i = 0; i < this.config.auditEventsPerOrg; i++) {
        eventIndex++;
        this.progress(`Creating audit event ${eventIndex}/${this.config.organizations * this.config.auditEventsPerOrg}`);
        
        const userIdx = eventIndex % this.createdIds.users.length;
        const eventType = eventTypes[eventIndex % eventTypes.length];
        
        await db.insert(auditEvents).values({
          orgId,
          actorUserId: this.createdIds.users[userIdx],
          type: eventType,
          details: {
            test: true,
            action: eventType,
            timestamp: faker.date.recent({ days: 30 }).toISOString(),
            metadata: {
              userAgent: 'TEST-BROWSER/1.0',
              sessionId: faker.string.uuid(),
              additionalInfo: faker.lorem.sentence()
            }
          },
          ip: faker.internet.ipv4(),
          userAgent: 'Mozilla/5.0 (TEST) TestBrowser/1.0',
          createdAt: faker.date.recent({ days: 30 })
        });
        
        this.stats.auditEvents++;
      }
    }
    
    this.log(`\n✅ Generated ${this.stats.auditEvents} audit events`, colors.green);
  }

  /**
   * Generate connector configurations
   */
  private async generateConnectorConfigs() {
    this.log('\n🔌 Generating Connector Configurations...', colors.cyan);
    
    const connectors = ['cdanet', 'eclaims', 'portal'];
    
    for (const orgId of this.createdIds.organizations) {
      for (const connector of connectors) {
        this.progress(`Creating connector config ${this.stats.connectorConfigs + 1}`);
        
        await db.insert(connectorConfigs).values({
          orgId,
          name: connector as any,
          enabled: faker.datatype.boolean(0.7),
          mode: 'sandbox',
          settings: {
            test: true,
            apiUrl: `https://test-${connector}.medlink.ca/api`,
            apiKey: `TEST-KEY-${faker.string.alphanumeric(32).toUpperCase()}`,
            timeout: 30000,
            retryAttempts: 3
          },
          createdAt: faker.date.past({ years: 1 }),
          updatedAt: faker.date.recent({ days: 7 })
        });
        
        this.stats.connectorConfigs++;
      }
    }
    
    this.log(`\n✅ Generated ${this.stats.connectorConfigs} connector configurations`, colors.green);
  }

  /**
   * Generate connector transactions
   */
  private async generateConnectorTransactions() {
    this.log('\n🔄 Generating Connector Transactions...', colors.cyan);
    
    // Generate transactions for submitted claims
    const submittedClaims = await db.select()
      .from(claims)
      .where(sql`${claims.status} IN ('submitted', 'pending', 'paid', 'denied')`)
      .limit(100);
    
    for (const claim of submittedClaims) {
      this.progress(`Creating transaction ${this.stats.connectorTransactions + 1}`);
      
      const connector = faker.helpers.arrayElement(['cdanet', 'eclaims', 'portal']);
      const transactionType = faker.helpers.arrayElement(['submit', 'poll']);
      
      await db.insert(connectorTransactions).values({
        claimId: claim.id,
        connector: connector as any,
        type: transactionType as any,
        externalId: `TEST-TRANS-${faker.string.alphanumeric(12).toUpperCase()}`,
        status: claim.status || 'pending',
        payload: {
          test: true,
          request: {
            claimId: claim.id,
            timestamp: faker.date.recent({ days: 30 }).toISOString()
          },
          response: {
            success: claim.status === 'paid',
            message: `Test transaction for claim ${claim.claimNumber}`
          }
        },
        createdAt: faker.date.recent({ days: 30 }),
        updatedAt: faker.date.recent({ days: 7 })
      });
      
      this.stats.connectorTransactions++;
    }
    
    this.log(`\n✅ Generated ${this.stats.connectorTransactions} connector transactions`, colors.green);
  }

  /**
   * Generate push subscriptions
   */
  private async generatePushSubscriptions() {
    this.log('\n🔔 Generating Push Subscriptions...', colors.cyan);
    
    // Generate subscriptions for a subset of users
    const usersWithNotifications = this.createdIds.users.slice(0, Math.floor(this.createdIds.users.length / 2));
    
    for (const userId of usersWithNotifications) {
      this.progress(`Creating subscription ${this.stats.pushSubscriptions + 1}`);
      
      const userOrg = await db.select({ orgId: users.orgId })
        .from(users)
        .where(sql`${users.id} = ${userId}`)
        .limit(1);
      
      if (userOrg[0]?.orgId) {
        await db.insert(pushSubscriptions).values({
          userId,
          orgId: userOrg[0].orgId,
          endpoint: `https://test-push.medlink.ca/push/${faker.string.alphanumeric(64)}`,
          p256dhKey: faker.string.alphanumeric(87),
          authKey: faker.string.alphanumeric(22),
          userAgent: 'Mozilla/5.0 (TEST) TestBrowser/1.0',
          isActive: faker.datatype.boolean(0.8),
          createdAt: faker.date.past({ years: 1 }),
          updatedAt: faker.date.recent({ days: 30 })
        });
        
        this.stats.pushSubscriptions++;
      }
    }
    
    this.log(`\n✅ Generated ${this.stats.pushSubscriptions} push subscriptions`, colors.green);
  }

  /**
   * Print final statistics
   */
  private printStats() {
    const duration = (Date.now() - this.stats.startTime) / 1000;
    const totalRecords = Object.values(this.stats)
      .filter((val, key) => typeof val === 'number' && key !== 'startTime')
      .reduce((sum, val) => sum + (val as number), 0);

    this.log('\n\n' + '=' .repeat(50), colors.cyan);
    this.log('📊 TEST DATA GENERATION COMPLETE', colors.green);
    this.log('=' .repeat(50), colors.cyan);
    
    this.log('\nGenerated Records:', colors.yellow);
    this.log(`  • Organizations:     ${this.stats.organizations}`, colors.blue);
    this.log(`  • Users:            ${this.stats.users}`, colors.blue);
    this.log(`  • Patients:         ${this.stats.patients}`, colors.blue);
    this.log(`  • Providers:        ${this.stats.providers}`, colors.blue);
    this.log(`  • Insurers:         ${this.stats.insurers}`, colors.blue);
    this.log(`  • Appointments:     ${this.stats.appointments}`, colors.blue);
    this.log(`  • Claims:           ${this.stats.claims}`, colors.blue);
    this.log(`  • Pre-Auths:        ${this.stats.preAuths}`, colors.blue);
    this.log(`  • Attachments:      ${this.stats.attachments}`, colors.blue);
    this.log(`  • Remittances:      ${this.stats.remittances}`, colors.blue);
    this.log(`  • Audit Events:     ${this.stats.auditEvents}`, colors.blue);
    this.log(`  • Connector Configs: ${this.stats.connectorConfigs}`, colors.blue);
    this.log(`  • Transactions:     ${this.stats.connectorTransactions}`, colors.blue);
    this.log(`  • Push Subs:        ${this.stats.pushSubscriptions}`, colors.blue);
    
    this.log(`\n  Total Records:      ${totalRecords}`, colors.green);
    this.log(`  Duration:           ${duration.toFixed(2)} seconds`, colors.green);
    
    if (this.stats.errors.length > 0) {
      this.log('\n⚠️  Errors encountered:', colors.red);
      this.stats.errors.forEach(err => this.log(`  • ${err}`, colors.red));
    }

    this.log('\n✅ All test data has been generated successfully!', colors.green);
    this.log('⚠️  All data is marked with TEST- prefix for easy identification', colors.yellow);
  }

  /**
   * Run the generation process
   */
  async run() {
    try {
      this.log('\n🚀 TEST DATA GENERATOR', colors.magenta);
      this.log('=' .repeat(50));

      // Safety checks
      if (!await this.safetyCheck()) {
        process.exit(1);
      }

      // Get confirmation
      if (!await this.getConfirmation()) {
        this.log('\n❌ Generation cancelled', colors.yellow);
        process.exit(0);
      }

      // Generate data in order (respecting foreign keys)
      await this.generateOrganizations();
      await this.generateUsers();
      await this.generateInsurers();
      await this.generatePatients();
      await this.generateProviders();
      await this.generateAppointments();
      await this.generateClaims(); // Also generates attachments
      await this.generatePreAuths();
      await this.generateRemittances();
      await this.generateAuditEvents();
      await this.generateConnectorConfigs();
      await this.generateConnectorTransactions();
      await this.generatePushSubscriptions();

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
  // Parse command line arguments
  const args = process.argv.slice(2);
  const config: Partial<GenerationConfig> = {};
  
  // Simple argument parsing
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = parseInt(args[i + 1] || '0');
    
    if (key && value) {
      (config as any)[key] = value;
    }
  }
  
  const generator = new TestDataGenerator(config);
  generator.run();
}

export default TestDataGenerator;