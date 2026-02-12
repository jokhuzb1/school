import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { getEnvFilePath } from './app/runtime/paths';

// Ensure env is loaded before Prisma Client initialization.
dotenv.config({ path: getEnvFilePath(".env") });

// Force local query engine mode to avoid accidental Data Proxy runtime.
if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = 'library';
}

const datasourceUrl = process.env.DATABASE_URL || '';
if (!datasourceUrl) {
  throw new Error('DATABASE_URL is missing. Set it in .env before starting the server.');
}

const prisma = new PrismaClient();

export default prisma;
