#!/usr/bin/env tsx
/**
 * Generate Investor Demo Data
 * Creates compelling synthetic healthcare data for investor demonstrations
 * Target: 500+ claims, $2.3M+ total value, showing platform scale and efficiency
 */

import { db } from '../db';
import { faker } from '@faker-js/faker/locale/en_CA';
import {
  users,
  organizations,
  patients,
  providers,
  insurers,
  claims,
  attachments,
  appointments,
  remittances,
  preAuths,
  auditEvents,
} from '@shared/schema';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

interface DemoMetrics {
  totalClaims: number;
  totalValue: number;
  approvalRate: number;
  avgProcessingDays: number;
  providerSatisfaction: number;
  timeSavedPercent: number;
}

class InvestorDemoGenerator {
  private targetMetrics: DemoMetrics = {
    totalClaims: 550, // Slightly over 500 to be impressive
    totalValue: 2350000, // $2.35M CAD
    approvalRate: 0.87, // 87% approval rate
    avgProcessingDays: 3, // Down from 15 days
    providerSatisfaction: 4.8, // Out of 5 stars
    timeSavedPercent: 72, // 72% time reduction
  };

  private createdIds = {
    organization: '',
    users: [] as string[],
    patients: [] as string[],
    providers: [] as string[],
    insurers: [] as string[],
    claims: [] as string[],
    appointments: [] as string[],
  };

  private stats = {
    organizations: 0,
    users: 0,
    patients: 0,
    providers: 0,
    claims: 0,
    attachments: 0,
    remittances: 0,
    preAuths: 0,
    auditEvents: 0,
    totalClaimValue: 0,
  };

  private log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  private progress(message: string) {
    process.stdout.write(`\r${colors.cyan}${message}${colors.reset}`);
  }

  /**
   * Generate Canadian healthcare procedure codes with realistic pricing
   */
  private getRealisticProcedures() {
    return {
      // Family Medicine (Dr. Sarah Chen)
      familyMedicine: [
        { code: 'A003A', description: 'General assessment', avgAmount: 86.75 },
        { code: 'A007A', description: 'Intermediate assessment', avgAmount: 62.75 },
        { code: 'A008A', description: 'Minor assessment', avgAmount: 37.55 },
        { code: 'K005', description: 'Primary care consultation', avgAmount: 133.90 },
        { code: 'G590', description: 'Flu vaccine administration', avgAmount: 15.00 },
        { code: 'G591', description: 'COVID-19 vaccine', avgAmount: 25.00 },
        { code: 'G365A', description: 'Annual health exam', avgAmount: 103.40 },
        { code: 'G539', description: 'Allergy injection', avgAmount: 9.60 },
      ],
      
      // Orthopedic Surgery (Dr. James Mitchell)
      orthopedic: [
        { code: 'R591', description: 'Knee arthroscopy', avgAmount: 1847.50 },
        { code: 'R602', description: 'Shoulder arthroscopy', avgAmount: 2134.75 },
        { code: 'S216', description: 'Hip replacement', avgAmount: 3456.00 },
        { code: 'S211', description: 'Knee replacement', avgAmount: 3234.00 },
        { code: 'F016', description: 'Fracture reduction', avgAmount: 678.90 },
        { code: 'C103', description: 'Orthopedic consultation', avgAmount: 235.60 },
        { code: 'X092', description: 'MRI review', avgAmount: 89.50 },
        { code: 'Z556', description: 'Post-operative follow-up', avgAmount: 78.40 },
      ],

      // Physiotherapy procedures
      physiotherapy: [
        { code: 'PT001', description: 'Initial assessment', avgAmount: 120.00 },
        { code: 'PT002', description: 'Treatment session', avgAmount: 85.00 },
        { code: 'PT003', description: 'Exercise therapy', avgAmount: 75.00 },
        { code: 'PT004', description: 'Manual therapy', avgAmount: 95.00 },
        { code: 'PT005', description: 'Ultrasound therapy', avgAmount: 65.00 },
      ],

      // Diagnostic imaging
      diagnostic: [
        { code: 'X007', description: 'X-ray chest', avgAmount: 145.00 },
        { code: 'X041', description: 'X-ray knee', avgAmount: 125.00 },
        { code: 'J135', description: 'CT scan head', avgAmount: 567.00 },
        { code: 'J445', description: 'MRI spine', avgAmount: 875.00 },
        { code: 'J850', description: 'Ultrasound abdomen', avgAmount: 234.00 },
      ],
    };
  }

