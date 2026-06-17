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
