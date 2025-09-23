/**
 * Centralized Data Access Layer
 * All database operations MUST go through this repository layer.
 * This ensures field-level encryption is applied consistently.
 */

import { db } from '../db';
import { 
  patients, 
  claims, 
  providers, 
  users,
  organizations,
  insurers,
  appointments,
  preAuths
} from '@shared/schema';
import { eq, and, or, desc, sql, like } from 'drizzle-orm';
import { encryptPHI, decryptPHI, hashForSearch } from '../security/field-encryption';

// PHI fields that must be encrypted
const PHI_FIELDS: Record<string, string[]> = {
  patients: ['name', 'email', 'phone', 'address'],
  users: ['email', 'phone', 'mfaSecret'],
  providers: ['email', 'phone'],
  claims: ['notes'],
  preAuths: ['notes'],
  appointments: ['notes']
};

// Generic encryption wrapper
function encryptRecord<T extends Record<string, any>>(
  tableName: string, 
  record: T
): T {
  const fields = PHI_FIELDS[tableName] || [];
  const encrypted = { ...record } as any;
  
  for (const field of fields) {
    if (record[field] !== undefined && record[field] !== null) {
      encrypted[field] = encryptPHI(record[field]);
      // Store searchable hash for email/phone fields
      if (field === 'email' || field === 'phone') {
        encrypted[`${field}_hash`] = hashForSearch(record[field]);
      }
    }
  }
  
  return encrypted;
}

// Generic decryption wrapper
function decryptRecord<T extends Record<string, any>>(
  tableName: string,
  record: T | null
): T | null {
  if (!record) return null;
  
  const fields = PHI_FIELDS[tableName] || [];
  const decrypted = { ...record } as any;
  
  for (const field of fields) {
    if (decrypted[field]) {
      try {
        decrypted[field] = decryptPHI(decrypted[field]);
      } catch (e) {
        // If decryption fails, it might be plaintext (legacy data)
        // Log this for migration tracking
        console.warn(`Warning: Found unencrypted ${field} in ${tableName}`);
      }
    }
  }
  
  // Remove hash fields from output
  delete decrypted['email_hash'];
  delete decrypted['phone_hash'];
  
  return decrypted;
}

// Batch decryption helper
function decryptRecords<T extends Record<string, any>>(
  tableName: string,
  records: T[]
): T[] {
  return records.map(r => decryptRecord(tableName, r)!);
}

/**
 * Patients Repository
 */
export const patientsRepo = {
  async create(data: typeof patients.$inferInsert) {
    const encrypted = encryptRecord('patients', data);
    const [patient] = await db.insert(patients)
      .values(encrypted)
      .returning();
    return decryptRecord('patients', patient);
  },

  async findById(id: string) {
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, id),
      with: {
        organization: true,
        appointments: true,
        claims: true
      }
    });
    return decryptRecord('patients', patient);
  },

  async findByOrgId(orgId: string) {
    const results = await db.query.patients.findMany({
      where: eq(patients.orgId, orgId),
      orderBy: desc(patients.createdAt)
    });
    return decryptRecords('patients', results);
  },

  async findByEmail(email: string) {
    // Use hash for search
    const emailHash = hashForSearch(email);
    const patient = await db.query.patients.findFirst({
      where: eq(patients.email_hash as any, emailHash)
    });
    return decryptRecord('patients', patient);
  },

  async update(id: string, data: Partial<typeof patients.$inferInsert>) {
    const encrypted = encryptRecord('patients', data);
    const [updated] = await db.update(patients)
      .set(encrypted)
      .where(eq(patients.id, id))
      .returning();
    return decryptRecord('patients', updated);
  },

  async delete(id: string) {
    const [deleted] = await db.delete(patients)
      .where(eq(patients.id, id))
      .returning();
    return decryptRecord('patients', deleted);
  }
};

/**
 * Claims Repository
 */
