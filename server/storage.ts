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
  type InsertUser,
  type InsertOrganization,
  type InsertPatient,
  type InsertProvider,
  type InsertClaim,
  type InsertAttachment,
  type InsertRemittance,
  type InsertAuditEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Organization operations
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  
  // Patient operations
  getPatients(orgId: string): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  
  // Provider operations
  getProviders(orgId: string): Promise<Provider[]>;
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        // Auto-assign to first organization for development
        orgId: userData.orgId || (await this.getFirstOrganization())?.id,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getFirstOrganization(): Promise<{ id: string } | undefined> {
    const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1);
    return org;
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async createOrganization(orgData: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(orgData).returning();
    return org;
  }

  async getPatients(orgId: string): Promise<Patient[]> {
    return await db.select().from(patients).where(eq(patients.orgId, orgId));
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient;
  }

  async createPatient(patientData: InsertPatient): Promise<Patient> {
    const [patient] = await db.insert(patients).values(patientData).returning();
    return patient;
  }

  async getProviders(orgId: string): Promise<Provider[]> {
    return await db.select().from(providers).where(eq(providers.orgId, orgId));
  }

  async getProvider(id: string): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.id, id));
    return provider;
  }

  async createProvider(providerData: InsertProvider): Promise<Provider> {
    const [provider] = await db.insert(providers).values(providerData).returning();
    return provider;
  }

  async getInsurers(): Promise<Insurer[]> {
    return await db.select().from(insurers).orderBy(asc(insurers.name));
  }

  async getInsurer(id: string): Promise<Insurer | undefined> {
    const [insurer] = await db.select().from(insurers).where(eq(insurers.id, id));
    return insurer;
  }

  async getClaims(orgId: string, userId?: string, role?: string): Promise<Claim[]> {
    let query = db.select().from(claims).where(eq(claims.orgId, orgId));
    
    // Role-based filtering
    if (role === 'provider' && userId) {
      query = query.where(and(eq(claims.orgId, orgId), eq(claims.createdBy, userId)));
    }
    
    return await query.orderBy(desc(claims.createdAt));
  }

  async getClaim(id: string): Promise<Claim | undefined> {
    const [claim] = await db.select().from(claims).where(eq(claims.id, id));
    return claim;
  }

  async createClaim(claimData: InsertClaim): Promise<Claim> {
    const [claim] = await db.insert(claims).values(claimData).returning();
    return claim;
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<Claim | undefined> {
    const [claim] = await db
      .update(claims)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();
    return claim;
  }

  async getAttachments(claimId: string): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.claimId, claimId));
  }

  async createAttachment(attachmentData: InsertAttachment): Promise<Attachment> {
    const [attachment] = await db.insert(attachments).values(attachmentData).returning();
    return attachment;
  }

  async getRemittances(orgId: string): Promise<Remittance[]> {
    return await db
      .select()
      .from(remittances)
      .innerJoin(insurers, eq(remittances.insurerId, insurers.id))
      .orderBy(desc(remittances.createdAt));
  }

  async createRemittance(remittanceData: InsertRemittance): Promise<Remittance> {
    const [remittance] = await db.insert(remittances).values(remittanceData).returning();
    return remittance;
  }

  async createAuditEvent(eventData: InsertAuditEvent): Promise<AuditEvent> {
    const [event] = await db.insert(auditEvents).values(eventData).returning();
    return event;
  }

  async getAuditEvents(orgId: string, limit = 100): Promise<AuditEvent[]> {
    return await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.orgId, orgId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);
  }

  async createAuditLog(event: any): Promise<any> {
    // Redirect to existing audit event creation for compatibility
    return this.createAuditEvent(event);
  }

  async getClaimsByStatus(statuses: string[]): Promise<Claim[]> {
    return await db
      .select()
      .from(claims)
      .where(sql`${claims.status} = ANY(${statuses})`)
      .orderBy(desc(claims.updatedAt));
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
}

export const storage = new DatabaseStorage();
