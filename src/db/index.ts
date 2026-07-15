import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { parseDbUrl } from './connection';

const { host, port, database, username, password } = parseDbUrl(process.env.DATABASE_URL!);

const client = postgres({ host, port, database, username, password, ssl: 'require', prepare: false });
export const db = drizzle(client);
