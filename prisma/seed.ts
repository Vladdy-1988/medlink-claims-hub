import { db } from "../server/db";
import { organizations, users, providers, patients } from "../shared/schema";

async function seed() {
  console.log("Starting database seed...");

  try {
    // Create sample organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: "MedLink Healthcare",
      })
      .returning();

    console.log("Created organization:", org.name);

    // Create sample providers
    const [provider1] = await db
      .insert(providers)
      .values({
        orgId: org.id,
        name: "Dr. Sarah Johnson",
        discipline: "Family Medicine",
        licenceNumber: "FM123456",
      })
      .returning();

    const [provider2] = await db
      .insert(providers)
      .values({
        orgId: org.id,
        name: "Dr. Mike Chen",
        discipline: "Physiotherapy",
        licenceNumber: "PT789012",
      })
      .returning();

    console.log("Created providers:", provider1.name, provider2.name);

    // Create sample patients
    const [patient1] = await db
      .insert(patients)
      .values({
        orgId: org.id,
        name: "John Doe",
        dob: new Date("1985-06-15"),
        identifiers: {
          healthCard: "1234567890",
          insuranceNumber: "BC123456789",
        },
      })
      .returning();

    const [patient2] = await db
      .insert(patients)
      .values({
        orgId: org.id,
        name: "Jane Smith",
        dob: new Date("1990-03-22"),
        identifiers: {
          healthCard: "0987654321",
          insuranceNumber: "BC987654321",
        },
      })
      .returning();

    console.log("Created patients:", patient1.name, patient2.name);

    console.log("Database seeding completed successfully!");
    console.log("\nTo test the application:");
    console.log("1. Click the login button in the app");
    console.log("2. Authenticate with your Replit account");
    console.log("3. Your user will be automatically created and linked to the organization");
    console.log("\nSample data created:");
    console.log(`- Organization: ${org.name} (ID: ${org.id})`);
    console.log(`- Providers: ${provider1.name}, ${provider2.name}`);
    console.log(`- Patients: ${patient1.name}, ${patient2.name}`);

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// Run the seed function
seed()
  .then(() => {
    console.log("Seed script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed script failed:", error);
    process.exit(1);
  });