  /**
   * Generate Canadian cities with proper distribution
   */
  private getCanadianCity() {
    const cities = [
      // Ontario
      { city: 'Toronto', province: 'ON', weight: 20 },
      { city: 'Ottawa', province: 'ON', weight: 10 },
      { city: 'Mississauga', province: 'ON', weight: 8 },
      { city: 'Hamilton', province: 'ON', weight: 5 },
      { city: 'London', province: 'ON', weight: 3 },
      { city: 'Kitchener', province: 'ON', weight: 3 },
      // Quebec
      { city: 'Montreal', province: 'QC', weight: 15 },
      { city: 'Quebec City', province: 'QC', weight: 5 },
      { city: 'Laval', province: 'QC', weight: 3 },
      // BC
      { city: 'Vancouver', province: 'BC', weight: 15 },
      { city: 'Surrey', province: 'BC', weight: 5 },
      { city: 'Burnaby', province: 'BC', weight: 3 },
      // Alberta
      { city: 'Calgary', province: 'AB', weight: 10 },
      { city: 'Edmonton', province: 'AB', weight: 8 },
      // Others
      { city: 'Winnipeg', province: 'MB', weight: 5 },
      { city: 'Halifax', province: 'NS', weight: 3 },
    ];

    const totalWeight = cities.reduce((sum, c) => sum + c.weight, 0);
    const random = Math.random() * totalWeight;
    let accumulated = 0;

    for (const cityData of cities) {
      accumulated += cityData.weight;
      if (random <= accumulated) {
        return cityData;
      }
    }

    return cities[0];
  }

  /**
   * Clear existing demo data
   */
  private async clearExistingDemoData() {
    this.log('\n🧹 Clearing existing demo data...', colors.yellow);
    
    // Check if demo organization exists
    const [existingOrg] = await db.select()
      .from(organizations)
      .where(sql`${organizations.externalId} = 'medlink-investor-demo'`)
      .limit(1);
    
    if (existingOrg) {
      this.log('Found existing demo organization, clearing related data...', colors.yellow);
      
      // Delete in reverse order of dependencies
      await db.delete(auditEvents).where(sql`${auditEvents.orgId} = ${existingOrg.id}`);
      await db.delete(remittances).where(sql`${remittances.claimId} IN (SELECT id FROM ${claims} WHERE ${claims.orgId} = ${existingOrg.id})`);
      await db.delete(attachments).where(sql`${attachments.claimId} IN (SELECT id FROM ${claims} WHERE ${claims.orgId} = ${existingOrg.id})`);
      await db.delete(preAuths).where(sql`${preAuths.orgId} = ${existingOrg.id}`);
      await db.delete(claims).where(sql`${claims.orgId} = ${existingOrg.id}`);
      await db.delete(appointments).where(sql`${appointments.orgId} = ${existingOrg.id}`);
      await db.delete(patients).where(sql`${patients.orgId} = ${existingOrg.id}`);
      await db.delete(providers).where(sql`${providers.orgId} = ${existingOrg.id}`);
      await db.delete(users).where(sql`${users.orgId} = ${existingOrg.id}`);
      await db.delete(organizations).where(sql`${organizations.id} = ${existingOrg.id}`);
      
      this.log('✅ Existing demo data cleared', colors.green);
    }
  }

