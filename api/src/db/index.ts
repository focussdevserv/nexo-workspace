import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL não configurada. Copie api/.env.example para api/.env.');

export const pool = new Pool({ connectionString, max: Number(process.env.DB_POOL_SIZE || 10), connectionTimeoutMillis: 5000 });
export const db = drizzle(pool, { schema });
