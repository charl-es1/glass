import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';

// Instantiate the better-sqlite3 database connection
const getPrismaInstance = () => {
  let dbUrl = '';

  if (process.env.VERCEL === '1') {
    // Vercel serverless workaround: copy the DB file from read-only project folder to writable /tmp
    const srcPath = path.join(process.cwd(), 'prisma', 'dev.db');
    const destPath = '/tmp/dev.db';

    try {
      if (!fs.existsSync(destPath)) {
        console.log(`Copying database to writable path: ${destPath}`);
        fs.copyFileSync(srcPath, destPath);
        // Ensure write permissions
        fs.chmodSync(destPath, 0o666);
      }
    } catch (err) {
      console.error('Failed to copy database to /tmp:', err);
    }
    dbUrl = 'file:' + destPath;
  } else {
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    dbUrl = 'file:' + dbPath;
  }

  const adapter = new PrismaBetterSqlite3({
    url: dbUrl,
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
