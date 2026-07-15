import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Esto obliga a cargar las variables del archivo .env.local de Next.js
dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: 'require',
  },
});