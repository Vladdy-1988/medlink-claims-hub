import { db } from "./db";
import { insurers, organizations, users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Starting database seed...");

  try {
    // Check if insurers already exist
    const existingInsurers = await db.select().from(insurers);
    
    if (existingInsurers.length === 0) {
      console.log("Seeding insurers...");
      
      const canadianInsurers = [
        { name: "Manulife Financial", rail: "telusEclaims" as const },
        { name: "Sun Life Financial", rail: "telusEclaims" as const },
        { name: "Blue Cross Canada", rail: "telusEclaims" as const },
        { name: "Desjardins Group", rail: "telusEclaims" as const },
        { name: "GreenShield Canada", rail: "telusEclaims" as const },
        { name: "Canada Life", rail: "telusEclaims" as const },
        { name: "Empire Life", rail: "telusEclaims" as const },
        { name: "Industrial Alliance", rail: "telusEclaims" as const },
        { name: "Equitable Life", rail: "telusEclaims" as const },
        { name: "RBC Insurance", rail: "telusEclaims" as const },
        { name: "TD Insurance", rail: "telusEclaims" as const },
        { name: "SSQ Insurance", rail: "cdanet" as const },
        { name: "Medavie Blue Cross", rail: "cdanet" as const },
        { name: "Pacific Blue Cross", rail: "cdanet" as const },
        { name: "Alberta Blue Cross", rail: "cdanet" as const },
        { name: "Saskatchewan Blue Cross", rail: "cdanet" as const },
        { name: "Manitoba Blue Cross", rail: "cdanet" as const },
        { name: "WSIB Ontario", rail: "portal" as const },
        { name: "WorkSafeBC", rail: "portal" as const },
        { name: "WCB Alberta", rail: "portal" as const },
        { name: "CNESST Quebec", rail: "portal" as const },
        { name: "WCB Manitoba", rail: "portal" as const },
        { name: "WCB Saskatchewan", rail: "portal" as const },
        { name: "WorkplaceNL", rail: "portal" as const },
      ];

      await db.insert(insurers).values(canadianInsurers);
      console.log(`Seeded ${canadianInsurers.length} insurers`);
    } else {
      console.log("Insurers already exist, skipping...");
    }

    // Check for demo organization
    const existingOrgs = await db.select().from(organizations).where(eq(organizations.externalId, "demo-org"));
    
    if (existingOrgs.length === 0) {
      console.log("Creating demo organization...");
      
      await db.insert(organizations).values({
        name: "Demo Medical Clinic",
        externalId: "demo-org",
        province: "ON",
        preferredLanguage: "en-CA",
        privacyOfficerName: "Dr. Jane Smith",
        privacyOfficerEmail: "privacy@democlinic.ca",
        dataRetentionDays: 2555, // 7 years
        privacyContactUrl: "https://democlinic.ca/privacy",
        minimizeLogging: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log("Demo organization created");
    } else {
      console.log("Demo organization already exists, skipping...");
    }

    console.log("Database seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed();