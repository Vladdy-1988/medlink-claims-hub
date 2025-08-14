import { db } from "./db";
import { organizations } from "../shared/schema";

/**
 * Runs a one-time seed guard to ensure the database has initial data
 * This is idempotent and safe to run multiple times
 */
export async function runSeedGuard() {
  try {
    // Check if any organizations exist
    const existingOrgs = await db.select().from(organizations).limit(1);
    
    if (existingOrgs.length === 0) {
      console.log("No organizations found. Running initial seed...");
      
      // Import and run the seed function dynamically
      const { default: seed } = await import("../prisma/seed");
      await seed();
      
      console.log("Initial seed completed successfully.");
    } else {
      console.log("Database already has data. Skipping seed.");
    }
  } catch (error) {
    console.error("Seed guard failed:", error);
    // Don't throw - let the app continue even if seeding fails
  }
}