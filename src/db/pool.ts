import { Pool } from "pg";
import { config } from "../config";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error", err);
});

export async function pingDb(): Promise<boolean> {
  const result = await pool.query("SELECT 1 AS ok");
  return result.rows[0]?.ok === 1;
}
