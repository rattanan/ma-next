import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import { getServerEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool };

function createPool() {
  const uri = getServerEnv().DATABASE_URL;
  return mysql.createPool({ uri, connectionLimit: 10, timezone: "Z", enableKeepAlive: true });
}

export const pool = globalForDb.mysqlPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.mysqlPool = pool;
export const db = drizzle({ client: pool, schema, mode: "default" });
