import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import { getServerEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool; mysqlPoolUrl?: string };

function createPool(uri: string) {
  return mysql.createPool({ uri, connectionLimit: 10, timezone: "Z", enableKeepAlive: true });
}

const resolvedUrl = getServerEnv().DATABASE_URL;
// A development HMR cycle can retain globals created before an environment
// target changed. Reuse a pool only when it belongs to the resolved database.
export const pool = globalForDb.mysqlPool && globalForDb.mysqlPoolUrl === resolvedUrl ? globalForDb.mysqlPool : createPool(resolvedUrl);
if (process.env.NODE_ENV !== "production") { globalForDb.mysqlPool = pool; globalForDb.mysqlPoolUrl = resolvedUrl; }
export const db = drizzle({ client: pool, schema, mode: "default" });