export const claimsRepo = {
  async create(data: typeof claims.$inferInsert) {
    const encrypted = encryptRecord('claims', data);
    const [claim] = await db.insert(claims)
      .values(encrypted)
      .returning();
    return decryptRecord('claims', claim);
  },

  async findById(id: string) {
    const claim = await db.query.claims.findFirst({
      where: eq(claims.id, id),
      with: {
        patient: true,
        provider: true,
        insurer: true,
        appointment: true,
        organization: true
      }
    });
    
    // Decrypt nested PHI
    if (claim) {
      claim.patient = decryptRecord('patients', claim.patient);
      claim.provider = decryptRecord('providers', claim.provider);
    }
    
    return decryptRecord('claims', claim);
  },

  async findByOrgId(orgId: string, limit = 100) {
    const results = await db.query.claims.findMany({
      where: eq(claims.orgId, orgId),
      with: {
        patient: true,
        provider: true,
        insurer: true
      },
      limit,
      orderBy: desc(claims.createdAt)
    });
    
    // Decrypt all nested PHI
    return results.map(claim => {
      claim.patient = decryptRecord('patients', claim.patient);
      claim.provider = decryptRecord('providers', claim.provider);
      return decryptRecord('claims', claim);
    });
  },

  async update(id: string, data: Partial<typeof claims.$inferInsert>) {
    const encrypted = encryptRecord('claims', data);
    const [updated] = await db.update(claims)
      .set(encrypted)
      .where(eq(claims.id, id))
      .returning();
    return decryptRecord('claims', updated);
  },

  async updateStatus(id: string, status: any) {
    const [updated] = await db.update(claims)
      .set({ status, updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();
    return decryptRecord('claims', updated);
  }
};

/**
 * Providers Repository
 */
export const providersRepo = {
  async create(data: typeof providers.$inferInsert) {
    const encrypted = encryptRecord('providers', data);
    const [provider] = await db.insert(providers)
      .values(encrypted)
      .returning();
    return decryptRecord('providers', provider);
  },

  async findById(id: string) {
    const provider = await db.query.providers.findFirst({
      where: eq(providers.id, id),
      with: {
        organization: true,
        claims: true,
        appointments: true
      }
    });
    return decryptRecord('providers', provider);
  },

  async findByOrgId(orgId: string) {
    const results = await db.query.providers.findMany({
      where: eq(providers.orgId, orgId),
      orderBy: desc(providers.createdAt)
    });
    return decryptRecords('providers', results);
  },

  async findByEmail(email: string) {
    const emailHash = hashForSearch(email);
    const provider = await db.query.providers.findFirst({
      where: eq(providers.email_hash as any, emailHash)
    });
    return decryptRecord('providers', provider);
  },

  async update(id: string, data: Partial<typeof providers.$inferInsert>) {
    const encrypted = encryptRecord('providers', data);
    const [updated] = await db.update(providers)
      .set(encrypted)
      .where(eq(providers.id, id))
      .returning();
    return decryptRecord('providers', updated);
  }
};

/**
 * Users Repository
 */
export const usersRepo = {
  async create(data: typeof users.$inferInsert) {
    const encrypted = encryptRecord('users', data);
    const [user] = await db.insert(users)
      .values(encrypted)
      .returning();
    return decryptRecord('users', user);
  },

  async findById(id: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        organization: true
      }
    });
    return decryptRecord('users', user);
  },

  async findByEmail(email: string) {
    const emailHash = hashForSearch(email);
    const user = await db.query.users.findFirst({
      where: eq(users.email_hash as any, emailHash)
    });
    return decryptRecord('users', user);
  },

  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    const encrypted = encryptRecord('users', data);
    const [updated] = await db.update(users)
      .set(encrypted)
      .where(eq(users.id, id))
      .returning();
    return decryptRecord('users', updated);
  },

  async setMFASecret(id: string, secret: string, backupCodes: string[]) {
    // Encrypt MFA secret
    const encryptedSecret = encryptPHI(secret);
    const hashedCodes = backupCodes.map(code => hashForSearch(code));
    
    const [updated] = await db.update(users)
      .set({
        mfaSecret: encryptedSecret,
        mfaBackupCodes: JSON.stringify(hashedCodes),
        mfaEnabled: false, // Not enabled until verified
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
      
    return decryptRecord('users', updated);
  },

  async enableMFA(id: string) {
    const [updated] = await db.update(users)
      .set({
        mfaEnabled: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return decryptRecord('users', updated);
  }
};

/**
 * Organizations Repository
 */
export const orgsRepo = {
  async findById(id: string) {
    return await db.query.organizations.findFirst({
      where: eq(organizations.id, id)
    });
  },

  async update(id: string, data: Partial<typeof organizations.$inferInsert>) {
    const [updated] = await db.update(organizations)
      .set(data)
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }
};

/**
 * Insurers Repository
 */
export const insurersRepo = {
  async findAll() {
    return await db.query.insurers.findMany({
      orderBy: insurers.name
    });
  },

  async findById(id: string) {
    return await db.query.insurers.findFirst({
      where: eq(insurers.id, id)
    });
  }
};

/**
 * Appointments Repository
 */
export const appointmentsRepo = {
  async create(data: typeof appointments.$inferInsert) {
    const encrypted = encryptRecord('appointments', data);
    const [appointment] = await db.insert(appointments)
      .values(encrypted)
      .returning();
    return decryptRecord('appointments', appointment);
  },

  async findById(id: string) {
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, id),
      with: {
        patient: true,
        provider: true
      }
    });
    
    if (appointment) {
      appointment.patient = decryptRecord('patients', appointment.patient);
      appointment.provider = decryptRecord('providers', appointment.provider);
    }
    
    return decryptRecord('appointments', appointment);
  },

  async findByOrgId(orgId: string) {
    const results = await db.query.appointments.findMany({
      where: eq(appointments.orgId, orgId),
      with: {
        patient: true,
        provider: true
      },
      orderBy: desc(appointments.scheduledAt)
    });
    
    return results.map(apt => {
      apt.patient = decryptRecord('patients', apt.patient);
      apt.provider = decryptRecord('providers', apt.provider);
      return decryptRecord('appointments', apt);
    });
  }
};

