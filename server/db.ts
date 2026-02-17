import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;

function shouldUseNeonDriver(url: string): boolean {
  const driver = (process.env.DB_DRIVER || "").toLowerCase();
  if (driver === "pg") {
    return false;
  }
  if (driver === "neon") {
    return true;
  }

  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("neon.tech");
  } catch {
    // Default to Neon driver unless explicitly overridden.
    return true;
  }
}

const useNeonDriver = shouldUseNeonDriver(databaseUrl);
const NodePgPool = pg.Pool;
type NodePgPoolInstance = InstanceType<typeof NodePgPool>;

if (useNeonDriver) {
  neonConfig.webSocketConstructor = ws;
}

export const pool = useNeonDriver
  ? new NeonPool({ connectionString: databaseUrl })
  : new NodePgPool({ connectionString: databaseUrl });

export const db = useNeonDriver
  ? drizzleNeon({ client: pool as NeonPool, schema })
  : drizzleNodePg({ client: pool as NodePgPoolInstance, schema });
