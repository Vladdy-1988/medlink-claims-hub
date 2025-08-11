import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create organization
  const organization = await prisma.organization.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440000' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Sunrise Medical Clinic',
      address: '123 Healthcare Avenue, Toronto, ON M5H 2N2',
      phone: '(416) 555-0123',
      website: 'https://sunrise-clinic.com',
    },
  });

  console.log('Created organization:', organization.name);

  // Create users
  const adminUser = await prisma.user.upsert({
    where: { id: 'admin-user-001' },
    update: {},
    create: {
      id: 'admin-user-001',
      email: 'admin@sunrise-clinic.com',
      firstName: 'Admin',
      lastName: 'Smith',
      role: 'admin',
      orgId: organization.id,
    },
  });

  const providerUser = await prisma.user.upsert({
    where: { id: 'provider-user-001' },
    update: {},
    create: {
      id: 'provider-user-001',
      email: 'jane.doe@sunrise-clinic.com',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'provider',
      orgId: organization.id,
    },
  });

  const billingUser = await prisma.user.upsert({
    where: { id: 'billing-user-001' },
    update: {},
    create: {
      id: 'billing-user-001',
      email: 'maria.brown@sunrise-clinic.com',
      firstName: 'Maria',
      lastName: 'Brown',
      role: 'billing',
      orgId: organization.id,
    },
  });

  console.log('Created users:', [adminUser.email, providerUser.email, billingUser.email]);

  // Create insurance providers
  const insurers = await Promise.all([
    prisma.insurer.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440001' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Blue Cross',
        rail: 'telusEclaims',
      },
    }),
    prisma.insurer.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440002' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Manulife',
        rail: 'cdanet',
      },
    }),
    prisma.insurer.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440003' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Sun Life',
        rail: 'portal',
      },
    }),
    prisma.insurer.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440004' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440004',
        name: 'Great West Life',
        rail: 'telusEclaims',
      },
    }),
  ]);

  console.log('Created insurers:', insurers.map(i => i.name));

  // Create providers
  const providers = await Promise.all([
    prisma.provider.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440010' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440010',
        orgId: organization.id,
        name: 'Dr. Jane Doe',
        discipline: 'Physiotherapy',
        licenceNumber: 'PT-12345',
      },
    }),
    prisma.provider.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440011' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440011',
        orgId: organization.id,
        name: 'Sarah Wilson',
        discipline: 'Massage Therapy',
        licenceNumber: 'MT-67890',
      },
    }),
    prisma.provider.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440012' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440012',
        orgId: organization.id,
        name: 'Dr. Michael Chen',
        discipline: 'Chiropractic',
        licenceNumber: 'DC-11223',
      },
    }),
  ]);

  console.log('Created providers:', providers.map(p => p.name));

  // Create patients
  const patients = await Promise.all([
    prisma.patient.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440020' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440020',
        orgId: organization.id,
        name: 'Michael Johnson',
        dob: new Date('1985-03-15'),
        identifiers: {
          healthCard: '1234567890',
          insuranceId: 'BC-MJ-001',
        },
      },
    }),
    prisma.patient.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440021' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440021',
        orgId: organization.id,
        name: 'Sarah Parker',
        dob: new Date('1990-07-22'),
        identifiers: {
          healthCard: '2345678901',
          insuranceId: 'ML-SP-002',
        },
      },
    }),
    prisma.patient.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440022' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440022',
        orgId: organization.id,
        name: 'Robert Thompson',
        dob: new Date('1978-11-08'),
        identifiers: {
          healthCard: '3456789012',
          insuranceId: 'SL-RT-003',
        },
      },
    }),
    prisma.patient.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440023' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440023',
        orgId: organization.id,
        name: 'Emily Davis',
        dob: new Date('1992-04-18'),
        identifiers: {
          healthCard: '4567890123',
          insuranceId: 'GWL-ED-004',
        },
      },
    }),
    prisma.patient.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440024' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440024',
        orgId: organization.id,
        name: 'David Wilson',
        dob: new Date('1975-09-12'),
        identifiers: {
          healthCard: '5678901234',
          insuranceId: 'BC-DW-005',
        },
      },
    }),
  ]);

  console.log('Created patients:', patients.map(p => p.name));

  // Create appointments
  const appointments = await Promise.all([
    prisma.appointment.create({
      data: {
        orgId: organization.id,
        patientId: patients[0].id,
        providerId: providers[0].id,
        scheduledAt: new Date('2024-01-15T10:00:00Z'),
      },
    }),
    prisma.appointment.create({
      data: {
        orgId: organization.id,
        patientId: patients[1].id,
        providerId: providers[1].id,
        scheduledAt: new Date('2024-01-14T14:30:00Z'),
      },
    }),
    prisma.appointment.create({
      data: {
        orgId: organization.id,
        patientId: patients[2].id,
        providerId: providers[2].id,
        scheduledAt: new Date('2024-01-13T09:15:00Z'),
      },
    }),
  ]);

  console.log('Created appointments:', appointments.length);

  // Create sample claims
  const claims = await Promise.all([
    prisma.claim.create({
      data: {
        orgId: organization.id,
        patientId: patients[0].id,
        providerId: providers[0].id,
        insurerId: insurers[0].id,
        appointmentId: appointments[0].id,
        type: 'claim',
        status: 'submitted',
        amount: 85.00,
        codes: ['91102'],
        notes: 'Physiotherapy session for lower back pain',
        referenceNumber: 'BC-2024-001501',
        createdBy: providerUser.id,
      },
    }),
    prisma.claim.create({
      data: {
        orgId: organization.id,
        patientId: patients[1].id,
        providerId: providers[1].id,
        insurerId: insurers[1].id,
        appointmentId: appointments[1].id,
        type: 'claim',
        status: 'paid',
        amount: 120.00,
        codes: ['92204'],
        notes: 'Therapeutic massage session',
        referenceNumber: 'ML-2024-001402',
        createdBy: providerUser.id,
      },
    }),
    prisma.claim.create({
      data: {
        orgId: organization.id,
        patientId: patients[2].id,
        providerId: providers[2].id,
        insurerId: insurers[2].id,
        appointmentId: appointments[2].id,
        type: 'claim',
        status: 'infoRequested',
        amount: 95.00,
        codes: ['99213'],
        notes: 'Chiropractic adjustment and assessment',
        referenceNumber: 'SL-2024-001303',
        createdBy: providerUser.id,
      },
    }),
    prisma.claim.create({
      data: {
        orgId: organization.id,
        patientId: patients[3].id,
        providerId: providers[0].id,
        insurerId: insurers[3].id,
        type: 'preauth',
        status: 'pending',
        amount: 1080.00,
        codes: ['91102', '91103'],
        notes: 'Pre-authorization for 12 physiotherapy sessions over 6 weeks for chronic pain management',
        createdBy: providerUser.id,
      },
    }),
    prisma.claim.create({
      data: {
        orgId: organization.id,
        patientId: patients[4].id,
        providerId: providers[1].id,
        insurerId: insurers[0].id,
        type: 'claim',
        status: 'draft',
        amount: 110.00,
        codes: ['92205'],
        notes: 'Draft claim for deep tissue massage',
        createdBy: providerUser.id,
      },
    }),
  ]);

  console.log('Created claims:', claims.length);

  // Create sample remittances
  const remittances = await Promise.all([
    prisma.remittance.create({
      data: {
        insurerId: insurers[1].id,
        claimId: claims[1].id,
        status: 'processed',
        amountPaid: 120.00,
        raw: {
          transactionId: 'TXN-20240114-001',
          paymentDate: '2024-01-14',
          claimReference: 'ML-2024-001402',
        },
      },
    }),
    prisma.remittance.create({
      data: {
        insurerId: insurers[0].id,
        status: 'received',
        raw: {
          fileName: 'bluecross_remittance_20240115.pdf',
          uploadDate: '2024-01-15',
          totalAmount: 1250.00,
          claimCount: 8,
        },
      },
    }),
  ]);

  console.log('Created remittances:', remittances.length);

  // Create audit events
  const auditEvents = await Promise.all([
    prisma.auditEvent.create({
      data: {
        orgId: organization.id,
        actorUserId: providerUser.id,
        type: 'claim_created',
        details: {
          claimId: claims[0].id,
          patientId: patients[0].id,
          amount: 85.00,
        },
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }),
    prisma.auditEvent.create({
      data: {
        orgId: organization.id,
        actorUserId: providerUser.id,
        type: 'claim_submitted',
        details: {
          claimId: claims[0].id,
          rail: 'telusEclaims',
          referenceNumber: 'BC-2024-001501',
        },
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }),
    prisma.auditEvent.create({
      data: {
        orgId: organization.id,
        actorUserId: billingUser.id,
        type: 'remittance_uploaded',
        details: {
          remittanceId: remittances[0].id,
          fileName: 'bluecross_remittance_20240115.pdf',
        },
        ip: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    }),
  ]);

  console.log('Created audit events:', auditEvents.length);

  console.log('Database seed completed successfully!');
  console.log('\nSample data created:');
  console.log(`- Organization: ${organization.name}`);
  console.log(`- Users: ${[adminUser, providerUser, billingUser].length} (admin, provider, billing)`);
  console.log(`- Insurers: ${insurers.length}`);
  console.log(`- Providers: ${providers.length}`);
  console.log(`- Patients: ${patients.length}`);
  console.log(`- Appointments: ${appointments.length}`);
  console.log(`- Claims: ${claims.length} (various statuses)`);
  console.log(`- Remittances: ${remittances.length}`);
  console.log(`- Audit Events: ${auditEvents.length}`);
  
  console.log('\nTest accounts:');
  console.log(`- Admin: ${adminUser.email} (role: admin)`);
  console.log(`- Provider: ${providerUser.email} (role: provider)`);
  console.log(`- Billing: ${billingUser.email} (role: billing)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