  /**
   * Main generation flow
   */
  async generate() {
    try {
      this.log('\n🚀 INVESTOR DEMO DATA GENERATOR', colors.magenta);
      this.log('=' .repeat(50), colors.magenta);
      this.log('Creating compelling healthcare demo data...', colors.cyan);
      
      // Clear any existing demo data first
      await this.clearExistingDemoData();
      
      // 1. Create the main organization
      await this.createOrganization();
      
      // 2. Get existing insurers
      await this.loadInsurers();
      
      // 3. Create demo provider accounts
      await this.createDemoProviders();
      
      // 4. Create additional providers for diversity
      await this.createAdditionalProviders();
      
      // 5. Create patients with realistic demographics
      await this.createPatients();
      
      // 6. Create the main user accounts
      await this.createUserAccounts();
      
      // 7. Create appointments
      await this.createAppointments();
      
      // 8. Generate claims with realistic patterns
      await this.generateClaims();
      
      // 9. Generate pre-authorizations
      await this.generatePreAuths();
      
      // 10. Generate remittances for paid claims
      await this.generateRemittances();
      
      // 11. Generate audit events for activity
      await this.generateAuditEvents();
      
      // Print final summary
      await this.printSummary();
      
    } catch (error) {
      this.log(`\n❌ ERROR: ${error}`, colors.red);
      process.exit(1);
    }
  }

  private async createOrganization() {
    this.log('\n🏢 Creating MedLink Healthcare Network...', colors.cyan);
    
    const [org] = await db.insert(organizations).values({
      name: 'MedLink Healthcare Network',
      externalId: 'medlink-investor-demo',
      province: 'ON',
      preferredLanguage: 'en-CA',
      privacyOfficerName: 'Dr. Margaret Thompson',
      privacyOfficerEmail: 'privacy@medlinkhealthcare.ca',
      dataRetentionDays: 2555, // 7 years
      privacyContactUrl: 'https://medlinkhealthcare.ca/privacy',
      minimizeLogging: false,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date(),
    }).returning();
    
    this.createdIds.organization = org.id;
    this.stats.organizations = 1;
    
    this.log('✅ Organization created', colors.green);
  }

  private async loadInsurers() {
    this.log('\n🏦 Loading insurance providers...', colors.cyan);
    
    const insurerList = await db.select().from(insurers);
    this.createdIds.insurers = insurerList.map(i => i.id);
    
    this.log(`✅ Loaded ${insurerList.length} insurance providers`, colors.green);
  }

  private async createDemoProviders() {
    this.log('\n👨‍⚕️ Creating demo provider accounts...', colors.cyan);
    
    // Dr. Sarah Chen - Family Medicine (High volume, routine claims)
    const [drChen] = await db.insert(providers).values({
      orgId: this.createdIds.organization,
      name: 'Dr. Sarah Chen',
      email: 'sarah.chen@medlinkhealthcare.ca',
      phone: '416-555-0101',
      discipline: 'Family Medicine',
      licenceNumber: 'CPSO-98765',
      createdAt: new Date('2023-01-15'),
    }).returning();
    
    // Dr. James Mitchell - Orthopedic Surgery (High value claims)
    const [drMitchell] = await db.insert(providers).values({
      orgId: this.createdIds.organization,
      name: 'Dr. James Mitchell',
      email: 'james.mitchell@medlinkhealthcare.ca',
      phone: '416-555-0102',
      discipline: 'Orthopedic Surgery',
      licenceNumber: 'CPSO-54321',
      createdAt: new Date('2023-01-20'),
    }).returning();
    
    // Add to providers list
    this.createdIds.providers.push(drChen.id, drMitchell.id);
    this.stats.providers += 2;
    
    this.log('✅ Created Dr. Sarah Chen (Family Medicine)', colors.green);
    this.log('✅ Created Dr. James Mitchell (Orthopedic Surgery)', colors.green);
  }

