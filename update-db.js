// Script to update database schema
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function updateSchema() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Add new columns to organizations table if they don't exist
    const orgColumns = [
      "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS province VARCHAR(2)",
      "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en-CA'",
      "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS privacy_officer_name VARCHAR",
      "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS privacy_officer_email VARCHAR",
      "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS data_retention_days INTEGER DEFAULT 2555",
      "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS privacy_contact_url VARCHAR",
      "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS minimize_logging BOOLEAN DEFAULT true",
      "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()"
    ];
    
    for (const query of orgColumns) {
      try {
        await pool.query(query);
        console.log('✓ Executed:', query.slice(0, 60) + '...');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('Error:', err.message);
        }
      }
    }
    
    // Add new columns to users table
    const userColumns = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5)"
    ];
    
    for (const query of userColumns) {
      try {
        await pool.query(query);
        console.log('✓ Executed:', query.slice(0, 60) + '...');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('Error:', err.message);
        }
      }
    }
    
    // Add new columns to claims table
    const claimColumns = [
      "ALTER TABLE claims ADD COLUMN IF NOT EXISTS portal_reference_number VARCHAR",
      "ALTER TABLE claims ADD COLUMN IF NOT EXISTS portal_submission_date TIMESTAMP"
    ];
    
    for (const query of claimColumns) {
      try {
        await pool.query(query);
        console.log('✓ Executed:', query.slice(0, 60) + '...');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('Error:', err.message);
        }
      }
    }
    
    console.log('\n✅ Database schema updated successfully!');
  } catch (error) {
    console.error('Database update failed:', error);
  } finally {
    await pool.end();
  }
}

updateSchema();