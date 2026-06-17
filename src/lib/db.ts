import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import 'dotenv/config';

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

// Instantiate the better-sqlite3 database connection
const getPrismaInstance = () => {
  const adapter = new PrismaBetterSqlite3({
    url: 'file:' + dbPath,
  });
  return new PrismaClient({ adapter });
};

// Global type augmentation
declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma ?? getPrismaInstance();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export default prisma;