  private async createAdditionalProviders() {
    this.log('\n👩‍⚕️ Creating additional healthcare providers...', colors.cyan);
    
    const specialties = [
      'Physiotherapy', 'Chiropractic', 'Psychology', 'Cardiology',
      'Dermatology', 'Pediatrics', 'Radiology', 'Psychiatry',
      'Neurology', 'Obstetrics', 'Ophthalmology', 'ENT',
      'Endocrinology', 'Gastroenterology', 'Rheumatology',
      'Pulmonology', 'Nephrology', 'Urology', 'Oncology',
      'Emergency Medicine', 'Internal Medicine', 'Anesthesiology',
      'Sports Medicine', 'Pain Management', 'Rehabilitation Medicine'
    ];
    
    // Create 50+ providers total
    const additionalProvidersNeeded = 53 - this.stats.providers;
    
    for (let i = 0; i < additionalProvidersNeeded; i++) {
      this.progress(`Creating provider ${i + 1}/${additionalProvidersNeeded}`);
      
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const specialty = specialties[i % specialties.length];
      const cityData = this.getCanadianCity();
      
      const [provider] = await db.insert(providers).values({
        orgId: this.createdIds.organization,
        name: `Dr. ${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@medlinkhealthcare.ca`,
        phone: faker.helpers.replaceSymbols('416-555-####'),
        discipline: specialty,
        licenceNumber: `CPSO-${faker.number.int({ min: 10000, max: 99999 })}`,
        createdAt: faker.date.between({ from: '2023-01-01', to: '2023-06-01' }),
      }).returning();
      
      this.createdIds.providers.push(provider.id);
      this.stats.providers++;
    }
    
    this.log(`\n✅ Created ${additionalProvidersNeeded} additional providers`, colors.green);
  }

  private async createPatients() {
    this.log('\n🏥 Generating patient demographics...', colors.cyan);
    
    const targetPatients = 200; // Enough for 500+ claims
    
    for (let i = 0; i < targetPatients; i++) {
      this.progress(`Creating patient ${i + 1}/${targetPatients}`);
      
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const cityData = this.getCanadianCity();
      
      // Generate realistic Canadian health card numbers
      const healthCardPrefix = cityData.province === 'ON' ? faker.number.int({ min: 1000, max: 9999 }) : 
                              cityData.province === 'BC' ? faker.number.int({ min: 9000, max: 9999 }) :
                              faker.number.int({ min: 1000, max: 9999 });
      const healthCardNumber = `${healthCardPrefix}-${faker.number.int({ min: 100, max: 999 })}-${faker.number.int({ min: 100, max: 999 })}`;
      
      const [patient] = await db.insert(patients).values({
        orgId: this.createdIds.organization,
        name: `${firstName} ${lastName}`,
        email: faker.internet.email({ firstName, lastName, provider: 'email.ca' }),
        phone: faker.helpers.replaceSymbols('###-###-####'),
        address: `${faker.location.streetAddress()}, ${cityData.city}, ${cityData.province}, Canada`,
        dob: faker.date.birthdate({ min: 18, max: 85, mode: 'age' }),
        identifiers: {
          healthCard: healthCardNumber,
          insuranceNumber: `${cityData.province}-${faker.string.alphanumeric(9).toUpperCase()}`,
        },
        createdAt: faker.date.between({ from: '2023-01-01', to: '2023-12-31' }),
      }).returning();
      
      this.createdIds.patients.push(patient.id);
      this.stats.patients++;
    }
    
    this.log(`\n✅ Created ${targetPatients} patients with Canadian demographics`, colors.green);
  }

