import {
  users,
  organizations,
  patients,
  providers,
  appointments,
  insurers,
  claims,
  attachments,
  remittances,
  auditEvents,
  connectorConfigs,
  connectorTransactions,
  connectorErrors,
  type User,
  type UpsertUser,
  type Organization,
  type Patient,
  type Provider,
  type Appointment,
  type Insurer,
  type Claim,
  type Attachment,
  type Remittance,
  type AuditEvent,
  type ConnectorConfig,
  type ConnectorTransaction,
  type ConnectorError,
  type InsertUser,
  type InsertOrganization,
  type InsertPatient,
  type InsertProvider,
  type InsertClaim,
  type InsertAttachment,
  type InsertRemittance,
  type InsertAuditEvent,
  type InsertConnectorConfig,
  type InsertConnectorTransaction,
  type InsertConnectorError,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import { fieldEncryption, encryptRecord, decryptRecord } from "./security/encryption";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Organization operations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationById(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  
  // Patient operations
  getPatients(orgId: string, filter?: { id?: string }): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  
  // Provider operations
  getProviders(orgId: string, filter?: { id?: string }): Promise<Provider[]>;
  getProvider(id: string): Promise<Provider | undefined>;
  createProvider(provider: InsertProvider): Promise<Provider>;
  
  // Insurer operations
  getInsurers(): Promise<Insurer[]>;
  getInsurer(id: string): Promise<Insurer | undefined>;
  
  // Claim operations
  getClaims(orgId: string, userId?: string, role?: string): Promise<Claim[]>;
  getClaim(id: string): Promise<Claim | undefined>;
  createClaim(claim: InsertClaim): Promise<Claim>;
  updateClaim(id: string, updates: Partial<Claim>): Promise<Claim | undefined>;
  updateClaimStatus(id: string, status: string): Promise<void>;
  
  // Attachment operations
  getAttachments(claimId: string): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  
  // Remittance operations
  getRemittances(orgId: string): Promise<Remittance[]>;
  createRemittance(remittance: InsertRemittance): Promise<Remittance>;
  
  // Audit operations
  createAuditEvent(event: InsertAuditEvent): Promise<AuditEvent>;
  getAuditEvents(orgId: string, limit?: number): Promise<AuditEvent[]>;
  createAuditLog(event: any): Promise<any>;
  
  // Scheduler operations
  getClaimsByStatus(statuses: string[]): Promise<Claim[]>;
  
  // Dashboard KPIs
  getDashboardStats(orgId: string): Promise<{
    totalClaims: number;
    pendingClaims: number;
    successRate: number;
    monthlyRevenue: number;
  }>;

  // EDI Connector operations
  upsertConnectorConfig(config: InsertConnectorConfig): Promise<ConnectorConfig>;
  getConnectorConfig(orgId: string, name: string): Promise<ConnectorConfig | undefined>;
  createConnectorTransaction(transaction: InsertConnectorTransaction): Promise<ConnectorTransaction>;
  updateConnectorTransaction(id: string, updates: Partial<ConnectorTransaction>): Promise<ConnectorTransaction | undefined>;
  createConnectorError(error: InsertConnectorError): Promise<ConnectorError>;
  getConnectorEvents(claimId: string): Promise<ConnectorTransaction[]>;

  // MFA operations
  updateUserMFA(id: string, updates: {
    mfaSecret?: string | null;
    mfaEnabled?: boolean;
    mfaBackupCodes?: string[] | null;
    mfaEnforcedAt?: Date | null;
  }): Promise<User | undefined>;
  getUserMFA(id: string): Promise<{
    mfaSecret: string | null;
    mfaEnabled: boolean;
    mfaBackupCodes: string[] | null;
    mfaEnforcedAt: Date | null;
  } | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ? decryptRecord('users', user) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // For email searches, we need to encrypt the search value for comparison
    // Note: This requires deterministic encryption for email field or storing a hash
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user ? decryptRecord('users', user) : undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const encryptedData = encryptRecord('users', userData);
    const [user] = await db
      .insert(users)
      .values(encryptedData)
      .returning();
    return decryptRecord('users', user);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const dataWithOrg = {
      ...userData,
      // Auto-assign to first organization for development
      orgId: userData.orgId || (await this.getFirstOrganization())?.id,
    };
    const encryptedData = encryptRecord('users', dataWithOrg);
    const [user] = await db
      .insert(users)
      .values(encryptedData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...encryptedData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return decryptRecord('users', user);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const encryptedUpdates = encryptRecord('users', { ...updates, updatedAt: new Date() });
    const [user] = await db
      .update(users)
      .set(encryptedUpdates)
      .where(eq(users.id, id))
      .returning();
    return user ? decryptRecord('users', user) : undefined;
  }

  async getFirstOrganization(): Promise<{ id: string } | undefined> {
    const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1);
    return org;
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org ? decryptRecord('organizations', org) : undefined;
  }

  async getOrganizationById(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org ? decryptRecord('organizations', org) : undefined;
  }

  async getOrganizationByExternalId(externalId: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.externalId, externalId));
    return org ? decryptRecord('organizations', org) : undefined;
  }

  async createOrganization(orgData: InsertOrganization): Promise<Organization> {
    // Remove externalId if it exists since the column may not be in the database yet
    const { externalId, ...safeOrgData } = orgData as any;
    const encryptedData = encryptRecord('organizations', safeOrgData);
    const [org] = await db.insert(organizations).values(encryptedData).returning();
    return decryptRecord('organizations', org);
  }



  async getPatient(id: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient ? decryptRecord('patients', patient) : undefined;
  }

  async createPatient(patientData: InsertPatient): Promise<Patient> {
    const encryptedData = encryptRecord('patients', patientData);
    const [patient] = await db.insert(patients).values(encryptedData).returning();
    return decryptRecord('patients', patient);
  }



  async getProvider(id: string): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.id, id));
    return provider ? decryptRecord('providers', provider) : undefined;
  }

  async createProvider(providerData: InsertProvider): Promise<Provider> {
    const encryptedData = encryptRecord('providers', providerData);
    const [provider] = await db.insert(providers).values(encryptedData).returning();
    return decryptRecord('providers', provider);
  }

  async getInsurers(): Promise<Insurer[]> {
    return await db.select().from(insurers).orderBy(asc(insurers.name));
  }

  async getInsurer(id: string): Promise<Insurer | undefined> {
    const [insurer] = await db.select().from(insurers).where(eq(insurers.id, id));
    return insurer;
  }

  async createInsurer(data: any): Promise<Insurer> {
    const [insurer] = await db.insert(insurers).values(data).returning();
    return insurer;
  }

  async getClaims(orgId: string, userId?: string, role?: string): Promise<Claim[]> {
    const baseConditions = [eq(claims.orgId, orgId)];
    
    // Role-based filtering
    if (role === 'provider' && userId) {
      baseConditions.push(eq(claims.createdBy, userId));
    }
    
    const results = await db
      .select()
      .from(claims)
      .where(and(...baseConditions))
      .orderBy(desc(claims.createdAt));
    
    // Decrypt all claims
    return results.map(claim => decryptRecord('claims', claim));
  }

  async getClaim(id: string): Promise<Claim | undefined> {
    const [claim] = await db.select().from(claims).where(eq(claims.id, id));
    return claim ? decryptRecord('claims', claim) : undefined;
  }

  async createClaim(claimData: InsertClaim): Promise<Claim> {
    const encryptedData = encryptRecord('claims', claimData);
    const [claim] = await db.insert(claims).values(encryptedData).returning();
    return decryptRecord('claims', claim);
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<Claim | undefined> {
    const encryptedUpdates = encryptRecord('claims', { ...updates, updatedAt: new Date() });
    const [claim] = await db
      .update(claims)
      .set(encryptedUpdates)
      .where(eq(claims.id, id))
      .returning();
    return claim ? decryptRecord('claims', claim) : undefined;
  }

  async getAttachments(claimId: string): Promise<Attachment[]> {
    const results = await db.select().from(attachments).where(eq(attachments.claimId, claimId));
    return results.map(att => decryptRecord('attachments', att));
  }

  async createAttachment(attachmentData: InsertAttachment): Promise<Attachment> {
    const encryptedData = encryptRecord('attachments', attachmentData);
    const [attachment] = await db.insert(attachments).values(encryptedData).returning();
    return decryptRecord('attachments', attachment);
  }

  async getRemittances(orgId: string): Promise<Remittance[]> {
    const results = await db
      .select({
        id: remittances.id,
        insurerId: remittances.insurerId,
        claimId: remittances.claimId,
        status: remittances.status,
        amountPaid: remittances.amountPaid,
        raw: remittances.raw,
        createdAt: remittances.createdAt
      })
      .from(remittances)
      .innerJoin(insurers, eq(remittances.insurerId, insurers.id))
      .orderBy(desc(remittances.createdAt));
    // Decrypt raw field which may contain PHI
    return results.map(r => decryptRecord('remittances', r));
  }

  async createRemittance(remittanceData: InsertRemittance): Promise<Remittance> {
    const encryptedData = encryptRecord('remittances', remittanceData);
    const [remittance] = await db.insert(remittances).values(encryptedData).returning();
    return decryptRecord('remittances', remittance);
  }

  async createAuditEvent(eventData: InsertAuditEvent): Promise<AuditEvent> {
    const encryptedData = encryptRecord('auditEvents', eventData);
    const [event] = await db.insert(auditEvents).values(encryptedData).returning();
    return decryptRecord('auditEvents', event);
  }

  async getAuditEvents(orgId: string, limit = 100): Promise<AuditEvent[]> {
    const results = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.orgId, orgId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);
    return results.map(event => decryptRecord('auditEvents', event));
  }

  async createAuditLog(event: any): Promise<any> {
    // Redirect to existing audit event creation for compatibility
    return this.createAuditEvent(event);
  }

  async getClaimsByStatus(statuses: string[]): Promise<Claim[]> {
    const results = await db
      .select()
      .from(claims)
      .where(sql`${claims.status} = ANY(${statuses})`)
      .orderBy(desc(claims.updatedAt));
    return results.map(claim => decryptRecord('claims', claim));
  }

  async getDashboardStats(orgId: string): Promise<{
    totalClaims: number;
    pendingClaims: number;
    successRate: number;
    monthlyRevenue: number;
  }> {
    const totalClaimsResult = await db
      .select({ count: count() })
      .from(claims)
      .where(eq(claims.orgId, orgId));

    const pendingClaimsResult = await db
      .select({ count: count() })
      .from(claims)
      .where(and(eq(claims.orgId, orgId), eq(claims.status, 'pending')));

    const paidClaimsResult = await db
      .select({ count: count() })
      .from(claims)
      .where(and(eq(claims.orgId, orgId), eq(claims.status, 'paid')));

    const monthlyRevenueResult = await db
      .select({ 
        sum: sql<string>`sum(${claims.amount})` 
      })
      .from(claims)
      .where(
        and(
          eq(claims.orgId, orgId),
          eq(claims.status, 'paid'),
          sql`${claims.createdAt} >= date_trunc('month', current_date)`
        )
      );

    const totalClaims = totalClaimsResult[0]?.count || 0;
    const pendingClaims = pendingClaimsResult[0]?.count || 0;
    const paidClaims = paidClaimsResult[0]?.count || 0;
    const monthlyRevenue = parseFloat(monthlyRevenueResult[0]?.sum || '0');
    
    const successRate = totalClaims > 0 ? (paidClaims / totalClaims) * 100 : 0;

    return {
      totalClaims,
      pendingClaims,
      successRate,
      monthlyRevenue,
    };
  }

  async updateClaimStatus(id: string, status: string): Promise<void> {
    // Status is not PHI, but we still use encryptRecord for consistency
    const updates = { 
      status: status as any,
      updatedAt: new Date(),
    };
    await db
      .update(claims)
      .set(updates)
      .where(eq(claims.id, id));
  }

  // EDI Connector operations implementation
  async upsertConnectorConfig(config: InsertConnectorConfig): Promise<ConnectorConfig> {
    const [result] = await db
      .insert(connectorConfigs)
      .values(config)
      .onConflictDoUpdate({
        target: [connectorConfigs.orgId, connectorConfigs.name],
        set: {
          enabled: config.enabled,
          mode: config.mode,
          settings: config.settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getConnectorConfig(orgId: string, name: string): Promise<ConnectorConfig | undefined> {
    const [config] = await db
      .select()
      .from(connectorConfigs)
      .where(and(
        eq(connectorConfigs.orgId, orgId),
        eq(connectorConfigs.name, name as any)
      ));
    return config;
  }

  async createConnectorTransaction(transaction: InsertConnectorTransaction): Promise<ConnectorTransaction> {
    const [result] = await db
      .insert(connectorTransactions)
      .values(transaction)
      .returning();
    return result;
  }

  async updateConnectorTransaction(id: string, updates: Partial<ConnectorTransaction>): Promise<ConnectorTransaction | undefined> {
    const [result] = await db
      .update(connectorTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(connectorTransactions.id, id))
      .returning();
    return result;
  }

  async createConnectorError(error: InsertConnectorError): Promise<ConnectorError> {
    const [result] = await db
      .insert(connectorErrors)
      .values(error)
      .returning();
    return result;
  }

  async getConnectorEvents(claimId: string): Promise<ConnectorTransaction[]> {
    return await db
      .select()
      .from(connectorTransactions)
      .where(eq(connectorTransactions.claimId, claimId))
      .orderBy(desc(connectorTransactions.createdAt));
  }

  // MFA operations
  async updateUserMFA(id: string, updates: {
    mfaSecret?: string | null;
    mfaEnabled?: boolean;
    mfaBackupCodes?: string[] | null;
    mfaEnforcedAt?: Date | null;
  }): Promise<User | undefined> {
    const mfaData: any = {};
    
    if ('mfaSecret' in updates) {
      mfaData.mfaSecret = updates.mfaSecret;
    }
    if ('mfaEnabled' in updates) {
      mfaData.mfaEnabled = updates.mfaEnabled;
    }
    if ('mfaBackupCodes' in updates) {
      mfaData.mfaBackupCodes = updates.mfaBackupCodes ? JSON.stringify(updates.mfaBackupCodes) : null;
    }
    if ('mfaEnforcedAt' in updates) {
      mfaData.mfaEnforcedAt = updates.mfaEnforcedAt;
    }
    
    const encryptedData = encryptRecord('users', { ...mfaData, updatedAt: new Date() });
    const [user] = await db
      .update(users)
      .set(encryptedData)
      .where(eq(users.id, id))
      .returning();
    return user ? decryptRecord('users', user) : undefined;
  }

  async getUserMFA(id: string): Promise<{
    mfaSecret: string | null;
    mfaEnabled: boolean;
    mfaBackupCodes: string[] | null;
    mfaEnforcedAt: Date | null;
  } | undefined> {
    const [user] = await db
      .select({
        mfaSecret: users.mfaSecret,
        mfaEnabled: users.mfaEnabled,
        mfaBackupCodes: users.mfaBackupCodes,
        mfaEnforcedAt: users.mfaEnforcedAt,
      })
      .from(users)
      .where(eq(users.id, id));
    
    if (!user) return undefined;
    
    const decrypted = decryptRecord('users', user);
    return {
      mfaSecret: decrypted.mfaSecret || null,
      mfaEnabled: decrypted.mfaEnabled || false,
      mfaBackupCodes: decrypted.mfaBackupCodes ? JSON.parse(decrypted.mfaBackupCodes) : null,
      mfaEnforcedAt: decrypted.mfaEnforcedAt || null,
    };
  }

  // Enhanced methods for EDI requirements
  async getPatients(orgId: string, filter?: { id?: string }): Promise<Patient[]> {
    const conditions = [eq(patients.orgId, orgId)];
    if (filter?.id) {
      conditions.push(eq(patients.id, filter.id));
    }
    
    const results = await db
      .select()
      .from(patients)
      .where(and(...conditions))
      .orderBy(asc(patients.name));
    
    return results.map(patient => decryptRecord('patients', patient));
  }

  async getProviders(orgId: string, filter?: { id?: string }): Promise<Provider[]> {
    const conditions = [eq(providers.orgId, orgId)];
    if (filter?.id) {
      conditions.push(eq(providers.id, filter.id));
    }
    
    const results = await db
      .select()
      .from(providers)
      .where(and(...conditions))
      .orderBy(asc(providers.name));
    
    return results.map(provider => decryptRecord('providers', provider));
  }
}

export const storage = new DatabaseStorage();
