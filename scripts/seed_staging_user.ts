import bcrypt from 'bcryptjs';
import { DatabaseStorage } from '../server/storage';

async function seedStagingUser() {
  console.log('🌱 Starting staging user seed...');
  
  try {
    // Initialize storage
    const storage = new DatabaseStorage();
    
    // Hash the password with 10 salt rounds
    const passwordHash = await bcrypt.hash('Test1234!', 10);
    
    // Define the test user data
    const testEmail = 'test.user+smoke@medlink.dev';
    
    // Check if user already exists
    let user = await storage.getUserByEmail(testEmail);
    
    if (user) {
      // Update existing user
      user = await storage.updateUser(user.id, {
        firstName: 'Test',
        lastName: 'User',
        role: 'patient',
        passwordHash: passwordHash,
        mfaEnabled: false,
        notificationsEnabled: false,
      });
      
      console.log(`✅ Updated existing test user: ${user?.id}`);
    } else {
      // Create new user
      user = await storage.createUser({
        email: testEmail,
        firstName: 'Test',
        lastName: 'User',
        role: 'patient',
        passwordHash: passwordHash,
        mfaEnabled: false,
        notificationsEnabled: false,
      });
      
      console.log(`✅ Created new test user: ${user.id}`);
    }
    
    console.log('📋 Test user details:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: Test1234!`);
    console.log(`   Role: patient`);
    console.log(`   User ID: ${user?.id}`);
    console.log(`   MFA Enabled: false`);
    
    console.log('\n✨ Staging user seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding staging user:', error);
    process.exit(1);
  }
}

// Run the seed script
seedStagingUser();