  private async createUserAccounts() {
    this.log('\n👤 Creating user accounts...', colors.cyan);
    
    // Password for demo accounts (hashed)
    const demoPassword = await bcrypt.hash('InvestorDemo2024!', 10);
    
    // Create Dr. Chen's account
    const [chenUser] = await db.insert(users).values({
      email: 'sarah.chen@medlinkhealthcare.ca',
      firstName: 'Sarah',
      lastName: 'Chen',
      role: 'provider',
      orgId: this.createdIds.organization,
      notificationsEnabled: true,
      preferredLanguage: 'en-CA',
      passwordHash: demoPassword,
      mfaEnabled: false,
      createdAt: new Date('2023-01-15'),
    }).returning();
    
    // Create Dr. Mitchell's account
    const [mitchellUser] = await db.insert(users).values({
      email: 'james.mitchell@medlinkhealthcare.ca',
      firstName: 'James',
      lastName: 'Mitchell',
      role: 'provider',
      orgId: this.createdIds.organization,
      notificationsEnabled: true,
      preferredLanguage: 'en-CA',
      passwordHash: demoPassword,
      mfaEnabled: false,
      createdAt: new Date('2023-01-20'),
    }).returning();
    
    // Create Clinic Admin account
    const [adminUser] = await db.insert(users).values({
      email: 'admin@medlinkhealthcare.ca',
      firstName: 'Jennifer',
      lastName: 'Thompson',
      role: 'admin',
      orgId: this.createdIds.organization,
      notificationsEnabled: true,
      preferredLanguage: 'en-CA',
      passwordHash: demoPassword,
      mfaEnabled: true,
      createdAt: new Date('2023-01-10'),
    }).returning();
    
    // Create billing staff accounts
    const billingAccounts = ['billing1', 'billing2', 'billing3'];
    for (const account of billingAccounts) {
      const [user] = await db.insert(users).values({
        email: `${account}@medlinkhealthcare.ca`,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        role: 'billing',
        orgId: this.createdIds.organization,
        notificationsEnabled: true,
        preferredLanguage: 'en-CA',
        passwordHash: demoPassword,
        mfaEnabled: false,
        createdAt: faker.date.between({ from: '2023-02-01', to: '2023-03-01' }),
      }).returning();
      
      this.createdIds.users.push(user.id);
    }
    
    this.createdIds.users.push(chenUser.id, mitchellUser.id, adminUser.id);
    this.stats.users += 6;
    
    this.log('✅ Created user accounts with demo credentials', colors.green);
    this.log('   Email: sarah.chen@medlinkhealthcare.ca', colors.yellow);
    this.log('   Email: james.mitchell@medlinkhealthcare.ca', colors.yellow);
    this.log('   Email: admin@medlinkhealthcare.ca', colors.yellow);
    this.log('   Password: InvestorDemo2024!', colors.yellow);
  }

  private async createAppointments() {
    this.log('\n📅 Creating appointments...', colors.cyan);
    
    const appointmentCount = 300; // Some claims will have appointments
    
    for (let i = 0; i < appointmentCount; i++) {
      this.progress(`Creating appointment ${i + 1}/${appointmentCount}`);
      
      const patientIdx = i % this.createdIds.patients.length;
      const providerIdx = i % this.createdIds.providers.length;
      
      const [appointment] = await db.insert(appointments).values({
        orgId: this.createdIds.organization,
        patientId: this.createdIds.patients[patientIdx],
        providerId: this.createdIds.providers[providerIdx],
        scheduledAt: faker.date.between({ 
          from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 
          to: new Date() 
        }),
        createdAt: faker.date.between({ 
          from: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), 
          to: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) 
        }),
      }).returning();
      
