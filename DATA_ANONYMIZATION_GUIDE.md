# Data Anonymization Pipeline Guide

## Overview
This document describes the comprehensive data anonymization pipeline for staging environments to ensure NO real PHI is used in testing.

## Components

### 1. Data Anonymizer Module (`server/security/anonymizer.ts`)
- **Deterministic anonymization**: Same input always produces same output (maintains referential integrity)
- **Canadian-specific formats**: Health cards, postal codes, phone numbers
- **PHI field support**: Names, DOB, addresses, emails, license numbers, claim numbers
- **TEST- prefix**: All anonymized data is clearly marked with TEST- prefix

### 2. Anonymize Staging Script (`server/scripts/anonymize-staging.ts`)
Anonymizes existing data in staging database:
- Replaces all PHI with synthetic data
- Maintains foreign key relationships
- Provides dry-run mode for safety
- Shows real-time progress and statistics
- Creates audit log of anonymization

### 3. Generate Test Data Script (`server/scripts/generate-test-data.ts`)
Creates completely synthetic test data:
- Generates organizations, users, patients, providers
- Creates realistic claims with various statuses
- Adds attachments, remittances, audit events
- Configurable data volumes

## Usage

### Anonymizing Existing Staging Data

```bash
# Run the anonymization script
./anonymize-staging.sh

# Or directly with tsx
NODE_ENV=staging tsx server/scripts/anonymize-staging.ts
```

**Safety Features:**
- Environment check (blocks production)
- Database URL validation
- Requires typing 'ANONYMIZE STAGING' to confirm
- Dry-run mode available
- Creates audit event for tracking

### Generating Synthetic Test Data

```bash
# Generate with default settings
./generate-test-data.sh

# Generate with custom volumes
./generate-test-data.sh --organizations 3 --patientsPerOrg 50

# View all options
./generate-test-data.sh --help
```

**Available Options:**
- `--organizations <n>`: Number of organizations (default: 2)
- `--usersPerOrg <n>`: Users per organization (default: 5)
- `--patientsPerOrg <n>`: Patients per organization (default: 20)
- `--providersPerOrg <n>`: Providers per organization (default: 10)
- `--claimsPerPatient <n>`: Claims per patient (default: 3)

### Testing the Anonymizer

```bash
# Run the test suite
tsx server/scripts/test-anonymizer.ts
```

Tests verify:
- Deterministic anonymization
- Format correctness (Canadian formats)
- Safety checks
- Data generation

## Anonymized Fields by Table

### Users Table
- `firstName` → TEST-[Generated First Name]
- `lastName` → [Generated Last Name]
- `email` → test.user.[hash]@staging.medlink.ca
- MFA fields → Cleared

### Patients Table
- `name` → TEST-[Generated Full Name]
- `dob` → Random date (18-85 years ago)
- `identifiers` → Synthetic health card numbers

### Providers Table
- `name` → TEST-Dr. [Generated Name]
- `licenceNumber` → TEST-LIC-[Hash]

### Claims Table
- `claimNumber` → TEST-CLM-[Hash]
- `notes` → [ANONYMIZED TEST DATA] Lorem ipsum...
- `referenceNumber` → TEST-REF-[Hash]
- `externalId` → TEST-EXT-[Hash]

### Organizations Table
- `name` → TEST-[Organization Name]
- `privacyOfficerName` → TEST-[Generated Name]
- `privacyOfficerEmail` → test.privacy.[n]@staging.medlink.ca

### Attachments Table
- `url` → https://test-storage.medlink.ca/anonymized/[hash].[ext]

### Audit Events Table
- `details` → Sanitized with [ANONYMIZED] markers
- `ip` → 127.0.0.1
- `userAgent` → TEST-BROWSER/1.0

## Safety Mechanisms

1. **Environment Detection**
   - Checks NODE_ENV (blocks if 'production')
   - Validates DATABASE_URL for staging/test keywords
   - Blocks URLs containing 'prod', 'production', 'live', 'master'

2. **Confirmation Required**
   - User must type 'ANONYMIZE STAGING' exactly
   - Dry-run mode recommended first
   - Clear warnings displayed

3. **Audit Trail**
   - Creates audit event for every anonymization
   - Logs statistics and timestamp
   - Tracks errors if any occur

## Best Practices

1. **Before Anonymizing:**
   - Ensure you're connected to staging database
   - Consider backing up important test scenarios
   - Run in dry-run mode first

2. **After Anonymizing:**
   - Verify application still works correctly
   - Check that foreign key relationships are intact
   - Confirm all PHI is replaced

3. **For Development:**
   - Use generate-test-data.sh for fresh data
   - All synthetic data has TEST- prefix for easy identification
   - Data is realistic but completely fake

## Troubleshooting

**Error: Cannot run anonymization in production**
- Solution: Ensure NODE_ENV is set to 'staging' or 'development'

**Error: Database URL contains 'prod'**
- Solution: Verify you're using the staging database URL

**Error: Confirmation not received**
- Solution: Type 'ANONYMIZE STAGING' exactly as shown

**Data relationships broken**
- Solution: The anonymizer is deterministic - same input always produces same output, maintaining referential integrity

## Security Notes

- Never run these scripts in production
- All generated data is clearly marked with TEST- prefix
- Original PHI is completely replaced, not just masked
- Deterministic anonymization ensures consistent relationships

## Support

For issues or questions about the data anonymization pipeline, please consult the development team or review the source code in:
- `server/security/anonymizer.ts`
- `server/scripts/anonymize-staging.ts`
- `server/scripts/generate-test-data.ts`