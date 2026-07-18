import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { pool } from "./pool";

function resolveSchemaPath(): string {
  const candidates = [
    join(__dirname, "schema.sql"),
    join(process.cwd(), "src", "db", "schema.sql"),
    join(process.cwd(), "dist", "db", "schema.sql"),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`schema.sql not found. Tried: ${candidates.join(", ")}`);
  }
  return found;
}

async function migrate(): Promise<void> {
  const schemaPath = resolveSchemaPath();
  const sql = readFileSync(schemaPath, "utf8");
  await pool.query(sql);
  console.log(`Migrations applied successfully (${schemaPath})`);
  await pool.end();
}

migrate().catch(async (err) => {
  console.error("Migration failed:", err);
  await pool.end();
  process.exit(1);
});