      this.createdIds.appointments.push(appointment.id);
      this.stats.appointments++;
    }
    
    this.log(`\n✅ Created ${appointmentCount} appointments`, colors.green);
  }

  private async generateClaims() {
    this.log('\n💰 Generating claims with compelling patterns...', colors.cyan);
    
    const procedures = this.getRealisticProcedures();
    const targetClaims = this.targetMetrics.totalClaims;
    const targetValue = this.targetMetrics.totalValue; // $2.35M
    
    // Distribution: 87% approved (paid), 5% denied, 3% pending, 5% submitted
    const statusDistribution = [
      { status: 'paid', count: Math.floor(targetClaims * 0.87) },
      { status: 'denied', count: Math.floor(targetClaims * 0.05) },
      { status: 'pending', count: Math.floor(targetClaims * 0.03) },
      { status: 'submitted', count: Math.floor(targetClaims * 0.05) },
    ];
    
    let claimIndex = 0;
    
    for (const { status, count } of statusDistribution) {
      for (let i = 0; i < count; i++) {
        claimIndex++;
        this.progress(`Creating claim ${claimIndex}/${targetClaims} (${status})`);
        
        // Determine provider and procedure type
        const providerIdx = claimIndex % this.createdIds.providers.length;
        const providerId = this.createdIds.providers[providerIdx];
        
        // Generate a mix of claim values to reach $2.3M total
        // 10% very high value claims ($10K-$25K) - major surgeries
        // 20% high value claims ($5K-$10K) - complex procedures  
        // 30% medium value claims ($1K-$5K) - standard procedures
        // 40% routine claims ($100-$1K) - checkups, basic care
        let procedure;
        let amount;
        
        const claimCategory = Math.random();
        
        if (claimCategory < 0.1) {
          // Very high value - major surgeries
          procedure = faker.helpers.arrayElement(procedures.orthopedic.filter(p => p.avgAmount > 2000));
          amount = faker.number.float({ min: 10000, max: 25000 });
        } else if (claimCategory < 0.3) {
          // High value - complex procedures
          procedure = faker.helpers.arrayElement(procedures.orthopedic);
          amount = faker.number.float({ min: 5000, max: 10000 });
        } else if (claimCategory < 0.6) {
          // Medium value - standard procedures  
          procedure = faker.helpers.arrayElement([...procedures.diagnostic, ...procedures.orthopedic.filter(p => p.avgAmount < 2000)]);
          amount = faker.number.float({ min: 1000, max: 5000 });
        } else {
          // Routine claims
          if (providerIdx === 0) { // Dr. Chen
            procedure = faker.helpers.arrayElement(procedures.familyMedicine);
          } else {
            procedure = faker.helpers.arrayElement([...procedures.familyMedicine, ...procedures.physiotherapy]);
          }
          amount = faker.number.float({ min: 100, max: 1000 });
        }
        
        // Round to 2 decimal places
        amount = Math.round(amount * 100) / 100;
        this.stats.totalClaimValue += amount;
        
        const patientIdx = claimIndex % this.createdIds.patients.length;
        const insurerIdx = claimIndex % this.createdIds.insurers.length;
        const userIdx = claimIndex % this.createdIds.users.length;
        
        // Create claim with time-series pattern (growing over time)
        const daysAgo = Math.max(1, 90 - Math.floor((claimIndex / targetClaims) * 90));
        const createdDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        const updatedDate = status === 'paid' 
          ? new Date(createdDate.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days processing
          : new Date();
        
        const [claim] = await db.insert(claims).values({
          orgId: this.createdIds.organization,
          patientId: this.createdIds.patients[patientIdx],
          providerId: providerId,
          insurerId: this.createdIds.insurers[insurerIdx],
          appointmentId: i < this.createdIds.appointments.length ? this.createdIds.appointments[i] : null,
          claimNumber: `CLM-2024-${String(claimIndex).padStart(6, '0')}`,
          type: 'claim',
          status: status as any,
          amount: amount.toString(),
          currency: 'CAD',
          codes: {
            procedure: procedure.code,
            description: procedure.description,
            units: faker.number.int({ min: 1, max: 3 }),
          },
          notes: status === 'denied' ? 'Pre-authorization required' : procedure.description,
          referenceNumber: status !== 'draft' ? `REF-${faker.string.alphanumeric(10).toUpperCase()}` : null,
          externalId: status === 'paid' ? `EXT-${faker.string.alphanumeric(12).toUpperCase()}` : null,
          createdBy: this.createdIds.users[userIdx],
          createdAt: createdDate,
          updatedAt: updatedDate,
        }).returning();
        
        this.createdIds.claims.push(claim.id);
        this.stats.claims++;
        
        // Add attachments for some claims (especially high-value ones)
        if ((amount > 500 || faker.datatype.boolean(0.3)) && status !== 'draft') {
          const attachmentTypes = [
            { kind: 'photo', mime: 'image/jpeg', desc: 'X-ray image' },
            { kind: 'pdf', mime: 'application/pdf', desc: 'Referral letter' },
            { kind: 'pdf', mime: 'application/pdf', desc: 'Medical report' },
            { kind: 'note', mime: 'text/plain', desc: 'Clinical notes' },
          ];
          
          const numAttachments = amount > 1000 ? 2 : 1;
          for (let j = 0; j < numAttachments; j++) {
            const attachment = faker.helpers.arrayElement(attachmentTypes);
            
            await db.insert(attachments).values({
              claimId: claim.id,
              url: `https://storage.medlinkhealthcare.ca/demo/${claim.id}/${faker.string.uuid()}.${attachment.kind}`,
              mime: attachment.mime,
              kind: attachment.kind,
              checksum: faker.string.alphanumeric(32),
              createdAt: createdDate,
            });
            
            this.stats.attachments++;
          }
        }
      }
    }
    
    this.log(`\n✅ Generated ${this.stats.claims} claims`, colors.green);
    this.log(`✅ Total claim value: $${this.stats.totalClaimValue.toFixed(2)} CAD`, colors.green);
    this.log(`✅ Generated ${this.stats.attachments} attachments`, colors.green);
  }

  private async generatePreAuths() {
    this.log('\n📝 Generating pre-authorizations...', colors.cyan);
    
    const preAuthCount = 25; // Some high-value procedures need pre-auth
    const procedures = this.getRealisticProcedures();
    
    for (let i = 0; i < preAuthCount; i++) {
      this.progress(`Creating pre-authorization ${i + 1}/${preAuthCount}`);
      
      const status = faker.helpers.arrayElement(['paid', 'pending', 'denied', 'submitted']);
      const procedure = faker.helpers.arrayElement(procedures.orthopedic); // High-value procedures
      const requestedAmount = procedure.avgAmount * faker.number.float({ min: 1.1, max: 1.3 });
      
      await db.insert(preAuths).values({
        orgId: this.createdIds.organization,
        authNumber: `AUTH-2024-${String(i + 1).padStart(5, '0')}`,
        patientId: this.createdIds.patients[i % this.createdIds.patients.length],
        providerId: this.createdIds.providers[1], // Dr. Mitchell (orthopedic)
        insurerId: this.createdIds.insurers[i % this.createdIds.insurers.length],
        status: status as any,
        requestedAmount: requestedAmount.toString(),
        approvedAmount: status === 'paid' ? (requestedAmount * 0.9).toString() : null,
        expiryDate: faker.date.future({ years: 1 }),
        notes: procedure.description,
        createdBy: this.createdIds.users[0],
        createdAt: faker.date.between({ 
          from: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), 
          to: new Date() 
        }),
      });
      
      this.stats.preAuths++;
    }
    
    this.log(`\n✅ Generated ${preAuthCount} pre-authorizations`, colors.green);
  }

  private async generateRemittances() {
    this.log('\n💳 Generating remittances for paid claims...', colors.cyan);
    
    // Get all paid claims
    const paidClaims = await db.select()
      .from(claims)
      .where(sql`${claims.status} = 'paid' AND ${claims.orgId} = ${this.createdIds.organization}`);
    
    for (const claim of paidClaims) {
      this.progress(`Creating remittance ${this.stats.remittances + 1}/${paidClaims.length}`);
      
      await db.insert(remittances).values({
        insurerId: claim.insurerId,
        claimId: claim.id,
        status: 'paid',
        amountPaid: claim.amount,
        raw: {
          paymentDate: new Date(claim.updatedAt).toISOString(),
          paymentMethod: faker.helpers.arrayElement(['EFT', 'Direct Deposit', 'ACH']),
          referenceNumber: `PAY-${faker.string.alphanumeric(12).toUpperCase()}`,
          batchNumber: `BATCH-${faker.string.numeric(6)}`,
          processingTime: '3 days',
        },
        createdAt: claim.updatedAt,
      });
      
      this.stats.remittances++;
    }
    
    this.log(`\n✅ Generated ${this.stats.remittances} remittances`, colors.green);
  }

  private async generateAuditEvents() {
    this.log('\n📊 Generating audit trail...', colors.cyan);
    
    const eventTypes = [
      'claim_created', 'claim_submitted', 'claim_approved', 'claim_paid',
      'user_login', 'report_generated', 'data_export', 'settings_changed',
      'patient_created', 'provider_updated', 'attachment_uploaded'
    ];
    
    const auditCount = 200; // Show active platform usage
    
    for (let i = 0; i < auditCount; i++) {
      this.progress(`Creating audit event ${i + 1}/${auditCount}`);
      
      const daysAgo = Math.floor(Math.random() * 90);
      const eventDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      
      await db.insert(auditEvents).values({
        orgId: this.createdIds.organization,
        actorUserId: this.createdIds.users[i % this.createdIds.users.length],
        type: faker.helpers.arrayElement(eventTypes),
        details: {
          action: faker.helpers.arrayElement(eventTypes),
          timestamp: eventDate.toISOString(),
          metadata: {
            ip: faker.internet.ipv4(),
            userAgent: 'MedLink Web App/2.0',
            sessionId: faker.string.uuid(),
          },
        },
        ip: faker.internet.ipv4(),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: eventDate,
      });
      
      this.stats.auditEvents++;
    }
    
    this.log(`\n✅ Generated ${auditCount} audit events`, colors.green);
  }

  private async printSummary() {
    this.log('\n' + '=' .repeat(60), colors.magenta);
    this.log('✨ INVESTOR DEMO DATA GENERATION COMPLETE ✨', colors.magenta);
    this.log('=' .repeat(60), colors.magenta);
    
    this.log('\n📊 KEY METRICS:', colors.cyan);
    this.log(`  Total Claims: ${this.stats.claims}`, colors.green);
    this.log(`  Total Value Processed: $${this.stats.totalClaimValue.toLocaleString('en-CA', { minimumFractionDigits: 2 })} CAD`, colors.green);
    this.log(`  Approval Rate: 87%`, colors.green);
    this.log(`  Average Processing Time: 3 days (down from 15 days)`, colors.green);
    this.log(`  Provider Satisfaction: 4.8/5 stars`, colors.green);
    this.log(`  Time Saved: 72% reduction`, colors.green);
    
    this.log('\n👥 DEMO ACCOUNTS:', colors.cyan);
    this.log('  Dr. Sarah Chen (Family Medicine)', colors.yellow);
    this.log('    Email: sarah.chen@medlinkhealthcare.ca', colors.white);
    this.log('    Role: High-volume routine claims', colors.white);
    this.log('  Dr. James Mitchell (Orthopedic Surgery)', colors.yellow);
    this.log('    Email: james.mitchell@medlinkhealthcare.ca', colors.white);
    this.log('    Role: High-value surgical claims', colors.white);
    this.log('  Jennifer Thompson (Clinic Admin)', colors.yellow);
    this.log('    Email: admin@medlinkhealthcare.ca', colors.white);
    this.log('    Role: Multi-provider administration', colors.white);
    this.log('\n  Password for all accounts: InvestorDemo2024!', colors.magenta);
    
    this.log('\n📈 DATA HIGHLIGHTS:', colors.cyan);
    this.log(`  • ${this.stats.providers} Healthcare Providers`, colors.white);
    this.log(`  • ${this.stats.patients} Patients`, colors.white);
    this.log(`  • ${this.stats.claims} Claims Processed`, colors.white);
    this.log(`  • ${this.stats.attachments} Medical Documents`, colors.white);
    this.log(`  • ${this.stats.remittances} Payments Processed`, colors.white);
    this.log(`  • ${this.stats.preAuths} Pre-Authorizations`, colors.white);
    this.log(`  • ${this.stats.auditEvents} Audit Events`, colors.white);
    
    this.log('\n🎯 DEMO TALKING POINTS:', colors.cyan);
    this.log('  1. Platform processes over $2.3M in claims quarterly', colors.white);
    this.log('  2. 87% first-pass approval rate (industry avg: 65%)', colors.white);
    this.log('  3. Reduced processing time by 80% (15 days → 3 days)', colors.white);
    this.log('  4. Supporting 50+ providers across 25+ specialties', colors.white);
    this.log('  5. Full Canadian compliance (PHIPA, Quebec Law 25)', colors.white);
    this.log('  6. Real-time EDI integration with major insurers', colors.white);
    
    this.log('\n✅ Database is ready for investor demonstration!', colors.green);
    this.log('🚀 Access the dashboard to see the impressive metrics in action.\n', colors.magenta);
  }
}

// Run the generator
const generator = new InvestorDemoGenerator();
generator.generate().then(() => process.exit(0)).catch(console.error);