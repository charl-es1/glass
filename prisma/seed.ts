import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.join(__dirname, 'dev.db');

const getPrismaInstance = () => {
  const adapter = new PrismaBetterSqlite3({
    url: 'file:' + dbPath,
  });
  return new PrismaClient({ adapter });
};

const prisma = getPrismaInstance();

async function main() {
  console.log('Seeding database...');

  // 1. Clean up existing data to ensure idempotent seeding
  await prisma.securityLog.deleteMany();
  await prisma.securityVerificationItem.deleteMany();
  await prisma.securityVerification.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.lineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.glassType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.subType.deleteMany();
  await prisma.category.deleteMany();

  // 2. Create Users
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const staffPasswordHash = await bcrypt.hash('staff123', 10);
  const supervisorPasswordHash = await bcrypt.hash('supervisor123', 10);
  const securityPasswordHash = await bcrypt.hash('security123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@glasscutting.com',
      password_hash: adminPasswordHash,
      role: 'admin',
      status: 'active',
    },
  });

  const staff = await prisma.user.create({
    data: {
      name: 'John Staff',
      email: 'staff@glasscutting.com',
      password_hash: staffPasswordHash,
      role: 'user',
      status: 'active',
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      name: 'Supervisor User',
      email: 'supervisor@glasscutting.com',
      password_hash: supervisorPasswordHash,
      role: 'supervisor',
      status: 'active',
    },
  });

  const security = await prisma.user.create({
    data: {
      name: 'Officer Kwame',
      email: 'security@glasscutting.com',
      password_hash: securityPasswordHash,
      role: 'security',
      status: 'active',
      pin: '1234',
    },
  });

  console.log(`Users seeded: Admin (${admin.email}), Staff (${staff.email}), Supervisor (${supervisor.email}), Security (${security.email})`);

  // 3. Create Glass Types (Prices in GHS per square meter)
  const glassTypesData = [
    { name: 'Clear Float (5mm)', price_per_sqm: 200.0 },
    { name: 'Frosted Glass (6mm)', price_per_sqm: 350.0 },
    { name: 'Tinted Glass (Bronze/Grey)', price_per_sqm: 400.0 },
    { name: 'Tempered Safety Glass', price_per_sqm: 500.0 },
    { name: 'Laminated Glass (Double)', price_per_sqm: 650.0 },
  ];

  for (const gt of glassTypesData) {
    const created = await prisma.glassType.create({
      data: gt,
    });
    console.log(`Glass Type seeded: ${created.name} - ${created.price_per_sqm} GHS/m²`);
  }

  // 4. Create default Glazing Catalog
  const defaultCatalog = [
    {
      id: 'windows',
      name: 'Window Systems',
      slug: 'window',
      types: [
        { id: 'casement_window', name: 'Casement Window', defaultWidth: 800, defaultHeight: 1200, operationalType: 'hinged' },
        { id: 'awning_window', name: 'Projected / Awning Window', defaultWidth: 1000, defaultHeight: 800, operationalType: 'awning' },
        { id: 'tilt_turn_window', name: 'Tilt and Turn Window', defaultWidth: 900, defaultHeight: 1300, operationalType: 'hinged' },
        { id: 'fanlight_window', name: 'Fanlight Window (Fixed)', defaultWidth: 1200, defaultHeight: 600, operationalType: 'fixed' },
        { id: 'sliding_window', name: 'Sliding Window', defaultWidth: 1500, defaultHeight: 1200, operationalType: 'sliding' },
        { id: 'double_casement_window', name: '2-Opening Casement Window', defaultWidth: 1600, defaultHeight: 1200, operationalType: 'hinged' },
      ],
    },
    {
      id: 'doors',
      name: 'Door Systems',
      slug: 'door',
      types: [
        { id: 'single_hinged_door', name: 'Single Hinged Entry Door', defaultWidth: 900, defaultHeight: 2100, operationalType: 'hinged' },
        { id: 'double_french_door', name: 'Double French Door', defaultWidth: 1800, defaultHeight: 2100, operationalType: 'hinged' },
        { id: 'sliding_patio_door', name: 'Sliding Patio Door (Double Slider)', defaultWidth: 3300, defaultHeight: 2790, operationalType: 'sliding' },
        { id: 'door_sidelite', name: 'Hinged Door with Fixed Sidelite', defaultWidth: 1350, defaultHeight: 2200, operationalType: 'hinged' },
        { id: 'bifold_door', name: 'Bi-Folding Door System', defaultWidth: 3000, defaultHeight: 2400, operationalType: 'sliding' },
      ],
    },
    {
      id: 'showers',
      name: 'Bathroom & Shower Glass',
      slug: 'shower',
      types: [
        { id: 'fixed_shower_screen', name: 'Fixed Walk-in Glass Screen', defaultWidth: 1000, defaultHeight: 2000, operationalType: 'fixed' },
        { id: 'inline_shower_door', name: 'Hinged Shower Door (Inline Setup)', defaultWidth: 1200, defaultHeight: 2000, operationalType: 'hinged' },
        { id: 'sliding_shower_enclosure', name: 'Sliding / Bypass Shower Enclosure', defaultWidth: 1500, defaultHeight: 2000, operationalType: 'sliding' },
        { id: 'corner_shower_enclosure', name: '90-Degree Corner Enclosure', defaultWidth: 1200, defaultHeight: 2000, operationalType: 'fixed' },
      ],
    },
  ];

  for (const cat of defaultCatalog) {
    const createdCat = await prisma.category.create({
      data: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
      },
    });
    console.log(`Category seeded: ${createdCat.name}`);

    for (const t of cat.types) {
      await prisma.subType.create({
        data: {
          id: t.id,
          categoryId: createdCat.id,
          name: t.name,
          slug: t.id,
          defaultWidth: t.defaultWidth,
          defaultHeight: t.defaultHeight,
          operationalType: t.operationalType,
        },
      });
      console.log(`  Sub-type seeded: ${t.name}`);
    }
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    // We don't have to close the adapter manually in this prisma version,
    // but the node process will exit when finished.
  });