/**
 * Pre-authorizations Repository  
 */
export const preauthsRepo = {
  async create(data: typeof preAuths.$inferInsert) {
    const encrypted = encryptRecord('preAuths', data);
    const [preauth] = await db.insert(preAuths)
      .values(encrypted)
      .returning();
    return decryptRecord('preAuths', preauth);
  },

  async findById(id: string) {
    const preauth = await db.query.preAuths.findFirst({
      where: eq(preAuths.id, id),
      with: {
        patient: true,
        provider: true,
        insurer: true
      }
    });
    
    if (preauth) {
      preauth.patient = decryptRecord('patients', preauth.patient);
      preauth.provider = decryptRecord('providers', preauth.provider);
    }
    
    return decryptRecord('preAuths', preauth);
  },

  async findByOrgId(orgId: string) {
    const results = await db.query.preAuths.findMany({
      where: eq(preAuths.orgId, orgId),
      orderBy: desc(preAuths.createdAt)
    });
    
    return results.map(preauth => {
      if (preauth.patient) preauth.patient = decryptRecord('patients', preauth.patient);
      if (preauth.provider) preauth.provider = decryptRecord('providers', preauth.provider);
      return decryptRecord('preAuths', preauth);
    });
  },

  async update(id: string, data: Partial<typeof preAuths.$inferInsert>) {
    const encrypted = encryptRecord('preAuths', data);
    const [updated] = await db.update(preAuths)
      .set(encrypted)
      .where(eq(preAuths.id, id))
      .returning();
    return decryptRecord('preAuths', updated);
  }
};

// Export all repos
export default {
  patients: patientsRepo,
  claims: claimsRepo,
  providers: providersRepo,
  users: usersRepo,
  organizations: orgsRepo,
  insurers: insurersRepo,
  appointments: appointmentsRepo,
  preauths: preauthsRepo
};